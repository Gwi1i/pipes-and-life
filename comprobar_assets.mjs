/**
 * EL BARRIDO DE LÁMINAS — ¿referencia el código alguna imagen que no existe?
 *
 * Nació de una caza del autor (16/08/2026): las tarjetas de primera vez
 * salían sin imagen porque buscaban h_arqueologia.jpg y compañía, que nunca
 * se generaron. El fallo es de una clase barrible a máquina: el código monta
 * rutas de assets a partir de CONFIG, y si el archivo falta no peta nada —
 * el onerror lo esconde y el hueco solo se ve cuando ese momento llega
 * jugando. Este módulo expande las rutas posibles y las comprueba todas.
 *
 * Desde la consola del juego:
 *   (await import('/comprobar_assets.mjs')).comprobar()
 *
 * Solo comprueba lo OBLIGATORIO: imágenes cuya ausencia deja cojo un momento
 * diseñado (tarjetas de hito y logro, fichas de yacimiento, ruina y caserío).
 * Quedan fuera a propósito las opcionales por diseño: música y voz (el juego
 * suena igual sin ellas), las estampas de minijuego (res_, cam_ y cont_: los
 * minijuegos filtran por existencia), las épocas _e2 y _e3 (caen a la estampa
 * base) y guia_bien/mal (la cara de Manuel solo sale si existe).
 */

import { CONFIG } from './src/config.js';

export async function comprobar(){
  const rutas = [];

  // Tarjetas de hito y logro. OJO: arqueologia, ruina y crecimiento van con
  // la lámina del hallazgo concreto (estado.hitoImagen) y su genérica no
  // hace falta — se saltan aquí para no pedir arte que no se usa.
  const conLamina = ['arqueologia', 'ruina', 'crecimiento'];
  for(const [id, h] of Object.entries(CONFIG.hitos))
    if(!conLamina.includes(id))
      rutas.push(`assets/${h.logro ? 'l' : 'h'}_${id}.jpg`);

  for(const tp of CONFIG.arqueologia.tipos) rutas.push(`assets/a_${tp.id}.jpg`);
  for(const p of new Set(CONFIG.hallazgos.piezasRuina))
    rutas.push(`assets/f_${p}_ruina.jpg`);
  for(const esc of CONFIG.caserio.escalones) rutas.push(`assets/f_${esc.nombre}.jpg`);

  const faltan = [];
  for(const ruta of rutas){
    const r = await fetch(ruta, { method: 'HEAD' }).catch(() => null);
    if(!r || !r.ok) faltan.push(ruta);
  }
  if(faltan.length){
    console.warn(`FALTAN ${faltan.length} de ${rutas.length}:`);
    for(const f of faltan) console.warn('  ' + f);
  }else{
    console.log(`Las ${rutas.length} láminas obligatorias existen.`);
  }
  return faltan;
}
