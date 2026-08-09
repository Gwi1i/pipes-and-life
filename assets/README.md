# assets/

Imágenes generadas con IA. Ver `PROMPTS.md` para los prompts listos para copiar
y pegar.

## Estilo D — teselas (el camino elegido)

Vista cenital sobre cuadrícula. Cada archivo que falte se dibuja por código, así
que puedes ir añadiéndolas de una en una (botón *Estilo → D · Teselas*).

| Archivo | Qué es | Fondo |
|---|---|---|
| `t_hierba.png` | Césped, textura repetible | opaco |
| `t_hierba_matojos.png` | Césped con arbustos y piedras | opaco |
| `t_agua.png` | Agua del río, repetible | opaco |
| `t_orilla.png` | Transición césped→agua (agua a la derecha) | opaco |
| `t_tierra.png` | Tierra/grava (opcional, para ampliaciones) | opaco |
| `t_captacion.png` | Toma de agua | transparente |
| `t_bomba.png` | Caseta de bombeo | transparente |
| `t_deposito.png` | Depósito circular | transparente |
| `t_depuradora.png` | Estación depuradora | transparente |
| `t_tanque.png` | Tanque de tormentas | transparente |
| `t_pueblo_aldea.png` | Aldea (ocupa 2×2 celdas) | transparente |
| `t_pueblo_villa.png` | Pueblo | transparente |
| `t_pueblo_ciudad.png` | Ciudad | transparente |

Las **tuberías no son arte**: se dibujan por código para que el agua se anime
según el caudal real.

## Estilo C — vista de alzado (material anterior)

Suelta aquí los PNG con estos nombres exactos (fondo transparente, cuadrados):

| Archivo              | Qué es                    | ¿Obligatorio? |
|----------------------|---------------------------|---------------|
| `paisaje.png`        | Paisaje de fondo a pantalla completa (río abajo, suelo en medio, montañas y cielo arriba). **Sin transparencia.** | recomendado |
| `paisaje_noche.png`  | Igual, de noche           | opcional (si no, se oscurece el de día) |
| `paisaje_invierno.png`| Igual, nevado            | opcional      |
| `pueblo_aldea.png`   | Asentamiento pequeño (fondo transparente) | opcional (si no, casa1-3) |
| `pueblo_villa.png`   | Pueblo mediano            | opcional      |
| `pueblo_ciudad.png`  | Ciudad                    | opcional      |
| `bomba.png`          | Caseta de bombeo          | recomendado   |
| `deposito.png`       | Depósito / torre de agua  | recomendado   |
| `depuradora.png`     | Estación depuradora       | recomendado   |
| `captacion.png`      | Toma de agua en el río    | opcional      |
| `casa1.png`          | Casa del pueblo (variante 1) | recomendado |
| `casa2.png`          | Casa del pueblo (variante 2) | recomendado |
| `casa3.png`          | Casa del pueblo (variante 3) | recomendado |

Cada archivo que falte se dibuja con el estilo A automáticamente, así que puedes
ir completándolos poco a poco. En el juego, el botón **Estilo** (arriba a la
derecha) cicla A → B → C.
