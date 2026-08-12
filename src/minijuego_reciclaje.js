/**
 * MINIJUEGO: LA LÍNEA DE RECICLAJE.
 *
 * Eres el operario de la cinta en la planta: van llegando residuos y hay que
 * tocar el CONTENEDOR que les toca — los de verdad, con sus colores: amarillo
 * envases, azul papel, verde vidrio, marrón orgánica. Y la lección escondida:
 * el RESTO no se toca. Dejarlo seguir hasta el vertedero del final ES lo
 * correcto, porque no todo se recicla, también en la planta real.
 *
 * Controles de un dedo: tocar un contenedor resuelve el residuo que va PRIMERO
 * en la cinta (el que brilla). La cinta se anima con cada acierto.
 *
 * Módulo autocontenido, como el de tuberías: su telón, su lienzo, su reloj y
 * sus escuchas. NO toca el estado — devuelve (aciertos, total) por callback y
 * main.js decide qué significa (el bono del turno, o nada si es ensayo).
 */

import { CONFIG } from './config.js';
import * as sonido from './sonido.js';

// Los residuos que caen por la cinta. `bin` es el contenedor correcto;
// 'resto' no tiene: su sitio es el final de la cinta.
const TIPOS = [
  { id: 'envases',  bin: 'envases',  color: '#facc15' },
  { id: 'papel',    bin: 'papel',    color: '#3b82f6' },
  { id: 'vidrio',   bin: 'vidrio',   color: '#22c55e' },
  { id: 'organica', bin: 'organica', color: '#a16207' },
  { id: 'resto',    bin: null,       color: '#94a3b8' }
];
const BINES = [
  { id: 'envases',  nombre: 'ENVASES',  color: '#facc15' },
  { id: 'organica', nombre: 'ORGÁNICA', color: '#a16207' },
  { id: 'papel',    nombre: 'PAPEL',    color: '#3b82f6' },
  { id: 'vidrio',   nombre: 'VIDRIO',   color: '#22c55e' }
];

export class MinijuegoReciclaje {

  constructor(){
    this.fondo = document.getElementById('minijuego2');
    this.lienzo = document.getElementById('mini2-lienzo');
    this.ctx = this.lienzo.getContext('2d');
    this.alTerminar = null;

    this.lienzo.addEventListener('pointerdown', e => {
      const r = this.lienzo.getBoundingClientRect();
      this.clic((e.clientX - r.left) * (this.lienzo.width / r.width),
                (e.clientY - r.top) * (this.lienzo.height / r.height));
    });
    document.getElementById('mini2-cancelar').onclick = () => this.terminar('abandonado');
  }

  jugar(alTerminar){
    const K = CONFIG.minijuegos.reciclaje;
    this.alTerminar = alTerminar;
    this.lienzo.width = 640;
    this.lienzo.height = 430;

    // La geometría: cinta arriba, contenedores abajo, vertedero a la derecha
    this.cintaY = 120;
    this.binY = 250;
    this.binAncho = 130; this.binAlto = 130;

    this.velocidad = K.velocidad;
    this.porSalir = K.objetos;
    this.residuos = [];        // los que van en la cinta: { tipo, x, resuelto }
    this.vuelos = [];          // animaciones de residuo volando a su contenedor
    this.aciertos = 0; this.fallos = 0;
    this.reloj = 0;
    this.ultimoSpawn = -999;
    this.flashBin = null;      // { id, bueno, t } para pintar el acierto/fallo
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

  tipoAlAzar(){
    const K = CONFIG.minijuegos.reciclaje;
    if(Math.random() < K.probResto) return TIPOS[4];
    return TIPOS[Math.floor(Math.random() * 4)];
  }

  /* ---------------- jugar ---------------- */

  tick(dt){
    this.reloj += dt;
    if(this.fin){
      this.fin.t += dt;
      if(this.fin.t > 1.6) this.terminar('fin');
      return;
    }
    const K = CONFIG.minijuegos.reciclaje;

    // Entran residuos por la izquierda, guardando su distancia
    const ultimo = this.residuos[this.residuos.length - 1];
    if(this.porSalir > 0 && (!ultimo || ultimo.x > K.separacion - 40)){
      this.residuos.push({ tipo: this.tipoAlAzar(), x: -30 });
      this.porSalir--;
    }

    // La cinta avanza
    for(const res of this.residuos) res.x += this.velocidad * dt;

    // El que llega al final: vertedero. Para el RESTO es un acierto; para
    // cualquier otro, un fallo — había que haberlo separado.
    const borde = this.lienzo.width - 55;
    while(this.residuos.length && this.residuos[0].x >= borde){
      const res = this.residuos.shift();
      this.resolver(res, null);
    }

    // Los vuelos a contenedor avanzan y mueren solos
    this.vuelos = this.vuelos.filter(v => (v.t += dt * 3.2) < 1);
    if(this.flashBin && (this.flashBin.t += dt) > 0.5) this.flashBin = null;

    // Fin del turno: nada por salir, cinta vacía, vuelos acabados
    if(!this.porSalir && !this.residuos.length && !this.vuelos.length)
      this.fin = { t: 0 };
  }

  /** Resuelve un residuo: `binId` tocado, o null si llegó al vertedero. */
  resolver(res, binId){
    const K = CONFIG.minijuegos.reciclaje;
    const bueno = res.tipo.bin === binId;
    if(bueno) this.aciertos++; else this.fallos++;
    if(binId){
      const i = BINES.findIndex(b => b.id === binId);
      this.vuelos.push({ tipo: res.tipo, desdeX: res.x, desdeY: this.cintaY,
                         haciaX: this.binX(i) + this.binAncho / 2,
                         haciaY: this.binY + 20, t: 0 });
      this.flashBin = { id: binId, bueno, t: 0 };
      if(bueno) sonido.compra(); else sonido.seco();
    } else {
      // al vertedero por el final de la cinta
      if(bueno) sonido.tramo(); else sonido.seco();
    }
    this.velocidad *= K.aceleracion;   // la cinta se viene arriba
  }

  binX(i){
    const total = BINES.length * this.binAncho + (BINES.length - 1) * 18;
    const x0 = (this.lienzo.width - total) / 2;
    return x0 + i * (this.binAncho + 18);
  }

  clic(x, y){
    if(this.fin) return;
    if(y < this.binY || y > this.binY + this.binAlto) return;
    for(let i = 0; i < BINES.length; i++){
      const bx = this.binX(i);
      if(x >= bx && x <= bx + this.binAncho){
        // Se resuelve el residuo que va PRIMERO (el que brilla)
        const res = this.residuos.shift();
        if(res) this.resolver(res, BINES[i].id);
        return;
      }
    }
  }

  terminar(razon){
    if(this.fondo.hidden) return;
    this.fondo.hidden = true;
    const cb = this.alTerminar;
    this.alTerminar = null;
    if(cb) cb(this.aciertos, this.aciertos + this.fallos, razon);
  }

  /* ---------------- dibujar ---------------- */

  dibujar(){
    const ctx = this.ctx, W = this.lienzo.width, H = this.lienzo.height;
    ctx.clearRect(0, 0, W, H);

    // La nave de la planta: fondo y marcador
    ctx.fillStyle = '#101c28';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '600 15px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#2dd48f';
    ctx.fillText('✓ ' + this.aciertos, 22, 34);
    ctx.fillStyle = '#f05a4a';
    ctx.fillText('✗ ' + this.fallos, 100, 34);
    ctx.fillStyle = '#8aa0b4';
    ctx.fillText('quedan ' + (this.porSalir + this.residuos.length),
                 W - 165, 34);

    this.dibujarCinta(ctx, W);
    for(const res of this.residuos)
      this.dibujarResiduo(ctx, res.tipo, res.x, this.cintaY,
                          res === this.residuos[0]);
    for(const v of this.vuelos){
      const x = v.desdeX + (v.haciaX - v.desdeX) * v.t;
      const y = v.desdeY + (v.haciaY - v.desdeY) * v.t - Math.sin(v.t * Math.PI) * 55;
      this.dibujarResiduo(ctx, v.tipo, x, y, false);
    }
    BINES.forEach((bin, i) => this.dibujarBin(ctx, bin, i));

    if(this.fin){
      const total = this.aciertos + this.fallos;
      ctx.fillStyle = 'rgba(6,12,18,0.75)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#eef6fb';
      ctx.font = '700 30px "IBM Plex Mono", monospace';
      ctx.fillText('FIN DEL TURNO', W / 2, H / 2 - 22);
      ctx.font = '600 19px "IBM Plex Mono", monospace';
      ctx.fillStyle = this.aciertos / Math.max(1, total) > 0.7 ? '#2dd48f' : '#f0a04a';
      ctx.fillText(this.aciertos + ' de ' + total + ' bien separados', W / 2, H / 2 + 16);
      ctx.textAlign = 'left';
    }
  }

  /** La cinta: banda con rodillos y las rayas moviéndose con el reloj. */
  dibujarCinta(ctx, W){
    const y = this.cintaY;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, y + 16, W, 14);
    ctx.fillStyle = '#26313d';
    ctx.fillRect(0, y + 10, W, 16);
    ctx.fillStyle = '#3a4a58';
    ctx.fillRect(0, y + 12, W, 6);
    // rayas que corren: la cinta SE VE moverse
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 26]);
    ctx.lineDashOffset = -(this.reloj * this.velocidad) % 42;
    ctx.beginPath();
    ctx.moveTo(0, y + 20); ctx.lineTo(W, y + 20);
    ctx.stroke();
    ctx.setLineDash([]);
    // el vertedero del final: la boca por la que cae el resto
    ctx.fillStyle = '#141d26';
    ctx.fillRect(W - 52, y - 42, 52, 92);
    ctx.fillStyle = '#31404d';
    ctx.fillRect(W - 46, y - 36, 40, 80);
    ctx.fillStyle = '#8aa0b4';
    ctx.font = '700 9px "IBM Plex Mono", monospace';
    ctx.save();
    ctx.translate(W - 20, y + 32); ctx.rotate(-Math.PI / 2);
    ctx.fillText('VERTEDERO', 0, 0);
    ctx.restore();
  }

  /** Un residuo de tebeo: contorno gordo, color plano y su brillo. */
  dibujarResiduo(ctx, tipo, x, y, activo){
    const r = 17;
    if(activo){   // el primero de la cinta brilla: es el que se resuelve
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath(); ctx.arc(x, y - 4, r * 1.7, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + 11, r * 0.9, r * 0.35, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.arc(x, y - 4, r + 3, 0, 7); ctx.fill();
    ctx.fillStyle = tipo.color;
    ctx.beginPath(); ctx.arc(x, y - 4, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - 4 - r * 0.35, r * 0.32, 0, 7); ctx.fill();
    // la seña de cada tipo, dibujada simple encima
    ctx.fillStyle = '#141d26';
    ctx.font = '700 13px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    const letras = { envases: 'E', papel: 'P', vidrio: 'V', organica: 'O', resto: '?' };
    ctx.fillText(letras[tipo.id], x, y + 1);
    ctx.textAlign = 'left';
  }

  /** Un contenedor de calle: cuerpo, tapa, ruedas y su nombre. */
  dibujarBin(ctx, bin, i){
    const x = this.binX(i), y = this.binY;
    const w = this.binAncho, h = this.binAlto - 34;
    const flash = this.flashBin && this.flashBin.id === bin.id ? this.flashBin : null;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 5, y + h + 2, w - 6, 8);
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(x - 3, y + 7, w + 6, h - 4, 10); ctx.fill();
    ctx.fillStyle = bin.color;
    ctx.beginPath(); ctx.roundRect(x, y + 10, w, h - 10, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + 6, y + 14, w - 12, 9);
    // la tapa
    ctx.fillStyle = '#141d26';
    ctx.beginPath(); ctx.roundRect(x - 6, y - 2, w + 12, 16, 6); ctx.fill();
    ctx.fillStyle = bin.color;
    ctx.beginPath(); ctx.roundRect(x - 3, y, w + 6, 11, 5); ctx.fill();
    // ruedas
    ctx.fillStyle = '#141d26';
    for(const dx of [0.22, 0.78]){
      ctx.beginPath(); ctx.arc(x + w * dx, y + h + 6, 7, 0, 7); ctx.fill();
    }
    // el nombre, en su placa
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 8, y + h - 34, w - 16, 22);
    ctx.fillStyle = '#eef6fb';
    ctx.font = '700 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(bin.nombre, x + w / 2, y + h - 19);
    ctx.textAlign = 'left';
    // el veredicto del último toque, medio segundo
    if(flash){
      ctx.font = '700 34px "IBM Plex Mono", monospace';
      ctx.fillStyle = flash.bueno ? '#2dd48f' : '#f05a4a';
      ctx.fillText(flash.bueno ? '✓' : '✗', x + w / 2 - 12, y - 14);
    }
  }
}
