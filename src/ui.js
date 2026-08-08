/**
 * UI — todo lo que es DOM, fuera de la escena.
 *
 * El canvas se repinta 60 veces por segundo; el DOM solo se toca cuando algo
 * cambia de verdad, porque tocarlo es caro. De ahí el pequeño caché.
 */

import { CONFIG } from './config.js';
import { capacidad, demandaMedia, caudalCaptacion, costeMejora } from './simulacion.js';
import { formatear } from './util.js';

export class UI {

  constructor(entrada){
    this.entrada = entrada;
    this.cache = {};
    // Mejoras ordenadas por su campo `orden`, para que la tienda no dependa
    // del orden en que estén escritas en config.
    this.mejoras = Object.entries(CONFIG.mejoras)
      .sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0));
    this.construirTienda();
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
        bt.classList.add('comprada');
        bt.classList.remove('inalcanzable');
        bt.disabled = true;
        continue;
      }
      const coste = costeMejora(clave, nivel);
      elC.textContent = formatear(coste) + ' €';
      bt.classList.toggle('inalcanzable', !estado.puedePagar(coste));
    }
  }

  /* ---------------- HUD ---------------- */

  /** Solo escribe en el DOM si el valor ha cambiado. */
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
      resultado.prodLps > 0 ? 'ok' : 'neutro');
    this.fijar('hud-dinero', formatear(estado.dinero) + ' €',
      estado.dinero < 0 ? 'critico' : 'dinero');
    this.fijar('hud-poblacion',
      Math.floor(estado.poblacion.habitantes).toLocaleString('es-ES') + ' hab', 'neutro');

    const serv = Math.round(resultado.servicio * 100);
    this.fijar('hud-servicio', serv + ' %',
      serv >= 100 ? 'ok' : serv >= 50 ? 'alarma' : 'critico');

    const barra = document.getElementById('barra-agua');
    if(barra) barra.style.width = limitarPct(pct) + '%';

    this.refrescarTienda(estado);
    this.actualizarPanel(estado, resultado);
    this.actualizarRegistro(estado);
  }

  actualizarPanel(estado, resultado){
    const P = CONFIG.poblacion;
    const dem = demandaMedia(estado.poblacion.habitantes);
    const consumoHora = dem * 3600 / 1000;   // m³/h
    const prodHora = caudalCaptacion(estado) * 3600 / 1000;  // m³/h pasivos de captación

    // Tendencia demográfica, con el mismo criterio que usa la simulación
    let tendencia, claseT;
    if(resultado.servicio >= P.servicioBueno){
      const listo = estado.poblacion.racha >= P.horasBuenServicioParaCrecer;
      tendencia = listo ? 'Creciendo ▲' : 'Ganándose la confianza…';
      claseT = listo ? 'ok' : 'neutro';
    } else if(resultado.servicio < P.servicioMalo){
      tendencia = 'Despoblándose ▼'; claseT = 'critico';
    } else {
      tendencia = 'Estable'; claseT = 'alarma';
    }

    const nivelDep = estado.mejoras.deposito;
    const reserva = nivelDep === 0 ? 'Sin depósito' : `Nivel ${nivelDep} · ${formatear(capacidad(estado))} L`;

    // Se reconstruye solo cuando cambia algo perceptible, no cada fotograma.
    const firma = [tendencia, Math.floor(estado.poblacion.habitantes),
                   nivelDep, estado.mejoras.captacion].join('|');
    if(this.cache.panelFirma === firma) return;
    this.cache.panelFirma = firma;

    document.getElementById('detalle').innerHTML = `
      <div class="d-fila"><span>Tendencia</span><b class="${claseT}">${tendencia}</b></div>
      <div class="d-fila"><span>Habitantes</span><b>${Math.floor(estado.poblacion.habitantes).toLocaleString('es-ES')}</b></div>
      <div class="d-fila"><span>Consumo</span><b>${consumoHora.toFixed(2)} m³/h</b></div>
      <div class="d-fila"><span>Captación</span><b>${prodHora > 0 ? prodHora.toFixed(2) + ' m³/h' : '—'}</b></div>
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
