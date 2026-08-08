/**
 * CONFIG — todos los parámetros ajustables del juego.
 *
 * Ningún otro módulo define números "mágicos". Si quieres cambiar el
 * equilibrio o el aspecto, se toca aquí y solo aquí: motor y datos separados.
 *
 * Versión INCREMENTAL/CLICKER: se bombea agua a golpe de clic, se acumula en un
 * depósito y se abastece a una población que crece si la sirves bien. La
 * versión de estrategia sobre terreno vive en la rama `master`.
 */

export const CONFIG = {

  /* ---------- LA POBLACIÓN A ABASTECER ----------
     Una sola, de momento. Crece si la sirves bien y sin cortes; se despuebla
     si le falta agua. Ese vaivén es el motor de que la partida no se estanque. */
  poblacion: {
    nombre: 'Villagua',
    habitantes: 300,
    litrosHabitanteDia: 165,   // dotación: lo que consume una persona al día

    habitantesMin: 80,
    habitantesMax: 6000,
    servicioBueno: 0.99,       // a partir de aquí se considera "bien abastecida"
    servicioMalo: 0.70,        // por debajo, empieza a despoblarse
    horasBuenServicioParaCrecer: 6,  // horas de juego seguidas sin corte antes de crecer
    tasaCrecimientoAnual: 0.80,      // +80 %/año bien servida (generoso, es un clicker)
    tasaDeclineAnual: -0.40          // -40 %/año mal servida
  },

  /* ---------- LA BOMBA (el clic principal) ---------- */
  bomba: {
    litrosPorClicBase: 450,    // agua por clic sin mejoras
    bufferSinDeposito: 900     // capacidad del sistema mientras no hay depósito (L)
  },

  /* ---------- EL DEPÓSITO ---------- */
  deposito: {
    capacidadBase: 20000,      // litros con el primer nivel
    incrementoCapacidad: 25000 // litros que suma cada nivel adicional
  },

  /* ---------- MEJORAS (la tienda normal) ----------
     Cuatro vías que compiten por el dinero. La tienda se genera sola a partir
     de este objeto. El AUTO-BOMBEO ya NO está aquí: es una función especial
     (ver `premium`). Su hueco lo ocupa el personal de mantenimiento. */
  mejoras: {
    bomba: {
      nombre: 'Potencia de bomba', orden: 1,
      desc: 'Más agua por clic. También rinde más el auto-bombeo.',
      costeBase: 140, factorCoste: 1.5, nivelMax: 25,
      incrementoLitros: 220     // +L por clic y por nivel
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
      caudalPorNivel: 0.15      // L/s de producción pasiva por nivel (antes del estiaje)
    },
    mantenimiento: {
      nombre: 'Personal de mantenimiento', orden: 4,
      desc: 'Repara las averías solo. Cada nivel, más rápido. Sin él, reparas a mano.',
      costeBase: 1500, factorCoste: 1.8, nivelMax: 8
    }
  },

  /* ---------- FUNCIÓN ESPECIAL: AUTO-BOMBEO ----------
     No es una mejora más: es el gran aliciente. Bombea solo, sin descanso. Se
     gana cumpliendo requisitos Y pagando caro. El campo `desbloqueoExterno` es
     el gancho para, en el futuro, permitir desbloquearlo por otra vía (anuncio
     o pago real). De momento null: solo requisitos + coste en el juego.
     IMPORTANTE: aquí NO se implementa ningún pago ni anuncio real. */
  premium: {
    autobomba: {
      nombre: 'Auto-bombeo',
      desc: 'Bombea por ti, sin descanso. Rinde según la potencia de bomba.',
      requisitos: { bomba: 5, captacion: 5, habitantes: 600 },
      coste: 25000,
      clicsPorSeg: 1.5,         // pulsaciones automáticas/s (× potencia de bomba)
      desbloqueoExterno: null   // futuro: 'anuncio' | 'pago' | null
    }
  },

  /* ---------- ECONOMÍA ---------- */
  economia: {
    dineroInicial: 0,
    tarifa: 3.60,              // €/m³ de agua servida
    horasPorSegundo: 0.4      // 1 s real = 0,4 h de explotación
  },

  /* ---------- TIEMPO ----------
     El año da la escala del crecimiento y del estiaje. */
  tiempo: {
    horasPorAño: 360
  },

  /* ---------- CICLO DIARIO DE CONSUMO ----------
     El consumo NO es constante: punta de mañana y de tarde, valle de madrugada.
     Coeficiente por cada hora del día (0-23) sobre el consumo medio. Por eso
     tiene sentido el depósito de regulación. */
  curvaDiaria: [
    0.35, 0.28, 0.24, 0.22, 0.25, 0.42, 0.85, 1.45,   // 0-7 h
    1.72, 1.55, 1.30, 1.20, 1.35, 1.42, 1.18, 1.05,   // 8-15 h
    1.00, 1.10, 1.35, 1.62, 1.70, 1.40, 0.95, 0.55    // 16-23 h
  ],

  /* ---------- ESTIAJE ----------
     El caudal de la captación cae en verano y sube con el deshielo. Golpea
     justo a la producción pasiva: tu reserva es lo que te salva el verano. */
  estiaje: {
    factorMin: 0.35,   // en pleno verano queda un tercio del caudal
    factorMax: 1.25    // deshielo de primavera
  },

  /* ---------- AVERÍAS ----------
     La instalación envejece y revienta. Una avería PARA la producción
     automática (captación + auto-bombeo); el clic manual sigue funcionando,
     que es la tensión: puedes seguir a mano mientras reparas. */
  averias: {
    probBasePorHora: 0.006,      // probabilidad de avería por hora de juego
    factorDesgaste: 0.10,        // + riesgo por cada nivel de captación (más máquina, más avería)
    riesgoAutobomba: 4,          // el auto-bombeo castiga la máquina como 4 niveles
    recorteProduccion: 1.0,      // fracción de producción pasiva que se pierde (1 = se para)
    costeReparacionManual: 200,  // € por reparar a mano al instante
    reparacionAutoHoras: 6,      // horas de juego que tarda el personal de nivel 1
    reparacionAutoFactor: 0.7    // cada nivel multiplica ese tiempo (más rápido)
  },

  /* ---------- PROGRESO OFFLINE ----------
     Al volver a la partida, se simula el tiempo ausente (con tope) y se
     acredita lo producido/consumido. No ocurren averías nuevas mientras no
     estás: sería injusto volver a un desastre. */
  offline: {
    minSegundos: 60,   // por debajo de esto ni se molesta
    maxHoras: 8        // horas REALES como máximo a acreditar
  },

  /* ---------- ASPECTO ---------- */
  color: {
    cielo:      ['#0a1a2b', '#123049', '#1c4a63'],
    cieloNoche: ['#050d18', '#0a1a2b', '#0e2438'],
    tierra:     ['#243b2e', '#182a20'],
    agua:       '#38bdf8',
    aguaProfunda:'#0e5a86',
    aguaSeca:   '#475569',
    sol:        '#f5c451',
    luna:       '#cbd5e1',
    estructura: '#94a3b8',
    deposito:   '#7dd3fc',
    captacion:  '#5eead4',
    casa:       '#facc15',
    casaSeca:   '#6f8aa1',
    ok:         '#4ade80',
    alarma:     '#f5a524',
    critico:    '#ef4444',
    premium:    '#c084fc',
    texto:      '#cfdce8',
    tenue:      '#6f8aa1'
  },

  /* ---------- GUARDADO ---------- */
  guardado: { clave: 'redHidraulica_clicker_v1', intervaloSegundos: 10 }
};
