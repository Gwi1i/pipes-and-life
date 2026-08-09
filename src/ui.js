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
         poderExpansion } from './simulacion.js';
import { formatear } from './util.js';
import { celdaEn, piezaDeRuina } from './mapa.js';

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

  construirPaletaObra(){
    const cont = document.getElementById('construir');
    if(!cont) return;
    const obras = Object.entries(CONFIG.construibles)
      .sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0));
    cont.innerHTML = obras.map(([clave, d]) => `
      <button class="mejora obra" data-accion="elegirConstruible" data-clave="${clave}"
              id="obra-${clave}" style="--tono:${d.color}">
        <span class="m-cab"><span class="m-nom">${d.nombre}</span></span>
        <span class="m-desc">${d.desc}</span>
        <span class="m-coste">${formatear(d.coste)} €</span>
      </button>`).join('') + `
      <button class="mejora obra tuberia" data-accion="modoTuberia" id="obra-tuberia"
              style="--tono:${CONFIG.color.agua}">
        <span class="m-cab"><span class="m-nom">Tender tubería</span></span>
        <span class="m-desc">Tú marcas el recorrido, casilla a casilla. Clic en
          la última para rematar, en la anterior para deshacer. Cada terreno
          cuesta lo suyo: rodear un bosque puede salir mejor que desbrozarlo.</span>
        <span class="m-coste">según el terreno</span>
      </button>`;
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
    const firma = sel ? `${sel.col},${sel.fila},${celda?.resuelto}` : 'nada';
    if(this.cache.hallazgoFirma === firma) return;
    this.cache.hallazgoFirma = firma;

    if(!celda || !celda.hallazgo || celda.resuelto){ panel.style.display = 'none'; return; }
    panel.style.display = '';
    const cont = document.getElementById('hallazgo');
    const H = CONFIG.hallazgos;

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
    } else if(celda.hallazgo === 'yacimiento'){
      cont.innerHTML = `
        <button class="mejora obra" data-accion="explotarYacimiento" style="--tono:${H.color.yacimiento}">
          <span class="m-cab"><span class="m-nom">Explotar el yacimiento</span></span>
          <span class="m-desc">Materiales que se venden de una vez.</span>
          <span class="m-coste">+${formatear(H.primaYacimiento)} €</span>
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
                  || (b.dataset.accion === 'modoTuberia' && modo.tipo === 'tuberia');
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
      const alerta = p.averia ? ' con-averia' : '';
      return `<button class="pestana${activa}${alerta}" data-accion="cambiarPueblo" data-clave="${i}">
        ${p.nombre}${p.averia ? ' ⚠' : ''}</button>`;
    }).join('');
  }

  /* ---------------- TIENDA (del pueblo activo) ---------------- */

  construirTienda(){
    const cont = document.getElementById('tienda');
    cont.innerHTML = this.mejoras.map(([clave, m]) => `
      <button class="mejora" data-accion="mejorar" data-clave="${clave}" id="mejora-${clave}">
        <span class="m-cab">
          <span class="m-nom">${m.nombre}</span>
          <span class="m-nivel" id="nivel-${clave}"></span>
        </span>
        <span class="m-desc">${m.desc}</span>
        <span class="m-coste" id="coste-${clave}">—</span>
      </button>`).join('');
  }

  refrescarTienda(estado){
    const p = estado.activo;
    for(const [clave, m] of this.mejoras){
      const nivel = p.mejoras[clave];
      const bt = document.getElementById('mejora-' + clave);
      const elN = document.getElementById('nivel-' + clave);
      const elC = document.getElementById('coste-' + clave);
      if(!bt) continue;

      // Mejoras que aún no están desbloqueadas para la mancomunidad
      if(m.requiere === 'pluviales' && !estado.pluvialesActivas){
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

  refrescarAverias(estado){
    const p = estado.activo;
    const panel = document.getElementById('panel-averias');
    const hayAveria = !!p.averia;
    const tieneEquipo = p.mejoras.mantenimiento > 0;

    panel.style.display = hayAveria ? '' : 'none';
    if(!hayAveria) return;

    document.getElementById('averia-estado').textContent = tieneEquipo
      ? 'El equipo de mantenimiento está en camino…'
      : 'Producción automática parada. Bombea a mano o repara.';
    const btn = document.getElementById('btn-reparar');
    btn.style.display = tieneEquipo ? 'none' : '';
    document.getElementById('averia-coste').textContent =
      formatear(CONFIG.averias.costeReparacionManual) + ' €';
  }

  /* ---------------- CAUCE (común) ---------------- */

  refrescarCauce(estado, resultado){
    const panel = document.getElementById('panel-cauce');
    // Solo tiene sentido cuando algún pueblo ya vierte, o si hay suciedad
    const algunoVierte = estado.pueblos.some(p => p.desbloqueado && p.saneamientoActivo);
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

    // Desgaste: barra y aviso en el botón de engrasar
    const des = Math.round((resultado.desgaste || 0) * 100);
    const bd = document.getElementById('barra-desgaste');
    if(bd){
      bd.style.width = limitarPct(des) + '%';
      bd.className = des >= CONFIG.desgaste.avisoEn * 100 ? 'alto' : '';
    }
    this.fijar('desgaste-txt', `desgaste ${des} %  ·  rinde ${Math.round((resultado.eficiencia ?? 1) * 100)} %`);
    const btnM = document.getElementById('btn-mantener');
    if(btnM) btnM.classList.toggle('urge', des >= CONFIG.desgaste.avisoEn * 100);

    // Multa por hora, para el panel de cauce
    resultado.multaHora = (resultado.suciedad || 0) * CONFIG.cauce.multaMaxPorHora;

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
    const firma = estado.pueblos.map(p => (p.averia ? 1 : 0)).join('') + '|' + estado.puebloActivo;
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
    if(p.averia){ tendencia = 'Avería activa'; claseT = 'critico'; }
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
    const sane = p.saneamientoActivo
      ? (p.mejoras.depuradora > 0 ? `Depuradora Nv ${p.mejoras.depuradora}` : 'SIN depurar ⚠')
      : 'Aún no genera';

    // Lluvia y tormentas (solo cuando la mancomunidad ya gestiona pluviales)
    const lluviaPct = Math.round((resultado.lluvia || 0) * 100);
    const tanquePct = Math.round((resultado.tanqueFrac || 0) * 100);
    const filaLluvia = estado.pluvialesActivas ? `
      <div class="d-fila"><span>Lluvia</span><b class="${lluviaPct > 50 ? 'agua' : ''}">${lluviaPct} %</b></div>
      <div class="d-fila"><span>Pluviales</span><b>${p.mejoras.pluviales > 0 ? 'Nivel ' + p.mejoras.pluviales : 'Sin separar ⚠'}</b></div>
      <div class="d-fila"><span>Tanque tormentas</span><b class="${resultado.aliviando ? 'critico' : ''}">${
        capacidadTanque(p) > 0 ? tanquePct + ' % lleno' : '—'}${resultado.aliviando ? ' · ALIVIANDO' : ''}</b></div>
      <div class="d-fila"><span>Calidad</span><b class="${(resultado.calidad || 1) > 1.05 ? 'ok' : ''}">×${(resultado.calidad || 1).toFixed(2)}</b></div>` : '';

    const firma = [p.nombre, tendencia, Math.floor(p.habitantes),
                   nivelDep, p.mejoras.captacion, estacion, sane,
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
      <div class="d-fila"><span>Saneamiento</span><b class="${p.saneamientoActivo && p.mejoras.depuradora === 0 ? 'alarma' : ''}">${sane}</b></div>
      ${filaLluvia}`;
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
