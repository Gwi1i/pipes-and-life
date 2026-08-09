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
    { nombre: 'Villagua',  habitantes: 300, desbloqueada: true  },
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
    tasaCrecimientoAnual: 0.80,
    tasaDeclineAnual: -0.40
  },

  /* ---------- LA BOMBA (el clic principal) ---------- */
  bomba: {
    litrosPorClicBase: 450,
    bufferSinDeposito: 900
  },

  /* ---------- EL DEPÓSITO ---------- */
  deposito: {
    capacidadBase: 20000,
    incrementoCapacidad: 25000
  },

  /* ---------- MEJORAS (la tienda de cada pueblo) ----------
     Cada pueblo tiene su propio nivel de cada vía. La tienda se genera sola. */
  mejoras: {
    bomba: {
      nombre: 'Potencia de bomba', orden: 1,
      desc: 'Más agua por clic. También rinde más el auto-bombeo.',
      costeBase: 140, factorCoste: 1.5, nivelMax: 25,
      incrementoLitros: 220
    },
    deposito: {
      nombre: 'Depósito de reserva', orden: 2,
      desc: 'Acumula agua para no depender del clic. Cada nivel amplía la reserva.',
      costeBase: 300, factorCoste: 1.7, nivelMax: 15
    },
    captacion: {
      nombre: 'Captación', orden: 3,
      desc: 'Extrae agua sola, sin clicar. En verano rinde menos (estiaje).',
      costeBase: 500, factorCoste: 1.7, nivelMax: 20,
      caudalPorNivel: 0.15
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
    dineroInicial: 0,
    tarifa: 3.60,
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

  /* ---------- MAPA DE TESELAS (estilo D, vista cenital) ----------
     Cuadrícula ortogonal vista desde arriba, al estilo de los idle builders:
     cada elemento ocupa su celda y las tuberías se trazan entre ellas. El río
     va por las columnas de la derecha. Cambiar la parcela es cambiar esto. */
  mapa: {
    filas: 7,
    colsMin: 11,             // el ancho real se estira hasta llenar el lienzo
    anchoRio: 2,             // columnas de agua, siempre pegadas al borde derecho
    // Posición de cada elemento. `desdeOrilla` cuenta columnas hacia la
    // IZQUIERDA desde la orilla (0 = la celda que toca el agua), para que la
    // composición quede anclada al río sea cual sea el ancho de la pantalla.
    celdas: {
      captacion:  { desdeOrilla: 0, fila: 5 },
      bomba:      { desdeOrilla: 2, fila: 5 },
      deposito:   { desdeOrilla: 5, fila: 5 },
      pueblo:     { desdeOrilla: 10, fila: 3, ancho: 2, alto: 2 },
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
