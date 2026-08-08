/**
 * SIMULACIÓN — el motor del juego.
 *
 * Un balance de agua simple: entra agua (clics + producción pasiva), sale agua
 * (consumo de la población), y lo que queda se guarda en el depósito hasta su
 * tope. Lo servido se factura. La población crece o mengua según el servicio.
 *
 * A partir del Hito 3 el mundo tiene ciclo: el consumo sube y baja con la hora
 * del día (curva diaria) y la captación con la estación (estiaje).
 *
 * Nada de esto dibuja ni toca el DOM: solo lee CONFIG y muta el estado.
 *
 * NOTA sobre unidades de tiempo. Hay dos clases de flujo, a propósito:
 *   - Flujos "de mundo" (consumo, captación) van en L/s de JUEGO y se escalan
 *     con las horas de juego (dtHoras). El estiaje y la curva diaria los modulan.
 *   - Flujos "de acción" (clic manual, auto-bombeo) son ritmo humano y van en
 *     tiempo REAL, como el propio clicar.
 */

import { CONFIG } from './config.js';

/** Demanda MEDIA de la población, en L/s. La fórmula vive SOLO aquí. */
export function demandaMedia(habitantes){
  return habitantes * CONFIG.poblacion.litrosHabitanteDia / 86400;
}

/** Coeficiente de punta para la hora del día (0-23). */
export function coefHora(horas){
  const h = Math.floor(((horas % 24) + 24) % 24);
  return CONFIG.curvaDiaria[h];
}

/** Factor de estiaje: cuánto caudal da la captación según la época del año. */
export function factorEstiaje(horas){
  const e = CONFIG.estiaje, T = CONFIG.tiempo;
  const fase = ((horas % T.horasPorAño) / T.horasPorAño) * Math.PI * 2;
  // Arranca en primavera (máximo) y baja hasta el mínimo en pleno verano.
  const t = (Math.cos(fase) + 1) / 2;
  return e.factorMin + (e.factorMax - e.factorMin) * t;
}

/** Litros que mete cada clic, con la mejora de potencia de bomba. */
export function litrosPorClic(estado){
  return CONFIG.bomba.litrosPorClicBase +
         estado.mejoras.bomba * CONFIG.mejoras.bomba.incrementoLitros;
}

/** Capacidad del sistema en litros: chorrito sin depósito, reserva con él. */
export function capacidad(estado){
  const n = estado.mejoras.deposito;
  if(n === 0) return CONFIG.bomba.bufferSinDeposito;
  return CONFIG.deposito.capacidadBase + (n - 1) * CONFIG.deposito.incrementoCapacidad;
}

/** Producción pasiva de la captación, en L/s de juego (antes del estiaje). */
export function caudalCaptacion(estado){
  return estado.mejoras.captacion * CONFIG.mejoras.captacion.caudalPorNivel;
}

/** Pulsaciones automáticas por segundo real. Cero si el auto-bombeo no está activo. */
export function clicsAutoPorSeg(estado){
  return estado.autobombaActivo ? CONFIG.premium.autobomba.clicsPorSeg : 0;
}

/** Coste del SIGUIENTE nivel de una mejora dado su nivel actual. */
export function costeMejora(clave, nivelActual){
  const m = CONFIG.mejoras[clave];
  return Math.round(m.costeBase * Math.pow(m.factorCoste, nivelActual));
}

/** ¿Se puede desbloquear ya el auto-bombeo? Devuelve qué falta si no. */
export function requisitosAutobomba(estado){
  const r = CONFIG.premium.autobomba.requisitos;
  const faltan = [];
  if(estado.mejoras.bomba < r.bomba)
    faltan.push({ txt: `Potencia de bomba Nv ${r.bomba}`, ok: false });
  else faltan.push({ txt: `Potencia de bomba Nv ${r.bomba}`, ok: true });
  if(estado.mejoras.captacion < r.captacion)
    faltan.push({ txt: `Captación Nv ${r.captacion}`, ok: false });
  else faltan.push({ txt: `Captación Nv ${r.captacion}`, ok: true });
  const hab = Math.floor(estado.poblacion.habitantes);
  faltan.push({ txt: `${r.habitantes} habitantes`, ok: hab >= r.habitantes });
  return { cumple: faltan.every(f => f.ok), lista: faltan };
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
 * NO decide averías: eso lo lleva `main.js` en el bucle vivo. Pero sí respeta
 * una avería en curso, cortando la producción automática.
 */
export function avanzar(estado, dt){
  const eco = CONFIG.economia;
  const dtHoras = dt * eco.horasPorSegundo;
  const cap = capacidad(estado);
  const punta = coefHora(estado.horas);
  const estiaje = factorEstiaje(estado.horas);
  const factorAveria = estado.averia ? (1 - CONFIG.averias.recorteProduccion) : 1;

  // --- Entrada: producción pasiva (parada si hay avería) ---
  const prodCaptacion = caudalCaptacion(estado) * estiaje * factorAveria * 3600 * dtHoras;
  const prodAuto = clicsAutoPorSeg(estado) * litrosPorClic(estado) * factorAveria * dt;
  const antes = estado.agua;
  estado.agua = Math.min(cap, estado.agua + prodCaptacion + prodAuto);
  const entrada = estado.agua - antes;

  // --- Salida: consumo de la población, con la punta horaria ---
  const dem = demandaMedia(estado.poblacion.habitantes);
  const consumo = dem * punta * 3600 * dtHoras;
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
    demandaAhora: dem * punta, punta, estiaje,
    entrada, prodLps: dt > 0 ? entrada / dt : 0,
    produciendo: entrada > 0.0001,
    bombeoAuto: prodAuto > 0.0001,
    averiada: !!estado.averia
  };
}

/**
 * Crecimiento / despoblación.
 * Crece solo tras una racha de buen servicio SIN CORTES (un corte la resetea);
 * mengua si va mal servida; en medio, se queda igual.
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
    p.racha = 0;
    p.habitantes = Math.max(P.habitantesMin,
      p.habitantes * (1 + P.tasaDeclineAnual * años));
  }
}
