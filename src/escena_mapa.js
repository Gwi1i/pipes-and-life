/**
 * ESCENA MAPA — la vista principal del juego: el territorio.
 *
 * Dibuja la cuadrícula grande con niebla, la cámara que se arrastra, el
 * progreso de los clics sobre cada casilla y los hallazgos. Como el resto de
 * escenas, SOLO LEE el estado: quien mueve la cámara o destapa casillas es
 * `main.js` a partir de las acciones de `entrada.js`.
 *
 * Solo se dibujan las casillas que caen en pantalla: el mapa tiene más de mil
 * y pintarlas todas cada fotograma sería tirar rendimiento.
 */

import { CONFIG } from './config.js';
import { celdaEn, clicsParaDestapar, esAlcanzable, puedeColocar,
         puedeSeguirTrazado, costeTrazado, costeCasillaTuberia,
         diametro, nivelDiametro, redDe, casillaEnRed,
         construccionesConectadas, averiaEn,
         nucleoMasCercano, nombreDeNucleo } from './mapa.js';
import { poderExpansion, llenadoVaso, factorEstiaje,
         capacidad, escalonCaserio } from './simulacion.js';
import { formatear } from './util.js';
import { limitar } from './util.js';
import { Escena, mezclarColor, oscurecer, aclarar } from './escena.js';

export class EscenaMapa extends Escena {

  constructor(lienzo){
    super(lienzo);
    this.zoom = 1;
    // Cuánto queda del último golpe de bombeo (segundos). El clic principal era
    // lo ÚNICO del mapa que no se notaba en ninguna parte: solo cambiaban los
    // números. Ahora la caseta acusa el golpe y suelta vapor.
    this.golpe = 0;
    this.centrada = false;
    this.resaltada = null;    // { col, fila } bajo el cursor
  }

  /** Píxeles por casilla al zoom actual. */
  get tam(){ return CONFIG.mapaMundo.tamTesela * this.zoom; }

  /* ---------- conversiones pantalla <-> mapa ---------- */

  celdaEnPantalla(estado, px, py){
    const t = this.tam;
    return {
      col: Math.floor((px + estado.camara.x) / t),
      fila: Math.floor((py + estado.camara.y) / t)
    };
  }

  /**
   * Zoom con la rueda, manteniendo bajo el cursor el mismo punto del mapa. Sin
   * esto la vista salta y te pierdes el sitio que estabas mirando.
   */
  ampliar(estado, delta, px, py){
    // La rueda manda "muescas"; el pellizco manda factor directo. Las dos
    // acaban aquí abajo: una sola cuenta de zoom para los dos mundos.
    this.ampliarFactor(estado, Math.exp(-delta * CONFIG.mapaMundo.velocidadZoom), px, py);
  }

  /** Zoom por factor directo (1 = quieto). Es lo que manda el pellizco. */
  ampliarFactor(estado, factor, px, py){
    const M = CONFIG.mapaMundo;
    // qué casilla (con decimales) hay bajo el cursor ANTES de ampliar
    const antesCol = (px + estado.camara.x) / this.tam;
    const antesFila = (py + estado.camara.y) / this.tam;

    this.zoom = limitar(this.zoom * factor, M.zoomMin, M.zoomMax);

    // recolocar la cámara para que esa misma casilla siga bajo el cursor
    estado.camara.x = antesCol * this.tam - px;
    estado.camara.y = antesFila * this.tam - py;
    this.limitarCamara(estado);
  }

  /** Centra la cámara en el pueblo de origen (solo la primera vez). */
  centrarEnOrigen(estado){
    const M = CONFIG.mapaMundo;
    this.centrarEn(estado, M.origen.col, M.origen.fila);
    this.centrada = true;
  }

  /** Un golpe de bombeo: lo llama `main.js` con cada clic de BOMBEAR. */
  golpeBomba(){ this.golpe = CONFIG.estiloMapa.duracionGolpe; }

  /** Lleva la vista a una casilla concreta (el botón de "ir a la avería"). */
  centrarEn(estado, col, fila){
    const t = this.tam;
    estado.camara.x = col * t + t / 2 - this.ancho / 2;
    estado.camara.y = fila * t + t / 2 - this.alto / 2;
    this.limitarCamara(estado);
  }

  /** Que la cámara no se salga del mundo. */
  limitarCamara(estado){
    const M = CONFIG.mapaMundo, t = this.tam;
    const maxX = Math.max(0, M.cols * t - this.ancho);
    const maxY = Math.max(0, M.filas * t - this.alto);
    estado.camara.x = limitar(estado.camara.x, 0, maxX);
    estado.camara.y = limitar(estado.camara.y, 0, maxY);
  }

  /* ================================================================
     DIBUJO
     ================================================================ */

  dibujar(estado, resultado, dt){
    this.prepararFotograma(estado, resultado, dt);
    const ctx = this.ctx, W = this._W, H = this._H;
    if(!this.centrada) this.centrarEnOrigen(estado);
    this.limitarCamara(estado);

    ctx.fillStyle = '#070d14';
    ctx.fillRect(0, 0, W, H);

    // El coste de cada casilla depende de cómo lleves el abastecimiento
    this.poder = poderExpansion(estado);
    // El estiaje se cachea aquí: lo consulta cada casilla de agua y recalcularlo
    // mil veces por fotograma no tendría ningún sentido.
    this.estiaje = factorEstiaje(estado.horas);
    // El color del año, interpolado de forma CONTINUA entre la estación actual
    // y la siguiente. El `estacion()` del padre salta el 70 % y funde el resto:
    // sirve para el diorama, pero aquí daría justo el tirón que no se quiere.
    this.paletaAño = this.colorDeEstacion(estado.horas);
    // Cuánto de invierno hay ahora mismo (0..1): lo usa la nieve de los árboles.
    this.invierno = this.gradoInvierno(estado.horas);
    // Y cuánto de primavera: lo usan las florecillas del prado.
    this.primavera = this.gradoEstacion(estado.horas, 'Primavera');

    // LO QUE ESTÁ PASANDO AHORA, para que las piezas lo enseñen. Se cachea aquí
    // porque lo consulta cada construcción visible y son datos que ya calcula la
    // simulación: no hay que inventarse nada, solo enchufarlos al dibujo.
    const p = estado.activo, r = resultado || {};
    const cap = capacidad(p, estado);
    this.golpe = Math.max(0, this.golpe - dt);
    this.vivo = {
      lleno: cap > 0 ? limitar(p.agua / cap, 0, 1) : 0,   // nivel del depósito
      produce: !!r.produciendo,                            // entra agua
      trata: !!r.saneamiento,                              // hay saneamiento activo
      recicla: (r.recicladaTh || 0) > 0                    // la planta separa
    };

    const t = this.tam, M = CONFIG.mapaMundo;
    const c0 = Math.max(0, Math.floor(estado.camara.x / t));
    const f0 = Math.max(0, Math.floor(estado.camara.y / t));
    const c1 = Math.min(M.cols - 1, Math.ceil((estado.camara.x + W) / t));
    const f1 = Math.min(M.filas - 1, Math.ceil((estado.camara.y + H) / t));

    for(let f = f0; f <= f1; f++){
      for(let c = c0; c <= c1; c++){
        const celda = celdaEn(estado.mapa, c, f);
        if(!celda) continue;
        const x = Math.round(c * t - estado.camara.x);
        const y = Math.round(f * t - estado.camara.y);
        celda.oculta ? this.dibujarNiebla(estado, celda, c, f, x, y, t)
                     : this.dibujarTerreno(celda, c, f, x, y, t);
      }
    }

    this.contornoExplorado(estado, c0, f0, c1, f1);
    this.lindesProtegidas(estado, c0, f0, c1, f1);
    this.dibujarTuberias(estado);
    // Los hallazgos van DESPUES de las tuberias: pintados junto al terreno, una
    // conduccion que pasara por encima del pueblo lo tapaba, y el icono del
    // pueblo es justo lo que no puede desaparecer del mapa.
    this.dibujarHallazgos(estado);
    this.dibujarConstrucciones(estado);
    this.previsualizar(estado);
    this.marcoResaltado(estado);
    this.velosDeAmbiente();
    this.dibujarAverias(estado);
    this.destellosClic();
  }

  /* ---------- casilla descubierta ---------- */
  /**
   * La referencia es un idle builder de vista cenital, y lo que define ese
   * estilo no son los dibujos: es que el terreno se lee como un CAMPO CONTINUO
   * con un tablero encima, no como un mosaico de cuadros de colores.
   *
   * De ahí las tres decisiones que mandan aquí:
   *   · variación mínima entre casillas (damero suavísimo, no ruido fuerte),
   *   · rejilla clara pintada POR ENCIMA de todo, agua incluida,
   *   · orilla de arena donde la tierra da al agua.
   *
   * Todo Canvas 2D a mano y esto corre por casilla visible y fotograma, así que
   * las operaciones son baratas a propósito.
   */
  dibujarTerreno(celda, c, f, x, y, t){
    const ctx = this.ctx;
    const E = CONFIG.estiloMapa;
    const def = CONFIG.terrenos[celda.tipo] || CONFIG.terrenos.prado;
    const v = ruido(c, f);
    const esAgua = celda.tipo === 'agua' || celda.tipo === 'lago';

    // Damero muy suave + una pizca de ruido. La clave es que sea POCO: con
    // variación fuerte por celda el prado parece papel pintado descosido.
    const par = (c + f) % 2 === 0;
    let color = def.color;
    // El año tiñe el suelo. Solo llano y arbolado: la roca y el agua no cambian
    // de color con la estación, y teñirlas se veía falso.
    if(this.paletaAño && E.tinteEstacion > 0){
      // Por FAMILIA, no por tipo: las tres variantes de llano amarillean igual.
      const fam = def.familia;
      if(fam === 'llano') color = mezclarColor(color, this.paletaAño.hierba, E.tinteEstacion);
      else if(fam === 'arbolado') color = mezclarColor(color, this.paletaAño.hierba, E.tinteEstacion * 0.7);
    }
    let base = mezclarColor(color, par ? '#ffffff' : '#000000', E.damero);
    base = mezclarColor(base, v > 0.5 ? '#ffffff' : '#000000', Math.abs(v - 0.5) * E.variacion);
    if(esAgua && celda.insalubre > 0)
      base = mezclarColor(base, '#7a6a34', Math.min(0.75, celda.insalubre));
    // El SUELO CONTINUO: la casilla entera, sin hueco ni redondeo, con su
    // color bien oscurecido. Es lo que hay "debajo" de la ficha — el hueco
    // entre teselas pasa de vacío negro a tierra del mismo tono, y el mapa
    // se lee como territorio en vez de como fichas flotando.
    ctx.fillStyle = oscurecer(base, E.sueloOscuro);
    ctx.fillRect(x, y, t + 0.5, t + 0.5);

    // La FICHA: cuadrado redondeado con hueco alrededor. Todo lo de dentro se
    // recorta contra ella, asi el terreno nunca se sale de su tesela.
    const g = t * E.separacion, r = t * E.radio;
    const fx = x + g, fy = y + g, fl = t - g * 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(fx, fy, fl, fl, r);
    ctx.clip();

    ctx.fillStyle = base;
    ctx.fillRect(fx, fy, fl, fl);

    // El MOTEADO: parches suaves de luz y sombra, sembrados por casilla (el
    // ruido de siempre decide dónde). Sin esto la hierba era pintura plana.
    if(!esAgua && E.moteado > 0){
      for(let k = 0; k < E.motas; k++){
        const mu = (v * 17 + k * 0.41) % 1, mw = (v * 29 + k * 0.67) % 1;
        // Pequeñas: con parches grandes el prado parecía de camuflaje
        const mr = fl * (0.09 + ((v * 7 + k * 0.23) % 1) * 0.11);
        ctx.fillStyle = mezclarColor(base, k % 2 ? '#ffffff' : '#000000', E.moteado);
        ctx.beginPath();
        ctx.ellipse(fx + fl * (0.15 + mu * 0.7), fy + fl * (0.15 + mw * 0.7),
                    mr, mr * 0.7, mu * 3, 0, 7);
        ctx.fill();
      }
    }

    if(esAgua) this.pintarAgua(celda, c, f, fx, fy, fl, base);
    else this.pintarTierra(celda, c, f, fx, fy, fl, base, v);
    if(!esAgua) this.pintarOrilla(c, f, fx, fy, fl);

    // ZONA PROTEGIDA: un velo verde, y en cada casilla su señal — huella de
    // fauna o flor, según qué se protege. La linde va fuera del clip.
    if(celda.protegida){
      const Z = CONFIG.proteccion;
      ctx.fillStyle = 'rgba(45,212,143,0.14)';
      ctx.fillRect(fx, fy, fl, fl);
      ctx.strokeStyle = Z.color;
      ctx.lineWidth = Math.max(1, fl * 0.028);
      ctx.globalAlpha = 0.75;
      if(celda.protegida === 'fauna'){
        // huella: almohadilla y dedos
        const px = fx + fl * 0.78, py = fy + fl * 0.22, r = fl * 0.05;
        ctx.fillStyle = Z.color;
        ctx.beginPath(); ctx.ellipse(px, py + r, r * 1.2, r, 0, 0, 7); ctx.fill();
        for(const dx of [-1.2, 0, 1.2]){
          ctx.beginPath();
          ctx.arc(px + dx * r, py - r * 0.9, r * 0.5, 0, 7); ctx.fill();
        }
      } else {
        // flor: cuatro pétalos y centro
        const px = fx + fl * 0.78, py = fy + fl * 0.22, r = fl * 0.045;
        ctx.fillStyle = Z.color;
        for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          ctx.beginPath();
          ctx.arc(px + dx * r * 1.3, py + dy * r * 1.3, r, 0, 7); ctx.fill();
        }
        ctx.fillStyle = '#f4f8b8';
        ctx.beginPath(); ctx.arc(px, py, r * 0.8, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // EL SUBSUELO. El acuífero no se dibuja NUNCA —si se viera, sobraría todo
    // el trabajo de buscarlo—; lo que se dibuja es lo que el jugador ha pagado
    // por saber: la zona estudiada, los indicios y cada perforación.
    if(celda.estudiada || celda.sondeo) this.marcaSubsuelo(celda, fx, fy, fl);

    // Luz arriba y sombra abajo DENTRO de la ficha: es lo que le da grosor y la
    // separa del fondo sin necesidad de contorno duro.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(fx, fy, fl, Math.max(1, fl * 0.06));
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(fx, fy + fl - Math.max(1, fl * 0.08), fl, Math.max(1, fl * 0.08));
    ctx.restore();

    // El borde sale del PROPIO color de la casilla, no de un negro plano: así
    // pertenece a la tesela en vez de recortarla contra el fondo.
    ctx.strokeStyle = oscurecer(base, E.contorno);
    ctx.lineWidth = Math.max(1, t * 0.02);
    ctx.beginPath(); ctx.roundRect(fx, fy, fl, fl, r); ctx.stroke();

  }

  /**
   * 0 fuera del invierno y 1 en su centro, con subida y bajada suaves. Sirve
   * para lo que solo debe verse cuando de verdad hace frío.
   */
  gradoInvierno(horas){ return this.gradoEstacion(horas, 'Invierno'); }

  /** 0 fuera de la estación pedida y 1 en su centro, con subida y bajada
   *  suaves. La nieve y las flores comparten esta cuenta. */
  gradoEstacion(horas, nombre){
    const E = CONFIG.estaciones;
    const frac = ((horas % CONFIG.tiempo.horasPorAño) / CONFIG.tiempo.horasPorAño + 1) % 1;
    const pos = frac * E.length;
    const i = Math.floor(pos) % E.length;
    if(E[i].nombre !== nombre) return 0;
    return Math.sin((pos - Math.floor(pos)) * Math.PI);
  }

  /**
   * Los colores del año, mezclando siempre entre la estación actual y la
   * siguiente en proporción al trozo de estación transcurrido. Sin escalones.
   */
  colorDeEstacion(horas){
    const E = CONFIG.estaciones;
    const frac = ((horas % CONFIG.tiempo.horasPorAño) / CONFIG.tiempo.horasPorAño + 1) % 1;
    const pos = frac * E.length;
    const i = Math.floor(pos) % E.length;
    const k = pos - Math.floor(pos);
    const sig = E[(i + 1) % E.length];
    return {
      hierba: mezclarColor(E[i].hierba, sig.hierba, k),
      follaje: mezclarColor(E[i].follaje, sig.follaje, k)
    };
  }

  /**
   * El agua CORRE. Las ondas no se mueven en el sitio: se desplazan siguiendo el
   * cauce, y para saber por dónde va se mira si la casilla tiene agua a los
   * lados (corriente horizontal) o arriba y abajo (vertical).
   *
   * Y el ESTIAJE se ve. En verano el río baja y deja lecho al descubierto por
   * las orillas. Es el dato que ya calcula la simulación, puesto en pantalla:
   * hasta ahora el estiaje solo existía en un número del panel.
   */
  pintarAgua(celda, c, f, x, y, t, base){
    const ctx = this.ctx;
    const mapa = this._estado && this._estado.mapa;

    // ¿Por dónde va la corriente? Se deduce de los vecinos con agua.
    let horizontal = true;
    if(mapa){
      const esAgua = (dc, df) => {
        const v = celdaEn(mapa, c + dc, f + df);
        return !!v && (v.tipo === 'agua' || v.tipo === 'lago');
      };
      const lados = (esAgua(-1, 0) ? 1 : 0) + (esAgua(1, 0) ? 1 : 0);
      const vert = (esAgua(0, -1) ? 1 : 0) + (esAgua(0, 1) ? 1 : 0);
      horizontal = lados >= vert;
    }

    // Lecho al descubierto por el estiaje: cuanto menos caudal, más orilla seca.
    // Ojo con la normalización: `factorEstiaje` va de factorMin a factorMax y el
    // máximo pasa de 1, así que restarle a 1 daba negativo casi todo el año y el
    // lecho no aparecía nunca.
    // Y el lecho SOLO aparece donde hay ORILLA de verdad: se mira vecino a
    // vecino. Antes se pintaba en los dos bordes perpendiculares a la
    // corriente, y una casilla en mitad del río lucía orillas contra otra
    // agua — lo cazó el autor jugando.
    const Q = CONFIG.estiaje;
    const seco = limitar((Q.factorMax - this.estiaje) / (Q.factorMax - Q.factorMin), 0, 1) * 0.34;
    if(seco > 0.01 && mapa){
      const esTierra = (dc, df) => {
        const v = celdaEn(mapa, c + dc, f + df);
        return !!v && v.tipo !== 'agua' && v.tipo !== 'lago';
      };
      ctx.fillStyle = 'rgba(150,132,96,0.55)';
      const b = t * seco * 0.5;
      if(esTierra(0, -1)) ctx.fillRect(x, y, t, b);
      if(esTierra(0, 1))  ctx.fillRect(x, y + t - b, t, b);
      if(esTierra(-1, 0)) ctx.fillRect(x, y, b, t);
      if(esTierra(1, 0))  ctx.fillRect(x + t - b, y, b, t);
    }

    if(celda.insalubre > 0){
      ctx.fillStyle = `rgba(130,110,50,${0.22 * celda.insalubre})`;
      for(const p of [[0.28, 0.34, 0.10], [0.62, 0.55, 0.08], [0.44, 0.72, 0.07]]){
        ctx.beginPath(); ctx.arc(x + t * p[0], y + t * p[1], t * p[2], 0, 7); ctx.fill();
      }
    }

    // LA OTRA MITAD DE LA ORILLA. La tierra ya pinta su franja de arena; el
    // agua pone los BAJÍOS (una banda clara: cerca de la orilla cubre menos)
    // y la ESPUMA lamiendo, animada. Es lo que convierte el borde del río de
    // un corte a tijera en una orilla de verdad.
    if(mapa){
      const esTierraVec = (dc, df) => {
        const vec = celdaEn(mapa, c + dc, f + df);
        return !!vec && !vec.oculta && vec.tipo !== 'agua' && vec.tipo !== 'lago';
      };
      const bordes = [
        [0, -1, x, y, t, t * 0.11, x, y + t * 0.045, x + t, y + t * 0.045],
        [0, 1, x, y + t - t * 0.11, t, t * 0.11, x, y + t - t * 0.045, x + t, y + t - t * 0.045],
        [-1, 0, x, y, t * 0.11, t, x + t * 0.045, y, x + t * 0.045, y + t],
        [1, 0, x + t - t * 0.11, y, t * 0.11, t, x + t - t * 0.045, y, x + t - t * 0.045, y + t]
      ];
      for(const b of bordes){
        if(!esTierraVec(b[0], b[1])) continue;
        ctx.fillStyle = 'rgba(180,225,240,0.30)';       // el bajío
        ctx.fillRect(b[2], b[3], b[4], b[5]);
        // La ESPUMA: lametones quietos que RESPIRAN, no una línea discontinua
        // en marcha — aquello parecía el marcador de una zona y el autor
        // preguntó qué significaba. La espuma no desfila: lame y se retira.
        const largo = Math.hypot(b[8] - b[6], b[9] - b[7]);
        const ux = (b[8] - b[6]) / largo, uy = (b[9] - b[7]) / largo;
        // hacia dónde bomba el lametón: del lado de tierra hacia el agua
        const angAgua = Math.atan2(-b[1], -b[0]);
        ctx.lineWidth = Math.max(1, t * 0.02);
        for(let e = 0; e < 3; e++){
          const q = 0.16 + e * 0.32 + ((c * 7 + f * 13 + e * 5) % 10) * 0.012;
          const px2 = b[6] + ux * largo * q, py2 = b[7] + uy * largo * q;
          const resp = 0.5 + 0.5 * Math.sin(this.tiempo * 1.2 + c * 1.7 + f * 2.3 + e * 2.1);
          ctx.strokeStyle = `rgba(255,255,255,${(0.12 + 0.34 * resp).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px2, py2, t * (0.045 + 0.02 * resp), angAgua - 1.25, angAgua + 1.25);
          ctx.stroke();
        }
      }
    }

    // ONDAS, no líneas. Antes eran senos a lo ancho de la casilla, y una celda
    // con corriente horizontal no se parecía en nada a una vertical: el río
    // cambiaba de textura en cada codo. Ahora son arcos cortos repartidos por la
    // tesela que DERIVAN en la dirección del cauce; el dibujo es el mismo mire
    // hacia donde mire, y solo cambia por dónde se van.
    const deriva = (this.tiempo * 0.16) % 1;
    const filas = 3, porFila = 3;
    for(let fy = 0; fy < filas; fy++){
      for(let fx = 0; fx < porFila; fx++){
        // posición base, más un corrimiento por fila para que no formen rejilla
        let u = (fx + 0.5) / porFila + (fy % 2) * (0.5 / porFila);
        let w = (fy + 0.5) / filas;
        // la deriva corre a lo largo del cauce y da la vuelta por el otro lado
        if(horizontal) u = (u + deriva) % 1;
        else w = (w + deriva) % 1;

        const px = x + t * u, py = y + t * w;
        const r = t * 0.11;
        // se desvanece al entrar y al salir, para que no aparezcan de golpe
        const borde = horizontal ? u : w;
        const alfa = 0.20 * Math.sin(borde * Math.PI);
        if(alfa <= 0.01) continue;

        ctx.strokeStyle = `rgba(255,255,255,${alfa})`;
        ctx.lineWidth = Math.max(1, t * 0.022);
        ctx.beginPath();
        ctx.arc(px, py + r * 0.5, r, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${alfa * 0.5})`;
        ctx.beginPath();
        ctx.arc(px, py + r * 0.9, r * 0.55, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    }
  }

  /** Tierra: llano, arbolado o relieve. Cada familia con sus tres variantes. */
  pintarTierra(celda, c, f, x, y, t, base, v){
    const ctx = this.ctx;
    const def = CONFIG.terrenos[celda.tipo] || CONFIG.terrenos.prado;
    const fam = def.familia;

    if(fam === 'llano'){
      // Las tres se distinguen por lo que tienen ENCIMA, no solo por el color:
      // el prado va peinado, el pastizal echa matas altas y el pedregal está
      // sembrado de piedras. Es lo que hace que veas de un vistazo por dónde
      // sale caro pasar, sin tener que consultar ninguna tabla.
      ctx.strokeStyle = mezclarColor(base, '#000000', 0.18);
      ctx.lineWidth = Math.max(1, t * 0.02);
      const briznas = celda.tipo === 'pastizal' ? 6 : 3;
      const largo = celda.tipo === 'pastizal' ? 0.15 : 0.09;
      for(let k = 0; k < briznas; k++){
        const px = x + t * (0.15 + ((v * 7 + k * 0.37) % 1) * 0.7);
        const py = y + t * (0.30 + ((v * 13 + k * 0.61) % 1) * 0.55);
        const alto = t * largo;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + alto * 0.4, py - alto * 0.6, px + alto * 0.15, py - alto);
        ctx.stroke();
      }
      if(celda.tipo === 'pedregal'){
        for(let k = 0; k < 5; k++){
          const px = x + t * (0.14 + ((v * 11 + k * 0.29) % 1) * 0.72);
          const py = y + t * (0.24 + ((v * 5 + k * 0.53) % 1) * 0.60);
          const r = t * (0.030 + ((v * 3 + k * 0.17) % 1) * 0.028);
          this.sombraPieza(px, py, r * 0.9, r * 0.34, 0.18);
          ctx.fillStyle = aclarar(base, 0.22);
          ctx.beginPath(); ctx.ellipse(px, py - r * 0.3, r, r * 0.72, 0, 0, 7); ctx.fill();
          ctx.fillStyle = oscurecer(base, 0.20);
          ctx.beginPath(); ctx.ellipse(px + r * 0.3, py - r * 0.15, r * 0.55, r * 0.42, 0, 0, 7); ctx.fill();
        }
      }
      // FLORECILLAS de primavera en el prado: llegan con la estación y se van
      // con ella. La paleta del año ya existía; esto es aprovecharla.
      const flor = this.primavera || 0;
      if(flor > 0.05 && celda.tipo === 'prado'){
        const colores = ['#f6f3e7', '#f2d24d', '#e88bb1'];
        for(let k = 0; k < 4; k++){
          const px = x + t * (0.12 + ((v * 19 + k * 0.43) % 1) * 0.76);
          const py = y + t * (0.20 + ((v * 23 + k * 0.71) % 1) * 0.66);
          ctx.globalAlpha = flor * 0.9;
          ctx.fillStyle = colores[k % colores.length];
          ctx.beginPath(); ctx.arc(px, py, t * 0.022, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath(); ctx.arc(px, py, t * 0.008, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      return;
    }

    if(fam === 'arbolado'){
      let verde = def.color;
      if(this.paletaAño && CONFIG.estiloMapa.tinteEstacion > 0)
        verde = mezclarColor(verde, this.paletaAño.follaje, CONFIG.estiloMapa.tinteEstacion * 1.3);
      const nieve = Math.max(0, this.invierno || 0);

      // Cuántos árboles y cómo de altos. La DENSIDAD es la información: el
      // matorral son arbustos bajos y dispersos y el bosque cerrado una masa
      // apretada, así que si te lo encuentras tupido ya sabes que cruzarlo va a
      // costar sin necesidad de leer el precio.
      // El BOSQUE CERRADO ya no es "un pinar con más conos": es frondoso, de
      // copas redondas por lóbulos — el contraste de siluetas (cono contra
      // nube) es lo que hace legible la familia de un vistazo. Y todos los
      // árboles llevan TINTA, como las piezas (petición del autor: los
      // árboles se veían pobres).
      const perfil = {
        matorral: { n: 3, alto: 0.24, an: 0.13, mata: true },
        pinar:    { n: 4, alto: 0.44, an: 0.15 },
        bosque:   { n: 5, alto: 0.42, an: 0.18, frondoso: true }
      }[celda.tipo] || { n: 4, alto: 0.44, an: 0.15 };

      const tinta = `rgba(14,21,29,${CONFIG.estiloMapa.tinta * 0.8})`;
      const sitios = [[0.26, 0.58], [0.60, 0.48], [0.42, 0.80], [0.76, 0.70],
                      [0.16, 0.82], [0.66, 0.90]];
      for(let i = 0; i < perfil.n; i++){
        const rnd = (v * 13.7 + i * 2.31) % 1;
        const px = x + t * sitios[i][0], baseY = y + t * sitios[i][1];
        const esc = 0.86 + rnd * 0.34;
        const an = t * perfil.an * esc, alto = t * perfil.alto * esc;
        const claro = aclarar(verde, 0.14 + rnd * 0.16);
        const oscuro = oscurecer(verde, 0.34 + rnd * 0.14);
        // un lóbulo de follaje con su contorno: el ladrillo de matas y copas
        const lobulo = (lx, ly, r, color) => {
          ctx.fillStyle = tinta;
          ctx.beginPath(); ctx.arc(lx, ly, r + Math.max(1, t * 0.012), 0, 7); ctx.fill();
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(lx, ly, r, 0, 7); ctx.fill();
        };

        this.sombraPieza(px, baseY, an * 0.9, an * 0.30, 0.22);

        if(perfil.mata){
          // arbusto: dos bollos y sin tronco. Un matorral no tiene copa.
          lobulo(px, baseY - alto * 0.42, an * 0.78, oscuro);
          lobulo(px - an * 0.3, baseY - alto * 0.60, an * 0.52, claro);
          continue;
        }

        if(perfil.frondoso){
          // FRONDOSO: tronco corto y copa de tres lóbulos, del oscuro de la
          // base a la luz de arriba — una nube de follaje, no un cono
          ctx.fillStyle = tinta;
          ctx.fillRect(px - an * 0.11, baseY - alto * 0.34, an * 0.22, alto * 0.36);
          ctx.fillStyle = '#4a3524';
          ctx.fillRect(px - an * 0.08, baseY - alto * 0.32, an * 0.16, alto * 0.34);
          lobulo(px + an * 0.32, baseY - alto * 0.50, an * 0.62, oscuro);
          lobulo(px - an * 0.34, baseY - alto * 0.55, an * 0.58, mezclarColor(claro, oscuro, 0.5));
          lobulo(px, baseY - alto * 0.78, an * 0.56, claro);
          // el brillo de la copa, arriba a la izquierda como toda la luz
          ctx.fillStyle = aclarar(claro, 0.22);
          ctx.beginPath();
          ctx.arc(px - an * 0.18, baseY - alto * 0.88, an * 0.24, 0, 7); ctx.fill();
          if(nieve > 0.02){
            ctx.fillStyle = 'rgba(240,248,255,' + (0.6 * nieve) + ')';
            ctx.beginPath();
            ctx.ellipse(px, baseY - alto * 0.86, an * 0.5, an * 0.22, 0, 0, 7);
            ctx.fill();
          }
          continue;
        }

        // PINO: tronco y faldones en cono, ahora con su silueta a tinta
        ctx.fillStyle = tinta;
        ctx.fillRect(px - an * 0.12, baseY - alto * 0.20, an * 0.24, alto * 0.22);
        ctx.fillStyle = '#4a3524';
        ctx.fillRect(px - an * 0.09, baseY - alto * 0.18, an * 0.18, alto * 0.19);
        ctx.fillStyle = '#33251a';
        ctx.fillRect(px + an * 0.02, baseY - alto * 0.18, an * 0.07, alto * 0.19);

        const faldones = rnd > 0.55 ? 4 : 3;
        for(let k = 0; k < faldones; k++){
          const w = an * (1 - k * (0.78 / faldones));
          const yb = baseY - alto * (0.14 + k * (0.72 / faldones));
          const yt = yb - alto * (0.40 / faldones * 1.6);
          // la tinta del faldón, debajo de sus dos caras
          ctx.strokeStyle = tinta;
          ctx.lineWidth = Math.max(1, t * 0.016);
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(px - w, yb); ctx.lineTo(px, yt); ctx.lineTo(px + w, yb);
          ctx.stroke();
          ctx.fillStyle = claro;
          ctx.beginPath();
          ctx.moveTo(px, yt); ctx.lineTo(px - w, yb);
          ctx.lineTo(px - w * 0.45, yb); ctx.lineTo(px, yb - alto * 0.05);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = oscuro;
          ctx.beginPath();
          ctx.moveTo(px, yt); ctx.lineTo(px + w, yb);
          ctx.lineTo(px + w * 0.45, yb); ctx.lineTo(px, yb - alto * 0.05);
          ctx.closePath(); ctx.fill();
          if(nieve > 0.02){
            ctx.fillStyle = 'rgba(240,248,255,' + (0.55 * nieve) + ')';
            ctx.beginPath();
            ctx.moveTo(px, yt); ctx.lineTo(px - w * 0.55, yb - alto * 0.03);
            ctx.lineTo(px - w * 0.2, yb - alto * 0.04);
            ctx.closePath(); ctx.fill();
          }
        }
      }
      return;
    }

    if(fam === 'relieve'){
      /* REHECHO ENTERO (el autor, dos veces: "las montañas no parecen
         reales"). El fallo era de raíz: un triángulo de dos caras no es una
         montaña — al ojo lo convence la SILUETA DENTADA, no el volumen. La
         colina pasa a ser un lomo redondeado con el hueso de piedra
         asomando; la sierra y la roca viva, un MACIZO de cresta irregular
         con caras low-poly (los tramos que bajan a la derecha, en sombra) y
         el nevero siguiendo la cresta. Todo determinista por celda: la
         misma montaña sale igual en cada fotograma y en la ficha. */
      const az = n => (Math.sin(v * 91.7 + n * 47.3) + 1) / 2;
      const roca = def.color;
      const base = y + t * 0.80;

      if(celda.tipo === 'colina'){
        const cx = x + t * (0.5 + (v - 0.5) * 0.10);
        const R = t * (0.28 + v * 0.08);
        // el lomo es ASIMÉTRICO y cada colina carga el peso a un lado: tres
        // lomas simétricas en fila cantaban a sello de goma
        const sesgo = (az(1) - 0.5) * 0.5;
        const lomaPath = (lx, r) => {
          const cima = lx + r * sesgo;
          ctx.beginPath();
          ctx.moveTo(lx - r, base);
          ctx.quadraticCurveTo(cima - r * 0.6, base - r * (0.9 + az(2) * 0.2),
                               cima, base - r * (0.92 + az(2) * 0.16));
          ctx.quadraticCurveTo(cima + r * 0.55, base - r * 0.85, lx + r, base);
          ctx.closePath();
        };
        this.sombraPieza(cx + R * 0.2, base + t * 0.015, R * 1.5, R * 0.5, 0.18);
        // la loma de atrás, apagada; la grande, delante y con su luz
        ctx.fillStyle = oscurecer(roca, 0.16);
        lomaPath(cx + R * 0.62, R * 0.70); ctx.fill();
        ctx.fillStyle = roca;
        lomaPath(cx - R * 0.10, R); ctx.fill();
        ctx.save();
        lomaPath(cx - R * 0.10, R); ctx.clip();
        // el cel-shading parte de la CIMA (que va sesgada), no del centro:
        // con el pliegue en el centro fijo, la colina inclinada quedaba rara
        const cimaX = cx - R * 0.10 + R * sesgo;
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        ctx.fillRect(cimaX, base - R * 1.2, R * 1.4, R * 1.3);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(cx - R * 0.10 - R, base - R * 1.2, (cimaX - (cx - R * 0.10 - R)) * 0.45, R * 1.3);
        // el hueso de PIEDRA asomando por la ladera: eso la hace colina y no
        // un montículo de hierba
        ctx.fillStyle = oscurecer(roca, 0.34);
        for(let k = 0; k < 3; k++){
          const rr = R * (0.10 + az(k + 4) * 0.08);
          ctx.beginPath();
          ctx.ellipse(cx - R * 0.5 + R * az(k) * 1.0,
                      base - R * (0.25 + az(k + 8) * 0.35),
                      rr, rr * 0.55, (az(k) - 0.5) * 0.6, 0, 7);
          ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = `rgba(14,21,29,${CONFIG.estiloMapa.tinta * 0.7})`;
        ctx.lineWidth = Math.max(1, t * 0.016);
        lomaPath(cx - R * 0.10, R); ctx.stroke();
        return;
      }

      // SIERRA y ROCA VIVA: el macizo de cresta dentada
      const esRoca = celda.tipo === 'roca';
      const cx = x + t * 0.5;
      const W = t * (0.40 + v * 0.04);
      const altoMax = t * (esRoca ? 0.60 : 0.46) * (0.92 + v * 0.16);
      const nP = esRoca ? 7 : 6;

      const pts = [[cx - W, base]];
      let iCumbre = 1;
      for(let k = 1; k < nP; k++){
        const q = k / nP;
        const h = altoMax * Math.pow(Math.sin(q * Math.PI), 0.7)
                          * (0.55 + az(k) * 0.5);
        pts.push([cx - W + 2 * W * q + (az(k + 9) - 0.5) * W * 0.10, base - h]);
        if(pts[k][1] < pts[iCumbre][1]) iCumbre = k;
      }
      pts.push([cx + W, base]);
      // la cumbre principal, a tope: sin protagonista salía un lomo cualquiera
      pts[iCumbre][1] = base - altoMax;

      const silueta = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for(let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.closePath();
      };

      this.sombraPieza(cx + W * 0.1, base + t * 0.015, W * 1.7, W * 0.5, 0.20);

      ctx.fillStyle = aclarar(roca, 0.14);
      silueta(); ctx.fill();

      ctx.save();
      silueta(); ctx.clip();
      // el low-poly honesto: la luz del juego viene de la izquierda, así que
      // cada tramo de cresta que BAJA hacia la derecha es una cara en sombra
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      for(let k = 0; k < pts.length - 1; k++){
        if(pts[k + 1][1] <= pts[k][1]) continue;
        ctx.beginPath();
        ctx.moveTo(pts[k][0], pts[k][1]);
        ctx.lineTo(pts[k + 1][0], pts[k + 1][1]);
        ctx.lineTo(pts[k + 1][0], base);
        ctx.lineTo(pts[k][0], base);
        ctx.closePath(); ctx.fill();
      }
      // GRIETAS quebradas cayendo de las cumbres
      ctx.strokeStyle = 'rgba(0,0,0,0.20)';
      ctx.lineWidth = Math.max(1, t * 0.014);
      for(const k of [iCumbre, Math.min(pts.length - 2, iCumbre + 2)]){
        ctx.beginPath();
        ctx.moveTo(pts[k][0], pts[k][1] + t * 0.02);
        ctx.lineTo(pts[k][0] + (az(k + 3) - 0.5) * t * 0.10,
                   pts[k][1] + (base - pts[k][1]) * 0.5);
        ctx.lineTo(pts[k][0] + (az(k + 5) - 0.5) * t * 0.16, base - t * 0.02);
        ctx.stroke();
      }
      // el NEVERO siguiendo la cresta, con el borde bajo en dientes; la roca
      // viva va más vestida de blanco que la sierra
      const nieveY = base - altoMax * (esRoca ? 0.52 : 0.70);
      ctx.fillStyle = 'rgba(244,248,252,0.95)';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], Math.max(pts[0][1], nieveY));
      for(let k = 0; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
      for(let k = pts.length - 1; k >= 0; k--)
        ctx.lineTo(pts[k][0],
                   Math.max(pts[k][1] + t * 0.02, nieveY + (az(k) - 0.5) * t * 0.07));
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // el filo de LUZ en los tramos que suben: es lo que hace arista
      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
      ctx.lineWidth = Math.max(1, t * 0.014);
      ctx.beginPath();
      for(let k = 0; k < pts.length - 1; k++){
        if(pts[k + 1][1] < pts[k][1]){
          ctx.moveTo(pts[k][0], pts[k][1]);
          ctx.lineTo(pts[k + 1][0], pts[k + 1][1]);
        }
      }
      ctx.stroke();

      // la pedrera al pie
      ctx.fillStyle = oscurecer(roca, 0.42);
      for(let k = 0; k < 4; k++){
        const rr = t * (0.018 + az(k + 20) * 0.02);
        ctx.beginPath();
        ctx.ellipse(cx - W * 0.8 + W * 1.6 * az(k + 30), base + t * 0.012,
                    rr, rr * 0.6, 0, 0, 7);
        ctx.fill();
      }

      // y la SILUETA a tinta, como todo lo que se levanta del suelo
      ctx.strokeStyle = `rgba(14,21,29,${CONFIG.estiloMapa.tinta * 0.9})`;
      ctx.lineWidth = Math.max(1, t * 0.018);
      ctx.lineJoin = 'round';
      silueta(); ctx.stroke();
    }
  }

  /**
   * LA ORILLA. Donde la tierra da al agua se pinta una franja de arena por el
   * lado que toca. Es un detalle pequeño y es, con diferencia, lo que más cambia
   * la cara del mapa: sin él, el río es un rectángulo azul recortado con tijera.
   */
  pintarOrilla(c, f, x, y, t){
    const ctx = this.ctx;
    const mapa = this._estado && this._estado.mapa;
    if(!mapa) return;
    const ancho = Math.max(2, t * 0.14);
    ctx.fillStyle = 'rgba(222,205,158,0.60)';
    const lados = [
      [0, -1, x, y, t, ancho],
      [0,  1, x, y + t - ancho, t, ancho],
      [-1, 0, x, y, ancho, t],
      [1,  0, x + t - ancho, y, ancho, t]
    ];
    for(const l of lados){
      const vec = celdaEn(mapa, c + l[0], f + l[1]);
      if(!vec || vec.oculta) continue;
      if(vec.tipo !== 'agua' && vec.tipo !== 'lago') continue;
      ctx.fillRect(l[2], l[3], l[4], l[5]);
    }
  }

  /**
   * EL CONTORNO DE LO EXPLORADO. Una linea dorada que rodea todo el territorio
   * abierto, no tesela a tesela: se dibuja solo el lado de cada casilla que da a
   * lo desconocido, y el conjunto sale como un unico perimetro continuo.
   *
   * Es lo que convierte un monton de casillas destapadas en TU territorio.
   */
  contornoExplorado(estado, c0, f0, c1, f1){
    const ctx = this.ctx, t = this.tam, E = CONFIG.estiloMapa;
    const g = t * E.separacion;
    ctx.strokeStyle = CONFIG.color.dorado;
    ctx.lineWidth = Math.max(2, t * 0.045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for(let f = f0; f <= f1; f++){
      for(let c = c0; c <= c1; c++){
        const celda = celdaEn(estado.mapa, c, f);
        if(!celda || celda.oculta) continue;
        const x = Math.round(c * t - estado.camara.x) + g;
        const y = Math.round(f * t - estado.camara.y) + g;
        const l = t - g * 2;
        // solo el lado que da a lo desconocido (o al borde del mundo)
        const lados = [[0, -1, x, y, x + l, y],
                       [0,  1, x, y + l, x + l, y + l],
                       [-1, 0, x, y, x, y + l],
                       [1,  0, x + l, y, x + l, y + l]];
        for(const s of lados){
          const vec = celdaEn(estado.mapa, c + s[0], f + s[1]);
          if(vec && !vec.oculta) continue;
          ctx.moveTo(s[2], s[3]); ctx.lineTo(s[4], s[5]);
        }
      }
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  /**
   * La marca del subsuelo en una casilla. Cuatro estados y se distinguen de un
   * vistazo, porque la decisión de dónde perforar se toma mirando el mapa:
   * estudiada sin nada (una trama tenue), con indicios (gotas), sondeo seco (un
   * aspa) y sondeo con agua (la gota llena y su halo).
   */
  marcaSubsuelo(celda, fx, fy, fl){
    const ctx = this.ctx, A = CONFIG.acuiferos;
    const px = fx + fl * 0.22, py = fy + fl * 0.78;   // esquina de abajo a la izquierda
    const r = fl * 0.10;

    if(celda.sondeo === 'positivo'){
      const clase = CONFIG.acuiferos.clases[celda.acuifero];
      const tono = clase ? clase.color : A.color;
      ctx.fillStyle = tono; ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(px, py, r * 2, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      this.gota(px, py, r, tono, true);
      return;
    }
    if(celda.sondeo === 'seco'){
      ctx.strokeStyle = '#8b8578';
      ctx.lineWidth = Math.max(1, fl * 0.035);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r);
      ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    // Estudiada: una trama de puntos muy tenue para saber por dónde has pasado
    ctx.fillStyle = A.color;
    ctx.globalAlpha = celda.indicios ? 0.9 : 0.16;
    if(celda.indicios) this.gota(px, py, r * 0.85, A.color, false);
    else { ctx.beginPath(); ctx.arc(px, py, fl * 0.022, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  /** Una gota: el símbolo del agua subterránea, rellena o solo perfilada. */
  gota(x, y, r, color, llena){
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.4);
    ctx.bezierCurveTo(x + r, y - r * 0.2, x + r * 0.9, y + r, x, y + r);
    ctx.bezierCurveTo(x - r * 0.9, y + r, x - r, y - r * 0.2, x, y - r * 1.4);
    if(llena){ ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, r * 0.34); ctx.stroke(); }
  }

  /**
   * La LINDE de las zonas protegidas: discontinua y verde, solo en los lados que
   * dan a terreno normal — el conjunto se lee como un único recinto vallado,
   * igual que hace el contorno dorado con lo explorado.
   */
  lindesProtegidas(estado, c0, f0, c1, f1){
    const ctx = this.ctx, t = this.tam, E = CONFIG.estiloMapa;
    const g = t * E.separacion;
    ctx.strokeStyle = CONFIG.proteccion.color;
    ctx.lineWidth = Math.max(1.5, t * 0.03);
    ctx.setLineDash([t * 0.10, t * 0.07]);
    ctx.beginPath();
    for(let f = f0; f <= f1; f++){
      for(let c = c0; c <= c1; c++){
        const celda = celdaEn(estado.mapa, c, f);
        if(!celda || !celda.protegida || celda.oculta) continue;
        const x = Math.round(c * t - estado.camara.x) + g;
        const y = Math.round(f * t - estado.camara.y) + g;
        const l = t - g * 2;
        const lados = [[0, -1, x, y, x + l, y], [0, 1, x, y + l, x + l, y + l],
                       [-1, 0, x, y, x, y + l], [1, 0, x + l, y, x + l, y + l]];
        for(const s of lados){
          const vec = celdaEn(estado.mapa, c + s[0], f + s[1]);
          if(vec && vec.protegida) continue;
          ctx.moveTo(s[2], s[3]); ctx.lineTo(s[4], s[5]);
        }
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Pasada de hallazgos: pueblos, ruinas y yacimientos, por encima de las redes. */
  dibujarHallazgos(estado){
    const t = this.tam, M = CONFIG.mapaMundo;
    const c0 = Math.max(0, Math.floor(estado.camara.x / t));
    const f0 = Math.max(0, Math.floor(estado.camara.y / t));
    const c1 = Math.min(M.cols - 1, Math.ceil((estado.camara.x + this._W) / t));
    const f1 = Math.min(M.filas - 1, Math.ceil((estado.camara.y + this._H) / t));
    for(let f = f0; f <= f1; f++){
      for(let c = c0; c <= c1; c++){
        const celda = celdaEn(estado.mapa, c, f);
        if(!celda || celda.oculta) continue;
        const x = Math.round(c * t - estado.camara.x);
        const y = Math.round(f * t - estado.camara.y);
        if(celda.arqueologia && celda.aflorado) this.dibujarYacimiento(celda, x, y, t);
        if(celda.hallazgo)
          // El dato extra se resuelve aquí, que es donde se sabe la casilla:
          // para un pueblo, sus habitantes (los reales o los sembrados); para
          // una señal, el núcleo sin resolver más cercano — su brújula.
          this.dibujarHallazgo(celda, x, y, t,
            celda.hallazgo === 'senal'
              ? nucleoMasCercano(estado.mapa, c, f)
              : this.habitantesDe(celda, estado, c, f));
        // EL NOMBRE, bajo el caserío: el mapa es el selector de pueblos
        // (las pestañas no escalaban) y un selector necesita rótulos. Solo
        // con zoom suficiente; de lejos serían hormigas.
        if(celda.hallazgo === 'pueblo' && t >= CONFIG.estiloMapa.zoomNombres){
          const p = estado.pueblos.find(pb => pb.col === c && pb.fila === f);
          this.rotuloPueblo(
            p ? p.nombre : nombreDeNucleo(celda.nombreIdx || 0),
            x + t / 2, y + t * 0.9, t,
            p && estado.pueblos.indexOf(p) === estado.puebloActivo, !p);
        }
      }
    }
  }

  /**
   * La placa con el nombre del pueblo. El ACTIVO en azul claro (es el que
   * responde a tus clics), los tuyos en blanco, los POR INCORPORAR en el
   * dorado de los hallazgos — el color ya dice de quién es cada uno.
   */
  rotuloPueblo(nombre, cx, cy, t, activo, ajeno){
    const ctx = this.ctx;
    const fs = Math.max(9, Math.round(t * 0.16));
    ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`;
    const w = ctx.measureText(nombre).width;
    ctx.fillStyle = 'rgba(8,14,22,0.62)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 - 5, cy - fs, w + 10, fs + 7, 4);
    ctx.fill();
    ctx.fillStyle = activo ? '#7fd4f7' : ajeno ? '#d9c58a' : '#e6eef5';
    ctx.textAlign = 'center';
    ctx.fillText(nombre, cx, cy + 2);
    ctx.textAlign = 'left';
  }

  /* ---------- lo que esconde una casilla ---------- */
  /**
   * Los hallazgos eran polígonos planos —una casita de dos trazos, un muro roto,
   * un rombo— y desentonaban al lado de unas piezas en isométrica. Ahora son
   * volúmenes con la misma luz que todo lo demás.
   *
   * El PUEBLO es el que más importa: es el objetivo del juego y lo que más se
   * mira. Se dibuja como un caserío de tres casas con sus tejados a dos aguas.
   */
  /** Cuánta gente vive en esa casilla: la de verdad si el pueblo ya es tuyo,
   *  la sembrada por la semilla si todavía está por incorporar. */
  habitantesDe(celda, estado, c, f){
    if(celda.hallazgo !== 'pueblo') return 0;
    const p = estado.pueblos.find(p => p.col === c && p.fila === f);
    return p ? p.habitantes : (celda.habIni || 0);
  }

  dibujarHallazgo(celda, x, y, t, extra){
    const habitantes = typeof extra === 'number' ? extra : 0;
    const ctx = this.ctx;
    const col = CONFIG.hallazgos.color[celda.hallazgo] || '#ffffff';
    const cx = x + t / 2, cy = y + t / 2;

    // Una ruina atendida YA NO ESTÁ: o te la has llevado al almacén o la has
    // puesto en marcha y ahora hay una construcción encima. Seguir pintando el
    // muro roto dejaba fantasmas por el mapa y ensuciaba la pieza reparada.
    if(celda.resuelto && celda.hallazgo === 'ruina') return;

    // La señal no late: es un cartel, no un premio pendiente
    if(!celda.resuelto && celda.hallazgo !== 'senal'){
      const pulso = 0.5 + Math.sin(this.tiempo * 3) * 0.5;
      ctx.globalAlpha = 0.20 + pulso * 0.28;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(cx, cy, t * 0.42, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // OJO: un pueblo INCORPORADO se pinta ENTERO. Hubo un 0.45 de alfa aquí
    // ("atendido = apagado", herencia de las ruinas) y el pueblo de origen
    // —el botón de bombear del juego— salía como deshabilitado. Lo que
    // distingue al que falta por incorporar es su halo latiendo, y basta.

    // sombra desplazada abajo-derecha, como manda la luz
    this.sombraPieza(cx, y + t * 0.72, t * 0.24, t * 0.08, 0.28);

    if(celda.hallazgo === 'pueblo')
      this.caserio(cx, y + t * 0.70, t, col, habitantes);
    else if(celda.hallazgo === 'ruina') this.ruina(cx, y + t * 0.70, t, col);
    else if(celda.hallazgo === 'senal') this.senal(cx, y + t * 0.72, t, extra);
    else return;

    ctx.globalAlpha = 1;
  }

  /**
   * Yacimiento aflorado: la cata abierta con sus catas cuadriculadas y los muros
   * de piedra asomando. Sin excavar sale con el cordón de obra puesto; excavado,
   * con la pasarela de visita, que es lo que dice que ya renta.
   */
  dibujarYacimiento(celda, x, y, t){
    const ctx = this.ctx;
    const A = CONFIG.arqueologia;
    const cx = x + t * 0.5, cy = y + t * 0.56;

    ctx.fillStyle = '#6b5a3e';
    ctx.beginPath();
    ctx.ellipse(cx, cy, t * 0.34, t * 0.20, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#7d6b4c';
    ctx.beginPath();
    ctx.ellipse(cx, cy - t * 0.012, t * 0.28, t * 0.16, 0, 0, 7);
    ctx.fill();

    // cuadrícula de la cata
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, t * 0.28, t * 0.16, 0, 0, 7); ctx.clip();
    for(let i = -2; i <= 2; i++){
      ctx.beginPath();
      ctx.moveTo(cx + i * t * 0.10, cy - t * 0.20);
      ctx.lineTo(cx + i * t * 0.10, cy + t * 0.20);
      ctx.moveTo(cx - t * 0.32, cy + i * t * 0.06);
      ctx.lineTo(cx + t * 0.32, cy + i * t * 0.06);
      ctx.stroke();
    }
    ctx.restore();

    // muros asomando
    ctx.fillStyle = '#b9ae95';
    for(const p of [[-0.13, -0.02, 0.10, 0.030], [0.05, 0.03, 0.13, 0.026],
                    [-0.02, -0.07, 0.06, 0.024]]){
      ctx.fillRect(cx + t * p[0], cy + t * p[1], t * p[2], t * p[3]);
    }

    if(celda.excavado){
      // pasarela de visita: es lo que se ve cuando el sitio ya está en valor
      ctx.strokeStyle = '#c9a97f';
      ctx.lineWidth = Math.max(1.5, t * 0.026);
      ctx.beginPath();
      ctx.moveTo(cx - t * 0.30, cy + t * 0.10);
      ctx.lineTo(cx + t * 0.06, cy - t * 0.02);
      ctx.lineTo(cx + t * 0.30, cy + t * 0.06);
      ctx.stroke();
    } else {
      // cordón de obra a rayas mientras no se excave
      const pulso = 0.55 + Math.sin(this.tiempo * 2.4) * 0.45;
      ctx.strokeStyle = A.color;
      ctx.lineWidth = Math.max(1.5, t * 0.024);
      ctx.setLineDash([t * 0.06, t * 0.05]);
      ctx.globalAlpha = 0.55 + pulso * 0.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, t * 0.36, t * 0.22, 0, 0, 7);
      ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }

  /**
   * Un caserío, del tamaño que le toque por población: de tres casas sueltas
   * (aldea) a una ciudad con iglesia. Los escalones y sus casas están en
   * `CONFIG.caserio`; aquí solo se pintan.
   */
  caserio(cx, suelo, t, color, habitantes){
    const esc = escalonCaserio(habitantes);
    // Muros claros y tejas rojas: el pueblo es el objetivo del juego y tiene que
    // cantar sobre el verde, no fundirse con él.
    const muro = mezclarColor(color, '#fff8e6', 0.62);
    const tejado = '#b4442a';
    // La iglesia va DETRÁS del caserío: es lo que se ve desde lejos, pero las
    // casas de delante tienen que taparle los pies o no se apoya en el suelo.
    if(esc.iglesia) this.iglesia(cx, suelo - t * 0.13, t, muro, tejado);
    // Y las casas, de atrás hacia delante (dy creciente): así se solapan bien
    // y el montón se lee como un caserío y no como un collage.
    const casas = esc.casas.slice().sort((a, b) => a[1] - b[1]);
    for(const casa of casas){
      const px = cx + t * casa[0], py = suelo + t * casa[1];
      const an = t * 0.15 * casa[2], al = t * 0.20 * casa[2];
      this.isoCaja(px, py, an, an * 0.5, al, muro);
      this.isoTejado(px, py - al, an, an * 0.5, t * 0.09 * casa[2], tejado);
    }
  }

  /**
   * La iglesia: lo que convierte un montón de casas en un pueblo de verdad.
   * Nave baja y campanario alto — es la silueta que se reconoce desde lejos.
   */
  iglesia(cx, suelo, t, muro, tejado){
    const ctx = this.ctx;
    const piedra = oscurecer(muro, 0.10);
    // la nave
    this.isoCaja(cx - t * 0.04, suelo, t * 0.10, t * 0.05, t * 0.15, piedra);
    this.isoTejado(cx - t * 0.04, suelo - t * 0.15, t * 0.10, t * 0.05,
                   t * 0.06, tejado);
    // el campanario, más alto y a un lado
    const bx = cx + t * 0.10, by = suelo + t * 0.01;
    this.isoCaja(bx, by, t * 0.045, t * 0.022, t * 0.26, piedra);
    // el hueco de la campana
    ctx.fillStyle = 'rgba(20,29,38,0.5)';
    ctx.fillRect(bx - t * 0.015, by - t * 0.23, t * 0.03, t * 0.045);
    // el chapitel
    this.isoTejado(bx, by - t * 0.26, t * 0.05, t * 0.025, t * 0.09,
                   oscurecer(tejado, 0.18));
  }

  /**
   * La SEÑAL DE CAMINO: poste de madera con su flecha apuntando al pueblo sin
   * resolver más cercano, y encima la distancia en casillas. Es la brújula
   * del explorador — encontrarla es encontrar un rumbo.
   */
  senal(cx, suelo, t, objetivo){
    const ctx = this.ctx;
    const madera = '#8a6a42';
    // sombra y poste
    this.sombraPieza(cx, suelo + t * 0.015, t * 0.10, t * 0.035, 0.25);
    ctx.fillStyle = oscurecer(madera, 0.30);
    ctx.fillRect(cx - t * 0.018, suelo - t * 0.30, t * 0.036, t * 0.31);
    ctx.fillStyle = madera;
    ctx.fillRect(cx - t * 0.018, suelo - t * 0.30, t * 0.018, t * 0.31);
    if(!objetivo) return;   // ya no queda a quién señalar
    // la FLECHA gira DE VERDAD hacia el pueblo. Hubo una versión con el giro
    // recortado a ±28° "para que la tabla se leyera"... y con destinos casi
    // verticales la flecha apuntaba de lado — lo cazó el autor comprobándola
    // sobre el mapa. La legibilidad no puede comerse la dirección: por eso
    // el NÚMERO ya no va en la tabla, va en su plaquita horizontal.
    const a = Math.atan2(objetivo.dy, objetivo.dx);
    const L = t * 0.26, alto = t * 0.10;
    ctx.save();
    ctx.translate(cx, suelo - t * 0.30);
    ctx.rotate(a);
    ctx.fillStyle = oscurecer(madera, 0.18);
    ctx.beginPath();
    ctx.moveTo(-L * 0.45, -alto / 2);
    ctx.lineTo(L * 0.68, -alto / 2);
    ctx.lineTo(L, 0);
    ctx.lineTo(L * 0.68, alto / 2);
    ctx.lineTo(-L * 0.45, alto / 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = oscurecer(madera, 0.45);
    ctx.lineWidth = Math.max(1, t * 0.014);
    ctx.stroke();
    ctx.restore();
    // la DISTANCIA, en su plaquita horizontal sobre el poste: legible siempre
    const py2 = suelo - t * 0.12;
    ctx.fillStyle = oscurecer(madera, 0.30);
    ctx.beginPath();
    ctx.roundRect(cx - t * 0.085, py2 - t * 0.075, t * 0.17, t * 0.15, t * 0.02);
    ctx.fill();
    ctx.fillStyle = '#f4ead2';
    ctx.font = `700 ${Math.max(8, t * 0.115)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.round(objetivo.d)), cx, py2 + 0.5);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  /** Instalación abandonada: muros derruidos y cascotes. */
  ruina(cx, suelo, t, color){
    // Era dos cajitas y tres piedras. Una ruina se lee por la LÍNEA DE
    // ROTURA: la esquina de un edificio sin techo, con el remate dentado,
    // un hueco de ventana y la maleza comiéndosela.
    const ctx = this.ctx;
    const piedra = mezclarColor(color, '#6b7280', 0.55);
    const tinta = `rgba(14,21,29,${CONFIG.estiloMapa.tinta * 0.9})`;
    const h = t * 0.27;
    this.sombraPieza(cx, suelo + t * 0.035, t * 0.24, t * 0.075, 0.22);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, t * 0.015);

    // muro izquierdo, a la luz, con la rotura en dientes
    ctx.fillStyle = aclarar(piedra, 0.08);
    ctx.beginPath();
    ctx.moveTo(cx - t * 0.21, suelo + t * 0.005);
    ctx.lineTo(cx, suelo + t * 0.05);
    ctx.lineTo(cx, suelo + t * 0.05 - h * 0.55);
    ctx.lineTo(cx - t * 0.055, suelo + t * 0.02 - h * 0.74);
    ctx.lineTo(cx - t * 0.115, suelo - h * 0.50);
    ctx.lineTo(cx - t * 0.21, suelo - h * 0.92);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = tinta; ctx.stroke();
    // el hueco de la ventana, al vacío
    ctx.fillStyle = 'rgba(10,16,24,0.8)';
    ctx.fillRect(cx - t * 0.165, suelo - h * 0.46, t * 0.055, t * 0.08);

    // muro derecho, en sombra y más caído
    ctx.fillStyle = oscurecer(piedra, 0.30);
    ctx.beginPath();
    ctx.moveTo(cx, suelo + t * 0.05);
    ctx.lineTo(cx + t * 0.165, suelo + t * 0.002);
    ctx.lineTo(cx + t * 0.165, suelo - h * 0.38);
    ctx.lineTo(cx + t * 0.09, suelo - h * 0.30);
    ctx.lineTo(cx + t * 0.04, suelo - h * 0.56);
    ctx.lineTo(cx, suelo + t * 0.05 - h * 0.55);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = tinta; ctx.stroke();

    // cascotes al pie, con su media sombra
    for(const p of [[-0.26, 0.055, 0.032], [0.06, 0.085, 0.026],
                    [0.23, 0.045, 0.024], [-0.05, 0.10, 0.020]]){
      const px = cx + t * p[0], py = suelo + t * p[1], r = t * p[2];
      ctx.fillStyle = oscurecer(piedra, 0.38);
      ctx.beginPath(); ctx.ellipse(px + r * 0.2, py + r * 0.2, r, r * 0.55, 0, 0, 7); ctx.fill();
      ctx.fillStyle = mezclarColor(piedra, '#ffffff', 0.10);
      ctx.beginPath(); ctx.ellipse(px, py, r * 0.85, r * 0.5, 0, 0, 7); ctx.fill();
    }
    // y la maleza que se la come: dos matojos verdes contra los muros
    ctx.fillStyle = '#4e7a3a';
    ctx.beginPath(); ctx.arc(cx - t * 0.19, suelo + t * 0.005, t * 0.045, 0, 7); ctx.fill();
    ctx.fillStyle = '#5e8c46';
    ctx.beginPath(); ctx.arc(cx + t * 0.15, suelo + t * 0.02, t * 0.038, 0, 7); ctx.fill();
  }

  /** Yacimiento: cristales asomando de la roca. */
  yacimiento(cx, suelo, t, color){
    const ctx = this.ctx;
    const cristales = [[-0.08, 0.26, 0.9], [0.06, 0.34, 1.0], [0.15, 0.20, 0.7]];
    for(const cr of cristales){
      const px = cx + t * cr[0], alto = t * cr[1] * 0.55, an = t * 0.055 * cr[2];
      ctx.fillStyle = aclarar(color, 0.30);
      ctx.beginPath();
      ctx.moveTo(px, suelo - alto); ctx.lineTo(px - an, suelo - alto * 0.30);
      ctx.lineTo(px, suelo); ctx.closePath(); ctx.fill();
      ctx.fillStyle = oscurecer(color, 0.28);
      ctx.beginPath();
      ctx.moveTo(px, suelo - alto); ctx.lineTo(px + an, suelo - alto * 0.30);
      ctx.lineTo(px, suelo); ctx.closePath(); ctx.fill();
    }
  }

  /* ---------- casilla tapada ---------- */
  /**
   * La niebla no es un cuadrado gris: es bruma posada sobre terreno que aún no
   * has pisado. Se pintan tres borrones por celda con el ruido de la propia
   * casilla, así el frente de exploración tiene bordes irregulares en vez de
   * parecer un muro de ladrillos.
   */
  dibujarNiebla(estado, celda, c, f, x, y, t){
    const ctx = this.ctx;
    const alcanzable = esAlcanzable(estado.mapa, c, f);
    const v = ruido(c, f);

    // La niebla es una ficha más, con el mismo hueco y el mismo redondeo: si la
    // tapada fuera un cuadrado a sangre, el frente de exploración se vería como
    // un muro liso en vez de como fichas por levantar.
    const E = CONFIG.estiloMapa;
    const g = t * E.separacion, r = t * E.radio;
    const fx = x + g, fy = y + g, fl = t - g * 2;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(fx, fy, fl, fl, r); ctx.clip();
    ctx.fillStyle = alcanzable ? '#26364a' : '#151d29';
    ctx.fillRect(fx, fy, fl, fl);

    // borrones de bruma: dan volumen y rompen la cuadrícula
    const tono = alcanzable ? 255 : 200;
    for(let k = 0; k < 3; k++){
      const px = x + t * (0.22 + ((v * 11 + k * 0.41) % 1) * 0.56);
      const py = y + t * (0.24 + ((v * 17 + k * 0.73) % 1) * 0.52);
      const r = t * (0.20 + ((v * 5 + k * 0.29) % 1) * 0.16);
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${tono},${tono},${tono},${alcanzable ? 0.075 : 0.035})`);
      g.addColorStop(1, `rgba(${tono},${tono},${tono},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
    }

    if(alcanzable){
      const faltan = clicsParaDestapar(c, f, celda.tipo, this.poder);
      const frac = celda.progreso / faltan;

      if(frac > 0){   // aro de progreso
        const r = t * 0.3;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = Math.max(3, t * 0.07);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x + t / 2, y + t / 2, r, 0, 7); ctx.stroke();
        ctx.strokeStyle = CONFIG.color.agua;
        ctx.beginPath();
        ctx.arc(x + t / 2, y + t / 2, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
      // clics que quedan
      ctx.font = `700 ${Math.round(t * 0.2)}px IBM Plex Mono, ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(207,220,232,0.85)';
      ctx.fillText(String(faltan - celda.progreso), x + t / 2, y + t / 2);
      ctx.textBaseline = 'alphabetic';
    } else {
      ctx.fillStyle = 'rgba(207,220,232,0.10)';
      ctx.font = `700 ${Math.round(t * 0.26)}px IBM Plex Sans, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', x + t / 2, y + t / 2);
      ctx.textBaseline = 'alphabetic';
    }

    ctx.restore();

    // Contorno de la ficha. Las que ya puedes abrir llevan filo claro: es lo que
    // enseña de un vistazo hasta dónde llegas.
    ctx.strokeStyle = alcanzable ? 'rgba(150,190,225,0.45)' : 'rgba(90,110,135,0.25)';
    ctx.lineWidth = Math.max(1, t * 0.02);
    ctx.beginPath(); ctx.roundRect(fx, fy, fl, fl, r); ctx.stroke();
  }

  /* ---------- tuberías tendidas ---------- */
  /**
   * Las conducciones eran dos líneas planas sobre unas teselas que ya tienen
   * volumen, y cantaba. Ahora se trazan en cuatro pasadas —sombra, cuerpo,
   * brillo y contenido— con la misma luz que el resto: el reflejo va arriba
   * porque el sol está arriba a la izquierda.
   *
   * Y las dos redes se leen distinto a propósito: por una TUBERÍA corren gotas;
   * una CARRETERA lleva marca vial discontinua. Antes eran la misma línea con
   * otro color.
   */
  dibujarTuberias(estado){
    const ctx = this.ctx, t = this.tam;
    if(!estado.tuberias.length) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const ordenRedes = Object.keys(CONFIG.redes);
    for(const tub of estado.tuberias){
      const clave = redDe(tub);
      const R = CONFIG.redes[clave] || CONFIG.redes.abastecimiento;
      // El CARRIL de esta red: desvío fijo en diagonal, igual para toda la
      // línea. En tramos horizontales separa en vertical y al revés — cuatro
      // redes por la misma casilla se ven las cuatro, en paralelo.
      const k = (ordenRedes.indexOf(clave) - (ordenRedes.length - 1) / 2)
                * t * CONFIG.estiloMapa.carril;
      const pts = tub.camino.map(p => ({
        x: p.col * t - estado.camara.x + t / 2 + k,
        y: p.fila * t - estado.camara.y + t / 2 + k
      }));
      // El GROSOR dice el calibre y el COLOR la red: el cuello de botella se
      // localiza mirando el mapa, sin abrir ninguna tabla.
      const escala = 1 + nivelDiametro(tub.dn, clave) * 0.55;
      const ancho = Math.max(3, t * 0.115 * escala);

      // 1. sombra arrojada, desplazada hacia abajo
      ctx.save();
      ctx.translate(0, ancho * 0.30);
      ctx.strokeStyle = 'rgba(0,0,0,0.32)';
      ctx.lineWidth = ancho * 1.15;
      this.trazo(pts);
      ctx.restore();

      // 2. cuerpo
      ctx.strokeStyle = oscurecer(R.color, 0.34);
      ctx.lineWidth = ancho * 1.15;
      this.trazo(pts);
      ctx.strokeStyle = R.color;
      ctx.lineWidth = ancho;
      this.trazo(pts);

      // 3. brillo: una línea fina desplazada hacia arriba. Es lo que convierte
      //    la banda plana en algo cilíndrico.
      ctx.save();
      ctx.translate(0, -ancho * 0.22);
      ctx.strokeStyle = aclarar(R.color, 0.40);
      ctx.lineWidth = Math.max(1, ancho * 0.22);
      this.trazo(pts);
      ctx.restore();

      // 4. lo que lleva dentro
      if(R.esVial) this.marcaVial(pts, ancho);
      else this.gotasEnRuta(pts, ancho, R.color);
    }
  }

  /** Marca vial discontinua, para que la carretera no parezca un tubo gris. */
  marcaVial(pts, ancho){
    const ctx = this.ctx;
    ctx.save();
    ctx.setLineDash([ancho * 0.9, ancho * 0.8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, ancho * 0.11);
    this.trazo(pts);
    ctx.restore();
  }

  /** Gotas viajando por dentro, para que se vea que la tubería lleva agua. */
  gotasEnRuta(pts, ancho, color){
    const ctx = this.ctx;
    ctx.fillStyle = aclarar(color, 0.55);
    const sep = ancho * 3.2, desfase = (this.tiempo * 34) % sep;
    let acum = -desfase;
    for(let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i + 1];
      const largo = Math.hypot(b.x - a.x, b.y - a.y);
      let d = -acum % sep; if(d < 0) d += sep;
      for(; d < largo; d += sep){
        const k = d / largo;
        ctx.beginPath();
        ctx.arc(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, ancho * 0.16, 0, 7);
        ctx.fill();
      }
      acum += largo;
    }
  }

  trazo(pts){
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  /* ---------- lo construido ---------- */
  /**
   * Cada pieza tiene su SILUETA, dibujada a mano. Antes eran todas el mismo
   * recuadro con una letra dentro, y una depuradora se distinguía de un depósito
   * por leer la inicial: eso no es un mapa, es una leyenda.
   *
   * Todas comparten la misma luz —clara arriba, oscura al lado derecho— y su
   * sombra en el suelo, que es lo que las asienta sobre el terreno.
   */
  /**
   * Qué piezas están SIN CONECTAR a su red. El autor colocó una potabilizadora
   * y nada en el mapa le decía si había quedado enganchada: la ficha lo cuenta,
   * pero solo si la seleccionas — la duda hay que resolverla mirando el mapa.
   * El recorrido de red es caro, así que se cachea y solo se rehace cuando
   * cambia lo construido o lo tendido.
   */
  piezasSueltas(estado){
    // Las averías entran en la firma: el recuento de conectadas las excluye,
    // y reparar una cambia la conectividad sin cambiar ningún otro número.
    const firma = estado.tuberias.length + ':' + estado.construcciones.length
                + ':' + estado.averias.length;
    if(this._sueltasFirma === firma) return this._sueltas;
    this._sueltasFirma = firma;
    this._sueltas = new Set();
    for(const [clave, r] of Object.entries(CONFIG.redes)){
      if(!r.piezas.length) continue;
      const enredadas = new Set(construccionesConectadas(estado, clave));
      for(const o of estado.construcciones)
        if(r.piezas.includes(o.tipo) && !enredadas.has(o)) this._sueltas.add(o);
    }
    return this._sueltas;
  }

  /** El cartel de SIN CONECTAR: un empalme abierto — dos cabos de tubo que
   *  no llegan a tocarse — en ámbar, el color de "esto pide una decisión". */
  marcaSinRed(x, y, t){
    const ctx = this.ctx;
    const r = Math.max(6, t * 0.16);
    const cx = x + t * 0.82, cy = y + t * 0.16;
    ctx.save();
    ctx.fillStyle = 'rgba(8,15,23,0.92)';
    ctx.strokeStyle = '#f5b544';
    ctx.lineWidth = Math.max(1, t * 0.02);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = Math.max(1.5, t * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.62, cy + r * 0.30); ctx.lineTo(cx - r * 0.12, cy + r * 0.06);
    ctx.moveTo(cx + r * 0.62, cy - r * 0.30); ctx.lineTo(cx + r * 0.12, cy - r * 0.06);
    ctx.stroke();
    ctx.restore();
  }

  dibujarConstrucciones(estado){
    const ctx = this.ctx, t = this.tam;
    const sueltas = this.piezasSueltas(estado);
    for(const obra of estado.construcciones){
      const x = obra.col * t - estado.camara.x, y = obra.fila * t - estado.camara.y;
      if(x < -t || y < -t || x > this._W || y > this._H) continue;
      const def = CONFIG.construibles[obra.tipo];

      // La TESELA ya es la base: la pieza no necesita zócalo, necesita VOLUMEN.
      // En la referencia los edificios ocupan casi toda la casilla y asoman por
      // encima de su borde superior, que es lo que los hace parecer objetos
      // puestos sobre el tablero y no dibujos estampados en la casilla.
      const E = CONFIG.estiloMapa;
      const lado = t * E.ladoPieza;
      const ox = x + (t - lado) / 2;
      const oy = y + (t - lado) / 2 - t * E.alturaPieza * 0.5;

      // VELO: se apaga y difumina el terreno de debajo antes de poner la pieza.
      // Sobre una montaña, el pico de detrás competía con el edificio y no se
      // leía ninguno de los dos. Es el equivalente barato a una profundidad de
      // campo: el fondo se va y la pieza se queda delante.
      const E0 = CONFIG.estiloMapa;
      const rv = t * E0.difuminaPieza;
      const velo = ctx.createRadialGradient(x + t * 0.5, y + t * 0.55, rv * 0.15,
                                            x + t * 0.5, y + t * 0.55, rv);
      velo.addColorStop(0, `rgba(10,18,26,${E0.veloPieza})`);
      velo.addColorStop(1, 'rgba(10,18,26,0)');
      ctx.fillStyle = velo;
      ctx.fillRect(x - t * 0.1, y - t * 0.1, t * 1.2, t * 1.2);

      // Sobre agua no hay sombra arrojada: hay reflejo y ondas alrededor de los
      // pilotes. Una elipse negra sobre el río era justo lo que hacía que la
      // captación pareciera flotar en el aire.
      // La sombra va DONDE APOYA LA PIEZA, no en un punto fijo de la casilla.
      // Estaba puesta a ojo en y+0.72t mientras la silueta, ya escalada y subida
      // por `alturaPieza`, apoyaba en y+0.53t: veinte centesimas de casilla de
      // aire debajo, y de ahi que el bombeo pareciera flotar. Se calcula igual
      // que la silueta para que no puedan volver a separarse.
      const baseY = oy + lado * 0.70;
      const suelo = celdaEn(estado.mapa, obra.col, obra.fila);
      if(suelo && (suelo.tipo === 'agua' || suelo.tipo === 'lago'))
        this.reflejoEnAgua(x + t * 0.5, baseY, lado * 0.22, lado * 0.075);
      else
        this.sombraPieza(x + t * 0.5, baseY, lado * 0.26, lado * 0.085);

      // La silueta se dibuja siempre en su caja de t x t y se ESCALA aquí, así
      // ningún dibujo de pieza tiene que saber nada del tamaño final.
      // Una pieza SIN CONECTAR se pinta apagada y con su cartel: sin red no
      // trabaja, y eso tiene que verse desde el mapa, no solo en la ficha.
      // (La averiada ya lleva su propia marca: no se le suma esta.)
      const suelta = sueltas.has(obra) && !averiaEn(estado, obra.col, obra.fila);
      ctx.save();
      if(suelta) ctx.globalAlpha = 0.55;
      ctx.translate(ox, oy);
      ctx.scale(lado / t, lado / t);
      this.silueta(obra.tipo, 0, 0, t, def.color, obra);
      ctx.restore();
      if(suelta) this.marcaSinRed(x, y, t);

      // El vertedero enseña cuánto vaso le queda: cuando se llena deja de
      // tragar, y eso hay que verlo venir sin abrir ningún panel.
      if(obra.tipo === 'vertedero'){
        const frac = llenadoVaso(obra);
        const bw = t * 0.62, bx = x + (t - bw) / 2, by = y + t * 0.86;
        const bh = Math.max(3, t * 0.07);
        ctx.fillStyle = 'rgba(6,15,24,0.75)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = frac >= 1 ? CONFIG.color.critico
                      : (frac > 0.8 ? CONFIG.color.alarma : '#c9a97f');
        ctx.fillRect(bx, by, bw * frac, bh);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      }
    }
  }

  /**
   * LA SOMBRA VA DESPLAZADA. Si la pones justo debajo del objeto, el objeto
   * flota: una sombra centrada es la de una luz cenital perfecta, y aquí la luz
   * viene de arriba a la IZQUIERDA. Tiene que caer abajo y a la derecha.
   *
   * Y no todo lleva sombra arrojada: la montaña ES el suelo, no algo apoyado
   * encima, y lo que está sobre el agua no proyecta sombra dura sino que se
   * refleja. Poner una elipse negra debajo de todo era lo que hacía que las
   * piezas parecieran calcomanías flotando.
   */
  sombraPieza(cx, baseY, rx, ry, fuerza = 0.30){
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(0,0,0,${fuerza})`;
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.42, baseY + ry * 0.55, rx, ry, 0, 0, 7);
    ctx.fill();
  }

  /** Lo que está sobre el agua no da sombra: da reflejo y ondas. */
  reflejoEnAgua(cx, baseY, rx, ry){
    const ctx = this.ctx;
    // El reflejo arranca EN la base y se estira hacia abajo. Separado del objeto
    // volvía a leerse como una sombra suelta, que es justo lo que se quería
    // quitar: lo que flota es lo que tiene una mancha oscura debajo y despegada.
    const g = ctx.createLinearGradient(0, baseY - ry, 0, baseY + ry * 2.2);
    g.addColorStop(0, 'rgba(8,26,44,0.30)');
    g.addColorStop(1, 'rgba(8,26,44,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, baseY + ry * 0.5, rx * 0.85, ry * 1.6, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(1, rx * 0.07);
    for(let k = 0; k < 2; k++){
      const e = 1 + k * 0.5 + Math.sin(this.tiempo * 1.6 + k) * 0.12;
      ctx.beginPath();
      ctx.ellipse(cx, baseY, rx * e, ry * e, 0, 0, 7);
      ctx.stroke();
    }
  }

  /* ================================================================
     VOLUMEN ISOMÉTRICO
     Las piezas se dibujan en 3/4 de verdad: una cara superior en rombo y dos
     laterales. La luz viene de arriba a la izquierda SIEMPRE, así que la tapa
     es la más clara, la cara izquierda intermedia y la derecha la oscura. Si
     añades una pieza nueva, respétalo o cantará al lado de las demás.

     `W` es el medio ancho del rombo en pantalla y `H` su medio alto; la
     proporción 2:1 (H = W/2) es la isometría de toda la vida.
     ================================================================ */

  /** Prisma isométrico: la caja base de casi todo. */
  isoCaja(cx, baseY, W, H, alto, color){
    const ctx = this.ctx;
    const ty = baseY - alto;
    const izq = aclarar(color, 0.02);
    const der = oscurecer(color, 0.34);
    const tapa = aclarar(color, 0.30);

    ctx.fillStyle = izq;                      // cara izquierda
    ctx.beginPath();
    ctx.moveTo(cx - W, baseY - H * 0);
    ctx.lineTo(cx, baseY + H);
    ctx.lineTo(cx, ty + H);
    ctx.lineTo(cx - W, ty);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = der;                      // cara derecha
    ctx.beginPath();
    ctx.moveTo(cx + W, baseY);
    ctx.lineTo(cx, baseY + H);
    ctx.lineTo(cx, ty + H);
    ctx.lineTo(cx + W, ty);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = tapa;                     // tapa en rombo
    ctx.beginPath();
    ctx.moveTo(cx, ty - H);
    ctx.lineTo(cx + W, ty);
    ctx.lineTo(cx, ty + H);
    ctx.lineTo(cx - W, ty);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = oscurecer(color, 0.55);
    ctx.lineWidth = Math.max(0.8, W * 0.05);
    ctx.stroke();

    // La TINTA: silueta exterior en oscuro, como el arte de los minijuegos.
    // Es lo que despega la pieza del terreno (probado a petición del autor).
    const tinta = CONFIG.estiloMapa.tinta;
    if(tinta > 0){
      ctx.strokeStyle = `rgba(14,21,29,${tinta})`;
      ctx.lineWidth = Math.max(1, W * 0.075);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - W, baseY);
      ctx.lineTo(cx, baseY + H);
      ctx.lineTo(cx + W, baseY);
      ctx.lineTo(cx + W, ty);
      ctx.lineTo(cx, ty - H);
      ctx.lineTo(cx - W, ty);
      ctx.closePath();
      ctx.stroke();
    }
  }

  /** Cilindro isométrico: depósitos, tanques y decantadores. */
  isoCilindro(cx, baseY, W, H, alto, color){
    const ctx = this.ctx;
    const ty = baseY - alto;
    ctx.fillStyle = color;                    // cuerpo
    ctx.beginPath();
    ctx.moveTo(cx - W, baseY);
    ctx.lineTo(cx - W, ty);
    ctx.ellipse(cx, ty, W, H, 0, Math.PI, 0);
    ctx.lineTo(cx + W, baseY);
    ctx.ellipse(cx, baseY, W, H, 0, 0, Math.PI);
    ctx.closePath(); ctx.fill();
    // sombra propia en el lado derecho, que es de donde no viene la luz
    ctx.fillStyle = oscurecer(color, 0.30);
    ctx.beginPath();
    ctx.moveTo(cx + W * 0.30, baseY + H * 0.55);
    ctx.lineTo(cx + W * 0.30, ty);
    ctx.ellipse(cx, ty, W, H, 0, 0, Math.PI * 0.35);
    ctx.lineTo(cx + W, baseY);
    ctx.ellipse(cx, baseY, W, H, 0, 0, Math.PI * 0.5);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = aclarar(color, 0.32);     // tapa
    ctx.beginPath(); ctx.ellipse(cx, ty, W, H, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = oscurecer(color, 0.5);
    ctx.lineWidth = Math.max(0.8, W * 0.05);
    ctx.stroke();

    // La TINTA: silueta exterior del cilindro (ver isoCaja)
    const tinta = CONFIG.estiloMapa.tinta;
    if(tinta > 0){
      ctx.strokeStyle = `rgba(14,21,29,${tinta})`;
      ctx.lineWidth = Math.max(1, W * 0.075);
      ctx.beginPath();
      ctx.moveTo(cx - W, baseY);
      ctx.lineTo(cx - W, ty);
      ctx.ellipse(cx, ty, W, H, 0, Math.PI, 0);
      ctx.lineTo(cx + W, baseY);
      ctx.ellipse(cx, baseY, W, H, 0, 0, Math.PI);
      ctx.closePath();
      ctx.stroke();
    }
  }

  /**
   * Cubierta a cuatro aguas sobre la tapa de una caja. Antes esto dibujaba un
   * caballete plano por el borde de atrás y quedaba ESCONDIDO tras la propia
   * tapa: las casetas parecían cubos pelados. Una pirámide sobre el rombo sí se
   * lee desde este ángulo, y solo hacen falta las dos caras que se ven.
   *
   * `ty` es la Y del centro de la tapa; `alto` lo que sube la cumbrera.
   */
  isoTejado(cx, ty, W, H, alto, color){
    const ctx = this.ctx;
    const cumbre = ty - alto;
    const O = [cx - W, ty], S = [cx, ty + H], E = [cx + W, ty];

    ctx.fillStyle = aclarar(color, 0.14);          // faldón izquierdo (a la luz)
    ctx.beginPath();
    ctx.moveTo(O[0], O[1]); ctx.lineTo(S[0], S[1]); ctx.lineTo(cx, cumbre);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = oscurecer(color, 0.26);        // faldón derecho (en sombra)
    ctx.beginPath();
    ctx.moveTo(S[0], S[1]); ctx.lineTo(E[0], E[1]); ctx.lineTo(cx, cumbre);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = oscurecer(color, 0.45);
    ctx.lineWidth = Math.max(0.8, W * 0.06);
    ctx.beginPath();
    ctx.moveTo(O[0], O[1]); ctx.lineTo(S[0], S[1]); ctx.lineTo(E[0], E[1]);
    ctx.moveTo(S[0], S[1]); ctx.lineTo(cx, cumbre);
    ctx.stroke();

    // La TINTA: el perímetro del tejado (ver isoCaja)
    const tinta = CONFIG.estiloMapa.tinta;
    if(tinta > 0){
      ctx.strokeStyle = `rgba(14,21,29,${tinta})`;
      ctx.lineWidth = Math.max(1, W * 0.07);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(O[0], O[1]); ctx.lineTo(cx, cumbre); ctx.lineTo(E[0], E[1]);
      ctx.lineTo(S[0], S[1]); ctx.closePath();
      ctx.stroke();
    }
  }

  /* ---------- detalles finos de las piezas ----------
     Lo que separa un volumen de un edificio: puertas, ventanas, escalerillas,
     barandillas y las piezas que se mueven. Va aparte de `silueta` porque son
     adornos reutilizables, no la forma de nada. */

  /** Ventanas iluminadas en una cara. `n` por fila, repartidas. */
  ventanas(x, y, an, al, n, color){
    const ctx = this.ctx;
    const w = an / (n * 2 + 1), h = al * 0.26;
    for(let i = 0; i < n; i++){
      const px = x + w * (1 + i * 2);
      ctx.fillStyle = color;
      ctx.fillRect(px, y + al * 0.22, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(px, y + al * 0.22, w, h * 0.28);
    }
  }

  /** Puerta con dintel. */
  puerta(cx, baseY, an, al, color){
    const ctx = this.ctx;
    ctx.fillStyle = oscurecer(color, 0.55);
    ctx.fillRect(cx - an / 2, baseY - al, an, al);
    ctx.fillStyle = oscurecer(color, 0.30);
    ctx.fillRect(cx - an / 2, baseY - al, an, al * 0.14);
  }

  /** Escalerilla de gato: dos largueros y sus peldaños. */
  escalerilla(px, baseY, alto, an, color){
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.7, an * 0.16);
    ctx.beginPath();
    ctx.moveTo(px - an / 2, baseY); ctx.lineTo(px - an / 2, baseY - alto);
    ctx.moveTo(px + an / 2, baseY); ctx.lineTo(px + an / 2, baseY - alto);
    const n = Math.max(3, Math.round(alto / (an * 0.9)));
    for(let i = 1; i < n; i++){
      const yy = baseY - (alto * i) / n;
      ctx.moveTo(px - an / 2, yy); ctx.lineTo(px + an / 2, yy);
    }
    ctx.stroke();
  }

  /** Barandilla sobre el borde de un rombo (la tapa de un cilindro o caja). */
  barandilla(cx, cy, W, H, altoPost, color){
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.7, W * 0.045);
    ctx.beginPath();
    ctx.ellipse(cx, cy - altoPost, W, H, 0, 0, 7);
    ctx.stroke();
    for(let a = 0; a < 8; a++){
      const ang = (a / 8) * Math.PI * 2;
      const px = cx + Math.cos(ang) * W, py = cy + Math.sin(ang) * H;
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(px, py - altoPost);
      ctx.stroke();
    }
  }

  /** Zunchos horizontales de un depósito metálico. */
  zunchos(cx, baseY, W, H, alto, n, color){
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.7, W * 0.05);
    for(let i = 1; i <= n; i++){
      const yy = baseY - (alto * i) / (n + 1);
      ctx.beginPath();
      ctx.ellipse(cx, yy, W, H, 0, 0, Math.PI);
      ctx.stroke();
    }
  }

  /**
   * Humo saliendo de una chimenea. Las bocanadas suben, se abren y se
   * desvanecen; el desfase por índice hace que no salgan todas a la vez.
   */
  humo(px, py, r, n = 3){
    const ctx = this.ctx;
    for(let i = 0; i < n; i++){
      const fase = (this.tiempo * 0.5 + i / n) % 1;
      const sube = fase * r * 5;
      const crece = r * (0.5 + fase * 1.5);
      ctx.fillStyle = `rgba(220,228,236,${0.30 * (1 - fase)})`;
      ctx.beginPath();
      ctx.arc(px + Math.sin(fase * 3 + i) * r * 0.8, py - sube, crece, 0, 7);
      ctx.fill();
    }
  }

  /**
   * Lámina de agua dentro de un cilindro abierto, hasta la fracción `frac`.
   * Es el detalle que convierte el depósito en un depósito: se ve lo que tienes.
   */
  laminaEnCilindro(cx, baseY, W, H, alto, frac, color){
    if(frac <= 0.01) return;
    const ctx = this.ctx;
    const y = baseY - alto * frac;
    ctx.fillStyle = mezclarColor(color, '#0b3550', 0.55);
    ctx.beginPath();
    ctx.moveTo(cx - W, y);
    ctx.lineTo(cx - W, baseY);
    ctx.ellipse(cx, baseY, W, H, 0, Math.PI, 0, true);
    ctx.lineTo(cx + W, y);
    ctx.ellipse(cx, y, W, H, 0, 0, Math.PI);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = aclarar(mezclarColor(color, '#2b7fa8', 0.5), 0.20);
    ctx.beginPath(); ctx.ellipse(cx, y, W, H, 0, 0, 7); ctx.fill();
  }

  /** La forma concreta de cada pieza, ya en isométrica y con sus detalles. */
  silueta(tipo, x, y, t, color, obra){
    const ctx = this.ctx;
    const cx = x + t * 0.5, suelo = y + t * 0.70;
    const W = t * 0.30, H = W * 0.5;
    const metal = 'rgba(230,240,250,0.75)';
    const luz = 'rgba(255,214,120,0.92)';

    switch(tipo){
      case 'deposito': {      // depósito elevado: zunchos, escalerilla y baranda
        this.isoCaja(cx, suelo, W * 0.34, H * 0.34, t * 0.20, oscurecer(color, 0.42));
        const alto = t * 0.30, rw = W * 0.72, rh = H * 0.72;
        this.isoCilindro(cx, suelo - t * 0.20, rw, rh, alto, color);
        // EL NIVEL SE VE. `vivo.lleno` sale del agua que de verdad tienes en el
        // pueblo activo: el depósito deja de ser un adorno y pasa a ser el
        // mismo dato que la barra de abajo, pero puesto donde está la cosa.
        // SOLO si está CONECTADO: un depósito sin tubería llenándose y
        // vaciándose al ritmo del pueblo no es lógico (lo cazó el autor
        // jugando el tutorial) — sin red, se queda vacío, como debe.
        const enchufado = obra && this._estado
          && casillaEnRed(this._estado, obra.col, obra.fila, 'abastecimiento');
        if(this.vivo && enchufado){
          ctx.save();
          ctx.globalAlpha = 0.85;
          this.laminaEnCilindro(cx, suelo - t * 0.20, rw * 0.86, rh * 0.86,
                                alto * 0.88, this.vivo.lleno, color);
          ctx.restore();
        }
        this.zunchos(cx, suelo - t * 0.20, rw, rh, alto, 2, 'rgba(0,0,0,0.22)');
        this.escalerilla(cx - rw * 0.72, suelo - t * 0.20, alto * 0.92, W * 0.13, metal);
        this.barandilla(cx, suelo - t * 0.20 - alto, rw, rh, t * 0.045, metal);
        break;
      }

      case 'bomba': {
        // ESTACIÓN DE BOMBEO, rehecha para que se ENTIENDA (el autor no la
        // leía): la caseta se encoge y el protagonista pasa a ser el GRUPO
        // DE BOMBEO a la vista — cuerpo de bomba azul, motor y la tubería
        // de impulsión gorda con sus bridas. Una caseta sola era una casita.
        const an = W * 0.62, al = t * 0.22;
        // EL GOLPE. Al clicar, el conjunto da un respingo y suelta vapor: es
        // la pieza del clic principal y era la única que no reaccionaba.
        const g = this.golpe > 0 ? this.golpe / CONFIG.estiloMapa.duracionGolpe : 0;
        if(g > 0){
          ctx.save();
          ctx.translate(0, Math.sin(g * Math.PI * 3) * t * 0.02 * g);
        }
        // la caseta, más pequeña y a un lado
        this.isoCaja(cx - W * 0.38, suelo - t * 0.01, an, an * 0.5, al, color);
        this.puerta(cx - W * 0.20, suelo - t * 0.01, an * 0.30, al * 0.62, color);
        this.isoTejado(cx - W * 0.38, suelo - t * 0.01 - al, an, an * 0.5,
                       t * 0.09, oscurecer(color, 0.15));
        // EL GRUPO DE BOMBEO, fuera y a la vista: bancada, cuerpo azul
        // horizontal y motor acoplado
        const gx = cx + W * 0.48, gy = suelo + t * 0.03;
        this.isoCaja(gx, gy, W * 0.42, H * 0.42, t * 0.045, oscurecer(color, 0.35));
        const azul = '#3f7fb5';
        // cuerpo de la bomba (cilindro tumbado)
        ctx.fillStyle = azul;
        ctx.beginPath();
        ctx.ellipse(gx, gy - t * 0.095, W * 0.34, t * 0.055, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = aclarar(azul, 0.25);
        ctx.beginPath();
        ctx.ellipse(gx - W * 0.1, gy - t * 0.115, W * 0.20, t * 0.028, 0, 0, 7);
        ctx.fill();
        // el motor, un tambor más claro en el extremo
        ctx.fillStyle = oscurecer(azul, 0.25);
        ctx.beginPath();
        ctx.ellipse(gx + W * 0.30, gy - t * 0.095, W * 0.11, t * 0.05, 0, 0, 7);
        ctx.fill();
        // la IMPULSIÓN: tubería gorda que sube y cruza hacia la caseta,
        // con sus bridas marcadas
        ctx.strokeStyle = metal;
        ctx.lineWidth = Math.max(2.5, t * 0.055);
        ctx.beginPath();
        ctx.moveTo(gx - W * 0.28, gy - t * 0.10);
        ctx.lineTo(gx - W * 0.28, suelo - t * 0.30);
        ctx.lineTo(cx - W * 0.38, suelo - t * 0.34);
        ctx.stroke();
        ctx.lineWidth = Math.max(1.5, t * 0.02);
        for(const [fx2, fy2] of [[gx - W * 0.28, suelo - t * 0.20],
                                 [cx - W * 0.05, suelo - t * 0.325]]){
          ctx.beginPath();
          ctx.moveTo(fx2 - t * 0.03, fy2); ctx.lineTo(fx2 + t * 0.03, fy2);
          ctx.stroke();
        }
        // manómetro: el circulito con aguja que dice "aquí hay presión"
        const mx = gx - W * 0.28, my = suelo - t * 0.36;
        ctx.fillStyle = '#e8eef4';
        ctx.beginPath(); ctx.arc(mx, my, t * 0.035, 0, 7); ctx.fill();
        ctx.strokeStyle = '#b8452e'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx, my);
        ctx.lineTo(mx + t * 0.02, my - t * 0.02); ctx.stroke();
        if(g > 0){
          ctx.restore();
          // vapor: sale de golpe y se deshace, como el escape de una bomba
          for(let i = 0; i < 3; i++){
            const q = 1 - g + i * 0.18;
            if(q < 0 || q > 1) continue;
            ctx.fillStyle = `rgba(226,238,248,${0.42 * (1 - q)})`;
            ctx.beginPath();
            ctx.arc(cx - an * 0.55 + q * an * 0.5, suelo - t * 0.32 - q * t * 0.16,
                    t * (0.020 + q * 0.045), 0, 7);
            ctx.fill();
          }
        }
        break;
      }

      case 'captacion': {
        // OBRA DE TOMA, rehecha para que se ENTIENDA (el autor no la leía):
        // sus tres señas del oficio, exageradas — la REJA de barrotes por la
        // que entra el agua, el VOLANTE rojo de la compuerta y la TUBERÍA
        // gruesa que se lleva lo captado.
        // pilotes clavados al lecho
        ctx.strokeStyle = oscurecer(color, 0.55);
        ctx.lineWidth = Math.max(1.5, t * 0.030);
        for(const dx of [-0.55, 0, 0.55]){
          ctx.beginPath();
          ctx.moveTo(cx + W * dx, suelo + t * 0.10);
          ctx.lineTo(cx + W * dx, suelo - t * 0.02);
          ctx.stroke();
        }
        this.isoCaja(cx, suelo, W * 0.9, H * 0.9, t * 0.08, color);      // plataforma
        this.barandilla(cx, suelo - t * 0.08, W * 0.9, H * 0.9, t * 0.05, metal);
        // la TORRE de toma, con su cara frontal abierta en REJA
        const an = W * 0.52, al = t * 0.26, techoT = suelo - t * 0.08;
        this.isoCaja(cx, techoT, an, an * 0.5, al, aclarar(color, 0.08));
        // la boca: hueco oscuro con barrotes bien visibles
        const bx = cx - an * 0.78, by = techoT - al * 0.82;
        const bw = an * 1.15, bh = al * 0.62;
        ctx.fillStyle = 'rgba(10,22,32,0.85)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = metal;
        ctx.lineWidth = Math.max(1, t * 0.016);
        for(let i = 1; i <= 4; i++){
          const px = bx + (bw * i) / 5;
          ctx.beginPath(); ctx.moveTo(px, by); ctx.lineTo(px, by + bh); ctx.stroke();
        }
        // el VOLANTE de la compuerta, rojo óxido sobre la torre: la señal
        // universal de "aquí se abre y se cierra el agua"
        const vx = cx + an * 0.55, vy = techoT - al - t * 0.055, vr = t * 0.055;
        ctx.strokeStyle = '#b8452e';
        ctx.lineWidth = Math.max(1.5, t * 0.022);
        ctx.beginPath(); ctx.ellipse(vx, vy, vr, vr * 0.45, 0, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(vx - vr, vy); ctx.lineTo(vx + vr, vy);
        ctx.moveTo(vx, vy - vr * 0.45); ctx.lineTo(vx, vy + vr * 0.45);
        ctx.stroke();
        ctx.strokeStyle = oscurecer('#b8452e', 0.3);
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx, techoT - al); ctx.stroke();
        // la TUBERÍA que se lleva el agua: gruesa, con bridas, hacia tierra
        ctx.strokeStyle = metal;
        ctx.lineWidth = Math.max(2.5, t * 0.055);
        ctx.beginPath();
        ctx.moveTo(cx + an * 0.9, techoT - al * 0.35);
        ctx.lineTo(cx + W * 1.15, techoT - al * 0.35);
        ctx.lineTo(cx + W * 1.15, suelo + t * 0.06);
        ctx.stroke();
        ctx.lineWidth = Math.max(1.5, t * 0.02);
        ctx.beginPath();
        ctx.moveTo(cx + W * 1.02, techoT - al * 0.35 - t * 0.035);
        ctx.lineTo(cx + W * 1.02, techoT - al * 0.35 + t * 0.035);
        ctx.stroke();
        break;
      }

      case 'potabilizadora': {
        // ETAP: FILTROS en batería — balsas RECTANGULARES con lámina de agua
        // clara (los círculos son de la depuradora: cuadrado = beber, círculo
        // = devolver), más la caseta de cloración con su tanque blanco.
        for(const dx of [-0.34, 0.32]){
          const px = cx + W * dx;
          this.isoCaja(px, suelo, W * 0.40, H * 0.40, t * 0.055, color);
          const tyB = suelo - t * 0.055, w2 = W * 0.32, h2 = H * 0.32;
          ctx.fillStyle = mezclarColor('#8fd8f2', color, 0.20);
          ctx.beginPath();
          ctx.moveTo(px, tyB - h2); ctx.lineTo(px + w2, tyB);
          ctx.lineTo(px, tyB + h2); ctx.lineTo(px - w2, tyB);
          ctx.closePath(); ctx.fill();
          // el brillo del agua en calma
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.ellipse(px - w2 * 0.25, tyB - h2 * 0.2, w2 * 0.28, h2 * 0.22, 0, 0, 7);
          ctx.fill();
        }
        // caseta de cloración y su tanque blanco
        this.isoCaja(cx + W * 0.72, suelo - t * 0.015, W * 0.20, H * 0.20,
                     t * 0.15, aclarar(color, 0.10));
        this.isoCilindro(cx - W * 0.72, suelo - t * 0.015, W * 0.13, H * 0.13,
                         t * 0.15, '#dde8f0');
        break;
      }

      case 'depuradora': {    // decantadores con el PUENTE DE RASQUETAS girando
        for(const dx of [-0.42, 0.42]){
          const px = cx + W * dx, rw = W * 0.46, rh = H * 0.46;
          this.isoCilindro(px, suelo, rw, rh, t * 0.08, color);
          // lámina de agua
          ctx.fillStyle = mezclarColor(color, '#08251a', 0.60);
          ctx.beginPath();
          ctx.ellipse(px, suelo - t * 0.08, rw * 0.76, rh * 0.76, 0, 0, 7);
          ctx.fill();
          // el puente gira despacio: es lo que dice que la planta ESTÁ tratando
          // El puente gira SOLO si el pueblo genera aguas residuales. Una planta
          // barriendo un decantador vacío contaría una mentira.
          const marcha = (this.vivo && this.vivo.trata) ? 1 : 0;
          const ang = this.tiempo * 0.5 * marcha + (dx > 0 ? 1.7 : 0);
          ctx.strokeStyle = metal;
          ctx.lineWidth = Math.max(1, t * 0.020);
          ctx.beginPath();
          ctx.moveTo(px - Math.cos(ang) * rw * 0.78, suelo - t * 0.08 - Math.sin(ang) * rh * 0.78);
          ctx.lineTo(px + Math.cos(ang) * rw * 0.78, suelo - t * 0.08 + Math.sin(ang) * rh * 0.78);
          ctx.stroke();
          ctx.fillStyle = metal;
          ctx.beginPath();
          ctx.arc(px, suelo - t * 0.085, Math.max(1, t * 0.016), 0, 7);
          ctx.fill();
          this.barandilla(px, suelo - t * 0.08, rw, rh, t * 0.032, 'rgba(230,240,250,0.55)');
        }
        break;
      }

      case 'tanque': {        // tanque de tormentas: zunchos y boca de hombre
        const rw = W * 0.92, rh = H * 0.92, alto = t * 0.17;
        this.isoCilindro(cx, suelo, rw, rh, alto, color);
        this.zunchos(cx, suelo, rw, rh, alto, 2, 'rgba(0,0,0,0.20)');
        ctx.fillStyle = oscurecer(color, 0.45);
        ctx.beginPath();
        ctx.ellipse(cx + rw * 0.28, suelo - alto, rw * 0.22, rh * 0.22, 0, 0, 7);
        ctx.fill();
        this.escalerilla(cx - rw * 0.74, suelo, alto * 0.95, W * 0.11, metal);
        break;
      }

      case 'acuifero': {      // castillete con polea y cable
        this.isoCaja(cx, suelo, W * 0.55, H * 0.55, t * 0.05, oscurecer(color, 0.35));
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, t * 0.030);
        ctx.beginPath();
        ctx.moveTo(cx - W * 0.5, suelo - t * 0.05); ctx.lineTo(cx, suelo - t * 0.36);
        ctx.lineTo(cx + W * 0.5, suelo - t * 0.05);
        ctx.moveTo(cx - W * 0.30, suelo - t * 0.20); ctx.lineTo(cx + W * 0.30, suelo - t * 0.20);
        ctx.moveTo(cx - W * 0.17, suelo - t * 0.28); ctx.lineTo(cx + W * 0.17, suelo - t * 0.28);
        ctx.stroke();
        ctx.fillStyle = metal;
        ctx.beginPath(); ctx.arc(cx, suelo - t * 0.36, t * 0.022, 0, 7); ctx.fill();
        // El cable sube y baja mientras se capta: es el gesto que dice que el
        // sondeo está trabajando y no es un castillete abandonado.
        const bombeando = this.vivo && this.vivo.produce;
        const vaiven = bombeando
          ? (0.5 + Math.sin(this.tiempo * 2.2) * 0.5) * t * 0.16 : 0;
        ctx.strokeStyle = 'rgba(230,240,250,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, suelo - t * 0.36);
        ctx.lineTo(cx, suelo - t * 0.09 - vaiven);
        ctx.stroke();
        ctx.fillStyle = 'rgba(200,215,230,0.9)';
        ctx.fillRect(cx - t * 0.018, suelo - t * 0.09 - vaiven, t * 0.036, t * 0.04);
        break;
      }

      case 'vertedero': {
        // Una montera lisa por capas parecia una duna, no un vertedero. Lo que
        // lo hace vertedero es que sea IRREGULAR y que este CERCADO: un recinto
        // vallado, el vaso excavado y un monton de silueta dentada con cosas
        // asomando. Lo liso y simetrico lee como terreno; lo dentado, como
        // basura amontonada.
        const rw = W * 1.05, rh = H * 1.05;

        // el vaso: una depresion de tierra removida
        ctx.fillStyle = '#6b5b45';
        ctx.beginPath(); ctx.ellipse(cx, suelo, rw, rh, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#5a4c39';
        ctx.beginPath(); ctx.ellipse(cx, suelo, rw * 0.82, rh * 0.82, 0, 0, 7); ctx.fill();

        // el monton, con el borde dentado
        const alto = t * 0.19;
        ctx.fillStyle = oscurecer(color, 0.10);
        ctx.beginPath();
        ctx.moveTo(cx - rw * 0.80, suelo);
        const dientes = 9;
        for(let i = 0; i <= dientes; i++){
          const q = i / dientes;
          const px = cx - rw * 0.80 + rw * 1.60 * q;
          const forma = Math.sin(q * Math.PI);
          const ruidillo = ((i * 37) % 11) / 11 - 0.5;
          ctx.lineTo(px, suelo - alto * forma * (0.75 + ruidillo * 0.5));
        }
        ctx.lineTo(cx + rw * 0.80, suelo);
        ctx.closePath(); ctx.fill();
        // cara en sombra del monton
        ctx.fillStyle = oscurecer(color, 0.34);
        ctx.beginPath();
        ctx.moveTo(cx + rw * 0.10, suelo - alto * 0.72);
        ctx.lineTo(cx + rw * 0.80, suelo);
        ctx.lineTo(cx + rw * 0.10, suelo + rh * 0.28);
        ctx.closePath(); ctx.fill();

        // lo que asoma: chatarra, bolsas, tablones. Girado cada uno a su aire.
        const trastos = [[-0.52, 0.10, 0.034, '#8a9099'], [-0.20, 0.16, 0.028, '#7a5a3a'],
                         [0.12, 0.17, 0.030, '#5f6b74'], [0.44, 0.10, 0.026, '#8a7a4a'],
                         [-0.36, 0.05, 0.022, '#6f7d86'], [0.30, 0.04, 0.024, '#7a4a3a']];
        for(let i = 0; i < trastos.length; i++){
          const p = trastos[i];
          ctx.save();
          ctx.translate(cx + rw * p[0], suelo - alto * p[1] * 5);
          ctx.rotate((i * 1.3) % 2 - 1);
          ctx.fillStyle = p[3];
          ctx.fillRect(-t * p[2] / 2, -t * p[2] / 3, t * p[2], t * p[2] * 0.62);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(-t * p[2] / 2, t * p[2] * 0.16, t * p[2], t * p[2] * 0.13);
          ctx.restore();
        }

        // VALLADO perimetral: postes y malla. Es lo que dice "recinto" y no
        // "montana de tierra".
        ctx.strokeStyle = 'rgba(180,190,200,0.55)';
        ctx.lineWidth = Math.max(0.8, t * 0.012);
        ctx.beginPath();
        ctx.ellipse(cx, suelo + rh * 0.10, rw * 1.02, rh * 1.02, 0, 0, 7);
        ctx.stroke();
        for(let a = 0; a < 10; a++){
          const ang = (a / 10) * Math.PI * 2;
          const px = cx + Math.cos(ang) * rw * 1.02;
          const py = suelo + rh * 0.10 + Math.sin(ang) * rh * 1.02;
          ctx.beginPath();
          ctx.moveTo(px, py); ctx.lineTo(px, py - t * 0.055);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(180,190,200,0.35)';
        ctx.beginPath();
        ctx.ellipse(cx, suelo + rh * 0.10 - t * 0.055, rw * 1.02, rh * 1.02, 0, 0, 7);
        ctx.stroke();
        break;
      }

      case 'reciclaje': {     // nave con portón, ventanas, cinta y chimenea
        const an = W * 0.92, al = t * 0.22;
        this.isoCaja(cx, suelo, an, an * 0.5, al, color);
        this.ventanas(cx - an * 0.9, suelo - al, an * 0.7, al, 3, luz);
        this.puerta(cx + an * 0.45, suelo, an * 0.34, al * 0.72, color);
        this.isoTejado(cx, suelo - al, an, an * 0.5, t * 0.10, oscurecer(color, 0.18));
        // cinta transportadora entrando por el lateral
        ctx.strokeStyle = 'rgba(80,90,100,0.9)';
        ctx.lineWidth = Math.max(1.5, t * 0.026);
        ctx.beginPath();
        ctx.moveTo(cx - an * 1.15, suelo + t * 0.02);
        ctx.lineTo(cx - an * 0.35, suelo - al * 0.75);
        ctx.stroke();
        // chimenea, y humo SOLO cuando la planta está separando de verdad
        ctx.fillStyle = oscurecer(color, 0.40);
        ctx.fillRect(cx + an * 0.30, suelo - al - t * 0.16, t * 0.035, t * 0.16);
        if(this.vivo && this.vivo.recicla)
          this.humo(cx + an * 0.30 + t * 0.017, suelo - al - t * 0.17, t * 0.026);
        // el triángulo del reciclaje, en la fachada
        ctx.strokeStyle = '#0b1a12'; ctx.lineWidth = Math.max(1.2, t * 0.024);
        {
          const r = t * 0.055, cyy = suelo - al * 0.45;
          ctx.beginPath();
          ctx.moveTo(cx - an * 0.35, cyy - r);
          ctx.lineTo(cx - an * 0.35 + r * 0.87, cyy + r * 0.5);
          ctx.lineTo(cx - an * 0.35 - r * 0.87, cyy + r * 0.5);
          ctx.closePath(); ctx.stroke();
        }
        break;
      }

      default:
        this.isoCaja(cx, suelo, W * 0.8, H * 0.8, t * 0.22, color);
    }
  }

  /* ---------- lo que está roto ---------- */
  /**
   * La avería tiene SITIO. Se pinta encima de la pieza parada, con la brigada
   * esperando y los golpes de llave que le faltan: así el jugador sabe adónde
   * ir y cuánto le queda sin abrir ningún panel.
   */
  dibujarAverias(estado){
    const ctx = this.ctx, t = this.tam;
    for(const av of estado.averias || []){
      const x = av.col * t - estado.camara.x, y = av.fila * t - estado.camara.y;
      if(x < -t || y < -t || x > this._W || y > this._H) continue;
      const cx = x + t / 2, cy = y + t / 2;
      const pulso = 0.5 + Math.abs(Math.sin(this.tiempo * 3)) * 0.5;

      // halo de aviso, para localizarla de un vistazo aunque esté lejos
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, t * 0.75);
      halo.addColorStop(0, `rgba(239,68,68,${0.30 * pulso})`);
      halo.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - t * 0.25, y - t * 0.25, t * 1.5, t * 1.5);

      ctx.strokeStyle = CONFIG.color.critico;
      ctx.lineWidth = 2 + pulso * 1.5;
      ctx.strokeRect(x + 2, y + 2, t - 4, t - 4);

      // la llave inglesa y los clics que faltan
      ctx.font = `${Math.round(t * 0.34)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔧', cx, y + t * 0.26);
      ctx.font = `700 ${Math.round(t * 0.2)}px IBM Plex Mono, ui-monospace, monospace`;
      ctx.fillStyle = CONFIG.color.critico;
      ctx.fillText('×' + av.clics, cx, y + t * 0.78);
      ctx.textBaseline = 'alphabetic';
    }
  }

  /* ---------- previsualización de lo que vas a hacer ---------- */
  previsualizar(estado){
    const r = this.resaltada;
    if(!r || !estado.modo.tipo) return;
    const ctx = this.ctx, t = this.tam;
    const x = r.col * t - estado.camara.x, y = r.fila * t - estado.camara.y;

    if(estado.modo.tipo === 'colocar'){
      const v = puedeColocar(estado.mapa, estado.construcciones, estado.modo.elemento, r.col, r.fila);
      ctx.fillStyle = v.ok ? 'rgba(74,222,128,0.30)' : 'rgba(239,68,68,0.30)';
      ctx.fillRect(x, y, t, t);
      ctx.strokeStyle = v.ok ? CONFIG.color.ok : CONFIG.color.critico;
      ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, t - 3, t - 3);
      if(!v.ok) this.cartel(v.motivo, x + t / 2, y - 6, CONFIG.color.critico);
      else if(v.aviso) this.cartel(v.aviso, x + t / 2, y - 6, CONFIG.color.alarma);
      else this.cartel(formatear(CONFIG.construibles[estado.modo.elemento].coste) + ' €',
                       x + t / 2, y - 6, CONFIG.color.ok);
      return;
    }

    if(estado.modo.tipo === 'tuberia'){
      const trazado = estado.modo.trazado;

      // El trazado que llevas dibujado, casilla a casilla
      ctx.fillStyle = 'rgba(56,189,248,0.32)';
      for(const p of trazado){
        ctx.fillRect(p.col * t - estado.camara.x, p.fila * t - estado.camara.y, t, t);
      }
      if(trazado.length){
        const pts = trazado.map(p => ({
          x: p.col * t - estado.camara.x + t / 2,
          y: p.fila * t - estado.camara.y + t / 2
        }));
        ctx.strokeStyle = (CONFIG.redes[estado.redActual] || CONFIG.redes.abastecimiento).color;
        ctx.lineWidth = Math.max(2, t * 0.10 *
          (1 + nivelDiametro(estado.dnActual[estado.redActual], estado.redActual) * 0.55));
        ctx.setLineDash([t * 0.18, t * 0.12]);
        this.trazo(pts); ctx.setLineDash([]);
        // la última puesta, marcada: es donde se pincha para rematar
        const u = trazado[trazado.length - 1];
        ctx.strokeStyle = CONFIG.color.ok; ctx.lineWidth = 3;
        ctx.strokeRect(u.col * t - estado.camara.x + 2, u.fila * t - estado.camara.y + 2, t - 4, t - 4);
      }

      if(!trazado.length){
        this.cartel('Marca por dónde empieza', x + t / 2, y - 6, CONFIG.color.agua);
        return;
      }

      const total = costeTrazado(estado.mapa, trazado, estado.dnActual[estado.redActual], estado.redActual);
      const ultimo = trazado[trazado.length - 1];
      if(ultimo.col === r.col && ultimo.fila === r.fila){
        this.cartel(`Clic aquí: rematar · ${formatear(total)} €`, x + t / 2, y - 6,
                    estado.puedePagar(total) ? CONFIG.color.ok : CONFIG.color.critico);
        return;
      }
      // Coste de prolongar hasta donde señalas
      const v = puedeSeguirTrazado(estado.mapa, trazado, r.col, r.fila);
      const celda = celdaEn(estado.mapa, r.col, r.fila);
      if(v.ok && celda){
        const obra = CONFIG.tuberia.nombreObra[celda.tipo] || 'obra';
        ctx.fillStyle = 'rgba(74,222,128,0.28)'; ctx.fillRect(x, y, t, t);
        this.cartel(`+${formatear(costeCasillaTuberia(celda, estado.dnActual[estado.redActual], estado.redActual))} € (${obra}) · total ${formatear(total)} €`,
                    x + t / 2, y - 6, CONFIG.color.ok);
      } else {
        this.cartel(v.motivo || 'Ahí no', x + t / 2, y - 6, CONFIG.color.critico);
      }
    }
  }

  /** Cartelito con pastilla, para que se lea sobre cualquier terreno. */
  cartel(texto, cx, y, color){
    const ctx = this.ctx;
    const tam = Math.max(10, Math.round(this.tam * 0.16));
    ctx.font = `700 ${tam}px IBM Plex Mono, ui-monospace, monospace`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(texto).width, pad = 7;
    ctx.fillStyle = 'rgba(8,16,26,0.85)';
    ctx.beginPath(); ctx.roundRect(cx - w / 2 - pad, y - tam - 6, w + pad * 2, tam + 8, 5); ctx.fill();
    ctx.fillStyle = color; ctx.fillText(texto, cx, y - 2);
  }

  /* ---------- marco de la casilla bajo el cursor ---------- */
  marcoResaltado(estado){
    const r = this.resaltada;
    if(!r) return;
    const t = this.tam;
    const x = r.col * t - estado.camara.x, y = r.fila * t - estado.camara.y;
    const celda = celdaEn(estado.mapa, r.col, r.fila);
    if(!celda) return;
    const puede = !celda.oculta || esAlcanzable(estado.mapa, r.col, r.fila);
    this.ctx.strokeStyle = puede ? '#ffffff' : 'rgba(255,255,255,0.25)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 1, y + 1, t - 2, t - 2);
  }
}

/** Ruido determinista 0..1 por celda. */
function ruido(c, f){
  const n = Math.sin(c * 127.1 + f * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
