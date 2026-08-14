/**
 * LEGADO — lo que sobrevive de una comarca a la siguiente.
 *
 * El TRASLADO DE CONCESIÓN es la estructura de partidas del juego: cuando la
 * mancomunidad madura, te ofrecen empezar en otra comarca (otra semilla, otro
 * territorio) llevándote la VETERANÍA — puntos que se gastan en un expediente
 * de ventajas permanentes. La regla que lo mantiene sano: las ventajas quitan
 * FRICCIÓN (explorar, prospectar), nunca multiplican ingresos — así la
 * primera partida no cambia nada y las siguientes van más ligeras sin
 * desequilibrar la economía.
 *
 * Vive en su PROPIA clave de localStorage, fuera del guardado de la partida:
 * tiene que sobrevivir al traslado (que borra la partida). El botón Reiniciar
 * de verdad lo borra todo, legado incluido: "empezar de cero" significa eso.
 *
 * Módulo HOJA como config: solo importa CONFIG, así mapa.js y simulacion.js
 * pueden leerlo sin ciclos.
 */

import { CONFIG } from './config.js';

const CLAVE = 'redHidraulica_legado';

function nuevo(){
  return { comarca: 1, veterania: 0, semillaActual: null, ventajas: {} };
}

export let legado = nuevo();

export function cargarLegado(){
  try{
    const bruto = localStorage.getItem(CLAVE);
    if(bruto) legado = Object.assign(nuevo(), JSON.parse(bruto));
  }catch(e){ legado = nuevo(); }
  return legado;
}

export function guardarLegado(){
  try{ localStorage.setItem(CLAVE, JSON.stringify(legado)); }catch(e){}
}

export function borrarLegado(){
  legado = nuevo();
  try{ localStorage.removeItem(CLAVE); }catch(e){}
}

/** Nivel comprado de una ventaja del expediente (0 si ninguna). */
export function nivelVentaja(clave){
  return (legado.ventajas || {})[clave] || 0;
}

/** Lo que cuesta el siguiente nivel, o null si ya está al máximo. */
export function costeVentaja(clave){
  const def = CONFIG.comarcas.ventajas[clave];
  const nivel = nivelVentaja(clave);
  if(nivel >= def.nivelMax) return null;
  return Math.round(def.costeBase * Math.pow(def.factorCoste, nivel));
}

/** Compra un nivel si hay veteranía. Devuelve si pudo. */
export function comprarVentaja(clave){
  const coste = costeVentaja(clave);
  if(coste == null || legado.veterania < coste) return false;
  legado.veterania -= coste;
  legado.ventajas[clave] = nivelVentaja(clave) + 1;
  guardarLegado();
  return true;
}

/** La región de la comarca actual: nombre y tinte del terreno. Cíclica. */
export function regionActual(){
  const R = CONFIG.comarcas.regiones;
  return R[(legado.comarca - 1) % R.length];
}

/** La época de las estampas del pueblo: comarcas 1, 2 y 3+ (tope en la 3,
 *  que el arte no es infinito). La usa la ficha del pueblo. */
export function epocaActual(){
  return Math.min(legado.comarca, 3);
}
