/**
 * TUTORIAL — la guía de los primeros pasos, y los CAPÍTULOS por servicio.
 *
 * Acompaña al jugador hasta que su pueblo bebe por primera vez, y desaparece.
 * No hay botones de "siguiente": cada paso se da por cumplido cuando el jugador
 * lo consigue DE VERDAD en el juego. Así la guía nunca va por delante ni por
 * detrás de lo que está pasando en pantalla.
 *
 * Los CAPÍTULOS (CONFIG.guias) usan el mismo motor: cuando se abre un
 * servicio nuevo (saneamiento, pluviales, residuos), el hito cuenta el porqué
 * y el capítulo enseña el cómo, paso a paso. Su estado vive en `estado.guias`
 * y una partida vieja con el servicio ya abierto no ve su capítulo: llega
 * tarde a enseñar (eso lo decide `cargar()` en estado.js).
 *
 * Módulo de lectura pura: mira el estado y dice por dónde va. No lo modifica
 * (salvo avanzar el propio contador, que hace `main.js`).
 */

import { CONFIG } from './config.js';

/**
 * ¿Está cumplido el paso `id`? Una función por paso — los de la guía inicial
 * y los de los capítulos, en la misma tabla.
 */
const CUMPLIDO = {
  explorar:  estado => estado.descubiertas > 0,
  bombear:   estado => estado.activo.agua > 0,
  captacion: estado => estado.construcciones.some(o => o.tipo === 'captacion'),
  bomba:     estado => estado.construcciones.some(o => o.tipo === 'bomba'),
  deposito:  estado => estado.construcciones.some(o => o.tipo === 'deposito'),
  // La red ENTERA conectada, no cualquier cosa: el recorrido de red arranca
  // del propio pueblo, así que una pieza pegada a él contaba como conectada
  // sin un metro de tubería y este paso se cumplía solo al colocar el
  // depósito — la guía se saltaba sus dos últimos pasos (lo cazó el autor).
  tuberia:   estado => ['captacion', 'bomba', 'deposito']
    .every(tp => ((estado._conectado || {})[tp] || 0) > 0),
  servido:   estado => estado.activo.servicio > 0.5,

  // --- capítulo del saneamiento ---
  sanDepuradora: estado => estado.construcciones.some(o => o.tipo === 'depuradora'),
  sanColector:   estado => (((estado._conectadoRed || {}).saneamiento || {}).depuradora || 0) > 0,
  // --- capítulo de las pluviales ---
  pluRed:    estado => (estado.tuberias || []).some(tb => tb.red === 'pluviales'),
  pluTanque: estado => (((estado._conectadoRed || {}).pluviales || {}).tanque || 0) > 0,
  // --- capítulo de los residuos ---
  resCarretera: estado => (estado.tuberias || []).some(tb => tb.red === 'residuos'),
  resVertedero: estado => (((estado._conectadoRed || {}).residuos || {}).vertedero || 0) > 0,
  resReciclaje: estado => (((estado._conectadoRed || {}).residuos || {}).reciclaje || 0) > 0
};

/* Cuándo está ABIERTO cada capítulo. Lectura directa del estado, sin importar
   simulacion.js: este módulo tiene que seguir siendo una hoja del árbol. */
const CAPITULOS = ['saneamiento', 'pluviales', 'residuos'];
const ABIERTO = {
  saneamiento: e => e.pueblos.some(p => p.servicios?.saneamiento?.activo),
  pluviales:   e => !!e.pluvialesActivas,
  residuos:    e => e.pueblos.some(p => p.servicios?.residuos?.activo)
};

/** El capítulo que toca ahora, o null. Solo tras la guía de primeros pasos. */
function capituloActivo(estado){
  if(!estado.guias) return null;
  for(const c of CAPITULOS){
    const g = estado.guias[c];
    if(g && !g.terminada && ABIERTO[c](estado)) return c;
  }
  return null;
}

/**
 * El paso actual — de la guía inicial o del capítulo que toque — o null.
 * Los pasos de capítulo llevan `capitulo` y `rotulo` (para la cabecera del
 * bocadillo y para que main sepa que el cierre de la guía no es el suyo).
 */
export function pasoActual(estado){
  const t = estado.tutorial;
  if(t && !t.terminado) return CONFIG.tutorial[t.paso] || null;

  const cap = capituloActivo(estado);
  if(!cap) return null;
  const def = CONFIG.guias[cap];
  const paso = def.pasos[estado.guias[cap].paso];
  return paso ? { ...paso, capitulo: cap, rotulo: def.rotulo } : null;
}

/**
 * Avanza la guía si el paso actual ya está cumplido. Devuelve el paso que se
 * acaba de completar (para poder anunciarlo), o null.
 */
export function comprobar(estado){
  const paso = pasoActual(estado);
  if(!paso) return null;
  const test = CUMPLIDO[paso.id];
  if(!test || !test(estado)) return null;

  if(paso.capitulo){
    const g = estado.guias[paso.capitulo];
    g.paso++;
    if(g.paso >= CONFIG.guias[paso.capitulo].pasos.length) g.terminada = true;
  } else {
    estado.tutorial.paso++;
    if(estado.tutorial.paso >= CONFIG.tutorial.length) estado.tutorial.terminado = true;
  }
  return paso;
}

/**
 * Saltar SOLO el paso actual. Nació del muro del probador frío: el paso de
 * la colina lo atascó diez minutos y la única salida era tirar la guía
 * ENTERA — castigar el atasco con perder el manual es lo contrario de
 * enseñar. Vale para la guía inicial y para los capítulos.
 */
export function saltarPaso(estado){
  const paso = pasoActual(estado);
  if(!paso) return;
  if(paso.capitulo){
    const g = estado.guias[paso.capitulo];
    g.paso++;
    if(g.paso >= CONFIG.guias[paso.capitulo].pasos.length) g.terminada = true;
  } else {
    estado.tutorial.paso++;
    if(estado.tutorial.paso >= CONFIG.tutorial.length) estado.tutorial.terminado = true;
  }
}

/** Saltarse la guía (botón de la propia guía): la inicial, o el capítulo. */
export function saltar(estado){
  const t = estado.tutorial;
  if(t && !t.terminado){ t.terminado = true; return; }
  const cap = capituloActivo(estado);
  if(cap) estado.guias[cap].terminada = true;
}
