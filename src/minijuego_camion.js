/**
 * MINIJUEGO: LA RUTA DEL CAMIÓN — la recogida vista desde la calle.
 *
 * Es la recogida de verdad, la de madrugada: el camión avanza por una calle
 * de pueblo sembrada de contenedores y el jugador decide DÓNDE PARAR. Solo
 * puntúan los contenedores LLENOS y de las fracciones del día; pararse en
 * uno a medias, vacío o de otra fracción gasta jornada en balde. La calle no
 * se recorre dos veces (la marcha atrás existe, con su pitido, pero cuesta).
 *
 * La lección es la de la casa del autor (Mancomunidad de Montejurra): en los
 * pueblos pequeños la recogida es TRASERA, con camiones de DOBLE
 * COMPARTIMENTO que levantan dos fracciones en una sola ruta sin mezclarlas.
 * Por eso hay jornadas de una fracción y jornadas dobles, y el camión sale
 * pintado con los colores de lo que toca.
 *
 * Mandos: flechas (o A/D) para avanzar y retroceder; en pantalla, dos
 * botonazos ◀ ▶ para el dedo. Pararse junto a un contenedor lo iza solo:
 * la decisión es dónde te detienes, no apuntar fino.
 *
 * Módulo autocontenido, como sus dos hermanos: no toca el estado, devuelve
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

export class MinijuegoCamion {

  constructor(){
    this.fondo = document.getElementById('minijuego3');
    this.lienzo = document.getElementById('mini3-lienzo');
    this.ctx = this.lienzo.getContext('2d');
    this.alTerminar = null;

    // El TELÓN del amanecer (assets/mini_camion.jpg, del autor): el cielo y
    // los tejados del pueblo. Si existe manda — en mosaico con paralaje — y
    // si no, el caserío de código. La calzada, las farolas y todo lo jugable
    // siguen siendo SIEMPRE de código: cambian con la partida.
    this.cieloImg = new Image();
    this.hayCielo = false;
    this.cieloImg.onload = () => { this.hayCielo = true; };
    this.cieloImg.src = 'assets/mini_camion.jpg';

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
    this.pulsado = null;             // 'avante' | 'atras' | null
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
    if(x < this.lienzo.width * 0.38) return 'atras';
    if(x > this.lienzo.width * 0.62) return 'avante';
    return null;
  }

  jugar(alTerminar){
    const K = CONFIG.minijuegos.camion;
    this.alTerminar = alTerminar;
    this.lienzo.width = 640;
    this.lienzo.height = 460;

    // LA JORNADA DEL DÍA: una fracción, o dos si toca camión bicompartimentado
    const barajadas = FRACCIONES.slice().sort(() => Math.random() - 0.5);
    this.hoy = barajadas.slice(0, Math.random() < K.probDoble ? 2 : 1);

    // LA CALLE: contenedores repartidos, cada uno con su fracción y su estado.
    // Se garantiza un mínimo de llenos del día: una jornada sin nada que
    // recoger no es difícil, es una estafa (la regla de los hermanos).
    this.sep = 118;
    this.margen = 260;
    this.contenedores = [];
    for(let i = 0; i < K.contenedores; i++){
      const frac = FRACCIONES[Math.floor(Math.random() * FRACCIONES.length)];
      const azar = Math.random();
      const estadoC = azar < K.probLleno ? 'lleno' : azar < K.probLleno + 0.25 ? 'medias' : 'vacio';
      this.contenedores.push({ frac, estadoC, hecho: false,
                               x: this.margen + i * this.sep + (Math.random() * 26 - 13) });
    }
    const delDia = () => this.contenedores.filter(
      c => c.estadoC === 'lleno' && this.hoy.some(f => f.id === c.frac.id));
    let vueltas = 0;
    while(delDia().length < 4 && vueltas++ < 40){
      const c = this.contenedores[Math.floor(Math.random() * this.contenedores.length)];
      c.frac = this.hoy[Math.floor(Math.random() * this.hoy.length)];
      c.estadoC = 'lleno';
    }
    this.total = delDia().length;
    this.mundo = this.margen + K.contenedores * this.sep + 300;

    this.camion = { x: 60, vx: 0 };
    this.vaciando = null;            // { cont, t } mientras el volquete iza
    this.marcas = [];                // ✓/✗ flotando sobre el contenedor
    this.jornada = K.jornadaSegundos;
    this.preludio = K.preludioSegundos;
    this.aciertos = 0; this.fallos = 0;
    this.reloj = 0; this._retro = 0;
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

    // El volquete: mientras iza, el camión está clavado
    if(this.vaciando){
      this.vaciando.t += dt;
      if(this.vaciando.t >= K.segundosVaciado){
        this.resolver(this.vaciando.cont);
        this.vaciando = null;
      }
      return;
    }

    // Conducción: acelera hacia lo pedido, con la marcha atrás más corta
    const quiere = (this.teclas.ArrowRight || this.teclas.KeyD || this.pulsado === 'avante') ? 1
                 : (this.teclas.ArrowLeft || this.teclas.KeyA || this.pulsado === 'atras') ? -1 : 0;
    const tope = quiere > 0 ? K.velocidad : quiere < 0 ? -K.velocidadAtras : 0;
    this.camion.vx += (tope - this.camion.vx) * Math.min(1, dt * 4.5);
    if(quiere === 0 && Math.abs(this.camion.vx) < 6) this.camion.vx = 0;
    this.camion.x = Math.max(40, Math.min(this.mundo - 40, this.camion.x + this.camion.vx * dt));

    // El pitido reglamentario de la marcha atrás
    if(this.camion.vx < -20 && (this._retro += dt) > 0.55){ this._retro = 0; sonido.retro(); }

    // Fin de calle: el vertedero. Llegar con la ruta hecha ES rematarla.
    if(this.camion.x >= this.mundo - 60){ this.fin = { t: 0 }; sonido.rematar(); return; }

    // Parado y alineado con un contenedor pendiente: la cuadrilla lo iza.
    // La decisión ya está tomada — dónde has parado — y el resto es oficio.
    if(this.camion.vx === 0){
      const cont = this.contenedores.find(c => !c.hecho && Math.abs(c.x - this.traseraX()) < 30);
      if(cont){ this.vaciando = { cont, t: 0 }; sonido.tramo(); }
    }

    this.marcas = this.marcas.filter(m => (m.t += dt) < 1);
  }

  /** Dónde carga el camión: la trasera, que es donde se vuelcan los cubos. */
  traseraX(){ return this.camion.x - 128; }

  resolver(cont){
    cont.hecho = true;
    const esDelDia = this.hoy.some(f => f.id === cont.frac.id);
    const bueno = cont.estadoC === 'lleno' && esDelDia;
    if(bueno){
      this.aciertos++;
      cont.estadoC = 'vacio';
      sonido.compra();
    } else {
      this.fallos++;
      sonido.bocina();
    }
    this.marcas.push({ x: cont.x, bueno, t: 0,
                       texto: bueno ? '✓'
                            : !esDelDia ? t`hoy no toca`
                            : cont.estadoC === 'medias' ? t`a medias` : t`vacío` });
    // Si ya no queda nada del día por recoger, la jornada se remata sola
    if(!this.contenedores.some(c => !c.hecho && c.estadoC === 'lleno'
                                    && this.hoy.some(f => f.id === c.frac.id)))
      this.fin = { t: 0.6 };
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
    const cam = Math.max(0, Math.min(this.mundo - W, this.camion.x - W * 0.55));
    ctx.clearRect(0, 0, W, H);

    this.dibujarCalle(ctx, W, H, cam);

    // contenedores (los hechos se quedan, apagados)
    for(const c of this.contenedores){
      const x = c.x - cam;
      if(x < -60 || x > W + 60) continue;
      this.dibujarContenedor(ctx, c, x, 330);
    }

    this.dibujarCamion(ctx, this.camion.x - cam, 330);

    // ✓/✗ flotando
    for(const m of this.marcas){
      ctx.globalAlpha = 1 - m.t;
      ctx.font = '700 17px "IBM Plex Mono", monospace';
      ctx.fillStyle = m.bueno ? '#2dd48f' : '#f05a4a';
      ctx.textAlign = 'center';
      ctx.fillText(m.texto, m.x - cam, 232 - m.t * 34);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // marcador: jornada, aciertos, lo que queda del día
    const quedan = this.contenedores.filter(c => !c.hecho && c.estadoC === 'lleno'
      && this.hoy.some(f => f.id === c.frac.id)).length;
    ctx.font = '600 15px "IBM Plex Mono", monospace';
    ctx.fillStyle = this.jornada < 10 ? '#f05a4a' : '#c6d4e0';
    ctx.fillText('⏱ ' + Math.ceil(this.jornada) + ' s', 22, 34);
    ctx.fillStyle = '#2dd48f';
    ctx.fillText('✓ ' + this.aciertos, 130, 34);
    ctx.fillStyle = '#f05a4a';
    ctx.fillText('✗ ' + this.fallos, 205, 34);
    ctx.fillStyle = '#c6d4e0';
    ctx.textAlign = 'right';
    ctx.fillText(t`quedan ${quedan}`, W - 22, 34);
    ctx.textAlign = 'left';
    // la ruta del día, siempre a la vista en su placa (corrida a la derecha
    // del marcador: encima del contador de fallos no se leía ninguno de los dos)
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
      if(this.fallos > 0){
        ctx.fillStyle = '#8aa0b4';
        ctx.font = '600 14px "IBM Plex Mono", monospace';
        ctx.fillText(t`${this.fallos} paradas en balde`, W / 2, H / 2 + 44);
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
    ctx.fillText(t`Párate junto a un contenedor y la cuadrilla lo iza.`, W / 2, y);
    ctx.fillText(t`Pararse donde no toca gasta jornada — y el reloj manda.`, W / 2, y + 24);
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

  /** La calle de madrugada: cielo, caserío dormido, farolas y calzada. */
  dibujarCalle(ctx, W, H, cam){
    if(this.hayCielo){
      // La lámina del autor, en mosaico y con paralaje suave: el fondo anda
      // más despacio que la calle, como los tejados de verdad. El velo la
      // hunde un punto para que lo jugable mande.
      const esc = 300 / this.cieloImg.height;
      const w = this.cieloImg.width * esc;
      for(let x = -((cam * 0.3) % w); x < W; x += w)
        ctx.drawImage(this.cieloImg, x, 0, w, 300);
      ctx.fillStyle = 'rgba(8,14,22,0.35)';
      ctx.fillRect(0, 0, W, 300);
    } else {
      // cielo de antes del amanecer
      const g = ctx.createLinearGradient(0, 0, 0, 300);
      g.addColorStop(0, '#0b1420'); g.addColorStop(1, '#1c2b3d');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 300);
      // luna y estrellas fijas al cielo (no viajan con la cámara)
      ctx.fillStyle = 'rgba(255,255,240,0.9)';
      ctx.beginPath(); ctx.arc(W - 90, 64, 16, 0, 7); ctx.fill();
      ctx.fillStyle = '#16222e';
      ctx.beginPath(); ctx.arc(W - 84, 58, 13, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for(let i = 0; i < 22; i++){
        const sx = (i * 137.5) % W, sy = 20 + (i * 73) % 180;
        ctx.fillRect(sx, sy, 2, 2);
      }
      // el caserío del fondo, con alguna ventana madrugadora encendida
      for(let i = Math.floor(cam / 150) - 1; i < (cam + W) / 150 + 1; i++){
        const x = i * 150 - cam;
        const alto = 90 + ((i * 37) % 60);
        ctx.fillStyle = '#131e2a';
        ctx.fillRect(x, 300 - alto, 132, alto);
        ctx.fillStyle = '#0d151f';
        ctx.beginPath();
        ctx.moveTo(x - 6, 300 - alto); ctx.lineTo(x + 66, 300 - alto - 26);
        ctx.lineTo(x + 138, 300 - alto); ctx.fill();
        if((i * 7) % 3 === 0){
          ctx.fillStyle = 'rgba(240,200,90,0.75)';
          ctx.fillRect(x + 18 + (i * 11) % 60, 300 - alto + 18, 14, 18);
        }
      }
    }
    // acera y calzada
    ctx.fillStyle = '#26313d';
    ctx.fillRect(0, 300, W, 46);
    ctx.fillStyle = '#141d26';
    ctx.fillRect(0, 344, W, 4);
    ctx.fillStyle = '#1a232e';
    ctx.fillRect(0, 348, W, H - 348);
    // la raya discontinua de la calzada, viajando con el mundo
    ctx.fillStyle = 'rgba(230,235,240,0.25)';
    for(let x = -((cam) % 70); x < W; x += 70) ctx.fillRect(x, 396, 34, 5);
    // farolas cada tanto, con su charco de luz
    for(let i = Math.floor(cam / 236); i < (cam + W) / 236 + 1; i++){
      const x = i * 236 - cam + 40;
      ctx.fillStyle = '#0d151f';
      ctx.fillRect(x - 3, 210, 6, 122);
      ctx.fillRect(x - 3, 210, 24, 5);
      ctx.fillStyle = 'rgba(240,200,90,0.9)';
      ctx.beginPath(); ctx.arc(x + 21, 218, 5, 0, 7); ctx.fill();
      const luz = ctx.createRadialGradient(x + 21, 220, 4, x + 21, 300, 110);
      luz.addColorStop(0, 'rgba(240,200,90,0.16)');
      luz.addColorStop(1, 'rgba(240,200,90,0)');
      ctx.fillStyle = luz;
      ctx.fillRect(x - 90, 214, 220, 132);
    }
    // el VERTEDERO al final de la calle: la portada con su cartel
    const fx = this.mundo - 46 - cam;
    if(fx < W + 80){
      ctx.fillStyle = '#141d26';
      ctx.fillRect(fx - 8, 210, 12, 136);
      ctx.fillRect(fx + 66, 210, 12, 136);
      ctx.fillStyle = '#31404d';
      ctx.fillRect(fx - 12, 196, 94, 26);
      ctx.fillStyle = '#facc15';
      ctx.font = '700 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t`VERTEDERO`, fx + 35, 213);
      ctx.textAlign = 'left';
    }
  }

  /**
   * Un contenedor de calle en pequeño, con su ESTADO legible de un vistazo:
   * lleno = tapa levantada con bolsas asomando; a medias = tapa entreabierta;
   * vacío = cerrado. El color es la fracción — la información ES el dibujo.
   */
  dibujarContenedor(ctx, c, x, sueloY){
    ctx.save();
    ctx.translate(x, sueloY);
    if(c.hecho) ctx.globalAlpha = 0.45;
    // izándose: se inclina hacia la trasera del camión
    if(this.vaciando && this.vaciando.cont === c){
      const f = this.vaciando.t / CONFIG.minijuegos.camion.segundosVaciado;
      ctx.translate(0, -Math.sin(f * Math.PI) * 34);
      ctx.rotate(-Math.sin(f * Math.PI) * 0.9);
    }
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 2, 24, 5, 0, 0, 7); ctx.fill();
    // ruedas
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.arc(-13, -2, 5, 0, 7); ctx.arc(13, -2, 5, 0, 7); ctx.fill();
    // cuerpo
    const alto = 40, w = 42;
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(-w / 2 - 3, -alto - 8, w + 6, alto + 6, 4); ctx.fill();
    ctx.fillStyle = c.frac.color;
    ctx.beginPath(); ctx.roundRect(-w / 2, -alto - 5, w, alto, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(w * 0.12, -alto - 5, w * 0.38, alto);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-w / 2 + 3, -alto - 2, 5, alto - 6);
    // la tapa según el estado
    const tapa = (dy, ang) => {
      ctx.save();
      ctx.translate(-w / 2 - 2, -alto - 5 + dy);
      ctx.rotate(ang);
      ctx.fillStyle = '#141d26';
      ctx.beginPath(); ctx.roundRect(-2, -9, w + 8, 9, 3); ctx.fill();
      ctx.fillStyle = this.oscurecerColor(c.frac.color, 0.7);
      ctx.beginPath(); ctx.roundRect(0, -7, w + 4, 6, 2); ctx.fill();
      ctx.restore();
    };
    if(c.estadoC === 'lleno' && !c.hecho){
      // las bolsas asomando: esto ES "lleno", visible desde la otra acera
      ctx.fillStyle = '#141d26';
      ctx.beginPath();
      ctx.arc(-9, -alto - 9, 9, 0, 7); ctx.arc(4, -alto - 13, 10, 0, 7);
      ctx.arc(14, -alto - 7, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#5b6a79';
      ctx.beginPath();
      ctx.arc(-9, -alto - 9, 6.5, 0, 7); ctx.arc(4, -alto - 13, 7.5, 0, 7);
      ctx.arc(14, -alto - 7, 4.8, 0, 7); ctx.fill();
      tapa(-13, -0.5);
    } else if(c.estadoC === 'medias' && !c.hecho){
      tapa(-3, -0.16);
    } else {
      tapa(0, 0);
    }
    ctx.restore();
  }

  /**
   * El camión de recogida TRASERA, de perfil y andando hacia el vertedero:
   * cabina a la derecha, caja detrás con la tolva. La caja va pintada con
   * las fracciones del día — el doble compartimento se VE: dos paneles.
   */
  dibujarCamion(ctx, x, sueloY){
    const balanceo = Math.abs(this.camion.vx) > 5 ? Math.sin(this.reloj * 18) * 1.2 : 0;
    ctx.save();
    ctx.translate(x, sueloY + 6 + balanceo);
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(-58, 26, 92, 9, 0, 0, 7); ctx.fill();

    // ruedas (traseras dobles, como los de verdad)
    for(const [wx, r] of [[-104, 15], [-84, 15], [10, 15]]){
      ctx.fillStyle = '#141d26';
      ctx.beginPath(); ctx.arc(wx, 12, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a4a58';
      ctx.beginPath(); ctx.arc(wx, 12, r * 0.55, 0, 7); ctx.fill();
      ctx.fillStyle = '#8ea3b6';
      ctx.beginPath(); ctx.arc(wx - 2, 10, 2.6, 0, 7); ctx.fill();
    }
    // chasis
    ctx.fillStyle = '#141d26';
    ctx.fillRect(-132, 0, 170, 8);

    // LA CAJA con la tolva trasera. Pintada del día: uno o dos paneles.
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(-136, -66, 122, 66, 6); ctx.fill();
    const nHoy = this.hoy.length;
    this.hoy.forEach((f, i) => {
      ctx.fillStyle = this.oscurecerColor(f.color, 0.85);
      const w = 112 / nHoy;
      ctx.beginPath();
      ctx.roundRect(-131 + i * (w + 2), -61, w - 2, 56, 4); ctx.fill();
    });
    // la separación del doble compartimento, con su nervio
    if(nHoy === 2){
      ctx.fillStyle = '#141d26';
      ctx.fillRect(-77, -61, 4, 56);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-131, -58, 112, 7);
    // la TOLVA trasera (por donde entran los cubos)
    ctx.fillStyle = '#141d26';
    ctx.beginPath();
    ctx.moveTo(-136, -40); ctx.lineTo(-152, -26); ctx.lineTo(-152, 2);
    ctx.lineTo(-136, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#31404d';
    ctx.beginPath();
    ctx.moveTo(-138, -34); ctx.lineTo(-148, -24); ctx.lineTo(-148, 0);
    ctx.lineTo(-138, 0); ctx.closePath(); ctx.fill();

    // LA CABINA, con su madrugador al volante
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(-12, -52, 52, 52, 6); ctx.fill();
    ctx.fillStyle = '#c8d3dd';
    ctx.beginPath(); ctx.roundRect(-8, -48, 44, 44, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(14, -48, 22, 44);
    ctx.fillStyle = '#1c2b3d';
    ctx.beginPath(); ctx.roundRect(8, -44, 26, 20, 3); ctx.fill();
    ctx.fillStyle = '#e8b06a';
    ctx.beginPath(); ctx.arc(18, -36, 5, 0, 7); ctx.fill();
    // el rotativo ámbar del techo, girando
    ctx.fillStyle = (Math.floor(this.reloj * 4) % 2) ? '#f0a04a' : '#c97b2e';
    ctx.beginPath(); ctx.roundRect(6, -58, 12, 7, 2); ctx.fill();
    // faro
    ctx.fillStyle = '#f4e8b0';
    ctx.fillRect(37, -18, 4, 8);
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
    const atras = this.teclas.ArrowLeft || this.teclas.KeyA || this.pulsado === 'atras';
    const avante = this.teclas.ArrowRight || this.teclas.KeyD || this.pulsado === 'avante';
    boton(16, W * 0.34, '◀', atras);
    boton(W * 0.66 - 16, W * 0.34, '▶', avante);
  }

  oscurecerColor(hex, f){
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.round(v * f);
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }
}
