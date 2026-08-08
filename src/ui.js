/**
 * UI — todo lo que es DOM, fuera de la escena.
 *
 * El canvas se repinta 60 veces por segundo; el DOM solo se toca cuando algo
 * cambia de verdad, porque tocarlo es caro. De ahí el pequeño caché.
 */

import { CONFIG } from './config.js';
import { capacidad, demandaMedia } from './simulacion.js';
import { formatear } from './util.js';

export class UI {

  constructor(entrada){
    this.entrada = entrada;
    this.cache = {};
    this.construirTienda();
  }

  /* ---------------- TIENDA / MEJORAS ---------------- */

  construirTienda(){
    // De momento una sola mejora. El data-accion la conecta con main.js.
    const cont = document.getElementById('tienda');
    cont.innerHTML = `
      <button class="mejora" data-accion="comprarDeposito" id="mejora-deposito">
        <span class="m-nom">Depósito de reserva</span>
        <span class="m-desc">Acumula agua: ${formatear(CONFIG.deposito.capacidad)} L.
          Bombea a ratos y deja que la reserva abastezca.</span>
        <span class="m-coste">${formatear(CONFIG.deposito.coste)} €</span>
      </button>`;
  }

  refrescarTienda(estado){
    const b = document.getElementById('mejora-deposito');
    if(!b) return;
    if(estado.tieneDeposito){
      b.classList.add('comprada');
      b.disabled = true;
      b.querySelector('.m-coste').textContent = 'Construido ✓';
    } else {
      b.classList.toggle('inalcanzable', !estado.puedePagar(CONFIG.deposito.coste));
    }
  }

  /* ---------------- HUD Y PANELES ---------------- */

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
    this.fijar('hud-dinero', formatear(estado.dinero) + ' €',
      estado.dinero < 0 ? 'critico' : 'dinero');
    this.fijar('hud-poblacion',
      estado.poblacion.habitantes.toLocaleString('es-ES') + ' hab', 'neutro');

    const serv = Math.round(resultado.servicio * 100);
    this.fijar('hud-servicio', serv + ' %',
      serv >= 100 ? 'ok' : serv >= 50 ? 'alarma' : 'critico');

    // Barra de agua del HUD
    const barra = document.getElementById('barra-agua');
    if(barra) barra.style.width = limitarPct(pct) + '%';

    this.refrescarTienda(estado);
    this.actualizarPanel(estado, resultado);
    this.actualizarRegistro(estado);
  }

  actualizarPanel(estado, resultado){
    const dem = demandaMedia(estado.poblacion.habitantes);
    const consumoHora = dem * 3600 / 1000;   // m³/h
    const estadoTxt = resultado.servicio >= 0.999 ? 'Abastecida'
                    : resultado.servicio >= 0.5   ? 'Servicio parcial'
                    : 'Sin agua suficiente';
    const clase = resultado.servicio >= 0.999 ? 'ok'
                : resultado.servicio >= 0.5   ? 'alarma' : 'critico';

    // Se reconstruye entero solo si cambia el texto de estado, no cada frame.
    const firma = estadoTxt + '|' + estado.poblacion.habitantes + '|' + estado.tieneDeposito;
    if(this.cache.panelFirma === firma) return;
    this.cache.panelFirma = firma;

    document.getElementById('detalle').innerHTML = `
      <div class="d-fila"><span>Estado</span><b class="${clase}">${estadoTxt}</b></div>
      <div class="d-fila"><span>Habitantes</span><b>${estado.poblacion.habitantes.toLocaleString('es-ES')}</b></div>
      <div class="d-fila"><span>Consumo</span><b>${consumoHora.toFixed(2)} m³/h</b></div>
      <div class="d-fila"><span>Reserva</span><b>${estado.tieneDeposito ? 'Depósito ' + formatear(CONFIG.deposito.capacidad) + ' L' : 'Sin depósito'}</b></div>`;
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
