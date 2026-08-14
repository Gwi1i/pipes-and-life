# -*- coding: utf-8 -*-
"""
GENERAR VOCES — la voz de Manuel con las voces neuronales de Microsoft.

La sintesis del navegador sonaba a robot; esto genera ARCHIVOS con voz
neuronal, y desde la traduccion genera DOS juegos: el castellano
(es-ES-AlvaroNeural) y el ingles (en-GB-RyanNeural). Requisitos, una vez:

    py -m pip install edge-tts

y ejecutar esto cada vez que cambien los textos de Manuel (en cualquiera
de los dos idiomas):

    py generar_voces.py            # genera lo que falte, borra lo huerfano
    py generar_voces.py --listar   # solo enseña las lineas, sin internet

El truco contra los audios mentirosos: el nombre de cada archivo lleva la
HUELLA del texto (assets/voz/<id>-<huella>.mp3), con los espacios plegados
antes de la cuenta — la misma huella que calcula sonido.js. Si un texto
cambia, el juego no encuentra el archivo, cae al sintetizador, y este
script genera el nuevo y borra el viejo. Como el texto ingles y el
castellano tienen huellas distintas, los dos juegos de archivos conviven
en la misma carpeta sin pisarse y el juego abre el del idioma en curso.

Los textos se LEEN del codigo: el castellano de src/config.js y
src/comentarios.js (la fuente de verdad), el ingles del diccionario
src/idiomas/en.js. Una sola fuente por idioma; nada se copia a mano.
"""

import asyncio
import os
import re
import sys

VOCES = {
    'es': 'es-ES-AlvaroNeural',   # el hombre tranquilo
    'en': 'en-GB-RyanNeural'      # su gemelo britanico, mismo aplomo
}
RATE = '-8%'                      # un pelin pausado, de veterano
PITCH = '-10Hz'                   # y un punto mas grave

RAIZ = os.path.dirname(os.path.abspath(__file__))
CARPETA = os.path.join(RAIZ, 'assets', 'voz')


def normalizar(texto):
    return re.sub(r'\s+', ' ', texto).strip()


def huella(texto):
    """La misma huella que sonido.js: espacios plegados, djb2 UTF-8, hex."""
    h = 5381
    for b in normalizar(texto).encode('utf-8'):
        h = ((h * 33) ^ b) & 0xFFFFFFFF
    return format(h, '08x')


def unir_cadenas(bloque):
    """Junta 'trozos' + 'concatenados' de JS en una sola cadena."""
    return ''.join(re.findall(r"'((?:[^'\\]|\\.)*)'", bloque)).replace("\\'", "'")


CADENA = r"((?:'(?:[^'\\]|\\.)*'\s*\+?\s*)+)"


def lineas_castellano():
    """Todo lo que Manuel dice en castellano: guia, saludo, cierre, comentarios."""
    lineas = {}

    config = open(os.path.join(RAIZ, 'src', 'config.js'), encoding='utf-8').read()
    # Los pasos de la guia: se habla "titulo. texto", igual que en main.js
    tutorial = config.split('tutorial: [', 1)[1].split('\n  ],', 1)[0]
    ids_tutorial = []
    for m in re.finditer(
            r"id: '(\w+)',\s*titulo: " + CADENA + r",\s*texto: " + CADENA, tutorial):
        lineas[m.group(1)] = unir_cadenas(m.group(2)) + '. ' + unir_cadenas(m.group(3))
        ids_tutorial.append(m.group(1))

    # El saludo de presentacion, que vive en CONFIG.sonido.voz
    m = re.search(r"presentacion: " + CADENA, config)
    if m:
        lineas['presentacion'] = unir_cadenas(m.group(1))

    # El cierre de la guia (CONFIG.cierreGuia): la enhorabuena de Manuel
    m = re.search(r"cierreGuia: \{\s*texto: " + CADENA, config)
    if m:
        lineas['cierreGuia'] = unir_cadenas(m.group(1))

    # Los comentarios: plantillas t`...` (sin ${}: regla escrita en el modulo)
    comentarios = open(os.path.join(RAIZ, 'src', 'comentarios.js'), encoding='utf-8').read()
    for m in re.finditer(r"id: '(\w+)'.*?texto: t`([^`]*)`", comentarios, re.DOTALL):
        lineas[m.group(1)] = normalizar(m.group(2))

    return lineas, ids_tutorial


def lineas_ingles(castellano, ids_tutorial):
    """Las mismas lineas, en ingles, leidas del diccionario en.js."""
    src = open(os.path.join(RAIZ, 'src', 'idiomas', 'en.js'), encoding='utf-8').read()
    lineas = {}

    # La guia: el array tutorial de la capa inglesa va en el MISMO orden que
    # el castellano (se mezcla por indice), asi que se casa por posicion.
    tutorial = src.split('tutorial: [', 1)[1].split('\n    ],', 1)[0]
    entradas = re.findall(r"titulo: " + CADENA + r",\s*texto: " + CADENA, tutorial)
    for id_, (titulo, texto) in zip(ids_tutorial, entradas):
        lineas[id_] = unir_cadenas(titulo) + '. ' + unir_cadenas(texto)

    m = re.search(r"presentacion: " + CADENA, src)
    if m:
        lineas['presentacion'] = unir_cadenas(m.group(1))

    m = re.search(r"cierreGuia: \{\s*texto: " + CADENA, src)
    if m:
        lineas['cierreGuia'] = unir_cadenas(m.group(1))

    # Los comentarios: por el diccionario de frases, clave = texto castellano
    frases = {}
    seccion = src.split('frases: {', 1)[1]
    for m in re.finditer(r"^\s{4}'((?:[^'\\]|\\.)*)':\s*" + CADENA, seccion, re.M):
        frases[m.group(1).replace("\\'", "'")] = unir_cadenas(m.group(2))
    for id_, texto in castellano.items():
        if id_ in lineas:
            continue                      # guia, saludo y cierre ya estan
        traduccion = frases.get(normalizar(texto))
        if traduccion:
            lineas[id_] = traduccion
        else:
            print('SIN TRADUCIR (no tendra voz inglesa): ' + id_)

    return lineas


async def main():
    listar = '--listar' in sys.argv

    castellano, ids_tutorial = lineas_castellano()
    if not castellano:
        print('No he encontrado textos: ¿ha cambiado el formato de config.js?')
        return 1
    ingles = lineas_ingles(castellano, ids_tutorial)

    quiero = {}
    for idioma, lineas in (('es', castellano), ('en', ingles)):
        for id_, texto in lineas.items():
            quiero['%s-%s.mp3' % (id_, huella(texto))] = (idioma, texto)

    if listar:
        for nombre, (idioma, texto) in sorted(quiero.items()):
            print('[%s] %s  %s' % (idioma, nombre, texto[:70]))
        print('\n%d lineas (%d es, %d en).' %
              (len(quiero), len(castellano), len(ingles)))
        return 0

    try:
        import edge_tts
    except ImportError:
        print('Falta la herramienta. Instala una vez con:  py -m pip install edge-tts')
        return 1

    os.makedirs(CARPETA, exist_ok=True)

    # Fuera lo viejo: archivos cuya huella ya no casa con ningun texto de
    # NINGUN idioma (los dos juegos conviven, cada uno con sus huellas)
    for nombre in os.listdir(CARPETA):
        if nombre.endswith('.mp3') and nombre not in quiero:
            os.remove(os.path.join(CARPETA, nombre))
            print('borrado (texto cambiado): ' + nombre)

    nuevos = 0
    for nombre, (idioma, texto) in sorted(quiero.items()):
        ruta = os.path.join(CARPETA, nombre)
        if os.path.exists(ruta):
            continue
        print('generando [%s] %s ...' % (idioma, nombre))
        await edge_tts.Communicate(texto, VOCES[idioma], rate=RATE, pitch=PITCH).save(ruta)
        nuevos += 1

    print('')
    print('Listo: %d lineas (%d es + %d en), %d generadas ahora.' %
          (len(quiero), len(castellano), len(ingles), nuevos))
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
