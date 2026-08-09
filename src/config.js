/**
 * CONFIG — todos los parámetros ajustables del juego.
 *
 * Ningún otro módulo define números "mágicos". Motor y datos separados.
 *
 * Versión INCREMENTAL/CLICKER, multi-pueblo: una MANCOMUNIDAD gestiona uno o
 * varios pueblos. Cada pueblo es un sistema propio (bomba, depósito, captación,
 * depuradora, mantenimiento, auto-bombeo). Lo COMÚN a la mancomunidad es la caja
 * (dinero), el reloj/estación y el cauce (un solo río, una sola contaminación).
 * La versión de estrategia sobre terreno vive en la rama `master`.
 */

export const CONFIG = {

  /* ---------- LOS PUEBLOS ----------
     Lista de núcleos que puede gestionar la mancomunidad. El primero arranca
     desbloqueado; los demás se abren al cumplir el hito de crecimiento. */
  poblaciones: [
    { nombre: 'Villagua',  habitantes: 200, desbloqueada: true  },
    { nombre: 'Riolindo',  habitantes: 180, desbloqueada: false, desbloqueaEn: 900  },
    { nombre: 'Valdeagua', habitantes: 220, desbloqueada: false, desbloqueaEn: 2200 }
  ],
  // `desbloqueaEn` son habitantes TOTALES de la mancomunidad (solo cuentan los
  // pueblos ya abiertos). Al abrir el TERCERO se desbloquea además la red de
  // pluviales y el tanque de tormentas para toda la mancomunidad.

  /* ---------- PARÁMETROS COMUNES DE POBLACIÓN ----------
     Se aplican igual a cada pueblo. Su tamaño de arranque está en la lista. */
  poblacion: {
    litrosHabitanteDia: 165,
    habitantesMin: 80,
    habitantesMax: 6000,
    servicioBueno: 0.99,
    servicioMalo: 0.70,
    horasBuenServicioParaCrecer: 6,
    // Fuerte a propósito: los ingresos están topados por la demanda del pueblo,
    // así que si no crece deprisa, en cuanto superas su consumo el juego pierde
    // la tensión y clicar deja de servir para nada.
    tasaCrecimientoAnual: 2.50,
    tasaDeclineAnual: -0.40
  },

  /* ---------- LA BOMBA (el clic principal) ---------- */
  bomba: {
    // El clic es la identidad del juego: tiene que costar llenar y hay que
    // clicar de continuo para que llegue agua. Lo que compensa el esfuerzo NO
    // es que cada clic dé mucha agua, sino que el agua servida pague bien
    // (ver economia.tarifa). Con 1500 L bastaban dos clics para llenar la barra
    // y el juego se quedaba esperando: eso mataba la esencia.
    litrosPorClicBase: 450,
    bufferSinDeposito: 4000
  },

  /* ---------- EL DEPÓSITO ---------- */
  deposito: {
    // Llenarlo tiene que costar decenas de clics y vaciarse rápido: es un
    // respiro entre tandas de clic, no un piloto automático.
    capacidadBase: 12000,      // ~27 clics de llenado
    incrementoCapacidad: 14000
  },

  /* ---------- MEJORAS (la tienda de cada pueblo) ----------
     Cada pueblo tiene su propio nivel de cada vía. La tienda se genera sola. */
  mejoras: {
    bomba: {
      nombre: 'Potencia de bomba', orden: 1,
      desc: 'Más agua por clic. También rinde más el auto-bombeo.',
      costeBase: 140, factorCoste: 1.5, nivelMax: 25,
      incrementoLitros: 150
    },
    deposito: {
      nombre: 'Depósito de reserva', orden: 2,
      desc: 'Acumula agua para no depender del clic. Cada nivel amplía la reserva.',
      // Barato a propósito: es la mejora que te saca del clic continuo, y tiene
      // que llegar en el primer medio minuto de partida.
      costeBase: 120, factorCoste: 1.7, nivelMax: 15
    },
    captacion: {
      nombre: 'Captación', orden: 3,
      desc: 'Extrae agua sola, sin clicar. En verano rinde menos (estiaje).',
      // ELEMENTO EXCLUSIVO: produce sin clicar, o sea que compra justo lo que
      // el juego vende. Tiene que ser un objetivo caro, no un trámite del
      // primer minuto, o el jugador deja de clicar y se acaba la gracia.
      costeBase: 2500, factorCoste: 1.8, nivelMax: 20,
      caudalPorNivel: 0.12
    },
    depuradora: {
      nombre: 'Estación depuradora', orden: 4,
      desc: 'Trata las aguas residuales antes de devolverlas al cauce. Cada nivel, más limpio.',
      costeBase: 2000, factorCoste: 1.8, nivelMax: 6,
      fraccionPorNivel: 0.22,   // fracción de residual que trata cada nivel
      fraccionMax: 0.96,        // ni la mejor depuradora deja el agua perfecta
      caudalPorNivel: 2500      // L/h que es capaz de tratar cada nivel (lo que
                                // exceda se ALIVIA crudo al cauce)
    },
    // --- Solo cuando se abre el tercer pueblo (requiere: 'pluviales') ---
    pluviales: {
      nombre: 'Red de pluviales', orden: 5,
      desc: 'Separa el agua de lluvia del saneamiento: alivia la depuradora y ' +
            'aprovecha parte de la lluvia para tu depósito.',
      costeBase: 3000, factorCoste: 1.7, nivelMax: 5,
      requiere: 'pluviales',
      fraccionPorNivel: 0.20,   // fracción de escorrentía que saca del colector
      fraccionMax: 0.85
    },
    tanque: {
      nombre: 'Tanque de tormentas', orden: 6,
      desc: 'Retiene la punta de lluvia para no aliviar crudo al cauce, y la ' +
            'trata luego con calma. Mejora la calidad del pueblo.',
      costeBase: 4500, factorCoste: 1.8, nivelMax: 5,
      requiere: 'pluviales',
      capacidadPorNivel: 30000  // litros de retención por nivel
    },
    mantenimiento: {
      nombre: 'Personal de mantenimiento', orden: 7,
      desc: 'Repara las averías de este pueblo solo. Cada nivel, más rápido.',
      costeBase: 1500, factorCoste: 1.8, nivelMax: 8
    }
  },

  /* ---------- FUNCIÓN ESPECIAL: AUTO-BOMBEO ----------
     Por pueblo: cada concesión se gana su automatización. Requisitos + pago
     alto. `desbloqueoExterno` es el gancho para una futura vía de anuncio/pago;
     aquí NO se implementa pago ni anuncio real. */
  premium: {
    autobomba: {
      nombre: 'Auto-bombeo',
      desc: 'Bombea por ti en este pueblo, sin descanso.',
      requisitos: { bomba: 5, captacion: 5, habitantes: 600 },
      coste: 25000,
      clicsPorSeg: 1.5,
      desbloqueoExterno: null
    }
  },

  /* ---------- SANEAMIENTO Y CAUCE ----------
     Al crecer, el pueblo genera aguas residuales. Sin depurar, ensucian el
     cauce COMÚN. La contaminación cuesta dinero (multa) y frena el crecimiento
     de todos los pueblos. Se limpia a mano (botón) o, mejor, con depuradoras. */
  saneamiento: {
    habitantesUmbral: 500,   // a partir de aquí el pueblo genera aguas residuales
    fraccionResidual: 0.80   // fracción del agua servida que vuelve como residual
  },
  /* ---------- LLUVIA Y PLUVIALES ----------
     La lluvia deja de ser solo decorado: moja la ciudad y esa escorrentía entra
     al colector, que es lo que revienta a la depuradora en tormenta. La red de
     pluviales la separa; el tanque de tormentas amortigua la punta. */
  lluvia: {
    // Intensidad 0..1 por estación, en el mismo orden que `estaciones`
    porEstacion: [0.45, 0.05, 1.00, 0.30],   // primavera, verano, otoño, invierno
    litrosPorHabHora: 6      // escorrentía urbana por habitante y hora, a lluvia máxima
  },
  pluviales: {
    fraccionAprovechada: 0.35   // de lo separado, cuánto se recoge para el depósito
  },
  /* ---------- CALIDAD DEL PUEBLO ----------
     Multiplica el crecimiento: un pueblo con buen saneamiento crece mejor. */
  calidad: {
    base: 1.0, bonusTanque: 0.10, bonusPluviales: 0.05, max: 1.6
  },

  cauce: {
    contaminacionMax: 100,
    porLitroResidual: 0.0006,   // cuánto sube la contaminación por litro crudo vertido
    recuperacionNatural: 0.6,   // cuánto baja sola por hora de juego
    limpiezaPorClic: 4,         // cuánto baja cada clic de LIMPIAR CAUCE
    multaMaxPorHora: 45,        // € por hora de juego con el cauce al máximo de suciedad
    frenoCrecimiento: 0.85      // a suciedad máxima, el crecimiento se reduce hasta ×0,15
  },

  /* ---------- ECONOMÍA ---------- */
  economia: {
    dineroInicial: 25,     // anticipo de la concesión: un empujón para arrancar
    // Alta a propósito: el esfuerzo de clicar se paga en DINERO, no en agua
    // regalada. Es lo que evita la desesperación de los primeros minutos.
    tarifa: 14.00,
    horasPorSegundo: 0.4
  },

  /* ---------- TIEMPO ---------- */
  tiempo: {
    horasPorAño: 360
  },

  /* ---------- CICLO DIARIO DE CONSUMO ---------- */
  curvaDiaria: [
    0.35, 0.28, 0.24, 0.22, 0.25, 0.42, 0.85, 1.45,
    1.72, 1.55, 1.30, 1.20, 1.35, 1.42, 1.18, 1.05,
    1.00, 1.10, 1.35, 1.62, 1.70, 1.40, 0.95, 0.55
  ],

  /* ---------- ESTIAJE ---------- */
  estiaje: {
    factorMin: 0.35,
    factorMax: 1.25
  },

  /* ---------- ESTACIONES (aspecto de la escena) ----------
     El año se divide en cuatro. La escena interpola entre una estación y la
     siguiente, así el paisaje cambia de forma continua. `clima` decide qué
     partículas caen. Empieza en primavera (frac 0), como el estiaje. */
  estaciones: [
    { nombre: 'Primavera', follaje: '#8fce6a', hierba: '#4f9a44', tinte: 'rgba(140,200,120,0.06)', clima: 'flores' },
    { nombre: 'Verano',    follaje: '#5fae42', hierba: '#5a9a34', tinte: 'rgba(245,196,81,0.05)', clima: 'sol' },
    { nombre: 'Otoño',     follaje: '#d98a3c', hierba: '#7c7a3a', tinte: 'rgba(180,120,60,0.07)', clima: 'lluvia' },
    { nombre: 'Invierno',  follaje: '#dfeaf2', hierba: '#9fb2bb', tinte: 'rgba(150,180,210,0.10)', clima: 'nieve' }
  ],
  clima: {
    densidadLluvia: 110,     // gotas en pantalla
    densidadNieve: 90,       // copos
    densidadFlores: 34,      // pétalos de primavera
    velocidadLluvia: 560,    // px/s
    velocidadNieve: 70
  },
  // La escena da sensación de volumen ("falso 3D") con luz direccional,
  // cilindros, casas en 3/4, sombras arrojadas y bruma en la lejanía. Los
  // colores base están arriba (color/estaciones); las intensidades de sombreado
  // son detalle de dibujo y viven en escena.js.

  /* ---------- DESGASTE ----------
     La instalación se va gastando y pierde eficacia. Es la SEGUNDA tecla del
     juego: obliga a alternar entre el botón de bombear y el de mantenimiento,
     en vez de machacar siempre el mismo sitio. Se puede engrasar a mano
     (gratis, clicando) o comprar personal de mantenimiento, que lo frena. */
  desgaste: {
    porHoraJuego: 0.010,     // sube solo con el tiempo
    porClic: 0.0008,         // y además usar la bomba la gasta: clicar castiga
    efectoMax: 0.72,         // a desgaste 1 se produce solo el 28 %
    reparaPorClic: 0.05,     // cuánto baja cada clic de mantenimiento
    frenoPorNivelMant: 0.65, // cada nivel de mantenimiento multiplica el desgaste acumulado
    avisoEn: 0.45            // a partir de aquí, la UI avisa
  },

  /* ---------- EL OPERARIO ----------
     Cada cierto tiempo aparece en la escena y hay que pillarlo antes de que se
     vaya: engrasa la instalación entera y trae una prima. Da algo que mirar
     mientras se clica y premia estar atento. */
  visita: {
    cadaMinSeg: 30, cadaMaxSeg: 70,   // cada cuánto asoma (segundos reales)
    duracionSeg: 9,                   // lo que se queda antes de irse
    primaSegundos: 25,                // le paga al jugador lo que ganaría en X s
    primaMinima: 40                   // ...o esto, lo que sea mayor
  },

  /* ---------- AVERÍAS (por pueblo) ---------- */
  averias: {
    probBasePorHora: 0.006,
    factorDesgaste: 0.10,
    riesgoAutobomba: 4,
    recorteProduccion: 1.0,
    costeReparacionManual: 200,
    reparacionAutoHoras: 6,
    reparacionAutoFactor: 0.7
  },

  /* ---------- PROGRESO OFFLINE ---------- */
  offline: {
    minSegundos: 60,
    maxHoras: 8
  },

  /* ---------- EL MUNDO: mapa grande de exploración ----------
     Mucho mayor que la pantalla y casi todo tapado. Se destapa a clics, y
     cuanto más lejos del pueblo de origen, más cuesta. */
  mapaMundo: {
    cols: 40, filas: 28,
    semilla: 20260809,
    origen: { col: 20, fila: 14 },   // aquí está tu pueblo inicial
    radioInicial: 3,                 // casillas ya abiertas al empezar
    tamTesela: 74,                   // píxeles por casilla al zoom 1

    // Coste en clics: base + distancia^exponente * factor
    clicsBase: 3,
    exponenteDistancia: 1.4,
    factorDistancia: 1.0
  },

  /* ---------- PODER DE EXPANSIÓN ----------
     Lo que une el mapa con el juego de siempre: explorar no cuesta lo mismo
     según cómo lleves tu red. Una población grande y BIEN SERVIDA, con la
     instalación cuidada, abarata las casillas de alrededor; si dejas caer el
     servicio, se desgasta la maquinaria o hay una avería, explorar cuesta más.
     Así abastecer sigue siendo el objetivo y no un adorno. */
  expansion: {
    factorPoblacion: 0.55,     // cuánto ayuda la población (crece logarítmico)
    habitantesReferencia: 200, // la población de partida no da ventaja: es el listón
    servicioMinimo: 0.35,      // suelo, para que un corte puntual no te bloquee
    penalizacionDesgaste: 0.50,// cuánto castiga no engrasar
    penalizacionAveria: 0.70,  // multiplicador si hay alguna avería sin reparar
    poderMin: 0.35, poderMax: 6
  },

  /* ---------- TERRENOS ----------
     `costeExtra` multiplica los clics necesarios para abrir la casilla. */
  terrenos: {
    hierba:  { nombre: 'Prado',   color: '#4f9a44', costeExtra: 1.0 },
    bosque:  { nombre: 'Bosque',  color: '#2f6b39', costeExtra: 1.4 },
    montana: { nombre: 'Montaña', color: '#7b7f86', costeExtra: 2.0 },
    agua:    { nombre: 'Río',     color: '#2b7fa8', costeExtra: 1.2 },
    lago:    { nombre: 'Lago',    color: '#1d5f80', costeExtra: 1.2 }
  },

  /* ---------- QUÉ SE PUEDE CONSTRUIR Y DÓNDE ----------
     Cada pieza pide su sitio, y eso es lo que convierte el mapa en un problema
     y no en un lienzo: el depósito quiere altura (montaña), la captación va en
     el agua, y lo que trata o impulsa tiene que estar junto al cauce.
     `terreno` = casillas donde puede ir. `junto` = además, debe tocar una de
     esas. `lejosDeAgua` = solo si NO hay agua a esa distancia (el acuífero). */
  construibles: {
    captacion: {
      nombre: 'Captación', coste: 300, orden: 1, color: '#5eead4',
      terreno: ['agua', 'lago'],
      desc: 'Toma el agua del cauce. Va sobre el río o un lago.'
    },
    bomba: {
      nombre: 'Bombeo', coste: 250, orden: 2, color: '#7aa7c7',
      terreno: ['hierba'], junto: ['agua', 'lago'],
      desc: 'Impulsa el agua. En tierra llana, pegado al agua.'
    },
    deposito: {
      nombre: 'Depósito', coste: 400, orden: 3, color: '#7dd3fc',
      terreno: ['montana'],
      desc: 'Guarda agua EN ALTO para que baje por gravedad: por eso va en montaña.'
    },
    depuradora: {
      nombre: 'Depuradora', coste: 2000, orden: 4, color: '#34d399',
      terreno: ['hierba'], junto: ['agua', 'lago'],
      desc: 'Trata las aguas residuales antes de devolverlas al cauce.'
    },
    tanque: {
      nombre: 'Tanque de tormentas', coste: 1500, orden: 5, color: '#818cf8',
      terreno: ['hierba', 'bosque'],
      desc: 'Retiene la punta de lluvia. En llano o desbrozando bosque.'
    },
    acuifero: {
      nombre: 'Sondeo a acuífero', coste: 5000, orden: 6, color: '#a78bfa',
      terreno: ['hierba', 'bosque', 'montana'], lejosDeAgua: 4,
      desc: 'El recurso de última hora: perfora y saca agua del subsuelo. ' +
            'Solo tiene sentido lejos del cauce, y sale caro.'
    }
  },

  /* ---------- LO QUE APORTA CADA PIEZA CONECTADA ----------
     La tienda de mejoras sube el NIVEL (lo bien que rinde cada una); el mapa
     decide CUÁNTAS tienes y si están enganchadas. Una pieza sin tubería al
     pueblo no cuenta: por eso el trazado importa. */
  aportePorPieza: {
    captacion: 0.10,     // L/s de producción pasiva que suma cada captación
    deposito: 9000,      // litros de capacidad que suma cada depósito
    bomba: 220           // litros por clic que suma cada bombeo
  },

  /* ---------- TUBERÍAS ----------
     No van por donde quieran: cada casilla cuesta según lo que haya que hacer
     para atravesarla. Rodear un bosque o pagar por desbrozarlo es la decisión. */
  tuberia: {
    costePorCasilla: { hierba: 12, bosque: 45, montana: 120, agua: 70, lago: 70 },
    nombreObra: { hierba: 'zanja', bosque: 'desbroce', montana: 'excavación',
                  agua: 'cruce del cauce', lago: 'cruce del lago' }
  },

  /* ---------- HALLAZGOS ----------
     Lo que se encuentra explorando. Las ruinas son instalaciones abandonadas:
     se pueden reparar en el sitio o llevarse al inventario para colocarlas
     donde convenga. */
  hallazgos: {
    pueblos: 7, ruinas: 14, yacimientos: 10,
    distanciaMinima: 4,      // nada de hallazgos pegados al origen
    color: { pueblo: '#facc15', ruina: '#c084fc', yacimiento: '#38bdf8' }
  },

  /* ---------- MAPA DE TESELAS (estilo D, vista cenital) ----------
     Cuadrícula ortogonal vista desde arriba, al estilo de los idle builders:
     cada elemento ocupa su celda y las tuberías se trazan entre ellas. El río
     va por las columnas de la derecha. Cambiar la parcela es cambiar esto. */
  mapa: {
    // Menos filas = teselas más grandes. Con 6 el arte de cada celda se lee;
    // con 7 u 8 los edificios quedaban en un borrón.
    filas: 6,
    colsMin: 11,             // el ancho real se estira hasta llenar el lienzo
    anchoRio: 2,             // columnas de agua, siempre pegadas al borde derecho
    // Posición de cada elemento. `desdeOrilla` cuenta columnas hacia la
    // IZQUIERDA desde la orilla (0 = la celda que toca el agua), para que la
    // composición quede anclada al río sea cual sea el ancho de la pantalla.
    celdas: {
      captacion:  { desdeOrilla: 0, fila: 4 },
      bomba:      { desdeOrilla: 2, fila: 4 },
      deposito:   { desdeOrilla: 5, fila: 4 },
      pueblo:     { desdeOrilla: 7, fila: 2, ancho: 2, alto: 2 },
      tanque:     { desdeOrilla: 5, fila: 1 },
      depuradora: { desdeOrilla: 2, fila: 1 }
    }
  },

  /* ---------- ASPECTO ---------- */
  color: {
    cielo:      ['#0a1a2b', '#123049', '#1c4a63'],
    cieloNoche: ['#050d18', '#0a1a2b', '#0e2438'],
    tierra:     ['#243b2e', '#182a20'],
    agua:       '#38bdf8',
    aguaProfunda:'#0e5a86',
    aguaSucia:  '#6b7a3a',    // el cauce contaminado tira a verde turbio
    aguaSeca:   '#475569',
    sol:        '#f5c451',
    luna:       '#cbd5e1',
    estructura: '#94a3b8',
    deposito:   '#7dd3fc',
    captacion:  '#5eead4',
    depuradora: '#34d399',
    pluviales:  '#22d3ee',
    tanque:     '#818cf8',
    casa:       '#facc15',
    casaSeca:   '#6f8aa1',
    ok:         '#4ade80',
    alarma:     '#f5a524',
    critico:    '#ef4444',
    premium:    '#c084fc',
    texto:      '#cfdce8',
    tenue:      '#6f8aa1'
  },

  /* ---------- GUARDADO ----------
     v2: el formato multi-pueblo no es compatible con el de un solo pueblo. */
  guardado: { clave: 'redHidraulica_clicker_v2', intervaloSegundos: 10 }
};
