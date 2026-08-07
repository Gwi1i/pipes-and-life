/**
 * TERRENO — modelo digital de elevaciones generado por procedimiento.
 *
 * Guarda una malla regular de cotas y sabe interpolar la altitud en
 * cualquier punto. Además se dibuja a sí mismo en un lienzo aparte que
 * se genera UNA VEZ: el terreno no cambia, así que repintarlo en cada
 * fotograma sería tirar rendimiento a la basura.
 */

import { CONFIG } from './config.js';
import { generadorAleatorio, interpolar, suavizar, limitar,
         normalizar, colorDeRampa, rgb, distanciaASegmento } from './util.js';

export class Terreno {

  constructor(){
    const m = CONFIG.mundo;
    this.ancho = m.ancho;
    this.alto  = m.alto;
    this.paso  = m.resolucion;

    // Dimensiones de la malla (+1 para incluir el borde derecho e inferior)
    this.cols = Math.ceil(m.ancho / this.paso) + 1;
    this.filas = Math.ceil(m.alto  / this.paso) + 1;

    // Float32Array en vez de array normal: menos memoria y más rápido.
    this.cotas = new Float32Array(this.cols * this.filas);

    this.generar(m.semilla);
    this.calcularHidrologia();   // cauces y manantiales
    this.lienzo = null;          // se rellena en dibujarCapa()
  }

  /* ------------------------------------------------------------------
     GENERACIÓN
     Ruido de valor con varias octavas. Cada octava añade detalle a mitad
     de amplitud y doble de frecuencia; sumadas dan un relieve creíble.
     ------------------------------------------------------------------ */

  generar(semilla){
    const azar = generadorAleatorio(semilla);

    // Rejillas de valores aleatorios, una por octava
    const octavas = [
      { celdas: 4,  peso: 1.00 },
      { celdas: 9,  peso: 0.48 },
      { celdas: 19, peso: 0.24 },
      { celdas: 37, peso: 0.11 }
    ];

    octavas.forEach(o => {
      o.rejilla = [];
      for(let i = 0; i < (o.celdas + 1) * (o.celdas + 1); i++){
        o.rejilla.push(azar());
      }
    });

    let min = Infinity, max = -Infinity;
    const bruto = new Float32Array(this.cols * this.filas);

    for(let f = 0; f < this.filas; f++){
      for(let c = 0; c < this.cols; c++){
        const u = c / (this.cols - 1);
        const v = f / (this.filas - 1);

        let valor = 0, sumaPesos = 0;
        for(const o of octavas){
          valor += this.muestrearRejilla(o.rejilla, o.celdas, u, v) * o.peso;
          sumaPesos += o.peso;
        }
        valor /= sumaPesos;

        // Vertiente general: el mapa entero cae hacia el sureste. Sin una
        // dirección dominante de drenaje, el relleno de depresiones crea
        // mesetas planas y los cauces salen en zigzag.
        valor = valor * 0.62 + (1 - (u * 0.38 + v * 0.62)) * 0.55;

        // Valle principal excavado sobre esa vertiente: es donde se
        // concentrará el cauce y donde el jugador irá a captar.
        const distValle = Math.abs((v - 0.42) - (u - 0.5) * 0.55);
        valor -= Math.exp(-distValle * distValle * 26) * 0.34;

        bruto[f * this.cols + c] = valor;
        if(valor < min) min = valor;
        if(valor > max) max = valor;
      }
    }

    // Reescalar al rango de cotas real
    const { cotaMin, cotaMax } = CONFIG.mundo;
    for(let i = 0; i < bruto.length; i++){
      this.cotas[i] = interpolar(cotaMin, cotaMax, (bruto[i] - min) / (max - min));
    }
  }

  /** Interpolación bilineal suavizada dentro de una rejilla de ruido. */
  muestrearRejilla(rejilla, celdas, u, v){
    const x = u * celdas, y = v * celdas;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, celdas), y1 = Math.min(y0 + 1, celdas);
    const tx = suavizar(x - x0), ty = suavizar(y - y0);
    const n = celdas + 1;
    const a = interpolar(rejilla[y0 * n + x0], rejilla[y0 * n + x1], tx);
    const b = interpolar(rejilla[y1 * n + x0], rejilla[y1 * n + x1], tx);
    return interpolar(a, b, ty);
  }

  /* ==================================================================
     HIDROLOGÍA
     De dónde sale el agua. Se calcula igual que en un análisis
     hidrológico de verdad sobre un MDT:

       1. Rellenar depresiones (si no, los cauces se cortan)
       2. Dirección de flujo D8: cada celda vierte a su vecina más baja
       3. Acumulación: cuántas celdas drenan a través de cada una
       4. Donde la acumulación supera un umbral, hay cauce

     Es el mismo encadenamiento Fill → Flow Direction → Flow Accumulation
     que harías en QGIS o ArcMap. Aquí sirve para que el jugador vea de
     un vistazo dónde puede captar.
     ================================================================== */

  calcularHidrologia(){
    const n = this.cols * this.filas;

    // --- 1. Rellenar depresiones ---
    // Copia de trabajo: no tocamos las cotas reales del terreno, solo
    // las usadas para encaminar el agua.
    const z = Float32Array.from(this.cotas);
    for(let pasada = 0; pasada < 30; pasada++){
      let cambios = 0;
      for(let f = 1; f < this.filas - 1; f++){
        for(let c = 1; c < this.cols - 1; c++){
          const i = f * this.cols + c;
          let minVecino = Infinity;
          for(let df = -1; df <= 1; df++)
            for(let dc = -1; dc <= 1; dc++){
              if(df === 0 && dc === 0) continue;
              const v = z[(f + df) * this.cols + (c + dc)];
              if(v < minVecino) minVecino = v;
            }
          if(z[i] <= minVecino){ z[i] = minVecino + 0.02; cambios++; }
        }
      }
      if(cambios === 0) break;
    }

    // --- 2. Dirección de flujo D8 ---
    // Para cada celda, el índice de la vecina hacia la que vierte.
    const destino = new Int32Array(n).fill(-1);
    for(let f = 0; f < this.filas; f++){
      for(let c = 0; c < this.cols; c++){
        const i = f * this.cols + c;
        let mejor = -1, mayorPendiente = 0;
        for(let df = -1; df <= 1; df++){
          for(let dc = -1; dc <= 1; dc++){
            if(df === 0 && dc === 0) continue;
            const nf = f + df, nc = c + dc;
            if(nf < 0 || nc < 0 || nf >= this.filas || nc >= this.cols) continue;
            const j = nf * this.cols + nc;
            // Pendiente normalizada por la distancia (las diagonales son
            // más largas: √2 veces el lado de la celda)
            const dist = (df && dc) ? 1.41421 : 1;
            const pend = (z[i] - z[j]) / dist;
            if(pend > mayorPendiente){ mayorPendiente = pend; mejor = j; }
          }
        }
        destino[i] = mejor;
      }
    }

    // --- 3. Acumulación de flujo ---
    // Procesando las celdas de mayor a menor cota, cuando llegamos a una
    // ya han vertido en ella todas las que están por encima.
    const acumulacion = new Float32Array(n).fill(1);
    const orden = Array.from({ length: n }, (_, i) => i)
                       .sort((a, b) => z[b] - z[a]);
    for(const i of orden){
      const d = destino[i];
      if(d >= 0) acumulacion[d] += acumulacion[i];
    }

    this.acumulacion = acumulacion;
    this.destinoFlujo = destino;

    // --- 4. Extraer los cauces ---
    // Umbral: cuántas celdas tienen que drenar para considerar que hay río.
    const umbralRio = n * 0.022;
    const umbralArroyo = n * 0.0075;

    this.cauces = [];
    for(let f = 0; f < this.filas; f++){
      for(let c = 0; c < this.cols; c++){
        const i = f * this.cols + c;
        if(acumulacion[i] < umbralArroyo) continue;
        const d = destino[i];
        if(d < 0) continue;
        const fd = Math.floor(d / this.cols), cd = d % this.cols;
        this.cauces.push({
          x1: c * this.paso,  y1: f * this.paso,
          x2: cd * this.paso, y2: fd * this.paso,
          acum: acumulacion[i],
          principal: acumulacion[i] >= umbralRio
        });
      }
    }

    // --- 5. Manantiales ---
    // Puntos altos con algo de cuenca detrás: poco caudal, pero a cota,
    // que es justo lo que hace útil un manantial.
    this.manantiales = [];
    const azar = generadorAleatorio(CONFIG.mundo.semilla + 4242);
    const candidatos = [];
    for(let f = 2; f < this.filas - 2; f++){
      for(let c = 2; c < this.cols - 2; c++){
        const i = f * this.cols + c;
        const a = acumulacion[i];
        if(a > umbralArroyo * 0.30 && a < umbralArroyo * 0.85){
          const cota = this.cotas[i];
          const t = normalizar(cota, CONFIG.mundo.cotaMin, CONFIG.mundo.cotaMax);
          if(t > 0.55) candidatos.push({ x: c * this.paso, y: f * this.paso, cota, a });
        }
      }
    }
    // Repartirlos: nada de manantiales amontonados
    candidatos.sort(() => azar() - 0.5);
    for(const cand of candidatos){
      if(this.manantiales.length >= 5) break;
      if(this.manantiales.every(m => Math.hypot(m.x - cand.x, m.y - cand.y) > 620)){
        this.manantiales.push(cand);
      }
    }
  }

  /**
   * ¿Hay agua captable en este punto?
   * Devuelve la fuente y el caudal aprovechable, o null.
   */
  fuenteEn(x, y, radio = 90){
    // Manantiales primero: son puntuales y más fáciles de acertar
    for(const m of this.manantiales){
      if(Math.hypot(m.x - x, m.y - y) < radio * 1.4){
        return { tipo: 'manantial', caudal: 4.5, cota: m.cota,
                 nombre: 'Manantial' };
      }
    }
    // Cauces: se busca el tramo más próximo
    let mejor = null, mejorD = radio;
    for(const t of this.cauces){
      const d = distanciaASegmento(x, y, t.x1, t.y1, t.x2, t.y2);
      if(d < mejorD){ mejorD = d; mejor = t; }
    }
    if(mejor){
      // Caudal proporcional a la cuenca vertiente, con tope
      const q = Math.min(26, 2.5 + Math.sqrt(mejor.acum) * 0.55);
      return { tipo: mejor.principal ? 'rio' : 'arroyo', caudal: q,
               nombre: mejor.principal ? 'Río' : 'Arroyo' };
    }
    return null;
  }

  /* ------------------------------------------------------------------
     CONSULTA
     ------------------------------------------------------------------ */

  /** Cota (m) en cualquier punto del mundo, interpolada bilinealmente. */
  cotaEn(x, y){
    x = limitar(x, 0, this.ancho - 0.001);
    y = limitar(y, 0, this.alto  - 0.001);
    const cx = x / this.paso, cy = y / this.paso;
    const c0 = Math.floor(cx), f0 = Math.floor(cy);
    const c1 = Math.min(c0 + 1, this.cols - 1);
    const f1 = Math.min(f0 + 1, this.filas - 1);
    const tx = cx - c0, ty = cy - f0;
    const a = interpolar(this.cotas[f0 * this.cols + c0], this.cotas[f0 * this.cols + c1], tx);
    const b = interpolar(this.cotas[f1 * this.cols + c0], this.cotas[f1 * this.cols + c1], tx);
    return interpolar(a, b, ty);
  }

  /**
   * Busca un punto con la cota pedida, para colocar poblaciones.
   *
   * `ocupados` es la lista de puntos ya colocados: se exige una separación
   * mínima para que no caigan dos núcleos encima. Sin esta comprobación
   * el generador amontona las poblaciones que comparten preferencia de cota.
   */
  buscarPunto(preferencia, azar, ocupados = [], separacionMin = 550){
    const { cotaMin, cotaMax } = CONFIG.mundo;
    const rango = cotaMax - cotaMin;
    const rangos = {
      baja:  [cotaMin, cotaMin + rango * 0.38],
      media: [cotaMin + rango * 0.32, cotaMin + rango * 0.68],
      alta:  [cotaMin + rango * 0.62, cotaMax]
    };
    const [lo, hi] = rangos[preferencia] || rangos.media;

    let mejor = null, mejorPuntuacion = -Infinity;

    for(let intento = 0; intento < 3000; intento++){
      const x = 200 + azar() * (this.ancho - 400);
      const y = 200 + azar() * (this.alto  - 400);
      const cota = this.cotaEn(x, y);
      if(cota < lo || cota > hi) continue;

      // Distancia al vecino más próximo ya colocado
      let dMin = Infinity;
      for(const o of ocupados){
        const d = Math.hypot(x - o.x, y - o.y);
        if(d < dMin) dMin = d;
      }
      if(dMin < separacionMin) continue;   // demasiado cerca, se descarta

      // Puntuar: premia separarse de los vecinos y del centro del mapa
      const dCentro = Math.hypot(x - this.ancho / 2, y - this.alto / 2);
      const puntuacion = Math.min(dMin, separacionMin * 2.2) + dCentro * 0.35;
      if(puntuacion > mejorPuntuacion){
        mejorPuntuacion = puntuacion;
        mejor = { x, y, cota };
      }
    }

    // Si con la separación exigida no cabe, se relaja y se reintenta
    if(!mejor && separacionMin > 200){
      return this.buscarPunto(preferencia, azar, ocupados, separacionMin * 0.6);
    }
    return mejor || { x: this.ancho / 2, y: this.alto / 2,
                      cota: this.cotaEn(this.ancho / 2, this.alto / 2) };
  }

  /* ------------------------------------------------------------------
     DIBUJO
     Se pinta una sola vez sobre un lienzo fuera de pantalla y luego el
     render solo copia ese lienzo. Es la diferencia entre 60 fps y 5.
     ------------------------------------------------------------------ */

  dibujarCapa(){
    const escala = 0.5;   // el terreno no necesita resolución completa
    const w = Math.round(this.ancho * escala);
    const h = Math.round(this.alto  * escala);

    const lienzo = document.createElement('canvas');
    lienzo.width = w; lienzo.height = h;
    const ctx = lienzo.getContext('2d');

    const { cotaMin, cotaMax } = CONFIG.mundo;
    const imagen = ctx.createImageData(w, h);
    const datos = imagen.data;

    for(let py = 0; py < h; py++){
      for(let px = 0; px < w; px++){
        const mx = px / escala, my = py / escala;
        const cota = this.cotaEn(mx, my);
        const t = normalizar(cota, cotaMin, cotaMax);

        // Sombreado por pendiente: ilumina desde el noroeste, como un
        // plano topográfico sombreado de toda la vida.
        const dzdx = this.cotaEn(mx + 12, my) - this.cotaEn(mx - 12, my);
        const dzdy = this.cotaEn(mx, my + 12) - this.cotaEn(mx, my - 12);
        const sombra = limitar(0.72 + (-dzdx - dzdy) * 0.030, 0.42, 1.30);

        const base = colorDeRampa(CONFIG.rampaTerreno, t);
        const i = (py * w + px) * 4;
        datos[i]     = limitar(base[0] * sombra, 0, 255);
        datos[i + 1] = limitar(base[1] * sombra, 0, 255);
        datos[i + 2] = limitar(base[2] * sombra, 0, 255);
        datos[i + 3] = 255;
      }
    }
    ctx.putImageData(imagen, 0, 0);

    this.dibujarCurvas(ctx, escala);
    this.dibujarCauces(ctx, escala);
    this.lienzo = lienzo;
    this.escalaLienzo = escala;
    return lienzo;
  }

  /** Cauces y manantiales, sobre el terreno ya sombreado. */
  dibujarCauces(ctx, escala){
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Tres pasadas: halo ancho y oscuro, cuerpo del cauce, y brillo
    // central. Es lo que hace que un río se lea como agua y no como
    // una raya azul cualquiera.
    const pasadas = [
      { anchoExtra: 5.5, color: '#0a2733', alfa: 0.55 },
      { anchoExtra: 0,   color: '#2a7ba8', alfa: 0.95 },
      { anchoExtra: -1.6,color: '#7dd3fc', alfa: 0.75 }
    ];

    for(const pasada of pasadas){
      for(const principal of [false, true]){
        for(const t of this.cauces){
          if(t.principal !== principal) continue;
          // El cauce engorda aguas abajo con la raíz de su cuenca
          const base = Math.max(1.6, Math.sqrt(t.acum) * 0.075) * escala * 2;
          const ancho = base + pasada.anchoExtra;
          if(ancho <= 0) continue;
          ctx.strokeStyle = pasada.color;
          ctx.lineWidth = ancho;
          ctx.globalAlpha = pasada.alfa * (principal ? 1 : 0.72);
          ctx.beginPath();
          ctx.moveTo(t.x1 * escala, t.y1 * escala);
          ctx.lineTo(t.x2 * escala, t.y2 * escala);
          ctx.stroke();
        }
      }
    }

    // Manantiales: diana turquesa, bien visible
    for(const m of this.manantiales){
      const x = m.x * escala, y = m.y * escala, r = 4.2 * escala * 2;
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = '#5eead4';
      ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5eead4';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#062a2c'; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Curvas de nivel por marching squares simplificado.
   * Para cada celda de la malla se mira qué aristas cruza la curva y se
   * traza el segmento correspondiente. Es el mismo principio que usa
   * cualquier software topográfico.
   */
  dibujarCurvas(ctx, escala){
    const { equidistancia, cotaMin, cotaMax } = CONFIG.mundo;
    const primera = Math.ceil(cotaMin / equidistancia) * equidistancia;

    for(let nivel = primera; nivel < cotaMax; nivel += equidistancia){
      const maestra = Math.abs(nivel % (equidistancia * 5)) < 0.01;
      ctx.strokeStyle = maestra ? CONFIG.color.curvaMaestra : CONFIG.color.curva;
      ctx.lineWidth   = maestra ? 1.35 : 0.7;
      ctx.globalAlpha = maestra ? 0.95 : 0.68;
      ctx.beginPath();

      for(let f = 0; f < this.filas - 1; f++){
        for(let c = 0; c < this.cols - 1; c++){
          const z = [
            this.cotas[f * this.cols + c],
            this.cotas[f * this.cols + c + 1],
            this.cotas[(f + 1) * this.cols + c + 1],
            this.cotas[(f + 1) * this.cols + c]
          ];
          const x0 = c * this.paso * escala, y0 = f * this.paso * escala;
          const p = this.paso * escala;

          // Puntos de corte en las cuatro aristas de la celda
          const cortes = [];
          const aristas = [[0,1,x0,y0,x0+p,y0],[1,2,x0+p,y0,x0+p,y0+p],
                           [2,3,x0+p,y0+p,x0,y0+p],[3,0,x0,y0+p,x0,y0]];
          for(const [a,b,ax,ay,bx,by] of aristas){
            if((z[a] - nivel) * (z[b] - nivel) < 0){
              const t = (nivel - z[a]) / (z[b] - z[a]);
              cortes.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
            }
          }
          // Con dos cortes hay un segmento limpio; con cuatro es un punto
          // de silla y lo dejamos pasar (simplificación aceptable).
          if(cortes.length === 2){
            ctx.moveTo(cortes[0][0], cortes[0][1]);
            ctx.lineTo(cortes[1][0], cortes[1][1]);
          }
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
