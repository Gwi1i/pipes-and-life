/**
 * ESTADO — dinero, agua, mejoras, tiempo y persistencia.
 *
 * Solo datos y las reglas de la caja. Ni geometría ni dibujo. La lógica de qué
 * hacer con estos números vive en `simulacion.js`.
 */

import { CONFIG } from './config.js';

/** Niveles de mejora a cero: una clave por cada entrada de CONFIG.mejoras. */
function mejorasACero(){
  const m = {};
  for(const clave of Object.keys(CONFIG.mejoras)) m[clave] = 0;
  return m;
}

export class Estado {

  constructor(){
    this.dinero = CONFIG.economia.dineroInicial;
    this.agua = 0;                 // litros almacenados ahora mismo
    this.horas = 0;                // tiempo de explotación transcurrido
    this.m3Servidos = 0;           // total histórico facturado

    this.mejoras = mejorasACero(); // nivel de cada vía de la tienda
    this.autobombaActivo = false;  // función especial (ver CONFIG.premium)
    this.averia = null;            // null | { desde: horas } mientras esté rota

    this.poblacion = {
      nombre: CONFIG.poblacion.nombre,
      habitantes: CONFIG.poblacion.habitantes,
      abastecida: false,
      servicio: 0,                 // 0..1, lo rellena la simulación
      racha: 0                     // horas seguidas de buen servicio (para crecer)
    };

    this.registro = [];
    this.ultimoInstante = Date.now();   // para el progreso offline (Hito 3)
  }

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
      dinero: this.dinero, agua: this.agua, horas: this.horas,
      m3Servidos: this.m3Servidos, mejoras: this.mejoras,
      autobombaActivo: this.autobombaActivo, averia: this.averia,
      habitantes: this.poblacion.habitantes, racha: this.poblacion.racha,
      ultimoInstante: this.ultimoInstante
    };
    try{
      localStorage.setItem(CONFIG.guardado.clave, JSON.stringify(datos));
      return true;
    }catch(e){
      return false;   // modo incógnito o cuota llena
    }
  }

  /** Restaura la partida sobre `estado`. Devuelve true si había algo guardado. */
  static cargar(estado){
    try{
      const bruto = localStorage.getItem(CONFIG.guardado.clave);
      if(!bruto) return false;
      const d = JSON.parse(bruto);
      estado.dinero = d.dinero ?? estado.dinero;
      estado.agua = d.agua ?? 0;
      estado.horas = d.horas ?? 0;
      estado.m3Servidos = d.m3Servidos ?? 0;
      // Mezcla con las claves actuales: si se añade una mejora nueva, arranca a 0
      estado.mejoras = { ...mejorasACero(), ...(d.mejoras || {}) };
      estado.autobombaActivo = d.autobombaActivo ?? false;
      estado.averia = d.averia ?? null;
      estado.poblacion.habitantes = d.habitantes ?? estado.poblacion.habitantes;
      estado.poblacion.racha = d.racha ?? 0;
      estado.ultimoInstante = d.ultimoInstante ?? Date.now();
      return true;
    }catch(e){
      return false;
    }
  }

  static borrar(){
    try{ localStorage.removeItem(CONFIG.guardado.clave); }catch(e){}
  }
}
