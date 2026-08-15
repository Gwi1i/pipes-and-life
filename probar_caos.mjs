/**
 * BOT CAÓTICO — herramienta de prueba, no es parte del juego.
 *
 * El bot de medición (`medir_partida.mjs`) juega como un jugador aplicado, y
 * eso es justo su límite: los fallos viven en los caminos que NADIE planeó
 * (petición del autor: "en los caminos no habituales pueden aparecer
 * problemas que no hemos detectado"). Este bot hace lo contrario: acciones
 * legales pero desordenadas — construir sin conectar, tender redes desde
 * ninguna parte, derribar lo recién pagado, dejar pudrirse las averías,
 * incorporar el pueblo más LEJANO, guardar y recargar a mitad — y comprueba
 * INVARIANTES a cada paso: ningún número puede irse a NaN/Infinity, ningún
 * depósito al negativo, ninguna excepción sin capturar.
 *
 * Uso, desde la consola del navegador con el juego cargado:
 *   const c = await import('/probar_caos.mjs');
 *   c.caos(123, 90).then(r => console.log(r));
 * La semilla hace la corrida REPRODUCIBLE: el mismo caos dos veces.
 *
 * OJO: prueba el guardado/carga de verdad, así que protege el localStorage
 * real (lo aparta al entrar y lo repone SIEMPRE al salir, pase lo que pase).
 */
import { CONFIG } from './src/config.js';
import { Estado } from './src/estado.js';
import { avanzar, bombear, costeMejora, servicioActivo, faseActual,
         incorporarPueblo, canonIncorporacion, capacidad,
         costeAmpliarPieza, desgloseProduccion } from './src/simulacion.js';
import { puedeColocar, costeTrazado, celdaEn, escalaDeRed,
         estudiarZona, sondear, aflorarArqueologia } from './src/mapa.js';

/* Azar con semilla (mulberry32): el mismo caos dos veces seguidas. */
function azarCon(semilla){
  let a = semilla >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const finito = (n) => typeof n === 'number' && Number.isFinite(n);

export async function caos(semilla = 1, maxMin = 90, pasoSeg = 0.25){
  const azar = azarCon(semilla);
  const M = CONFIG.mapaMundo;
  const errores = [], avisos = [];
  const cuenta = {};
  const TOPE = 20;   // regla de escala: ni los fallos se listan enteros
  let seg = 0;

  // El guardado real del jugador se aparta y SIEMPRE se repone al salir
  const claveReal = CONFIG.guardado.clave;
  const guardadoReal = localStorage.getItem(claveReal);

  const estado = new Estado();
  const anotarError = (donde, e) => {
    if(errores.length < TOPE)
      errores.push({ min: +(seg / 60).toFixed(1), donde,
                     mensaje: String(e && e.message || e),
                     pila: e && e.stack ? String(e.stack).split('\n')[1] : '' });
  };
  const avisar = (que) => {
    if(!avisos.some(a => a.que === que) && avisos.length < TOPE)
      avisos.push({ min: +(seg / 60).toFixed(1), que });
  };
  const celdaAlAzar = () => {
    const c = Math.floor(azar() * M.cols), f = Math.floor(azar() * M.filas);
    const celda = celdaEn(estado.mapa, c, f);
    if(celda) celda.oculta = false;   // el caos tampoco paga la exploración
    return { c, f, celda };
  };

  /* Cada acción es legal por separado; el caos está en el orden y el sitio. */
  const ACCIONES = {
    clicar(){
      // Casi siempre con sed (que la economía respire y aparezcan estados
      // tardíos); a ratos aporrea a depósito lleno, que también es un jugador
      const p = estado.pueblos[Math.floor(azar() * estado.pueblos.length)];
      const aporrea = azar() < 0.15;
      if(!aporrea && p.agua >= capacidad(p, estado) - 1) return;
      for(let i = 0; i < 1 + azar() * 6; i++) bombear(p, estado);
    },
    mejorar(){
      const p = estado.pueblos[Math.floor(azar() * estado.pueblos.length)];
      const claves = Object.keys(CONFIG.mejoras);
      const clave = claves[Math.floor(azar() * claves.length)];
      const def = CONFIG.mejoras[clave];
      if(def.requiere && !servicioActivo(p, def.requiere)) return;
      const nivel = p.mejoras[clave] || 0;
      if(nivel >= def.nivelMax) return;
      const coste = costeMejora(clave, nivel);
      if(estado.dinero < coste) return;
      estado.pagar(coste); p.mejoras[clave]++;
    },
    construirDondeSea(){
      // Pieza al azar en casilla al azar: casi siempre queda SIN CONECTAR,
      // que es justo el camino que un jugador normal no pisa
      const tipos = Object.keys(CONFIG.construibles);
      const tipo = tipos[Math.floor(azar() * tipos.length)];
      const { c, f } = celdaAlAzar();
      const v = puedeColocar(estado.mapa, estado.construcciones, tipo, c, f,
                             estado.pueblos.length);
      const def = CONFIG.construibles[tipo];
      if(!v.ok || estado.dinero < def.coste) return;
      aflorarArqueologia(estado.mapa, c, f);
      const celda = celdaEn(estado.mapa, c, f);
      if(celda && celda.arqueologia && celda.aflorado) return;  // tropiezo real
      estado.pagar(def.coste);
      estado.construcciones.push({ tipo, col: c, fila: f, nivel: 1,
        ...(tipo === 'vertedero' ? { lleno: 0 } : {}) });
    },
    tenderDesdeNingunaParte(){
      // Una línea de red al azar entre dos puntos al azar: ni sale del pueblo
      // ni llega a nada. Legal, cara e inútil — como un error de verdad.
      const redes = Object.keys(CONFIG.redes);
      const red = redes[Math.floor(azar() * redes.length)];
      const a = celdaAlAzar(), b = celdaAlAzar();
      if(!a.celda || !b.celda) return;
      if(Math.abs(a.c - b.c) + Math.abs(a.f - b.f) > 25) return;
      const camino = [];
      let x = a.c, y = a.f;
      camino.push({ col: x, fila: y });
      while(x !== b.c){ x += Math.sign(b.c - x); camino.push({ col: x, fila: y }); }
      while(y !== b.f){ y += Math.sign(b.f - y); camino.push({ col: x, fila: y }); }
      if(camino.some(q => { const cel = celdaEn(estado.mapa, q.col, q.fila);
        return !cel || cel.protegida || cel.tipo === 'agua' || cel.tipo === 'lago'; })) return;
      const dn = escalaDeRed(red)[Math.floor(azar() * escalaDeRed(red).length)].id;
      const coste = costeTrazado(estado.mapa, camino, dn, red);
      if(!finito(coste)){ avisar('costeTrazado no finito en ' + red); return; }
      if(estado.dinero < coste) return;
      estado.pagar(coste);
      estado.tuberias.push({ camino, coste, dn, red, nacida: estado.horas });
    },
    derribar(){
      if(!estado.construcciones.length) return;
      const i = Math.floor(azar() * estado.construcciones.length);
      const obra = estado.construcciones[i];
      const def = CONFIG.construibles[obra.tipo];
      estado.dinero += def.coste * CONFIG.derribo.fraccionRecuperada;
      estado.construcciones.splice(i, 1);
      // La avería de esa casilla se va con el escombro, como hace main.js
      estado.averias = estado.averias.filter(
        av => av.col !== obra.col || av.fila !== obra.fila);
    },
    levantarLinea(){
      if(!estado.tuberias.length) return;
      const i = Math.floor(azar() * estado.tuberias.length);
      const tub = estado.tuberias[i];
      estado.dinero += (tub.coste || 0) * CONFIG.tuberia.valorRecuperado;
      estado.tuberias.splice(i, 1);
    },
    ampliar(){
      const cabe = estado.construcciones.filter(
        o => CONFIG.ampliacion.tipos.includes(o.tipo)
          && (o.nivel || 1) < CONFIG.ampliacion.nivelMax);
      if(!cabe.length) return;
      const obra = cabe[Math.floor(azar() * cabe.length)];
      const coste = costeAmpliarPieza(obra);
      if(!finito(coste)){ avisar('costeAmpliarPieza no finito: ' + obra.tipo); return; }
      if(estado.dinero < coste) return;
      estado.pagar(coste);
      obra.nivel = (obra.nivel || 1) + 1;
    },
    subsuelo(){
      const { c, f, celda } = celdaAlAzar();
      if(!celda) return;
      const E = CONFIG.acuiferos;
      // Para la prueba basta pagar el sondeo caro: lo vigilado es la mecánica
      const costeSondeo = Math.max(...Object.values(E.clases).map(k => k.costeSondeo));
      if(azar() < 0.5 && estado.dinero >= E.estudio.coste){
        estado.pagar(E.estudio.coste); estudiarZona(estado.mapa, c, f);
      } else if(estado.dinero >= costeSondeo){
        estado.pagar(costeSondeo); sondear(estado.mapa, c, f);
      }
    },
    incorporarElMasLejano(){
      // Al revés que todo el mundo: el núcleo alcanzable MÁS LEJANO primero
      const canon = canonIncorporacion(estado);
      if(estado.dinero < canon + 2000) return;
      const fase = faseActual(estado);
      let peor = null, peorD = -1;
      for(let f = 0; f < M.filas; f++) for(let c = 0; c < M.cols; c++){
        const celda = celdaEn(estado.mapa, c, f);
        if(!celda || celda.hallazgo !== 'pueblo' || celda.resuelto) continue;
        if((celda.anillo || 1) > fase) continue;
        const d = Math.hypot(estado.pueblos[0].col - c, estado.pueblos[0].fila - f);
        if(d > peorD){ peorD = d; peor = { c, f, celda }; }
      }
      if(!peor) return;
      estado.pagar(canon);
      incorporarPueblo(estado, peor.c, peor.f, peor.celda);
    },
    cambiarActivo(){
      estado.puebloActivo = Math.floor(azar() * estado.pueblos.length);
    },
    repararAlgo(){
      // Solo a veces: el caos también deja pudrirse las averías
      if(!estado.averias.length || azar() < 0.5) return;
      const av = estado.averias[0];
      const coste = av.clics * CONFIG.averias.costePorClic;
      if(estado.dinero >= coste){ estado.pagar(coste); estado.averias.shift(); }
    }
  };
  // PESOS: sin ellos el caos se arruinaba a sí mismo (todo derribado, caja
  // vacía) y la mitad de las acciones no llegaban a ejecutarse — un caos
  // pobre prueba poco. Construir pesa más que derribar; clicar va aparte,
  // cada paso, porque sin ingresos no hay estados que romper.
  const PESOS = { mejorar: 3, construirDondeSea: 4, tenderDesdeNingunaParte: 3,
                  derribar: 1, levantarLinea: 1, ampliar: 2, subsuelo: 1,
                  incorporarElMasLejano: 2, cambiarActivo: 2, repararAlgo: 2 };
  const BOLSA = Object.entries(PESOS).flatMap(([k, p]) => Array(p).fill(k));

  const comprobar = () => {
    if(!finito(estado.dinero)) avisar('dinero no finito');
    if(!finito(estado.horas)) avisar('horas no finitas');
    if(!finito(estado.contaminacion) || estado.contaminacion < 0)
      avisar('contaminación rara: ' + estado.contaminacion);
    for(const p of estado.pueblos){
      if(!finito(p.agua) || p.agua < -1) avisar(`agua rara en ${p.nombre}: ${p.agua}`);
      if(!finito(p.habitantes) || p.habitantes < 0)
        avisar(`habitantes raros en ${p.nombre}: ${p.habitantes}`);
      const cap = capacidad(p, estado);
      if(!finito(cap) || cap <= 0) avisar(`capacidad rara en ${p.nombre}: ${cap}`);
      if(p.agua > cap * 1.01 + 1) avisar(`${p.nombre} por encima de su capacidad`);
    }
    for(const [masa, nivel] of Object.entries(estado.acuiferos || {}))
      if(!finito(nivel) || nivel < -0.01 || nivel > 1.01)
        avisar(`acuífero ${masa} fuera de 0..1: ${nivel}`);
  };

  try{
    while(seg < maxMin * 60){
      // Clicar SIEMPRE (es el ingreso), más 1-2 rarezas de la bolsa
      try{ ACCIONES.clicar(); } catch(e){ anotarError('clicar', e); }
      const n = 1 + Math.floor(azar() * 2);
      for(let i = 0; i < n; i++){
        const nombre = BOLSA[Math.floor(azar() * BOLSA.length)];
        cuenta[nombre] = (cuenta[nombre] || 0) + 1;
        try{ ACCIONES[nombre](); }
        catch(e){ anotarError(nombre, e); }
      }

      try{
        const res = avanzar(estado, pasoSeg);
        if(!finito(res.servicio)) avisar('resultado.servicio no finito');
        if(!finito(res.prodLps)) avisar('resultado.prodLps no finito');
      }
      catch(e){ anotarError('avanzar', e); }
      seg += pasoSeg;

      comprobar();

      // El desglose es LA fuente de la que bebe el panel: si se rompe con un
      // estado raro, el panel del jugador se rompe igual
      if(seg % 60 < pasoSeg){
        try{
          const d = desgloseProduccion(estado.activo, estado);
          for(const [k, v] of Object.entries(d))
            if(typeof v === 'number' && !finito(v)) avisar(`desglose.${k} no finito`);
        }
        catch(e){ anotarError('desgloseProduccion', e); }
      }

      // Guardar y recargar A MITAD de la partida rara: el guardado tiene que
      // tragarse cualquier estado alcanzable, no solo los bonitos
      if(seg % 300 < pasoSeg){
        try{
          estado.guardar();
          const otro = new Estado();
          if(!Estado.cargar(otro)) avisar('guardar() no dejó nada que cargar');
          if(Math.abs(otro.dinero - estado.dinero) > 1)
            avisar('el dinero no sobrevive al guardar/cargar');
          if(otro.pueblos.length !== estado.pueblos.length)
            avisar('los pueblos no sobreviven al guardar/cargar');
          if(otro.construcciones.length !== estado.construcciones.length)
            avisar('las construcciones no sobreviven al guardar/cargar');
        }
        catch(e){ anotarError('guardar/cargar', e); }
      }

      if(seg % 600 < pasoSeg) await new Promise(r => setTimeout(r));   // respirar
    }
  } finally {
    // El guardado del jugador vuelve a su sitio PASE LO QUE PASE
    if(guardadoReal === null) localStorage.removeItem(claveReal);
    else localStorage.setItem(claveReal, guardadoReal);
  }

  return {
    semilla, minutos: maxMin,
    errores, avisos,
    acciones: cuenta,
    foto: {
      pueblos: estado.pueblos.length,
      construcciones: estado.construcciones.length,
      tuberias: estado.tuberias.length,
      averias: estado.averias.length,
      dinero: Math.round(estado.dinero),
      contaminacion: +estado.contaminacion.toFixed(2),
      habTotales: Math.round(estado.pueblos.reduce((a, p) => a + p.habitantes, 0))
    }
  };
}
