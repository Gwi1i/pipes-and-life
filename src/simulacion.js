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
import { limitar } from './util.js';
import { inventarioConectado, cuelloDeBotella } from './mapa.js';

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

/**
 * Piezas conectadas al pueblo por tubería. Se calcula una vez por fotograma y
 * se cachea en el estado: recorrer la red en cada consulta sería absurdo.
 * Si no hay estado (llamadas sueltas desde la UI), se supone que no hay nada.
 */
function piezas(estado){ return (estado && estado._conectado) || {}; }

/**
 * El diámetro que MANDA en la conducción del pueblo: el del tramo más estrecho.
 * Igual que `_conectado`, se cachea una vez por paso porque lo consultan el
 * caudal, las fugas y el crecimiento.
 *
 * Sin estado (llamadas sueltas de la UI) se supone la red heredada, que es lo
 * que hay antes de tender nada.
 */
export function redDelPueblo(estado, red = 'abastecimiento'){
  const cacheada = estado && (estado._redes || {})[red];
  return cacheada || { def: CONFIG.tuberia.diametros[0], lineas: [], estrechas: 0 };
}

/** Piezas conectadas a una red concreta del mapa. */
export function piezasDeRed(estado, red){
  return (estado && (estado._conectadoRed || {})[red]) || {};
}
function piezasSan(estado){ return piezasDeRed(estado, 'saneamiento'); }

/**
 * ¿Tiene el pueblo este servicio en marcha? Única puerta de entrada: si algún
 * día un servicio se activa por otra cosa (un hito, una compra), se cambia aquí
 * y no en los diez sitios que preguntan.
 */
export function servicioActivo(pueblo, clave){
  return !!(pueblo.servicios && pueblo.servicios[clave] && pueblo.servicios[clave].activo);
}

/**
 * Abre los servicios que ya toquen. Devuelve los que se acaban de abrir, para
 * poder anunciarlos. `estado` hace falta para los que dependen de un hito de la
 * mancomunidad y no del tamaño del pueblo.
 */
export function abrirServicios(pueblo, estado){
  const nuevos = [];
  for(const [clave, def] of Object.entries(CONFIG.servicios)){
    if(servicioActivo(pueblo, clave)) continue;
    const porTamano = def.activaEnHabitantes != null && pueblo.habitantes >= def.activaEnHabitantes;
    const porHito = def.requiere === 'pluviales' && estado.pluvialesActivas;
    if(!porTamano && !porHito) continue;
    pueblo.servicios[clave] = { activo: true };
    nuevos.push(clave);
  }
  return nuevos;
}

/**
 * Lo que cabe por el COLECTOR, en L/h. Aquí el cuello de botella duele distinto
 * que en el abastecimiento: lo que no cabe no es agua que deja de llegar, es
 * agua sucia que se sale y va al río tal cual.
 */
export function capacidadColector(estado){
  return redDelPueblo(estado, 'saneamiento').def.caudalMax
       * CONFIG.saneamiento.holguraColector * 3600;
}

/**
 * Lo que se lleva la red de PLUVIALES, en L/h. Si no la has tendido devuelve
 * cero, y ahí está la diferencia con el colector: el saneamiento tiene una red
 * unitaria vieja de la que tirar, pero separar la lluvia no lo hace nadie por
 * ti. Sin red de pluviales, la tormenta entera se va por el colector.
 */
export function capacidadPluviales(estado){
  const red = redDelPueblo(estado, 'pluviales');
  if(!red.lineas || !red.lineas.length) return 0;
  return red.def.caudalMax * CONFIG.pluviales.holguraPluvial * 3600;
}

/**
 * Lo que se pierde por el camino. El fibrocemento viejo gotea: es la parte
 * antipática de no renovar, y la que hace que el salto de material se NOTE en
 * el contador de agua sin tener que leer ninguna cifra.
 */
export function rendimientoRed(estado){
  return 1 - redDelPueblo(estado).def.fugas;
}

export function litrosPorClic(pueblo, estado){
  const base = CONFIG.bomba.litrosPorClicBase
             + pueblo.mejoras.bomba * CONFIG.mejoras.bomba.incrementoLitros
             + (piezas(estado).bomba || 0) * CONFIG.aportePorPieza.bomba;
  return base * eficiencia(pueblo) * rendimientoRed(estado);
}

/** Engrasado a mano: lo que baja el desgaste por cada clic de mantenimiento. */
export function engrasar(pueblo){
  const antes = pueblo.desgaste || 0;
  pueblo.desgaste = Math.max(0, antes - CONFIG.desgaste.reparaPorClic);
  return antes - pueblo.desgaste;
}

export function capacidad(pueblo, estado){
  const extra = (piezas(estado).deposito || 0) * CONFIG.aportePorPieza.deposito;
  const n = pueblo.mejoras.deposito;
  if(n === 0) return CONFIG.bomba.bufferSinDeposito + extra;
  return CONFIG.deposito.capacidadBase + (n - 1) * CONFIG.deposito.incrementoCapacidad + extra;
}

/**
 * Caudal que produce la captación... y que llega. Por mucha captación que
 * tengas, por la tubería cabe lo que cabe: el tramo más estrecho tapa el resto.
 * Es el motivo de renovar la conducción y no seguir comprando bombas.
 */
export function caudalCaptacion(pueblo, estado){
  const bruto = pueblo.mejoras.captacion * CONFIG.mejoras.captacion.caudalPorNivel
              + (piezas(estado).captacion || 0) * CONFIG.aportePorPieza.captacion;
  const red = redDelPueblo(estado);
  return Math.min(bruto, red.def.caudalMax) * rendimientoRed(estado);
}

/** ¿Está la tubería estrangulando la captación? Para poder avisar en la UI. */
export function redEstrangula(pueblo, estado){
  const bruto = pueblo.mejoras.captacion * CONFIG.mejoras.captacion.caudalPorNivel
              + (piezas(estado).captacion || 0) * CONFIG.aportePorPieza.captacion;
  return bruto > redDelPueblo(estado).def.caudalMax + 1e-9;
}

export function clicsAutoPorSeg(pueblo){
  return pueblo.autobombaActivo ? CONFIG.premium.autobomba.clicsPorSeg : 0;
}

/**
 * Cómo de limpia sale el agua tratada (0..máx). Cuenta el nivel de la tienda Y
 * las depuradoras del mapa: si solo contara el nivel, una planta construida
 * junto al río haría pasar el agua por dentro y la devolvería igual de sucia.
 */
export function fraccionTratada(pueblo, estado){
  const d = CONFIG.mejoras.depuradora;
  return Math.min(d.fraccionMax,
    pueblo.mejoras.depuradora * d.fraccionPorNivel
    + (piezasSan(estado).depuradora || 0) * CONFIG.aportePorPieza.depuradoraCalidad);
}

/**
 * Caudal máximo que se puede tratar, en L/h. Lo que exceda se alivia.
 * La tienda sube el NIVEL de la depuradora; el mapa dice CUÁNTAS tienes
 * enganchadas al colector. Una depuradora preciosa junto al río, sin colector
 * que le lleve el agua sucia, no trata absolutamente nada.
 */
export function capacidadTratamiento(pueblo, estado){
  return pueblo.mejoras.depuradora * CONFIG.mejoras.depuradora.caudalPorNivel
       + (piezasSan(estado).depuradora || 0) * CONFIG.aportePorPieza.depuradora;
}

/** Fracción de escorrentía que separa la MEJORA de pluviales (la de la tienda). */
export function fraccionSeparada(pueblo){
  const r = CONFIG.mejoras.pluviales;
  return Math.min(r.fraccionMax, pueblo.mejoras.pluviales * r.fraccionPorNivel);
}

/** Litros que puede retener el tanque de tormentas. */
export function capacidadTanque(pueblo, estado){
  return pueblo.mejoras.tanque * CONFIG.mejoras.tanque.capacidadPorNivel
       // El tanque de tormentas vive en la red de PLUVIALES, no en el colector:
       // su trabajo es cortar la punta de lluvia antes de que llegue abajo.
       + (piezasDeRed(estado, 'pluviales').tanque || 0) * CONFIG.aportePorPieza.tanque;
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

/**
 * PODER DE EXPANSIÓN — lo que enlaza el mapa con el juego de abastecer.
 *
 * Sale de lo bien que lleves tu red: población servida, nivel de servicio,
 * desgaste de la maquinaria y averías pendientes. Divide el coste en clics de
 * destapar casillas, así que cuidar la instalación no solo produce más agua:
 * también abre territorio. Y al revés: si desatiendes el servicio, explorar se
 * pone cuesta arriba.
 */
export function poderExpansion(estado){
  const E = CONFIG.expansion;
  let hab = 0, servicio = 0, desgaste = 0, n = 0;
  // Las averías ya no son del pueblo sino de las piezas del mapa: basta con que
  // haya alguna sin reparar para que explorar cueste más.
  const averiado = (estado.averias || []).length > 0;
  for(const p of estado.pueblos){
    if(!p.desbloqueado) continue;
    hab += p.habitantes;
    servicio += p.servicio;
    desgaste += p.desgaste || 0;
    n++;
  }
  if(n === 0) return 1;

  // La población de partida es el listón: crecer por encima es lo que premia
  const porPoblacion = 1 + Math.log2(1 + hab / E.habitantesReferencia) * E.factorPoblacion;
  const porServicio = Math.max(E.servicioMinimo, servicio / n);
  const porDesgaste = 1 - (desgaste / n) * E.penalizacionDesgaste;
  const porAveria = averiado ? E.penalizacionAveria : 1;

  return limitar(porPoblacion * porServicio * porDesgaste * porAveria,
                 E.poderMin, E.poderMax);
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
export function bombear(pueblo, estado){
  const cap = capacidad(pueblo, estado);
  const antes = pueblo.agua;
  pueblo.desgaste = Math.min(1, (pueblo.desgaste || 0) + CONFIG.desgaste.porClic);
  pueblo.agua = Math.min(cap, pueblo.agua + litrosPorClic(pueblo, estado));
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
  const cap = capacidad(p, estado);
  // Ya no hay un "pueblo averiado": lo que se rompe es una pieza concreta, y su
  // castigo es dejar de contar como conectada (lo hace `construccionesConectadas`).
  // Así la avería se paga justo en lo que esa pieza aportaba, no en un porcentaje
  // suelto que no se sabía de dónde salía.

  // Entrada: producción pasiva (parada si hay avería)
  // La instalación se gasta con el tiempo; el personal de mantenimiento lo frena
  const D = CONFIG.desgaste;
  p.desgaste = Math.min(1, (p.desgaste || 0) +
    D.porHoraJuego * dtHoras * Math.pow(D.frenoPorNivelMant, p.mejoras.mantenimiento));

  const ef = eficiencia(p);
  const prodCaptacion = caudalCaptacion(p, estado) * estiaje * ef * 3600 * dtHoras;
  const prodAuto = clicsAutoPorSeg(p) * litrosPorClic(p, estado) * dt;
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
  const serviciosNuevos = abrirServicios(p, estado);
  const recienSaneamiento = serviciosNuevos.includes('saneamiento');
  let residual = 0, alivio = 0, aprovechado = 0, reboseColector = 0, cargaBruta = 0;
  let lluviaBruta = 0, lluviaSeparada = 0;
  if(servicioActivo(p, 'saneamiento')){
    // 1. Lo que entra al colector: aguas residuales + la lluvia NO separada.
    const aguasResiduales = servido * S.fraccionResidual;
    const escorrentia = p.habitantes * CONFIG.lluvia.litrosPorHabHora * lluvia * dtHoras;
    // Lo que se saca del colector: lo que separa la mejora de la tienda MÁS lo
    // que se lleva la red de pluviales del mapa, sin pasar de lo que llueve.
    const separada = Math.min(escorrentia,
      escorrentia * fraccionSeparada(p) + capacidadPluviales(estado) * dtHoras);
    lluviaBruta = escorrentia; lluviaSeparada = separada;
    // La red de pluviales, además de aliviar el colector, recoge agua limpia
    aprovechado = separada * CONFIG.pluviales.fraccionAprovechada;
    if(aprovechado > 0) p.agua = Math.min(cap, p.agua + aprovechado);
    let carga = aguasResiduales + (escorrentia - separada);

    // 2. EL COLECTOR. Por el tubo cabe lo que cabe: lo que no entra ni siquiera
    //    llega a la depuradora, se sale antes y va al río tal cual. Aquí el
    //    cuello de botella no es "llega menos agua", es "se desborda".
    cargaBruta = carga;
    const cabe = capacidadColector(estado) * dtHoras;
    reboseColector = Math.max(0, carga - cabe);
    carga -= reboseColector;

    // 3. La depuradora trata hasta su caudal máximo; el resto es exceso.
    const capacidadPaso = capacidadTratamiento(p, estado) * dtHoras;
    let aTratar = Math.min(carga, capacidadPaso);
    let exceso = carga - aTratar;

    // 4. El tanque de tormentas retiene el exceso; si sobra capacidad de
    //    tratamiento, se vacía poco a poco hacia la depuradora. Es exactamente
    //    para lo que sirve uno de verdad: cortar la punta y tratarla luego.
    if(exceso > 0){
      const hueco = Math.max(0, capacidadTanque(p, estado) - p.tanqueAgua);
      const retenido = Math.min(exceso, hueco);
      p.tanqueAgua += retenido;
      exceso -= retenido;
    } else {
      const libre = capacidadPaso - carga;
      const vaciado = Math.min(p.tanqueAgua, libre);
      p.tanqueAgua -= vaciado;
      aTratar += vaciado;
    }

    // 5. Lo tratado sale casi limpio; lo aliviado va crudo al cauce. El rebose
    //    del colector cuenta igual: al río no le importa por dónde se ha salido.
    alivio = exceso + reboseColector;
    residual = aTratar * (1 - fraccionTratada(p, estado)) + alivio;
  }

  const topeRed = redDelPueblo(estado).def.habitantesMax;
  crecer(p, servicio, dtHoras, frenoCrec, calidadServicio(p), topeRed);

  return {
    residual, recienSaneamiento,
    res: {
      servicio, demandaAhora: dem * punta, punta, estiaje,
      prodLps: dt > 0 ? entrada / dt : 0,
      produciendo: entrada > 0.0001,
      bombeoAuto: prodAuto > 0.0001,
      averiada: (estado.averias || []).length > 0,
      desgaste: p.desgaste || 0,
      eficiencia: ef,
      saneamiento: servicioActivo(p, 'saneamiento'),
      lluvia, aliviando: alivio > 0.0001,
      // Se distingue el rebose del colector del alivio de la depuradora: son
      // dos averías distintas y se arreglan en sitios distintos del mapa.
      rebosando: reboseColector > 0.0001,
      // Cuánto llega al colector, en L/h: sin este número la UI no puede decir
      // si el tapón está en la tubería o en la depuradora.
      cargaLh: dtHoras > 0 ? cargaBruta / dtHoras : 0,
      lluviaLh: dtHoras > 0 ? lluviaBruta / dtHoras : 0,
      separadaLh: dtHoras > 0 ? lluviaSeparada / dtHoras : 0,
      tanqueFrac: capacidadTanque(p, estado) > 0 ? p.tanqueAgua / capacidadTanque(p, estado) : 0,
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
  // Qué hay enganchado a la red AHORA. Se cachea aquí, una vez por paso: cada
  // consulta de capacidad o caudal la usa, y recorrer la red en todas sería
  // absurdo. Una pieza sin tubería al pueblo no cuenta.
  // Qué hay enganchado a CADA red y por qué diámetro pasa. Se recorre una vez
  // por paso: cada consulta de capacidad, caudal o tratamiento lo usa. Hoy las
  // redes son comunes (salen todas del pueblo de origen); cuando cada pueblo
  // tenga las suyas, esto pasará a calcularse por pueblo.
  estado._conectadoRed = {};
  estado._redes = {};
  for(const clave of Object.keys(CONFIG.redes)){
    estado._conectadoRed[clave] = inventarioConectado(estado, clave);
    estado._redes[clave] = cuelloDeBotella(estado, clave);
  }
  // Atajos para lo que se consulta a todas horas
  estado._conectado    = estado._conectadoRed.abastecimiento;
  estado._conectadoSan = estado._conectadoRed.saneamiento;
  estado._red          = estado._redes.abastecimiento;
  estado._redSan       = estado._redes.saneamiento;
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
 *
 * `topeRed` es el techo que pone el DIÁMETRO de la conducción. Un pueblo no
 * crece más allá de lo que su tubería puede darle de beber: se estanca, no se
 * castiga. Ese estancamiento es la señal de que toca renovar la red.
 */
function crecer(p, servicio, dtHoras, frenoCrec, calidad = 1, topeRed = Infinity){
  const P = CONFIG.poblacion;
  const años = dtHoras / CONFIG.tiempo.horasPorAño;
  const tope = Math.min(P.habitantesMax, topeRed);

  if(servicio >= P.servicioBueno){
    p.racha += dtHoras;
    if(p.racha >= P.horasBuenServicioParaCrecer){
      const crecido = p.habitantes * (1 + P.tasaCrecimientoAnual * frenoCrec * calidad * años);
      // El tope FRENA, no encoge: si una partida vieja ya estaba por encima, no
      // se le despuebla el pueblo de golpe por haber cambiado la regla.
      p.habitantes = Math.max(p.habitantes, Math.min(tope, crecido));
    }
  } else if(servicio < P.servicioMalo){
    p.racha = 0;
    p.habitantes = Math.max(P.habitantesMin,
      p.habitantes * (1 + P.tasaDeclineAnual * años));
  }
}
