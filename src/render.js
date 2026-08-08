/**
 * RENDER — todo el dibujo en el lienzo.
 *
 * Regla de oro: este módulo LEE el estado, nunca lo modifica. Si el
 * render tocara datos, sería imposible saber por qué algo cambia.
 *
 * Orden de capas, de abajo a arriba:
 *   terreno (precalculado) → tuberías → nodos → etiquetas → herramienta
 */

import { CONFIG } from './config.js';
import { limitar, formatearCaudal } from './util.js';

export class Render {

  constructor(lienzo, camara, terreno){
    this.lienzo = lienzo;
    this.ctx = lienzo.getContext('2d');
    this.camara = camara;
    this.terreno = terreno;
    this.tiempo = 0;
  }

  dibujar(grafo, estado, entrada, dt){
    const ctx = this.ctx, cam = this.camara;
    this.tiempo += dt;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = CONFIG.color.fondo;
    ctx.fillRect(0, 0, cam.anchoPantalla, cam.altoPantalla);

    this.dibujarTerreno();
    this.dibujarAristas(grafo);
    this.dibujarNodos(grafo, entrada);
    this.dibujarHerramienta(grafo, entrada);
    this.dibujarEscala();
  }

  /* ---------------- TERRENO ----------------
     Una sola llamada a drawImage. Todo el trabajo pesado se hizo una vez
     al arrancar, en terreno.dibujarCapa(). */

  dibujarTerreno(){
    if(!this.terreno.lienzo) return;
    const cam = this.camara, ctx = this.ctx;
    const e = 1 / this.terreno.escalaLienzo;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.terreno.lienzo,
      cam.mundoAPantallaX(0),
      cam.mundoAPantallaY(0),
      this.terreno.lienzo.width  * e * cam.zoom,
      this.terreno.lienzo.height * e * cam.zoom
    );

    // Marco del ámbito
    ctx.strokeStyle = 'rgba(120,160,190,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      cam.mundoAPantallaX(0), cam.mundoAPantallaY(0),
      CONFIG.mundo.ancho * cam.zoom, CONFIG.mundo.alto * cam.zoom
    );
  }

  /* ---------------- TUBERÍAS ---------------- */

  dibujarAristas(grafo){
    const ctx = this.ctx, cam = this.camara;

    for(const ar of grafo.aristas.values()){
      const a = grafo.nodos.get(ar.a), b = grafo.nodos.get(ar.b);
      if(!a || !b) continue;

      const x1 = cam.mundoAPantallaX(a.x), y1 = cam.mundoAPantallaY(a.y);
      const x2 = cam.mundoAPantallaX(b.x), y2 = cam.mundoAPantallaY(b.y);

      const tipo = CONFIG.diametros.find(d => d.dn === ar.dn);
      const grosor = Math.max(1.5, (ar.dn / 55) * cam.zoom * 1.6);

      // Tramo roto: rojo intermitente, imposible de pasar por alto
      if(ar.rota){
        const pulso = 0.55 + Math.sin(this.tiempo * 5) * 0.45;
        ctx.strokeStyle = CONFIG.color.critico;
        ctx.lineWidth = grosor + 2;
        ctx.globalAlpha = pulso;
        ctx.setLineDash([9, 6]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        continue;
      }

      // Trazo base: gris si no circula agua
      ctx.strokeStyle = ar.activa ? tipo.color : CONFIG.color.aguaSeca;
      ctx.lineWidth = grosor;
      ctx.lineCap = 'round';
      ctx.globalAlpha = ar.activa ? 0.95 : 0.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

      // Interior azul + gotas viajando, si hay caudal
      if(ar.activa){
        ctx.strokeStyle = CONFIG.color.aguaOk;
        ctx.lineWidth = Math.max(1, grosor * 0.45);
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

        if(cam.zoom > 0.2) this.dibujarGotas(x1, y1, x2, y2, ar.caudal, grosor);
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Puntos de luz recorriendo la tubería, a velocidad proporcional al caudal. */
  dibujarGotas(x1, y1, x2, y2, caudal, grosor){
    const ctx = this.ctx;
    const largo = Math.hypot(x2 - x1, y2 - y1);
    if(largo < 8) return;

    const separacion = 26;
    const velocidad = limitar(18 + caudal * 3.5, 18, 90);
    const desfase = (this.tiempo * velocidad) % separacion;
    const dx = (x2 - x1) / largo, dy = (y2 - y1) / largo;

    ctx.fillStyle = '#7dd3fc';
    for(let t = desfase; t < largo; t += separacion){
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(x1 + dx * t, y1 + dy * t, Math.max(1.2, grosor * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- NODOS ---------------- */

  dibujarNodos(grafo, entrada){
    const ctx = this.ctx, cam = this.camara;

    for(const n of grafo.nodos.values()){
      const def = CONFIG.elementos[n.tipo];
      const px = cam.mundoAPantallaX(n.x), py = cam.mundoAPantallaY(n.y);
      const r = Math.max(5, def.radio * cam.zoom * 0.85);

      // Fuera de pantalla: ni lo dibujamos
      if(px < -60 || py < -60 || px > cam.anchoPantalla + 60 || py > cam.altoPantalla + 60) continue;

      const seleccionado = entrada.seleccionado === n.id;
      const bajoCursor   = entrada.nodoBajoCursor === n.id;

      // Halo de estado para poblaciones
      if(n.tipo === 'poblacion'){
        const ok = n.abastecido;
        const pulso = 0.5 + Math.sin(this.tiempo * 2.4) * 0.5;
        ctx.beginPath();
        ctx.arc(px, py, r + 7 + pulso * 4, 0, Math.PI * 2);
        ctx.fillStyle = ok ? 'rgba(74,222,128,0.14)' : 'rgba(239,68,68,0.16)';
        ctx.fill();
      }

      // Cuerpo
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0f1c28';
      ctx.fill();
      ctx.lineWidth = seleccionado ? 3 : (bajoCursor ? 2.4 : 1.8);
      ctx.strokeStyle = seleccionado ? '#ffffff' : def.color;
      ctx.stroke();

      // Símbolo interior
      this.dibujarSimbolo(n, px, py, r, def.color);

      // Distintivos de los equipos instalados encima
      this.dibujarEquipos(n, px, py, r);

      // Etiqueta
      if(cam.zoom > 0.18){
        ctx.font = '600 10px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = def.color;
        const etq = n.nombre || def.nombre;
        ctx.fillText(etq, px, py - r - 7);

        if(cam.zoom > 0.34 && n.alturaPiezometrica !== null){
          ctx.font = '400 9px ui-monospace, Menlo, monospace';
          ctx.fillStyle = n.presion < CONFIG.hidraulica.presionMinima
            ? CONFIG.color.critico : CONFIG.color.tenue;
          ctx.fillText(`${n.presion.toFixed(0)} mca · ${n.cota.toFixed(0)} m`, px, py + r + 14);
        }
      }
    }
  }

  /** Iconos esquemáticos dentro del círculo de cada nodo. */
  dibujarSimbolo(n, px, py, r, color){
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.lineCap = 'round';
    const s = r * 0.52;

    ctx.beginPath();
    switch(n.tipo){
      case 'captacion':   // pozo: dos verticales
        ctx.moveTo(px - s * 0.5, py - s); ctx.lineTo(px - s * 0.5, py + s);
        ctx.moveTo(px + s * 0.5, py - s); ctx.lineTo(px + s * 0.5, py + s);
        break;
      case 'deposito': {  // depósito con lámina de agua
        ctx.rect(px - s, py - s * 0.7, s * 2, s * 1.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(px - s, py + s * 0.1, s * 2, s * 0.8);
        ctx.globalAlpha = 1;
        return;
      }
      case 'bombeo':      // triángulo de bomba
        ctx.moveTo(px - s * 0.8, py + s * 0.6);
        ctx.lineTo(px + s * 0.8, py + s * 0.6);
        ctx.lineTo(px, py - s * 0.8);
        ctx.closePath();
        break;
      case 'poblacion':   // casita
        ctx.moveTo(px - s, py + s * 0.7); ctx.lineTo(px - s, py - s * 0.1);
        ctx.lineTo(px, py - s * 0.8); ctx.lineTo(px + s, py - s * 0.1);
        ctx.lineTo(px + s, py + s * 0.7);
        break;
      case 'nudo':
        ctx.arc(px, py, s * 0.4, 0, Math.PI * 2);
        break;
    }
    ctx.stroke();
  }

  /**
   * Insignias de los equipos instalados en un nodo: bombeo y válvula.
   * Sin esto no hay forma de ver sobre el mapa dónde has puesto qué, y
   * son justo los dos elementos que explican las presiones raras.
   */
  dibujarEquipos(n, px, py, r){
    const ctx = this.ctx;
    const equipos = [];
    if(n.bombeos > 0) equipos.push({ clave: 'bombeo',  color: CONFIG.elementos.bombeo.color });
    if(n.valvula)     equipos.push({ clave: 'valvula', color: CONFIG.elementos.valvula.color });
    if(!equipos.length) return;

    const rb = Math.max(3.5, r * 0.40);
    let bx = px + r * 0.80, by = py - r * 0.80;

    for(const eq of equipos){
      ctx.beginPath();
      ctx.arc(bx, by, rb, 0, Math.PI * 2);
      ctx.fillStyle = '#0b1622'; ctx.fill();
      ctx.strokeStyle = eq.color; ctx.lineWidth = 1.2; ctx.stroke();

      const s = rb * 0.55;
      ctx.beginPath();
      if(eq.clave === 'bombeo'){
        // Triángulo hacia arriba: la impulsión sube el agua
        ctx.moveTo(bx - s, by + s); ctx.lineTo(bx + s, by + s); ctx.lineTo(bx, by - s);
      } else {
        // Lazo de dos triángulos: el símbolo de válvula de toda la vida
        ctx.moveTo(bx - s, by - s); ctx.lineTo(bx - s, by + s);
        ctx.lineTo(bx + s, by - s); ctx.lineTo(bx + s, by + s);
      }
      ctx.closePath();
      ctx.fillStyle = eq.color; ctx.fill();

      bx += rb * 2.2;
    }
  }

  /* ---------------- HERRAMIENTA ACTIVA ---------------- */

  dibujarHerramienta(grafo, entrada){
    const ctx = this.ctx, cam = this.camara;

    // Trazando una tubería: línea elástica desde el nodo de origen
    if(entrada.herramienta === 'tuberia' && entrada.origenTuberia !== null){
      const a = grafo.nodos.get(entrada.origenTuberia);
      if(a){
        const x1 = cam.mundoAPantallaX(a.x), y1 = cam.mundoAPantallaY(a.y);
        const x2 = cam.mundoAPantallaX(entrada.mundoX), y2 = cam.mundoAPantallaY(entrada.mundoY);

        ctx.setLineDash([7, 5]);
        ctx.strokeStyle = entrada.nodoBajoCursor ? CONFIG.color.ok : CONFIG.color.alarma;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);

        // Datos del tramo mientras lo trazas: longitud, desnivel y coste
        const cotaFin = this.terreno.cotaEn(entrada.mundoX, entrada.mundoY);
        const largo = Math.hypot(entrada.mundoX - a.x, entrada.mundoY - a.y);
        const desn = cotaFin - a.cota;
        ctx.font = '600 11px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = CONFIG.color.texto;
        ctx.fillText(`${largo.toFixed(0)} m`, x2 + 14, y2 - 6);
        ctx.fillStyle = desn > 0 ? CONFIG.color.alarma : CONFIG.color.ok;
        ctx.fillText(`${desn > 0 ? '+' : ''}${desn.toFixed(0)} m de cota`, x2 + 14, y2 + 9);
        // Coste en euros: sin esto no puedes decidir el diámetro
        const dnActivo = CONFIG.diametros.find(d => d.dn === entrada.diametroActivo);
        const coste = largo * dnActivo.coste + Math.abs(desn) * CONFIG.costeExtraPorCota;
        ctx.fillStyle = CONFIG.color.dinero;
        ctx.fillText(`${Math.round(coste).toLocaleString('es-ES')} €`, x2 + 14, y2 + 24);
      }
    }

    // Colocando un elemento: fantasma bajo el cursor
    if(entrada.herramienta && entrada.herramienta !== 'tuberia' &&
       entrada.herramienta !== 'mover' && entrada.herramienta !== 'borrar'){
      const def = CONFIG.elementos[entrada.herramienta];
      if(def){
        const px = cam.mundoAPantallaX(entrada.mundoX);
        const py = cam.mundoAPantallaY(entrada.mundoY);
        const r = Math.max(5, def.radio * cam.zoom * 0.85);
        ctx.globalAlpha = 0.55;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        const cota = this.terreno.cotaEn(entrada.mundoX, entrada.mundoY);
        ctx.font = '600 11px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = CONFIG.color.tenue;
        ctx.fillText(`cota ${cota.toFixed(0)} m`, px + r + 8, py + 4);
      }
    }
  }

  /* ---------------- ESCALA GRÁFICA ---------------- */

  dibujarEscala(){
    const ctx = this.ctx, cam = this.camara;
    // Elegir una longitud "redonda" que ocupe ~120 px
    const objetivo = 120 / cam.zoom;
    const potencia = Math.pow(10, Math.floor(Math.log10(objetivo)));
    const metros = [1, 2, 5, 10].map(m => m * potencia)
                    .find(m => m >= objetivo * 0.6) || potencia * 10;
    const px = metros * cam.zoom;

    const x = 18, y = cam.altoPantalla - 26;
    ctx.strokeStyle = 'rgba(207,220,232,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 5);
    ctx.stroke();
    ctx.font = '500 10px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(207,220,232,0.75)';
    ctx.fillText(metros >= 1000 ? (metros/1000) + ' km' : metros + ' m', x + px / 2, y - 9);
  }
}
