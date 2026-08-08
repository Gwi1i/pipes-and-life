/**
 * ESCENA — el diorama.
 *
 * Es PURAMENTE visual: no decide nada, solo mira el estado y lo dibuja bonito.
 * Un corte de la instalación de izquierda a derecha —río, bomba, depósito,
 * pueblo— con el agua subiendo en el depósito, gotas por las tuberías y
 * animaciones cuando aparecen o se activan las cosas.
 *
 * Igual que el viejo render: LEE el estado, nunca lo modifica. Lo único que
 * guarda es su propio reloj de animación y los efectos pasajeros (destellos de
 * clic, aparición del depósito), que no son estado de juego.
 */

import { CONFIG } from './config.js';
import { capacidad } from './simulacion.js';
import { limitar } from './util.js';

export class Escena {

  constructor(lienzo){
    this.lienzo = lienzo;
    this.ctx = lienzo.getContext('2d');
    this.tiempo = 0;
    this.pulso = 0;          // 1 justo tras un clic, decae solo: anima el bombeo
    this.aparicionDeposito = 0;  // 0..1, animación de pop-in del depósito
    this.aparicionCaptacion = 0; // 0..1, pop-in de la captación
    this.destellos = [];     // ondas donde el jugador pincha
    this.ajustar();
    window.addEventListener('resize', () => this.ajustar());
  }

  /* El lienzo se dimensiona al hueco disponible, con nitidez en pantallas HiDPI. */
  ajustar(){
    const dpr = window.devicePixelRatio || 1;
    const caja = this.lienzo.parentElement.getBoundingClientRect();
    this.ancho = Math.max(320, caja.width);
    this.alto  = Math.max(240, caja.height);
    this.lienzo.width  = Math.round(this.ancho * dpr);
    this.lienzo.height = Math.round(this.alto  * dpr);
    this.lienzo.style.width  = this.ancho + 'px';
    this.lienzo.style.height = this.alto  + 'px';
  }

  /* ---------- efectos que dispara main.js ---------- */
  destello(x, y){
    this.pulso = 1;
    if(x != null) this.destellos.push({ x, y, t: 0 });
  }
  aparecerDeposito(){ this.aparicionDeposito = 0.0001; }  // arranca la animación
  aparecerCaptacion(){ this.aparicionCaptacion = 0.0001; }

  /* ================================================================
     DIBUJO
     ================================================================ */

  dibujar(estado, resultado, dt){
    const ctx = this.ctx;
    this.tiempo += dt;
    this.pulso = Math.max(0, this.pulso - dt * 2.2);
    // El auto-bombeo mantiene la bomba latiendo y las tuberías con gotas sin
    // que el jugador toque nada: se ve que la instalación trabaja sola.
    if(resultado.bombeoAuto) this.pulso = Math.max(this.pulso, 0.18);
    this.avanzarAparicion('aparicionDeposito', dt);
    this.avanzarAparicion('aparicionCaptacion', dt);
    this.destellos = this.destellos.filter(d => (d.t += dt) < 0.6);

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.ancho, H = this.alto;

    // Coordenadas de referencia de la escena
    const sueloY = H * 0.74;

    this.fondo(W, H, sueloY);
    this.rio(W, H, sueloY);
    if(estado.mejoras.captacion > 0) this.captacionIntake(W, H, sueloY);
    this.tuberias(estado, resultado, W, H, sueloY);
    this.bombaEdificio(estado, W, H, sueloY);
    if(estado.mejoras.deposito > 0) this.depositoTanque(estado, W, H, sueloY);
    this.pueblo(estado, resultado, W, H, sueloY);
    this.destellosClic(W, H);
  }

  /** Avanza una animación de aparición 0→1 sin pasarse. */
  avanzarAparicion(clave, dt){
    if(this[clave] > 0 && this[clave] < 1){
      this[clave] = Math.min(1, this[clave] + dt * 2.5);
    }
  }

  /* ---------- cielo, sol y tierra ---------- */
  fondo(W, H, sueloY){
    const ctx = this.ctx, C = CONFIG.color;
    const cielo = ctx.createLinearGradient(0, 0, 0, sueloY);
    cielo.addColorStop(0, C.cielo[0]);
    cielo.addColorStop(0.6, C.cielo[1]);
    cielo.addColorStop(1, C.cielo[2]);
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, W, sueloY);

    // Sol bajo, cálido: da el aire de atardecer de la paleta
    const sx = W * 0.84, sy = H * 0.20, r = Math.min(W, H) * 0.06;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.2);
    halo.addColorStop(0, 'rgba(245,196,81,0.5)');
    halo.addColorStop(1, 'rgba(245,196,81,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.sol;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();

    // Tierra
    const tierra = ctx.createLinearGradient(0, sueloY, 0, H);
    tierra.addColorStop(0, C.tierra[0]);
    tierra.addColorStop(1, C.tierra[1]);
    ctx.fillStyle = tierra;
    ctx.fillRect(0, sueloY, W, H - sueloY);
  }

  /* ---------- río en la orilla izquierda ---------- */
  rio(W, H, sueloY){
    const ctx = this.ctx, C = CONFIG.color;
    const x0 = 0, x1 = W * 0.16;
    ctx.fillStyle = C.aguaProfunda;
    ctx.fillRect(x0, sueloY, x1, H - sueloY);
    // Superficie ondulada
    ctx.strokeStyle = C.agua;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    for(let k = 0; k < 3; k++){
      ctx.beginPath();
      const y = sueloY + 6 + k * 7;
      for(let x = x0; x <= x1; x += 6){
        const oy = Math.sin(x * 0.06 + this.tiempo * 2 + k) * 2;
        x === x0 ? ctx.moveTo(x, y + oy) : ctx.lineTo(x, y + oy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- tuberías con gotas cuando circula agua ---------- */
  tuberias(estado, resultado, W, H, sueloY){
    const bombaX = W * 0.26;
    const casaX  = W * 0.80;
    const nivelTub = sueloY + (H - sueloY) * 0.45;
    // "Entra agua" si se clica O si produce la captación/auto-bombeo
    const entra = this.pulso > 0.02 || resultado.produciendo;

    // río → bomba
    this.tubo(W * 0.12, nivelTub, bombaX, nivelTub, entra, false);

    if(estado.mejoras.deposito > 0){
      const depX = W * 0.53, depBaseY = sueloY - H * 0.02, depTapaY = sueloY - H * 0.30;
      // bomba → depósito (sube)
      this.tubo(bombaX, nivelTub, depX, nivelTub, entra, false);
      this.tubo(depX, nivelTub, depX, depTapaY, entra, true);
      // depósito → pueblo (baja por gravedad): activa si hay servicio
      this.tubo(depX, depBaseY, casaX, depBaseY, resultado.servicio > 0.01, false);
      this.tubo(casaX, depBaseY, casaX, nivelTub, resultado.servicio > 0.01, true);
    } else {
      // sin depósito, la bomba va directa al pueblo: solo llega si entra agua
      this.tubo(bombaX, nivelTub, casaX, nivelTub, entra && resultado.servicio > 0.01, false);
    }
  }

  /** Un tramo de tubería recto (horizontal o vertical) con gotas si `fluye`. */
  tubo(x1, y1, x2, y2, fluye, vertical){
    const ctx = this.ctx, C = CONFIG.color;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2b3d4f';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = fluye ? C.agua : C.aguaSeca;
    ctx.lineWidth = 3;
    ctx.globalAlpha = fluye ? 0.95 : 0.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = 1;

    if(!fluye) return;
    const largo = Math.hypot(x2 - x1, y2 - y1);
    if(largo < 6) return;
    const dx = (x2 - x1) / largo, dy = (y2 - y1) / largo;
    const sep = 22, desfase = (this.tiempo * 60) % sep;
    ctx.fillStyle = '#bae6fd';
    for(let t = desfase; t < largo; t += sep){
      ctx.beginPath();
      ctx.arc(x1 + dx * t, y1 + dy * t, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------- captación: toma de agua en el río ---------- */
  captacionIntake(W, H, sueloY){
    const ctx = this.ctx, C = CONFIG.color;
    const a = this.aparicionCaptacion === 0 ? 1 : this.aparicionCaptacion;
    const x = W * 0.09, y = sueloY - H * 0.015;
    const s = Math.min(W, H) * 0.03 * (0.6 + 0.4 * a);

    ctx.save();
    ctx.globalAlpha = a;
    // Boya/toma turquesa con diana, evoca el manantial de la versión original
    ctx.fillStyle = C.captacion;
    ctx.globalAlpha = a * 0.3;
    ctx.beginPath(); ctx.arc(x, y, s * 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#062a2c'; ctx.lineWidth = 1.6; ctx.stroke();
    // Caña de aspiración hacia la bomba
    ctx.strokeStyle = C.captacion; ctx.globalAlpha = a * 0.7; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + W * 0.05, sueloY - H * 0.05); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ---------- caseta de bombeo (donde se clica) ---------- */
  bombaEdificio(estado, W, H, sueloY){
    const ctx = this.ctx, C = CONFIG.color;
    const x = W * 0.26, w = W * 0.075, h = H * 0.13;
    const y = sueloY - h;
    const auto = estado.mejoras.autobomba > 0;
    // Late suavemente, da un golpe al bombear, y late más si trabaja sola
    const late = 1 + Math.sin(this.tiempo * (auto ? 6 : 2)) * (auto ? 0.03 : 0.015)
                 + this.pulso * 0.06;

    ctx.save();
    ctx.translate(x, sueloY);
    ctx.scale(late, late);
    ctx.translate(-x, -sueloY);

    ctx.fillStyle = '#1b2a3a';
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.strokeStyle = C.estructura;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w / 2, y, w, h);
    // Tejado
    ctx.fillStyle = C.estructura;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 4, y);
    ctx.lineTo(x + w / 2 + 4, y);
    ctx.lineTo(x, y - h * 0.28);
    ctx.closePath(); ctx.fill();
    // Símbolo de bomba: gota que brilla con el pulso
    ctx.fillStyle = `rgba(56,189,248,${0.55 + this.pulso * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y + h * 0.55, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Etiqueta; marca AUTO cuando el auto-bombeo está en marcha
    ctx.font = '600 10px IBM Plex Mono, ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = auto ? C.captacion : C.tenue;
    ctx.fillText(auto ? 'BOMBEO · AUTO' : 'BOMBEO', x, sueloY + 16);
  }

  /* ---------- depósito elevado con lámina de agua ---------- */
  depositoTanque(estado, W, H, sueloY){
    const ctx = this.ctx, C = CONFIG.color;
    const x = W * 0.53, w = W * 0.11, h = H * 0.26;
    const topeY = sueloY - h * 1.05;
    const baseY = sueloY - h * 0.05;
    // Animación de aparición: sube desde el suelo y crece
    const a = this.aparicionDeposito === 0 ? 1 : this.aparicionDeposito;
    const esc = 0.6 + 0.4 * a;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, baseY);
    ctx.scale(esc, esc);
    ctx.translate(-x, -baseY);

    // Patas
    ctx.strokeStyle = C.estructura; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 6, baseY); ctx.lineTo(x - w / 2 + 6, baseY + h * 0.18);
    ctx.moveTo(x + w / 2 - 6, baseY); ctx.lineTo(x + w / 2 - 6, baseY + h * 0.18);
    ctx.stroke();

    const cuerpoH = baseY - topeY;
    // Agua dentro, proporcional al llenado
    const frac = limitar(estado.agua / capacidad(estado), 0, 1);
    const aguaH = cuerpoH * frac;
    const aguaY = baseY - aguaH;
    const grad = ctx.createLinearGradient(0, aguaY, 0, baseY);
    grad.addColorStop(0, C.agua);
    grad.addColorStop(1, C.aguaProfunda);
    ctx.fillStyle = grad;
    ctx.fillRect(x - w / 2, aguaY, w, aguaH);
    // Onda en la superficie
    if(frac > 0.01){
      ctx.strokeStyle = '#bae6fd'; ctx.globalAlpha = a * 0.8; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for(let px = x - w / 2; px <= x + w / 2; px += 5){
        const oy = Math.sin(px * 0.15 + this.tiempo * 3) * 1.6;
        px === x - w / 2 ? ctx.moveTo(px, aguaY + oy) : ctx.lineTo(px, aguaY + oy);
      }
      ctx.stroke();
      ctx.globalAlpha = a;
    }
    // Pared del tanque
    ctx.strokeStyle = C.deposito; ctx.lineWidth = 2.5;
    ctx.strokeRect(x - w / 2, topeY, w, cuerpoH);
    // Tapa
    ctx.fillStyle = C.estructura;
    ctx.fillRect(x - w / 2 - 3, topeY - 5, w + 6, 6);
    ctx.restore();

    // Porcentaje
    ctx.globalAlpha = 1;
    ctx.font = '600 11px IBM Plex Mono, ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.deposito;
    ctx.fillText(Math.round(frac * 100) + '%', x, topeY - 10);
  }

  /* ---------- el pueblo ---------- */
  pueblo(estado, resultado, W, H, sueloY){
    const ctx = this.ctx, C = CONFIG.color;
    const seco = resultado.servicio < 0.5;
    const col = seco ? C.casaSeca : C.casa;
    // Una casa por cada ~90 habitantes, entre 3 y 7
    const n = limitar(Math.round(estado.poblacion.habitantes / 90), 3, 7);
    const zonaX = W * 0.72, zonaW = W * 0.24;
    const casaW = Math.min(zonaW / n * 0.8, W * 0.04);

    for(let i = 0; i < n; i++){
      const x = zonaX + (i + 0.5) * (zonaW / n);
      const h = casaW * (1.1 + (i % 2) * 0.35);
      const y = sueloY - h;
      ctx.fillStyle = '#16222f';
      ctx.fillRect(x - casaW / 2, y, casaW, h);
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.strokeRect(x - casaW / 2, y, casaW, h);
      // Tejado
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - casaW / 2 - 2, y);
      ctx.lineTo(x + casaW / 2 + 2, y);
      ctx.lineTo(x, y - casaW * 0.5);
      ctx.closePath(); ctx.fill();
      // Ventana encendida si hay servicio
      if(!seco){
        ctx.fillStyle = 'rgba(245,196,81,0.85)';
        ctx.fillRect(x - casaW * 0.14, y + h * 0.35, casaW * 0.28, casaW * 0.28);
      }
    }

    // Burbuja de sed si está mal servida
    if(seco){
      const bx = zonaX + zonaW * 0.5, by = sueloY - casaW * 2.6;
      const pulso = 0.6 + Math.sin(this.tiempo * 4) * 0.4;
      ctx.globalAlpha = pulso;
      ctx.fillStyle = C.critico;
      ctx.font = 'bold 22px IBM Plex Sans, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', bx, by);
      ctx.globalAlpha = 1;
    }

    // Nombre
    ctx.font = '600 11px IBM Plex Mono, ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.tenue;
    ctx.fillText(estado.poblacion.nombre, zonaX + zonaW * 0.5, sueloY + 16);
  }

  /* ---------- ondas donde se pincha ---------- */
  destellosClic(W, H){
    const ctx = this.ctx;
    for(const d of this.destellos){
      const p = d.t / 0.6;
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 6 + p * 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
