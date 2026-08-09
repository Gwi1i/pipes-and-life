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
  const frac = ((horas % T.horasPorAño) / T.horasPorAño + 1) % 1;
  // El desfase de 1/8 de año alinea el MÍNIMO con la mitad del verano (frac
  // 0,375) y el máximo con el deshielo de finales de invierno. Sin él, el
  // estiaje mínimo caía al empezar el otoño: el panel decía "verano" mientras
  // la escena ya llovía y tenía el follaje ocre.
  const t = (Math.cos((frac + 0.125) * Math.PI * 2) + 1) / 2;
  return e.factorMin + (e.factorMax - e.factorMin) * t;
}

/** Nombre de la estación actual, tomado de la misma tabla que usa la escena. */
export function nombreEstacion(horas){
  const E = CONFIG.estaciones, T = CONFIG.tiempo;
  const frac = ((horas % T.horasPorAño) / T.horasPorAño + 1) % 1;
  return E[Math.floor(frac * E.length) % E.length].nombre;
}

/**
 * Rendimiento de la instalación según su desgaste (1 = a estrenar). Afecta al
 * clic Y a la producción pasiva: si no la cuidas, todo rinde menos.
 */
export function eficiencia(pueblo){
  return 1 - (pueblo.desgaste || 0) * CONFIG.desgaste.efectoMax;
}

export function litrosPorClic(pueblo){
  const base = CONFIG.bomba.litrosPorClicBase +
               pueblo.mejoras.bomba * CONFIG.mejoras.bomba.incrementoLitros;
  return base * eficiencia(pueblo);
}

/** Engrasado a mano: lo que baja el desgaste por cada clic de mantenimiento. */
export function engrasar(pueblo){
  const antes = pueblo.desgaste || 0;
  pueblo.desgaste = Math.max(0, antes - CONFIG.desgaste.reparaPorClic);
  return antes - pueblo.desgaste;
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

/** Caudal máximo que la depuradora puede tratar, en L/h. Lo que exceda se alivia. */
export function capacidadTratamiento(pueblo){
  return pueblo.mejoras.depuradora * CONFIG.mejoras.depuradora.caudalPorNivel;
}

/** Fracción de escorrentía de lluvia que la red de pluviales saca del colector. */
export function fraccionSeparada(pueblo){
  const r = CONFIG.mejoras.pluviales;
  return Math.min(r.fraccionMax, pueblo.mejoras.pluviales * r.fraccionPorNivel);
}

/** Litros que puede retener el tanque de tormentas. */
export function capacidadTanque(pueblo){
  return pueblo.mejoras.tanque * CONFIG.mejoras.tanque.capacidadPorNivel;
}

/**
 * Intensidad de lluvia (0..1) según la estación. Usa la misma fórmula de fase
 * que la escena, así lo que ves llover es exactamente lo que moja la ciudad.
 */
export function factorLluvia(horas){
  const L = CONFIG.lluvia.porEstacion, T = CONFIG.tiempo;
  const frac = ((horas % T.horasPorAño) / T.horasPorAño + 1) % 1;
  return L[Math.floor(frac * L.length) % L.length];
}

/** Calidad del pueblo (multiplica el crecimiento): la sube el saneamiento fino. */
export function calidadServicio(pueblo){
  const Q = CONFIG.calidad;
  return Math.min(Q.max, Q.base
    + pueblo.mejoras.tanque * Q.bonusTanque
    + pueblo.mejoras.pluviales * Q.bonusPluviales);
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
  pueblo.desgaste = Math.min(1, (pueblo.desgaste || 0) + CONFIG.desgaste.porClic);
  pueblo.agua = Math.min(cap, pueblo.agua + litrosPorClic(pueblo));
  return pueblo.agua - antes;
}

/* ---------------- AVANCE ---------------- */

/**
 * Avanza UN pueblo `dt` segundos reales. Muta el pueblo y la caja común.
 * Devuelve { residual, res } donde `residual` son los litros crudos que vierte
 * al cauce (ya descontada su depuradora) y `res` es el estado efímero para pintar.
 */
function avanzarPueblo(estado, p, dt, dtHoras, punta, estiaje, frenoCrec, lluvia){
  const S = CONFIG.saneamiento;
  const cap = capacidad(p);
  const factorAveria = p.averia ? (1 - CONFIG.averias.recorteProduccion) : 1;

  // Entrada: producción pasiva (parada si hay avería)
  // La instalación se gasta con el tiempo; el personal de mantenimiento lo frena
  const D = CONFIG.desgaste;
  p.desgaste = Math.min(1, (p.desgaste || 0) +
    D.porHoraJuego * dtHoras * Math.pow(D.frenoPorNivelMant, p.mejoras.mantenimiento));

  const ef = eficiencia(p);
  const prodCaptacion = caudalCaptacion(p) * estiaje * ef * factorAveria * 3600 * dtHoras;
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
  let residual = 0, alivio = 0, aprovechado = 0;
  if(p.saneamientoActivo){
    // 1. Lo que entra al colector: aguas residuales + la lluvia NO separada.
    const aguasResiduales = servido * S.fraccionResidual;
    const escorrentia = p.habitantes * CONFIG.lluvia.litrosPorHabHora * lluvia * dtHoras;
    const separada = escorrentia * fraccionSeparada(p);
    // La red de pluviales, además de aliviar el colector, recoge agua limpia
    aprovechado = separada * CONFIG.pluviales.fraccionAprovechada;
    if(aprovechado > 0) p.agua = Math.min(cap, p.agua + aprovechado);
    let carga = aguasResiduales + (escorrentia - separada);

    // 2. La depuradora trata hasta su caudal máximo; el resto es exceso.
    const capacidadPaso = capacidadTratamiento(p) * dtHoras;
    let aTratar = Math.min(carga, capacidadPaso);
    let exceso = carga - aTratar;

    // 3. El tanque de tormentas retiene el exceso; si sobra capacidad de
    //    tratamiento, se vacía poco a poco hacia la depuradora. Es exactamente
    //    para lo que sirve uno de verdad: cortar la punta y tratarla luego.
    if(exceso > 0){
      const hueco = Math.max(0, capacidadTanque(p) - p.tanqueAgua);
      const retenido = Math.min(exceso, hueco);
      p.tanqueAgua += retenido;
      exceso -= retenido;
    } else {
      const libre = capacidadPaso - carga;
      const vaciado = Math.min(p.tanqueAgua, libre);
      p.tanqueAgua -= vaciado;
      aTratar += vaciado;
    }

    // 4. Lo tratado sale casi limpio; lo aliviado va crudo al cauce.
    alivio = exceso;
    residual = aTratar * (1 - fraccionTratada(p)) + alivio;
  }

  crecer(p, servicio, dtHoras, frenoCrec, calidadServicio(p));

  return {
    residual, recienSaneamiento,
    res: {
      servicio, demandaAhora: dem * punta, punta, estiaje,
      prodLps: dt > 0 ? entrada / dt : 0,
      produciendo: entrada > 0.0001,
      bombeoAuto: prodAuto > 0.0001,
      averiada: !!p.averia,
      desgaste: p.desgaste || 0,
      eficiencia: ef,
      saneamiento: p.saneamientoActivo,
      lluvia, aliviando: alivio > 0.0001,
      tanqueFrac: capacidadTanque(p) > 0 ? p.tanqueAgua / capacidadTanque(p) : 0,
      aprovechadoLh: dtHoras > 0 ? aprovechado / dtHoras : 0,
      calidad: calidadServicio(p)
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
  const lluvia = factorLluvia(estado.horas);

  let totalResidual = 0;
  let activoRes = null;
  const saneamientoNuevo = [];

  for(let i = 0; i < estado.pueblos.length; i++){
    const p = estado.pueblos[i];
    if(!p.desbloqueado) continue;
    const out = avanzarPueblo(estado, p, dt, dtHoras, punta, estiaje, frenoCrec, lluvia);
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
                       bombeoAuto: false, averiada: false, punta, estiaje,
                       lluvia, aliviando: false, tanqueFrac: 0, calidad: 1 }),
    contaminacion: estado.contaminacion,
    suciedad,
    multa,
    frenoCrec,
    lluvia,
    saneamientoNuevo
  };
}

/**
 * Crecimiento / despoblación de un pueblo. El freno del cauce reduce lo que
 * crece; la calidad (pluviales y tanque de tormentas) lo empuja.
 */
function crecer(p, servicio, dtHoras, frenoCrec, calidad = 1){
  const P = CONFIG.poblacion;
  const años = dtHoras / CONFIG.tiempo.horasPorAño;

  if(servicio >= P.servicioBueno){
    p.racha += dtHoras;
    if(p.racha >= P.horasBuenServicioParaCrecer){
      p.habitantes = Math.min(P.habitantesMax,
        p.habitantes * (1 + P.tasaCrecimientoAnual * frenoCrec * calidad * años));
    }
  } else if(servicio < P.servicioMalo){
    p.racha = 0;
    p.habitantes = Math.max(P.habitantesMin,
      p.habitantes * (1 + P.tasaDeclineAnual * años));
  }
}
