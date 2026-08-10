/**
 * ESCENA MAPA — la vista principal del juego: el territorio.
 *
 * Dibuja la cuadrícula grande con niebla, la cámara que se arrastra, el
 * progreso de los clics sobre cada casilla y los hallazgos. Como el resto de
 * escenas, SOLO LEE el estado: quien mueve la cámara o destapa casillas es
 * `main.js` a partir de las acciones de `entrada.js`.
 *
 * Solo se dibujan las casillas que caen en pantalla: el mapa tiene más de mil
 * y pintarlas todas cada fotograma sería tirar rendimiento.
 */

import { CONFIG } from './config.js';
import { celdaEn, clicsParaDestapar, esAlcanzable, puedeColocar,
         puedeSeguirTrazado, costeTrazado, costeCasillaTuberia,
         diametro, nivelDiametro, redDe } from './mapa.js';
import { poderExpansion, llenadoVaso } from './simulacion.js';
import { formatear } from './util.js';
import { limitar } from './util.js';
import { Escena, mezclarColor, oscurecer, aclarar } from './escena.js';

export class EscenaMapa extends Escena {

  constructor(lienzo){
    super(lienzo);
    this.zoom = 1;
    this.centrada = false;
    this.resaltada = null;    // { col, fila } bajo el cursor
  }

  /** Píxeles por casilla al zoom actual. */
  get tam(){ return CONFIG.mapaMundo.tamTesela * this.zoom; }

  /* ---------- conversiones pantalla <-> mapa ---------- */

  celdaEnPantalla(estado, px, py){
    const t = this.tam;
    return {
      col: Math.floor((px + estado.camara.x) / t),
      fila: Math.floor((py + estado.camara.y) / t)
    };
  }

  /**
   * Zoom con la rueda, manteniendo bajo el cursor el mismo punto del mapa. Sin
   * esto la vista salta y te pierdes el sitio que estabas mirando.
   */
  ampliar(estado, delta, px, py){
    const M = CONFIG.mapaMundo;
    // qué casilla (con decimales) hay bajo el cursor ANTES de ampliar
    const antesCol = (px + estado.camara.x) / this.tam;
    const antesFila = (py + estado.camara.y) / this.tam;

    this.zoom = limitar(this.zoom * Math.exp(-delta * M.velocidadZoom),
                        M.zoomMin, M.zoomMax);

    // recolocar la cámara para que esa misma casilla siga bajo el cursor
    estado.camara.x = antesCol * this.tam - px;
    estado.camara.y = antesFila * this.tam - py;
    this.limitarCamara(estado);
  }

  /** Centra la cámara en el pueblo de origen (solo la primera vez). */
  centrarEnOrigen(estado){
    const M = CONFIG.mapaMundo;
    this.centrarEn(estado, M.origen.col, M.origen.fila);
    this.centrada = true;
  }

  /** Lleva la vista a una casilla concreta (el botón de "ir a la avería"). */
  centrarEn(estado, col, fila){
    const t = this.tam;
    estado.camara.x = col * t + t / 2 - this.ancho / 2;
    estado.camara.y = fila * t + t / 2 - this.alto / 2;
    this.limitarCamara(estado);
  }

  /** Que la cámara no se salga del mundo. */
  limitarCamara(estado){
    const M = CONFIG.mapaMundo, t = this.tam;
    const maxX = Math.max(0, M.cols * t - this.ancho);
    const maxY = Math.max(0, M.filas * t - this.alto);
    estado.camara.x = limitar(estado.camara.x, 0, maxX);
    estado.camara.y = limitar(estado.camara.y, 0, maxY);
  }

  /* ================================================================
     DIBUJO
     ================================================================ */

  dibujar(estado, resultado, dt){
    this.prepararFotograma(estado, resultado, dt);
    const ctx = this.ctx, W = this._W, H = this._H;
    if(!this.centrada) this.centrarEnOrigen(estado);
    this.limitarCamara(estado);

    ctx.fillStyle = '#070d14';
    ctx.fillRect(0, 0, W, H);

    // El coste de cada casilla depende de cómo lleves el abastecimiento
    this.poder = poderExpansion(estado);

    const t = this.tam, M = CONFIG.mapaMundo;
    const c0 = Math.max(0, Math.floor(estado.camara.x / t));
    const f0 = Math.max(0, Math.floor(estado.camara.y / t));
    const c1 = Math.min(M.cols - 1, Math.ceil((estado.camara.x + W) / t));
    const f1 = Math.min(M.filas - 1, Math.ceil((estado.camara.y + H) / t));

    for(let f = f0; f <= f1; f++){
      for(let c = c0; c <= c1; c++){
        const celda = celdaEn(estado.mapa, c, f);
        if(!celda) continue;
        const x = Math.round(c * t - estado.camara.x);
        const y = Math.round(f * t - estado.camara.y);
        celda.oculta ? this.dibujarNiebla(estado, celda, c, f, x, y, t)
                     : this.dibujarTerreno(celda, c, f, x, y, t);
      }
    }

    this.contornoExplorado(estado, c0, f0, c1, f1);
    this.dibujarTuberias(estado);
    // Los hallazgos van DESPUES de las tuberias: pintados junto al terreno, una
    // conduccion que pasara por encima del pueblo lo tapaba, y el icono del
    // pueblo es justo lo que no puede desaparecer del mapa.
    this.dibujarHallazgos(estado);
    this.dibujarConstrucciones(estado);
    this.previsualizar(estado);
    this.marcoResaltado(estado);
    this.velosDeAmbiente();
    this.dibujarAverias(estado);
    this.destellosClic();
  }

  /* ---------- casilla descubierta ---------- */
  /**
   * La referencia es un idle builder de vista cenital, y lo que define ese
   * estilo no son los dibujos: es que el terreno se lee como un CAMPO CONTINUO
   * con un tablero encima, no como un mosaico de cuadros de colores.
   *
   * De ahí las tres decisiones que mandan aquí:
   *   · variación mínima entre casillas (damero suavísimo, no ruido fuerte),
   *   · rejilla clara pintada POR ENCIMA de todo, agua incluida,
   *   · orilla de arena donde la tierra da al agua.
   *
   * Todo Canvas 2D a mano y esto corre por casilla visible y fotograma, así que
   * las operaciones son baratas a propósito.
   */
  dibujarTerreno(celda, c, f, x, y, t){
    const ctx = this.ctx;
    const E = CONFIG.estiloMapa;
    const def = CONFIG.terrenos[celda.tipo] || CONFIG.terrenos.hierba;
    const v = ruido(c, f);
    const esAgua = celda.tipo === 'agua' || celda.tipo === 'lago';

    // Damero muy suave + una pizca de ruido. La clave es que sea POCO: con
    // variación fuerte por celda el prado parece papel pintado descosido.
    const par = (c + f) % 2 === 0;
    let base = mezclarColor(def.color, par ? '#ffffff' : '#000000', E.damero);
    base = mezclarColor(base, v > 0.5 ? '#ffffff' : '#000000', Math.abs(v - 0.5) * E.variacion);
    if(esAgua && celda.insalubre > 0)
      base = mezclarColor(base, '#7a6a34', Math.min(0.75, celda.insalubre));
    // La FICHA: cuadrado redondeado con hueco alrededor. Todo lo de dentro se
    // recorta contra ella, asi el terreno nunca se sale de su tesela.
    const g = t * E.separacion, r = t * E.radio;
    const fx = x + g, fy = y + g, fl = t - g * 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(fx, fy, fl, fl, r);
    ctx.clip();

    ctx.fillStyle = base;
    ctx.fillRect(fx, fy, fl, fl);

    if(esAgua) this.pintarAgua(celda, c, f, fx, fy, fl, base);
    else this.pintarTierra(celda, c, f, fx, fy, fl, base, v);
    if(!esAgua) this.pintarOrilla(c, f, fx, fy, fl);

    // Luz arriba y sombra abajo DENTRO de la ficha: es lo que le da grosor y la
    // separa del fondo sin necesidad de contorno duro.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(fx, fy, fl, Math.max(1, fl * 0.06));
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(fx, fy + fl - Math.max(1, fl * 0.08), fl, Math.max(1, fl * 0.08));
    ctx.restore();

    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = Math.max(1, t * 0.015);
    ctx.beginPath(); ctx.roundRect(fx, fy, fl, fl, r); ctx.stroke();

  }

  /** Agua: ondas que corren, sin oscurecer tanto que pierda el color. */
  pintarAgua(celda, c, f, x, y, t, base){
    const ctx = this.ctx;
    if(celda.insalubre > 0){
      ctx.fillStyle = `rgba(130,110,50,${0.22 * celda.insalubre})`;
      for(const p of [[0.28, 0.34, 0.10], [0.62, 0.55, 0.08], [0.44, 0.72, 0.07]]){
        ctx.beginPath(); ctx.arc(x + t * p[0], y + t * p[1], t * p[2], 0, 7); ctx.fill();
      }
    }
    const desf = c * 0.7 + f * 1.3;
    for(let k = 0; k < 2; k++){
      ctx.strokeStyle = `rgba(255,255,255,${0.16 - k * 0.05})`;
      ctx.lineWidth = Math.max(1, t * 0.022);
      const yy = y + t * (0.32 + k * 0.30);
      ctx.beginPath();
      for(let i = 0; i <= 6; i++){
        const xx = x + (t * i) / 6;
        const oy = Math.sin(i * 1.1 + this.tiempo * 1.5 + desf + k) * t * 0.03;
        i ? ctx.lineTo(xx, yy + oy) : ctx.moveTo(xx, yy + oy);
      }
      ctx.stroke();
    }
  }

  /** Tierra: mata de hierba, arbolado o roca, según lo que sea. */
  pintarTierra(celda, c, f, x, y, t, base, v){
    const ctx = this.ctx;

    if(celda.tipo === 'hierba'){
      ctx.strokeStyle = mezclarColor(base, '#000000', 0.18);
      ctx.lineWidth = Math.max(1, t * 0.02);
      for(let k = 0; k < 3; k++){
        const px = x + t * (0.2 + ((v * 7 + k * 0.37) % 1) * 0.6);
        const py = y + t * (0.35 + ((v * 13 + k * 0.61) % 1) * 0.5);
        const alto = t * 0.09;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + alto * 0.4, py - alto * 0.6, px + alto * 0.15, py - alto);
        ctx.stroke();
      }
      return;
    }

    if(celda.tipo === 'bosque'){
      // CONIFERAS en 3/4, no copas redondas vistas desde arriba. Cada una son
      // tres faldones superpuestos que estrechan hacia arriba, con la mitad
      // izquierda clara y la derecha en sombra: misma luz que los edificios.
      const puntos = [[0.30, 0.62, 1.00], [0.62, 0.52, 0.86], [0.46, 0.82, 0.72]];
      const verde = CONFIG.terrenos.bosque.color;
      const claro = aclarar(verde, 0.20), oscuro = oscurecer(verde, 0.42);
      for(let i = 0; i < puntos.length; i++){
        const px = x + t * puntos[i][0], baseY = y + t * puntos[i][1];
        const esc = puntos[i][2] * (0.9 + ((v * 3 + i * 0.29) % 1) * 0.25);
        const an = t * 0.15 * esc, alto = t * 0.42 * esc;

        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(px + an * 0.35, baseY, an * 0.95, an * 0.34, 0, 0, 7);
        ctx.fill();

        ctx.fillStyle = '#4a3524';
        ctx.fillRect(px - an * 0.10, baseY - alto * 0.20, an * 0.20, alto * 0.20);

        for(let k = 0; k < 3; k++){
          const w = an * (1 - k * 0.24);
          const yb = baseY - alto * (0.16 + k * 0.26);
          const yt = yb - alto * 0.36;
          ctx.fillStyle = claro;
          ctx.beginPath();
          ctx.moveTo(px, yt); ctx.lineTo(px - w, yb); ctx.lineTo(px, yb);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = oscuro;
          ctx.beginPath();
          ctx.moveTo(px, yt); ctx.lineTo(px + w, yb); ctx.lineTo(px, yb);
          ctx.closePath(); ctx.fill();
        }
      }
      return;
    }

    if(celda.tipo === 'montana'){
      const cima = [x + t * 0.50, y + t * 0.24];
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.beginPath();
      ctx.ellipse(x + t * 0.55, y + t * 0.80, t * 0.32, t * 0.08, 0, 0, 7); ctx.fill();

      ctx.fillStyle = aclarar(CONFIG.terrenos.montana.color, 0.26);
      ctx.beginPath();
      ctx.moveTo(cima[0], cima[1]); ctx.lineTo(x + t * 0.18, y + t * 0.78);
      ctx.lineTo(x + t * 0.50, y + t * 0.78); ctx.closePath(); ctx.fill();
      ctx.fillStyle = oscurecer(CONFIG.terrenos.montana.color, 0.20);
      ctx.beginPath();
      ctx.moveTo(cima[0], cima[1]); ctx.lineTo(x + t * 0.82, y + t * 0.78);
      ctx.lineTo(x + t * 0.50, y + t * 0.78); ctx.closePath(); ctx.fill();

      ctx.fillStyle = '#f2f7fb';
      ctx.beginPath();
      ctx.moveTo(cima[0], cima[1]);
      ctx.lineTo(x + t * 0.39, y + t * 0.41);
      ctx.lineTo(x + t * 0.46, y + t * 0.37);
      ctx.lineTo(x + t * 0.54, y + t * 0.44);
      ctx.lineTo(x + t * 0.61, y + t * 0.41);
      ctx.closePath(); ctx.fill();
    }
  }

  /**
   * LA ORILLA. Donde la tierra da al agua se pinta una franja de arena por el
   * lado que toca. Es un detalle pequeño y es, con diferencia, lo que más cambia
   * la cara del mapa: sin él, el río es un rectángulo azul recortado con tijera.
   */
  pintarOrilla(c, f, x, y, t){
    const ctx = this.ctx;
    const mapa = this._estado && this._estado.mapa;
    if(!mapa) return;
    const ancho = Math.max(2, t * 0.14);
    ctx.fillStyle = 'rgba(222,205,158,0.60)';
    const lados = [
      [0, -1, x, y, t, ancho],
      [0,  1, x, y + t - ancho, t, ancho],
      [-1, 0, x, y, ancho, t],
      [1,  0, x + t - ancho, y, ancho, t]
    ];
    for(const l of lados){
      const vec = celdaEn(mapa, c + l[0], f + l[1]);
      if(!vec || vec.oculta) continue;
      if(vec.tipo !== 'agua' && vec.tipo !== 'lago') continue;
      ctx.fillRect(l[2], l[3], l[4], l[5]);
    }
  }

  /**
   * EL CONTORNO DE LO EXPLORADO. Una linea dorada que rodea todo el territorio
   * abierto, no tesela a tesela: se dibuja solo el lado de cada casilla que da a
   * lo desconocido, y el conjunto sale como un unico perimetro continuo.
   *
   * Es lo que convierte un monton de casillas destapadas en TU territorio.
   */
  contornoExplorado(estado, c0, f0, c1, f1){
    const ctx = this.ctx, t = this.tam, E = CONFIG.estiloMapa;
    const g = t * E.separacion;
    ctx.strokeStyle = CONFIG.color.dorado;
    ctx.lineWidth = Math.max(2, t * 0.045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for(let f = f0; f <= f1; f++){
      for(let c = c0; c <= c1; c++){
        const celda = celdaEn(estado.mapa, c, f);
        if(!celda || celda.oculta) continue;
        const x = Math.round(c * t - estado.camara.x) + g;
        const y = Math.round(f * t - estado.camara.y) + g;
        const l = t - g * 2;
        // solo el lado que da a lo desconocido (o al borde del mundo)
        const lados = [[0, -1, x, y, x + l, y],
                       [0,  1, x, y + l, x + l, y + l],
                       [-1, 0, x, y, x, y + l],
                       [1,  0, x + l, y, x + l, y + l]];
        for(const s of lados){
          const vec = celdaEn(estado.mapa, c + s[0], f + s[1]);
          if(vec && !vec.oculta) continue;
          ctx.moveTo(s[2], s[3]); ctx.lineTo(s[4], s[5]);
        }
      }
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  /** Pasada de hallazgos: pueblos, ruinas y yacimientos, por encima de las redes. */
  dibujarHallazgos(estado){
    const t = this.tam, M = CONFIG.mapaMundo;
    const c0 = Math.max(0, Math.floor(estado.camara.x / t));
    const f0 = Math.max(0, Math.floor(estado.camara.y / t));
    const c1 = Math.min(M.cols - 1, Math.ceil((estado.camara.x + this._W) / t));
    const f1 = Math.min(M.filas - 1, Math.ceil((estado.camara.y + this._H) / t));
    for(let f = f0; f <= f1; f++){
      for(let c = c0; c <= c1; c++){
        const celda = celdaEn(estado.mapa, c, f);
        if(!celda || celda.oculta || !celda.hallazgo) continue;
        this.dibujarHallazgo(celda, Math.round(c * t - estado.camara.x),
                             Math.round(f * t - estado.camara.y), t);
      }
    }
  }

  /* ---------- lo que esconde una casilla ---------- */
  dibujarHallazgo(celda, x, y, t){
    const ctx = this.ctx;
    const col = CONFIG.hallazgos.color[celda.hallazgo] || '#ffffff';
    const cx = x + t / 2, cy = y + t / 2;

    // Una ruina atendida YA NO ESTÁ: o te la has llevado al almacén o la has
    // puesto en marcha y ahora hay una construcción encima. Seguir pintando el
    // muro roto dejaba fantasmas por el mapa y ensuciaba la pieza reparada.
    if(celda.resuelto && celda.hallazgo === 'ruina') return;

    if(!celda.resuelto){   // aún por atender: late para que se vea
      const pulso = 0.5 + Math.sin(this.tiempo * 3) * 0.5;
      ctx.globalAlpha = 0.25 + pulso * 0.35;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(cx, cy, t * 0.42, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Los pueblos y los yacimientos sí siguen ahí: son referencias del terreno.
    // Se apagan para que se lea de un vistazo que ya están atendidos.
    if(celda.resuelto) ctx.globalAlpha = 0.4;
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(6,15,24,0.6)'; ctx.lineWidth = 1.6;
    const s = t * 0.17;
    ctx.beginPath();
    if(celda.hallazgo === 'pueblo'){          // casita
      ctx.moveTo(cx - s, cy + s); ctx.lineTo(cx - s, cy - s * 0.2);
      ctx.lineTo(cx, cy - s * 1.1); ctx.lineTo(cx + s, cy - s * 0.2);
      ctx.lineTo(cx + s, cy + s); ctx.closePath();
    } else if(celda.hallazgo === 'ruina'){    // muro roto
      ctx.moveTo(cx - s, cy + s); ctx.lineTo(cx - s, cy - s * 0.6);
      ctx.lineTo(cx - s * 0.2, cy - s * 0.6); ctx.lineTo(cx - s * 0.2, cy - s * 1.1);
      ctx.lineTo(cx + s * 0.5, cy - s * 1.1); ctx.lineTo(cx + s * 0.5, cy);
      ctx.lineTo(cx + s, cy); ctx.lineTo(cx + s, cy + s); ctx.closePath();
    } else {                                   // yacimiento: cristal
      ctx.moveTo(cx, cy - s * 1.1); ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s * 1.1); ctx.lineTo(cx - s, cy); ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ---------- casilla tapada ---------- */
  /**
   * La niebla no es un cuadrado gris: es bruma posada sobre terreno que aún no
   * has pisado. Se pintan tres borrones por celda con el ruido de la propia
   * casilla, así el frente de exploración tiene bordes irregulares en vez de
   * parecer un muro de ladrillos.
   */
  dibujarNiebla(estado, celda, c, f, x, y, t){
    const ctx = this.ctx;
    const alcanzable = esAlcanzable(estado.mapa, c, f);
    const v = ruido(c, f);

    // La niebla es una ficha más, con el mismo hueco y el mismo redondeo: si la
    // tapada fuera un cuadrado a sangre, el frente de exploración se vería como
    // un muro liso en vez de como fichas por levantar.
    const E = CONFIG.estiloMapa;
    const g = t * E.separacion, r = t * E.radio;
    const fx = x + g, fy = y + g, fl = t - g * 2;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(fx, fy, fl, fl, r); ctx.clip();
    ctx.fillStyle = alcanzable ? '#26364a' : '#151d29';
    ctx.fillRect(fx, fy, fl, fl);

    // borrones de bruma: dan volumen y rompen la cuadrícula
    const tono = alcanzable ? 255 : 200;
    for(let k = 0; k < 3; k++){
      const px = x + t * (0.22 + ((v * 11 + k * 0.41) % 1) * 0.56);
      const py = y + t * (0.24 + ((v * 17 + k * 0.73) % 1) * 0.52);
      const r = t * (0.20 + ((v * 5 + k * 0.29) % 1) * 0.16);
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${tono},${tono},${tono},${alcanzable ? 0.075 : 0.035})`);
      g.addColorStop(1, `rgba(${tono},${tono},${tono},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
    }

    if(alcanzable){
      const faltan = clicsParaDestapar(c, f, celda.tipo, this.poder);
      const frac = celda.progreso / faltan;

      if(frac > 0){   // aro de progreso
        const r = t * 0.3;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = Math.max(3, t * 0.07);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x + t / 2, y + t / 2, r, 0, 7); ctx.stroke();
        ctx.strokeStyle = CONFIG.color.agua;
        ctx.beginPath();
        ctx.arc(x + t / 2, y + t / 2, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
      // clics que quedan
      ctx.font = `700 ${Math.round(t * 0.2)}px IBM Plex Mono, ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(207,220,232,0.85)';
      ctx.fillText(String(faltan - celda.progreso), x + t / 2, y + t / 2);
      ctx.textBaseline = 'alphabetic';
    } else {
      ctx.fillStyle = 'rgba(207,220,232,0.10)';
      ctx.font = `700 ${Math.round(t * 0.26)}px IBM Plex Sans, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', x + t / 2, y + t / 2);
      ctx.textBaseline = 'alphabetic';
    }

    ctx.restore();

    // Contorno de la ficha. Las que ya puedes abrir llevan filo claro: es lo que
    // enseña de un vistazo hasta dónde llegas.
    ctx.strokeStyle = alcanzable ? 'rgba(150,190,225,0.40)' : 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, t * 0.015);
    ctx.beginPath(); ctx.roundRect(fx, fy, fl, fl, r); ctx.stroke();
  }

  /* ---------- tuberías tendidas ---------- */
  dibujarTuberias(estado){
    const ctx = this.ctx, t = this.tam;
    if(!estado.tuberias.length) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for(const tub of estado.tuberias){
      const pts = tub.camino.map(p => ({
        x: p.col * t - estado.camara.x + t / 2,
        y: p.fila * t - estado.camara.y + t / 2
      }));
      // Se ven las dos cosas de un vistazo y sin leer ninguna tabla: el COLOR
      // dice qué red es (agua limpia o colector) y el GROSOR el diámetro, que es
      // donde está el cuello de botella.
      const R = CONFIG.redes[redDe(tub)] || CONFIG.redes.abastecimiento;
      const escala = 1 + nivelDiametro(tub.dn, redDe(tub)) * 0.55;
      ctx.strokeStyle = '#1b2836'; ctx.lineWidth = Math.max(4, t * 0.16 * escala);
      this.trazo(pts);
      ctx.strokeStyle = R.color; ctx.lineWidth = Math.max(2, t * 0.09 * escala);
      this.trazo(pts);
      // gotas viajando, para que se vea que lleva algo dentro
      ctx.fillStyle = aclarar(R.color, 0.45);
      const sep = t * 0.5, desfase = (this.tiempo * 40) % sep;
      let acum = -desfase;
      for(let i = 0; i < pts.length - 1; i++){
        const a = pts[i], b = pts[i + 1];
        const largo = Math.hypot(b.x - a.x, b.y - a.y);
        let d = -acum % sep; if(d < 0) d += sep;
        for(; d < largo; d += sep){
          const k = d / largo;
          ctx.beginPath();
          ctx.arc(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, Math.max(1.5, t * 0.035), 0, 7);
          ctx.fill();
        }
        acum += largo;
      }
    }
  }

  trazo(pts){
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  /* ---------- lo construido ---------- */
  /**
   * Cada pieza tiene su SILUETA, dibujada a mano. Antes eran todas el mismo
   * recuadro con una letra dentro, y una depuradora se distinguía de un depósito
   * por leer la inicial: eso no es un mapa, es una leyenda.
   *
   * Todas comparten la misma luz —clara arriba, oscura al lado derecho— y su
   * sombra en el suelo, que es lo que las asienta sobre el terreno.
   */
  dibujarConstrucciones(estado){
    const ctx = this.ctx, t = this.tam;
    for(const obra of estado.construcciones){
      const x = obra.col * t - estado.camara.x, y = obra.fila * t - estado.camara.y;
      if(x < -t || y < -t || x > this._W || y > this._H) continue;
      const def = CONFIG.construibles[obra.tipo];

      // La TESELA ya es la base: la pieza no necesita zócalo, necesita VOLUMEN.
      // En la referencia los edificios ocupan casi toda la casilla y asoman por
      // encima de su borde superior, que es lo que los hace parecer objetos
      // puestos sobre el tablero y no dibujos estampados en la casilla.
      const E = CONFIG.estiloMapa;
      const lado = t * E.ladoPieza;
      const ox = x + (t - lado) / 2;
      const oy = y + (t - lado) / 2 - t * E.alturaPieza * 0.5;

      // sombra arrojada sobre la tesela
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.ellipse(x + t * 0.52, y + t * 0.74, t * 0.30, t * 0.10, 0, 0, 7);
      ctx.fill();

      // La silueta se dibuja siempre en su caja de t x t y se ESCALA aquí, así
      // ningún dibujo de pieza tiene que saber nada del tamaño final.
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(lado / t, lado / t);
      this.silueta(obra.tipo, 0, 0, t, def.color);
      ctx.restore();

      // El vertedero enseña cuánto vaso le queda: cuando se llena deja de
      // tragar, y eso hay que verlo venir sin abrir ningún panel.
      if(obra.tipo === 'vertedero'){
        const frac = llenadoVaso(obra);
        const bw = t * 0.62, bx = x + (t - bw) / 2, by = y + t * 0.86;
        const bh = Math.max(3, t * 0.07);
        ctx.fillStyle = 'rgba(6,15,24,0.75)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = frac >= 1 ? CONFIG.color.critico
                      : (frac > 0.8 ? CONFIG.color.alarma : '#c9a97f');
        ctx.fillRect(bx, by, bw * frac, bh);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      }
    }
  }

  /* ================================================================
     VOLUMEN ISOMÉTRICO
     Las piezas se dibujan en 3/4 de verdad: una cara superior en rombo y dos
     laterales. La luz viene de arriba a la izquierda SIEMPRE, así que la tapa
     es la más clara, la cara izquierda intermedia y la derecha la oscura. Si
     añades una pieza nueva, respétalo o cantará al lado de las demás.

     `W` es el medio ancho del rombo en pantalla y `H` su medio alto; la
     proporción 2:1 (H = W/2) es la isometría de toda la vida.
     ================================================================ */

  /** Prisma isométrico: la caja base de casi todo. */
  isoCaja(cx, baseY, W, H, alto, color){
    const ctx = this.ctx;
    const ty = baseY - alto;
    const izq = aclarar(color, 0.02);
    const der = oscurecer(color, 0.34);
    const tapa = aclarar(color, 0.30);

    ctx.fillStyle = izq;                      // cara izquierda
    ctx.beginPath();
    ctx.moveTo(cx - W, baseY - H * 0);
    ctx.lineTo(cx, baseY + H);
    ctx.lineTo(cx, ty + H);
    ctx.lineTo(cx - W, ty);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = der;                      // cara derecha
    ctx.beginPath();
    ctx.moveTo(cx + W, baseY);
    ctx.lineTo(cx, baseY + H);
    ctx.lineTo(cx, ty + H);
    ctx.lineTo(cx + W, ty);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = tapa;                     // tapa en rombo
    ctx.beginPath();
    ctx.moveTo(cx, ty - H);
    ctx.lineTo(cx + W, ty);
    ctx.lineTo(cx, ty + H);
    ctx.lineTo(cx - W, ty);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = oscurecer(color, 0.55);
    ctx.lineWidth = Math.max(0.8, W * 0.05);
    ctx.stroke();
  }

  /** Cilindro isométrico: depósitos, tanques y decantadores. */
  isoCilindro(cx, baseY, W, H, alto, color){
    const ctx = this.ctx;
    const ty = baseY - alto;
    ctx.fillStyle = color;                    // cuerpo
    ctx.beginPath();
    ctx.moveTo(cx - W, baseY);
    ctx.lineTo(cx - W, ty);
    ctx.ellipse(cx, ty, W, H, 0, Math.PI, 0);
    ctx.lineTo(cx + W, baseY);
    ctx.ellipse(cx, baseY, W, H, 0, 0, Math.PI);
    ctx.closePath(); ctx.fill();
    // sombra propia en el lado derecho, que es de donde no viene la luz
    ctx.fillStyle = oscurecer(color, 0.30);
    ctx.beginPath();
    ctx.moveTo(cx + W * 0.30, baseY + H * 0.55);
    ctx.lineTo(cx + W * 0.30, ty);
    ctx.ellipse(cx, ty, W, H, 0, 0, Math.PI * 0.35);
    ctx.lineTo(cx + W, baseY);
    ctx.ellipse(cx, baseY, W, H, 0, 0, Math.PI * 0.5);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = aclarar(color, 0.32);     // tapa
    ctx.beginPath(); ctx.ellipse(cx, ty, W, H, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = oscurecer(color, 0.5);
    ctx.lineWidth = Math.max(0.8, W * 0.05);
    ctx.stroke();
  }

  /** Tejado a dos aguas isométrico, para las casetas. */
  isoTejado(cx, ty, W, H, alto, color){
    const ctx = this.ctx;
    ctx.fillStyle = aclarar(color, 0.18);
    ctx.beginPath();
    ctx.moveTo(cx - W, ty); ctx.lineTo(cx, ty - H);
    ctx.lineTo(cx, ty - H - alto); ctx.lineTo(cx - W, ty - alto);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = oscurecer(color, 0.22);
    ctx.beginPath();
    ctx.moveTo(cx + W, ty); ctx.lineTo(cx, ty - H);
    ctx.lineTo(cx, ty - H - alto); ctx.lineTo(cx + W, ty - alto);
    ctx.closePath(); ctx.fill();
  }

  /** La forma concreta de cada pieza, ya en isométrica. */
  silueta(tipo, x, y, t, color){
    const ctx = this.ctx;
    const cx = x + t * 0.5, suelo = y + t * 0.70;
    const W = t * 0.30, H = W * 0.5;

    switch(tipo){
      case 'deposito':        // depósito elevado sobre su torreta
        this.isoCaja(cx, suelo, W * 0.34, H * 0.34, t * 0.20, oscurecer(color, 0.42));
        this.isoCilindro(cx, suelo - t * 0.20, W * 0.72, H * 0.72, t * 0.30, color);
        break;

      case 'bomba':           // caseta de bombeo con tejado y tubo
        this.isoCaja(cx, suelo, W * 0.82, H * 0.82, t * 0.24, color);
        this.isoTejado(cx, suelo - t * 0.24, W * 0.82, H * 0.82, t * 0.12, oscurecer(color, 0.15));
        ctx.strokeStyle = aclarar(color, 0.40);
        ctx.lineWidth = Math.max(2, t * 0.05);
        ctx.beginPath();
        ctx.moveTo(cx - W * 0.95, suelo - t * 0.04);
        ctx.lineTo(cx - W * 0.95, suelo - t * 0.30);
        ctx.stroke();
        break;

      case 'captacion':       // plataforma de toma sobre pilotes
        ctx.strokeStyle = oscurecer(color, 0.50);
        ctx.lineWidth = Math.max(1.5, t * 0.035);
        ctx.beginPath();
        ctx.moveTo(cx - W * 0.5, suelo + t * 0.10); ctx.lineTo(cx - W * 0.5, suelo - t * 0.02);
        ctx.moveTo(cx + W * 0.5, suelo + t * 0.10); ctx.lineTo(cx + W * 0.5, suelo - t * 0.02);
        ctx.stroke();
        this.isoCaja(cx, suelo, W * 0.9, H * 0.9, t * 0.10, color);
        this.isoCaja(cx, suelo - t * 0.10, W * 0.42, H * 0.42, t * 0.16, aclarar(color, 0.12));
        break;

      case 'depuradora':      // dos decantadores con su puente
        for(const dx of [-0.42, 0.42]){
          this.isoCilindro(cx + W * dx, suelo, W * 0.46, H * 0.46, t * 0.09, color);
          ctx.fillStyle = mezclarColor(color, '#08251a', 0.55);
          ctx.beginPath();
          ctx.ellipse(cx + W * dx, suelo - t * 0.09, W * 0.34, H * 0.34, 0, 0, 7);
          ctx.fill();
        }
        ctx.strokeStyle = aclarar(color, 0.45);
        ctx.lineWidth = Math.max(1, t * 0.022);
        ctx.beginPath();
        ctx.moveTo(cx - W * 0.85, suelo - t * 0.09);
        ctx.lineTo(cx + W * 0.85, suelo - t * 0.09);
        ctx.stroke();
        break;

      case 'tanque':          // tanque de tormentas: ancho y bajo
        this.isoCilindro(cx, suelo, W * 0.92, H * 0.92, t * 0.16, color);
        break;

      case 'acuifero':        // castillete del sondeo
        this.isoCaja(cx, suelo, W * 0.55, H * 0.55, t * 0.06, oscurecer(color, 0.35));
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, t * 0.032);
        ctx.beginPath();
        ctx.moveTo(cx - W * 0.5, suelo - t * 0.06); ctx.lineTo(cx, suelo - t * 0.34);
        ctx.lineTo(cx + W * 0.5, suelo - t * 0.06);
        ctx.moveTo(cx - W * 0.28, suelo - t * 0.20); ctx.lineTo(cx + W * 0.28, suelo - t * 0.20);
        ctx.stroke();
        break;

      case 'vertedero': {     // montera de basura por capas
        const capas = [[1.00, 0.00, 0.10], [0.72, 0.09, 0.08], [0.42, 0.16, 0.06]];
        for(let i = 0; i < capas.length; i++){
          const e = capas[i];
          this.isoCilindro(cx, suelo - t * e[1], W * e[0], H * e[0], t * e[2],
                           i % 2 ? oscurecer(color, 0.20) : color);
        }
        break;
      }

      case 'reciclaje':       // nave con el triángulo de las flechas
        this.isoCaja(cx, suelo, W * 0.92, H * 0.92, t * 0.22, color);
        this.isoTejado(cx, suelo - t * 0.22, W * 0.92, H * 0.92, t * 0.10, oscurecer(color, 0.18));
        ctx.strokeStyle = '#0b1a12'; ctx.lineWidth = Math.max(1.5, t * 0.028);
        {
          const r = t * 0.075, cy = suelo - t * 0.14;
          ctx.beginPath();
          ctx.moveTo(cx, cy - r);
          ctx.lineTo(cx + r * 0.87, cy + r * 0.5);
          ctx.lineTo(cx - r * 0.87, cy + r * 0.5);
          ctx.closePath(); ctx.stroke();
        }
        break;

      default:
        this.isoCaja(cx, suelo, W * 0.8, H * 0.8, t * 0.22, color);
    }
  }

  /* ---------- lo que está roto ---------- */
  /**
   * La avería tiene SITIO. Se pinta encima de la pieza parada, con la brigada
   * esperando y los golpes de llave que le faltan: así el jugador sabe adónde
   * ir y cuánto le queda sin abrir ningún panel.
   */
  dibujarAverias(estado){
    const ctx = this.ctx, t = this.tam;
    for(const av of estado.averias || []){
      const x = av.col * t - estado.camara.x, y = av.fila * t - estado.camara.y;
      if(x < -t || y < -t || x > this._W || y > this._H) continue;
      const cx = x + t / 2, cy = y + t / 2;
      const pulso = 0.5 + Math.abs(Math.sin(this.tiempo * 3)) * 0.5;

      // halo de aviso, para localizarla de un vistazo aunque esté lejos
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, t * 0.75);
      halo.addColorStop(0, `rgba(239,68,68,${0.30 * pulso})`);
      halo.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - t * 0.25, y - t * 0.25, t * 1.5, t * 1.5);

      ctx.strokeStyle = CONFIG.color.critico;
      ctx.lineWidth = 2 + pulso * 1.5;
      ctx.strokeRect(x + 2, y + 2, t - 4, t - 4);

      // la llave inglesa y los clics que faltan
      ctx.font = `${Math.round(t * 0.34)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔧', cx, y + t * 0.26);
      ctx.font = `700 ${Math.round(t * 0.2)}px IBM Plex Mono, ui-monospace, monospace`;
      ctx.fillStyle = CONFIG.color.critico;
      ctx.fillText('×' + av.clics, cx, y + t * 0.78);
      ctx.textBaseline = 'alphabetic';
    }
  }

  /* ---------- previsualización de lo que vas a hacer ---------- */
  previsualizar(estado){
    const r = this.resaltada;
    if(!r || !estado.modo.tipo) return;
    const ctx = this.ctx, t = this.tam;
    const x = r.col * t - estado.camara.x, y = r.fila * t - estado.camara.y;

    if(estado.modo.tipo === 'colocar'){
      const v = puedeColocar(estado.mapa, estado.construcciones, estado.modo.elemento, r.col, r.fila);
      ctx.fillStyle = v.ok ? 'rgba(74,222,128,0.30)' : 'rgba(239,68,68,0.30)';
      ctx.fillRect(x, y, t, t);
      ctx.strokeStyle = v.ok ? CONFIG.color.ok : CONFIG.color.critico;
      ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, t - 3, t - 3);
      if(!v.ok) this.cartel(v.motivo, x + t / 2, y - 6, CONFIG.color.critico);
      else if(v.aviso) this.cartel(v.aviso, x + t / 2, y - 6, CONFIG.color.alarma);
      else this.cartel(formatear(CONFIG.construibles[estado.modo.elemento].coste) + ' €',
                       x + t / 2, y - 6, CONFIG.color.ok);
      return;
    }

    if(estado.modo.tipo === 'tuberia'){
      const trazado = estado.modo.trazado;

      // El trazado que llevas dibujado, casilla a casilla
      ctx.fillStyle = 'rgba(56,189,248,0.32)';
      for(const p of trazado){
        ctx.fillRect(p.col * t - estado.camara.x, p.fila * t - estado.camara.y, t, t);
      }
      if(trazado.length){
        const pts = trazado.map(p => ({
          x: p.col * t - estado.camara.x + t / 2,
          y: p.fila * t - estado.camara.y + t / 2
        }));
        ctx.strokeStyle = (CONFIG.redes[estado.redActual] || CONFIG.redes.abastecimiento).color;
        ctx.lineWidth = Math.max(2, t * 0.10 *
          (1 + nivelDiametro(estado.dnActual[estado.redActual], estado.redActual) * 0.55));
        ctx.setLineDash([t * 0.18, t * 0.12]);
        this.trazo(pts); ctx.setLineDash([]);
        // la última puesta, marcada: es donde se pincha para rematar
        const u = trazado[trazado.length - 1];
        ctx.strokeStyle = CONFIG.color.ok; ctx.lineWidth = 3;
        ctx.strokeRect(u.col * t - estado.camara.x + 2, u.fila * t - estado.camara.y + 2, t - 4, t - 4);
      }

      if(!trazado.length){
        this.cartel('Marca por dónde empieza', x + t / 2, y - 6, CONFIG.color.agua);
        return;
      }

      const total = costeTrazado(estado.mapa, trazado, estado.dnActual[estado.redActual], estado.redActual);
      const ultimo = trazado[trazado.length - 1];
      if(ultimo.col === r.col && ultimo.fila === r.fila){
        this.cartel(`Clic aquí: rematar · ${formatear(total)} €`, x + t / 2, y - 6,
                    estado.puedePagar(total) ? CONFIG.color.ok : CONFIG.color.critico);
        return;
      }
      // Coste de prolongar hasta donde señalas
      const v = puedeSeguirTrazado(estado.mapa, trazado, r.col, r.fila);
      const celda = celdaEn(estado.mapa, r.col, r.fila);
      if(v.ok && celda){
        const obra = CONFIG.tuberia.nombreObra[celda.tipo] || 'obra';
        ctx.fillStyle = 'rgba(74,222,128,0.28)'; ctx.fillRect(x, y, t, t);
        this.cartel(`+${formatear(costeCasillaTuberia(celda, estado.dnActual[estado.redActual], estado.redActual))} € (${obra}) · total ${formatear(total)} €`,
                    x + t / 2, y - 6, CONFIG.color.ok);
      } else {
        this.cartel(v.motivo || 'Ahí no', x + t / 2, y - 6, CONFIG.color.critico);
      }
    }
  }

  /** Cartelito con pastilla, para que se lea sobre cualquier terreno. */
  cartel(texto, cx, y, color){
    const ctx = this.ctx;
    const tam = Math.max(10, Math.round(this.tam * 0.16));
    ctx.font = `700 ${tam}px IBM Plex Mono, ui-monospace, monospace`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(texto).width, pad = 7;
    ctx.fillStyle = 'rgba(8,16,26,0.85)';
    ctx.beginPath(); ctx.roundRect(cx - w / 2 - pad, y - tam - 6, w + pad * 2, tam + 8, 5); ctx.fill();
    ctx.fillStyle = color; ctx.fillText(texto, cx, y - 2);
  }

  /* ---------- marco de la casilla bajo el cursor ---------- */
  marcoResaltado(estado){
    const r = this.resaltada;
    if(!r) return;
    const t = this.tam;
    const x = r.col * t - estado.camara.x, y = r.fila * t - estado.camara.y;
    const celda = celdaEn(estado.mapa, r.col, r.fila);
    if(!celda) return;
    const puede = !celda.oculta || esAlcanzable(estado.mapa, r.col, r.fila);
    this.ctx.strokeStyle = puede ? '#ffffff' : 'rgba(255,255,255,0.25)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 1, y + 1, t - 2, t - 2);
  }
}

/** Ruido determinista 0..1 por celda. */
function ruido(c, f){
  const n = Math.sin(c * 127.1 + f * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
