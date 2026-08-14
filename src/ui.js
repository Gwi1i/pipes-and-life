/**
 * UI — todo lo que es DOM, fuera de la escena.
 *
 * El canvas se repinta 60 veces por segundo; el DOM solo se toca cuando algo
 * cambia de verdad, porque tocarlo es caro. De ahí el pequeño caché.
 *
 * Multi-pueblo: las pestañas cambian el pueblo activo; la tienda, el panel de
 * detalle y las averías se refieren SIEMPRE al pueblo activo. La caja, el reloj
 * y el cauce (contaminación) son comunes a la mancomunidad.
 */

import { CONFIG } from './config.js';
import { capacidad, demandaMedia, caudalCaptacion, costeMejora,
         requisitosAutobomba, capacidadTanque, nombreEstacion,
         poderExpansion, redEstrangula, capacidadTratamiento,
         servicioActivo, nivelReciclaje, fraccionesActivas,
         faseActual, faltanParaFase, canonIncorporacion,
         llenadoVaso, capacidadVaso, costeAmpliarVertedero,
         nivelMasa, pozosPorMasa, caudalPozo, caudalSostenible,
         desgloseProduccion, tasaFugasRed, costeAmpliarPieza,
         escalonCaserio, costeEstudio, veteraniaAlTrasladarse } from './simulacion.js';
import { legado, nivelVentaja, costeVentaja, regionActual,
         epocaActual } from './legado.js';
import { formatear } from './util.js';
import { celdaEn, piezaDeRuina, diametro, nivelDiametro, costeRenovar,
         nombreDeNucleo, tipoYacimiento, nucleoMasCercano,
         costeCasillaTuberia, puedeColocar,
         lineasConectadas, cuelloDeBotella, escalaDeRed,
         claseAcuifero, puedeSondear, costeSondeo,
         masasDelMapa, edadAños, fugasDe,
         nombreDeObra, averiaEn, casillaEnRed,
         lineasEnCasilla, redDe, costeTrazado } from './mapa.js';
import { lista as listaLugares } from './lugares.js';
import { pasoActual } from './tutorial.js';
import { dibujarDiagrama, hayDiagrama } from './diagramas.js';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export class UI {

  constructor(entrada){
    this.entrada = entrada;
    this.cache = {};
    this.mejoras = Object.entries(CONFIG.mejoras)
      .sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0));
    this.construirTienda();
    this.construirPremium();
    this.construirPaletaObra();
  }

  /* ---------------- CONSTRUIR EN EL MAPA ---------------- */

  /**
   * La paleta de obra, AGRUPADA POR RED. Era una lista plana de ocho piezas más
   * el botón de tender, y ahí dentro convivían el bombeo, la depuradora y el
   * vertedero como si fueran lo mismo. Ahora cada red trae sus piezas y su
   * botón de tender justo debajo, que es como se usan: eliges red, colocas lo
   * suyo y tiendes lo suyo.
   */
  construirPaletaObra(){
    const cont = document.getElementById('construir');
    if(!cont) return;

    cont.innerHTML = Object.entries(CONFIG.redes).map(([clave, r]) => {
      const piezas = (r.piezas || [])
        .filter(k => CONFIG.construibles[k])
        .map(k => {
          const d = CONFIG.construibles[k];
          return `
            <button class="mejora obra" data-accion="elegirConstruible" data-clave="${k}"
                    id="obra-${k}" style="--tono:${d.color}">
              <span class="m-cab"><span class="m-nom">${d.nombre}</span>
                <span class="m-coste">${formatear(d.coste)} €</span></span>
              <span class="m-desc">${d.desc}</span>
            </button>`;
        }).join('');

      return `
        <div class="servicio red-obra" id="obra-red-${clave}" style="--tono:${r.color}">
          <p class="sv-cab"><span class="sv-nom">${r.nombre}</span></p>
          ${piezas}
          <button class="mejora obra tender" data-accion="elegirRedYTender" data-clave="${clave}"
                  id="tender-${clave}" style="--tono:${r.color}">
            <span class="m-cab"><span class="m-nom">Colocar ${r.corto}</span>
              <span class="m-coste" id="tender-coste-${clave}">—</span></span>
            <span class="m-desc">Marca el recorrido casilla a casilla. Clic en la
              última para rematar, en la anterior para deshacer.</span>
          </button>
        </div>`;
    }).join('');
  }

  /** Oculta las redes cuyo servicio aún no está en marcha. */
  refrescarPaletaObra(estado){
    const p = estado.activo;
    for(const [clave, r] of Object.entries(CONFIG.redes)){
      const caja = document.getElementById('obra-red-' + clave);
      if(!caja) continue;
      const abierta = !r.requiere || servicioActivo(p, r.requiere);
      caja.style.display = abierta ? '' : 'none';
      const etq = document.getElementById('tender-coste-' + clave);
      if(etq && abierta) etq.textContent = diametro(estado.dnActual[clave], clave).nombre;
    }
  }

  /* ---------------- LA RED: DIÁMETROS Y RENOVACIÓN ---------------- */

  /**
   * Qué diámetro manda, qué tope de población impone y qué líneas hay que
   * renovar. El panel entero existe para responder a una pregunta que si no
   * parece un fallo: "¿por qué ha dejado de crecer mi pueblo?".
   */
  refrescarRed(estado, resultado){
    const clave = estado.redActual;
    const R = CONFIG.redes[clave];
    const D = escalaDeRed(clave);
    const cuello = cuelloDeBotella(estado, clave);
    const lineas = lineasConectadas(estado, clave);
    const p = estado.activo;
    const objetivo = diametro(estado.dnActual[clave], clave);
    // Las pluviales no existen hasta que se abre el tercer pueblo
    // Una red solo se ofrece cuando su servicio está en marcha
    const disponibles = Object.entries(CONFIG.redes)
      .filter(([, r]) => !r.requiere || servicioActivo(p, r.requiere));

    // La firma lleva BANDERAS, no los textos: los avisos del saneamiento llevan
    // caudales que cambian cada fotograma, y meterlos aquí reconstruía el panel
    // entero 10 veces por segundo.
    const firma = [clave, disponibles.length, estado.dnActual[clave], cuello.dn, lineas.length,
                   Math.round((resultado.lluviaLh || 0) / 500),
                   // En décimas: el porcentaje de basura en la calle sale en el
                   // aviso, y sin esto se quedaba congelado en el primer valor.
                   Math.round((resultado.basuraCalle || 0) * 10),
                   !!resultado.rebosando, !!resultado.aliviando,
                   redEstrangula(p, estado),
                   p.habitantes >= cuello.def.habitantesMax * 0.95,
                   !!(estado._conectadoSan || {}).depuradora,
                   lineas.map(l => l.tuberia.dn).join(''),
                   // La edad entra en la firma: sin ella el panel se quedaría
                   // enseñando "39 años" para siempre
                   lineas.map(l => Math.floor(edadAños(l.tuberia, estado.horas))).join(',')].join('|');
    if(this.cache.redFirma === firma) return;
    this.cache.redFirma = firma;

    // Pestañas: se trabaja sobre UNA red cada vez. Mezclarlas en una sola lista
    // era un lío: no se sabía si el tramo que ibas a renovar llevaba agua limpia
    // o sucia.
    const pestanas = disponibles.map(([k, r]) => `
      <button class="red-tab${k === clave ? ' activa' : ''}"
              data-accion="elegirRed" data-clave="${k}" style="--tono:${r.color}">
        ${r.nombre}</button>`).join('');

    const selector = D.map(d => `
      <button class="dn${d.id === objetivo.id ? ' activa' : ''}"
              data-accion="elegirDiametro" data-clave="${d.id}" style="--tono:${d.color}">
        <b>${d.nombre}</b>
        <em>${d.material}</em>
        <i>${this.medidaTier(clave, d)} · ${Math.round(d.fugas * 100)} % fugas</i>
      </button>`).join('');

    const listado = !lineas.length
      ? `<p class="m-desc">${clave === 'saneamiento'
          ? `Todavía no hay colector. El pueblo se apaña con la red unitaria vieja:
             ${D[0].nombre} de ${D[0].material}, y todo lo que no le cabe acaba en el río.`
          : `Todavía no hay ninguna línea que llegue al pueblo. Mientras tanto bebe
             de la red vieja: ${D[0].nombre} de ${D[0].material}.`}</p>`
      : lineas.map(({ tuberia, indice }) => {
          const d = diametro(tuberia.dn, clave);
          const años = Math.floor(edadAños(tuberia, estado.horas));
          const vieja = d.vidaAños && años > d.vidaAños;
          const sube = nivelDiametro(tuberia.dn, clave) < nivelDiametro(objetivo.id, clave);
          // Al mismo calibre solo se renueva lo VIEJO: lo demás sería tirar dinero
          const renovable = sube
            || (vieja && nivelDiametro(objetivo.id, clave) === nivelDiametro(tuberia.dn, clave));
          const coste = renovable ? costeRenovar(estado.mapa, tuberia, objetivo.id, clave) : 0;
          return `
            <button class="mejora obra linea${renovable ? '' : ' hecha'}"
                    ${renovable ? `data-accion="renovarLinea" data-clave="${indice}"` : 'disabled'}
                    style="--tono:${vieja ? '#f0a04a' : d.color}">
              <span class="m-cab"><span class="m-nom">${tuberia.camino.length} casillas · ${d.nombre}
                ${d.vidaAños ? `<i class="linea-edad${vieja ? ' vieja' : ''}">${años} años</i>` : ''}
              </span></span>
              <span class="m-desc">${sube
                ? `Renovar a ${objetivo.nombre} de ${objetivo.material}.`
                : vieja
                  ? `Pasada de vida útil (${d.vidaAños} años del ${d.material}): fuga cada
                     vez más. Renovarla la deja nueva.`
                  : 'Ya está a la altura del diámetro elegido.'}</span>
              <span class="m-coste">${renovable ? formatear(coste) + ' €' : '—'}</span>
            </button>`;
        }).join('');

    const avisos = this.avisosRed(estado, clave, cuello, resultado)
      .map(t => `<p class="red-aviso">${t}</p>`).join('');

    document.getElementById('red').innerHTML = `
      <div class="red-tabs">${pestanas}</div>
      <p class="m-desc">${R.desc}</p>
      <p class="red-cuello" style="--tono:${cuello.def.color}">
        Manda el tramo más estrecho: <b>${cuello.def.nombre}</b> de ${cuello.def.material}
        ${cuello.estrechas > 1 ? `<i>(${cuello.estrechas} líneas así)</i>` : ''}
      </p>
      ${avisos}
      <p class="m-desc">${R.esVial ? 'Clase de vía' : 'Diámetro'} con que se tiende
        y a la que se renueva:</p>
      <div class="dn-selector">${selector}</div>
      ${listado}`;

    // Que el botón de tender diga QUÉ va a tender: si no, eliges aquí y luego
    // trazas allí sin saber si estás poniendo agua limpia o un colector.
    const nombre = document.querySelector('#obra-tuberia .m-nom');
    const etiqueta = document.querySelector('#obra-tuberia .m-coste');
    if(nombre) nombre.textContent = `Colocar ${R.corto}`;
    if(etiqueta) etiqueta.textContent = `${R.nombre} · ${objetivo.nombre}`;
    const boton = document.getElementById('obra-tuberia');
    if(boton) boton.style.setProperty('--tono', R.color);
  }

  /** Lo que dice cada calibre según la red: no se mide igual un tubo que una vía. */
  medidaTier(clave, d){
    if(clave === 'saneamiento')
      return formatear(d.caudalMax * CONFIG.saneamiento.holguraColector * 3600) + ' L/h';
    if(clave === 'residuos')
      return d.caudalMax.toFixed(2) + ' t/h';
    return 'hasta ' + formatear(d.habitantesMax) + ' hab';
  }

  /**
   * PUEBLOS DE TU ZONA: el estado del semillero de nombres. Todo el texto de
   * privacidad está AQUÍ, a la vista y antes del botón: pedir la ubicación sin
   * decir para qué y qué se guarda sería ganarse una desinstalación.
   */
  refrescarLugares(estado){
    const nombres = listaLugares();
    const firma = nombres ? 'si' + nombres.length : 'no';
    if(this.cache.lugaresFirma === firma) return;
    this.cache.lugaresFirma = firma;
    document.getElementById('lugares').innerHTML = nombres
      ? `<p class="m-desc">Los pueblos por descubrir llevan nombres de tu comarca
           (${nombres.length}): <b>${nombres.slice(0, 4).join('</b>, <b>')}</b>…
           Los ya incorporados conservan el suyo.</p>
         <button class="mejora obra" data-accion="quitarLugares">
           <span class="m-cab"><span class="m-nom">Volver a los inventados</span></span>
           <span class="m-desc">La lista de nombres se borra de este navegador.</span>
         </button>`
      : `<p class="m-desc">Los pueblos del mapa pueden llamarse como los de tu
           comarca: encontrar tu zona en el juego tiene su gracia. Tu ubicación
           se usa UNA sola vez para preguntar a OpenStreetMap por los municipios
           cercanos, no se guarda, y aquí solo queda la lista de nombres.</p>
         <button class="mejora obra" data-accion="usarLugares">
           <span class="m-cab"><span class="m-nom">Usar pueblos de mi zona</span></span>
           <span class="m-desc">El navegador te pedirá permiso de ubicación.</span>
         </button>`;
  }

  /**
   * DE DÓNDE SALE EL AGUA: el desglose de la producción del pueblo activo.
   * Contesta a "¿por qué produzco menos que antes?", que con cinco mermas
   * posibles a la vez (estiaje, tubería, fugas, lixiviados, averías) no se
   * puede contestar mirando un solo número. Cada línea sale solo si pinta
   * algo: un desglose siempre lleno de ceros no lo lee nadie.
   */
  refrescarDiagnostico(estado, resultado = {}){
    const p = estado.activo;
    const estiaje = resultado.estiaje ?? 1;
    const d = desgloseProduccion(p, estado, estiaje);
    const dem = demandaMedia(p.habitantes);

    // ¿Algún acuífero en uso está por debajo del umbral? Merma silenciosa.
    let pozosMermados = false;
    for(const [masa] of pozosPorMasa(estado))
      if(nivelMasa(estado, masa) < CONFIG.acuiferos.umbralMerma) pozosMermados = true;

    const firma = [d.rio, d.pozos, d.perdidaTope, d.fugas, d.veneno,
                   d.paradas, dem, pozosMermados ? 1 : 0]
      .map(x => (+x).toFixed(2)).join(',');
    if(this.cache.diagFirma === firma) return;
    this.cache.diagFirma = firma;

    const L = x => x.toFixed(2) + ' L/s';
    const f = [];

    // Las fuentes
    if(d.rioBruto > 0){
      const nota = estiaje < 0.95
        ? ` <em class="diag-nota">estiaje: el río viene bajo, −${(d.rioBruto - d.rio).toFixed(2)}</em>`
        : estiaje > 1.05
          ? ` <em class="diag-nota buena">deshielo: viene crecido, +${(d.rio - d.rioBruto).toFixed(2)}</em>`
          : '';
      f.push(`<div class="casilla-fila"><span>Del río${nota}</span><b>${L(d.rio)}</b></div>`);
    }
    if(d.pozos > 0 || pozosMermados){
      const nota = pozosMermados
        ? ' <em class="diag-nota mala">acuífero bajo: dan menos</em>' : '';
      f.push(`<div class="casilla-fila"><span>De los pozos${nota}</span><b>${L(d.pozos)}</b></div>`);
    }
    if(d.rioBruto <= 0 && d.pozos <= 0)
      f.push(`<p class="m-desc">Sin captación conectada: toda el agua sale de tus
        clics. Una captación en el río —o un pozo— produce sola.</p>`);

    // Las mermas, solo las que están doliendo
    if(d.perdidaTope > 0.005)
      f.push(`<div class="casilla-fila"><span>No cabe por ${d.red.def.nombre}
        <em class="diag-nota mala">renovar la línea lo libera</em></span>
        <b class="diag-perdida">−${L(d.perdidaTope)}</b></div>`);
    if(d.fugas > 0.005){
      // Si la tasa supera la del material es que hay una línea vieja fugando
      const envejecida = tasaFugasRed(estado) > d.red.def.fugas + 0.005;
      f.push(`<div class="casilla-fila"><span>Fugas del ${d.red.def.material}
        ${envejecida ? '<em class="diag-nota mala">hay una línea vieja: renovarla lo corta</em>' : ''}</span>
        <b class="diag-perdida">−${L(d.fugas)}</b></div>`);
    }
    if(d.veneno > 0.005)
      f.push(`<div class="casilla-fila"><span>Agua insalubre
        <em class="diag-nota mala">lixiviados sobre tu toma</em></span>
        <b class="diag-perdida">−${L(d.veneno)}</b></div>`);
    if(d.paradas > 0)
      f.push(`<div class="casilla-fila"><span>${d.paradas === 1
          ? 'Una pieza parada por avería' : d.paradas + ' piezas paradas por avería'}
        <em class="diag-nota mala">repárala sobre el mapa</em></span>
        <b class="diag-perdida">parada</b></div>`);

    // El cierre: lo que queda contra lo que pide el pueblo
    const cubre = d.neto >= dem;
    f.push(`<div class="casilla-fila diag-total"><span>Produce</span><b>${L(d.neto)}</b></div>
      <div class="casilla-fila"><span>El pueblo pide de media</span><b>${L(dem)}</b></div>
      <p class="m-desc">${cubre
        ? 'La captación cubre la demanda media; el depósito absorbe las puntas y tus clics son propina.'
        : 'La captación NO cubre la demanda: lo que falte sale de tus clics, o el pueblo pasa sed.'}</p>`);

    document.getElementById('diagnostico').innerHTML = f.join('');
  }

  /**
   * Por qué la red se ha convertido en el problema. Van aquí y no en el HTML
   * porque son la respuesta a preguntas que, sin contestar, parecen fallos del
   * juego: "compro captación y no sube el agua", "cuido el servicio y el pueblo
   * no crece", "tengo depuradora y el río sigue sucio".
   */
  avisosRed(estado, clave, cuello, resultado = {}){
    const p = estado.activo;
    const fuera = [];
    if(clave === 'abastecimiento'){
      // La vejez se avisa aquí porque su síntoma —producir menos— tiene otras
      // cinco causas posibles, y esta es la única que empeora sola y despacio.
      for(const { tuberia } of cuello.lineas || []){
        const d = diametro(tuberia.dn, clave);
        const extra = fugasDe(tuberia, estado.horas) - d.fugas;
        if(extra > 0.005){
          fuera.push(`Una línea de ${Math.floor(edadAños(tuberia, estado.horas))} años
            (${d.material}, vida útil ${d.vidaAños}): fuga un
            ${Math.round((d.fugas + extra) * 100)} % y cada año irá a más.
            Renovarla —aunque sea al mismo calibre— la deja nueva.`);
          break;   // con avisar de la peor basta: el panel ya las lista todas
        }
      }
      if(redEstrangula(p, estado)) fuera.push(`Tu captación da más agua de la que
        cabe por ${cuello.def.nombre}: se está perdiendo lo que sobra. Comprar más
        captación no servirá de nada hasta que ensanches la línea.`);
      if(p.habitantes >= cuello.def.habitantesMax * 0.95) fuera.push(`El pueblo ha
        tocado techo: por ${cuello.def.nombre} no cabe agua para más de
        ${formatear(cuello.def.habitantesMax)} habitantes. Hasta que no renueves la
        línea entera, no crece.`);
      // AGUA SIN POTABILIZAR: el freno silencioso. Si no se cuenta aquí, el
      // jugador ve el pueblo estancado y no sabe por qué.
      if(resultado && (resultado.aguaBrutaLh || 0) > (resultado.aguaTrataLh || 0) + 1e-6)
        fuera.push(`Estás sirviendo ${formatear(resultado.aguaBrutaLh - resultado.aguaTrataLh)}
          L/h de agua BRUTA sin potabilizar (del río, o de pozos exprimidos), y eso
          frena el crecimiento: nadie se fía de un grifo sin garantía. Una
          POTABILIZADORA conectada lo resuelve.`);
    } else if(clave === 'pluviales'){
      if(!cuello.lineas.length) fuera.push(`No hay red de pluviales: la lluvia y las
        aguas fecales van juntas por el mismo colector, y en tormenta eso es lo que
        revienta a la depuradora. Tender una línea aparte saca del colector todo lo
        que le quepa.`);
      else if(resultado.lluviaLh > 0) fuera.push(`Ahora mismo caen
        ${formatear(resultado.lluviaLh)} L/h sobre el pueblo y tu red se lleva
        ${formatear(resultado.separadaLh)} L/h. El resto baja por el colector.`);
    } else if(clave === 'residuos'){
      const piezas = (estado._conectadoRed || {}).residuos || {};
      if(!cuello.lineas.length) fuera.push(`No hay carretera: el camión no tiene por
        dónde salir y la basura se queda en el pueblo. Aquí no hay ninguna vía vieja
        que valga, hay que tenderla.`);
      else if(!piezas.vertedero) fuera.push(`Recoges la basura pero no tienes dónde
        dejarla: hace falta un VERTEDERO enganchado a la carretera, y lejos del agua.`);
      else if(resultado.basuraTh > resultado.recogidaTh + 1e-6) fuera.push(`Se genera
        más basura de la que puede sacar la vía: ${(resultado.basuraTh || 0).toFixed(3)}
        t/h contra ${(resultado.recogidaTh || 0).toFixed(3)}. Lo que no sale se pudre
        en la calle —ya va por el ${Math.round((resultado.basuraCalle || 0) * 100)} %—
        y frena el crecimiento.`);
      if(!nivelReciclaje(p, estado)) fuera.push(`Todo va al vertedero, y enterrar solo
        cuesta dinero. Con una PLANTA DE RECICLAJE conectada empiezas a separar
        fracciones y a venderlas: es la única parte del juego que ingresa aparte
        del agua.`);
    } else {
      if(servicioActivo(p, 'saneamiento') && !(estado._conectadoSan || {}).depuradora)
        fuera.push(`El pueblo ya genera aguas residuales y no hay ninguna depuradora
          enganchada al colector. Todo lo que sale va crudo al cauce: constrúyela
          junto al agua y llévale una línea de saneamiento.`);
      if(resultado.rebosando) fuera.push(`El colector está REBOSANDO: entra más agua
        de la que cabe por ${cuello.def.nombre} y se sale antes de llegar a la
        depuradora. Eso va al río sin tratar. Ensancha el colector o separa las
        pluviales.`);
      // El tapón se muda: en cuanto ensanchas el colector, llega TODO a la
      // depuradora y es ella la que no da abasto. Sin decirlo, el jugador
      // renueva la línea, ve el río igual de sucio y cree que no ha servido.
      const trata = capacidadTratamiento(p, estado);
      if(!resultado.rebosando && resultado.aliviando && servicioActivo(p, 'saneamiento'))
        fuera.push(`El colector da de sí, pero la depuradora no: le llegan
          ${formatear(resultado.cargaLh || 0)} L/h y solo trata
          ${formatear(trata)} L/h. Lo que sobra se alivia crudo. Ahora el problema
          no es la tubería: hace falta más depuración, o un tanque de tormentas
          que corte la punta.`);
    }
    return fuera;
  }

  /**
   * LA TARJETA DE HITO. Aparece cuando se abre un servicio nuevo y cuenta las
   * tres cosas que hacen falta en ese momento: qué ha pasado, qué hay que hacer
   * y por qué. El "por qué" es el que justifica pararlo todo — es justo lo que
   * el jugador se está preguntando.
   *
   * La imagen se pone solo si carga: si falta, la tarjeta sale igual con su
   * texto y no queda un hueco roto.
   */
  refrescarHito(estado){
    const fondo = document.getElementById('hito-fondo');
    const id = estado.hitoPendiente;
    if(this.cache.hitoFirma === id) return;
    this.cache.hitoFirma = id;

    if(!id || !CONFIG.hitos[id]){ fondo.hidden = true; return; }
    const h = CONFIG.hitos[id];
    fondo.hidden = false;

    const img = document.getElementById('hito-img');
    img.hidden = true;
    img.onload = () => { img.hidden = false; };
    img.onerror = () => { img.hidden = true; };
    // Los logros llevan su propia imagen, amable: `l_` en vez de `h_`.
    img.src = `assets/${h.logro ? 'l' : 'h'}_${id}.jpg`;

    // La tarjeta cambia de tono: un problema entra en ámbar y un logro en verde.
    // Con el mismo color, la de "el río vuelve a estar vivo" se leía como otra
    // regañina antes de haber leído una sola palabra.
    document.getElementById('hito').classList.toggle('es-logro', !!h.logro);
    document.getElementById('hito-eti-pasa').textContent =
      h.logro ? 'Lo has conseguido' : 'Qué ha pasado';
    document.getElementById('hito-eti-hacer').textContent =
      h.logro ? 'Qué viene ahora' : 'Qué tienes que hacer';
    document.getElementById('hito-titulo').textContent = h.titulo;
    document.getElementById('hito-pasa').textContent = h.pasa;
    document.getElementById('hito-hacer').textContent = h.hacer;
    document.getElementById('hito-porque').textContent = h.porque;
  }

  /* ---------------- LA GUÍA DE LOS PRIMEROS PASOS ---------------- */

  /**
   * Enseña un comentario de Manuel en el bocadillo. El texto vive lo que diga
   * CONFIG.comentarios y se va solo; la cara acompaña si el comentario trae
   * ánimo. Nunca pisa la guía de primeros pasos: main.js ni lo intenta.
   */
  mostrarComentario(com){
    this.comentario = { ...com, hasta: Date.now() + CONFIG.comentarios.duracionSegundos * 1000 };
    this.cache.guiaFirma = null;      // que el bocadillo se redibuje ya
    if(com.animo) this.caraGuia(com.animo);
    else this.respingoGuia();         // sin cambio de cara, el bote avisa igual
  }

  refrescarGuia(estado){
    const paso = pasoActual(estado);
    // El comentario caduca solo; mientras vive, el bocadillo es suyo
    if(this.comentario && Date.now() > this.comentario.hasta) this.comentario = null;
    const com = paso ? null : this.comentario;
    const firma = paso ? 'paso:' + paso.id : com ? 'com:' + com.texto : 'fin';
    if(this.cache.guiaFirma === firma) return;
    this.cache.guiaFirma = firma;

    const panel = document.getElementById('panel-guia');
    if(!paso && !com){ panel.style.display = 'none'; return; }
    panel.style.display = '';

    // Dos modos, un bocadillo: la guía enseña pasos; Manuel suelto, comenta
    document.getElementById('guia-rotulo').textContent = paso ? 'Primeros pasos' : 'dice';
    document.getElementById('guia-titulo').style.display = paso ? '' : 'none';
    panel.querySelector('.guia-saltar').style.display = paso ? '' : 'none';
    if(com){
      panel.classList.remove('plegada');
      const bocadillo = panel.querySelector('.guia-bocadillo');
      if(bocadillo){
        bocadillo.style.animation = 'none';
        void bocadillo.offsetWidth;
        bocadillo.style.animation = '';
      }
      document.getElementById('guia-cuenta').textContent = '';
      document.getElementById('guia-texto').textContent = com.texto;
      return;
    }
    // Un paso NUEVO se despliega y da su botecito aunque estuviera plegada:
    // información nueva pide atención; el pliegue era del paso anterior.
    panel.classList.remove('plegada');
    const bocadillo = panel.querySelector('.guia-bocadillo');
    if(bocadillo){
      bocadillo.style.animation = 'none';
      void bocadillo.offsetWidth;          // reencender la animación
      bocadillo.style.animation = '';
    }
    document.getElementById('guia-cuenta').textContent =
      `${estado.tutorial.paso + 1}/${CONFIG.tutorial.length}`;
    document.getElementById('guia-titulo').textContent = paso.titulo;
    document.getElementById('guia-texto').textContent = paso.texto;
  }

  /* ---------------- HALLAZGO SELECCIONADO Y ALMACÉN ---------------- */

  /**
   * Panel de acciones de la casilla seleccionada. Se reconstruye solo cuando
   * cambia la selección, no en cada fotograma.
   */
  refrescarHallazgo(estado){
    const panel = document.getElementById('panel-hallazgo');
    const sel = estado.seleccion;
    const celda = sel ? celdaEn(estado.mapa, sel.col, sel.fila) : null;
    // Del pueblo cambian solos el tamaño y el servicio: sin ellos en la firma,
    // la ficha se quedaba enseñando los datos del momento en que la abriste.
    const pSel = sel && estado.pueblos.find(x => x.col === sel.col && x.fila === sel.fila);
    const vivo = pSel
      ? `,${Math.round(pSel.habitantes)},${Math.round((pSel.servicio || 0) * 100)}`
      : '';
    const firma = sel
      ? `${sel.col},${sel.fila},${celda?.resuelto},${celda?.excavado}${vivo}` : 'nada';
    if(this.cache.hallazgoFirma === firma) return;
    this.cache.hallazgoFirma = firma;

    const cont = document.getElementById('hallazgo');
    const H = CONFIG.hallazgos;

    // Un yacimiento aflorado no es un "hallazgo" de los de destapar casilla:
    // sale al picar. Se atiende aquí igual porque el sitio es el mismo.
    if(celda && celda.arqueologia && celda.aflorado){
      const A = CONFIG.arqueologia;
      const tipoY = tipoYacimiento(celda);
      panel.style.display = '';
      // La imagen del tipo (assets/a_<id>.jpg) preside la ficha; si no existe
      // se esconde sola y el texto cuenta lo mismo.
      const img = `<img class="ficha-dib" src="assets/a_${tipoY.id}.jpg"
                     onerror="this.hidden=true" alt="">`;
      cont.innerHTML = celda.excavado
        ? `<p class="red-cuello" style="--tono:${A.color}"><b>${tipoY.nombre}</b> · en valor</p>
           ${img}
           <p class="m-desc">${tipoY.desc}</p>
           <p class="m-desc">Renta <b>${formatear(tipoY.renta)} €/h</b> y seguirá
             haciéndolo. La casilla queda para siempre fuera de obra.</p>`
        : `<p class="red-cuello" style="--tono:${A.color}"><b>${tipoY.nombre}</b></p>
           ${img}
           <p class="m-desc">${tipoY.desc}</p>
           <p class="m-desc">Ha salido al picar. No se puede quitar ni construir
             encima: hay que rodearlo. Excavarlo cuesta, pero lo pone en valor y
             pasa a rentar todos los meses.</p>
           <button class="mejora obra" data-accion="excavarYacimiento" style="--tono:${A.color}">
             <span class="m-cab"><span class="m-nom">Excavar y poner en valor</span></span>
             <span class="m-desc">+${formatear(tipoY.renta)} €/h para siempre.</span>
             <span class="m-coste">${formatear(A.costeExcavar)} €</span>
           </button>`;
      return;
    }

    // El PUEBLO tiene ficha SIEMPRE, esté incorporado o no. Antes, en cuanto
    // entraba en la mancomunidad el panel se escondía: clicar tu propio pueblo
    // —lo más importante del mapa— no enseñaba absolutamente nada.
    if(celda && celda.hallazgo === 'pueblo'){
      panel.style.display = '';
      cont.innerHTML = this.fichaPueblo(estado, celda, sel);
      return;
    }

    // La SEÑAL DE CAMINO: dice a quién apunta y a cuánto, en vivo.
    if(celda && celda.hallazgo === 'senal'){
      panel.style.display = '';
      const obj = nucleoMasCercano(estado.mapa, sel.col, sel.fila);
      cont.innerHTML = obj
        ? `<p class="red-cuello" style="--tono:${H.color.senal}"><b>Señal de camino</b></p>
           <p class="m-desc">«${nombreDeNucleo(obj.celda.nombreIdx || 0)} ·
             a ${Math.round(obj.d)} casillas»</p>
           <p class="m-desc">Los camineros las plantaban donde el viajero dudaba.
             Apunta siempre al pueblo por descubrir más cercano: cuando lo
             incorpores, señalará al siguiente.</p>`
        : `<p class="red-cuello" style="--tono:${H.color.senal}"><b>Señal de camino</b></p>
           <p class="m-desc">Ya no señala a nadie: no queda ningún pueblo por
             descubrir en la comarca. Buen trabajo.</p>`;
      return;
    }

    if(!celda || !celda.hallazgo || celda.resuelto){ panel.style.display = 'none'; return; }
    panel.style.display = '';

    if(celda.hallazgo === 'ruina'){
      const tipo = piezaDeRuina(celda);
      const def = CONFIG.construibles[tipo];
      const reparar = Math.round(def.coste * H.costeReparar);
      const desmontar = Math.round(def.coste * H.costeDesmontar);
      cont.innerHTML = `
        <p class="m-desc">Instalación abandonada: <b>${def.nombre}</b>.</p>
        <button class="mejora obra" data-accion="repararRuina" style="--tono:${def.color}">
          <span class="m-cab"><span class="m-nom">Poner en marcha aquí</span></span>
          <span class="m-desc">Se queda donde está, si el terreno le sirve.</span>
          <span class="m-coste">${formatear(reparar)} €</span>
        </button>
        <button class="mejora obra" data-accion="desmontarRuina" style="--tono:${H.color.ruina}">
          <span class="m-cab"><span class="m-nom">Desmontar y guardar</span></span>
          <span class="m-desc">Va al almacén para levantarla donde te convenga.</span>
          <span class="m-coste">${formatear(desmontar)} €</span>
        </button>`;
    }
  }

  /**
   * LA FICHA DEL PUEBLO. La preside su ILUSTRACIÓN (assets/f_<escalón>.jpg:
   * aldea, pueblo, villa o ciudad), que cambia sola al crecer — abrir la ficha
   * y encontrarse otra estampa es medio premio.
   *
   * Aquí la imagen SÍ encaja y en el mapa no: es una lámina de tamaño fijo, sin
   * zoom, sin estados encima y sin isométrica alrededor con la que casar. Si no
   * existe el archivo se esconde sola y el texto cuenta lo mismo, como en las
   * fichas de las instalaciones.
   */
  fichaPueblo(estado, celda, sel){
    const H = CONFIG.hallazgos;
    const p = estado.pueblos.find(x => x.col === sel.col && x.fila === sel.fila);
    const habitantes = p ? p.habitantes : (celda.habIni || 0);
    const esc = escalonCaserio(habitantes);
    const nombre = p ? p.nombre : nombreDeNucleo(celda.nombreIdx || 0);

    // La estampa de la ÉPOCA: en comarcas posteriores se prueba primero
    // f_<escalón>_e2.jpg / _e3.jpg (pueblos más modernos, si el autor los ha
    // generado); si no existe cae a la base, y sin base se esconde.
    const ep = epocaActual();
    const base = `assets/f_${esc.nombre}.jpg`;
    const src = ep > 1 ? `assets/f_${esc.nombre}_e${ep}.jpg` : base;
    const img = `<img class="ficha-dib" src="${src}"
                   onerror="if(this.src.indexOf('_e')>-1){this.src='${base}';}else{this.hidden=true}"
                   alt="">`;
    const cab = `<p class="red-cuello" style="--tono:${H.color.pueblo}">
        <b>${nombre}</b> · ${esc.nombre}</p>${img}`;

    // Lo que significa ese tamaño en el oficio. Mismo bloque que las fichas de
    // las instalaciones: si el jugador ya sabe leer uno, sabe leer este.
    const leccion = `<div class="ficha" style="--tono:${H.color.pueblo}">
        <p class="ficha-tit ficha-dato-tit">Un núcleo de este tamaño</p>
        <p class="ficha-txt ficha-dato">${esc.ficha}</p>
      </div>`;

    if(!p){
      // Aún por incorporar: lo que se sabe de lejos y qué hace falta para traerlo
      const bloqueado = (celda.anillo || 1) > faseActual(estado);
      return cab + `
        <div class="casilla-fila"><span>Habitantes</span>
          <b>${formatear(Math.round(habitantes))}</b></div>
        <div class="casilla-fila"><span>Distancia</span>
          <b>anillo ${celda.anillo || 1}</b></div>
        ${leccion}
        ${bloqueado
          ? `<p class="red-aviso">Demasiado lejos para la mancomunidad de hoy:
               incorpora ${faltanParaFase(estado)} núcleos más cercanos y se abrirá
               este anillo.</p>`
          : `<button class="mejora obra" data-accion="abastecerPueblo" style="--tono:${H.color.pueblo}">
               <span class="m-cab"><span class="m-nom">Abastecer este pueblo</span></span>
               <span class="m-desc">Hay que haberle llevado antes una tubería. Al
                 hacerlo entra en la mancomunidad.</span>
               <span class="m-coste">canon: ${formatear(canonIncorporacion(estado))} €</span>
             </button>`}`;
    }

    // Ya es tuyo: quién es y cómo lo estás atendiendo
    const dem = demandaMedia(p.habitantes);
    const serv = Math.round((p.servicio || 0) * 100);
    const clase = serv >= 95 ? 'ok' : serv >= 70 ? 'alarma' : 'critico';
    const activo = estado.pueblos.indexOf(p) === estado.puebloActivo;
    return cab + `
      <div class="casilla-fila"><span>Habitantes</span>
        <b>${formatear(Math.round(p.habitantes))}</b></div>
      <div class="casilla-fila"><span>Pide de media</span>
        <b>${dem.toFixed(2)} L/s</b></div>
      <div class="casilla-fila"><span>Servicio</span>
        <b class="v ${clase}">${serv} %</b></div>
      ${leccion}
      <p class="m-desc">${activo
        ? 'Es el pueblo que estás mirando. Cada clic encima es una bombada.'
        : 'Clícalo en el mapa para ponerlo al frente y bombear aquí.'}</p>`;
  }

  /**
   * El EXPEDIENTE: la carrera del jugador por encima de las partidas. Comarca
   * y región, la veteranía disponible, las ventajas compradas y el botón de
   * trasladarse cuando la mancomunidad da la talla. Vive en Mancomunidad.
   */
  refrescarExpediente(estado){
    const cont = document.getElementById('expediente');
    if(!cont) return;
    const K = CONFIG.comarcas;
    const puede = faseActual(estado) >= K.faseParaTrasladarse;
    // El MÁXIMO alcanzado, no el de hoy: el mérito no caduca (ver main.js)
    const ganada = Math.max(estado.mejorVeterania || 0, veteraniaAlTrasladarse(estado));
    const firma = `${legado.comarca},${legado.veterania},` +
      `${JSON.stringify(legado.ventajas)},${puede},${ganada}`;
    if(this.cache.expedienteFirma === firma) return;
    this.cache.expedienteFirma = firma;

    const ventajas = Object.entries(K.ventajas).map(([k, def]) => {
      const nivel = nivelVentaja(k);
      const coste = costeVentaja(k);
      const sinFondos = coste == null || legado.veterania < coste;
      return `<button class="mejora obra" data-accion="comprarVentaja" data-clave="${k}"
          style="--tono:#c084fc" ${sinFondos ? 'disabled' : ''}>
        <span class="m-cab"><span class="m-nom">${def.nombre}
          · ${nivel}/${def.nivelMax}</span></span>
        <span class="m-desc">${def.desc}</span>
        <span class="m-coste">${coste == null ? 'al máximo' : coste + ' veteranía'}</span>
      </button>`;
    }).join('');

    cont.innerHTML = `
      <p class="m-desc"><b>Comarca ${legado.comarca}</b> · ${regionActual().nombre}
        · veteranía disponible: <b>${legado.veterania}</b></p>
      ${ventajas}
      ${puede
        ? `<button class="mejora obra" data-accion="trasladarse" style="--tono:#f0a04a">
             <span class="m-cab"><span class="m-nom">Trasladarse a otra comarca</span></span>
             <span class="m-desc">La red, la caja y los pueblos se quedan; tú te llevas
               la experiencia. Territorio nuevo de verdad: otro río, otros acuíferos.</span>
             <span class="m-coste">+${ganada} veteranía</span>
           </button>`
        : `<p class="m-desc">El traslado se ofrecerá al alcanzar la
             fase ${K.faseParaTrasladarse}: las comarcas grandes solo llaman
             a quien ya ha demostrado lo que sabe.</p>`}`;
  }

  /**
   * La instalación seleccionada. Existe sobre todo por el VERTEDERO: sin poder
   * mirarlo no hay forma de saber cuánto le queda de vaso, y cuando se llena la
   * basura se queda en la calle sin que se entienda por qué.
   */
  refrescarObra(estado){
    const panel = document.getElementById('panel-obra');
    const sel = estado.seleccion;
    const obra = sel && estado.construcciones.find(o => o.col === sel.col && o.fila === sel.fila);
    // El nivel del acuífero entra en la firma: es lo único de una obra que
    // cambia sola con el tiempo, y si no se refresca el panel se queda mintiendo.
    const celdaObra = obra && celdaEn(estado.mapa, obra.col, obra.fila);
    // Del pozo cambian solas DOS cosas: el nivel y cuántos pozos más han
    // enganchado a la misma masa. Sin las dos en la firma, el panel se queda
    // enseñando el reparto de ayer.
    const nivelPozo = obra && obra.tipo === 'acuifero'
      ? Math.round(nivelMasa(estado, celdaObra?.masa) * 20)
        + ':' + (pozosPorMasa(estado).get(celdaObra?.masa) || 0) : '';
    // La avería y la conexión también entran: son lo que el panel debe contar
    const estadoObra = obra ? this.estadoDeObra(estado, obra) : '';
    const nLineas = obra ? lineasEnCasilla(estado, obra.col, obra.fila).length : 0;
    // El bono del turno se agota con las horas: la ficha de la planta lo cuenta
    const turnoFirma = obra && obra.tipo === 'reciclaje'
      ? Math.ceil(((estado.turnoReciclaje || {}).hasta || 0) - estado.horas) : '';
    const firma = obra ? `${obra.tipo},${obra.col},${obra.fila},${obra.nivel || 1},${Math.round(obra.lleno || 0)},${nivelPozo},${estadoObra},${nLineas},${turnoFirma}` : 'nada';
    if(this.cache.obraFirma === firma) return;
    this.cache.obraFirma = firma;

    if(!obra){ panel.style.display = 'none'; return; }
    panel.style.display = '';
    const def = CONFIG.construibles[obra.tipo];
    const cont = document.getElementById('obra');
    const titulo = nombreDeObra(obra);

    // Averiada o suelta, la pieza no aporta NADA — y si el panel no lo dice,
    // el jugador cree que la ampliación que acaba de pagar no funciona.
    const situacion = estadoObra === 'averiada'
      ? '<p class="red-aviso">AVERIADA: no cuenta en la red hasta que la repares clicándola en el mapa.</p>'
      : estadoObra === 'suelta'
        ? '<p class="red-aviso">SIN CONECTAR: no aporta nada hasta que le llegue su red.</p>'
        : '';

    // EL POZO: aquí es donde hace falta ver el acuífero, no en la ficha de
    // terreno — en cuanto construyes encima, aquella deja de salir.
    const lineasAqui = this.bloqueLineas(estado, { col: obra.col, fila: obra.fila });
    const derribo = this.botonDerribar(obra);

    if(obra.tipo === 'acuifero'){
      cont.innerHTML = `
        <p class="red-cuello" style="--tono:${def.color}"><b>${titulo}</b></p>
        ${situacion}
        ${lineasAqui}
        ${this.bloqueSubsuelo(estado, celdaObra, { col: obra.col, fila: obra.fila })}
        ${this.fichaHTML(def, obra.tipo)}
        ${derribo}`;
      return;
    }

    if(obra.tipo !== 'vertedero'){
      const A = CONFIG.ampliacion;
      const nivel = obra.nivel || 1;
      const ampliable = A.tipos.includes(obra.tipo);
      // LA PLANTA DE RECICLAJE tiene su turno jugable: el minijuego con premio
      let turno = '';
      if(obra.tipo === 'reciclaje'){
        const t = estado.turnoReciclaje;
        const activo = t && estado.horas < t.hasta;
        turno = activo
          ? `<p class="m-desc">Turno echado: la venta va al
               <b>+${Math.round((t.factor - 1) * 100)} %</b> todavía
               ${Math.ceil(t.hasta - estado.horas)} horas más.</p>`
          : `<button class="mejora obra" data-accion="turnoReciclaje" style="--tono:#facc15">
               <span class="m-cab"><span class="m-nom">Echar un turno en la línea</span></span>
               <span class="m-desc">Separa bien en la cinta y la venta de reciclado
                 sube hasta un ${Math.round(CONFIG.minijuegos.reciclaje.bonusMax * 100)} %
                 una temporada.</span>
               <span class="m-coste">jugar</span>
             </button>`;
      }
      cont.innerHTML = `
        <p class="red-cuello" style="--tono:${def.color}"><b>${titulo}</b>
          ${ampliable ? `· nivel ${nivel}` : ''}</p>
        ${situacion}
        ${lineasAqui}
        ${turno}
        <p class="m-desc">${this.queAporta(obra.tipo, nivel) || def.desc}</p>
        ${!ampliable ? '' : nivel >= A.nivelMax
          ? '<p class="m-desc">Ampliada al máximo: si hace falta más, toca construir otra.</p>'
          : `<button class="mejora obra" data-accion="ampliarPieza" style="--tono:${def.color}">
               <span class="m-cab"><span class="m-nom">Ampliar a nivel ${nivel + 1}</span></span>
               <span class="m-desc">Pasará a aportar como ${nivel + 1} piezas iguales.</span>
               <span class="m-coste">${formatear(costeAmpliarPieza(obra))} €</span>
             </button>`}
        ${this.fichaHTML(def, obra.tipo)}
        ${derribo}`;
      return;
    }

    const V = CONFIG.residuos.vertedero;
    const pct = Math.round(llenadoVaso(obra) * 100);
    const nivel = obra.nivel || 1;
    const tope = nivel >= V.nivelMax;
    const coste = costeAmpliarVertedero(obra);
    cont.innerHTML = `
      <p class="red-cuello" style="--tono:${def.color}">
        <b>${titulo}</b> · vaso nivel ${nivel}
      </p>
      ${situacion}
      <div class="vaso"><i style="width:${pct}%"></i></div>
      <p class="m-desc">${formatear(obra.lleno || 0)} de ${formatear(capacidadVaso(obra))} t
        (${pct} %).${pct >= 100
          ? ' <b class="critico">LLENO: ya no admite nada.</b>'
          : ''}</p>
      <p class="m-desc">Gotea sobre el agua que tiene alrededor, y cuanto más
        lleno, más. Un agua insalubre da menos caudal.</p>
      ${this.fichaHTML(def, 'vertedero')}
      ${tope
        ? '<p class="m-desc">No se puede ampliar más: abre otro vertedero en otra parte.</p>'
        : `<button class="mejora obra" data-accion="ampliarVertedero" style="--tono:${def.color}">
             <span class="m-cab"><span class="m-nom">Ampliar el vaso</span></span>
             <span class="m-desc">+${formatear(V.capacidadPorNivel)} t de capacidad.</span>
             <span class="m-coste">${formatear(coste)} €</span>
           </button>`}
      ${lineasAqui}
      ${derribo}`;
  }

  /**
   * Las líneas que pasan por la casilla seleccionada, cada una con su botón de
   * LEVANTARLA. Es la respuesta a la casilla compartida: si hay una obra Y una
   * tubería en el mismo sitio, el panel enseña las dos, cada una con lo suyo —
   * mejor que preguntar.
   */
  bloqueLineas(estado, sel){
    const lineas = lineasEnCasilla(estado, sel.col, sel.fila);
    if(!lineas.length) return '';
    return lineas.map(({ tuberia, indice }) => {
      const clave = redDe(tuberia);
      const red = CONFIG.redes[clave];
      const d = diametro(tuberia.dn, clave);
      const recupera = Math.round(costeTrazado(estado.mapa, tuberia.camino, tuberia.dn, clave)
                                  * CONFIG.tuberia.valorRecuperado);
      return `<div class="linea-aqui" style="--tono:${red.color}">
        <span class="linea-aqui-txt">Por aquí pasa <b>${red.nombre.toLowerCase()}</b>:
          ${d.nombre} de ${tuberia.camino.length} casillas.</span>
        <button class="linea-aqui-btn" data-accion="quitarLinea" data-clave="${indice}">
          Levantarla (+${formatear(recupera)} €)</button>
      </div>`;
    }).join('');
  }

  /** El botón de derribo: al final y en su color — destructivo pero con salida. */
  botonDerribar(obra){
    const def = CONFIG.construibles[obra.tipo];
    const recupera = Math.round(def.coste * (obra.nivel || 1)
                                * CONFIG.derribo.fraccionRecuperada);
    return `<button class="mejora obra derribo" data-accion="derribarObra" style="--tono:#f05a4a">
      <span class="m-cab"><span class="m-nom">Derribar</span></span>
      <span class="m-desc">La casilla queda libre y del derribo se recuperan
        ${formatear(recupera)} €.</span>
    </button>`;
  }

  /**
   * La CARA del guía cambia un momento con lo que pasa: celebra los pasos y se
   * preocupa con las averías. Solo si esa cara existe (guia_bien/guia_mal.jpg,
   * de la hoja de tres): sin archivos, el guía se queda sereno y no pasa nada.
   */
  /** El respingo del avatar: algo nuevo que decir o un cambio de cara. */
  respingoGuia(){
    const avatar = document.querySelector('.guia-avatar');
    if(!avatar) return;
    avatar.classList.remove('respingo');
    void avatar.offsetWidth;                     // reencender la animación
    avatar.classList.add('respingo');
    // La clase se va al terminar: si se quedara, taparía el bote de hablar
    clearTimeout(this._respingoTemp);
    this._respingoTemp = setTimeout(() => avatar.classList.remove('respingo'), 550);
  }

  /**
   * Los botecitos de "está hablando": main.js pregunta al sonido y avisa aquí.
   * Con caché del último valor, que tocar el DOM sesenta veces por segundo
   * para dejarlo igual sería de mala educación.
   */
  marcarHablando(hablando){
    if(this._hablando === hablando) return;
    this._hablando = hablando;
    const avatar = document.querySelector('.guia-avatar');
    if(avatar) avatar.classList.toggle('hablando', hablando);
  }

  caraGuia(animo){
    this.respingoGuia();                         // el cambio de cara se nota
    const img = document.querySelector('.guia-avatar img');
    if(!img || img.hidden) return;               // sin retrato no hay teatro
    const src = `assets/guia_${animo}.jpg`;
    this._carasOk = this._carasOk || {};
    const poner = () => {
      img.src = src;
      clearTimeout(this._caraTemp);
      this._caraTemp = setTimeout(() => { img.src = 'assets/guia.jpg'; }, 3500);
    };
    if(this._carasOk[src]){ poner(); return; }
    if(this._carasOk[src] === false) return;
    const prueba = new Image();
    prueba.onload = () => { this._carasOk[src] = true; poner(); };
    prueba.onerror = () => { this._carasOk[src] = false; };
    prueba.src = src;
  }

  /**
   * La situación de una obra: 'averiada', 'suelta' (sin red que le llegue) o
   * '' (en servicio). Es lo primero que el panel debe decir, porque una pieza
   * en cualquiera de los dos primeros estados no aporta nada.
   */
  estadoDeObra(estado, obra){
    if(averiaEn(estado, obra.col, obra.fila)) return 'averiada';
    const red = Object.keys(CONFIG.redes)
      .find(k => CONFIG.redes[k].piezas.includes(obra.tipo));
    if(red && !casillaEnRed(estado, obra.col, obra.fila, red)) return 'suelta';
    return '';
  }

  /**
   * Qué aporta una pieza del mapa a su nivel actual, en cristiano y con sus
   * números. Es la respuesta a "¿cuál de mis dos depósitos es este?": el que
   * dice lo que dice esta ficha.
   */
  queAporta(tipo, nivel){
    const P = CONFIG.aportePorPieza;
    switch(tipo){
      case 'captacion':
        return `Aporta <b>${(nivel * P.captacion).toFixed(2)} L/s</b> de producción
                continua al pueblo, sin clicar.`;
      case 'bomba':
        return `Suma <b>${formatear(nivel * P.bomba)} L</b> a cada clic de bombeo.`;
      case 'deposito':
        return `Añade <b>${formatear(nivel * P.deposito)} L</b> de capacidad de reserva.`;
      case 'potabilizadora':
        return `Potabiliza <b>${formatear(nivel * P.potabilizadora)} L/h</b> de agua
                bruta del río o de pozos exprimidos. Sin tratar, esa agua frena
                el crecimiento.`;
      case 'depuradora':
        return `Trata <b>${formatear(nivel * P.depuradora)} L/h</b> de aguas residuales
                y mejora la limpieza un <b>${Math.round(nivel * P.depuradoraCalidad * 100)} %</b>.`;
      case 'tanque':
        return `Retiene <b>${formatear(nivel * P.tanque)} L</b> de punta de tormenta
                para tratarlos cuando la depuradora respire.`;
      default: return '';
    }
  }

  /**
   * Anima los diagramas que haya en pantalla. Los llama `main.js` en cada
   * fotograma con el dt real: son uno o dos como mucho y solo se pintan si están
   * visibles, así que no hace falta ni observador ni temporizadores.
   */
  animarDiagramas(dt){
    this.relojDiagrama = (this.relojDiagrama || 0) + dt;
    for(const c of document.querySelectorAll('canvas[data-diagrama]')){
      if(!c.isConnected || !c.offsetParent) continue;
      dibujarDiagrama(c.getContext('2d'), c.dataset.diagrama,
                      c.width, c.height, this.relojDiagrama);
    }
  }

  /**
   * LA FICHA DIVULGATIVA de una pieza. El autor trabaja en esto y quiere que
   * quien juegue acabe sabiendo algo del oficio, así que cada instalación cuenta
   * qué es de verdad, para qué sirve y un detalle que no se ve desde fuera.
   *
   * No es texto de juego: no habla de costes ni de niveles. Va aparte a
   * propósito para que se pueda leer sin ruido y para que sea evidente, al
   * añadir una pieza nueva, que también hay que explicarla.
   */
  fichaHTML(def, clave){
    if(!def || !def.ficha) return '';
    const f = def.ficha;
    // El DIAGRAMA va primero y es lo que hace que se lea lo de abajo. Un muro de
    // texto no lo abre nadie; una animación pequeña con algo corriendo por
    // dentro sí se mira, y una vez mirada ya estás leyendo.
    const dib = clave && hayDiagrama(clave)
      ? `<canvas class="ficha-dib" data-diagrama="${clave}" width="440" height="240"></canvas>`
      : '';
    return `
      <div class="ficha" style="--tono:${def.color}">
        ${dib}
        <p class="ficha-tit">¿Qué es?</p>
        <p class="ficha-txt">${f.que}</p>
        <p class="ficha-tit">¿Para qué sirve?</p>
        <p class="ficha-txt">${f.para}</p>
        <p class="ficha-tit ficha-dato-tit">Del oficio</p>
        <p class="ficha-txt ficha-dato">${f.dato}</p>
      </div>`;
  }

  /**
   * Mientras tienes una pieza elegida para colocar, su ficha se lee ANTES de
   * pagarla. Aprender lo que estás a punto de construir es justo el momento en
   * el que apetece leerlo.
   */
  refrescarFichaObra(estado){
    const panel = document.getElementById('panel-ficha');
    const clave = estado.modo.tipo === 'colocar' ? estado.modo.elemento : null;
    if(this.cache.fichaFirma === clave) return;
    this.cache.fichaFirma = clave;

    if(!clave){ panel.style.display = 'none'; return; }
    const def = CONFIG.construibles[clave];
    panel.style.display = '';
    document.getElementById('ficha').innerHTML = `
      <p class="red-cuello" style="--tono:${def.color}"><b>${def.nombre}</b></p>
      ${this.fichaHTML(def, clave)}`;
  }

  /**
   * LA FICHA DE LA CASILLA. Clicar terreno vacío no hacía nada; ahora cuenta qué
   * es, qué cuesta cruzarlo con cada red y qué cabe encima. Con nueve terrenos y
   * precios que se van de 12 a 190 €, el jugador necesita poder mirar antes de
   * decidir por dónde tira la conducción — y mirar tiene que ser gratis.
   *
   * El dibujo NO es un icono aparte: es la misma casilla del mapa, pintada por
   * la escena en un lienzo pequeño. Así no hay dos verdades sobre qué aspecto
   * tiene un pedregal, y si algún día cambia el dibujo la ficha cambia sola.
   */
  refrescarCasilla(estado, escena){
    const panel = document.getElementById('panel-casilla');
    const sel = estado.seleccion;
    const celda = sel ? celdaEn(estado.mapa, sel.col, sel.fila) : null;

    // La ficha solo sale para terreno pelado: si hay obra, hallazgo o restos, ya
    // tienen su propio panel y este estorbaría.
    const hayOtra = celda && (celda.hallazgo || (celda.arqueologia && celda.aflorado)
      || estado.construcciones.some(o => o.col === sel.col && o.fila === sel.fila));
    const vale = celda && !celda.oculta && !hayOtra;

    const firma = vale ? `${sel.col},${sel.fila},${celda.tipo},${celda.protegida || ''},`
                       + `${celda.estudiada ? 1 : 0}${celda.sondeo || ''},`
                       + lineasEnCasilla(estado, sel.col, sel.fila).length : 'nada';
    if(this.cache.casillaFirma === firma) return;
    this.cache.casillaFirma = firma;

    if(!vale){ panel.style.display = 'none'; return; }
    panel.style.display = '';

    const def = CONFIG.terrenos[celda.tipo] || CONFIG.terrenos.prado;

    // Una zona protegida no enseña costes de obra: enseña por qué no los hay.
    if(celda.protegida){
      const Z = CONFIG.proteccion;
      document.getElementById('casilla').innerHTML = `
        <p class="red-cuello" style="--tono:${Z.color}">
          <b>Zona de especial conservación</b> ·
          ${celda.protegida === 'fauna' ? 'hábitat de fauna' : 'flora protegida'}
        </p>
        <p class="m-desc">Entorno protegido por el Estado. No se puede construir
          ni tender redes: hay que rodearla. Y si tus lixiviados la alcanzan,
          multa de ${formatear(Z.multaPorHoraCelda)} €/h por casilla dañada
          mientras dure el daño.</p>`;
      return;
    }
    const FAM = { llano: 'Terreno llano', arbolado: 'Arbolado',
                  relieve: 'Relieve', agua: 'Masa de agua' };

    // Lo que cuesta meter cada red por aquí, con el calibre que tengas elegido
    const redes = Object.entries(CONFIG.redes)
      .filter(([, r]) => !r.requiere || servicioActivo(estado.activo, r.requiere))
      .map(([k, r]) => {
        const c = costeCasillaTuberia(celda, estado.dnActual[k], k);
        const obra = CONFIG.tuberia.nombreObra[celda.tipo] || 'obra';
        return `<div class="casilla-fila"><span>${r.nombre} · ${obra}</span>
                  <b style="color:${r.color}">${formatear(c)} €</b></div>`;
      }).join('');

    // Y qué piezas admite. Es la pregunta que de verdad se hace uno al mirar.
    const cabe = Object.entries(CONFIG.construibles)
      .filter(([k]) => puedeColocar(estado.mapa, estado.construcciones, k, sel.col, sel.fila).ok)
      .map(([, d]) => d.nombre);

    document.getElementById('casilla').innerHTML = `
      <div class="casilla-cab" style="--tono:${def.color}">
        <canvas id="casilla-lienzo" width="128" height="128"></canvas>
        <div>
          <div class="casilla-nom">${def.nombre}</div>
          <div class="casilla-fam">${FAM[def.familia] || ''}</div>
        </div>
      </div>
      <div class="casilla-datos">
        <div class="casilla-fila"><span>Destapar</span><b>×${def.costeExtra}</b></div>
        ${redes}
      </div>
      ${this.bloqueLineas(estado, sel)}
      ${this.bloqueSubsuelo(estado, celda, sel)}
      <p class="casilla-cabe">${cabe.length
        ? 'Aquí cabe: <b>' + cabe.join('</b>, <b>') + '</b>.'
        : 'Aquí no cabe ninguna instalación.'}</p>`;

    this.pintarMiniCasilla(estado, escena, celda, sel);
  }

  /**
   * EL SUBSUELO de la casilla: lo único que se ve del agua subterránea. Cuenta
   * en qué punto de la cadena está esta casilla —sin estudiar, estudiada con o
   * sin indicios, perforada— y ofrece el paso siguiente con su precio.
   *
   * Lo que NUNCA dice es si hay agua debajo: eso solo lo sabe la perforación, y
   * si la ficha lo adelantara no habría prospección que valiera.
   */
  bloqueSubsuelo(estado, celda, sel){
    const A = CONFIG.acuiferos;
    if(celda.tipo === 'agua' || celda.tipo === 'lago') return '';

    if(celda.sondeo === 'positivo'){
      const clase = claseAcuifero(celda);
      const info = masasDelMapa(estado.mapa).get(celda.masa);
      const nivel = nivelMasa(estado, celda.masa);
      const pozos = pozosPorMasa(estado).get(celda.masa) || 0;
      // El dato que de verdad importa y que nadie enseña: cuánto se puede sacar
      // sin vaciarlo. Con eso se decide si cabe un segundo pozo o no.
      const sostenible = info ? caudalSostenible(info) : 0;
      // Lo que los pozos PIDEN (a acuífero lleno) contra lo que da ahora. La
      // comparación tiene que ser con lo que piden: con lo que sacan ya mermado,
      // un acuífero hundido daba "extracción sostenible" — que es justo lo que
      // el jugador necesita NO creerse.
      const pidiendo = pozos * caudalPozo(clase, 1, 1);
      const sacando = pozos * caudalPozo(clase, nivel, 1);
      const pasado = pidiendo > sostenible + 1e-6;
      return `<div class="subsuelo" style="--tono:${clase.color}">
        <div class="subsuelo-cab">Sondeo con agua · ${clase.nombre}</div>
        <p class="m-desc">${clase.desc}</p>
        <div class="nivel-acuifero">
          <div class="nivel-barra"><i style="width:${Math.round(nivel * 100)}%;
            background:${nivel < CONFIG.acuiferos.umbralMerma ? '#f0a04a' : clase.color}"></i></div>
          <span>${Math.round(nivel * 100)}%</span>
        </div>
        <div class="casilla-fila"><span>Caudal sostenible</span>
          <b>${sostenible.toFixed(2)} L/s</b></div>
        <div class="casilla-fila"><span>${pozos === 1 ? 'Pide el pozo' : 'Piden los pozos'}</span>
          <b style="color:${pasado ? '#f0a04a' : 'inherit'}">${pidiendo.toFixed(2)} L/s</b></div>
        ${nivel < CONFIG.acuiferos.umbralMerma ? `<div class="casilla-fila">
          <span>Está dando</span><b style="color:#f0a04a">${sacando.toFixed(2)} L/s</b></div>` : ''}
        <p class="m-desc">${pozos === 0
          ? 'Construye aquí el pozo y engánchalo a la red para que cuente.'
          : pasado
            ? 'Sacas más de lo que entra: el nivel baja y el pozo da cada vez ' +
              'menos. Y no lo arregla otro pozo — el acuífero acaba entregando ' +
              'lo que le devuelve la lluvia y nada más; lo único que consigues ' +
              'perforando otra vez es tener el nivel por los suelos.'
            : 'Extracción sostenible: entra tanto como sale y el nivel aguanta.'}</p>
      </div>`;
    }
    if(celda.sondeo === 'seco'){
      return `<div class="subsuelo seco">
        <div class="subsuelo-cab">Sondeo seco</div>
        <p class="m-desc">Aquí se perforó y no había nada. Un punto descartado
          también es información: el acuífero, si lo hay, está en otro sitio.</p></div>`;
    }

    const puedeS = puedeSondear(estado.mapa, sel.col, sel.fila);
    const botonSondeo = puedeS.ok
      ? `<button class="mejora obra" data-accion="sondear" style="--tono:${A.color}">
           <span class="m-cab"><span class="m-nom">Perforar un sondeo</span></span>
           <span class="m-desc">${celda.indicios && celda.estudiada
             ? 'Con indicios favorables: aquí es donde hay que probar.'
             : 'Sin indicios, es una apuesta cara: casi siempre sale seco.'}</span>
           <span class="m-coste">${formatear(costeSondeo(celda))} €</span>
         </button>`
      : '';

    if(!celda.estudiada){
      return `<div class="subsuelo" style="--tono:${A.color}">
        <div class="subsuelo-cab">Subsuelo sin estudiar</div>
        <p class="m-desc">Nadie ha mirado qué hay debajo. El estudio cubre
          ${A.estudio.radio * 2 + 1}×${A.estudio.radio * 2 + 1} casillas y dice
          dónde hay indicios de agua — que no es lo mismo que encontrarla.</p>
        <button class="mejora obra" data-accion="estudiarZona" style="--tono:${A.color}">
          <span class="m-cab"><span class="m-nom">Estudio hidrogeológico</span></span>
          <span class="m-desc">Cartografía y geofísica de la zona.</span>
          <span class="m-coste">${formatear(costeEstudio())} €</span>
        </button>
        ${botonSondeo}</div>`;
    }
    return celda.indicios
      ? `<div class="subsuelo" style="--tono:${A.color}">
           <div class="subsuelo-cab">Indicios de agua</div>
           <p class="m-desc">La geología promete: formación permeable y
             estructura favorable. No garantiza nada — hay que perforar para
             saberlo.</p>
           ${botonSondeo}</div>`
      : `<div class="subsuelo esteril">
           <div class="subsuelo-cab">Estudiado · sin indicios</div>
           <p class="m-desc">Terreno impermeable. Perforar aquí sería tirar el
             dinero.</p>
           ${botonSondeo}</div>`;
  }

  /**
   * Pinta la casilla en el lienzo pequeño de la ficha reutilizando el dibujo de
   * la escena. Se le presta el contexto y se le pide una sola casilla: es el
   * mismo codigo que pinta el mapa, asi que no pueden acabar diciendo cosas
   * distintas.
   */
  pintarMiniCasilla(estado, escena, celda, sel){
    const lienzo = document.getElementById('casilla-lienzo');
    if(!lienzo || !escena) return;
    const ctx = lienzo.getContext('2d');
    const lado = lienzo.width;
    ctx.clearRect(0, 0, lado, lado);

    // La escena dibuja sobre SU contexto y con SU tamaño de casilla: se los
    // cambiamos un momento y se los devolvemos. Feo pero honrado, y evita
    // duplicar doscientas líneas de dibujo para una miniatura.
    const ctxReal = escena.ctx, wReal = escena._W, hReal = escena._H;
    escena.ctx = ctx; escena._W = lado; escena._H = lado;
    try{
      escena.dibujarTerreno(celda, sel.col, sel.fila, 0, 0, lado);
    } finally {
      escena.ctx = ctxReal; escena._W = wReal; escena._H = hReal;
    }
  }

  /** El almacén: piezas rescatadas, listas para colocar sin volver a pagarlas. */
  refrescarAlmacen(estado){
    const firma = estado.inventario.map(p => p.tipo).join(',');
    if(this.cache.almacenFirma === firma) return;
    this.cache.almacenFirma = firma;
    const panel = document.getElementById('panel-almacen');
    panel.style.display = estado.inventario.length ? '' : 'none';
    if(!estado.inventario.length) return;
    document.getElementById('almacen').innerHTML = estado.inventario.map((p, i) => {
      const def = CONFIG.construibles[p.tipo];
      return `
        <button class="mejora obra" data-accion="colocarDeInventario" data-clave="${i}"
                style="--tono:${def.color}">
          <span class="m-cab"><span class="m-nom">${def.nombre}</span></span>
          <span class="m-desc">Rescatada. Colócala donde quieras.</span>
          <span class="m-coste">gratis</span>
        </button>`;
    }).join('');
  }

  /** Marca qué herramienta está activa. */
  refrescarConstruccion(estado){
    const modo = estado.modo;
    document.querySelectorAll('#construir .obra').forEach(b => {
      const activa = (b.dataset.accion === 'elegirConstruible' && modo.elemento === b.dataset.clave)
                  || (b.dataset.accion === 'elegirRedYTender'
                      && modo.tipo === 'tuberia' && estado.redActual === b.dataset.clave);
      b.classList.toggle('activa', activa);
    });
  }

  /** Fuerza que el próximo refresco reconstruya todo (al cambiar de pueblo). */
  invalidarCache(){ this.cache = {}; }

  /* ---------------- PESTAÑAS DE PUEBLOS ---------------- */

  reconstruirPestanas(estado){
    const cont = document.getElementById('pestanas');
    if(!cont) return;
    // Los pueblos son dinámicos: no hay pestañas bloqueadas, los que faltan
    // están en el mapa esperando a que llegues. La cuenta de fase va al final.
    const faltan = faltanParaFase(estado);
    const conAveria = (estado.averias || []).length > 0;
    cont.innerHTML = estado.pueblos.map((p, i) => {
      const activa = i === estado.puebloActivo ? ' activa' : '';
      return `<button class="pestana${activa}${conAveria && i === estado.puebloActivo ? ' con-averia' : ''}"
        data-accion="cambiarPueblo" data-clave="${i}">${p.nombre}</button>`;
    }).join('') + (faltan != null
      ? `<span class="pestana bloqueada" title="Incorpora ${faltan} núcleos más para abrir el siguiente anillo">fase ${faseActual(estado)} · faltan ${faltan}</span>`
      : '');
  }

  /* ---------------- TIENDA (del pueblo activo) ---------------- */

  /**
   * La tienda va AGRUPADA POR SERVICIO, no como una lista suelta de mejoras. Es
   * la misma idea que ordena el juego entero: un pueblo necesita servicios, y
   * cada servicio tiene sus vías de mejora y su red. Puestas en fila, "tanque de
   * tormentas" y "potencia de bomba" parecían lo mismo.
   */
  construirTienda(){
    const cont = document.getElementById('tienda');
    const servicios = Object.entries(CONFIG.servicios)
      .sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0));

    // Red de seguridad: una mejora que no figure en ningún servicio no puede
    // desaparecer sin más de la tienda. Sería un fallo mudo —la añades, no la
    // ves, y no hay ningún error—, así que cae en un grupo suelto al final.
    const asignadas = new Set(servicios.flatMap(([, sv]) => sv.mejoras || []));
    const huerfanas = Object.keys(CONFIG.mejoras).filter(k => !asignadas.has(k));
    if(huerfanas.length){
      servicios.push(['otras', { nombre: 'Otras mejoras', siempre: true,
        desc: 'Sin servicio asignado en CONFIG.servicios.', mejoras: huerfanas }]);
    }

    cont.innerHTML = servicios.map(([sc, sv]) => {
      const dentro = (sv.mejoras || [])
        .filter(k => CONFIG.mejoras[k])
        .map(k => {
          const m = CONFIG.mejoras[k];
          return `
            <button class="mejora" data-accion="mejorar" data-clave="${k}" id="mejora-${k}">
              <span class="m-cab">
                <span class="m-nom">${m.nombre}</span>
                <span class="m-nivel" id="nivel-${k}"></span>
              </span>
              <span class="m-desc">${m.desc}</span>
              <span class="m-coste" id="coste-${k}">—</span>
            </button>`;
        }).join('');
      const tono = (CONFIG.redes[sv.red] || {}).color || CONFIG.color.alarma;
      return `
        <div class="servicio" id="servicio-${sc}" style="--tono:${tono}">
          <p class="sv-cab">
            <span class="sv-nom">${sv.nombre}</span>
            <span class="sv-estado" id="sv-estado-${sc}"></span>
          </p>
          <p class="sv-desc">${sv.desc}</p>
          ${dentro}
        </div>`;
    }).join('');
  }

  refrescarTienda(estado){
    const p = estado.activo;

    // Cada servicio dice en qué punto está: de serie, en marcha, esperando a
    // crecer o todavía cerrado. Sin esto, las mejoras de un servicio dormido
    // salían igual que las demás y no se entendía por qué no hacían nada.
    for(const [sc, sv] of Object.entries(CONFIG.servicios)){
      const caja = document.getElementById('servicio-' + sc);
      const etq = document.getElementById('sv-estado-' + sc);
      if(!caja) continue;
      const activo = servicioActivo(p, sc);
      let texto = 'de serie';
      if(!sv.siempre){
        if(activo) texto = 'en marcha';
        else if(sv.requiere === 'pluviales') texto = 'con el tercer pueblo';
        else if(sv.requiere === 'residuos') texto = `desde ${formatear(CONFIG.residuos.activaEnHabitantes)} hab`;
        else if(sv.activaEnHabitantes) texto = `desde ${formatear(sv.activaEnHabitantes)} hab`;
        else texto = 'cerrado';
      }
      etq.textContent = texto;
      caja.classList.toggle('dormido', !activo);
    }

    for(const [clave, m] of this.mejoras){
      const nivel = p.mejoras[clave];
      const bt = document.getElementById('mejora-' + clave);
      const elN = document.getElementById('nivel-' + clave);
      const elC = document.getElementById('coste-' + clave);
      if(!bt) continue;

      // Mejoras de un servicio que todavía no está en marcha
      if(m.requiere && !servicioActivo(p, m.requiere)){
        bt.style.display = 'none';
        continue;
      }
      bt.style.display = '';

      elN.textContent = nivel > 0 ? 'Nv ' + nivel : '';

      if(nivel >= m.nivelMax){
        elC.textContent = 'AL MÁXIMO';
        bt.classList.add('comprada'); bt.classList.remove('inalcanzable');
        bt.disabled = true;
        continue;
      }
      bt.disabled = false;
      const coste = costeMejora(clave, nivel);
      elC.textContent = formatear(coste) + ' €';
      bt.classList.remove('comprada');
      bt.classList.toggle('inalcanzable', !estado.puedePagar(coste));
    }
  }

  /* ---------------- FUNCIÓN ESPECIAL: AUTO-BOMBEO (del pueblo activo) ------ */

  construirPremium(){
    const P = CONFIG.premium.autobomba;
    document.getElementById('premium').innerHTML = `
      <button class="premium" data-accion="activarAutobomba" id="premium-autobomba">
        <span class="p-cab">
          <span class="p-nom">✦ ${P.nombre}</span>
          <span class="p-etq" id="premium-etq"></span>
        </span>
        <span class="p-desc">${P.desc}</span>
        <div class="p-reqs" id="premium-reqs"></div>
        <span class="p-coste" id="premium-coste"></span>
      </button>`;
  }

  refrescarPremium(estado){
    const P = CONFIG.premium.autobomba;
    const p = estado.activo;
    const bt = document.getElementById('premium-autobomba');
    const etq = document.getElementById('premium-etq');
    const reqs = document.getElementById('premium-reqs');
    const coste = document.getElementById('premium-coste');
    if(!bt) return;

    if(p.autobombaActivo){
      etq.textContent = 'ACTIVO';
      reqs.innerHTML = '';
      coste.textContent = 'La bomba trabaja sola ✓';
      bt.classList.add('activa'); bt.classList.remove('lista', 'bloqueada');
      bt.disabled = true;
      return;
    }

    const req = requisitosAutobomba(p);
    const puede = req.cumple && estado.puedePagar(P.coste);
    etq.textContent = req.cumple ? 'DISPONIBLE' : 'BLOQUEADO';
    reqs.innerHTML = req.lista.map(f =>
      `<span class="p-req ${f.ok ? 'ok' : ''}">${f.ok ? '✓' : '○'} ${f.txt}</span>`).join('');
    coste.textContent = req.cumple ? `Activar · ${formatear(P.coste)} €`
                                   : 'Cumple los requisitos para activarlo';
    bt.classList.remove('activa');
    bt.classList.toggle('lista', puede);
    bt.classList.toggle('bloqueada', !req.cumple);
    bt.disabled = !req.cumple;
  }

  /* ---------------- AVERÍAS (del pueblo activo) ---------------- */

  /**
   * El panel NO repara: lista lo que está roto y te lleva hasta ello. Arreglarlo
   * es ir a la casilla y clicar encima. Un botón que lo resolviera desde aquí
   * volvería a convertir la avería en un trámite de panel, que es justo lo que
   * se ha quitado.
   */
  refrescarAverias(estado){
    const panel = document.getElementById('panel-averias');
    const lista = estado.averias || [];
    const firma = lista.map(a => `${a.col},${a.fila},${a.clics},${a.aManoJugada ? 1 : 0}`).join('|');
    if(this.cache.averiasFirma === firma) return;
    this.cache.averiasFirma = firma;

    panel.style.display = lista.length ? '' : 'none';
    if(!lista.length) return;

    const coste = CONFIG.averias.costePorClic;
    document.getElementById('averias-lista').innerHTML = lista.map((av, i) => {
      const obra = estado.construcciones.find(o => o.col === av.col && o.fila === av.fila);
      const def = obra ? CONFIG.construibles[obra.tipo] : null;
      return `
        <button class="mejora obra averia" data-accion="irAAveria" data-clave="${i}"
                style="--tono:${CONFIG.color.critico}">
          <span class="m-cab"><span class="m-nom">${def ? def.nombre : 'Instalación'} · fuera de servicio</span></span>
          <span class="m-desc">Está fuera de servicio y no cuenta en la red.
            Ve hasta ella y clica encima: ${av.clics === 1
              ? 'le falta <b>1</b> golpe de llave'
              : `le faltan <b>${av.clics}</b> golpes de llave`},
            a ${formatear(coste)} € cada uno.</span>
          <span class="m-coste">ir ahí →</span>
        </button>
        ${av.aManoJugada ? '' : `
        <button class="mejora obra" data-accion="repararAMano" data-clave="${i}"
                style="--tono:${CONFIG.color.agua || '#38bdf8'}">
          <span class="m-cab"><span class="m-nom">Repararla a mano</span></span>
          <span class="m-desc">Monta el tramo antes de que llegue el agua y queda
            arreglada GRATIS. Un solo intento: si se derrama, a golpe de llave.</span>
          <span class="m-coste">jugar</span>
        </button>`}`;
    }).join('');
  }

  /* ---------------- CAUCE (común) ---------------- */

  refrescarCauce(estado, resultado){
    const panel = document.getElementById('panel-cauce');
    // Solo tiene sentido cuando algún pueblo ya vierte, o si hay suciedad
    const algunoVierte = estado.pueblos.some(p => p.desbloqueado && servicioActivo(p, 'saneamiento'));
    const visible = algunoVierte || estado.contaminacion > 0.5;
    panel.style.display = visible ? '' : 'none';
    if(!visible) return;

    const pct = Math.round((resultado.suciedad || 0) * 100);
    const barra = document.getElementById('barra-cauce');
    if(barra){
      barra.style.width = pct + '%';
      barra.className = 'barra-cauce-relleno ' +
        (pct >= 66 ? 'critico' : pct >= 33 ? 'alarma' : 'ok');
    }
    this.fijar('cauce-pct', pct + '% sucio',
      pct >= 66 ? 'critico' : pct >= 33 ? 'alarma' : 'ok');
    this.fijar('cauce-multa',
      (resultado.multaHora !== undefined ? resultado.multaHora : 0).toFixed(0));
  }

  /* ---------------- HUD ---------------- */

  fijar(id, valor, clase){
    if(this.cache[id] === valor) return;
    this.cache[id] = valor;
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = valor;
    if(clase) el.className = 'v ' + clase;
  }

  actualizar(estado, resultado){
    const p = estado.activo;
    const cap = capacidad(p, estado);
    const pct = Math.round((p.agua / cap) * 100);

    this.fijar('hud-agua', `${formatear(p.agua)} / ${formatear(cap)} L`,
      p.agua < cap * 0.08 ? 'critico' : 'agua');
    // En caudal DE JUEGO, la unidad del oficio: 0,41 L/s para un pueblo de 200
    // habitantes es un dato de verdad. Antes mostraba litros por segundo REAL
    // (clics incluidos) y con el desglose al lado eran dos verdades a la vista.
    // El clic no entra aquí: su respuesta es la escena y el nivel del depósito.
    const caudal = caudalCaptacion(p, estado, resultado.estiaje || 1);
    this.fijar('hud-produccion',
      (caudal < 10 ? caudal.toFixed(2) : formatear(caudal)) + ' L/s',
      resultado.averiada ? 'critico' : (caudal > 0 ? 'ok' : 'neutro'));
    this.fijar('hud-dinero', formatear(estado.dinero) + ' €',
      estado.dinero < 0 ? 'critico' : 'dinero');
    this.fijar('hud-poblacion',
      Math.floor(p.habitantes).toLocaleString('es-ES') + ' hab', 'neutro');

    const serv = Math.round(resultado.servicio * 100);
    this.fijar('hud-servicio', serv + ' %',
      serv >= 100 ? 'ok' : serv >= 50 ? 'alarma' : 'critico');

    const suc = Math.round((resultado.suciedad || 0) * 100);
    this.fijar('hud-cauce', suc + ' %',
      suc >= 66 ? 'critico' : suc >= 33 ? 'alarma' : 'ok');

    // Poder de expansión: lo que enlaza abastecer bien con explorar barato
    const poder = poderExpansion(estado);
    this.fijar('hud-expansion', '×' + poder.toFixed(2),
      poder >= 1.5 ? 'ok' : poder >= 1 ? 'neutro' : 'critico');

    const h = Math.floor(estado.horas % 24);
    const horasAño = CONFIG.tiempo.horasPorAño;
    const mes = MESES[Math.floor(((estado.horas % horasAño) / horasAño) * MESES.length)];
    this.fijar('hud-reloj', `${String(h).padStart(2,'0')}:00 · ${mes}`,
      (resultado.punta || 1) > 1.4 ? 'alarma' : 'neutro');

    const barra = document.getElementById('barra-agua');
    if(barra) barra.style.width = limitarPct(pct) + '%';

    // Multa por hora, para el panel de cauce
    resultado.multaHora = (resultado.suciedad || 0) * CONFIG.cauce.multaMaxPorHora;

    this.refrescarHito(estado);
    this.refrescarGuia(estado);
    this.refrescarPaletaObra(estado);
    this.refrescarRed(estado, resultado);
    this.refrescarDiagnostico(estado, resultado);
    this.refrescarLugares(estado);
    this.refrescarObra(estado);
    this.refrescarCasilla(estado, this.escena);
    this.refrescarFichaObra(estado);
    this.refrescarHallazgo(estado);
    this.refrescarAlmacen(estado);
    this.refrescarTienda(estado);
    this.refrescarPremium(estado);
    this.refrescarAverias(estado);
    this.refrescarExpediente(estado);
    this.refrescarCauce(estado, resultado);
    this.marcarPestanaAveria(estado);
    this.actualizarPanel(estado, resultado);
    this.actualizarRegistro(estado);
  }

  /** Pinta una alerta en la pestaña de cualquier pueblo con avería. */
  marcarPestanaAveria(estado){
    const firma = (estado.averias || []).length + '|' + estado.puebloActivo;
    if(this.cache.pestanaFirma === firma) return;
    this.cache.pestanaFirma = firma;
    this.reconstruirPestanas(estado);
  }

  actualizarPanel(estado, resultado){
    const p = estado.activo;
    const P = CONFIG.poblacion;
    const dem = demandaMedia(p.habitantes);
    const consumoAhora = dem * (resultado.punta || 1) * 3600 / 1000;
    const prodAhora = caudalCaptacion(p, estado, resultado.estiaje || 1) * 3600 / 1000;

    let tendencia, claseT;
    if((estado.averias || []).length){ tendencia = 'Avería sin reparar'; claseT = 'critico'; }
    else if(resultado.servicio >= P.servicioBueno){
      const listo = p.racha >= P.horasBuenServicioParaCrecer;
      tendencia = listo ? 'Creciendo ▲' : 'Ganándose la confianza…';
      claseT = listo ? 'ok' : 'neutro';
    } else if(resultado.servicio < P.servicioMalo){
      tendencia = 'Despoblándose ▼'; claseT = 'critico';
    } else { tendencia = 'Estable'; claseT = 'alarma'; }

    // El nombre sale de la MISMA tabla que pinta la escena; el paréntesis
    // describe cómo va el caudal, para que nunca se contradigan.
    const est = resultado.estiaje || 1;
    const estacion = nombreEstacion(estado.horas) +
      (est < 0.7 ? ' · estiaje' : est > 1.1 ? ' · deshielo' : '');
    const nivelDep = p.mejoras.deposito;
    const reserva = nivelDep === 0 ? 'Sin depósito' : `Nivel ${nivelDep} · ${formatear(capacidad(p, estado))} L`;
    const sane = servicioActivo(p, 'saneamiento')
      ? (p.mejoras.depuradora > 0 ? `Depuradora Nv ${p.mejoras.depuradora}` : 'SIN depurar ⚠')
      : 'Aún no genera';

    // Lluvia y tormentas (solo cuando la mancomunidad ya gestiona pluviales)
    const lluviaPct = Math.round((resultado.lluvia || 0) * 100);
    const tanquePct = Math.round((resultado.tanqueFrac || 0) * 100);
    const filaLluvia = estado.pluvialesActivas ? `
      <div class="d-fila"><span>Lluvia</span><b class="${lluviaPct > 50 ? 'agua' : ''}">${lluviaPct} %</b></div>
      <div class="d-fila"><span>Pluviales</span><b>${p.mejoras.pluviales > 0 ? 'Nivel ' + p.mejoras.pluviales : 'Sin separar ⚠'}</b></div>
      <div class="d-fila"><span>Tanque tormentas</span><b class="${resultado.aliviando ? 'critico' : ''}">${
        capacidadTanque(p, estado) > 0 ? tanquePct + ' % lleno' : '—'}${resultado.aliviando ? ' · ALIVIANDO' : ''}</b></div>
      <div class="d-fila"><span>Calidad</span><b class="${(resultado.calidad || 1) > 1.05 ? 'ok' : ''}">×${(resultado.calidad || 1).toFixed(2)}</b></div>` : '';

    // Residuos: cuánto se recicla, cuánto deja y cuánta basura hay tirada
    const basuraPct = Math.round((resultado.basuraCalle || 0) * 100);
    const recicPct = resultado.basuraTh > 0
      ? Math.round((resultado.recicladaTh || 0) / resultado.basuraTh * 100) : 0;
    const filaResiduos = servicioActivo(p, 'residuos') ? `
      <div class="d-fila"><span>Basura</span><b>${(resultado.basuraTh || 0).toFixed(3)} t/h</b></div>
      <div class="d-fila"><span>Se recicla</span><b class="${recicPct > 0 ? 'ok' : 'alarma'}">${recicPct} %</b></div>
      <div class="d-fila"><span>Venta de material</span><b class="${(resultado.ingresoResiduosHora || 0) > 0 ? 'dinero' : 'critico'}">${
        formatear(resultado.ingresoResiduosHora || 0)} €/h</b></div>
      <div class="d-fila"><span>Sin recoger</span><b class="${basuraPct > 20 ? 'critico' : ''}">${basuraPct} %</b></div>` : '';

    const firma = [p.nombre, tendencia, Math.floor(p.habitantes),
                   nivelDep, p.mejoras.captacion, estacion, sane, basuraPct, recicPct,
                   estado.pluvialesActivas, lluviaPct, tanquePct,
                   resultado.aliviando, p.mejoras.pluviales, p.mejoras.tanque].join('|');
    if(this.cache.panelFirma === firma) return;
    this.cache.panelFirma = firma;

    document.getElementById('detalle').innerHTML = `
      <div class="d-fila"><span>Pueblo</span><b>${p.nombre}</b></div>
      <div class="d-fila"><span>Tendencia</span><b class="${claseT}">${tendencia}</b></div>
      <div class="d-fila"><span>Habitantes</span><b>${Math.floor(p.habitantes).toLocaleString('es-ES')}</b></div>
      <div class="d-fila"><span>Consumo ahora</span><b>${consumoAhora.toFixed(2)} m³/h</b></div>
      <div class="d-fila"><span>Captación</span><b>${prodAhora > 0 ? prodAhora.toFixed(2) + ' m³/h' : '—'}</b></div>
      <div class="d-fila"><span>Estación</span><b>${estacion}</b></div>
      <div class="d-fila"><span>Reserva</span><b>${reserva}</b></div>
      <div class="d-fila"><span>Saneamiento</span><b class="${servicioActivo(p, 'saneamiento') && p.mejoras.depuradora === 0 ? 'alarma' : ''}">${sane}</b></div>
      ${filaLluvia}
      ${filaResiduos}`;
  }

  actualizarRegistro(estado){
    const firma = estado.registro.length + ':' + (estado.registro[0]?.texto || '');
    if(this.cache.regFirma === firma) return;
    this.cache.regFirma = firma;
    const cont = document.getElementById('registro');
    if(!estado.registro.length){
      cont.innerHTML = '<div class="reg vacio">Sin novedades.</div>';
      return;
    }
    cont.innerHTML = estado.registro.slice(0, 8).map(r =>
      `<div class="reg ${r.nivel}"><em>${r.h} h</em> ${r.texto}</div>`).join('');
  }
}

const limitarPct = p => p < 0 ? 0 : p > 100 ? 100 : p;
