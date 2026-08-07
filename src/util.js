/**
 * UTIL — funciones auxiliares sin estado.
 *
 * Nada de aquí sabe qué es el juego. Son herramientas puras: entra un valor,
 * sale otro. Por eso se pueden probar de forma aislada y reutilizar en
 * cualquier proyecto.
 */

/* ---------- ALEATORIEDAD REPRODUCIBLE ----------
   Math.random() no sirve para generar terreno: cada recarga daría un mapa
   distinto y sería imposible depurar. Con un generador sembrado, la misma
   semilla produce siempre exactamente el mismo mundo. */
export function generadorAleatorio(semilla){
  let a = semilla >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- MATEMÁTICAS ---------- */
export const limitar = (v, min, max) => v < min ? min : (v > max ? max : v);
export const interpolar = (a, b, t) => a + (b - a) * t;

/** Suavizado de Hermite: quita las esquinas de una interpolación lineal. */
export const suavizar = t => t * t * (3 - 2 * t);

export const distancia = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/** Reescala un valor de un rango a otro, recortando a [0,1]. */
export const normalizar = (v, min, max) => limitar((v - min) / (max - min), 0, 1);

/* ---------- COLOR ---------- */
/** Devuelve un color de una rampa definida por paradas {t, c:[r,g,b]}. */
export function colorDeRampa(rampa, t){
  t = limitar(t, 0, 1);
  for(let i = 0; i < rampa.length - 1; i++){
    const a = rampa[i], b = rampa[i + 1];
    if(t >= a.t && t <= b.t){
      const k = (t - a.t) / (b.t - a.t);
      return [
        Math.round(interpolar(a.c[0], b.c[0], k)),
        Math.round(interpolar(a.c[1], b.c[1], k)),
        Math.round(interpolar(a.c[2], b.c[2], k))
      ];
    }
  }
  return rampa[rampa.length - 1].c;
}

export const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

/* ---------- FORMATO ---------- */
const SUFIJOS = ['', 'K', 'M', 'MM', 'B'];

export function formatear(n, decimales = 1){
  if(!isFinite(n)) return '—';
  const neg = n < 0; n = Math.abs(n);
  if(n < 1000) return (neg ? '-' : '') + n.toFixed(n < 10 ? decimales : 0);
  let i = 0;
  while(n >= 1000 && i < SUFIJOS.length - 1){ n /= 1000; i++; }
  return (neg ? '-' : '') + n.toFixed(2) + SUFIJOS[i];
}

export const formatearMetros = m => m.toFixed(0) + ' m';
export const formatearCaudal = q => q.toFixed(2) + ' L/s';

/* ---------- GEOMETRÍA ---------- */
/**
 * Distancia de un punto al segmento AB. Se usa para detectar clics sobre
 * tuberías, que son segmentos y no puntos.
 */
export function distanciaASegmento(px, py, ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  if(largo2 === 0) return distancia(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / largo2;
  t = limitar(t, 0, 1);
  return distancia(px, py, ax + t * dx, ay + t * dy);
}
