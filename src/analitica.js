/**
 * ANALÍTICA — los cuatro números que dicen si el juego gusta.
 *
 * No es un panel de estadísticas ni un sistema de telemetría: es un contador
 * de sucesos, anónimo y minúsculo. Contesta a lo que no se puede preguntar
 * ("¿te ha gustado?" siempre se responde que sí): cuánta gente entra, cuánta
 * pasa de la portada, **cuánta vuelve al día siguiente** y hasta dónde llega.
 *
 * Las reglas, que son las del proyecto llevadas a este terreno:
 *
 * - NO se carga el script de nadie. Se pide una imagen de 1px con la etiqueta
 *   del suceso, y se acabó. Ningún código ajeno se ejecuta aquí dentro.
 * - Se cuenta QUÉ pasa, nunca QUIÉN. No hay identificador de jugador, ni
 *   ubicación, ni nada de la partida. Dos personas que hagan lo mismo son
 *   indistinguibles a propósito.
 * - Sin `CONFIG.analitica.codigo` no se pide NADA a nadie: el módulo entero se
 *   queda mudo. Como la música sin archivos.
 * - Se respeta «No rastrear» del navegador.
 *
 * Módulo del lado tonto, como el sonido: solo REACCIONA. No toca el estado, no
 * dibuja, y si falla no se entera nadie — una analítica que rompe la partida es
 * mucho peor que no tener analítica.
 */

import { CONFIG } from './config.js';

let activa = false;
let dicho = new Set();   // cada suceso, UNA vez por sesión: contamos jugadores

// EL INTERRUPTOR DEL AUTOR: sus propias pruebas ensuciaban la medición real.
// `juego.noContarme()` en la consola excluye ESE navegador para siempre (y
// `juego.contarme()` lo revierte). Va en su clave, fuera del guardado: tiene
// que sobrevivir a Reiniciar, como todo lo que es del aparato y no de la
// partida.
const CLAVE_EXCLUIDO = 'redHidraulica_noContar';

export function noContarme(){
  try{ localStorage.setItem(CLAVE_EXCLUIDO, '1'); }catch(_){ }
  activa = false;
  return 'Hecho: este navegador ya no cuenta en la analítica.';
}

export function contarme(){
  try{ localStorage.removeItem(CLAVE_EXCLUIDO); }catch(_){ }
  return 'Este navegador volverá a contar en la próxima carga.';
}

function excluido(){
  try{ return localStorage.getItem(CLAVE_EXCLUIDO) === '1'; }catch(_){ return false; }
}

/** El día de hoy en formato aaaa-mm-dd, para comparar días de calendario. */
function hoy(){
  return new Date().toISOString().slice(0, 10);
}

/**
 * Arranca el contador y mide la VUELTA, que es la medida que importa: cuántos
 * de los que probaron el juego lo abren otro día. Se guarda solo el primer día
 * y el último, en el propio navegador del jugador — nada de eso sale de ahí:
 * lo único que se manda es el número de días, sin fecha ni identificador.
 */
export function iniciar(){
  const K = CONFIG.analitica;
  if(!K || !K.codigo) return;                       // sin cuenta, silencio
  if(navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  if(excluido()) return;                            // el navegador del autor
  activa = true;

  contar('visita');

  let v;
  try{ v = JSON.parse(localStorage.getItem(K.clave)) || null; }catch(_){ v = null; }
  const dia = hoy();

  if(!v){
    contar('jugador-nuevo');
    v = { primero: dia, ultimo: dia, dias: 1 };
  } else if(v.ultimo !== dia){
    // Días de CALENDARIO desde la primera vez: el 1 y el 7 son los que se miran
    const transcurridos = Math.round(
      (new Date(dia) - new Date(v.primero)) / 86400000);
    v.dias = (v.dias || 1) + 1;
    v.ultimo = dia;
    contar('vuelve/dia-' + transcurridos);
    if(v.dias >= 3) contar('vuelve/tres-veces');
  }
  try{ localStorage.setItem(K.clave, JSON.stringify(v)); }catch(_){ }
}

/**
 * Cuenta un suceso. `etiqueta` es una ruta legible ('fase-2', 'minijuego/
 * tuberias'): lo que se lee luego en el panel del contador.
 * Cada etiqueta se manda UNA vez por sesión — se cuentan jugadores que llegan
 * a un sitio, no veces que pasan por él, que es lo que se quiere saber.
 */
export function contar(etiqueta){
  if(!activa || dicho.has(etiqueta)) return;
  dicho.add(etiqueta);
  const K = CONFIG.analitica;
  // Se limpia en vez de escaparse: las barras tienen que llegar como barras
  // para que el panel agrupe ('vuelve/dia-1' junto a 'vuelve/dia-7'), y
  // escapándolas se leía '/vuelve%2Fdia-7'. Nada que no sea letra, número,
  // guion o barra no entra — es la garantía de que la etiqueta es inofensiva.
  const limpia = String(etiqueta).toLowerCase().replace(/[^a-z0-9/-]/g, '');
  try{
    // Una imagen de 1px: ni fetch, ni script, ni cookies. Lo más tonto que hay.
    new Image().src = `https://${K.codigo}.${K.servidor}/count`
      + `?p=/${limpia}`
      + `&r=${encodeURIComponent(document.referrer || '')}`
      + `&rnd=${Math.random().toString(36).slice(2)}`;
  }catch(_){ /* si falla, que falle en silencio: es solo un contador */ }
}
