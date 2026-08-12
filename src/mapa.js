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
// La única concesión de este módulo "puro": el semillero de nombres puede
// venir de los lugares del jugador. Es leer una lista, no tocar el mundo.
import { lista as listaLugares } from './lugares.js';

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

      // Primero la FAMILIA con la altura, como siempre. La variante dentro de
      // cada familia la decide una tercera capa de ruido, más fina y con otra
      // semilla: así el pinar y el bosque cerrado se agrupan en manchas en vez
      // de salpicarse al azar casilla por casilla, que se vería como ruido.
      const veta = ruidoSuave(M.semilla + 313, c, f, 5);

      let tipo;
      if(enCauce)        tipo = 'agua';
      else if(h < 0.26)  tipo = 'lago';
      else if(h > 0.74)  tipo = veta > 0.66 ? 'roca'     : (veta > 0.36 ? 'sierra' : 'colina');
      else if(h > 0.60)  tipo = veta > 0.66 ? 'bosque'   : (veta > 0.36 ? 'pinar'  : 'matorral');
      else               tipo = veta > 0.72 ? 'pedregal' : (veta > 0.40 ? 'pastizal' : 'prado');

      celdas[f * M.cols + c] = {
        tipo, hallazgo: null, oculta: true, progreso: 0, resuelto: false
      };
    }
  }

  suavizarArranque(celdas);
  sembrarPueblos(celdas, azar);
  sembrarProteccion(celdas, azar);
  // La garantía va DESPUÉS de proteger y ANTES de nada más: si una zona ha
  // dejado un pueblo incomunicado, aquí se le abre el paso.
  garantizarAcceso(celdas);
  sembrarAcuiferos(celdas, azar);
  sembrarHallazgos(celdas, azar);
  sembrarArqueologia(celdas, azar);
  abrirZonaInicial(celdas);
  return celdas;
}

/**
 * El arranque tiene que ser amable. Con nueve terrenos, la semilla podía dejar
 * al pueblo de origen rodeado de pedregal y roca viva, y entonces la primera
 * tubería costaba una fortuna y el juego empezaba cuesta arriba sin motivo.
 * Cerca del pueblo se rebaja cada familia a su variante barata; a partir de ahí,
 * el terreno es el que toque.
 */
function suavizarArranque(celdas){
  const M = CONFIG.mapaMundo;
  const rebaja = { pedregal: 'prado', pastizal: 'prado',
                   bosque: 'matorral', pinar: 'matorral',
                   roca: 'colina', sierra: 'colina' };
  recorrer(celdas, (celda, c, f) => {
    if(distanciaAlOrigen(c, f) > M.radioAmable) return;
    if(rebaja[celda.tipo]) celda.tipo = rebaja[celda.tipo];
  });
}

/**
 * Siembra las ZONAS DE ESPECIAL CONSERVACIÓN: manchas orgánicas de casillas
 * protegidas, cada una de fauna o de flora. Crecen desde una semilla por
 * vecinos al azar, que da formas irregulares en vez de rectángulos de parque.
 */
function sembrarProteccion(celdas, azar){
  const M = CONFIG.mapaMundo, Z = CONFIG.proteccion;
  let zonas = 0, intentos = 0;
  while(zonas < Z.zonas && intentos++ < Z.zonas * 300){
    const c0 = Math.floor(azar() * M.cols), f0 = Math.floor(azar() * M.filas);
    const semilla = celdaEn(celdas, c0, f0);
    if(!semilla || semilla.hallazgo || semilla.protegida) continue;
    if(distanciaAlOrigen(c0, f0) < Z.distanciaMinima) continue;
    const tipo = azar() < 0.5 ? 'fauna' : 'flora';
    const objetivo = Z.tamMin + Math.floor(azar() * (Z.tamMax - Z.tamMin + 1));
    const mancha = [{ c: c0, f: f0 }];
    semilla.protegida = tipo;
    // El tope de vueltas no es adorno: una mancha encajonada entre hallazgos no
    // puede crecer más y sin él este bucle se queda dando vueltas para siempre.
    let vueltas = 0;
    while(mancha.length < objetivo && vueltas++ < objetivo * 60){
      const base = mancha[Math.floor(azar() * mancha.length)];
      const [dc, df] = [[1,0],[-1,0],[0,1],[0,-1]][Math.floor(azar() * 4)];
      const cel = celdaEn(celdas, base.c + dc, base.f + df);
      if(!cel || cel.protegida || cel.hallazgo) continue;
      if(distanciaAlOrigen(base.c + dc, base.f + df) < Z.distanciaMinima) continue;
      cel.protegida = tipo;
      mancha.push({ c: base.c + dc, f: base.f + df });
    }
    zonas++;
  }
}

/**
 * Siembra el AGUA SUBTERRÁNEA: masas de acuífero invisibles, de las dos clases,
 * cada una en los terrenos que le tocan. Y siembra también los INDICIOS, que es
 * lo que el estudio hidrogeológico ve: cubren la masa, se salen un poco de ella
 * (`haloIndicios`) y aparecen además en manchas SIN agua (`señuelos`).
 *
 * Esa separación es toda la mecánica: si los indicios coincidieran exactamente
 * con el agua, el estudio sería un detector y perforar dejaría de ser una
 * apuesta. Con señuelos, el estudio hace lo que hace de verdad — mejorar mucho
 * las probabilidades, sin garantizar nada.
 */
function sembrarAcuiferos(celdas, azar){
  const M = CONFIG.mapaMundo, A = CONFIG.acuiferos;

  // Crece una mancha desde una semilla y devuelve sus casillas
  const manchaDesde = (c0, f0, objetivo, valida) => {
    const mancha = [{ c: c0, f: f0 }];
    let vueltas = 0;
    while(mancha.length < objetivo && vueltas++ < objetivo * 60){
      const base = mancha[Math.floor(azar() * mancha.length)];
      const [dc, df] = [[1,0],[-1,0],[0,1],[0,-1]][Math.floor(azar() * 4)];
      const c = base.c + dc, f = base.f + df;
      if(mancha.some(q => q.c === c && q.f === f)) continue;
      if(!valida(celdaEn(celdas, c, f), c, f)) continue;
      mancha.push({ c, f });
    }
    return mancha;
  };

  const marcarIndicios = mancha => {
    for(const q of mancha)
      for(let df = -A.haloIndicios; df <= A.haloIndicios; df++)
        for(let dc = -A.haloIndicios; dc <= A.haloIndicios; dc++){
          const cel = celdaEn(celdas, q.c + dc, q.f + df);
          if(cel && cel.tipo !== 'agua' && cel.tipo !== 'lago') cel.indicios = true;
        }
  };

  // 1. Las masas con agua de verdad, clase por clase. Cada MASA lleva su número:
  //    es la unidad que se explota y que se agota, no la casilla. Dos pozos
  //    clavados en la misma masa se están quitando el agua el uno al otro.
  let masa = 0;
  for(const [clave, def] of Object.entries(A.clases)){
    const valida = (cel, c, f) => cel && !cel.acuifero && !cel.hallazgo
      && def.terrenos.includes(cel.tipo)
      && distanciaAlOrigen(c, f) >= A.distanciaMinima;
    let puestas = 0, intentos = 0;
    while(puestas < def.masas && intentos++ < def.masas * 400){
      const c0 = Math.floor(azar() * M.cols), f0 = Math.floor(azar() * M.filas);
      if(!valida(celdaEn(celdas, c0, f0), c0, f0)) continue;
      const objetivo = def.tamMin + Math.floor(azar() * (def.tamMax - def.tamMin + 1));
      const mancha = manchaDesde(c0, f0, objetivo, valida);
      masa++;
      for(const q of mancha){
        const cel = celdaEn(celdas, q.c, q.f);
        cel.acuifero = clave;
        cel.masa = masa;
      }
      marcarIndicios(mancha);
      puestas++;
    }
  }

  // 2. Los señuelos: geología que promete y no cumple. El sondeo aquí sale seco.
  const terrenosPosibles = Object.values(A.clases).flatMap(d => d.terrenos);
  const validaSeñuelo = (cel, c, f) => cel && !cel.acuifero && !cel.hallazgo
    && terrenosPosibles.includes(cel.tipo)
    && distanciaAlOrigen(c, f) >= A.distanciaMinima;
  let puestos = 0, intentos = 0;
  while(puestos < A.señuelos && intentos++ < A.señuelos * 400){
    const c0 = Math.floor(azar() * M.cols), f0 = Math.floor(azar() * M.filas);
    if(!validaSeñuelo(celdaEn(celdas, c0, f0), c0, f0)) continue;
    marcarIndicios(manchaDesde(c0, f0, A.tamSeñuelo, validaSeñuelo));
    puestos++;
  }
}

/**
 * LA GARANTÍA: ningún núcleo puede quedar sin manera de recibir agua.
 *
 * Lo único que corta el paso para siempre son las zonas protegidas, y basta con
 * que una caiga cerrando el único paso a un pueblo para dejarlo incomunicado sin
 * que el jugador pueda hacer nada. Aquí se recorre el mapa desde el origen y, si
 * algún núcleo se ha quedado al otro lado, se le abre un pasillo quitando la
 * protección de las casillas justas. Un pueblo inalcanzable no es dificultad:
 * es una partida rota que además no se ve venir.
 */
function garantizarAcceso(celdas){
  const M = CONFIG.mapaMundo;
  const idx = (c, f) => f * M.cols + c;
  const dentro = (c, f) => c >= 0 && f >= 0 && c < M.cols && f < M.filas;

  // Camino más corto desde el origen contando las casillas protegidas como
  // caras: así el pasillo que se abre es el que menos protección destruye.
  const abrirHasta = (cd, fd) => {
    const coste = new Float64Array(M.cols * M.filas).fill(Infinity);
    const previo = new Int32Array(M.cols * M.filas).fill(-1);
    const o = M.origen;
    coste[idx(o.col, o.fila)] = 0;
    const cola = [{ c: o.col, f: o.fila, g: 0 }];
    while(cola.length){
      cola.sort((a, b) => a.g - b.g);
      const act = cola.shift();
      if(act.g > coste[idx(act.c, act.f)]) continue;
      if(act.c === cd && act.f === fd) break;
      for(const [dc, df] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const c = act.c + dc, f = act.f + df;
        if(!dentro(c, f)) continue;
        const g = act.g + (celdas[idx(c, f)].protegida ? 1 : 0.001);
        if(g >= coste[idx(c, f)]) continue;
        coste[idx(c, f)] = g;
        previo[idx(c, f)] = idx(act.c, act.f);
        cola.push({ c, f, g });
      }
    }
    for(let i = idx(cd, fd); i >= 0; i = previo[i]) celdas[i].protegida = null;
  };

  // ¿A quién no se llega? Recorrido normal, saltando lo protegido.
  const visto = new Uint8Array(M.cols * M.filas);
  const o = M.origen;
  const pila = [[o.col, o.fila]];
  visto[idx(o.col, o.fila)] = 1;
  while(pila.length){
    const [c, f] = pila.pop();
    for(const [dc, df] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nc = c + dc, nf = f + df;
      if(!dentro(nc, nf) || visto[idx(nc, nf)]) continue;
      if(celdas[idx(nc, nf)].protegida) continue;
      visto[idx(nc, nf)] = 1;
      pila.push([nc, nf]);
    }
  }
  recorrer(celdas, (celda, c, f) => {
    if(celda.hallazgo === 'pueblo' && !visto[idx(c, f)]) abrirHasta(c, f);
  });
}

/** La clase de acuífero que hay bajo una casilla, si la hay. */
export function claseAcuifero(celda){
  return celda && celda.acuifero ? CONFIG.acuiferos.clases[celda.acuifero] : null;
}

/**
 * Las masas de acuífero del mapa: número de masa → { clase, celdas }. Se calcula
 * una vez y se guarda en el propio mapa, que no cambia en toda la partida (el
 * agua subterránea viene de la semilla y ahí se queda).
 */
export function masasDelMapa(celdas){
  if(celdas._masas) return celdas._masas;
  const masas = new Map();
  for(const celda of celdas){
    if(!celda || !celda.masa) continue;
    const m = masas.get(celda.masa);
    if(m) m.celdas++;
    else masas.set(celda.masa, { clase: celda.acuifero, celdas: 1 });
  }
  Object.defineProperty(celdas, '_masas', { value: masas, enumerable: false });
  return masas;
}

/**
 * Esconde yacimientos arqueológicos BAJO TIERRA. No llevan `hallazgo` porque no
 * son algo que se encuentre mirando: `celda.arqueologia` no se dibuja ni se
 * anuncia hasta que alguien pica ahí (`aflorado`).
 */
function sembrarArqueologia(celdas, azar){
  const A = CONFIG.arqueologia, M = CONFIG.mapaMundo;
  let puestos = 0, intentos = 0;
  while(puestos < A.cantidad && intentos < A.cantidad * 200){
    intentos++;
    const c = Math.floor(azar() * M.cols), f = Math.floor(azar() * M.filas);
    const celda = celdaEn(celdas, c, f);
    if(!celda || celda.arqueologia || celda.hallazgo) continue;
    if(celda.tipo === 'agua' || celda.tipo === 'lago') continue;
    if(distanciaAlOrigen(c, f) < A.distanciaMinima) continue;
    // Cada yacimiento nace siendo algo concreto (con la semilla, para que la
    // misma partida encuentre siempre lo mismo en el mismo sitio)
    const T = A.tipos;
    const pesoTotal = T.reduce((a, t) => a + t.peso, 0);
    let bola = azar() * pesoTotal;
    celda.arqueologia = T.find(t => (bola -= t.peso) <= 0)?.id || T[0].id;
    puestos++;
  }
}

/**
 * Siembra los NÚCLEOS por anillos de distancia. Cada uno guarda en su celda el
 * anillo (decide en qué fase se puede incorporar), sus habitantes de llegada y
 * su nombre, todo con la semilla: la misma partida encuentra siempre los mismos
 * pueblos en los mismos sitios.
 */
function sembrarPueblos(celdas, azar){
  const M = CONFIG.mapaMundo, N = CONFIG.nucleos;
  const puestos = [];
  let indice = 0;
  N.anillos.forEach((anillo, ai) => {
    const desde = ai === 0 ? M.radioInicial + 2 : N.anillos[ai - 1].hasta;
    let puestosAqui = 0, intentos = 0;
    while(puestosAqui < anillo.n && intentos++ < 6000){
      const c = Math.floor(azar() * M.cols), f = Math.floor(azar() * M.filas);
      const celda = celdaEn(celdas, c, f);
      if(!celda || celda.hallazgo) continue;
      if(celda.tipo === 'agua' || celda.tipo === 'lago') continue;
      const d = distanciaAlOrigen(c, f);
      if(d < desde || d >= anillo.hasta) continue;
      if(!puestos.every(q => Math.hypot(q.c - c, q.f - f) >= N.separacion)) continue;
      celda.tipo = 'prado';            // un pueblo no se asienta en la roca
      celda.hallazgo = 'pueblo';
      celda.anillo = ai + 1;
      celda.habIni = Math.round(N.habitantesMin + azar() * (N.habitantesMax - N.habitantesMin)
                                + ai * N.habitantesPorAnillo);
      celda.nombreIdx = indice++;
      puestos.push({ c, f });
      puestosAqui++;
    }
  });
}

/**
 * El nombre estable de un núcleo a partir de su índice de siembra. Si el
 * jugador activó los LUGARES de su zona, mandan esos —los más cercanos a su
 * casa son los primeros índices, que son los primeros núcleos en aparecer—;
 * si no, o si la lista se queda corta, los inventados de siempre.
 * OJO: los pueblos YA incorporados guardan su nombre en la partida y no
 * cambian; esto bautiza a los que quedan por descubrir.
 */
export function nombreDeNucleo(idx){
  const cercanos = listaLugares();
  if(cercanos && cercanos[idx]) return cercanos[idx];
  const N = CONFIG.nucleos;
  const pre = N.prefijos[idx % N.prefijos.length];
  const suf = N.sufijos[Math.floor(idx / N.prefijos.length) % N.sufijos.length];
  return pre + suf;
}

/** Reparte ruinas por el mapa, sin amontonarlas. */
function sembrarHallazgos(celdas, azar){
  const M = CONFIG.mapaMundo, H = CONFIG.hallazgos;
  const puestos = [];
  const lejosDeOtros = (c, f, min) =>
    puestos.every(p => Math.hypot(p.c - c, p.f - f) >= min);

  const tipos = [
    // Las ruinas salen en cualquier tierra firme: son instalaciones viejas y
    // las hubo de todo tipo. El agua es lo unico que se descarta.
    { clave: 'ruina', n: H.ruinas, separacion: 4, terreno: null }
  ];

  for(const t of tipos){
    let puestosDeEste = 0, intentos = 0;
    while(puestosDeEste < t.n && intentos++ < 4000){
      const c = Math.floor(azar() * M.cols);
      const f = Math.floor(azar() * M.filas);
      const celda = celdas[f * M.cols + c];
      const dist = Math.hypot(c - M.origen.col, f - M.origen.fila);
      //  = vale cualquier tierra firme
      if(celda.tipo === 'agua' || celda.tipo === 'lago') continue;
      if(t.terreno && !t.terreno.includes(celda.tipo)) continue;
      if(celda.hallazgo) continue;
      if(dist < H.distanciaMinima) continue;      // que no salga todo en la puerta
      if(!lejosDeOtros(c, f, t.separacion)) continue;
      celda.hallazgo = t.clave;
      // Cada instalación abandonada esconde una pieza concreta, decidida aquí
      // (con la semilla) para que sea siempre la misma en la misma partida.
      if(t.clave === 'ruina'){
        const lista = H.piezasRuina;
        celda.pieza = lista[Math.floor(azar() * lista.length)];
      }
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
  if(o){ o.tipo = 'prado'; o.hallazgo = 'pueblo'; o.resuelto = true; }
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
/**
 * ¿Hay un yacimiento ya AFLORADO en esa casilla? Solo bloquea cuando ha salido a
 * la luz: mientras siga dormido nadie sabe que está ahí, que es toda la gracia.
 */
export function arqueologiaBloquea(celda){
  return !!(celda && celda.arqueologia && celda.aflorado);
}

/**
 * Saca a la luz el yacimiento de esa casilla, si lo hay. Se llama SOLO cuando el
 * jugador confirma una obra, nunca al pasar el ratón: si aflorara en la
 * previsualización, bastaría con barrer el mapa con el cursor para descubrirlos
 * todos sin pagar ni una zanja.
 */
export function aflorarArqueologia(celdas, col, fila){
  const celda = celdaEn(celdas, col, fila);
  if(!celda || !celda.arqueologia || celda.aflorado) return false;
  celda.aflorado = true;
  return true;
}

/* ---------- LA BÚSQUEDA DE AGUA SUBTERRÁNEA ---------- */

/**
 * ¿Se puede estudiar aquí? El estudio se paga por área, así que lo único que se
 * pide es haber explorado el sitio: no se estudia lo que no se ha pisado.
 */
export function puedeEstudiar(celdas, col, fila){
  const celda = celdaEn(celdas, col, fila);
  if(!celda) return { ok: false, motivo: 'Fuera del mapa.' };
  if(celda.oculta) return { ok: false, motivo: 'Primero hay que destapar esa zona.' };
  if(celda.estudiada) return { ok: false, motivo: 'Esta zona ya está estudiada.' };
  return { ok: true, motivo: '' };
}

/**
 * Pasa el estudio hidrogeológico por el área. Marca las casillas como
 * estudiadas: a partir de ahí se ve cuáles tienen indicios. Devuelve cuántas
 * con indicios han salido, para poder contarlo.
 */
export function estudiarZona(celdas, col, fila){
  const A = CONFIG.acuiferos;
  let conIndicios = 0;
  for(let df = -A.estudio.radio; df <= A.estudio.radio; df++)
    for(let dc = -A.estudio.radio; dc <= A.estudio.radio; dc++){
      const celda = celdaEn(celdas, col + dc, fila + df);
      if(!celda || celda.oculta) continue;
      celda.estudiada = true;
      if(celda.indicios) conIndicios++;
    }
  return conIndicios;
}

/**
 * ¿Se puede perforar aquí? Perforar a ciegas se DEJA hacer: es carísimo y casi
 * siempre sale seco, y esa es justo la lección que el estudio ahorra.
 */
export function puedeSondear(celdas, col, fila){
  const celda = celdaEn(celdas, col, fila);
  if(!celda) return { ok: false, motivo: 'Fuera del mapa.' };
  if(celda.oculta) return { ok: false, motivo: 'Primero hay que destapar esa casilla.' };
  if(celda.protegida)
    return { ok: false, motivo: 'Zona de especial conservación: aquí no se perfora.' };
  if(celda.tipo === 'agua' || celda.tipo === 'lago')
    return { ok: false, motivo: 'Eso es agua superficial: se capta, no se perfora.' };
  if(celda.hallazgo === 'pueblo')
    return { ok: false, motivo: 'Ahí está el pueblo.' };
  if(arqueologiaBloquea(celda))
    return { ok: false, motivo: 'Yacimiento arqueológico: no se puede tocar.' };
  if(celda.sondeo)
    return { ok: false, motivo: celda.sondeo === 'seco'
      ? 'Aquí ya se perforó y salió seco.' : 'Aquí ya hay un sondeo con agua.' };
  return { ok: true, motivo: '' };
}

/** Lo que cuesta perforar aquí. En roca cuesta más que en la vega. */
export function costeSondeo(celda){
  const A = CONFIG.acuiferos;
  const clase = claseAcuifero(celda);
  if(clase) return clase.costeSondeo;
  // Sin agua debajo se paga por el terreno que haya que atravesar: la roca es
  // cara aunque no haya nada al final. Perforar en balde también se cobra.
  const dura = ['colina', 'sierra', 'roca', 'pedregal'].includes(celda.tipo);
  return dura ? A.clases.karst.costeSondeo : A.clases.aluvial.costeSondeo;
}

/**
 * Perfora. El resultado NO es un dado: depende de si hay agua ahí debajo, que
 * se sembró con el mapa. Así la misma partida da siempre el mismo resultado en
 * la misma casilla —nada de recargar hasta que suene— y lo que decide es dónde
 * eliges perforar, que es de lo que va la prospección.
 */
export function sondear(celdas, col, fila){
  const celda = celdaEn(celdas, col, fila);
  if(!celda || celda.sondeo) return null;
  celda.sondeo = celda.acuifero ? 'positivo' : 'seco';
  celda.estudiada = true;     // perforar es la forma más cara de estudiar
  return celda.sondeo === 'positivo' ? claseAcuifero(celda) : null;
}

export function puedeColocar(celdas, construcciones, tipo, col, fila){
  const def = CONFIG.construibles[tipo];
  if(!def) return { ok: false, motivo: 'Eso no se puede construir.' };

  const celda = celdaEn(celdas, col, fila);
  if(!celda) return { ok: false, motivo: 'Fuera del mapa.' };
  if(celda.oculta) return { ok: false, motivo: 'Primero hay que destapar esa casilla.' };
  // La protección se dice ANTES que ninguna otra pega: si el motivo fuera "ese
  // terreno no vale", el jugador pensaría que con otro terreno sí se podría.
  if(celda.protegida)
    return { ok: false, motivo: 'Zona de especial conservación: aquí no se construye. Hay que rodearla.' };
  if(construcciones.some(o => o.col === col && o.fila === fila))
    return { ok: false, motivo: 'Ya hay algo construido ahí.' };
  if(celda.hallazgo === 'pueblo')
    return { ok: false, motivo: 'Ahí está el pueblo.' };

  // El pozo no va "en un terreno": va donde el sondeo ha dado agua. Por eso su
  // definición no lleva `terreno` y la comprobación es esta.
  if(def.requiereSondeo && celda.sondeo !== 'positivo')
    return { ok: false, motivo: celda.sondeo === 'seco'
      ? 'Ese sondeo salió seco: ahí abajo no hay agua.'
      : 'Ahí no se ha perforado todavía. Hay que sondear antes y que dé agua.' };

  if(def.terreno && !def.terreno.includes(celda.tipo)){
    const nombres = def.terreno.map(t => CONFIG.terrenos[t].nombre.toLowerCase()).join(' o ');
    return { ok: false, motivo: `${def.nombre} solo va en ${nombres}.` };
  }
  if(def.junto && !vecinas(celdas, col, fila).some(v => def.junto.includes(v.celda.tipo)))
    return { ok: false, motivo: `${def.nombre} tiene que estar pegado al agua.` };
  if(arqueologiaBloquea(celda))
    return { ok: false, motivo: 'Yacimiento arqueológico: no se puede tocar. Hay que rodearlo.' };
  if(def.lejosDeAgua && hayAguaCerca(celdas, col, fila, def.lejosDeAgua))
    return { ok: false, motivo: 'Hay agua cerca: sale mucho más barato captarla que perforar.' };

  // Jugadas legales pero malas. Se deja hacer y se avisa: prohibirlas quita la
  // decisión, y un juego que no te deja equivocarte no tiene nada que decidir.
  if(def.avisaSiAguaCerca && hayAguaCerca(celdas, col, fila, def.avisaSiAguaCerca))
    return { ok: true, motivo: '', aviso: 'Hay agua a tiro: los lixiviados la envenenarán.' };

  return { ok: true, motivo: '' };
}

/* ================================================================
   TUBERÍAS — la ruta más barata, esquivando o pagando el terreno
   ================================================================ */

/**
 * La escala de una red. Las de tubería se miden en diámetros; la de residuos en
 * clases de vía. Es la misma mecánica —manda el tramo peor— pero llamar
 * "DN 63 de fibrocemento" a una carretera no tendría ningún sentido.
 */
export function escalaDeRed(red = 'abastecimiento'){
  const def = CONFIG.redes[red];
  return (def && def.tiers === 'viales') ? CONFIG.viales.clases : CONFIG.tuberia.diametros;
}

/** El calibre `id` de esa red, o el más bajo si no consta (red heredada). */
export function diametro(id, red = 'abastecimiento'){
  const D = escalaDeRed(red);
  return D.find(d => d.id === id) || D[0];
}

/** Posición en la escala (0 = el más bajo). */
export function nivelDiametro(id, red = 'abastecimiento'){
  const i = escalaDeRed(red).findIndex(d => d.id === id);
  return i < 0 ? 0 : i;
}

/** Lo que cuesta atravesar una casilla con ese calibre. */
export function costeCasillaTuberia(celda, dn, red = 'abastecimiento'){
  const base = CONFIG.tuberia.costePorCasilla[celda.tipo] ?? 20;
  return Math.round(base * diametro(dn, red).costeRelativo);
}

/**
 * ¿Se puede prolongar el trazado hasta esta casilla? El jugador dibuja la
 * tubería a mano, casilla a casilla: aquí solo se comprueba que la jugada sea
 * legal. Devuelve { ok, motivo }.
 */
export function puedeSeguirTrazado(celdas, trazado, col, fila){
  const celda = celdaEn(celdas, col, fila);
  if(!celda) return { ok: false, motivo: 'Fuera del mapa.' };
  if(celda.oculta) return { ok: false, motivo: 'Por ahí no has explorado todavía.' };
  if(celda.protegida)
    return { ok: false, motivo: 'Zona protegida: ninguna red puede atravesarla. Rodéala.' };
  if(arqueologiaBloquea(celda))
    return { ok: false, motivo: 'Yacimiento arqueológico: no se puede atravesar. Rodéalo.' };
  if(!trazado.length) return { ok: true, motivo: '' };

  if(trazado.some(p => p.col === col && p.fila === fila))
    return { ok: false, motivo: 'La tubería ya pasa por ahí.' };

  const ultimo = trazado[trazado.length - 1];
  const salto = Math.abs(ultimo.col - col) + Math.abs(ultimo.fila - fila);
  if(salto !== 1) return { ok: false, motivo: 'Tiene que ser una casilla contigua.' };
  return { ok: true, motivo: '' };
}

/** Lo que cuesta un trazado completo, sumando la obra de cada casilla. */
export function costeTrazado(celdas, trazado, dn, red = 'abastecimiento'){
  let total = 0;
  for(const p of trazado){
    const celda = celdaEn(celdas, p.col, p.fila);
    if(celda) total += costeCasillaTuberia(celda, dn, red);
  }
  return total;
}

/**
 * Lo que cuesta cambiarle el diámetro a una línea ya tendida. La zanja ya está
 * abierta y el material viejo se vende, así que sale más barato que tenderla de
 * cero — pero renovar sigue siendo una inversión, no un botón.
 */
export function costeRenovar(celdas, tuberia, dn, red = 'abastecimiento'){
  const bruto = costeTrazado(celdas, tuberia.camino, dn, red);
  return Math.round(bruto * (1 - CONFIG.tuberia.valorRecuperado));
}

/* ================================================================
   LA RED — qué está de verdad conectado al pueblo
   ================================================================ */

/** La red de una tubería. Las de antes de existir el saneamiento son de agua. */
export function redDe(tuberia){ return tuberia.red || 'abastecimiento'; }

/**
 * Recorrido en anchura desde la casilla del pueblo por las tuberías de UNA red.
 * Devuelve el conjunto de casillas alcanzadas.
 *
 * Las redes no se mezclan a propósito: un colector que pasa por encima de una
 * captación no la conecta a nada. Son dos instalaciones distintas que da la
 * casualidad de que cruzan el mismo campo.
 */
function alcanzadasPorLaRed(estado, red = 'abastecimiento'){
  const M = CONFIG.mapaMundo;
  const clave = (c, f) => f * M.cols + c;

  // Casillas por las que pasa alguna tubería DE ESTA RED
  const conTuberia = new Set();
  for(const tub of estado.tuberias){
    if(redDe(tub) !== red) continue;
    for(const p of tub.camino) conTuberia.add(clave(p.col, p.fila));
  }

  // La red arranca de TODOS los pueblos incorporados, no solo del origen: es
  // una red mancomunada de verdad, y una línea tendida desde el tercer pueblo
  // vale exactamente igual que una tendida desde el primero.
  const visitadas = new Set();
  const cola = [];
  for(const p of (estado.pueblos || [])){
    if(p.col == null) continue;
    const k = clave(p.col, p.fila);
    if(!visitadas.has(k)){ visitadas.add(k); cola.push(k); }
  }
  if(!cola.length){
    cola.push(clave(M.origen.col, M.origen.fila));
    visitadas.add(cola[0]);
  }
  while(cola.length){
    const k = cola.shift();
    const c = k % M.cols, f = Math.floor(k / M.cols);
    for(const [dc, df] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nc = c + dc, nf = f + df;
      if(nc < 0 || nf < 0 || nc >= M.cols || nf >= M.filas) continue;
      const kv = clave(nc, nf);
      if(visitadas.has(kv) || !conTuberia.has(kv)) continue;
      visitadas.add(kv); cola.push(kv);
    }
  }
  return visitadas;
}

/**
 * Devuelve el conjunto de construcciones ENGANCHADAS al pueblo por tubería.
 * Una pieza suelta en mitad del campo no sirve de nada: hay que llevarle el
 * agua. Es lo que convierte el trazado en una decisión y no en un adorno.
 */
export function construccionesConectadas(estado, red = 'abastecimiento'){
  const visitadas = alcanzadasPorLaRed(estado, red);
  const suyas = CONFIG.redes[red].piezas;
  // Cada red solo cuenta lo suyo: una depuradora no la conecta la tubería de
  // agua potable, por muy encima que le pase. Y una pieza averiada no cuenta
  // aunque esté perfectamente conectada: está parada.
  return estado.construcciones.filter(
    o => suyas.includes(o.tipo) && !averiaEn(estado, o.col, o.fila)
      && pegadaA(visitadas, o.col, o.fila));
}

/** La definición del tipo de yacimiento de una celda (poblado, fósiles...). */
export function tipoYacimiento(celda){
  const T = CONFIG.arqueologia.tipos;
  return T.find(t => t.id === celda.arqueologia) || T[0];
}

/** La avería que hay en esa casilla, si la hay. */
export function averiaEn(estado, col, fila){
  return (estado.averias || []).find(a => a.col === col && a.fila === fila) || null;
}

/**
 * ¿Está esta casilla SOBRE la red o PEGADA a ella? Exigir que la tubería pasara
 * justo por encima era una trampa: llevabas la conducción hasta la puerta del
 * pueblo, se veía conectada, y el juego decía que no. Con acometida lateral se
 * comporta como uno espera.
 */
function pegadaA(visitadas, c, f){
  const M = CONFIG.mapaMundo;
  const clave = (cc, ff) => ff * M.cols + cc;
  if(visitadas.has(clave(c, f))) return true;
  for(const [dc, df] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nc = c + dc, nf = f + df;
    if(nc < 0 || nf < 0 || nc >= M.cols || nf >= M.filas) continue;
    if(visitadas.has(clave(nc, nf))) return true;
  }
  return false;
}

/** ¿Llega alguna tubería de esa red hasta esta casilla? (o hasta su lado) */
export function casillaEnRed(estado, col, fila, red = 'abastecimiento'){
  return pegadaA(alcanzadasPorLaRed(estado, red), col, fila);
}

/**
 * Las líneas que forman de verdad la conducción del pueblo: las que tocan la
 * red que sale de él. Una tubería tirada en la otra punta del mapa no estrangula
 * nada, así que no debe contar para el cuello de botella.
 * Devuelve [{ tuberia, indice }].
 */
export function lineasConectadas(estado, red = 'abastecimiento'){
  const M = CONFIG.mapaMundo;
  const clave = (c, f) => f * M.cols + c;
  const visitadas = alcanzadasPorLaRed(estado, red);
  const salida = [];
  estado.tuberias.forEach((tuberia, indice) => {
    if(redDe(tuberia) !== red) return;
    if(tuberia.camino.some(p => visitadas.has(clave(p.col, p.fila))))
      salida.push({ tuberia, indice });
  });
  return salida;
}

/* ---------- LA EDAD DE LAS LÍNEAS ----------
   Las redes de verdad tienen vida útil: pasada, no revientan — fugan cada año
   más. `nacida` (en horas de juego) se sella al tender y al renovar; una línea
   sin fecha (partidas viejas, el bot) no envejece hasta que la renueven. */

/** La edad de una línea en años de juego, o 0 si no consta cuándo se tendió. */
export function edadAños(tuberia, horas){
  if(tuberia.nacida === undefined) return 0;
  return Math.max(0, (horas - tuberia.nacida) / CONFIG.tiempo.horasPorAño);
}

/**
 * Las fugas REALES de una línea: las de su material más lo que le añade la
 * vejez, con techo. Es la única cuenta de fugas por línea — el desglose y el
 * rendimiento de la red beben de aquí.
 */
export function fugasDe(tuberia, horas, red = 'abastecimiento'){
  const def = diametro(tuberia.dn, red);
  if(!def.vidaAños) return def.fugas || 0;
  const E = CONFIG.tuberia.envejecimiento;
  const exceso = Math.max(0, edadAños(tuberia, horas) - def.vidaAños);
  return (def.fugas || 0) + Math.min(E.fugasExtraMax, exceso * E.fugasPorAño);
}

/**
 * EL CUELLO DE BOTELLA: por una línea cabe lo que quepa por su tramo más
 * estrecho, y punto. Es lo que obliga a renovar la conducción ENTERA en vez de
 * parchear un trozo, y lo que hace que crecer duela.
 *
 * Sin ninguna línea conectada se supone la red heredada (el diámetro más
 * estrecho): el pueblo siempre ha bebido de algo.
 * Devuelve { dn, def, lineas, estrechas }.
 */
export function cuelloDeBotella(estado, red = 'abastecimiento'){
  const D = escalaDeRed(red);
  const lineas = lineasConectadas(estado, red);
  if(!lineas.length) return { dn: D[0].id, def: D[0], lineas: [], estrechas: 0 };

  let peor = Infinity;
  for(const { tuberia } of lineas) peor = Math.min(peor, nivelDiametro(tuberia.dn, red));
  const def = D[peor];
  const estrechas = lineas.filter(l => nivelDiametro(l.tuberia.dn, red) === peor).length;
  return { dn: def.id, def, lineas, estrechas };
}

/**
 * Cuenta por tipo lo que hay conectado: { captacion: 2, deposito: 1, ... }
 * OJO: suma NIVELES, no unidades — una pieza ampliada a nivel 3 cuenta como
 * tres. Así todas las fórmulas de aporte (capacidad, caudal, tratamiento)
 * recogen la ampliación sin tocarlas una a una.
 */
export function inventarioConectado(estado, red = 'abastecimiento'){
  const cuenta = {};
  for(const o of construccionesConectadas(estado, red))
    cuenta[o.tipo] = (cuenta[o.tipo] || 0) + (o.nivel || 1);
  return cuenta;
}

/** El nombre propio de una obra ("Depósito 2"), o el genérico si no lo tiene. */
export function nombreDeObra(obra){
  return obra.nombre || CONFIG.construibles[obra.tipo].nombre;
}

/**
 * Bautiza una obra nueva: el nombre del tipo y su número ("Bombeo 3"). La
 * primera de cada tipo va sin número — mientras solo hay una, el apellido
 * sobra. El número sale del MAYOR ya usado, no de contar las vivas: con el
 * derribo, contar habría repetido nombres (derribas "Depósito", construyes, y
 * el nuevo salía "Depósito 2" habiendo ya un "Depósito 2").
 */
export function bautizarObra(construcciones, tipo){
  const base = CONFIG.construibles[tipo].nombre;
  let mayor = 0;
  for(const o of construcciones){
    if(o.tipo !== tipo) continue;
    const num = (o.nombre || '').match(/(\d+)$/);
    mayor = Math.max(mayor, num ? +num[1] : 1);
  }
  return mayor === 0 ? base : `${base} ${mayor + 1}`;
}

/** Las líneas que PASAN por una casilla, con su índice real en estado.tuberias. */
export function lineasEnCasilla(estado, col, fila){
  const salida = [];
  estado.tuberias.forEach((tuberia, indice) => {
    if(tuberia.camino.some(p => p.col === col && p.fila === fila))
      salida.push({ tuberia, indice });
  });
  return salida;
}

/* ---------- persistencia compacta ----------
   El terreno se regenera de la semilla, así que solo hace falta guardar lo que
   el jugador ha tocado: qué está descubierto, qué lleva progreso y qué
   hallazgos ya ha resuelto. */

export function comprimir(celdas){
  const abiertas = [], progresos = [], resueltos = [], insalubres = [];
  const aflorados = [], excavados = [], estudiadas = [], sondeos = [];
  recorrer(celdas, (celda, c, f) => {
    const i = f * CONFIG.mapaMundo.cols + c;
    if(!celda.oculta) abiertas.push(i);
    else if(celda.progreso > 0) progresos.push([i, celda.progreso]);
    if(celda.resuelto) resueltos.push(i);
    // El agua envenenada por los lixiviados hay que guardarla: es daño que se
    // queda, y regenerar el terreno de la semilla lo borraría.
    if(celda.insalubre > 0) insalubres.push([i, +celda.insalubre.toFixed(3)]);
    // Los yacimientos se regeneran de la semilla, pero SI han aflorado o se han
    // excavado eso es cosa del jugador y hay que guardarlo.
    if(celda.aflorado) aflorados.push(i);
    if(celda.excavado) excavados.push(i);
    // El agua subterránea se regenera de la semilla, pero lo que has PAGADO por
    // saber —el estudio y cada perforación— es tuyo y no se puede olvidar.
    if(celda.estudiada) estudiadas.push(i);
    if(celda.sondeo) sondeos.push([i, celda.sondeo === 'positivo' ? 1 : 0]);
  });
  return { abiertas, progresos, resueltos, insalubres, aflorados, excavados,
           estudiadas, sondeos };
}

/** La pieza que esconde una ruina, ya resuelta o no. */
export function piezaDeRuina(celda){ return celda?.pieza || 'bomba'; }

export function aplicarGuardado(celdas, datos){
  if(!datos) return;
  for(const i of datos.abiertas || []) if(celdas[i]) celdas[i].oculta = false;
  for(const [i, p] of datos.progresos || []) if(celdas[i]) celdas[i].progreso = p;
  for(const i of datos.resueltos || []) if(celdas[i]) celdas[i].resuelto = true;
  for(const [i, v] of datos.insalubres || []) if(celdas[i]) celdas[i].insalubre = v;
  for(const i of datos.aflorados || []) if(celdas[i]) celdas[i].aflorado = true;
  for(const i of datos.excavados || []) if(celdas[i]) celdas[i].excavado = true;
  for(const i of datos.estudiadas || []) if(celdas[i]) celdas[i].estudiada = true;
  for(const [i, v] of datos.sondeos || [])
    if(celdas[i]) celdas[i].sondeo = v ? 'positivo' : 'seco';
}
