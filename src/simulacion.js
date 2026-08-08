/**
 * SIMULACIÓN — el motor del juego.
 *
 * Un balance de agua muy simple: entra agua (clics + producción pasiva), sale
 * agua (consumo de la población), y lo que queda se guarda en el depósito hasta
 * su tope. Lo que se sirve, se factura. Y la población crece o mengua según lo
 * bien que la abastezcas.
 *
 * Nada de esto dibuja ni toca el DOM: solo lee CONFIG y muta el estado.
 *
 * NOTA sobre unidades de tiempo. Hay dos clases de flujo, a propósito:
 *   - Flujos "de mundo" (consumo, captación) van en L/s de JUEGO y se escalan
 *     con las horas de juego (dtHoras). El estiaje del Hito 3 los modulará.
 *   - Flujos "de acción" (clic manual, auto-bombeo) son ritmo humano y van en
 *     tiempo REAL, como el propio clicar.
 */

import { CONFIG } from './config.js';

/** Demanda MEDIA de la población, en L/s. La fórmula vive SOLO aquí. */
export function demandaMedia(habitantes){
  return habitantes * CONFIG.poblacion.litrosHabitanteDia / 86400;
}

/** Litros que mete cada clic, con la mejora de potencia de bomba. */
export function litrosPorClic(estado){
  return CONFIG.bomba.litrosPorClicBase +
         estado.mejoras.bomba * CONFIG.mejoras.bomba.incrementoLitros;
}

/**
 * Capacidad del sistema en litros. Sin depósito (nivel 0) es el chorrito que
 * cabe en la tubería: por eso hay que clicar sin parar. Cada nivel de depósito
 * amplía la reserva.
 */
export function capacidad(estado){
  const n = estado.mejoras.deposito;
  if(n === 0) return CONFIG.bomba.bufferSinDeposito;
  return CONFIG.deposito.capacidadBase + (n - 1) * CONFIG.deposito.incrementoCapacidad;
}

/** Producción pasiva de la captación, en L/s de juego. */
export function caudalCaptacion(estado){
  return estado.mejoras.captacion * CONFIG.mejoras.captacion.caudalPorNivel;
}

/** Pulsaciones automáticas por segundo real que da el auto-bombeo. */
export function clicsAutoPorSeg(estado){
  return estado.mejoras.autobomba * CONFIG.mejoras.autobomba.clicsPorSegPorNivel;
}

/** Coste del SIGUIENTE nivel de una mejora dado su nivel actual. */
export function costeMejora(clave, nivelActual){
  const m = CONFIG.mejoras[clave];
  return Math.round(m.costeBase * Math.pow(m.factorCoste, nivelActual));
}

/**
 * Un golpe de bomba. Mete agua en el sistema sin pasarse de la capacidad.
 * Devuelve los litros que ENTRARON de verdad (0 si ya estaba lleno).
 */
export function bombear(estado){
  const cap = capacidad(estado);
  const antes = estado.agua;
  estado.agua = Math.min(cap, estado.agua + litrosPorClic(estado));
  return estado.agua - antes;
}

/**
 * Avance de la simulación durante `dt` segundos REALES.
 * Produce (pasivo), consume, sirve, factura y hace crecer/menguar la población.
 * Devuelve un resultado efímero (de este fotograma) para UI y escena.
 */
export function avanzar(estado, dt){
  const eco = CONFIG.economia;
  const dtHoras = dt * eco.horasPorSegundo;
  const cap = capacidad(estado);

  // --- Entrada: producción pasiva ---
  const prodCaptacion = caudalCaptacion(estado) * 3600 * dtHoras;        // flujo de mundo
  const prodAuto = clicsAutoPorSeg(estado) * litrosPorClic(estado) * dt; // ritmo humano
  const antes = estado.agua;
  estado.agua = Math.min(cap, estado.agua + prodCaptacion + prodAuto);
  const entrada = estado.agua - antes;

  // --- Salida: consumo de la población ---
  const dem = demandaMedia(estado.poblacion.habitantes);   // L/s
  const consumo = dem * 3600 * dtHoras;                     // litros pedidos en el paso
  const servido = Math.min(estado.agua, consumo);
  estado.agua -= servido;

  // --- Caja: solo se paga lo que llega ---
  const m3 = servido / 1000;
  estado.dinero += m3 * eco.tarifa;
  estado.m3Servidos += m3;
  estado.horas += dtHoras;

  const servicio = consumo > 0 ? servido / consumo : 1;
  estado.poblacion.servicio = servicio;
  estado.poblacion.abastecida = servicio > 0.999;

  crecer(estado, servicio, dtHoras);

  return {
    servicio, servidoM3: m3, consumo, demanda: dem,
    entrada,                          // litros que entraron este paso
    prodLps: dt > 0 ? entrada / dt : 0,  // producción percibida, L/s real
    produciendo: entrada > 0.0001,
    bombeoAuto: prodAuto > 0.0001
  };
}

/**
 * Crecimiento / despoblación.
 * Crece solo si lleva un rato SIN CORTES bien abastecida (la racha); un corte
 * la resetea. Si va mal servida, mengua. En medio, se queda como está.
 */
function crecer(estado, servicio, dtHoras){
  const P = CONFIG.poblacion;
  const años = dtHoras / CONFIG.tiempo.horasPorAño;
  const p = estado.poblacion;

  if(servicio >= P.servicioBueno){
    p.racha += dtHoras;
    if(p.racha >= P.horasBuenServicioParaCrecer){
      p.habitantes = Math.min(P.habitantesMax,
        p.habitantes * (1 + P.tasaCrecimientoAnual * años));
    }
  } else if(servicio < P.servicioMalo){
    p.racha = 0;   // un corte rompe la confianza: hay que volver a ganársela
    p.habitantes = Math.max(P.habitantesMin,
      p.habitantes * (1 + P.tasaDeclineAnual * años));
  }
  // zona templada (entre malo y bueno): ni crece ni mengua, la racha se congela
}
