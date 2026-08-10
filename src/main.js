/**
 * MAIN — punto de entrada.
 *
 * Crea las piezas, las conecta y hace girar el bucle. No dibuja ni calcula:
 * delega. Bucle:  entrada → acciones → simulación → economía → escena + ui
 */

import { CONFIG } from './config.js';
import { Estado } from './estado.js';
import { Entrada } from './entrada.js';
import { UI } from './ui.js';
import { Escena } from './escena.js';
import { EscenaSVG } from './escena_svg.js';
import { EscenaAssets } from './escena_assets.js';
import { EscenaTeselas } from './escena_teselas.js';
import { EscenaMapa } from './escena_mapa.js';
import { celdaEn, clicarCasilla, clicsParaDestapar, puedeColocar,
         puedeSeguirTrazado, costeTrazado, casillaEnRed,
         piezaDeRuina, diametro, nivelDiametro, costeRenovar,
         averiaEn } from './mapa.js';
import { avanzar, bombear, costeMejora, requisitosAutobomba, engrasar,
         poderExpansion, servicioActivo, costeAmpliarVertedero,
         capacidadVaso } from './simulacion.js';
import { formatear } from './util.js';
import { comprobar as comprobarGuia, saltar as saltarGuia } from './tutorial.js';

const lienzo  = document.getElementById('escena');
const estado  = new Estado();
const habiaPartida = Estado.cargar(estado);
const entrada = new Entrada(lienzo);
const ui      = new UI(entrada);

// Estilo visual: A (Canvas "falso 3D"), B (sprites SVG) o C (imágenes de IA en
// assets/). Se recuerda la elección; el botón de la barra superior cicla A→B→C.
// 'm' (el mapa) es la vista principal del juego; el resto quedan como estilos
// antiguos de la parcela, accesibles con el botón para comparar.
const ESTILOS = ['m', 'd', 'a', 'b', 'c'];
let estiloEscena = ESTILOS.includes(localStorage.getItem('rh_estilo')) ? localStorage.getItem('rh_estilo') : 'm';
function crearEscena(){
  if(estiloEscena === 'b') return new EscenaSVG(lienzo);
  if(estiloEscena === 'c') return new EscenaAssets(lienzo);
  if(estiloEscena === 'd') return new EscenaTeselas(lienzo);
  if(estiloEscena === 'm') return new EscenaMapa(lienzo);
  return new Escena(lienzo);
}
let escena = crearEscena();

if(!habiaPartida){
  estado.anotar(`Nueva mancomunidad. ${estado.activo.nombre} espera agua: dale a BOMBEAR.`, 'info');
} else {
  progresoOffline();
}
ui.reconstruirPestanas(estado);

// Población de referencia para avisar solo al cruzar centenas, por pueblo
let habPrev = estado.pueblos.map(p => Math.floor(p.habitantes));

/* ==================================================================
   ACCIONES
   ================================================================== */

function procesarAcciones(){
  for(const a of entrada.vaciarAcciones()){
    switch(a.tipo){

      case 'bombear': {
        bombear(estado.activo, estado);
        escena.destello(a.x, a.y);
        break;
      }

      /* --- EL MAPA: arrastrar para mirar, clicar para destapar --- */

      case 'arrastrar':
        if(escena instanceof EscenaMapa){
          estado.camara.x -= a.dx;
          estado.camara.y -= a.dy;
        }
        break;

      case 'senalar':
        if(escena instanceof EscenaMapa){
          escena.resaltada = escena.celdaEnPantalla(estado, a.x, a.y);
        }
        break;

      case 'zoom':
        if(escena instanceof EscenaMapa) escena.ampliar(estado, a.delta, a.x, a.y);
        break;

      /* --- MODO CONSTRUCCIÓN --- */

      case 'elegirConstruible': {
        const def = CONFIG.construibles[a.clave];
        if(!def) break;
        // volver a pulsar el mismo botón cancela
        estado.modo = estado.modo.elemento === a.clave
          ? { tipo: null, elemento: null, trazado: [] }
          : { tipo: 'colocar', elemento: a.clave, trazado: [] };
        ui.refrescarConstruccion(estado);
        break;
      }

      case 'modoTuberia':
        estado.modo = estado.modo.tipo === 'tuberia'
          ? { tipo: null, elemento: null, trazado: [] }
          : { tipo: 'tuberia', elemento: null, trazado: [] };
        ui.refrescarConstruccion(estado);
        break;

      /* --- DIÁMETROS: con qué se tiende y qué se renueva --- */

      case 'elegirRed': {
        const def = CONFIG.redes[a.clave];
        if(def && def.requiere && !servicioActivo(estado.activo, def.requiere)){
          avisar(`Esa red llega con el servicio de ${CONFIG.servicios[def.requiere].nombre.toLowerCase()}.`);
          break;
        }
        if(def){
          estado.redActual = a.clave;
          // Cambiar de red a media traza dejaría un trazado a medias con la red
          // equivocada: se descarta y se empieza de nuevo.
          if(estado.modo.tipo === 'tuberia') estado.modo.trazado = [];
          ui.invalidarCache();
        }
        break;
      }

      case 'elegirDiametro':
        // El calibre es POR RED: elegir doble calzada no debe cambiar el
        // diámetro con el que tiendes tuberías de agua.
        estado.dnActual[estado.redActual] = diametro(a.clave, estado.redActual).id;
        ui.invalidarCache();
        break;

      case 'renovarLinea': {
        const i = parseInt(a.clave, 10);
        const tub = estado.tuberias[i];
        if(!tub) break;
        const red = tub.red || 'abastecimiento';
        const destino = estado.dnActual[red];
        if(nivelDiametro(destino, red) <= nivelDiametro(tub.dn, red)){
          avisar('Elige arriba un calibre mayor que el que ya tiene.');
          break;
        }
        const coste = costeRenovar(estado.mapa, tub, destino, red);
        if(!estado.puedePagar(coste)){
          avisar(`Renovar esa línea cuesta ${formatear(coste)} € y no hay fondos.`);
          break;
        }
        estado.pagar(coste);
        const antes = diametro(tub.dn, red).nombre;
        tub.dn = destino;
        tub.coste = (tub.coste || 0) + coste;
        estado.anotar(`Línea renovada de ${antes} a ${diametro(destino, red).nombre} por ${formatear(coste)} €.`, 'ok');
        avisar(`Línea renovada a ${diametro(destino, red).nombre}.`);
        ui.invalidarCache();
        break;
      }

      case 'ampliarVertedero': {
        const sel = estado.seleccion;
        const obra = sel && estado.construcciones.find(
          o => o.col === sel.col && o.fila === sel.fila && o.tipo === 'vertedero');
        if(!obra) break;
        const V = CONFIG.residuos.vertedero;
        if((obra.nivel || 1) >= V.nivelMax){ avisar('Ese vaso ya no da más de sí.'); break; }
        const coste = costeAmpliarVertedero(obra);
        if(!estado.puedePagar(coste)){
          avisar(`Ampliar el vaso cuesta ${formatear(coste)} € y no hay fondos.`);
          break;
        }
        estado.pagar(coste);
        obra.nivel = (obra.nivel || 1) + 1;
        estado.anotar(`Vertedero ampliado a nivel ${obra.nivel}: ${formatear(capacidadVaso(obra))} t de capacidad.`, 'ok');
        ui.invalidarCache();
        break;
      }

      case 'saltarGuia':
        saltarGuia(estado);
        estado.anotar('Guía saltada. Suerte ahí fuera.', 'info');
        break;

      case 'cancelarModo':
        estado.modo = { tipo: null, elemento: null, trazado: [] };
        ui.refrescarConstruccion(estado);
        break;

      case 'clicEscena': {
        // En el mapa el clic explora; en las vistas de parcela, bombea.
        if(!(escena instanceof EscenaMapa)){
            bombear(estado.activo, estado);
          escena.destello(a.x, a.y);
          break;
        }
        const { col, fila } = escena.celdaEnPantalla(estado, a.x, a.y);
        const celda = celdaEn(estado.mapa, col, fila);
        if(!celda) break;

        // Con una herramienta activa, el clic construye en vez de explorar
        if(estado.modo.tipo === 'colocar'){ colocarElemento(col, fila); break; }
        if(estado.modo.tipo === 'tuberia'){ clicTuberia(col, fila); break; }

        // Lo roto manda: si hay una avería aquí, el clic la repara
        if(clicAveria(col, fila)){ escena.destello(a.x, a.y); break; }

        // Clicar una instalación tuya la selecciona para verla de cerca: es la
        // única forma de saber cómo va de lleno un vertedero.
        const obraAqui = estado.construcciones.find(o => o.col === col && o.fila === fila);
        if(obraAqui){ estado.seleccion = { col, fila }; break; }

        if(celda.oculta){
          const r = clicarCasilla(estado.mapa, col, fila, poderExpansion(estado));
          if(r === null){ avisar('Ahí no llegas todavía: abre primero una casilla de al lado.'); break; }
          escena.destello(a.x, a.y);
          if(r === 'descubierta') anunciarHallazgo(celda, col, fila);
        } else if(celda.hallazgo && !celda.resuelto){
          // Un hallazgo sin atender se selecciona: sus acciones salen en el panel
          estado.seleccion = { col, fila };
        } else {
          // Casilla ya abierta y sin nada que hacer: el clic sigue bombeando
          estado.seleccion = null;
          bombear(estado.activo, estado);
          escena.destello(a.x, a.y);
        }
        break;
      }

      /* --- HALLAZGOS: qué hacer con lo que encuentras --- */

      case 'repararRuina':     accionRuina(false); break;
      case 'desmontarRuina':   accionRuina(true);  break;

      case 'explotarYacimiento': {
        const celda = celdaSeleccionada();
        if(!celda || celda.hallazgo !== 'yacimiento' || celda.resuelto) break;
        const prima = CONFIG.hallazgos.primaYacimiento;
        celda.resuelto = true;
        estado.dinero += prima;
        estado.anotar(`Yacimiento explotado: ${formatear(prima)} € en materiales.`, 'ok');
        avisar(`+${formatear(prima)} € del yacimiento.`);
        estado.seleccion = null;
        break;
      }

      case 'abastecerPueblo': {
        const celda = celdaSeleccionada();
        if(!celda || celda.hallazgo !== 'pueblo' || celda.resuelto) break;
        const sel = estado.seleccion;
        if(!estaEnLaRed(sel.col, sel.fila)){
          avisar('Primero hay que llegar hasta él con una tubería.');
          break;
        }
        // Incorporarlo a la mancomunidad: abre el siguiente pueblo del config
        const nuevo = estado.pueblos.find(p => !p.desbloqueado);
        celda.resuelto = true;
        if(nuevo){
          nuevo.desbloqueado = true;
          estado.anotar(`${nuevo.nombre} entra en la mancomunidad: ya recibe agua.`, 'ok');
          avisar(`¡${nuevo.nombre} incorporado! Míralo en las pestañas.`);
          ui.reconstruirPestanas(estado);
        } else {
          estado.anotar('Pueblo abastecido.', 'ok');
        }
        estado.seleccion = null;
        break;
      }

      case 'colocarDeInventario': {
        const i = parseInt(a.clave, 10);
        const pieza = estado.inventario[i];
        if(!pieza) break;
        estado.modo = { tipo: 'colocar', elemento: pieza.tipo, trazado: [],
                        deInventario: i };
        ui.refrescarConstruccion(estado);
        break;
      }

      case 'mantener': {
        const bajo = engrasar(estado.activo);
        if(bajo > 0) escena.destelloMantenimiento();
        break;
      }

      case 'cambiarPueblo': {
        const i = parseInt(a.clave, 10);
        if(estado.pueblos[i] && estado.pueblos[i].desbloqueado){
          estado.puebloActivo = i;
          ui.reconstruirPestanas(estado);
          ui.invalidarCache();
        }
        break;
      }

      case 'mejorar': {
        const m = CONFIG.mejoras[a.clave];
        if(!m) break;
        const p = estado.activo;
        const nivel = p.mejoras[a.clave];
        if(nivel >= m.nivelMax){ avisar(`${m.nombre}: ya está al máximo.`); break; }
        const coste = costeMejora(a.clave, nivel);
        if(!estado.puedePagar(coste)){
          avisar(`Sin fondos: ${m.nombre.toLowerCase()} cuesta ${formatear(coste)} €.`);
          break;
        }
        estado.pagar(coste);
        p.mejoras[a.clave]++;
        estado.anotar(`${p.nombre} · ${m.nombre} nivel ${p.mejoras[a.clave]}.`, 'ok');
        if(a.clave === 'deposito'   && p.mejoras.deposito   === 1) escena.aparecerDeposito();
        if(a.clave === 'captacion'  && p.mejoras.captacion  === 1) escena.aparecerCaptacion();
        if(a.clave === 'depuradora' && p.mejoras.depuradora === 1) escena.aparecerDepuradora();
        break;
      }

      case 'activarAutobomba': {
        const p = estado.activo;
        if(p.autobombaActivo) break;
        const P = CONFIG.premium.autobomba;
        // GANCHO de monetización futura (P.desbloqueoExterno). De momento solo
        // se activa cumpliendo requisitos y pagando en el juego.
        if(!requisitosAutobomba(p).cumple){
          avisar('Este pueblo aún no cumple los requisitos para el auto-bombeo.');
          break;
        }
        if(!estado.puedePagar(P.coste)){
          avisar(`El auto-bombeo cuesta ${formatear(P.coste)} €.`);
          break;
        }
        estado.pagar(P.coste);
        p.autobombaActivo = true;
        estado.anotar(`¡Auto-bombeo activado en ${p.nombre}!`, 'ok');
        break;
      }

      // El panel ya no repara: lleva hasta la avería. Arreglarla es ir y clicar.
      case 'irAAveria': {
        const av = estado.averias[parseInt(a.clave, 10)] || estado.averias[0];
        if(!av) break;
        if(escena instanceof EscenaMapa) escena.centrarEn(estado, av.col, av.fila);
        estado.seleccion = { col: av.col, fila: av.fila };
        avisar('Ahí la tienes: clica encima hasta dejarla arreglada.');
        break;
      }

      case 'limpiarCauce':
        estado.contaminacion = Math.max(0, estado.contaminacion - CONFIG.cauce.limpiezaPorClic);
        escena.destelloCauce();
        break;
    }
  }
}

/* ==================================================================
   CONSTRUIR SOBRE EL MAPA
   ================================================================== */

function colocarElemento(col, fila){
  const clave = estado.modo.elemento;
  const def = CONFIG.construibles[clave];
  const veredicto = puedeColocar(estado.mapa, estado.construcciones, clave, col, fila);
  if(!veredicto.ok){ avisar(veredicto.motivo); return; }

  // Si viene del inventario ya está pagada: se rescató de una ruina
  const deInv = estado.modo.deInventario;
  if(deInv === false){
    if(!estado.puedePagar(def.coste)){
      avisar(`Sin fondos: ${def.nombre.toLowerCase()} cuesta ${formatear(def.coste)} €.`);
      return;
    }
    estado.pagar(def.coste);
    estado.anotar(`${def.nombre} construido por ${formatear(def.coste)} €.`, 'ok');
  } else {
    estado.inventario.splice(deInv, 1);
    estado.anotar(`${def.nombre} del almacén, colocado.`, 'ok');
    estado.modo = { tipo: null, elemento: null, trazado: [], deInventario: false };
  }
  estado.construcciones.push({ tipo: clave, col, fila });
  // Se queda la herramienta puesta: normalmente se colocan varias seguidas
  ui.refrescarConstruccion(estado);
}

/* ---------- hallazgos ---------- */

const celdaSeleccionada = () =>
  estado.seleccion ? celdaEn(estado.mapa, estado.seleccion.col, estado.seleccion.fila) : null;

/** ¿Esa casilla está enganchada a la red de tuberías del pueblo? */
function estaEnLaRed(col, fila){
  return casillaEnRed(estado, col, fila, 'abastecimiento');
}

/**
 * Una instalación abandonada: se puede poner en marcha donde está (más barato)
 * o desmontarla y guardarla para levantarla donde interese (más cara, porque
 * hay que trasladarla).
 */
function accionRuina(desmontar){
  const celda = celdaSeleccionada();
  if(!celda || celda.hallazgo !== 'ruina' || celda.resuelto) return;
  const sel = estado.seleccion;
  const tipo = piezaDeRuina(celda);
  const def = CONFIG.construibles[tipo];
  const H = CONFIG.hallazgos;
  const coste = Math.round(def.coste * (desmontar ? H.costeDesmontar : H.costeReparar));

  if(!estado.puedePagar(coste)){ avisar(`Hacen falta ${formatear(coste)} €.`); return; }

  if(!desmontar){
    // Reparar en el sitio exige que el terreno le sirva a esa pieza
    const v = puedeColocar(estado.mapa, estado.construcciones, tipo, sel.col, sel.fila);
    if(!v.ok){
      avisar(`No se puede poner en marcha aquí: ${v.motivo} Prueba a desmontarla.`);
      return;
    }
    estado.pagar(coste);
    estado.construcciones.push({ tipo, col: sel.col, fila: sel.fila });
    estado.anotar(`${def.nombre} recuperado y puesto en marcha por ${formatear(coste)} €.`, 'ok');
  } else {
    estado.pagar(coste);
    estado.inventario.push({ tipo });
    estado.anotar(`${def.nombre} desmontado y guardado en el almacén.`, 'ok');
  }
  celda.resuelto = true;
  estado.seleccion = null;
}

/**
 * Tender tubería A MANO: el jugador va marcando casilla a casilla por dónde
 * quiere que pase. No se calcula ninguna ruta automática a propósito — decidir
 * el trazado, y si compensa rodear un bosque o pagar por atravesarlo, ES el
 * juego.
 *
 * Reglas de la herramienta:
 *   · clic en una casilla contigua      → prolonga el trazado
 *   · clic en la ÚLTIMA casilla puesta  → termina y paga
 *   · clic en la anterior               → deshace el último tramo
 *   · Esc                               → cancela entero
 */
function clicTuberia(col, fila){
  const trazado = estado.modo.trazado;

  if(trazado.length){
    const ultimo = trazado[trazado.length - 1];
    if(ultimo.col === col && ultimo.fila === fila){ rematarTuberia(); return; }
    const penultimo = trazado[trazado.length - 2];
    if(penultimo && penultimo.col === col && penultimo.fila === fila){
      trazado.pop();   // deshacer
      return;
    }
  }

  const v = puedeSeguirTrazado(estado.mapa, trazado, col, fila);
  if(!v.ok){ avisar(v.motivo); return; }
  trazado.push({ col, fila });
}

function rematarTuberia(){
  const trazado = estado.modo.trazado;
  if(trazado.length < 2){ avisar('Una tubería necesita al menos dos casillas.'); return; }
  const red = estado.redActual, dn = estado.dnActual[red];
  const coste = costeTrazado(estado.mapa, trazado, dn, red);
  if(!estado.puedePagar(coste)){
    avisar(`Ese trazado cuesta ${formatear(coste)} € y no hay fondos.`);
    return;
  }
  estado.pagar(coste);
  estado.tuberias.push({ camino: trazado.slice(), coste, dn, red });
  estado.anotar(`${CONFIG.redes[red].nombre}: ${diametro(dn, red).nombre} de ` +
                `${trazado.length} casillas por ${formatear(coste)} €.`, 'ok');
  estado.modo.trazado = [];
}

/**
 * Al destapar una casilla se cuenta lo que había. Los hallazgos son el motivo
 * de explorar: sin esto, ampliar terreno sería solo gastar clics.
 */
function anunciarHallazgo(celda, col, fila){
  estado.descubiertas++;
  if(!celda.hallazgo) return;
  const textos = {
    pueblo:     `¡Un pueblo sin abastecer! Está a ${Math.round(distancia(col, fila))} casillas.`,
    ruina:      'Instalación abandonada. Se podrá reparar o llevar al inventario.',
    yacimiento: 'Yacimiento localizado.'
  };
  estado.anotar(textos[celda.hallazgo], 'ok');
  avisar(textos[celda.hallazgo]);
}
const distancia = (c, f) =>
  Math.hypot(c - CONFIG.mapaMundo.origen.col, f - CONFIG.mapaMundo.origen.fila);

/* ==================================================================
   EL OPERARIO — aparece de vez en cuando y hay que pillarlo
   ================================================================== */

/* ==================================================================
   AVERÍAS — por pueblo, solo en la partida viva (nunca offline)
   ================================================================== */

function tickAverias(dtHoras){
  const A = CONFIG.averias;

  // 1. Lo que ya está roto: el personal contratado lo va terminando solo.
  for(let i = estado.averias.length - 1; i >= 0; i--){
    const av = estado.averias[i];
    const nivel = Math.max(...estado.pueblos.map(p => p.mejoras.mantenimiento));
    if(nivel <= 0) continue;
    const tiempo = A.reparacionAutoHoras * Math.pow(A.reparacionAutoFactor, nivel - 1);
    if(estado.horas - av.desde >= tiempo){
      estado.averias.splice(i, 1);
      estado.anotar('El equipo de mantenimiento termina una reparación.', 'ok');
    }
  }

  // 2. Lo que puede romperse: SOLO piezas puestas en el mapa. Sin instalación no
  //    hay averías, que es lo que mantiene limpio el arranque de la partida.
  const sanas = estado.construcciones.filter(o => !averiaEn(estado, o.col, o.fila));
  if(!sanas.length) return;

  const p = estado.activo;
  // El riesgo sube con el tamaño de la instalación, pero por RAÍZ y no en línea
  // recta: multiplicarlo por el número de piezas hacía que con dos ya cayeran
  // averías en cadena, y con veinte habría sido injugable.
  let riesgo = A.probBasePorHora * dtHoras * Math.sqrt(sanas.length);
  riesgo *= 1 + A.factorDesgaste *
            (p.mejoras.captacion + (p.autobombaActivo ? A.riesgoAutobomba : 0));
  if(Math.random() >= riesgo) return;

  const victima = sanas[Math.floor(Math.random() * sanas.length)];
  const def = CONFIG.construibles[victima.tipo];
  estado.averias.push({
    col: victima.col, fila: victima.fila,
    clics: clicsDeReparacion(), desde: estado.horas
  });
  estado.anotar(`Avería: ${def.nombre} fuera de servicio hasta que lo repares.`, 'critico');
  avisar(`¡Avería en ${def.nombre}! Ve al mapa y clica encima.`);
}

/** Golpes de llave que pide una avería. El personal contratado deja menos faena. */
function clicsDeReparacion(){
  const A = CONFIG.averias;
  const nivel = Math.max(...estado.pueblos.map(p => p.mejoras.mantenimiento));
  return Math.max(A.clicsMinimos, A.clicsParaReparar - nivel * A.clicsMenosPorNivelMant);
}

/**
 * Un clic sobre una casilla averiada: se paga y se avanza el arreglo. Repararla
 * es ir hasta allí y darle, no pulsar un botón desde el panel. Devuelve true si
 * el clic se ha consumido aquí.
 */
function clicAveria(col, fila){
  const av = averiaEn(estado, col, fila);
  if(!av) return false;
  const coste = CONFIG.averias.costePorClic;
  if(!estado.puedePagar(coste)){
    avisar(`Cada golpe de llave cuesta ${formatear(coste)} € y no hay fondos.`);
    return true;
  }
  estado.pagar(coste);
  av.clics--;
  if(av.clics > 0){
    avisar(`Reparando... quedan ${av.clics} (−${formatear(coste)} €)`);
    return true;
  }
  estado.averias.splice(estado.averias.indexOf(av), 1);
  const obra = estado.construcciones.find(o => o.col === col && o.fila === fila);
  const nombre = obra ? CONFIG.construibles[obra.tipo].nombre : 'La instalación';
  estado.anotar(`${nombre}: avería reparada, vuelve a estar en servicio.`, 'ok');
  avisar('¡Reparada! Vuelve a contar en la red.');
  escena.destelloMantenimiento();
  return true;
}

/* ==================================================================
   DESBLOQUEO DE PUEBLOS Y AVISOS DE CRECIMIENTO
   ================================================================== */

function comprobarDesbloqueo(){
  // Habitantes TOTALES de la mancomunidad (solo los pueblos ya abiertos)
  const total = estado.pueblos.reduce(
    (s, p) => s + (p.desbloqueado ? Math.floor(p.habitantes) : 0), 0);

  for(let i = 1; i < estado.pueblos.length; i++){
    const p = estado.pueblos[i];
    const def = CONFIG.poblaciones[i];
    if(p.desbloqueado || !def.desbloqueaEn || total < def.desbloqueaEn) continue;

    p.desbloqueado = true;
    estado.anotar(`¡La mancomunidad se amplía! Nuevo pueblo: ${p.nombre}.`, 'ok');
    avisar(`Nuevo pueblo disponible: ${p.nombre}. Ábrelo en las pestañas.`);
    ui.reconstruirPestanas(estado);

    // El TERCER pueblo trae consigo la gestión de aguas pluviales
    if(i >= 2 && !estado.pluvialesActivas){
      estado.pluvialesActivas = true;
      estado.anotar('Nueva competencia: red de pluviales y tanques de tormenta. ' +
                    'Separa la lluvia del saneamiento para no aliviar al cauce.', 'ok');
      avisar('¡Desbloqueadas la red de pluviales y el tanque de tormentas!');
      ui.invalidarCache();
    }
  }
}

function anotarCrecimiento(){
  for(let i = 0; i < estado.pueblos.length; i++){
    const p = estado.pueblos[i];
    if(!p.desbloqueado) continue;
    const ahora = Math.floor(p.habitantes);
    const antes = habPrev[i];
    if(Math.floor(ahora / 100) !== Math.floor(antes / 100)){
      estado.anotar(ahora > antes
        ? `${p.nombre} crece: ${ahora.toLocaleString('es-ES')} habitantes.`
        : `${p.nombre} pierde población: ${ahora.toLocaleString('es-ES')} habitantes.`,
        ahora > antes ? 'ok' : 'alarma');
    }
    habPrev[i] = ahora;
  }
}

/* ==================================================================
   PROGRESO OFFLINE
   ================================================================== */

function progresoOffline(){
  const O = CONFIG.offline;
  const seg = (Date.now() - estado.ultimoInstante) / 1000;
  if(seg <= O.minSegundos) return;

  const aSimular = Math.min(seg, O.maxHoras * 3600);
  const dineroAntes = estado.dinero;
  let restante = aSimular;
  const paso = 30;
  while(restante > 0){
    avanzar(estado, Math.min(paso, restante));   // sin averías nuevas offline
    restante -= paso;
  }
  const dinero = estado.dinero - dineroAntes;
  const minutos = Math.round(aSimular / 60);
  estado.anotar(`Mientras no estabas (${minutos} min): ${dinero >= 0 ? '+' : ''}${formatear(dinero)} €.`, 'info');
}

/* ==================================================================
   AVISO PASAJERO
   ================================================================== */

let tempAviso = null;
function avisar(texto){
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.classList.add('visible');
  clearTimeout(tempAviso);
  tempAviso = setTimeout(() => el.classList.remove('visible'), 2800);
}

/* ==================================================================
   BUCLE PRINCIPAL
   ================================================================== */

let ultimo = performance.now();
let acumGuardado = 0, acumHUD = 0;
let resultado = { servicio: 0, prodLps: 0, contaminacion: 0, suciedad: 0 };

function bucle(ahora){
  const dt = Math.min((ahora - ultimo) / 1000, 0.1);
  ultimo = ahora;

  procesarAcciones();
  resultado = avanzar(estado, dt);
  tickAverias(dt * CONFIG.economia.horasPorSegundo);

  // La guía avanza sola cuando el jugador consigue de verdad cada paso
  const pasoHecho = comprobarGuia(estado);
  if(pasoHecho) estado.anotar(`Guía: ${pasoHecho.titulo} ✓`, 'ok');
  comprobarDesbloqueo();
  anotarCrecimiento();

  if(resultado.saneamientoNuevo && resultado.saneamientoNuevo.length){
    for(const nombre of resultado.saneamientoNuevo){
      estado.anotar(`${nombre} genera aguas residuales. Vigila el cauce y piensa en una depuradora.`, 'alarma');
      avisar(`${nombre} ya vierte al cauce. Sin depuradora, contaminas.`);
    }
  }

  acumHUD += dt;
  if(acumHUD > 0.1){ acumHUD = 0; ui.actualizar(estado, resultado); }

  acumGuardado += dt;
  if(acumGuardado > CONFIG.guardado.intervaloSegundos){
    acumGuardado = 0;
    estado.guardar();
  }

  escena.dibujar(estado, resultado, dt);
  requestAnimationFrame(bucle);
}

/* ==================================================================
   BOTONES GENERALES
   ================================================================== */

document.getElementById('btn-reiniciar').onclick = () => {
  if(!confirm('¿Empezar de cero? Se perderá el progreso.')) return;
  Estado.borrar();
  location.reload();
};

// Alternar estilo visual A/B para compararlos, sin recargar
const btnEstilo = document.getElementById('btn-estilo');
const ETIQUETAS = { m: 'Mapa', d: 'Parcela', a: 'A · 3D', b: 'B · SVG', c: 'C · IA' };
function etiquetaEstilo(){ btnEstilo.textContent = 'Estilo: ' + ETIQUETAS[estiloEscena]; }
btnEstilo.onclick = () => {
  estiloEscena = ESTILOS[(ESTILOS.indexOf(estiloEscena) + 1) % ESTILOS.length];
  localStorage.setItem('rh_estilo', estiloEscena);
  escena = crearEscena();
  if(window.juego) window.juego.escena = escena;   // mantener la referencia de depuración
  etiquetaEstilo();
};
etiquetaEstilo();

// Depuración: `juego` en la consola. `juego.dinero(n)` fija el saldo.
window.juego = {
  estado, entrada, escena, CONFIG,
  dinero: n => { estado.dinero = n; },
  agua: n => { estado.activo.agua = n; }
};

requestAnimationFrame(bucle);
