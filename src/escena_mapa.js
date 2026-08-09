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
         puedeSeguirTrazado, costeTrazado, costeCasillaTuberia } from './mapa.js';
import { poderExpansion } from './simulacion.js';
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

  /** Centra la cámara en el pueblo de origen (solo la primera vez). */
  centrarEnOrigen(estado){
    const M = CONFIG.mapaMundo, t = this.tam;
    estado.camara.x = M.origen.col * t + t / 2 - this.ancho / 2;
    estado.camara.y = M.origen.fila * t + t / 2 - this.alto / 2;
    this.limitarCamara(estado);
    this.centrada = true;
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

    this.dibujarTuberias(estado);
    this.dibujarConstrucciones(estado);
    this.previsualizar(estado);
    this.marcoResaltado(estado);
    this.velosDeAmbiente();
    this.dibujarOperario();
    this.destellosClic();
  }

  /* ---------- casilla descubierta ---------- */
  dibujarTerreno(celda, c, f, x, y, t){
    const ctx = this.ctx;
    const def = CONFIG.terrenos[celda.tipo] || CONFIG.terrenos.hierba;
    const v = ruido(c, f);

    // color base con variación por celda, para que no parezca papel pintado
    ctx.fillStyle = mezclarColor(def.color, v > 0.5 ? '#ffffff' : '#000000',
                                 Math.abs(v - 0.5) * 0.16);
    ctx.fillRect(x, y, t, t);

    if(celda.tipo === 'agua' || celda.tipo === 'lago'){
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.5;
      for(let k = 0; k < 2; k++){
        const yy = y + t * (0.34 + k * 0.32);
        ctx.beginPath();
        for(let xx = x; xx <= x + t; xx += 7){
          ctx.lineTo(xx, yy + Math.sin(xx * 0.08 + this.tiempo * 2 + k) * 2);
        }
        ctx.stroke();
      }
    } else if(celda.tipo === 'bosque'){
      ctx.fillStyle = oscurecer(def.color, 0.35);
      for(const [dx, dy, r] of [[0.3, 0.42, 0.12], [0.58, 0.3, 0.1], [0.46, 0.64, 0.11]]){
        ctx.beginPath(); ctx.arc(x + t * dx, y + t * dy, t * r, 0, 7); ctx.fill();
      }
    } else if(celda.tipo === 'montana'){
      ctx.fillStyle = aclarar(def.color, 0.22);
      ctx.beginPath();
      ctx.moveTo(x + t * 0.2, y + t * 0.72); ctx.lineTo(x + t * 0.48, y + t * 0.26);
      ctx.lineTo(x + t * 0.76, y + t * 0.72); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8eef4';
      ctx.beginPath();
      ctx.moveTo(x + t * 0.40, y + t * 0.38); ctx.lineTo(x + t * 0.48, y + t * 0.26);
      ctx.lineTo(x + t * 0.56, y + t * 0.38); ctx.closePath(); ctx.fill();
    }

    if(celda.hallazgo) this.dibujarHallazgo(celda, x, y, t);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, t, t);
  }

  /* ---------- lo que esconde una casilla ---------- */
  dibujarHallazgo(celda, x, y, t){
    const ctx = this.ctx;
    const col = CONFIG.hallazgos.color[celda.hallazgo] || '#ffffff';
    const cx = x + t / 2, cy = y + t / 2;

    if(!celda.resuelto){   // aún por atender: late para que se vea
      const pulso = 0.5 + Math.sin(this.tiempo * 3) * 0.5;
      ctx.globalAlpha = 0.25 + pulso * 0.35;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(cx, cy, t * 0.42, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

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
  }

  /* ---------- casilla tapada ---------- */
  dibujarNiebla(estado, celda, c, f, x, y, t){
    const ctx = this.ctx;
    const alcanzable = esAlcanzable(estado.mapa, c, f);

    ctx.fillStyle = alcanzable ? '#243244' : '#141d28';
    ctx.fillRect(x, y, t, t);
    // textura de niebla, para que no sea un plano liso
    const v = ruido(c, f);
    ctx.fillStyle = `rgba(255,255,255,${0.02 + v * 0.03})`;
    ctx.fillRect(x, y, t, t);

    if(alcanzable){
      const faltan = clicsParaDestapar(c, f, celda.tipo, this.poder);
      const frac = celda.progreso / faltan;

      if(frac > 0){   // aro de progreso
        const r = t * 0.3;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = Math.max(3, t * 0.07);
        ctx.beginPath(); ctx.arc(x + t / 2, y + t / 2, r, 0, 7); ctx.stroke();
        ctx.strokeStyle = CONFIG.color.agua;
        ctx.beginPath();
        ctx.arc(x + t / 2, y + t / 2, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.stroke();
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
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, t, t);
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
      ctx.strokeStyle = '#1b2836'; ctx.lineWidth = Math.max(4, t * 0.16);
      this.trazo(pts);
      ctx.strokeStyle = CONFIG.color.agua; ctx.lineWidth = Math.max(2, t * 0.09);
      this.trazo(pts);
      // gotas viajando, para que se vea que lleva agua
      ctx.fillStyle = '#bae6fd';
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
  dibujarConstrucciones(estado){
    const ctx = this.ctx, t = this.tam;
    for(const obra of estado.construcciones){
      const x = obra.col * t - estado.camara.x, y = obra.fila * t - estado.camara.y;
      if(x < -t || y < -t || x > this._W || y > this._H) continue;
      const def = CONFIG.construibles[obra.tipo];
      const lado = t * 0.7;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(x + t / 2, y + t * 0.82, lado * 0.4, lado * 0.14, 0, 0, 7); ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + (t - lado) / 2, y + (t - lado) / 2, lado, lado, lado * 0.2);
      ctx.fillStyle = 'rgba(12,22,34,0.9)'; ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth = 2.5; ctx.stroke();
      // inicial de la pieza, hasta que haya arte
      ctx.fillStyle = def.color;
      ctx.font = `700 ${Math.round(t * 0.3)}px IBM Plex Mono, ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.nombre[0], x + t / 2, y + t / 2);
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
        ctx.strokeStyle = CONFIG.color.agua; ctx.lineWidth = Math.max(2, t * 0.10);
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

      const total = costeTrazado(estado.mapa, trazado);
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
        this.cartel(`+${formatear(costeCasillaTuberia(celda))} € (${obra}) · total ${formatear(total)} €`,
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
