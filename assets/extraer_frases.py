# -*- coding: utf-8 -*-
"""
El comprobador del diccionario inglés. Extrae los esqueletos de todas las
plantillas t`...` del código (la MISMA cuenta que esqueleto() en idioma.js:
partes fijas unidas con {0},{1}..., espacios plegados, recortado) y los
compara con las claves de EN.frases en src/idiomas/en.js.

    py assets/extraer_frases.py

Si FALTAN claves, esas frases saldrán en castellano jugando en inglés (no es
un error: es el diseño — pero es la lista de deberes). Si SOBRAN, alguien
cambió un texto en el código y su traducción quedó huérfana: hay que
actualizar la clave. En el juego, la consola dice lo mismo en vivo:
juego.sinTraducir.

OJO al escribir comentarios en los .js: nada de acentos graves alrededor de
una t suelta, que este extractor se los toma por una plantilla etiquetada.
"""
import re, json, sys, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTES = [os.path.join(RAIZ, 'src', a)
           for a in ('ui.js', 'simulacion.js', 'main.js', 'mapa.js', 'comentarios.js')]
DICCIONARIO = os.path.join(RAIZ, 'src', 'idiomas', 'en.js')


def esqueletos(src):
    """Todos los esqueletos t`...` de un fuente, en orden de aparición."""
    claves = []
    for m in re.finditer(r'(?<![\w$.])t`', src):
        j = m.end() - 1
        partes, actual = [], []
        k = j + 1
        while k < len(src):
            c = src[k]
            if c == '\\':
                actual.append(src[k:k + 2]); k += 2; continue
            if c == '`':
                partes.append(''.join(actual)); break
            if c == '$' and src[k + 1:k + 2] == '{':
                partes.append(''.join(actual)); actual = []
                prof = 1; k += 2
                while k < len(src) and prof:
                    ch = src[k]
                    if ch == '{': prof += 1
                    elif ch == '}': prof -= 1
                    elif ch == '`':          # plantilla anidada: saltarla entera
                        k += 1
                        prof2 = 0
                        while k < len(src):
                            c2 = src[k]
                            if c2 == '\\': k += 1
                            elif c2 == '$' and src[k + 1:k + 2] == '{': prof2 += 1; k += 1
                            elif c2 == '}' and prof2: prof2 -= 1
                            elif c2 == '`' and not prof2: break
                            k += 1
                    elif ch in ('"', "'"):   # cadena dentro de la expresión
                        q = ch; k += 1
                        while k < len(src) and src[k] != q:
                            if src[k] == '\\': k += 1
                            k += 1
                    k += 1
                continue
            actual.append(c); k += 1
        esq = partes[0]
        for x in range(1, len(partes)):
            esq += '{' + str(x - 1) + '}' + partes[x]
        claves.append(re.sub(r'\s+', ' ', esq).strip())
    return claves


codigo = set()
for ruta in FUENTES:
    if os.path.exists(ruta):
        codigo |= set(esqueletos(open(ruta, encoding='utf-8').read()))

src = open(DICCIONARIO, encoding='utf-8').read()
if 'frases: {' not in src:
    sys.exit('src/idiomas/en.js no tiene bloque frases')
seccion = src.split('frases: {', 1)[1]
frases = set(m.group(1).replace("\\'", "'")
             for m in re.finditer(r"^\s{4}'((?:[^'\\]|\\.)*)':", seccion, re.M))

faltan, sobran = sorted(codigo - frases), sorted(frases - codigo)
print(f'esqueletos en el código: {len(codigo)} · claves en el diccionario: {len(frases)}')
if not faltan and not sobran:
    print('Todo casa: cada frase del código tiene su traducción.')
if faltan:
    print(f'\nFALTAN en el diccionario ({len(faltan)}) — saldrán en castellano:')
    for k in faltan:
        print('  ' + json.dumps(k, ensure_ascii=False))
if sobran:
    print(f'\nSOBRAN en el diccionario ({len(sobran)}) — el texto original cambió:')
    for k in sobran:
        print('  ' + json.dumps(k, ensure_ascii=False))
sys.exit(1 if (faltan or sobran) else 0)
