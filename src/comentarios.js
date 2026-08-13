/**
 * LOS COMENTARIOS DE MANUEL — el guía mira tu partida y comenta.
 *
 * La diferencia entre un personaje y un incordio está en una sola regla:
 * CONTEXTUAL O NADA. Manuel nunca dice "¡ánimo!" porque sí; dice "el depósito
 * lleva rato lleno" porque tu depósito lleva rato lleno. Es un compañero de
 * oficio enseñándote a leer tu propia instalación, que es lo que este juego
 * quiere hacer desde el principio.
 *
 * Las guardas que lo mantienen a raya:
 *  - Un silencio mínimo entre comentarios (CONFIG.comentarios).
 *  - Cada comentario se dice UNA vez y no vuelve hasta RE-ARMARSE: su
 *    condición tiene que apagarse y volverse a encender. Nada de repetir
 *    "el río baja sucio" cada dos minutos mientras siga sucio.
 *  - Nunca habla durante la guía de primeros pasos (ese bocadillo es suyo,
 *    pero está ocupado en cosas más importantes) ni sobre una tarjeta.
 *
 * Módulo de lectura pura, como tutorial.js: mira el estado y devuelve qué
 * decir. Quién y cuándo lo enseña es cosa de main.js y ui.js.
 */

import { CONFIG } from './config.js';
import { capacidad, tasaFugasRed, redDelPueblo, redEstrangula,
         nivelMasa, pozosPorMasa, nivelCaserio } from './simulacion.js';

/* Cada comentario: cuándo procede y qué dice Manuel. El orden ES la
   prioridad: lo que duele va antes que lo que luce. */
const COMENTARIOS = [
  {
    id: 'averiaVieja', animo: 'mal',
    cuando: (e) => (e.averias || []).some(av => e.horas - av.desde > 72),
    texto: 'Esa avería lleva días esperando... Lo roto no bombea y no cobra: ' +
           'ir con la llave sale más barato que dejarlo estar.'
  },
  {
    id: 'aliviando', animo: 'mal',
    cuando: (e, res) => !!res.aliviando,
    texto: 'La depuradora no da abasto y está aliviando crudo al río. O más ' +
           'tratamiento, o un tanque que aguante la punta.'
  },
  {
    id: 'cauceSucio', animo: 'mal',
    cuando: (e) => e.contaminacion > CONFIG.cauce.contaminacionMax * 0.5,
    texto: 'El río baja sucio, y un río sucio frena a todos los pueblos. ' +
           'En mis tiempos eso costaba disgustos con el Estado... y sigue.'
  },
  {
    id: 'basura', animo: 'mal',
    cuando: (e, res) => (res.basuraCalle || 0) > 0.3,
    texto: 'Se está acumulando la basura en la calle. La gente aguanta poco ' +
           'eso: o sale en camión, o se te va el pueblo.'
  },
  {
    id: 'acuiferoBajo', animo: 'mal',
    cuando: (e) => {
      for(const [masa] of pozosPorMasa(e))
        if(nivelMasa(e, masa) < CONFIG.acuiferos.umbralMerma) return true;
      return false;
    },
    texto: 'Ese acuífero anda por los suelos: sacáis más de lo que llueve. ' +
           'El agua de abajo también se acaba, aunque no se vea.'
  },
  {
    id: 'lineaVieja', animo: 'mal',
    cuando: (e) => tasaFugasRed(e) - redDelPueblo(e).def.fugas > 0.005,
    texto: 'Hay una conducción pasada de sus años por ahí. Fuga cada vez más: ' +
           'yo la renovaría antes de que dé un disgusto.'
  },
  {
    id: 'estrangula', animo: 'mal',
    cuando: (e) => redEstrangula(e.activo, e),
    texto: 'Captáis más agua de la que cabe por la tubería, y lo que sobra se ' +
           'queda en el río. Más captación no: más calibre.'
  },
  {
    id: 'estiaje', animo: null,
    cuando: (e, res) => (res.estiaje || 1) < 0.5,
    texto: 'El río viene flojo... es el estiaje, en verano siempre pasa. Los ' +
           'pozos ni lo notan, por si algún día quieres dormir tranquilo.'
  },
  {
    id: 'depositoLleno', animo: null,
    cuando: (e) => {
      const cap = capacidad(e.activo, e);
      return cap > CONFIG.bomba.bufferSinDeposito && e.activo.agua >= cap * 0.98;
    },
    texto: 'El depósito lleva un rato lleno: cada clic de más se pierde por ' +
           'el aliviadero. O más depósito, o más pueblo que lo beba.'
  },
  {
    id: 'cajaGorda', animo: null,
    cuando: (e) => e.dinero > 12000,
    texto: 'Buena caja llevas. El dinero parado no trae agua: yo estaría ' +
           'mirando el mapa, que ahí fuera hay pueblos esperando.'
  },
  {
    id: 'creciendo', animo: 'bien',
    cuando: (e) => e.activo.racha >= CONFIG.poblacion.horasBuenServicioParaCrecer
                   && e.activo.servicio >= CONFIG.poblacion.servicioBueno,
    texto: 'El pueblo crece, ¿eh? Buen servicio sostenido: así se hace. La ' +
           'demanda subirá con él, no te me duermas.'
  },
  {
    /* Cuando el caserío ya es villa o ciudad: el momento de mirar el calibre.
       Los escalones de dibujo coinciden con los topes de las tuberías a
       propósito, así que si se ve grande, la conducción anda justa. */
    id: 'yaEsVilla', animo: 'bien',
    cuando: (e) => nivelCaserio(e.activo.habitantes) >= 2,
    texto: 'Mira cómo está el pueblo: eso ya no es una aldea de cuatro casas. ' +
           'Con ese tamaño, échale un ojo al calibre de la conducción.'
  },

  /* ---- CHASCARRILLOS: la coña del veterano ----
     También con su contexto (la batallita de la tormenta sale CUANDO llueve
     de verdad), pero sin lección obligada: son personaje, no manual. Van los
     últimos —cualquier aviso les pasa delante— y con su propio silencio,
     mucho más largo. */
  {
    id: 'chTormenta', animo: null, chascarrillo: true,
    cuando: (e, res) => (res.lluvia || 0) > 0.8,
    texto: 'Menuda tromba... Esto me recuerda al 96: tres días así y la ' +
           'depuradora pidió la baja. Los tanques de tormenta se inventaron ' +
           'por algo, te lo digo yo.'
  },
  {
    id: 'chDeshielo', animo: null, chascarrillo: true,
    cuando: (e, res) => (res.estiaje || 1) > 1.1,
    texto: 'El río baja crecido con el deshielo. Disfrútalo mientras dure: ' +
           'el verano nunca manda aviso.'
  },
  {
    id: 'chLluvia', animo: null, chascarrillo: true,
    cuando: (e, res) => (res.lluvia || 0) > 0.35 && (res.lluvia || 0) <= 0.8,
    texto: '¿Oyes? Agua del cielo. La única que llega sin bombear... y aun ' +
           'así nos las apañamos para que acabe donde no debe.'
  },
  {
    id: 'chMadrugada', animo: null, chascarrillo: true,
    cuando: (e) => { const h = Math.floor(e.horas % 24); return h >= 2 && h <= 5; },
    texto: 'Turno de noche, ¿eh? Yo de guardia nocturna arreglé más ' +
           'reventones que en diez años de mañanas. El agua no libra.'
  },
  {
    id: 'chPozo', animo: null, chascarrillo: true,
    cuando: (e) => e.construcciones.some(o => o.tipo === 'acuifero'),
    texto: 'Mi abuelo buscaba agua con dos varillas de avellano. Tú con ' +
           'estudio hidrogeológico: no sé si es mejor, pero falla menos.'
  },
  {
    id: 'chRedGrande', animo: null, chascarrillo: true,
    cuando: (e) => (e.tuberias || []).length >= 8,
    texto: 'Menuda red vas tejiendo ya... En la cuadrilla a esto lo ' +
           'llamábamos encaje de bolillos, pero con zanja.'
  },
  {
    id: 'chPunta', animo: null, chascarrillo: true,
    cuando: (e, res) => (res.punta || 1) > 1.6,
    texto: 'Hora punta: medio pueblo duchándose a la vez. Para esto está el ' +
           'depósito, que el río no entiende de prisas.'
  }
];

let ultimaVez = null;        // reloj real del último comentario (segundos)
let ultimaCoña = null;       // el chascarrillo lleva su propio silencio, más largo
const dicho = {};            // id -> ya dicho y aún sin re-armar

/**
 * ¿Tiene Manuel algo que decir AHORA? Devuelve { texto, animo } o null.
 * Llamar cada pocos segundos con el reloj real: el re-armado necesita ver
 * las condiciones también cuando no toca hablar.
 */
export function comentar(estado, resultado, ahoraSeg){
  if(!estado.tutorial || !estado.tutorial.terminado) return null;
  if(estado.hitoPendiente) return null;

  // El primer silencio también cuenta: nada de saludar según cargas
  if(ultimaVez === null){ ultimaVez = ahoraSeg; ultimaCoña = ahoraSeg; }

  let elegido = null;
  for(const c of COMENTARIOS){
    let activo = false;
    try{ activo = !!c.cuando(estado, resultado); }catch(_){ /* sin drama */ }
    if(!activo){ dicho[c.id] = false; continue; }   // apagado: se re-arma
    if(dicho[c.id]) continue;                        // ya dicho, sigue activo
    if(!elegido) elegido = c;                        // el primero manda
  }
  if(!elegido) return null;
  const K = CONFIG.comentarios;
  if(ahoraSeg - ultimaVez < K.cadaSegundosMin) return null;
  // La coña espera SU turno largo: es un caramelo, no un canal de información
  if(elegido.chascarrillo && ahoraSeg - ultimaCoña < K.chascarrilloCadaSegundosMin)
    return null;

  dicho[elegido.id] = true;
  ultimaVez = ahoraSeg;
  if(elegido.chascarrillo) ultimaCoña = ahoraSeg;
  // El id viaja con el texto: es la llave del archivo de voz
  return { id: elegido.id, texto: elegido.texto, animo: elegido.animo };
}
