/**
 * UI — todo lo que es DOM, fuera de la escena.
 *
 * El canvas se repinta 60 veces por segundo; el DOM solo se toca cuando algo
 * cambia de verdad, porque tocarlo es caro. De ahí el pequeño caché.
 */

import { CONFIG } from './config.js';
import { capacidad, demandaMedia, caudalCaptacion, costeMejora,
         requisitosAutobomba } from './simulacion.js';
import { formatear } from './util.js';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export class UI {

  constructor(entrada){
    this.entrada = entrada;
    this.cache = {};
    this.mejoras = Object.entries(CONFIG.mejoras)
      .sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0));
    this.construirTienda();
    this.construirPremium();
  }

  /* ---------------- TIENDA / MEJORAS ---------------- */

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
    for(const [clave, m] of this.mejoras){
      const nivel = estado.mejoras[clave];
      const bt = document.getElementById('mejora-' + clave);
      const elN = document.getElementById('nivel-' + clave);
      const elC = document.getElementById('coste-' + clave);
      if(!bt) continue;

      elN.textContent = nivel > 0 ? 'Nv ' + nivel : '';

      if(nivel >= m.nivelMax){
        elC.textContent = 'AL MÁXIMO';
        bt.classList.add('comprada'); bt.classList.remove('inalcanzable');
        bt.disabled = true;
        continue;
      }
      const coste = costeMejora(clave, nivel);
      elC.textContent = formatear(coste) + ' €';
      bt.classList.toggle('inalcanzable', !estado.puedePagar(coste));
    }
  }

  /* ---------------- FUNCIÓN ESPECIAL: AUTO-BOMBEO ---------------- */

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
    const bt = document.getElementById('premium-autobomba');
    const etq = document.getElementById('premium-etq');
    const reqs = document.getElementById('premium-reqs');
    const coste = document.getElementById('premium-coste');
    if(!bt) return;

    if(estado.autobombaActivo){
      const firma = 'activo';
      if(this.cache.premiumFirma === firma) return;
      this.cache.premiumFirma = firma;
      bt.classList.add('activa'); bt.disabled = true;
      etq.textContent = 'ACTIVO';
      reqs.innerHTML = '';
      coste.textContent = 'La bomba trabaja sola ✓';
      return;
    }

    const req = requisitosAutobomba(estado);
    const puede = req.cumple && estado.puedePagar(P.coste);
    const firma = 'r' + req.lista.map(f => f.ok ? 1 : 0).join('') + (estado.puedePagar(P.coste) ? 'p' : '');
    if(this.cache.premiumFirma === firma) return;
    this.cache.premiumFirma = firma;

    etq.textContent = req.cumple ? 'DISPONIBLE' : 'BLOQUEADO';
    reqs.innerHTML = req.lista.map(f =>
      `<span class="p-req ${f.ok ? 'ok' : ''}">${f.ok ? '✓' : '○'} ${f.txt}</span>`).join('');
    coste.textContent = req.cumple ? `Activar · ${formatear(P.coste)} €` : 'Cumple los requisitos para activarlo';
    bt.classList.toggle('lista', puede);
    bt.classList.toggle('bloqueada', !req.cumple);
    bt.disabled = !req.cumple;
  }

  /* ---------------- AVERÍAS ---------------- */

  refrescarAverias(estado){
    const panel = document.getElementById('panel-averias');
    const hayAveria = !!estado.averia;
    const tieneEquipo = estado.mejoras.mantenimiento > 0;
    const firma = hayAveria + '|' + tieneEquipo;
    if(this.cache.averiaFirma === firma){ return; }
    this.cache.averiaFirma = firma;

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
    const cap = capacidad(estado);
    const pct = Math.round((estado.agua / cap) * 100);

    this.fijar('hud-agua', `${formatear(estado.agua)} / ${formatear(cap)} L`,
      estado.agua < cap * 0.08 ? 'critico' : 'agua');
    this.fijar('hud-produccion', formatear(resultado.prodLps) + ' L/s',
      resultado.averiada ? 'critico' : (resultado.prodLps > 0 ? 'ok' : 'neutro'));
    this.fijar('hud-dinero', formatear(estado.dinero) + ' €',
      estado.dinero < 0 ? 'critico' : 'dinero');
    this.fijar('hud-poblacion',
      Math.floor(estado.poblacion.habitantes).toLocaleString('es-ES') + ' hab', 'neutro');

    const serv = Math.round(resultado.servicio * 100);
    this.fijar('hud-servicio', serv + ' %',
      serv >= 100 ? 'ok' : serv >= 50 ? 'alarma' : 'critico');

    // Reloj: hora del día y mes del año de juego
    const h = Math.floor(estado.horas % 24);
    const horasAño = CONFIG.tiempo.horasPorAño;
    const mes = MESES[Math.floor(((estado.horas % horasAño) / horasAño) * MESES.length)];
    this.fijar('hud-reloj', `${String(h).padStart(2,'0')}:00 · ${mes}`,
      (resultado.punta || 1) > 1.4 ? 'alarma' : 'neutro');

    const barra = document.getElementById('barra-agua');
    if(barra) barra.style.width = limitarPct(pct) + '%';

    this.refrescarTienda(estado);
    this.refrescarPremium(estado);
    this.refrescarAverias(estado);
    this.actualizarPanel(estado, resultado);
    this.actualizarRegistro(estado);
  }

  actualizarPanel(estado, resultado){
    const P = CONFIG.poblacion;
    const dem = demandaMedia(estado.poblacion.habitantes);
    const consumoAhora = dem * (resultado.punta || 1) * 3600 / 1000;      // m³/h ahora
    const prodAhora = caudalCaptacion(estado) * (resultado.estiaje || 1) * 3600 / 1000; // m³/h

    let tendencia, claseT;
    if(estado.averia){ tendencia = 'Avería activa'; claseT = 'critico'; }
    else if(resultado.servicio >= P.servicioBueno){
      const listo = estado.poblacion.racha >= P.horasBuenServicioParaCrecer;
      tendencia = listo ? 'Creciendo ▲' : 'Ganándose la confianza…';
      claseT = listo ? 'ok' : 'neutro';
    } else if(resultado.servicio < P.servicioMalo){
      tendencia = 'Despoblándose ▼'; claseT = 'critico';
    } else { tendencia = 'Estable'; claseT = 'alarma'; }

    const estacion = (resultado.estiaje || 1) < 0.7 ? 'Estiaje (verano)'
                   : (resultado.estiaje || 1) > 1.1 ? 'Deshielo' : 'Normal';

    const firma = [tendencia, Math.floor(estado.poblacion.habitantes),
                   estado.mejoras.deposito, estado.mejoras.captacion, estacion].join('|');
    if(this.cache.panelFirma === firma) return;
    this.cache.panelFirma = firma;

    const nivelDep = estado.mejoras.deposito;
    const reserva = nivelDep === 0 ? 'Sin depósito' : `Nivel ${nivelDep} · ${formatear(capacidad(estado))} L`;

    document.getElementById('detalle').innerHTML = `
      <div class="d-fila"><span>Tendencia</span><b class="${claseT}">${tendencia}</b></div>
      <div class="d-fila"><span>Habitantes</span><b>${Math.floor(estado.poblacion.habitantes).toLocaleString('es-ES')}</b></div>
      <div class="d-fila"><span>Consumo ahora</span><b>${consumoAhora.toFixed(2)} m³/h</b></div>
      <div class="d-fila"><span>Captación</span><b>${prodAhora > 0 ? prodAhora.toFixed(2) + ' m³/h' : '—'}</b></div>
      <div class="d-fila"><span>Estación</span><b>${estacion}</b></div>
      <div class="d-fila"><span>Reserva</span><b>${reserva}</b></div>`;
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
