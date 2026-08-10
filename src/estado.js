/**
 * ESTADO — la caja, el cauce, el tiempo, los pueblos y la persistencia.
 *
 * La mancomunidad tiene UNA caja, UN reloj y UN cauce (contaminación). Cada
 * pueblo es un objeto con su propio sistema. Solo datos y reglas de la caja; la
 * lógica de qué hacer con ellos vive en `simulacion.js`.
 */

import { CONFIG } from './config.js';
import { generarMapa, comprimir, aplicarGuardado } from './mapa.js';

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

/** Crea un pueblo a partir de su definición en CONFIG.poblaciones. */
function crearPueblo(def){
  return {
    nombre: def.nombre,
    habitantes: def.habitantes,
    desbloqueado: !!def.desbloqueada,
    agua: 0,
    servicio: 0,
    abastecida: false,
    racha: 0,
    mejoras: mejorasACero(),
    servicios: serviciosIniciales(),
    autobombaActivo: false,
    tanqueAgua: 0,              // litros retenidos ahora en el tanque de tormentas
    desgaste: 0                 // 0..1; a más desgaste, menos rinde todo
  };
}

export class Estado {

  constructor(){
    // Comunes a la mancomunidad
    this.dinero = CONFIG.economia.dineroInicial;
    this.horas = 0;
    this.m3Servidos = 0;
    this.contaminacion = 0;     // del cauce, 0..CONFIG.cauce.contaminacionMax
    this.pluvialesActivas = false;   // se abre al desbloquear el tercer pueblo

    // Pueblos y cuál se está mirando
    this.pueblos = CONFIG.poblaciones.map(crearPueblo);
    this.puebloActivo = 0;

    // El territorio: mapa de exploración, cámara e inventario de piezas
    this.mapa = generarMapa();
    this.camara = { x: 0, y: 0 };   // píxeles; lo centra la escena al arrancar
    this.inventario = [];           // instalaciones recuperadas de las ruinas
    this.descubiertas = 0;          // casillas abiertas, para el HUD
    this.construcciones = [];       // { tipo, col, fila } puestas sobre el mapa
    this.tuberias = [];             // { camino:[{col,fila}], coste, dn, red }
    // Diámetro con el que se tienden los tramos NUEVOS. Arranca en el más
    // estrecho: la red barata es el punto de partida, no el objetivo.
    this.dnActual = CONFIG.tuberia.diametros[0].id;
    // Y para qué red se tiende: agua potable o colector.
    this.redActual = 'abastecimiento';
    // Averías VIVAS sobre el mapa: { col, fila, clics, desde }. Son de la
    // mancomunidad, no de un pueblo: lo que se rompe es una pieza concreta.
    this.averias = [];
    // Modo de construcción: qué está intentando colocar el jugador ahora mismo
    this.modo = { tipo: null, elemento: null, trazado: [], deInventario: false };
    this.seleccion = null;          // { col, fila } de la casilla que miras
    this.tutorial = { paso: 0, terminado: false };   // la guía de los primeros pasos

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
      dinero: this.dinero, horas: this.horas, m3Servidos: this.m3Servidos,
      contaminacion: this.contaminacion, puebloActivo: this.puebloActivo,
      pluvialesActivas: this.pluvialesActivas,
      pueblos: this.pueblos, ultimoInstante: this.ultimoInstante,
      // El terreno se regenera de la semilla: solo se guarda lo que has tocado
      mapa: comprimir(this.mapa),
      inventario: this.inventario, camara: this.camara,
      construcciones: this.construcciones, tuberias: this.tuberias,
      dnActual: this.dnActual, redActual: this.redActual,
      averias: this.averias, tutorial: this.tutorial
    };
    try{
      localStorage.setItem(CONFIG.guardado.clave, JSON.stringify(datos));
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
      estado.puebloActivo = d.puebloActivo ?? 0;
      estado.ultimoInstante = d.ultimoInstante ?? Date.now();

      // Reconstruir pueblos: partir de la definición actual y volcar lo guardado,
      // así añadir una mejora o un pueblo nuevo no rompe una partida vieja.
      estado.pueblos = CONFIG.poblaciones.map((def, i) => {
        const base = crearPueblo(def);
        const g = (d.pueblos || [])[i];
        if(!g) return base;
        const pueblo = {
          ...base, ...g,
          mejoras: { ...base.mejoras, ...(g.mejoras || {}) },
          // Igual que con las mejoras: se parte de la definición actual y se
          // vuelca lo guardado encima, así añadir un servicio nuevo no rompe
          // una partida vieja.
          servicios: { ...base.servicios, ...(g.servicios || {}) }
        };
        // Partidas de antes de los servicios: el saneamiento era un booleano suelto
        if(g.saneamientoActivo) pueblo.servicios.saneamiento = { activo: true };
        delete pueblo.saneamientoActivo;
        return pueblo;
      });
      if(estado.puebloActivo >= estado.pueblos.length) estado.puebloActivo = 0;

      aplicarGuardado(estado.mapa, d.mapa);
      estado.inventario = d.inventario || [];
      estado.construcciones = d.construcciones || [];
      estado.tuberias = d.tuberias || [];
      // Las tuberías de antes de los diámetros se quedan en el más estrecho: es
      // exactamente la red vieja de fibrocemento que uno se encuentra heredada.
      // Y las de antes de existir el saneamiento son todas de agua potable.
      for(const t of estado.tuberias){
        if(!t.dn) t.dn = CONFIG.tuberia.diametros[0].id;
        if(!t.red) t.red = 'abastecimiento';
      }
      estado.dnActual = d.dnActual || CONFIG.tuberia.diametros[0].id;
      estado.redActual = d.redActual || 'abastecimiento';
      // Una partida con la avería vieja (del pueblo entero) empieza limpia: el
      // formato no es convertible y arrastrarlo daría un pueblo roto sin sitio
      // donde ir a arreglarlo.
      estado.averias = (d.averias || []).filter(a => a && a.col != null);
      estado.tutorial = d.tutorial || { paso: 0, terminado: false };
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
