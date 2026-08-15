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
import { inventarioConectado, cuelloDeBotella, construccionesConectadas,
         celdaEn, nombreDeNucleo, tipoYacimiento, claseAcuifero,
         masasDelMapa, fugasDe } from './mapa.js';
import { nivelVentaja } from './legado.js';
// Solo para los TEXTOS de los requisitos del auto-bombeo: la etiqueta t los
// traduce sin sacarlos de aquí. La lógica no depende del idioma para nada.
import { t } from './idioma.js';

/* ---------------- HELPERS POR PUEBLO ---------------- */

export function demandaMedia(habitantes){
  return habitantes * CONFIG.poblacion.litrosHabitanteDia / 86400;
}

/**
 * En qué ESCALÓN de caserío está un pueblo por su población: 0 aldea, 1
 * pueblo, 2 villa, 3 ciudad (`CONFIG.caserio.escalones`).
 *
 * Vive aquí, en un solo sitio, porque lo usan dos módulos que no se hablan: la
 * escena para saber cuántas casas pintar y `main.js` para anunciar el cambio.
 * Duplicar la cuenta acabaría con un pueblo dibujado como villa mientras el
 * aviso dice otra cosa — el fallo clásico de este proyecto con `demandaMedia`.
 */
export function nivelCaserio(habitantes){
  const esc = CONFIG.caserio.escalones;
  for(let i = 0; i < esc.length; i++) if(habitantes < esc[i].hasta) return i;
  return esc.length - 1;
}

export function escalonCaserio(habitantes){
  return CONFIG.caserio.escalones[nivelCaserio(habitantes)];
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
 * Rendimiento de la instalación. Hubo un contador de DESGASTE que bajaba solo y
 * se subía con un botón de ENGRASAR: dos mecánicas de mantenimiento a la vez, y
 * la abstracta —un número oculto y un botonazo— no significaba nada. El
 * mantenimiento del juego son las AVERÍAS, que tienen sitio en el mapa y se
 * arreglan yendo allí. Esto se queda como gancho por si algún día algo vuelve a
 * mermar el rendimiento.
 */
export function eficiencia(pueblo){
  return 1;
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

/**
 * LA FASE de la mancomunidad: 1 al empezar, y sube al cruzar cada umbral de
 * pueblos incorporados (5, 10, 15...). El anillo N del mapa solo se puede
 * incorporar en fase >= N: es lo que hace la dificultad exponencial sin tocar
 * ningún multiplicador — cada salto exige más pueblos, y los siguientes están
 * más lejos y en peor terreno.
 */
export function faseActual(estado){
  const n = estado.pueblos.length;
  return 1 + CONFIG.fases.umbrales.filter(u => n >= u).length;
}

/** Cuántos pueblos faltan para abrir el siguiente anillo, o null si no hay más. */
export function faltanParaFase(estado){
  const n = estado.pueblos.length;
  const u = CONFIG.fases.umbrales.find(x => n < x);
  return u == null ? null : u - n;
}

/** Lo que cuesta absorber el SIGUIENTE núcleo: geométrico con el tamaño.
 *  La Fama del legado rebaja SOLO el primero de cada comarca: abre la puerta
 *  antes, pero no toca la palanca que hace la dificultad exponencial. */
export function canonIncorporacion(estado){
  const N = CONFIG.nucleos;
  const base = Math.round(N.canonBase * Math.pow(N.canonFactor, estado.pueblos.length - 1));
  if(estado.pueblos.length === 1){
    const V = CONFIG.comarcas.ventajas.fama;
    const rebaja = Math.min(0.9, nivelVentaja('fama') * V.descuentoPrimerCanon);
    return Math.round(base * (1 - rebaja));
  }
  return base;
}

/** El estudio hidrogeológico, con el Ojo clínico del legado aplicado.
 *  ÚNICA cuenta del precio: la UI y la acción beben de aquí. */
export function costeEstudio(){
  const V = CONFIG.comarcas.ventajas.ojoClinico;
  const rebaja = Math.min(0.9, nivelVentaja('ojoClinico') * V.descuento);
  return Math.round(CONFIG.acuiferos.estudio.coste * (1 - rebaja));
}

/**
 * La veteranía que darían los pueblos de HOY al trasladarse: cada uno según
 * su escalón, y solo si está razonablemente atendido — llevarse mérito de un
 * pueblo sediento sería un timo. Es la cuenta ÚNICA: la usan el panel (para
 * enseñar qué ganarías) y el traslado (para pagarlo de verdad).
 */
export function veteraniaAlTrasladarse(estado){
  const K = CONFIG.comarcas;
  let total = 0;
  for(const p of estado.pueblos){
    if(!p.desbloqueado || (p.servicio || 0) < K.servicioMinimo) continue;
    total += K.veteraniaPorEscalon[nivelCaserio(p.habitantes)];
  }
  return total;
}

/**
 * Incorpora el núcleo de esa casilla a la mancomunidad. No comprueba red ni
 * fase: eso es cosa de quien llama (la acción de la UI o el bot de medida).
 * Devuelve el pueblo nuevo.
 */
export function incorporarPueblo(estado, col, fila, celda){
  const pueblo = {
    nombre: nombreDeNucleo(celda.nombreIdx || 0),
    habitantes: celda.habIni || CONFIG.nucleos.habitantesMin,
    col, fila,
    desbloqueado: true,
    agua: 0, servicio: 0, abastecida: false, racha: 0,
    mejoras: Object.fromEntries(Object.keys(CONFIG.mejoras).map(k => [k, 0])),
    servicios: Object.fromEntries(Object.entries(CONFIG.servicios)
      .map(([k, d]) => [k, { activo: !!d.siempre }])),
    autobombaActivo: false, tanqueAgua: 0, basuraCalle: 0
  };
  celda.resuelto = true;
  estado.pueblos.push(pueblo);
  // La competencia de pluviales llega con la mancomunidad ya rodada
  if(estado.pueblos.length >= CONFIG.pluviales.abreConPueblos) estado.pluvialesActivas = true;
  return pueblo;
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
    const porHito = (def.requiere === 'pluviales' && estado.pluvialesActivas)
                 || (def.requiere === 'residuos' && pueblo.habitantes >= CONFIG.residuos.activaEnHabitantes);
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

/* ---------------- RESIDUOS ---------------- */

/**
 * Cuántos yacimientos hay excavados. Se recorre el mapa entero una vez por paso;
 * son mil casillas y una comprobación tonta, sale más barato que mantener otra
 * lista sincronizada a mano.
 */
export function yacimientosExcavados(estado){
  let n = 0;
  for(const celda of estado.mapa) if(celda.excavado) n++;
  return n;
}

/** La renta conjunta de los yacimientos puestos en valor, €/h. Cada tipo la suya. */
export function rentaYacimientos(estado){
  let euros = 0;
  for(const celda of estado.mapa)
    if(celda.excavado) euros += tipoYacimiento(celda).renta;
  return euros;
}

/** Basura que genera el pueblo, en toneladas por hora de juego. */
export function basuraGenerada(pueblo){
  return pueblo.habitantes * CONFIG.residuos.kgPorHabitanteDia / 1000 / 24;
}

/**
 * Lo que la CARRETERA es capaz de sacar del pueblo, en t/h. Sin vía tendida no
 * sale nada: a diferencia del saneamiento, aquí no hay ninguna red heredada de
 * la que tirar. Si no hay por dónde pasar el camión, la basura se queda.
 */
export function capacidadRecogida(estado){
  const red = redDelPueblo(estado, 'residuos');
  if(!red.lineas || !red.lineas.length) return 0;
  // El bono de la RUTA DEL CAMIÓN (minijuego, desde el vertedero): una ruta
  // bien echada saca más basura con la misma vía, durante una temporada.
  const bono = estado.rutaCamion && estado.horas < estado.rutaCamion.hasta
    ? estado.rutaCamion.factor : 1;
  return red.def.caudalMax * (1 - red.def.fugas) * bono;
}

/** Los vertederos enganchados a la carretera, con su llenado y su nivel. */
export function vertederosConectados(estado){
  return construccionesConectadas(estado, 'residuos').filter(o => o.tipo === 'vertedero');
}

/** Toneladas que le caben a un vertedero según su nivel. */
export function capacidadVaso(obra){
  const V = CONFIG.residuos.vertedero;
  return V.capacidadBase + ((obra.nivel || 1) - 1) * V.capacidadPorNivel;
}

/** Cuánto le queda de vida, de 0 (nuevo) a 1 (hasta arriba). */
export function llenadoVaso(obra){
  return Math.min(1, (obra.lleno || 0) / capacidadVaso(obra));
}

/** Lo que cuesta la siguiente ampliación de ese vertedero. */
export function costeAmpliarVertedero(obra){
  const V = CONFIG.residuos.vertedero;
  return Math.round(V.costeAmpliarBase * Math.pow(V.factorAmpliar, (obra.nivel || 1) - 1));
}

/**
 * Lo que tragan los vertederos, en t/h. Un vertedero LLENO no traga nada: deja
 * de contar y la basura se queda en la calle hasta que amplías o abres otro.
 */
export function capacidadVertido(estado){
  let t = 0;
  for(const v of vertederosConectados(estado))
    if(llenadoVaso(v) < 1) t += CONFIG.residuos.capacidadVertedero;
  return t;
}

/** Nivel efectivo de reciclaje: hace falta la mejora Y una planta conectada. */
export function nivelReciclaje(pueblo, estado){
  if(!(piezasDeRed(estado, 'residuos').reciclaje || 0)) return 0;
  return pueblo.mejoras.reciclaje || 0;
}

/**
 * Las fracciones que se están recuperando ahora mismo. El nivel de la planta va
 * abriendo contenedores: primero envases, luego orgánica, y así. El "resto" no
 * cuenta aquí porque no se recicla, se entierra.
 */
export function fraccionesActivas(pueblo, estado){
  const nivel = nivelReciclaje(pueblo, estado);
  return CONFIG.residuos.fracciones.filter(f => f.nivel > 0 && f.nivel <= nivel);
}

/**
 * Lo que se saca por vender lo reciclado, en € por tonelada recogida. Es la
 * segunda fuente de ingresos del juego: no se recicla por deber moral, se
 * recicla porque alguien te compra el material.
 */
/**
 * El bono del TURNO en la línea (minijuego): mientras dura, la venta de
 * reciclado sube según la puntería que hiciste. Es ventaja de quien juega,
 * nunca puerta: sin turno, la planta vende a su precio normal.
 */
export function factorTurnoReciclaje(estado){
  const t = estado && estado.turnoReciclaje;
  return (t && estado.horas < t.hasta) ? t.factor : 1;
}

export function precioMedioReciclaje(pueblo, estado){
  let euros = 0;
  for(const f of fraccionesActivas(pueblo, estado)) euros += f.parte * f.precio;
  return euros * CONFIG.residuos.escalaEconomica * factorTurnoReciclaje(estado);
}

/**
 * Reparte lo enterrado entre los vertederos con hueco. Se llena antes el que va
 * más vacío, que es lo que haría cualquiera: así los que abres nuevos alivian de
 * verdad al que estaba a punto de reventar.
 */
function llenarVertederos(estado, toneladas){
  const libres = vertederosConectados(estado)
    .filter(v => llenadoVaso(v) < 1)
    .sort((a, b) => llenadoVaso(a) - llenadoVaso(b));
  if(!libres.length) return;
  let queda = toneladas;
  for(const v of libres){
    const hueco = capacidadVaso(v) - (v.lleno || 0);
    const mete = Math.min(queda, hueco);
    v.lleno = (v.lleno || 0) + mete;
    queda -= mete;
    if(queda <= 0) break;
  }
}

/**
 * LIXIVIADOS. Un vertedero con carga gotea, y lo que gotea acaba en el agua que
 * tiene cerca: esa masa se vuelve insalubre (`celda.insalubre`, 0..1) y da menos
 * caudal. Es lo que castiga poner el vertedero al lado de tu propia captación.
 *
 * Muta el mapa y el cauce común, así que vive aquí y no en un helper de lectura.
 */
function lixiviar(estado, dtHoras){
  const V = CONFIG.residuos.vertedero;
  // OJO: aquí NO se filtra por conectados. Un vertedero con basura dentro gotea
  // esté o no enganchado a la carretera; si dependiera de la conexión, levantar
  // el último tramo de vía pararía la fuga por arte de magia.
  const vertederos = (estado.construcciones || [])
    .filter(o => o.tipo === 'vertedero' && (o.lleno || 0) > 0);
  if(!vertederos.length) return 0;

  let alCauce = 0;
  for(const v of vertederos){
    const carga = llenadoVaso(v);          // cuanto más lleno, más gotea
    const goteo = carga * V.lixiviadoPorHora * dtHoras;
    if(goteo <= 0) continue;
    for(let df = -V.radioContaminacion; df <= V.radioContaminacion; df++){
      for(let dc = -V.radioContaminacion; dc <= V.radioContaminacion; dc++){
        const celda = celdaEn(estado.mapa, v.col + dc, v.fila + df);
        if(!celda || (celda.tipo !== 'agua' && celda.tipo !== 'lago')) continue;
        const dist = Math.hypot(dc, df);
        if(dist > V.radioContaminacion) continue;
        // más cerca, más veneno
        const cerca = 1 - dist / (V.radioContaminacion + 1);
        celda.insalubre = Math.min(1, (celda.insalubre || 0) + goteo * cerca);
      }
    }
    alCauce += goteo * V.aporteCauce;
  }
  return alCauce;
}

/**
 * Cómo de envenenada está el agua que tomas: la media de las casillas donde
 * tienes captaciones. Recorta el caudal, porque un agua mala hay que tratarla
 * más y rinde menos.
 */
export function insalubridadCaptacion(estado){
  const tomas = (estado.construcciones || []).filter(o => o.tipo === 'captacion');
  if(!tomas.length) return 0;
  let suma = 0;
  for(const t of tomas){
    const celda = celdaEn(estado.mapa, t.col, t.fila);
    suma += (celda && celda.insalubre) || 0;
  }
  return suma / tomas.length;
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
 * La TASA de fugas de la red: la del material del cuello... o la de la línea
 * más VIEJA si es peor. Manda el tramo peor también en esto: una línea pasada
 * de vida útil sangra toda la red, y renovarla es lo que lo cura.
 */
export function tasaFugasRed(estado){
  const red = redDelPueblo(estado);
  let fugas = red.def.fugas;
  if(estado)
    for(const { tuberia } of red.lineas || [])
      fugas = Math.max(fugas, fugasDe(tuberia, estado.horas));
  return fugas;
}

/**
 * Lo que se pierde por el camino. El fibrocemento viejo gotea: es la parte
 * antipática de no renovar, y la que hace que el salto de material se NOTE en
 * el contador de agua sin tener que leer ninguna cifra.
 */
export function rendimientoRed(estado){
  return 1 - tasaFugasRed(estado);
}

export function litrosPorClic(pueblo, estado){
  const base = CONFIG.bomba.litrosPorClicBase
             + pueblo.mejoras.bomba * CONFIG.mejoras.bomba.incrementoLitros
             + (piezas(estado).bomba || 0) * CONFIG.aportePorPieza.bomba;
  return base * eficiencia(pueblo) * rendimientoRed(estado);
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
/* ---------------- EL AGUA SUBTERRÁNEA ---------------- */

/** El nivel de una masa de acuífero, 0..1. Sin tocar, está llena. */
export function nivelMasa(estado, masa){
  const v = (estado.acuiferos || {})[masa];
  return v === undefined ? 1 : v;
}

/**
 * Lo que da UN pozo, en L/s. Depende de tres cosas y las tres se ven en el
 * panel: la clase de acuífero, el año (estiaje) y lo bajo que esté el nivel.
 * Mientras el nivel esté por encima del umbral el pozo da lo suyo; por debajo,
 * cae en picado — hay que bombear desde más hondo hasta que ya no sale.
 */
export function caudalPozo(clase, nivel, estiaje = 1){
  const A = CONFIG.acuiferos;
  const merma = nivel >= A.umbralMerma ? 1 : nivel / A.umbralMerma;
  return clase.caudal * (1 - clase.sensibilidadEstiaje * (1 - estiaje)) * merma;
}

/** Los pozos CONECTADOS agrupados por masa: es la masa la que se agota. */
export function pozosPorMasa(estado){
  const porMasa = new Map();
  for(const obra of construccionesConectadas(estado, 'abastecimiento')){
    if(obra.tipo !== 'acuifero') continue;
    const celda = celdaEn(estado.mapa, obra.col, obra.fila);
    if(!celda || !celda.masa) continue;
    porMasa.set(celda.masa, (porMasa.get(celda.masa) || 0) + 1);
  }
  return porMasa;
}

/**
 * Lo que dan los POZOS conectados, en L/s. Cada uno rinde según la clase de
 * acuífero que tiene debajo, no según una cifra única: el de montaña casi no
 * nota el año seco y el aluvial sí, que es la diferencia que los hace elegibles.
 */
export function caudalAcuiferos(estado, estiaje = 1){
  const masas = masasDelMapa(estado.mapa);
  let total = 0;
  for(const [masa, pozos] of pozosPorMasa(estado)){
    const info = masas.get(masa);
    if(!info) continue;
    const clase = CONFIG.acuiferos.clases[info.clase];
    total += pozos * caudalPozo(clase, nivelMasa(estado, masa), estiaje);
  }
  return total;
}

/** Lo que ENTRA en una masa, en L/s. Es lluvia, así que en verano entra poco. */
export function recargaMasa(info, lluvia = 1){
  const A = CONFIG.acuiferos;
  const clase = CONFIG.acuiferos.clases[info.clase];
  return info.celdas * clase.recargaPorCelda
       * (A.recargaMinima + (1 - A.recargaMinima) * lluvia);
}

/**
 * El CAUDAL SOSTENIBLE de una masa: lo que se puede sacar año tras año sin
 * vaciarla. Es la recarga con la lluvia MEDIA del año, no con la de un día de
 * otoño — enseñar el máximo sería mentir, y es justo el error que hace que un
 * acuífero se sobreexplote creyendo que va sobrado.
 */
export function caudalSostenible(info){
  const P = CONFIG.lluvia.porEstacion;
  const media = P.reduce((a, b) => a + b, 0) / P.length;
  return recargaMasa(info, media);
}

/**
 * El balance del acuífero, una vez por paso. Sube el nivel si entra más de lo
 * que sale y lo baja si es al revés. Devuelve las masas que acaban de cruzar el
 * umbral de aviso, para poder contarlo UNA vez y no cada hora.
 */
export function tickAcuiferos(estado, dtHoras, lluvia, estiaje){
  const masas = masasDelMapa(estado.mapa);
  const pozos = pozosPorMasa(estado);
  if(!estado.acuiferos) estado.acuiferos = {};
  const A = CONFIG.acuiferos;
  const avisos = [];

  for(const [masa, info] of masas){
    const nPozos = pozos.get(masa) || 0;
    const nivel = nivelMasa(estado, masa);
    // Una masa llena y sin pozos no hace falta ni tocarla
    if(!nPozos && nivel >= 1) continue;
    const clase = CONFIG.acuiferos.clases[info.clase];
    const extraccion = nPozos * caudalPozo(clase, nivel, estiaje);
    const balance = recargaMasa(info, lluvia) - extraccion;
    const reserva = info.celdas * clase.reservaPorCelda;
    const nuevo = limitar(nivel + balance * dtHoras / reserva, 0, 1);
    if(nPozos && nivel >= A.avisoNivel && nuevo < A.avisoNivel)
      avisos.push({ masa, clase, pozos: nPozos });
    estado.acuiferos[masa] = nuevo;
  }
  return avisos;
}

/**
 * EL DESGLOSE de la producción: de dónde sale el agua y dónde se pierde, paso
 * a paso. Es la ÚNICA cuenta — `caudalCaptacion()` sale de aquí — porque si el
 * panel hiciera su propia versión acabarían contando dos verdades distintas,
 * que es exactamente lo que pasó una vez con la demanda.
 *
 * Existe porque el juego tiene cinco cosas capaces de mermar la producción a la
 * vez (estiaje, tubería, fugas, lixiviados, averías) y cuando el número del HUD
 * baja, el jugador necesita saber CUÁL ha sido. Sin esto, parece un fallo.
 */
export function desgloseProduccion(pueblo, estado, estiaje = 1){
  const rioBruto = pueblo.mejoras.captacion * CONFIG.mejoras.captacion.caudalPorNivel
                 + (piezas(estado).captacion || 0) * CONFIG.aportePorPieza.captacion;
  const rio = rioBruto * estiaje;
  const pozos = caudalAcuiferos(estado, estiaje);
  const red = redDelPueblo(estado);
  const entra = rio + pozos;
  const tope = Math.min(entra, red.def.caudalMax);
  const fugas = tope * tasaFugasRed(estado);
  const veneno = (tope - fugas) * insalubridadCaptacion(estado);
  // Piezas de abastecimiento PARADAS por avería: están en el mapa, conectadas,
  // y no aportan nada hasta que alguien vaya con la llave.
  const suyas = CONFIG.redes.abastecimiento.piezas;
  const paradas = (estado.averias || []).filter(a =>
    estado.construcciones.some(o => o.col === a.col && o.fila === a.fila
      && suyas.includes(o.tipo))).length;
  return {
    rioBruto, rio, pozos, entra,
    perdidaTope: entra - tope,
    fugas, veneno, paradas, red,
    neto: (tope - fugas) - veneno
  };
}

export function caudalCaptacion(pueblo, estado, estiaje = 1){
  // El estiaje se aplica por fuente, no fuera y a todo por igual: el río
  // baja en verano y el pozo casi no. Antes multiplicaba `avanzar()` al final,
  // que con una sola fuente daba lo mismo y con dos ya no.
  return desgloseProduccion(pueblo, estado, estiaje).neto;
}

/**
 * Lo que cuesta AMPLIAR una pieza del mapa al siguiente nivel: el precio de la
 * pieza por el factor elevado al nivel actual. Ampliar es más barato que
 * construir otra al principio y más caro después — la segunda unidad compite.
 */
export function costeAmpliarPieza(obra){
  const A = CONFIG.ampliacion;
  return Math.round(CONFIG.construibles[obra.tipo].coste
                    * Math.pow(A.factorCoste, obra.nivel || 1));
}

/** ¿Está la tubería estrangulando la captación? Para poder avisar en la UI. */
export function redEstrangula(pueblo, estado){
  return desgloseProduccion(pueblo, estado, 1).perdidaTope > 1e-9;
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
 * y averías pendientes. Divide el coste en clics de
 * destapar casillas, así que cuidar la instalación no solo produce más agua:
 * también abre territorio. Y al revés: si desatiendes el servicio, explorar se
 * pone cuesta arriba.
 */
export function poderExpansion(estado){
  const E = CONFIG.expansion;
  let hab = 0, servicio = 0, n = 0;
  // Las averías ya no son del pueblo sino de las piezas del mapa: basta con que
  // haya alguna sin reparar para que explorar cueste más.
  const averiado = (estado.averias || []).length > 0;
  for(const p of estado.pueblos){
    if(!p.desbloqueado) continue;
    hab += p.habitantes;
    servicio += p.servicio;
    n++;
  }
  if(n === 0) return 1;

  // La población de partida es el listón: crecer por encima es lo que premia
  const porPoblacion = 1 + Math.log2(1 + hab / E.habitantesReferencia) * E.factorPoblacion;
  const porServicio = Math.max(E.servicioMinimo, servicio / n);
  const porAveria = averiado ? E.penalizacionAveria : 1;

  return limitar(porPoblacion * porServicio * porAveria,
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
    { txt: t`Potencia de bomba Nv ${r.bomba}`, ok: pueblo.mejoras.bomba >= r.bomba },
    { txt: t`Captación Nv ${r.captacion}`,      ok: pueblo.mejoras.captacion >= r.captacion },
    { txt: t`${r.habitantes} habitantes`,        ok: hab >= r.habitantes }
  ];
  return { cumple: lista.every(f => f.ok), lista };
}

/** Un golpe de bomba en un pueblo. Devuelve los litros que entraron.
 *  DESBORDE: con el depósito lleno el golpe no cabe y el agua se tira — y el
 *  agua tirada arrastra y acaba en el cauce. Malgastar ensucia un poco cada
 *  vez (petición del autor): aporrear el clic con todo lleno tiene precio. */
export function bombear(pueblo, estado){
  const cap = capacidad(pueblo, estado);
  const antes = pueblo.agua;
  pueblo.agua = Math.min(cap, pueblo.agua + litrosPorClic(pueblo, estado));
  const entro = pueblo.agua - antes;
  if(entro <= 0.001)
    estado.contaminacion = Math.min(CONFIG.cauce.contaminacionMax,
      estado.contaminacion + CONFIG.bombeo.contaminacionPorDesborde);
  return entro;
}

/**
 * Agua BRUTA que entra al sistema y necesita potabilizarse, en L/h: TODA la
 * superficial (un río limpio no es un río potable) más la de los pozos sobre
 * masas por debajo del umbral de merma, que concentran partículas al bajar.
 */
export function aguaBrutaLh(estado, estiaje = 1){
  const P = piezas(estado);
  let lh = (P.captacion || 0) * CONFIG.aportePorPieza.captacion * 3600;
  const masas = masasDelMapa(estado.mapa);
  for(const [masa, pozos] of pozosPorMasa(estado)){
    const info = masas.get(masa);
    if(!info) continue;
    const nivel = nivelMasa(estado, masa);
    if(nivel >= CONFIG.acuiferos.umbralMerma) continue;
    const clase = CONFIG.acuiferos.clases[info.clase];
    lh += pozos * caudalPozo(clase, nivel, estiaje) * 3600;
  }
  return lh;
}

/** Lo que las ETAP conectadas pueden tratar, en L/h. Suma NIVELES, como todo. */
export function capacidadPotabilizacion(estado){
  return (piezas(estado).potabilizadora || 0) * CONFIG.aportePorPieza.potabilizadora;
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
  const ef = eficiencia(p);
  const prodCaptacion = caudalCaptacion(p, estado, estiaje) * ef * 3600 * dtHoras;
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

  /* --- RESIDUOS: recoger, enterrar y VENDER lo aprovechable --- */
  let basura = 0, recogida = 0, reciclada = 0, ingresoResiduos = 0;
  if(servicioActivo(p, 'residuos')){
    const R = CONFIG.residuos;
    basura = basuraGenerada(p) * dtHoras;

    // 1. La carretera pone el techo: lo que no cabe en el camión se queda en la
    //    calle. Sin vía tendida no sale NADA, igual que con las pluviales.
    const cabe = capacidadRecogida(estado) * dtHoras;
    recogida = Math.min(basura, cabe);

    // 2. De lo recogido, la planta recupera sus fracciones y las vende. El resto
    //    hay que enterrarlo, y enterrar cuesta.
    const fracRecuperada = fraccionesActivas(p, estado).reduce((a, f) => a + f.parte, 0);
    const aVertedero = recogida * (1 - fracRecuperada);
    // El vertedero también tiene tope: lo que no traga se queda sin gestionar.
    const tragadero = capacidadVertido(estado) * dtHoras;
    const enterrada = Math.min(aVertedero, tragadero);
    reciclada = recogida - aVertedero;

    // Lo enterrado OCUPA SITIO: se reparte entre los vasos que aún admiten.
    if(enterrada > 0) llenarVertederos(estado, enterrada);

    ingresoResiduos = reciclada * precioMedioReciclaje(p, estado)
                    - enterrada * R.costeVertidoTonelada * R.escalaEconomica;
    estado.dinero += ingresoResiduos;

    // 3. Lo que ni se recoge ni se entierra se pudre en el pueblo.
    const abandonada = (basura - recogida) + (aVertedero - enterrada);
    p.basuraCalle = Math.max(0, Math.min(1,
      (p.basuraCalle || 0) + abandonada * R.acumulaPorTonelada
      - R.recuperacionNatural * dtHoras));
  }

  const topeRed = redDelPueblo(estado).def.habitantesMax;
  // La basura en la calle frena el crecimiento igual que lo hace el cauce sucio:
  // nadie se muda a un pueblo que huele.
  const frenoBasura = 1 - (p.basuraCalle || 0) * CONFIG.residuos.penalizacionCrecimiento;
  crecer(p, servicio, dtHoras, frenoCrec * frenoBasura, calidadServicio(p), topeRed);

  return {
    residual, recienSaneamiento, serviciosNuevos,
    res: {
      servicio, demandaAhora: dem * punta, punta, estiaje,
      prodLps: dt > 0 ? entrada / dt : 0,
      produciendo: entrada > 0.0001,
      bombeoAuto: prodAuto > 0.0001,
      averiada: (estado.averias || []).length > 0,
      eficiencia: ef,
      saneamiento: servicioActivo(p, 'saneamiento'),
      lluvia, aliviando: alivio > 0.0001,
      // Se distingue el rebose del colector del alivio de la depuradora: son
      // dos averías distintas y se arreglan en sitios distintos del mapa.
      rebosando: reboseColector > 0.0001,
      // Cuánto llega al colector, en L/h: sin este número la UI no puede decir
      // si el tapón está en la tubería o en la depuradora.
      cargaLh: dtHoras > 0 ? cargaBruta / dtHoras : 0,
      basuraTh: dtHoras > 0 ? basura / dtHoras : 0,
      recogidaTh: dtHoras > 0 ? recogida / dtHoras : 0,
      recicladaTh: dtHoras > 0 ? reciclada / dtHoras : 0,
      ingresoResiduosHora: dtHoras > 0 ? ingresoResiduos / dtHoras : 0,
      basuraCalle: p.basuraCalle || 0,
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
  // EL AGUA SIN POTABILIZAR frena el crecimiento como el cauce sucio y la
  // basura: nadie se fía de un grifo sin garantía. Se calcula una vez para
  // toda la mancomunidad (la red hoy es común) y multiplica el freno.
  const brutaLh = aguaBrutaLh(estado, estiaje);
  const trataLh = capacidadPotabilizacion(estado);
  const frenoAgua = brutaLh > 0
    ? 1 - (Math.max(0, brutaLh - trataLh) / brutaLh) * CONFIG.calidad.penalizacionBruta
    : 1;
  const frenoCrec = (1 - suciedad * K.frenoCrecimiento) * frenoAgua;
  const lluvia = factorLluvia(estado.horas);

  let totalResidual = 0;
  let activoRes = null;
  const saneamientoNuevo = [];
  const serviciosNuevos = [];

  for(let i = 0; i < estado.pueblos.length; i++){
    const p = estado.pueblos[i];
    if(!p.desbloqueado) continue;
    const out = avanzarPueblo(estado, p, dt, dtHoras, punta, estiaje, frenoCrec, lluvia);
    totalResidual += out.residual;
    if(out.recienSaneamiento) saneamientoNuevo.push(p.nombre);
    // Los servicios que se acaban de abrir suben hasta aquí para que `main.js`
    // pueda contar su hito. Solo los del pueblo activo: los hitos son del
    // jugador, no de cada núcleo.
    if(i === estado.puebloActivo && out.serviciosNuevos)
      serviciosNuevos.push(...out.serviciosNuevos);
    if(i === estado.puebloActivo) activoRes = out.res;
  }

  // Los vertederos gotean sobre las masas de agua cercanas, y parte acaba en el
  // cauce común. Va aquí, fuera del bucle de pueblos: los vertederos son de la
  // mancomunidad, no de un pueblo.
  const lixiviados = lixiviar(estado, dtHoras);

  // El balance de los acuíferos. Va aquí por lo mismo: el agua subterránea es
  // del territorio, no de un pueblo, y un pozo del quinto la comparte con el
  // del primero si están sobre la misma masa.
  const avisosAcuifero = tickAcuiferos(estado, dtHoras, lluvia, estiaje);

  // LA MULTA DEL ESTADO: cada casilla protegida con daño (lixiviados que le han
  // llegado) cuesta dinero mientras el daño dure. No es un castigo de una vez:
  // es un goteo que solo para cuando el agua se recupera.
  let celdasZEC = 0;
  for(const celda of estado.mapa)
    if(celda.protegida && (celda.insalubre || 0) > 0.05) celdasZEC++;
  const multaProtegida = celdasZEC * CONFIG.proteccion.multaPorHoraCelda * dtHoras;
  estado.dinero -= multaProtegida;

  // Los yacimientos excavados rentan mientras sigan ahí: es el premio por haber
  // tropezado con uno y haberlo tratado bien en vez de maldecirlo.
  estado.dinero += rentaYacimientos(estado) * dtHoras;

  // Cauce común: sube con el vertido crudo, baja solo poco a poco
  estado.contaminacion = Math.max(0, Math.min(K.contaminacionMax,
    estado.contaminacion + totalResidual * K.porLitroResidual + lixiviados
    - K.recuperacionNatural * dtHoras));

  // Multa por contaminación (a la caja común)
  const multa = (estado.contaminacion / K.contaminacionMax) * K.multaMaxPorHora * dtHoras;
  estado.dinero -= multa;

  estado.horas += dtHoras;

  return {
    ...(activoRes || { servicio: 0, prodLps: 0, produciendo: false,
                       bombeoAuto: false, averiada: false, punta, estiaje,
                       lluvia, aliviando: false, tanqueFrac: 0, calidad: 1 }),
    contaminacion: estado.contaminacion,
    multaProtegida,
    celdasProtegidasSucias: celdasZEC,
    avisosAcuifero,
    suciedad,
    multa,
    frenoCrec,
    // El agua bruta contra lo potabilizado: el panel y los avisos beben de
    // aquí, no recalculan su propia versión.
    aguaBrutaLh: brutaLh,
    aguaTrataLh: trataLh,
    lluvia,
    saneamientoNuevo,
    serviciosNuevos
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
