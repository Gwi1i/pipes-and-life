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

    // El TACTO: en el móvil no hay rueda, así que el zoom es el PELLIZCO. Se
    // llevan los dedos activos en un mapa; con dos, cada movimiento se reparte
    // en dos gestos — lo que cambia la separación es zoom, lo que se mueve el
    // centro es arrastre. `fuePellizco` aguanta hasta soltar TODOS los dedos:
    // sin él, levantar un dedo antes que el otro colaba un clic fantasma.
    const dedos = new Map();
    let fuePellizco = false, distPrev = 0, cxPrev = 0, cyPrev = 0;
    const medirPellizco = () => {
      const [a, b] = [...dedos.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y),
               cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    };

    l.addEventListener('pointerdown', e => {
      // La captura mantiene el gesto aunque el dedo se salga del lienzo. Si
      // falla (puntero ya perdido) no puede tumbar el resto del manejador.
      try{ l.setPointerCapture(e.pointerId); }catch(_){ }
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if(dedos.size === 2){
        fuePellizco = true; pulsado = false;   // el clic pendiente se anula
        ({ dist: distPrev, cx: cxPrev, cy: cyPrev } = medirPellizco());
        return;
      }
      const r = l.getBoundingClientRect();
      pulsado = true; recorrido = 0;
      ultX = e.clientX; ultY = e.clientY;
      this.emitir('pulsar', { x: e.clientX - r.left, y: e.clientY - r.top });
    });

    l.addEventListener('pointermove', e => {
      if(dedos.has(e.pointerId)) dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if(dedos.size === 2){
        const r = l.getBoundingClientRect();
        const { dist, cx, cy } = medirPellizco();
        if(distPrev > 0 && dist > 0)
          this.emitir('pellizco', { factor: dist / distPrev,
                                    x: cx - r.left, y: cy - r.top });
        this.emitir('arrastrar', { dx: cx - cxPrev, dy: cy - cyPrev });
        distPrev = dist; cxPrev = cx; cyPrev = cy;
        return;
      }
      const r = l.getBoundingClientRect();
      this.emitir('senalar', { x: e.clientX - r.left, y: e.clientY - r.top });
      if(!pulsado) return;
      const dx = e.clientX - ultX, dy = e.clientY - ultY;
      recorrido += Math.abs(dx) + Math.abs(dy);
      ultX = e.clientX; ultY = e.clientY;
      if(recorrido > 8) this.emitir('arrastrar', { dx, dy });
    });

    const soltar = e => {
      dedos.delete(e.pointerId);
      if(dedos.size === 0) setTimeout(() => { fuePellizco = false; }, 0);
      if(!pulsado || fuePellizco){ pulsado = false; return; }
      pulsado = false;
      if(recorrido > 8) return;              // fue un arrastre, no un clic
      const r = l.getBoundingClientRect();
      this.emitir('clicEscena', { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    l.addEventListener('pointerup', soltar);
    l.addEventListener('pointercancel', soltar);
    l.addEventListener('pointerleave', () => { if(!dedos.size) pulsado = false; });

    // Rueda del ratón: zoom sobre el mapa. Se manda la posición del cursor para
    // poder ampliar SOBRE ese punto y no sobre el centro, que es lo que hace
    // que el zoom se sienta natural en vez de dar saltos.
    l.addEventListener('wheel', e => {
      e.preventDefault();
      const r = l.getBoundingClientRect();
      this.emitir('zoom', { delta: e.deltaY, x: e.clientX - r.left, y: e.clientY - r.top });
    }, { passive: false });

    // Barra espaciadora = bombear en el pueblo, para quien prefiera el teclado.
    // OJO al `repeat`: mantenerla pulsada dispara la repetición del sistema y
    // bombeaba en ráfaga sola — un autoclic gratis que el autor cazó jugando.
    // Una pulsación, una bombada, como el ratón.
    window.addEventListener('keydown', e => {
      if(e.code === 'Space' && e.target === document.body && !e.repeat){
        e.preventDefault();
        this.emitir('bombear');
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

    // OJO: un botón fuera de estos contenedores se pinta y no hace nada, sin
    // avisar de nada. 'casilla' entró aquí con el estudio hidrogeológico.
    for(const id of ['tienda', 'premium', 'panel-averias', 'pestanas', 'panel-cauce',
                     'construir', 'hallazgo', 'almacen', 'panel-guia', 'red', 'obra',
                     'hito', 'casilla', 'vuelta', 'lugares', 'taller', 'respaldo',
                     'expediente', 'descubierto', 'tajo']){
      const cont = document.getElementById(id);
      if(cont) cont.addEventListener('click', e => {
        const b = e.target.closest('[data-accion]');
        if(b) this.emitir(b.dataset.accion, { clave: b.dataset.clave });
      });
    }
  }
}
