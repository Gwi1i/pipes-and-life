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
