# Prompts para el arte generado con IA

> **Estilo D (teselas)** es el camino elegido: está justo abajo.
> Más abajo queda el material del **estilo C** (vista de alzado), por si se
> retoma.

---

# ESTILO D — TESELAS (vista cenital sobre cuadrícula)

El terreno es una **rejilla de celdas cuadradas vistas desde arriba**; cada
elemento ocupa su celda y las tuberías se trazan entre ellas. Suelta los PNG en
esta carpeta con el nombre exacto y el juego los usa solo (botón *Estilo → D*).
Lo que falte se sigue dibujando por código, así puedes ir de una en una.

**Las tuberías NO son arte**: se dibujan por código para que la animación del
agua siga el caudal real. No hace falta generarlas.

## Reglas para que todas peguen (importante)

- **Vista CENITAL** (desde arriba, cámara perpendicular). No en perspectiva, no
  isométrica, no de lado.
- **Imagen CUADRADA** (p. ej. 512×512).
- **Luz suave desde arriba a la izquierda**, igual en todas.
- **Sin texto, sin marcas de agua, sin logotipos.** (El paisaje anterior traía
  una marca de agua abajo a la derecha; conviene pedirlo explícito.)
- **Sin sombra proyectada** en los edificios: la sombra la pone el juego.

## Estilo común (pégalo al final de CADA prompt)

> **, vista cenital desde arriba, estilo render 3D cartoon de juego móvil,
> colores saturados y limpios, luz suave desde arriba a la izquierda, sin texto,
> sin marca de agua, imagen cuadrada**

En inglés:
> **, top-down view from directly above, stylized 3D cartoon mobile game art,
> clean saturated colors, soft light from top-left, no text, no watermark,
> square image**

---

## 1. Teselas de terreno (fondo OPACO y **repetible**)

Estas se repiten por todo el tablero, así que pide **textura continua
(seamless/tileable)**. Si no salen perfectas no pasa nada: la rejilla del juego
dibuja el borde de cada celda y las costuras se leen como líneas de cuadrícula.

### `t_hierba.png`
> Textura de césped verde corto visto desde arriba, uniforme, sin objetos,
> textura continua repetible en mosaico (seamless tileable) *[+ estilo común]*

### `t_hierba_matojos.png`
> Textura de césped verde visto desde arriba con unos pocos arbustos y piedras
> pequeñas repartidos, textura continua repetible (seamless tileable) *[+ estilo común]*

### `t_agua.png`
> Textura de agua de río vista desde arriba, azul turquesa con ondas suaves y
> reflejos, textura continua repetible (seamless tileable) *[+ estilo común]*

### `t_orilla.png`
> Transición de tierra a agua vista desde arriba: césped en la mitad izquierda,
> una franja de arena y guijarros en el centro, y agua en la mitad derecha; el
> borde corre en vertical *[+ estilo común]*

### `t_tierra.png` (opcional, para futuras ampliaciones)
> Textura de tierra compactada y grava vista desde arriba, repetible *[+ estilo común]*

---

## 2. Teselas de instalaciones (fondo **TRANSPARENTE**)

Que el objeto **ocupe casi toda la imagen** dejando un margen pequeño, centrado.

### `t_captacion.png`
> Estación de captación de agua vista desde arriba: plataforma de hormigón junto
> al río con una reja de toma y tuberías *[+ estilo común]*, fondo transparente

### `t_bomba.png`
> Caseta de bombeo de agua vista desde arriba: edificio pequeño rectangular con
> tejado a dos aguas y tuberías azules entrando y saliendo *[+ estilo común]*,
> fondo transparente

### `t_deposito.png`
> Depósito de agua circular visto desde arriba: gran tanque cilíndrico metálico
> con pasarela y escalera exterior *[+ estilo común]*, fondo transparente

### `t_depuradora.png`
> Estación depuradora de aguas residuales vista desde arriba: dos tanques
> clarificadores circulares con brazos radiales, pasarelas metálicas y una
> caseta pequeña *[+ estilo común]*, fondo transparente

### `t_tanque.png`
> Tanque de tormentas enterrado visto desde arriba: gran tapa circular de
> hormigón con rejillas de ventilación y un aliviadero *[+ estilo común]*,
> fondo transparente

---

## 3. Teselas de población (fondo **TRANSPARENTE**, ocupan 2×2 celdas)

Cuadradas también; el juego las estira a su bloque de 2×2.

### `t_pueblo_aldea.png`
> Aldea vista desde arriba: cuatro o cinco casitas con tejado rojo alrededor de
> un camino de tierra, con algún árbol *[+ estilo común]*, fondo transparente

### `t_pueblo_villa.png`
> Pueblo visto desde arriba: una docena de casas con tejado rojo, calles
> empedradas, una plaza con fuente y una iglesia *[+ estilo común]*,
> fondo transparente

### `t_pueblo_ciudad.png`
> Ciudad vista desde arriba: manzanas de edificios de varias plantas con azoteas,
> calles en cuadrícula, una plaza central y zonas verdes *[+ estilo común]*,
> fondo transparente

---

## Consejo

Genera primero **`t_hierba.png` y `t_bombeo.png`**, suéltalas y mira el tablero
en *Estilo D*. Si el encuadre o la escala no cuadran con tu arte, dímelo y
ajusto proporciones y márgenes en `escena_teselas.js`.

---
---

# ESTILO C — vista de alzado (material anterior)

La idea: generas estas imágenes con **cualquier** generador de IA (Bing Image
Creator / Copilot y Google Gemini son gratis y valen de sobra; también ChatGPT,
Midjourney o Stable Diffusion), las guardas en esta carpeta `assets/` con el
nombre exacto de cada una, y el juego las usa solas (botón *Estilo → C · IA*).

Si falta algún archivo, ese elemento se dibuja con el estilo A, así puedes ir
añadiéndolas de una en una.

## Reglas para que TODAS peguen entre sí (importante)

- **Fondo transparente** (PNG con transparencia). Es lo más importante.
- **Imagen cuadrada** (p. ej. 1024×1024), objeto **centrado** con algo de margen.
- **Sin texto, sin marcas de agua, sin sombra bajo el objeto** (la sombra la
  pone el juego).
- El objeto **solo** (nada de fondos, ni suelo, ni cielo).

## Estilo común (pégalo al final de CADA prompt)

> **, render 3D estilizado tipo videojuego móvil moderno, vista en 3/4
> ligeramente elevada, luz cálida y suave desde arriba a la derecha, colores
> saturados y limpios, bordes redondeados, aspecto simpático, fondo
> transparente, PNG, objeto centrado, sin texto, sin marca de agua**

En inglés, por si tu herramienta responde mejor:
> **, stylized 3D render, modern mobile game art, 3/4 slightly top-down view,
> warm soft light from top-right, clean saturated colors, rounded edges,
> friendly look, transparent background, PNG, centered, no text, no watermark**

---

## EL PAISAJE DE FONDO (nuevo, recomendado)

En vez de trocear dos capas, ahora el juego admite **un único paisaje a pantalla
completa** llamado `paisaje.png`, y dibuja las estructuras encima. Es lo que hace
que todo pegue.

**Composición (importante), de abajo a arriba:**
- **Abajo del todo (≈15%)**: el **río**, de lado a lado (ahí caen la captación y
  el vertido).
- **Franja media (≈20%)**: **suelo/hierba llano** donde se apoyan los edificios.
- **Arriba (≈65%)**: **montañas y cielo**.

`paisaje.png` — prompt:
> Paisaje de valle: río caudaloso cruzando de lado a lado en primer plano abajo,
> una franja de pradera verde llana en medio, y montañas verdes con cielo al
> fondo *[+ estilo común]* **PERO** que **LLENE TODO EL CUADRO, 16:9, sin fondo
> transparente y sin cuadros grises de transparencia** (fondo sólido de borde a
> borde).

> ⚠️ El fondo que mandaste traía los "cuadros grises" (checkerboard) horneados en
> la parte de abajo: eso pasa cuando el generador exporta la transparencia como
> imagen. Pide "sin transparencia, cuadro completo" y ese problema desaparece.

**Día/noche y estaciones (opcional, no hace falta saber nada):** por defecto el
juego **oscurece el paisaje de día para simular la noche**. Si quieres más
calidad, deja también:
- `paisaje_noche.png` — el mismo valle de noche (cielo oscuro, luces).
- `paisaje_invierno.png` — el mismo valle nevado.
El juego elige la variante que exista; si no, se apaña con el de día.

## LOS PUEBLOS POR TAMAÑO (nuevo)

Tres imágenes de asentamiento; el juego elige según la población y crece sola.
Fondo **transparente de verdad** (no las quieras a pantalla completa):

- `pueblo_aldea.png` — *Grupo de 3-4 casitas de pueblo juntas, pequeñas* *[+ estilo común]*
- `pueblo_villa.png` — *Pueblo con varias casas y una iglesia o un edificio algo mayor* *[+ estilo común]*
- `pueblo_ciudad.png` — *Pequeña ciudad con edificios de varias plantas y alguna casa* *[+ estilo común]*

Mientras no existan, el juego usa las casas sueltas (`casa1-3.png`).

## Los archivos (estructuras sueltas)

Genera uno por línea. El **nombre del archivo tiene que ser exacto.**

### `bomba.png`
> Caseta de estación de bombeo de agua, pequeño edificio con tejado a dos aguas,
> una gran tubería/válvula azul y un ojo de buey circular *[+ estilo común]*

### `deposito.png`
> Depósito de agua elevado sobre cuatro patas (torre de agua) cilíndrico,
> metálico claro, escalera lateral *[+ estilo común]*

### `depuradora.png`
> Pequeña estación depuradora de aguas residuales con dos tanques clarificadores
> circulares y pasarelas metálicas *[+ estilo común]*

### `captacion.png`
> Boya de captación de agua turquesa flotando, pequeña toma de agua de río,
> forma redondeada *[+ estilo común]*

### `casa1.png`, `casa2.png`, `casa3.png`
Tres casitas DISTINTAS para que el pueblo no sea repetitivo. Mismo estilo, varía
color de pared y tejado:
> Casita de pueblo europea de dos plantas, tejado a dos aguas de teja roja,
> paredes color crema, ventanas con contraventanas *[+ estilo común]*

- `casa2.png`: paredes ocre y tejado marrón.
- `casa3.png`: paredes blancas y tejado de pizarra gris azulado.

### `arbol.png`
> Árbol frondoso de copa redonda y verde, tronco marrón *[+ estilo común]*

### `arbol_invierno.png` (opcional)
> Árbol con la copa cubierta de nieve, invierno *[+ estilo común]*

---

## Opcionales (más adelante, si quieres ir a por todas)

- `fondo.png`: paisaje de valle con colinas y cielo, panorámico 16:9, mismo
  estilo. (De momento el juego usa su cielo/colinas animados; el fondo por IA
  sería un paso extra que habría que cablear aparte — dímelo si lo generas.)

## Consejo

Genera primero **una** (p. ej. `casa1.png`), suéltala aquí, pon el juego en
*Estilo C* y mírala en su sitio. Si te gusta cómo encaja, sigue con el resto con
el mismo estilo. Si el tamaño o el recorte no cuadran, avísame y ajusto las
proporciones en `escena_assets.js`.
