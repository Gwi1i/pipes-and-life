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
   cinta de verdad no repite la misma botella toda la mañana. */
const RESIDUOS = [
  { frac: 'papel',    dibujo: 'caja' },
  { frac: 'papel',    dibujo: 'periodico' },
  { frac: 'vidrio',   dibujo: 'botellaVidrio' },
  { frac: 'vidrio',   dibujo: 'tarro' },
  { frac: 'envases',  dibujo: 'botellaPlastico' },
  { frac: 'envases',  dibujo: 'lata' },
  { frac: 'envases',  dibujo: 'brik' },
  { frac: 'organica', dibujo: 'manzana' },
  { frac: 'organica', dibujo: 'raspa' },
  { frac: 'organica', dibujo: 'platano' },
  { frac: null,       dibujo: 'bolsa' }        // el resto: no se toca
];

const BINES = [
  { id: 'envases',  nombre: 'ENVASES',  color: '#facc15' },
  { id: 'organica', nombre: 'ORGÁNICA', color: '#a16207' },
  { id: 'papel',    nombre: 'PAPEL',    color: '#3b82f6' },
  { id: 'vidrio',   nombre: 'VIDRIO',   color: '#22c55e' }
];

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
      if(this.enMano) [this.enMano.x, this.enMano.y] = pos(e);
    });
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
    if(Math.random() < K.probResto) return RESIDUOS[RESIDUOS.length - 1];
    return RESIDUOS[Math.floor(Math.random() * (RESIDUOS.length - 1))];
  }

  /* ---------------- jugar ---------------- */

  tick(dt){
    this.reloj += dt;
    if(this.fin){
      this.fin.t += dt;
      if(this.fin.t > 1.6) this.terminar('fin');
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

  dibujarCinta(ctx, W){
    const y = this.cintaY;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, y + 18, W, 16);
    ctx.fillStyle = '#141d26';
    ctx.fillRect(0, y + 6, W, 26);
    ctx.fillStyle = '#26313d';
    ctx.fillRect(0, y + 9, W, 20);
    ctx.fillStyle = '#3a4a58';
    ctx.fillRect(0, y + 11, W, 7);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 26]);
    ctx.lineDashOffset = -(this.reloj * this.velocidad) % 42;
    ctx.beginPath();
    ctx.moveTo(0, y + 20); ctx.lineTo(W, y + 20);
    ctx.stroke();
    ctx.setLineDash([]);
    // rodillos
    ctx.fillStyle = '#141d26';
    for(let x = 26; x < W; x += 64){
      ctx.beginPath(); ctx.arc(x, y + 34, 7, 0, 7); ctx.fill();
    }
    // el vertedero del final
    ctx.fillStyle = '#141d26';
    ctx.fillRect(W - 52, y - 52, 52, 104);
    ctx.fillStyle = '#31404d';
    ctx.fillRect(W - 46, y - 46, 40, 92);
    ctx.fillStyle = '#c6d4e0';
    ctx.font = '700 9px "IBM Plex Mono", monospace';
    ctx.save();
    ctx.translate(W - 21, y + 36); ctx.rotate(-Math.PI / 2);
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
    this['res_' + def.dibujo](ctx);
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

  /** Un contenedor de calle: cuerpo, tapa, ruedas y su nombre. */
  dibujarBin(ctx, bin, i){
    const x = this.binX(i), y = this.binY;
    const w = this.binAncho, h = this.binAlto - 34;
    const flash = this.flashBin && this.flashBin.id === bin.id ? this.flashBin : null;
    // si llevas algo en la mano, los contenedores se ofrecen
    if(this.enMano){
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.roundRect(x - 8, y - 10, w + 16, h + 24, 12); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 5, y + h + 2, w - 6, 8);
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(x - 3, y + 7, w + 6, h - 4, 10); ctx.fill();
    ctx.fillStyle = bin.color;
    ctx.beginPath(); ctx.roundRect(x, y + 10, w, h - 10, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + 6, y + 14, w - 12, 9);
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(x - 6, y - 2, w + 12, 16, 6); ctx.fill();
    ctx.fillStyle = bin.color;
    ctx.beginPath(); ctx.roundRect(x - 3, y, w + 6, 11, 5); ctx.fill();
    ctx.fillStyle = '#141d26';
    for(const dx of [0.22, 0.78]){
      ctx.beginPath(); ctx.arc(x + w * dx, y + h + 6, 7, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 8, y + h - 34, w - 16, 22);
    ctx.fillStyle = '#eef6fb';
    ctx.font = '700 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(bin.nombre, x + w / 2, y + h - 19);
    ctx.textAlign = 'left';
    if(flash){
      ctx.font = '700 34px "IBM Plex Mono", monospace';
      ctx.fillStyle = flash.bueno ? '#2dd48f' : '#f05a4a';
      ctx.fillText(flash.bueno ? '✓' : '✗', x + w / 2 - 12, y - 16);
    }
  }
}
