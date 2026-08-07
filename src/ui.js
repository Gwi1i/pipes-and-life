/**
 * UI — todo lo que es DOM, fuera del lienzo.
 *
 * Se mantiene separado del render de canvas a propósito: son dos mundos
 * distintos. El canvas se repinta entero 60 veces por segundo; el DOM
 * solo se toca cuando algo cambia de verdad, porque tocarlo es caro.
 */

import { CONFIG } from './config.js';
import { formatear } from './util.js';

export class UI {

  constructor(entrada){
    this.entrada = entrada;
    this.construirBarra();
    this.construirDiametros();
    this.cacheHUD = {};
  }

  /* ---------------- BARRA DE HERRAMIENTAS ---------------- */

  construirBarra(){
    const cont = document.getElementById('herramientas');

    const items = Object.entries(CONFIG.elementos)
      .filter(([, def]) => def.colocable !== false)
      .map(([clave, def]) => ({ clave, ...def }));

    items.push({ clave: 'tuberia', nombre: 'Tubería', color: '#94a3b8',
      coste: 0, desc: 'Une dos elementos. Haz clic en el origen y luego en el destino.' });
    items.push({ clave: 'borrar', nombre: 'Demoler', color: '#ef4444',
      coste: 0, desc: 'Elimina el elemento o el tramo sobre el que hagas clic.' });

    cont.innerHTML = items.map(i => `
      <button class="herramienta" data-herr="${i.clave}" style="--tono:${i.color}">
        <span class="h-nom">${i.nombre}</span>
        ${i.coste ? `<span class="h-coste">${formatear(i.coste)} €</span>` : ''}
      </button>`).join('');

    cont.addEventListener('click', e => {
      const b = e.target.closest('[data-herr]');
      if(!b) return;
      this.entrada.elegirHerramienta(b.dataset.herr);
      this.refrescarBarra();
      const def = CONFIG.elementos[b.dataset.herr] ||
                  items.find(i => i.clave === b.dataset.herr);
      this.mostrarAyuda(def ? def.desc : '');
    });
  }

  refrescarBarra(){
    document.querySelectorAll('[data-herr]').forEach(b => {
      b.classList.toggle('activa', b.dataset.herr === this.entrada.herramienta);
    });
    document.getElementById('panel-diametros').style.display =
      this.entrada.herramienta === 'tuberia' ? '' : 'none';
  }

  construirDiametros(){
    const cont = document.getElementById('diametros');
    cont.innerHTML = CONFIG.diametros.map((d, i) => `
      <button class="diam" data-dn="${d.dn}">
        <span class="d-nom">${d.nombre}</span>
        <span class="d-coste">${d.coste} €/m</span>
        <span class="d-tecla">${i + 1}</span>
      </button>`).join('');

    cont.addEventListener('click', e => {
      const b = e.target.closest('[data-dn]');
      if(!b) return;
      this.entrada.diametroActivo = parseInt(b.dataset.dn, 10);
      this.refrescarDiametros();
    });
    this.refrescarDiametros();
  }

  refrescarDiametros(){
    document.querySelectorAll('[data-dn]').forEach(b => {
      b.classList.toggle('activa', parseInt(b.dataset.dn, 10) === this.entrada.diametroActivo);
    });
  }

  mostrarAyuda(texto){
    document.getElementById('ayuda').textContent = texto || '';
  }

  /* ---------------- HUD ---------------- */

  /** Solo escribe en el DOM si el valor ha cambiado. */
  fijar(id, valor, clase){
    if(this.cacheHUD[id] === valor) return;
    this.cacheHUD[id] = valor;
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = valor;
    if(clase) el.className = 'v ' + clase;
  }

  actualizarHUD(estado, grafo){
    const r = estado.resultado;
    const h = Math.floor(estado.horas % 24);
    const dia = Math.floor(estado.horas / 24);
    const mes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
                [Math.floor(((estado.horas % 360) / 360) * 12)];
    this.fijar('hud-reloj', `${String(h).padStart(2,'0')}:00 · ${mes}`,
      (r.punta || 1) > 1.4 ? 'alarma' : 'neutro');
    this.fijar('hud-punta', 'x' + (r.punta || 1).toFixed(2),
      (r.punta || 1) > 1.4 ? 'alarma' : 'neutro');
    this.fijar('hud-recurso',
      `${(r.caudalCaptable || 0).toFixed(1)} L/s`,
      (r.recorte || 1) < 0.999 ? 'critico' : 'ok');
    const hab = grafo.porTipo('poblacion').reduce((s,p)=>s+Math.floor(p.habitantes),0);
    this.fijar('hud-habitantes', hab.toLocaleString('es-ES'), 'neutro');
    this.fijar('hud-dinero', formatear(estado.dinero) + ' €',
      estado.dinero < 0 ? 'critico' : 'dinero');
    this.fijar('hud-abastecidas', `${r.abastecidas}/${r.totales}`,
      r.abastecidas === r.totales && r.totales > 0 ? 'ok' : 'alarma');
    this.fijar('hud-caudal', r.caudalTotal.toFixed(2) + ' L/s', 'agua');
    this.fijar('hud-energia', r.energiaKwh.toFixed(1) + ' kW', 'alarma');
    this.fijar('hud-nodos', `${grafo.nodos.size} / ${grafo.aristas.size}`, 'neutro');
    this.fijar('hud-horas', Math.floor(estado.horas).toLocaleString('es-ES') + ' h', 'neutro');
  }

  /** Aviso de tramos rotos y botón de reparación. */
  actualizarAverias(grafo){
    const rotos = [...grafo.aristas.values()].filter(a => a.rota);
    const panel = document.getElementById('panel-averias');
    panel.style.display = rotos.length ? '' : 'none';
    if(!rotos.length) return;
    const coste = rotos.reduce((s,a)=>s + a.longitud * CONFIG.averias.costeReparacion, 0);
    document.getElementById('averias-txt').textContent =
      `${rotos.length} tramo${rotos.length>1?'s':''} averiado${rotos.length>1?'s':''}`;
    document.getElementById('averias-coste').textContent = formatear(coste) + ' €';
  }

  /* ---------------- PANEL DE DETALLE ---------------- */

  mostrarNodo(nodo, grafo){
    const p = document.getElementById('detalle');
    if(!nodo){ p.innerHTML = '<div class="vacio">Selecciona un elemento del mapa.</div>'; return; }

    const def = CONFIG.elementos[nodo.tipo];
    const conexiones = (grafo.adyacencia.get(nodo.id) || []).length;

    let filas = `
      <div class="d-fila"><span>Cota del terreno</span><b>${nodo.cota.toFixed(1)} m</b></div>
      <div class="d-fila"><span>Conexiones</span><b>${conexiones}</b></div>`;

    if(nodo.alturaPiezometrica !== null){
      const malaPresion = nodo.presion < CONFIG.hidraulica.presionMinima;
      const sobrePresion = nodo.presion > CONFIG.hidraulica.presionMaxima;
      filas += `
        <div class="d-fila"><span>Altura piezométrica</span><b>${nodo.alturaPiezometrica.toFixed(1)} m</b></div>
        <div class="d-fila"><span>Presión disponible</span>
          <b class="${malaPresion ? 'critico' : sobrePresion ? 'alarma' : 'ok'}">${nodo.presion.toFixed(1)} m.c.a.</b></div>
        <div class="d-fila"><span>Caudal de paso</span><b>${nodo.caudal.toFixed(2)} L/s</b></div>`;
    } else {
      filas += `<div class="d-fila"><span>Estado</span><b class="critico">Sin conexión a fuente</b></div>`;
    }

    if(nodo.tipo === 'captacion' && nodo.caudalDisponible){
      filas += `
        <div class="d-fila"><span>Origen</span><b>${nodo.nombre}</b></div>
        <div class="d-fila"><span>Caudal disponible</span><b class="ok">${nodo.caudalDisponible.toFixed(1)} L/s</b></div>`;
    }

    if(nodo.tipo === 'poblacion'){
      filas += `
        <div class="d-fila"><span>Habitantes</span><b>${Math.floor(nodo.habitantes).toLocaleString('es-ES')}</b></div>
        <div class="d-fila"><span>Demanda media</span><b>${nodo.demanda.toFixed(2)} L/s</b></div>
        <div class="d-fila"><span>Demanda ahora</span><b class="agua">${(nodo.demandaActual||nodo.demanda).toFixed(2)} L/s</b></div>
        <div class="d-fila"><span>Presión exigida</span><b>${CONFIG.hidraulica.presionMinima} m.c.a.</b></div>`;
    }

    // Bombeo instalado aquí
    if(nodo.bombeos > 0){
      const salto = CONFIG.elementos.bombeo.alturaManometrica * nodo.bombeos;
      filas += `<div class="d-fila"><span>Grupos de impulsión</span>
                  <b class="bombeo">${nodo.bombeos} · +${salto} m</b></div>`;
    }

    // Se puede bombear desde cualquier punto de la red salvo el consumo
    const admiteBombeo = nodo.tipo !== 'poblacion';
    const costeBombeo = CONFIG.elementos.bombeo.coste * Math.pow(1.7, nodo.bombeos);

    p.innerHTML = `
      <div class="d-cabecera" style="--tono:${def.color}">
        <span class="d-tipo">${def.nombre}</span>
        <span class="d-nombre">${nodo.nombre || '#' + nodo.id}</span>
      </div>
      ${filas}
      <div class="d-desc">${def.desc}</div>
      ${admiteBombeo ? `
        <button class="btn-instalar" data-instalar="${nodo.id}">
          <span>Instalar grupo de bombeo</span>
          <b>${formatear(costeBombeo)} €</b>
        </button>
        <div class="d-nota">Sube ${CONFIG.elementos.bombeo.alturaManometrica} m la altura
        piezométrica desde aquí. Consume energía mientras circule caudal.</div>` : ''}`;
  }

  /* ---------------- INCIDENCIAS ---------------- */

  actualizarIncidencias(incidencias){
    const cont = document.getElementById('incidencias');
    if(!incidencias.length){
      cont.innerHTML = '<div class="inc ok">Red estable. Todas las poblaciones abastecidas.</div>';
      return;
    }
    cont.innerHTML = incidencias.slice(0, 6).map(i =>
      `<div class="inc ${i.nivel}">${i.texto}</div>`).join('');
  }
}
