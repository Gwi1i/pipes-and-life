/**
 * ESTADO — dinero, tiempo, resultado del solver y persistencia.
 *
 * Aquí no hay geometría ni dibujo: solo el estado de la partida y las
 * reglas económicas. Guardar un grafo obliga a serializarlo a mano,
 * porque un Map no se convierte solo a JSON.
 */

import { CONFIG } from './config.js';
import { Grafo } from './grafo.js';

export class Estado {

  constructor(){
    this.dinero = CONFIG.economia.dineroInicial;
    this.horas = 0;
    this.m3Servidos = 0;
    this.resultado = { abastecidas: 0, totales: 0, caudalTotal: 0,
                       energiaKwh: 0, incidencias: [] };
    this.registro = [];
    this.ultimoInstante = Date.now();
  }

  /** Un paso de economía. `horas` es tiempo simulado. */
  avanzar(horas){
    const e = CONFIG.economia;
    const r = this.resultado;

    // Solo se factura el agua que llega con presión suficiente
    const m3 = r.caudalTotal * 3.6 * horas;         // L/s → m³/h
    const ingresos = m3 * e.tarifa;
    const gastos = r.energiaKwh * horas * e.costeEnergiaKwh;

    this.dinero += ingresos - gastos;
    this.m3Servidos += m3;
    this.horas += horas;
  }

  puedePagar(coste){ return this.dinero >= coste; }
  pagar(coste){ this.dinero -= coste; }

  anotar(texto, nivel = 'info'){
    this.registro.unshift({ h: Math.floor(this.horas), texto, nivel });
    if(this.registro.length > 40) this.registro.pop();
  }

  /* ---------------- PERSISTENCIA ---------------- */

  guardar(grafo){
    this.ultimoInstante = Date.now();
    const datos = {
      dinero: this.dinero, horas: this.horas, m3Servidos: this.m3Servidos,
      ultimoInstante: this.ultimoInstante,
      grafo: grafo.aObjeto()
    };
    try{
      localStorage.setItem(CONFIG.guardado.clave, JSON.stringify(datos));
      return true;
    }catch(e){
      return false;   // modo incógnito, cuota llena, o file:// restringido
    }
  }

  /** Devuelve el grafo restaurado, o null si no había partida. */
  static cargar(estado){
    try{
      const bruto = localStorage.getItem(CONFIG.guardado.clave);
      if(!bruto) return null;
      const d = JSON.parse(bruto);
      estado.dinero = d.dinero;
      estado.horas = d.horas;
      estado.m3Servidos = d.m3Servidos;
      estado.ultimoInstante = d.ultimoInstante || Date.now();
      return Grafo.desdeObjeto(d.grafo);
    }catch(e){
      return null;
    }
  }

  static borrar(){
    try{ localStorage.removeItem(CONFIG.guardado.clave); }catch(e){}
  }
}
