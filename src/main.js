/**
 * MAIN — punto de entrada.
 *
 * Crea las piezas, las conecta y hace girar el bucle. No dibuja ni calcula:
 * delega. Bucle:  entrada → acciones → simulación → economía → escena + ui
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
  estado.anotar(`Nueva mancomunidad. ${estado.activo.nombre} espera agua: dale a BOMBEAR.`, 'info');
} else {
  progresoOffline();
}
ui.reconstruirPestanas(estado);

// Población de referencia para avisar solo al cruzar centenas, por pueblo
let habPrev = estado.pueblos.map(p => Math.floor(p.habitantes));

/* ==================================================================
   ACCIONES
   ================================================================== */

function procesarAcciones(){
  for(const a of entrada.vaciarAcciones()){
    switch(a.tipo){

      case 'bombear':
        bombear(estado.activo);
        escena.destello(a.x, a.y);
        break;

      case 'cambiarPueblo': {
        const i = parseInt(a.clave, 10);
        if(estado.pueblos[i] && estado.pueblos[i].desbloqueado){
          estado.puebloActivo = i;
          ui.reconstruirPestanas(estado);
          ui.invalidarCache();
        }
        break;
      }

      case 'mejorar': {
        const m = CONFIG.mejoras[a.clave];
        if(!m) break;
        const p = estado.activo;
        const nivel = p.mejoras[a.clave];
        if(nivel >= m.nivelMax){ avisar(`${m.nombre}: ya está al máximo.`); break; }
        const coste = costeMejora(a.clave, nivel);
        if(!estado.puedePagar(coste)){
          avisar(`Sin fondos: ${m.nombre.toLowerCase()} cuesta ${formatear(coste)} €.`);
          break;
        }
        estado.pagar(coste);
        p.mejoras[a.clave]++;
        estado.anotar(`${p.nombre} · ${m.nombre} nivel ${p.mejoras[a.clave]}.`, 'ok');
        if(a.clave === 'deposito'   && p.mejoras.deposito   === 1) escena.aparecerDeposito();
        if(a.clave === 'captacion'  && p.mejoras.captacion  === 1) escena.aparecerCaptacion();
        if(a.clave === 'depuradora' && p.mejoras.depuradora === 1) escena.aparecerDepuradora();
        break;
      }

      case 'activarAutobomba': {
        const p = estado.activo;
        if(p.autobombaActivo) break;
        const P = CONFIG.premium.autobomba;
        // GANCHO de monetización futura (P.desbloqueoExterno). De momento solo
        // se activa cumpliendo requisitos y pagando en el juego.
        if(!requisitosAutobomba(p).cumple){
          avisar('Este pueblo aún no cumple los requisitos para el auto-bombeo.');
          break;
        }
        if(!estado.puedePagar(P.coste)){
          avisar(`El auto-bombeo cuesta ${formatear(P.coste)} €.`);
          break;
        }
        estado.pagar(P.coste);
        p.autobombaActivo = true;
        estado.anotar(`¡Auto-bombeo activado en ${p.nombre}!`, 'ok');
        break;
      }

      case 'repararAveria': {
        const p = estado.activo;
        if(!p.averia) break;
        const coste = CONFIG.averias.costeReparacionManual;
        if(!estado.puedePagar(coste)){
          avisar(`La reparación cuesta ${formatear(coste)} € y no hay fondos.`);
          break;
        }
        estado.pagar(coste);
        p.averia = null;
        estado.anotar(`Avería de ${p.nombre} reparada a mano por ${formatear(coste)} €.`, 'ok');
        break;
      }

      case 'limpiarCauce':
        estado.contaminacion = Math.max(0, estado.contaminacion - CONFIG.cauce.limpiezaPorClic);
        escena.destelloCauce();
        break;
    }
  }
}

/* ==================================================================
   AVERÍAS — por pueblo, solo en la partida viva (nunca offline)
   ================================================================== */

function tickAverias(dtHoras){
  const A = CONFIG.averias;
  for(let i = 0; i < estado.pueblos.length; i++){
    const p = estado.pueblos[i];
    if(!p.desbloqueado) continue;

    if(p.averia){
      const nivel = p.mejoras.mantenimiento;
      if(nivel > 0){
        const tiempo = A.reparacionAutoHoras * Math.pow(A.reparacionAutoFactor, nivel - 1);
        if(estado.horas - p.averia.desde >= tiempo){
          p.averia = null;
          estado.anotar(`El equipo de mantenimiento repara la avería de ${p.nombre}.`, 'ok');
        }
      }
      continue;
    }

    let riesgo = A.probBasePorHora * dtHoras;
    riesgo *= 1 + A.factorDesgaste *
              (p.mejoras.captacion + (p.autobombaActivo ? A.riesgoAutobomba : 0));
    if(Math.random() < riesgo){
      p.averia = { desde: estado.horas };
      estado.anotar(`Avería en ${p.nombre}: producción automática parada.`, 'critico');
      if(i === estado.puebloActivo) avisar('¡Avería! La producción automática se ha parado.');
    }
  }
}

/* ==================================================================
   DESBLOQUEO DE PUEBLOS Y AVISOS DE CRECIMIENTO
   ================================================================== */

function comprobarDesbloqueo(){
  const primero = estado.pueblos[0];
  for(let i = 1; i < estado.pueblos.length; i++){
    const p = estado.pueblos[i];
    if(!p.desbloqueado && Math.floor(primero.habitantes) >= CONFIG.desbloqueo.segundoPuebloEn){
      p.desbloqueado = true;
      estado.anotar(`¡La mancomunidad se amplía! Nuevo pueblo: ${p.nombre}.`, 'ok');
      avisar(`Nuevo pueblo disponible: ${p.nombre}. Ábrelo en las pestañas.`);
      ui.reconstruirPestanas(estado);
    }
  }
}

function anotarCrecimiento(){
  for(let i = 0; i < estado.pueblos.length; i++){
    const p = estado.pueblos[i];
    if(!p.desbloqueado) continue;
    const ahora = Math.floor(p.habitantes);
    const antes = habPrev[i];
    if(Math.floor(ahora / 100) !== Math.floor(antes / 100)){
      estado.anotar(ahora > antes
        ? `${p.nombre} crece: ${ahora.toLocaleString('es-ES')} habitantes.`
        : `${p.nombre} pierde población: ${ahora.toLocaleString('es-ES')} habitantes.`,
        ahora > antes ? 'ok' : 'alarma');
    }
    habPrev[i] = ahora;
  }
}

/* ==================================================================
   PROGRESO OFFLINE
   ================================================================== */

function progresoOffline(){
  const O = CONFIG.offline;
  const seg = (Date.now() - estado.ultimoInstante) / 1000;
  if(seg <= O.minSegundos) return;

  const aSimular = Math.min(seg, O.maxHoras * 3600);
  const dineroAntes = estado.dinero;
  let restante = aSimular;
  const paso = 30;
  while(restante > 0){
    avanzar(estado, Math.min(paso, restante));   // sin averías nuevas offline
    restante -= paso;
  }
  const dinero = estado.dinero - dineroAntes;
  const minutos = Math.round(aSimular / 60);
  estado.anotar(`Mientras no estabas (${minutos} min): ${dinero >= 0 ? '+' : ''}${formatear(dinero)} €.`, 'info');
}

/* ==================================================================
   AVISO PASAJERO
   ================================================================== */

let tempAviso = null;
function avisar(texto){
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.classList.add('visible');
  clearTimeout(tempAviso);
  tempAviso = setTimeout(() => el.classList.remove('visible'), 2800);
}

/* ==================================================================
   BUCLE PRINCIPAL
   ================================================================== */

let ultimo = performance.now();
let acumGuardado = 0, acumHUD = 0;
let resultado = { servicio: 0, prodLps: 0, contaminacion: 0, suciedad: 0 };

function bucle(ahora){
  const dt = Math.min((ahora - ultimo) / 1000, 0.1);
  ultimo = ahora;

  procesarAcciones();
  resultado = avanzar(estado, dt);
  tickAverias(dt * CONFIG.economia.horasPorSegundo);
  comprobarDesbloqueo();
  anotarCrecimiento();

  if(resultado.saneamientoNuevo && resultado.saneamientoNuevo.length){
    for(const nombre of resultado.saneamientoNuevo){
      estado.anotar(`${nombre} genera aguas residuales. Vigila el cauce y piensa en una depuradora.`, 'alarma');
      avisar(`${nombre} ya vierte al cauce. Sin depuradora, contaminas.`);
    }
  }

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

// Depuración: `juego` en la consola. `juego.dinero(n)` fija el saldo.
window.juego = {
  estado, entrada, escena, CONFIG,
  dinero: n => { estado.dinero = n; },
  agua: n => { estado.activo.agua = n; }
};

requestAnimationFrame(bucle);
