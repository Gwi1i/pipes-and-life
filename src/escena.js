/**
 * ESCENA — el diorama, versión "falso 3D".
 *
 * PURAMENTE visual: LEE el estado, nunca lo modifica. Guarda solo su reloj de
 * animación y efectos pasajeros (clima, destellos, aparición de estructuras).
 *
 * Muestra el CICLO DEL AGUA del pueblo activo, de aguas arriba a aguas abajo:
 * río → captación → bombeo → depósito → pueblo → saneamiento → depuradora →
 * de vuelta al cauce. El río es común y se enturbia con la contaminación.
 *
 * El "falso 3D" sale de cuatro trucos, todos a mano con Canvas 2D (sin deps):
 *   1. LUZ DIRECCIONAL: una cara iluminada y otra en sombra en cada objeto.
 *   2. VOLUMEN: el depósito y los clarificadores son cilindros; las casas y la
 *      caseta se ven en 3/4 (cara frontal + cara lateral + tejado a dos aguas).
 *   3. SOMBRAS ARROJADAS: elipses en el suelo que "posan" cada objeto.
 *   4. PERSPECTIVA ATMOSFÉRICA: lo lejano se difumina hacia el color de bruma.
 */

import { CONFIG } from './config.js';
import { capacidad, fraccionTratada, capacidadTanque } from './simulacion.js';
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
    this.particulas = [];
    this.nubes = null;
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
    this.nubes = null;
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

  /**
   * Bookkeeping común a cualquier estilo de escena: avanza relojes y efectos y
   * cachea el contexto del fotograma (tamaño, pueblo activo, luz, estación...).
   * Se extrajo aquí para que otras escenas con composición distinta (la vista
   * cenital de teselas) la reutilicen sin duplicar.
   */
  prepararFotograma(estado, resultado, dt){
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

    const p = estado.activo;
    this._W = W; this._H = H; this._p = p; this._res = resultado;
    this.hora = ((estado.horas % 24) + 24) % 24;
    this.luz = Math.max(0, Math.sin(((this.hora - 6) / 12) * Math.PI));
    this.est = this.estacion(estado.horas);
    this.suciedad = resultado.suciedad ?? (estado.contaminacion / CONFIG.cauce.contaminacionMax);
    // Color de bruma para la perspectiva atmosférica: claro de día, oscuro de noche
    this.bruma = mezclarColor('#28384a', '#c6d8e4', this.luz);
    return p;
  }

  dibujar(estado, resultado, dt){
    const p = this.prepararFotograma(estado, resultado, dt);
    const H = this._H;

    this.horizonteY = H * 0.50;
    this.sueloY = H * 0.66;
    this.rioY   = H * 0.84;

    if(!this.nubes) this.generarNubes();

    this.cielo();
    this.astro();
    this.nubesDibujar(dt);
    this.colinas();
    this.brumaHorizonte();
    this.arboles(true);
    this.suelo();
    this.rio(dt);
    this.tuberiaSaneamiento();
    if(p.mejoras.captacion > 0) this.captacion();
    this.bomba();
    if(p.mejoras.deposito > 0) this.deposito();
    if(p.mejoras.depuradora > 0) this.depuradora();
    this.tuberiaAbastecimiento();
    if(p.mejoras.tanque > 0) this.tanqueTormentas();
    this.pueblo();
    this.arboles(false);
    this.vertido();
    this.clima(dt);
    if(resultado.averiada) this.averiaIndicador();
    this.destellosClic();
  }

  /* ---------- estación (interpolada) ---------- */
  estacion(horas){
    const E = CONFIG.estaciones;
    const frac = ((horas % CONFIG.tiempo.horasPorAño) / CONFIG.tiempo.horasPorAño + 1) % 1;
    const pos = frac * E.length;
    const i = Math.floor(pos) % E.length;
    const t = pos - Math.floor(pos);
    const sig = E[(i + 1) % E.length];
    const tb = t < 0.7 ? 0 : (t - 0.7) / 0.3;
    return {
      i, t, nombre: E[i].nombre,
      follaje: mezclarColor(E[i].follaje, sig.follaje, tb),
      hierba:  mezclarColor(E[i].hierba,  sig.hierba,  tb),
      tinte: E[i].tinte, clima: E[i].clima
    };
  }

  /* ---------- cielo ---------- */
  cielo(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H;
    const hasta = this.horizonteY + H * 0.1;
    const noche = ctx.createLinearGradient(0, 0, 0, hasta);
    noche.addColorStop(0, C.cieloNoche[0]); noche.addColorStop(0.6, C.cieloNoche[1]); noche.addColorStop(1, C.cieloNoche[2]);
    ctx.fillStyle = noche; ctx.fillRect(0, 0, W, hasta);
    const dia = ctx.createLinearGradient(0, 0, 0, hasta);
    dia.addColorStop(0, C.cielo[0]); dia.addColorStop(0.6, C.cielo[1]); dia.addColorStop(1, C.cielo[2]);
    ctx.globalAlpha = this.luz; ctx.fillStyle = dia; ctx.fillRect(0, 0, W, hasta); ctx.globalAlpha = 1;
    ctx.fillStyle = this.est.tinte; ctx.fillRect(0, 0, W, hasta);
  }

  /* ---------- sol / luna ---------- */
  astro(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, h = this.hora;
    const esDia = h >= 5 && h < 19;
    const fx = esDia ? (h - 5) / 14 : (((h < 5 ? h + 24 : h) - 19) / 10);
    this.astroX = W * (0.12 + 0.76 * fx);
    this.astroY = H * (0.30 - Math.sin(limitar(fx, 0, 1) * Math.PI) * 0.20);
    const ax = this.astroX, ay = this.astroY, r = Math.min(W, H) * 0.05;
    const tono = esDia ? '245,196,81' : '203,213,225';
    if(esDia){
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(this.tiempo * 0.12);
      ctx.strokeStyle = `rgba(${tono},${0.22 * this.luz + 0.05})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for(let k = 0; k < 12; k++){ ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(r * 2.1, 0); ctx.stroke(); }
      ctx.restore();
    }
    const halo = ctx.createRadialGradient(ax, ay, 0, ax, ay, r * 3);
    halo.addColorStop(0, `rgba(${tono},0.45)`); halo.addColorStop(1, `rgba(${tono},0)`);
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(ax, ay, r * 3, 0, 7); ctx.fill();
    // esfera con sombreado (más brillo arriba-derecha)
    const g = ctx.createRadialGradient(ax + r * 0.3, ay - r * 0.3, r * 0.2, ax, ay, r);
    g.addColorStop(0, esDia ? '#fff2c2' : '#eef2f7'); g.addColorStop(1, esDia ? C.sol : C.luna);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ax, ay, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(6,15,24,0.2)'; ctx.lineWidth = 2; ctx.stroke();
  }

  /* ---------- nubes ---------- */
  generarNubes(){
    this.nubes = [];
    for(let k = 0; k < 4; k++) this.nubes.push({
      x: Math.random() * this.ancho, y: this.alto * (0.08 + Math.random() * 0.22),
      e: 0.7 + Math.random() * 0.8, v: 6 + Math.random() * 10
    });
  }
  nubesDibujar(dt){
    const ctx = this.ctx, W = this._W;
    const alpha = 0.30 + this.luz * 0.4;
    for(const c of this.nubes){
      c.x += c.v * dt; if(c.x - 80 * c.e > W) c.x = -80 * c.e;
      const x = c.x, y = c.y, e = c.e;
      // volumen: base en sombra, cúpula clara
      ctx.fillStyle = `rgba(190,205,218,${alpha})`;
      this.grupoNube(x, y + 5 * e, e);
      ctx.fillStyle = `rgba(240,247,252,${alpha})`;
      this.grupoNube(x, y, e * 0.92);
    }
  }
  grupoNube(x, y, e){
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 16 * e, 0, 7); ctx.arc(x + 18 * e, y + 4 * e, 13 * e, 0, 7);
    ctx.arc(x - 18 * e, y + 4 * e, 12 * e, 0, 7); ctx.arc(x, y + 8 * e, 20 * e, 0, 7);
    ctx.fill();
  }

  /* ---------- colinas con bruma (perspectiva atmosférica) ---------- */
  colinas(){
    const ctx = this.ctx, W = this._W, H = this._H;
    const capas = [
      { y: this.horizonteY + 8,  amp: 22, base: this.est.hierba, haze: 0.55, vel: 0.6 },
      { y: this.horizonteY + 32, amp: 32, base: this.est.hierba, haze: 0.30, vel: 1.0 }
    ];
    for(const c of capas){
      const col = mezclarColor(mezclarColor(c.base, '#0b1a12', 0.4), this.bruma, c.haze);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, H);
      for(let x = 0; x <= W; x += 12){
        const y = c.y + Math.sin(x * 0.008 + c.vel * 2) * c.amp + Math.sin(x * 0.02) * c.amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      if(this.est.i === 3 || (this.est.i === 2 && this.est.t > 0.6)){
        ctx.fillStyle = `rgba(235,244,250,${0.4 - c.haze * 0.2})`;
        ctx.beginPath();
        for(let x = 0; x <= W; x += 12){
          const y = c.y + Math.sin(x * 0.008 + c.vel * 2) * c.amp + Math.sin(x * 0.02) * c.amp * 0.4;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y + 4);
        }
        for(let x = W; x >= 0; x -= 12){
          const y = c.y + Math.sin(x * 0.008 + c.vel * 2) * c.amp + Math.sin(x * 0.02) * c.amp * 0.4;
          ctx.lineTo(x, y + 9);
        }
        ctx.closePath(); ctx.fill();
      }
    }
  }

  /* ---------- banda de bruma sobre el horizonte ---------- */
  brumaHorizonte(){
    const ctx = this.ctx, W = this._W;
    const g = ctx.createLinearGradient(0, this.horizonteY - 30, 0, this.sueloY);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, this.bruma.replace('rgb', 'rgba').replace(')', `,${0.28 * this.luz + 0.08})`));
    ctx.fillStyle = g; ctx.fillRect(0, this.horizonteY - 30, W, this.sueloY - this.horizonteY + 30);
  }

  /* ---------- suelo con sombreado de contacto ---------- */
  suelo(){
    const ctx = this.ctx, W = this._W, H = this._H;
    const g = ctx.createLinearGradient(0, this.sueloY, 0, H);
    g.addColorStop(0, aclarar(this.est.hierba, 0.08));
    g.addColorStop(0.5, this.est.hierba);
    g.addColorStop(1, oscurecer(this.est.hierba, 0.5));
    ctx.fillStyle = g; ctx.fillRect(0, this.sueloY, W, H - this.sueloY);
    // franja de luz en el borde superior del suelo
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, this.sueloY, W, 2);
  }

  /* ---------- río con profundidad y reflejo ---------- */
  rio(dt){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H;
    const suc = this.cauceFlash ? Math.max(0, this.suciedad - this.cauceFlash * 0.3) : this.suciedad;
    // orilla lejana (más clara/hazed) y agua cercana (más oscura) → profundidad
    ctx.fillStyle = mezclarColor(mezclarColor(C.agua, C.aguaSucia, suc), this.bruma, 0.35);
    ctx.fillRect(0, this.rioY, W, 6);
    const g = ctx.createLinearGradient(0, this.rioY + 6, 0, H);
    g.addColorStop(0, mezclarColor(C.agua, C.aguaSucia, suc));
    g.addColorStop(1, oscurecer(mezclarColor(C.aguaProfunda, C.aguaSucia, suc), 0.25));
    ctx.fillStyle = g; ctx.fillRect(0, this.rioY + 6, W, H - this.rioY - 6);
    // reflejo del astro en el agua
    if(this.astroX !== undefined){
      const rg = ctx.createLinearGradient(0, this.rioY, 0, H);
      const tono = (this.hora >= 5 && this.hora < 19) ? '245,196,81' : '203,213,225';
      rg.addColorStop(0, `rgba(${tono},${0.22 * this.luz + 0.06})`); rg.addColorStop(1, `rgba(${tono},0)`);
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.moveTo(this.astroX - 14, this.rioY);
      ctx.lineTo(this.astroX + 14, this.rioY); ctx.lineTo(this.astroX + 26, H); ctx.lineTo(this.astroX - 26, H);
      ctx.closePath(); ctx.fill();
    }
    // reflejos que fluyen
    ctx.strokeStyle = `rgba(255,255,255,${0.10 + 0.06 * this.luz})`; ctx.lineWidth = 2;
    for(let k = 0; k < 4; k++){
      const y = this.rioY + 10 + k * (H - this.rioY) / 5;
      ctx.beginPath();
      for(let x = 0; x <= W; x += 8){ const oy = Math.sin(x * 0.05 - this.tiempo * 2 + k) * 2; x === 0 ? ctx.moveTo(x, y + oy) : ctx.lineTo(x, y + oy); }
      ctx.stroke();
    }
  }

  /* ---------- captación ---------- */
  captacion(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H;
    const a = this.aparicionCaptacion === 0 ? 1 : this.aparicionCaptacion;
    const x = W * 0.07, y = this.rioY + (H - this.rioY) * 0.35;
    const s = Math.min(W, H) * 0.03 * (0.6 + 0.4 * a);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = C.captacion; ctx.globalAlpha = a * 0.3;
    ctx.beginPath(); ctx.arc(x, y, s * 1.9, 0, 7); ctx.fill();
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.2, x, y, s);
    g.addColorStop(0, aclarar(C.captacion, 0.3)); g.addColorStop(1, oscurecer(C.captacion, 0.2));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
    ctx.strokeStyle = '#062a2c'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
  }

  /* ---------- caseta de bombeo (3/4) ---------- */
  bomba(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p;
    const w = W * 0.075, h = H * 0.13, x = W * 0.17 - w / 2, baseY = this.sueloY;
    const auto = p.autobombaActivo;
    const sx = 1 + this.pulso * 0.08, sy = 1 - this.pulso * 0.08;

    // tubo de aspiración al río
    ctx.strokeStyle = C.captacion; ctx.globalAlpha = 0.7; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + w * 0.2, baseY); ctx.lineTo(W * 0.07, this.rioY + (H - this.rioY) * 0.35); ctx.stroke();
    ctx.globalAlpha = 1;

    this.sombraSuelo(x + w / 2, baseY + 3, w * 1.1);
    ctx.save(); ctx.translate(x + w / 2, baseY); ctx.scale(sx, sy); ctx.translate(-(x + w / 2), -baseY);
    this.casa3d(x, baseY, w, h, '#3a536e', '#4a6a8c');
    // ojo de buey con gota que late
    ctx.beginPath(); ctx.arc(x + w * 0.5, baseY - h * 0.5, w * 0.2, 0, 7);
    const gg = ctx.createRadialGradient(x + w * 0.45, baseY - h * 0.55, 1, x + w * 0.5, baseY - h * 0.5, w * 0.2);
    gg.addColorStop(0, `rgba(125,211,252,${0.7 + this.pulso * 0.3})`); gg.addColorStop(1, `rgba(14,90,134,${0.6 + this.pulso * 0.3})`);
    ctx.fillStyle = gg; ctx.fill(); this.contorno();
    ctx.restore();

    ctx.font = '700 10px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = auto ? C.captacion : C.tenue;
    ctx.fillText(auto ? 'BOMBEO · AUTO' : 'BOMBEO', x + w / 2, baseY + 16);
  }

  /* ---------- depósito elevado (cilindro) ---------- */
  deposito(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p;
    const cx = W * 0.36, w = W * 0.11, h = H * 0.24;
    const a = this.aparicionDeposito === 0 ? 1 : this.aparicionDeposito;
    const esc = 0.6 + 0.4 * a;
    const baseY = this.sueloY - h * 0.05, topeY = this.sueloY - h * 1.05;
    this.sombraSuelo(cx, this.sueloY + 2, w * 1.2);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, baseY); ctx.scale(esc, esc); ctx.translate(-cx, -baseY);

    // patas
    ctx.strokeStyle = oscurecer(C.estructura, 0.2); ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 6, baseY); ctx.lineTo(cx - w / 2 + 6, baseY + h * 0.16);
    ctx.moveTo(cx + w / 2 - 6, baseY); ctx.lineTo(cx + w / 2 - 6, baseY + h * 0.16);
    ctx.stroke();

    const rx = w / 2, ry = w * 0.16;
    const cuerpoTop = topeY + ry, cuerpoBot = baseY - ry;
    // cuerpo (gradiente de barril: luz a la derecha)
    const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, oscurecer('#20455c', 0.25)); g.addColorStop(0.5, '#2e5f7e'); g.addColorStop(0.62, aclarar('#2e5f7e', 0.18)); g.addColorStop(1, oscurecer('#20455c', 0.15));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cuerpoTop); ctx.lineTo(cx - rx, cuerpoBot);
    ctx.ellipse(cx, cuerpoBot, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + rx, cuerpoTop);
    ctx.ellipse(cx, cuerpoTop, rx, ry, 0, 0, Math.PI, true); ctx.closePath(); ctx.fill();

    // agua dentro (cilindro más corto con superficie elíptica)
    const frac = limitar(p.agua / capacidad(p), 0, 1);
    const aguaTop = cuerpoBot - (cuerpoBot - cuerpoTop) * frac;
    if(frac > 0.01){
      const wg = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
      wg.addColorStop(0, oscurecer(C.aguaProfunda, 0.1)); wg.addColorStop(0.55, C.agua); wg.addColorStop(1, oscurecer(C.aguaProfunda, 0.05));
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(cx - rx, aguaTop); ctx.lineTo(cx - rx, cuerpoBot);
      ctx.ellipse(cx, cuerpoBot, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + rx, aguaTop);
      ctx.ellipse(cx, aguaTop, rx, ry, 0, 0, Math.PI, true); ctx.closePath(); ctx.fill();
      // superficie con brillo y oleaje
      ctx.fillStyle = aclarar(C.agua, 0.25 + Math.sin(this.tiempo * 3) * 0.05);
      ctx.beginPath(); ctx.ellipse(cx, aguaTop, rx, ry, 0, 0, 7); ctx.fill();
    }
    // aro superior del tanque
    ctx.strokeStyle = C.deposito; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(cx, cuerpoTop, rx, ry, 0, 0, 7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - rx, cuerpoTop); ctx.lineTo(cx - rx, cuerpoBot);
    ctx.moveTo(cx + rx, cuerpoTop); ctx.lineTo(cx + rx, cuerpoBot); ctx.stroke();
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.font = '700 11px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.deposito; ctx.fillText(Math.round(frac * 100) + '%', cx, topeY - 6);
  }

  /* ---------- depuradora (clarificadores cilíndricos) ---------- */
  depuradora(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p;
    const a = this.aparicionDepuradora === 0 ? 1 : this.aparicionDepuradora;
    const x = W * 0.80, base = this.sueloY, w = W * 0.14;
    this.sombraSuelo(x, base + 2, w * 0.9);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, base); ctx.scale(0.6 + 0.4 * a, 0.6 + 0.4 * a); ctx.translate(-x, -base);
    const rx = Math.min(W, H) * 0.032, ry = rx * 0.4, hh = rx * 0.9;
    for(let k = 0; k < 2; k++){
      const cx = x - w / 2 + w * (0.28 + k * 0.44);
      const topY = base - hh - ry * 2;
      // pared del tanque (banda) con gradiente
      const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
      g.addColorStop(0, oscurecer('#1a3a34', 0.1)); g.addColorStop(0.6, mezclarColor('#1a3a34', C.depuradora, 0.3)); g.addColorStop(1, oscurecer('#1a3a34', 0.05));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - rx, topY + ry); ctx.lineTo(cx - rx, base - ry);
      ctx.ellipse(cx, base - ry, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + rx, topY + ry);
      ctx.ellipse(cx, topY + ry, rx, ry, 0, 0, Math.PI, true); ctx.closePath(); ctx.fill();
      // agua tratada en la boca, con burbujas
      ctx.fillStyle = mezclarColor('#1a3a34', C.depuradora, 0.5);
      ctx.beginPath(); ctx.ellipse(cx, topY + ry, rx, ry, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(cx, topY + ry, rx, ry, 0, 0, 7); ctx.clip();
      ctx.fillStyle = 'rgba(190,240,220,0.5)';
      for(let b = 0; b < 4; b++){ const bx = cx - rx + ((this.tiempo * 18 + b * 31) % (rx * 2)); ctx.beginPath(); ctx.arc(bx, topY + ry + Math.sin(this.tiempo * 3 + b) * ry * 0.4, 1.4, 0, 7); ctx.fill(); }
      ctx.restore();
      // brazo giratorio sobre la boca (elíptico → sensación de girar en 3D)
      ctx.save(); ctx.translate(cx, topY + ry);
      const ang = this.tiempo * (0.9 + k * 0.2);
      ctx.strokeStyle = C.estructura; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-Math.cos(ang) * rx * 0.85, -Math.sin(ang) * ry * 0.85);
      ctx.lineTo(Math.cos(ang) * rx * 0.85, Math.sin(ang) * ry * 0.85); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = C.depuradora; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, topY + ry, rx, ry, 0, 0, 7); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.font = '700 9px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.depuradora; ctx.fillText(`DEPURADORA Nv${p.mejoras.depuradora}`, x, base + 15);
  }

  /* ---------- tubería de abastecimiento ---------- */
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

  /* ---------- tanque de tormentas ----------
     Cilindro enterrado a medias junto al pueblo, con el nivel de lo retenido.
     Late en rojo cuando está aliviando: se ve que se ha quedado corto. */
  tanqueTormentas(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p, r = this._res;
    const cx = W * 0.685, baseY = this.sueloY + (this.rioY - this.sueloY) * 0.30;
    const rx = W * 0.028, ry = rx * 0.42, alto = H * 0.055;
    const topY = baseY - alto;
    const frac = capacidadTanque(p) > 0 ? limitar(p.tanqueAgua / capacidadTanque(p), 0, 1) : 0;

    // cuerpo
    const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    g.addColorStop(0, oscurecer(C.tanque, 0.45)); g.addColorStop(0.55, oscurecer(C.tanque, 0.15));
    g.addColorStop(1, oscurecer(C.tanque, 0.4));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - rx, topY); ctx.lineTo(cx - rx, baseY);
    ctx.ellipse(cx, baseY, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + rx, topY);
    ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI, true); ctx.closePath(); ctx.fill();
    // lo retenido
    if(frac > 0.01){
      const aguaTop = baseY - (baseY - topY) * frac;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - rx, topY); ctx.lineTo(cx - rx, baseY);
      ctx.ellipse(cx, baseY, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + rx, topY);
      ctx.closePath(); ctx.clip();
      ctx.fillStyle = mezclarColor('#6b7a3a', C.agua, 0.35);
      ctx.fillRect(cx - rx, aguaTop, rx * 2, baseY - aguaTop);
      ctx.restore();
      ctx.fillStyle = aclarar(mezclarColor('#6b7a3a', C.agua, 0.35), 0.2);
      ctx.beginPath(); ctx.ellipse(cx, aguaTop, rx, ry, 0, 0, 7); ctx.fill();
    }
    // boca
    ctx.strokeStyle = r.aliviando
      ? `rgba(239,68,68,${0.5 + Math.sin(this.tiempo * 7) * 0.45})` : C.tanque;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, topY, rx, ry, 0, 0, 7); ctx.stroke();

    ctx.font = '700 8px IBM Plex Mono, ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.fillStyle = r.aliviando ? C.critico : C.tanque;
    ctx.fillText(r.aliviando ? 'ALIVIANDO' : 'TORMENTAS', cx, baseY + 11);
  }

  /* ---------- tubería de saneamiento (retorno al cauce) ---------- */
  tuberiaSaneamiento(){
    const W = this._W, p = this._p, r = this._res;
    if(!p.saneamientoActivo) return;
    const yS = this.sueloY + (this.rioY - this.sueloY) * 0.55;
    const xPueblo = W * 0.60, xDepu = W * 0.80, xVert = W * 0.92;

    // Red de pluviales: canal aparte que lleva la lluvia limpia al cauce sin
    // pasar por la depuradora. Solo "fluye" cuando de verdad está lloviendo.
    if(p.mejoras.pluviales > 0){
      const yP = yS + (this.rioY - yS) * 0.45, xP = W * 0.30;
      const llueve = (r.lluvia || 0) > 0.05;
      this.tubo(W * 0.52, yP, xP, yP, llueve, CONFIG.color.pluviales);
      this.tubo(xP, yP, xP, this.rioY + 4, llueve, CONFIG.color.pluviales);
    }
    const suciedad = 1 - fraccionTratada(p);
    const colSucio = mezclarColor('#38bdf8', '#7a5a2a', 0.85);
    if(p.mejoras.depuradora > 0){
      this.tubo(xPueblo, yS, xDepu, yS, true, colSucio);
      const colSalida = mezclarColor('#38bdf8', '#7a5a2a', suciedad);
      this.tubo(xDepu, yS, xVert, yS, true, colSalida);
      this.tubo(xVert, yS, xVert, this.rioY + 4, true, colSalida);
    } else {
      this.tubo(xPueblo, yS, xVert, yS, true, colSucio);
      this.tubo(xVert, yS, xVert, this.rioY + 4, true, colSucio);
    }
  }

  /** Tramo tubular con brillo y gotas si `fluye`. */
  tubo(x1, y1, x2, y2, fluye, color){
    const ctx = this.ctx, C = CONFIG.color;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1b2836'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = fluye ? color : C.aguaSeca; ctx.lineWidth = 4;
    ctx.globalAlpha = fluye ? 0.95 : 0.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // brillo tubular
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.2; ctx.globalAlpha = fluye ? 0.5 : 0.25;
    const nx = (y2 - y1), ny = -(x2 - x1); const L = Math.hypot(nx, ny) || 1;
    ctx.beginPath(); ctx.moveTo(x1 + nx / L * 1.5, y1 + ny / L * 1.5); ctx.lineTo(x2 + nx / L * 1.5, y2 + ny / L * 1.5); ctx.stroke();
    ctx.globalAlpha = 1;
    if(!fluye) return;
    const largo = Math.hypot(x2 - x1, y2 - y1); if(largo < 6) return;
    const dx = (x2 - x1) / largo, dy = (y2 - y1) / largo, sep = 22, desfase = (this.tiempo * 60) % sep;
    ctx.fillStyle = aclarar(color, 0.2);
    for(let t = desfase; t < largo; t += sep){ ctx.beginPath(); ctx.arc(x1 + dx * t, y1 + dy * t, 2.6, 0, 7); ctx.fill(); }
  }

  /* ---------- el pueblo (casas en 3/4) ---------- */
  pueblo(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, p = this._p, r = this._res;
    const seco = r.servicio < 0.5;
    const n = limitar(Math.round(p.habitantes / 120), 3, 8);
    const zonaX = W * 0.48, zonaW = W * 0.26;
    const casaW = Math.min(zonaW / n * 0.7, W * 0.04);

    for(let i = 0; i < n; i++){
      const x = zonaX + (i + 0.5) * (zonaW / n) - casaW / 2;
      const h = casaW * (1.15 + (i % 3) * 0.3);
      const baseY = this.sueloY;
      const frente = seco ? '#33434e' : mezclarColor('#efdcaa', '#c79a54', (i % 3) / 3);
      const tejado = seco ? C.casaSeca : mezclarColor('#d0453a', '#8e2f24', (i % 2) / 2);
      this.sombraSuelo(x + casaW / 2, baseY + 2, casaW * 1.1);
      this.casa3d(x, baseY, casaW, h, frente, tejado, this.est.i === 3);
      // ventana encendida
      if(!seco){
        const brillo = 0.5 + (1 - this.luz) * 0.45;
        ctx.fillStyle = `rgba(245,196,81,${brillo})`;
        ctx.fillRect(x + casaW * 0.28, baseY - h * 0.55, casaW * 0.3, casaW * 0.3);
        this.contornoRect(x + casaW * 0.28, baseY - h * 0.55, casaW * 0.3, casaW * 0.3);
      }
      // humo
      if(!seco && (this.est.i === 3 || i % 2 === 0)){
        ctx.fillStyle = 'rgba(210,220,230,0.22)';
        for(let k = 0; k < 3; k++){ const hy = baseY - h - casaW * 0.4 - k * 8 - (this.tiempo * 12 % 8); ctx.beginPath(); ctx.arc(x + casaW * 0.6 + Math.sin(this.tiempo + k) * 3, hy, 3 + k, 0, 7); ctx.fill(); }
      }
    }

    if(seco){
      const bx = zonaX + zonaW * 0.5, by = this.sueloY - casaW * 3.2;
      ctx.globalAlpha = 0.6 + Math.sin(this.tiempo * 4) * 0.4;
      ctx.fillStyle = C.critico; ctx.font = 'bold 22px IBM Plex Sans, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('!', bx, by); ctx.globalAlpha = 1;
    }
    ctx.font = '700 11px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.texto; ctx.fillText(p.nombre, zonaX + zonaW * 0.5, this.sueloY + 15);
  }

  /* ---------- árboles con volumen y sombra ---------- */
  arboles(fondo){
    const ctx = this.ctx, W = this._W;
    const xs = fondo ? [0.28, 0.44, 0.68, 0.90] : [0.10, 0.72];
    for(let k = 0; k < xs.length; k++){
      const x = W * xs[k], baseY = this.sueloY + (fondo ? -2 : 8), esc = fondo ? 0.72 : 1.05;
      const sway = Math.sin(this.tiempo * 1.2 + k) * 3 * esc;
      const troncoH = 26 * esc, troncoW = 6 * esc, r = 15 * esc, cy = baseY - troncoH - r * 0.5;
      let follaje = this.est.follaje;
      if(fondo) follaje = mezclarColor(follaje, this.bruma, 0.4);   // perspectiva atmosférica
      this.sombraSuelo(x, baseY + 2, r * 1.1);
      // tronco con cara en sombra
      ctx.fillStyle = '#6b4a30'; ctx.beginPath(); ctx.roundRect(x - troncoW / 2, baseY - troncoH, troncoW, troncoH, 2); ctx.fill();
      ctx.fillStyle = '#4a3220'; ctx.fillRect(x + troncoW * 0.1, baseY - troncoH, troncoW * 0.4, troncoH);
      // copa: bolas con gradiente radial (luz arriba-derecha)
      for(const [ox, oy, rr] of [[-r * 0.7, 4, r * 0.85], [r * 0.7, 4, r * 0.85], [0, -r * 0.5, r]]){
        const gx = x + ox + sway, gy = cy + oy;
        const g = ctx.createRadialGradient(gx + rr * 0.3, gy - rr * 0.3, rr * 0.2, gx, gy, rr);
        g.addColorStop(0, aclarar(follaje, 0.22)); g.addColorStop(1, oscurecer(follaje, 0.28));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, rr, 0, 7); ctx.fill();
      }
      if(this.est.i === 3){ ctx.fillStyle = 'rgba(235,244,250,0.7)'; ctx.beginPath(); ctx.arc(x + sway, cy - r * 0.5, r, Math.PI, 0); ctx.fill(); }
    }
  }

  /* ---------- vertido al cauce ---------- */
  vertido(){
    const ctx = this.ctx, W = this._W, p = this._p;
    if(!p.saneamientoActivo) return;
    const x = W * 0.92, y = this.rioY;
    const sucio = 1 - fraccionTratada(p);
    const col = mezclarColor('#7dd3fc', '#8a6a2a', sucio);
    ctx.fillStyle = col; ctx.globalAlpha = 0.85;
    for(let k = 0; k < 3; k++){ const dy = (this.tiempo * 40 + k * 6) % 14; ctx.beginPath(); ctx.arc(x, y + dy, 2.2, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 0.35 * sucio + 0.1; ctx.beginPath(); ctx.ellipse(x, y + 8, 22, 5, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ---------- clima ---------- */
  clima(dt){
    const ctx = this.ctx, W = this._W, H = this._H, K = CONFIG.clima;
    const tipo = this.est.clima;
    let objetivo = 0, vy = 0;
    if(tipo === 'lluvia'){ objetivo = K.densidadLluvia; vy = K.velocidadLluvia; }
    else if(tipo === 'nieve'){ objetivo = K.densidadNieve; vy = K.velocidadNieve; }
    else if(tipo === 'flores'){ objetivo = K.densidadFlores; vy = K.velocidadNieve * 0.9; }
    while(this.particulas.length < objetivo) this.particulas.push({
      x: Math.random() * W, y: Math.random() * H * 0.6 - H * 0.1, vy: vy * (0.7 + Math.random() * 0.5),
      vx: tipo === 'lluvia' ? -60 : (Math.random() - 0.5) * 30, tipo, fase: Math.random() * 7, tam: 0.8 + Math.random() * 0.7
    });
    const vivos = [];
    for(const q of this.particulas){
      q.y += q.vy * dt; q.x += (q.vx + (q.tipo !== 'lluvia' ? Math.sin(this.tiempo * 2 + q.fase) * 20 : 0)) * dt;
      if(q.y < H + 10 && q.x > -30 && q.x < W + 30) this.dibujarParticula(q);
      if(q.tipo === tipo){ if(q.y >= H){ q.y = -8; q.x = Math.random() * W; } vivos.push(q); }
      else if(q.y < H) vivos.push(q);
    }
    this.particulas = vivos;
  }
  dibujarParticula(q){
    const ctx = this.ctx;
    if(q.tipo === 'lluvia'){ ctx.strokeStyle = 'rgba(150,200,235,0.55)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - 3, q.y + 9); ctx.stroke(); }
    else if(q.tipo === 'nieve'){ ctx.fillStyle = 'rgba(235,244,250,0.85)'; ctx.beginPath(); ctx.arc(q.x, q.y, 2 * q.tam, 0, 7); ctx.fill(); }
    else { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.fase + this.tiempo); ctx.fillStyle = 'rgba(248,187,208,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, 3.2 * q.tam, 1.7 * q.tam, 0, 0, 7); ctx.fill(); ctx.restore(); }
  }

  /* ---------- avería ---------- */
  averiaIndicador(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H;
    const x = W * 0.17, y = this.sueloY - H * 0.22, pulso = 0.55 + Math.sin(this.tiempo * 6) * 0.45;
    ctx.globalAlpha = pulso; ctx.fillStyle = C.critico; ctx.beginPath(); ctx.arc(x, y, Math.min(W, H) * 0.028, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(Math.min(W, H) * 0.03)}px IBM Plex Sans, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, y + 1); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
  }

  /* ---------- ondas de clic ---------- */
  destellosClic(){
    const ctx = this.ctx;
    for(const d of this.destellos){ const t = d.t / 0.6; ctx.globalAlpha = (1 - t) * 0.6; ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, 6 + t * 26, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  /* ================================================================
     HELPERS DE DIBUJO "FALSO 3D"
     ================================================================ */

  /** Sombra elíptica difusa en el suelo. */
  sombraSuelo(cx, y, rw){
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(cx, y, 0, cx, y, rw);
    g.addColorStop(0, 'rgba(0,0,0,0.30)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(cx, y); ctx.scale(1, 0.26); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rw, 0, 7); ctx.fill(); ctx.restore();
  }

  /** Casa/edificio en vista 3/4: cara frontal + cara lateral + tejado a dos aguas. */
  casa3d(x, baseY, w, h, frente, tejado, nieve){
    const ctx = this.ctx;
    const vx = w * 0.34, vy = -w * 0.22;             // vector de profundidad (atrás-derecha)
    const topY = baseY - h;
    // cara lateral (en sombra)
    ctx.fillStyle = oscurecer(frente, 0.34);
    this.poligono([[x + w, baseY], [x + w + vx, baseY + vy], [x + w + vx, topY + vy], [x + w, topY]]);
    // cara frontal (gradiente vertical: arriba algo más claro)
    const g = ctx.createLinearGradient(0, topY, 0, baseY);
    g.addColorStop(0, aclarar(frente, 0.10)); g.addColorStop(1, oscurecer(frente, 0.06));
    ctx.fillStyle = g; ctx.beginPath(); ctx.rect(x, topY, w, h); ctx.fill(); this.contorno();
    // tejado a dos aguas: cumbrera hacia atrás-derecha
    const apexFX = x + w / 2, apexFY = topY - w * 0.5;
    const apexBX = apexFX + vx, apexBY = apexFY + vy;
    // faldón frontal (hastial) — claro
    ctx.fillStyle = aclarar(tejado, 0.12);
    this.poligono([[x, topY], [x + w, topY], [apexFX, apexFY]]);
    // faldón derecho — más oscuro (gira hacia atrás)
    ctx.fillStyle = oscurecer(tejado, 0.22);
    this.poligono([[x + w, topY], [x + w + vx, topY + vy], [apexBX, apexBY], [apexFX, apexFY]]);
    if(nieve){
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#eef4fa';
      this.poligono([[x, topY], [x + w, topY], [apexFX, apexFY]]);
      ctx.globalAlpha = 1;
    }
  }

  poligono(pts){
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill(); this.contorno();
  }
  contorno(){ const ctx = this.ctx; ctx.strokeStyle = 'rgba(6,15,24,0.5)'; ctx.lineWidth = 1.6; ctx.stroke(); }
  contornoRect(x, y, w, h){ const ctx = this.ctx; ctx.strokeStyle = 'rgba(6,15,24,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); }
}

/* ---------- utilidades de color ---------- */
function parseRGB(c){
  if(c[0] === '#'){ const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = c.match(/(\d+)/g); return [ +m[0], +m[1], +m[2] ];
}
export function mezclarColor(a, b, t){
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const A = parseRGB(a), B = parseRGB(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
export const oscurecer = (c, k) => mezclarColor(c, '#000000', k);
export const aclarar   = (c, k) => mezclarColor(c, '#ffffff', k);
