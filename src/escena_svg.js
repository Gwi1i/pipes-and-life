/**
 * ESCENA SVG — Nivel B (prototipo para comparar con el Nivel A).
 *
 * Hereda TODO el entorno del Nivel A (cielo, agua, clima, día/noche, sombras,
 * bruma, tuberías, vertido...) y solo cambia las ESTRUCTURAS —bomba, depósito,
 * depuradora, casas, árboles, captación— por sprites vectoriales SVG dibujados
 * a mano. Así la comparación es justa: mismo escenario, distinto "material".
 *
 * Los sprites son SVG (con degradados y sombra suave por desenfoque) que se
 * cargan como imagen y se pintan con drawImage. Mientras un sprite no ha
 * cargado, se recurre al dibujo por código del Nivel A (super.metodo()), así
 * nunca desaparece nada. Sin dependencias ni build: el SVG es texto.
 */

import { CONFIG } from './config.js';
import { capacidad, fraccionTratada } from './simulacion.js';
import { limitar } from './util.js';
import { Escena, mezclarColor, oscurecer, aclarar } from './escena.js';

export class EscenaSVG extends Escena {

  constructor(lienzo){
    super(lienzo);
    this._img = {};   // caché de sprites: clave → { img, ok }
  }

  /** Devuelve la imagen del sprite, o null si aún no ha cargado. */
  sprite(clave, svg){
    let e = this._img[clave];
    if(!e){
      e = { img: new Image(), ok: false };
      e.img.onload = () => { e.ok = true; };
      e.img.src = 'data:image/svg+xml;charset=utf8,' + encodeURIComponent(svg);
      this._img[clave] = e;
    }
    return e.ok ? e.img : null;
  }

  /* ---------------- CAPTACIÓN ---------------- */
  captacion(){
    const W = this._W, H = this._H;
    const spr = this.sprite('captacion', svgCaptacion());
    if(!spr) return super.captacion();
    const a = this.aparicionCaptacion === 0 ? 1 : this.aparicionCaptacion;
    const s = Math.min(W, H) * 0.10 * (0.6 + 0.4 * a);
    const x = W * 0.07, y = this.rioY + (H - this.rioY) * 0.35;
    this.ctx.globalAlpha = a;
    this.ctx.drawImage(spr, x - s / 2, y - s / 2, s, s);
    this.ctx.globalAlpha = 1;
  }

  /* ---------------- CASETA DE BOMBEO ---------------- */
  bomba(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p;
    const spr = this.sprite('bomba', svgBomba());
    if(!spr) return super.bomba();
    const w = W * 0.075, h = H * 0.13, cx = W * 0.17, baseY = this.sueloY;
    const auto = p.autobombaActivo;
    const sx = 1 + this.pulso * 0.08, sy = 1 - this.pulso * 0.08;

    // tubo de aspiración al río (igual que en A)
    ctx.strokeStyle = C.captacion; ctx.globalAlpha = 0.7; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(W * 0.07, this.rioY + (H - this.rioY) * 0.35); ctx.stroke();
    ctx.globalAlpha = 1;

    this.sombraSuelo(cx, baseY + 3, w * 1.1);
    const dw = w * 2.1, dh = dw;
    ctx.save(); ctx.translate(cx, baseY); ctx.scale(sx, sy); ctx.translate(-cx, -baseY);
    ctx.drawImage(spr, cx - dw / 2, baseY - dh * 0.92, dw, dh);
    // gota que late sobre el ojo de buey
    ctx.beginPath(); ctx.arc(cx, baseY - h * 0.5, w * 0.16, 0, 7);
    ctx.fillStyle = `rgba(125,211,252,${0.35 + this.pulso * 0.5})`; ctx.fill();
    ctx.restore();

    ctx.font = '700 10px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = auto ? C.captacion : C.tenue;
    ctx.fillText(auto ? 'BOMBEO · AUTO' : 'BOMBEO', cx, baseY + 16);
  }

  /* ---------------- DEPÓSITO ---------------- */
  deposito(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, H = this._H, p = this._p;
    const spr = this.sprite('deposito', svgDeposito());
    if(!spr) return super.deposito();
    const cx = W * 0.36, w = W * 0.12, h = H * 0.26;
    const a = this.aparicionDeposito === 0 ? 1 : this.aparicionDeposito;
    const esc = 0.6 + 0.4 * a;
    const baseY = this.sueloY, topeY = baseY - h;
    this.sombraSuelo(cx, baseY + 2, w * 1.2);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, baseY); ctx.scale(esc, esc); ctx.translate(-cx, -baseY);

    // agua (canvas) detrás del cristal del sprite
    const frac = limitar(p.agua / capacidad(p, this._estado), 0, 1);
    const intX = cx - w * 0.34, intW = w * 0.68;
    const intBot = baseY - h * 0.16, intTop = topeY + h * 0.12;
    const aguaTop = intBot - (intBot - intTop) * frac;
    if(frac > 0.01){
      const g = ctx.createLinearGradient(intX, 0, intX + intW, 0);
      g.addColorStop(0, oscurecer(C.aguaProfunda, 0.05)); g.addColorStop(0.55, C.agua); g.addColorStop(1, oscurecer(C.aguaProfunda, 0.02));
      ctx.fillStyle = g; ctx.fillRect(intX, aguaTop, intW, intBot - aguaTop);
      ctx.fillStyle = aclarar(C.agua, 0.25 + Math.sin(this.tiempo * 3) * 0.05);
      ctx.beginPath(); ctx.ellipse(intX + intW / 2, aguaTop, intW / 2, h * 0.03, 0, 0, 7); ctx.fill();
    }
    const dw = w * 1.5, dh = h * 1.35;
    ctx.drawImage(spr, cx - dw / 2, baseY - dh, dw, dh);
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.font = '700 11px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.deposito; ctx.fillText(Math.round(frac * 100) + '%', cx, topeY - 8);
  }

  /* ---------------- DEPURADORA ---------------- */
  depuradora(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, p = this._p;
    const spr = this.sprite('depuradora', svgDepuradora());
    if(!spr) return super.depuradora();
    const a = this.aparicionDepuradora === 0 ? 1 : this.aparicionDepuradora;
    const x = W * 0.80, base = this.sueloY, w = W * 0.15, dh = w * 0.62;
    this.sombraSuelo(x, base + 2, w * 0.55);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, base); ctx.scale(0.6 + 0.4 * a, 0.6 + 0.4 * a); ctx.translate(-x, -base);
    ctx.drawImage(spr, x - w / 2, base - dh, w, dh);
    // brazos giratorios sobre las bocas (canvas)
    ctx.strokeStyle = C.estructura; ctx.lineWidth = 1.6;
    for(let k = 0; k < 2; k++){
      const cxk = x - w / 2 + w * (0.30 + k * 0.40), cyk = base - dh * 0.62, rx = w * 0.11, ry = rx * 0.4;
      const ang = this.tiempo * (0.9 + k * 0.2);
      ctx.beginPath();
      ctx.moveTo(cxk - Math.cos(ang) * rx, cyk - Math.sin(ang) * ry);
      ctx.lineTo(cxk + Math.cos(ang) * rx, cyk + Math.sin(ang) * ry); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.font = '700 9px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = C.depuradora; ctx.fillText(`DEPURADORA Nv${p.mejoras.depuradora}`, x, base + 15);
  }

  /* ---------------- PUEBLO ---------------- */
  pueblo(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, p = this._p, r = this._res;
    const seco = r.servicio < 0.5;
    const n = limitar(Math.round(p.habitantes / 120), 3, 8);
    const zonaX = W * 0.48, zonaW = W * 0.26;
    const casaW = Math.min(zonaW / n * 0.72, W * 0.042);
    let algunoFalta = false;

    for(let i = 0; i < n; i++){
      const pared = seco ? '#3a4650' : ['#efdcaa', '#e3b98a', '#d9c98f'][i % 3];
      const tejado = seco ? '#556170' : ['#d0453a', '#b8593a', '#9e3f30'][i % 3];
      const spr = this.sprite('casa_' + pared + '_' + tejado + (seco ? '_s' : ''), svgCasa(pared, tejado, seco));
      if(!spr){ algunoFalta = true; continue; }
      const cx = zonaX + (i + 0.5) * (zonaW / n);
      const dw = casaW * 2.1, dh = dw * 1.25;
      this.sombraSuelo(cx, this.sueloY + 2, casaW * 1.1);
      ctx.drawImage(spr, cx - dw / 2, this.sueloY - dh * 0.92, dw, dh);
      // ventana encendida de noche (canvas, encima del sprite)
      if(!seco){
        const brillo = (1 - this.luz) * 0.5;
        if(brillo > 0.02){
          ctx.fillStyle = `rgba(255,224,130,${brillo})`;
          ctx.fillRect(cx - casaW * 0.16, this.sueloY - dh * 0.42, casaW * 0.32, casaW * 0.32);
        }
      }
    }
    if(algunoFalta) return super.pueblo();   // aún cargando: el A rellena

    if(seco){
      const bx = zonaX + zonaW * 0.5, by = this.sueloY - casaW * 3.2;
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
    const xs = fondo ? [0.28, 0.44, 0.68, 0.90] : [0.10, 0.72];
    let follaje = this.est.follaje;
    if(fondo) follaje = mezclarColor(follaje, this.bruma, 0.4);
    const nevado = this.est.i === 3;
    const spr = this.sprite('arbol_' + follaje + (nevado ? '_n' : ''), svgArbol(follaje, nevado));
    if(!spr) return super.arboles(fondo);
    for(let k = 0; k < xs.length; k++){
      const x = W * xs[k], baseY = this.sueloY + (fondo ? -2 : 8), esc = fondo ? 0.72 : 1.05;
      const sway = Math.sin(this.tiempo * 1.2 + k) * 3 * esc;
      const dw = 40 * esc, dh = 55 * esc;
      this.sombraSuelo(x, baseY + 2, dw * 0.35);
      ctx.save(); ctx.translate(x + sway * 0.4, 0);
      ctx.drawImage(spr, x - dw / 2, baseY - dh, dw, dh);
      ctx.restore();
    }
  }
}

/* ================================================================
   SPRITES SVG (texto; se dibujan una vez y se cachean como imagen)
   ================================================================ */

const SOMBRA = `<filter id='s' x='-40%' y='-40%' width='180%' height='180%'>
  <feDropShadow dx='2' dy='3' stdDeviation='2.5' flood-color='#04101a' flood-opacity='0.45'/></filter>`;

function svg(vb, cuerpo){
  // width/height explícitos: sin ellos, Chrome da a la imagen SVG un tamaño
  // intrínseco por defecto y drawImage no escala como se espera.
  const [, , w, h] = vb.split(' ');
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${vb}'><defs>${SOMBRA}</defs>${cuerpo}</svg>`;
}

function svgCasa(pared, tejado, seco){
  const ventana = seco ? '#1c2732' : '#f5c451';
  return svg('0 0 100 130', `
    <linearGradient id='w' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0' stop-color='${aclarar(pared, 0.14)}'/>
      <stop offset='0.6' stop-color='${pared}'/>
      <stop offset='1' stop-color='${oscurecer(pared, 0.3)}'/>
    </linearGradient>
    <linearGradient id='r' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='${aclarar(tejado, 0.16)}'/>
      <stop offset='1' stop-color='${oscurecer(tejado, 0.2)}'/>
    </linearGradient>
    <g filter='url(#s)' stroke='#0a1622' stroke-width='1.4' stroke-linejoin='round'>
      <path d='M70,122 L92,110 L92,54 L70,66 Z' fill='${oscurecer(pared, 0.42)}'/>
      <rect x='24' y='66' width='46' height='56' fill='url(#w)'/>
      <path d='M70,66 L92,54 L70,36 L48,48 Z' fill='${oscurecer(tejado, 0.22)}'/>
      <path d='M24,66 L70,66 L47,42 Z' fill='url(#r)'/>
      <rect x='36' y='84' width='20' height='20' rx='2' fill='${ventana}'/>
    </g>`);
}

function svgArbol(follaje, nevado){
  const nieve = nevado
    ? `<path d='M18,44 a24,24 0 0 1 44,0 Z' fill='#eef4fa' opacity='0.75'/>` : '';
  return svg('0 0 80 110', `
    <radialGradient id='f' cx='0.35' cy='0.3' r='0.85'>
      <stop offset='0' stop-color='${aclarar(follaje, 0.26)}'/>
      <stop offset='1' stop-color='${oscurecer(follaje, 0.32)}'/>
    </radialGradient>
    <g filter='url(#s)'>
      <rect x='35' y='58' width='9' height='48' rx='3' fill='#6b4a30'/>
      <rect x='39' y='58' width='4' height='48' fill='#4a3220' opacity='0.6'/>
      <g stroke='#0a1622' stroke-width='1'>
        <circle cx='27' cy='50' r='21' fill='url(#f)'/>
        <circle cx='53' cy='50' r='21' fill='url(#f)'/>
        <circle cx='40' cy='32' r='25' fill='url(#f)'/>
      </g>
      ${nieve}
    </g>`);
}

function svgBomba(){
  return svg('0 0 100 100', `
    <linearGradient id='w' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0' stop-color='#4a6a8c'/><stop offset='0.6' stop-color='#35506d'/><stop offset='1' stop-color='#22364a'/>
    </linearGradient>
    <radialGradient id='o' cx='0.4' cy='0.35' r='0.7'>
      <stop offset='0' stop-color='#bae6fd'/><stop offset='1' stop-color='#0e5a86'/>
    </radialGradient>
    <g filter='url(#s)' stroke='#0a1622' stroke-width='1.6' stroke-linejoin='round'>
      <path d='M72,96 L92,86 L92,44 L72,54 Z' fill='#243a52'/>
      <rect x='16' y='46' width='56' height='50' fill='url(#w)'/>
      <path d='M72,46 L92,36 L72,20 L52,30 Z' fill='#2c4763'/>
      <path d='M16,46 L72,46 L44,22 Z' fill='#4a6a8c'/>
      <circle cx='44' cy='72' r='13' fill='url(#o)'/>
    </g>`);
}

function svgDeposito(){
  // cristal translúcido para que se vea el agua (canvas) por detrás
  return svg('0 0 100 130', `
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0' stop-color='#7dd3fc' stop-opacity='0.30'/>
      <stop offset='0.5' stop-color='#bae6fd' stop-opacity='0.12'/>
      <stop offset='1' stop-color='#38bdf8' stop-opacity='0.30'/>
    </linearGradient>
    <g filter='url(#s)'>
      <rect x='24' y='108' width='5' height='20' fill='#94a3b8'/>
      <rect x='71' y='108' width='5' height='20' fill='#94a3b8'/>
      <rect x='18' y='22' width='64' height='90' rx='8' fill='url(#g)' stroke='#7dd3fc' stroke-width='2.5'/>
      <ellipse cx='50' cy='22' rx='32' ry='9' fill='#9fdcfb' stroke='#7dd3fc' stroke-width='2.5'/>
      <rect x='26' y='30' width='7' height='72' rx='3' fill='#ffffff' opacity='0.20'/>
    </g>`);
}

function svgDepuradora(){
  const tanque = (cx) => `
    <ellipse cx='${cx}' cy='58' rx='22' ry='9' fill='#0f2a26'/>
    <path d='M${cx - 22},58 L${cx - 22},20 a22,9 0 0 1 44,0 L${cx + 22},58 a22,9 0 0 1 -44,0 Z'
      fill='url(#t)' stroke='#34d399' stroke-width='2'/>
    <ellipse cx='${cx}' cy='20' rx='22' ry='9' fill='#1f5a4c' stroke='#34d399' stroke-width='2'/>`;
  return svg('0 0 160 70', `
    <linearGradient id='t' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0' stop-color='#173a33'/><stop offset='0.6' stop-color='#2b6a5a'/><stop offset='1' stop-color='#173a33'/>
    </linearGradient>
    <g filter='url(#s)'>${tanque(46)}${tanque(114)}</g>`);
}

function svgCaptacion(){
  return svg('0 0 100 100', `
    <radialGradient id='c' cx='0.4' cy='0.35' r='0.7'>
      <stop offset='0' stop-color='#a7f3e0'/><stop offset='1' stop-color='#0d9488'/>
    </radialGradient>
    <g filter='url(#s)'>
      <circle cx='50' cy='50' r='34' fill='#5eead4' opacity='0.25'/>
      <circle cx='50' cy='50' r='20' fill='url(#c)' stroke='#062a2c' stroke-width='2'/>
    </g>`);
}
