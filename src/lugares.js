/**
 * LUGARES — los pueblos del jugador, si él quiere.
 *
 * La idea: que los núcleos por descubrir se llamen como los municipios de la
 * comarca de quien juega. Nadie olvida la partida en la que abasteció a su
 * propio pueblo.
 *
 * Las dos reglas de la casa, y son sagradas:
 *   1. SIEMPRE opcional. Se ofrece con un botón, y sin permiso, sin internet o
 *      sin ganas, los nombres inventados de siempre. El juego entero funciona
 *      igual sin esto.
 *   2. La ubicación NO SE GUARDA y solo sale del navegador UNA vez: en la
 *      consulta anónima a OpenStreetMap que pide los nombres. Lo que se guarda
 *      es la lista de nombres, nada más.
 *
 * Es la primera pieza del juego que habla con un servicio externo
 * (overpass-api.de, el buscador de OpenStreetMap): tenerlo aquí encapsulado es
 * lo que mantiene esa dependencia en un solo archivo.
 */

import { CONFIG } from './config.js';

const CLAVE = 'redHidraulica_lugares';
let cache;   // undefined = sin leer aún; null = no hay; array = nombres

/** La lista de nombres de la zona, o null si no se ha activado. */
export function lista(){
  if(cache !== undefined) return cache;
  try{ cache = JSON.parse(localStorage.getItem(CLAVE)); }
  catch(_){ cache = null; }
  if(!Array.isArray(cache) || !cache.length) cache = null;
  return cache;
}

export function activo(){ return !!lista(); }

export function quitar(){
  cache = null;
  localStorage.removeItem(CLAVE);
}

export function guardarNombres(nombres){
  cache = nombres;
  localStorage.setItem(CLAVE, JSON.stringify(nombres));
}

/** Pide la ubicación al navegador. El navegador pregunta al jugador: esa es
 *  la puerta, y no hay otra. */
export function pedirUbicacion(){
  return new Promise((listo, falla) => {
    if(!navigator.geolocation){
      falla(new Error('Este navegador no puede dar la ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      p => listo({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => falla(new Error('Sin permiso de ubicación: se quedan los nombres inventados.')),
      { timeout: 12000, maximumAge: 600000 });
  });
}

/**
 * Pregunta a OpenStreetMap por los pueblos y villas alrededor. Devuelve los
 * nombres ORDENADOS POR CERCANÍA: los más cercanos son los que el jugador
 * reconoce, y por eso deben ser los primeros en aparecer en su partida.
 */
export async function buscarNombres({ lat, lon }){
  const L = CONFIG.lugares;
  const consulta = `[out:json][timeout:15];` +
    `node[place~"^(village|town|hamlet)$"]` +
    `(around:${L.radioKm * 1000},${lat.toFixed(3)},${lon.toFixed(3)});` +
    `out body ${L.maxNombres * 3};`;
  const resp = await fetch(L.servicio, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(consulta)
  });
  if(!resp.ok) throw new Error('El servicio de mapas no responde ahora mismo.');
  const datos = await resp.json();

  const vistos = new Set();
  const cerca = [];
  for(const el of datos.elements || []){
    const nombre = el.tags && el.tags.name;
    if(!nombre || vistos.has(nombre)) continue;
    vistos.add(nombre);
    // Distancia aproximada en el plano; para ordenar por cercanía sobra
    const d = Math.hypot(el.lat - lat, (el.lon - lon) * Math.cos(lat * Math.PI / 180));
    cerca.push({ nombre, d });
  }
  cerca.sort((a, b) => a.d - b.d);
  return cerca.slice(0, L.maxNombres).map(x => x.nombre);
}
