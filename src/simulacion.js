/**
 * SIMULACIÓN — el motor del juego.
 *
 * Sustituye al viejo solver hidráulico: aquí no hay red que resolver, sino un
 * balance de agua muy simple. Cada paso: entra agua (por los clics), sale agua
 * (la que consume la población), y lo que queda se guarda en el depósito hasta
 * su tope. Lo que se sirve, se factura.
 *
 * Nada de esto dibuja ni toca el DOM: solo lee CONFIG y muta el estado.
 */

import { CONFIG } from './config.js';

/** Demanda MEDIA de la población, en L/s. La fórmula vive SOLO aquí. */
export function demandaMedia(habitantes){
  return habitantes * CONFIG.poblacion.litrosHabitanteDia / 86400;
}

/**
 * Capacidad del sistema en litros. Sin depósito, es el chorrito que cabe en la
 * propia tubería: por eso hay que clicar sin parar. Con depósito, la reserva
 * de verdad. Es el único número que cambia entre "atado al clic" y "puedo
 * soltar el ratón".
 */
export function capacidad(estado){
  return estado.tieneDeposito
    ? CONFIG.deposito.capacidad
    : CONFIG.bomba.bufferSinDeposito;
}

/**
 * Un golpe de bomba. Mete agua en el sistema, sin pasarse de la capacidad.
 * Devuelve los litros que ENTRARON de verdad (0 si ya estaba lleno), que es lo
 * que la escena usa para decidir si anima el chorro o no.
 */
export function bombear(estado){
  const cap = capacidad(estado);
  const antes = estado.agua;
  estado.agua = Math.min(cap, estado.agua + CONFIG.bomba.litrosPorClic);
  return estado.agua - antes;
}

/**
 * Avance de la simulación durante `dtHoras` horas de juego.
 * Consume, sirve lo que hay, factura y anota el tiempo.
 *
 * Devuelve un resultado que la UI y la escena leen para pintar el estado del
 * momento (nivel de servicio, agua servida...). No guarda ese resultado en el
 * estado: es efímero, de este fotograma.
 */
export function avanzar(estado, dtHoras){
  const dem = demandaMedia(estado.poblacion.habitantes);   // L/s
  const consumo = dem * 3600 * dtHoras;                     // litros pedidos en el paso
  const servido = Math.min(estado.agua, consumo);
  estado.agua -= servido;

  const m3 = servido / 1000;
  estado.dinero += m3 * CONFIG.economia.tarifa;   // solo se paga lo que llega
  estado.m3Servidos += m3;
  estado.horas += dtHoras;

  // Nivel de servicio: 1 = abastecida del todo, 0 = seca.
  const servicio = consumo > 0 ? servido / consumo : 1;
  estado.poblacion.servicio = servicio;
  estado.poblacion.abastecida = servicio > 0.999;

  return { servicio, servidoM3: m3, consumo, demanda: dem };
}
