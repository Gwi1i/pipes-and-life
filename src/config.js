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

  /* ---------- LA BOMBA (el clic principal) ----------
     Cada pulsación extrae agua del río. Sin depósito solo cabe un chorrito
     (el propio tramo de tubería), así que hay que clicar sin parar; con
     depósito se acumula. Ese contraste es lo que hace que el depósito se note. */
  bomba: {
    litrosPorClicBase: 450,    // agua por clic sin mejoras
    bufferSinDeposito: 900     // capacidad del sistema mientras no hay depósito (L)
  },

  /* ---------- EL DEPÓSITO ----------
     No produce agua: la GUARDA. La capacidad depende del nivel comprado en
     `mejoras.deposito`; estos son los números base de ese cálculo. */
  deposito: {
    capacidadBase: 20000,      // litros con el primer nivel (el depósito de siempre)
    incrementoCapacidad: 25000 // litros que suma cada nivel adicional
  },

  /* ---------- MEJORAS (la tienda) ----------
     Cuatro vías que compiten por el dinero: ahí está la estrategia. Cada nivel
     cuesta `costeBase · factorCoste^nivelActual`. La tienda se genera sola a
     partir de este objeto: añadir una mejora aquí la hace aparecer. */
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
      // el efecto (capacidad) se calcula con deposito.capacidadBase/incremento
    },
    captacion: {
      nombre: 'Captación', orden: 3,
      desc: 'Extrae agua sola, sin clicar. Es tu producción de fondo.',
      costeBase: 500, factorCoste: 1.7, nivelMax: 20,
      caudalPorNivel: 0.15      // L/s de producción pasiva por nivel
    },
    autobomba: {
      nombre: 'Auto-bombeo', orden: 4,
      desc: 'Bombea solo. Cada nivel da más pulsaciones automáticas por segundo.',
      costeBase: 800, factorCoste: 1.8, nivelMax: 20,
      clicsPorSegPorNivel: 0.6  // clics automáticos/s por nivel (× potencia de bomba)
    }
  },

  /* ---------- ECONOMÍA ---------- */
  economia: {
    dineroInicial: 0,          // se empieza sin nada: el primer dinero sale de clicar
    tarifa: 3.60,              // €/m³ de agua servida (número de juego, no real)
    horasPorSegundo: 0.4       // 1 s real = 0,4 h de explotación. Marca el ritmo del reloj.
  },

  /* ---------- TIEMPO ----------
     El año da la escala del crecimiento (y del estiaje, en el Hito 3). */
  tiempo: {
    horasPorAño: 360
  },

  /* ---------- ASPECTO ----------
     El color codifica estado, no decora. Mismos tonos que la hoja de estilos. */
  color: {
    cielo:      ['#0a1a2b', '#123049', '#1c4a63'],  // degradado de arriba abajo
    tierra:     ['#243b2e', '#182a20'],
    agua:       '#38bdf8',
    aguaProfunda:'#0e5a86',
    aguaSeca:   '#475569',
    sol:        '#f5c451',
    estructura: '#94a3b8',
    deposito:   '#7dd3fc',
    captacion:  '#5eead4',
    casa:       '#facc15',
    casaSeca:   '#6f8aa1',
    ok:         '#4ade80',
    alarma:     '#f5a524',
    critico:    '#ef4444',
    texto:      '#cfdce8',
    tenue:      '#6f8aa1'
  },

  /* ---------- GUARDADO ---------- */
  guardado: { clave: 'redHidraulica_clicker_v1', intervaloSegundos: 10 }
};
