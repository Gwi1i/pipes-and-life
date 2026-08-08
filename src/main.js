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
import { avanzar, bombear, costeMejora, requisitosAutobomba } from './simulacion.js';
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
} else {
  progresoOffline();   // acreditar el tiempo ausente
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

      case 'activarAutobomba': {
        if(estado.autobombaActivo) break;
        const P = CONFIG.premium.autobomba;
        // GANCHO de monetización futura: si algún día se decide desbloquear por
        // anuncio o pago, se comprobaría aquí (P.desbloqueoExterno). De momento
        // solo hay una vía: cumplir requisitos y pagar en el juego.
        if(!requisitosAutobomba(estado).cumple){
          avisar('Aún no cumples los requisitos para el auto-bombeo.');
          break;
        }
        if(!estado.puedePagar(P.coste)){
          avisar(`El auto-bombeo cuesta ${formatear(P.coste)} €.`);
          break;
        }
        estado.pagar(P.coste);
        estado.autobombaActivo = true;
        estado.anotar('¡Auto-bombeo activado! La bomba trabaja sola.', 'ok');
        break;
      }

      case 'repararAveria': {
        if(!estado.averia) break;
        const coste = CONFIG.averias.costeReparacionManual;
        if(!estado.puedePagar(coste)){
          avisar(`La reparación cuesta ${formatear(coste)} € y no hay fondos.`);
          break;
        }
        estado.pagar(coste);
        estado.averia = null;
        estado.anotar(`Avería reparada a mano por ${formatear(coste)} €.`, 'ok');
        break;
      }
    }
  }
}

/* ==================================================================
   AVERÍAS — solo en la partida viva, nunca offline
   ================================================================== */

function tickAverias(dtHoras){
  const A = CONFIG.averias;

  // Reparación automática si hay personal de mantenimiento contratado
  if(estado.averia){
    const nivel = estado.mejoras.mantenimiento;
    if(nivel > 0){
      const tiempo = A.reparacionAutoHoras * Math.pow(A.reparacionAutoFactor, nivel - 1);
      if(estado.horas - estado.averia.desde >= tiempo){
        estado.averia = null;
        estado.anotar('El equipo de mantenimiento repara la avería.', 'ok');
      }
    }
    return;   // mientras esté rota, no puede volver a romperse
  }

  // Riesgo de nueva avería: más máquina en marcha, más desgaste
  let riesgo = A.probBasePorHora * dtHoras;
  riesgo *= 1 + A.factorDesgaste *
            (estado.mejoras.captacion + (estado.autobombaActivo ? A.riesgoAutobomba : 0));
  if(Math.random() < riesgo){
    estado.averia = { desde: estado.horas };
    avisar('¡Avería! La producción automática se ha parado.');
    estado.anotar('Avería en la instalación: la producción automática está parada.', 'critico');
  }
}

/* ==================================================================
   PROGRESO OFFLINE — acreditar el tiempo ausente al cargar
   ================================================================== */

function progresoOffline(){
  const O = CONFIG.offline;
  const seg = (Date.now() - estado.ultimoInstante) / 1000;
  if(seg <= O.minSegundos) return;

  const aSimular = Math.min(seg, O.maxHoras * 3600);   // segundos reales, con tope
  const dineroAntes = estado.dinero;
  const habAntes = Math.floor(estado.poblacion.habitantes);

  // Se avanza a pasos: la curva diaria y el estiaje cambian por el camino, así
  // que un único salto grande daría un resultado sesgado.
  let restante = aSimular;
  const paso = 30;   // segundos reales por paso
  while(restante > 0){
    avanzar(estado, Math.min(paso, restante));
    restante -= paso;
  }

  const dinero = estado.dinero - dineroAntes;
  const habAhora = Math.floor(estado.poblacion.habitantes);
  const minutos = Math.round(aSimular / 60);
  let txt = `Mientras no estabas (${minutos} min): ${dinero >= 0 ? '+' : ''}${formatear(dinero)} €`;
  if(habAhora !== habAntes) txt += `, población ${habAhora.toLocaleString('es-ES')}`;
  estado.anotar(txt + '.', 'info');
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
  tickAverias(dt * CONFIG.economia.horasPorSegundo);
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
