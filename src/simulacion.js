/**
 * SIMULACIÓN — el motor del juego.
 *
 * Multi-pueblo: la mancomunidad gestiona varios pueblos, cada uno con su propio
 * sistema (bomba, depósito, captación, depuradora, mantenimiento, auto-bombeo).
 * Lo COMÚN es la caja (`estado.dinero`), el reloj (`estado.horas`) y el cauce
 * (`estado.contaminacion`): un solo río al que vierten todos.
 *
 * Cada paso: por cada pueblo entra agua (clics + producción pasiva) y sale agua
 * (consumo). Lo servido se factura a la caja común. Las aguas residuales sin
 * depurar de TODOS los pueblos ensucian el mismo cauce, lo que cuesta una multa
 * y frena el crecimiento de todos.
 *
 * Nada de esto dibuja ni toca el DOM: solo lee CONFIG y muta el estado.
 *
 * Unidades de tiempo (a propósito): flujos "de mundo" (consumo, captación) en
 * L/s de juego escalados por dtHoras; flujos "de acción" (clic, auto-bombeo) en
 * tiempo real, como el propio clicar.
 */

import { CONFIG } from './config.js';

/* ---------------- HELPERS POR PUEBLO ---------------- */

export function demandaMedia(habitantes){
  return habitantes * CONFIG.poblacion.litrosHabitanteDia / 86400;
}

export function coefHora(horas){
  const h = Math.floor(((horas % 24) + 24) % 24);
  return CONFIG.curvaDiaria[h];
}

export function factorEstiaje(horas){
  const e = CONFIG.estiaje, T = CONFIG.tiempo;
  const fase = ((horas % T.horasPorAño) / T.horasPorAño) * Math.PI * 2;
  const t = (Math.cos(fase) + 1) / 2;
  return e.factorMin + (e.factorMax - e.factorMin) * t;
}

export function litrosPorClic(pueblo){
  return CONFIG.bomba.litrosPorClicBase +
         pueblo.mejoras.bomba * CONFIG.mejoras.bomba.incrementoLitros;
}

export function capacidad(pueblo){
  const n = pueblo.mejoras.deposito;
  if(n === 0) return CONFIG.bomba.bufferSinDeposito;
  return CONFIG.deposito.capacidadBase + (n - 1) * CONFIG.deposito.incrementoCapacidad;
}

export function caudalCaptacion(pueblo){
  return pueblo.mejoras.captacion * CONFIG.mejoras.captacion.caudalPorNivel;
}

export function clicsAutoPorSeg(pueblo){
  return pueblo.autobombaActivo ? CONFIG.premium.autobomba.clicsPorSeg : 0;
}

/** Fracción de aguas residuales que trata la depuradora del pueblo (0..máx). */
export function fraccionTratada(pueblo){
  const d = CONFIG.mejoras.depuradora;
  return Math.min(d.fraccionMax, pueblo.mejoras.depuradora * d.fraccionPorNivel);
}

export function costeMejora(clave, nivelActual){
  const m = CONFIG.mejoras[clave];
  return Math.round(m.costeBase * Math.pow(m.factorCoste, nivelActual));
}

/** ¿Puede este pueblo desbloquear el auto-bombeo? Devuelve qué falta. */
export function requisitosAutobomba(pueblo){
  const r = CONFIG.premium.autobomba.requisitos;
  const hab = Math.floor(pueblo.habitantes);
  const lista = [
    { txt: `Potencia de bomba Nv ${r.bomba}`, ok: pueblo.mejoras.bomba >= r.bomba },
    { txt: `Captación Nv ${r.captacion}`,      ok: pueblo.mejoras.captacion >= r.captacion },
    { txt: `${r.habitantes} habitantes`,        ok: hab >= r.habitantes }
  ];
  return { cumple: lista.every(f => f.ok), lista };
}

/** Un golpe de bomba en un pueblo. Devuelve los litros que entraron. */
export function bombear(pueblo){
  const cap = capacidad(pueblo);
  const antes = pueblo.agua;
  pueblo.agua = Math.min(cap, pueblo.agua + litrosPorClic(pueblo));
  return pueblo.agua - antes;
}

/* ---------------- AVANCE ---------------- */

/**
 * Avanza UN pueblo `dt` segundos reales. Muta el pueblo y la caja común.
 * Devuelve { residual, res } donde `residual` son los litros crudos que vierte
 * al cauce (ya descontada su depuradora) y `res` es el estado efímero para pintar.
 */
function avanzarPueblo(estado, p, dt, dtHoras, punta, estiaje, frenoCrec){
  const S = CONFIG.saneamiento;
  const cap = capacidad(p);
  const factorAveria = p.averia ? (1 - CONFIG.averias.recorteProduccion) : 1;

  // Entrada: producción pasiva (parada si hay avería)
  const prodCaptacion = caudalCaptacion(p) * estiaje * factorAveria * 3600 * dtHoras;
  const prodAuto = clicsAutoPorSeg(p) * litrosPorClic(p) * factorAveria * dt;
  const antes = p.agua;
  p.agua = Math.min(cap, p.agua + prodCaptacion + prodAuto);
  const entrada = p.agua - antes;

  // Salida: consumo con la punta horaria
  const dem = demandaMedia(p.habitantes);
  const consumo = dem * punta * 3600 * dtHoras;
  const servido = Math.min(p.agua, consumo);
  p.agua -= servido;

  const m3 = servido / 1000;
  estado.dinero += m3 * CONFIG.economia.tarifa;
  estado.m3Servidos += m3;

  const servicio = consumo > 0 ? servido / consumo : 1;
  p.servicio = servicio;
  p.abastecida = servicio > 0.999;

  // Saneamiento: al superar el umbral, el pueblo empieza a generar residuales
  let recienSaneamiento = false;
  if(!p.saneamientoActivo && p.habitantes >= S.habitantesUmbral){
    p.saneamientoActivo = true;
    recienSaneamiento = true;
  }
  let residual = 0;
  if(p.saneamientoActivo){
    const aguasResiduales = servido * S.fraccionResidual;
    residual = aguasResiduales * (1 - fraccionTratada(p));   // lo que llega crudo al cauce
  }

  crecer(p, servicio, dtHoras, frenoCrec);

  return {
    residual, recienSaneamiento,
    res: {
      servicio, demandaAhora: dem * punta, punta, estiaje,
      prodLps: dt > 0 ? entrada / dt : 0,
      produciendo: entrada > 0.0001,
      bombeoAuto: prodAuto > 0.0001,
      averiada: !!p.averia,
      saneamiento: p.saneamientoActivo
    }
  };
}

/**
 * Avanza TODA la mancomunidad `dt` segundos reales. Devuelve el resultado
 * efímero del pueblo ACTIVO más los datos comunes (cauce, multa).
 */
export function avanzar(estado, dt){
  const eco = CONFIG.economia, K = CONFIG.cauce;
  const dtHoras = dt * eco.horasPorSegundo;
  const punta = coefHora(estado.horas);
  const estiaje = factorEstiaje(estado.horas);
  const suciedad = estado.contaminacion / K.contaminacionMax;   // 0..1
  const frenoCrec = 1 - suciedad * K.frenoCrecimiento;

  let totalResidual = 0;
  let activoRes = null;
  const saneamientoNuevo = [];

  for(let i = 0; i < estado.pueblos.length; i++){
    const p = estado.pueblos[i];
    if(!p.desbloqueado) continue;
    const out = avanzarPueblo(estado, p, dt, dtHoras, punta, estiaje, frenoCrec);
    totalResidual += out.residual;
    if(out.recienSaneamiento) saneamientoNuevo.push(p.nombre);
    if(i === estado.puebloActivo) activoRes = out.res;
  }

  // Cauce común: sube con el vertido crudo, baja solo poco a poco
  estado.contaminacion = Math.max(0, Math.min(K.contaminacionMax,
    estado.contaminacion + totalResidual * K.porLitroResidual - K.recuperacionNatural * dtHoras));

  // Multa por contaminación (a la caja común)
  const multa = (estado.contaminacion / K.contaminacionMax) * K.multaMaxPorHora * dtHoras;
  estado.dinero -= multa;

  estado.horas += dtHoras;

  return {
    ...(activoRes || { servicio: 0, prodLps: 0, produciendo: false,
                       bombeoAuto: false, averiada: false, punta, estiaje }),
    contaminacion: estado.contaminacion,
    suciedad,
    multa,
    frenoCrec,
    saneamientoNuevo
  };
}

/** Crecimiento / despoblación de un pueblo. El freno del cauce reduce lo que crece. */
function crecer(p, servicio, dtHoras, frenoCrec){
  const P = CONFIG.poblacion;
  const años = dtHoras / CONFIG.tiempo.horasPorAño;

  if(servicio >= P.servicioBueno){
    p.racha += dtHoras;
    if(p.racha >= P.horasBuenServicioParaCrecer){
      p.habitantes = Math.min(P.habitantesMax,
        p.habitantes * (1 + P.tasaCrecimientoAnual * frenoCrec * años));
    }
  } else if(servicio < P.servicioMalo){
    p.racha = 0;
    p.habitantes = Math.max(P.habitantesMin,
      p.habitantes * (1 + P.tasaDeclineAnual * años));
  }
}
