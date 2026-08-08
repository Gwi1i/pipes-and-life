/**
 * HIDRÁULICA — el solver.
 *
 * Resuelve, en tres pasadas sobre el árbol de expansión:
 *   1. Qué está conectado a una fuente de agua
 *   2. Cuánto caudal circula por cada tramo (de las hojas hacia la raíz)
 *   3. Qué presión queda en cada nudo (de la raíz hacia las hojas)
 *
 * IMPORTANTE — esto NO es un modelo hidráulico real. Un EPANET resuelve
 * un sistema no lineal por Newton-Raphson e itera hasta converger, y
 * admite mallas cerradas. Aquí se supone que la red es un ÁRBOL y se
 * calcula de una pasada. Es una mentira deliberada: el jugador tiene que
 * intuir el resultado en dos segundos, no que sea exacto.
 *
 * La malla cerrada, con su reparto de caudales entre caminos alternativos,
 * queda como ampliación futura. Es justo lo que la haría interesante.
 */

import { CONFIG } from './config.js';

/**
 * @param {Grafo} grafo
 * @returns {{abastecidas:number, totales:number, caudalTotal:number,
 *            energiaKwh:number, incidencias:Array}}
 */
/** Coeficiente de punta para una hora concreta del día. */
export function coefHora(horas){
  const h = Math.floor(((horas % 24) + 24) % 24);
  return CONFIG.curvaDiaria[h];
}

/** Factor de estiaje: el caudal de los cauces según la época del año. */
export function factorEstiaje(horas){
  const e = CONFIG.estiaje;
  const fase = ((horas % e.horasPorAño) / e.horasPorAño) * Math.PI * 2;
  // Mínimo en verano (mitad del ciclo), máximo en primavera
  const t = (Math.cos(fase) + 1) / 2;
  return e.factorMin + (e.factorMax - e.factorMin) * t;
}

export function resolver(grafo, horas = 0){
  const H = CONFIG.hidraulica;
  const punta = coefHora(horas);
  const estiaje = factorEstiaje(horas);

  // Reiniciar el estado calculado del ciclo anterior
  for(const n of grafo.nodos.values()){
    n.alturaPiezometrica = null;
    n.presion = 0;
    n.caudal = 0;
    n.recorteValvula = 0;
    n.abastecido = false;
  }
  for(const ar of grafo.aristas.values()){
    ar.caudal = 0; ar.perdida = 0; ar.activa = false;
  }

  /* ---------------- PASADA 0: identificar orígenes ----------------
     Un depósito es un origen de presión: su lámina de agua fija la
     altura piezométrica aguas abajo. Una captación solo aporta agua a
     cota de terreno, así que por sí sola casi nunca da presión útil. */

  const origenes = [];
  let caudalCaptable = 0;
  for(const n of grafo.nodos.values()){
    if(n.tipo === 'deposito'){
      n.alturaPiezometrica = n.cota + H.alturaLamina;
      origenes.push(n.id);
    } else if(n.tipo === 'captacion'){
      n.alturaPiezometrica = n.cota;
      // El cauce lleva menos agua en verano
      n.caudalActual = (n.caudalDisponible || 0) * estiaje;
      caudalCaptable += n.caudalActual;
      origenes.push(n.id);
    }
  }

  const incidencias = [];
  if(origenes.length === 0){
    return { abastecidas: 0, totales: grafo.porTipo('poblacion').length,
             caudalTotal: 0, energiaKwh: 0,
             incidencias: [{ nivel: 'critico', texto: 'No hay ninguna fuente de agua en la red.' }] };
  }

  /* ---------------- PASADA 1: conectividad (BFS) ---------------- */

  const { padre, orden, visitado } = grafo.recorrerDesde(origenes);

  /* ---------------- PASADA 2: caudales, de hojas a raíz ----------------
     Se recorre el orden de descubrimiento AL REVÉS. Así, cuando se llega
     a un nodo, todos sus descendientes ya han sumado su demanda. Es el
     truco clásico para acumular sobre un árbol sin recursión. */

  const demandaAcumulada = new Map();
  for(const id of orden) demandaAcumulada.set(id, 0);

  // Demanda propia de cada población
  for(const n of grafo.nodos.values()){
    if(n.tipo === 'poblacion' && visitado.has(n.id)){
      // Demanda del momento, no la media: en punta puede ser casi el doble
      n.demandaActual = n.demanda * punta;
      demandaAcumulada.set(n.id, n.demandaActual);
    }
  }

  for(let i = orden.length - 1; i >= 0; i--){
    const id = orden[i];
    const p = padre.get(id);
    if(!p || p.desde === null) continue;

    const q = demandaAcumulada.get(id);
    demandaAcumulada.set(p.desde, demandaAcumulada.get(p.desde) + q);

    const ar = grafo.aristas.get(p.porArista);
    ar.caudal = q;
    ar.activa = q > 0.001;
    ar.perdida = perdidaDeCarga(q, ar.dn, ar.longitud);
  }

  /* ---------------- PASADA 3: presiones, de raíz a hojas ----------------
     Ahora en el orden normal: cuando se llega a un nodo, su padre ya
     tiene altura piezométrica calculada. */

  let energiaKwh = 0;

  for(const id of orden){
    const nodo = grafo.nodos.get(id);
    const p = padre.get(id);

    if(p.desde !== null){
      const anterior = grafo.nodos.get(p.desde);
      const ar = grafo.aristas.get(p.porArista);
      nodo.alturaPiezometrica = anterior.alturaPiezometrica - ar.perdida;
    }

    // Un bombeo añade altura manométrica: es lo que permite subir agua
    // a cotas superiores a la del origen. Es una PROPIEDAD del nodo, no
    // un nodo aparte: el grupo está dentro de la captación o del depósito.
    if(nodo.bombeos > 0 && demandaAcumulada.get(id) > 0.001){
      const salto = CONFIG.elementos.bombeo.alturaManometrica * nodo.bombeos;
      nodo.alturaPiezometrica += salto;
      // Energía: P(kW) = ρ·g·Q·H / rendimiento
      const qm3s = demandaAcumulada.get(id) / 1000;
      const kW = (1000 * 9.81 * qm3s * salto) / (CONFIG.economia.rendimientoBombeo * 1000);
      energiaKwh += kW;   // 1 s de juego = 1 h → kW ≡ kWh
    }

    // Una válvula reductora hace lo contrario que un bombeo: recorta la
    // altura piezométrica para que de aquí hacia abajo no se supere su
    // consigna. Solo puede REDUCIR — si la presión ya es menor, no toca
    // nada. Como se aplica antes de que los hijos lean la piezométrica de
    // su padre, el recorte se propaga solo a toda la rama de aguas abajo,
    // que es justo lo que hace una VRP de verdad.
    if(nodo.valvula){
      const techo = nodo.cota + nodo.valvula.consigna;
      if(nodo.alturaPiezometrica > techo){
        nodo.recorteValvula = nodo.alturaPiezometrica - techo;
        nodo.alturaPiezometrica = techo;
      }
    }

    nodo.presion = nodo.alturaPiezometrica - nodo.cota;
    nodo.caudal = demandaAcumulada.get(id);
  }

  /* ---------------- EVALUACIÓN ---------------- */

  let abastecidas = 0, caudalTotal = 0;
  const poblaciones = grafo.porTipo('poblacion');

  for(const p of poblaciones){
    if(!visitado.has(p.id)){
      incidencias.push({ nivel: 'critico', nodo: p.id,
        texto: `${p.nombre} no está conectada a la red.` });
      continue;
    }
    if(p.presion < CONFIG.hidraulica.presionMinima){
      incidencias.push({ nivel: 'alarma', nodo: p.id,
        texto: `${p.nombre}: presión insuficiente (${p.presion.toFixed(0)} m.c.a.).` });
      continue;
    }
    p.abastecido = true;
    abastecidas++;
    caudalTotal += p.demanda;   // media; la punta se aplica al final
  }

  // Sobrepresión: revienta tuberías, y es el contrapeso de poner el
  // depósito muy alto. Sin esto, la estrategia óptima sería trivial.
  for(const n of grafo.nodos.values()){
    if(visitado.has(n.id) && n.presion > CONFIG.hidraulica.presionMaxima){
      incidencias.push({ nivel: 'alarma', nodo: n.id,
        texto: `Sobrepresión (${n.presion.toFixed(0)} m.c.a.). Hace falta una válvula reductora.` });
    }
  }

  // El recurso también es finito: si la demanda punta supera lo que dan
  // los cauces, no se puede servir todo aunque la red esté perfecta.
  const demandaPunta = poblaciones.filter(p => p.abastecido)
                                  .reduce((s, p) => s + p.demandaActual, 0);
  let recorte = 1;
  if(caudalCaptable > 0 && demandaPunta > caudalCaptable){
    recorte = caudalCaptable / demandaPunta;
    incidencias.unshift({ nivel: 'alarma',
      texto: `Recurso insuficiente: la captación da ${caudalCaptable.toFixed(1)} L/s ` +
             `y la punta pide ${demandaPunta.toFixed(1)} L/s.` });
  }

  return { abastecidas, totales: poblaciones.length,
           caudalTotal: caudalTotal * punta * recorte,
           caudalCaptable, punta, estiaje, recorte,
           energiaKwh, incidencias };
}

/**
 * Pérdida de carga en un tramo, en metros.
 *
 * Forma inspirada en Hazen-Williams (el caudal pesa ~1,85 y el diámetro
 * ~4,87) pero con constantes ajustadas para que se note jugando. No
 * intentes validarla contra un cálculo real: no coincidirá, y es a
 * propósito.
 */
export function perdidaDeCarga(caudalLs, dnMm, longitudM){
  if(caudalLs <= 0) return 0;
  const H = CONFIG.hidraulica;
  const d = dnMm / 100;   // a decímetros, para que los números salgan manejables
  return H.coefPerdida * longitudM *
         Math.pow(caudalLs, H.exponenteCaudal) /
         Math.pow(d, H.exponenteDiametro);
}

/** Coste de tender un tramo: longitud, diámetro y desnivel salvado. */
export function costeTramo(longitud, desnivel, dn){
  const tipo = CONFIG.diametros.find(d => d.dn === dn);
  return longitud * tipo.coste + desnivel * CONFIG.costeExtraPorCota;
}
