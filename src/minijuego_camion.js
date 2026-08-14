/**
 * MINIJUEGO: LA RUTA DEL CAMIÓN — la recogida, vista desde arriba.
 *
 * El camión va por la parte de abajo y se mueve a izquierda y derecha; la
 * calle baja hacia él (tú conduces, la madrugada corre) sembrada de
 * contenedores. Se RECOGE pasando por encima — pero solo puntúan los LLENOS
 * de las fracciones del día: llevarse uno vacío, a medias o de otra
 * fracción es viaje en balde. Y hay TRÁFICO: coches que esquivar, que un
 * golpe te deja clavado unos segundos con la jornada corriendo.
 *
 * La lección es la de la casa del autor (Mancomunidad de Montejurra): en
 * los pueblos pequeños la recogida es trasera, con camiones de DOBLE
 * COMPARTIMENTO que levantan dos fracciones en una sola ruta sin
 * mezclarlas. Por eso hay jornadas de una fracción y jornadas dobles, y el
 * camión sale pintado desde arriba con sus dos tapas.
 *
 * Mandos: flechas (o A/D), y en pantalla dos botonazos ◀ ▶ — deslizar no:
 * este diseño nació justo para que el dedo solo tenga que tocar.
 *
 * Módulo autocontenido, como sus hermanos: no toca el estado, devuelve
 * (aciertos, total, razón) por callback y main.js decide qué significa.
 */

import { CONFIG } from './config.js';
import * as sonido from './sonido.js';
import { t } from './idioma.js';

/* Las fracciones con contenedor de calle. El rótulo corto es el que cabe en
   una placa; el diccionario inglés traduce por esqueleto, como siempre. */
const FRACCIONES = [
  { id: 'resto',    color: '#94a3b8' },
  { id: 'envases',  color: '#facc15' },
  { id: 'organica', color: '#a16207' },
  { id: 'papel',    color: '#3b82f6' },
  { id: 'vidrio',   color: '#22c55e' }
];
const rotulo = id => ({
  resto:    t`RESTO`,
  envases:  t`ENVASES`,
  organica: t`ORGÁNICA`,
  papel:    t`PAPEL`,
  vidrio:   t`VIDRIO`
})[id];

const COLORES_COCHE = ['#d64545', '#e8e8e8', '#4a6fa5', '#3d3d46', '#7fa06a'];

/* Los sprites del autor (assets/cam_*.png, de camion_hoja.png pasada por
   recortar_hojas.py): si existen mandan y si no, el dibujo por código — el
   reparto de siempre. Lo que SIGNIFICA algo lo pinta el juego encima
   SIEMPRE: las tapas del día sobre el camión y el estado (las bolsas del
   lleno, la rendija del a-medias) sobre los contenedores. */
const SPRITES = {};
for(const clave of ['camion', 'coche1', 'coche2', 'coche3', 'coche4',
                    'cont_resto', 'cont_envases', 'cont_organica',
                    'cont_papel', 'cont_vidrio']){
  const img = new Image();
  img.src = `assets/cam_${clave}.png`;
  SPRITES[clave] = img;   // si 404, naturalWidth queda a 0 y no se usa
}
const conSprite = clave => SPRITES[clave] && SPRITES[clave].naturalWidth > 0;

export class MinijuegoCamion {

  constructor(){
    this.fondo = document.getElementById('minijuego3');
    this.lienzo = document.getElementById('mini3-lienzo');
    this.ctx = this.lienzo.getContext('2d');
    this.alTerminar = null;

    // Teclado: flechas o A/D. Se escucha en window solo con el telón abierto.
    this.teclas = {};
    window.addEventListener('keydown', e => {
      if(this.fondo.hidden) return;
      if(['ArrowRight', 'ArrowLeft', 'KeyD', 'KeyA'].includes(e.code)){
        this.teclas[e.code] = true;
        if(this.preludio > 0) this.preludio = 0;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => { this.teclas[e.code] = false; });

    // Tacto y ratón: los dos botonazos ◀ ▶ pintados en el lienzo
    const pos = e => {
      const r = this.lienzo.getBoundingClientRect();
      return [(e.clientX - r.left) * (this.lienzo.width / r.width),
              (e.clientY - r.top) * (this.lienzo.height / r.height)];
    };
    this.pulsado = null;             // 'izq' | 'der' | null
    this.lienzo.addEventListener('pointerdown', e => {
      try{ this.lienzo.setPointerCapture(e.pointerId); }catch(_){ }
      if(this.preludio > 0){ this.preludio = 0; return; }
      const [x, y] = pos(e);
      this.pulsado = this.botonEn(x, y);
    });
    this.lienzo.addEventListener('pointermove', e => {
      if(this.pulsado === null) return;
      const [x, y] = pos(e);
      this.pulsado = this.botonEn(x, y);
    });
    const soltar = () => { this.pulsado = null; };
    this.lienzo.addEventListener('pointerup', soltar);
    this.lienzo.addEventListener('pointercancel', soltar);
    document.getElementById('mini3-cancelar').onclick = () => this.terminar('abandonado');
  }

  /** ¿Qué botón de pantalla cae bajo ese punto? Zonas anchas: son para dedos. */
  botonEn(x, y){
    if(y < this.lienzo.height - 96) return null;
    if(x < this.lienzo.width * 0.38) return 'izq';
    if(x > this.lienzo.width * 0.62) return 'der';
    return null;
  }

  jugar(alTerminar){
    const K = CONFIG.minijuegos.camion;
    this.alTerminar = alTerminar;
    this.lienzo.width = 640;
    this.lienzo.height = 460;

    // LA CALZADA: la franja central por la que baja todo
    this.viaIzq = this.lienzo.width * 0.26;
    this.viaDer = this.lienzo.width * 0.74;

    // LA JORNADA DEL DÍA: una fracción, o dos si toca camión bicompartimentado
    const barajadas = FRACCIONES.slice().sort(() => Math.random() - 0.5);
    this.hoy = barajadas.slice(0, Math.random() < K.probDoble ? 2 : 1);

    // LA TANDA de contenedores que va a bajar, ya echada: cada uno con su
    // fracción, su estado y su carril. Se garantiza un mínimo de llenos del
    // día — una jornada sin nada que recoger no es difícil, es una estafa.
    this.porBajar = [];
    for(let i = 0; i < K.contenedores; i++){
      const frac = FRACCIONES[Math.floor(Math.random() * FRACCIONES.length)];
      const azar = Math.random();
      const estadoC = azar < K.probLleno ? 'lleno' : azar < K.probLleno + 0.25 ? 'medias' : 'vacio';
      this.porBajar.push({ tipo: 'cont', frac, estadoC });
    }
    const buenos = () => this.porBajar.filter(
      c => c.estadoC === 'lleno' && this.hoy.some(f => f.id === c.frac.id));
    let vueltas = 0;
    while(buenos().length < 5 && vueltas++ < 60){
      const c = this.porBajar[Math.floor(Math.random() * this.porBajar.length)];
      c.frac = this.hoy[Math.floor(Math.random() * this.hoy.length)];
      c.estadoC = 'lleno';
    }
    this.total = buenos().length;
    this.buenosVivos = this.total;   // pendientes de recoger o de perderse

    this.camion = { x: this.lienzo.width / 2, vx: 0, y: this.lienzo.height - 150 };
    this.items = [];                 // lo que baja: contenedores y coches
    this.avance = 0;                 // metros de calle recorridos (px)
    this._siguienteCont = 120;       // avance al que sale el próximo contenedor
    this._siguienteCoche = K.cochesCadaSegundos;
    this.golpe = 0;                  // aturdido tras un choque (segundos)
    this.marcas = [];                // ✓/✗ flotando
    this.jornada = K.jornadaSegundos;
    this.preludio = K.preludioSegundos;
    this.aciertos = 0; this.fallos = 0; this.choques = 0;
    this.reloj = 0;
    this.fin = null;

    this.fondo.hidden = false;
    this._ultimo = performance.now();
    const paso = (ahora) => {
      if(this.fondo.hidden) return;
      const dt = Math.min((ahora - this._ultimo) / 1000, 0.1);
      this._ultimo = ahora;
      this.tick(dt);
      this.dibujar();
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  /* ---------------- jugar ---------------- */

  tick(dt){
    this.reloj += dt;
    if(this.fin){
      this.fin.t += dt;
      if(this.fin.t > 1.8) this.terminar('fin');
      return;
    }
    if(this.preludio > 0){ this.preludio -= dt; return; }

    const K = CONFIG.minijuegos.camion;
    this.jornada -= dt;
    if(this.jornada <= 0){ this.jornada = 0; this.fin = { t: 0 }; sonido.seco(); return; }

    // El volante: aturdido no se conduce, que el golpe cueste de verdad
    if(this.golpe > 0) this.golpe -= dt;
    const quiere = this.golpe > 0 ? 0
      : (this.teclas.ArrowRight || this.teclas.KeyD || this.pulsado === 'der') ? 1
      : (this.teclas.ArrowLeft || this.teclas.KeyA || this.pulsado === 'izq') ? -1 : 0;
    this.camion.vx += (quiere * K.velocidadLateral - this.camion.vx) * Math.min(1, dt * 7);
    this.camion.x = Math.max(this.viaIzq + 30,
      Math.min(this.viaDer - 30, this.camion.x + this.camion.vx * dt));

    // La calle baja; con los golpes, a medias (el camión tocado no avanza)
    const marcha = this.golpe > 0 ? 0.25 : 1;
    this.avance += K.velocidadBajada * marcha * dt;

    // SIEMBRA: contenedores por avance, coches por reloj
    if(this.porBajar.length && this.avance >= this._siguienteCont){
      const def = this.porBajar.shift();
      def.x = this.viaIzq + 40 + Math.random() * (this.viaDer - this.viaIzq - 80);
      def.y = -40;
      this.items.push(def);
      this._siguienteCont = this.avance + K.separacion * (0.75 + Math.random() * 0.5);
    }
    this._siguienteCoche -= dt;
    if(this._siguienteCoche <= 0){
      this._siguienteCoche = K.cochesCadaSegundos * (0.6 + Math.random() * 0.8);
      const x = this.viaIzq + 40 + Math.random() * (this.viaDer - this.viaIzq - 80);
      // que no nazca pegado a un contenedor recién sembrado: sería una trampa
      if(!this.items.some(o => o.y < 40 && Math.abs(o.x - x) < 70))
        this.items.push({ tipo: 'coche', x, y: -60,
                          color: COLORES_COCHE[Math.floor(Math.random() * COLORES_COCHE.length)],
                          variante: 1 + Math.floor(Math.random() * 4),
                          chocado: false });
    }

    // BAJADA y choques
    for(const o of this.items){
      o.y += (K.velocidadBajada * marcha + (o.tipo === 'coche' ? K.velocidadCocheExtra : 0)) * dt;
      if(o.resuelto || o.y < this.camion.y - 70 || o.y > this.camion.y + 60) continue;
      if(Math.abs(o.x - this.camion.x) > (o.tipo === 'coche' ? 44 : 40)) continue;
      if(o.tipo === 'cont'){
        o.resuelto = true;
        this.resolver(o);
      } else if(!o.chocado && this.golpe <= 0){
        o.chocado = true;
        this.choques++;
        this.golpe = K.aturdimientoSegundos;
        this.marcas.push({ x: o.x, y: this.camion.y - 40, bueno: false, t: 0, texto: '💥' });
        sonido.bocina(); sonido.seco();
      }
    }
    // Lo que se escapa por abajo: un lleno del día perdido baja la puntería
    for(const o of this.items){
      if(o.tipo === 'cont' && !o.resuelto && o.y > this.lienzo.height + 30){
        o.resuelto = true;
        if(o.estadoC === 'lleno' && this.hoy.some(f => f.id === o.frac.id))
          this.buenosVivos--;
      }
    }
    this.items = this.items.filter(o => o.y <= this.lienzo.height + 40 && !(o.resuelto && o.tipo === 'cont' && o.recogido));

    this.marcas = this.marcas.filter(m => (m.t += dt) < 1);

    // Sin llenos del día pendientes, la jornada se remata sola
    if(this.buenosVivos <= 0 && !this.fin){ this.fin = { t: 0.6 }; sonido.rematar(); }
  }

  resolver(cont){
    const esDelDia = this.hoy.some(f => f.id === cont.frac.id);
    const bueno = cont.estadoC === 'lleno' && esDelDia;
    cont.recogido = true;
    if(bueno){
      this.aciertos++;
      this.buenosVivos--;
      sonido.volcado();
    } else {
      this.fallos++;
      sonido.bocina();
    }
    this.marcas.push({ x: cont.x, y: this.camion.y - 46, bueno, t: 0,
                       texto: bueno ? '✓'
                            : !esDelDia ? t`hoy no toca`
                            : cont.estadoC === 'medias' ? t`a medias` : t`vacío` });
  }

  terminar(razon){
    if(this.fondo.hidden) return;
    this.fondo.hidden = true;
    this.teclas = {};
    this.pulsado = null;
    const cb = this.alTerminar;
    this.alTerminar = null;
    if(cb) cb(this.aciertos, this.total, razon);
  }

  /* ---------------- dibujar ---------------- */

  dibujar(){
    const ctx = this.ctx, W = this.lienzo.width, H = this.lienzo.height;
    ctx.clearRect(0, 0, W, H);

    this.dibujarCalle(ctx, W, H);

    // lo que baja, de arriba a abajo para que lo cercano pise a lo lejano
    const orden = this.items.slice().sort((a, b) => a.y - b.y);
    for(const o of orden){
      if(o.tipo === 'cont' && !o.recogido) this.dibujarContenedor(ctx, o);
      else if(o.tipo === 'coche') this.dibujarCoche(ctx, o);
    }

    this.dibujarCamion(ctx);

    for(const m of this.marcas){
      ctx.globalAlpha = 1 - m.t;
      ctx.font = '700 17px "IBM Plex Mono", monospace';
      ctx.fillStyle = m.bueno ? '#2dd48f' : '#f05a4a';
      ctx.textAlign = 'center';
      ctx.fillText(m.texto, m.x, m.y - m.t * 34);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // marcador: jornada, puntería y lo que queda del día
    ctx.font = '600 15px "IBM Plex Mono", monospace';
    ctx.fillStyle = this.jornada < 10 ? '#f05a4a' : '#c6d4e0';
    ctx.fillText('⏱ ' + Math.ceil(this.jornada) + ' s', 22, 34);
    ctx.fillStyle = '#2dd48f';
    ctx.fillText('✓ ' + this.aciertos, 130, 34);
    ctx.fillStyle = '#f05a4a';
    ctx.fillText('✗ ' + (this.fallos + this.choques), 205, 34);
    ctx.fillStyle = '#c6d4e0';
    ctx.textAlign = 'right';
    ctx.fillText(t`quedan ${this.buenosVivos}`, W - 22, 34);
    ctx.textAlign = 'left';
    this.hoy.forEach((f, i) => this.chip(ctx, f, W / 2 - (this.hoy.length === 2 ? 70 : 16) + i * 100, 18));

    this.dibujarBotones(ctx, W, H);

    if(this.preludio > 0 && !this.fin) this.dibujarPreludio(ctx, W, H);

    if(this.fin){
      ctx.fillStyle = 'rgba(6,12,18,0.75)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#eef6fb';
      ctx.font = '700 30px "IBM Plex Mono", monospace';
      ctx.fillText(t`FIN DE LA JORNADA`, W / 2, H / 2 - 22);
      ctx.font = '600 19px "IBM Plex Mono", monospace';
      ctx.fillStyle = this.aciertos / Math.max(1, this.total) > 0.7 ? '#2dd48f' : '#f0a04a';
      ctx.fillText(t`${this.aciertos} de ${this.total} contenedores recogidos`, W / 2, H / 2 + 16);
      if(this.fallos + this.choques > 0){
        ctx.fillStyle = '#8aa0b4';
        ctx.font = '600 14px "IBM Plex Mono", monospace';
        ctx.fillText(t`${this.fallos} recogidas en balde · ${this.choques} golpes`, W / 2, H / 2 + 44);
      }
      ctx.textAlign = 'left';
    }
  }

  /** El telón de antes de arrancar: la ruta del día, en grande. */
  dibujarPreludio(ctx, W, H){
    ctx.fillStyle = 'rgba(6,12,18,0.84)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0a04a';
    ctx.font = '700 26px "IBM Plex Mono", monospace';
    ctx.fillText(t`LA RUTA DEL DÍA`, W / 2, 78);
    ctx.fillStyle = '#dfe9f1';
    ctx.font = '600 15px "IBM Plex Mono", monospace';
    ctx.fillText(t`Solo se recogen los contenedores LLENOS de:`, W / 2, 116);
    this.hoy.forEach((f, i) =>
      this.chip(ctx, f, W / 2 - (this.hoy.length === 2 ? 110 : 55) + i * 120, 134, 1.25));
    ctx.textAlign = 'center';   // la placa lo deja a la izquierda
    ctx.font = '600 15px "IBM Plex Mono", monospace';
    let y = 196;
    if(this.hoy.length === 2){
      ctx.fillStyle = '#9fd4ae';
      ctx.fillText(t`Camión de DOBLE COMPARTIMENTO: dos fracciones`, W / 2, y);
      ctx.fillText(t`en una sola ruta, sin mezclarse. Así se sirve`, W / 2, y + 22);
      ctx.fillText(t`a los pueblos pequeños sin doblar viajes.`, W / 2, y + 44);
      y += 76;
    }
    ctx.fillStyle = '#dfe9f1';
    ctx.fillText(t`Recoge pasando por encima. Esquiva los vacíos, los de`, W / 2, y);
    ctx.fillText(t`otra fracción... y el tráfico: un golpe te deja clavado.`, W / 2, y + 24);
    ctx.fillStyle = '#8aa0b4';
    ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.fillText(t`flechas o botones ◀ ▶ · toca para salir ya — arrancas en ${Math.ceil(this.preludio)} s`,
                 W / 2, y + 64);
    ctx.textAlign = 'left';
  }

  /** La placa de una fracción: su color y su nombre. */
  chip(ctx, frac, x, y, esc = 1){
    const w = 92 * esc, h = 22 * esc;
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 6); ctx.fill();
    ctx.fillStyle = frac.color;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
    ctx.fillStyle = frac.id === 'envases' ? '#141d26' : '#f4f8fb';
    ctx.font = `700 ${Math.round(11 * esc)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(rotulo(frac.id), x + w / 2, y + h * 0.7);
    ctx.textAlign = 'left';
  }

  /** La calle desde arriba, de madrugada: calzada, aceras y tejados. */
  dibujarCalle(ctx, W, H){
    const vi = this.viaIzq, vd = this.viaDer;
    // los TEJADOS de los lados: el pueblo dormido visto desde arriba
    ctx.fillStyle = '#131e2a';
    ctx.fillRect(0, 0, vi - 26, H);
    ctx.fillRect(vd + 26, 0, W - vd - 26, H);
    // OJO al sentido: todo el decorado tiene que BAJAR con el mundo (screen
    // y = avance − posición fija). La primera versión lo subía y el camión
    // parecía ir marcha atrás — lo cazó el autor a la primera.
    const casa = (x0, ancho) => {
      for(let j = Math.floor((this.avance - H) / 130) - 1; j < this.avance / 130 + 1; j++){
        const yy = this.avance - j * 130;
        if(yy < -140 || yy > H + 20) continue;
        ctx.fillStyle = (j % 2) ? '#182534' : '#152130';
        ctx.fillRect(x0, yy, ancho, 116);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x0 + ancho / 2, yy + 4); ctx.lineTo(x0 + ancho / 2, yy + 112);
        ctx.stroke();
        if(((j % 4) + 4) % 4 === 0){
          ctx.fillStyle = 'rgba(240,200,90,0.5)';
          ctx.fillRect(x0 + 12 + (((j * 29) % (ancho - 40)) + ancho - 40) % (ancho - 40), yy + 24, 12, 12);
        }
      }
    };
    casa(6, vi - 40);
    casa(vd + 34, W - vd - 40);
    // ACERAS con sus farolas (el charco de luz, que es lo que se ve de noche)
    ctx.fillStyle = '#26313d';
    ctx.fillRect(vi - 26, 0, 26, H);
    ctx.fillRect(vd, 0, 26, H);
    for(let j = Math.floor((this.avance - H) / 200) - 1; j < this.avance / 200 + 1; j++){
      const y = this.avance - j * 200;
      if(y < -70 || y > H + 70) continue;
      for(const lx of [vi - 13, vd + 13]){
        const luz = ctx.createRadialGradient(lx, y, 2, lx, y, 60);
        luz.addColorStop(0, 'rgba(240,200,90,0.30)');
        luz.addColorStop(1, 'rgba(240,200,90,0)');
        ctx.fillStyle = luz;
        ctx.beginPath(); ctx.arc(lx, y, 60, 0, 7); ctx.fill();
        ctx.fillStyle = '#f0c85a';
        ctx.beginPath(); ctx.arc(lx, y, 3.5, 0, 7); ctx.fill();
      }
    }
    // la CALZADA con su raya discontinua bajando
    ctx.fillStyle = '#1a232e';
    ctx.fillRect(vi, 0, vd - vi, H);
    ctx.fillStyle = 'rgba(230,235,240,0.22)';
    for(let y = (this.avance % 64) - 64; y < H; y += 64)
      ctx.fillRect(W / 2 - 3, y, 6, 30);
    ctx.strokeStyle = 'rgba(230,235,240,0.18)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(vi + 2, 0); ctx.lineTo(vi + 2, H);
    ctx.moveTo(vd - 2, 0); ctx.lineTo(vd - 2, H);
    ctx.stroke();
  }

  /**
   * Un contenedor visto desde ARRIBA: la tapa de su color con el asa. El
   * estado se lee de un vistazo — lleno, bolsas encima; a medias, la tapa
   * entreabierta con su rendija; vacío, tapa lisa y cerrada.
   */
  dibujarContenedor(ctx, c){
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(3, 4, 22, 20, 0, 0, 7); ctx.fill();
    const spr = SPRITES['cont_' + c.frac.id];
    if(spr && spr.naturalWidth > 0){
      // la lámina del autor, encajada en la caja del contenedor (~44px)
      const alto = 44, ancho = alto * (spr.naturalWidth / spr.naturalHeight);
      ctx.drawImage(spr, -ancho / 2, -22, ancho, alto);
    } else {
      // el cuerpo (el canto que asoma) y la tapa
      ctx.fillStyle = '#141d26';
      ctx.beginPath(); ctx.roundRect(-21, -21, 42, 42, 7); ctx.fill();
      ctx.fillStyle = this.oscurecerColor(c.frac.color, 0.62);
      ctx.beginPath(); ctx.roundRect(-18, -18, 36, 36, 5); ctx.fill();
      ctx.fillStyle = c.frac.color;
      ctx.beginPath(); ctx.roundRect(-16, -16, 32, 30, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-13, -13, 26, 5);
    }
    if(c.estadoC === 'lleno'){
      // las bolsas encima: esto ES "lleno", visible desde un tejado
      ctx.fillStyle = '#141d26';
      ctx.beginPath();
      ctx.arc(-6, -4, 8, 0, 7); ctx.arc(5, 1, 9, 0, 7); ctx.arc(2, -9, 6.5, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#5b6a79';
      ctx.beginPath();
      ctx.arc(-6, -4, 5.5, 0, 7); ctx.arc(5, 1, 6.5, 0, 7); ctx.arc(2, -9, 4.2, 0, 7);
      ctx.fill();
    } else if(c.estadoC === 'medias'){
      // la rendija: tapa entreabierta, se ve lo oscuro de dentro
      ctx.fillStyle = '#0c151d';
      ctx.beginPath(); ctx.roundRect(-13, 2, 26, 8, 3); ctx.fill();
    } else if(!(spr && spr.naturalWidth > 0)){
      // vacío: tapa lisa, solo el asa (la lámina ya trae la suya)
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.roundRect(-9, -3, 18, 6, 3); ctx.fill();
    }
    ctx.restore();
  }

  /** Un coche de madrugada, de frente hacia abajo, con sus faros por delante. */
  dibujarCoche(ctx, o){
    ctx.save();
    ctx.translate(o.x, o.y);
    // los faros barren por delante (hacia abajo: viene de cara)
    const luz = ctx.createLinearGradient(0, 0, 0, 86);
    luz.addColorStop(0, 'rgba(240,230,170,0.28)');
    luz.addColorStop(1, 'rgba(240,230,170,0)');
    ctx.fillStyle = luz;
    ctx.beginPath();
    ctx.moveTo(-12, 20); ctx.lineTo(-24, 96); ctx.lineTo(24, 96); ctx.lineTo(12, 20);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(3, 4, 20, 28, 0, 0, 7); ctx.fill();
    const spr = SPRITES['coche' + (o.variante || 1)];
    if(spr && spr.naturalWidth > 0){
      const alto = 62, ancho = alto * (spr.naturalWidth / spr.naturalHeight);
      ctx.drawImage(spr, -ancho / 2, -31, ancho, alto);
      ctx.restore();
      return;
    }
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(-17, -29, 34, 58, 9); ctx.fill();
    ctx.fillStyle = o.color;
    ctx.beginPath(); ctx.roundRect(-14, -26, 28, 52, 7); ctx.fill();
    // parabrisas (delante, abajo) y luneta
    ctx.fillStyle = '#1c2b3d';
    ctx.beginPath(); ctx.roundRect(-11, 4, 22, 12, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-11, -20, 22, 9, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-11, -6, 22, 4);
    // faros
    ctx.fillStyle = '#f4e8b0';
    ctx.fillRect(-12, 22, 7, 4);
    ctx.fillRect(5, 22, 7, 4);
    ctx.restore();
  }

  /**
   * El camión desde ARRIBA: cabina mirando hacia arriba (tú conduces calle
   * adelante) y la caja pintada con las fracciones del día — el doble
   * compartimento son dos tapas, con su nervio en medio.
   */
  dibujarCamion(ctx){
    const golpeado = this.golpe > 0 && Math.floor(this.reloj * 10) % 2 === 0;
    ctx.save();
    ctx.translate(this.camion.x, this.camion.y);
    if(this.golpe > 0) ctx.rotate(Math.sin(this.reloj * 30) * 0.03);
    // faros del camión, barriendo hacia arriba
    const luz = ctx.createLinearGradient(0, -46, 0, -150);
    luz.addColorStop(0, 'rgba(240,230,170,0.25)');
    luz.addColorStop(1, 'rgba(240,230,170,0)');
    ctx.fillStyle = luz;
    ctx.beginPath();
    ctx.moveTo(-16, -44); ctx.lineTo(-30, -150); ctx.lineTo(30, -150); ctx.lineTo(16, -44);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(4, 6, 28, 48, 0, 0, 7); ctx.fill();
    ctx.lineJoin = 'round';
    const nHoy = this.hoy.length;
    if(conSprite('camion')){
      // La lámina del autor pone la carrocería; las TAPAS del día las pinta
      // el juego encima igualmente — son mecánica, no chapa.
      const spr = SPRITES.camion;
      const alto = 100, ancho = alto * (spr.naturalWidth / spr.naturalHeight);
      ctx.drawImage(spr, -ancho / 2, -50, ancho, alto);
      this.hoy.forEach((f, i) => {
        ctx.fillStyle = golpeado ? '#8a4444' : this.oscurecerColor(f.color, 0.85);
        const alto2 = 52 / nHoy;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.roundRect(-17, -8 + i * (alto2 + 2), 34, alto2 - 2, 4); ctx.fill();
        ctx.globalAlpha = 1;
      });
      if(golpeado){
        ctx.fillStyle = 'rgba(240,90,74,0.35)';
        ctx.beginPath(); ctx.roundRect(-25, -50, 50, 100, 8); ctx.fill();
      }
      ctx.fillStyle = (Math.floor(this.reloj * 4) % 2) ? '#f0a04a' : '#c97b2e';
      ctx.beginPath(); ctx.arc(0, -38, 4.5, 0, 7); ctx.fill();
      ctx.restore();
      return;
    }
    // el chasis
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(-25, -48, 50, 96, 8); ctx.fill();
    // LA CABINA (arriba): techo con su rotativo ámbar
    ctx.fillStyle = golpeado ? '#f05a4a' : '#c8d3dd';
    ctx.beginPath(); ctx.roundRect(-21, -44, 42, 26, 5); ctx.fill();
    ctx.fillStyle = '#1c2b3d';
    ctx.beginPath(); ctx.roundRect(-17, -26, 34, 7, 3); ctx.fill();
    ctx.fillStyle = (Math.floor(this.reloj * 4) % 2) ? '#f0a04a' : '#c97b2e';
    ctx.beginPath(); ctx.arc(0, -36, 4.5, 0, 7); ctx.fill();
    // LA CAJA: las tapas del día — una, o dos con su nervio
    this.hoy.forEach((f, i) => {
      ctx.fillStyle = golpeado ? '#8a4444' : this.oscurecerColor(f.color, 0.85);
      const alto = 58 / nHoy;
      ctx.beginPath();
      ctx.roundRect(-20, -14 + i * (alto + 2), 40, alto - 2, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-17, -12 + i * (alto + 2), 34, 4);
    });
    if(nHoy === 2){
      ctx.fillStyle = '#141d26';
      ctx.fillRect(-20, -14 + 58 / 2 - 1, 40, 4);
    }
    // la tolva trasera
    ctx.fillStyle = '#31404d';
    ctx.beginPath(); ctx.roundRect(-18, 40, 36, 8, 3); ctx.fill();
    ctx.restore();
  }

  /** Los dos botonazos del dedo. En teclado también valen las flechas. */
  dibujarBotones(ctx, W, H){
    const y = H - 84;
    const boton = (x, w, txt, activo) => {
      ctx.fillStyle = activo ? 'rgba(56,189,248,0.28)' : 'rgba(20,29,38,0.72)';
      ctx.beginPath(); ctx.roundRect(x, y, w, 64, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(198,212,224,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y, w, 64, 12); ctx.stroke();
      ctx.fillStyle = '#dfe9f1';
      ctx.font = '700 30px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(txt, x + w / 2, y + 42);
      ctx.textAlign = 'left';
    };
    const izq = this.teclas.ArrowLeft || this.teclas.KeyA || this.pulsado === 'izq';
    const der = this.teclas.ArrowRight || this.teclas.KeyD || this.pulsado === 'der';
    boton(16, W * 0.34, '◀', izq);
    boton(W * 0.66 - 16, W * 0.34, '▶', der);
  }

  oscurecerColor(hex, f){
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.round(v * f);
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }
}
