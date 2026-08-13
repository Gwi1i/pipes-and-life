/**
 * MINIJUEGO: LA REPARACIÓN A MANO.
 *
 * Una tubería ha reventado y el agua viene de camino: la zanja está LLENA de
 * piezas descolocadas y hay que GIRARLAS para unir la ENTRADA con la SALIDA
 * antes de que el agua alcance un desencaje y se derrame. Es el oficio contado
 * a otra velocidad — y el homenaje evidente a los juegos de tuberías de los 90.
 *
 * Controles (pensados para el dedo): tocar una pieza seca la GIRA. Nada más:
 * hubo una versión en que se COLOCABAN piezas de una cola y se quitó a
 * propósito — una pieza mal puesta no tenía arreglo y el fallo de un clic
 * condenaba la partida entera. Girar siempre tiene vuelta atrás.
 *
 * El tablero se genera EXCAVANDO primero un camino solución (paseo aleatorio
 * autoevitante de boca a boca), poniendo en cada casilla del camino su pieza
 * correcta, rellenando el resto con piezas al azar y BARAJANDO todos los
 * giros. La solución existe siempre; encontrarla a tiempo es el juego.
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
// La te y la cruceta abren MÁS de dos bocas: por dónde sale el agua lo
// decide salidaDe() con una sola regla — recto si puede, si no gira.
const FORMAS = { recto: [E, O], codo: [N, E],
                 te: [N, E, S], cruceta: [N, E, S, O] };

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

    this.entradaFila = 1 + Math.floor(Math.random() * (K.filas - 2));
    this.salidaFila = 1 + Math.floor(Math.random() * (K.filas - 2));
    this.celdas = Array.from({ length: K.filas },
      () => new Array(K.columnas).fill(null));

    // 1. Se EXCAVA el camino solución: un paseo autoevitante de boca a boca.
    // Existe siempre (el tablero aún está vacío), así que el puzle nace con
    // solución garantizada: un puzle sin solución no es difícil, es una estafa.
    const camino = this.carvarCamino(K);
    const enCamino = new Set(camino.map(([c, f]) => c + ',' + f));

    // 2. Cada casilla del camino recibe SU pieza con SU giro bueno. De vez
    // en cuando la pieza se ASCIENDE a te o cruceta (CONFIG.formasExtra):
    // mismas bocas de paso más las de sobra, para que el tablero no sea un
    // desfile de rectos y codos. giroQueUne comprueba el FLUJO, así que un
    // ascenso solo entra si el agua sigue saliendo por donde toca.
    const X = K.formasExtra || {};
    for(let i = 0; i < camino.length; i++){
      const [c, f] = camino[i];
      const ladoIn = i === 0 ? O
        : this.ladoHacia(camino[i], camino[i - 1]);
      const ladoOut = i === camino.length - 1 ? E
        : this.ladoHacia(camino[i], camino[i + 1]);
      let forma = ((ladoIn + 2) % 4 === ladoOut) ? 'recto' : 'codo';
      if(Math.random() < (X.cruceta || 0)
         && this.giroQueUne('cruceta', ladoIn, ladoOut) !== null)
        forma = 'cruceta';
      else if(Math.random() < (X.te || 0)
              && this.giroQueUne('te', ladoIn, ladoOut) !== null)
        forma = 'te';
      // rotBuena no la usa el juego: queda para poder comprobar por consola
      // que la solución existe (girar todo el camino a su rotBuena y simular)
      const rotBuena = this.giroQueUne(forma, ladoIn, ladoOut);
      this.celdas[f][c] = { forma, rot: rotBuena, rotBuena, mojada: 0 };
    }
    this._camino = camino;

    // 3. Rocas fuera del camino, y el resto relleno de piezas al azar:
    // un tablero LLENO donde girar es lo único que hay que hacer
    let puestas = 0, cabida = K.columnas * K.filas - camino.length;
    while(puestas < Math.min(K.rocas, cabida)){
      const c = Math.floor(Math.random() * K.columnas);
      const f = Math.floor(Math.random() * K.filas);
      if(this.celdas[f][c] || enCamino.has(c + ',' + f)) continue;
      this.celdas[f][c] = { roca: true };
      puestas++;
    }
    for(let f = 0; f < K.filas; f++)
      for(let c = 0; c < K.columnas; c++)
        if(!this.celdas[f][c]) this.celdas[f][c] = this.pieza();

    // 4. Se BARAJAN los giros de todas las piezas... comprobando que el azar
    // no haya dejado el puzle ya resuelto de fábrica
    let vueltas = 0;
    do{
      for(const [c, f] of camino)
        this.celdas[f][c].rot = Math.floor(Math.random() * 4);
    } while(this.yaResuelto(K) && ++vueltas < 20);

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
    const K = CONFIG.minijuegos.tuberias, X = K.formasExtra || {};
    let forma;
    if(Math.random() < (X.cruceta || 0)) forma = 'cruceta';
    else if(Math.random() < (X.te || 0)) forma = 'te';
    else forma = Math.random() < K.probRecto ? 'recto' : 'codo';
    return { forma, rot: Math.floor(Math.random() * 4), mojada: 0 };
  }

  /**
   * El camino solución: paseo aleatorio AUTOEVITANTE de la boca de entrada a
   * la de salida (DFS con vecinos barajados). El este va con ventaja para que
   * el camino avance en vez de enredarse por todo el tablero; aun así serpentea
   * lo suyo, que es lo que da codos que girar.
   */
  carvarCamino(K){
    const visto = new Set(['0,' + this.entradaFila]);
    const camino = [[0, this.entradaFila]];
    const dfs = () => {
      const [c, f] = camino[camino.length - 1];
      if(c === K.columnas - 1 && f === this.salidaFila) return true;
      const vecinos = [[1,0],[-1,0],[0,1],[0,-1]]
        .map(v => [v, Math.random() - (v[0] === 1 ? 0.45 : 0)])
        .sort((a, b) => a[1] - b[1]).map(x => x[0]);
      for(const [dc, df] of vecinos){
        const nc = c + dc, nf = f + df;
        if(nc < 0 || nf < 0 || nc >= K.columnas || nf >= K.filas) continue;
        const clave = nc + ',' + nf;
        if(visto.has(clave)) continue;
        visto.add(clave);
        camino.push([nc, nf]);
        if(dfs()) return true;
        camino.pop();
      }
      return false;
    };
    dfs();
    return camino;
  }

  /** Por qué lado de la celda `a` se llega a la vecina `b`. */
  ladoHacia([c, f], [c2, f2]){
    return c2 > c ? E : c2 < c ? O : f2 > f ? S : N;
  }

  /** El giro que hace que el agua que entra por `ladoA` SALGA por `ladoB`.
   *  No basta con que la forma conecte los dos lados: en una te el agua
   *  prefiere el recto, así que hay que comprobar el flujo de verdad.
   *  Devuelve null si ningún giro lo consigue. */
  giroQueUne(forma, ladoA, ladoB){
    for(let rot = 0; rot < 4; rot++){
      const p = { forma, rot };
      if(this.conexiones(p).includes(ladoA)
         && this.salidaDe(p, ladoA) === ladoB) return rot;
    }
    return null;
  }

  /** ¿El agua llegaría YA de boca a boca sin tocar nada? Simulación en seco:
   *  sirve para no estrenar un puzle que el azar dejó resuelto de fábrica. */
  yaResuelto(K){
    let c = 0, f = this.entradaFila, lado = O;
    const pisado = new Set();
    while(true){
      const p = this.celdas[f][c];
      if(!p || p.roca || !this.conexiones(p).includes(lado)) return false;
      const clave = c + ',' + f + ',' + lado;
      if(pisado.has(clave)) return false;          // bucle: no llega a ningún lado
      pisado.add(clave);
      const salida = this.salidaDe(p, lado);
      const [dc, df] = [[0,-1],[1,0],[0,1],[-1,0]][salida];
      const nc = c + dc, nf = f + df;
      if(nc >= K.columnas) return f === this.salidaFila && salida === E;
      if(nc < 0 || nf < 0 || nf >= K.filas) return false;
      c = nc; f = nf; lado = (salida + 2) % 4;
    }
  }

  conexiones(p){ return FORMAS[p.forma].map(l => (l + p.rot) % 4); }

  /**
   * Por dónde sale el agua que entra por `entrada`: RECTO si puede, y si no
   * gira (primero a un lado, luego al otro, en orden fijo). Una sola regla
   * visible para que el jugador pueda predecir la te y la cruceta: la
   * cruceta siempre se cruza de largo, la te solo desvía cuando no hay recto.
   */
  salidaDe(p, entrada){
    const con = this.conexiones(p);
    return [(entrada + 2) % 4, (entrada + 1) % 4, (entrada + 3) % 4]
      .find(l => con.includes(l));
  }

  /* ---------------- jugar ---------------- */

  clic(x, y){
    if(this.fin) return;
    const c = Math.floor((x - this.margenX) / this.tam);
    const f = Math.floor((y - this.margenY) / this.tam);
    const K = CONFIG.minijuegos.tuberias;
    if(c < 0 || f < 0 || c >= K.columnas || f >= K.filas) return;
    const celda = this.celdas[f][c];
    if(!celda || celda.roca) return;
    // Lo que el agua ya ha tocado no se toca: llegas tarde
    if(celda.mojada > 0) return;
    if(this.agua.dentro && this.agua.col === c && this.agua.fila === f) return;

    celda.rot = (celda.rot + 1) % 4;
    sonido.tramo();
  }

  tick(dt){
    // El reloj corre SIEMPRE: mueve la corriente del agua y los brillos,
    // también durante el cartel del final.
    this.reloj += dt;
    if(this.fin){
      this.fin.t += dt;
      if(this.fin.t > (this.fin.exito ? 0.8 : 1.1))
        this.terminar(this.fin.exito, this.fin.razon);
      return;
    }
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
    p.entradaAgua = a.lado;      // para dibujarla llena por su recorrido real
    const salida = this.salidaDe(p, a.lado);
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
    this.margenY = this.tam;                    // tira superior: consigna y reloj
    this.lienzo.width = ancho;
    this.lienzo.height = this.margenY + K.filas * this.tam + Math.floor(this.tam / 2);
  }

  dibujar(){
    const ctx = this.ctx, K = CONFIG.minijuegos.tuberias, t = this.tam;
    const W = this.lienzo.width, H = this.lienzo.height;
    ctx.clearRect(0, 0, W, H);

    // La tira de arriba: la consigna y el reloj de gracia
    ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#8aa0b4';
    ctx.fillText('GIRA LAS PIEZAS Y UNE LAS BOCAS', this.margenX, t * 0.4);
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

    // El tablero: una ZANJA abierta — tierra excavada, no una cuadrícula
    // abstracta. La reparación se hace en el barro, como las de verdad.
    for(let f = 0; f < K.filas; f++)
      for(let c = 0; c < K.columnas; c++){
        const x = this.margenX + c * t, y = this.margenY + f * t;
        ctx.fillStyle = (c + f) % 2 ? '#3b2b18' : '#43311c';
        ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
        // La pared de la zanja: sombra arriba (la luz viene de arriba-izquierda)
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 1, y + 1, t - 2, t * 0.10);
        ctx.fillStyle = 'rgba(255,235,190,0.08)';
        ctx.fillRect(x + 1, y + t - t * 0.08, t - 2, t * 0.07);
        // Grava y pedruscos, sembrados fijos por celda para que no parpadeen
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for(let g = 0; g < 4; g++){
          const gx = ((c * 7 + f * 13 + g * 29) % 10) / 10;
          const gy = ((c * 17 + f * 5 + g * 41) % 10) / 10;
          ctx.beginPath();
          ctx.arc(x + t * (0.12 + gx * 0.76), y + t * (0.16 + gy * 0.68),
                  t * 0.022, 0, 7);
          ctx.fill();
        }
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
                           celda.entradaAgua ?? this.conexiones(celda)[0], 1);
      }

    // Bocas de entrada y salida
    this.dibujarBoca(ctx, this.margenX - t * 0.45, this.margenY + this.entradaFila * t, t, true);
    this.dibujarBoca(ctx, this.margenX + K.columnas * t + t * 0.05,
                     this.margenY + this.salidaFila * t, t, false);

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

  /** El punto medio de cada lado de la celda: por ahí asoman las bocas. */
  medioDe(x, y, t, lado){
    return [[x + t / 2, y], [x + t, y + t / 2],
            [x + t / 2, y + t], [x, y + t / 2]][lado];
  }

  /**
   * Una pieza de CARICATURA, como las ilustraciones del juego: contorno gordo
   * y oscuro —la seña del estilo—, color plano con su banda de luz arriba y de
   * sombra abajo (cel-shading, nada de degradados), proporciones rechonchas y
   * tornillos exagerados. Las BRIDAS de cada boca no son adorno: son lo que
   * hace legible de un vistazo por dónde conecta la pieza.
   * Se dibuja POR RAMAS (del centro a cada boca): así la misma mano pinta el
   * recto, el codo, la te y la cruceta.
   */
  dibujarPieza(ctx, p, x, y, t, alfa){
    const cx = x + t / 2, cy = y + t / 2;
    const lados = this.conexiones(p);
    // La punta de cada rama muere EN su brida, no en el borde de la celda:
    // el corte recto queda tapado por la placa (petición del autor — el tubo
    // seguía de largo y la pieza parecía no acabar en nada).
    const punta = l => {
      const [dx, dy] = [[0,-1],[1,0],[0,1],[-1,0]][l];
      return [cx + dx * t * 0.40, cy + dy * t * 0.40];
    };
    const traza = (dx, dy, grosor, color, conEmpalme) => {
      ctx.save(); ctx.translate(dx, dy);
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.lineWidth = grosor; ctx.lineCap = 'butt';
      ctx.beginPath();
      for(const l of lados){
        ctx.moveTo(cx, cy);
        ctx.lineTo(...punta(l));
      }
      ctx.stroke();
      // el empalme del centro: el mismo tubo redondeado, para que el codo y
      // la te no hagan muesca donde se juntan las ramas (sin tambor: el
      // tambor de antes era un parche para tapar justo esto)
      if(conEmpalme){
        ctx.beginPath(); ctx.arc(cx, cy, grosor / 2, 0, 7); ctx.fill();
      }
      ctx.restore();
    };
    ctx.globalAlpha = alfa;
    traza(t * 0.05, t * 0.07, t * 0.42, 'rgba(0,0,0,0.4)', true);  // sombra al barro
    traza(0, 0, t * 0.46, '#141d26', true);                        // CONTORNO gordo
    traza(0, 0, t * 0.34, '#8ea3b6', true);                        // el tubo, plano
    traza(t * 0.035, t * 0.05, t * 0.13, '#5d7183', false);        // banda de sombra
    traza(-t * 0.04, -t * 0.055, t * 0.12, '#cfe0ec', false);      // banda de luz
    for(const lado of lados)
      this.dibujarBrida(ctx, x, y, t, lado);
    ctx.globalAlpha = 1;
  }

  /** La brida de una boca: oreja rechoncha con dos tornillos bien gordos. */
  dibujarBrida(ctx, x, y, t, lado){
    const vertical = (lado === N || lado === S);   // el tubo sale en vertical
    const px = x + (lado === E ? t : lado === O ? 0 : t / 2);
    const py = y + (lado === S ? t : lado === N ? 0 : t / 2);
    const largo = t * 0.54, grueso = t * 0.16;
    ctx.save();
    ctx.translate(px, py);
    if(!vertical) ctx.rotate(Math.PI / 2);
    // hacia dentro de la celda, para que no invada a la vecina
    const dentro = (lado === N || lado === O) ? grueso * 0.2 : -grueso * 1.2;
    const caja = (dx, dy, w, h, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(dx, dy, w, h, r);
      ctx.fill();
    };
    caja(-largo / 2 - t * 0.03, dentro - t * 0.03, largo + t * 0.06,
         grueso + t * 0.06, '#141d26', t * 0.06);              // contorno
    caja(-largo / 2, dentro, largo, grueso, '#9db1c2', t * 0.04);
    caja(-largo / 2, dentro, largo, grueso * 0.42, '#cfe0ec', t * 0.04);  // luz
    // tornillos de tebeo: gordos, con contorno y su chispita
    for(const s of [-1, 1]){
      const tx = s * (largo / 2 - grueso * 0.5), ty = dentro + grueso / 2;
      ctx.fillStyle = '#141d26';
      ctx.beginPath(); ctx.arc(tx, ty, grueso * 0.34, 0, 7); ctx.fill();
      ctx.fillStyle = '#6d8296';
      ctx.beginPath(); ctx.arc(tx, ty, grueso * 0.24, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8f2f9';
      ctx.beginPath(); ctx.arc(tx - grueso * 0.08, ty - grueso * 0.08,
                               grueso * 0.09, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  dibujarAgua(ctx, p, x, y, t, desdeLado, frac){
    // El recorrido REAL del agua: entra por `desdeLado`, pasa por el centro y
    // sale por donde diga salidaDe — en la te y la cruceta las ramas de
    // sobra se quedan secas, que es justo lo que pasa de verdad.
    const pts = [this.medioDe(x, y, t, desdeLado),
                 [x + t / 2, y + t / 2],
                 this.medioDe(x, y, t, this.salidaDe(p, desdeLado))];
    const camino = () => {
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
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1d7fb8'; ctx.lineWidth = t * 0.16;
    camino(); ctx.stroke();
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = t * 0.11;
    camino(); ctx.stroke();
    // La CORRIENTE: rayitas claras que viajan con el reloj. Es lo que hace que
    // el agua parezca agua y no una tubería pintada de azul.
    ctx.strokeStyle = 'rgba(200,240,255,0.7)'; ctx.lineWidth = t * 0.045;
    ctx.setLineDash([t * 0.13, t * 0.19]);
    ctx.lineDashOffset = -this.reloj * t * 1.6;
    camino(); ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Pedrusco de tebeo: contorno gordo, color plano y su parche de luz. */
  dibujarRoca(ctx, x, y, t){
    const bolos = [[0.38, 0.5, 0.23], [0.66, 0.6, 0.18], [0.52, 0.72, 0.13]];
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for(const [dx, dy, r] of bolos){
      ctx.beginPath(); ctx.ellipse(x + t * dx + t * 0.05, y + t * dy + t * 0.07,
                                   t * r, t * r * 0.75, 0, 0, 7); ctx.fill();
    }
    for(const [dx, dy, r] of bolos){
      ctx.fillStyle = '#141d26';
      ctx.beginPath(); ctx.arc(x + t * dx, y + t * dy, t * (r + 0.045), 0, 7); ctx.fill();
      ctx.fillStyle = '#5f7181';
      ctx.beginPath(); ctx.arc(x + t * dx, y + t * dy, t * r, 0, 7); ctx.fill();
      ctx.fillStyle = '#8397a8';
      ctx.beginPath();
      ctx.arc(x + t * (dx - 0.045), y + t * (dy - 0.05), t * r * 0.55, 0, 7);
      ctx.fill();
    }
  }

  /** Las bocas: tocones de tubería cortada abiertos HACIA el tablero. */
  dibujarBoca(ctx, x, y, t, esEntrada){
    const cy = y + t / 2;
    const bocaX = esEntrada ? x + t * 0.42 : x;   // por dónde asoma el agua
    ctx.fillStyle = '#141d26';
    ctx.fillRect(x - 2, cy - t * 0.21, t * 0.42 + 4, t * 0.42);
    ctx.fillStyle = '#8ea3b6';
    ctx.fillRect(x, cy - t * 0.16, t * 0.42, t * 0.32);
    ctx.fillStyle = '#cfe0ec';
    ctx.fillRect(x, cy - t * 0.16, t * 0.42, t * 0.10);
    // La boca: oscura de normal; en la entrada, azul cuando el agua está al
    // caer — es el aviso silencioso de que el reloj se acaba
    ctx.fillStyle = esEntrada && (this.agua.dentro || this.reloj > this.gracia * 0.8)
      ? '#38bdf8' : '#0c151d';
    ctx.beginPath();
    ctx.ellipse(bocaX, cy, t * 0.06, t * 0.17, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#eef6fb';
    ctx.font = `700 ${Math.floor(t * 0.26)}px "IBM Plex Mono", monospace`;
    ctx.fillText('→', x + t * 0.08, cy + t * 0.09);
  }
}
