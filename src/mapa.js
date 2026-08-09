/**
 * MAPA — el territorio de la mancomunidad.
 *
 * Una cuadrícula grande, mucho mayor que la pantalla, que empieza casi entera
 * TAPADA. Cada casilla se destapa a base de clics, y cuanto más lejos está de
 * tu pueblo de origen, más clics cuesta. Al destaparla aparece su terreno y, si
 * lo tiene, su hallazgo: un pueblo al que dar servicio, una instalación
 * abandonada que reparar o llevarte, o un yacimiento.
 *
 * Módulo de datos puro: genera, consulta y muta el mapa. No sabe dibujar ni de
 * interfaz, igual que `simulacion.js`.
 *
 * El terreno se genera por PROCEDIMIENTO a partir de una semilla, así que no
 * hace falta guardarlo: al cargar la partida se regenera igual y solo se
 * restaura lo que el jugador ha cambiado (lo descubierto y los hallazgos ya
 * resueltos). Es lo que evita que el guardado engorde con miles de casillas.
 */

import { CONFIG } from './config.js';
import { generadorAleatorio } from './util.js';

/* ---------- ruido de valor, para que el terreno tenga formas ---------- */

function ruido2D(semilla, x, y){
  const n = Math.sin(x * 127.1 + y * 311.7 + semilla * 0.0001) * 43758.5453;
  return n - Math.floor(n);
}

/** Ruido suavizado: interpola entre los nodos de una rejilla más gruesa. */
function ruidoSuave(semilla, x, y, escala){
  const gx = x / escala, gy = y / escala;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const tx = gx - x0, ty = gy - y0;
  const s = t => t * t * (3 - 2 * t);
  const a = ruido2D(semilla, x0, y0),     b = ruido2D(semilla, x0 + 1, y0);
  const c = ruido2D(semilla, x0, y0 + 1), d = ruido2D(semilla, x0 + 1, y0 + 1);
  const sx = s(tx), sy = s(ty);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/* ---------- generación ---------- */

/**
 * Crea el mapa. Devuelve un array plano de casillas:
 *   { tipo, hallazgo, oculta, progreso, resuelto }
 * `tipo` es el terreno; `hallazgo` es lo que esconde (o null).
 */
export function generarMapa(){
  const M = CONFIG.mapaMundo;
  const celdas = new Array(M.cols * M.filas);
  const azar = generadorAleatorio(M.semilla);

  for(let f = 0; f < M.filas; f++){
    for(let c = 0; c < M.cols; c++){
      // Dos capas de ruido: uno grande para los biomas y otro fino para el detalle
      const grande = ruidoSuave(M.semilla, c, f, 9);
      const fino   = ruidoSuave(M.semilla + 77, c, f, 3.5);
      const h = grande * 0.72 + fino * 0.28;

      // Un río que serpentea de norte a sur, para que siempre haya de dónde captar
      const cauce = M.cols * 0.5 + Math.sin(f * 0.28) * M.cols * 0.16
                                 + Math.sin(f * 0.11) * M.cols * 0.08;
      const enCauce = Math.abs(c - cauce) < 1.1;

      let tipo;
      if(enCauce)          tipo = 'agua';
      else if(h > 0.74)    tipo = 'montana';
      else if(h > 0.60)    tipo = 'bosque';
      else if(h < 0.26)    tipo = 'lago';
      else                 tipo = 'hierba';

      celdas[f * M.cols + c] = {
        tipo, hallazgo: null, oculta: true, progreso: 0, resuelto: false
      };
    }
  }

  sembrarHallazgos(celdas, azar);
  abrirZonaInicial(celdas);
  return celdas;
}

/** Reparte pueblos, ruinas y yacimientos por el mapa, sin amontonarlos. */
function sembrarHallazgos(celdas, azar){
  const M = CONFIG.mapaMundo, H = CONFIG.hallazgos;
  const puestos = [];
  const lejosDeOtros = (c, f, min) =>
    puestos.every(p => Math.hypot(p.c - c, p.f - f) >= min);

  const tipos = [
    { clave: 'pueblo',     n: H.pueblos,     separacion: 6, terreno: ['hierba', 'bosque'] },
    { clave: 'ruina',      n: H.ruinas,      separacion: 4, terreno: ['hierba', 'bosque', 'montana'] },
    { clave: 'yacimiento', n: H.yacimientos, separacion: 4, terreno: ['montana', 'bosque'] }
  ];

  for(const t of tipos){
    let puestosDeEste = 0, intentos = 0;
    while(puestosDeEste < t.n && intentos++ < 4000){
      const c = Math.floor(azar() * M.cols);
      const f = Math.floor(azar() * M.filas);
      const celda = celdas[f * M.cols + c];
      const dist = Math.hypot(c - M.origen.col, f - M.origen.fila);
      if(!t.terreno.includes(celda.tipo)) continue;
      if(celda.hallazgo) continue;
      if(dist < H.distanciaMinima) continue;      // que no salga todo en la puerta
      if(!lejosDeOtros(c, f, t.separacion)) continue;
      celda.hallazgo = t.clave;
      puestos.push({ c, f });
      puestosDeEste++;
    }
  }
}

/** Deja descubierto un círculo alrededor del origen: por algo hay que empezar. */
function abrirZonaInicial(celdas){
  const M = CONFIG.mapaMundo;
  recorrer(celdas, (celda, c, f) => {
    if(Math.hypot(c - M.origen.col, f - M.origen.fila) <= M.radioInicial){
      celda.oculta = false;
    }
  });
  // La casilla de origen es siempre tu pueblo
  const o = celdaEn(celdas, M.origen.col, M.origen.fila);
  if(o){ o.tipo = 'hierba'; o.hallazgo = 'pueblo'; o.resuelto = true; }
}

/* ---------- consulta ---------- */

export function celdaEn(celdas, col, fila){
  const M = CONFIG.mapaMundo;
  if(col < 0 || fila < 0 || col >= M.cols || fila >= M.filas) return null;
  return celdas[fila * M.cols + col];
}

export function recorrer(celdas, fn){
  const M = CONFIG.mapaMundo;
  for(let f = 0; f < M.filas; f++)
    for(let c = 0; c < M.cols; c++)
      fn(celdas[f * M.cols + c], c, f);
}

/** Distancia (en casillas) desde el pueblo de origen. */
export function distanciaAlOrigen(col, fila){
  const o = CONFIG.mapaMundo.origen;
  return Math.hypot(col - o.col, fila - o.fila);
}

/**
 * Clics necesarios para destapar una casilla. Crece con la distancia y algo
 * más que en línea recta, para que expandirse lejos sea una decisión y no un
 * trámite. El terreno difícil (montaña) cuesta un extra.
 */
export function clicsParaDestapar(col, fila, tipo, poder = 1){
  const M = CONFIG.mapaMundo;
  const d = distanciaAlOrigen(col, fila);
  const base = M.clicsBase + Math.pow(d, M.exponenteDistancia) * M.factorDistancia;
  const extra = CONFIG.terrenos[tipo]?.costeExtra ?? 1;
  // El poder de expansión (lo bien que llevas el abastecimiento) DIVIDE el
  // coste: es lo que hace que cuidar la red abra territorio.
  return Math.max(1, Math.round(base * extra / Math.max(0.2, poder)));
}

/** ¿Es alcanzable? Solo se puede destapar lo que toca terreno ya descubierto. */
export function esAlcanzable(celdas, col, fila){
  for(const [dc, df] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const v = celdaEn(celdas, col + dc, fila + df);
    if(v && !v.oculta) return true;
  }
  return false;
}

/* ---------- acción ---------- */

/**
 * Un clic sobre una casilla tapada. Devuelve 'progreso', 'descubierta' o null
 * si ese clic no valía (fuera del mapa o inalcanzable).
 */
export function clicarCasilla(celdas, col, fila, poder = 1){
  const celda = celdaEn(celdas, col, fila);
  if(!celda || !celda.oculta) return null;
  if(!esAlcanzable(celdas, col, fila)) return null;

  celda.progreso++;
  if(celda.progreso >= clicsParaDestapar(col, fila, celda.tipo, poder)){
    celda.oculta = false;
    return 'descubierta';
  }
  return 'progreso';
}

/* ================================================================
   CONSTRUCCIÓN — dónde se puede poner cada cosa
   ================================================================ */

/** Vecinas ortogonales de una casilla (las que existen). */
export function vecinas(celdas, col, fila){
  const v = [];
  for(const [dc, df] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const celda = celdaEn(celdas, col + dc, fila + df);
    if(celda) v.push({ celda, col: col + dc, fila: fila + df });
  }
  return v;
}

/** ¿Hay agua a `radio` casillas o menos? Lo usa el sondeo a acuífero. */
export function hayAguaCerca(celdas, col, fila, radio){
  for(let f = fila - radio; f <= fila + radio; f++){
    for(let c = col - radio; c <= col + radio; c++){
      const celda = celdaEn(celdas, c, f);
      if(celda && (celda.tipo === 'agua' || celda.tipo === 'lago')) return true;
    }
  }
  return false;
}

/**
 * ¿Se puede plantar `tipo` en esta casilla? Devuelve { ok, motivo } — el motivo
 * se le enseña al jugador, que si no no entiende por qué no le deja.
 */
export function puedeColocar(celdas, construcciones, tipo, col, fila){
  const def = CONFIG.construibles[tipo];
  if(!def) return { ok: false, motivo: 'Eso no se puede construir.' };

  const celda = celdaEn(celdas, col, fila);
  if(!celda) return { ok: false, motivo: 'Fuera del mapa.' };
  if(celda.oculta) return { ok: false, motivo: 'Primero hay que destapar esa casilla.' };
  if(construcciones.some(o => o.col === col && o.fila === fila))
    return { ok: false, motivo: 'Ya hay algo construido ahí.' };
  if(celda.hallazgo === 'pueblo')
    return { ok: false, motivo: 'Ahí está el pueblo.' };

  if(!def.terreno.includes(celda.tipo)){
    const nombres = def.terreno.map(t => CONFIG.terrenos[t].nombre.toLowerCase()).join(' o ');
    return { ok: false, motivo: `${def.nombre} solo va en ${nombres}.` };
  }
  if(def.junto && !vecinas(celdas, col, fila).some(v => def.junto.includes(v.celda.tipo)))
    return { ok: false, motivo: `${def.nombre} tiene que estar pegado al agua.` };
  if(def.lejosDeAgua && hayAguaCerca(celdas, col, fila, def.lejosDeAgua))
    return { ok: false, motivo: 'Hay agua cerca: sale mucho más barato captarla que perforar.' };

  return { ok: true, motivo: '' };
}

/* ================================================================
   TUBERÍAS — la ruta más barata, esquivando o pagando el terreno
   ================================================================ */

export function costeCasillaTuberia(celda){
  return CONFIG.tuberia.costePorCasilla[celda.tipo] ?? 20;
}

/**
 * Ruta más BARATA entre dos casillas (A* sobre la cuadrícula, en ortogonal).
 * No busca la más corta: busca la que menos cuesta, así rodear un bosque o
 * atravesarlo pagando el desbroce es una decisión real del terreno y no una
 * regla artificial. Solo pasa por casillas ya descubiertas.
 *
 * Devuelve { camino: [{col,fila}], coste } o null si no hay paso.
 */
export function rutaTuberia(celdas, desde, hasta){
  const M = CONFIG.mapaMundo;
  const clave = (c, f) => f * M.cols + c;
  const meta = clave(hasta.col, hasta.fila);

  const coste = new Map();      // mejor coste conocido hasta cada casilla
  const previo = new Map();
  const abierta = [{ col: desde.col, fila: desde.fila, g: 0,
                     f: heuristica(desde, hasta) }];
  coste.set(clave(desde.col, desde.fila), 0);

  let vueltas = 0;
  while(abierta.length && vueltas++ < 20000){
    // el de menor f estimado (la lista es corta: basta con buscarlo)
    let mejor = 0;
    for(let i = 1; i < abierta.length; i++) if(abierta[i].f < abierta[mejor].f) mejor = i;
    const actual = abierta.splice(mejor, 1)[0];
    const k = clave(actual.col, actual.fila);

    if(k === meta){
      // reconstruir el camino hacia atrás
      const camino = [];
      let cur = k;
      while(cur !== undefined){
        camino.unshift({ col: cur % M.cols, fila: Math.floor(cur / M.cols) });
        cur = previo.get(cur);
      }
      return { camino, coste: coste.get(meta) };
    }

    for(const v of vecinas(celdas, actual.col, actual.fila)){
      if(v.celda.oculta) continue;              // no se tiende por lo desconocido
      const kv = clave(v.col, v.fila);
      const g = actual.g + costeCasillaTuberia(v.celda);
      if(coste.has(kv) && coste.get(kv) <= g) continue;
      coste.set(kv, g); previo.set(kv, k);
      abierta.push({ col: v.col, fila: v.fila, g,
                     f: g + heuristica(v, hasta) });
    }
  }
  return null;
}

// Distancia Manhattan por el coste más barato posible: nunca sobreestima, que
// es lo que hace que A* siga dando la ruta óptima.
function heuristica(a, b){
  const minimo = Math.min(...Object.values(CONFIG.tuberia.costePorCasilla));
  return (Math.abs(a.col - b.col) + Math.abs(a.fila - b.fila)) * minimo;
}

/* ---------- persistencia compacta ----------
   El terreno se regenera de la semilla, así que solo hace falta guardar lo que
   el jugador ha tocado: qué está descubierto, qué lleva progreso y qué
   hallazgos ya ha resuelto. */

export function comprimir(celdas){
  const abiertas = [], progresos = [], resueltos = [];
  recorrer(celdas, (celda, c, f) => {
    const i = f * CONFIG.mapaMundo.cols + c;
    if(!celda.oculta) abiertas.push(i);
    else if(celda.progreso > 0) progresos.push([i, celda.progreso]);
    if(celda.resuelto) resueltos.push(i);
  });
  return { abiertas, progresos, resueltos };
}

export function aplicarGuardado(celdas, datos){
  if(!datos) return;
  for(const i of datos.abiertas || []) if(celdas[i]) celdas[i].oculta = false;
  for(const [i, p] of datos.progresos || []) if(celdas[i]) celdas[i].progreso = p;
  for(const i of datos.resueltos || []) if(celdas[i]) celdas[i].resuelto = true;
}
