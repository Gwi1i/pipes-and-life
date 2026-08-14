# -*- coding: utf-8 -*-
"""
GENERAR VOCES — la voz de Manuel con las voces neuronales de Microsoft.

La sintesis del navegador sonaba a robot; esto genera ARCHIVOS con la voz
neuronal (es-ES-AlvaroNeural), que es otra liga. Requisitos, una sola vez:

    py -m pip install edge-tts

y ejecutar esto cada vez que cambien los textos de Manuel:

    py generar_voces.py

El truco contra los audios mentirosos: el nombre de cada archivo lleva la
HUELLA del texto (assets/voz/<id>-<huella>.mp3). Si un texto cambia, el juego
no encuentra el archivo nuevo, cae al sintetizador del navegador, y este
script —al volver a correr— genera el que falta y borra el viejo. Un audio
grabado nunca puede quedarse contando lo de ayer.

Los textos se LEEN de src/config.js y src/comentarios.js: una sola fuente.
Necesita internet (la voz se genera en linea); el juego, no.
"""

import asyncio
import os
import re
import sys

VOZ = 'es-ES-AlvaroNeural'   # el hombre tranquilo; Elvira/Ximena si algun dia
RATE = '-8%'                 # un pelin pausado, de veterano
PITCH = '-10Hz'              # y un punto mas grave

RAIZ = os.path.dirname(os.path.abspath(__file__))
CARPETA = os.path.join(RAIZ, 'assets', 'voz')


def huella(texto):
    """La misma huella que calcula sonido.js: djb2 sobre UTF-8, 32 bits, hex."""
    h = 5381
    for b in texto.encode('utf-8'):
        h = ((h * 33) ^ b) & 0xFFFFFFFF
    return format(h, '08x')


def unir_cadenas(bloque):
    """Junta 'trozos' + 'concatenados' de JS en una sola cadena."""
    return ''.join(re.findall(r"'((?:[^'\\]|\\.)*)'", bloque))


def lineas_del_juego():
    """Extrae todo lo que Manuel dice: pasos de la guia, comentarios y saludo."""
    lineas = {}

    config = open(os.path.join(RAIZ, 'src', 'config.js'), encoding='utf-8').read()
    # Los pasos de la guia: se habla "titulo. texto", igual que en main.js
    tutorial = config.split('tutorial: [', 1)[1].split('\n  ],', 1)[0]
    for m in re.finditer(
            r"id: '(\w+)',\s*titulo: ((?:'[^']*'\s*\+?\s*)+),\s*"
            r"texto: ((?:'[^']*'\s*\+?\s*)+)", tutorial):
        lineas[m.group(1)] = unir_cadenas(m.group(2)) + '. ' + unir_cadenas(m.group(3))

    # El saludo de presentacion, que vive en CONFIG.sonido.voz
    m = re.search(r"presentacion: ((?:'[^']*'\s*\+?\s*)+)", config)
    if m:
        lineas['presentacion'] = unir_cadenas(m.group(1))

    # El cierre de la guia (CONFIG.cierreGuia): la enhorabuena de Manuel
    m = re.search(r"cierreGuia: \{\s*texto: ((?:'[^']*'\s*\+?\s*)+)", config)
    if m:
        lineas['cierreGuia'] = unir_cadenas(m.group(1))

    comentarios = open(os.path.join(RAIZ, 'src', 'comentarios.js'), encoding='utf-8').read()
    for m in re.finditer(r"id: '(\w+)'.*?texto: ((?:'[^']*'\s*\+?\s*)+)\n",
                         comentarios, re.DOTALL):
        lineas[m.group(1)] = unir_cadenas(m.group(2))

    return lineas


async def main():
    try:
        import edge_tts
    except ImportError:
        print('Falta la herramienta. Instala una vez con:  py -m pip install edge-tts')
        return 1

    os.makedirs(CARPETA, exist_ok=True)
    lineas = lineas_del_juego()
    if not lineas:
        print('No he encontrado textos: ¿ha cambiado el formato de config.js?')
        return 1

    quiero = {}
    for id_, texto in lineas.items():
        quiero['%s-%s.mp3' % (id_, huella(texto))] = texto

    # Fuera lo viejo: archivos cuya huella ya no casa con ningun texto
    for nombre in os.listdir(CARPETA):
        if nombre.endswith('.mp3') and nombre not in quiero:
            os.remove(os.path.join(CARPETA, nombre))
            print('borrado (texto cambiado): ' + nombre)

    nuevos = 0
    for nombre, texto in sorted(quiero.items()):
        ruta = os.path.join(CARPETA, nombre)
        if os.path.exists(ruta):
            continue
        print('generando ' + nombre + ' ...')
        await edge_tts.Communicate(texto, VOZ, rate=RATE, pitch=PITCH).save(ruta)
        nuevos += 1

    print('')
    print('Listo: %d lineas, %d generadas ahora, con la voz %s.' %
          (len(quiero), nuevos, VOZ))
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
