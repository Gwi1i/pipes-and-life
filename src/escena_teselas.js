/**
 * ESCENA TESELAS — Estilo D: vista CENITAL sobre cuadrícula ortogonal.
 *
 * Al estilo de los idle builders (tipo "Post Apo Tycoon"): el terreno es una
 * rejilla de celdas cuadradas vista desde arriba, cada elemento ocupa su celda
 * y las TUBERÍAS se trazan en ortogonal entre ellas. Para un juego que va de
 * redes de agua, es la vista que mejor cuenta lo que pasa.
 *
 * PROTOTIPO: de momento las teselas están dibujadas POR CÓDIGO (hierba, agua,
 * orilla y edificios como piezas con silueta). Sirve para validar composición,
 * tamaño de rejilla y legibilidad antes de generar el arte. Cuando existan las
 * teselas de verdad, se sustituye el dibujo de cada celda por su imagen sin
 * tocar la lógica de posiciones ni de tuberías.
 *
 * Hereda de `Escena` para reutilizar relojes, clima, día/noche y efectos, pero
 * sustituye la composición entera: aquí no hay cielo ni horizonte.
 */

import { CONFIG } from './config.js';
import { capacidad, capacidadTanque, fraccionTratada } from './simulacion.js';
import { limitar } from './util.js';
import { Escena, mezclarColor, oscurecer, aclarar } from './escena.js';

// Mientras se diseña el mapa de exploración se trabaja con las teselas
// DIBUJADAS POR CÓDIGO: son más esquemáticas y dejan ver mejor la mecánica.
// El arte de `assets/` sigue en su sitio: basta con poner esto a `true`.
const USAR_ARTE = false;

export class EscenaTeselas extends Escena {

  constructor(lienzo){
    super(lienzo);
    this._img = {};   // teselas de arte: nombre → { img, ok, fallo }
  }

  /**
   * Tesela de `assets/`, o null si no existe todavía (entonces se dibuja por
   * código). Permite ir añadiendo arte de una en una sin romper nada.
   * Devuelve { img, bbox } — la caja opaca sirve para que un edificio con
   * márgenes transparentes llene igualmente su celda.
   */
  tesela(nombre){
    if(!USAR_ARTE) return null;
    let e = this._img[nombre];
    if(!e){
      e = { img: new Image(), ok: false, fallo: false, bbox: null };
      e.img.onload  = () => { e.bbox = cajaOpaca(e.img); e.ok = true; };
      e.img.onerror = () => { e.fallo = true; };
      e.img.src = 'assets/' + nombre;
      this._img[nombre] = e;
    }
    return e.ok ? e : null;
  }

  /**
   * Dibuja un edificio (PNG con fondo transparente) sobre su celda: se escala
   * por su caja opaca para que llene el hueco sea cual sea el margen que dejara
   * el generador, se apoya en la parte baja de la celda y puede sobresalir un
   * poco hacia arriba, como en cualquier tile builder.
   */
  edificioTesela(entrada, cx, cyCelda, t, altoRel = 1.05){
    const ctx = this.ctx, img = entrada.img, b = entrada.bbox;
    const rel = b.w / b.h;
    let dh = t * altoRel, dw = dh * rel;
    if(dw > t * 1.25){ dw = t * 1.25; dh = dw / rel; }   // que no invada al vecino
    // El sprite se centra en la celda, no se "cuelga" de su base: los edificios
    // vienen en 3/4 y con tuberías que sobresalen, así que anclarlos por el
    // borde inferior de su caja opaca los levantaba y parecían volar.
    const cy = cyCelda + t * 0.06;
    const x = cx - dw / 2, y = cy - dh / 2;
    // Sombra elíptica pegada a la base visual del edificio, que lo asienta.
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(cx, y + dh * 0.80, dw * 0.36, dh * 0.11, 0, 0, 7);
    ctx.fill();
    ctx.drawImage(img, b.x, b.y, b.w, b.h, x, y, dw, dh);
  }

  /* ================================================================
     BUCLE DE DIBUJO
     ================================================================ */

  dibujar(estado, resultado, dt){
    const p = this.prepararFotograma(estado, resultado, dt);
    const ctx = this.ctx, W = this._W, H = this._H, M = CONFIG.mapa;

    // El alto manda el tamaño de tesela; luego se añaden columnas hasta llenar
    // el ancho, así el tablero cubre el lienzo sea cual sea la proporción.
    const margen = H * 0.03;
    this.tam = Math.floor((H - margen * 2) / M.filas);
    // El tablero debe tener columnas suficientes para el elemento más alejado
    // del río; si no, el pueblo se queda fuera de pantalla por la izquierda.
    const necesarias = Math.max(...Object.values(M.celdas)
      .map(c => c.desdeOrilla + (c.ancho || 1))) + M.anchoRio + 1;
    this.cols = Math.max(M.colsMin, necesarias, Math.ceil(W / this.tam));
    this.rioDesdeCol = this.cols - M.anchoRio;
    this.orillaCol = this.rioDesdeCol - 1;
    // Anclado al río (derecha), pero sin cortar el elemento más alejado: si el
    // tablero es más ancho que el lienzo, se desplaza lo justo para que quepa.
    this.ox = Math.min(0, W - this.tam * this.cols);
    this.oy = Math.round((H - this.tam * M.filas) / 2);

    ctx.fillStyle = '#0a1420';
    ctx.fillRect(0, 0, W, H);

    this.terreno(dt);
    this.tuberias();
    this.edificios();
    this.velosDeAmbiente();
    this.clima(dt);
    this.dibujarOperario();
    this.destellosClic();
  }

  /* ---------- conversión celda → píxel ---------- */
  cx(col){ return this.ox + col * this.tam; }
  cy(fila){ return this.oy + fila * this.tam; }
  centro(col, fila, ancho = 1, alto = 1){
    return { x: this.cx(col) + this.tam * ancho / 2, y: this.cy(fila) + this.tam * alto / 2 };
  }
  /** Columna real de una celda definida por su distancia a la orilla. */
  col(celda){ return this.orillaCol - celda.desdeOrilla; }
  /** Centro de una celda de CONFIG.mapa.celdas. */
  centroDe(celda){
    return this.centro(this.col(celda), celda.fila, celda.ancho || 1, celda.alto || 1);
  }

  /* ---------- terreno: hierba, orilla y agua ---------- */
  terreno(dt){
    const ctx = this.ctx, M = CONFIG.mapa, t = this.tam;
    const suc = this.suciedad;
    const hierbaBase = this.est.hierba;

    // Teselas de arte, si ya existen (si no, se dibuja todo por código)
    const tHierba = this.tesela('t_hierba.png')?.img;
    const tMatojos = this.tesela('t_hierba_matojos.png')?.img;
    const tAgua = this.tesela('t_agua.png')?.img;
    const tOrilla = this.tesela('t_orilla.png')?.img;

    for(let f = 0; f < M.filas; f++){
      for(let c = 0; c < this.cols; c++){
        const x = this.cx(c), y = this.cy(f);
        const esAgua = c >= this.rioDesdeCol;
        const esOrilla = c === this.orillaCol;

        // --- camino con arte ---
        if(esAgua && tAgua){
          ctx.drawImage(tAgua, x, y, t, t);
          if(suc > 0.02){ ctx.fillStyle = `rgba(120,130,60,${suc * 0.45})`; ctx.fillRect(x, y, t, t); }
          continue;
        }
        if(!esAgua && tHierba){
          const v = ruido(c, f);
          const img = (v > 0.78 && tMatojos) ? tMatojos : tHierba;
          // Se gira cada celda un múltiplo de 90°: con una sola textura, el ojo
          // dejaría de ver hierba y empezaría a ver un patrón repetido.
          const giro = Math.floor(v * 4) % 4;
          if(giro === 0){
            ctx.drawImage(img, x, y, t, t);
          } else {
            ctx.save();
            ctx.translate(x + t / 2, y + t / 2);
            ctx.rotate(giro * Math.PI / 2);
            ctx.drawImage(img, -t / 2, -t / 2, t, t);
            ctx.restore();
          }
          if(esOrilla && tOrilla) ctx.drawImage(tOrilla, x, y, t, t);
          continue;
        }

        // --- camino por código (prototipo) ---
        if(esAgua){
          const base = mezclarColor(CONFIG.color.aguaProfunda, CONFIG.color.aguaSucia, suc);
          ctx.fillStyle = mezclarColor(base, '#000000', ((c + f) % 2) * 0.06);
          ctx.fillRect(x, y, t, t);
          // ondas que bajan por el cauce
          ctx.strokeStyle = `rgba(255,255,255,${0.10 + this.luz * 0.06})`;
          ctx.lineWidth = 1.5;
          for(let k = 0; k < 2; k++){
            const yy = y + t * (0.3 + k * 0.4) + Math.sin(this.tiempo * 1.6 + c + k) * 2;
            ctx.beginPath();
            for(let xx = x; xx <= x + t; xx += 6){
              const oy = Math.sin(xx * 0.09 + this.tiempo * 2 + k) * 1.6;
              xx === x ? ctx.moveTo(xx, yy + oy) : ctx.lineTo(xx, yy + oy);
            }
            ctx.stroke();
          }
        } else {
          // hierba con variación determinista por celda (no titila entre frames)
          const v = ruido(c, f);
          ctx.fillStyle = mezclarColor(hierbaBase, v > 0.5 ? '#ffffff' : '#000000',
                                       Math.abs(v - 0.5) * 0.14);
          ctx.fillRect(x, y, t, t);
          // matojos
          if(v > 0.78){
            ctx.fillStyle = oscurecer(hierbaBase, 0.25);
            const r = t * 0.07;
            ctx.beginPath(); ctx.arc(x + t * 0.3, y + t * 0.66, r, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.arc(x + t * 0.44, y + t * 0.74, r * 0.8, 0, 7); ctx.fill();
          }
          if(esOrilla){   // ribera arenosa junto al agua
            ctx.fillStyle = 'rgba(196,168,110,0.55)';
            ctx.fillRect(x + t * 0.82, y, t * 0.18, t);
          }
        }
        // rejilla sutil, que es lo que da el aire de "tablero"
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, t, t);
      }
    }
  }

  /* ---------- tuberías ortogonales entre celdas ---------- */
  tuberias(){
    const p = this._p, r = this._res, M = CONFIG.mapa, K = M.celdas;
    const entra = this.pulso > 0.02 || r.produciendo;

    // Abastecimiento (azul): captación → bomba → depósito → pueblo
    const cap = this.centroDe(K.captacion);
    const bom = this.centroDe(K.bomba);
    const dep = this.centroDe(K.deposito);
    const pue = this.centroDe(K.pueblo);
    const azul = CONFIG.color.agua;

    if(p.mejoras.captacion > 0) this.trazo([cap, bom], entra, azul);
    if(p.mejoras.deposito > 0){
      this.trazo([bom, dep], entra, azul);
      this.trazo([dep, pue], r.servicio > 0.01, azul);
    } else {
      this.trazo([bom, pue], entra && r.servicio > 0.01, azul);
    }

    // Saneamiento (pardo): pueblo → tanque → depuradora → río
    if(p.saneamientoActivo){
      const sucio = mezclarColor(azul, '#7a5a2a', 0.85);
      const salida = mezclarColor(azul, '#7a5a2a', 1 - fraccionTratada(p, this._estado));
      const tan = this.centroDe(K.tanque);
      const depu = this.centroDe(K.depuradora);
      const vert = this.centro(this.rioDesdeCol, K.depuradora.fila);
      // sube por la izquierda y cruza por arriba
      const esquina = { x: pue.x, y: tan.y };
      this.trazo([pue, esquina, tan], true, sucio);
      this.trazo([tan, depu], true, p.mejoras.tanque > 0 ? sucio : sucio);
      this.trazo([depu, vert], true, salida);

      // Pluviales (cian): canal aparte del pueblo al río, solo si llueve
      if(p.mejoras.pluviales > 0){
        const llueve = (r.lluvia || 0) > 0.05;
        // Una fila por debajo del abastecimiento, para que no se pisen
        const fila = K.pueblo.fila + K.pueblo.alto + 1;
        const a = this.centro(this.col(K.pueblo) + K.pueblo.ancho - 1, fila);
        const b = this.centro(this.rioDesdeCol, fila);
        this.trazo([a, b], llueve, CONFIG.color.pluviales);
      }
    }
  }

  /** Traza una polilínea ortogonal con gotas viajando si `fluye`. */
  trazo(puntos, fluye, color){
    const ctx = this.ctx, t = this.tam;
    const camino = [];
    for(let i = 0; i < puntos.length - 1; i++){
      const a = puntos[i], b = puntos[i + 1];
      // codo en L: primero horizontal, luego vertical
      camino.push(a, { x: b.x, y: a.y }, b);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const grosor = Math.max(3, t * 0.13);
    ctx.strokeStyle = '#1b2836'; ctx.lineWidth = grosor + 3;
    this.polilinea(camino);
    ctx.strokeStyle = fluye ? color : CONFIG.color.aguaSeca;
    ctx.lineWidth = grosor;
    ctx.globalAlpha = fluye ? 0.95 : 0.5;
    this.polilinea(camino);
    ctx.globalAlpha = 1;
    if(fluye) this.gotas(camino, color, grosor);
  }

  polilinea(pts){
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  gotas(pts, color, grosor){
    const ctx = this.ctx;
    // recorrer la polilínea a intervalos regulares
    const sep = this.tam * 0.42, desfase = (this.tiempo * 55) % sep;
    let acumulado = -desfase;
    ctx.fillStyle = aclarar(color, 0.25);
    for(let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i + 1];
      const largo = Math.hypot(b.x - a.x, b.y - a.y);
      if(largo < 1) continue;
      const dx = (b.x - a.x) / largo, dy = (b.y - a.y) / largo;
      let d = -acumulado % sep; if(d < 0) d += sep;
      for(; d < largo; d += sep){
        ctx.beginPath();
        ctx.arc(a.x + dx * d, a.y + dy * d, grosor * 0.38, 0, 7);
        ctx.fill();
      }
      acumulado += largo;
    }
  }

  /* ---------- edificios sobre sus celdas ---------- */
  edificios(){
    const p = this._p, r = this._res, K = CONFIG.mapa.celdas, C = CONFIG.color;
    this._altRotulo = {};   // reiniciar el escalonado de rótulos cada fotograma

    if(p.mejoras.captacion > 0){
      this.pieza(K.captacion, C.captacion, 'captacion',
                 'CAPTACIÓN', 'Nv' + p.mejoras.captacion);
    }
    this.pieza(CONFIG.mapa.celdas.bomba, p.autobombaActivo ? C.captacion : '#7aa7c7',
               'bomba', p.autobombaActivo ? 'BOMBEO AUTO' : 'BOMBEO',
               'Nv' + p.mejoras.bomba, r.averiada, 1 + this.pulso * 0.06);

    if(p.mejoras.deposito > 0){
      const frac = limitar(p.agua / capacidad(p, this._estado), 0, 1);
      this.pieza(K.deposito, C.deposito, 'deposito', 'DEPÓSITO',
                 Math.round(frac * 100) + '%', false, 1, frac);
    }
    if(p.mejoras.tanque > 0){
      const frac = capacidadTanque(p, this._estado) > 0 ? limitar(p.tanqueAgua / capacidadTanque(p, this._estado), 0, 1) : 0;
      this.pieza(K.tanque, C.tanque, 'tanque', r.aliviando ? 'ALIVIANDO' : 'TORMENTAS',
                 Math.round(frac * 100) + '%', r.aliviando, 1, frac);
    }
    if(p.mejoras.depuradora > 0){
      this.pieza(K.depuradora, C.depuradora, 'depuradora', 'DEPURADORA',
                 'Nv' + p.mejoras.depuradora);
    }
    this.puebloPieza();
  }

  /**
   * Una pieza sobre su celda: base con sombra, silueta según el tipo, etiqueta
   * y, si procede, barra de llenado. Es el hueco donde entrará la tesela de arte.
   */
  pieza(celda, color, tipo, titulo, valor, alarma = false, escala = 1, frac = null){
    const ctx = this.ctx, t = this.tam;
    const col = this.col(celda);
    const { x, y } = this.centro(col, celda.fila);
    const lado = t * 0.78 * escala;

    const entrada = this.tesela('t_' + tipo + '.png');
    if(entrada){
      // Los edificios vienen con fondo transparente: se dibujan sobre la hierba
      // del terreno, escalados por su caja opaca y apoyados en la celda.
      this.edificioTesela(entrada, x, y, t, escala * 1.05);
      if(alarma){   // aro rojo latiendo cuando hay avería o alivio
        ctx.strokeStyle = `rgba(239,68,68,${0.55 + Math.sin(this.tiempo * 7) * 0.4})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(x - t / 2 + 1, y - t / 2 + 1, t - 2, t - 2, 4); ctx.stroke();
      }
    } else {
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(x, y + lado * 0.42, lado * 0.42, lado * 0.16, 0, 0, 7); ctx.fill();
      // plataforma
      ctx.beginPath(); ctx.roundRect(x - lado / 2, y - lado / 2, lado, lado, lado * 0.18);
      ctx.fillStyle = oscurecer(color, 0.62); ctx.fill();
      ctx.strokeStyle = alarma
        ? `rgba(239,68,68,${0.55 + Math.sin(this.tiempo * 7) * 0.4})` : oscurecer(color, 0.2);
      ctx.lineWidth = 2; ctx.stroke();

      this.silueta(tipo, x, y, lado, color);
    }

    if(frac !== null){   // barra de llenado bajo la pieza
      const bw = lado * 0.8, bh = Math.max(3, lado * 0.09), bx = x - bw / 2, by = y + lado * 0.36;
      ctx.fillStyle = 'rgba(8,16,26,0.75)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = color; ctx.fillRect(bx, by, bw * frac, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
    }
    // Los rótulos se escalonan alternando DENTRO de cada fila: así dos piezas
    // consecutivas nunca ponen su etiqueta a la misma altura. (Alternar por
    // paridad de columna fallaba en cuanto dos piezas estaban a 2 celdas.)
    const tamTexto = Math.max(7, Math.round(t * 0.13));
    this._altRotulo = this._altRotulo || {};
    const n = (this._altRotulo[celda.fila] = (this._altRotulo[celda.fila] || 0) + 1);
    const yRot = n % 2 === 0 ? y - lado * 0.52 - (tamTexto + 6) : y + lado * 0.52;
    this.rotulo(titulo, valor, x, yRot, alarma ? CONFIG.color.critico : color);
  }

  /** Siluetas simples y reconocibles desde arriba. */
  silueta(tipo, x, y, lado, color){
    const ctx = this.ctx, s = lado * 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = aclarar(color, 0.1);
    ctx.strokeStyle = oscurecer(color, 0.5);
    ctx.lineWidth = 1.5;

    switch(tipo){
      case 'bomba': {          // caseta con tubo
        ctx.beginPath(); ctx.roundRect(-s * 0.6, -s * 0.5, s * 1.2, s, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = oscurecer(color, 0.35);
        ctx.fillRect(-s * 0.15, -s * 0.9, s * 0.3, s * 0.45);
        break;
      }
      case 'deposito': {       // círculo (tanque visto en planta)
        ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, 7); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = aclarar(color, 0.4);
        ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, 7); ctx.stroke();
        break;
      }
      case 'tanque': {         // círculo con cruz: depósito enterrado
        ctx.beginPath(); ctx.arc(0, 0, s * 0.68, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, 0); ctx.lineTo(s * 0.5, 0);
        ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, s * 0.5); ctx.stroke();
        break;
      }
      case 'depuradora': {     // dos clarificadores con brazo girando
        for(const dx of [-s * 0.42, s * 0.42]){
          ctx.beginPath(); ctx.arc(dx, 0, s * 0.38, 0, 7); ctx.fill(); ctx.stroke();
        }
        ctx.save(); ctx.rotate(this.tiempo * 0.9);
        ctx.strokeStyle = aclarar(color, 0.5);
        ctx.beginPath(); ctx.moveTo(-s * 0.42 - s * 0.3, 0); ctx.lineTo(-s * 0.42 + s * 0.3, 0); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'captacion': {      // diana sobre el agua
        ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = oscurecer(color, 0.4);
        ctx.beginPath(); ctx.arc(0, 0, s * 0.26, 0, 7); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  /** El pueblo ocupa varias celdas: manzanas con calles. */
  puebloPieza(){
    const ctx = this.ctx, p = this._p, r = this._res, t = this.tam;
    const K = CONFIG.mapa.celdas.pueblo;
    const x0 = this.cx(this.col(K)), y0 = this.cy(K.fila);
    const w = t * K.ancho, h = t * K.alto;
    const seco = r.servicio < 0.5;

    // Tesela de arte según el tamaño del pueblo, si existe
    const nivel = p.habitantes > 2500 ? 'ciudad' : p.habitantes > 600 ? 'villa' : 'aldea';
    const entrada = this.tesela('t_pueblo_' + nivel + '.png');
    if(entrada){
      // Fondo transparente: se apoya sobre la hierba, ocupando su bloque 2×2
      // El bloque del pueblo es 2×2, pero el sprite se dibuja a poco más de una
      // celda: a tamaño de bloque completo aplastaba visualmente al resto.
      this.edificioTesela(entrada, x0 + w / 2, y0 + h / 2, t * 1.35, 1);
      if(seco){
        ctx.fillStyle = 'rgba(30,40,50,0.45)';
        ctx.fillRect(x0, y0, w, h);
        this.avisoSed(x0 + w / 2, y0 + h / 2 + t * 0.18, t);
      }
      this.rotulo(p.nombre, Math.floor(p.habitantes).toLocaleString('es-ES') + ' hab',
                  x0 + w / 2, y0 + h + t * 0.06, CONFIG.color.texto);
      return;
    }

    // parcela (prototipo por código)
    ctx.fillStyle = seco ? '#3a4048' : mezclarColor('#6b7a4a', this.est.hierba, 0.4);
    ctx.beginPath(); ctx.roundRect(x0 + 3, y0 + 3, w - 6, h - 6, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();

    // manzanas: más y más grandes cuanto mayor la población
    const filas = p.habitantes > 2500 ? 4 : p.habitantes > 600 ? 3 : 2;
    const cw = (w - 12) / filas, ch = (h - 12) / filas;
    for(let i = 0; i < filas; i++){
      for(let j = 0; j < filas; j++){
        if((i + j) % 3 === 2) continue;   // huecos = plazas y calles
        const bx = x0 + 6 + i * cw + cw * 0.12, by = y0 + 6 + j * ch + ch * 0.12;
        const bw = cw * 0.76, bh = ch * 0.76;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(bx + 2, by + 2, bw, bh);
        ctx.fillStyle = seco ? '#59636e'
          : ['#e9d7a6', '#d9b98a', '#efe0bd'][(i + j) % 3];
        ctx.fillRect(bx, by, bw, bh);
        // tejado
        ctx.fillStyle = seco ? '#454e57' : ['#c0392b', '#a8432f'][(i * 2 + j) % 2];
        ctx.fillRect(bx, by, bw, bh * 0.42);
        // luz encendida de noche si hay servicio
        if(!seco && this.luz < 0.5){
          ctx.fillStyle = `rgba(255,214,120,${(1 - this.luz) * 0.55})`;
          ctx.fillRect(bx + bw * 0.35, by + bh * 0.62, bw * 0.3, bh * 0.24);
        }
      }
    }
    if(seco) this.avisoSed(x0 + w / 2, y0 + h / 2 + t * 0.18, t);
    this.rotulo(p.nombre, Math.floor(p.habitantes).toLocaleString('es-ES') + ' hab',
                x0 + w / 2, y0 + h + t * 0.06, CONFIG.color.texto);
  }

  /** "!" que late sobre un pueblo mal servido. */
  avisoSed(cx, cy, t){
    const ctx = this.ctx;
    ctx.globalAlpha = 0.6 + Math.sin(this.tiempo * 4) * 0.4;
    ctx.fillStyle = CONFIG.color.critico;
    ctx.font = `bold ${Math.round(t * 0.5)}px IBM Plex Sans, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('!', cx, cy);
    ctx.globalAlpha = 1;
  }

  /** Rótulo con pastilla, como en el estilo C. */
  rotulo(titulo, valor, cx, y, color){
    const ctx = this.ctx;
    const tam = Math.max(7, Math.round(this.tam * 0.13));
    const texto = valor ? `${titulo} · ${valor}` : titulo;
    ctx.font = `700 ${tam}px IBM Plex Mono, ui-monospace, monospace`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(texto).width, padX = 5, hh = tam + 6;
    ctx.fillStyle = 'rgba(8,16,26,0.62)';
    ctx.beginPath(); ctx.roundRect(cx - w / 2 - padX, y, w + padX * 2, hh, 4); ctx.fill();
    ctx.fillStyle = color; ctx.fillText(texto, cx, y + tam + 1);
  }

}

/**
 * Caja de los píxeles OPACOS de una imagen. Sirve para que un edificio llene su
 * celda aunque el generador le haya dejado un margen transparente enorme, sin
 * tener que recortar los PNG a mano.
 */
function cajaOpaca(img){
  const W = img.naturalWidth, H = img.naturalHeight;
  const lienzo = document.createElement('canvas');
  lienzo.width = W; lienzo.height = H;
  const ctx = lienzo.getContext('2d');
  ctx.drawImage(img, 0, 0);
  let d;
  try { d = ctx.getImageData(0, 0, W, H).data; }
  catch(e){ return { x: 0, y: 0, w: W, h: H }; }
  let minX = W, minY = H, maxX = 0, maxY = 0, hay = false;
  for(let y = 0; y < H; y++){
    for(let x = 0; x < W; x++){
      if(d[(y * W + x) * 4 + 3] > 24){
        hay = true;
        if(x < minX) minX = x; if(x > maxX) maxX = x;
        if(y < minY) minY = y; if(y > maxY) maxY = y;
      }
    }
  }
  return hay ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
             : { x: 0, y: 0, w: W, h: H };
}

/** Ruido determinista 0..1 por celda: la misma celda siempre igual. */
function ruido(c, f){
  const n = Math.sin(c * 127.1 + f * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
