# -*- coding: utf-8 -*-
"""
Recorte por INUNDACION de las hojas de sprites (residuos_hoja.png 6x4 y
contenedores_hoja2.png 4x1): el partidor simple de optimizar.ps1 necesita
fondo liso, pero el generador se empeña en pintar paisaje detrás — dos hojas
de dos han venido así. Este script aguanta ese caso: vota el color de loseta
entre todas las casillas, inunda desde los bordes lo parecido a él (la
conectividad respeta los cristales que dejan ver el fondo a través) y
descarta por ISLAS lo que sobrevive suelto o pegado a la orilla (matas,
piedras y bandas del decorado).

Uso: `py assets/recortar_hojas.py` (una vez: `py -m pip install pillow`).
Busca las hojas en assets/ y, si ya se movieron, en assets/originales/.
"""
from PIL import Image
from collections import deque
import os

ASSETS = os.path.dirname(os.path.abspath(__file__))
ORIG = os.path.join(ASSETS, 'originales')

def hoja_donde_este(nombre):
    """La hoja recién soltada en assets/, o la ya archivada en originales/."""
    for carpeta in (ASSETS, ORIG):
        ruta = os.path.join(carpeta, nombre)
        if os.path.exists(ruta):
            return ruta
    raise SystemExit(f'No encuentro {nombre} ni en assets/ ni en originales/')
UMBRAL_OSCURO = 80          # media RGB por debajo: contorno, no se cruza

def lila_de(celda):
    """El color de fondo de la casilla: 8 muestras por el borde y gana el
    RACIMO más numeroso (algunas caen en paisaje, pero la loseta domina)."""
    w, h = celda.size
    px = celda.load()
    puntos = ((0.07, 0.10), (0.93, 0.10), (0.07, 0.90), (0.93, 0.90),
              (0.06, 0.50), (0.94, 0.50), (0.50, 0.06), (0.50, 0.94))
    cols = [px[int(w * a), int(h * b)][:3] for a, b in puntos]
    mejor, mejorVotos = cols[0], -1
    for c in cols:
        votos = [o for o in cols
                 if sum((c[k] - o[k]) ** 2 for k in range(3)) < 40 * 40]
        if len(votos) > mejorVotos:
            mejorVotos = len(votos)
            mejor = tuple(sum(v[k] for v in votos) // len(votos) for k in range(3))
    return mejor

def cortar_fondo(celda, solo_mayor, min_frac, lila=None, directo=False):
    """Devuelve la celda RGBA con el fondo inundado a transparente.

    Dos modos: con `lila`, se inunda solo lo PARECIDO a ese color (croma con
    conectividad: un cristal transparente que deja ver el lila a través no se
    toca porque su lila interior no conecta con el de fuera). Sin `lila`, se
    inunda todo lo que no sea contorno oscuro (vale para dibujos con tinta
    negra de verdad, como los contenedores)."""
    celda = celda.convert('RGBA')
    w, h = celda.size
    px = celda.load()
    fondo = bytearray(w * h)

    if lila:
        def pasable(x, y):
            r, g, b, a = px[x, y]
            return ((r - lila[0]) ** 2 + (g - lila[1]) ** 2
                    + (b - lila[2]) ** 2) < 50 * 50
    else:
        def pasable(x, y):
            r, g, b, a = px[x, y]
            return (r + g + b) / 3 >= UMBRAL_OSCURO

    oscuro = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if (r + g + b) / 3 < UMBRAL_OSCURO:
                oscuro[y * w + x] = 1

    # modo DIRECTO: croma a secas, sin conectividad — para las casillas donde
    # la loseta se funde con el objeto por un hueco del contorno. Solo vale si
    # el objeto no tiene ningún color parecido al fondo.
    if directo and lila:
        for y in range(h):
            for x in range(w):
                if pasable(x, y):
                    fondo[y * w + x] = 1

    # 1. inundar desde los cuatro bordes
    cola = deque()
    for x in range(w):
        cola.append((x, 0)); cola.append((x, h - 1))
    for y in range(h):
        cola.append((0, y)); cola.append((w - 1, y))
    while cola:
        x, y = cola.popleft()
        i = y * w + x
        if fondo[i] or not pasable(x, y):
            continue
        fondo[i] = 1
        if x > 0: cola.append((x - 1, y))
        if x < w - 1: cola.append((x + 1, y))
        if y > 0: cola.append((x, y - 1))
        if y < h - 1: cola.append((x, y + 1))

    # 1b. una erosion: el fleco de dique CLARO pegado a lo inundado es fondo
    # (la dilatacion deja un anillo de color de fondo alrededor de la tinta)
    fleco = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if fondo[i] or oscuro[i]:
                continue
            for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0 <= nx < w and 0 <= ny < h and fondo[ny * w + nx]:
                    fleco.append(i)
                    break
    for i in fleco:
        fondo[i] = 1

    # 2. islas: componentes de lo no inundado
    visto = bytearray(w * h)
    islas = []
    for y0 in range(h):
        for x0 in range(w):
            i0 = y0 * w + x0
            if fondo[i0] or visto[i0]:
                continue
            pixeles = []
            toca_borde = False
            bx0 = bx1 = x0; by0 = by1 = y0
            cola = deque([(x0, y0)])
            visto[i0] = 1
            while cola:
                x, y = cola.popleft()
                pixeles.append((x, y))
                bx0 = min(bx0, x); bx1 = max(bx1, x)
                by0 = min(by0, y); by1 = max(by1, y)
                if x == 0 or y == 0 or x == w - 1 or y == h - 1:
                    toca_borde = True
                for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not fondo[j] and not visto[j]:
                            visto[j] = 1
                            cola.append((nx, ny))
            islas.append((pixeles, toca_borde, (bx1 - bx0 + 1, by1 - by0 + 1)))

    # 3. decidir qué islas viven
    if solo_mayor:
        vivas = [max(islas, key=lambda i: len(i[0]))[0]] if islas else []
    else:
        minimo = w * h * min_frac
        vivas = []
        for p, borde, (aw, ah) in islas:
            # una isla que abarca casi toda la casilla es FONDO (la loseta o
            # una banda de paisaje), sea del color que sea
            if aw >= w * 0.88 or ah >= h * 0.88:
                continue
            if len(p) < minimo:
                continue
            # tocar el borde condena (restos y bandas del decorado); los
            # objetos van centrados y no llegan a tocar el recorte
            if borde and len(p) < w * h * 0.30:
                continue
            # motas del color del fondo (antialias de la loseta): solo islas
            # pequeñas — un objeto de tonos parecidos al lila no es una mota
            if lila and len(p) < w * h * 0.03:
                mr = sum(px[x, y][0] for x, y in p) / len(p)
                mg = sum(px[x, y][1] for x, y in p) / len(p)
                mb = sum(px[x, y][2] for x, y in p) / len(p)
                if ((mr - lila[0]) ** 2 + (mg - lila[1]) ** 2
                        + (mb - lila[2]) ** 2) < 45 * 45:
                    continue
            # decorado arrimado a la orilla: isla pequeña con el centro en el
            # anillo exterior de la casilla (matojos, piedras del paisaje)
            cx = sum(x for x, y in p) / len(p)
            cy = sum(y for x, y in p) / len(p)
            orilla = (cx < w * 0.14 or cx > w * 0.86
                      or cy < h * 0.14 or cy > h * 0.86)
            if orilla and len(p) < w * h * 0.10:
                continue
            vivas.append(p)
        if not vivas and islas:                      # red de seguridad
            vivas = [max(islas, key=lambda i: len(i[0]))[0]]

    # 4. componer: transparente todo salvo las islas vivas
    salida = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    spx = salida.load()
    for pixeles in vivas:
        for x, y in pixeles:
            spx[x, y] = px[x, y]
    return salida

def bbox_con_margen(img, margen):
    caja = img.getbbox()
    if not caja:
        return img
    x0, y0, x1, y1 = caja
    return img.crop((max(0, x0 - margen), max(0, y0 - margen),
                     min(img.width, x1 + margen), min(img.height, y1 + margen)))

# ---- LOS RESIDUOS: 6x4, recorte 5% hacia dentro, salida 128x128 ----
ORDEN_RES = ['caja','periodico','revista','huevera','tubo','botellaVidrio',
             'botellaMarron','tarro','frasco','botellaPlastico','lata','lataConservas',
             'brik','yogur','aerosol','manzana','platano','raspa',
             'hueso','cascara','bolsa','panal','maceta','esponja']

hoja = Image.open(hoja_donde_este('residuos_hoja.png'))
cw, ch = hoja.width // 6, hoja.height // 4
m = int(cw * 0.02)      # la inundación ya se come el fondo; el recorte apenas entra

# El lila es EL MISMO en toda la hoja: se vota primero por casilla y luego
# entre las 24 — las casillas que pisan el camino de tierra votan marrón,
# pero la mayoría de la hoja las desmiente.
votos = []
for i in range(24):
    cx, cy = (i % 6) * cw, (i // 6) * ch
    votos.append(lila_de(hoja.crop((cx + m, cy + m, cx + cw - m, cy + ch - m))))
LILA, mejorVotos = votos[0], -1
for c in votos:
    grupo = [o for o in votos
             if sum((c[k] - o[k]) ** 2 for k in range(3)) < 40 * 40]
    if len(grupo) > mejorVotos:
        mejorVotos = len(grupo)
        LILA = tuple(sum(v[k] for v in grupo) // len(grupo) for k in range(3))
print('lila global:', LILA, 'con', mejorVotos, 'casillas de acuerdo')

for i, nombre in enumerate(ORDEN_RES):
    cx, cy = (i % 6) * cw, (i // 6) * ch
    celda = hoja.crop((cx + m, cy + m, cx + cw - m, cy + ch - m))
    corte = cortar_fondo(celda, solo_mayor=False, min_frac=0.004,
                         lila=LILA,
                         directo=nombre == 'bolsa')
    corte = corte.resize((128, 128), Image.LANCZOS)
    corte.save(os.path.join(ASSETS, f'res_{nombre}.png'))
    print('res_' + nombre)

# ---- LOS CONTENEDORES: la hoja 2 (4x1), isla mayor, alto 256 ----
ORDEN_CONT = ['envases', 'organica', 'papel', 'vidrio']
hoja2 = Image.open(hoja_donde_este('contenedores_hoja2.png'))
cw = hoja2.width // 4
m = int(cw * 0.02)
for i, nombre in enumerate(ORDEN_CONT):
    celda = hoja2.crop((i * cw + m, m, (i + 1) * cw - m, hoja2.height - m))
    corte = cortar_fondo(celda, solo_mayor=True, min_frac=0)
    corte = bbox_con_margen(corte, 6)
    alto = 256
    ancho = round(alto * corte.width / corte.height)
    corte = corte.resize((ancho, alto), Image.LANCZOS)
    corte.save(os.path.join(ASSETS, f'cont_{nombre}.png'))
    print('cont_' + nombre)

# ---- los originales, a su carpeta, como hace el optimizador ----
os.makedirs(ORIG, exist_ok=True)
for f in ['residuos_hoja.png', 'contenedores_hoja.png', 'contenedores_hoja2.png']:
    origen = os.path.join(ASSETS, f)
    if os.path.exists(origen):
        destino = os.path.join(ORIG, f)
        if os.path.exists(destino):
            os.remove(destino)
        os.rename(origen, destino)
        print(f + ' -> originales/')
print('hecho')
