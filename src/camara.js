/**
 * CÁMARA — traduce entre coordenadas de mundo y de pantalla.
 *
 * Esta es la pieza que separa "página web" de "motor gráfico". El juego
 * razona siempre en metros sobre el terreno; la pantalla es solo una
 * ventana que mira a ese mundo. Todo clic hay que traducirlo, y todo
 * dibujo también.
 *
 *   mundo  →  pantalla :  (m - centro) * zoom + mitadPantalla
 *   pantalla → mundo   :  (p - mitadPantalla) / zoom + centro
 */

import { CONFIG } from './config.js';
import { limitar } from './util.js';

export class Camara {

  constructor(lienzo){
    this.lienzo = lienzo;
    this.x = CONFIG.mundo.ancho / 2;   // centro de la vista, en metros
    this.y = CONFIG.mundo.alto  / 2;
    this.zoom = CONFIG.camara.zoomInicial;
    this.teclas = new Set();
  }

  get anchoPantalla(){ return this.lienzo.width  / (window.devicePixelRatio || 1); }
  get altoPantalla (){ return this.lienzo.height / (window.devicePixelRatio || 1); }

  /* ---------- CONVERSIONES ---------- */

  mundoAPantallaX(mx){ return (mx - this.x) * this.zoom + this.anchoPantalla / 2; }
  mundoAPantallaY(my){ return (my - this.y) * this.zoom + this.altoPantalla  / 2; }
  pantallaAMundoX(px){ return (px - this.anchoPantalla / 2) / this.zoom + this.x; }
  pantallaAMundoY(py){ return (py - this.altoPantalla  / 2) / this.zoom + this.y; }

  /** Rectángulo del mundo que se ve ahora mismo. Sirve para descartar
      del dibujo todo lo que queda fuera: es la optimización más barata
      que existe en un motor 2D. */
  get vista(){
    return {
      x1: this.pantallaAMundoX(0),
      y1: this.pantallaAMundoY(0),
      x2: this.pantallaAMundoX(this.anchoPantalla),
      y2: this.pantallaAMundoY(this.altoPantalla)
    };
  }

  /* ---------- MOVIMIENTO ---------- */

  desplazar(dxPantalla, dyPantalla){
    this.x -= dxPantalla / this.zoom;
    this.y -= dyPantalla / this.zoom;
    this.limitarPosicion();
  }

  /**
   * Zoom centrado en el cursor: el punto del mundo bajo el ratón debe
   * seguir bajo el ratón después de ampliar. Es lo que hace que el zoom
   * se sienta natural en lugar de saltar.
   */
  ampliar(delta, pxCursor, pyCursor){
    const antesX = this.pantallaAMundoX(pxCursor);
    const antesY = this.pantallaAMundoY(pyCursor);

    const factor = Math.exp(-delta * CONFIG.camara.velocidadZoom);
    this.zoom = limitar(this.zoom * factor, CONFIG.camara.zoomMin, CONFIG.camara.zoomMax);

    const despuesX = this.pantallaAMundoX(pxCursor);
    const despuesY = this.pantallaAMundoY(pyCursor);
    this.x += antesX - despuesX;
    this.y += antesY - despuesY;
    this.limitarPosicion();
  }

  /** No dejar que la cámara se vaya al vacío más allá del mapa. */
  limitarPosicion(){
    const margen = 400;
    this.x = limitar(this.x, -margen, CONFIG.mundo.ancho + margen);
    this.y = limitar(this.y, -margen, CONFIG.mundo.alto  + margen);
  }

  /** Desplazamiento con WASD / flechas, llamado desde el bucle. */
  actualizar(dt){
    const v = CONFIG.camara.velocidadTeclado * dt / this.zoom * 0.55;
    if(this.teclas.has('w') || this.teclas.has('arrowup'))    this.y -= v;
    if(this.teclas.has('s') || this.teclas.has('arrowdown'))  this.y += v;
    if(this.teclas.has('a') || this.teclas.has('arrowleft'))  this.x -= v;
    if(this.teclas.has('d') || this.teclas.has('arrowright')) this.x += v;
    this.limitarPosicion();
  }

  /** Encuadra todo el mapa en pantalla. */
  encuadrarTodo(){
    const zx = this.anchoPantalla / (CONFIG.mundo.ancho * 1.08);
    const zy = this.altoPantalla  / (CONFIG.mundo.alto  * 1.08);
    this.zoom = limitar(Math.min(zx, zy), CONFIG.camara.zoomMin, CONFIG.camara.zoomMax);
    this.x = CONFIG.mundo.ancho / 2;
    this.y = CONFIG.mundo.alto  / 2;
  }
}
