/**
 * TUTORIAL — la guía de los primeros pasos.
 *
 * Acompaña al jugador hasta que su pueblo bebe por primera vez, y desaparece.
 * No hay botones de "siguiente": cada paso se da por cumplido cuando el jugador
 * lo consigue DE VERDAD en el juego. Así la guía nunca va por delante ni por
 * detrás de lo que está pasando en pantalla.
 *
 * Módulo de lectura pura: mira el estado y dice por dónde va. No lo modifica
 * (salvo avanzar el propio contador, que hace `main.js`).
 */

import { CONFIG } from './config.js';

/**
 * ¿Está cumplido el paso `id`? Una función por paso, en el mismo orden que
 * `CONFIG.tutorial`.
 */
const CUMPLIDO = {
  explorar:  estado => estado.descubiertas > 0,
  bombear:   estado => estado.activo.agua > 0,
  captacion: estado => estado.construcciones.some(o => o.tipo === 'captacion'),
  bomba:     estado => estado.construcciones.some(o => o.tipo === 'bomba'),
  deposito:  estado => estado.construcciones.some(o => o.tipo === 'deposito'),
  // Vale con que algo esté enganchado a la red: es lo que enseña el paso
  tuberia:   estado => Object.keys(estado._conectado || {}).length > 0,
  servido:   estado => estado.activo.servicio > 0.5
};

/** El paso actual, o null si la guía ya terminó. */
export function pasoActual(estado){
  const t = estado.tutorial;
  if(!t || t.terminado) return null;
  return CONFIG.tutorial[t.paso] || null;
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

  estado.tutorial.paso++;
  if(estado.tutorial.paso >= CONFIG.tutorial.length) estado.tutorial.terminado = true;
  return paso;
}

/** Saltarse la guía (botón de la propia guía). */
export function saltar(estado){
  estado.tutorial.terminado = true;
}
