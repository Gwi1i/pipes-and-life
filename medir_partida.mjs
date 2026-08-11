/**
 * BOT DE MEDICIÓN — herramienta de calibrado, no es parte del juego.
 *
 * Uso, desde la consola del navegador con el juego cargado:
 *   const m = await import('/medir_partida.mjs');
 *   m.medir(0.25, 120).then(r => console.table(r.marcas));
 *
 * Cada cambio de equilibrio (precios, tasas, umbrales) se puede re-medir en
 * segundos en vez de jugando una hora. Con esto se midió la partida del
 * 11/08/2026: arco completo en ~63 min y el final asintótico (ver commit).
 *
 * Juega una partida entera acelerada con los módulos REALES (avanzar, bombear,
 * costeMejora...) y una estrategia de jugador aplicado: clica cuando falta agua,
 * compra mejoras por prioridad, construye lo que cada servicio pide, repara
 * averías al momento y renueva diámetros cuando el juego lo pide.
 *
 * Lo único que se salta es el coste en clics de EXPLORAR (destapa gratis), así
 * que los tiempos medidos son un suelo: la partida real es algo más lenta.
 */
import { CONFIG } from './src/config.js';
import { Estado } from './src/estado.js';
import { avanzar, bombear, costeMejora, servicioActivo, redEstrangula,
         redDelPueblo, requisitosAutobomba, faseActual,
         incorporarPueblo, canonIncorporacion } from './src/simulacion.js';
import { puedeColocar, costeTrazado, costeRenovar, celdaEn,
         escalaDeRed, nivelDiametro } from './src/mapa.js';

const O = () => CONFIG.mapaMundo;

function buscarSitio(estado, tipo, radio = 8){
  const M = O();
  for(let r = 1; r <= radio; r++)
    for(let f = M.origen.fila - r; f <= M.origen.fila + r; f++)
      for(let c = M.origen.col - r; c <= M.origen.col + r; c++){
        const celda = celdaEn(estado.mapa, c, f);
        if(!celda) continue;
        celda.oculta = false;   // el bot no paga la exploración
        if(estado.construcciones.some(o => o.col === c && o.fila === f)) continue;
        if(puedeColocar(estado.mapa, estado.construcciones, tipo, c, f).ok)
          return { c, f };
      }
  return null;
}

/** Tubería recta en L desde el pueblo incorporado más cercano hasta (c,f). */
function tender(estado, red, c, f){
  const M = O();
  const camino = [];
  let base = estado.pueblos[0];
  for(const p of estado.pueblos)
    if(Math.hypot(p.col - c, p.fila - f) < Math.hypot(base.col - c, base.fila - f)) base = p;
  let x = base.col, y = base.fila;
  camino.push({ col: x, fila: y });
  while(x !== c){ x += Math.sign(c - x); camino.push({ col: x, fila: y }); }
  while(Math.abs(y - f) > 1){ y += Math.sign(f - y); camino.push({ col: x, fila: y }); }
  for(const p of camino){ const cel = celdaEn(estado.mapa, p.col, p.fila); if(cel) cel.oculta = false; }
  // El bot respeta las zonas protegidas igual que el jugador: si el camino en L
  // cruza una, ese núcleo no se puede alcanzar así y se probará otro.
  if(camino.some(q => { const cel = celdaEn(estado.mapa, q.col, q.fila);
                        return cel && cel.protegida; })) return false;
  const dn = escalaDeRed(red)[0].id;
  const coste = costeTrazado(estado.mapa, camino, dn, red);
  if(estado.dinero < coste) return false;
  estado.pagar(coste);
  estado.tuberias.push({ camino, coste, dn, red });
  return true;
}

function construir(estado, tipo, red){
  const def = CONFIG.construibles[tipo];
  const sitio = buscarSitio(estado, tipo);
  if(!sitio || estado.dinero < def.coste + 800) return false;
  estado.pagar(def.coste);
  estado.construcciones.push({ tipo, col: sitio.c, fila: sitio.f,
    ...(tipo === 'vertedero' ? { nivel: 1, lleno: 0 } : {}) });
  if(red) tender(estado, red, sitio.c, sitio.f);
  return true;
}

/** Renueva TODAS las líneas de una red al siguiente calibre. */
function renovarRed(estado, red){
  const lineas = estado.tuberias.filter(t => (t.red || 'abastecimiento') === red);
  if(!lineas.length) return false;
  const escala = escalaDeRed(red);
  const peor = Math.min(...lineas.map(t => nivelDiametro(t.dn, red)));
  if(peor >= escala.length - 1) return false;
  const destino = escala[peor + 1].id;
  const total = lineas.reduce((a, t) => a + costeRenovar(estado.mapa, t, destino, red), 0);
  if(estado.dinero < total) return false;
  for(const t of lineas){ estado.pagar(costeRenovar(estado.mapa, t, destino, red)); t.dn = destino; }
  return true;
}

export async function medir(pasoSeg = 0.25, maxMin = 240, informar = () => {}){
  const estado = new Estado();
  const marcas = [];
  const marca = (id) => { if(!marcas.some(m => m.id === id))
    marcas.push({ id, min: +(seg / 60).toFixed(1) }); };
  let seg = 0, res = null;
  const PRIORIDAD = ['deposito', 'bomba', 'captacion', 'depuradora', 'mantenimiento',
                     'pluviales', 'tanque', 'reciclaje'];

  while(seg < maxMin * 60){
    // --- el pueblo peor servido pasa a activo (cambiar de pestaña es gratis) ---
    const abiertos = estado.pueblos.map((p, i) => ({ p, i })).filter(x => x.p.desbloqueado);
    abiertos.sort((a, b) => (a.p.agua / 1e9 + a.p.servicio) - (b.p.agua / 1e9 + b.p.servicio));
    estado.puebloActivo = abiertos[0].i;
    const p = estado.activo;

    // --- clicar: 4 por segundo si falta agua (un jugador aplicado) ---
    if(p.agua < 6000) bombear(p, estado);

    res = avanzar(estado, pasoSeg);
    seg += pasoSeg;

    // --- reparar averías al momento (pagando sus clics) ---
    for(let i = estado.averias.length - 1; i >= 0; i--){
      const coste = estado.averias[i].clics * CONFIG.averias.costePorClic;
      if(estado.dinero >= coste){ estado.pagar(coste); estado.averias.splice(i, 1); }
    }

    // --- obras que pide cada servicio ---
    if(!estado.construcciones.some(o => o.tipo === 'captacion')){
      if(construir(estado, 'captacion', 'abastecimiento')) marca('obra captacion');
    }
    if(servicioActivo(p, 'saneamiento') && !estado.construcciones.some(o => o.tipo === 'depuradora')){
      if(construir(estado, 'depuradora', 'saneamiento')) marca('obra depuradora');
    }
    if(servicioActivo(p, 'residuos')){
      if(!estado.construcciones.some(o => o.tipo === 'vertedero')){
        if(construir(estado, 'vertedero', 'residuos')) marca('obra vertedero');
      } else if(!estado.construcciones.some(o => o.tipo === 'reciclaje')){
        if(construir(estado, 'reciclaje', 'residuos')) marca('obra reciclaje');
      }
    }
    // Con muchos pueblos hace falta MAS depuración y más vertederos: el bot
    // amplía cuando el juego avisa, igual que haría un jugador que lee.
    if(res && res.aliviando
       && estado.construcciones.filter(o => o.tipo === 'depuradora').length < estado.pueblos.length)
      construir(estado, 'depuradora', 'saneamiento');
    if((res && (res.basuraCalle || 0) > 0.3)
       && estado.construcciones.filter(o => o.tipo === 'vertedero').length < 4)
      construir(estado, 'vertedero', 'residuos');

    if(estado.pluvialesActivas && !estado.tuberias.some(t => t.red === 'pluviales'))
      tender(estado, 'pluviales', O().origen.col + 2, O().origen.fila);

    // --- renovar calibres cuando el juego lo pide ---
    if(redEstrangula(p, estado) || p.habitantes >= redDelPueblo(estado).def.habitantesMax * 0.95){
      if(renovarRed(estado, 'abastecimiento')) marca('renueva agua a ' + redDelPueblo(estado).def.nombre);
    }
    if(res.rebosando) if(renovarRed(estado, 'saneamiento')) marca('renueva colector');
    if((res.basuraTh || 0) > (res.recogidaTh || 0) + 1e-6)
      if(renovarRed(estado, 'residuos')) marca('renueva carretera');

    // --- tienda, por prioridad, guardando un colchón ---
    for(const clave of PRIORIDAD){
      const m = CONFIG.mejoras[clave];
      if(m.requiere && !servicioActivo(p, m.requiere)) continue;
      const nivel = p.mejoras[clave];
      if(nivel >= m.nivelMax) continue;
      const coste = costeMejora(clave, nivel);
      if(estado.dinero > coste + 500){ estado.pagar(coste); p.mejoras[clave]++; break; }
    }
    // auto-bombeo en cuanto se pueda: es lo que sostiene el crecimiento
    if(!p.autobombaActivo && requisitosAutobomba(p).ok
       && estado.dinero > CONFIG.premium.autobomba.coste + 2000){
      estado.pagar(CONFIG.premium.autobomba.coste);
      p.autobombaActivo = true;
      marca('auto-bombeo en ' + p.nombre);
    }

    // --- incorporar núcleos: el corazón del juego largo. Cada pocos segundos
    //     busca el núcleo alcanzable más cercano, paga la tubería real hasta él
    //     y lo incorpora, igual que haría el jugador ---
    // Solo se expande si los pueblos que ya tiene están bien servidos: crecer
    // dejando morir lo anterior fue lo que hundió la primera medición.
    const peor = Math.min(...estado.pueblos.map(x => x.servicio));
    if(seg % 4 < pasoSeg && peor > 0.93
       && estado.dinero > canonIncorporacion(estado) + 4000){
      const M = O(), fase = faseActual(estado);
      let mejor = null, mejorD = 1e9;
      for(let f = 0; f < M.filas; f++) for(let c = 0; c < M.cols; c++){
        const celda = celdaEn(estado.mapa, c, f);
        if(!celda || celda.hallazgo !== 'pueblo' || celda.resuelto) continue;
        if((celda.anillo || 1) > fase) continue;
        for(const q of estado.pueblos){
          const d = Math.hypot(q.col - c, q.fila - f);
          if(d < mejorD){ mejorD = d; mejor = { c, f, celda }; }
        }
      }
      if(mejor && estado.dinero >= canonIncorporacion(estado)
         && tender(estado, 'abastecimiento', mejor.c, mejor.f)){
        estado.pagar(canonIncorporacion(estado));
        const faseAntes = faseActual(estado);
        const nuevo = incorporarPueblo(estado, mejor.c, mejor.f, mejor.celda);
        marca('nucleo ' + estado.pueblos.length + ' (' + nuevo.nombre + ')');
        if(faseActual(estado) > faseAntes) marca('FASE ' + faseActual(estado));
        if(estado.pluvialesActivas) marca('pluviales activas');
      }
    }

    // --- hitos de población y servicios ---
    if(servicioActivo(p, 'saneamiento')) marca('saneamiento abierto');
    if(servicioActivo(p, 'residuos')) marca('residuos abierto');
    const totalHab = estado.pueblos.reduce((a, x) => a + x.habitantes, 0);
    if(totalHab >= 2000) marca('2000 hab totales');
    if(totalHab >= 5000) marca('5000 hab totales');
    if(totalHab >= 10000) marca('10000 hab totales');
    if(totalHab >= 20000) marca('20000 hab totales');

    if(seg % 600 < pasoSeg) await new Promise(r => setTimeout(r));   // respirar
    if(seg % 1800 < pasoSeg) informar({ min: +(seg / 60).toFixed(0), marcas: marcas.length });
  }

  const foto = {
    pueblos: estado.pueblos.length,
    fase: faseActual(estado),
    habTotales: Math.round(estado.pueblos.reduce((a, x) => a + x.habitantes, 0)),
    peorServicio: +Math.min(...estado.pueblos.map(x => x.servicio)).toFixed(2)
  };
  return { marcas, foto, dinero: Math.round(estado.dinero),
           contaminacion: Math.round(estado.contaminacion) };
}
