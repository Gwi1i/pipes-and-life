/**
 * DIAGRAMAS — la animación que acompaña a la ficha de cada instalación.
 *
 * Esto NO es el dibujo del mapa. En el mapa se ve la pieza DESDE ARRIBA y lo que
 * importa es reconocerla de un vistazo; aquí se ve EN SECCIÓN y lo que importa es
 * entender por dónde va el agua. Son dos preguntas distintas y por eso son dos
 * dibujos distintos: una vista cenital de un depósito no explica que el agua baja
 * por gravedad, y ese es justo el dato que hay que contar.
 *
 * Son esquemas de manual, a propósito: pocas formas, mucho contraste y una sola
 * cosa moviéndose. Lo que llama la atención no es el detalle, es que ALGO CORRA
 * por dentro — y lo que corre es siempre lo que la pieza le hace al agua.
 *
 * Módulo puro: recibe un contexto, un tamaño y un reloj, y dibuja. No sabe nada
 * del estado del juego ni lo toca.
 */

import { CONFIG } from './config.js';

const AGUA      = '#3d84c6';
const AGUA_CLARA = '#7dc4f0';
const SUCIA     = '#7a6a3a';
const METAL     = '#9aa7b4';
const OBRA      = '#8a8f96';
const TIERRA    = '#6b5b45';
const FONDO     = '#0d1a26';

/** Flecha de dirección: es lo que convierte una tubería en un recorrido. */
function flecha(ctx, x, y, dx, dy, tam, color){
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, tam * 0.22);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
  const ang = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - Math.cos(ang - 0.5) * tam, y + dy - Math.sin(ang - 0.5) * tam);
  ctx.lineTo(x + dx - Math.cos(ang + 0.5) * tam, y + dy - Math.sin(ang + 0.5) * tam);
  ctx.closePath(); ctx.fill();
}

/** Gotas recorriendo un camino. `f` devuelve un punto para 0..1. */
function corriente(ctx, f, t, n, r, color, vel = 1){
  ctx.fillStyle = color;
  for(let i = 0; i < n; i++){
    const q = ((t * vel + i / n) % 1);
    const p = f(q);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
  }
}

function etiqueta(ctx, texto, x, y, color, H){
  ctx.fillStyle = color;
  ctx.font = `600 ${Math.round(H * 0.075)}px IBM Plex Mono, ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(texto, x, y);
  ctx.textAlign = 'left';
}

/* ================================================================
   ILUSTRACIONES DE assets/
   Si existe `assets/f_<pieza>.png` se usa como fondo de la ficha y el esquema
   pasa a dibujarse ENCIMA, solo con lo que se mueve. Si no existe, el esquema se
   dibuja entero él solo.

   Es el mismo apaño que ya se usó con los sprites: nunca hay un hueco vacío y se
   pueden ir añadiendo imágenes de una en una. Y ojo con el orden — la
   ilustración es fija y el movimiento va por código: una foto quieta con el agua
   corriendo por encima queda mejor que un GIF, pesa mil veces menos y no se
   descuadra al cambiar de tamaño.
   ================================================================ */

const CACHE = {};

/** Devuelve la imagen si ya está cargada; la pide la primera vez y sigue. */
function ilustracion(tipo){
  if(CACHE[tipo] !== undefined) return CACHE[tipo] || null;
  CACHE[tipo] = null;                       // marcada como "pedida"
  const img = new Image();
  img.onload = () => { CACHE[tipo] = img; };
  img.onerror = () => { CACHE[tipo] = false; };   // no está, y no se vuelve a pedir
  img.src = `assets/f_${tipo}.png`;
  return null;
}

/**
 * Lo único que se mueve cuando hay ilustración de fondo. Se dibuja aparte del
 * esquema completo porque sobre una foto no hacen falta ni las cajas ni los
 * rótulos: solo el agua yendo de un lado a otro.
 */
const MOVIMIENTO = {
  captacion: (ctx, W, H, t) =>
    corriente(ctx, q => ({ x: W * 0.62 + q * W * 0.38, y: H * 0.66 }), t, 4, W * 0.014, AGUA_CLARA, 0.6),
  bomba: (ctx, W, H, t) =>
    corriente(ctx, q => ({ x: W * 0.70, y: H * 0.80 - q * H * 0.60 }), t, 4, W * 0.014, AGUA_CLARA, 0.7),
  deposito: (ctx, W, H, t) =>
    corriente(ctx, q => ({ x: W * 0.30 + q * W * 0.55, y: H * 0.80 }), t, 5, W * 0.013, AGUA_CLARA, 0.55),
  acuifero: (ctx, W, H, t) =>
    corriente(ctx, q => ({ x: W * 0.48, y: H * 0.86 - q * H * 0.55 }), t, 4, W * 0.013, AGUA_CLARA, 0.5),
  depuradora: (ctx, W, H, t) =>
    corriente(ctx, q => ({ x: W * 0.10 + q * W * 0.82, y: H * 0.82 }), t, 5, W * 0.013, AGUA_CLARA, 0.5),
  tanque: (ctx, W, H, t) => {
    ctx.strokeStyle = AGUA_CLARA; ctx.lineWidth = Math.max(1, W * 0.006);
    for(let i = 0; i < 8; i++){
      const q = ((t * 2.2 + i / 8) % 1);
      const x = W * (0.08 + i * 0.11);
      ctx.beginPath();
      ctx.moveTo(x, q * H * 0.55); ctx.lineTo(x, q * H * 0.55 + H * 0.05); ctx.stroke();
    }
  },
  vertedero: (ctx, W, H, t) =>
    corriente(ctx, q => ({ x: W * 0.50, y: H * 0.80 + q * H * 0.14 }), t, 2, W * 0.010, '#6b6a2a', 0.8),
  reciclaje: (ctx, W, H, t) => {
    const F = CONFIG.residuos.fracciones.filter(f => f.nivel > 0).slice(0, 4);
    for(let i = 0; i < 6; i++){
      const q = ((t * 0.5 + i / 6) % 1);
      ctx.fillStyle = F[i % F.length].color;
      ctx.fillRect(W * (0.10 + q * 0.62), H * 0.52, W * 0.020, H * 0.045);
    }
  }
};

/* ================================================================
   UN DIAGRAMA POR PIEZA
   ================================================================ */

const DIBUJOS = {

  /** El río, la reja que para lo que baja, y el agua que entra al sistema. */
  captacion(ctx, W, H, t){
    const nivel = H * 0.52;
    ctx.fillStyle = AGUA;
    ctx.fillRect(0, nivel, W * 0.62, H - nivel);
    // superficie ondulada
    ctx.fillStyle = AGUA_CLARA;
    ctx.beginPath();
    for(let x = 0; x <= W * 0.62; x += 4)
      ctx.lineTo(x, nivel + Math.sin(x * 0.06 + t * 3) * H * 0.012);
    ctx.lineTo(W * 0.62, nivel + 4); ctx.lineTo(0, nivel + 4);
    ctx.fill();

    // lo que baja flotando y la reja que lo para
    ctx.fillStyle = '#6b4f2a';
    for(let i = 0; i < 3; i++){
      const q = ((t * 0.35 + i / 3) % 1);
      const x = q * W * 0.42;
      ctx.fillRect(x, nivel - H * 0.045, W * 0.05, H * 0.028);
    }
    ctx.strokeStyle = METAL; ctx.lineWidth = Math.max(1.5, W * 0.008);
    for(let i = 0; i < 5; i++){
      const x = W * 0.44 + i * W * 0.018;
      ctx.beginPath(); ctx.moveTo(x, nivel - H * 0.10); ctx.lineTo(x, H * 0.86); ctx.stroke();
    }
    etiqueta(ctx, 'REJA', W * 0.48, nivel - H * 0.16, METAL, H);

    // la obra de toma y la tubería de salida
    ctx.fillStyle = OBRA;
    ctx.fillRect(W * 0.60, nivel - H * 0.22, W * 0.16, H * 0.50);
    ctx.fillStyle = FONDO;
    ctx.fillRect(W * 0.64, nivel - H * 0.10, W * 0.08, H * 0.30);
    ctx.fillStyle = OBRA;
    ctx.fillRect(W * 0.76, H * 0.60, W * 0.24, H * 0.10);
    corriente(ctx, q => ({ x: W * 0.62 + q * W * 0.38, y: H * 0.65 }),
              t, 4, W * 0.016, AGUA_CLARA, 0.6);
    flecha(ctx, W * 0.80, H * 0.42, W * 0.14, 0, W * 0.03, AGUA_CLARA);
    etiqueta(ctx, 'AGUA BRUTA', W * 0.80, H * 0.32, AGUA_CLARA, H);
  },

  /** Lo que hace una bomba: dar altura. Se ve subir el agua. */
  bomba(ctx, W, H, t){
    ctx.fillStyle = OBRA;
    ctx.fillRect(0, H * 0.72, W * 0.34, H * 0.08);          // llegada baja
    ctx.fillRect(W * 0.62, H * 0.08, W * 0.10, H * 0.66);   // impulsión vertical
    ctx.fillRect(W * 0.62, H * 0.08, W * 0.38, H * 0.08);   // hacia el depósito

    // el grupo motobomba
    ctx.fillStyle = METAL;
    ctx.fillRect(W * 0.34, H * 0.62, W * 0.28, H * 0.22);
    ctx.fillStyle = '#2b3948';
    ctx.beginPath(); ctx.arc(W * 0.48, H * 0.73, H * 0.075, 0, 7); ctx.fill();
    // el rodete girando: lo único que se mueve dentro de la caja
    ctx.strokeStyle = AGUA_CLARA; ctx.lineWidth = Math.max(1.5, W * 0.012);
    for(let i = 0; i < 4; i++){
      const a = t * 7 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(W * 0.48, H * 0.73);
      ctx.lineTo(W * 0.48 + Math.cos(a) * H * 0.06, H * 0.73 + Math.sin(a) * H * 0.06);
      ctx.stroke();
    }

    // el agua entra por abajo y SUBE
    corriente(ctx, q => ({ x: q * W * 0.34, y: H * 0.76 }), t, 3, W * 0.016, AGUA, 0.5);
    corriente(ctx, q => ({ x: W * 0.67, y: H * 0.74 - q * H * 0.62 }),
              t, 4, W * 0.016, AGUA_CLARA, 0.7);
    flecha(ctx, W * 0.80, H * 0.30, 0, -H * 0.14, W * 0.03, AGUA_CLARA);
    etiqueta(ctx, 'ALTURA', W * 0.86, H * 0.40, AGUA_CLARA, H);
  },

  /** La altura ES la presión: el agua baja sola hasta las casas. */
  deposito(ctx, W, H, t){
    // el vaso, llenándose y vaciándose despacio
    const lleno = 0.45 + Math.sin(t * 0.8) * 0.28;
    ctx.strokeStyle = OBRA; ctx.lineWidth = Math.max(2, W * 0.012);
    ctx.strokeRect(W * 0.10, H * 0.14, W * 0.34, H * 0.30);
    ctx.fillStyle = AGUA;
    const alto = H * 0.30 * lleno;
    ctx.fillRect(W * 0.10, H * 0.44 - alto, W * 0.34, alto);
    ctx.fillStyle = AGUA_CLARA;
    ctx.fillRect(W * 0.10, H * 0.44 - alto, W * 0.34, Math.min(alto, H * 0.012));
    // patas
    ctx.fillStyle = OBRA;
    ctx.fillRect(W * 0.14, H * 0.44, W * 0.03, H * 0.16);
    ctx.fillRect(W * 0.37, H * 0.44, W * 0.03, H * 0.16);

    // la cota, que es de lo que va todo esto
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.46, H * 0.30); ctx.lineTo(W * 0.46, H * 0.80);
    ctx.stroke(); ctx.setLineDash([]);
    etiqueta(ctx, 'ALTURA = PRESIÓN', W * 0.62, H * 0.24, AGUA_CLARA, H);

    // la conducción baja y llega a la casa
    ctx.fillStyle = OBRA;
    ctx.fillRect(W * 0.26, H * 0.60, W * 0.06, H * 0.20);
    ctx.fillRect(W * 0.26, H * 0.76, W * 0.46, H * 0.06);
    corriente(ctx, q => q < 0.4
      ? { x: W * 0.29, y: H * 0.60 + q / 0.4 * H * 0.19 }
      : { x: W * 0.29 + (q - 0.4) / 0.6 * W * 0.42, y: H * 0.79 },
      t, 5, W * 0.015, AGUA_CLARA, 0.55);

    // la casa
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(W * 0.74, H * 0.60, W * 0.18, H * 0.20);
    ctx.fillStyle = '#b4442a';
    ctx.beginPath();
    ctx.moveTo(W * 0.71, H * 0.60); ctx.lineTo(W * 0.83, H * 0.50);
    ctx.lineTo(W * 0.95, H * 0.60); ctx.closePath(); ctx.fill();
  },

  /** El pozo: capas, el filtro a la altura del acuífero y el agua subiendo. */
  acuifero(ctx, W, H, t){
    const capas = [['#7d6b4c', 0.30], ['#8f8271', 0.14], ['#5f6b74', 0.16], ['#3f5a6b', 0.40]];
    let y = H * 0.24;
    for(const [col, alto] of capas){
      ctx.fillStyle = col;
      ctx.fillRect(0, y, W, H * alto * 0.76);
      y += H * alto * 0.76;
    }
    // el acuífero, la capa de abajo, con su agua
    ctx.fillStyle = 'rgba(61,132,198,0.55)';
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
    etiqueta(ctx, 'ACUÍFERO', W * 0.72, H * 0.88, AGUA_CLARA, H);

    // la perforación
    ctx.fillStyle = FONDO;
    ctx.fillRect(W * 0.42, H * 0.14, W * 0.10, H * 0.72);
    ctx.strokeStyle = METAL; ctx.lineWidth = Math.max(1.5, W * 0.010);
    ctx.strokeRect(W * 0.42, H * 0.14, W * 0.10, H * 0.72);
    // filtro: solo a la altura del acuífero
    ctx.strokeStyle = AGUA_CLARA;
    for(let i = 0; i < 5; i++){
      const yy = H * 0.74 + i * H * 0.035;
      ctx.beginPath();
      ctx.moveTo(W * 0.42, yy); ctx.lineTo(W * 0.52, yy); ctx.stroke();
    }
    // el agua sube por dentro
    corriente(ctx, q => ({ x: W * 0.47, y: H * 0.84 - q * H * 0.68 }),
              t, 4, W * 0.015, AGUA_CLARA, 0.5);
    flecha(ctx, W * 0.47, H * 0.24, 0, -H * 0.10, W * 0.028, AGUA_CLARA);
    // castillete
    ctx.strokeStyle = METAL; ctx.lineWidth = Math.max(1.5, W * 0.012);
    ctx.beginPath();
    ctx.moveTo(W * 0.36, H * 0.14); ctx.lineTo(W * 0.47, H * 0.03);
    ctx.lineTo(W * 0.58, H * 0.14); ctx.stroke();
  },

  /** Las tres etapas de una EDAR, de izquierda a derecha, y el agua limpiándose. */
  depuradora(ctx, W, H, t){
    const yb = H * 0.56;
    // el agua va cambiando de color de etapa en etapa
    const tramos = [
      { x0: 0.00, x1: 0.26, col: SUCIA,  txt: 'DESBASTE' },
      { x0: 0.30, x1: 0.60, col: '#6b7a4a', txt: 'DECANTA' },
      { x0: 0.64, x1: 0.90, col: '#4f8a6a', txt: 'BIOLÓGICO' }
    ];
    for(const tr of tramos){
      ctx.fillStyle = tr.col;
      ctx.fillRect(W * tr.x0, yb, W * (tr.x1 - tr.x0), H * 0.22);
      ctx.strokeStyle = OBRA; ctx.lineWidth = Math.max(1.5, W * 0.008);
      ctx.strokeRect(W * tr.x0, yb, W * (tr.x1 - tr.x0), H * 0.22);
      etiqueta(ctx, tr.txt, W * (tr.x0 + tr.x1) / 2, yb - H * 0.05, OBRA, H);
    }
    // rejas del desbaste
    ctx.strokeStyle = METAL; ctx.lineWidth = Math.max(1, W * 0.006);
    for(let i = 0; i < 4; i++){
      const x = W * (0.06 + i * 0.05);
      ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x, yb + H * 0.22); ctx.stroke();
    }
    // el puente del decantador, girando
    const cx = W * 0.45, cy = yb + H * 0.11;
    ctx.strokeStyle = METAL; ctx.lineWidth = Math.max(1.5, W * 0.010);
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(t * 1.2) * W * 0.13, cy - Math.sin(t * 1.2) * H * 0.09);
    ctx.lineTo(cx + Math.cos(t * 1.2) * W * 0.13, cy + Math.sin(t * 1.2) * H * 0.09);
    ctx.stroke();
    // burbujas del biológico: son las bacterias trabajando
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for(let i = 0; i < 7; i++){
      const q = ((t * 0.9 + i / 7) % 1);
      ctx.beginPath();
      ctx.arc(W * (0.67 + (i % 4) * 0.055), yb + H * 0.22 - q * H * 0.20,
              W * 0.010, 0, 7);
      ctx.fill();
    }
    // sale al río
    ctx.fillStyle = AGUA;
    ctx.fillRect(W * 0.90, yb + H * 0.08, W * 0.10, H * 0.14);
    corriente(ctx, q => ({ x: W * 0.86 + q * W * 0.14, y: yb + H * 0.14 }),
              t, 3, W * 0.013, AGUA_CLARA, 0.8);
    etiqueta(ctx, 'AL RÍO', W * 0.93, yb - H * 0.05, AGUA_CLARA, H);
  },

  /** El primer lavado: llega de golpe, se retiene y se suelta despacio. */
  tanque(ctx, W, H, t){
    const ciclo = (t * 0.35) % 1;
    const lloviendo = ciclo < 0.35;

    // nube y lluvia solo en la primera parte del ciclo
    ctx.fillStyle = lloviendo ? '#5b6b7a' : '#3a4652';
    ctx.beginPath();
    ctx.ellipse(W * 0.24, H * 0.14, W * 0.16, H * 0.07, 0, 0, 7); ctx.fill();
    if(lloviendo){
      ctx.strokeStyle = AGUA_CLARA; ctx.lineWidth = Math.max(1, W * 0.007);
      for(let i = 0; i < 6; i++){
        const q = ((t * 2.5 + i / 6) % 1);
        const x = W * (0.13 + i * 0.045);
        ctx.beginPath();
        ctx.moveTo(x, H * 0.20 + q * H * 0.14);
        ctx.lineTo(x, H * 0.24 + q * H * 0.14); ctx.stroke();
      }
    }

    // el colector y el tanque
    ctx.fillStyle = OBRA;
    ctx.fillRect(0, H * 0.40, W, H * 0.07);
    ctx.strokeStyle = OBRA; ctx.lineWidth = Math.max(2, W * 0.012);
    ctx.strokeRect(W * 0.28, H * 0.50, W * 0.34, H * 0.34);

    // se llena de golpe y se vacía despacio: esa asimetría ES la pieza
    const lleno = lloviendo ? ciclo / 0.35 : Math.max(0, 1 - (ciclo - 0.35) / 0.65);
    const alto = H * 0.34 * lleno;
    ctx.fillStyle = SUCIA;
    ctx.fillRect(W * 0.28, H * 0.84 - alto, W * 0.34, alto);
    etiqueta(ctx, lloviendo ? 'RETIENE' : 'SUELTA DESPACIO',
             W * 0.45, H * 0.94, lloviendo ? CONFIG.color.alarma : AGUA_CLARA, H);

    // salida hacia la depuradora
    ctx.fillStyle = OBRA;
    ctx.fillRect(W * 0.62, H * 0.74, W * 0.30, H * 0.06);
    corriente(ctx, q => ({ x: W * 0.62 + q * W * 0.30, y: H * 0.77 }),
              t, 3, W * 0.012, SUCIA, lloviendo ? 0.25 : 0.7);
  },

  /** No es un agujero: es un vaso impermeabilizado que recoge su lixiviado. */
  vertedero(ctx, W, H, t){
    ctx.fillStyle = TIERRA;
    ctx.fillRect(0, H * 0.34, W, H * 0.66);
    // el vaso excavado
    ctx.fillStyle = '#4a3f2f';
    ctx.beginPath();
    ctx.moveTo(W * 0.10, H * 0.40); ctx.lineTo(W * 0.22, H * 0.84);
    ctx.lineTo(W * 0.78, H * 0.84); ctx.lineTo(W * 0.90, H * 0.40);
    ctx.closePath(); ctx.fill();
    // LA LÁMINA impermeable, que es lo que lo hace controlado
    ctx.strokeStyle = '#2f3a44'; ctx.lineWidth = Math.max(2.5, W * 0.016);
    ctx.beginPath();
    ctx.moveTo(W * 0.10, H * 0.40); ctx.lineTo(W * 0.22, H * 0.84);
    ctx.lineTo(W * 0.78, H * 0.84); ctx.lineTo(W * 0.90, H * 0.40);
    ctx.stroke();
    etiqueta(ctx, 'LÁMINA IMPERMEABLE', W * 0.50, H * 0.95, '#8a97a4', H);

    // capas de residuo que van subiendo
    const capas = 4;
    for(let i = 0; i < capas; i++){
      const q = Math.min(1, Math.max(0, (t * 0.25 % 1) * capas - i));
      if(q <= 0) continue;
      ctx.fillStyle = i % 2 ? '#7b6a52' : '#8f8264';
      const y = H * (0.80 - i * 0.10);
      ctx.fillRect(W * (0.25 + i * 0.015), y - H * 0.09 * q,
                   W * (0.50 - i * 0.03), H * 0.09 * q);
    }
    // el lixiviado, goteando al dren
    corriente(ctx, q => ({ x: W * 0.50, y: H * 0.84 + q * H * 0.08 }),
              t, 2, W * 0.010, '#6b6a2a', 0.8);
    ctx.fillStyle = '#6b6a2a';
    ctx.fillRect(W * 0.46, H * 0.90, W * 0.08, H * 0.05);
    etiqueta(ctx, 'LIXIVIADO', W * 0.72, H * 0.30, '#a8a34a', H);
  },

  /** La cinta que separa: entra mezclado y sale en fracciones. */
  reciclaje(ctx, W, H, t){
    // la cinta
    ctx.fillStyle = '#39424c';
    ctx.fillRect(W * 0.04, H * 0.46, W * 0.62, H * 0.09);
    ctx.strokeStyle = '#5b6672'; ctx.lineWidth = Math.max(1, W * 0.006);
    for(let i = 0; i < 8; i++){
      const x = W * 0.04 + (((t * 0.5 + i / 8) % 1) * W * 0.62);
      ctx.beginPath();
      ctx.moveTo(x, H * 0.46); ctx.lineTo(x, H * 0.55); ctx.stroke();
    }
    etiqueta(ctx, 'TRIAJE', W * 0.34, H * 0.40, OBRA, H);

    // lo que entra: mezclado. Lo que sale: cada cosa a su sitio.
    const F = CONFIG.residuos.fracciones.filter(f => f.nivel > 0).slice(0, 4);
    for(let i = 0; i < 8; i++){
      const q = ((t * 0.5 + i / 8) % 1);
      const f = F[i % F.length];
      const x = W * 0.04 + q * W * 0.62;
      ctx.fillStyle = q < 0.55 ? '#8a8f96' : f.color;   // se identifica a mitad
      ctx.fillRect(x, H * 0.40, W * 0.022, H * 0.05);
    }
    // los contenedores de salida
    for(let i = 0; i < F.length; i++){
      const x = W * (0.68 + i * 0.08);
      ctx.fillStyle = F[i].color;
      ctx.fillRect(x, H * 0.60, W * 0.06, H * 0.22);
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(x, H * 0.60, W * 0.06, H * 0.03);
    }
    etiqueta(ctx, 'SE VENDE', W * 0.82, H * 0.92, CONFIG.color.dinero, H);
  }
};

/**
 * Dibuja el diagrama de `tipo`. `t` es un reloj en segundos: el mismo dibujo con
 * distinto `t` es el siguiente fotograma, así que quien llame decide el ritmo.
 */
export function dibujarDiagrama(ctx, tipo, W, H, t){
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, W, H);

  const img = ilustracion(tipo);
  ctx.save();
  if(img){
    // La ilustración manda: se dibuja cubriendo el lienzo sin deformarla, y
    // encima solo va lo que se mueve.
    const escala = Math.max(W / img.width, H / img.height);
    const an = img.width * escala, al = img.height * escala;
    ctx.drawImage(img, (W - an) / 2, (H - al) / 2, an, al);
    const mov = MOVIMIENTO[tipo];
    if(mov) mov(ctx, W, H, t);
  } else {
    const fn = DIBUJOS[tipo];
    if(!fn){ ctx.restore(); return false; }
    fn(ctx, W, H, t);
  }
  ctx.restore();
  return true;
}

/** ¿Hay diagrama para esta pieza? Lo usa la UI para no dejar un hueco vacío. */
export function hayDiagrama(tipo){ return !!DIBUJOS[tipo]; }
