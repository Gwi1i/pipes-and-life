/**
 * MINIJUEGO: LA LÍNEA DE RECICLAJE — la planta de verdad.
 *
 * Eres el operario de la cinta: pasan RESIDUOS RECONOCIBLES —cajas de cartón,
 * botellas, latas, briks, raspas de pescado, corazones de manzana— y se
 * AGARRAN con el dedo y se SUELTAN en su contenedor, los de calle de toda la
 * vida: amarillo envases, azul papel, verde vidrio, marrón orgánica. La
 * lección escondida sigue: el RESTO (la bolsa atada) no se toca — dejarlo
 * llegar al vertedero del final ES lo correcto, porque no todo se recicla.
 *
 * El estilo, el de la casa: la NAVE de fondo puede ser una ilustración del
 * autor (assets/mini_reciclaje.jpg, como las tarjetas; sin ella, la nave
 * dibujada por código) y los residuos van a mano con el tebeo de las
 * tuberías — contorno gordo, color plano, banda de luz — porque lo que se
 * toca con el dedo tiene que ser preciso al píxel.
 *
 * Módulo autocontenido: no toca el estado, devuelve (aciertos, total, razón)
 * por callback y main.js decide qué significa.
 */

import { CONFIG } from './config.js';
import * as sonido from './sonido.js';

/* Cada residuo es ALGO: su fracción y su dibujo. Varios por fracción, que la
   cinta de verdad no repite la misma botella toda la mañana.

   La regla del reparto, del autor (que trabaja en esto): residuos CLAROS, sin
   dobleces. El zapato se fue por eso — si sirve va a textil y si no a resto,
   y ese matiz no cabe en la cinta—. Y los del resto enseñan de verdad: el
   pañal no se recicla, la maceta es CERÁMICA (no vidrio: es el error más
   común del iglú verde), la esponja tampoco tiene contenedor.

   Solo salen a la cinta los que TIENEN estampa: sprite del autor o dibujo por
   código (residuoAlAzar filtra). Así la lista puede ir por delante del arte
   sin que aparezca un bulto sin cara. */
const RESIDUOS = [
  // PAPEL Y CARTÓN (azul)
  { frac: 'papel',    dibujo: 'caja' },
  { frac: 'papel',    dibujo: 'periodico' },
  { frac: 'papel',    dibujo: 'revista' },
  { frac: 'papel',    dibujo: 'huevera' },
  { frac: 'papel',    dibujo: 'tubo' },            // el rollo de cartón
  // VIDRIO (verde)
  { frac: 'vidrio',   dibujo: 'botellaVidrio' },
  { frac: 'vidrio',   dibujo: 'botellaMarron' },
  { frac: 'vidrio',   dibujo: 'tarro' },
  { frac: 'vidrio',   dibujo: 'frasco' },          // de colonia
  // ENVASES (amarillo)
  { frac: 'envases',  dibujo: 'botellaPlastico' }, // aplastada: se ve que es plástico
  { frac: 'envases',  dibujo: 'lata' },
  { frac: 'envases',  dibujo: 'lataConservas' },
  { frac: 'envases',  dibujo: 'brik' },
  { frac: 'envases',  dibujo: 'yogur' },
  { frac: 'envases',  dibujo: 'aerosol' },
  // ORGÁNICA (marrón)
  { frac: 'organica', dibujo: 'manzana' },
  { frac: 'organica', dibujo: 'platano' },
  { frac: 'organica', dibujo: 'raspa' },
  { frac: 'organica', dibujo: 'hueso' },           // muslo de pollo comido
  { frac: 'organica', dibujo: 'cascara' },         // de huevo, rota
  // RESTO: no se tocan
  { frac: null,       dibujo: 'bolsa' },
  { frac: null,       dibujo: 'panal' },           // el pañal, sin discusión
  { frac: null,       dibujo: 'maceta' },          // cerámica: NO es vidrio
  { frac: null,       dibujo: 'esponja' }
];

/* Los sprites generados por el autor (assets/res_<dibujo>.png, de la hoja de
   residuos): si existen, mandan; si no, el dibujo por código de cada uno.
   El mismo reparto de siempre — la ilustración pone el estilo, el código pone
   la garantía de que siempre hay algo que agarrar. */
const SPRITES = {};
for(const def of RESIDUOS){
  if(SPRITES[def.dibujo]) continue;
  const img = new Image();
  img.src = `assets/res_${def.dibujo}.png`;
  SPRITES[def.dibujo] = img;   // si 404, naturalWidth queda a 0 y no se usa
}

const BINES = [
  { id: 'envases',  nombre: 'ENVASES',  color: '#facc15' },
  { id: 'organica', nombre: 'ORGÁNICA', color: '#a16207' },
  { id: 'papel',    nombre: 'PAPEL',    color: '#3b82f6' },
  { id: 'vidrio',   nombre: 'VIDRIO',   color: '#22c55e' }
];

/* Los contenedores ilustrados (assets/cont_<id>.png, de la hoja de
   contenedores): como los residuos, si existen mandan y si no, el dibujo por
   código. La placa del nombre y el ✓/✗ los pone SIEMPRE el juego encima —
   son interfaz, no carrocería. */
const SPRITES_BIN = {};
for(const b of BINES){
  const img = new Image();
  img.src = `assets/cont_${b.id}.png`;
  SPRITES_BIN[b.id] = img;   // si 404, naturalWidth queda a 0 y no se usa
}

export class MinijuegoReciclaje {

  constructor(){
    this.fondo = document.getElementById('minijuego2');
    this.lienzo = document.getElementById('mini2-lienzo');
    this.ctx = this.lienzo.getContext('2d');
    this.alTerminar = null;

    // La nave ilustrada, si el autor la ha generado; si no, la de código
    this.nave = new Image();
    this.hayNave = false;
    this.nave.onload = () => { this.hayNave = true; };
    this.nave.src = 'assets/mini_reciclaje.jpg';

    const pos = e => {
      const r = this.lienzo.getBoundingClientRect();
      return [(e.clientX - r.left) * (this.lienzo.width / r.width),
              (e.clientY - r.top) * (this.lienzo.height / r.height)];
    };
    this.lienzo.addEventListener('pointerdown', e => {
      try{ this.lienzo.setPointerCapture(e.pointerId); }catch(_){ }
      this.agarrar(...pos(e));
    });
    this.lienzo.addEventListener('pointermove', e => {
      [this.manoX, this.manoY] = pos(e);
      this.manoDentro = true;
      if(this.enMano) [this.enMano.x, this.enMano.y] = [this.manoX, this.manoY];
    });
    this.lienzo.addEventListener('pointerleave', () => { this.manoDentro = false; });
    const soltar = e => { if(this.enMano) this.soltar(...pos(e)); };
    this.lienzo.addEventListener('pointerup', soltar);
    this.lienzo.addEventListener('pointercancel', soltar);
    document.getElementById('mini2-cancelar').onclick = () => this.terminar('abandonado');
  }

  jugar(alTerminar){
    const K = CONFIG.minijuegos.reciclaje;
    this.alTerminar = alTerminar;
    this.lienzo.width = 640;
    this.lienzo.height = 460;

    this.cintaY = 150;
    this.binY = 290;
    this.binAncho = 130; this.binAlto = 130;

    this.velocidad = K.velocidad;
    this.preludio = K.preludioSegundos;   // la regla en pantalla, antes de nada
    this.porSalir = K.objetos;
    this.residuos = [];        // en la cinta: { def, x, y, balanceo }
    this.enMano = null;        // el agarrado: { def, x, y }
    this.vuelos = [];          // volando a su contenedor tras soltarlo
    this.aciertos = 0; this.fallos = 0;
    this.reloj = 0;
    this.flashBin = null;
    this.fin = null;

    this.fondo.hidden = false;
    this._ultimo = performance.now();
    const paso = (ahora) => {
      if(this.fondo.hidden) return;
      const dt = Math.min((ahora - this._ultimo) / 1000, 0.1);
      this._ultimo = ahora;
      this.tick(dt);
      this.dibujar();
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  residuoAlAzar(){
    const K = CONFIG.minijuegos.reciclaje;
    // Solo residuos CON estampa: el sprite del autor ya cargado, o su dibujo
    // por código. Los que aún no tienen arte esperan su turno sin romper nada.
    const conCara = d => (SPRITES[d.dibujo] && SPRITES[d.dibujo].naturalWidth > 0)
                         || typeof this['res_' + d.dibujo] === 'function';
    const esResto = Math.random() < K.probResto;
    const grupo = RESIDUOS.filter(d => conCara(d) && (d.frac === null) === esResto);
    return grupo[Math.floor(Math.random() * grupo.length)];
  }

  /* ---------------- jugar ---------------- */

  tick(dt){
    this.reloj += dt;
    if(this.fin){
      this.fin.t += dt;
      if(this.fin.t > 1.6) this.terminar('fin');
      return;
    }
    // Durante el preludio la cinta gira en vacío: se lee la regla y nada más
    if(this.preludio > 0){
      this.preludio -= dt;
      return;
    }
    const K = CONFIG.minijuegos.reciclaje;

    const ultimo = this.residuos[this.residuos.length - 1];
    if(this.porSalir > 0 && (!ultimo || ultimo.x > K.separacion - 40)){
      this.residuos.push({ def: this.residuoAlAzar(), x: -35,
                           balanceo: Math.random() * 7 });
      this.porSalir--;
    }

    for(const res of this.residuos) res.x += this.velocidad * dt;

    // Lo que llega al final cae al vertedero: acierto solo si era resto
    const borde = this.lienzo.width - 55;
    while(this.residuos.length && this.residuos[0].x >= borde){
      const res = this.residuos.shift();
      this.resolver(res.def, null, borde, this.cintaY);
    }

    this.vuelos = this.vuelos.filter(v => (v.t += dt * 3.2) < 1);
    if(this.flashBin && (this.flashBin.t += dt) > 0.5) this.flashBin = null;

    if(!this.porSalir && !this.residuos.length && !this.enMano && !this.vuelos.length)
      this.fin = { t: 0 };
  }

  /** Cierra un residuo: al bin dicho, o al vertedero (binId null). */
  resolver(def, binId, x, y){
    const K = CONFIG.minijuegos.reciclaje;
    const bueno = def.frac === binId || (def.frac === null && binId === null);
    if(bueno) this.aciertos++; else this.fallos++;
    if(binId !== null){
      const i = BINES.findIndex(b => b.id === binId);
      this.vuelos.push({ def, desdeX: x, desdeY: y,
                         haciaX: this.binX(i) + this.binAncho / 2,
                         haciaY: this.binY + 22, t: 0 });
      this.flashBin = { id: binId, bueno, t: 0 };
      if(bueno) sonido.compra(); else sonido.seco();
    } else {
      if(bueno) sonido.tramo(); else sonido.seco();
    }
    this.velocidad *= K.aceleracion;
  }

  binX(i){
    const total = BINES.length * this.binAncho + (BINES.length - 1) * 18;
    const x0 = (this.lienzo.width - total) / 2;
    return x0 + i * (this.binAncho + 18);
  }

  /** ¿Hay un residuo bajo el dedo? Se agarra y deja la cinta. */
  agarrar(x, y){
    if(this.preludio > 0){ this.preludio = 0; return; }   // toque: empezamos
    if(this.fin || this.enMano) return;
    for(let i = 0; i < this.residuos.length; i++){
      const res = this.residuos[i];
      if(Math.abs(res.x - x) < 34 && Math.abs(this.cintaY - 8 - y) < 42){
        this.residuos.splice(i, 1);
        this.enMano = { def: res.def, x, y };
        sonido.tramo();
        return;
      }
    }
  }

  /** Soltarlo: en un contenedor, resuelve; en el aire, vuelve a la cinta. */
  soltar(x, y){
    const res = this.enMano;
    this.enMano = null;
    if(y >= this.binY - 14 && y <= this.binY + this.binAlto){
      for(let i = 0; i < BINES.length; i++){
        const bx = this.binX(i);
        if(x >= bx - 8 && x <= bx + this.binAncho + 8){
          this.resolver(res.def, BINES[i].id, x, y);
          return;
        }
      }
    }
    // Al aire: el residuo vuelve a la cinta por donde iba (sin regalar tiempo)
    const enX = Math.min(Math.max(x, 10), this.lienzo.width - 80);
    let i = 0;
    while(i < this.residuos.length && this.residuos[i].x > enX) i++;
    this.residuos.splice(i, 0, { def: res.def, x: enX, balanceo: 0 });
  }

  terminar(razon){
    if(this.fondo.hidden) return;
    this.fondo.hidden = true;
    const cb = this.alTerminar;
    this.alTerminar = null;
    if(cb) cb(this.aciertos, this.aciertos + this.fallos, razon);
  }

  /* ---------------- dibujar ---------------- */

  dibujar(){
    const ctx = this.ctx, W = this.lienzo.width, H = this.lienzo.height;
    ctx.clearRect(0, 0, W, H);
    this.dibujarNave(ctx, W, H);

    // marcador
    ctx.font = '600 15px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#2dd48f';
    ctx.fillText('✓ ' + this.aciertos, 22, 34);
    ctx.fillStyle = '#f05a4a';
    ctx.fillText('✗ ' + this.fallos, 100, 34);
    ctx.fillStyle = '#c6d4e0';
    ctx.fillText('quedan ' + (this.porSalir + this.residuos.length
                              + (this.enMano ? 1 : 0)), W - 165, 34);

    this.dibujarCinta(ctx, W);
    for(const res of this.residuos){
      const bob = Math.sin(res.x * 0.05 + res.balanceo) * 2;
      this.dibujarResiduo(ctx, res.def, res.x, this.cintaY - 8 + bob);
    }
    for(const v of this.vuelos){
      const x = v.desdeX + (v.haciaX - v.desdeX) * v.t;
      const y = v.desdeY + (v.haciaY - v.desdeY) * v.t - Math.sin(v.t * Math.PI) * 60;
      this.dibujarResiduo(ctx, v.def, x, y);
    }
    BINES.forEach((bin, i) => this.dibujarBin(ctx, bin, i));
    // El agarrado va en la mano, por encima de todo y un poco más grande
    if(this.enMano){
      ctx.save();
      ctx.translate(this.enMano.x, this.enMano.y);
      ctx.scale(1.15, 1.15);
      this.dibujarResiduo(ctx, this.enMano.def, 0, 0);
      ctx.restore();
    }
    // Y LA MANO del operario como puntero: abierta al vuelo, agarrando
    // cuando llevas algo. El cursor del sistema se esconde por CSS.
    if(this.manoDentro && !this.fin)
      this.dibujarMano(ctx, this.manoX, this.manoY, !!this.enMano);

    // El PRELUDIO: la regla del resto en grande, con sus cuatro caras, antes
    // de que salga el primer residuo. Es la lección del minijuego y en la
    // letra pequeña del telón no la leía nadie (petición del autor).
    if(this.preludio > 0 && !this.fin){
      ctx.fillStyle = 'rgba(6,12,18,0.8)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0a04a';
      ctx.font = '700 26px "IBM Plex Mono", monospace';
      ctx.fillText('NO TODO SE RECICLA', W / 2, 88);
      ctx.fillStyle = '#dfe9f1';
      ctx.font = '600 15px "IBM Plex Mono", monospace';
      ctx.fillText('Cada residuo, a su contenedor.', W / 2, 126);
      ctx.fillText('Pero estos cuatro NO tienen: ni los toques.', W / 2, 150);
      ctx.fillText('Déjalos seguir hasta el vertedero — eso también puntúa.', W / 2, 174);
      const resto = RESIDUOS.filter(d => d.frac === null);
      resto.forEach((d, i) =>
        this.dibujarResiduo(ctx, d, W / 2 + (i - 1.5) * 95, 250));
      ctx.fillStyle = '#8aa0b4';
      ctx.font = '600 13px "IBM Plex Mono", monospace';
      ctx.fillText('toca para empezar — la cinta arranca en '
                   + Math.ceil(this.preludio) + ' s', W / 2, 340);
      ctx.textAlign = 'left';
    }

    if(this.fin){
      const total = this.aciertos + this.fallos;
      ctx.fillStyle = 'rgba(6,12,18,0.75)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#eef6fb';
      ctx.font = '700 30px "IBM Plex Mono", monospace';
      ctx.fillText('FIN DEL TURNO', W / 2, H / 2 - 22);
      ctx.font = '600 19px "IBM Plex Mono", monospace';
      ctx.fillStyle = this.aciertos / Math.max(1, total) > 0.7 ? '#2dd48f' : '#f0a04a';
      ctx.fillText(this.aciertos + ' de ' + total + ' bien separados', W / 2, H / 2 + 16);
      ctx.textAlign = 'left';
    }
  }

  /** La nave: la ilustración del autor si existe; si no, la de código. */
  dibujarNave(ctx, W, H){
    if(this.hayNave){
      // a sangre, recortando lo que sobre, y un velo para que el juego se lea
      const esc = Math.max(W / this.nave.width, H / this.nave.height);
      const nw = this.nave.width * esc, nh = this.nave.height * esc;
      ctx.drawImage(this.nave, (W - nw) / 2, (H - nh) / 2, nw, nh);
      ctx.fillStyle = 'rgba(8,14,22,0.45)';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    // La nave de código: pared, cerchas y ventanales altos
    ctx.fillStyle = '#16222e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1b2937';
    ctx.fillRect(0, 0, W, this.cintaY + 30);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 8;
    for(let x = -40; x < W + 40; x += 130){
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 70, this.cintaY + 30);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(140,190,230,0.10)';
    for(let x = 30; x < W - 60; x += 150) ctx.fillRect(x, 18, 90, 34);
  }

  /**
   * La cinta como MÁQUINA y no como una franja pintada: patas ancladas al
   * suelo, bastidor metálico con sus tornillos, rodillos con eje que asoman
   * entre pata y pata, la banda con sus flechas de marcha y el vertedero del
   * final con rayas de peligro. El mismo cel-shading de las piezas: contorno
   * gordo, color plano, banda de luz.
   */
  dibujarCinta(ctx, W){
    const y = this.cintaY;
    // las PATAS: ancladas cada tanto, con su zapata
    for(let x = 46; x < W - 20; x += 128){
      ctx.fillStyle = '#141d26';
      ctx.fillRect(x - 7, y + 30, 14, 46);
      ctx.fillStyle = '#26313d';
      ctx.fillRect(x - 4, y + 32, 8, 42);
      ctx.fillStyle = '#141d26';
      ctx.fillRect(x - 13, y + 72, 26, 8);           // la zapata al suelo
    }
    // sombra de la máquina al suelo
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y + 76, W, 10);
    // los RODILLOS, con eje y brillo, asomando bajo el bastidor
    for(let x = 26; x < W; x += 64){
      ctx.fillStyle = '#141d26';
      ctx.beginPath(); ctx.arc(x, y + 42, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a4a58';
      ctx.beginPath(); ctx.arc(x, y + 42, 6.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#8ea3b6';
      ctx.beginPath(); ctx.arc(x - 2, y + 40, 2.2, 0, 7); ctx.fill();
    }
    // la BANDA: goma oscura con lomo de luz
    ctx.fillStyle = '#141d26';
    ctx.fillRect(0, y + 4, W, 28);
    ctx.fillStyle = '#26313d';
    ctx.fillRect(0, y + 8, W, 21);
    ctx.fillStyle = '#3f5060';
    ctx.fillRect(0, y + 10, W, 7);
    // las FLECHAS de marcha viajando con la cinta: dicen hacia dónde va
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const paso = 46, corr = (this.reloj * this.velocidad) % paso;
    ctx.beginPath();
    for(let x = -paso + corr; x < W; x += paso){
      ctx.moveTo(x - 5, y + 13); ctx.lineTo(x + 3, y + 19); ctx.lineTo(x - 5, y + 25);
    }
    ctx.stroke();
    // el BASTIDOR: el perfil metálico que remata la máquina, con tornillos
    ctx.fillStyle = '#141d26';
    ctx.fillRect(0, y + 26, W, 12);
    ctx.fillStyle = '#4b5c6b';
    ctx.fillRect(0, y + 28, W, 8);
    ctx.fillStyle = '#7d94a6';
    ctx.fillRect(0, y + 28, W, 3);
    ctx.fillStyle = '#141d26';
    for(let x = 30; x < W; x += 64){
      ctx.beginPath(); ctx.arc(x, y + 32, 2.4, 0, 7); ctx.fill();
    }
    // el VERTEDERO del final: la tolva con sus rayas de peligro
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(W - 56, y + 50, 56, 12);
    ctx.fillStyle = '#141d26';
    ctx.fillRect(W - 52, y - 52, 52, 108);
    ctx.fillStyle = '#31404d';
    ctx.fillRect(W - 46, y - 46, 40, 98);
    ctx.fillStyle = '#26313d';
    ctx.fillRect(W - 46, y - 46, 40, 12);
    // boca oscura por donde cae lo que llega
    ctx.fillStyle = '#0c151d';
    ctx.beginPath(); ctx.ellipse(W - 26, y + 6, 16, 22, 0, 0, 7); ctx.fill();
    // rayas amarillas y negras en el canto: aquí acaba la cinta
    ctx.save();
    ctx.beginPath(); ctx.rect(W - 52, y - 52, 8, 108); ctx.clip();
    for(let i = 0; i < 12; i++){
      ctx.fillStyle = i % 2 ? '#141d26' : '#facc15';
      ctx.beginPath();
      ctx.moveTo(W - 52, y - 52 + i * 10); ctx.lineTo(W - 44, y - 60 + i * 10);
      ctx.lineTo(W - 44, y - 50 + i * 10); ctx.lineTo(W - 52, y - 42 + i * 10);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#c6d4e0';
    ctx.font = '700 9px "IBM Plex Mono", monospace';
    ctx.save();
    ctx.translate(W - 18, y + 36); ctx.rotate(-Math.PI / 2);
    ctx.fillText('VERTEDERO', 0, 0);
    ctx.restore();
  }

  /* ---- los residuos, uno a uno y que se RECONOZCAN ---- */

  dibujarResiduo(ctx, def, x, y){
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    // sombra común al suelo de la cinta
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(3, 26, 20, 6, 0, 0, 7); ctx.fill();
    const sprite = SPRITES[def.dibujo];
    if(sprite && sprite.naturalWidth > 0){
      // el sprite del autor, encajado en la caja del residuo (~60px de alto)
      const alto = 62, ancho = alto * (sprite.naturalWidth / sprite.naturalHeight);
      ctx.drawImage(sprite, -ancho / 2, -34, ancho, alto);
    } else if(this['res_' + def.dibujo]){
      this['res_' + def.dibujo](ctx);
    }
    ctx.restore();
  }

  /** El contorno + relleno de tebeo que comparten todos. */
  forma(ctx, color, traza){
    ctx.fillStyle = '#141d26';
    ctx.lineWidth = 7; ctx.strokeStyle = '#141d26';
    ctx.beginPath(); traza(ctx); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); traza(ctx); ctx.fill();
  }

  res_caja(ctx){   // caja de cartón con solapas y cinta
    this.forma(ctx, '#b98a4f', c => c.rect(-22, -14, 44, 36));
    ctx.fillStyle = '#a06f38';
    ctx.fillRect(-22, -14, 44, 9);
    ctx.fillStyle = '#d8b070';
    ctx.beginPath(); ctx.moveTo(-22, -14); ctx.lineTo(-4, -24); ctx.lineTo(14, -14); ctx.fill();
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(-3, -14, 6, 36);
  }

  res_periodico(ctx){   // periódico doblado
    this.forma(ctx, '#e5e7eb', c => c.rect(-24, -8, 48, 26));
    ctx.fillStyle = '#9aa4af';
    for(let i = 0; i < 3; i++) ctx.fillRect(-17, -2 + i * 7, 34, 3);
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-17, -13, 22, 7);
  }

  res_botellaVidrio(ctx){   // botella verde
    this.forma(ctx, '#2f9e57', c => {
      c.moveTo(-4, -30); c.lineTo(4, -30); c.lineTo(4, -14);
      c.quadraticCurveTo(13, -8, 13, 4); c.lineTo(13, 24); c.lineTo(-13, 24);
      c.lineTo(-13, 4); c.quadraticCurveTo(-13, -8, -4, -14); c.closePath();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-9, -2, 5, 22);
    ctx.fillStyle = '#c9b458';
    ctx.fillRect(-5, -31, 10, 5);
  }

  res_tarro(ctx){   // tarro con tapa
    this.forma(ctx, '#7fc9a2', c => c.rect(-14, -12, 28, 34));
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(-10, -6, 5, 24);
    ctx.fillStyle = '#141d26';
    ctx.fillRect(-16, -20, 32, 10);
    ctx.fillStyle = '#8a97a5';
    ctx.fillRect(-14, -18, 28, 6);
  }

  res_botellaPlastico(ctx){   // botella de plástico con tapón azul
    this.forma(ctx, '#bfe3f2', c => {
      c.moveTo(-5, -28); c.lineTo(5, -28); c.lineTo(5, -16);
      c.quadraticCurveTo(11, -10, 11, 0); c.lineTo(11, 24); c.lineTo(-11, 24);
      c.lineTo(-11, 0); c.quadraticCurveTo(-11, -10, -5, -16); c.closePath();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-8, -4, 4, 24);
    ctx.fillStyle = '#1d6fb8';
    ctx.fillRect(-6, -32, 12, 7);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-11, 6, 22, 9);
  }

  res_lata(ctx){   // lata de refresco
    this.forma(ctx, '#d64545', c => c.rect(-12, -18, 24, 40));
    ctx.fillStyle = '#e8edf2';
    ctx.fillRect(-12, -18, 24, 7);
    ctx.fillRect(-12, 16, 24, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-8, -10, 5, 26);
    ctx.fillStyle = '#f2f6fa';
    ctx.beginPath(); ctx.ellipse(0, -18, 10, 3.5, 0, 0, 7); ctx.fill();
  }

  res_brik(ctx){   // brik de leche/zumo con pajita
    this.forma(ctx, '#e8944a', c => c.rect(-14, -20, 28, 42));
    ctx.fillStyle = '#f2f6fa';
    ctx.fillRect(-14, -6, 28, 14);
    ctx.fillStyle = '#c9762e';
    ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(0, -27); ctx.lineTo(14, -20); ctx.fill();
    ctx.strokeStyle = '#e8edf2'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(8, -27); ctx.lineTo(12, -36); ctx.stroke();
  }

  res_manzana(ctx){   // corazón de manzana mordida
    this.forma(ctx, '#efe6c8', c => {
      c.moveTo(-12, -16); c.quadraticCurveTo(0, -8, 12, -16);
      c.quadraticCurveTo(4, 0, 12, 16); c.quadraticCurveTo(0, 8, -12, 16);
      c.quadraticCurveTo(-4, 0, -12, -16);
    });
    ctx.fillStyle = '#b23b3b';
    ctx.beginPath(); ctx.ellipse(0, -17, 11, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5b3b1e';
    ctx.fillRect(-1.5, -26, 3, 8);
    ctx.fillStyle = '#3d2a12';
    ctx.beginPath(); ctx.ellipse(0, 1, 2.5, 4, 0.4, 0, 7); ctx.fill();
  }

  res_raspa(ctx){   // raspa de pescado
    this.forma(ctx, '#dbe4ec', c => {
      c.moveTo(-24, 0); c.lineTo(-15, -8); c.lineTo(-15, 8); c.closePath();
    });
    ctx.strokeStyle = '#141d26'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(16, 0); ctx.stroke();
    ctx.strokeStyle = '#dbe4ec'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(16, 0);
    for(let i = -10; i <= 10; i += 5){
      ctx.moveTo(i, 0); ctx.lineTo(i - 4, -8);
      ctx.moveTo(i, 0); ctx.lineTo(i - 4, 8);
    }
    ctx.stroke();
    this.forma(ctx, '#dbe4ec', c => c.arc(20, 0, 6.5, 0, 7));
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.arc(21, -1.5, 1.8, 0, 7); ctx.fill();
  }

  res_platano(ctx){   // piel de plátano abierta
    this.forma(ctx, '#f0d048', c => {
      c.moveTo(0, -6);
      c.quadraticCurveTo(-20, -2, -16, 18); c.quadraticCurveTo(-8, 10, -4, 2);
      c.quadraticCurveTo(0, 12, 0, 20); c.quadraticCurveTo(6, 10, 6, 2);
      c.quadraticCurveTo(12, 12, 18, 16); c.quadraticCurveTo(20, -4, 0, -6);
    });
    ctx.fillStyle = '#8a6d1e';
    ctx.fillRect(-3, -14, 6, 9);
  }

  res_bolsa(ctx){   // la bolsa de resto, atada: NO se toca
    this.forma(ctx, '#8a97a5', c => {
      c.moveTo(0, -18);
      c.quadraticCurveTo(18, -12, 16, 8); c.quadraticCurveTo(14, 22, 0, 22);
      c.quadraticCurveTo(-14, 22, -16, 8); c.quadraticCurveTo(-18, -12, 0, -18);
    });
    ctx.fillStyle = '#6b7885';
    ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(0, -26); ctx.lineTo(3, -16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, -16); ctx.lineTo(9, -24); ctx.lineTo(9, -15); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.arc(-6, 0, 6, 0, 7); ctx.fill();
  }

  /**
   * La mano del operario, de tebeo: guante de trabajo con puño amarillo.
   * Abierta cuando va de vacío; cerrada en puño cuando agarra el residuo
   * (que se dibuja debajo, en la cinta de sus dedos).
   */
  dibujarMano(ctx, x, y, agarrando){
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(2, 7, 11, 4.5, 0, 0, 7); ctx.fill();
    const guante = '#e8edf2', tinta = '#141d26';

    // La mano se arma con CÁPSULAS (trazos de punta redonda): primero todas
    // las tintas, luego todos los rellenos — así la silueta es una sola y no
    // hay aristas. Antes iba a polígono y quedaba tosca y demasiado grande.
    const capsulas = agarrando
      // el puño: la palma cerrada y el pulgar cruzado por delante
      ? [[-4, -6, 4, -6, 15], [-7, 2, 5, 3, 7]]
      // abierta: palma, cuatro dedos y el pulgar hacia fuera
      : [[-5, 0, 5, 0, 13],
         [-7, -1, -7, -10, 4.5], [-2.5, -2, -2.5, -13, 4.5],
         [2, -2, 2, -12, 4.5], [6.5, -1, 6.5, -9, 4.5],
         [-6, 2, -13, -2, 5]];
    for(const margen of [4.5, 0]){
      ctx.strokeStyle = margen ? tinta : guante;
      for(const [x1, y1, x2, y2, g] of capsulas){
        ctx.lineWidth = g + margen;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    // los pliegues: nudillos en el puño, separación de dedos en la abierta
    ctx.strokeStyle = '#b7c4d0'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    if(agarrando){
      for(const dx of [-4, 0.5, 5]){
        ctx.moveTo(dx, -11); ctx.quadraticCurveTo(dx + 1.5, -7, dx, -4);
      }
    } else {
      for(const dx of [-4.8, -0.3, 4.2]){
        ctx.moveTo(dx, -3); ctx.lineTo(dx, -8);
      }
    }
    ctx.stroke();
    // el puño del guante, amarillo de obra
    ctx.fillStyle = tinta;
    ctx.beginPath(); ctx.roundRect(-9, 5, 19, 11, 2); ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.roundRect(-7.5, 6.5, 16, 8, 1.5); ctx.fill();
    ctx.fillStyle = '#c9a20e';
    ctx.fillRect(-7.5, 12.5, 16, 2);
    ctx.restore();
  }

  /**
   * Un contenedor de CALLE, con la carrocería de los de verdad: cuerpo que se
   * estrecha hacia abajo, nervios verticales, cel-shading (cara de luz a la
   * izquierda, sombra a la derecha), tapa abombada con su asa, boca oscura
   * bajo la tapa y ruedas con tapacubos. Es el botón del juego: cuanto más
   * mueble parezca, menos interfaz parece.
   */
  dibujarBin(ctx, bin, i){
    const x = this.binX(i), y = this.binY;
    const w = this.binAncho, h = this.binAlto - 34;
    const flash = this.flashBin && this.flashBin.id === bin.id ? this.flashBin : null;
    // si llevas algo en la mano, los contenedores se ofrecen
    if(this.enMano){
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.beginPath(); ctx.roundRect(x - 8, y - 12, w + 16, h + 28, 12); ctx.fill();
    }
    ctx.lineJoin = 'round';
    // sombra al suelo (la comparten el sprite y el dibujo por código)
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 8, w * 0.52, 7, 0, 0, 7); ctx.fill();

    const spr = SPRITES_BIN[bin.id];
    if(spr && spr.naturalWidth > 0){
      // el contenedor ilustrado, apoyado en el mismo suelo que el de código
      const alto = h + 26;
      const ancho = Math.min(w + 14, alto * (spr.naturalWidth / spr.naturalHeight));
      ctx.drawImage(spr, x + w / 2 - ancho / 2, y + h + 4 - alto, ancho, alto);
      this.rotularBin(ctx, bin, x, y, w, h, flash);
      return;
    }
    // RUEDAS con tapacubos (antes que el cuerpo, que pisa)
    for(const dx of [0.2, 0.8]){
      ctx.fillStyle = '#141d26';
      ctx.beginPath(); ctx.arc(x + w * dx, y + h + 2, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#4b5c6b';
      ctx.beginPath(); ctx.arc(x + w * dx, y + h + 2, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#8ea3b6';
      ctx.beginPath(); ctx.arc(x + w * dx - 1.5, y + h, 1.8, 0, 7); ctx.fill();
    }
    // el CUERPO: se estrecha hacia abajo, como los de polietileno de calle
    const cuerpo = (m) => {
      ctx.beginPath();
      ctx.moveTo(x - m, y + 8);
      ctx.lineTo(x + w + m, y + 8);
      ctx.lineTo(x + w - 7 + m, y + h - 2);
      ctx.quadraticCurveTo(x + w / 2, y + h + 4 + m, x + 7 - m, y + h - 2);
      ctx.closePath();
    };
    ctx.fillStyle = '#141d26'; cuerpo(3.5); ctx.fill();       // contorno
    ctx.fillStyle = bin.color; cuerpo(0); ctx.fill();
    // cel-shading: cara de sombra a la derecha, filo de luz a la izquierda
    ctx.save();
    cuerpo(0); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + w * 0.62, y + 8, w * 0.4, h);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 4, y + 10, 9, h - 10);
    // los NERVIOS verticales del cuerpo
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 4;
    ctx.beginPath();
    for(const t of [0.3, 0.5, 0.7]){
      ctx.moveTo(x + w * t, y + 16); ctx.lineTo(x + w * t, y + h - 6);
    }
    ctx.stroke();
    ctx.restore();
    // la BOCA: la ranura oscura bajo la tapa, que es donde "entra" el residuo
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(x + 8, y + 6, w - 16, 9, 4); ctx.fill();
    // la TAPA abombada, con su asa y su brillo
    ctx.fillStyle = '#141d26';
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 9);
    ctx.quadraticCurveTo(x + w / 2, y - 20, x + w + 9, y + 9);
    ctx.closePath(); ctx.fill();
    const tapa = this.oscurecerColor(bin.color, 0.82);
    ctx.fillStyle = tapa;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 7);
    ctx.quadraticCurveTo(x + w / 2, y - 15, x + w + 5, y + 7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 2);
    ctx.quadraticCurveTo(x + w / 2, y - 11, x + w - 10, y + 2);
    ctx.quadraticCurveTo(x + w / 2, y - 6, x + 10, y + 2);
    ctx.closePath(); ctx.fill();
    // el asa
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(x + w / 2 - 14, y - 12, 28, 7, 3); ctx.fill();
    ctx.fillStyle = '#4b5c6b';
    ctx.beginPath(); ctx.roundRect(x + w / 2 - 11, y - 10, 22, 3.5, 2); ctx.fill();
    this.rotularBin(ctx, bin, x, y, w, h, flash);
  }

  /** La capa de INTERFAZ del contenedor: placa del nombre y ✓/✗. Va encima
   *  tanto del sprite como del dibujo por código. */
  rotularBin(ctx, bin, x, y, w, h, flash){
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.roundRect(x + 12, y + h - 32, w - 24, 20, 4); ctx.fill();
    ctx.fillStyle = '#eef6fb';
    ctx.font = '700 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(bin.nombre, x + w / 2, y + h - 18);
    ctx.textAlign = 'left';
    if(flash){
      ctx.font = '700 34px "IBM Plex Mono", monospace';
      ctx.fillStyle = flash.bueno ? '#2dd48f' : '#f05a4a';
      ctx.fillText(flash.bueno ? '✓' : '✗', x + w / 2 - 12, y - 24);
    }
  }

  /** Oscurecer un color #rrggbb sin salir del estilo plano (para las tapas). */
  oscurecerColor(hex, f){
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.round(v * f);
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }
}
