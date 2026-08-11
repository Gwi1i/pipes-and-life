/**
 * SONIDO — la respuesta audible del juego, sintetizada ENTERA con Web Audio.
 *
 * Ni un archivo de audio: igual que el mapa se dibuja por código, el sonido se
 * fabrica por código. Cada efecto son dos o tres osciladores con su envolvente,
 * y eso basta — lo que se busca es la CONFIRMACIÓN del gesto, no una banda
 * sonora. El clic de bombear es el sonido más repetido del juego con
 * diferencia: lleva un poco de azar en el tono para que mil clics no suenen a
 * martillo pilón.
 *
 * Módulo como la escena: solo REACCIONA, nunca toca el estado. Y despierta
 * perezoso: el navegador no deja sonar nada hasta el primer gesto del usuario,
 * así que el contexto se crea/reanuda en cada llamada si hace falta.
 */

import { CONFIG } from './config.js';

// La preferencia de silencio sobrevive a la partida (y al botón Reiniciar):
// va en su propia clave, no en el guardado del juego.
const CLAVE_SILENCIO = 'redHidraulica_sonido';

let ctx = null;          // AudioContext, creado al primer gesto
let maestro = null;      // ganancia general (el mando de volumen)
let lluviaGan = null;    // ganancia del ambiente de lluvia
let encendido = localStorage.getItem(CLAVE_SILENCIO) !== '0';

function despertar(){
  if(!encendido) return null;
  if(!ctx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    maestro = ctx.createGain();
    maestro.gain.value = CONFIG.sonido.volumen;
    maestro.connect(ctx.destination);
  }
  if(ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Un tono con envolvente de caída: el ladrillo de casi todos los efectos. */
function tono(f0, f1, dur, tipo = 'sine', vol = 0.5, retardo = 0){
  if(!despertar()) return;
  const t = ctx.currentTime + retardo;
  const osc = ctx.createOscillator(), gan = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  gan.gain.setValueAtTime(vol, t);
  gan.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gan); gan.connect(maestro);
  osc.start(t); osc.stop(t + dur + 0.02);
}

/** Un golpe de ruido filtrado: agua, tierra, metal — según el filtro. */
function golpe(frec, dur, vol = 0.5, tipo = 'bandpass', retardo = 0){
  if(!despertar()) return;
  const t = ctx.currentTime + retardo;
  const n = Math.round(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const datos = buf.getChannelData(0);
  for(let i = 0; i < n; i++) datos[i] = Math.random() * 2 - 1;
  const fuente = ctx.createBufferSource(); fuente.buffer = buf;
  const filtro = ctx.createBiquadFilter();
  filtro.type = tipo; filtro.frequency.value = frec; filtro.Q.value = 1.2;
  const gan = ctx.createGain();
  gan.gain.setValueAtTime(vol, t);
  gan.gain.exponentialRampToValueAtTime(0.001, t + dur);
  fuente.connect(filtro); filtro.connect(gan); gan.connect(maestro);
  fuente.start(t);
}

const azar = (min, max) => min + Math.random() * (max - min);

/* ---------------- los efectos, uno por gesto del juego ---------------- */

/** El clic de bombear: golpe grave de bomba + chapoteo. El más oído: con azar. */
export function bombear(){
  const v = azar(0.9, 1.1);
  tono(150 * v, 55, 0.10, 'sine', 0.55);
  golpe(900 * v, 0.07, 0.18, 'bandpass', 0.015);
}

/** Picar una casilla tapada: el golpe seco de la azada. */
export function picar(){
  golpe(300 * azar(0.85, 1.15), 0.05, 0.22, 'lowpass');
}

/** La casilla se abre del todo: el mismo golpe y un brillo pequeño. */
export function destapar(){
  picar();
  tono(660, 990, 0.09, 'sine', 0.14, 0.05);
}

/** Colocar una pieza: un buen zumbo de obra que asienta. */
export function colocar(){
  tono(95, 60, 0.16, 'triangle', 0.5);
  golpe(500, 0.09, 0.2, 'lowpass', 0.02);
}

/** Cada casilla de tubería aceptada: un tic mínimo, que no canse. */
export function tramo(){
  tono(820, 780, 0.03, 'square', 0.06);
}

/** Rematar la línea: dos notas arriba, "esto ya está". */
export function rematar(){
  tono(520, 520, 0.07, 'triangle', 0.22);
  tono(780, 780, 0.10, 'triangle', 0.22, 0.08);
}

/** Comprar una mejora: la caja registradora, en pequeñito. */
export function compra(){
  tono(950, 950, 0.05, 'sine', 0.18);
  tono(1420, 1420, 0.08, 'sine', 0.16, 0.05);
}

/** Una avería nueva: dos toques metálicos que no se pueden confundir. */
export function averia(){
  tono(230, 170, 0.12, 'square', 0.22);
  tono(230, 170, 0.12, 'square', 0.22, 0.16);
}

/** Golpe de llave sobre lo roto. */
export function llave(){
  golpe(2400, 0.04, 0.2, 'highpass');
  tono(310 * azar(0.9, 1.1), 240, 0.06, 'triangle', 0.2, 0.01);
}

/** Reparación terminada: arpegio corto hacia arriba. */
export function reparada(){
  tono(440, 440, 0.07, 'triangle', 0.2);
  tono(550, 550, 0.07, 'triangle', 0.2, 0.07);
  tono(660, 660, 0.11, 'triangle', 0.2, 0.14);
}

/** Un hallazgo aflora: destello de curiosidad. */
export function hallazgo(){
  tono(660, 660, 0.06, 'sine', 0.18);
  tono(880, 880, 0.06, 'sine', 0.18, 0.06);
  tono(1320, 1320, 0.12, 'sine', 0.14, 0.12);
}

/** Tarjeta de hito o logro: dos notas serenas. Es un momento, no una feria. */
export function hito(){
  tono(440, 440, 0.18, 'triangle', 0.22);
  tono(660, 660, 0.30, 'triangle', 0.2, 0.16);
}

/** Un pueblo se incorpora: la fanfarria buena, tres notas. */
export function pueblo(){
  tono(392, 392, 0.14, 'triangle', 0.24);
  tono(494, 494, 0.14, 'triangle', 0.24, 0.12);
  tono(587, 587, 0.28, 'triangle', 0.24, 0.24);
}

/** Sondeo con agua: borboteo hacia arriba. */
export function agua(){
  golpe(700, 0.18, 0.2, 'bandpass');
  tono(330, 660, 0.22, 'sine', 0.22, 0.05);
  tono(495, 990, 0.20, 'sine', 0.16, 0.15);
}

/** Sondeo seco: la nota que baja y se apaga. Dinero al agujero. */
export function seco(){
  tono(220, 110, 0.35, 'sine', 0.24);
}

/**
 * El ambiente de lluvia: un chorro de ruido en bucle cuya ganancia sigue a la
 * intensidad. Es lo único continuo que suena, y va muy bajo a propósito: está
 * para que el otoño se OIGA sin que nadie piense en él.
 */
export function ambiente(lluvia){
  if(!encendido || !ctx) return;   // no despierta el contexto por sí solo
  if(!lluviaGan){
    const seg = 2, n = ctx.sampleRate * seg;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const datos = buf.getChannelData(0);
    for(let i = 0; i < n; i++) datos[i] = Math.random() * 2 - 1;
    const fuente = ctx.createBufferSource();
    fuente.buffer = buf; fuente.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = 900;
    lluviaGan = ctx.createGain(); lluviaGan.gain.value = 0;
    fuente.connect(filtro); filtro.connect(lluviaGan); lluviaGan.connect(maestro);
    fuente.start();
  }
  // Sin rampa daba chasquidos cada vez que cambiaba la estación
  lluviaGan.gain.setTargetAtTime(
    lluvia * CONFIG.sonido.volumenLluvia / CONFIG.sonido.volumen, ctx.currentTime, 0.8);
}

/* ---------------- el interruptor ---------------- */

export function activo(){ return encendido; }

export function alternar(){
  encendido = !encendido;
  localStorage.setItem(CLAVE_SILENCIO, encendido ? '1' : '0');
  if(!encendido && ctx) ctx.suspend();
  if(encendido && ctx) ctx.resume();
  return encendido;
}
