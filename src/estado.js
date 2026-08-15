/**
 * ESTADO — la caja, el cauce, el tiempo, los pueblos y la persistencia.
 *
 * La mancomunidad tiene UNA caja, UN reloj y UN cauce (contaminación). Cada
 * pueblo es un objeto con su propio sistema. Solo datos y reglas de la caja; la
 * lógica de qué hacer con ellos vive en `simulacion.js`.
 */

import { CONFIG } from './config.js';
import { generarMapa, comprimir, aplicarGuardado } from './mapa.js';
import { legado, nivelVentaja, guardarLegado } from './legado.js';

/** Radio extra de arranque por la ventaja Cartografía del legado. */
function radioCartografia(){
  return nivelVentaja('cartografia') * CONFIG.comarcas.ventajas.cartografia.radioExtra;
}

/** Niveles de mejora a cero: una clave por cada entrada de CONFIG.mejoras. */
function mejorasACero(){
  const m = {};
  for(const clave of Object.keys(CONFIG.mejoras)) m[clave] = 0;
  return m;
}

/**
 * Los servicios que puede tener un pueblo, todos apagados salvo los que van de
 * serie. Un pueblo no es una lista de mejoras: es un conjunto de servicios que
 * se van abriendo, y cada uno se activa por su cuenta (por tamaño, por hito de
 * la mancomunidad...).
 */
function serviciosIniciales(){
  const s = {};
  for(const [clave, def] of Object.entries(CONFIG.servicios)){
    s[clave] = { activo: !!def.siempre };
  }
  return s;
}

/** Crea un pueblo desde una definición {nombre, habitantes, col, fila}. */
function crearPueblo(def){
  return {
    nombre: def.nombre,
    habitantes: def.habitantes,
    col: def.col, fila: def.fila,    // dónde vive sobre el mapa
    desbloqueado: true,              // si está en la lista, está incorporado
    agua: 0,
    servicio: 0,
    abastecida: false,
    racha: 0,
    mejoras: mejorasACero(),
    servicios: serviciosIniciales(),
    autobombaActivo: false,
    tanqueAgua: 0,              // litros retenidos ahora en el tanque de tormentas
    basuraCalle: 0              // 0..1; basura sin recoger pudriéndose en el pueblo
  };
}

export class Estado {

  constructor(){
    // Comunes a la mancomunidad
    this.dinero = CONFIG.economia.dineroInicial;
    this.horas = 0;
    this.m3Servidos = 0;
    this.contaminacion = 0;     // del cauce, 0..CONFIG.cauce.contaminacionMax
    this.pluvialesActivas = false;   // se abre al desbloquear el cuarto pueblo (pluviales.abreConPueblos)
    // Nivel de cada masa de acuífero (número de masa → 0..1). Lo que no está
    // aquí está lleno: solo se anota lo que has empezado a bombear.
    this.acuiferos = {};
    // El bono del turno en la línea de reciclaje: { hasta, factor } o null
    this.turnoReciclaje = null;
    // Y el de la ruta del camión: misma forma, sube la recogida una temporada
    this.rutaCamion = null;
    // La mejor veteranía alcanzada en ESTA comarca: el mérito no caduca
    // aunque los pueblos menguen (el traslado paga el máximo, no el de hoy)
    this.mejorVeterania = 0;

    // Los pueblos son DINÁMICOS: se arranca solo con el de origen y el resto
    // se incorporan al alcanzarlos por el mapa. No hay tope de lista.
    this.pueblos = [crearPueblo({ ...CONFIG.poblacionOrigen,
      col: CONFIG.mapaMundo.origen.col, fila: CONFIG.mapaMundo.origen.fila })];
    this.puebloActivo = 0;

    // El territorio: mapa de exploración, cámara e inventario de piezas.
    // La SEMILLA es de la partida (cada comarca tiene la suya y viaja con el
    // guardado); el legado dice cuál toca y con cuántos planos se llega.
    this.semilla = legado.semillaActual || CONFIG.mapaMundo.semilla;
    // La VERSIÓN DEL MUNDO viaja en el guardado: una partida vieja regenera
    // su mundo exacto (ver el comentario en CONFIG.mapaMundo.mundo).
    this.mundo = CONFIG.mapaMundo.mundo;
    this.mapa = generarMapa(this.semilla, radioCartografia(), this.mundo);
    this.camara = { x: 0, y: 0 };   // píxeles; lo centra la escena al arrancar
    this.inventario = [];           // instalaciones recuperadas de las ruinas
    this.descubiertas = 0;          // casillas abiertas, para el HUD
    this.construcciones = [];       // { tipo, col, fila } puestas sobre el mapa
    this.tuberias = [];             // { camino:[{col,fila}], coste, dn, red }
    // Calibre con el que se tienden los tramos NUEVOS, UNO POR RED: cada una
    // tiene su escala (diámetros o clases de vía) y su punto de partida, que es
    // siempre el más barato. La red barata es el arranque, no el objetivo.
    this.dnActual = {};
    for(const [clave, def] of Object.entries(CONFIG.redes)){
      const escala = def.tiers === 'viales' ? CONFIG.viales.clases : CONFIG.tuberia.diametros;
      this.dnActual[clave] = escala[0].id;
    }
    // Y sobre qué red se está trabajando ahora mismo.
    this.redActual = 'abastecimiento';
    // Averías VIVAS sobre el mapa: { col, fila, clics, desde }. Son de la
    // mancomunidad, no de un pueblo: lo que se rompe es una pieza concreta.
    this.averias = [];
    // Modo de construcción: qué está intentando colocar el jugador ahora mismo
    this.modo = { tipo: null, elemento: null, trazado: [], deInventario: false };
    this.seleccion = null;          // { col, fila } de la casilla que miras
    this.tutorial = { paso: 0, terminado: false };   // la guía de los primeros pasos
    // Hitos ya contados. Cada uno se enseña UNA vez en toda la partida: si se
    // repitiera dejaría de ser un momento y pasaría a ser un estorbo.
    this.hitosVistos = [];
    this.hitoPendiente = null;      // el que hay que enseñar ahora mismo

    this.registro = [];
    this.ultimoInstante = Date.now();
  }

  get activo(){ return this.pueblos[this.puebloActivo]; }

  puedePagar(coste){ return this.dinero >= coste; }
  pagar(coste){ this.dinero -= coste; }

  anotar(texto, nivel = 'info'){
    this.registro.unshift({ h: Math.floor(this.horas), texto, nivel });
    if(this.registro.length > 40) this.registro.pop();
  }

  /* ---------------- PERSISTENCIA ---------------- */

  guardar(){
    this.ultimoInstante = Date.now();
    const datos = {
      semilla: this.semilla,
      mundo: this.mundo,   // la versión del mundo generado (ver mapaMundo.mundo)
      dinero: this.dinero, horas: this.horas, m3Servidos: this.m3Servidos,
      contaminacion: this.contaminacion, puebloActivo: this.puebloActivo,
      pluvialesActivas: this.pluvialesActivas, acuiferos: this.acuiferos,
      turnoReciclaje: this.turnoReciclaje, rutaCamion: this.rutaCamion,
      mejorVeterania: this.mejorVeterania,
      pueblos: this.pueblos, ultimoInstante: this.ultimoInstante,
      // El terreno se regenera de la semilla: solo se guarda lo que has tocado
      mapa: comprimir(this.mapa),
      inventario: this.inventario, camara: this.camara,
      construcciones: this.construcciones, tuberias: this.tuberias,
      dnActual: this.dnActual, redActual: this.redActual,
      averias: this.averias, tutorial: this.tutorial,
      hitosVistos: this.hitosVistos
    };
    try{
      localStorage.setItem(CONFIG.guardado.clave, JSON.stringify(datos));
      return true;
    }catch(e){
      return false;
    }
  }

  /* ---- COPIA DE SEGURIDAD: la partida cabe en un texto ----
     Todo el progreso vive en el localStorage de UN navegador: se pierde
     limpiando datos, cambiando de aparato o en modo incógnito — y ese es el
     único fallo que un jugador no perdona. El texto lleva prefijo (para
     reconocerlo al pegar) y va en base64: sobrevive a correos y mensajerías
     sin que nada le retoque las comillas. */

  exportar(){
    this.guardar();                       // sellar el estado de este instante
    const bruto = localStorage.getItem(CONFIG.guardado.clave);
    if(!bruto) return null;
    // A base64 pasando por bytes: btoa a pelo revienta con acentos, y el
    // spread de golpe revienta la pila con partidas grandes — a trozos.
    const bytes = new TextEncoder().encode(bruto);
    let bin = '';
    for(let i = 0; i < bytes.length; i += 8192)
      bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return 'PIPES1:' + btoa(bin);
  }

  /** Deja la partida pegada lista en localStorage. NO recarga: eso es cosa de
   *  quien llama, que además debe anular el guardado antes (el sello del
   *  adiós resucitaría la partida vieja, como pasó con Reiniciar). */
  static importar(texto){
    try{
      const limpio = (texto || '').trim();
      if(!limpio.startsWith('PIPES1:')) return false;
      const bin = atob(limpio.slice(7));
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const bruto = new TextDecoder().decode(bytes);
      const d = JSON.parse(bruto);
      if(!Array.isArray(d.pueblos)) return false;   // no parece una partida
      localStorage.setItem(CONFIG.guardado.clave, bruto);
      return true;
    }catch(e){
      return false;
    }
  }

  /** Restaura la partida sobre `estado`. Devuelve true si había algo guardado. */
  static cargar(estado){
    try{
      const bruto = localStorage.getItem(CONFIG.guardado.clave);
      if(!bruto) return false;
      const d = JSON.parse(bruto);
      estado.dinero = d.dinero ?? estado.dinero;
      estado.horas = d.horas ?? 0;
      estado.m3Servidos = d.m3Servidos ?? 0;
      estado.contaminacion = d.contaminacion ?? 0;
      estado.pluvialesActivas = d.pluvialesActivas ?? false;
      estado.acuiferos = d.acuiferos ?? {};
      estado.turnoReciclaje = d.turnoReciclaje ?? null;
      estado.rutaCamion = d.rutaCamion ?? null;
      estado.mejorVeterania = d.mejorVeterania ?? 0;
      estado.puebloActivo = d.puebloActivo ?? 0;
      estado.ultimoInstante = d.ultimoInstante ?? Date.now();

      // Reconstruir pueblos: la lista es dinámica, así que se carga la guardada
      // volcando cada uno sobre la plantilla actual — añadir una mejora o un
      // servicio nuevo no rompe una partida vieja.
      const guardados = (d.pueblos || []);
      if(guardados.length){
        estado.pueblos = guardados.map(g => {
          const base = crearPueblo(g);
          return {
            ...base, ...g,
            mejoras: { ...base.mejoras, ...(g.mejoras || {}) },
            servicios: { ...base.servicios, ...(g.servicios || {}) }
          };
        });
      }
      if(estado.puebloActivo >= estado.pueblos.length) estado.puebloActivo = 0;

      // La partida manda sobre la semilla: si llega de OTRO navegador (una
      // copia de seguridad pegada), el mapa del constructor puede ser de otra
      // comarca y hay que regenerarlo antes de volcarle lo tocado. Y el
      // legado local se pone de acuerdo, para que la próxima carga ya nazca
      // con la semilla buena.
      const semillaCambia = d.semilla && d.semilla !== estado.semilla;
      if(semillaCambia){
        estado.semilla = d.semilla;
        legado.semillaActual = d.semilla;
        guardarLegado();
      }
      // Y manda también sobre la VERSIÓN DEL MUNDO: una partida vieja (sin
      // el campo = 1) regenera SU siembra exacta, no la del código de hoy.
      const mundoGuardado = d.mundo ?? 1;
      if(semillaCambia || mundoGuardado !== estado.mundo){
        estado.mundo = mundoGuardado;
        estado.mapa = generarMapa(estado.semilla, radioCartografia(), estado.mundo);
      }
      aplicarGuardado(estado.mapa, d.mapa);
      estado.inventario = d.inventario || [];
      estado.construcciones = d.construcciones || [];
      // Las obras de antes de tener nombre y nivel los reciben al cargar, en
      // su orden de construcción: "Depósito", "Depósito 2"...
      const vistos = {};
      for(const o of estado.construcciones){
        if(o.nivel === undefined) o.nivel = 1;
        vistos[o.tipo] = (vistos[o.tipo] || 0) + 1;
        if(!o.nombre){
          const base = (CONFIG.construibles[o.tipo] || {}).nombre || o.tipo;
          o.nombre = vistos[o.tipo] === 1 ? base : `${base} ${vistos[o.tipo]}`;
        }
      }
      estado.tuberias = d.tuberias || [];
      // Las tuberías de antes de los diámetros se quedan en el más estrecho: es
      // exactamente la red vieja de fibrocemento que uno se encuentra heredada.
      // Y las de antes de existir el saneamiento son todas de agua potable.
      for(const t of estado.tuberias){
        if(!t.dn) t.dn = CONFIG.tuberia.diametros[0].id;
        if(!t.red) t.red = 'abastecimiento';
        // Las de antes de existir la vida útil nacen HOY: castigar una partida
        // vieja con cuarenta años de golpe sería estrenar la mecánica robando.
        if(t.nacida === undefined) t.nacida = d.horas ?? 0;
      }
      // Antes había un solo calibre para todo; ahora hay uno por red. Una
      // partida vieja traía una cadena suelta, y hay que ignorarla.
      if(d.dnActual && typeof d.dnActual === 'object'){
        estado.dnActual = { ...estado.dnActual, ...d.dnActual };
      }
      estado.redActual = d.redActual || 'abastecimiento';
      // Una partida con la avería vieja (del pueblo entero) empieza limpia: el
      // formato no es convertible y arrastrarlo daría un pueblo roto sin sitio
      // donde ir a arreglarlo.
      estado.averias = (d.averias || []).filter(a => a && a.col != null);
      estado.tutorial = d.tutorial || { paso: 0, terminado: false };
      estado.hitosVistos = d.hitosVistos || [];
      if(d.camara) estado.camara = d.camara;
      return true;
    }catch(e){
      return false;
    }
  }

  static borrar(){
    try{ localStorage.removeItem(CONFIG.guardado.clave); }catch(e){}
  }
}
