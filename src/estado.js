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
    autobombaActivo: false,
    averia: null,               // null | { desde: horas }
    saneamientoActivo: false,   // se activa al superar el umbral de habitantes
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
      inventario: this.inventario, camara: this.camara
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
        return {
          ...base, ...g,
          mejoras: { ...base.mejoras, ...(g.mejoras || {}) }
        };
      });
      if(estado.puebloActivo >= estado.pueblos.length) estado.puebloActivo = 0;

      aplicarGuardado(estado.mapa, d.mapa);
      estado.inventario = d.inventario || [];
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
