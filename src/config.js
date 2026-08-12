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

  /* ---------- EL PUEBLO DE ORIGEN Y LOS NÚCLEOS ----------
     Ya no hay una lista fija de tres pueblos: el de origen arranca contigo y el
     resto están REPARTIDOS POR EL MAPA, sembrados en anillos de distancia.
     Encontrarlos explorando, llegar con una tubería e incorporarlos ES el juego,
     y no tiene final: cuantos más incorporas, más lejos están los siguientes.

     Cada anillo trae núcleos algo mayores (más renta) pero mucho más caros de
     alcanzar: la distancia, el terreno duro y el calibre necesario hacen la
     dificultad exponencial sin tocar ningún multiplicador. */
  poblacionOrigen: { nombre: 'Villagua', habitantes: 200 },

  nucleos: {
    // Anillos de siembra: hasta qué distancia del origen y cuántos núcleos.
    // El anillo N solo se puede INCORPORAR en fase >= N (ver `fases`).
    anillos: [
      { hasta: 14, n: 5 },
      { hasta: 24, n: 6 },
      { hasta: 34, n: 7 },
      { hasta: 46, n: 8 },
      { hasta: 62, n: 10 }
    ],
    separacion: 6,           // casillas mínimas entre núcleos
    // EL CANON DE INCORPORACIÓN: absorber un núcleo cuesta expediente, obra de
    // conexión y personal, y cada uno más que el anterior. Esta es la palanca
    // que hace la dificultad exponencial de verdad: la tubería crece lineal con
    // la distancia, pero el canon crece geométrico con el tamaño de la
    // mancomunidad. El decimoquinto pueblo no cuesta lo que el quinto.
    canonBase: 400,
    canonFactor: 1.30,
    habitantesMin: 120,      // tamaño con el que llega cada uno (crece por anillo)
    habitantesMax: 260,
    habitantesPorAnillo: 60, // los lejanos son algo mayores: premio por el viaje
    // Nombres generados combinando estas dos listas, en orden estable de semilla
    prefijos: ['Riba', 'Fuente', 'Val', 'Puente', 'Torre', 'Molino', 'Vega',
               'Soto', 'Pozo', 'Presa'],
    sufijos: ['frío', 'clara', 'seca', 'hondo', 'verde', 'alto', 'chica',
              'del Río', 'de la Peña', 'salada']
  },

  /* ---------- LAS FASES ----------
     La mancomunidad crece a saltos: incorporar núcleos abre el siguiente
     anillo. Los umbrales son el NÚMERO DE PUEBLOS incorporados (contando el de
     origen) que hace falta para poder absorber los del anillo siguiente:
     primero 5, luego 10, luego 15... El salto crece porque una administración
     no absorbe veinte núcleos igual que absorbe tres. */
  fases: {
    umbrales: [5, 10, 15, 21, 28]
  },

  /* ---------- GANCHOS DE ACELERACIÓN (futuro) ----------
     Si el juego se comercializa, aquí irían los aceleradores por anuncio o pago
     (más clics, obras al instante...). Como con el auto-bombeo: `desbloqueoExterno`
     es SOLO el gancho — NO hay pago ni anuncio implementado y no se debe simular
     ninguno falso. */
  aceleradores: { desbloqueoExterno: null },

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
      // Subido de 500: el bot midió que a 500 llegaba a los SEIS minutos de
      // partida, con el jugador aún aprendiendo a clicar.
      activaEnHabitantes: 800,
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
      // Subido de 2500: con aquello, a 6000 hab el residual (33.000 L/h)
      // superaba el tratamiento máximo posible y el río moría hicieras lo que
      // hicieras. La lección que enseñaba era la contraria a la buscada.
      caudalPorNivel: 6000      // L/h que es capaz de tratar cada nivel (lo que
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
    activaEnHabitantes: 1400,    // cuándo se abre el servicio
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
    porLitroResidual: 0.00035,  // cuánto sube la contaminación por litro crudo vertido
    // Subida junto con la depuración: con 0,6 incluso tratando el 96 % el goteo
    // superaba lo que el río recupera, y el final era una asíntota muerta.
    recuperacionNatural: 0.9,   // cuánto baja sola por hora de juego
    limpiezaPorClic: 4,         // cuánto baja cada clic de LIMPIAR CAUCE
    multaMaxPorHora: 45,        // € por hora de juego con el cauce al máximo de suciedad
    frenoCrecimiento: 0.85      // a suciedad máxima, el crecimiento se reduce hasta ×0,15
  },

  /* ---------- ECONOMÍA ---------- */
  economia: {
    /* El anticipo de la concesión. Medido con el bot: con 25 € la primera obra
       llegaba al minuto 5 — cinco minutos de clicar sin nada que decidir, y un
       jugador nuevo decide si se queda en menos de uno. Con 260 la captación
       (300 €) queda a un puñado de clics: se aprende igual que clicar es
       dinero, pero la primera DECISIÓN llega cuando aún hay alguien mirando. */
    dineroInicial: 260,
    // Alta a propósito: el esfuerzo de clicar se paga en DINERO, no en agua
    // regalada. Es lo que evita la desesperación de los primeros minutos.
    tarifa: 14.00,
    horasPorSegundo: 0.4
  },

  /* ---------- SONIDO ----------
     Sintetizado entero (src/sonido.js): aquí solo los mandos de volumen. Los
     "parches" de cada efecto —frecuencias, envolventes— son decisiones
     musicales y viven con el código, como los trazos del dibujo. */
  sonido: {
    volumen: 0.35,        // efectos; su interruptor de la cabecera los apaga
    volumenLluvia: 0.05,  // el ambiente de lluvia, muy por debajo del resto
    /* La música de fondo (assets/musica.ogg|mp3|wav, generada por el autor).
       De fondo DE VERDAD: si compite con los efectos, cansa en diez minutos. */
    volumenMusica: 0.18,
    /* El recorte del bucle: la música generada trae fundido a silencio al
       final, y en bucle eso es morirse y arrancar de golpe. Se mide el volumen
       por ventanas y se repite solo el tramo que supera `umbral` × mediana. */
    bucle: {
      ventana: 0.25,   // segundos por ventana de medida
      umbral: 0.5      // fracción de la mediana por debajo de la cual es "cola"
    }
  },

  /* ---------- MINIJUEGOS ----------
     La regla de oro de todos: OPCIONALES y nunca puerta de progreso. Salen de
     momentos que ya existen y dan ventaja a quien los juega; quien pase de
     ellos no pierde nada esencial. Uno solo de momento: el de tuberías. */
  minijuegos: {
    tuberias: {
      columnas: 7, filas: 5,
      rocas: 4,                // celdas bloqueadas: obligan a rodear
      graciaSegundos: 5,       // margen antes de que el agua entre al tablero
      segundosPorCelda: 1.15,  // lo que tarda el agua en cruzar cada pieza
      aceleracion: 0.96,       // cada celda cruzada, un poco más rápido
      probRecto: 0.55          // reparto de la cola de piezas (resto: codos)
    }
  },

  /* ---------- LUGARES: pueblos con nombres de la zona del jugador ----------
     Opcional SIEMPRE (ver src/lugares.js: la ubicación no se guarda y solo
     sale en una consulta anónima a OpenStreetMap). Es la única pieza del juego
     que habla con un servicio externo. */
  lugares: {
    radioKm: 30,          // hasta dónde se buscan municipios alrededor
    maxNombres: 48,       // 36 núcleos + margen para repoblar
    servicio: 'https://overpass-api.de/api/interpreter'
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
    /* Tres horas y a MEDIO rendimiento: la explotación sin nadie al mando rinde
       menos, y el juego es estar. Además deja hueco para la monetización
       futura: pagar por más horas o por el rendimiento completo sería la
       ventaja natural a vender. Como el auto-bombeo y los aceleradores:
       `desbloqueoExterno` es el GANCHO — NO hay pago ni anuncio implementado y
       no se debe simular ninguno falso. */
    maxHoras: 3,
    rendimiento: 0.5,          // fracción de la ganancia que se cobra offline
    desbloqueoExterno: null,
    /* La TARJETA de vuelta solo desde ausencias de verdad: por debajo, la línea
       del registro basta. Con el umbral en cero, cada recarga rápida taparía el
       juego con una tarjeta, y taparlo es un privilegio que hay que ganarse. */
    tarjetaDesdeMinutos: 10
  },

  /* ---------- EL MUNDO: mapa grande de exploración ----------
     Mucho mayor que la pantalla y casi todo tapado. Se destapa a clics, y
     cuanto más lejos del pueblo de origen, más cuesta. */
  mapaMundo: {
    // GRANDE a propósito: el juego ahora es incorporar núcleos cada vez más
    // lejanos, y eso necesita sitio. Solo se dibuja lo visible, así que el
    // tamaño no cuesta rendimiento: cuesta exploración, que es lo que debe.
    cols: 96, filas: 68,
    semilla: 20260809,
    origen: { col: 48, fila: 34 },   // aquí está tu pueblo inicial
    radioInicial: 3,                // casillas ya abiertas al empezar
    // Alrededor del pueblo, el terreno se rebaja a su variante barata: empezar
    // rodeado de roca viva por capricho de la semilla no es dificultad, es mala
    // suerte. Más allá de este radio manda el mapa.
    radioAmable: 5,
    tamTesela: 74,                   // píxeles por casilla al zoom 1

    // Zoom con la rueda del ratón
    zoomMin: 0.22, zoomMax: 2.2, velocidadZoom: 0.0015,

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
      nombre: 'Pozo de explotación', coste: 5000, orden: 6, color: '#a78bfa',
      // No lleva `terreno`: va donde el SONDEO haya dado agua y en ningún otro
      // sitio. Antes pedía estar a 4 casillas del río y podía ponerse en
      // cualquier parte, que era tanto como decir que el agua estaba en todas.
      requiereSondeo: true,
      desc: 'Explota el agua que ha encontrado el sondeo. Solo puede ir sobre ' +
            'una perforación que haya dado agua.',
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
        'para siempre. Es el recurso más cómodo y el más fácil de estropear. ' +
        'Por eso lo que se mira no es lo que da la bomba, sino el CAUDAL ' +
        'SOSTENIBLE: lo que la lluvia devuelve cada año. Sacar más que eso no ' +
        'es abastecer, es minar agua. '
      }
    }
  },

  /* ---------- AMPLIACIÓN DE PIEZAS DEL MAPA ----------
     Cada pieza construida es ALGUIEN: lleva su nombre ("Depósito 2"), su nivel
     y su ficha al seleccionarla, y se amplía ahí mismo. Sin esto, con dos
     depósitos en el mapa no había manera de saber cuál era cuál — la pregunta
     exacta que hizo el autor y que destapó el hueco.

     El reparto de papeles queda así: la TIENDA sube la instalación propia del
     pueblo activo (su red municipal de siempre); cada pieza del MAPA se
     selecciona y se amplía individualmente. Ampliar multiplica su aporte:
     una pieza de nivel 3 cuenta como tres. */
  ampliacion: {
    tipos: ['captacion', 'bomba', 'deposito', 'depuradora', 'tanque'],
    nivelMax: 4,
    factorCoste: 1.7       // ampliar a nivel n cuesta coste × factor^(n-1)
  },

  /* ---------- DERRIBO ----------
     Equivocarse de sitio tiene que tener salida: se derriba y se recupera una
     parte de lo invertido. Solo una parte — deshacer no puede ser gratis, o
     colocar deja de ser una decisión. Las tuberías se LEVANTAN con la misma
     lógica, al `tuberia.valorRecuperado` de siempre. */
  derribo: {
    fraccionRecuperada: 0.3   // de lo invertido (pieza + ampliaciones)
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
    depuradora: 8000,    // L/h de tratamiento que suma cada depuradora
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
    /* `vidaAños` es la VIDA ÚTIL del material: pasada esa edad la línea no
       revienta, pero fuga cada año más (ver `envejecimiento`). El dato de los
       40 años del fibrocemento es del oficio —una canalización de más de 40 se
       considera susceptible de cambiarse— y el calendario del juego lo deja en
       ~10 horas reales de partida: mantenimiento de fondo, no un fastidio. Los
       materiales mejores viven más: pagar fundición también compra paz. */
    diametros: [
      { id: 'dn63',  nombre: 'DN 63',  material: 'fibrocemento',
        caudalMax: 0.80, habitantesMax: 400,  fugas: 0.12, vidaAños: 40,
        costeRelativo: 1,   color: '#9aa08a' },
      { id: 'dn110', nombre: 'DN 110', material: 'polietileno',
        caudalMax: 3.20, habitantesMax: 1600, fugas: 0.04, vidaAños: 50,
        costeRelativo: 3.5, color: '#38bdf8' },
      { id: 'dn200', nombre: 'DN 200', material: 'fundición dúctil',
        caudalMax: 12.0, habitantesMax: 6000, fugas: 0.01, vidaAños: 70,
        costeRelativo: 11, color: '#cbd5e1' }
    ],
    /* Cómo envejece una línea pasada su vida útil: las fugas crecen despacio y
       con TECHO — una red vieja sangra, no mata. Renovarla (aunque sea al mismo
       calibre ya no: a uno mayor) la deja nueva y el reloj vuelve a cero. */
    envejecimiento: {
      fugasPorAño: 0.012,     // puntos de fuga extra por año pasado de vida
      fugasExtraMax: 0.15     // techo del castigo: nunca más de esto de propina
    },
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
    // Los PUEBLOS ya no se siembran aquí: van por anillos (CONFIG.nucleos)
    ruinas: 30,
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
    cantidad: 40,            // cuántos esconde el mapa entero
    distanciaMinima: 3,      // ninguno pegado al pueblo de origen
    costeExcavar: 2600,
    color: '#d9a441',
    /* Cada yacimiento ES algo concreto, no "restos" genéricos. El peso decide
       cuántos salen de cada clase y la renta lo que dejan puestos en valor: los
       raros (homínidos, dinosaurios) son los premios gordos de picar donde no
       debías. La imagen de cada uno es `assets/a_<id>.jpg`; sin ella la ficha
       sale igual con su texto. */
    tipos: [
      { id: 'poblado',     nombre: 'Poblado antiguo',        peso: 3, renta: 22,
        desc: 'Muros de un asentamiento de hace siglos: calles, hogares y cerámica.' },
      { id: 'tesoro',      nombre: 'Depósito de objetos',    peso: 2, renta: 30,
        desc: 'Monedas, herramientas y piezas de bronce escondidas en su día y nunca recuperadas.' },
      { id: 'necropolis',  nombre: 'Necrópolis',             peso: 2, renta: 26,
        desc: 'Un cementerio antiguo. Las tumbas cuentan cómo vivía la gente mejor que ningún libro.' },
      { id: 'hominidos',   nombre: 'Restos de homínidos',    peso: 1, renta: 45,
        desc: 'Huesos y herramientas de los primeros humanos. Rarísimo: media provincia vendrá a verlo.' },
      { id: 'dinosaurios', nombre: 'Fósiles de dinosaurio',  peso: 1, renta: 60,
        desc: 'Huesos de hace millones de años. El premio gordo de cualquier obra: un museo en tu pueblo.' }
    ]
  },

  /* ---------- ZONAS DE ESPECIAL CONSERVACIÓN ----------
     Entornos protegidos por el Estado: hábitats de fauna o riberas y masas de
     flora singular. NO se puede construir ni tender redes dentro —hay que
     rodear, como con la arqueología— y contaminarlos (los lixiviados de un
     vertedero llegan lejos) trae multa mientras dure el daño.

     Son la otra restricción real de trazado: las conducciones de verdad dan
     rodeos enormes para no tocar espacios protegidos. */
  proteccion: {
    zonas: 9,                // cuántas ZEC siembra el mapa
    tamMin: 4, tamMax: 9,    // casillas por zona (manchas orgánicas)
    distanciaMinima: 7,      // ninguna pegada al pueblo de origen
    multaPorHoraCelda: 14,   // € por hora y casilla protegida contaminada
    color: '#2dd48f'
  },

  /* ---------- EL AGUA QUE NO SE VE ----------
     Más de la mitad de los núcleos del mapa están lejos de un río, y llegar
     hasta ellos son kilómetros de tubería. El subsuelo es la otra respuesta: a
     veces hay agua justo debajo y a veces no, y averiguarlo cuesta dinero.

     La cadena es la del oficio, y son TRES pasos que no se saltan:
       1. ESTUDIO hidrogeológico — barato, cubre un área, y NO encuentra agua:
          dice dónde hay indicios favorables. Es cartografía y geofísica.
       2. SONDEO de prospección — caro, una casilla, y puede salir SECO. Ahí es
          donde se pierde el dinero, y es la lección: por eso se estudia antes.
       3. Explotación — si dio agua, ya se puede construir el pozo encima.

     Los indicios NO son el acuífero: se marcan también donde la geología se
     parece pero no hay agua (`señuelos`). Si el estudio acertara siempre, el
     sondeo dejaría de ser una apuesta y no habría nada que decidir. */
  acuiferos: {
    /* Dos clases, y son distintas a propósito: la de montaña es más difícil de
       perforar y da menos, pero le da igual el año seco; la del llano da más y
       es más barata, y en estiaje se resiente. Es la diferencia real entre una
       caliza fisurada y los gravas de una vega. */
    clases: {
      karst: {
        nombre: 'Acuífero de montaña', corto: 'montaña',
        terrenos: ['colina', 'sierra', 'roca', 'pedregal'],
        masas: 7, tamMin: 3, tamMax: 6,
        caudal: 0.85,          // L/s que da el pozo, en la escala de captación
        costeSondeo: 4200,     // perforar roca cuesta más
        sensibilidadEstiaje: 0.15,   // 0 = le da igual el año; 1 = como el río
        /* Lo que ENTRA por casilla de masa, en L/s A LLUVIA MÁXIMA. Ojo con este
           número: la recarga la modula la lluvia, que de media anual es 0,64, así
           que lo que de verdad entra es el 64% de esto. Calibrado con la media —no
           con el máximo, que fue el fallo la primera vez y dejaba un solo pozo
           agotando el acuífero— para que UN pozo se sostenga en la masa más
           pequeña (3 celdas × 0,47 × 0,64 = 0,90 contra 0,85 que saca) y DOS no.
           El caudal sostenible no lo decide la bomba, lo decide el acuífero. */
        recargaPorCelda: 0.47,
        // Lo que la masa GUARDA, en L/s·hora por casilla: el colchón que te deja
        // pasarte una temporada antes de notarlo. La montaña guarda más y se
        // recarga más despacio; es agua de muchos años.
        reservaPorCelda: 85,
        color: '#a78bfa',
        desc: 'Agua metida en las grietas de la roca. Cuesta perforar y da menos, ' +
              'pero el nivel apenas se mueve en todo el año.'
      },
      aluvial: {
        nombre: 'Acuífero aluvial', corto: 'aluvial',
        terrenos: ['prado', 'pastizal', 'matorral'],
        masas: 6, tamMin: 4, tamMax: 8,
        caudal: 1.35,
        costeSondeo: 2600,
        sensibilidadEstiaje: 0.5,
        recargaPorCelda: 0.56,   // 4 celdas × 0,56 × 0,64 = 1,44 contra 1,35 de un pozo
        reservaPorCelda: 55,     // guarda menos que la montaña, pero se repone antes
        color: '#67e8f9',
        desc: 'Agua entre las gravas de una vega antigua. Barato de perforar y ' +
              'generoso, pero nota el verano: se recarga del río y de la lluvia.'
      }
    },
    distanciaMinima: 5,     // ninguno pegado al pueblo de origen
    /* El halo a 0 y los señuelos aparte, y esto está medido: con halo 1 los
       indicios acertaban el 19% de las veces —el estudio no se pagaba y
       perforar volvía a ser una lotería— porque el borde de cada masa mete
       muchísima casilla seca. Así los indicios dibujan la formación tal cual y
       lo que engaña son los señuelos, que es lo que engaña de verdad: una
       geología que promete y no cumple. Sale en torno a dos aciertos de cada
       tres, que es lo que hace que estudiar valga la pena SIN volverlo seguro. */
    haloIndicios: 0,        // casillas de indicios alrededor de cada masa
    señuelos: 11,           // manchas con indicios y SIN agua: el sondeo seco
    tamSeñuelo: 4,
    estudio: {
      coste: 900,           // por estudio, cubre un área
      radio: 2              // 5x5 casillas alrededor de la elegida
    },
    /* ---- SOBREEXPLOTACIÓN ----
       Un acuífero no es un grifo: es un depósito que se llena solo, despacio.
       Si sacas más de lo que entra, el nivel baja, y cuando baja de
       `umbralMerma` el pozo empieza a dar menos — que es lo que pasa de verdad:
       hay que bombear desde más hondo hasta que el pozo se queda seco.

       No se prohíbe poner dos pozos en la misma masa. Se deja, se avisa, y el
       acuífero pasa la factura. Es la misma regla que el vertedero junto al
       río: poder equivocarte a sabiendas es lo que hace que la decisión exista.

       Y sale solo de las cuentas, sin programarlo: en equilibrio la extracción
       iguala a la recarga, así que DOS pozos acaban dando lo mismo que uno —lo
       único que has comprado es un nivel por los suelos y un pozo de más—. Es
       exactamente lo que pasa en un acuífero sobreexplotado de verdad. */
    umbralMerma: 0.5,       // por debajo de este nivel el pozo empieza a flojear
    avisoNivel: 0.7,        // cuándo se avisa de que está bajando
    // La recarga es de la LLUVIA, así que en verano no entra casi nada. Este es
    // el suelo: lo que sigue llegando aunque no llueva (el agua de años atrás).
    recargaMinima: 0.35,
    color: '#38bdf8'
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
  /* La guía se lee en los TRES PRIMEROS MINUTOS, que es cuando el jugador
     decide si se queda. Dos reglas aprendidas a base de dejarla envejecer mal:
     cada texto nombra SOLO cosas que existen hoy (llegó a pedir un botón
     BOMBEAR y un engrase que se quitaron hace dos versiones), y el primer
     paso cuenta el OBJETIVO del juego — sin el "para qué", destapar casillas
     es un trámite. */
  tutorial: [
    { id: 'explorar',  titulo: 'Destapa el terreno',
      texto: 'Ahí fuera hay TREINTA Y SEIS pueblos esperando agua, y esta ' +
             'mancomunidad empieza en el tuyo. Clica las casillas en penumbra ' +
             'alrededor del pueblo hasta ver el RÍO: el número que llevan es ' +
             'los clics que les faltan.' },
    { id: 'bombear',   titulo: 'Bombea clicando tu pueblo',
      texto: 'Clica TU PUEBLO (o dale a la barra espaciadora): cada clic sube ' +
             'agua, y el agua servida se factura. Con eso se paga la obra que ' +
             'viene ahora.' },
    { id: 'captacion', titulo: 'Paso 1 de la obra: la captación',
      texto: 'En la solapa MAPA, en «Construir en el mapa», elige CAPTACIÓN y ' +
             'clica una casilla de agua del río para colocarla. En verde vale; ' +
             'en rojo, el motivo te dice por qué no.' },
    { id: 'bomba',     titulo: 'Paso 2: el bombeo, pegado al agua',
      texto: 'El agua no sube sola. Elige BOMBEO y colócalo en tierra llana ' +
             'que TOQUE el agua, cerca de tu captación.' },
    { id: 'deposito',  titulo: 'Paso 3: el depósito, en un alto',
      texto: 'Busca una COLINA (vale también una sierra) y coloca ahí el ' +
             'DEPÓSITO. El agua se guarda EN ALTO para bajar por gravedad con ' +
             'presión: por eso esta pieza pide relieve, no llano.' },
    { id: 'tuberia',   titulo: 'Paso 4: únelo todo con tubería',
      texto: 'Elige «Tender agua» y marca el recorrido casilla a casilla DESDE ' +
             'tu pueblo HASTA la captación, pasando pegado al bombeo y al ' +
             'depósito — tocar una casilla vecina basta para conectarlos. Clic ' +
             'en la última casilla para rematar y pagar. Lo que no queda ' +
             'conectado NO aporta nada.' },
    { id: 'servido',   titulo: '¡Tu pueblo bebe!',
      texto: 'Ya está abastecido, y solo se factura el agua SERVIDA: un pueblo ' +
             'bien atendido es el que paga las obras. A partir de aquí: explora ' +
             'hacia los pueblos vecinos, vigila «La red» —por una tubería ' +
             'estrecha no cabe agua para siempre— y cuando algo se rompa, ' +
             'búscalo en el mapa y repáralo clicando encima. Al crecer llegarán ' +
             'el saneamiento, las pluviales y la basura, cada uno con SU red.' }
  ],

  /* ---------- LOS HITOS ----------
     Cuando se abre un servicio nuevo, el juego CAMBIA de problema: hasta ese
     momento solo había que traer agua, y de repente hay que llevársela sucia, o
     separar la lluvia, o sacar la basura. Eso no se puede anunciar con una línea
     en el registro que se pierde entre las demás.

     Cada hito para el juego una vez —tres o cuatro veces en toda la partida— y
     cuenta tres cosas en este orden: QUÉ acaba de pasar, QUÉ hay que conseguir
     ahora y POR QUÉ importa. El "por qué" es el que justifica todo esto: es el
     momento en que el jugador se lo está preguntando.

     `img` es `assets/h_<id>.jpg`; si no está, la tarjeta sale igual sin imagen. */
  hitos: {
    saneamiento: {
      titulo: 'El pueblo ya ensucia',
      pasa: 'Ha crecido lo bastante como para generar aguas residuales. Todo lo ' +
            'que sirves acaba volviendo, y de momento vuelve al río tal cual.',
      hacer: 'Tiende un COLECTOR desde el pueblo hasta una DEPURADORA junto al ' +
             'agua. Es una red aparte: la tubería de beber no sirve para esto.',
      porque: 'Un río puede con una cierta carga y se limpia solo, pero por encima ' +
              'de ahí se muere. Y es el mismo río del que estás captando: lo que ' +
              'viertes sin depurar te lo acabas bebiendo tú.'
    },
    pluviales: {
      titulo: 'Cuando llueve, revienta',
      pasa: 'La mancomunidad ya gestiona tres pueblos, y con el tamaño llega el ' +
            'problema clásico: la lluvia entra al mismo colector que las fecales.',
      hacer: 'Tiende la red de PLUVIALES para separar el agua de lluvia, y pon un ' +
             'TANQUE DE TORMENTAS para retener la punta del aguacero.',
      porque: 'Una depuradora está dimensionada para el caudal de un día normal. ' +
              'En una tormenta le puede llegar diez veces más, y lo que no cabe ' +
              'se alivia crudo al río. Separar la lluvia es quitarle de encima ' +
              'un agua que ni siquiera venía sucia.'
    },
    residuos: {
      titulo: 'Y ahora, la basura',
      pasa: 'El pueblo genera residuos todos los días. Sin nadie que se los lleve, ' +
            'se quedan en la calle y la gente se marcha.',
      hacer: 'Tiende una CARRETERA hasta un VERTEDERO lejos del agua. Después, una ' +
             'PLANTA DE RECICLAJE: cada nivel abre una fracción nueva.',
      porque: 'Enterrar solo cuesta dinero. Lo que se separa SE VENDE, y cada ' +
              'fracción tiene su precio real: el aceite vale mucho más por ' +
              'tonelada que la orgánica. Es el primer servicio que da beneficio ' +
              'en vez de gasto.'
    },
    mancomunidad: {
      titulo: 'Ya no es un pueblo, es una mancomunidad',
      pasa: 'Otro núcleo entra a formar parte de la gestión. Tiene sus propios ' +
            'habitantes, su propio depósito y sus propias mejoras.',
      hacer: 'Cambia entre pueblos con las pestañas de arriba. Cada uno lleva su ' +
             'sistema, pero la caja es UNA sola.',
      porque: 'Así funciona de verdad: los pueblos pequeños no pueden pagarse un ' +
              'servicio de agua cada uno, así que se juntan para compartir ' +
              'personal, obras y tarifa. Eso es una mancomunidad.'
    },

    proteccion: {
      titulo: 'Zona de especial conservación',
      pasa: 'Te has topado con un entorno protegido: un hábitat que el Estado ' +
            'custodia y que ninguna obra puede tocar.',
      hacer: 'Rodéalo. No se puede construir ni tender redes dentro, y si tus ' +
             'lixiviados lo alcanzan habrá multa mientras dure el daño.',
      porque: 'Las redes de verdad se diseñan así: los trazados dan rodeos ' +
              'enormes para no tocar espacios protegidos. Un pueblo necesita ' +
              'agua, pero el territorio no es solo suyo.'
    },

    acuifero: {
      titulo: 'Ha dado agua',
      pasa: 'El sondeo ha encontrado acuífero. Debajo de esa casilla hay agua ' +
            'que no se ve desde la superficie y que no depende de ningún río.',
      hacer: 'Construye el pozo encima y engánchalo a la red. Da menos que una ' +
             'captación de río, pero está donde no hay río.',
      porque: 'Media España bebe de pozos. Donde no llega el cauce, la ' +
              'alternativa a treinta kilómetros de conducción es mirar hacia ' +
              'abajo: sale a temperatura y calidad constantes todo el año, y ' +
              'por eso es el recurso más cómodo... y el más fácil de estropear.'
    },

    /* --- LOS LOGROS: la otra cara ---
       Un hito enseña el problema; un logro enseña el pueblo DESPUÉS. Sin ellos
       el juego solo te para para darte malas noticias, y lo que se aprende no es
       que el saneamiento sea un fastidio: es que resolverlo se nota. La imagen
       de estos es `assets/l_<id>.jpg` y son escenas amables a propósito. */
    rioLimpio: {
      logro: true,
      titulo: 'El río vuelve a estar vivo',
      pasa: 'Tu depuradora trata lo que el pueblo devuelve, y el cauce ha bajado ' +
            'a niveles que aguanta solo.',
      hacer: 'Mantenla: al crecer el pueblo llegará más carga, y una depuradora ' +
             'que se queda corta vuelve a aliviar crudo.',
      porque: 'Un río limpio no es solo paisaje. Es el mismo del que captas, así ' +
              'que tratar bien lo que devuelves te abarata el agua que sacas. ' +
              'Aguas abajo hay más pueblos haciendo lo mismo.'
    },
    sinAlivios: {
      logro: true,
      titulo: 'Ha llovido y no ha pasado nada',
      pasa: 'La red de pluviales separa el aguacero y el tanque corta la punta. ' +
            'La depuradora ha seguido trabajando con normalidad.',
      hacer: 'Vigila el diámetro. Lo que separa la red es lo que le quepa por el ' +
             'tubo, y la tormenta no avisa.',
      porque: 'La mayoría de la contaminación de un año no llega poco a poco: ' +
              'llega en cuatro o cinco tormentas. Aguantar esas es aguantar casi ' +
              'todo.'
    },
    puebloLimpio: {
      logro: true,
      titulo: 'Las calles están limpias, y encima renta',
      pasa: 'La basura sale toda del pueblo y la planta separa fracciones que se ' +
            'venden. El servicio se paga solo.',
      hacer: 'Sube el nivel de la planta: cada uno abre una fracción nueva, y las ' +
             'que más valen llegan al final.',
      porque: 'Un pueblo limpio crece. Y el material recuperado tiene comprador ' +
              'de verdad, así que reciclar deja de ser un gasto y pasa a ser el ' +
              'negocio del servicio.'
    },
    todosServidos: {
      logro: true,
      titulo: 'Toda la mancomunidad con agua',
      pasa: 'Todos los núcleos que gestionas están bien abastecidos a la vez, sin ' +
            'un solo corte.',
      hacer: 'Sigue creciendo. Cuanto mejor sirves, más barato te sale abrir ' +
             'territorio nuevo.',
      porque: 'Esto es lo que hace una mancomunidad de verdad: que un pueblo de ' +
              'doscientos habitantes tenga la misma agua que uno de cinco mil, ' +
              'porque comparten la obra y el personal.'
    }
  },


  /* ---------- GUARDADO ----------
     v3: mapa grande y pueblos dinámicos; el formato v2 no es convertible. */
  guardado: { clave: 'redHidraulica_clicker_v3', intervaloSegundos: 10 }
};
