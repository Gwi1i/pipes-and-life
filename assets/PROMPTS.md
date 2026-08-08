# Prompts para el arte del estilo C (generado con IA)

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

## Los archivos

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
