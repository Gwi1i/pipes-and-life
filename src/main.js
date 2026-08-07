/**
 * MAIN — punto de entrada.
 *
 * Este archivo no sabe dibujar, ni calcular presiones, ni generar terreno.
 * Su único trabajo es crear las piezas, conectarlas y hacer girar el bucle.
 * Si algo falla, aquí es donde se ve qué módulo tiene la culpa.
 *
 * Bucle:  entrada → acciones → solver → economía → render
 */

import { CONFIG } from './config.js';
import { Terreno } from './terreno.js';
import { Camara } from './camara.js';
import { Grafo } from './grafo.js';
import { Render } from './render.js';
import { Entrada } from './entrada.js';
import { Estado } from './estado.js';
import { UI } from './ui.js';
import { resolver, costeTramo } from './hidraulica.js';
import { generadorAleatorio, formatear } from './util.js';

/* ==================================================================
   ARRANQUE
   ================================================================== */

const lienzo = document.getElementById('lienzo');
const terreno = new Terreno();
const camara  = new Camara(lienzo);
const entrada = new Entrada(lienzo, camara);
const estado  = new Estado();
const ui      = new UI(entrada);
const render  = new Render(lienzo, camara, terreno);

let grafo = Estado.cargar(estado) || new Grafo();
let recalcular = true;

function ajustarLienzo(){
  const dpr = window.devicePixelRatio || 1;
  const caja = lienzo.parentElement.getBoundingClientRect();
  lienzo.width  = Math.round(caja.width  * dpr);
  lienzo.height = Math.round(caja.height * dpr);
  lienzo.style.width  = caja.width + 'px';
  lienzo.style.height = caja.height + 'px';
}
window.addEventListener('resize', ajustarLienzo);
ajustarLienzo();

// El terreno se dibuja UNA vez a un lienzo aparte. Tarda unos ms, así
// que se hace aquí y no en el bucle.
terreno.dibujarCapa();

// Si es partida nueva, sembrar las poblaciones sobre el mapa
if(grafo.nodos.size === 0){
  sembrarPoblaciones();
  estado.anotar('Nueva concesión. Cuatro núcleos por abastecer.');
}

camara.encuadrarTodo();
ui.refrescarBarra();
ui.mostrarNodo(null, grafo);

function sembrarPoblaciones(){
  const azar = generadorAleatorio(CONFIG.mundo.semilla + 999);
  const colocados = [];   // se va pasando para exigir separación mínima

  for(const p of CONFIG.poblaciones){
    const punto = terreno.buscarPunto(p.preferirCota, azar, colocados);
    colocados.push(punto);

    const demanda = p.habitantes * CONFIG.litrosHabitanteDia / 86400;  // L/s medio
    grafo.agregarNodo('poblacion', punto.x, punto.y, punto.cota, {
      nombre: p.nombre,
      habitantes: p.habitantes,
      demanda: demanda * 1.6      // punta horaria
    });
  }
}

/* ==================================================================
   ACCIONES — traducción de intenciones a cambios en el grafo
   ================================================================== */

function procesarAcciones(){
  for(const a of entrada.vaciarAcciones()){
    switch(a.tipo){

      case 'consultarNodo': {
        const n = grafo.nodoEn(entrada.mundoX, entrada.mundoY, 24 / camara.zoom);
        entrada.nodoBajoCursor = n ? n.id : null;
        break;
      }

      case 'seleccionar': {
        const n = grafo.nodoEn(a.x, a.y, 24 / camara.zoom);
        entrada.seleccionado = n ? n.id : null;
        ui.mostrarNodo(n, grafo);
        break;
      }

      case 'colocar': {
        const def = CONFIG.elementos[a.elemento];

        // Una captación solo tiene sentido donde hay agua. Es la
        // restricción que da al mapa su primera pregunta: ¿de dónde saco?
        let extra = {};
        if(a.elemento === 'captacion'){
          const fuente = terreno.fuenteEn(a.x, a.y, 110);
          if(!fuente){
            avisar('Aquí no hay agua. Coloca la captación sobre un cauce azul o en un manantial.');
            break;
          }
          extra = { fuente: fuente.tipo, caudalDisponible: fuente.caudal,
                    nombre: fuente.nombre };
        }

        if(!estado.puedePagar(def.coste)){
          avisar(`Sin fondos: ${def.nombre} cuesta ${formatear(def.coste)} €.`);
          break;
        }
        if(grafo.nodoEn(a.x, a.y, 32)){
          avisar('Demasiado cerca de otro elemento.');
          break;
        }

        estado.pagar(def.coste);
        const cota = terreno.cotaEn(a.x, a.y);
        const n = grafo.agregarNodo(a.elemento, a.x, a.y, cota, extra);
        estado.anotar(a.elemento === 'captacion'
          ? `Captación en ${extra.nombre.toLowerCase()} · ${extra.caudalDisponible.toFixed(1)} L/s a cota ${cota.toFixed(0)} m.`
          : `${def.nombre} construido a cota ${cota.toFixed(0)} m.`);
        entrada.seleccionado = n.id;
        ui.mostrarNodo(n, grafo);
        recalcular = true;
        break;
      }

      case 'clicTuberia': {
        const n = grafo.nodoEn(a.x, a.y, 26 / camara.zoom);
        if(!n){
          // Clic en vacío: crear un nudo intermedio si ya hay origen
          if(entrada.origenTuberia !== null){
            const def = CONFIG.elementos.nudo;
            if(!estado.puedePagar(def.coste)) break;
            estado.pagar(def.coste);
            const nuevo = grafo.agregarNodo('nudo', a.x, a.y, terreno.cotaEn(a.x, a.y));
            tenderTramo(entrada.origenTuberia, nuevo.id);
            entrada.origenTuberia = nuevo.id;   // encadenar
          }
          break;
        }
        if(entrada.origenTuberia === null){
          entrada.origenTuberia = n.id;
        } else if(entrada.origenTuberia !== n.id){
          tenderTramo(entrada.origenTuberia, n.id);
          entrada.origenTuberia = n.id;         // seguir encadenando
        }
        break;
      }

      case 'borrarEn': {
        const n = grafo.nodoEn(a.x, a.y, 24 / camara.zoom);
        if(n){
          if(n.tipo === 'poblacion'){
            avisar('Las poblaciones no se pueden demoler.');
            break;
          }
          grafo.eliminarNodo(n.id);
          if(entrada.seleccionado === n.id){ entrada.seleccionado = null; ui.mostrarNodo(null, grafo); }
          recalcular = true;
          break;
        }
        const ar = grafo.aristaEn(a.x, a.y, 14 / camara.zoom);
        if(ar){ grafo.eliminarArista(ar.id); recalcular = true; }
        break;
      }

      case 'borrarNodo': {
        const n = grafo.nodos.get(a.id);
        if(n && n.tipo !== 'poblacion'){
          grafo.eliminarNodo(a.id);
          entrada.seleccionado = null;
          ui.mostrarNodo(null, grafo);
          recalcular = true;
        }
        break;
      }

      case 'instalarBombeo': {
        const n = grafo.nodos.get(a.id);
        if(!n || n.tipo === 'poblacion') break;
        const coste = CONFIG.elementos.bombeo.coste * Math.pow(1.7, n.bombeos);
        if(!estado.puedePagar(coste)){
          avisar(`Sin fondos: el grupo cuesta ${formatear(coste)} €.`);
          break;
        }
        estado.pagar(coste);
        n.bombeos++;
        estado.anotar(`Grupo de impulsión instalado en ${n.nombre || 'nudo #' + n.id}. ` +
                      `Ahora eleva ${CONFIG.elementos.bombeo.alturaManometrica * n.bombeos} m.`);
        ui.mostrarNodo(n, grafo);
        recalcular = true;
        break;
      }

      case 'cambioHerramienta':
        ui.refrescarBarra();
        break;

      case 'cambioDiametro':
        ui.refrescarDiametros();
        break;
    }
  }
}

/**
 * Aviso visible en pantalla. Antes esto solo iba al registro lateral y
 * el jugador no se enteraba de por qué no pasaba nada al hacer clic.
 */
let tempAviso = null;
function avisar(texto){
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.classList.add('visible');
  clearTimeout(tempAviso);
  tempAviso = setTimeout(() => el.classList.remove('visible'), 3200);
  estado.anotar(texto, 'alarma');
}

function tenderTramo(idA, idB){
  const a = grafo.nodos.get(idA), b = grafo.nodos.get(idB);
  if(!a || !b) return;
  if(grafo.existeArista(idA, idB)){
    avisar('Ya existe un tramo entre esos puntos.');
    return;
  }
  const longitud = Math.hypot(b.x - a.x, b.y - a.y);
  const desnivel = Math.abs(b.cota - a.cota);
  const coste = costeTramo(longitud, desnivel, entrada.diametroActivo);

  if(!estado.puedePagar(coste)){
    avisar(`Sin fondos: el tramo cuesta ${formatear(coste)} €.`);
    return;
  }
  estado.pagar(coste);
  grafo.agregarArista(idA, idB, entrada.diametroActivo);
  estado.anotar(`Tramo de ${longitud.toFixed(0)} m tendido por ${formatear(coste)} €.`);
  recalcular = true;
}

/* ==================================================================
   VIDA DE LA RED — lo que hace que la partida no se acabe
   ================================================================== */

let acumDinamica = 0;

/**
 * Crecimiento de poblaciones y averías de tuberías.
 * Se evalúa cada pocos segundos, no en cada fotograma: son procesos
 * lentos y calcularlos 60 veces por segundo no aporta nada.
 */
function avanzarDinamica(horas){
  const C = CONFIG.crecimiento, A = CONFIG.averias;
  const años = horas / CONFIG.estiaje.horasPorAño;

  // --- Crecimiento / despoblación ---
  for(const p of grafo.porTipo('poblacion')){
    const tasa = p.abastecido ? C.tasaAnualBien : C.tasaAnualMal;
    const antes = Math.floor(p.habitantes);
    p.habitantes = Math.max(60, Math.min(C.habitantesMax,
                            p.habitantes * (1 + tasa * años)));
    p.demanda = p.habitantes * CONFIG.litrosHabitanteDia / 86400;

    const ahora = Math.floor(p.habitantes);
    // Avisar solo al cruzar cada millar, para no llenar el registro
    if(Math.floor(ahora / 500) !== Math.floor(antes / 500)){
      estado.anotar(ahora > antes
        ? `${p.nombre} crece: ${ahora} habitantes. Revisa si la red aguanta.`
        : `${p.nombre} pierde población: ${ahora} habitantes.`,
        ahora > antes ? 'info' : 'alarma');
      recalcular = true;
    }
  }

  // --- Averías ---
  for(const ar of grafo.aristas.values()){
    if(ar.rota) continue;
    ar.horasServicio += horas;

    const a = grafo.nodos.get(ar.a), b = grafo.nodos.get(ar.b);
    const presionMax = Math.max(a?.presion || 0, b?.presion || 0);

    let riesgo = A.probBase * horas;
    riesgo *= 1 + (ar.horasServicio / 1000) * A.factorAntiguedad;
    if(presionMax > CONFIG.hidraulica.presionMaxima){
      // La sobrepresión dispara la rotura: por fin tiene consecuencias
      const exceso = presionMax / CONFIG.hidraulica.presionMaxima;
      riesgo *= A.factorSobrepresion * exceso;
    }
    if(ar.activa) riesgo *= 1.4;   // un tramo en carga sufre más

    if(Math.random() < riesgo){
      ar.rota = true;
      recalcular = true;
      const motivo = presionMax > CONFIG.hidraulica.presionMaxima
        ? 'por sobrepresión' : 'por fatiga del material';
      avisar(`¡Rotura ${motivo} en un tramo de ${ar.longitud.toFixed(0)} m!`);
    }
  }
}

/** Repara todos los tramos rotos, si hay dinero. */
function repararTodo(){
  const rotos = [...grafo.aristas.values()].filter(a => a.rota);
  if(!rotos.length){ avisar('No hay ningún tramo averiado.'); return; }
  const coste = rotos.reduce((s, a) => s + a.longitud * CONFIG.averias.costeReparacion, 0);
  if(!estado.puedePagar(coste)){
    avisar(`La reparación cuesta ${formatear(coste)} € y no hay fondos.`);
    return;
  }
  estado.pagar(coste);
  rotos.forEach(a => { a.rota = false; a.horasServicio *= 0.4; });
  estado.anotar(`${rotos.length} tramo(s) reparados por ${formatear(coste)} €.`);
  recalcular = true;
}

/* ==================================================================
   SERVICIO DE CUBAS — la parte manual
   Mientras un núcleo no tenga red, se le puede llevar agua en camión.
   Da poco y hay que pulsar: es exactamente el motivo para construir la
   red. Cuando todos están conectados, deja de tener sentido.
   ================================================================== */

function nucleosSinRed(){
  return grafo.porTipo('poblacion').filter(p => !p.abastecido).length;
}

function servirCuba(ev){
  const sinRed = nucleosSinRed();
  const btn = document.getElementById('btn-cubas');

  if(sinRed === 0){
    avisar('Todos los núcleos tienen red. El camión ya no hace falta.');
    return;
  }

  const c = CONFIG.cubas;
  const neto = c.m3PorViaje * c.tarifa - c.costeViaje;
  estado.dinero += neto;
  estado.m3Servidos += c.m3PorViaje;

  // Retorno visual: importe flotando desde donde se pulsa
  const caja = btn.getBoundingClientRect();
  const f = document.createElement('span');
  f.className = 'flotante';
  f.textContent = '+' + neto.toFixed(2) + ' €';
  f.style.left = ((ev.clientX ?? caja.left + caja.width / 2) - caja.left) + 'px';
  f.style.top  = ((ev.clientY ?? caja.top + caja.height / 2) - caja.top) + 'px';
  btn.appendChild(f);
  setTimeout(() => f.remove(), 950);

  btn.classList.remove('pulsado'); void btn.offsetWidth; btn.classList.add('pulsado');
}

function actualizarBotonCubas(){
  const sinRed = nucleosSinRed();
  const btn = document.getElementById('btn-cubas');
  const c = CONFIG.cubas;
  const neto = c.m3PorViaje * c.tarifa - c.costeViaje;
  btn.classList.toggle('agotado', sinRed === 0);
  document.getElementById('cubas-texto').textContent = sinRed === 0
    ? 'Toda la red abastecida'
    : `Servir cuba  ·  +${neto.toFixed(2)} €`;
  document.getElementById('cubas-sub').textContent = sinRed === 0
    ? 'El camión ya no hace falta'
    : `${sinRed} núcleo${sinRed > 1 ? 's' : ''} sin red · ${c.m3PorViaje} m³ por viaje`;
}

/* ==================================================================
   BUCLE PRINCIPAL
   ================================================================== */

let ultimo = performance.now();
let acumGuardado = 0;
let acumHUD = 0;

function bucle(ahora){
  const dt = Math.min((ahora - ultimo) / 1000, 0.1);
  ultimo = ahora;

  camara.actualizar(dt);
  procesarAcciones();

  // El solver solo se ejecuta cuando la red ha cambiado. Recalcular una
  // red de cien nudos 60 veces por segundo sería absurdo: la topología
  // no cambia entre fotogramas.
  if(recalcular){
    estado.resultado = resolver(grafo, estado.horas);
    ui.actualizarIncidencias(estado.resultado.incidencias);
    recalcular = false;
    if(entrada.seleccionado !== null){
      ui.mostrarNodo(grafo.nodos.get(entrada.seleccionado), grafo);
    }
  }

  estado.avanzar(dt * CONFIG.economia.segundosPorHora);

  acumDinamica += dt;
  if(acumDinamica > 2){ avanzarDinamica(acumDinamica * CONFIG.economia.segundosPorHora);
                        acumDinamica = 0; recalcular = true; }

  acumHUD += dt;
  if(acumHUD > 0.15){ acumHUD = 0; ui.actualizarHUD(estado, grafo); actualizarBotonCubas();
                      ui.actualizarAverias(grafo); }

  acumGuardado += dt;
  if(acumGuardado > CONFIG.guardado.intervaloSegundos){
    acumGuardado = 0;
    estado.guardar(grafo);
  }

  render.dibujar(grafo, estado, entrada, dt);
  requestAnimationFrame(bucle);
}

/* ==================================================================
   BOTONES GENERALES
   ================================================================== */

document.getElementById('btn-cubas').addEventListener('click', servirCuba);
document.getElementById('btn-reparar').addEventListener('click', repararTodo);

// Delegación para el botón de instalar bombeo, que se recrea con el panel
document.getElementById('detalle').addEventListener('click', e => {
  const b = e.target.closest('[data-instalar]');
  if(b) entrada.emitir('instalarBombeo', { id: parseInt(b.dataset.instalar, 10) });
});

document.getElementById('btn-encuadrar').onclick = () => camara.encuadrarTodo();
document.getElementById('btn-guardar').onclick = () => {
  const ok = estado.guardar(grafo);
  estado.anotar(ok ? 'Partida guardada.' : 'No se pudo guardar (almacenamiento no disponible).',
                ok ? 'info' : 'alarma');
  ui.actualizarIncidencias(estado.resultado.incidencias);
};
document.getElementById('btn-reiniciar').onclick = () => {
  if(!confirm('¿Empezar una concesión nueva? Se perderá todo lo construido.')) return;
  Estado.borrar();
  location.reload();
};

// Exponer para depurar desde la consola del navegador: escribe `juego`
// en las herramientas de desarrollo y podrás inspeccionarlo todo.
// `juego.recalcular()` fuerza una pasada del solver si tocas el grafo a mano.
window.juego = {
  grafo, estado, camara, terreno, entrada, CONFIG,
  recalcular: () => { recalcular = true; },
  dinero: n => { estado.dinero = n; }    // para probar sin construir la economía
};

requestAnimationFrame(bucle);
