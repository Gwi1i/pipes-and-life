/**
 * ENTRADA — ratón, tacto y teclado.
 *
 * Su trabajo es convertir eventos del navegador (que hablan en píxeles de
 * pantalla) en intenciones del juego (que hablan en metros sobre el
 * terreno). Toda la traducción pasa por la cámara.
 *
 * No modifica el grafo directamente: emite acciones que main.js ejecuta.
 * Así la lógica de juego queda en un solo sitio.
 */

import { CONFIG } from './config.js';

export class Entrada {

  constructor(lienzo, camara){
    this.lienzo = lienzo;
    this.camara = camara;

    this.herramienta = null;      // null | 'captacion' | 'deposito' | ... | 'tuberia' | 'borrar'
    this.diametroActivo = CONFIG.diametros[1].dn;
    this.origenTuberia = null;    // id del nodo desde el que se traza
    this.seleccionado = null;     // id del nodo seleccionado
    this.nodoBajoCursor = null;

    this.mundoX = 0; this.mundoY = 0;
    this.arrastrando = false;
    this.huboArrastre = false;
    this.recorrido = 0;
    this.ultimoPx = 0; this.ultimoPy = 0;

    // Cola de acciones que main.js consume cada fotograma
    this.acciones = [];

    this.conectar();
  }

  emitir(tipo, datos = {}){ this.acciones.push({ tipo, ...datos }); }
  vaciarAcciones(){ const a = this.acciones; this.acciones = []; return a; }

  /* ---------------- EVENTOS ---------------- */

  conectar(){
    const l = this.lienzo;

    l.addEventListener('mousemove', e => this.mover(e.offsetX, e.offsetY, e.buttons));
    l.addEventListener('mousedown', e => this.pulsar(e.offsetX, e.offsetY, e.button));
    l.addEventListener('mouseup',   e => this.soltar(e.offsetX, e.offsetY, e.button));
    l.addEventListener('mouseleave',() => { this.arrastrando = false; this.nodoBajoCursor = null; });

    l.addEventListener('wheel', e => {
      e.preventDefault();
      this.camara.ampliar(e.deltaY, e.offsetX, e.offsetY);
    }, { passive: false });

    l.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.cancelar();
    });

    // Tacto: un dedo desplaza, dos hacen zoom
    let distanciaPrevia = 0;
    l.addEventListener('touchstart', e => {
      if(e.touches.length === 1){
        const r = l.getBoundingClientRect();
        this.pulsar(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top, 0);
      }
      e.preventDefault();
    }, { passive: false });

    l.addEventListener('touchmove', e => {
      const r = l.getBoundingClientRect();
      if(e.touches.length === 1){
        this.mover(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top, 1);
      } else if(e.touches.length === 2){
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        if(distanciaPrevia) this.camara.ampliar((distanciaPrevia - d) * 3,
          (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
          (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top);
        distanciaPrevia = d;
      }
      e.preventDefault();
    }, { passive: false });

    l.addEventListener('touchend', e => {
      distanciaPrevia = 0;
      if(e.touches.length === 0) this.soltar(this.ultimoPx, this.ultimoPy, 0);
    });

    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      this.camara.teclas.add(k);
      if(k === 'escape') this.cancelar();
      if(k === 'f') this.camara.encuadrarTodo();
      if(k === 'delete' || k === 'backspace'){
        if(this.seleccionado !== null) this.emitir('borrarNodo', { id: this.seleccionado });
      }
      // Teclas 1-4 para elegir diámetro
      const n = parseInt(k, 10);
      if(n >= 1 && n <= CONFIG.diametros.length){
        this.diametroActivo = CONFIG.diametros[n - 1].dn;
        this.emitir('cambioDiametro');
      }
    });
    window.addEventListener('keyup', e => this.camara.teclas.delete(e.key.toLowerCase()));
  }

  /* ---------------- LÓGICA ---------------- */

  mover(px, py, botones){
    this.mundoX = this.camara.pantallaAMundoX(px);
    this.mundoY = this.camara.pantallaAMundoY(py);

    if(this.arrastrando && botones){
      const dx = px - this.ultimoPx, dy = py - this.ultimoPy;

      // Se mide el desplazamiento TOTAL desde donde se pulsó, no el de
      // este fotograma. Con el umbral por fotograma, el temblor normal
      // de la mano al hacer clic (2-3 px) descartaba casi todos los clics.
      this.recorrido += Math.abs(dx) + Math.abs(dy);
      if(this.recorrido > 8) this.huboArrastre = true;

      if(!this.herramienta || this.herramienta === 'mover'){
        this.camara.desplazar(dx, dy);
      }
    }
    this.ultimoPx = px; this.ultimoPy = py;
    this.emitir('consultarNodo');
  }

  pulsar(px, py, boton){
    if(boton !== 0) return;
    this.arrastrando = true;
    this.huboArrastre = false;
    this.recorrido = 0;
    this.ultimoPx = px; this.ultimoPy = py;
    this.mundoX = this.camara.pantallaAMundoX(px);
    this.mundoY = this.camara.pantallaAMundoY(py);
  }

  soltar(px, py, boton = 0){
    // Solo el botón izquierdo actúa. `pulsar` ya descarta los demás, pero
    // sin esta comprobación el `mouseup` del botón central o del derecho
    // llegaba igual hasta aquí y colocaba el elemento de la herramienta
    // activa: un clic que nadie había pedido.
    if(boton !== 0) return;

    const eraArrastre = this.huboArrastre;
    this.arrastrando = false;
    this.huboArrastre = false;
    if(eraArrastre) return;   // fue un desplazamiento, no un clic

    this.mundoX = this.camara.pantallaAMundoX(px);
    this.mundoY = this.camara.pantallaAMundoY(py);

    switch(this.herramienta){
      case null:
      case 'mover':
        this.emitir('seleccionar', { x: this.mundoX, y: this.mundoY });
        break;

      case 'tuberia':
        this.emitir('clicTuberia', { x: this.mundoX, y: this.mundoY });
        break;

      case 'borrar':
        this.emitir('borrarEn', { x: this.mundoX, y: this.mundoY });
        break;

      default:
        // OJO: la clave NO puede llamarse `tipo`. emitir() hace
        // push({ tipo, ...datos }), así que un `tipo` en los datos
        // sobrescribe el tipo de la acción y el switch no la reconoce.
        // Fallo silencioso de manual: sin error, sin efecto.
        this.emitir('colocar', {
          elemento: this.herramienta, x: this.mundoX, y: this.mundoY
        });
    }
  }

  cancelar(){
    this.origenTuberia = null;
    this.herramienta = null;
    this.seleccionado = null;
    this.emitir('cambioHerramienta');
  }

  elegirHerramienta(h){
    this.herramienta = (this.herramienta === h) ? null : h;
    this.origenTuberia = null;
    this.emitir('cambioHerramienta');
  }
}
