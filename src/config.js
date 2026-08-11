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

  /* ---------- LOS SERVICIOS ----------
     La espina dorsal del juego: un pueblo no es una lista de mejoras sueltas,
     es un conjunto de SERVICIOS que hay que darle, y cada uno se abre cuando
     toca. Aquí se dice qué mejoras y qué red pertenecen a cada uno.

     OJO: servicio NO es lo mismo que red. Las tres primeras tienen tubería, pero
     `explotacion` no la tiene (es el personal), y los RESIDUOS del día de mañana
     tampoco: se recogen en camión, con rutas por el mapa. Por eso son dos
     conceptos con dos tablas (`CONFIG.redes` y esto) y no una sola: fundirlos
     ahora dejaría fuera la mitad de lo que viene.

     `piezas` no se repite aquí: lo que se puede construir de cada red vive en
     `CONFIG.redes[red].piezas`, y esa es la única fuente. */
  servicios: {
    abastecimiento: {
      nombre: 'Abastecimiento', orden: 1, red: 'abastecimiento', siempre: true,
      desc: 'Llevar agua potable al pueblo. Es de lo que vive la mancomunidad.',
      mejoras: ['bomba', 'deposito', 'captacion']
    },
    saneamiento: {
      nombre: 'Saneamiento', orden: 2, red: 'saneamiento',
      desc: 'Llevarse lo que el pueblo devuelve sucio, y tratarlo antes del río.',
      // Se abre solo al crecer: hasta cierto tamaño un pueblo se apaña sin nada
      activaEnHabitantes: 500,
      mejoras: ['depuradora']
    },
    pluviales: {
      nombre: 'Pluviales', orden: 3, red: 'pluviales', requiere: 'pluviales',
      desc: 'Separar la lluvia del colector para que no reviente la depuradora.',
      mejoras: ['pluviales', 'tanque']
    },
    residuos: {
      nombre: 'Residuos', orden: 4, red: 'residuos', requiere: 'residuos',
      desc: 'Recoger la basura y llevarla fuera. Lo que se recicla se VENDE.',
      mejoras: ['reciclaje']
    },
    explotacion: {
      nombre: 'Explotación', orden: 5, siempre: true,
      desc: 'El personal que mantiene todo lo demás. No tiene red propia.',
      mejoras: ['mantenimiento']
    }
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
    reciclaje: {
      nombre: 'Planta de reciclaje', orden: 7,
      desc: 'Cada nivel abre una fracción nueva (envases, orgánica, vidrio...) ' +
            'y con ella un contenedor en el pueblo. Lo separado se vende.',
      costeBase: 5000, factorCoste: 1.75, nivelMax: 7,
      requiere: 'residuos'
    },
    mantenimiento: {
      nombre: 'Personal de mantenimiento', orden: 8,
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
    // El umbral de habitantes vive en CONFIG.servicios.saneamiento
    // (`activaEnHabitantes`): un servicio decide él solo cuándo se abre.
    fraccionResidual: 0.80,  // fracción del agua servida que vuelve como residual
    // Un colector se dimensiona con holgura sobre la línea de agua potable:
    // no lleva solo lo que bebes, lleva también lo que llueve encima.
    holguraColector: 1.6
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
    fraccionAprovechada: 0.35,  // de lo separado, cuánto se recoge para el depósito
    // Un pluvial va sobradísimo respecto a la línea de agua potable: lo suyo son
    // puntas cortas y bestiales, no un caudal sostenido.
    holguraPluvial: 3.0
  },
  /* ---------- CALIDAD DEL PUEBLO ----------
     Multiplica el crecimiento: un pueblo con buen saneamiento crece mejor. */
  calidad: {
    base: 1.0, bonusTanque: 0.10, bonusPluviales: 0.05, max: 1.6
  },

  /* ---------- RESIDUOS ----------
     El cuarto servicio, y el primero que gana dinero en vez de gastarlo. La
     basura sale del pueblo por CARRETERA (la red `residuos`): lo que la vía no
     es capaz de mover se queda pudriéndose en la calle y baja la salubridad.

     Al principio hay un solo contenedor —el gris, resto— y la basura solo se
     entierra en el vertedero: cuesta y no da nada. La planta de reciclaje abre
     una fracción por nivel, y cada fracción se le VENDE a quien la compra, que
     es como funciona de verdad. Reciclar deja de ser una obligación moral y
     pasa a ser el negocio. */
  residuos: {
    kgPorHabitanteDia: 1.4,      // lo que genera cada vecino
    activaEnHabitantes: 800,     // cuándo se abre el servicio
    costeVertidoTonelada: 12,    // lo que cuesta enterrar lo que no se recicla
    // Los precios de abajo son los REALES por tonelada, y así se quedan: lo que
    // importa es que el aceite valga mucho más que la orgánica, y eso es cierto.
    // Pero la economía del juego ya va inflada (el agua se paga a 14 €/m³, no a
    // 1,50 como en la vida), así que sin escalar esto el reciclaje daba 7 €/h
    // contra 115 del agua: cuatro duros y no compensaba mirarlo. Este número
    // sube la escala SIN tocar las proporciones entre fracciones.
    escalaEconomica: 5,
    capacidadVertedero: 0.10,    // t/h que traga cada vertedero conectado

    /* EL VERTEDERO SE LLENA. No es un agujero sin fondo: tiene toneladas de
       capacidad y se acaban. Cuando se llena deja de tragar, la basura se queda
       en la calle y hay que decidir: ampliar el que tienes (más caro cada nivel)
       o abrir otro en otra parte.

       Y gotea. Un vertedero con carga suelta LIXIVIADOS que ensucian las masas de
       agua que tiene cerca, y un agua insalubre da menos caudal: si pones el
       vertedero al lado de tu captación, te envenenas tú solo. Esa es la
       decisión que hace que el sitio importe. */
    vertedero: {
      capacidadBase: 400,        // toneladas que caben de fábrica
      capacidadPorNivel: 350,    // lo que suma cada ampliación
      nivelMax: 5,
      costeAmpliarBase: 1200, factorAmpliar: 1.7,
      radioContaminacion: 3,     // casillas a la redonda que puede envenenar
      lixiviadoPorHora: 0.030,   // cuánto sube la insalubridad del agua cercana
      aporteCauce: 0.25          // parte de eso que además ensucia el cauce común
    },
    // Basura sin recoger: se acumula (0..1) y castiga la salubridad del pueblo,
    // que multiplica el crecimiento igual que hace la calidad del saneamiento.
    // Ojo con estos dos: la primera versión limpiaba la calle más deprisa de lo
    // que se ensuciaba, así que con la vía saturada el contador se quedaba a
    // cero y el castigo no llegaba nunca. Tienen que moverse a la vez.
    acumulaPorTonelada: 2.0,
    recuperacionNatural: 0.010,  // lo que baja sola por hora de juego
    penalizacionCrecimiento: 0.6,

    /* LAS FRACCIONES, en el orden en que las abre la planta. `nivel` es el de
       la mejora `reciclaje` que hace falta; `parte` es qué porcentaje de la
       basura total es esa fracción; `precio` lo que pagan por tonelada.
       El gris (resto) no se recicla: es lo que queda y va al vertedero. */
    fracciones: [
      { id: 'resto',    nombre: 'Resto',              color: '#94a3b8', nivel: 0, parte: 1.00, precio: 0 },
      { id: 'envases',  nombre: 'Envases y embalajes', color: '#facc15', nivel: 1, parte: 0.13, precio: 260 },
      { id: 'organica', nombre: 'Orgánica',            color: '#a16207', nivel: 2, parte: 0.38, precio: 45 },
      { id: 'papel',    nombre: 'Papel y cartón',      color: '#3b82f6', nivel: 3, parte: 0.18, precio: 110 },
      { id: 'vidrio',   nombre: 'Vidrio',              color: '#22c55e', nivel: 4, parte: 0.08, precio: 90 },
      { id: 'aceite',   nombre: 'Aceite',              color: '#f97316', nivel: 5, parte: 0.01, precio: 700 },
      { id: 'ropa',     nombre: 'Ropa',                color: '#c084fc', nivel: 6, parte: 0.04, precio: 320 },
      { id: 'limpio',   nombre: 'Punto limpio',        color: '#14b8a6', nivel: 7, parte: 0.03, precio: 480 }
    ]
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

    
  /* ---------- AVERÍAS (por pueblo) ---------- */
  averias: {
    probBasePorHora: 0.006,
    factorDesgaste: 0.10,
    riesgoAutobomba: 4,
    // Una avería CAE SOBRE UNA PIEZA del mapa y la deja fuera de servicio: se
    // ve dónde se ha roto y se nota qué has dejado de tener. Se arregla yendo
    // allí y clicando encima, y cada golpe de llave cuesta dinero. No hay botón
    // que lo resuelva de lejos: si algo se rompe, hay que ir.
    clicsParaReparar: 6,
    clicsMenosPorNivelMant: 1,   // el personal contratado deja menos faena manual
    clicsMinimos: 2,             // ...pero nunca la quita del todo
    costePorClic: 60,
    reparacionAutoHoras: 6,      // el personal termina el arreglo solo, con tiempo
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
    radioInicial: 3,                // casillas ya abiertas al empezar
    // Alrededor del pueblo, el terreno se rebaja a su variante barata: empezar
    // rodeado de roca viva por capricho de la semilla no es dificultad, es mala
    // suerte. Más allá de este radio manda el mapa.
    radioAmable: 5,
    tamTesela: 74,                   // píxeles por casilla al zoom 1

    // Zoom con la rueda del ratón
    zoomMin: 0.45, zoomMax: 2.2, velocidadZoom: 0.0015,

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
    penalizacionAveria: 0.70,  // multiplicador si hay alguna avería sin reparar
    poderMin: 0.35, poderMax: 6
  },

  /* ---------- TERRENOS ----------
     `costeExtra` multiplica los clics necesarios para abrir la casilla. */
  /* ---------- LOS TERRENOS ----------
     NUEVE tipos en tres familias, y cada uno con su precio. Antes eran tres a
     secas y el mapa era monótono, pero sobre todo trazar era casi siempre ir en
     línea recta: dentro de un tipo el coste era plano y no había nada que
     decidir. Con nueve, cada tramo es una elección — a veces compensa rodear por
     un pinar antes que zanjar un pedregal, aunque el pedregal sea llano.

     `familia` la usa el dibujo (llano / arbolado / relieve) y `costeExtra`
     multiplica lo que cuesta destaparlo. Lo que cuesta ATRAVESARLO con una red
     está en `CONFIG.tuberia.costePorCasilla`, que tiene una entrada por tipo.

     Y ojo, no es solo precio: `CONFIG.construibles[x].terreno` decide dónde cabe
     cada pieza, así que el depósito puede conformarse con una colina o exigir
     sierra. Ahí es donde el terreno deja de ser decorado. */
  terrenos: {
    // --- LLANO: barato de cruzar, pero el pedregal engaña ---
    prado:     { nombre: 'Prado',        familia: 'llano',    color: '#6aab4e', costeExtra: 1.0 },
    pastizal:  { nombre: 'Pastizal',     familia: 'llano',    color: '#8fae52', costeExtra: 1.15 },
    pedregal:  { nombre: 'Pedregal',     familia: 'llano',    color: '#9c9a7e', costeExtra: 1.7 },
    // --- ARBOLADO: hay que desbrozar, y no todo cuesta igual ---
    matorral:  { nombre: 'Matorral',     familia: 'arbolado', color: '#6d9a4a', costeExtra: 1.25 },
    pinar:     { nombre: 'Pinar',        familia: 'arbolado', color: '#4b8b43', costeExtra: 1.5 },
    bosque:    { nombre: 'Bosque cerrado', familia: 'arbolado', color: '#356b38', costeExtra: 1.9 },
    // --- RELIEVE: donde va el depósito, y lo que más cuesta perforar ---
    colina:    { nombre: 'Colina',       familia: 'relieve',  color: '#a8a48c', costeExtra: 1.8 },
    sierra:    { nombre: 'Sierra',       familia: 'relieve',  color: '#9aa0a8', costeExtra: 2.3 },
    roca:      { nombre: 'Roca viva',    familia: 'relieve',  color: '#8b93a0', costeExtra: 3.0 },
    // --- AGUA ---
    agua:      { nombre: 'Río',          familia: 'agua',     color: '#3d84c6', costeExtra: 1.2 },
    lago:      { nombre: 'Lago',         familia: 'agua',     color: '#2f6ea8', costeExtra: 1.2 }
  },

  /* ---------- ESTILO DEL MAPA ----------
     La referencia es un idle builder de vista cenital: campo continuo, no un
     mosaico de cuadros. Las claves son tres y las tres van aquí para poder
     moverlas sin tocar el dibujo:
       · La cuadrícula se ve, es CLARA y se pinta por encima de TODO, agua
         incluida. Es lo que da la sensación de tablero.
       · La variación entre casillas es un damero muy suave, no ruido: si cada
         celda tira por su lado, el prado parece papel pintado roto.
       · Las piezas ocupan bastante MENOS que la casilla y se apoyan en un
         zócalo, para que se lean como fichas puestas sobre el tablero. */
  estiloMapa: {
    // Las teselas son FICHAS: cuadrados redondeados separados por un hueco, no
    // un campo continuo con una rejilla dibujada encima. Es la diferencia entre
    // que el mapa parezca un tablero de piezas o una hoja cuadriculada, y es lo
    // que más define el estilo de la referencia.
    // El hueco tiene que ser un RESPIRO, no una zanja. Con 0.045 el negro del
    // fondo se colaba entre casillas y el mapa parecía de azulejos mal puestos:
    // lo que separa las teselas debe ser el borde, no el vacío.
    separacion: 0.016,      // hueco entre teselas, en fracción de casilla
    radio: 0.11,            // redondeo de las esquinas
    // El contorno de cada ficha, en vez de un negro duro: oscurece su propio
    // color. Así la línea pertenece a la tesela y no la recorta contra el fondo.
    contorno: 0.30,         // cuánto se oscurece el color base para el borde
    damero: 0.030,          // cuánto se aclara/oscurece una casilla respecto a su vecina
    variacion: 0.05,        // ruido por casilla: poco, solo para que no sea plano
    // Las piezas OCUPAN la tesela y sobresalen por arriba: la ficha ya es su
    // base, así que no necesitan zócalo y sí necesitan volumen.
    ladoPieza: 1.02,        // las piezas mandan sobre su casilla
    alturaPieza: 0.34,      // cuánto asoma por encima del borde de la tesela
    /* VELO BAJO LA PIEZA. Un edificio sobre una montaña competía con el pico que
       tenía detrás y no se leía ninguno de los dos. Se apaga y desenfoca el
       terreno justo debajo, como una profundidad de campo: el fondo pierde
       nitidez y la pieza pasa a primer plano. */
    veloPieza: 0.42,        // cuánto se apaga el terreno bajo una construcción
    difuminaPieza: 0.55,    // radio del degradado, en fracción de casilla
    /* EL AÑO EN EL MAPA. El prado amarillea en verano y se apaga en invierno,
       pero con MUY poca amplitud y una transición continua de una estación a la
       siguiente. Un año son 15 minutos reales y una estación 3,8: a ese ritmo un
       cambio de color fuerte sería un parpadeo molesto cada pocos minutos.
       Se busca que lo notes sin que te distraiga. A 0 se apaga del todo. */
    tinteEstacion: 0.16,
    duracionGolpe: 0.45     // segundos que dura el respingo de la bomba al clicar
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
      desc: 'Toma el agua del cauce. Va sobre el río o un lago.',
      // Ficha divulgativa: esto no es texto de juego, es lo que
      // esta pieza ES de verdad. El objetivo del autor es que quien
      // juegue acabe sabiendo algo del oficio.
      ficha: {
        que: 'La OBRA DE TOMA: el punto donde el agua deja de ser del río y entra ' +
        'en el sistema. Suele ser una arqueta o una torre con compuertas, y ' +
        'siempre lleva una REJA de desbaste que para ramas, hojas y todo lo ' +
        'que baja flotando antes de que llegue a las bombas. ',
        para: 'Coger el agua bruta y entregarla al resto de la instalación en ' +
        'condiciones de poder tratarla. Aquí el agua todavía no es potable. ',
        dato: 'El caudal que puedes captar no lo decides tú: lo marca la concesión ' +
        'administrativa y lo limita el propio río. En estiaje hay menos, y ' +
        'cuando viene crecida el problema es el contrario — tanta turbidez que ' +
        'la planta no da abasto y a veces hay que parar la toma. '
      }
    },
    bomba: {
      nombre: 'Bombeo', coste: 250, orden: 2, color: '#7aa7c7',
      terreno: ['prado', 'pastizal'], junto: ['agua', 'lago'],
      desc: 'Impulsa el agua. En tierra llana y despejada, pegado al agua.',
      // Ficha divulgativa: esto no es texto de juego, es lo que
      // esta pieza ES de verdad. El objetivo del autor es que quien
      // juegue acabe sabiendo algo del oficio.
      ficha: {
        que: 'La ESTACIÓN DE BOMBEO. Un edificio con uno o varios grupos motobomba, ' +
        'sus válvulas, el calderín antiariete y el cuadro eléctrico. Es lo que ' +
        'le da al agua la energía que necesita para subir. ',
        para: 'Vencer el desnivel y las pérdidas de carga de la tubería. Lo que la ' +
        'bomba proporciona se llama ALTURA MANOMÉTRICA, y se mide en metros de ' +
        'columna de agua, no en presión a secas. ',
        dato: 'La energía eléctrica es casi siempre la mayor partida del coste de ' +
        'explotación de un abastecimiento. Por eso se bombea de noche siempre ' +
        'que se puede: la tarifa es más barata y el depósito guarda el agua ' +
        'para el día. '
      }
    },
    deposito: {
      nombre: 'Depósito', coste: 400, orden: 3, color: '#7dd3fc',
      // Le vale una COLINA, que es barata de encontrar: obligarle a sierra
      // dejaría a media partida sin sitio donde poner el primer depósito.
      terreno: ['colina', 'sierra', 'roca'],
      desc: 'Guarda agua EN ALTO para que baje por gravedad: va en relieve, y con una colina le basta.',
      // Ficha divulgativa: esto no es texto de juego, es lo que
      // esta pieza ES de verdad. El objetivo del autor es que quien
      // juegue acabe sabiendo algo del oficio.
      ficha: {
        que: 'El DEPÓSITO REGULADOR. Un vaso cerrado, normalmente de hormigón, ' +
        'colocado por encima del pueblo. Puede ser enterrado en una loma o ' +
        'elevado sobre una torre si no hay altura natural. ',
        para: 'Dos cosas a la vez, y por eso es la pieza clave. REGULAR: el consumo ' +
        'tiene puntas de mañana y de tarde, y el depósito las absorbe para que ' +
        'la captación trabaje a caudal constante. Y DAR PRESIÓN: el agua baja ' +
        'por gravedad, así que la altura del depósito es la presión del grifo. ',
        dato: 'Se dimensiona para guardar entre medio día y un día de consumo. Esa ' +
        'reserva no es solo comodidad: es lo que te permite parar la captación ' +
        'por una avería o por un episodio de turbidez sin dejar a nadie sin ' +
        'agua. '
      }
    },
    depuradora: {
      nombre: 'Depuradora', coste: 2000, orden: 4, color: '#34d399',
      terreno: ['prado', 'pastizal'], junto: ['agua', 'lago'],
      desc: 'Trata las aguas residuales antes de devolverlas al cauce.',
      // Ficha divulgativa: esto no es texto de juego, es lo que
      // esta pieza ES de verdad. El objetivo del autor es que quien
      // juegue acabe sabiendo algo del oficio.
      ficha: {
        que: 'Una EDAR: Estación Depuradora de Aguas Residuales. Lo que se ve son ' +
        'los decantadores circulares con su puente de rasquetas girando, pero ' +
        'eso es solo una parte del proceso. ',
        para: 'Devolver al río el agua que el pueblo ha ensuciado, en condiciones de ' +
        'que el río pueda con ella. El agua pasa por un PRETRATAMIENTO ' +
        '(desbaste y desarenado), una DECANTACIÓN primaria que separa lo que ' +
        'sedimenta, y un tratamiento BIOLÓGICO donde son bacterias las que se ' +
        'comen la materia orgánica. ',
        dato: 'Lo que de verdad depura no es una máquina: son microorganismos vivos. ' +
        'Por eso una depuradora no se enciende y se apaga como un motor — ' +
        'necesita semanas para arrancar, y un vertido tóxico puede matarle la ' +
        'biología y dejarla inservible durante días. '
      }
    },
    tanque: {
      nombre: 'Tanque de tormentas', coste: 1500, orden: 5, color: '#818cf8',
      terreno: ['prado', 'pastizal', 'matorral'],
      desc: 'Retiene la punta de lluvia. En llano, o desbrozando matorral.',
      // Ficha divulgativa: esto no es texto de juego, es lo que
      // esta pieza ES de verdad. El objetivo del autor es que quien
      // juegue acabe sabiendo algo del oficio.
      ficha: {
        que: 'Un TANQUE DE TORMENTAS. Un depósito grande, casi siempre enterrado, ' +
        'conectado al colector antes de la depuradora. ',
        para: 'Retener el primer golpe de agua de una tormenta y soltarlo despacio ' +
        'cuando la depuradora vuelva a tener hueco, en vez de aliviarlo al ' +
        'río. ',
        dato: 'Se llama PRIMER LAVADO y es lo más sucio de todo el episodio: la ' +
        'primera lluvia arrastra de golpe los aceites, gomas y suciedad que ' +
        'llevan días acumulándose en las calles. Retener solo esos primeros ' +
        'minutos evita la mayor parte de la contaminación del aguacero entero. '
      }
    },
    vertedero: {
      nombre: 'Vertedero', coste: 1800, orden: 7, color: '#a8896a',
      terreno: ['prado', 'pastizal', 'pedregal', 'matorral'],
      // NO se prohíbe ponerlo junto al agua, se AVISA. Prohibirlo dejaba la
      // mecánica de lixiviados muerta —un vertedero legal nunca podía alcanzar
      // una masa de agua— y encima quitaba la decisión: que puedas equivocarte
      // a sabiendas es justo lo que hace que el sitio importe.
      avisaSiAguaCerca: 3,
      desc: 'Donde acaba lo que no se recicla. Se llena, y gotea: si lo pones ' +
            'junto al agua, la envenenas y tu captación rinde menos.',
      // Ficha divulgativa: esto no es texto de juego, es lo que
      // esta pieza ES de verdad. El objetivo del autor es que quien
      // juegue acabe sabiendo algo del oficio.
      ficha: {
        que: 'Un VERTEDERO CONTROLADO. No es un agujero: es un vaso ' +
        'impermeabilizado con láminas y arcilla, con red de drenaje en el ' +
        'fondo y chimeneas de desgasificación. ',
        para: 'Confinar lo que no se puede aprovechar, aislándolo del terreno y del ' +
        'agua subterránea. Los residuos se extienden en capas y se cubren cada ' +
        'día con tierra para que no vuelen ni atraigan bichos. ',
        dato: 'Lo que se filtra por dentro se llama LIXIVIADO y es un líquido muy ' +
        'cargado: hay que recogerlo y tratarlo aparte, a veces durante décadas ' +
        'después de haber cerrado el vertedero. Un vertedero no termina cuando ' +
        'se llena; hay que vigilarlo treinta años más. '
      }
    },
    reciclaje: {
      nombre: 'Planta de reciclaje', coste: 6000, orden: 8, color: '#4ade80',
      terreno: ['prado', 'pastizal'],
      desc: 'Separa y vende lo aprovechable. Cuanto mejor sea, más fracciones ' +
            'recupera y más te pagan por ellas.',
      // Ficha divulgativa: esto no es texto de juego, es lo que
      // esta pieza ES de verdad. El objetivo del autor es que quien
      // juegue acabe sabiendo algo del oficio.
      ficha: {
        que: 'Una PLANTA DE TRATAMIENTO DE RESIDUOS. Una nave con cintas ' +
        'transportadoras, tromel, separadores magnéticos y de corrientes de ' +
        'Foucault, y puestos de triaje manual. ',
        para: 'Separar lo aprovechable de lo que hay que enterrar. Cuanto mejor ' +
        'separada llega la basura desde los contenedores, más se recupera y ' +
        'más limpio sale el material. ',
        dato: 'El material recuperado SE VENDE, y cada fracción tiene su precio de ' +
        'mercado: el aceite usado o el aluminio valen muchísimo más por ' +
        'tonelada que la materia orgánica. Por eso separar en casa no es un ' +
        'gesto simbólico — es lo que hace que el sistema se pague solo. '
      }
    },
    acuifero: {
      nombre: 'Sondeo a acuífero', coste: 5000, orden: 6, color: '#a78bfa',
      terreno: ['prado', 'pastizal', 'pedregal', 'matorral', 'pinar',
                'colina', 'sierra'], lejosDeAgua: 4,
      desc: 'El recurso de última hora: perfora y saca agua del subsuelo. ' +
            'Solo tiene sentido lejos del cauce, y sale caro.',
      // Ficha divulgativa: esto no es texto de juego, es lo que
      // esta pieza ES de verdad. El objetivo del autor es que quien
      // juegue acabe sabiendo algo del oficio.
      ficha: {
        que: 'Un SONDEO a un acuífero. Una perforación estrecha y profunda —decenas ' +
        'o cientos de metros— con su entubación, su filtro a la altura del ' +
        'acuífero y una bomba sumergida en el fondo. ',
        para: 'Sacar agua subterránea cuando no hay río cerca o cuando el río no da ' +
        'para más. Sale a temperatura y calidad muy constantes durante todo el ' +
        'año, lo que la hace muy cómoda de tratar. ',
        dato: 'Un acuífero se recarga despacio, con la lluvia de años. Si extraes ' +
        'más de lo que entra, el nivel baja, hay que bombear desde más hondo ' +
        '—más energía— y en la costa puede entrar agua del mar y salinizarlo ' +
        'para siempre. Es el recurso más cómodo y el más fácil de estropear. '
      }
    }
  },

  /* ---------- LO QUE APORTA CADA PIEZA CONECTADA ----------
     La tienda de mejoras sube el NIVEL (lo bien que rinde cada una); el mapa
     decide CUÁNTAS tienes y si están enganchadas. Una pieza sin tubería al
     pueblo no cuenta: por eso el trazado importa. */
  aportePorPieza: {
    captacion: 0.10,     // L/s de producción pasiva que suma cada captación
    deposito: 9000,      // litros de capacidad que suma cada depósito
    bomba: 220,          // litros por clic que suma cada bombeo
    // Estas dos van por la red de SANEAMIENTO, no por la de abastecimiento
    depuradora: 2000,    // L/h de tratamiento que suma cada depuradora
    // ...y lo BIEN que lo trata. Sin esto una depuradora del mapa hacía pasar el
    // agua por dentro y la devolvía igual de sucia: mucho caudal y cero limpieza.
    depuradoraCalidad: 0.22,
    tanque: 25000        // litros de retención que suma cada tanque
  },

  /* ---------- LAS REDES ----------
     Un pueblo no tiene UNA red, tiene varias, y cada una lleva lo suyo en su
     dirección: el abastecimiento trae agua limpia, el saneamiento se lleva la
     sucia. Comparten mecánica (trazado a mano, diámetros, cuello de botella) y
     no se mezclan: una tubería de saneamiento no conecta una captación.

     `piezas` dice qué construcciones cuentan en cada una. Las pluviales serán la
     tercera, cuando toque separarlas del colector unitario. */
  redes: {
    abastecimiento: {
      nombre: 'Abastecimiento', corto: 'agua', color: '#38bdf8',
      tiers: 'tuberia',
      piezas: ['captacion', 'bomba', 'deposito', 'acuifero'],
      desc: 'Trae el agua desde la captación hasta el pueblo.'
    },
    saneamiento: {
      nombre: 'Saneamiento', corto: 'colector', color: '#a3a15c',
      tiers: 'tuberia',
      piezas: ['depuradora'],
      desc: 'Se lleva las aguas residuales del pueblo hasta la depuradora.'
    },
    // La tercera. Al principio TODO va por el colector unitario: la lluvia y las
    // fecales juntas, que es lo que revienta la depuradora en tormenta. Separar
    // es tender esta red aparte, y lo que separa es lo que le quepa: por eso
    // aquí el diámetro no es un detalle, es la mecánica entera.
    pluviales: {
      nombre: 'Pluviales', corto: 'pluvial', color: '#60a5fa',
      tiers: 'tuberia',
      piezas: ['tanque'], requiere: 'pluviales',
      desc: 'Saca el agua de lluvia del colector antes de que sature la depuradora.'
    },
    // La cuarta, y la primera que NO es una tubería. La mecánica es la misma
    // —se traza a mano, manda el tramo peor, renovar a medias no sirve— pero lo
    // que circula son camiones, así que su escala son clases de vía.
    residuos: {
      nombre: 'Residuos', corto: 'carretera', color: '#b7a08a',
      tiers: 'viales', esVial: true,
      piezas: ['vertedero', 'reciclaje'], requiere: 'residuos',
      desc: 'Lleva la basura del pueblo al vertedero y a la planta de reciclaje.'
    }
  },

  /* ---------- TUBERÍAS ----------
     No van por donde quieran: cada casilla cuesta según lo que haya que hacer
     para atravesarla. Rodear un bosque o pagar por desbrozarlo es la decisión. */
  tuberia: {
    /* Lo que cuesta meter una red por cada terreno. Los saltos son grandes a
       propósito: si la diferencia fuera pequeña, rodear no compensaría nunca y
       volveríamos a la línea recta de siempre. */
    costePorCasilla: {
      prado: 12, pastizal: 16, pedregal: 52,
      matorral: 26, pinar: 45, bosque: 78,
      colina: 70, sierra: 120, roca: 190,
      agua: 70, lago: 70
    },
    nombreObra: {
      prado: 'zanja', pastizal: 'zanja', pedregal: 'picado de piedra',
      matorral: 'desbroce', pinar: 'tala', bosque: 'tala y destoconado',
      colina: 'excavación', sierra: 'excavación en roca', roca: 'voladura',
      agua: 'cruce del cauce', lago: 'cruce del lago'
    },

    /* --- DIÁMETROS Y MATERIALES ---
       Una tubería no es solo un camino: tiene un tamaño. `caudalMax` es lo que
       cabe por ella (L/s de juego) y `habitantesMax` hasta dónde puede crecer
       el pueblo que alimenta. La red vieja es de FIBROCEMENTO porque es lo que
       de verdad hay heredado en media España: barata, estrecha y con fugas.

       Regla del juego: manda el TRAMO MÁS ESTRECHO de toda la línea. Renovar
       medio recorrido no sirve de nada. Por eso `caudalMax` y `habitantesMax`
       van de la mano (≈ litros/hab/día): el tope de población de cada diámetro
       es justo la gente a la que puede dar de beber. */
    diametros: [
      { id: 'dn63',  nombre: 'DN 63',  material: 'fibrocemento',
        caudalMax: 0.80, habitantesMax: 400,  fugas: 0.12,
        costeRelativo: 1,   color: '#9aa08a' },
      { id: 'dn110', nombre: 'DN 110', material: 'polietileno',
        caudalMax: 3.20, habitantesMax: 1600, fugas: 0.04,
        costeRelativo: 3.5, color: '#38bdf8' },
      { id: 'dn200', nombre: 'DN 200', material: 'fundición dúctil',
        caudalMax: 12.0, habitantesMax: 6000, fugas: 0.01,
        costeRelativo: 11, color: '#cbd5e1' }
    ],
    // Al renovar un tramo se recupera parte del material viejo: renovar es más
    // barato que tender de cero, pero no gratis.
    valorRecuperado: 0.25
  },

  /* ---------- VIALES ----------
     La escala de la red de residuos. Es la MISMA mecánica que los diámetros
     —manda el tramo peor y renovar a medias no sirve— pero medir una carretera
     en "DN 63 de fibrocemento" no tendría ningún sentido, así que cada red usa
     su propia tabla (`CONFIG.redes[red].tiers`).

     Aquí `caudalMax` son toneladas de basura por hora que aguanta la vía, y
     `habitantesMax` la gente a la que puede dar servicio: los dos van de la mano
     (a 1,4 kg por vecino y día) y hay que moverlos JUNTOS. Con caudales sueltos,
     una pista de tierra daba para cinco mil habitantes y la carretera no era un
     cuello de botella nunca, que es justo lo contrario de lo que se busca. `fugas` es la basura
     que se pierde por el camino: en una pista de tierra el camión va dando
     tumbos y se deja media carga en la cuneta. */
  viales: {
    clases: [
      { id: 'pista',   nombre: 'Pista',    material: 'tierra compactada',
        caudalMax: 0.06, habitantesMax: 900,  fugas: 0.15,
        costeRelativo: 0.8, color: '#a8896a' },
      { id: 'asfalto', nombre: 'Asfaltada', material: 'aglomerado',
        caudalMax: 0.20, habitantesMax: 3000, fugas: 0.05,
        costeRelativo: 3.0, color: '#94a3b8' },
      { id: 'calzada', nombre: 'Doble calzada', material: 'hormigón',
        caudalMax: 0.60, habitantesMax: 9000, fugas: 0.01,
        costeRelativo: 9.0, color: '#e2e8f0' }
    ]
  },

  /* ---------- HALLAZGOS ----------
     Lo que se encuentra explorando. Las ruinas son instalaciones abandonadas:
     se pueden reparar en el sitio o llevarse al inventario para colocarlas
     donde convenga. */
  hallazgos: {
    pueblos: 7, ruinas: 14,
    distanciaMinima: 4,      // nada de hallazgos pegados al origen
    color: { pueblo: '#facc15', ruina: '#c084fc', arqueologia: '#d9a441' },

    // Qué pieza puede salir de una instalación abandonada, y con qué peso
    piezasRuina: ['bomba', 'bomba', 'deposito', 'captacion', 'depuradora', 'tanque'],
    // Reparar en el sitio sale a cuenta; desmontarla para llevártela, también,
    // pero cuesta más porque hay que trasladarla.
    costeReparar: 0.35,      // fracción del precio de la pieza
    costeDesmontar: 0.55,
  },

  /* ---------- YACIMIENTOS ARQUEOLÓGICOS ----------
     Están BAJO TIERRA: no se ven en el mapa. Aparecen al EXCAVAR, o sea cuando
     intentas tender una tubería o una carretera por esa casilla o levantar algo
     encima. Y ya no se van: no se pueden eliminar, hay que RODEARLOS.

     Es el primer obstáculo del juego que sale DESPUÉS de haber decidido. Todo lo
     demás lo ves antes de pagar; esto te obliga a replantear un trazado ya
     empezado, y de ahí salen las historias. Por eso mismo tiene que ser RARO: si
     apareciera a menudo dejaría de ser un contratiempo con carácter y sería un
     impuesto aleatorio y molesto.

     Excavarlo cuesta, pero luego renta todos los meses: el premio a haber
     tropezado con él y haberlo tratado bien. */
  arqueologia: {
    cantidad: 14,            // cuántos esconde el mapa entero
    distanciaMinima: 3,      // ninguno pegado al pueblo de origen
    costeExcavar: 2600,
    rentaPorHora: 26,        // ingreso mientras siga excavado y cuidado
    color: '#d9a441'
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
    // El contorno del territorio ya explorado. Va aparte de `alarma` aunque se
    // parezcan: uno avisa de un problema y el otro dice "esto es tuyo".
    dorado:     '#e0b155',
    critico:    '#ef4444',
    premium:    '#c084fc',
    texto:      '#cfdce8',
    tenue:      '#6f8aa1'
  },

  /* ---------- LA GUÍA DE LOS PRIMEROS PASOS ----------
     Acompaña hasta que el pueblo bebe por primera vez, y se quita de en medio.
     Cada paso se da por hecho SOLO cuando el jugador lo consigue de verdad (la
     comprobación está en tutorial.js): nada de "pulsa siguiente". */
  tutorial: [
    { id: 'explorar',  titulo: 'Destapa el terreno',
      texto: 'Clica sobre una casilla en penumbra, junto a tu pueblo. Cada una ' +
             'necesita varios clics: el número que ves es lo que le falta.' },
    { id: 'captacion', titulo: 'Busca de dónde sacar agua',
      texto: 'Encuentra el río y pon una CAPTACIÓN sobre una casilla de agua. ' +
             'La eliges en «Construir en el mapa»; en verde es que ahí vale.' },
    { id: 'bomba',     titulo: 'Levanta el bombeo',
      texto: 'El agua no sube sola. Coloca un BOMBEO en tierra llana, pegado al agua.' },
    { id: 'tuberia',   titulo: 'Une todo con tubería',
      texto: 'Con «Tender tubería» marca el recorrido casilla a casilla, desde ' +
             'tu pueblo hasta el bombeo. Clic en la última para rematar. Ojo: ' +
             'lo que no queda conectado no sirve de nada.' },
    { id: 'bombear',   titulo: 'A bombear',
      texto: 'Pulsa BOMBEAR (o la barra espaciadora) para llenar el depósito. ' +
             'Si dejas de clicar, el pueblo se queda seco.' },
    { id: 'servido',   titulo: '¡Tu pueblo bebe!',
      texto: 'Ya está abastecido. A partir de aquí: engrasa la instalación para ' +
             'que no pierda fuelle, explora más lejos para encontrar pueblos a ' +
             'los que dar servicio, y vigila «La red»: por la tubería estrecha ' +
             'que has puesto no cabe agua para siempre. Cuando algo se rompa, ' +
             'búscalo en el mapa: se repara clicando encima. Y al crecer llegarán ' +
             'el saneamiento, las pluviales y la basura, cada uno con SU red.' }
  ],

  /* ---------- GUARDADO ----------
     v2: el formato multi-pueblo no es compatible con el de un solo pueblo. */
  guardado: { clave: 'redHidraulica_clicker_v2', intervaloSegundos: 10 }
};
