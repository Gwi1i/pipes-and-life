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
         costeSondeo, claseAcuifero, edadAños, bautizarObra,
         nombreDeNucleo, conjuntoDeRed } from './mapa.js';
import { avanzar, bombear, costeCuadrilla, nivelMaxPieza, requisitosAutobomba,
         poderExpansion, servicioActivo, costeAmpliarVertedero,
         capacidadVaso, faseActual, faltanParaFase, capacidad,
         incorporarPueblo, canonIncorporacion, costeAmpliarPieza,
         nivelCaserio, escalonCaserio, costeEstudio,
         veteraniaAlTrasladarse } from './simulacion.js';
import { legado, cargarLegado, guardarLegado, borrarLegado,
         comprarVentaja, nivelVentaja, regionActual } from './legado.js';
import { mezclarColor } from './escena.js';

/**
 * Tiñe los colores del terreno con la región de la comarca actual. UNA sola
 * vez al arrancar, ANTES de crear nada: así todo lo que pinte terreno —el
 * mapa, la miniatura de la ficha de casilla— cuenta la misma región. La
 * comarca 1 no lleva tinte: es la de siempre, píxel por píxel.
 */
function aplicarRegion(){
  const r = regionActual();
  if(!r || !r.tinte) return;
  for(const def of Object.values(CONFIG.terrenos))
    def.color = mezclarColor(def.color, r.tinte, r.fuerza);
}
import { formatear } from './util.js';
import { comprobar as comprobarGuia, saltar as saltarGuia,
         pasoActual } from './tutorial.js';
import { comentar } from './comentarios.js';
import { vecinoPendiente } from './tajos.js';
import * as sonido from './sonido.js';
import { pedirUbicacion, buscarNombres, guardarNombres,
         quitar as quitarLugares } from './lugares.js';
import { MinijuegoTuberias } from './minijuego_tuberias.js';
import { MinijuegoReciclaje } from './minijuego_reciclaje.js';
import { MinijuegoCamion } from './minijuego_camion.js';
import * as analitica from './analitica.js';
import { aplicarIdioma, idiomaActual, cambiarIdioma, sinTraducir, t } from './idioma.js';

const lienzo  = document.getElementById('escena');
// El LEGADO va antes que el estado: el constructor necesita saber la semilla
// de la comarca actual y con cuántos planos (Cartografía) se llega.
cargarLegado();
aplicarRegion();
// El IDIOMA también va antes que nada: mezcla el diccionario inglés sobre
// CONFIG y sobre el HTML estático, y todo lo que se construya después
// (tienda, guía, paneles) nace ya traducido.
aplicarIdioma(CONFIG);
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
const miniTuberias = new MinijuegoTuberias();
const miniReciclaje = new MinijuegoReciclaje();
const miniCamion = new MinijuegoCamion();
// La ficha de casilla pinta su miniatura con el MISMO dibujo del mapa, asi que
// necesita la escena. Se la damos aqui para que ui.js no tenga que importarla.
ui.escena = escena;

if(!habiaPartida){
  estado.anotar(t`Nueva mancomunidad. ${estado.activo.nombre} espera agua: clica el pueblo para bombear.`, 'info');
} else {
  progresoOffline();
}

// LA PORTADA: un telón, no un menú — el juego ya corre detrás. Quitarla es
// además el primer gesto del usuario, que es justo lo que el navegador exige
// para dejar sonar la música: entrar por aquí lo resuelve solo.
{
  const botonPortada = document.getElementById('portada-jugar');
  botonPortada.textContent = habiaPartida ? t`Continuar la partida` : t`Empezar`;
  botonPortada.onclick = () => {
    document.getElementById('portada').hidden = true;
    // El primer embudo: cuántos de los que entran pasan de la portada
    analitica.contar(habiaPartida ? 'continua' : 'empieza');
    // Con la voz ya activada de otra sesión, Manuel lee el paso que espera.
    // El clic de la portada es además el gesto que el navegador exige.
    const paso = pasoActual(estado);
    if(paso) sonido.hablar(paso.titulo + '. ' + paso.texto, paso.id);
  };

  // El cartel puede ser VÍDEO (h_portada.mp4), como en las fichas: se prueba
  // y solo si de verdad puede reproducirse sustituye a la imagen fija. Sin
  // archivo, el error se queda callado y la imagen sigue en su sitio.
  const cartel = document.querySelector('#portada .portada-img');
  const v = document.createElement('video');
  v.className = 'portada-img';
  v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
  v.oncanplay = () => { if(cartel.parentNode){ cartel.replaceWith(v); v.play(); } };
  v.src = 'assets/h_portada.mp4';
}
ui.reconstruirPestanas(estado);

// Población de referencia para avisar solo al cruzar centenas, por pueblo
let habPrev = estado.pueblos.map(p => Math.floor(p.habitantes));
let multaZECAvisada = false;   // para anunciar la multa solo al empezar

/* ==================================================================
   ACCIONES
   ================================================================== */

/**
 * EL GOLPE DE BOMBA, con sus dos límites (petición del autor):
 * - TOPE DE RITMO: más clics por segundo de los que da una mano se ignoran
 *   sin ruido. No detecta autoclickers —en un juego que corre entero en tu
 *   navegador no se puede—: los vuelve inútiles, que es mejor.
 * - DESBORDE: con el depósito lleno el agua se tira y ensucia el cauce (eso
 *   lo hace `bombear` en simulacion). Aquí se le pone cara: sin destello ni
 *   gota — un clic que no sirve no debe sonar a que sirve — y el primer
 *   desborde se explica una vez.
 */
let clicsBombeo = [];
let desbordeAvisado = false;
function golpeDeBomba(px, py, col, fila){
  const ahora = performance.now();
  clicsBombeo = clicsBombeo.filter(x => ahora - x < 1000);
  if(clicsBombeo.length >= CONFIG.bombeo.maxClicsPorSegundo) return;
  clicsBombeo.push(ahora);

  // EL CONJUNTO (petición del autor): dos pueblos colgados del mismo
  // depósito funcionan como uno. El golpe se da donde clicas, pero el agua
  // va al pueblo MÁS SEDIENTO de los que comparten red con esa casilla —
  // mismos litros por clic, repartidos con cabeza, como hace el oficio.
  let candidatos = col != null ? conjuntoDeRed(estado, col, fila, 'abastecimiento') : [];
  if(!candidatos.length) candidatos = [estado.activo];
  candidatos.sort((a, b) =>
    a.agua / capacidad(a, estado) - b.agua / capacidad(b, estado));
  const objetivo = candidatos.find(pb => pb.agua < capacidad(pb, estado) - 0.001);

  const entro = bombear(objetivo || estado.activo, estado);
  // Si el agua fue a OTRO pueblo del conjunto, se ve allí también: sin ese
  // destello, tu depósito no sube y parece que el clic se perdió
  if(entro > 0.001 && objetivo && objetivo !== estado.activo){
    const tam2 = escena.tam;
    escena.destello(objetivo.col * tam2 - estado.camara.x + tam2 / 2,
                    objetivo.fila * tam2 - estado.camara.y + tam2 / 2);
  }
  if(entro <= 0.001){
    if(!desbordeAvisado){
      desbordeAvisado = true;
      avisar(t`¡El depósito está LLENO! Cada golpe de más se derrama... y lo derramado acaba en el cauce.`);
      estado.anotar(t`Bombeo con el depósito lleno: el agua sobrante se derrama al cauce.`, 'alarma');
    }
    sonido.seco();
    return;
  }
  escena.destello(px, py);
  // Que la caseta de bombeo acuse el clic: hasta ahora bombear solo movía
  // números y la pieza del mapa se quedaba igual.
  escena.golpeBomba();
  sonido.bombear();
}

function procesarAcciones(){
  for(const a of entrada.vaciarAcciones()){
    switch(a.tipo){

      case 'bombear': {
        // Sin coordenadas (barra espaciadora): el destello va sobre el pueblo.
        // (tam, no t: la t es la etiqueta de traducción importada)
        const O = CONFIG.mapaMundo, tam = escena.tam;
        const px = a.x != null ? a.x : O.origen.col * tam - estado.camara.x + tam / 2;
        const py = a.y != null ? a.y : O.origen.fila * tam - estado.camara.y + tam / 2;
        golpeDeBomba(px, py, estado.activo.col, estado.activo.fila);
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
          avisar(t`Esa red llega con el servicio de ${CONFIG.servicios[def.requiere].nombre.toLowerCase()}.`);
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
          avisar(t`Esa red llega con el servicio de ${CONFIG.servicios[def.requiere].nombre.toLowerCase()}.`);
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
        // Renovar al MISMO calibre vale si la línea está pasada de vida útil:
        // sin esto, una fundición de 80 años no tenía cura posible.
        const vieja = edadAños(tub, estado.horas) > (diametro(tub.dn, red).vidaAños || Infinity);
        const salto = nivelDiametro(destino, red) - nivelDiametro(tub.dn, red);
        if(salto < 0 || (salto === 0 && !vieja)){
          avisar(t`Elige arriba un calibre mayor — o el mismo, si la línea está vieja.`);
          break;
        }
        const coste = costeRenovar(estado.mapa, tub, destino, red);
        if(!estado.puedePagar(coste)){
          avisar(t`Renovar esa línea cuesta ${formatear(coste)} € y no hay fondos.`);
          break;
        }
        estado.pagar(coste);
        const antes = diametro(tub.dn, red).nombre;
        tub.dn = destino;
        tub.coste = (tub.coste || 0) + coste;
        // Renovar es tubería NUEVA: el reloj de la vida útil vuelve a cero
        tub.nacida = estado.horas;
        estado.anotar(t`Línea renovada de ${antes} a ${diametro(destino, red).nombre} por ${formatear(coste)} €.`, 'ok');
        avisar(t`Línea renovada a ${diametro(destino, red).nombre}.`);
        ui.invalidarCache();
        break;
      }

      case 'ampliarPieza': {
        const sel = estado.seleccion;
        const obra = sel && estado.construcciones.find(o => o.col === sel.col && o.fila === sel.fila);
        if(!obra) break;
        const A = CONFIG.ampliacion;
        if(!A.tipos.includes(obra.tipo) || (obra.nivel || 1) >= nivelMaxPieza(obra.tipo)) break;
        const coste = costeAmpliarPieza(obra);
        if(!estado.puedePagar(coste)){
          avisar(t`Ampliar cuesta ${formatear(coste)} € y no hay fondos.`);
          break;
        }
        estado.pagar(coste);
        obra.nivel = (obra.nivel || 1) + 1;
        sonido.compra();
        estado.anotar(t`${obra.nombre || obra.tipo} ampliado a nivel ${obra.nivel}: aporta como ${obra.nivel} piezas.`, 'ok');
        avisar(t`¡Ampliación terminada! Nivel ${obra.nivel}.`);
        ui.invalidarCache();
        break;
      }

      /* --- DERRIBAR Y LEVANTAR: equivocarse tiene salida, pero no gratis --- */

      case 'derribarObra': {
        const sel = estado.seleccion;
        const idx = sel ? estado.construcciones.findIndex(
          o => o.col === sel.col && o.fila === sel.fila) : -1;
        if(idx < 0) break;
        const obra = estado.construcciones[idx];
        const def = CONFIG.construibles[obra.tipo];
        const recupera = Math.round(def.coste * (obra.nivel || 1)
                                    * CONFIG.derribo.fraccionRecuperada);
        if(!confirm(t`¿Derribar ${obra.nombre || def.nombre}? Del derribo se recuperan ${formatear(recupera)} €.`)) break;
        estado.construcciones.splice(idx, 1);
        // Lo que estaba roto en esa casilla se va con el escombro
        estado.averias = estado.averias.filter(av => av.col !== sel.col || av.fila !== sel.fila);
        estado.dinero += recupera;
        estado.anotar(t`${obra.nombre || def.nombre} derribado: ${formatear(recupera)} € recuperados.`, 'info');
        avisar(t`Derribado. La casilla queda libre.`);
        sonido.picar();
        estado.seleccion = null;
        ui.invalidarCache();
        break;
      }

      case 'quitarLinea': {
        const tub = estado.tuberias[parseInt(a.clave, 10)];
        if(!tub) break;
        const red = tub.red || 'abastecimiento';
        const recupera = Math.round(costeTrazado(estado.mapa, tub.camino, tub.dn, red)
                                    * CONFIG.tuberia.valorRecuperado);
        const R = CONFIG.redes[red];
        if(!confirm(t`¿Levantar esta línea de ${R.nombre.toLowerCase()} (${tub.camino.length} casillas)?
                    Se recuperan ${formatear(recupera)} € de material.
                    Ojo: lo que colgaba de ella quedará sin conectar.`)) break;
        estado.tuberias.splice(estado.tuberias.indexOf(tub), 1);
        estado.dinero += recupera;
        estado.anotar(t`Línea de ${R.nombre.toLowerCase()} levantada: ${formatear(recupera)} € de material recuperado.`, 'info');
        avisar(t`Línea levantada.`);
        sonido.picar();
        ui.invalidarCache();
        break;
      }

      case 'ampliarVertedero': {
        const sel = estado.seleccion;
        const obra = sel && estado.construcciones.find(
          o => o.col === sel.col && o.fila === sel.fila && o.tipo === 'vertedero');
        if(!obra) break;
        const V = CONFIG.residuos.vertedero;
        if((obra.nivel || 1) >= V.nivelMax){ avisar(t`Ese vaso ya no da más de sí.`); break; }
        const coste = costeAmpliarVertedero(obra);
        if(!estado.puedePagar(coste)){
          avisar(t`Ampliar el vaso cuesta ${formatear(coste)} € y no hay fondos.`);
          break;
        }
        estado.pagar(coste);
        obra.nivel = (obra.nivel || 1) + 1;
        estado.anotar(t`Vertedero ampliado a nivel ${obra.nivel}: ${formatear(capacidadVaso(obra))} t de capacidad.`, 'ok');
        ui.invalidarCache();
        break;
      }

      case 'cerrarVuelta':
        document.getElementById('vuelta-fondo').hidden = true;
        break;

      case 'cerrarHito':
        estado.hitoPendiente = null;
        ui.invalidarCache();
        break;

      case 'plegarGuia':
        document.getElementById('panel-guia').classList.toggle('plegada');
        break;

      case 'saltarGuia':
        saltarGuia(estado);
        estado.anotar(t`Guía saltada. Suerte ahí fuera.`, 'info');
        break;

      case 'cancelarModo':
        cerrarEleccion();   // Escape también cierra la tarjeta de elección
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
          // Y lo SELECCIONA: aquí se ponía null de cuando clicar tu pueblo no
          // enseñaba nada. Ahora tiene ficha (nombre, estampa, datos) y
          // esconderla era el fallo que el autor encontró jugando.
          estado.seleccion = { col, fila };
          golpeDeBomba(a.x, a.y, col, fila);
          break;
        }

        // Clicar una instalación tuya la selecciona para verla de cerca: es la
        // única forma de saber cómo va de lleno un vertedero.
        const obraAqui = estado.construcciones.find(o => o.col === col && o.fila === fila);
        if(obraAqui){
          estado.seleccion = { col, fila };
          // Y el clic hace lo que hay debajo TAMBIÉN aquí: una pieza de
          // ABASTECIMIENTO conectada y sana es parte de la bomba — darle al
          // depósito lo llena, igual que darle al pueblo (petición del autor:
          // en el móvil, con una pieza en la mano, el pueblo quedaba lejos).
          const redPieza = Object.keys(CONFIG.redes)
            .find(k => CONFIG.redes[k].piezas.includes(obraAqui.tipo));
          if(redPieza === 'abastecimiento' && !averiaEn(estado, col, fila)
             && casillaEnRed(estado, col, fila, 'abastecimiento'))
            golpeDeBomba(a.x, a.y, col, fila);
          break;
        }

        if(celda.oculta){
          const r = clicarCasilla(estado.mapa, col, fila, poderExpansion(estado));
          if(r === null){ avisar(t`Ahí no llegas todavía: abre primero una casilla de al lado.`); break; }
          escena.destello(a.x, a.y);
          if(r === 'descubierta'){ sonido.destapar(); anunciarHallazgo(celda, col, fila); }
          else sonido.picar();
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
          avisar(t`La excavación cuesta ${formatear(A.costeExcavar)} € y no hay fondos.`);
          break;
        }
        estado.pagar(A.costeExcavar);
        celda.excavado = true;
        const tipoY = tipoYacimiento(celda);
        estado.anotar(t`${tipoY.nombre} puesto en valor: renta ${formatear(tipoY.renta)} €/h.`, 'ok');
        avisar(t`¡${tipoY.nombre}! Empieza a rentar.`);
        ui.invalidarCache();
        break;
      }

      /* --- EL AGUA QUE NO SE VE: estudiar, perforar --- */

      case 'estudiarZona': {
        const sel = estado.seleccion;
        if(!sel) break;
        const puede = puedeEstudiar(estado.mapa, sel.col, sel.fila);
        if(!puede.ok){ avisar(puede.motivo); break; }
        const precioEstudio = costeEstudio();   // con el Ojo clínico del legado
        if(!estado.puedePagar(precioEstudio)){
          avisar(t`El estudio cuesta ${formatear(precioEstudio)} € y no hay fondos.`);
          break;
        }
        estado.pagar(precioEstudio);
        const conIndicios = estudiarZona(estado.mapa, sel.col, sel.fila);
        // Un estudio sin indicios NO es dinero tirado y hay que decirlo así:
        // descartar una zona es la mitad del trabajo de un hidrogeólogo.
        if(conIndicios > 0){
          estado.anotar(t`Estudio hidrogeológico: ${conIndicios} casillas con indicios.`, 'ok');
          avisar(t`Indicios favorables en ${conIndicios} casillas. Ahí vale la pena perforar.`);
        } else {
          estado.anotar(t`Estudio hidrogeológico: sin indicios en esta zona.`, 'aviso');
          avisar(t`Nada prometedor por aquí. Zona descartada: prueba en otro sitio.`);
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
          avisar(t`Perforar aquí cuesta ${formatear(coste)} € y no hay fondos.`);
          break;
        }
        estado.pagar(coste);
        const clase = sondear(estado.mapa, sel.col, sel.fila);
        if(clase){
          contarHito('acuifero');
          sonido.agua();
          estado.anotar(t`¡Sondeo positivo! ${clase.nombre} bajo esa casilla.`, 'ok');
          avisar(t`¡Ha dado agua! ${clase.nombre}. Ya puedes poner el pozo encima.`);
        } else {
          sonido.seco();
          // El sondeo seco es la lección cara, y por eso se cuenta entero: lo que
          // ha costado y que ese punto ya está descartado para siempre.
          estado.anotar(t`Sondeo seco: ${formatear(coste)} € y ni gota.`, 'critico');
          avisar(t`Seco. Ahí abajo no hay nada, y la perforación ya está pagada.`);
        }
        ui.invalidarCache();
        break;
      }

      case 'abastecerPueblo': {
        const celda = celdaSeleccionada();
        if(!celda || celda.hallazgo !== 'pueblo' || celda.resuelto) break;
        const sel = estado.seleccion;
        if(!estaEnLaRed(sel.col, sel.fila)){
          avisar(t`Primero hay que llegar hasta él con una tubería.`);
          break;
        }
        // La FASE manda: los anillos lejanos exigen una mancomunidad grande.
        if((celda.anillo || 1) > faseActual(estado)){
          const faltan = faltanParaFase(estado);
          avisar(faltan === 1
            ? t`La mancomunidad aún no puede absorber este núcleo: incorpora un pueblo más cercano primero.`
            : t`La mancomunidad aún no puede absorber este núcleo: incorpora ${faltan} pueblos más cercanos primero.`);
          break;
        }
        const canon = canonIncorporacion(estado);
        if(!estado.puedePagar(canon)){
          avisar(t`Incorporarlo cuesta un canon de ${formatear(canon)} € y no hay fondos.`);
          break;
        }
        estado.pagar(canon);
        const faseAntes = faseActual(estado);
        const nuevo = incorporarPueblo(estado, sel.col, sel.fila, celda);
        habPrev.push(Math.floor(nuevo.habitantes));
        estado.anotar(t`${nuevo.nombre} entra en la mancomunidad: ya recibe agua.`, 'ok');
        avisar(t`¡${nuevo.nombre} incorporado! (${estado.pueblos.length} núcleos)`);
        sonido.pueblo();
        // La fiesta: incorporar es EL momento del juego y se despachaba con
        // una línea de registro. Anillos y confeti sobre el núcleo.
        escena.celebrarIncorporacion(sel.col, sel.fila);
        ui.reconstruirPestanas(estado);
        contarHito('mancomunidad');
        if(faseActual(estado) > faseAntes){
          estado.anotar(t`FASE ${faseActual(estado)}: la mancomunidad puede absorber
                        los núcleos del siguiente anillo, más lejanos.`, 'ok');
          avisar(t`¡Fase ${faseActual(estado)}! Se abre el siguiente anillo de núcleos.`);
        }
        // La llamada de otra comarca: tarjeta UNA vez, y solo en la primera —
        // quien ya se ha trasladado no necesita que se lo cuenten otra vez.
        if(legado.comarca === 1
           && faseActual(estado) >= CONFIG.comarcas.faseParaTrasladarse)
          contarHito('traslado');
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

      /* --- LA BARRA DE ESTADO: el mapa es el selector; esto, el atajo --- */

      case 'irPuebloActivo':
        // Tocar el nombre centra la cámara en tu pueblo: el "¿dónde estaba
        // yo?" del móvil, resuelto con un toque
        escena.centrarEn(estado, estado.activo.col, estado.activo.fila);
        break;

      case 'irProblema': {
        // El chip de la sed: activa ese pueblo y te planta delante de él
        const i = parseInt(a.clave, 10);
        const p = estado.pueblos[i];
        if(p && p.desbloqueado){
          estado.puebloActivo = i;
          ui.invalidarCache();
          escena.centrarEn(estado, p.col, p.fila);
        }
        break;
      }

      /* LA CIRUGÍA: el caso 'mejorar' (la tienda) murió — la infraestructura
         se amplía en el mapa. Sobrevive la CUADRILLA, que no es una obra. */
      case 'cuadrilla': {
        const C = CONFIG.cuadrilla;
        if((estado.cuadrilla || 0) >= C.nivelMax){
          avisar(t`${C.nombre}: ya está al completo.`);
          break;
        }
        const coste = costeCuadrilla(estado);
        if(!estado.puedePagar(coste)){
          avisar(t`Sin fondos: ampliar la cuadrilla cuesta ${formatear(coste)} €.`);
          break;
        }
        estado.pagar(coste);
        estado.cuadrilla = (estado.cuadrilla || 0) + 1;
        sonido.compra();
        estado.anotar(t`${C.nombre}: nivel ${estado.cuadrilla}. Menos golpes de
          llave y arreglos solos más rápidos.`, 'ok');
        break;
      }

      case 'activarAutobomba': {
        const p = estado.activo;
        if(p.autobombaActivo) break;
        const P = CONFIG.premium.autobomba;
        // GANCHO de monetización futura (P.desbloqueoExterno). De momento solo
        // se activa cumpliendo requisitos y pagando en el juego.
        if(!requisitosAutobomba(p, estado).cumple){
          avisar(t`Este pueblo aún no cumple los requisitos para el auto-bombeo.`);
          break;
        }
        if(!estado.puedePagar(P.coste)){
          avisar(t`El auto-bombeo cuesta ${formatear(P.coste)} €.`);
          break;
        }
        estado.pagar(P.coste);
        p.autobombaActivo = true;
        estado.anotar(t`¡Auto-bombeo activado en ${p.nombre}!`, 'ok');
        break;
      }

      /* --- EL MINIJUEGO: reparar a mano ---
         Opcional y con UN intento por avería: si siempre se pudiera reintentar,
         la llave (que cuesta dinero) no tendría sentido. El intento se gasta al
         ENTRAR — abandonar también cuenta, que mirar el tablero ya es ventaja.
         CADA AVERÍA JUEGA AL MINIJUEGO DE SU SERVICIO (petición del autor):
         las piezas de tubería, al tablero; la planta de reciclaje, a la cinta;
         el vertedero, a la ruta del camión. En modo avería el premio es SOLO
         el arreglo gratis: nada de bonos, que tienen su propia puerta. */
      case 'repararAMano': {
        const av = estado.averias[parseInt(a.clave, 10)];
        if(!av || av.aManoJugada) break;
        jugarAveria(av);
        break;
      }

      /* --- La tarjeta de elección de la avería (jugar o llave) --- */
      case 'eleccionJugar': {
        const av = averiaEnEleccion;
        cerrarEleccion();
        if(av && !av.aManoJugada) jugarAveria(av);
        break;
      }
      case 'eleccionLlave': {
        const av = averiaEnEleccion;
        cerrarEleccion();
        if(av){ av.elegidoLlave = true; ui.invalidarCache(); }
        break;
      }

      /* --- COPIA DE SEGURIDAD: la partida como texto --- */

      case 'exportarPartida': {
        const texto = estado.exportar();
        if(!texto){ avisar(t`Todavía no hay nada que copiar.`); break; }
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(texto)
            .then(() => avisar(t`Partida copiada al portapapeles. Pégala en un sitio seguro.`))
            // Sin permiso de portapapeles, el prompt de siempre: feo pero infalible
            .catch(() => prompt(t`Copia este texto y guárdalo:`, texto));
        } else {
          prompt(t`Copia este texto y guárdalo:`, texto);
        }
        break;
      }

      case 'importarPartida': {
        const texto = prompt(t`Pega aquí la partida copiada:`);
        if(texto === null || texto.trim() === '') break;
        if(!confirm(t`Esto SUSTITUYE la partida actual por la del texto. ¿Seguimos?`)) break;
        if(Estado.importar(texto)){
          // Como en Reiniciar: el sello del adiós resucitaría la partida vieja
          estado.guardar = () => {};
          location.reload();
        } else {
          avisar(t`Ese texto no parece una partida de Pipes and Life.`);
        }
        break;
      }

      /* --- EL EXPEDIENTE Y EL TRASLADO DE CONCESIÓN --- */

      case 'comprarVentaja': {
        const def = CONFIG.comarcas.ventajas[a.clave];
        if(!def) break;
        if(comprarVentaja(a.clave)){
          estado.anotar(t`Expediente: ${def.nombre} a nivel ${nivelVentaja(a.clave)}.`, 'ok');
          avisar(t`${def.nombre}: comprada. Es tuya para siempre, en todas las comarcas.`);
          sonido.compra();
        } else {
          avisar(t`No hay veteranía suficiente. Se gana al trasladarse.`);
        }
        ui.invalidarCache();
        break;
      }

      case 'cerrarDescubierto':
        document.getElementById('descubierto-fondo').hidden = true;
        break;

      case 'trasladarse': {
        if(faseActual(estado) < CONFIG.comarcas.faseParaTrasladarse) break;
        const ganada = Math.max(estado.mejorVeterania || 0, veteraniaAlTrasladarse(estado));
        if(!confirm(t`¿Trasladarse a otra comarca? La red, la caja y los pueblos SE QUEDAN.
                    Te llevas ${ganada} de veteranía y el expediente completo.`)) break;
        legado.comarca += 1;
        legado.veterania += ganada;
        // La semilla nueva, echada AHORA y guardada en el legado: el próximo
        // arranque construye la comarca nueva con ella.
        legado.semillaActual = 1 + Math.floor(Math.random() * 2147483646);
        guardarLegado();
        analitica.contar('traslado/comarca-' + legado.comarca);
        // Como en Reiniciar: se anula el sello del adiós y se borra la partida
        estado.guardar = () => {};
        Estado.borrar();
        location.reload();
        break;
      }

      /* --- EL TALLER: los minijuegos de ensayo, sin premio ni castigo --- */

      case 'practicarTuberias':
        analitica.contar('minijuego/tuberias');
        miniTuberias.jugar((exito, razon) => {
          if(razon === 'abandonado') return;
          avisar(exito ? t`¡Bordado! Así se remata un tramo.`
                       : t`Se derramó... en el taller no pasa nada: otra.`);
        });
        break;

      case 'practicarReciclaje':
        analitica.contar('minijuego/reciclaje');
        miniReciclaje.jugar((aciertos, total, razon) => {
          if(razon === 'abandonado') return;
          avisar(t`Ensayo: ${aciertos} de ${total} bien separados.`);
        });
        break;

      case 'practicarCamion':
        analitica.contar('minijuego/camion');
        miniCamion.jugar((aciertos, total, razon) => {
          if(razon === 'abandonado') return;
          avisar(t`Ensayo: ${aciertos} de ${total} contenedores recogidos.`);
        });
        break;

      /* --- EL TURNO DE VERDAD en la planta: con premio a la venta --- */

      case 'turnoReciclaje': {
        const K = CONFIG.minijuegos.reciclaje;
        if(estado.turnoReciclaje && estado.horas < estado.turnoReciclaje.hasta){
          avisar(t`El turno ya está echado: espera a que venza el bono.`);
          break;
        }
        miniReciclaje.jugar((aciertos, total, razon) => {
          if(razon === 'abandonado') return;
          const punteria = total ? aciertos / total : 0;
          const factor = 1 + K.bonusMax * punteria;
          estado.turnoReciclaje = { hasta: estado.horas + K.horasBonus, factor };
          estado.anotar(t`Turno en la línea: ${aciertos} de ${total}. La venta de
                        reciclado sube un ${Math.round((factor - 1) * 100)} % una temporada.`, 'ok');
          avisar(t`¡Turno hecho! Venta de reciclado +${Math.round((factor - 1) * 100)} %.`);
          if(punteria > 0.7){ sonido.reparada(); ui.caraGuia('bien'); }
          ui.invalidarCache();
        });
        break;
      }

      /* --- LA CARTA DEL TAJO: el botón hace lo obvio de cada paso --- */

      case 'irTajo': {
        const abrirSolapa = (nombre) => {
          const b = document.querySelector(`.solapa[data-solapa="${nombre}"]`);
          if(b) b.click();
        };
        const tender = (red) => {
          abrirSolapa('mapa');
          estado.redActual = red;
          estado.modo = { tipo: 'tuberia', elemento: null, trazado: [] };
          ui.invalidarCache();
          ui.refrescarConstruccion(estado);
        };
        const colocar = (pieza) => {
          abrirSolapa('mapa');
          estado.modo = { tipo: 'colocar', elemento: pieza, trazado: [] };
          ui.refrescarConstruccion(estado);
        };
        switch(a.clave){
          case 'mejora':         abrirSolapa('pueblo'); break;
          case 'conectar':       tender('abastecimiento'); break;
          case 'pluviales':      tender('pluviales'); break;
          case 'residuos':       tender('residuos'); break;
          case 'depuradora':     colocar('depuradora'); break;
          case 'reciclaje':      colocar('reciclaje'); break;
          case 'potabilizadora': colocar('potabilizadora'); break;
          case 'calibre':        abrirSolapa('mapa'); break;
          case 'traslado':       abrirSolapa('comun'); break;
          case 'canon': {
            // Centrar el mapa en el vecino descubierto y dejarlo seleccionado:
            // su ficha, con el botón de abastecer, sale sola en el lateral
            const v = vecinoPendiente(estado);
            if(v){
              escena.centrarEn(estado, v.col, v.fila);
              estado.seleccion = { col: v.col, fila: v.fila };
              ui.invalidarCache();
            }
            break;
          }
        }
        break;
      }

      /* --- LA RUTA DE VERDAD, desde el vertedero: con premio a la recogida --- */

      case 'rutaCamion': {
        const K = CONFIG.minijuegos.camion;
        if(estado.rutaCamion && estado.horas < estado.rutaCamion.hasta){
          avisar(t`La ruta ya está echada: espera a que venza el bono.`);
          break;
        }
        analitica.contar('minijuego/camion');
        miniCamion.jugar((aciertos, total, razon) => {
          if(razon === 'abandonado') return;
          const punteria = total ? aciertos / total : 0;
          const factor = 1 + K.bonusMax * punteria;
          estado.rutaCamion = { hasta: estado.horas + K.horasBonus, factor };
          estado.anotar(t`Ruta del camión: ${aciertos} de ${total} contenedores.
                        La recogida sube un ${Math.round((factor - 1) * 100)} % una temporada.`, 'ok');
          avisar(t`¡Ruta hecha! Recogida +${Math.round((factor - 1) * 100)} %.`);
          if(punteria > 0.7){ sonido.reparada(); ui.caraGuia('bien'); }
          ui.invalidarCache();
        });
        break;
      }

      // El panel ya no repara: lleva hasta la avería. Arreglarla es ir y clicar.
      case 'irAAveria': {
        const av = estado.averias[parseInt(a.clave, 10)] || estado.averias[0];
        if(!av) break;
        escena.centrarEn(estado, av.col, av.fila);
        estado.seleccion = { col: av.col, fila: av.fila };
        avisar(t`Ahí la tienes: clica encima hasta dejarla arreglada.`);
        break;
      }

      case 'limpiarCauce':
        estado.contaminacion = Math.max(0, estado.contaminacion - CONFIG.cauce.limpiezaPorClic);
        escena.destelloCauce();
        break;

      /* --- LUGARES: nombres de la zona del jugador, si él quiere --- */

      case 'usarLugares': {
        avisar(t`Pidiendo la ubicación al navegador…`);
        // Asíncrono de verdad (permiso + consulta): el juego sigue corriendo
        // y el resultado se anuncia cuando llega.
        (async () => {
          try{
            const pos = await pedirUbicacion();
            avisar(t`Preguntando a OpenStreetMap por tu comarca…`);
            const nombres = await buscarNombres(pos);
            if(!nombres.length){
              avisar(t`El mapa no da nombres por tu zona: se quedan los inventados.`);
              return;
            }
            guardarNombres(nombres);
            estado.anotar(t`Pueblos de tu zona activados: ${nombres.length} nombres,
                          empezando por ${nombres.slice(0, 3).join(', ')}.`, 'ok');
            avisar(t`¡Hecho! Los pueblos por descubrir llevarán nombres de tu comarca.`);
            ui.invalidarCache();
          }catch(err){
            avisar(err.message || t`No se ha podido: se quedan los nombres inventados.`);
          }
        })();
        break;
      }

      case 'quitarLugares':
        quitarLugares();
        ui.invalidarCache();
        avisar(t`Nombres inventados de vuelta.`);
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
  const tipoA = tipoYacimiento(celdaEn(estado.mapa, col, fila));
  // La primera vez, tarjeta: qué es y qué se hace — con la lámina del tipo
  contarHito('arqueologia', `assets/a_${tipoA.id}.jpg`);
  estado.seleccion = { col, fila };
  estado.modo.trazado = [];
  estado.anotar(t`¡${tipoA.nombre} al excavar! No se puede construir ahí: hay que rodearlo.`, 'alarma');
  avisar(t`¡${tipoA.nombre}! Rodéalo... o excávalo y ponlo en valor.`);
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
  const veredicto = puedeColocar(estado.mapa, estado.construcciones, clave, col, fila,
                                 estado.pueblos.length);
  if(!veredicto.ok){ avisar(veredicto.motivo); return; }

  // Si viene del inventario ya está pagada: se rescató de una ruina
  const deInv = estado.modo.deInventario;
  if(deInv === false){
    if(!estado.puedePagar(def.coste)){
      avisar(t`Sin fondos: ${def.nombre.toLowerCase()} cuesta ${formatear(def.coste)} €.`);
      return;
    }
    estado.pagar(def.coste);
    estado.anotar(t`${def.nombre} construido por ${formatear(def.coste)} €.`, 'ok');
  } else {
    estado.inventario.splice(deInv, 1);
    estado.anotar(t`${def.nombre} del almacén, colocado.`, 'ok');
    estado.modo = { tipo: null, elemento: null, trazado: [], deInventario: false };
  }
  estado.construcciones.push({ tipo: clave, col, fila, nivel: 1,
                               nombre: bautizarObra(estado.construcciones, clave) });
  // Los guiños de la escena, al colocar la PRIMERA pieza de cada tipo (antes
  // vivían en la tienda, que murió con la cirugía)
  if(estado.construcciones.filter(o => o.tipo === clave).length === 1){
    if(clave === 'deposito' && escena.aparecerDeposito) escena.aparecerDeposito();
    if(clave === 'captacion' && escena.aparecerCaptacion) escena.aparecerCaptacion();
    if(clave === 'depuradora' && escena.aparecerDepuradora) escena.aparecerDepuradora();
  }
  // Si queda SIN CONECTAR se dice en el acto (el autor colocó una
  // potabilizadora y nada le decía si había quedado enganchada): el mapa
  // además la pinta apagada y con su cartel hasta que le llegue la red.
  const redPieza = Object.keys(CONFIG.redes)
    .find(k => CONFIG.redes[k].piezas.includes(clave));
  if(redPieza && !casillaEnRed(estado, col, fila, redPieza))
    avisar(t`${def.nombre} SIN CONECTAR: llévale la ${CONFIG.redes[redPieza].corto} para que trabaje.`);
  sonido.colocar();
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

  if(!estado.puedePagar(coste)){ avisar(t`Hacen falta ${formatear(coste)} €.`); return; }

  if(!desmontar){
    // Reparar en el sitio exige que el terreno le sirva a esa pieza — y cupo
    // libre: una obra rescatada también es una obra. Si no hay cupo, al
    // almacén: guardada no gasta y espera al siguiente pueblo.
    const v = puedeColocar(estado.mapa, estado.construcciones, tipo, sel.col, sel.fila,
                           estado.pueblos.length);
    if(!v.ok){
      avisar(t`No se puede poner en marcha aquí: ${v.motivo} Prueba a desmontarla.`);
      return;
    }
    estado.pagar(coste);
    estado.construcciones.push({ tipo, col: sel.col, fila: sel.fila, nivel: 1,
                                 nombre: bautizarObra(estado.construcciones, tipo) });
    estado.anotar(t`${def.nombre} recuperado y puesto en marcha por ${formatear(coste)} €.`, 'ok');
  } else {
    estado.pagar(coste);
    estado.inventario.push({ tipo });
    estado.anotar(t`${def.nombre} desmontado y guardado en el almacén.`, 'ok');
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
  sonido.tramo();
}

function rematarTuberia(){
  const trazado = estado.modo.trazado;
  if(trazado.length < 2){ avisar(t`Una tubería necesita al menos dos casillas.`); return; }
  const red = estado.redActual, dn = estado.dnActual[red];
  const coste = costeTrazado(estado.mapa, trazado, dn, red);
  if(!estado.puedePagar(coste)){
    avisar(t`Ese trazado cuesta ${formatear(coste)} € y no hay fondos.`);
    return;
  }
  estado.pagar(coste);
  estado.tuberias.push({ camino: trazado.slice(), coste, dn, red,
                         nacida: estado.horas });
  estado.anotar(t`${CONFIG.redes[red].nombre}: ${diametro(dn, red).nombre} de
                ${trazado.length} casillas por ${formatear(coste)} €.`, 'ok');
  estado.modo.trazado = [];
  sonido.rematar();
}

/**
 * Al destapar una casilla se cuenta lo que había. Los hallazgos son el motivo
 * de explorar: sin esto, ampliar terreno sería solo gastar clics.
 */
function anunciarHallazgo(celda, col, fila){
  estado.descubiertas++;
  // LOS YACIMIENTOS AFLORAN AL DESTAPAR (petición del autor: cuando solo
  // afloraban al picar para construir, el 95% no se veía jamás — en la
  // mayoría de las casillas nunca se coloca nada encima).
  if(celda.arqueologia && !celda.aflorado){
    aflorarArqueologia(estado.mapa, col, fila);
    const tipoA = tipoYacimiento(celda);
    contarHito('arqueologia', `assets/a_${tipoA.id}.jpg`);
    estado.anotar(t`¡${tipoA.nombre} bajo la tesela! Excávalo y ponlo en valor, o rodéalo.`, 'ok');
    avisar(t`¡Ha aflorado: ${tipoA.nombre}!`);
    sonido.hallazgo();
  }
  if(!celda.hallazgo) return;
  // Un PUEBLO no es un aviso más: es EL premio del mapa. Tarjeta con su
  // estampa, sus vecinos pidiendo el agua, y fanfarria propia (petición del
  // autor). Sale cada vez — descubrir 36 pueblos son 36 momentos.
  if(celda.hallazgo === 'pueblo'){
    mostrarDescubierto(celda, col, fila);
    return;
  }
  // La primera ruina merece su tarjeta: qué es y qué decisión trae — con la
  // lámina de la instalación abandonada concreta que acaba de aparecer
  if(celda.hallazgo === 'ruina')
    contarHito('ruina', `assets/f_${piezaDeRuina(celda)}_ruina.jpg`);
  const textos = {
    ruina:      t`Instalación abandonada. Se podrá reparar o llevar al inventario.`,
    senal:      t`Una señal de camino: apunta al pueblo más cercano por descubrir.`,
  };
  if(!textos[celda.hallazgo]) return;
  estado.anotar(textos[celda.hallazgo], 'ok');
  avisar(textos[celda.hallazgo]);
  sonido.hallazgo();
}

/** La tarjeta del pueblo descubierto: estampa, nombre y el ruego de sus
 *  vecinos. La estampa es la del ESCALÓN que le toca por tamaño sembrado. */
function mostrarDescubierto(celda, col, fila){
  const hab = Math.round(celda.habIni || CONFIG.nucleos.habitantesMin);
  const esc = escalonCaserio(hab);
  const nombre = nombreDeNucleo(celda.nombreIdx || 0);
  const img = document.getElementById('desc-img');
  img.hidden = false;
  img.onerror = () => { img.hidden = true; };
  img.src = `assets/f_${esc.nombre}.jpg`;
  document.getElementById('desc-titulo').textContent = t`¡Has encontrado ${nombre}!`;
  // El artículo con género viaja como valor: en inglés la frase lo ignora.
  document.getElementById('desc-texto').textContent =
    t`${esc.art === 'una' ? 'Una' : 'Un'} ${esc.titulo} de ${hab.toLocaleString('es-ES')}
      habitantes, a ${Math.round(distancia(col, fila))} casillas de tu red.`;
  document.getElementById('desc-ruego').textContent =
    t`Sus vecinos salen a recibirte: «Llevamos toda la vida esperando.
      Por favor... ¡traednos el agua!»`;
  document.getElementById('descubierto-fondo').hidden = false;
  estado.anotar(t`Descubierto ${nombre}: ${hab.toLocaleString('es-ES')} habitantes esperando agua.`, 'ok');
  sonido.descubierto();
  analitica.contar('pueblo-descubierto');
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
    const nivel = estado.cuadrilla || 0;   // la cuadrilla común (la cirugía)
    if(nivel <= 0) continue;
    const tiempo = A.reparacionAutoHoras * Math.pow(A.reparacionAutoFactor, nivel - 1);
    if(estado.horas - av.desde >= tiempo){
      estado.averias.splice(i, 1);
      estado.anotar(t`El equipo de mantenimiento termina una reparación.`, 'ok');
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
            (((estado._conectado || {}).captacion || 0) + (p.autobombaActivo ? A.riesgoAutobomba : 0));
  if(Math.random() >= riesgo) return;

  const victima = sanas[Math.floor(Math.random() * sanas.length)];
  const def = CONFIG.construibles[victima.tipo];
  estado.averias.push({
    col: victima.col, fila: victima.fila,
    clics: clicsDeReparacion(), desde: estado.horas
  });
  estado.anotar(t`Avería: ${def.nombre} fuera de servicio hasta que lo repares.`, 'critico');
  avisar(t`¡Avería en ${def.nombre}! Ve al mapa y clica encima.`);
  sonido.averia();
  ui.caraGuia('mal');
  contarHito('averia');   // la primera, con tarjeta: qué ha pasado y qué se hace
}

/* La avería cuya elección está en pantalla ahora mismo (tarjeta) */
let averiaEnEleccion = null;

/** La tarjeta de elección: jugarse el arreglo gratis o ir a la llave. */
function mostrarEleccionAveria(av, coste){
  // Cerrar tocando el fondo: sin elegir no se recuerda nada y el siguiente
  // clic vuelve a preguntar. Se engancha una sola vez, perezoso.
  const fondo = document.getElementById('eleccion-fondo');
  if(!fondo.dataset.conCierre){
    fondo.dataset.conCierre = '1';
    fondo.addEventListener('click', e => { if(e.target === fondo) cerrarEleccion(); });
  }
  averiaEnEleccion = av;
  const juego = minijuegoDeAveria(av);
  const nombreJuego = juego === 'reciclaje' ? t`un turno en la cinta`
                    : juego === 'camion' ? t`una ruta con el camión`
                    : t`el tablero de tuberías`;
  document.getElementById('eleccion-titulo').textContent = t`¿Cómo la arreglamos?`;
  document.getElementById('eleccion-texto').textContent =
    t`Puedes jugarte el arreglo GRATIS con ${nombreJuego} — un solo intento — o
      ir a golpe de llave: ${av.clics} golpes a ${formatear(coste)} € cada uno.`;
  document.getElementById('eleccion-jugar').textContent = t`Me la juego`;
  document.getElementById('eleccion-llave').textContent = t`A golpe de llave`;
  document.getElementById('eleccion-fondo').hidden = false;
}

function cerrarEleccion(){
  document.getElementById('eleccion-fondo').hidden = true;
  averiaEnEleccion = null;
}

/** Qué minijuego arregla cada avería: EL DE SU SERVICIO. Las piezas de las
 *  redes de tubo van al tablero de tuberías; las de residuos, a lo suyo — la
 *  planta a la cinta y el vertedero a la ruta del camión. */
function minijuegoDeAveria(av){
  const obra = estado.construcciones.find(o => o.col === av.col && o.fila === av.fila);
  if(!obra) return 'tuberias';
  if(obra.tipo === 'reciclaje') return 'reciclaje';
  if(obra.tipo === 'vertedero') return 'camion';
  return 'tuberias';
}

/**
 * Jugarse el arreglo de una avería al minijuego de su servicio. El intento se
 * gasta al ENTRAR — abandonar también cuenta, que mirar ya es ventaja — y el
 * premio es SOLO el arreglo gratis: nada de bonos, que tienen su puerta.
 */
function jugarAveria(av){
  av.aManoJugada = true;
  const juego = minijuegoDeAveria(av);
  analitica.contar('minijuego/' + juego + (juego === 'tuberias' ? '' : '-averia'));
  ui.invalidarCache();

  const arreglada = () => {
    const i = estado.averias.indexOf(av);
    if(i >= 0) estado.averias.splice(i, 1);
    const obra = estado.construcciones.find(o => o.col === av.col && o.fila === av.fila);
    const nombre = obra ? CONFIG.construibles[obra.tipo].nombre : t`La instalación`;
    estado.anotar(t`${nombre}: reparación a mano impecable. Ni un euro en llaves.`, 'ok');
    avisar(t`¡En servicio! Reparada a mano, gratis.`);
    sonido.reparada();
    ui.caraGuia('bien');
    escena.destelloMantenimiento();
    ui.invalidarCache();
  };
  const fallada = (texto) => {
    estado.anotar(texto, 'alarma');
    avisar(t`No ha bastado: a golpe de llave, como toda la vida.`);
    sonido.seco();
    ui.caraGuia('mal');
  };

  if(juego === 'tuberias'){
    miniTuberias.jugar((exito, razon) => {
      if(exito) arreglada();
      else if(razon === 'derrame')
        fallada(t`El agua llegó antes que tú: esa avería ya solo se arregla con la llave.`);
    });
  } else {
    // La cinta o la ruta: se arregla gratis con puntería suficiente.
    // El listón sube con la práctica: rodaje primero, veteranía después.
    const K = CONFIG.minijuegos.averia;
    const veces = (estado.reparacionesJugadas || {})[juego] || 0;
    const minimo = veces < K.partidasFaciles ? K.punteriaMinima : K.punteriaVeterana;
    if(!estado.reparacionesJugadas) estado.reparacionesJugadas = { reciclaje: 0, camion: 0 };
    estado.reparacionesJugadas[juego] = veces + 1;   // se cuenta al entrar
    const mini = juego === 'reciclaje' ? miniReciclaje : miniCamion;
    mini.jugar((aciertos, total, razon) => {
      if(razon === 'abandonado') return;
      const punteria = total ? aciertos / total : 0;
      if(punteria >= minimo) arreglada();
      else fallada(t`El turno salió flojo (${aciertos} de ${total}): esa avería ya solo se arregla con la llave.`);
    });
  }
}

/** Golpes de llave que pide una avería. El personal contratado deja menos faena. */
function clicsDeReparacion(){
  const A = CONFIG.averias;
  const nivel = estado.cuadrilla || 0;   // la cuadrilla común (la cirugía)
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

  // LA ELECCIÓN EN EL SITIO (petición del autor): el PRIMER clic sobre la
  // avería pregunta si prefieres jugarte el arreglo gratis, antes de empezar
  // a pagar llaves. Con TARJETA del juego, no con confirm() — el diálogo
  // nativo del navegador ("localhost dice...") rompía la estética entera y
  // el autor lo vetó con captura en mano. Elegir la llave se recuerda en la
  // avería (elegidoLlave, viaja en el guardado); cerrar sin elegir (Escape o
  // clic fuera) no se recuerda: el siguiente clic vuelve a preguntar.
  if(!av.aManoJugada && !av.elegidoLlave){
    mostrarEleccionAveria(av, coste);
    return true;
  }
  if(!estado.puedePagar(coste)){
    avisar(t`Cada golpe de llave cuesta ${formatear(coste)} € y no hay fondos.`);
    return true;
  }
  estado.pagar(coste);
  av.clics--;
  sonido.llave();
  if(av.clics > 0){
    avisar(t`Reparando... quedan ${av.clics} (−${formatear(coste)} €)`);
    return true;
  }
  estado.averias.splice(estado.averias.indexOf(av), 1);
  sonido.reparada();
  const obra = estado.construcciones.find(o => o.col === col && o.fila === fila);
  const nombre = obra ? CONFIG.construibles[obra.tipo].nombre : t`La instalación`;
  estado.anotar(t`${nombre}: avería reparada, vuelve a estar en servicio.`, 'ok');
  avisar(t`¡Reparada! Vuelve a contar en la red.`);
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
    // El PRIMER crecimiento de la partida lleva tarjeta (petición del autor:
    // que la primera vez que pasa algo nuevo se explique qué está pasando).
    // contarHito ya garantiza que es una sola vez en toda la partida.
    const nivelAhora = nivelCaserio(ahora), nivelAntes = nivelCaserio(antes);
    if(ahora > antes)
      contarHito('crecimiento',
        `assets/f_${CONFIG.caserio.escalones[nivelAhora].nombre}.jpg`);
    // La línea de cada centena se calla si en este mismo paso hay cambio de
    // escalón: el aviso de escalón ya dice el número, y dos líneas seguidas
    // contando lo mismo ensucian el registro.
    if(Math.floor(ahora / 100) !== Math.floor(antes / 100) && nivelAhora === nivelAntes){
      estado.anotar(ahora > antes
        ? t`${p.nombre} crece: ${ahora.toLocaleString('es-ES')} habitantes.`
        : t`${p.nombre} pierde población: ${ahora.toLocaleString('es-ES')} habitantes.`,
        ahora > antes ? 'ok' : 'alarma');
    }
    /* CAMBIO DE ESCALÓN: de aldea a pueblo, de pueblo a villa... Es el premio
       del bucle central (servir bien → crecer) y hasta ahora era invisible: el
       caserío se dibujaba igual con 200 habitantes que con 6.000.
       Se anuncia como un GUIÑO y no como una tarjeta a pantalla completa: los
       hitos paran el juego porque son cuatro en toda la partida, y esto pasa
       muchas veces. Destello sobre la casilla, sonido y una línea. */
    if(nivelAhora !== nivelAntes){
      const esc = CONFIG.caserio.escalones[nivelAhora];
      const crece = nivelAhora > nivelAntes;
      // El artículo (esc.art) viaja como valor: la frase inglesa lo ignora.
      estado.anotar(crece
        ? t`${p.nombre} ya es ${esc.art} ${esc.titulo}: ${ahora.toLocaleString('es-ES')} habitantes.`
        : t`${p.nombre} vuelve a ser ${esc.art} ${esc.titulo}: la población se va.`,
        crece ? 'ok' : 'alarma');
      avisar(crece ? t`¡${p.nombre} ya es ${esc.art} ${esc.titulo.toUpperCase()}!`
                   : t`${p.nombre} encoge: vuelve a ser ${esc.art} ${esc.titulo}.`);
      if(crece){
        sonido.pueblo();
        // El destello va en coordenadas de PANTALLA, así que hay que traducir
        // la casilla del pueblo con la cámara de este momento. (tam, no t: la
        // t es la etiqueta de traducción y aquí taparla rompería las frases.)
        const tam = escena.tam;
        escena.destello(p.col * tam - estado.camara.x + tam / 2,
                        p.fila * tam - estado.camara.y + tam / 2);
      } else sonido.seco();
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
  // La foto de ANTES, para poder contar la diferencia al volver
  const antes = {
    dinero: estado.dinero,
    hab: estado.pueblos.reduce((a, p) => a + p.habitantes, 0),
    m3: estado.m3Servidos,
    cont: estado.contaminacion
  };
  // La foto de los habitantes, pueblo a pueblo: ver abajo — la noche no puede
  // despoblar.
  const habAntes = estado.pueblos.map(p => p.habitantes);
  let restante = aSimular;
  const paso = 30;
  while(restante > 0){
    avanzar(estado, Math.min(paso, restante));   // sin averías nuevas offline
    restante -= paso;
  }
  /* LA NOCHE NO DESPUEBLA (lo cazó el autor: jugabas un rato, volvías al día
     siguiente y habías perdido casi todos los habitantes — 8 horas reales son
     AÑOS de juego, y con el servicio a medias de una partida recién empezada
     la simulación vaciaba los pueblos). La regla: en tu ausencia los pueblos
     pueden CRECER si los dejaste bien servidos, pero nunca menguar — los
     vecinos no se van mientras duermes, aunque tampoco llega nadie nuevo si
     el grifo no daba. Las pérdidas de DINERO (multas, cauce) sí se pagan:
     la ausencia no es un escudo, pero tampoco un castigo por vivir. */
  estado.pueblos.forEach((p, i) => {
    if(p.habitantes < habAntes[i]) p.habitantes = habAntes[i];
  });
  // Sin nadie al mando, la explotación rinde MENOS: de la ganancia solo se
  // cobra una fracción. Las pérdidas (multas, cauce) se pagan enteras — la
  // ausencia no puede ser un escudo contra las consecuencias.
  let dinero = estado.dinero - antes.dinero;
  if(dinero > 0){
    const recorte = dinero * (1 - O.rendimiento);
    estado.dinero -= recorte;
    dinero -= recorte;
  }
  const minutos = Math.round(aSimular / 60);
  estado.anotar(t`Mientras no estabas (${minutos} min): ${dinero >= 0 ? '+' : ''}${formatear(dinero)} €.`, 'info');

  // La tarjeta, solo desde ausencias de verdad. El momento de volver es LA
  // razón de reabrir un incremental: merece contarse de frente, no en una
  // línea del registro que nadie encuentra.
  if(minutos >= O.tarjetaDesdeMinutos)
    mostrarVuelta({
      minutos, seg,
      horasJuego: aSimular * CONFIG.economia.horasPorSegundo,
      dinero,
      hab: estado.pueblos.reduce((a, p) => a + p.habitantes, 0) - antes.hab,
      m3: estado.m3Servidos - antes.m3,
      cont: estado.contaminacion - antes.cont
    });
}

// El tiempo también pasa con la pestaña ESCONDIDA. El navegador congela el
// bucle en segundo plano, así que sin esto, volver de otra aplicación —el caso
// NORMAL en el móvil— perdía todo el tiempo ausente salvo que recargaras: el
// cálculo offline solo corría al cargar la página. Al esconderse se sella el
// instante; al volver, se liquida la ausencia por el mismo camino que al abrir.
document.addEventListener('visibilitychange', () => {
  if(document.hidden){
    estado.guardar();
    sonido.pestanaOculta();   // el juego se para; la música no puede quedarse sonando
  } else {
    sonido.pestanaVisible();
    progresoOffline();
  }
});

/** Rellena y enseña la tarjeta de vuelta. Solo las líneas con algo que decir. */
function mostrarVuelta(r){
  const filas = [];
  const fila = (eti, valor, tono) =>
    filas.push(`<div class="vuelta-fila${tono ? ' ' + tono : ''}">
      <span>${eti}</span><b>${valor}</b></div>`);

  fila(t`La caja`, `${r.dinero >= 0 ? '+' : ''}${formatear(r.dinero)} €`,
       r.dinero >= 0 ? 'bien' : 'mal');
  if(r.dinero > 0)
    filas.push(`<p class="m-desc vuelta-nota">${t`Al ${Math.round(CONFIG.offline.rendimiento * 100)} %:
      sin nadie al mando, la explotación rinde lo justo.`}</p>`);
  if(Math.abs(r.hab) >= 1)
    fila(t`La población`, t`${r.hab >= 0 ? '+' : ''}${Math.round(r.hab)} habitantes`,
         r.hab >= 0 ? 'bien' : 'mal');
  if(r.m3 > 0.5) fila(t`Agua servida`, `${formatear(r.m3)} m³`);
  // El cauce solo se menciona si se ha movido de verdad en algún sentido
  const contPct = r.cont / CONFIG.cauce.contaminacionMax * 100;
  if(contPct > 2) fila(t`El cauce`, t`se ensució ${Math.round(contPct)} puntos`, 'mal');
  else if(contPct < -2) fila(t`El cauce`, t`se recuperó ${Math.round(-contPct)} puntos`, 'bien');

  // El tiempo FUERA es el real entero, no el simulado: decir "fuera 3 h" a
  // quien estuvo 5 es mentirle justo en la línea que explica el recorte.
  const minFuera = Math.round(r.seg / 60);
  const horas = Math.floor(minFuera / 60);
  const tiempoReal = horas > 0 ? `${horas} h ${minFuera % 60} min` : `${minFuera} min`;
  // El tiempo de juego, en el calendario DEL JUEGO (el año son 360 horas):
  // decir "961 horas" es verdad y no significa nada; "casi 3 años", sí.
  const años = r.horasJuego / CONFIG.tiempo.horasPorAño;
  const meses = Math.round(años * 12);
  const tiempoJuego = años >= 1
    ? t`${años.toFixed(años < 3 ? 1 : 0).replace('.', ',')} años`
    : años >= 1 / 12
      ? (meses === 1 ? t`1 mes` : t`${meses} meses`)
      : t`${Math.round(r.horasJuego)} horas`;
  // Si estuviste fuera más del tope, se dice: creer que se simuló todo y ver
  // menos dinero del esperado parecería un robo.
  const tope = r.seg > CONFIG.offline.maxHoras * 3600
    ? t` (se cuentan las primeras ${CONFIG.offline.maxHoras} h)` : '';
  document.getElementById('vuelta-tiempo').textContent =
    t`Fuera ${tiempoReal}${tope}: ${tiempoJuego} de juego.`;
  document.getElementById('vuelta-lineas').innerHTML = filas.join('');
  document.getElementById('vuelta-fondo').hidden = false;
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
function contarHito(id, imagen){
  if(!CONFIG.hitos[id]) return;
  if(estado.hitosVistos.includes(id)) return;
  estado.hitosVistos.push(id);
  estado.hitoPendiente = id;
  // La lámina del hallazgo CONCRETO que dispara la tarjeta (el yacimiento
  // aflorado, la ruina encontrada, el caserío que crece): sin ella se busca
  // la genérica h_<id>.jpg. Transitoria a propósito — hitoPendiente tampoco
  // sobrevive a una recarga.
  estado.hitoImagen = imagen || null;
  // Único embudo de hitos Y logros: el sonido de tarjeta va aquí y en ningún
  // otro sitio, así ningún momento suena dos veces.
  sonido.hito();
  // Y por lo mismo, el mejor sitio para contar hasta dónde llega la gente: los
  // hitos YA son la lista de momentos que importan. Sin instrumentar nada más.
  analitica.contar('hito/' + id);
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
let acumGuardado = 0, acumHUD = 0, acumManuel = 0;
let resultado = { servicio: 0, prodLps: 0, contaminacion: 0, suciedad: 0 };

function bucle(ahora){
  const dt = Math.min((ahora - ultimo) / 1000, 0.1);
  ultimo = ahora;

  procesarAcciones();
  resultado = avanzar(estado, dt);
  tickAverias(dt * CONFIG.economia.horasPorSegundo);

  // La guía avanza sola cuando el jugador consigue de verdad cada paso
  const pasoHecho = comprobarGuia(estado);
  if(pasoHecho){
    estado.anotar(t`Guía: ${pasoHecho.titulo} ✓`, 'ok');
    sonido.hallazgo();      // el paso conseguido se celebra, bajito
    ui.caraGuia('bien');    // ...y el guía lo celebra con la cara, si la tiene
    // Conectar la tubería al pueblo es EL momento del tutorial: se subraya
    // aparte del avance de la guía (petición del autor).
    if(pasoHecho.id === 'tuberia'){
      avisar(t`¡Conectado! El agua ya tiene camino hasta el pueblo.`);
      sonido.reparada();
    }
    // Y lee el paso NUEVO, si hay voz: el que acaba de aparecer en el bocadillo
    const siguiente = pasoActual(estado);
    if(siguiente) sonido.hablar(siguiente.titulo + '. ' + siguiente.texto, siguiente.id);
    else if(!pasoHecho.capitulo){
      // EL CIERRE: la guía se acababa y Manuel se iba sin despedirse — el
      // último paso merece enhorabuena y un empujón hacia lo que viene
      // (petición del autor). Sale como "Manuel dice", no como paso.
      // Solo para la guía INICIAL: los capítulos acaban con su ✓ y en paz.
      const c = CONFIG.cierreGuia;
      ui.mostrarComentario({ id: 'cierreGuia', texto: c.texto, animo: 'bien' });
      sonido.pueblo();
      sonido.hablar(c.texto, 'cierreGuia');
    }
  }
  anotarCrecimiento();

  // EL MÉRITO NO CADUCA: se registra la mejor veteranía alcanzada y el
  // traslado paga el máximo. Lo dijo el bot: en el juego largo los pueblos
  // menguan y la veteranía "de hoy" BAJA — quien se quedara más horas podía
  // acabar cobrando menos, que es un castigo por jugar. Con el máximo,
  // quedarse a criar villas siempre suma y una mala racha no roba lo ganado.
  estado.mejorVeterania = Math.max(estado.mejorVeterania || 0,
                                   veteraniaAlTrasladarse(estado));

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
    estado.anotar(t`Lixiviados en una zona protegida: multa del Estado mientras dure el daño.`, 'critico');
    avisar(t`¡Multa! Tus lixiviados han alcanzado una zona de especial conservación.`);
  } else if(resultado.celdasProtegidasSucias === 0){
    multaZECAvisada = false;
  }

  // El acuífero bajando es lo ÚNICO que no se ve en ninguna parte: no hay
  // avería, ni multa, ni humo. Solo el pozo dando cada vez menos. Si no se
  // cuenta, el jugador ve caer la producción y no entiende por qué.
  for(const av of resultado.avisosAcuifero || []){
    estado.anotar(t`El nivel del ${av.clase.nombre.toLowerCase()} está bajando:
      ${av.pozos} pozos sacan más de lo que entra.`, 'alarma');
    avisar(t`El acuífero se está agotando: sacas más agua de la que se repone.`);
  }
  if(resultado.saneamientoNuevo && resultado.saneamientoNuevo.length){
    for(const nombre of resultado.saneamientoNuevo){
      estado.anotar(t`${nombre} genera aguas residuales. Vigila el cauce y piensa en una depuradora.`, 'alarma');
      avisar(t`${nombre} ya vierte al cauce. Sin depuradora, contaminas.`);
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

  // El ambiente de lluvia sigue a la intensidad real: el otoño se OYE.
  sonido.ambiente(resultado.lluvia || 0);

  // Manuel bota mientras suena su voz: la animación sigue al audio real
  ui.marcarHablando(sonido.estaHablando());

  // Manuel mira la partida cada pocos segundos, y solo habla si hay algo QUE
  // decir y nada más importante en pantalla (tarjetas, minijuego, portada).
  acumManuel += dt;
  if(acumManuel > 3){
    acumManuel = 0;
    if(document.getElementById('portada').hidden
       && document.getElementById('minijuego').hidden
       && document.getElementById('vuelta-fondo').hidden
       && document.getElementById('descubierto-fondo').hidden){
      const com = comentar(estado, resultado, ahora / 1000);
      if(com){
        ui.mostrarComentario(com);
        sonido.comentario();
        sonido.hablar(com.texto, com.id);
      }
    }
  }

  escena.dibujar(estado, resultado, dt);
  requestAnimationFrame(bucle);
}

/* ==================================================================
   BOTONES GENERALES
   ================================================================== */

document.getElementById('btn-reiniciar').onclick = () => {
  if(!confirm(CONFIG.textos.confirmarReinicio)) return;
  // OJO: el sello del adiós (visibilitychange → guardar) RESUCITABA la partida
  // recién borrada al recargar. Se anula el guardado antes de borrar: esta
  // página ya no tiene nada que decir.
  estado.guardar = () => {};
  Estado.borrar();
  borrarLegado();   // empezar de cero significa DE CERO; trasladarse es lo otro
  location.reload();
};

// EL ENGRANAJE: las opciones viven plegadas en un botón. Se cierra al tocar
// fuera o al elegir cualquier opción — como en cualquier juego.
const btnAjustes = document.getElementById('btn-ajustes');
const menuAjustes = document.getElementById('menu-ajustes');
btnAjustes.onclick = (e) => {
  e.stopPropagation();
  menuAjustes.hidden = !menuAjustes.hidden;
};
document.addEventListener('click', (e) => {
  if(!menuAjustes.hidden && !menuAjustes.contains(e.target)) menuAjustes.hidden = true;
});

// EL ESCAPE DEL DEDO: el botón flotante que cancela la herramienta armada.
// Hace lo mismo que la tecla Esc; en el móvil no hay otra salida a mano.
document.getElementById('btn-cancelar-modo').onclick = () => {
  estado.modo = { tipo: null, elemento: null, trazado: [] };
  ui.refrescarConstruccion(estado);
};

// El interruptor del sonido. La preferencia sobrevive al Reiniciar: va en su
// propia clave de localStorage, no en el guardado de la partida.
const btnSonido = document.getElementById('btn-sonido');
const rotularSonido = () => { btnSonido.textContent = sonido.activo() ? CONFIG.textos.sonidoSi : CONFIG.textos.sonidoNo; };
btnSonido.onclick = () => { sonido.alternar(); rotularSonido(); };
rotularSonido();

// EL IDIOMA. El rótulo enseña el idioma al que CAMBIAS, escrito en ese
// idioma: lo entiende justo quien lo necesita. El de la portada existe
// porque ahí es donde el visitante decide si se queda; nace oculto para que
// una muerte de módulos no deje un botón muerto.
const btnIdioma = document.getElementById('btn-idioma');
btnIdioma.textContent = idiomaActual() === 'es' ? 'English' : 'Español';
btnIdioma.onclick = cambiarIdioma;
const portadaIdioma = document.getElementById('portada-idioma');
portadaIdioma.textContent = idiomaActual() === 'es' ? 'Play in English' : 'Jugar en español';
portadaIdioma.onclick = cambiarIdioma;
portadaIdioma.hidden = false;

// LA MÚSICA. El botón solo existe si hay archivo (assets/musica.*): un mando
// que no manda nada es peor que ningún mando. Y no puede empezar a sonar hasta
// el primer gesto — el navegador bloquea el audio antes—, así que el arranque
// espera al primer toque o tecla, una sola vez.
const btnMusica = document.getElementById('btn-musica');
const rotularMusica = () => { btnMusica.textContent = sonido.musicaActiva() ? CONFIG.textos.musicaSi : CONFIG.textos.musicaNo; };
btnMusica.onclick = () => { sonido.alternarMusica(); rotularMusica(); };

// LA VOZ DE MANUEL. El botón solo existe si hay voz en español en la máquina
// —un mando que no manda nada es peor que ningún mando— y arranca APAGADA:
// quien la quiera la enciende una vez y la preferencia se queda.
const btnVoz = document.getElementById('btn-voz');
const rotularVoz = () => { btnVoz.textContent = sonido.vozActiva() ? CONFIG.textos.vozSi : CONFIG.textos.vozNo; };
btnVoz.onclick = () => {
  const encendida = sonido.alternarVoz();
  rotularVoz();
  // Que se presente al encenderla: confirma que suena y de paso da la mano
  if(encendida) sonido.hablar(CONFIG.sonido.voz.presentacion, 'presentacion');
};
sonido.cargarVoz().then(hay => {
  // `hay` ya es del idioma de la partida: cargarVoz sondea el archivo de la
  // presentación TRADUCIDA y busca respaldo en esa lengua. Sin voces
  // inglesas generadas ni sintetizador inglés, el botón no existe.
  if(!hay) return;
  btnVoz.hidden = false;
  rotularVoz();
});
sonido.cargarMusica().then(hay => {
  if(hay){
    btnMusica.hidden = false;
    rotularMusica();
  }
  // El primer gesto (normalmente el botón de la portada) dispara el ARRANQUE:
  // el jingle de la intro y, al acabar, la música barajada. Va FUERA del
  // `if(hay)`: sin canciones, la fanfarria de código suena igual.
  const arrancar = () => sonido.arranque();
  window.addEventListener('pointerdown', arrancar, { once: true });
  window.addEventListener('keydown', arrancar, { once: true });
});

// El contador de visitas y vueltas. Sin cuenta configurada no hace nada.
analitica.iniciar();
// Cuántos juegan en inglés: es el dato que decide si la traducción avanza.
if(idiomaActual() === 'en') analitica.contar('idioma/en');

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
  estado, entrada, escena, ui, CONFIG, miniTuberias, miniReciclaje, miniCamion,
  dinero: n => { estado.dinero = n; },
  agua: n => { estado.activo.agua = n; },
  // Para el autor: excluir su navegador de la analítica (y revertirlo)
  noContarme: analitica.noContarme,
  contarme: analitica.contarme,
  // Jugando en inglés: las frases que aún salen en castellano por no tener
  // entrada en el diccionario. La misma lista, sin jugar: py assets/extraer_frases.py
  sinTraducir
};

requestAnimationFrame(bucle);
