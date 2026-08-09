/**
 * ENTRADA — ratón, tacto y teclado.
 *
 * En la versión clicker su trabajo es mínimo: convertir clics en la acción
 * `bombear` y los botones de la tienda en sus acciones. No toca el estado:
 * emite intenciones que `main.js` ejecuta. Así la lógica queda en un sitio.
 */

export class Entrada {

  constructor(lienzo){
    this.lienzo = lienzo;
    this.acciones = [];
    this.conectar();
  }

  emitir(tipo, datos = {}){ this.acciones.push({ tipo, ...datos }); }
  vaciarAcciones(){ const a = this.acciones; this.acciones = []; return a; }

  conectar(){
    const l = this.lienzo;

    // Ratón sobre la escena. Hay que distinguir ARRASTRAR (mover el mapa) de
    // CLICAR (destapar una casilla): se mide el recorrido total desde que se
    // pulsa, no el de cada fotograma, porque el temblor normal de la mano al
    // hacer clic ya movía la vista y se comía el clic.
    let pulsado = false, recorrido = 0, ultX = 0, ultY = 0;

    l.addEventListener('pointerdown', e => {
      const r = l.getBoundingClientRect();
      pulsado = true; recorrido = 0;
      ultX = e.clientX; ultY = e.clientY;
      this.emitir('pulsar', { x: e.clientX - r.left, y: e.clientY - r.top });
    });

    l.addEventListener('pointermove', e => {
      const r = l.getBoundingClientRect();
      this.emitir('senalar', { x: e.clientX - r.left, y: e.clientY - r.top });
      if(!pulsado) return;
      const dx = e.clientX - ultX, dy = e.clientY - ultY;
      recorrido += Math.abs(dx) + Math.abs(dy);
      ultX = e.clientX; ultY = e.clientY;
      if(recorrido > 8) this.emitir('arrastrar', { dx, dy });
    });

    const soltar = e => {
      if(!pulsado) return;
      pulsado = false;
      if(recorrido > 8) return;              // fue un arrastre, no un clic
      const r = l.getBoundingClientRect();
      this.emitir('clicEscena', { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    l.addEventListener('pointerup', soltar);
    l.addEventListener('pointerleave', () => { pulsado = false; });

    // Botón grande dedicado (accesible y para móvil)
    const btn = document.getElementById('btn-bombear');
    if(btn) btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      const r = l.getBoundingClientRect();
      this.emitir('bombear', { x: r.width * 0.26, y: r.height * 0.55 });
    });

    // Botón de mantenimiento: el segundo sitio donde clicar
    const btnM = document.getElementById('btn-mantener');
    if(btnM) btnM.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.emitir('mantener');
    });

    // Barra espaciadora = bombear, para quien prefiera el teclado
    window.addEventListener('keydown', e => {
      if(e.code === 'Space' && e.target === document.body){
        e.preventDefault();
        const r = l.getBoundingClientRect();
        this.emitir('bombear', { x: r.width * 0.26, y: r.height * 0.55 });
      }
    });

    // Paneles con botones de acción (tienda, función especial, averías). Cada
    // botón lleva su acción en `data-accion` y, si aplica, la clave concreta en
    // `data-clave`. Añadir botones no obliga a tocar esto: basta con que estén
    // dentro de uno de estos contenedores.
    // Esc cancela la herramienta de construcción que esté puesta
    window.addEventListener('keydown', e => {
      if(e.key === 'Escape') this.emitir('cancelarModo');
    });

    for(const id of ['tienda', 'premium', 'panel-averias', 'pestanas', 'panel-cauce', 'construir']){
      const cont = document.getElementById(id);
      if(cont) cont.addEventListener('click', e => {
        const b = e.target.closest('[data-accion]');
        if(b) this.emitir(b.dataset.accion, { clave: b.dataset.clave });
      });
    }
  }
}
