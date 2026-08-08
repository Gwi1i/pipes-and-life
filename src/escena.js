/**
 * ESCENA — el diorama, versión "dibujos animados".
 *
 * Es PURAMENTE visual: mira el estado y lo dibuja bonito y vivo. LEE el estado,
 * nunca lo modifica. Lo único que guarda es su reloj de animación y los efectos
 * pasajeros (clima, destellos, aparición de estructuras), que no son estado.
 *
 * Muestra el CICLO DEL AGUA completo del pueblo activo, de aguas arriba a aguas
 * abajo: río → captación → bombeo → depósito → pueblo → saneamiento →
 * depuradora → de vuelta al cauce. El río es común y se enturbia con la
 * contaminación. El paisaje cambia con la estación (sol, lluvia, nieve, flores)
 * y con la hora (día/noche).
 *
 * Todo se dibuja a mano con Canvas 2D (sin dependencias): formas redondeadas con
 * contorno, sombreado plano y movimiento (rebote, oleaje, parallax, partículas).
 */

import { CONFIG } from './config.js';
import { capacidad, fraccionTratada } from './simulacion.js';
import { limitar } from './util.js';

export class Escena {

  constructor(lienzo){
    this.lienzo = lienzo;
    this.ctx = lienzo.getContext('2d');
    this.tiempo = 0;
    this.pulso = 0;
    this.aparicionDeposito = 0;
    this.aparicionCaptacion = 0;
    this.aparicionDepuradora = 0;
    this.cauceFlash = 0;
    this.destellos = [];
    this.particulas = [];       // clima: lluvia / nieve / flores
    this.nubes = null;          // se generan al conocer el tamaño
    this.ajustar();
    window.addEventListener('resize', () => this.ajustar());
  }

  ajustar(){
    const dpr = window.devicePixelRatio || 1;
    const caja = this.lienzo.parentElement.getBoundingClientRect();
    this.ancho = Math.max(320, caja.width);
    this.alto  = Math.max(240, caja.height);
    this.lienzo.width  = Math.round(this.ancho * dpr);
    this.lienzo.height = Math.round(this.alto  * dpr);
    this.lienzo.style.width  = this.ancho + 'px';
    this.lienzo.style.height = this.alto  + 'px';
    this.nubes = null;   // regenerar a la nueva anchura
  }

  /* ---------- efectos que dispara main.js ---------- */
  destello(x, y){ this.pulso = 1; if(x != null) this.destellos.push({ x, y, t: 0 }); }
  aparecerDeposito(){ this.aparicionDeposito = 0.0001; }
  aparecerCaptacion(){ this.aparicionCaptacion = 0.0001; }
  aparecerDepuradora(){ this.aparicionDepuradora = 0.0001; }
  destelloCauce(){ this.cauceFlash = 1; }

  avanzarAparicion(clave, dt){
    if(this[clave] > 0 && this[clave] < 1) this[clave] = Math.min(1, this[clave] + dt * 2.5);
  }

  /* ================================================================
     DIBUJO
     ================================================================ */

  dibujar(estado, resultado, dt){
    const ctx = this.ctx;
    this.tiempo += dt;
    this.pulso = Math.max(0, this.pulso - dt * 2.2);
    if(resultado.bombeoAuto) this.pulso = Math.max(this.pulso, 0.18);
    this.avanzarAparicion('aparicionDeposito', dt);
    this.avanzarAparicion('aparicionCaptacion', dt);
    this.avanzarAparicion('aparicionDepuradora', dt);
    this.cauceFlash = Math.max(0, this.cauceFlash - dt * 2.5);
    this.destellos = this.destellos.filter(d => (d.t += dt) < 0.6);

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.ancho, H = this.alto;

    // --- contexto del fotograma (se guarda en this para no pasarlo mil veces) ---
    const p = estado.activo;
    this._W = W; this._H = H; this._p = p; this._res = resultado;
    this.hora = ((estado.horas % 24) + 24) % 24;
    this.luz = Math.max(0, Math.sin(((this.hora - 6) / 12) * Math.PI));  // 0 noche, 1 mediodía
    this.est = this.estacion(estado.horas);
    this.suciedad = resultado.suciedad ?? (estado.contaminacion / CONFIG.cauce.contaminacionMax);

    // geometría de la escena
    this.horizonteY = H * 0.50;
    this.sueloY = H * 0.66;   // dónde se asientan los edificios
    this.rioY   = H * 0.84;   // arriba de la banda de río del primer plano

    if(!this.nubes) this.generarNubes();

    this.cielo();
    this.astro();
    this.nubesDibujar(dt);
    this.colinas();
    this.arboles(true);        // árboles de fondo (tras los edificios)
    this.suelo();
    this.rio(dt);
    this.tuberiaSaneamiento();  // detrás de los edificios
    if(p.mejoras.captacion > 0) this.captacion();
    this.bomba();
    if(p.mejoras.deposito > 0) this.deposito();
    if(p.mejoras.depuradora > 0) this.depuradora();
    this.tuberiaAbastecimiento();
    this.pueblo();
    this.arboles(false);       // un par de árboles en primer plano
    this.vertido();            // descarga al cauce (sucia o limpia)
    this.clima(dt);
    if(resultado.averiada) this.averiaIndicador();
    this.destellosClic();
  }

  /* ---------- estación del año (interpolada) ---------- */
  estacion(horas){
    const E = CONFIG.estaciones;
    const frac = ((horas % CONFIG.tiempo.horasPorAño) / CONFIG.tiempo.horasPorAño + 1) % 1;
    const pos = frac * E.length;
    const i = Math.floor(pos) % E.length;
    const t = pos - Math.floor(pos);
    const sig = E[(i + 1) % E.length];
    // Cada estación mantiene su color casi todo el trimestre y solo se funde con
    // la siguiente en el último tramo: así cada una tiene identidad propia.
    const tb = t < 0.7 ? 0 : (t - 0.7) / 0.3;
    return {
      i, t, nombre: E[i].nombre,
      follaje: mezclarColor(E[i].follaje, sig.follaje, tb),
      hierba:  mezclarColor(E[i].hierba,  sig.hierba,  tb),
      tinte: E[i].tinte,
      clima: E[i].clima,
      climaSig: sig.clima
    };
  }

  /* ---------- cielo con día/noche + tinte estacional ---------- */
  cielo(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H;
    const noche = ctx.createLinearGradient(0, 0, 0, this.horizonteY + H * 0.1);
    noche.addColorStop(0, C.cieloNoche[0]);
    noche.addColorStop(0.6, C.cieloNoche[1]);
    noche.addColorStop(1, C.cieloNoche[2]);
    ctx.fillStyle = noche; ctx.fillRect(0, 0, W, this.horizonteY + H * 0.1);

    const dia = ctx.createLinearGradient(0, 0, 0, this.horizonteY + H * 0.1);
    dia.addColorStop(0, C.cielo[0]); dia.addColorStop(0.6, C.cielo[1]); dia.addColorStop(1, C.cielo[2]);
    ctx.globalAlpha = this.luz; ctx.fillStyle = dia;
    ctx.fillRect(0, 0, W, this.horizonteY + H * 0.1);
    ctx.globalAlpha = 1;

    // Tinte de la estación, sutil
    ctx.fillStyle = this.est.tinte;
    ctx.fillRect(0, 0, W, this.horizonteY + H * 0.1);
  }

  /* ---------- sol o luna con rayos ---------- */
  astro(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, h = this.hora;
    const esDia = h >= 5 && h < 19;
    const fx = esDia ? (h - 5) / 14 : (((h < 5 ? h + 24 : h) - 19) / 10);
    const ax = W * (0.12 + 0.76 * fx);
    const ay = H * (0.30 - Math.sin(limitar(fx, 0, 1) * Math.PI) * 0.20);
    const r = Math.min(W, H) * 0.05;
    const tono = esDia ? '245,196,81' : '203,213,225';

    if(esDia){   // rayos girando, aire de dibujo animado
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(this.tiempo * 0.12);
      ctx.strokeStyle = `rgba(${tono},${0.25 * this.luz + 0.05})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for(let k = 0; k < 12; k++){
        ctx.rotate(Math.PI / 6);
        ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(r * 2.1, 0); ctx.stroke();
      }
      ctx.restore();
    }
    const halo = ctx.createRadialGradient(ax, ay, 0, ax, ay, r * 3);
    halo.addColorStop(0, `rgba(${tono},0.45)`); halo.addColorStop(1, `rgba(${tono},0)`);
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(ax, ay, r * 3, 0, 7); ctx.fill();
    ctx.fillStyle = esDia ? C.sol : C.luna;
    ctx.beginPath(); ctx.arc(ax, ay, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(6,15,24,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  }

  /* ---------- nubes con parallax ---------- */
  generarNubes(){
    this.nubes = [];
    const n = 4;
    for(let k = 0; k < n; k++){
      this.nubes.push({
        x: Math.random() * this.ancho,
        y: this.alto * (0.08 + Math.random() * 0.22),
        e: 0.7 + Math.random() * 0.8,
        v: 6 + Math.random() * 10
      });
    }
  }
  nubesDibujar(dt){
    const ctx = this.ctx, W = this._W;
    const alpha = 0.35 + this.luz * 0.4;
    for(const c of this.nubes){
      c.x += c.v * dt;
      if(c.x - 80 * c.e > W) c.x = -80 * c.e;
      const x = c.x, y = c.y, e = c.e;
      ctx.fillStyle = `rgba(230,240,248,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 16 * e, 0, 7);
      ctx.arc(x + 18 * e, y + 4 * e, 13 * e, 0, 7);
      ctx.arc(x - 18 * e, y + 4 * e, 12 * e, 0, 7);
      ctx.arc(x, y + 8 * e, 20 * e, 0, 7);
      ctx.fill();
    }
  }

  /* ---------- colinas con parallax y color de estación ---------- */
  colinas(){
    const ctx = this.ctx, W = this._W, H = this._H;
    const capas = [
      { y: this.horizonteY + 8, amp: 22, col: mezclarColor(this.est.hierba, '#0b1a12', 0.55), vel: 0.6 },
      { y: this.horizonteY + 30, amp: 30, col: mezclarColor(this.est.hierba, '#0b1a12', 0.35), vel: 1.0 }
    ];
    for(const c of capas){
      ctx.fillStyle = c.col;
      ctx.beginPath(); ctx.moveTo(0, H);
      for(let x = 0; x <= W; x += 12){
        const y = c.y + Math.sin(x * 0.008 + c.vel * 2) * c.amp + Math.sin(x * 0.02) * c.amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      // Nieve en las cimas en invierno
      if(this.est.i === 3 || (this.est.i === 2 && this.est.t > 0.6)){
        ctx.fillStyle = 'rgba(230,240,248,0.5)';
        ctx.beginPath(); ctx.moveTo(0, c.y + c.amp * 0.2);
        for(let x = 0; x <= W; x += 12){
          const y = c.y + Math.sin(x * 0.008 + c.vel * 2) * c.amp + Math.sin(x * 0.02) * c.amp * 0.4;
          ctx.lineTo(x, y + 3);
        }
        for(let x = W; x >= 0; x -= 12){
          const y = c.y + Math.sin(x * 0.008 + c.vel * 2) * c.amp + Math.sin(x * 0.02) * c.amp * 0.4;
          ctx.lineTo(x, y + 8);
        }
        ctx.closePath(); ctx.fill();
      }
    }
  }

  /* ---------- suelo / hierba ---------- */
  suelo(){
    const ctx = this.ctx, W = this._W, H = this._H;
    const g = ctx.createLinearGradient(0, this.sueloY, 0, H);
    g.addColorStop(0, this.est.hierba);
    g.addColorStop(1, mezclarColor(this.est.hierba, '#0b1a12', 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(0, this.sueloY, W, H - this.sueloY);
  }

  /* ---------- río en primer plano, teñido por la contaminación ---------- */
  rio(dt){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H;
    const suc = this.cauceFlash ? Math.max(0, this.suciedad - this.cauceFlash * 0.3) : this.suciedad;
    const base = mezclarColor(C.aguaProfunda, C.aguaSucia, suc);
    const g = ctx.createLinearGradient(0, this.rioY, 0, H);
    g.addColorStop(0, mezclarColor(C.agua, C.aguaSucia, suc));
    g.addColorStop(1, base);
    ctx.fillStyle = g; ctx.fillRect(0, this.rioY, W, H - this.rioY);

    // reflejos que fluyen (aguas abajo, izquierda→derecha)
    ctx.strokeStyle = `rgba(255,255,255,${0.10 + 0.06 * this.luz})`; ctx.lineWidth = 2;
    for(let k = 0; k < 4; k++){
      const y = this.rioY + 8 + k * (H - this.rioY) / 5;
      ctx.beginPath();
      for(let x = 0; x <= W; x += 8){
        const oy = Math.sin(x * 0.05 - this.tiempo * 2 + k) * 2;
        x === 0 ? ctx.moveTo(x, y + oy) : ctx.lineTo(x, y + oy);
      }
      ctx.stroke();
    }
  }

  /* ---------- captación: toma en el río ---------- */
  captacion(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H;
    const a = this.aparicionCaptacion === 0 ? 1 : this.aparicionCaptacion;
    const x = W * 0.07, y = this.rioY + (H - this.rioY) * 0.35;
    const s = Math.min(W, H) * 0.03 * (0.6 + 0.4 * a);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = C.captacion; ctx.globalAlpha = a * 0.3;
    ctx.beginPath(); ctx.arc(x, y, s * 1.9, 0, 7); ctx.fill();
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
    ctx.strokeStyle = '#062a2c'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
  }

  /* ---------- caseta de bombeo (el clic) ---------- */
  bomba(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p;
    const x = W * 0.17, w = W * 0.08, h = H * 0.15, y = this.sueloY - h;
    const auto = p.autobombaActivo;
    // squash/stretch: rebote al clicar
    const sx = 1 + this.pulso * 0.10, sy = 1 - this.pulso * 0.10;
    ctx.save(); ctx.translate(x, this.sueloY); ctx.scale(sx, sy); ctx.translate(-x, -this.sueloY);

    // tubo de aspiración hasta el río
    ctx.strokeStyle = C.captacion; ctx.globalAlpha = 0.7; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - w * 0.3, this.sueloY);
    ctx.lineTo(W * 0.07, this.rioY + (H - this.rioY) * 0.35); ctx.stroke();
    ctx.globalAlpha = 1;

    this.caja(x - w / 2, y, w, h, '#2a3f57');
    // tejado a dos aguas
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 5, y); ctx.lineTo(x + w / 2 + 5, y);
    ctx.lineTo(x, y - h * 0.3); ctx.closePath();
    ctx.fillStyle = '#42607f'; ctx.fill(); this.contorno();
    // ojo de buey con gota que late
    ctx.beginPath(); ctx.arc(x, y + h * 0.5, w * 0.2, 0, 7);
    ctx.fillStyle = `rgba(56,189,248,${0.55 + this.pulso * 0.45})`; ctx.fill(); this.contorno();
    ctx.restore();

    ctx.font = '700 10px IBM Plex Mono, ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = auto ? C.captacion : C.tenue;
    ctx.fillText(auto ? 'BOMBEO · AUTO' : 'BOMBEO', x, this.sueloY + 15);
  }

  /* ---------- depósito elevado ---------- */
  deposito(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p;
    const x = W * 0.36, w = W * 0.11, h = H * 0.24;
    const a = this.aparicionDeposito === 0 ? 1 : this.aparicionDeposito;
    const esc = 0.6 + 0.4 * a;
    const baseY = this.sueloY - h * 0.05, topeY = this.sueloY - h * 1.05;
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(x, baseY); ctx.scale(esc, esc); ctx.translate(-x, -baseY);

    // patas
    ctx.strokeStyle = C.estructura; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 6, baseY); ctx.lineTo(x - w / 2 + 6, baseY + h * 0.16);
    ctx.moveTo(x + w / 2 - 6, baseY); ctx.lineTo(x + w / 2 - 6, baseY + h * 0.16);
    ctx.stroke();

    const cuerpoH = baseY - topeY;
    const frac = limitar(p.agua / capacidad(p), 0, 1);
    const aguaY = baseY - cuerpoH * frac;
    // vaso
    ctx.beginPath(); ctx.roundRect(x - w / 2, topeY, w, cuerpoH, 6);
    ctx.fillStyle = '#12222f'; ctx.fill();
    // agua
    ctx.save(); ctx.clip();
    const grad = ctx.createLinearGradient(0, aguaY, 0, baseY);
    grad.addColorStop(0, C.agua); grad.addColorStop(1, C.aguaProfunda);
    ctx.fillStyle = grad; ctx.fillRect(x - w / 2, aguaY, w, baseY - aguaY);
    if(frac > 0.01){
      ctx.strokeStyle = '#bae6fd'; ctx.globalAlpha = a * 0.85; ctx.lineWidth = 2;
      ctx.beginPath();
      for(let px = x - w / 2; px <= x + w / 2; px += 5){
        const oy = Math.sin(px * 0.15 + this.tiempo * 3) * 1.8;
        px === x - w / 2 ? ctx.moveTo(px, aguaY + oy) : ctx.lineTo(px, aguaY + oy);
      }
      ctx.stroke(); ctx.globalAlpha = a;
    }
    ctx.restore();
    ctx.strokeStyle = C.deposito; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(x - w / 2, topeY, w, cuerpoH, 6); ctx.stroke();
    ctx.fillStyle = C.estructura; ctx.fillRect(x - w / 2 - 3, topeY - 5, w + 6, 6);
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.font = '700 11px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.deposito;
    ctx.fillText(Math.round(frac * 100) + '%', x, topeY - 9);
  }

  /* ---------- estación depuradora ---------- */
  depuradora(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p;
    const a = this.aparicionDepuradora === 0 ? 1 : this.aparicionDepuradora;
    const x = W * 0.80, base = this.sueloY, w = W * 0.14;
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(x, base); ctx.scale(0.6 + 0.4 * a, 0.6 + 0.4 * a); ctx.translate(-x, -base);

    // dos tanques circulares (clarificadores) con brazo giratorio y burbujas
    const r = Math.min(W, H) * 0.035;
    for(let k = 0; k < 2; k++){
      const cx = x - w / 2 + w * (0.28 + k * 0.44);
      const cy = base - r * 0.9;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7);
      ctx.fillStyle = mezclarColor('#1a3a34', C.depuradora, 0.25); ctx.fill();
      ctx.strokeStyle = C.depuradora; ctx.lineWidth = 2; ctx.stroke();
      // agua tratada burbujeando
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, 7); ctx.clip();
      ctx.fillStyle = 'rgba(52,211,153,0.35)';
      for(let b = 0; b < 4; b++){
        const bx = cx - r + ((this.tiempo * 20 + b * 37) % (r * 2));
        const by = cy + Math.sin(this.tiempo * 3 + b) * r * 0.4;
        ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, 7); ctx.fill();
      }
      ctx.restore();
      // brazo giratorio
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.tiempo * (0.8 + k * 0.2));
      ctx.strokeStyle = C.estructura; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 0.8, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.font = '700 9px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.depuradora;
    ctx.fillText(`DEPURADORA Nv${p.mejoras.depuradora}`, x, base + 15);
  }

  /* ---------- tubería de abastecimiento (limpia, azul) ---------- */
  tuberiaAbastecimiento(){
    const W = this._W, H = this._H, r = this._res, p = this._p;
    const yA = this.sueloY - H * 0.055;
    const xBomba = W * 0.17, xDep = W * 0.36, xPueblo = W * 0.52;
    const entra = this.pulso > 0.02 || r.produciendo;

    if(p.mejoras.deposito > 0){
      this.tubo(xBomba, yA, xDep, yA, entra, '#38bdf8');
      this.tubo(xDep, yA, xPueblo, yA, r.servicio > 0.01, '#38bdf8');
    } else {
      this.tubo(xBomba, yA, xPueblo, yA, entra && r.servicio > 0.01, '#38bdf8');
    }
  }

  /* ---------- tubería de saneamiento (retorno al cauce) ---------- */
  tuberiaSaneamiento(){
    const W = this._W, H = this._H, p = this._p;
    if(!p.saneamientoActivo) return;
    const yS = this.sueloY + (this.rioY - this.sueloY) * 0.55;
    const xPueblo = W * 0.60, xDepu = W * 0.80, xVert = W * 0.92;
    const suciedad = 1 - fraccionTratada(p);
    const colSucio = mezclarColor('#38bdf8', '#7a5a2a', 0.85);
    const fluye = p.saneamientoActivo;

    if(p.mejoras.depuradora > 0){
      // pueblo → depuradora (sucia) → cauce (según trate)
      this.tubo(xPueblo, yS, xDepu, yS, fluye, colSucio);
      const colSalida = mezclarColor('#38bdf8', '#7a5a2a', suciedad);
      this.tubo(xDepu, yS, xVert, yS, fluye, colSalida);
    } else {
      // sin depuradora: directo y crudo al cauce
      this.tubo(xPueblo, yS, xVert, yS, fluye, colSucio);
    }
    // bajante al río en el punto de vertido
    this.tubo(xVert, yS, xVert, this.rioY + 4, fluye,
      p.mejoras.depuradora > 0 ? mezclarColor('#38bdf8', '#7a5a2a', suciedad) : colSucio);
  }

  /** Un tramo con gotas si `fluye`, del color dado. */
  tubo(x1, y1, x2, y2, fluye, color){
    const ctx = this.ctx, C = CONFIG.color;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#243447'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = fluye ? color : C.aguaSeca; ctx.lineWidth = 3;
    ctx.globalAlpha = fluye ? 0.95 : 0.45;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = 1;
    if(!fluye) return;
    const largo = Math.hypot(x2 - x1, y2 - y1);
    if(largo < 6) return;
    const dx = (x2 - x1) / largo, dy = (y2 - y1) / largo;
    const sep = 22, desfase = (this.tiempo * 60) % sep;
    ctx.fillStyle = color;
    for(let t = desfase; t < largo; t += sep){
      ctx.beginPath(); ctx.arc(x1 + dx * t, y1 + dy * t, 2.6, 0, 7); ctx.fill();
    }
  }

  /* ---------- el pueblo (casitas cartoon) ---------- */
  pueblo(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, p = this._p, r = this._res;
    const seco = r.servicio < 0.5;
    const n = limitar(Math.round(p.habitantes / 120), 3, 8);
    const zonaX = W * 0.48, zonaW = W * 0.26;
    const casaW = Math.min(zonaW / n * 0.82, W * 0.045);

    for(let i = 0; i < n; i++){
      const x = zonaX + (i + 0.5) * (zonaW / n);
      const h = casaW * (1.15 + (i % 3) * 0.3);
      const y = this.sueloY - h;
      const cuerpo = seco ? '#2b3a44' : mezclarColor('#e9d7a6', '#b98f4a', (i % 3) / 3);
      this.caja(x - casaW / 2, y, casaW, h, cuerpo, 2);
      // tejado
      const tej = seco ? C.casaSeca : mezclarColor('#c0392b', '#8e2f24', (i % 2) / 2);
      ctx.beginPath(); ctx.moveTo(x - casaW / 2 - 3, y);
      ctx.lineTo(x + casaW / 2 + 3, y); ctx.lineTo(x, y - casaW * 0.55);
      ctx.closePath(); ctx.fillStyle = tej; ctx.fill(); this.contorno();
      // nieve en el tejado en invierno
      if(this.est.i === 3){
        ctx.fillStyle = 'rgba(235,244,250,0.85)';
        ctx.beginPath(); ctx.moveTo(x - casaW / 2 - 3, y);
        ctx.lineTo(x + casaW / 2 + 3, y); ctx.lineTo(x, y - casaW * 0.55);
        ctx.closePath(); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
      }
      // ventana encendida si hay servicio (más viva de noche)
      if(!seco){
        const brillo = 0.5 + (1 - this.luz) * 0.4;
        ctx.fillStyle = `rgba(245,196,81,${brillo})`;
        ctx.fillRect(x - casaW * 0.15, y + h * 0.34, casaW * 0.3, casaW * 0.3);
        this.contornoRect(x - casaW * 0.15, y + h * 0.34, casaW * 0.3, casaW * 0.3);
      }
      // humo de la chimenea (invierno o simple ambiente)
      if(!seco && (this.est.i === 3 || i % 2 === 0)){
        ctx.fillStyle = 'rgba(200,210,220,0.25)';
        for(let k = 0; k < 3; k++){
          const hy = y - casaW * 0.5 - k * 8 - (this.tiempo * 12 % 8);
          ctx.beginPath(); ctx.arc(x + casaW * 0.25 + Math.sin(this.tiempo + k) * 3, hy, 3 + k, 0, 7); ctx.fill();
        }
      }
    }

    if(seco){
      const bx = zonaX + zonaW * 0.5, by = this.sueloY - casaW * 3;
      ctx.globalAlpha = 0.6 + Math.sin(this.tiempo * 4) * 0.4;
      ctx.fillStyle = C.critico; ctx.font = 'bold 22px IBM Plex Sans, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('!', bx, by); ctx.globalAlpha = 1;
    }

    ctx.font = '700 11px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.texto;
    ctx.fillText(p.nombre, zonaX + zonaW * 0.5, this.sueloY + 15);
  }

  /* ---------- árboles con follaje de estación y balanceo ---------- */
  arboles(fondo){
    const ctx = this.ctx, W = this._W;
    const xs = fondo ? [0.28, 0.44, 0.68, 0.88] : [0.10, 0.72];
    for(let k = 0; k < xs.length; k++){
      const x = W * xs[k];
      const baseY = this.sueloY + (fondo ? -2 : 8);
      const esc = fondo ? 0.75 : 1.05;
      const sway = Math.sin(this.tiempo * 1.2 + k) * 3 * esc;
      const troncoH = 26 * esc, troncoW = 6 * esc;
      // tronco
      ctx.fillStyle = '#5a3f2a';
      ctx.beginPath(); ctx.roundRect(x - troncoW / 2, baseY - troncoH, troncoW, troncoH, 2); ctx.fill();
      // copa (3 bolas), balanceándose
      const r = 15 * esc;
      const cy = baseY - troncoH - r * 0.5;
      const inv = this.est.i === 3;
      ctx.fillStyle = this.est.follaje;
      for(const [ox, oy, rr] of [[-r * 0.7, 4, r * 0.85], [r * 0.7, 4, r * 0.85], [0, -r * 0.5, r]]){
        ctx.beginPath(); ctx.arc(x + ox + sway, cy + oy, rr, 0, 7); ctx.fill();
      }
      this.contorno();
      if(inv){  // nieve sobre la copa
        ctx.fillStyle = 'rgba(235,244,250,0.7)';
        ctx.beginPath(); ctx.arc(x + sway, cy - r * 0.5, r, Math.PI, 0); ctx.fill();
      }
    }
  }

  /* ---------- vertido visible al cauce ---------- */
  vertido(){
    const ctx = this.ctx, W = this._W, p = this._p;
    if(!p.saneamientoActivo) return;
    const x = W * 0.92, y = this.rioY;
    const sucio = 1 - fraccionTratada(p);
    const col = mezclarColor('#7dd3fc', '#8a6a2a', sucio);
    ctx.fillStyle = col; ctx.globalAlpha = 0.8;
    // chorrito cayendo + mancha en el agua
    for(let k = 0; k < 3; k++){
      const dy = (this.tiempo * 40 + k * 6) % 14;
      ctx.beginPath(); ctx.arc(x, y + dy, 2.2, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 0.35 * sucio + 0.1;
    ctx.beginPath(); ctx.ellipse(x, y + 8, 22, 5, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ---------- clima: partículas por estación ---------- */
  clima(dt){
    const ctx = this.ctx, W = this._W, H = this._H, K = CONFIG.clima;
    const tipo = this.est.clima;
    // objetivo de partículas según el clima actual
    let objetivo = 0, vy = 0;
    if(tipo === 'lluvia'){ objetivo = K.densidadLluvia; vy = K.velocidadLluvia; }
    else if(tipo === 'nieve'){ objetivo = K.densidadNieve; vy = K.velocidadNieve; }
    else if(tipo === 'flores'){ objetivo = K.densidadFlores; vy = K.velocidadNieve * 0.9; }

    // generar hasta el objetivo
    while(this.particulas.length < objetivo){
      this.particulas.push({
        x: Math.random() * W, y: Math.random() * H * 0.6 - H * 0.1,
        vy: vy * (0.7 + Math.random() * 0.5),
        vx: tipo === 'lluvia' ? -60 : (Math.random() - 0.5) * 30,
        tipo, fase: Math.random() * 7, tam: 0.8 + Math.random() * 0.7
      });
    }
    // mover, dibujar y decidir cuáles siguen vivos
    const vivos = [];
    for(const q of this.particulas){
      q.y += q.vy * dt;
      q.x += (q.vx + (q.tipo !== 'lluvia' ? Math.sin(this.tiempo * 2 + q.fase) * 20 : 0)) * dt;
      if(q.y < H + 10 && q.x > -30 && q.x < W + 30) this.dibujarParticula(q);

      if(q.tipo === tipo){
        // del clima actual: si sale por abajo, se recicla arriba
        if(q.y >= H){ q.y = -8; q.x = Math.random() * W; }
        vivos.push(q);
      } else if(q.y < H){
        // de un clima anterior: se deja caer hasta salir, sin reciclar
        vivos.push(q);
      }
    }
    this.particulas = vivos;
  }

  dibujarParticula(q){
    const ctx = this.ctx;
    if(q.tipo === 'lluvia'){
      ctx.strokeStyle = 'rgba(150,200,235,0.55)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - 3, q.y + 9); ctx.stroke();
    } else if(q.tipo === 'nieve'){
      ctx.fillStyle = 'rgba(235,244,250,0.85)';
      ctx.beginPath(); ctx.arc(q.x, q.y, 2 * q.tam, 0, 7); ctx.fill();
    } else {  // flores/pétalos
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.fase + this.tiempo);
      ctx.fillStyle = 'rgba(248,187,208,0.85)';
      ctx.beginPath(); ctx.ellipse(0, 0, 3.2 * q.tam, 1.7 * q.tam, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- avería sobre la bomba ---------- */
  averiaIndicador(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H;
    const x = W * 0.17, y = this.sueloY - H * 0.22;
    const pulso = 0.55 + Math.sin(this.tiempo * 6) * 0.45;
    ctx.globalAlpha = pulso;
    ctx.fillStyle = C.critico; ctx.beginPath(); ctx.arc(x, y, Math.min(W, H) * 0.028, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(Math.min(W, H) * 0.03)}px IBM Plex Sans, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, y + 1);
    ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
  }

  /* ---------- ondas de clic ---------- */
  destellosClic(){
    const ctx = this.ctx;
    for(const d of this.destellos){
      const t = d.t / 0.6;
      ctx.globalAlpha = (1 - t) * 0.6; ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(d.x, d.y, 6 + t * 26, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- helpers de dibujo cartoon ---------- */
  caja(x, y, w, h, fill, r = 4){
    const ctx = this.ctx;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill; ctx.fill();
    // brillo superior
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x + 2, y + 2, w - 4, Math.max(2, h * 0.18));
    this.contorno();
  }
  contorno(){ const ctx = this.ctx; ctx.strokeStyle = 'rgba(6,15,24,0.55)'; ctx.lineWidth = 2; ctx.stroke(); }
  contornoRect(x, y, w, h){ const ctx = this.ctx; ctx.strokeStyle = 'rgba(6,15,24,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); }
}

/** Mezcla dos colores hex (#rrggbb) según t (0..1). Devuelve 'rgb(...)'. */
function mezclarColor(hexA, hexB, t){
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
  const br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}
