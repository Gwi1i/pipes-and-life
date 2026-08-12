/**
 * MINIJUEGO: LA REPARACIÓN A MANO.
 *
 * Una tubería ha reventado y el agua viene de camino: hay que reconstruir el
 * tramo uniendo la ENTRADA con la SALIDA, pieza a pieza, antes de que el agua
 * alcance un hueco y se derrame. Es el oficio contado a otra velocidad — y el
 * homenaje evidente a los juegos de tuberías de los 90.
 *
 * Controles (pensados para el dedo): tocar una casilla vacía COLOCA la pieza
 * que toque de la cola; tocar una pieza ya puesta (y aún seca) la GIRA. El
 * agua no espera a nadie.
 *
 * Módulo autocontenido: tiene su telón, su lienzo, su reloj y sus escuchas.
 * NO toca el estado del juego — devuelve el resultado por callback y es
 * `main.js` quien decide qué significa (arreglar gratis la avería). Del juego
 * grande solo toma CONFIG y el sonido, que también es de solo-reaccionar.
 */

import { CONFIG } from './config.js';
import * as sonido from './sonido.js';

// Lados de una celda, en orden horario. El opuesto es (lado + 2) % 4.
const N = 0, E = 1, S = 2, O = 3;
// Qué lados conecta cada forma SIN girar; el giro suma al índice.
const FORMAS = { recto: [E, O], codo: [N, E] };

export class MinijuegoTuberias {

  constructor(){
    this.fondo = document.getElementById('minijuego');
    this.lienzo = document.getElementById('mini-lienzo');
    this.ctx = this.lienzo.getContext('2d');
    this.alTerminar = null;

    this.lienzo.addEventListener('pointerdown', e => {
      const r = this.lienzo.getBoundingClientRect();
      // El lienzo se dibuja a resolución real pero se muestra escalado por CSS
      this.clic((e.clientX - r.left) * (this.lienzo.width / r.width),
                (e.clientY - r.top) * (this.lienzo.height / r.height));
    });
    document.getElementById('mini-cancelar').onclick = () => this.terminar(false, 'abandonado');
  }

  /* ---------------- el tablero ---------------- */

  jugar(alTerminar){
    const K = CONFIG.minijuegos.tuberias;
    this.alTerminar = alTerminar;

    // Tablero con rocas al azar, repetido hasta que EXISTA un camino posible:
    // un puzle sin solución no es difícil, es una estafa.
    let intentos = 0;
    do{
      this.entradaFila = 1 + Math.floor(Math.random() * (K.filas - 2));
      this.salidaFila = 1 + Math.floor(Math.random() * (K.filas - 2));
      this.celdas = Array.from({ length: K.filas },
        () => new Array(K.columnas).fill(null));
      let puestas = 0;
      while(puestas < K.rocas){
        const c = Math.floor(Math.random() * K.columnas);
        const f = Math.floor(Math.random() * K.filas);
        if(this.celdas[f][c]) continue;
        if(c === 0 && f === this.entradaFila) continue;
        if(c === K.columnas - 1 && f === this.salidaFila) continue;
        this.celdas[f][c] = { roca: true };
        puestas++;
      }
    } while(!this.haySalida(K) && ++intentos < 60);

    // La cola de piezas: la actual y la siguiente, para poder pensar una jugada
    this.cola = [this.pieza(), this.pieza()];
    this.reloj = 0;
    this.gracia = K.graciaSegundos;
    this.tCelda = K.segundosPorCelda;
    // El agua: dónde está, por qué lado entró y cuánto lleva cruzado (0..1)
    this.agua = { col: 0, fila: this.entradaFila, lado: O, avance: 0, dentro: false };
    this.fin = null;          // null = jugando; { exito, razon, t }
    this.fondo.hidden = false;
    this.ajustar();

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

  pieza(){
    const K = CONFIG.minijuegos.tuberias;
    return { forma: Math.random() < K.probRecto ? 'recto' : 'codo',
             rot: Math.floor(Math.random() * 4), mojada: 0 };
  }

  /** ¿Hay camino de entrada a salida por las celdas libres? (BFS a 4 vecinos) */
  haySalida(K){
    const visto = new Set();
    const cola = [[0, this.entradaFila]];
    while(cola.length){
      const [c, f] = cola.pop();
      if(c === K.columnas - 1 && f === this.salidaFila) return true;
      for(const [dc, df] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nc = c + dc, nf = f + df;
        if(nc < 0 || nf < 0 || nc >= K.columnas || nf >= K.filas) continue;
        const clave = nc + ',' + nf;
        if(visto.has(clave) || this.celdas[nf][nc]) continue;
        visto.add(clave); cola.push([nc, nf]);
      }
    }
    return false;
  }

  conexiones(p){ return FORMAS[p.forma].map(l => (l + p.rot) % 4); }

  /* ---------------- jugar ---------------- */

  clic(x, y){
    if(this.fin) return;
    const c = Math.floor((x - this.margenX) / this.tam);
    const f = Math.floor((y - this.margenY) / this.tam);
    const K = CONFIG.minijuegos.tuberias;
    if(c < 0 || f < 0 || c >= K.columnas || f >= K.filas) return;
    const celda = this.celdas[f][c];
    if(celda && celda.roca) return;
    // Lo que el agua ya ha tocado no se toca: llegas tarde
    if(celda && celda.mojada > 0) return;
    if(this.agua.dentro && this.agua.col === c && this.agua.fila === f) return;

    if(!celda){
      this.celdas[f][c] = this.cola.shift();
      this.cola.push(this.pieza());
      sonido.colocar();
    } else {
      celda.rot = (celda.rot + 1) % 4;
      sonido.tramo();
    }
  }

  tick(dt){
    if(this.fin){
      this.fin.t += dt;
      if(this.fin.t > (this.fin.exito ? 0.8 : 1.1))
        this.terminar(this.fin.exito, this.fin.razon);
      return;
    }
    this.reloj += dt;
    const a = this.agua;

    if(!a.dentro){
      if(this.reloj < this.gracia) return;
      // El agua asoma por la boca: si no hay pieza que la reciba, derrame YA.
      // Esperar a "cruzar" un hueco invisible sería regalar un tiempo falso.
      a.dentro = true;
      if(!this.recibe(a.col, a.fila, a.lado)){
        this.fin = { exito: false, razon: 'derrame', t: 0 };
        return;
      }
    }

    a.avance += dt / this.tCelda;
    if(a.avance < 1) return;

    // La pieza actual queda cruzada y llena: ¿a dónde manda el agua?
    const K = CONFIG.minijuegos.tuberias;
    const p = this.celdas[a.fila][a.col];
    p.mojada = 1;
    const salida = this.conexiones(p).find(l => l !== a.lado);
    const destino = [[0,-1],[1,0],[0,1],[-1,0]][salida];  // N,E,S,O
    const nc = a.col + destino[0], nf = a.fila + destino[1];
    // ¿Sale del tablero? Solo la boca de salida es victoria
    if(nc >= K.columnas && a.fila === this.salidaFila && salida === E){
      this.fin = { exito: true, razon: 'exito', t: 0 };
      return;
    }
    if(nc < 0 || nf < 0 || nc >= K.columnas || nf >= K.filas
       || !this.recibe(nc, nf, (salida + 2) % 4)){
      this.fin = { exito: false, razon: 'derrame', t: 0 };
      return;
    }
    a.col = nc; a.fila = nf;
    a.lado = (salida + 2) % 4;
    a.avance = 0;
    this.tCelda *= CONFIG.minijuegos.tuberias.aceleracion;   // el agua se crece
  }

  /** ¿Hay en (c,f) una pieza que reciba agua por ese lado? */
  recibe(c, f, lado){
    const p = this.celdas[f][c];
    return !!p && !p.roca && this.conexiones(p).includes(lado);
  }

  terminar(exito, razon){
    if(this.fondo.hidden) return;
    this.fondo.hidden = true;
    const cb = this.alTerminar;
    this.alTerminar = null;
    if(cb) cb(exito, razon);
  }

  /* ---------------- dibujar ---------------- */

  ajustar(){
    const K = CONFIG.minijuegos.tuberias;
    // Resolución fija y proporción del tablero + la tira de arriba
    const ancho = 640;
    this.tam = Math.floor(ancho / (K.columnas + 1));
    this.margenX = Math.floor(this.tam / 2);
    this.margenY = this.tam;                    // tira superior: cola y reloj
    this.lienzo.width = ancho;
    this.lienzo.height = this.margenY + K.filas * this.tam + Math.floor(this.tam / 2);
  }

  dibujar(){
    const ctx = this.ctx, K = CONFIG.minijuegos.tuberias, t = this.tam;
    const W = this.lienzo.width, H = this.lienzo.height;
    ctx.clearRect(0, 0, W, H);

    // La tira de arriba: piezas que vienen y el reloj de gracia
    ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#8aa0b4';
    ctx.fillText('SIGUIENTES', this.margenX, t * 0.4);
    this.cola.forEach((p, i) => {
      const x = this.margenX + 110 + i * (t * 0.75);
      this.dibujarPieza(ctx, p, x, t * 0.08, t * 0.6, i === 0 ? 1 : 0.45);
    });
    if(!this.agua.dentro){
      const resta = Math.max(0, this.gracia - this.reloj);
      const frac = resta / this.gracia;
      ctx.fillStyle = '#0d2233';
      ctx.fillRect(W - 190 - this.margenX, t * 0.18, 190, t * 0.34);
      ctx.fillStyle = frac < 0.3 ? '#f0a04a' : '#38bdf8';
      ctx.fillRect(W - 190 - this.margenX, t * 0.18, 190 * frac, t * 0.34);
      ctx.fillStyle = '#dfe9f1';
      ctx.fillText(resta.toFixed(1) + ' s', W - 60 - this.margenX, t * 0.42);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('¡AGUA EN LA RED!', W - 190 - this.margenX, t * 0.42);
    }

    // El tablero
    for(let f = 0; f < K.filas; f++)
      for(let c = 0; c < K.columnas; c++){
        const x = this.margenX + c * t, y = this.margenY + f * t;
        ctx.fillStyle = (c + f) % 2 ? '#0e1c2a' : '#102030';
        ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
        const celda = this.celdas[f][c];
        if(!celda) continue;
        if(celda.roca) this.dibujarRoca(ctx, x, y, t);
        else this.dibujarPieza(ctx, celda, x, y, t, 1);
      }

    // El agua sobre la pieza que está cruzando
    const a = this.agua;
    if(a.dentro && !this.fin){
      const p = this.celdas[a.fila][a.col];
      const x = this.margenX + a.col * t, y = this.margenY + a.fila * t;
      if(p && !p.roca && this.conexiones(p).includes(a.lado))
        this.dibujarAgua(ctx, p, x, y, t, a.lado, Math.min(1, a.avance));
    }
    // Y sobre todas las que ya cruzó, llenas
    for(let f = 0; f < K.filas; f++)
      for(let c = 0; c < K.columnas; c++){
        const celda = this.celdas[f][c];
        if(celda && celda.mojada)
          this.dibujarAgua(ctx, celda, this.margenX + c * t, this.margenY + f * t, t,
                           this.conexiones(celda)[0], 1);
      }

    // Bocas de entrada y salida
    this.dibujarBoca(ctx, this.margenX - t * 0.45, this.margenY + this.entradaFila * t, t, '→');
    this.dibujarBoca(ctx, this.margenX + K.columnas * t + t * 0.05,
                     this.margenY + this.salidaFila * t, t, '→');

    // El final: chapoteo o victoria
    if(this.fin){
      ctx.fillStyle = this.fin.exito ? 'rgba(45,212,143,0.25)' : 'rgba(240,90,74,0.25)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#eef6fb';
      ctx.font = '700 30px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.fin.exito ? '¡EN SERVICIO!' : '¡DERRAME!', W / 2, H / 2);
      ctx.textAlign = 'left';
    }
  }

  /** El camino que dibuja una pieza: del lado de entrada al centro y al otro. */
  puntosDe(p, x, y, t){
    const medio = l => [[x + t / 2, y], [x + t, y + t / 2],
                        [x + t / 2, y + t], [x, y + t / 2]][l];
    const [a, b] = this.conexiones(p);
    return [medio(a), [x + t / 2, y + t / 2], medio(b)];
  }

  dibujarPieza(ctx, p, x, y, t, alfa){
    const pts = this.puntosDe(p, x, y, t);
    ctx.globalAlpha = alfa;
    for(const [grosor, color] of [[t * 0.34, '#3a4a58'], [t * 0.24, '#8fa4b5']]){
      ctx.strokeStyle = color; ctx.lineWidth = grosor;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  dibujarAgua(ctx, p, x, y, t, desdeLado, frac){
    let pts = this.puntosDe(p, x, y, t);
    // El agua entra por `desdeLado`: si el camino está al revés, se invierte
    const medio = l => [[x + t / 2, y], [x + t, y + t / 2],
                        [x + t / 2, y + t], [x, y + t / 2]][l];
    const boca = medio(desdeLado);
    if(pts[0][0] !== boca[0] || pts[0][1] !== boca[1]) pts = pts.slice().reverse();
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = t * 0.14;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    if(frac <= 0.5){
      const k = frac * 2;
      ctx.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * k,
                 pts[0][1] + (pts[1][1] - pts[0][1]) * k);
    } else {
      ctx.lineTo(...pts[1]);
      const k = (frac - 0.5) * 2;
      ctx.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * k,
                 pts[1][1] + (pts[2][1] - pts[1][1]) * k);
    }
    ctx.stroke();
  }

  dibujarRoca(ctx, x, y, t){
    ctx.fillStyle = '#31404d';
    for(const [dx, dy, r] of [[0.32, 0.42, 0.2], [0.62, 0.55, 0.16], [0.48, 0.68, 0.13]]){
      ctx.beginPath();
      ctx.arc(x + t * dx, y + t * dy, t * r, 0, 7);
      ctx.fill();
    }
  }

  dibujarBoca(ctx, x, y, t, flecha){
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x, y + t * 0.33, t * 0.4, t * 0.34);
    ctx.fillStyle = '#0b1420';
    ctx.font = `700 ${Math.floor(t * 0.3)}px "IBM Plex Mono", monospace`;
    ctx.fillText(flecha, x + t * 0.06, y + t * 0.62);
  }
}
