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
         llenadoVaso, capacidadVaso, costeAmpliarVertedero } from './simulacion.js';
import { formatear } from './util.js';
import { celdaEn, piezaDeRuina, diametro, nivelDiametro, costeRenovar,
         costeCasillaTuberia, puedeColocar,
         lineasConectadas, cuelloDeBotella, escalaDeRed } from './mapa.js';
import { pasoActual } from './tutorial.js';

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
            <span class="m-cab"><span class="m-nom">Tender ${r.corto}</span>
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
                   lineas.map(l => l.tuberia.dn).join('')].join('|');
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
          const sube = nivelDiametro(tuberia.dn, clave) < nivelDiametro(objetivo.id, clave);
          const coste = sube ? costeRenovar(estado.mapa, tuberia, objetivo.id, clave) : 0;
          return `
            <button class="mejora obra linea${sube ? '' : ' hecha'}"
                    ${sube ? `data-accion="renovarLinea" data-clave="${indice}"` : 'disabled'}
                    style="--tono:${d.color}">
              <span class="m-cab"><span class="m-nom">${tuberia.camino.length} casillas · ${d.nombre}</span></span>
              <span class="m-desc">${sube
                ? `Renovar a ${objetivo.nombre} de ${objetivo.material}.`
                : 'Ya está a la altura del diámetro elegido.'}</span>
              <span class="m-coste">${sube ? formatear(coste) + ' €' : '—'}</span>
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
    if(nombre) nombre.textContent = `Tender ${R.corto}`;
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
   * Por qué la red se ha convertido en el problema. Van aquí y no en el HTML
   * porque son la respuesta a preguntas que, sin contestar, parecen fallos del
   * juego: "compro captación y no sube el agua", "cuido el servicio y el pueblo
   * no crece", "tengo depuradora y el río sigue sucio".
   */
  avisosRed(estado, clave, cuello, resultado = {}){
    const p = estado.activo;
    const fuera = [];
    if(clave === 'abastecimiento'){
      if(redEstrangula(p, estado)) fuera.push(`Tu captación da más agua de la que
        cabe por ${cuello.def.nombre}: se está perdiendo lo que sobra. Comprar más
        captación no servirá de nada hasta que ensanches la línea.`);
      if(p.habitantes >= cuello.def.habitantesMax * 0.95) fuera.push(`El pueblo ha
        tocado techo: por ${cuello.def.nombre} no cabe agua para más de
        ${formatear(cuello.def.habitantesMax)} habitantes. Hasta que no renueves la
        línea entera, no crece.`);
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

  /* ---------------- LA GUÍA DE LOS PRIMEROS PASOS ---------------- */

  refrescarGuia(estado){
    const paso = pasoActual(estado);
    const firma = paso ? paso.id : 'fin';
    if(this.cache.guiaFirma === firma) return;
    this.cache.guiaFirma = firma;

    const panel = document.getElementById('panel-guia');
    if(!paso){ panel.style.display = 'none'; return; }
    panel.style.display = '';
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
    const firma = sel ? `${sel.col},${sel.fila},${celda?.resuelto},${celda?.excavado}` : 'nada';
    if(this.cache.hallazgoFirma === firma) return;
    this.cache.hallazgoFirma = firma;

    const cont = document.getElementById('hallazgo');
    const H = CONFIG.hallazgos;

    // Un yacimiento aflorado no es un "hallazgo" de los de destapar casilla:
    // sale al picar. Se atiende aquí igual porque el sitio es el mismo.
    if(celda && celda.arqueologia && celda.aflorado){
      const A = CONFIG.arqueologia;
      panel.style.display = '';
      cont.innerHTML = celda.excavado
        ? `<p class="red-cuello" style="--tono:${A.color}"><b>Yacimiento excavado</b></p>
           <p class="m-desc">Puesto en valor. Renta <b>${formatear(A.rentaPorHora)} €/h</b>
             y seguirá haciéndolo. La casilla queda para siempre fuera de obra.</p>`
        : `<p class="red-cuello" style="--tono:${A.color}"><b>Restos arqueológicos</b></p>
           <p class="m-desc">Han salido al picar. No se pueden quitar ni se puede
             construir encima: hay que rodearlos. Excavarlos cuesta, pero los pone
             en valor y pasan a rentar todos los meses.</p>
           <button class="mejora obra" data-accion="excavarYacimiento" style="--tono:${A.color}">
             <span class="m-cab"><span class="m-nom">Excavar y poner en valor</span></span>
             <span class="m-desc">+${formatear(A.rentaPorHora)} €/h para siempre.</span>
             <span class="m-coste">${formatear(A.costeExcavar)} €</span>
           </button>`;
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
    } else {
      cont.innerHTML = `
        <button class="mejora obra" data-accion="abastecerPueblo" style="--tono:${H.color.pueblo}">
          <span class="m-cab"><span class="m-nom">Abastecer este pueblo</span></span>
          <span class="m-desc">Hay que haberle llevado antes una tubería. Al
            hacerlo entra en la mancomunidad.</span>
          <span class="m-coste">se une a tu red</span>
        </button>`;
    }
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
    const firma = obra ? `${obra.tipo},${obra.col},${obra.fila},${obra.nivel || 1},${Math.round(obra.lleno || 0)}` : 'nada';
    if(this.cache.obraFirma === firma) return;
    this.cache.obraFirma = firma;

    if(!obra){ panel.style.display = 'none'; return; }
    panel.style.display = '';
    const def = CONFIG.construibles[obra.tipo];
    const cont = document.getElementById('obra');

    if(obra.tipo !== 'vertedero'){
      cont.innerHTML = `
        <p class="red-cuello" style="--tono:${def.color}"><b>${def.nombre}</b></p>
        <p class="m-desc">${def.desc}</p>`;
      return;
    }

    const V = CONFIG.residuos.vertedero;
    const pct = Math.round(llenadoVaso(obra) * 100);
    const nivel = obra.nivel || 1;
    const tope = nivel >= V.nivelMax;
    const coste = costeAmpliarVertedero(obra);
    cont.innerHTML = `
      <p class="red-cuello" style="--tono:${def.color}">
        <b>${def.nombre}</b> · nivel ${nivel}
      </p>
      <div class="vaso"><i style="width:${pct}%"></i></div>
      <p class="m-desc">${formatear(obra.lleno || 0)} de ${formatear(capacidadVaso(obra))} t
        (${pct} %).${pct >= 100
          ? ' <b class="critico">LLENO: ya no admite nada.</b>'
          : ''}</p>
      <p class="m-desc">Gotea sobre el agua que tiene alrededor, y cuanto más
        lleno, más. Un agua insalubre da menos caudal.</p>
      ${tope
        ? '<p class="m-desc">No se puede ampliar más: abre otro vertedero en otra parte.</p>'
        : `<button class="mejora obra" data-accion="ampliarVertedero" style="--tono:${def.color}">
             <span class="m-cab"><span class="m-nom">Ampliar el vaso</span></span>
             <span class="m-desc">+${formatear(V.capacidadPorNivel)} t de capacidad.</span>
             <span class="m-coste">${formatear(coste)} €</span>
           </button>`}`;
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

    const firma = vale ? `${sel.col},${sel.fila},${celda.tipo}` : 'nada';
    if(this.cache.casillaFirma === firma) return;
    this.cache.casillaFirma = firma;

    if(!vale){ panel.style.display = 'none'; return; }
    panel.style.display = '';

    const def = CONFIG.terrenos[celda.tipo] || CONFIG.terrenos.prado;
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
      <p class="casilla-cabe">${cabe.length
        ? 'Aquí cabe: <b>' + cabe.join('</b>, <b>') + '</b>.'
        : 'Aquí no cabe ninguna instalación.'}</p>`;

    this.pintarMiniCasilla(estado, escena, celda, sel);
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
    cont.innerHTML = estado.pueblos.map((p, i) => {
      if(!p.desbloqueado){
        return `<span class="pestana bloqueada" title="Se abre al crecer el primer pueblo">🔒 ?</span>`;
      }
      const activa = i === estado.puebloActivo ? ' activa' : '';
      const alerta = (estado.averias || []).length ? ' con-averia' : '';
      return `<button class="pestana${activa}${alerta}" data-accion="cambiarPueblo" data-clave="${i}">
        ${p.nombre}${(estado.averias || []).length ? ' ⚠' : ''}</button>`;
    }).join('');
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
    const firma = lista.map(a => `${a.col},${a.fila},${a.clics}`).join('|');
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
            Ve hasta ella y clica encima: le faltan <b>${av.clics}</b> golpes de
            llave, a ${formatear(coste)} € cada uno.</span>
          <span class="m-coste">ir ahí →</span>
        </button>`;
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
    this.fijar('hud-produccion', formatear(resultado.prodLps) + ' L/s',
      resultado.averiada ? 'critico' : (resultado.prodLps > 0 ? 'ok' : 'neutro'));
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

    this.refrescarGuia(estado);
    this.refrescarPaletaObra(estado);
    this.refrescarRed(estado, resultado);
    this.refrescarObra(estado);
    this.refrescarCasilla(estado, this.escena);
    this.refrescarHallazgo(estado);
    this.refrescarAlmacen(estado);
    this.refrescarTienda(estado);
    this.refrescarPremium(estado);
    this.refrescarAverias(estado);
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
    const prodAhora = caudalCaptacion(p, estado) * (resultado.estiaje || 1) * 3600 / 1000;

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
