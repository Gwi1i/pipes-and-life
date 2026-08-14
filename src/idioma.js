/**
 * EL IDIOMA. El castellano es la FUENTE DE VERDAD: vive en config.js, en
 * comentarios.js y en el propio index.html, como siempre. El inglés es un
 * DICCIONARIO (src/idiomas/en.js) que se mezcla ENCIMA al arrancar — la
 * misma idea que aplicarRegion() con los tintes: una sola pasada, antes de
 * crear nada. Lo que el diccionario no tenga sale en castellano: un texto
 * sin traducir se enseña, nunca se esconde, y por eso la traducción puede
 * crecer por tandas.
 *
 * La preferencia vive en su propia clave de localStorage (como el sonido):
 * tiene que sobrevivir a Reiniciar. Sin preferencia dicha, decide el
 * navegador: un visitante que no lee castellano ve inglés a la primera,
 * que es justo cuando se decide si se queda.
 */
import { EN } from './idiomas/en.js';

const CLAVE = 'redHidraulica_idioma';

export function idiomaActual(){
  try{
    const guardado = localStorage.getItem(CLAVE);
    if(guardado === 'es' || guardado === 'en') return guardado;
  }catch(e){ /* navegación privada: sin memoria, pero que no tumbe nada */ }
  const nav = (navigator.language || 'es').toLowerCase();
  return nav.startsWith('es') ? 'es' : 'en';
}

export function cambiarIdioma(){
  // Recargar es a propósito: media interfaz ya está pintada en el idioma
  // viejo y re-traducirla en vivo sería mantener dos caminos. La partida no
  // corre peligro: se guarda sola al esconderse la página.
  try{ localStorage.setItem(CLAVE, idiomaActual() === 'es' ? 'en' : 'es'); }
  catch(e){ return; }
  location.reload();
}

/**
 * LA ETIQUETA t: la traducción de los textos que el código monta en vivo.
 * Se escribe t`Renovar a ${x} de ${y}.` y el castellano SE QUEDA AHÍ, en el
 * código, como fuente de verdad. La clave del diccionario es el ESQUELETO de
 * la frase —las partes fijas con {0},{1} en los huecos, los espacios
 * plegados— y la traducción es otro esqueleto con los mismos huecos, que en
 * inglés pueden ir en otro orden. Sin entrada en el diccionario, la frase
 * sale en castellano y su esqueleto queda apuntado en `sinTraducir`:
 * `juego.sinTraducir` en la consola es la lista de deberes.
 */
export const sinTraducir = new Set();

function esqueleto(partes){
  let s = partes[0];
  for(let i = 1; i < partes.length; i++) s += '{' + (i - 1) + '}' + partes[i];
  return s.replace(/\s+/g, ' ').trim();
}

export function t(partes, ...valores){
  if(idiomaActual() === 'en'){
    const clave = esqueleto(partes);
    const tpl = EN.frases[clave];
    if(tpl !== undefined)
      return tpl.replace(/\{(\d+)\}/g, (_, i) => valores[i] ?? '');
    sinTraducir.add(clave);
  }
  let s = partes[0];
  for(let i = 0; i < valores.length; i++) s += valores[i] + partes[i + 1];
  return s;
}

/* Mezcla recursiva: objetos y arrays se recorren, lo demás se sustituye.
   Solo pisa claves que EXISTEN en el destino: una errata en el diccionario
   no puede inventarle a CONFIG un parámetro nuevo. */
function mezclar(destino, encima){
  for(const k of Object.keys(encima)){
    if(!(k in destino)) continue;
    const v = encima[k];
    if(v && typeof v === 'object') mezclar(destino[k], v);
    else destino[k] = v;
  }
}

/** Una sola vez al arrancar, ANTES de crear la UI: así todo lo que se
 *  construya después (tienda, paneles, guía) nace ya con el idioma puesto. */
export function aplicarIdioma(CONFIG){
  if(idiomaActual() !== 'en') return;

  mezclar(CONFIG, EN.config);

  document.documentElement.lang = 'en';
  document.title = EN.titulo;
  const meta = document.querySelector('meta[name="description"]');
  if(meta) meta.setAttribute('content', EN.descripcion);

  for(const [sel, html] of Object.entries(EN.pagina))
    for(const el of document.querySelectorAll(sel)) el.innerHTML = html;

  for(const [sel, atributo, valor] of EN.atributos)
    for(const el of document.querySelectorAll(sel)) el.setAttribute(atributo, valor);
}
