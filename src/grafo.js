/**
 * GRAFO — la estructura de datos central del juego.
 *
 * Una red de tuberías ES un grafo: los nudos son vértices y los tramos
 * son aristas. Casi todo lo interesante que se puede preguntar sobre una
 * red ("¿está esto conectado?", "¿por dónde llega el agua?", "¿qué se
 * queda sin servicio si corto aquí?") son algoritmos de grafos clásicos.
 *
 * Esta es exactamente la estructura que necesita un conversor CAD→EPANET,
 * así que lo que aprendas aquí es directamente transferible.
 */

import { CONFIG } from './config.js';
import { distancia, distanciaASegmento } from './util.js';

let siguienteId = 1;

export class Grafo {

  constructor(){
    this.nodos  = new Map();   // id → nodo
    this.aristas = new Map();  // id → arista
    // Lista de adyacencia: id de nodo → array de {arista, vecino}
    // Se mantiene siempre sincronizada para no recorrer todas las
    // aristas cada vez que se pregunta por los vecinos de un nudo.
    this.adyacencia = new Map();
  }

  /* ------------------------------------------------------------------
     CONSTRUCCIÓN
     ------------------------------------------------------------------ */

  agregarNodo(tipo, x, y, cota, extra = {}){
    const id = siguienteId++;
    const nodo = {
      id, tipo, x, y, cota,
      bombeos: 0,                 // grupos de impulsión instalados aquí
      valvula: null,              // VRP instalada aquí: { consigna } en m.c.a.
      // Campos que rellena el solver hidráulico en cada pasada
      alturaPiezometrica: null,   // m sobre el nivel del mar
      presion: 0,                 // m.c.a. = piezométrica − cota
      caudal: 0,                  // L/s que pasa por aquí
      recorteValvula: 0,          // m de presión que disipa la VRP, si la hay
      abastecido: false,
      ...extra
    };
    this.nodos.set(id, nodo);
    this.adyacencia.set(id, []);
    return nodo;
  }

  agregarArista(idA, idB, dn){
    if(idA === idB) return null;
    if(this.existeArista(idA, idB)) return null;
    const a = this.nodos.get(idA), b = this.nodos.get(idB);
    if(!a || !b) return null;

    const id = siguienteId++;
    const arista = {
      id, a: idA, b: idB, dn,
      longitud: distancia(a.x, a.y, b.x, b.y),
      desnivel: Math.abs(b.cota - a.cota),
      caudal: 0,          // L/s, positivo de a→b
      perdida: 0,         // m de pérdida de carga
      activa: false,
      rota: false,        // avería: deja de conducir hasta repararla
      horasServicio: 0    // envejecimiento
    };
    this.aristas.set(id, arista);
    this.adyacencia.get(idA).push({ arista: id, vecino: idB });
    this.adyacencia.get(idB).push({ arista: id, vecino: idA });
    return arista;
  }

  existeArista(idA, idB){
    return this.adyacencia.get(idA)?.some(v => v.vecino === idB) ?? false;
  }

  eliminarNodo(id){
    // Hay que quitar primero todas las aristas que tocan este nodo,
    // o quedarían referencias colgando en la adyacencia.
    for(const { arista } of [...(this.adyacencia.get(id) || [])]){
      this.eliminarArista(arista);
    }
    this.nodos.delete(id);
    this.adyacencia.delete(id);
  }

  eliminarArista(id){
    const ar = this.aristas.get(id);
    if(!ar) return;
    const quitar = lista => lista.filter(v => v.arista !== id);
    this.adyacencia.set(ar.a, quitar(this.adyacencia.get(ar.a) || []));
    this.adyacencia.set(ar.b, quitar(this.adyacencia.get(ar.b) || []));
    this.aristas.delete(id);
  }

  /* ------------------------------------------------------------------
     BÚSQUEDA ESPACIAL
     Traducir "el usuario ha hecho clic aquí" a "ha pinchado este nudo".
     ------------------------------------------------------------------ */

  nodoEn(x, y, tolerancia = 20){
    let mejor = null, mejorD = tolerancia;
    for(const n of this.nodos.values()){
      const r = CONFIG.elementos[n.tipo].radio;
      const d = distancia(x, y, n.x, n.y);
      if(d < Math.max(r, tolerancia) && d < mejorD){ mejorD = d; mejor = n; }
    }
    return mejor;
  }

  aristaEn(x, y, tolerancia = 12){
    let mejor = null, mejorD = tolerancia;
    for(const ar of this.aristas.values()){
      const a = this.nodos.get(ar.a), b = this.nodos.get(ar.b);
      const d = distanciaASegmento(x, y, a.x, a.y, b.x, b.y);
      if(d < mejorD){ mejorD = d; mejor = ar; }
    }
    return mejor;
  }

  /* ------------------------------------------------------------------
     RECORRIDO — el algoritmo que da sentido a todo
     ------------------------------------------------------------------ */

  /**
   * Recorrido en anchura (BFS) desde un conjunto de orígenes.
   *
   * Devuelve un árbol de expansión: para cada nodo alcanzable, de qué
   * nodo viene y por qué arista. Ese árbol es lo que después permite
   * repartir caudales y acumular pérdidas de carga.
   *
   * Se recorre en anchura y no en profundidad porque así cada nodo queda
   * colgado del camino MÁS CORTO hasta una fuente, que es una
   * aproximación razonable a por dónde iría el agua en realidad.
   */
  recorrerDesde(idsOrigen){
    const padre = new Map();      // id nodo → { desde, porArista }
    const orden = [];             // nodos en orden de descubrimiento
    const visitado = new Set();
    const cola = [];

    for(const id of idsOrigen){
      if(!this.nodos.has(id)) continue;
      visitado.add(id);
      padre.set(id, { desde: null, porArista: null });
      cola.push(id);
      orden.push(id);
    }

    let cabeza = 0;
    while(cabeza < cola.length){
      const actual = cola[cabeza++];
      for(const { arista, vecino } of this.adyacencia.get(actual) || []){
        if(visitado.has(vecino)) continue;
        if(this.aristas.get(arista)?.rota) continue;   // un tramo roto no conduce
        visitado.add(vecino);
        padre.set(vecino, { desde: actual, porArista: arista });
        cola.push(vecino);
        orden.push(vecino);
      }
    }
    return { padre, orden, visitado };
  }

  /** Todos los nodos de un tipo concreto. */
  porTipo(tipo){
    return [...this.nodos.values()].filter(n => n.tipo === tipo);
  }

  /* ------------------------------------------------------------------
     SERIALIZACIÓN
     Un Map no se convierte solo a JSON: hay que pasarlo a array.
     Este es el motivo por el que guardar un grafo cuesta más que
     guardar un objeto plano.
     ------------------------------------------------------------------ */

  aObjeto(){
    return {
      siguienteId,
      nodos:   [...this.nodos.values()],
      aristas: [...this.aristas.values()]
    };
  }

  static desdeObjeto(datos){
    const g = new Grafo();
    siguienteId = datos.siguienteId || 1;
    for(const n of datos.nodos){
      g.nodos.set(n.id, n);
      g.adyacencia.set(n.id, []);
    }
    for(const ar of datos.aristas){
      g.aristas.set(ar.id, ar);
      g.adyacencia.get(ar.a)?.push({ arista: ar.id, vecino: ar.b });
      g.adyacencia.get(ar.b)?.push({ arista: ar.id, vecino: ar.a });
    }
    return g;
  }
}
