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
import { capacidad, demandaMedia, caudalCaptacion, costeCuadrilla, nivelMaxPieza,
         requisitosAutobomba, capacidadTanque, nombreEstacion,
         poderExpansion, redEstrangula, capacidadTratamiento,
         servicioActivo, nivelReciclaje, fraccionesActivas,
         faseActual, faltanParaFase, canonIncorporacion,
         aguaBrutaLh, factorEstiaje, capacidadPotabilizacion,
         llenadoVaso, capacidadVaso, costeAmpliarVertedero,
         nivelMasa, pozosPorMasa, caudalPozo, caudalSostenible,
         desgloseProduccion, tasaFugasRed, costeAmpliarPieza,
         escalonCaserio, costeEstudio, veteraniaAlTrasladarse,
         clicsAutoPorSeg, litrosPorClic } from './simulacion.js';
import { legado, nivelVentaja, costeVentaja, regionActual,
         epocaActual } from './legado.js';
import { formatear } from './util.js';
import { celdaEn, piezaDeRuina, diametro, nivelDiametro, costeRenovar,
         nombreDeNucleo, tipoYacimiento, nucleoMasCercano,
         costeCasillaTuberia, puedeColocar, conjuntoDeRed,
         lineasConectadas, cuelloDeBotella, escalaDeRed,
         claseAcuifero, puedeSondear, costeSondeo,
         masasDelMapa, edadAños, fugasDe,
         nombreDeObra, averiaEn, casillaEnRed,
         lineasEnCasilla, redDe, costeTrazado, relieveMasCercano } from './mapa.js';
import { lista as listaLugares } from './lugares.js';
import { pasoActual } from './tutorial.js';
import { tajoActual } from './tajos.js';
import { dibujarDiagrama, hayDiagrama } from './diagramas.js';
// La etiqueta de traducción (se escribe t delante de la plantilla): las
// frases que este módulo monta en vivo se quedan en castellano AQUÍ (la
// fuente) y el diccionario inglés las busca por su esqueleto. Ver idioma.js.
// OJO al escribir comentarios: sin acentos graves alrededor de la t, que el
// extractor de esqueletos (assets/extraer_frases.py) se los toma por código.
import { t } from './idioma.js';

export class UI {

  constructor(entrada){
    this.entrada = entrada;
    this.cache = {};
    this.construirServicios();
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
            <span class="m-cab"><span class="m-nom">${t`Colocar ${r.corto}`}</span>
              <span class="m-coste" id="tender-coste-${clave}">—</span></span>
            <span class="m-desc">${t`Marca el recorrido casilla a casilla. Clic en la
              última para rematar, en la anterior para deshacer.`}</span>
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
      if(etq && abierta){
        // MIENTRAS TRAZAS, la etiqueta del botón se vuelve el taxímetro:
        // "N casillas · X €" en vivo. En escritorio ya lo decía el cartel
        // del cursor, pero en MÓVIL no hay hover y el probador frío remaba
        // a ciegas — con 300 € justos, el precio se ve ANTES de rematar.
        const trazado = estado.modo.trazado;
        if(estado.modo.tipo === 'tuberia' && estado.redActual === clave
           && trazado && trazado.length){
          const total = costeTrazado(estado.mapa, trazado, estado.dnActual[clave], clave);
          etq.textContent = t`${trazado.length} casillas · ${formatear(total)} €`;
          etq.style.color = estado.puedePagar(total) ? '' : 'var(--critico, #ef4444)';
        } else {
          etq.textContent = diametro(estado.dnActual[clave], clave).nombre;
          etq.style.color = '';
        }
      }
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
    // Las pluviales no existen hasta que se abre el cuarto pueblo
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
        <i>${t`${this.medidaTier(clave, d)} · ${Math.round(d.fugas * 100)} % fugas`}</i>
      </button>`).join('');

    // La regla de escala: a final de partida hay DOCENAS de líneas, y aquí se
    // pintaban todas. Las que piden obra van primero; el listado se corta en
    // CONFIG.interfaz.lineasEnPanel y el resto se resume en una línea.
    const valoradas = lineas.map(({ tuberia, indice }) => {
      const d = diametro(tuberia.dn, clave);
      const años = Math.floor(edadAños(tuberia, estado.horas));
      const vieja = d.vidaAños && años > d.vidaAños;
      const sube = nivelDiametro(tuberia.dn, clave) < nivelDiametro(objetivo.id, clave);
      // Al mismo calibre solo se renueva lo VIEJO: lo demás sería tirar dinero
      const renovable = sube
        || (vieja && nivelDiametro(objetivo.id, clave) === nivelDiametro(tuberia.dn, clave));
      return { tuberia, indice, d, años, vieja, sube, renovable };
    }).sort((a, b) => (b.renovable ? 1 : 0) - (a.renovable ? 1 : 0));
    const enPanel = valoradas.slice(0, CONFIG.interfaz.lineasEnPanel);
    const resto = valoradas.length - enPanel.length;
    const restoRenovables = valoradas.slice(CONFIG.interfaz.lineasEnPanel)
      .filter(v => v.renovable).length;

    const listado = !lineas.length
      ? `<p class="m-desc">${clave === 'saneamiento'
          ? t`Todavía no hay colector. El pueblo se apaña con la red unitaria vieja:
             ${D[0].nombre} de ${D[0].material}, y todo lo que no le cabe acaba en el río.`
          : t`Todavía no hay ninguna línea que llegue al pueblo. Mientras tanto bebe
             de la red vieja: ${D[0].nombre} de ${D[0].material}.`}</p>`
      : enPanel.map(({ tuberia, indice, d, años, vieja, sube, renovable }) => {
          const coste = renovable ? costeRenovar(estado.mapa, tuberia, objetivo.id, clave) : 0;
          return `
            <button class="mejora obra linea${renovable ? '' : ' hecha'}"
                    ${renovable ? `data-accion="renovarLinea" data-clave="${indice}"` : 'disabled'}
                    style="--tono:${vieja ? '#f0a04a' : d.color}">
              <span class="m-cab"><span class="m-nom">${t`${tuberia.camino.length} casillas · ${d.nombre}`}
                ${d.vidaAños ? `<i class="linea-edad${vieja ? ' vieja' : ''}">${t`${años} años`}</i>` : ''}
              </span></span>
              <span class="m-desc">${sube
                ? t`Renovar a ${objetivo.nombre} de ${objetivo.material}.`
                : vieja
                  ? t`Pasada de vida útil (${d.vidaAños} años del ${d.material}): fuga cada
                     vez más. Renovarla la deja nueva.`
                  : t`Ya está a la altura del diámetro elegido.`}</span>
              <span class="m-coste">${renovable ? formatear(coste) + ' €' : '—'}</span>
            </button>`;
        }).join('') + (resto > 0
          ? `<p class="m-desc">${restoRenovables > 0
              ? t`Y ${resto} líneas más (${restoRenovables} por renovar): al
                 atender estas, van entrando.`
              : t`Y ${resto} líneas más, todas al día.`}</p>`
          : '');

    const avisos = this.avisosRed(estado, clave, cuello, resultado)
      .map(av => `<p class="red-aviso">${av}</p>`).join('');

    document.getElementById('red').innerHTML = `
      <div class="red-tabs">${pestanas}</div>
      <p class="m-desc">${R.desc}</p>
      <p class="red-cuello" style="--tono:${cuello.def.color}">
        ${t`Manda el tramo más estrecho: <b>${cuello.def.nombre}</b> de ${cuello.def.material}`}
        ${cuello.estrechas > 1 ? `<i>${t`(${cuello.estrechas} líneas así)`}</i>` : ''}
      </p>
      ${avisos}
      <p class="m-desc">${R.esVial
        ? t`Clase de vía con que se tiende y a la que se renueva:`
        : t`Diámetro con que se tiende y a la que se renueva:`}</p>
      <div class="dn-selector">${selector}</div>
      ${listado}`;

    // Que el botón de tender diga QUÉ va a tender: si no, eliges aquí y luego
    // trazas allí sin saber si estás poniendo agua limpia o un colector.
    const nombre = document.querySelector('#obra-tuberia .m-nom');
    const etiqueta = document.querySelector('#obra-tuberia .m-coste');
    if(nombre) nombre.textContent = t`Colocar ${R.corto}`;
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
    return t`hasta ${formatear(d.habitantesMax)} hab`;
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
      ? `<p class="m-desc">${t`Los pueblos por descubrir llevan nombres de tu comarca
           (${nombres.length}): <b>${nombres.slice(0, 4).join('</b>, <b>')}</b>…
           Los ya incorporados conservan el suyo.`}</p>
         <button class="mejora obra" data-accion="quitarLugares">
           <span class="m-cab"><span class="m-nom">${t`Volver a los inventados`}</span></span>
           <span class="m-desc">${t`La lista de nombres se borra de este navegador.`}</span>
         </button>`
      : `<p class="m-desc">${t`Los pueblos del mapa pueden llamarse como los de tu
           comarca: encontrar tu zona en el juego tiene su gracia. Tu ubicación
           se usa UNA sola vez para preguntar a OpenStreetMap por los municipios
           cercanos, no se guarda, y aquí solo queda la lista de nombres.`}</p>
         <button class="mejora obra" data-accion="usarLugares">
           <span class="m-cab"><span class="m-nom">${t`Usar pueblos de mi zona`}</span></span>
           <span class="m-desc">${t`El navegador te pedirá permiso de ubicación.`}</span>
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
        ? ` <em class="diag-nota">${t`estiaje: el río viene bajo, −${(d.rioBruto - d.rio).toFixed(2)}`}</em>`
        : estiaje > 1.05
          ? ` <em class="diag-nota buena">${t`deshielo: viene crecido, +${(d.rio - d.rioBruto).toFixed(2)}`}</em>`
          : '';
      f.push(`<div class="casilla-fila"><span>${t`Del río`}${nota}</span><b>${L(d.rio)}</b></div>`);
    }
    if(d.pozos > 0 || pozosMermados){
      const nota = pozosMermados
        ? ` <em class="diag-nota mala">${t`acuífero bajo: dan menos`}</em>` : '';
      f.push(`<div class="casilla-fila"><span>${t`De los pozos`}${nota}</span><b>${L(d.pozos)}</b></div>`);
    }
    if(d.rioBruto <= 0 && d.pozos <= 0)
      f.push(`<p class="m-desc">${t`Sin captación conectada: toda el agua sale de tus
        clics. Una captación en el río —o un pozo— produce sola.`}</p>`);

    // Las mermas, solo las que están doliendo
    if(d.perdidaTope > 0.005)
      f.push(`<div class="casilla-fila"><span>${t`No cabe por ${d.red.def.nombre}`}
        <em class="diag-nota mala">${t`renovar la línea lo libera`}</em></span>
        <b class="diag-perdida">−${L(d.perdidaTope)}</b></div>`);
    if(d.fugas > 0.005){
      // Si la tasa supera la del material es que hay una línea vieja fugando
      const envejecida = tasaFugasRed(estado) > d.red.def.fugas + 0.005;
      f.push(`<div class="casilla-fila"><span>${t`Fugas del ${d.red.def.material}`}
        ${envejecida ? `<em class="diag-nota mala">${t`hay una línea vieja: renovarla lo corta`}</em>` : ''}</span>
        <b class="diag-perdida">−${L(d.fugas)}</b></div>`);
    }
    if(d.veneno > 0.005)
      f.push(`<div class="casilla-fila"><span>${t`Agua insalubre`}
        <em class="diag-nota mala">${t`lixiviados sobre tu toma`}</em></span>
        <b class="diag-perdida">−${L(d.veneno)}</b></div>`);
    if(d.paradas > 0)
      f.push(`<div class="casilla-fila"><span>${d.paradas === 1
          ? t`Una pieza parada por avería` : t`${d.paradas} piezas paradas por avería`}
        <em class="diag-nota mala">${t`repárala sobre el mapa`}</em></span>
        <b class="diag-perdida">${t`parada`}</b></div>`);

    // El cierre: lo que queda contra lo que pide el pueblo
    const cubre = d.neto >= dem;
    f.push(`<div class="casilla-fila diag-total"><span>${t`Produce`}</span><b>${L(d.neto)}</b></div>
      <div class="casilla-fila"><span>${t`El pueblo pide de media`}</span><b>${L(dem)}</b></div>
      <p class="m-desc">${cubre
        ? t`La captación cubre la demanda media; el depósito absorbe las puntas y tus clics son propina.`
        : t`La captación NO cubre la demanda: lo que falte sale de tus clics, o el pueblo pasa sed.`}</p>`);

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
          fuera.push(t`Una línea de ${Math.floor(edadAños(tuberia, estado.horas))} años
            (${d.material}, vida útil ${d.vidaAños}): fuga un
            ${Math.round((d.fugas + extra) * 100)} % y cada año irá a más.
            Renovarla —aunque sea al mismo calibre— la deja nueva.`);
          break;   // con avisar de la peor basta: el panel ya las lista todas
        }
      }
      if(redEstrangula(p, estado)) fuera.push(t`Tu captación da más agua de la que
        cabe por ${cuello.def.nombre}: se está perdiendo lo que sobra. Comprar más
        captación no servirá de nada hasta que ensanches la línea.`);
      if(p.habitantes >= cuello.def.habitantesMax * 0.95) fuera.push(t`El pueblo ha
        tocado techo: por ${cuello.def.nombre} no cabe agua para más de
        ${formatear(cuello.def.habitantesMax)} habitantes. Hasta que no renueves la
        línea entera, no crece.`);
      // AGUA SIN POTABILIZAR: el freno silencioso. Si no se cuenta aquí, el
      // jugador ve el pueblo estancado y no sabe por qué.
      if(resultado && (resultado.aguaBrutaLh || 0) > (resultado.aguaTrataLh || 0) + 1e-6)
        fuera.push(t`Estás sirviendo ${formatear(resultado.aguaBrutaLh - resultado.aguaTrataLh)}
          L/h de agua BRUTA sin potabilizar (del río, o de pozos exprimidos), y eso
          frena el crecimiento: nadie se fía de un grifo sin garantía. Una
          POTABILIZADORA conectada lo resuelve.`);
    } else if(clave === 'pluviales'){
      if(!cuello.lineas.length) fuera.push(t`No hay red de pluviales: la lluvia y las
        aguas fecales van juntas por el mismo colector, y en tormenta eso es lo que
        revienta a la depuradora. Tender una línea aparte saca del colector todo lo
        que le quepa.`);
      else if(resultado.lluviaLh > 0) fuera.push(t`Ahora mismo caen
        ${formatear(resultado.lluviaLh)} L/h sobre el pueblo y tu red se lleva
        ${formatear(resultado.separadaLh)} L/h. El resto baja por el colector.`);
    } else if(clave === 'residuos'){
      const piezas = (estado._conectadoRed || {}).residuos || {};
      if(!cuello.lineas.length) fuera.push(t`No hay carretera: el camión no tiene por
        dónde salir y la basura se queda en el pueblo. Aquí no hay ninguna vía vieja
        que valga, hay que tenderla.`);
      else if(!piezas.vertedero) fuera.push(t`Recoges la basura pero no tienes dónde
        dejarla: hace falta un VERTEDERO enganchado a la carretera, y lejos del agua.`);
      else if(resultado.basuraTh > resultado.recogidaTh + 1e-6) fuera.push(t`Se genera
        más basura de la que puede sacar la vía: ${(resultado.basuraTh || 0).toFixed(3)}
        t/h contra ${(resultado.recogidaTh || 0).toFixed(3)}. Lo que no sale se pudre
        en la calle —ya va por el ${Math.round((resultado.basuraCalle || 0) * 100)} %—
        y frena el crecimiento.`);
      if(!nivelReciclaje(p, estado)) fuera.push(t`Todo va al vertedero, y enterrar solo
        cuesta dinero. Con una PLANTA DE RECICLAJE conectada empiezas a separar
        fracciones y a venderlas: es la única parte del juego que ingresa aparte
        del agua.`);
    } else {
      if(servicioActivo(p, 'saneamiento') && !(estado._conectadoSan || {}).depuradora)
        fuera.push(t`El pueblo ya genera aguas residuales y no hay ninguna depuradora
          enganchada al colector. Todo lo que sale va crudo al cauce: constrúyela
          junto al agua y llévale una línea de saneamiento.`);
      if(resultado.rebosando) fuera.push(t`El colector está REBOSANDO: entra más agua
        de la que cabe por ${cuello.def.nombre} y se sale antes de llegar a la
        depuradora. Eso va al río sin tratar. Ensancha el colector o separa las
        pluviales.`);
      // El tapón se muda: en cuanto ensanchas el colector, llega TODO a la
      // depuradora y es ella la que no da abasto. Sin decirlo, el jugador
      // renueva la línea, ve el río igual de sucio y cree que no ha servido.
      const trata = capacidadTratamiento(p, estado);
      if(!resultado.rebosando && resultado.aliviando && servicioActivo(p, 'saneamiento'))
        fuera.push(t`El colector da de sí, pero la depuradora no: le llegan
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
    // Los logros llevan su propia imagen, amable: `l_` en vez de `h_`. Y las
    // tarjetas de PRIMERA VEZ (yacimiento, ruina, crecimiento) enseñan la
    // lámina del hallazgo CONCRETO que las disparó (estado.hitoImagen, lo
    // deja contarHito): ese arte ya existe en las fichas y es mejor tarjeta
    // que una ilustración genérica.
    img.src = estado.hitoImagen || `assets/${h.logro ? 'l' : 'h'}_${id}.jpg`;

    // La tarjeta cambia de tono: un problema entra en ámbar y un logro en verde.
    // Con el mismo color, la de "el río vuelve a estar vivo" se leía como otra
    // regañina antes de haber leído una sola palabra.
    document.getElementById('hito').classList.toggle('es-logro', !!h.logro);
    document.getElementById('hito-eti-pasa').textContent =
      h.logro ? t`Lo has conseguido` : t`Qué ha pasado`;
    document.getElementById('hito-eti-hacer').textContent =
      h.logro ? t`Qué viene ahora` : t`Qué tienes que hacer`;
    document.getElementById('hito-titulo').textContent = h.titulo;
    document.getElementById('hito-pasa').textContent = h.pasa;
    document.getElementById('hito-hacer').textContent = h.hacer;
    document.getElementById('hito-porque').textContent = h.porque;
  }

  /* ---------------- LA CARTA DEL TAJO ---------------- */

  /**
   * La respuesta fija a "¿y ahora qué?": el primer tajo pendiente de la
   * cadena, con su botón. Es UNA tarjeta siempre — la prioridad la pone el
   * orden de CONFIG.tajos, y src/tajos.js decide cuál toca.
   */
  refrescarTajo(estado, resultado){
    const def = tajoActual(estado, resultado);
    const firma = def ? def.id : 'nada';
    if(this.cache.tajoFirma === firma) return;
    this.cache.tajoFirma = firma;

    const panel = document.getElementById('panel-tajo');
    if(!def){ panel.style.display = 'none'; return; }
    panel.style.display = '';
    document.getElementById('tajo').innerHTML = `
      <div class="tajo-cab">
        <img class="tajo-cara" src="assets/guia.jpg" onerror="this.hidden=true" alt="">
        <div>
          <div class="tajo-eti">${t`Manuel marca el tajo`}</div>
          <p class="tajo-tit">${def.titulo}</p>
        </div>
      </div>
      <p class="tajo-txt">${def.texto}</p>
      ${def.boton ? `<button class="tajo-btn" data-accion="irTajo"
                             data-clave="${def.id}">${def.boton}</button>` : ''}`;
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

  /**
   * EL ESQUIVE del bocadillo: si pisa el núcleo del pueblo activo (en ventana
   * estrecha el lienzo es pequeño y hasta la esquina llega al centro), salta
   * al lado contrario. Corre fuera del cache de pasos porque la cámara se
   * mueve sin que el paso cambie. Lo pidieron los TRES probadores fríos: dos
   * clicaron el bocadillo creyendo clicar su pueblo.
   */
  esquivarPueblo(estado){
    const panel = document.getElementById('panel-guia');
    if(!panel || panel.style.display === 'none' || !this.escena) return;
    const caja = panel.parentElement;   // .lienzo-caja
    if(!caja) return;
    const t = this.escena.tam;
    const px = estado.activo.col * t - estado.camara.x + t / 2;
    const py = estado.activo.fila * t - estado.camara.y + t / 2;
    const margen = t, an = panel.offsetWidth, al = panel.offsetHeight;
    // Se evalúan las DOS posiciones candidatas (izquierda de casa, derecha de
    // esquive) contra el punto del pueblo — determinista, sin parpadeo
    const pisaEn = (x) => px > x - margen && px < x + an + margen
                       && py > 14 - margen && py < 14 + al + margen;
    const pisaIzq = pisaEn(12);
    const pisaDer = pisaEn(caja.clientWidth - 12 - an);
    panel.classList.toggle('esquiva', pisaIzq && !pisaDer);
  }

  refrescarGuia(estado){
    this.esquivarPueblo(estado);
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
    // El rótulo dice QUÉ guía es: la inicial o el capítulo de un servicio
    document.getElementById('guia-rotulo').textContent =
      paso ? (paso.rotulo || t`Primeros pasos`) : t`dice`;
    document.getElementById('guia-titulo').style.display = paso ? '' : 'none';
    // Los DOS botones de saltar (el paso suelto y la guía entera)
    for(const b of panel.querySelectorAll('.guia-saltar'))
      b.style.display = paso ? '' : 'none';
    if(com){
      // En el TELÉFONO los comentarios salen PLEGADOS: el bocadillo tapaba
      // medio mapa (lo cazó el autor). El avatar da su respingo y quien
      // quiera leer a Manuel lo toca; la guía de primeros pasos, en cambio,
      // se despliega siempre — esa no es ambiente, es el manual.
      if(window.matchMedia('(max-width: 640px)').matches){
        panel.classList.add('plegada');
        this.respingoGuia();
      } else {
        panel.classList.remove('plegada');
      }
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
    // El paso de la COLINA lleva brújula (atascó al probador frío diez
    // minutos): Manuel otea el relieve más cercano y señala el rumbo, como
    // las señales de camino señalan pueblos. El terreno de la semilla no se
    // mueve, así que se calcula una vez y listo.
    if(paso.id === 'deposito'){
      if(this._rumboRelieve === undefined)
        this._rumboRelieve = relieveMasCercano(estado.mapa,
          CONFIG.mapaMundo.origen.col, CONFIG.mapaMundo.origen.fila,
          CONFIG.construibles.deposito.terreno) || null;
      const r = this._rumboRelieve;
      if(r) document.getElementById('guia-texto').textContent +=
        ' ' + t`Manuel otea el terreno: el relieve más cercano queda ${r.rumbo}, a unas ${r.dist} casillas del pueblo.`;
    }
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
        ? `<p class="red-cuello" style="--tono:${A.color}"><b>${tipoY.nombre}</b> · ${t`en valor`}</p>
           ${img}
           <p class="m-desc">${tipoY.desc}</p>
           <p class="m-desc">${t`Renta <b>${formatear(tipoY.renta)} €/h</b> y seguirá
             haciéndolo. La casilla queda para siempre fuera de obra.`}</p>`
        : `<p class="red-cuello" style="--tono:${A.color}"><b>${tipoY.nombre}</b></p>
           ${img}
           <p class="m-desc">${tipoY.desc}</p>
           <p class="m-desc">${t`Ha salido al picar. No se puede quitar ni construir
             encima: hay que rodearlo. Excavarlo cuesta, pero lo pone en valor y
             pasa a rentar todos los meses.`}</p>
           <button class="mejora obra" data-accion="excavarYacimiento" style="--tono:${A.color}">
             <span class="m-cab"><span class="m-nom">${t`Excavar y poner en valor`}</span></span>
             <span class="m-desc">${t`+${formatear(tipoY.renta)} €/h para siempre.`}</span>
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
        ? `<p class="red-cuello" style="--tono:${H.color.senal}"><b>${t`Señal de camino`}</b></p>
           <p class="m-desc">${t`«${nombreDeNucleo(obj.celda.nombreIdx || 0)} ·
             a ${Math.round(obj.d)} casillas»`}</p>
           <p class="m-desc">${t`Los camineros las plantaban donde el viajero dudaba.
             Apunta siempre al pueblo por descubrir más cercano: cuando lo
             incorpores, señalará al siguiente.`}</p>`
        : `<p class="red-cuello" style="--tono:${H.color.senal}"><b>${t`Señal de camino`}</b></p>
           <p class="m-desc">${t`Ya no señala a nadie: no queda ningún pueblo por
             descubrir en la comarca. Buen trabajo.`}</p>`;
      return;
    }

    // EL MANANTIAL: información del terreno, no un premio pendiente. Su ficha
    // dice la verdad mecánica entera — es el único indicio que no miente.
    if(celda && celda.hallazgo === 'manantial'){
      panel.style.display = '';
      cont.innerHTML = `
        <p class="red-cuello" style="--tono:${H.color.manantial}"><b>${t`Manantial`}</b></p>
        <p class="m-desc">${t`El agua subterránea asoma: debajo de esta casilla hay
          una masa de agua. El SONDEO aquí no sale seco — es el único indicio
          que no puede mentir.`}</p>
        <p class="m-desc">${t`Así se buscó el agua durante siglos, antes de los
          estudios hidrogeológicos: mirando dónde brota. En el karst de montaña
          sigue siendo la pista reina.`}</p>`;
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
        <p class="red-cuello" style="--tono:${H.color.ruina}">
          <b>${def.nombre}</b> · ${t`abandonada`}</p>
        <img class="ficha-dib" src="assets/f_${tipo}_ruina.jpg"
             onerror="this.hidden=true" alt="">
        <p class="m-desc">${t`Quien la levantó ya no está; la instalación, sí.
          Recuperarla siempre sale más barato que hacerla nueva.`}</p>
        <button class="mejora obra" data-accion="repararRuina" style="--tono:${def.color}">
          <span class="m-cab"><span class="m-nom">${t`Poner en marcha aquí`}</span></span>
          <span class="m-desc">${t`Se queda donde está, si el terreno le sirve.`}</span>
          <span class="m-coste">${formatear(reparar)} €</span>
        </button>
        <button class="mejora obra" data-accion="desmontarRuina" style="--tono:${H.color.ruina}">
          <span class="m-cab"><span class="m-nom">${t`Desmontar y guardar`}</span></span>
          <span class="m-desc">${t`Va al almacén para levantarla donde te convenga.`}</span>
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
        <b>${nombre}</b> · ${esc.titulo}</p>${img}`;

    // Lo que significa ese tamaño en el oficio. Mismo bloque que las fichas de
    // las instalaciones: si el jugador ya sabe leer uno, sabe leer este.
    const leccion = `<div class="ficha" style="--tono:${H.color.pueblo}">
        <p class="ficha-tit ficha-dato-tit">${t`Un núcleo de este tamaño`}</p>
        <p class="ficha-txt ficha-dato">${esc.ficha}</p>
      </div>`;

    if(!p){
      // Aún por incorporar: lo que se sabe de lejos y qué hace falta para traerlo
      const bloqueado = (celda.anillo || 1) > faseActual(estado);
      return cab + `
        <div class="casilla-fila"><span>${t`Habitantes`}</span>
          <b>${formatear(Math.round(habitantes))}</b></div>
        <div class="casilla-fila"><span>${t`Distancia`}</span>
          <b>${t`anillo ${celda.anillo || 1}`}</b></div>
        ${leccion}
        ${bloqueado
          ? `<p class="red-aviso">${t`Demasiado lejos para la mancomunidad de hoy:
               incorpora ${faltanParaFase(estado)} núcleos más cercanos y se abrirá
               este anillo.`}</p>`
          : `<button class="mejora obra" data-accion="abastecerPueblo" style="--tono:${H.color.pueblo}">
               <span class="m-cab"><span class="m-nom">${t`Abastecer este pueblo`}</span></span>
               <span class="m-desc">${t`Hay que haberle llevado antes una tubería. Al
                 hacerlo entra en la mancomunidad... y suma su personal:
                 +${CONFIG.economia.personalPorPuebloHora} €/h de nómina.`}</span>
               <span class="m-coste">${t`canon: ${formatear(canonIncorporacion(estado))} €`}</span>
             </button>`}`;
    }

    // Ya es tuyo: quién es y cómo lo estás atendiendo
    const dem = demandaMedia(p.habitantes);
    const serv = Math.round((p.servicio || 0) * 100);
    const clase = serv >= 95 ? 'ok' : serv >= 70 ? 'alarma' : 'critico';
    const activo = estado.pueblos.indexOf(p) === estado.puebloActivo;
    return cab + `
      <div class="casilla-fila"><span>${t`Habitantes`}</span>
        <b>${formatear(Math.round(p.habitantes))}</b></div>
      <div class="casilla-fila"><span>${t`Pide de media`}</span>
        <b>${dem.toFixed(2)} L/s</b></div>
      <div class="casilla-fila"><span>${t`Servicio`}</span>
        <b class="v ${clase}">${serv} %</b></div>
      ${leccion}
      <p class="m-desc">${activo
        ? t`Es el pueblo que estás mirando. Cada clic encima es una bombada.`
        : t`Clícalo en el mapa para ponerlo al frente y bombear aquí.`}</p>`;
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
        <span class="m-coste">${coste == null ? t`al máximo` : t`${coste} veteranía`}</span>
      </button>`;
    }).join('');

    cont.innerHTML = `
      <p class="m-desc">${t`<b>Comarca ${legado.comarca}</b> · ${regionActual().nombre}
        · veteranía disponible: <b>${legado.veterania}</b>`}</p>
      ${ventajas}
      ${puede
        ? `<button class="mejora obra" data-accion="trasladarse" style="--tono:#f0a04a">
             <span class="m-cab"><span class="m-nom">${t`Trasladarse a otra comarca`}</span></span>
             <span class="m-desc">${t`La red, la caja y los pueblos se quedan; tú te llevas
               la experiencia. Territorio nuevo de verdad: otro río, otros acuíferos.`}</span>
             <span class="m-coste">${t`+${ganada} veteranía`}</span>
           </button>`
        : `<p class="m-desc">${t`El traslado se ofrecerá al alcanzar la
             fase ${K.faseParaTrasladarse}: las comarcas grandes solo llaman
             a quien ya ha demostrado lo que sabe.`}</p>`}`;
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
      ? Math.ceil(((estado.turnoReciclaje || {}).hasta || 0) - estado.horas) : ''
    // ...y el de la ruta del camión, en la del vertedero
      + (obra && obra.tipo === 'vertedero'
        ? Math.ceil(((estado.rutaCamion || {}).hasta || 0) - estado.horas) : '');
    // El uso de las plantas cambia solo (crecen los pueblos, gira el año):
    // sin él en la firma, el porcentaje se quedaba clavado en el del clic
    const usoFirma = obra ? Math.round((this.usoDePlanta(estado, obra) || 0) * 100) : '';
    const firma = obra ? `${obra.tipo},${obra.col},${obra.fila},${obra.nivel || 1},${Math.round(obra.lleno || 0)},${nivelPozo},${estadoObra},${nLineas},${turnoFirma},${usoFirma}` : 'nada';
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
      ? `<p class="red-aviso">${t`AVERIADA: no cuenta en la red hasta que la repares clicándola en el mapa.`}</p>`
      : estadoObra === 'suelta'
        ? `<p class="red-aviso">${t`SIN CONECTAR: no aporta nada hasta que le llegue su red.`}</p>`
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
        // OJO: nada de variables llamadas t aquí — taparían la etiqueta de
        // traducción importada, y el fallo sería silencioso.
        const turnoVivo = estado.turnoReciclaje;
        const activo = turnoVivo && estado.horas < turnoVivo.hasta;
        turno = activo
          ? `<p class="m-desc">${t`Turno echado: la venta va al
               <b>+${Math.round((estado.turnoReciclaje.factor - 1) * 100)} %</b> todavía
               ${Math.ceil(estado.turnoReciclaje.hasta - estado.horas)} horas más.`}</p>`
          : `<button class="mejora obra" data-accion="turnoReciclaje" style="--tono:#facc15">
               <span class="m-cab"><span class="m-nom">${t`Echar un turno en la línea`}</span></span>
               <span class="m-desc">${t`Separa bien en la cinta y la venta de reciclado
                 sube hasta un ${Math.round(CONFIG.minijuegos.reciclaje.bonusMax * 100)} %
                 una temporada.`}</span>
               <span class="m-coste">${t`jugar`}</span>
             </button>`;
      }
      cont.innerHTML = `
        <p class="red-cuello" style="--tono:${def.color}"><b>${titulo}</b>
          ${ampliable ? `· ${t`nivel ${nivel}`}` : ''}</p>
        ${situacion}
        ${lineasAqui}
        ${turno}
        <p class="m-desc">${this.queAporta(obra.tipo, nivel, def.desc) || def.desc}</p>
        ${(() => {
          const uso = this.usoDePlanta(estado, obra);
          if(uso == null) return '';
          const pct = Math.round(uso * 100);
          const clase = pct >= 95 ? 'critico' : pct >= 70 ? 'alarma' : 'ok';
          return `<p class="m-desc">${t`Uso actual: trabaja al`}
            <b class="${clase}">${pct} %</b>${pct >= 90
              ? ' — ' + t`va justa: amplíala o construye otra.` : ''}</p>`;
        })()}
        ${!ampliable ? '' : nivel >= nivelMaxPieza(obra.tipo)
          ? `<p class="m-desc">${t`Ampliada al máximo: si hace falta más, toca construir otra.`}</p>`
          : `<button class="mejora obra" data-accion="ampliarPieza" style="--tono:${def.color}">
               <span class="m-cab"><span class="m-nom">${t`Ampliar a nivel ${nivel + 1}`}</span></span>
               <span class="m-desc">${t`Pasará a aportar como ${nivel + 1} piezas iguales.`}</span>
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
    // LA RUTA DEL CAMIÓN: la jornada con premio se saca desde aquí — el
    // camión acaba en el vertedero de todas formas. Un turno cada vez, como
    // el de la planta: mientras dure el bono, no hay segunda jornada.
    const rutaViva = estado.rutaCamion && estado.horas < estado.rutaCamion.hasta;
    const ruta = rutaViva
      ? `<p class="m-desc">${t`Ruta echada: la recogida va al
           <b>+${Math.round((estado.rutaCamion.factor - 1) * 100)} %</b> todavía
           ${Math.ceil(estado.rutaCamion.hasta - estado.horas)} horas más.`}</p>`
      : `<button class="mejora obra" data-accion="rutaCamion" style="--tono:#b7a08a">
           <span class="m-cab"><span class="m-nom">${t`Sacar la ruta del camión`}</span></span>
           <span class="m-desc">${t`Recoge bien los contenedores del día y la
             recogida sube hasta un ${Math.round(CONFIG.minijuegos.camion.bonusMax * 100)} %
             una temporada.`}</span>
           <span class="m-coste">${t`jugar`}</span>
         </button>`;
    cont.innerHTML = `
      <p class="red-cuello" style="--tono:${def.color}">
        <b>${titulo}</b> · ${t`vaso nivel ${nivel}`}
      </p>
      ${situacion}
      <div class="vaso"><i style="width:${pct}%"></i></div>
      <p class="m-desc">${t`${formatear(obra.lleno || 0)} de ${formatear(capacidadVaso(obra))} t
        (${pct} %).`}${pct >= 100
          ? ` <b class="critico">${t`LLENO: ya no admite nada.`}</b>`
          : ''}</p>
      <p class="m-desc">${t`Gotea sobre el agua que tiene alrededor, y cuanto más
        lleno, más. Un agua insalubre da menos caudal.`}</p>
      ${ruta}
      ${this.fichaHTML(def, 'vertedero')}
      ${tope
        ? `<p class="m-desc">${t`No se puede ampliar más: abre otro vertedero en otra parte.`}</p>`
        : `<button class="mejora obra" data-accion="ampliarVertedero" style="--tono:${def.color}">
             <span class="m-cab"><span class="m-nom">${t`Ampliar el vaso`}</span></span>
             <span class="m-desc">${t`+${formatear(V.capacidadPorNivel)} t de capacidad.`}</span>
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
        <span class="linea-aqui-txt">${t`Por aquí pasa <b>${red.nombre.toLowerCase()}</b>:
          ${d.nombre} de ${tuberia.camino.length} casillas.`}</span>
        <button class="linea-aqui-btn" data-accion="quitarLinea" data-clave="${indice}">
          ${t`Levantarla (+${formatear(recupera)} €)`}</button>
      </div>`;
    }).join('');
  }

  /** El botón de derribo: al final y en su color — destructivo pero con salida. */
  botonDerribar(obra){
    const def = CONFIG.construibles[obra.tipo];
    const recupera = Math.round(def.coste * (obra.nivel || 1)
                                * CONFIG.derribo.fraccionRecuperada);
    return `<button class="mejora obra derribo" data-accion="derribarObra" style="--tono:#f05a4a">
      <span class="m-cab"><span class="m-nom">${t`Derribar`}</span></span>
      <span class="m-desc">${t`La casilla queda libre y del derribo se recuperan
        ${formatear(recupera)} €.`}</span>
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
   * El USO de las plantas, 0..1+ (petición del autor: al clicar la
   * depuradora o la ETAP, saber si va justa y toca ampliar). Es la MEDIA
   * sostenida — para decidir ampliaciones sirve el régimen; las puntas de
   * lluvia ya las cuentan los avisos de la red. Devuelve null si la pieza
   * no es una planta o no tiene capacidad que medir.
   */
  usoDePlanta(estado, obra){
    if(obra.tipo === 'potabilizadora'){
      const cap = capacidadPotabilizacion(estado);
      if(cap <= 0) return null;
      return aguaBrutaLh(estado, factorEstiaje(estado.horas)) / cap;
    }
    if(obra.tipo === 'depuradora'){
      const cap = capacidadTratamiento(estado.activo, estado);
      if(cap <= 0) return null;
      let residualLh = 0;
      for(const p of estado.pueblos)
        if(p.desbloqueado && servicioActivo(p, 'saneamiento'))
          residualLh += demandaMedia(p.habitantes) * 3600 * CONFIG.saneamiento.fraccionResidual;
      return residualLh / cap;
    }
    return null;
  }

  /**
   * Qué aporta una pieza del mapa a su nivel actual, en cristiano y con sus
   * números. Es la respuesta a "¿cuál de mis dos depósitos es este?": el que
   * dice lo que dice esta ficha.
   */
  queAporta(tipo, nivel, desc = ''){
    const P = CONFIG.aportePorPieza;
    // La luz se dice junto al aporte: pagar sin saberlo parecería un robo.
    // `desc` es el respaldo para piezas sin línea de aporte (reciclaje,
    // pozo...): así la luz no les borra la descripción.
    const kwh = CONFIG.energia.porHora[tipo];
    const luz = kwh ? ' ' + t`Consume <b>${kwh * nivel} €/h</b> de energía mientras esté conectada.` : '';
    return (this.aporteBase(tipo, nivel, P) || desc) + luz;
  }

  aporteBase(tipo, nivel, P){
    switch(tipo){
      case 'captacion':
        // "A pleno caudal": el bruto de la pieza. El neto (tras estiaje,
        // tubería y fugas) lo cuenta el desglose — sin este matiz, la ficha
        // decía 1,80 y el HUD 1,19 y parecía un fallo (lo cazó el autor).
        return t`Aporta <b>${(nivel * P.captacion).toFixed(2)} L/s</b> a pleno caudal,
                sin clicar. Lo que llega tras estiaje, tubería y fugas lo
                desglosa «De dónde sale el agua».`;
      case 'bomba':
        // SINCLIC: la bomba trabaja sola — hablarle al jugador de "clics"
        // tras jubilarle el dedo era contradecir la tarjeta del relevo
        // (fosil cazado por el probador frio 3)
        return t`Impulsa <b>${formatear(nivel * P.bomba)} L</b> en cada golpe de bomba (${CONFIG.sinclic.ritmo}/s, automáticos).`;
      case 'deposito':
        return t`Añade <b>${formatear(nivel * P.deposito)} L</b> de capacidad de reserva.`;
      case 'potabilizadora':
        return t`Potabiliza <b>${formatear(nivel * P.potabilizadora)} L/h</b> de agua
                bruta del río o de pozos exprimidos. Sin tratar, esa agua frena
                el crecimiento.`;
      case 'depuradora':
        return t`Trata <b>${formatear(nivel * P.depuradora)} L/h</b> de aguas residuales
                y mejora la limpieza un <b>${Math.round(nivel * P.depuradoraCalidad * 100)} %</b>.`;
      case 'tanque':
        return t`Retiene <b>${formatear(nivel * P.tanque)} L</b> de punta de tormenta
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
  fichaHTML(def, clave, abierta = false, titulo = null){
    if(!def || !def.ficha) return '';
    const f = def.ficha;
    // El DIAGRAMA va primero y es lo que hace que se lea lo de abajo. Un muro de
    // texto no lo abre nadie; una animación pequeña con algo corriendo por
    // dentro sí se mira, y una vez mirada ya estás leyendo.
    const dib = clave && hayDiagrama(clave)
      ? `<canvas class="ficha-dib" data-diagrama="${clave}" width="440" height="240"></canvas>`
      : '';
    // PLEGADA en la pieza ya construida (petición del autor: la ficha es
    // bonita la primera vez y un estorbo la décima — empujaba el resto del
    // lateral media pantalla abajo). ABIERTA al elegir pieza para construir,
    // que es cuando apetece leerla. <details> nativo: cero cableado.
    return `
      <details class="ficha" style="--tono:${def.color}" ${abierta ? 'open' : ''}>
        <summary class="ficha-resumen">${titulo || t`¿Qué es esto?`}</summary>
        ${dib}
        <p class="ficha-tit">${t`¿Qué es?`}</p>
        <p class="ficha-txt">${f.que}</p>
        <p class="ficha-tit">${t`¿Para qué sirve?`}</p>
        <p class="ficha-txt">${f.para}</p>
        <p class="ficha-tit ficha-dato-tit">${t`Del oficio`}</p>
        <p class="ficha-txt ficha-dato">${f.dato}</p>
      </details>`;
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
      ${this.fichaHTML(def, clave, true)}`;
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
          <b>${t`Zona de especial conservación`}</b> ·
          ${celda.protegida === 'fauna' ? t`hábitat de fauna` : t`flora protegida`}
        </p>
        <p class="m-desc">${t`Entorno protegido por el Estado. No se puede construir
          ni tender redes: hay que rodearla. Y si tus lixiviados la alcanzan,
          multa de ${formatear(Z.multaPorHoraCelda)} €/h por casilla dañada
          mientras dure el daño.`}</p>`;
      return;
    }
    const FAM = { llano: t`Terreno llano`, arbolado: t`Arbolado`,
                  relieve: t`Relieve`, agua: t`Masa de agua` };

    // Lo que cuesta meter cada red por aquí, con el calibre que tengas elegido
    const redes = Object.entries(CONFIG.redes)
      .filter(([, r]) => !r.requiere || servicioActivo(estado.activo, r.requiere))
      .map(([k, r]) => {
        const c = costeCasillaTuberia(celda, estado.dnActual[k], k);
        const obra = CONFIG.tuberia.nombreObra[celda.tipo] || t`obra`;
        return `<div class="casilla-fila"><span>${r.nombre} · ${obra}</span>
                  <b style="color:${r.color}">${formatear(c)} €</b></div>`;
      }).join('');

    // Y qué piezas admite. Es la pregunta que de verdad se hace uno al mirar.
    // Sin nPueblos A PROPÓSITO: aquí se habla del TERRENO, y el cupo agotado
    // haría decir "esta casilla no admite depósito" cuando la casilla sí puede.
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
        <div class="casilla-fila"><span>${t`Destapar`}</span><b>×${def.costeExtra}</b></div>
        ${redes}
      </div>
      ${this.bloqueLineas(estado, sel)}
      ${this.bloqueSubsuelo(estado, celda, sel)}
      <p class="casilla-cabe">${cabe.length
        ? t`Aquí cabe: <b>${cabe.join('</b>, <b>')}</b>.`
        : t`Aquí no cabe ninguna instalación.`}</p>`;

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
        <div class="subsuelo-cab">${t`Sondeo con agua · ${clase.nombre}`}</div>
        <p class="m-desc">${clase.desc}</p>
        <div class="nivel-acuifero">
          <div class="nivel-barra"><i style="width:${Math.round(nivel * 100)}%;
            background:${nivel < CONFIG.acuiferos.umbralMerma ? '#f0a04a' : clase.color}"></i></div>
          <span>${Math.round(nivel * 100)}%</span>
        </div>
        <div class="casilla-fila"><span>${t`Caudal sostenible`}</span>
          <b>${sostenible.toFixed(2)} L/s</b></div>
        <div class="casilla-fila"><span>${pozos === 1 ? t`Pide el pozo` : t`Piden los pozos`}</span>
          <b style="color:${pasado ? '#f0a04a' : 'inherit'}">${pidiendo.toFixed(2)} L/s</b></div>
        ${nivel < CONFIG.acuiferos.umbralMerma ? `<div class="casilla-fila">
          <span>${t`Está dando`}</span><b style="color:#f0a04a">${sacando.toFixed(2)} L/s</b></div>` : ''}
        <p class="m-desc">${pozos === 0
          ? t`Construye aquí el pozo y engánchalo a la red para que cuente.`
          : pasado
            ? t`Sacas más de lo que entra: el nivel baja y el pozo da cada vez
              menos. Y no lo arregla otro pozo — el acuífero acaba entregando
              lo que le devuelve la lluvia y nada más; lo único que consigues
              perforando otra vez es tener el nivel por los suelos.`
            : t`Extracción sostenible: entra tanto como sale y el nivel aguanta.`}</p>
      </div>`;
    }
    if(celda.sondeo === 'seco'){
      return `<div class="subsuelo seco">
        <div class="subsuelo-cab">${t`Sondeo seco`}</div>
        <p class="m-desc">${t`Aquí se perforó y no había nada. Un punto descartado
          también es información: el acuífero, si lo hay, está en otro sitio.`}</p></div>`;
    }

    const puedeS = puedeSondear(estado.mapa, sel.col, sel.fila);
    const botonSondeo = puedeS.ok
      ? `<button class="mejora obra" data-accion="sondear" style="--tono:${A.color}">
           <span class="m-cab"><span class="m-nom">${t`Perforar un sondeo`}</span></span>
           <span class="m-desc">${celda.indicios && celda.estudiada
             ? t`Con indicios favorables: aquí es donde hay que probar.`
             : t`Sin indicios, es una apuesta cara: casi siempre sale seco.`}</span>
           <span class="m-coste">${formatear(costeSondeo(celda))} €</span>
         </button>`
      : '';

    if(!celda.estudiada){
      return `<div class="subsuelo" style="--tono:${A.color}">
        <div class="subsuelo-cab">${t`Subsuelo sin estudiar`}</div>
        <p class="m-desc">${t`Nadie ha mirado qué hay debajo. El estudio cubre
          ${A.estudio.radio * 2 + 1}×${A.estudio.radio * 2 + 1} casillas y dice
          dónde hay indicios de agua — que no es lo mismo que encontrarla.`}</p>
        <button class="mejora obra" data-accion="estudiarZona" style="--tono:${A.color}">
          <span class="m-cab"><span class="m-nom">${t`Estudio hidrogeológico`}</span></span>
          <span class="m-desc">${t`Cartografía y geofísica de la zona.`}</span>
          <span class="m-coste">${formatear(costeEstudio())} €</span>
        </button>
        ${botonSondeo}</div>`;
    }
    return celda.indicios
      ? `<div class="subsuelo" style="--tono:${A.color}">
           <div class="subsuelo-cab">${t`Indicios de agua`}</div>
           <p class="m-desc">${t`La geología promete: formación permeable y
             estructura favorable. No garantiza nada — hay que perforar para
             saberlo.`}</p>
           ${botonSondeo}</div>`
      : `<div class="subsuelo esteril">
           <div class="subsuelo-cab">${t`Estudiado · sin indicios`}</div>
           <p class="m-desc">${t`Terreno impermeable. Perforar aquí sería tirar el
             dinero.`}</p>
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

  /** El almacén: piezas rescatadas, listas para colocar sin volver a pagarlas.
   *  AGRUPADAS por tipo (la regla de escala): tres bombas rescatadas son un
   *  botón "Bombeo ×3", no tres botones iguales. */
  refrescarAlmacen(estado){
    const firma = estado.inventario.map(p => p.tipo).sort().join(',');
    if(this.cache.almacenFirma === firma) return;
    this.cache.almacenFirma = firma;
    const panel = document.getElementById('panel-almacen');
    panel.style.display = estado.inventario.length ? '' : 'none';
    if(!estado.inventario.length) return;
    const grupos = {};
    estado.inventario.forEach((p, i) => {
      if(!grupos[p.tipo]) grupos[p.tipo] = { n: 0, primero: i };
      grupos[p.tipo].n++;
    });
    document.getElementById('almacen').innerHTML = Object.entries(grupos)
      .map(([tipo, g]) => {
        const def = CONFIG.construibles[tipo];
        return `
          <button class="mejora obra" data-accion="colocarDeInventario" data-clave="${g.primero}"
                  style="--tono:${def.color}">
            <span class="m-cab"><span class="m-nom">${def.nombre}${g.n > 1 ? ` ×${g.n}` : ''}</span></span>
            <span class="m-desc">${t`Rescatada. Colócala donde quieras.`}</span>
            <span class="m-coste">${t`gratis`}</span>
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

  /* ---------------- LA BARRA DE ESTADO (antes, pestañas de pueblos) -------- */

  /**
   * Las pestañas no escalaban: con veinte pueblos eran una fila infinita, y
   * el SELECTOR de verdad ya es el mapa — tocar un pueblo lo hace activo, y
   * ahora además llevan su nombre rotulado. La fila queda en una barra
   * fina: el pueblo activo (tocarlo centra la cámara en él), la fase, y los
   * CHIPS DE ALERTA — un pueblo con sed o una avería sacan su botón rojo
   * que te lleva al problema (petición del autor). Con veinte pueblos:
   * cero pestañas, salvo problemas.
   */
  reconstruirPestanas(estado){
    const cont = document.getElementById('pestanas');
    if(!cont) return;
    const faltan = faltanParaFase(estado);
    const P = CONFIG.poblacion;
    const p = estado.activo;

    // Los sedientos, DEL PEOR AL MENOS MALO, y solo los primeros con nombre:
    // veinte chips serían las pestañas otra vez. El resto va en un chip de
    // grupo que lleva al peor de los que no caben.
    const sedientos = estado.pueblos
      .map((pb, i) => ({ pb, i }))
      .filter(({ pb }) => pb.desbloqueado && (pb.servicio || 0) < P.servicioMalo)
      .sort((a, b) => (a.pb.servicio || 0) - (b.pb.servicio || 0));
    const conNombre = sedientos.slice(0, CONFIG.interfaz.chipsDeSed);
    const demas = sedientos.slice(CONFIG.interfaz.chipsDeSed);
    const nAverias = (estado.averias || []).length;

    cont.innerHTML = `
      <button class="pestana activa" data-accion="irPuebloActivo"
              title="${t`Centrar el mapa en tu pueblo`}">${p.nombre}</button>
      ${faltan != null
        ? `<span class="pestana bloqueada" title="${t`Incorpora ${faltan} núcleos más para abrir el siguiente anillo`}">${t`fase ${faseActual(estado)} · faltan ${faltan}`}</span>`
        : ''}
      ${conNombre.map(({ pb, i }) => `
        <button class="pestana chip-alerta" data-accion="irProblema" data-clave="${i}">
          💧 ${pb.nombre}</button>`).join('')}
      ${demas.length > 0
        ? `<button class="pestana chip-alerta" data-accion="irProblema"
                   data-clave="${demas[0].i}">${t`💧 +${demas.length} más`}</button>`
        : ''}
      ${nAverias > 0
        ? `<button class="pestana chip-alerta" data-accion="irAAveria" data-clave="0">
             ${nAverias === 1 ? t`⚠ 1 avería` : t`⚠ ${nAverias} averías`}</button>`
        : ''}`;
  }

  /* ---------------- SERVICIOS (del pueblo activo) ---------------- */

  /**
   * LA CIRUGÍA se llevó la tienda (la infraestructura se amplía en el mapa),
   * pero el panel de SERVICIOS se queda: un pueblo es un conjunto de
   * servicios, y saber cuál está en marcha y cuál espera es media partida.
   */
  construirServicios(){
    const cont = document.getElementById('tienda');
    const servicios = Object.entries(CONFIG.servicios)
      .sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0));
    cont.innerHTML = servicios.map(([sc, sv]) => {
      const tono = (CONFIG.redes[sv.red] || {}).color || CONFIG.color.alarma;
      return `
        <div class="servicio" id="servicio-${sc}" style="--tono:${tono}">
          <p class="sv-cab">
            <span class="sv-nom">${sv.nombre}</span>
            <span class="sv-estado" id="sv-estado-${sc}"></span>
          </p>
          <p class="sv-desc">${sv.desc}</p>
        </div>`;
    }).join('');
  }

  refrescarServicios(estado){
    const p = estado.activo;
    // Cada servicio dice en qué punto está: de serie, en marcha, esperando a
    // crecer o todavía cerrado.
    for(const [sc, sv] of Object.entries(CONFIG.servicios)){
      const caja = document.getElementById('servicio-' + sc);
      const etq = document.getElementById('sv-estado-' + sc);
      if(!caja) continue;
      const activo = servicioActivo(p, sc);
      let texto = t`de serie`;
      if(!sv.siempre){
        if(activo) texto = t`en marcha`;
        else if(sv.requiere === 'pluviales') texto = t`con el cuarto pueblo`;
        else if(sv.requiere === 'residuos') texto = t`desde ${formatear(CONFIG.residuos.activaEnHabitantes)} hab`;
        else if(sv.activaEnHabitantes) texto = t`desde ${formatear(sv.activaEnHabitantes)} hab`;
        else texto = t`cerrado`;
      }
      etq.textContent = texto;
      caja.classList.toggle('dormido', !activo);
    }
  }

  /** LA CUADRILLA: la compra común de mantenimiento (vive en Mancomunidad). */
  refrescarCuadrilla(estado){
    const cont = document.getElementById('cuadrilla');
    if(!cont) return;
    const C = CONFIG.cuadrilla;
    const nivel = estado.cuadrilla || 0;
    const tope = nivel >= C.nivelMax;
    const coste = costeCuadrilla(estado);
    const firma = `${nivel},${tope ? 1 : estado.puedePagar(coste) ? 1 : 0}`;
    if(this.cache.cuadrillaFirma === firma) return;
    this.cache.cuadrillaFirma = firma;
    cont.innerHTML = `
      <button class="mejora ${tope ? 'comprada' : ''}" data-accion="cuadrilla"
              ${tope ? 'disabled' : ''}>
        <span class="m-cab">
          <span class="m-nom">${C.nombre}</span>
          <span class="m-nivel">${nivel > 0 ? t`Nv ${nivel}` : ''}</span>
        </span>
        <span class="m-desc">${C.desc}</span>
        <span class="m-coste">${tope ? t`AL MÁXIMO` : formatear(coste) + ' €'}</span>
      </button>`;
  }

  /**
   * EL LIBRO DEL OFICIO: las fichas divulgativas coleccionadas. Se desbloquean
   * CONSTRUYENDO (estado.conocidas): conocer el oficio es haber levantado sus
   * piezas, y derribar no des-aprende. Los escalones del caserío entran cuando
   * algún pueblo tuyo alcanza ese tamaño. Cada página es un <details> plegado
   * con el nombre de la pieza — la regla de escala, de serie: doce líneas de
   * una altura, no doce fichas abiertas. Las páginas por conocer salen como
   * «???»: que se vea cuánto oficio queda por aprender es el coleccionismo.
   */
  refrescarLibro(estado){
    const cont = document.getElementById('libro');
    if(!cont) return;
    const piezas = Object.entries(CONFIG.construibles)
      .filter(([, def]) => def.ficha)
      .sort((a, b) => (a[1].orden || 99) - (b[1].orden || 99));
    const escalones = CONFIG.caserio.escalones.filter(e => e.ficha);
    const maxHab = Math.max(0, ...estado.pueblos
      .filter(p => p.desbloqueado).map(p => p.habitantes || 0));
    const escalonMax = escalones.findLastIndex(e => escalonCaserio(maxHab) === e);
    const sabidas = piezas.filter(([clave]) => estado.conocidas.includes(clave)).length;
    const total = piezas.length + escalones.length;
    const firma = `${sabidas}:${escalonMax}`;
    if(this.cache.libroFirma === firma) return;
    this.cache.libroFirma = firma;

    const porConocer = `<span class="m-nivel">???</span>`;
    const paginas = piezas.map(([clave, def]) =>
      estado.conocidas.includes(clave)
        ? this.fichaHTML(def, clave, false, def.nombre)
        : `<p class="m-desc libro-cerrada">${porConocer} ${t`Se conoce construyéndola.`}</p>`
    ).join('');
    const tamanos = escalones.map((esc, i) =>
      i <= escalonMax
        ? `<details class="ficha" style="--tono:#e7d8b0">
             <summary class="ficha-resumen">${esc.titulo[0].toUpperCase() + esc.titulo.slice(1)}</summary>
             <p class="ficha-txt">${esc.ficha}</p>
           </details>`
        : `<p class="m-desc libro-cerrada">${porConocer} ${t`Se conoce cuando un pueblo tuyo llega a ese tamaño.`}</p>`
    ).join('');

    cont.innerHTML = `
      <p class="m-desc">${t`Lo que el oficio te ha enseñado, pieza a pieza:
        ${sabidas + Math.max(0, escalonMax + 1)} de ${total} páginas escritas.
        Las que faltan se aprenden construyendo.`}</p>
      ${paginas}
      <p class="m-desc" style="margin-top:0.6em"><b>${t`Los tamaños de un núcleo`}</b></p>
      ${tamanos}`;
  }

  /* ---------------- FUNCIÓN ESPECIAL: AUTO-BOMBEO (del pueblo activo) ------ */

  construirPremium(){
    // SINCLIC: el auto-bombeo llega solo con la primera bomba — la funcion
    // especial que lo vendia ya no significa nada y su bloque se esconde.
    const bloque = document.getElementById('premium');
    if(bloque){
      bloque.hidden = true;
      if(bloque.parentElement?.tagName === 'SECTION') bloque.parentElement.hidden = true;
    }
    return;
    // eslint-disable-next-line no-unreachable
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
    return;   // SINCLIC: sin bloque premium que refrescar
    // eslint-disable-next-line no-unreachable
    const P = CONFIG.premium.autobomba;
    const p = estado.activo;
    const bt = document.getElementById('premium-autobomba');
    const etq = document.getElementById('premium-etq');
    const reqs = document.getElementById('premium-reqs');
    const coste = document.getElementById('premium-coste');
    if(!bt) return;

    if(p.autobombaActivo){
      etq.textContent = t`ACTIVO`;
      reqs.innerHTML = '';
      coste.textContent = t`La bomba trabaja sola ✓`;
      bt.classList.add('activa'); bt.classList.remove('lista', 'bloqueada');
      bt.disabled = true;
      return;
    }

    const req = requisitosAutobomba(p, estado);
    const puede = req.cumple && estado.puedePagar(P.coste);
    etq.textContent = req.cumple ? t`DISPONIBLE` : t`BLOQUEADO`;
    reqs.innerHTML = req.lista.map(f =>
      `<span class="p-req ${f.ok ? 'ok' : ''}">${f.ok ? '✓' : '○'} ${f.txt}</span>`).join('');
    coste.textContent = req.cumple ? t`Activar · ${formatear(P.coste)} €`
                                   : t`Cumple los requisitos para activarlo`;
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

    // La regla de escala: las más antiguas con sus botones, el resto en una
    // línea. Diez averías eran veinte botonazos tapando el lateral entero.
    const enPanel = lista.slice(0, CONFIG.interfaz.averiasEnPanel);
    const resto = lista.length - enPanel.length;
    const coste = CONFIG.averias.costePorClic;
    document.getElementById('averias-lista').innerHTML = enPanel.map((av, i) => {
      const obra = estado.construcciones.find(o => o.col === av.col && o.fila === av.fila);
      const def = obra ? CONFIG.construibles[obra.tipo] : null;
      return `
        <button class="mejora obra averia" data-accion="irAAveria" data-clave="${i}"
                style="--tono:${CONFIG.color.critico}">
          <span class="m-cab"><span class="m-nom">${t`${def ? def.nombre : t`Instalación`} · fuera de servicio`}</span></span>
          <span class="m-desc">${t`Está fuera de servicio y no cuenta en la red.
            Ve hasta ella y clica encima: ${av.clics === 1
              ? t`le falta <b>1</b> golpe de llave`
              : t`le faltan <b>${av.clics}</b> golpes de llave`},
            a ${formatear(coste)} € cada uno.`}</span>
          <span class="m-coste">${t`ir ahí →`}</span>
        </button>
        ${av.aManoJugada ? '' : this.botonRepararJugando(estado, obra, i)}`;
    }).join('') + (resto > 0
      ? `<p class="m-desc">${t`Y ${resto} averías más esperando: al reparar
           estas, entran aquí.`}</p>`
      : '');
  }

  /**
   * La demanda de TODO el conjunto que comparte red con este pueblo — los
   * mismos pueblos entre los que reparte el clic. El recorrido de red es
   * caro, así que se cachea y solo se rehace cuando cambia lo que puede
   * cambiarlo: el pueblo activo, las tuberías o los pueblos incorporados.
   * (Los habitantes crecen despacio: la firma con la suma redondeada basta.)
   */
  demandaDelConjunto(estado, p){
    const firma = `${estado.puebloActivo},${estado.tuberias.length},${estado.pueblos.length}`;
    if(this.cache.conjuntoFirma !== firma){
      this.cache.conjuntoFirma = firma;
      this.cache.conjuntoPueblos = conjuntoDeRed(estado, p.col, p.fila, 'abastecimiento');
      if(!this.cache.conjuntoPueblos.length) this.cache.conjuntoPueblos = [p];
    }
    return this.cache.conjuntoPueblos.reduce((a, pb) => a + demandaMedia(pb.habitantes), 0);
  }

  /**
   * El botón de arreglar JUGANDO: cada avería ofrece el minijuego de SU
   * servicio (petición del autor) — tubería para las redes de tubo, la cinta
   * para la planta de reciclaje, la ruta para el vertedero. El premio es el
   * arreglo gratis; un solo intento, como siempre.
   */
  botonRepararJugando(estado, obra, i){
    const tipo = obra ? obra.tipo : null;
    // El listón del momento: rodaje o veteranía, según lo jugado (por juego)
    const K = CONFIG.minijuegos.averia;
    const juego = tipo === 'reciclaje' ? 'reciclaje' : tipo === 'vertedero' ? 'camion' : null;
    const veces = juego ? ((estado.reparacionesJugadas || {})[juego] || 0) : 0;
    const pct = Math.round((veces < K.partidasFaciles ? K.punteriaMinima : K.punteriaVeterana) * 100);
    let titulo, desc;
    if(tipo === 'reciclaje'){
      titulo = t`Arreglarla echando un turno`;
      desc = t`Un turno de urgencia en la cinta: separa bien al menos el
        ${pct} % y la avería queda arreglada GRATIS. Un solo intento.`;
    } else if(tipo === 'vertedero'){
      titulo = t`Arreglarla sacando la ruta`;
      desc = t`Una ruta de urgencia con el camión: recoge al menos el
        ${pct} % y la avería queda arreglada GRATIS. Un solo intento.`;
    } else {
      titulo = t`Repararla a mano`;
      desc = t`Monta el tramo antes de que llegue el agua y queda
        arreglada GRATIS. Un solo intento: si se derrama, a golpe de llave.`;
    }
    return `
        <button class="mejora obra" data-accion="repararAMano" data-clave="${i}"
                style="--tono:${CONFIG.color.agua || '#38bdf8'}">
          <span class="m-cab"><span class="m-nom">${titulo}</span></span>
          <span class="m-desc">${desc}</span>
          <span class="m-coste">${t`jugar`}</span>
        </button>`;
  }

  /**
   * EL DESGLOSE DE LA CAJA (petición del autor: ver dónde se gana y dónde se
   * va el dinero). Mismas reglas que el desglose del agua: la cuenta viene
   * ENTERA de avanzar() —aquí no se recalcula nada, que duplicar fórmulas ya
   * dio dos verdades una vez— y las líneas salen solo si existen. En €/h de
   * juego. El clic no lleva línea propia: su agua se factura como toda.
   */
  refrescarCaja(estado, resultado){
    const cont = document.getElementById('caja-desglose');
    if(!cont || !resultado.caja) return;
    const c = resultado.caja;
    const neto = c.facturado + c.residuos + c.yacimientos
               - c.luz - c.nomina - c.multaCauce - c.multaZec;
    // Los impagos van en la firma pero NO en el balance: no son un gasto,
    // son ingreso que nunca llegó (el facturado ya viene sin ellos)
    const firma = [c.facturado, c.impagos || 0, c.residuos, c.yacimientos, c.luz,
                   c.nomina, c.multaCauce, c.multaZec].map(v => Math.round(v * 10)).join(',');
    if(this.cache.cajaFirma === firma) return;
    this.cache.cajaFirma = firma;

    const fmt = v => Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : formatear(Math.round(Math.abs(v)));
    const fila = (nombre, v, gasto = false) => Math.abs(v) < 0.05 ? '' :
      `<div class="casilla-fila"><span>${nombre}</span>
         <b style="color:${(gasto ? v > 0 : v < 0) ? 'var(--critico)' : 'var(--ok, #4ade80)'}">
           ${(gasto ? v > 0 : v < 0) ? '−' : '+'}${fmt(v)} €/h</b></div>`;

    cont.innerHTML = `
      <div class="casilla-fila"><span>${t`Agua facturada`}</span>
        <b>+${fmt(c.facturado)} €/h</b></div>
      ${fila(t`Agua servida sin cobrar (impagos)`, c.impagos || 0, true)}
      ${fila(t`Residuos (venta menos vertido)`, c.residuos)}
      ${fila(t`Rentas de yacimientos`, c.yacimientos)}
      ${fila(t`La luz de las instalaciones`, c.luz, true)}
      ${fila(t`Nómina del personal`, c.nomina, true)}
      ${fila(t`Multa por el cauce sucio`, c.multaCauce, true)}
      ${fila(t`Multa por zonas protegidas dañadas`, c.multaZec, true)}
      <div class="casilla-fila"><span><b>${t`Balance`}</b></span>
        <b style="color:${neto >= 0 ? 'var(--ok, #4ade80)' : 'var(--critico)'}">
          ${neto >= 0 ? '+' : '−'}${fmt(neto)} €/h</b></div>
      <p class="m-desc">${t`Las obras, mejoras y reparaciones no salen aquí:
        son pagos de una vez, no flujos.`}</p>`;
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
    this.fijar('cauce-pct', t`${pct}% sucio`,
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

  /**
   * EL HUD PROGRESIVO: se arranca con TRES números (Agua, Caja, Servicio) y
   * los demás se INCORPORAN cuando nace su mecánica — la Población al acabar
   * la guía, la Producción y el reloj con la primera captación, el Cauce
   * cuando algún pueblo vierte, la Expansión al ir destapando. Ocho números
   * el minuto uno era abrumar ("hay que dárselo mascado", el autor); y la
   * regla del plan: no se QUITA nada a quien ya lo usa — las condiciones
   * salen del estado, así que una partida cargada enseña lo suyo sin guiño.
   */
  refrescarMetricas(estado){
    const conCaptacion =
      estado.construcciones.some(o => o.tipo === 'captacion' || o.tipo === 'acuifero');
    const visibles = {
      'hud-agua': true, 'hud-dinero': true, 'hud-servicio': true,
      'hud-poblacion': !!(estado.tutorial && estado.tutorial.terminado),
      'hud-produccion': conCaptacion,
      'hud-reloj': conCaptacion,   // el reloj importa cuando el estiaje importa
      'hud-cauce': estado.contaminacion > 0.5
        || estado.pueblos.some(pb => pb.desbloqueado && servicioActivo(pb, 'saneamiento')),
      'hud-expansion': (estado.descubiertas || 0) >= 3
    };
    // En el TELÉFONO mandan el mapa y lo esencial (petición del autor: "en
    // móvil pesa más el componente visual"). Los números de contexto no
    // entran nunca en la barra: la producción vive en el desglose, el cauce
    // en su panel y en el color del río, la expansión en los números de las
    // casillas y la estación en el detalle del pueblo. Están, pero no encima.
    if(window.matchMedia('(max-width: 640px)').matches){
      visibles['hud-produccion'] = false;
      visibles['hud-reloj'] = false;
      visibles['hud-cauce'] = false;
      visibles['hud-expansion'] = false;
    }
    const firma = Object.values(visibles).map(v => v ? 1 : 0).join('');
    if(this.cache.hudFirma === firma) return;
    // Sin firma previa (arranque o caché invalidada) se aplica EN SILENCIO:
    // el guiño de estreno es solo para lo que nace jugando.
    const estreno = this.cache.hudFirma !== undefined;
    this.cache.hudFirma = firma;
    for(const [id, ver] of Object.entries(visibles)){
      const caja = document.getElementById(id);
      const item = caja && caja.closest('.hud-item');
      if(!item) continue;
      const estaba = item.style.display !== 'none';
      item.style.display = ver ? '' : 'none';
      if(ver && !estaba && estreno){
        item.classList.remove('estreno');
        void item.offsetWidth;
        item.classList.add('estreno');
      }
    }
  }

  /**
   * LAS SOLAPAS QUE SE GANAN (frente 3 del plan): Mancomunidad no dice nada
   * con un solo pueblo — taller, expediente, lugares... — así que no existe
   * hasta el segundo (o hasta que el cauce necesite su panel: ESA es la
   * salvaguarda — nada útil puede quedar detrás de una solapa escondida).
   * Y «La red» espera a la primera tubería: sin líneas no hay nada que
   * renovar. Mismo guiño de estreno que las métricas, y misma regla: las
   * condiciones salen del estado, una partida cargada no nota nada.
   */
  refrescarSolapas(estado){
    const verComun = estado.pueblos.length >= 2
      || estado.contaminacion > 0.5
      || estado.pueblos.some(pb => pb.desbloqueado && servicioActivo(pb, 'saneamiento'));
    const verRed = (estado.tuberias || []).length > 0;
    const firma = `${verComun ? 1 : 0}${verRed ? 1 : 0}`;
    if(this.cache.solapasFirma === firma) return;
    const estreno = this.cache.solapasFirma !== undefined;
    this.cache.solapasFirma = firma;

    const solapaComun = document.querySelector('.solapa[data-solapa="comun"]');
    const panelRed = document.getElementById('panel-red');
    const poner = (el, ver) => {
      if(!el) return;
      const estaba = el.style.display !== 'none';
      el.style.display = ver ? '' : 'none';
      if(ver && !estaba && estreno){
        el.classList.remove('estreno');
        void el.offsetWidth;
        el.classList.add('estreno');
      }
    };
    poner(solapaComun, verComun);
    poner(panelRed, verRed);
    // Por si acaso: nunca dejar activa una solapa que ya no existe
    if(!verComun && solapaComun && solapaComun.classList.contains('activa')){
      const mapa = document.querySelector('.solapa[data-solapa="mapa"]');
      if(mapa) mapa.click();
    }
  }

  actualizar(estado, resultado){
    const p = estado.activo;
    const cap = capacidad(p, estado);
    const pct = Math.round((p.agua / cap) * 100);
    this.refrescarMetricas(estado);
    this.refrescarSolapas(estado);
    // El escape del dedo: visible solo con una herramienta armada
    const modoActivo = !!estado.modo.tipo;
    if(this.cache.cancelarModo !== modoActivo){
      this.cache.cancelarModo = modoActivo;
      const btnC = document.getElementById('btn-cancelar-modo');
      if(btnC) btnC.hidden = !modoActivo;
    }

    this.fijar('hud-agua', `${formatear(p.agua)} / ${formatear(cap)} L`,
      p.agua < cap * 0.08 ? 'critico' : 'agua');
    // En caudal DE JUEGO, la unidad del oficio: 0,41 L/s para un pueblo de 200
    // habitantes es un dato de verdad. Antes mostraba litros por segundo REAL
    // (clics incluidos) y con el desglose al lado eran dos verdades a la vista.
    // El clic no entra aquí: su respuesta es la escena y el nivel del depósito.
    // Produce CONTRA gasta, en el mismo vistazo (petición del autor): el
    // número suelto no decía si ibas sobrado o corto. Demanda MEDIA, no la
    // punta horaria: un número que baila cada segundo no se puede leer.
    // Y del CONJUNTO entero: la producción es de la red compartida, así que
    // compararla con la demanda de UN pueblo mentía en cuanto dos bebían de
    // la misma tubería (lo cazó el autor con su segundo pueblo).
    // SINCLIC: el caudal del bombeo automatico tambien es "Produce" — tras
    // el relevo, la bomba trabajaba y el HUD decia 0,00 (probador frio 3).
    // Mismo cambio de escala accion→mundo que usa avanzar(), a la inversa.
    const autoLps = clicsAutoPorSeg(p, estado) * litrosPorClic(p, estado)
                  / (3600 * CONFIG.economia.horasPorSegundo);
    const caudal = caudalCaptacion(p, estado, resultado.estiaje || 1) + autoLps;
    const demanda = this.demandaDelConjunto(estado, p);
    const fmtLs = v => v < 10 ? v.toFixed(2) : formatear(Math.round(v));
    this.fijar('hud-produccion', fmtLs(caudal) + ' / ' + fmtLs(demanda) + ' L/s',
      resultado.averiada ? 'critico' : caudal >= demanda ? 'ok' : 'neutro');
    this.fijar('hud-dinero', formatear(estado.dinero) + ' €',
      estado.dinero < 0 ? 'critico' : 'dinero');
    // EL RITMO DE LA CAJA en €/h, al lado del saldo: el probador frío vio
    // el dinero "bajar solo" sin recibo y pensó en un fallo — el goteo de
    // la luz y la nómina tiene que verse donde se mira el dinero. La cuenta
    // sale de resultado.caja (la única fuente); el detalle, en Mancomunidad.
    const cj = resultado.caja;
    if(cj){
      const ritmo = (cj.facturado || 0) - (cj.impagos || 0) + (cj.residuos || 0)
                  + (cj.yacimientos || 0) - (cj.luz || 0) - (cj.nomina || 0)
                  - (cj.multaCauce || 0) - (cj.multaZec || 0);
      const el = document.getElementById('hud-dinero-ritmo');
      if(el){
        el.textContent = (ritmo >= 0 ? '+' : '−')
          + Math.abs(ritmo).toFixed(Math.abs(ritmo) < 10 ? 1 : 0) + ' €/h';
        el.className = 'hud-ritmo ' + (ritmo >= 0 ? 'ok' : 'critico');
        // El rojo sin explicación deja "la mosca detrás de la oreja"
        // (jugadora de trance): el tooltip cuenta la cuenta
        el.title = t`Facturación del agua menos luz, nómina y multas. De noche se consume menos y se factura menos; la luz no descansa.`;
      }
    }
    this.fijar('hud-poblacion',
      t`${Math.floor(p.habitantes).toLocaleString('es-ES')} hab`, 'neutro');

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
    const MESES = CONFIG.textos.meses;
    const mes = MESES[Math.floor(((estado.horas % horasAño) / horasAño) * MESES.length)];
    this.fijar('hud-reloj', `${String(h).padStart(2,'0')}:00 · ${mes}`,
      (resultado.punta || 1) > 1.4 ? 'alarma' : 'neutro');

    // Multa por hora, para el panel de cauce
    resultado.multaHora = (resultado.suciedad || 0) * CONFIG.cauce.multaMaxPorHora;

    // EL SCROLL DEL LATERAL SE RESPETA: algún refresco reconstruye su bloque
    // y el navegador re-clava el scroll arriba — el probador frío apuntaba a
    // CAPTACIÓN y compró DEPURADORA dos veces porque la lista se le movió
    // bajo el dedo. Se toma nota antes de refrescar y se repone si algún
    // panel lo ha tocado; el usuario scrollea ENTRE ciclos, nunca dentro,
    // así que reponer no le pisa el gesto.
    const laterales = document.querySelectorAll('.lateral');
    const scrolls = [...laterales].map(l => l.scrollTop);

    this.refrescarHito(estado);
    this.refrescarGuia(estado);
    this.refrescarTajo(estado, resultado);
    this.refrescarPaletaObra(estado);
    this.refrescarRed(estado, resultado);
    this.refrescarDiagnostico(estado, resultado);
    this.refrescarLugares(estado);
    this.refrescarObra(estado);
    this.refrescarCasilla(estado, this.escena);
    this.refrescarFichaObra(estado);
    this.refrescarHallazgo(estado);
    this.refrescarAlmacen(estado);
    this.refrescarServicios(estado);
    this.refrescarCuadrilla(estado);
    this.refrescarPremium(estado);
    this.refrescarAverias(estado);
    this.refrescarExpediente(estado);
    this.refrescarLibro(estado);
    this.refrescarCauce(estado, resultado);
    this.refrescarCaja(estado, resultado);
    this.marcarPestanaAveria(estado);
    this.actualizarPanel(estado, resultado);
    this.actualizarRegistro(estado);

    // ...y se repone el scroll si algún refresco lo ha movido
    laterales.forEach((l, i) => { if(l.scrollTop !== scrolls[i]) l.scrollTop = scrolls[i]; });
  }

  /** Vigila TODO lo que pinta la barra de estado y la reconstruye al cambiar. */
  marcarPestanaAveria(estado){
    const P = CONFIG.poblacion;
    const sed = estado.pueblos
      .map(pb => pb.desbloqueado && (pb.servicio || 0) < P.servicioMalo ? 1 : 0).join('');
    const firma = [(estado.averias || []).length, estado.puebloActivo,
                   estado.pueblos.length, faltanParaFase(estado), sed].join('|');
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
    if((estado.averias || []).length){ tendencia = t`Avería sin reparar`; claseT = 'critico'; }
    else if(resultado.servicio >= P.servicioBueno){
      const listo = p.racha >= P.horasBuenServicioParaCrecer;
      tendencia = listo ? t`Creciendo ▲` : t`Ganándose la confianza…`;
      claseT = listo ? 'ok' : 'neutro';
    } else if(resultado.servicio < P.servicioMalo){
      tendencia = t`Despoblándose ▼`; claseT = 'critico';
    } else { tendencia = t`Estable`; claseT = 'alarma'; }

    // El nombre sale de la MISMA tabla que pinta la escena; el paréntesis
    // describe cómo va el caudal, para que nunca se contradigan.
    const est = resultado.estiaje || 1;
    const estacion = nombreEstacion(estado.horas) +
      (est < 0.7 ? t` · estiaje` : est > 1.1 ? t` · deshielo` : '');
    // Tras la cirugía, todo son NIVELES CONECTADOS de piezas del mapa
    const nivelDep = (estado._conectado || {}).deposito || 0;
    const reserva = nivelDep === 0 ? t`Sin depósito` : t`${nivelDep} niveles · ${formatear(capacidad(p, estado))} L`;
    const nivDepu = ((estado._conectadoSan || {}).depuradora || 0);
    const sane = servicioActivo(p, 'saneamiento')
      ? (nivDepu > 0 ? t`Depuradora: ${nivDepu} niveles` : t`SIN depurar ⚠`)
      : t`Aún no genera`;

    // Lluvia y tormentas (solo cuando la mancomunidad ya gestiona pluviales)
    const lluviaPct = Math.round((resultado.lluvia || 0) * 100);
    const tanquePct = Math.round((resultado.tanqueFrac || 0) * 100);
    const filaLluvia = estado.pluvialesActivas ? `
      <div class="d-fila"><span>${t`Lluvia`}</span><b class="${lluviaPct > 50 ? 'agua' : ''}">${lluviaPct} %</b></div>
      <div class="d-fila"><span>${t`Pluviales`}</span><b>${(resultado.separadaLh || 0) > 0 ? t`Separando` : t`Sin separar ⚠`}</b></div>
      <div class="d-fila"><span>${t`Tanque tormentas`}</span><b class="${resultado.aliviando ? 'critico' : ''}">${
        capacidadTanque(p, estado) > 0 ? t`${tanquePct} % lleno` : '—'}${resultado.aliviando ? t` · ALIVIANDO` : ''}</b></div>
      <div class="d-fila"><span>${t`Calidad`}</span><b class="${(resultado.calidad || 1) > 1.05 ? 'ok' : ''}">×${(resultado.calidad || 1).toFixed(2)}</b></div>` : '';

    // Residuos: cuánto se recicla, cuánto deja y cuánta basura hay tirada
    const basuraPct = Math.round((resultado.basuraCalle || 0) * 100);
    const recicPct = resultado.basuraTh > 0
      ? Math.round((resultado.recicladaTh || 0) / resultado.basuraTh * 100) : 0;
    const filaResiduos = servicioActivo(p, 'residuos') ? `
      <div class="d-fila"><span>${t`Basura`}</span><b>${(resultado.basuraTh || 0).toFixed(3)} t/h</b></div>
      <div class="d-fila"><span>${t`Se recicla`}</span><b class="${recicPct > 0 ? 'ok' : 'alarma'}">${recicPct} %</b></div>
      <div class="d-fila"><span>${t`Venta de material`}</span><b class="${(resultado.ingresoResiduosHora || 0) > 0 ? 'dinero' : 'critico'}">${
        formatear(resultado.ingresoResiduosHora || 0)} €/h</b></div>
      <div class="d-fila"><span>${t`Sin recoger`}</span><b class="${basuraPct > 20 ? 'critico' : ''}">${basuraPct} %</b></div>` : '';

    const firma = [p.nombre, tendencia, Math.floor(p.habitantes),
                   nivelDep, nivDepu, estacion, sane, basuraPct, recicPct,
                   estado.pluvialesActivas, lluviaPct, tanquePct,
                   resultado.aliviando, Math.round(resultado.separadaLh || 0)].join('|');
    if(this.cache.panelFirma === firma) return;
    this.cache.panelFirma = firma;

    document.getElementById('detalle').innerHTML = `
      <div class="d-fila"><span>${t`Pueblo`}</span><b>${p.nombre}</b></div>
      <div class="d-fila"><span>${t`Tendencia`}</span><b class="${claseT}">${tendencia}</b></div>
      <div class="d-fila"><span>${t`Habitantes`}</span><b>${Math.floor(p.habitantes).toLocaleString('es-ES')}</b></div>
      <div class="d-fila"><span>${t`Consumo ahora`}</span><b>${consumoAhora.toFixed(2)} m³/h</b></div>
      <div class="d-fila"><span>${t`Captación`}</span><b>${prodAhora > 0 ? prodAhora.toFixed(2) + ' m³/h' : '—'}</b></div>
      <div class="d-fila"><span>${t`Estación`}</span><b>${estacion}</b></div>
      <div class="d-fila"><span>${t`Reserva`}</span><b>${reserva}</b></div>
      <div class="d-fila"><span>${t`Saneamiento`}</span><b class="${servicioActivo(p, 'saneamiento') && nivDepu === 0 ? 'alarma' : ''}">${sane}</b></div>
      ${filaLluvia}
      ${filaResiduos}`;
  }

  actualizarRegistro(estado){
    const firma = estado.registro.length + ':' + (estado.registro[0]?.texto || '');
    if(this.cache.regFirma === firma) return;
    this.cache.regFirma = firma;
    const cont = document.getElementById('registro');
    if(!estado.registro.length){
      cont.innerHTML = `<div class="reg vacio">${t`Sin novedades.`}</div>`;
      return;
    }
    cont.innerHTML = estado.registro.slice(0, 8).map(r =>
      `<div class="reg ${r.nivel}"><em>${t`${r.h} h`}</em> ${r.texto}</div>`).join('');
  }
}

const limitarPct = p => p < 0 ? 0 : p > 100 ? 100 : p;
