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
import { avanzar, bombear } from './simulacion.js';
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

      case 'comprarDeposito': {
        if(estado.tieneDeposito) break;
        if(!estado.puedePagar(CONFIG.deposito.coste)){
          avisar(`Sin fondos: el depósito cuesta ${formatear(CONFIG.deposito.coste)} €.`);
          break;
        }
        estado.pagar(CONFIG.deposito.coste);
        estado.tieneDeposito = true;
        estado.anotar(`Depósito construido: ${formatear(CONFIG.deposito.capacidad)} L de reserva. ` +
                      `Ahora el agua se acumula.`, 'ok');
        escena.aparecerDeposito();
        break;
      }
    }
  }
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
  resultado = avanzar(estado, dt * CONFIG.economia.horasPorSegundo);

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
