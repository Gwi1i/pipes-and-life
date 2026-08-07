/**
 * CONFIG — todos los parámetros ajustables del juego.
 *
 * Ningún otro módulo define números "mágicos". Si quieres cambiar el
 * equilibrio, la escala del mapa o el aspecto, se toca aquí y solo aquí.
 * Es el mismo principio de tus config.json: motor y datos separados.
 */

export const CONFIG = {

  /* ---------- MUNDO ---------- */
  mundo: {
    ancho: 3000,          // metros de este a oeste
    alto:  2200,          // metros de norte a sur
    resolucion: 15,       // metros por celda del modelo de elevaciones
    cotaMin: 380,         // altitud mínima del terreno (m)
    cotaMax: 620,         // altitud máxima (m)
    equidistancia: 10,    // separación entre curvas de nivel (m)
    semilla: 20260807     // cambia esto y sale otro valle distinto
  },

  /* ---------- CÁMARA ---------- */
  camara: {
    zoomMin: 0.18,
    zoomMax: 3.0,
    zoomInicial: 0.42,
    velocidadZoom: 0.0014,
    velocidadTeclado: 900   // metros por segundo con WASD
  },

  /* ---------- HIDRÁULICA ----------
     Ojo: son fórmulas SIMPLIFICADAS, no Hazen-Williams real. Buscan ser
     legibles en dos segundos, no exactas. Un jugador tiene que intuir
     "tubo más fino = más pérdida", no calcular nada. */
  hidraulica: {
    coefPerdida: 0.017,      // constante global de pérdida de carga
    exponenteCaudal: 1.85,   // forma de Hazen-Williams
    exponenteDiametro: 4.87,
    presionMinima: 15,       // m.c.a. exigidos en una población
    presionMaxima: 70,       // por encima de esto, revienta la tubería
    alturaLamina: 6          // altura de agua sobre la solera del depósito
  },

  /* ---------- ELEMENTOS COLOCABLES ---------- */
  elementos: {
    captacion: {
      nombre: 'Captación', color: '#9caf6b', radio: 13, coste: 4000,
      desc: 'Sondeo o manantial. Origen del agua bruta. Está a cota de terreno, ' +
            'así que casi siempre hace falta bombear para llevarla arriba.',
      caudalBase: 12          // L/s que puede aportar
    },
    deposito: {
      nombre: 'Depósito', color: '#38bdf8', radio: 15, coste: 9000,
      desc: 'Almacena y da presión. La lámina de agua fija la altura ' +
            'piezométrica: cuanto más alto lo pongas, más presión gratis.',
      capacidad: 500          // m³
    },
    // El bombeo NO se coloca suelto: se INSTALA sobre un elemento que ya
    // existe. En una red real el grupo de impulsión está en la propia
    // captación o en el depósito, no plantado en mitad del campo.
    bombeo: {
      nombre: 'Bombeo', color: '#f97316', radio: 12, coste: 6500,
      desc: 'Eleva el agua hasta una cota superior. Cuesta energía por cada ' +
            'metro cúbico y cada metro de altura.',
      alturaManometrica: 65,
      colocable: false        // se instala desde el panel del elemento
    },
    nudo: {
      nombre: 'Nudo', color: '#64748b', radio: 8, coste: 200,
      desc: 'Punto de unión o cambio de dirección. Sin coste apenas.'
    },
    poblacion: {
      nombre: 'Población', color: '#facc15', radio: 16, coste: 0,
      desc: 'Núcleo a abastecer. Exige un caudal y una presión mínima. ' +
            'Si la tiene, paga; si no, protesta.',
      colocable: false        // las genera el mapa, no el jugador
    }
  },

  /* ---------- TUBERÍAS ---------- */
  diametros: [
    { dn: 63,  nombre: 'DN63',  coste: 3,   color: '#475569' },
    { dn: 110, nombre: 'DN110', coste: 7,   color: '#64748b' },
    { dn: 160, nombre: 'DN160', coste: 14,  color: '#94a3b8' },
    { dn: 250, nombre: 'DN250', coste: 28,  color: '#cbd5e1' }
  ],
  costeExtraPorCota: 6,    // recargo por metro de desnivel salvado

  /* ---------- SERVICIO DE CUBAS ----------
     El recurso manual: mientras un núcleo no tenga red, puedes servirlo
     con camión cisterna. Da poco dinero y hay que pulsar, que es
     justamente el motivo para construir la red. */
  cubas: {
    m3PorViaje: 22,
    tarifa: 2.40,           // €/m³ — más caro que por red, pero es un goteo
    costeViaje: 14          // gasoil y conductor
  },

  /* ---------- ECONOMÍA ---------- */
  economia: {
    dineroInicial: 78000,
    tarifa: 3.60,             // €/m³ facturado (número de juego, no real)
    costeEnergiaKwh: 0.16,
    rendimientoBombeo: 0.72,
    segundosPorHora: 1        // 1 s real = 1 h de explotación
  },

  /* ---------- POBLACIONES DEL MAPA ---------- */
  poblaciones: [
    { nombre: 'Aldealta',   habitantes: 420,  preferirCota: 'alta'  },
    { nombre: 'Vallehondo', habitantes: 1150, preferirCota: 'baja'  },
    { nombre: 'Peñarroya',  habitantes: 680,  preferirCota: 'media' },
    { nombre: 'Los Molinos',habitantes: 240,  preferirCota: 'baja'  }
  ],
  litrosHabitanteDia: 165,

  /* ---------- CICLO DIARIO DE CONSUMO ----------
     El consumo NO es constante: hay punta de mañana y de tarde, y valle
     de madrugada. Por eso existen los depósitos de regulación. Coeficiente
     por cada hora del día (0-23), sobre el consumo medio. */
  curvaDiaria: [
    0.35, 0.28, 0.24, 0.22, 0.25, 0.42, 0.85, 1.45,   // 0-7 h
    1.72, 1.55, 1.30, 1.20, 1.35, 1.42, 1.18, 1.05,   // 8-15 h
    1.00, 1.10, 1.35, 1.62, 1.70, 1.40, 0.95, 0.55    // 16-23 h
  ],

  /* ---------- ESTIAJE ----------
     El caudal de los cauces cae en verano. Un año dura 360 h de juego. */
  estiaje: {
    horasPorAño: 360,
    factorMin: 0.35,      // en agosto queda un tercio del caudal
    factorMax: 1.25       // deshielo de primavera
  },

  /* ---------- CRECIMIENTO ----------
     Un núcleo bien abastecido crece. Uno mal servido se despuebla.
     Es el motor de que la partida no se acabe: lo que hoy sobra,
     mañana se queda corto. */
  crecimiento: {
    tasaAnualBien: 0.14,
    tasaAnualMal: -0.035,
    habitantesMax: 14000
  },

  /* ---------- AVERÍAS ----------
     Las tuberías envejecen y revientan. La sobrepresión lo acelera, que
     es lo que por fin da sentido a vigilar el máximo. */
  averias: {
    probBase: 0.00045,        // por hora y por tramo
    factorSobrepresion: 14,   // multiplicador al superar la presión máxima
    factorAntiguedad: 0.6,    // recargo por cada 1000 h de servicio
    costeReparacion: 0.9      // €/m del tramo
  },

  /* ---------- ASPECTO ---------- */
  color: {
    fondo:      '#060f18',
    aguaOk:     '#38bdf8',
    aguaSeca:   '#475569',
    alarma:     '#f5a524',
    critico:    '#ef4444',
    ok:         '#4ade80',
    texto:      '#cfdce8',
    tenue:      '#6f8aa1',
    curva:      '#2a4055',
    curvaMaestra: '#3d5a75'
  },

  /* Rampa hipsométrica del terreno: de valle a cumbre */
  rampaTerreno: [
    { t: 0.00, c: [ 22,  42,  48] },
    { t: 0.25, c: [ 30,  56,  50] },
    { t: 0.50, c: [ 48,  62,  46] },
    { t: 0.75, c: [ 74,  70,  50] },
    { t: 1.00, c: [104,  94,  78] }
  ],

  guardado: { clave: 'redHidraulica_v1', intervaloSegundos: 20 }
};
