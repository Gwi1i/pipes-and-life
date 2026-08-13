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

// Las preferencias sobreviven a la partida (y al botón Reiniciar): van en su
// propia clave, no en el guardado del juego. Efectos y música por separado:
// hay quien juega con música y sin efectos, y al revés.
const CLAVE_SILENCIO = 'redHidraulica_sonido';
const CLAVE_MUSICA = 'redHidraulica_musica';

let ctx = null;          // AudioContext, creado al primer gesto
let maestro = null;      // ganancia de los EFECTOS (la música va por su lado)
let lluviaGan = null;    // ganancia del ambiente de lluvia
let encendido = localStorage.getItem(CLAVE_SILENCIO) !== '0';

function despertar(){
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
  if(!encendido || !despertar()) return;
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
  if(!encendido || !despertar()) return;
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

/** Manuel carraspea: dos notas suaves para anunciar un comentario. */
export function comentario(){
  tono(390, 390, 0.07, 'sine', 0.13);
  tono(490, 490, 0.10, 'sine', 0.11, 0.08);
}

/* ---------------- LA MÚSICA DE FONDO ----------------
   La única pieza de audio que NO se sintetiza: es un archivo del autor
   (assets/musica.*), como las ilustraciones. Se reproduce con un
   AudioBufferSourceNode en bucle —sin el hueco que mete <audio loop>— y por su
   propia ganancia, independiente de los efectos. Si el archivo no existe, no
   pasa nada: el juego suena igual que antes de tener música. */

let musicaOn = localStorage.getItem(CLAVE_MUSICA) !== '0';
let listaMusica = [];    // las canciones encontradas (urls), en su orden
let bufferMusica = {};   // url -> AudioBuffer, decodificado la primera vez
let pistaActual = -1;    // cuál suena, para seguir con la siguiente
let musicaGan = null;    // su mando de volumen
let musicaSrc = null;    // la fuente sonando ahora mismo

/**
 * Dónde EMPIEZA y ACABA la música de verdad dentro del archivo. La música
 * generada suele venir con un fundido a silencio al final (y a veces al
 * principio): en bucle, eso es morirse el sonido y arrancar de golpe. Se mide
 * el volumen por ventanas y el bucle se queda solo con el tramo fuerte — la
 * cola se oye UNA vez, en la primera pasada, y no vuelve.
 */
function extremosFuertes(buf){
  const B = CONFIG.sonido.bucle;
  const c = buf.getChannelData(0);
  const vent = Math.max(1, Math.floor(buf.sampleRate * B.ventana));
  const rms = [];
  for(let i = 0; i + vent <= c.length; i += vent){
    let s = 0;
    for(let j = i; j < i + vent; j++) s += c[j] * c[j];
    rms.push(Math.sqrt(s / vent));
  }
  if(!rms.length) return [0, buf.duration];
  const mediana = [...rms].sort((a, b) => a - b)[Math.floor(rms.length / 2)];
  const umbral = mediana * B.umbral;
  let ini = 0, fin = rms.length - 1;
  while(ini < fin && rms[ini] < umbral) ini++;
  while(fin > ini && rms[fin] < umbral) fin--;
  return [ini * B.ventana, Math.min(buf.duration, (fin + 1) * B.ventana)];
}

/**
 * Busca las canciones del autor: `musica`, `musica2`, `musica3`... hasta el
 * primer hueco, cada una en ogg/mp3/wav. Con varias, el juego las ROTA — la
 * lista entera es el bucle, así una tarde de partida no repite la misma
 * melodía en bucle hasta gastarla. Devuelve si hay alguna.
 */
export async function cargarMusica(){
  listaMusica = [];
  for(let n = 1; n <= 12; n++){
    const base = n === 1 ? 'musica' : 'musica' + n;
    let encontrada = null;
    for(const ext of ['ogg', 'mp3', 'wav']){
      try{
        const resp = await fetch(`assets/${base}.${ext}`, { method: 'HEAD' });
        if(resp.ok){ encontrada = `assets/${base}.${ext}`; break; }
      }catch(_){ /* siguiente formato */ }
    }
    if(!encontrada) break;   // al primer hueco se acabó la lista
    listaMusica.push(encontrada);
  }
  return listaMusica.length > 0;
}

/** Decodifica una pista la primera vez; después, de la caché. */
async function bufferDe(url){
  if(bufferMusica[url]) return bufferMusica[url];
  const datos = await (await fetch(url)).arrayBuffer();
  bufferMusica[url] = await ctx.decodeAudioData(datos);
  return bufferMusica[url];
}

/** Suena la pista `i` y, al acabar, encadena la siguiente de la lista. */
async function sonarPista(i){
  if(!musicaOn || !despertar()) return;
  let buf;
  try{ buf = await bufferDe(listaMusica[i]); }catch(_){ return; }
  if(!musicaOn || musicaSrc) return;   // algo cambió mientras decodificaba
  if(!musicaGan){
    musicaGan = ctx.createGain();
    musicaGan.connect(ctx.destination);   // NO pasa por maestro: mando propio
  }
  musicaGan.gain.setTargetAtTime(CONFIG.sonido.volumenMusica, ctx.currentTime, 0.1);
  // Cada pista suena solo su tramo FUERTE (las colas de silencio de la música
  // generada, fuera) y al terminar pasa el testigo a la siguiente
  const [ini, fin] = extremosFuertes(buf);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.onended = () => {
    if(musicaSrc !== src) return;   // la paró alguien (el botón): sin cadena
    musicaSrc = null;
    sonarPista((i + 1) % listaMusica.length);
  };
  src.connect(musicaGan);
  src.start(0, ini, Math.max(1, fin - ini));
  musicaSrc = src;
  pistaActual = i;
}

/** Arranca la música si hay lista y está activada. Llamar tras un gesto. */
export function empezarMusica(){
  if(!musicaOn || !listaMusica.length || musicaSrc) return;
  sonarPista(pistaActual >= 0 ? pistaActual : 0);
}

export function musicaActiva(){ return musicaOn; }
export function hayMusica(){ return listaMusica.length > 0; }

export function alternarMusica(){
  musicaOn = !musicaOn;
  localStorage.setItem(CLAVE_MUSICA, musicaOn ? '1' : '0');
  if(!musicaOn && musicaSrc){
    const src = musicaSrc;
    musicaSrc = null;               // antes de pararla: que onended no encadene
    if(musicaGan) musicaGan.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(() => { try{ src.stop(); }catch(_){ } }, 400);
  }
  if(musicaOn) empezarMusica();
  return musicaOn;
}

/* ---------------- LA VOZ DE MANUEL ----------------
   Síntesis del navegador (speechSynthesis): sin archivos, sin internet si la
   voz es local, y lee el texto VIVO — si mañana cambia un paso de la guía, la
   voz dice lo nuevo. Grabar audios habría dejado grabaciones mintiendo al
   primer refactor, que en este proyecto ya pasó dos veces con los textos.

   APAGADA por defecto (decisión del autor: un juego que habla sin avisar
   sobresalta) y con botón propio que SOLO existe si hay voz en español. */

const CLAVE_VOZ = 'redHidraulica_voz';
let vozOn = localStorage.getItem(CLAVE_VOZ) === '1';
let vozElegida = null;      // la del sintetizador de RESPALDO, si la hay
let hayArchivos = false;    // ¿existen las voces neuronales generadas?
let locucion = null;        // el <audio> que suena ahora mismo

/**
 * La huella de un texto: djb2 sobre UTF-8, 32 bits, en hexadecimal. La misma
 * cuenta que hace generar_voces.py — el nombre del archivo ES la huella, y
 * así un texto cambiado nunca reproduce el audio de ayer.
 */
export function huellaVoz(texto){
  const datos = new TextEncoder().encode(texto);
  let h = 5381;
  for(const b of datos) h = ((h * 33) ^ b) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/**
 * Prepara la voz: comprueba si están los archivos neuronales (sondeando el
 * saludo, que siempre existe si se generaron) y busca de paso el sintetizador
 * de respaldo. Devuelve si hay ALGUNA manera de hablar: sin ninguna, la UI
 * esconde el botón.
 */
export function cargarVoz(){
  const archivo = new Promise(listo => {
    const p = CONFIG.sonido.voz.presentacion;
    fetch(`assets/voz/presentacion-${huellaVoz(p)}.mp3`, { method: 'HEAD' })
      .then(r => { hayArchivos = r.ok; listo(r.ok); })
      .catch(() => listo(false));
  });
  const sintesis = new Promise(listo => {
    if(!('speechSynthesis' in window)){ listo(false); return; }
    const buscar = () => {
      const voces = speechSynthesis.getVoices();
      if(!voces.length) return false;
      const es = voces.filter(v => /^es/i.test(v.lang));
      // Un hombre para Manuel, si el sistema lo trae (Pablo, en Windows)
      vozElegida = es.find(v => /pablo|jorge|diego|alvaro|male/i.test(v.name))
                || es[0] || null;
      listo(!!vozElegida);
      return true;
    };
    if(buscar()) return;
    speechSynthesis.onvoiceschanged = buscar;
    setTimeout(() => listo(!!vozElegida), 2500);   // por si el navegador calla
  });
  return Promise.all([archivo, sintesis]).then(([a, s]) => a || s);
}

function pararLocucion(){
  if(locucion){ locucion.pause(); locucion = null; }
  if('speechSynthesis' in window) speechSynthesis.cancel();
}

/** El sintetizador del navegador: el RESPALDO cuando no hay archivo. */
function sintetizar(texto){
  if(!vozElegida) return;
  const u = new SpeechSynthesisUtterance(texto);
  u.voice = vozElegida;
  u.lang = vozElegida.lang;
  u.rate = CONFIG.sonido.voz.velocidad;
  u.pitch = CONFIG.sonido.voz.tono;
  u.volume = CONFIG.sonido.voz.volumen;
  speechSynthesis.speak(u);
}

/**
 * Manuel dice esto en voz alta, si la voz está activa. Primero el archivo
 * neuronal (assets/voz/<id>-<huella>.mp3, de generar_voces.py); si no está —
 * o el texto cambió y la huella ya no casa— cae al sintetizador. Lo nuevo
 * pisa lo viejo: Manuel no se atropella a sí mismo.
 */
export function hablar(texto, id){
  if(!vozOn) return;
  pararLocucion();
  if(id && hayArchivos){
    const a = new Audio(`assets/voz/${id}-${huellaVoz(texto)}.mp3`);
    a.volume = CONFIG.sonido.voz.volumen;
    a.onerror = () => { locucion = null; sintetizar(texto); };
    locucion = a;
    a.play().catch(() => { locucion = null; sintetizar(texto); });
    return;
  }
  sintetizar(texto);
}

export function vozActiva(){ return vozOn; }

/** ¿Está sonando la voz ahora mismo? Lo pregunta la UI para animar a Manuel. */
export function estaHablando(){
  if(locucion && !locucion.paused && !locucion.ended) return true;
  return 'speechSynthesis' in window && speechSynthesis.speaking;
}

export function alternarVoz(){
  vozOn = !vozOn;
  localStorage.setItem(CLAVE_VOZ, vozOn ? '1' : '0');
  if(!vozOn) pararLocucion();
  return vozOn;
}

/* ---------------- el interruptor de los efectos ---------------- */

export function activo(){ return encendido; }

export function alternar(){
  encendido = !encendido;
  localStorage.setItem(CLAVE_SILENCIO, encendido ? '1' : '0');
  // Ya no se suspende el contexto entero: la música va por su propio canal y
  // apagar los efectos no debe callarla. Los efectos ya comprueban `encendido`.
  if(maestro && ctx)
    maestro.gain.setTargetAtTime(encendido ? CONFIG.sonido.volumen : 0,
                                 ctx.currentTime, 0.05);
  return encendido;
}
