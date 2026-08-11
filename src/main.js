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
import { EscenaMapa } from './escena_mapa.js';
import { celdaEn, clicarCasilla, clicsParaDestapar, puedeColocar,
         puedeSeguirTrazado, costeTrazado, casillaEnRed,
         piezaDeRuina, diametro, nivelDiametro, costeRenovar,
         averiaEn, aflorarArqueologia, tipoYacimiento,
         puedeEstudiar, estudiarZona, puedeSondear, sondear,
         costeSondeo, claseAcuifero } from './mapa.js';
import { avanzar, bombear, costeMejora, requisitosAutobomba,
         poderExpansion, servicioActivo, costeAmpliarVertedero,
         capacidadVaso, faseActual, faltanParaFase,
         incorporarPueblo, canonIncorporacion } from './simulacion.js';
import { formatear } from './util.js';
import { comprobar as comprobarGuia, saltar as saltarGuia } from './tutorial.js';

const lienzo  = document.getElementById('escena');
const estado  = new Estado();
const habiaPartida = Estado.cargar(estado);
const entrada = new Entrada(lienzo);
const ui      = new UI(entrada);

// El mapa de exploracion ES el juego. Hubo cuatro estilos mas (diorama en falso
// 3D, sprites SVG, PNG de IA y una vista cenital de la parcela) que sirvieron
// para tantear por donde tirar; se han quitado al quedar claro cual valia.
// `escena.js` se queda porque `EscenaMapa` hereda de el: destellos, clima,
// estaciones y los helpers de color viven ahi.
let escena = new EscenaMapa(lienzo);
// La ficha de casilla pinta su miniatura con el MISMO dibujo del mapa, asi que
// necesita la escena. Se la damos aqui para que ui.js no tenga que importarla.
ui.escena = escena;

if(!habiaPartida){
  estado.anotar(`Nueva mancomunidad. ${estado.activo.nombre} espera agua: dale a BOMBEAR.`, 'info');
} else {
  progresoOffline();
}
ui.reconstruirPestanas(estado);

// Población de referencia para avisar solo al cruzar centenas, por pueblo
let habPrev = estado.pueblos.map(p => Math.floor(p.habitantes));
let multaZECAvisada = false;   // para anunciar la multa solo al empezar

/* ==================================================================
   ACCIONES
   ================================================================== */

function procesarAcciones(){
  for(const a of entrada.vaciarAcciones()){
    switch(a.tipo){

      case 'bombear': {
        // Sin coordenadas (barra espaciadora): el destello va sobre el pueblo.
        const O = CONFIG.mapaMundo, t = escena.tam;
        const px = a.x != null ? a.x : O.origen.col * t - estado.camara.x + t / 2;
        const py = a.y != null ? a.y : O.origen.fila * t - estado.camara.y + t / 2;
        bombear(estado.activo, estado);
        escena.destello(px, py);
        // Que la caseta de bombeo acuse el clic: hasta ahora bombear solo movía
        // números y la pieza del mapa se quedaba igual.
        escena.golpeBomba();
        break;
      }

      /* --- EL MAPA: arrastrar para mirar, clicar para destapar --- */

      case 'arrastrar':
        {
          estado.camara.x -= a.dx;
          estado.camara.y -= a.dy;
        }
        break;

      case 'senalar':
        {
          escena.resaltada = escena.celdaEnPantalla(estado, a.x, a.y);
        }
        break;

      case 'zoom':
        escena.ampliar(estado, a.delta, a.x, a.y);
        break;

      case 'pellizco':
        escena.ampliarFactor(estado, a.factor, a.x, a.y);
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

      // Elegir red y ponerse a tender, de una: en la paleta cada red trae su
      // propio botón de tender, así que pulsarlo ya dice cuál.
      case 'elegirRedYTender': {
        const def = CONFIG.redes[a.clave];
        if(!def) break;
        if(def.requiere && !servicioActivo(estado.activo, def.requiere)){
          avisar(`Esa red llega con el servicio de ${CONFIG.servicios[def.requiere].nombre.toLowerCase()}.`);
          break;
        }
        const yaEstaba = estado.modo.tipo === 'tuberia' && estado.redActual === a.clave;
        estado.redActual = a.clave;
        estado.modo = yaEstaba
          ? { tipo: null, elemento: null, trazado: [] }
          : { tipo: 'tuberia', elemento: null, trazado: [] };
        ui.invalidarCache();
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

      case 'cerrarHito':
        estado.hitoPendiente = null;
        ui.invalidarCache();
        break;

      case 'saltarGuia':
        saltarGuia(estado);
        estado.anotar('Guía saltada. Suerte ahí fuera.', 'info');
        break;

      case 'cancelarModo':
        estado.modo = { tipo: null, elemento: null, trazado: [] };
        ui.refrescarConstruccion(estado);
        break;

      case 'clicEscena': {
        const { col, fila } = escena.celdaEnPantalla(estado, a.x, a.y);
        const celda = celdaEn(estado.mapa, col, fila);
        if(!celda) break;

        // Con una herramienta activa, el clic construye en vez de explorar
        if(estado.modo.tipo === 'colocar'){ colocarElemento(col, fila); break; }
        if(estado.modo.tipo === 'tuberia'){ clicTuberia(col, fila); break; }

        // Lo roto manda: si hay una avería aquí, el clic la repara
        if(clicAveria(col, fila)){ escena.destello(a.x, a.y); break; }

        // EL PUEBLO ES EL BOTÓN DE BOMBEAR. Antes había un botonazo ocupando un
        // cuarto de la pantalla para hacer esto, y era el resto del mapa —terreno
        // vacío— el que bombeaba al clicarlo, que no significaba nada. Ahora se
        // clica donde está la cosa: sobre el pueblo, y solo sobre el pueblo.
        const puebloAqui = estado.pueblos.findIndex(p => p.col === col && p.fila === fila);
        if(puebloAqui >= 0){
          // Clicar un pueblo lo hace ACTIVO además de bombear: con muchos
          // núcleos por el mapa, cambiar de pestaña buscando cuál era este
          // rompía el ritmo del clic.
          if(estado.puebloActivo !== puebloAqui){
            estado.puebloActivo = puebloAqui;
            ui.invalidarCache();
            ui.reconstruirPestanas(estado);
          }
          estado.seleccion = null;
          bombear(estado.activo, estado);
          escena.destello(a.x, a.y);
          escena.golpeBomba();
          break;
        }

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
          // Terreno pelado: se selecciona y su ficha cuenta qué es, qué cuesta
          // cruzarlo y qué cabe encima. Mirar tiene que ser gratis.
          estado.seleccion = { col, fila };
        }
        break;
      }

      /* --- HALLAZGOS: qué hacer con lo que encuentras --- */

      case 'repararRuina':     accionRuina(false); break;
      case 'desmontarRuina':   accionRuina(true);  break;

      case 'excavarYacimiento': {
        const sel = estado.seleccion;
        const celda = sel && celdaEn(estado.mapa, sel.col, sel.fila);
        if(!celda || !celda.arqueologia || !celda.aflorado || celda.excavado) break;
        const A = CONFIG.arqueologia;
        if(!estado.puedePagar(A.costeExcavar)){
          avisar(`La excavación cuesta ${formatear(A.costeExcavar)} € y no hay fondos.`);
          break;
        }
        estado.pagar(A.costeExcavar);
        celda.excavado = true;
        const tipoY = tipoYacimiento(celda);
        estado.anotar(`${tipoY.nombre} puesto en valor: renta ${formatear(tipoY.renta)} €/h.`, 'ok');
        avisar(`¡${tipoY.nombre}! Empieza a rentar.`);
        ui.invalidarCache();
        break;
      }

      /* --- EL AGUA QUE NO SE VE: estudiar, perforar --- */

      case 'estudiarZona': {
        const sel = estado.seleccion;
        if(!sel) break;
        const A = CONFIG.acuiferos;
        const puede = puedeEstudiar(estado.mapa, sel.col, sel.fila);
        if(!puede.ok){ avisar(puede.motivo); break; }
        if(!estado.puedePagar(A.estudio.coste)){
          avisar(`El estudio cuesta ${formatear(A.estudio.coste)} € y no hay fondos.`);
          break;
        }
        estado.pagar(A.estudio.coste);
        const conIndicios = estudiarZona(estado.mapa, sel.col, sel.fila);
        // Un estudio sin indicios NO es dinero tirado y hay que decirlo así:
        // descartar una zona es la mitad del trabajo de un hidrogeólogo.
        if(conIndicios > 0){
          estado.anotar(`Estudio hidrogeológico: ${conIndicios} casillas con indicios.`, 'ok');
          avisar(`Indicios favorables en ${conIndicios} casillas. Ahí vale la pena perforar.`);
        } else {
          estado.anotar('Estudio hidrogeológico: sin indicios en esta zona.', 'aviso');
          avisar('Nada prometedor por aquí. Zona descartada: prueba en otro sitio.');
        }
        ui.invalidarCache();
        break;
      }

      case 'sondear': {
        const sel = estado.seleccion;
        if(!sel) break;
        const celda = celdaEn(estado.mapa, sel.col, sel.fila);
        const puede = puedeSondear(estado.mapa, sel.col, sel.fila);
        if(!puede.ok){ avisar(puede.motivo); break; }
        const coste = costeSondeo(celda);
        if(!estado.puedePagar(coste)){
          avisar(`Perforar aquí cuesta ${formatear(coste)} € y no hay fondos.`);
          break;
        }
        estado.pagar(coste);
        const clase = sondear(estado.mapa, sel.col, sel.fila);
        if(clase){
          contarHito('acuifero');
          estado.anotar(`¡Sondeo positivo! ${clase.nombre} bajo esa casilla.`, 'ok');
          avisar(`¡Ha dado agua! ${clase.nombre}. Ya puedes poner el pozo encima.`);
        } else {
          // El sondeo seco es la lección cara, y por eso se cuenta entero: lo que
          // ha costado y que ese punto ya está descartado para siempre.
          estado.anotar(`Sondeo seco: ${formatear(coste)} € y ni gota.`, 'critico');
          avisar('Seco. Ahí abajo no hay nada, y la perforación ya está pagada.');
        }
        ui.invalidarCache();
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
        // La FASE manda: los anillos lejanos exigen una mancomunidad grande.
        if((celda.anillo || 1) > faseActual(estado)){
          const faltan = faltanParaFase(estado);
          avisar(`La mancomunidad aún no puede absorber este núcleo: incorpora ` +
                 `${faltan} pueblo${faltan === 1 ? '' : 's'} más cercanos primero.`);
          break;
        }
        const canon = canonIncorporacion(estado);
        if(!estado.puedePagar(canon)){
          avisar(`Incorporarlo cuesta un canon de ${formatear(canon)} € y no hay fondos.`);
          break;
        }
        estado.pagar(canon);
        const faseAntes = faseActual(estado);
        const nuevo = incorporarPueblo(estado, sel.col, sel.fila, celda);
        habPrev.push(Math.floor(nuevo.habitantes));
        estado.anotar(`${nuevo.nombre} entra en la mancomunidad: ya recibe agua.`, 'ok');
        avisar(`¡${nuevo.nombre} incorporado! (${estado.pueblos.length} núcleos)`);
        ui.reconstruirPestanas(estado);
        contarHito('mancomunidad');
        if(faseActual(estado) > faseAntes){
          estado.anotar(`FASE ${faseActual(estado)}: la mancomunidad puede absorber ` +
                        `los núcleos del siguiente anillo, más lejanos.`, 'ok');
          avisar(`¡Fase ${faseActual(estado)}! Se abre el siguiente anillo de núcleos.`);
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
        escena.centrarEn(estado, av.col, av.fila);
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

/**
 * ¿Ha salido un yacimiento al picar aquí? Se comprueba SOLO al confirmar una
 * obra. Devuelve true si acaba de aflorar, y en ese caso la obra se cancela: lo
 * que estabas haciendo ya no se puede hacer ahí.
 */
function tropiezoArqueologico(col, fila){
  if(!aflorarArqueologia(estado.mapa, col, fila)) return false;
  estado.seleccion = { col, fila };
  estado.modo.trazado = [];
  const tipoA = tipoYacimiento(celdaEn(estado.mapa, col, fila));
  estado.anotar(`¡${tipoA.nombre} al excavar! No se puede construir ahí: hay que rodearlo.`, 'alarma');
  avisar(`¡${tipoA.nombre}! Rodéalo... o excávalo y ponlo en valor.`);
  ui.invalidarCache();
  return true;
}

function colocarElemento(col, fila){
  // La primera vez que una zona protegida te rechaza, se cuenta el porqué
  const celdaP = celdaEn(estado.mapa, col, fila);
  if(celdaP && celdaP.protegida) contarHito('proteccion');
  if(tropiezoArqueologico(col, fila)) return;
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
  const celdaP = celdaEn(estado.mapa, col, fila);
  if(celdaP && celdaP.protegida) contarHito('proteccion');
  if(tropiezoArqueologico(col, fila)) return;
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


function anotarCrecimiento(){
  // La lista de pueblos crece en caliente: los recién incorporados entran aquí
  while(habPrev.length < estado.pueblos.length)
    habPrev.push(Math.floor(estado.pueblos[habPrev.length].habitantes));
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

/**
 * Encola un hito para que se cuente. Solo la primera vez: un hito repetido deja
 * de ser un momento y pasa a ser un estorbo.
 */
function contarHito(id){
  if(!CONFIG.hitos[id]) return;
  if(estado.hitosVistos.includes(id)) return;
  estado.hitosVistos.push(id);
  estado.hitoPendiente = id;
}

/**
 * CUÁNDO SE HA CONSEGUIDO CADA LOGRO.
 *
 * Las condiciones viven aquí y no en `config.js` porque config no importa nada
 * de nadie: es una hoja del árbol de dependencias y solo exporta datos. Mismo
 * reparto que la guía, que tiene su tabla de comprobaciones en `tutorial.js`.
 *
 * Cada logro es el reverso exacto de su hito: el problema, resuelto.
 */
const LOGRO_CUMPLIDO = {
  // El río ha bajado a niveles que aguanta solo, y hay planta que lo trata.
  rioLimpio: (estado, res) =>
    servicioActivo(estado.activo, 'saneamiento')
    && (estado._conectadoSan || {}).depuradora
    && estado.contaminacion < CONFIG.cauce.contaminacionMax * 0.10,

  // Ha llovido de verdad y ni ha rebosado el colector ni ha aliviado la planta.
  sinAlivios: (estado, res) =>
    servicioActivo(estado.activo, 'pluviales')
    && (res.lluvia || 0) > 0.6 && !res.rebosando && !res.aliviando,

  // No queda basura en la calle Y algo se está reciclando.
  puebloLimpio: (estado, res) =>
    servicioActivo(estado.activo, 'residuos')
    && (res.basuraCalle || 0) < 0.02 && (res.recicladaTh || 0) > 0,

  // Todos los pueblos abiertos, bien servidos a la vez.
  // Con dos pueblos servidos saltaba nada más empezar; con el mundo de 36
  // núcleos, una mancomunidad de verdad son al menos SEIS bien atendidos a la vez.
  todosServidos: (estado) => {
    const abiertos = estado.pueblos.filter(p => p.desbloqueado);
    return abiertos.length >= 6
        && abiertos.every(p => p.servicio >= CONFIG.poblacion.servicioBueno);
  }
};

/** Mira si se ha conseguido alguno y lo cuenta. Uno por paso, sin atropellarse. */
function comprobarLogros(resultado){
  for(const [id, test] of Object.entries(LOGRO_CUMPLIDO)){
    if(estado.hitosVistos.includes(id)) continue;
    if(test(estado, resultado)) { contarHito(id); return; }
  }
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
  anotarCrecimiento();

  if(resultado.serviciosNuevos && resultado.serviciosNuevos.length){
    for(const clave of resultado.serviciosNuevos) contarHito(clave);
  }
  // Los logros se comprueban SIEMPRE, no solo al abrir un servicio: son el
  // premio a haber resuelto el problema, y eso pasa cuando el jugador quiere.
  comprobarLogros(resultado);

  // La multa de las zonas protegidas se anuncia al ARRANCAR, no cada paso: el
  // goteo ya se ve en la caja, lo que hay que contar es por qué ha empezado.
  if(resultado.celdasProtegidasSucias > 0 && !multaZECAvisada){
    multaZECAvisada = true;
    estado.anotar('Lixiviados en una zona protegida: multa del Estado mientras dure el daño.', 'critico');
    avisar('¡Multa! Tus lixiviados han alcanzado una zona de especial conservación.');
  } else if(resultado.celdasProtegidasSucias === 0){
    multaZECAvisada = false;
  }

  // El acuífero bajando es lo ÚNICO que no se ve en ninguna parte: no hay
  // avería, ni multa, ni humo. Solo el pozo dando cada vez menos. Si no se
  // cuenta, el jugador ve caer la producción y no entiende por qué.
  for(const av of resultado.avisosAcuifero || []){
    estado.anotar(`El nivel del ${av.clase.nombre.toLowerCase()} está bajando: ` +
      `${av.pozos} pozos sacan más de lo que entra.`, 'alarma');
    avisar('El acuífero se está agotando: sacas más agua de la que se repone.');
  }
  if(resultado.saneamientoNuevo && resultado.saneamientoNuevo.length){
    for(const nombre of resultado.saneamientoNuevo){
      estado.anotar(`${nombre} genera aguas residuales. Vigila el cauce y piensa en una depuradora.`, 'alarma');
      avisar(`${nombre} ya vierte al cauce. Sin depuradora, contaminas.`);
    }
  }

  acumHUD += dt;
  if(acumHUD > 0.1){ acumHUD = 0; ui.actualizar(estado, resultado); }
  // Los diagramas de las fichas van a 60 fps aunque el HUD se refresque a 10:
  // una animacion a tirones no llama la atencion, que es justo su trabajo.
  ui.animarDiagramas(dt);

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

// Solapas del lateral: enseñar una hoja y esconder las demás. Es DOM puro y no
// toca el estado, así que vive aquí y no en entrada.js.
const solapas = document.getElementById('solapas');
if(solapas) solapas.addEventListener('click', e => {
  const b = e.target.closest('.solapa');
  if(!b) return;
  for(const s of solapas.querySelectorAll('.solapa')) s.classList.toggle('activa', s === b);
  for(const h of document.querySelectorAll('.hoja')) h.hidden = h.dataset.hoja !== b.dataset.solapa;
});

// Depuración: `juego` en la consola. `juego.dinero(n)` fija el saldo.
window.juego = {
  estado, entrada, escena, CONFIG,
  dinero: n => { estado.dinero = n; },
  agua: n => { estado.activo.agua = n; }
};

requestAnimationFrame(bucle);
