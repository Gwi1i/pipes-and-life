/**
 * ESCENA ASSETS — Nivel C: estructuras con imágenes (PNG) generadas por IA.
 *
 * Hereda TODO el entorno del Nivel A (cielo, agua, clima, día/noche, sombras,
 * bruma, tuberías...) y solo cambia las ESTRUCTURAS por sprites cargados desde
 * la carpeta `assets/`. Si un archivo no existe todavía, ese elemento se dibuja
 * con el método del Nivel A (super.metodo()): así puedes ir añadiendo imágenes
 * una a una, y hasta que no haya ninguna, el estilo C se ve igual que el A.
 *
 * Sin dependencias ni build: son <img> normales apuntando a archivos locales.
 *
 * NOMBRES DE ARCHIVO esperados en `assets/` (ver assets/PROMPTS.md):
 *   bomba.png  deposito.png  depuradora.png  captacion.png
 *   casa1.png  casa2.png  casa3.png  arbol.png  arbol_invierno.png
 */

import { CONFIG } from './config.js';
import { capacidad, fraccionTratada } from './simulacion.js';
import { limitar } from './util.js';
import { Escena } from './escena.js';

export class EscenaAssets extends Escena {

  constructor(lienzo){
    super(lienzo);
    this._img = {};   // clave → { img, ok, fallo }
  }

  /** Imagen del asset, o null si no ha cargado (o no existe → fallback al A). */
  asset(nombre){
    let e = this._img[nombre];
    if(!e){
      e = { img: new Image(), ok: false, fallo: false };
      e.img.onload  = () => { e.ok = true; };
      e.img.onerror = () => { e.fallo = true; };   // archivo ausente: se usará el A
      e.img.src = 'assets/' + nombre;
      this._img[nombre] = e;
    }
    return e.ok ? e.img : null;
  }

  /* ---------------- CAPTACIÓN ---------------- */
  captacion(){
    const spr = this.asset('captacion.png');
    if(!spr) return super.captacion();
    const W = this._W, H = this._H;
    const a = this.aparicionCaptacion === 0 ? 1 : this.aparicionCaptacion;
    const s = Math.min(W, H) * 0.11 * (0.6 + 0.4 * a);
    const x = W * 0.07, y = this.rioY + (H - this.rioY) * 0.35;
    this.ctx.globalAlpha = a;
    this.dibujarSprite(spr, x, y, s, s, 'centro');
    this.ctx.globalAlpha = 1;
  }

  /* ---------------- BOMBA ---------------- */
  bomba(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p;
    const spr = this.asset('bomba.png');
    if(!spr) return super.bomba();
    const cx = W * 0.17, baseY = this.sueloY, w = W * 0.09, h = w;
    const auto = p.autobombaActivo;
    const sx = 1 + this.pulso * 0.08, sy = 1 - this.pulso * 0.08;
    ctx.strokeStyle = C.captacion; ctx.globalAlpha = 0.7; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(W * 0.07, this.rioY + (H - this.rioY) * 0.35); ctx.stroke();
    ctx.globalAlpha = 1;
    this.sombraSuelo(cx, baseY + 3, w * 0.6);
    ctx.save(); ctx.translate(cx, baseY); ctx.scale(sx, sy); ctx.translate(-cx, -baseY);
    this.dibujarSprite(spr, cx, baseY, w, h, 'suelo');
    ctx.restore();
    ctx.font = '700 10px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = auto ? C.captacion : C.tenue;
    ctx.fillText(auto ? 'BOMBEO · AUTO' : 'BOMBEO', cx, baseY + 16);
  }

  /* ---------------- DEPÓSITO (con indicador de nivel) ---------------- */
  deposito(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p;
    const spr = this.asset('deposito.png');
    if(!spr) return super.deposito();
    const cx = W * 0.36, baseY = this.sueloY, w = W * 0.13, h = H * 0.28;
    const a = this.aparicionDeposito === 0 ? 1 : this.aparicionDeposito;
    const esc = 0.6 + 0.4 * a;
    this.sombraSuelo(cx, baseY + 2, w * 0.7);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, baseY); ctx.scale(esc, esc); ctx.translate(-cx, -baseY);
    this.dibujarSprite(spr, cx, baseY, w, h, 'suelo');
    ctx.restore();
    ctx.globalAlpha = 1;

    // Medidor de nivel a la derecha del depósito (funciona con cualquier arte)
    const frac = limitar(p.agua / capacidad(p), 0, 1);
    const gx = cx + w * 0.52, gy0 = baseY - h * 0.85, gy1 = baseY - h * 0.15, gw = 6;
    ctx.fillStyle = 'rgba(8,18,28,0.8)'; ctx.fillRect(gx, gy0, gw, gy1 - gy0);
    ctx.fillStyle = C.agua; ctx.fillRect(gx, gy1 - (gy1 - gy0) * frac, gw, (gy1 - gy0) * frac);
    ctx.strokeStyle = C.deposito; ctx.lineWidth = 1; ctx.strokeRect(gx, gy0, gw, gy1 - gy0);
    ctx.font = '700 11px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.deposito; ctx.fillText(Math.round(frac * 100) + '%', cx, gy0 - 6);
  }

  /* ---------------- DEPURADORA ---------------- */
  depuradora(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, p = this._p;
    const spr = this.asset('depuradora.png');
    if(!spr) return super.depuradora();
    const a = this.aparicionDepuradora === 0 ? 1 : this.aparicionDepuradora;
    const x = W * 0.80, base = this.sueloY, w = W * 0.16, h = w * 0.7;
    this.sombraSuelo(x, base + 2, w * 0.5);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, base); ctx.scale(0.6 + 0.4 * a, 0.6 + 0.4 * a); ctx.translate(-x, -base);
    this.dibujarSprite(spr, x, base, w, h, 'suelo');
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.font = '700 9px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.depuradora; ctx.fillText(`DEPURADORA Nv${p.mejoras.depuradora}`, x, base + 15);
  }

  /* ---------------- PUEBLO ---------------- */
  pueblo(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, p = this._p, r = this._res;
    const casas = ['casa1.png', 'casa2.png', 'casa3.png'].map(nb => this.asset(nb));
    if(casas.every(c => !c)) return super.pueblo();   // aún no hay ninguna
    const seco = r.servicio < 0.5;
    const n = limitar(Math.round(p.habitantes / 120), 3, 8);
    const zonaX = W * 0.48, zonaW = W * 0.26;
    const casaW = Math.min(zonaW / n * 0.72, W * 0.05);

    for(let i = 0; i < n; i++){
      const spr = casas[i % 3] || casas.find(c => c);
      const cx = zonaX + (i + 0.5) * (zonaW / n);
      const dw = casaW * 2.0, dh = dw;
      this.sombraSuelo(cx, this.sueloY + 2, casaW);
      this.dibujarSprite(spr, cx, this.sueloY, dw, dh, 'suelo');
      // sin servicio: velo gris sobre la casa
      if(seco){
        ctx.fillStyle = 'rgba(30,40,50,0.5)';
        ctx.fillRect(cx - dw / 2, this.sueloY - dh, dw, dh);
      } else {
        const brillo = (1 - this.luz) * 0.5;
        if(brillo > 0.02){ ctx.fillStyle = `rgba(255,224,130,${brillo})`; ctx.fillRect(cx - casaW * 0.14, this.sueloY - dh * 0.42, casaW * 0.28, casaW * 0.28); }
      }
    }
    if(seco){
      const bx = zonaX + zonaW * 0.5, by = this.sueloY - casaW * 3;
      ctx.globalAlpha = 0.6 + Math.sin(this.tiempo * 4) * 0.4;
      ctx.fillStyle = C.critico; ctx.font = 'bold 22px IBM Plex Sans, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('!', bx, by); ctx.globalAlpha = 1;
    }
    ctx.font = '700 11px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.texto; ctx.fillText(p.nombre, zonaX + zonaW * 0.5, this.sueloY + 15);
  }

  /* ---------------- ÁRBOLES ---------------- */
  arboles(fondo){
    const ctx = this.ctx, W = this._W;
    const inv = this.est.i === 3;
    const spr = (inv && this.asset('arbol_invierno.png')) || this.asset('arbol.png');
    if(!spr) return super.arboles(fondo);
    const xs = fondo ? [0.28, 0.44, 0.68, 0.90] : [0.10, 0.72];
    for(let k = 0; k < xs.length; k++){
      const x = W * xs[k], baseY = this.sueloY + (fondo ? -2 : 8), esc = fondo ? 0.72 : 1.05;
      const sway = Math.sin(this.tiempo * 1.2 + k) * 3 * esc;
      const dw = 48 * esc, dh = 62 * esc;
      this.sombraSuelo(x, baseY + 2, dw * 0.3);
      ctx.globalAlpha = fondo ? 0.9 : 1;
      this.dibujarSprite(spr, x + sway * 0.4, baseY, dw, dh, 'suelo');
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Dibuja un sprite manteniendo su proporción real dentro de la caja (w×h),
   * anclado al suelo ('suelo') o centrado ('centro'). Así da igual que el arte
   * venga cuadrado o no: nunca se deforma.
   */
  dibujarSprite(img, cx, anclaY, w, h, ancla){
    const rel = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
    let dw = w, dh = w / rel;
    if(dh > h){ dh = h; dw = h * rel; }
    const x = cx - dw / 2;
    const y = ancla === 'suelo' ? anclaY - dh : anclaY - dh / 2;
    this.ctx.drawImage(img, x, y, dw, dh);
  }
}
