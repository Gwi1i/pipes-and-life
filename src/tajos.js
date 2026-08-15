/**
 * LOS TAJOS — el capataz que marca el siguiente paso.
 *
 * La carta "AHORA" del lateral: entre el final de la guía y el primer
 * traslado, siempre hay UN paso siguiente mascado. Este módulo decide cuál:
 * recorre la cadena de CONFIG.tajos en orden y devuelve el primero
 * PENDIENTE — el orden es la prioridad, como en los comentarios de Manuel.
 *
 * Lectura pura, como tutorial.js y comentarios.js: mira el estado y contesta.
 * Quién pinta la tarjeta es ui.js; qué hace su botón, main.js ('irTajo').
 *
 * La regla del cierre: TODO esto desaparece en la comarca 2 (petición del
 * autor: el muro es llegar al primer traslado; quien ya se trasladó no
 * necesita capataz). Y nunca pisa a la guía de primeros pasos.
 */

import { CONFIG } from './config.js';
import { servicioActivo, faseActual, capacidadPotabilizacion } from './simulacion.js';
import { cuelloDeBotella, nivelDiametro, casillaEnRed } from './mapa.js';
import { legado } from './legado.js';

/** Recorre las celdas del mapa llamando fn(celda, col, fila); corta si fn
 *  devuelve true. Devuelve la celda que cortó, o null. */
function buscarCelda(estado, fn){
  const M = CONFIG.mapaMundo;
  for(let i = 0; i < estado.mapa.length; i++){
    const celda = estado.mapa[i];
    if(celda && fn(celda, i % M.cols, Math.floor(i / M.cols)))
      return { celda, col: i % M.cols, fila: Math.floor(i / M.cols) };
  }
  return null;
}

/** Un pueblo descubierto y aún sin incorporar (el objetivo natural). */
export function vecinoPendiente(estado){
  return buscarCelda(estado, c => c.hallazgo === 'pueblo' && !c.oculta && !c.resuelto);
}

/* Cada condición contesta: ¿este tajo está PENDIENTE ahora mismo? Si la
   mecánica aún no ha nacido (el servicio no está abierto), no está pendiente
   y la cadena lo salta — la carta nunca pide lo que el juego aún no da. */
const PENDIENTE = {

  mejora: (e) => e.pueblos[0].mejoras.bomba + e.pueblos[0].mejoras.deposito < 1,

  vecino: (e) => !vecinoPendiente(e),

  conectar: (e) => {
    const v = vecinoPendiente(e);
    return !!v && !casillaEnRed(e, v.col, v.fila, 'abastecimiento');
  },

  canon: (e) => e.pueblos.length < 2,

  depuradora: (e) =>
    e.pueblos.some(p => p.desbloqueado && servicioActivo(p, 'saneamiento'))
    && !(e._conectadoRed && e._conectadoRed.saneamiento
         && e._conectadoRed.saneamiento.depuradora),

  calibre: (e) => {
    const cuello = cuelloDeBotella(e, 'abastecimiento');
    if(nivelDiametro(cuello.dn, 'abastecimiento') > 0) return false;
    return e.pueblos.some(p => p.desbloqueado
      && p.habitantes >= cuello.def.habitantesMax * 0.9);
  },

  tercero: (e) => e.pueblos.length < CONFIG.pluviales.abreConPueblos,

  pluviales: (e) => e.pluvialesActivas
    && !e.pueblos.some(p => p.mejoras.pluviales > 0)
    && !(e.tuberias || []).some(tb => tb.red === 'pluviales'),

  residuos: (e) =>
    e.pueblos.some(p => p.desbloqueado && servicioActivo(p, 'residuos'))
    && !(e._conectadoRed && e._conectadoRed.residuos
         && e._conectadoRed.residuos.vertedero),

  reciclaje: (e) =>
    !!(e._conectadoRed && e._conectadoRed.residuos
       && e._conectadoRed.residuos.vertedero)
    && !(e._conectadoRed.residuos.reciclaje)
    && !e.pueblos.some(p => p.mejoras.reciclaje > 0),

  potabilizadora: (e, res) => !!res
    && (res.aguaBrutaLh || 0) > (res.aguaTrataLh || 0) + 1
    && capacidadPotabilizacion(e) <= 0,

  fase2: (e) => faseActual(e) < 2,

  fase3: (e) => faseActual(e) < 3,

  traslado: (e) => faseActual(e) >= CONFIG.comarcas.faseParaTrasladarse
};

/**
 * El tajo que toca AHORA, o null (guía en marcha, comarca 2, o nada
 * pendiente). Devuelve la entrada de CONFIG.tajos tal cual.
 */
export function tajoActual(estado, resultado){
  if(!estado.tutorial || !estado.tutorial.terminado) return null;
  if(legado.comarca > 1) return null;
  for(const def of CONFIG.tajos){
    const pendiente = PENDIENTE[def.id];
    if(!pendiente) continue;
    let toca = false;
    try{ toca = !!pendiente(estado, resultado); }catch(_){ /* sin drama */ }
    if(toca) return def;
  }
  return null;
}
