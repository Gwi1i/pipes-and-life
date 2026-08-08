/**
 * ESTADO — dinero, agua, tiempo y persistencia.
 *
 * Solo datos y las reglas de la caja. Ni geometría ni dibujo. La lógica de qué
 * hacer con estos números vive en `simulacion.js`.
 */

import { CONFIG } from './config.js';

export class Estado {

  constructor(){
    this.dinero = CONFIG.economia.dineroInicial;
    this.agua = 0;                 // litros almacenados ahora mismo
    this.horas = 0;                // tiempo de explotación transcurrido
    this.m3Servidos = 0;           // total histórico facturado
    this.tieneDeposito = false;    // la primera mejora

    this.poblacion = {
      nombre: CONFIG.poblacion.nombre,
      habitantes: CONFIG.poblacion.habitantes,
      abastecida: false,
      servicio: 0                  // 0..1, lo rellena la simulación
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
      m3Servidos: this.m3Servidos, tieneDeposito: this.tieneDeposito,
      habitantes: this.poblacion.habitantes,
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
      estado.tieneDeposito = d.tieneDeposito ?? false;
      estado.poblacion.habitantes = d.habitantes ?? estado.poblacion.habitantes;
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
