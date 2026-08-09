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
 *   paisaje.png (opcional: paisaje_noche.png, paisaje_invierno.png)
 *   bomba.png  deposito.png  depuradora.png  captacion.png
 *   pueblo_aldea.png  pueblo_villa.png  pueblo_ciudad.png  (o casa1-3.png)
 *   arbol.png  arbol_invierno.png
 *
 * PAISAJE: si existe `paisaje.png`, se usa como telón a pantalla completa (río
 * abajo, banda de suelo en medio, montañas y cielo arriba) y las estructuras se
 * dibujan encima, sobre la línea de suelo `NIVEL_SUELO`. Si además hay variantes
 * `paisaje_noche.png` / `paisaje_invierno.png`, se eligen según hora/estación;
 * si no, la noche se resuelve oscureciendo el paisaje de día.
 */

import { CONFIG } from './config.js';
import { capacidad, fraccionTratada } from './simulacion.js';
import { limitar } from './util.js';
import { Escena, mezclarColor } from './escena.js';

// Dónde cae el "suelo" (donde se apoyan las estructuras) y el río DENTRO del
// paisaje a pantalla completa, en fracción de alto. Se ajustan al arte real.
const NIVEL_SUELO = 0.74;   // pradera del paisaje donde se apoyan las estructuras
const NIVEL_RIO = 0.84;     // borde del río del paisaje (captación y vertido)

// Niveles de población: una imagen de asentamiento por tamaño. Cambia sola al
// crecer. Si falta la imagen, se recurre a las casas sueltas (casa1-3).
const NIVELES_PUEBLO = [
  { hasta: 600,       sprite: 'pueblo_aldea.png'  },
  { hasta: 2500,      sprite: 'pueblo_villa.png'  },
  { hasta: Infinity,  sprite: 'pueblo_ciudad.png' }
];

export class EscenaAssets extends Escena {

  constructor(lienzo){
    super(lienzo);
    this._img = {};   // clave → { img, ok, fallo }
  }

  /** Entrada del asset { img, bbox } o null si no ha cargado (→ fallback al A). */
  asset(nombre){
    let e = this._img[nombre];
    if(!e){
      e = { img: new Image(), ok: false, fallo: false, bbox: null };
      e.img.onload  = () => { e.bbox = recorteOpaco(e.img); e.ok = true; };
      e.img.onerror = () => { e.fallo = true; };   // archivo ausente: se usará el A
      e.img.src = 'assets/' + nombre;
      this._img[nombre] = e;
    }
    return e.ok ? e : null;
  }

  /* ---------------- FONDO (paisaje de IA) ----------------
     Si existe assets/fondo.png, sustituye el cielo y las colinas de código por
     el paisaje ilustrado (mismo estilo que las estructuras, así todo pega). El
     sol/luna, el clima y el primer plano (suelo + río) se pintan encima para
     que siga vivo y con día/noche. */
  fondoBackdrop(){
    const f = this.asset('fondo.png');
    if(!f) return false;
    const ctx = this.ctx, W = this._W, C = CONFIG.color, img = f.img;
    // Relleno de respaldo: si el PNG del fondo no llega a los bordes, que se vea
    // cielo (arriba) y verde (abajo), no el vacío transparente del lienzo.
    const cieloArriba = mezclarColor(C.cieloNoche[0], C.cielo[0], this.luz);
    const cieloAbajo  = mezclarColor(C.cieloNoche[2], C.cielo[2], this.luz);
    const g = ctx.createLinearGradient(0, 0, 0, this.sueloY);
    g.addColorStop(0, cieloArriba); g.addColorStop(0.65, cieloAbajo);
    g.addColorStop(1, mezclarColor('#2f5a30', this.est.hierba, 0.6));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, this.sueloY + 4);

    // OJO: el fondo actual trae el "checkerboard" de transparencia HORNEADO como
    // píxeles opacos en su tercio inferior (fallo de exportación). Usamos solo su
    // parte SUPERIOR limpia (cielo + montañas + colinas) como telón, estirada a lo
    // ancho; el primer plano (suelo + río) lo pone el juego. Si algún día el fondo
    // llena todo el cuadro sin checkerboard, sube `CORTE` a 1.
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const CORTE = 0.50;
    ctx.drawImage(img, 0, 0, iw, ih * CORTE, 0, 0, W, this.sueloY + this._H * 0.05);
    // Atenuación día/noche sobre el fondo
    const oscuro = 1 - this.luz;
    if(oscuro > 0.01){ ctx.fillStyle = `rgba(6,14,26,${oscuro * 0.5})`; ctx.fillRect(0, 0, W, this.sueloY + 4); }
    return true;
  }

  /* ---------------- PAISAJE A PANTALLA COMPLETA ----------------
     Un único telón que ya trae río, suelo, montañas y cielo. Elige la variante
     más específica disponible según hora y estación. */
  paisajeAsset(){
    const noche = this.luz < 0.32;
    const inv = this.est.i === 3;
    const cands = [];
    if(inv && noche) cands.push('paisaje_invierno_noche.png');
    if(noche) cands.push('paisaje_noche.png');
    if(inv) cands.push('paisaje_invierno.png');
    cands.push('paisaje.png');
    for(const n of cands){ const f = this.asset(n); if(f) return { f, noche: n.includes('noche') }; }
    return null;
  }

  /** ¿Hay paisaje de fondo? (cachea el resultado por fotograma para no repetir). */
  hayPaisaje(){ return !!this.paisajeAsset(); }

  /** Dibuja una imagen cubriendo todo el lienzo (como background-size: cover). */
  dibujarCover(img){
    const ctx = this.ctx, W = this._W, H = this._H;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  /* --- Anulaciones del entorno cuando hay paisaje: el telón manda --- */
  cielo(){
    const pj = this.paisajeAsset();
    if(pj){
      // recolocar suelo/río a la composición del paisaje (afecta a lo que sigue)
      this.sueloY = this._H * NIVEL_SUELO;
      this.rioY = this._H * NIVEL_RIO;
      this.dibujarCover(pj.f.img);
      if(!pj.noche && this.luz < 0.92){   // oscurecer hacia la noche si no hay variante nocturna
        this.ctx.fillStyle = `rgba(8,14,34,${(1 - this.luz) * 0.5})`;
        this.ctx.fillRect(0, 0, this._W, this._H);
      }
      return;
    }
    if(this.fondoBackdrop()) return;
    super.cielo();
  }
  astro(){ if(!this.hayPaisaje()) super.astro(); }
  nubesDibujar(dt){ if(!this.hayPaisaje() && !this.asset('fondo.png')) super.nubesDibujar(dt); }
  colinas(){ if(!this.hayPaisaje() && !this.asset('fondo.png')) super.colinas(); }
  brumaHorizonte(){ if(!this.hayPaisaje() && !this.asset('fondo.png')) super.brumaHorizonte(); }
  suelo(){ if(!this.hayPaisaje()) super.suelo(); }
  rio(dt){ if(!this.hayPaisaje()) super.rio(dt); }

  /** Etiqueta con "pastilla" translúcida, para que el texto lea sobre cualquier fondo. */
  etiqueta(texto, cx, y, color, tam = 10){
    const ctx = this.ctx;
    ctx.font = `700 ${tam}px IBM Plex Mono, ui-monospace, monospace`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(texto).width, padX = 7, hh = tam + 7;
    ctx.fillStyle = 'rgba(8,16,26,0.5)';
    ctx.beginPath(); ctx.roundRect(cx - w / 2 - padX, y - tam - 2, w + padX * 2, hh, 5); ctx.fill();
    ctx.fillStyle = color; ctx.fillText(texto, cx, y);
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
    this.dibujarSprite(spr, cx, baseY, w, h, 'suelo', 3);
    ctx.restore();
    this.etiqueta(auto ? 'BOMBEO · AUTO' : 'BOMBEO', cx, baseY + 17, auto ? C.captacion : C.texto);
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
    this.dibujarSprite(spr, cx, baseY, w, h, 'suelo', 3);
    ctx.restore();
    ctx.globalAlpha = 1;

    // Nivel del depósito: pastilla con gota que se llena, integrada con el arte
    const frac = limitar(p.agua / capacidad(p, this._estado), 0, 1);
    this.pastillaNivel(cx, baseY - h - 2, frac);
  }

  /** Indicador de nivel: gota rellenándose + porcentaje, en una pastilla. */
  pastillaNivel(cx, y, frac){
    const ctx = this.ctx, C = CONFIG.color;
    const txt = Math.round(frac * 100) + '%';
    ctx.font = '700 11px IBM Plex Mono, ui-monospace, monospace'; ctx.textAlign = 'left';
    const w = ctx.measureText(txt).width, r = 6, gap = 6, padX = 8, hh = 20;
    const total = r * 2 + gap + w, x0 = cx - total / 2 - padX;
    ctx.fillStyle = 'rgba(8,16,26,0.5)';
    ctx.beginPath(); ctx.roundRect(x0, y - hh, total + padX * 2, hh, 6); ctx.fill();
    // gota (contorno + relleno por nivel)
    const gx = x0 + padX + r, gy = y - hh / 2;
    ctx.beginPath(); ctx.arc(gx, gy, r, 0, 7);
    ctx.fillStyle = 'rgba(56,189,248,0.18)'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = C.agua; ctx.fillRect(gx - r, gy + r - 2 * r * frac, r * 2, 2 * r * frac);
    ctx.restore();
    ctx.strokeStyle = C.deposito; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(gx, gy, r, 0, 7); ctx.stroke();
    ctx.fillStyle = C.texto; ctx.fillText(txt, gx + r + gap, y - hh / 2 + 4);
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
    this.dibujarSprite(spr, x, base, w, h, 'suelo', 3);
    ctx.restore(); ctx.globalAlpha = 1;
    this.etiqueta(`DEPURADORA Nv${p.mejoras.depuradora}`, x, base + 16, C.depuradora, 9);
  }

  /* ---------------- PUEBLO (por niveles de población) ---------------- */
  pueblo(){
    const ctx = this.ctx, C = CONFIG.color, W = this._W, p = this._p, r = this._res;
    const seco = r.servicio < 0.5;
    const zonaX = W * 0.48, zonaW = W * 0.26, cxZona = zonaX + zonaW * 0.5;

    // Imagen de asentamiento según el tamaño (aldea → villa → ciudad)
    const nivel = NIVELES_PUEBLO.find(t => p.habitantes < t.hasta) || NIVELES_PUEBLO[NIVELES_PUEBLO.length - 1];
    const asent = this.asset(nivel.sprite);
    if(asent){
      const esc = limitar(0.8 + p.habitantes / 8000, 0.8, 1.4);
      const dw = zonaW * esc, dh = dw * 0.72;
      // hundir la tile para tragarse el canto de su parcela (si no, flota)
      const hundir = dh * 0.16;
      this.sombraSuelo(cxZona, this.sueloY + 5, dw * 0.5);
      this.dibujarSprite(asent, cxZona, this.sueloY, dw, dh, 'suelo', hundir);
      if(seco){
        ctx.fillStyle = 'rgba(30,40,50,0.42)';
        ctx.fillRect(cxZona - dw / 2, this.sueloY - dh, dw, dh);
        this.burbujaSed(cxZona, this.sueloY - dh - 6);
      }
      this.etiqueta(p.nombre, cxZona, this.sueloY + 16, C.texto, 11);
      return;
    }

    // Respaldo: casas sueltas (casa1-3) mientras no haya imágenes de nivel
    const casas = ['casa1.png', 'casa2.png', 'casa3.png'].map(nb => this.asset(nb));
    if(casas.every(c => !c)) return super.pueblo();
    const n = limitar(Math.round(p.habitantes / 120), 3, 8);
    const casaW = Math.min(zonaW / n * 0.72, W * 0.05);

    for(let i = 0; i < n; i++){
      const spr = casas[i % 3] || casas.find(c => c);
      const cx = zonaX + (i + 0.5) * (zonaW / n);
      const dw = casaW * 2.0, dh = dw;
      this.sombraSuelo(cx, this.sueloY + 2, casaW);
      this.dibujarSprite(spr, cx, this.sueloY, dw, dh, 'suelo', 3);
      // sin servicio: velo gris sobre la casa
      if(seco){
        ctx.fillStyle = 'rgba(30,40,50,0.5)';
        ctx.fillRect(cx - dw / 2, this.sueloY - dh, dw, dh);
      } else {
        const brillo = (1 - this.luz) * 0.5;
        if(brillo > 0.02){ ctx.fillStyle = `rgba(255,224,130,${brillo})`; ctx.fillRect(cx - casaW * 0.14, this.sueloY - dh * 0.42, casaW * 0.28, casaW * 0.28); }
      }
    }
    if(seco) this.burbujaSed(zonaX + zonaW * 0.5, this.sueloY - casaW * 3);
    this.etiqueta(p.nombre, zonaX + zonaW * 0.5, this.sueloY + 16, C.texto, 11);
  }

  /** Signo de "!" que late, para el pueblo mal servido. */
  burbujaSed(cx, y){
    const ctx = this.ctx;
    ctx.globalAlpha = 0.6 + Math.sin(this.tiempo * 4) * 0.4;
    ctx.fillStyle = CONFIG.color.critico;
    ctx.font = 'bold 22px IBM Plex Sans, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('!', cx, y); ctx.globalAlpha = 1;
  }

  /* ---------------- ÁRBOLES ----------------
     Pocos y a los lados, para dar vida sin tapar las estructuras ni competir
     con la vegetación del fondo. Con paisaje de IA no se dibujan (el propio
     paisaje ya trae vegetación y quedaban despegados). */
  arboles(fondo){
    if(this.hayPaisaje()) return;   // el paisaje ya tiene su verde
    super.arboles(fondo);
  }

  /**
   * Dibuja un sprite usando SOLO su caja opaca (recorta márgenes y halos que la
   * IA hornea alrededor del objeto), manteniendo su proporción real dentro de la
   * caja destino (w×h) y anclándolo al suelo ('suelo') o centrado ('centro').
   *
   * `hundir` mete la base ESE tanto por debajo de la línea de suelo, para que el
   * objeto no "flote" (útil sobre todo con las tiles de pueblo, que traen una
   * parcela con canto). Además aplica una "respiración" sutil anclada a la base:
   * da vida al PNG sin despegarlo del suelo.
   */
  dibujarSprite(entrada, cx, anclaY, w, h, ancla, hundir = 0){
    const ctx = this.ctx, img = entrada.img, b = entrada.bbox;
    const rel = b.w / b.h;
    let dw = w, dh = w / rel;
    if(dh > h){ dh = h; dw = h * rel; }
    const baseY = (ancla === 'suelo' ? anclaY : anclaY + dh / 2) + hundir;
    const x = cx - dw / 2, y = baseY - dh;
    // respiración: escala mínima pivotando en la base (fase por posición)
    const fase = cx * 0.013 + (ancla === 'suelo' ? 0 : 1.7);
    const sy = 1 + Math.sin(this.tiempo * 1.5 + fase) * 0.012;
    const sx = 1 - Math.sin(this.tiempo * 1.5 + fase) * 0.006;
    ctx.save();
    ctx.translate(cx, baseY); ctx.scale(sx, sy); ctx.translate(-cx, -baseY);
    ctx.drawImage(img, b.x, b.y, b.w, b.h, x, y, dw, dh);
    ctx.restore();
  }
}

/**
 * Caja delimitadora de los píxeles OPACOS de una imagen (alpha por encima de un
 * umbral, para ignorar halos/sombras suaves). Se calcula una vez al cargar.
 */
function recorteOpaco(img){
  const W = img.naturalWidth, H = img.naturalHeight;
  const lienzo = document.createElement('canvas');
  lienzo.width = W; lienzo.height = H;
  const ctx = lienzo.getContext('2d');
  ctx.drawImage(img, 0, 0);
  let datos;
  try { datos = ctx.getImageData(0, 0, W, H).data; }
  catch(e){ return { x: 0, y: 0, w: W, h: H }; }   // por si acaso
  const UMBRAL = 24;   // alpha mínimo para contar como "objeto"
  let minX = W, minY = H, maxX = 0, maxY = 0, hay = false;
  for(let y = 0; y < H; y++){
    for(let x = 0; x < W; x++){
      if(datos[(y * W + x) * 4 + 3] > UMBRAL){
        hay = true;
        if(x < minX) minX = x; if(x > maxX) maxX = x;
        if(y < minY) minY = y; if(y > maxY) maxY = y;
      }
    }
  }
  if(!hay) return { x: 0, y: 0, w: W, h: H };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
