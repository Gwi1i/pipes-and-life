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

    // Pinchar en cualquier parte de la escena bombea. Es un clicker: cuanto
    // más grande el objetivo, mejor. La posición viaja para dibujar la onda.
    l.addEventListener('pointerdown', e => {
      const r = l.getBoundingClientRect();
      this.emitir('bombear', { x: e.clientX - r.left, y: e.clientY - r.top });
    });

    // Botón grande dedicado (accesible y para móvil)
    const btn = document.getElementById('btn-bombear');
    if(btn) btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      const r = l.getBoundingClientRect();
      this.emitir('bombear', { x: r.width * 0.26, y: r.height * 0.55 });
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
    for(const id of ['tienda', 'premium', 'panel-averias']){
      const cont = document.getElementById(id);
      if(cont) cont.addEventListener('click', e => {
        const b = e.target.closest('[data-accion]');
        if(b) this.emitir(b.dataset.accion, { clave: b.dataset.clave });
      });
    }
  }
}
