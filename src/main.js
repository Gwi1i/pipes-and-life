/**
 * MAIN — punto de entrada.
 *
 * Crea las piezas, las conecta y hace girar el bucle. No dibuja ni calcula:
 * delega. Si algo falla, aquí se ve qué módulo tiene la culpa.
 *
 * Bucle:  entrada → acciones → simulación → economía → escena + ui
 */

import { CONFIG } from './config.js';
import { Estado } from './estado.js';
import { Entrada } from './entrada.js';
import { UI } from './ui.js';
import { Escena } from './escena.js';
import { avanzar, bombear, costeMejora } from './simulacion.js';
import { formatear } from './util.js';

const lienzo  = document.getElementById('escena');
const estado  = new Estado();
const habiaPartida = Estado.cargar(estado);
const entrada = new Entrada(lienzo);
const ui      = new UI(entrada);
const escena  = new Escena(lienzo);

if(!habiaPartida){
  estado.anotar(`Nueva concesión. ${estado.poblacion.nombre} espera agua: ` +
                `dale a BOMBEAR.`, 'info');
}

/* ==================================================================
   ACCIONES — traducción de intenciones a cambios en el estado
   ================================================================== */

function procesarAcciones(){
  for(const a of entrada.vaciarAcciones()){
    switch(a.tipo){

      case 'bombear':
        bombear(estado);
        escena.destello(a.x, a.y);
        break;

      case 'mejorar': {
        const m = CONFIG.mejoras[a.clave];
        if(!m) break;
        const nivel = estado.mejoras[a.clave];
        if(nivel >= m.nivelMax){ avisar(`${m.nombre}: ya está al máximo.`); break; }
        const coste = costeMejora(a.clave, nivel);
        if(!estado.puedePagar(coste)){
          avisar(`Sin fondos: ${m.nombre.toLowerCase()} cuesta ${formatear(coste)} €.`);
          break;
        }
        estado.pagar(coste);
        estado.mejoras[a.clave]++;
        estado.anotar(`${m.nombre} · nivel ${estado.mejoras[a.clave]}.`, 'ok');
        // Primeras compras: animación de aparición en la escena
        if(a.clave === 'deposito'  && estado.mejoras.deposito  === 1) escena.aparecerDeposito();
        if(a.clave === 'captacion' && estado.mejoras.captacion === 1) escena.aparecerCaptacion();
        break;
      }
    }
  }
}

/**
 * Anota en el registro cuando la población cruza cada centena, en un sentido u
 * otro. Solo al cruzar, para no llenar el registro con el goteo continuo.
 */
function anotarCrecimiento(habAntes){
  const habAhora = Math.floor(estado.poblacion.habitantes);
  if(Math.floor(habAhora / 100) === Math.floor(habAntes / 100)) return;
  const n = estado.poblacion.nombre;
  estado.anotar(habAhora > habAntes
    ? `${n} crece: ${habAhora.toLocaleString('es-ES')} habitantes. Revisa si la red aguanta.`
    : `${n} pierde población: ${habAhora.toLocaleString('es-ES')} habitantes.`,
    habAhora > habAntes ? 'ok' : 'alarma');
}

/** Aviso pasajero sobre la escena. */
let tempAviso = null;
function avisar(texto){
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.classList.add('visible');
  clearTimeout(tempAviso);
  tempAviso = setTimeout(() => el.classList.remove('visible'), 2600);
}

/* ==================================================================
   BUCLE PRINCIPAL
   ================================================================== */

let ultimo = performance.now();
let acumGuardado = 0, acumHUD = 0;
let resultado = { servicio: 0, servidoM3: 0, consumo: 0, demanda: 0 };

function bucle(ahora){
  const dt = Math.min((ahora - ultimo) / 1000, 0.1);
  ultimo = ahora;

  procesarAcciones();

  // La simulación recibe el dt REAL: dentro decide qué es ritmo humano
  // (clics, auto-bombeo) y qué es tiempo de juego (consumo, captación).
  const habAntes = Math.floor(estado.poblacion.habitantes);
  resultado = avanzar(estado, dt);
  anotarCrecimiento(habAntes);

  acumHUD += dt;
  if(acumHUD > 0.1){ acumHUD = 0; ui.actualizar(estado, resultado); }

  acumGuardado += dt;
  if(acumGuardado > CONFIG.guardado.intervaloSegundos){
    acumGuardado = 0;
    estado.guardar();
  }

  escena.dibujar(estado, resultado, dt);
  requestAnimationFrame(bucle);
}

/* ==================================================================
   BOTONES GENERALES
   ================================================================== */

document.getElementById('btn-reiniciar').onclick = () => {
  if(!confirm('¿Empezar de cero? Se perderá el progreso.')) return;
  Estado.borrar();
  location.reload();
};

// Para depurar desde la consola: escribe `juego` en las herramientas del
// navegador. `juego.dinero(n)` fija el saldo para probar sin clicar.
window.juego = {
  estado, entrada, escena, CONFIG,
  dinero: n => { estado.dinero = n; },
  agua: n => { estado.agua = n; }
};

requestAnimationFrame(bucle);
