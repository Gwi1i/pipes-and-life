# Prompts para el arte generado con IA

> **Lo que se usa hoy son las FICHAS**, aquí abajo: la ilustración que abre la
> explicación de cada instalación.
>
> Más abajo quedan los prompts de las teselas del mapa (estilo D) y de los
> alzados (estilo C). **Ese arte ya no lo usa el juego**: el mapa se dibuja
> entero por código. Se conservan porque las reglas de cómo pedirle las cosas al
> generador siguen valiendo, y por si algún día se retoma.

---

# FICHAS DIVULGATIVAS — ilustración por instalación

Estas NO son las teselas del mapa. Son la **imagen grande que abre la ficha** de
cada instalación, la que tiene que hacer que alguien se pare a leer. Van en el
panel lateral, apaisadas, y debajo viene el texto de qué es y para qué sirve.

Suelta los PNG en esta carpeta con el nombre exacto. **Lo que falte se sigue
dibujando con el esquema animado por código**, así que puedes ir generándolas de
una en una y el juego nunca se queda con un hueco.

| Archivo | Instalación |
|---|---|
| `f_captacion.png`  | Obra de toma |
| `f_bomba.png`      | Estación de bombeo |
| `f_deposito.png`   | Depósito regulador |
| `f_acuifero.png`   | Sondeo a acuífero |
| `f_depuradora.png` | EDAR |
| `f_tanque.png`     | Tanque de tormentas |
| `f_vertedero.png`  | Vertedero controlado |
| `f_reciclaje.png`  | Planta de reciclaje |
| `f_aldea.png`      | El pueblo, hasta 400 habitantes |
| `f_pueblo.png`     | El pueblo, hasta 1.600 |
| `f_villa.png`      | El pueblo, hasta 6.000 |
| `f_ciudad.png`     | El pueblo, más de 6.000 |

## Lo que aprendimos con las teselas, y sigue valiendo

- **Empieza por el verbo** y escribe **una sola frase seguida**. Nada de
  títulos, listas ni nombres de archivo: el nombre es solo para guardar.
- **Pocas negaciones.** En vez de "no en sección, no isométrica", di en positivo
  *"vista en tres cuartos"*.
- Si responde con texto, insiste: **"Genérala como imagen"**.
- **Pide explícitamente que no lleve texto ni marca de agua.** La primera tanda
  vino con una abajo a la derecha.

## Dos avisos NUEVOS para estas

**No le pidas cortes ni secciones.** Un despiece con el interior a la vista es
justo lo que peor le sale: tuberías que no conectan con nada, rótulos ilegibles y
maquinaria inventada. Lo que hace bien es la instalación **vista por fuera, en
tres cuartos**, como una maqueta bonita. La explicación de por dónde va el agua
la ponen el texto y el esquema animado, que para eso están.

**EL VÍDEO GANA.** La primera prueba lo dejó claro: el clip del depósito hace lo
que una imagen fija no puede —el vaso abriéndose en corte para enseñar el agua
por dentro— y encima cierra el bucle limpio: el primer fotograma y el último son
idénticos, comprobado midiendo píxeles. Si puedes generar vídeo, genera vídeo.

Y una corrección: más arriba se avisaba de no pedirle cortes ni secciones porque
los generadores los hacen mal. **Para imagen fija sigue siendo verdad; para vídeo
no.** Este los resuelve bien.

Lo que hay que pedirle a un vídeo:

- **Diez segundos como mucho**, y que **empiece y acabe igual** para que el bucle
  no dé un salto. Díselo con esas palabras: *"que el último fotograma sea igual
  que el primero"*.
- **Cámara quieta.** Nada de travellings ni zooms: se ve en un panel pequeño y al
  lado hay texto que leer. Lo que se mueve es el agua, no el encuadre.
- **720p sobra.** El panel mide 440 píxeles de ancho.

Si solo puedes sacar imagen fija, sigue valiendo: el juego le pone el movimiento
por encima. El orden de preferencia es `.mp4` → `.jpg` → `.png` → esquema por
código, y lo que falte se cubre solo.

## El peso, que no es un detalle

La primera ilustración vino a 2752×1536 y **6,3 MB**. El panel mide 440×240: eso
son **cuarenta veces más píxeles** de los que se van a ver. Y en JPEG al 82 % la
misma imagen a 880 px de ancho pesa **78 KB**, doce veces menos que en PNG y sin
diferencia apreciable.

Regla: **guarda el original donde quieras, pero en `assets/` deja la copia
ligera.** Aquí no hay transparencia que preservar, así que el PNG no aporta nada.

## Coletilla de estilo (pégala al final de CADA prompt)

> **, ilustración apaisada de formato 16:9, estilo render 3D cartoon de
> videojuego móvil, vista en tres cuartos ligeramente elevada, colores saturados
> y limpios, luz suave de mediodía, fondo sencillo de cielo y terreno, sin texto
> ni marca de agua**

---

## Los ocho prompts

### `f_captacion.png`
> Genera una imagen: una obra de toma de agua a la orilla de un río caudaloso,
> una pequeña torre de hormigón con compuertas metálicas y una reja de barrotes
> verticales que filtra ramas y hojas antes de que el agua entre, con una tubería
> gruesa que sale hacia la derecha entre la hierba de la ribera

### `f_bomba.png`
> Genera una imagen: una estación de bombeo de agua, una caseta baja de ladrillo
> con puerta metálica y ventanas, y a su lado dos grandes bombas centrífugas
> azules conectadas a tuberías de acero con válvulas rojas de volante, con una
> tubería gruesa que sube y se aleja hacia una loma

### `f_deposito.png`
> Genera una imagen: un depósito de agua elevado sobre una colina verde, un gran
> cilindro de hormigón claro con una escalera de gato metálica por el lateral y
> barandilla en la cubierta, con un pueblo pequeño de casas de tejado rojo abajo
> en el valle

### `f_acuifero.png`
> Genera una imagen: un sondeo de captación de agua subterránea en un campo seco,
> un castillete metálico de perforación sobre la boca entubada del pozo, con el
> cabezal, la tubería de impulsión y un cuadro eléctrico gris al lado

### `f_depuradora.png`
> Genera una imagen: una estación depuradora de aguas residuales con dos grandes
> decantadores circulares de hormigón llenos de agua, cada uno con su puente de
> rasquetas metálico cruzando el diámetro, más un tanque rectangular de aireación
> con agua burbujeante al fondo y un río limpio detrás

### `f_tanque.png`
> Genera una imagen: un tanque de tormentas de aguas pluviales, un gran depósito
> enterrado de hormigón del que solo asoman la losa de cubierta, dos tapas de
> registro circulares y una torre de ventilación, bajo un cielo de tormenta con
> lluvia y un colector de gran diámetro entrando por un lateral

### `f_vertedero.png`
> Genera una imagen: un vertedero controlado de residuos, una explanada excavada
> en terrazas con la basura extendida en capas y cubierta de tierra, una
> excavadora amarilla compactando arriba, chimeneas de desgasificación asomando y
> una valla metálica rodeando todo el recinto

### `f_potabilizadora.png`
> Genera una imagen: una estación de tratamiento de agua potable vista desde
> fuera, con dos balsas rectangulares de filtros llenas de agua clara y
> quieta, un pequeño decantador, un edificio bajo de control con una puerta y
> un tanque cilíndrico blanco de cloro junto a él, tuberías gruesas
> conectando las balsas, todo limpio y ordenado sobre una explanada de
> hierba, *(+ coletilla)*

### `f_reciclaje.png`
> Genera una imagen: el interior luminoso de una planta de reciclaje de residuos,
> una cinta transportadora larga con envases y cartones mezclados avanzando,
> operarios con chaleco naranja separando a los lados, y al fondo balas
> compactadas de plástico y cartón apiladas por colores

## Los cuatro tamaños de pueblo

Presiden la **ficha del pueblo**, la que sale al clicarlo en el mapa, y
**cambian solas al crecer**: el mismo núcleo pasa de aldea a pueblo, a villa y
a ciudad según su población. En el mapa el caserío se sigue dibujando por
código (tiene que casar en isométrica con el depósito y el bombeo, y aguantar
el zoom y la niebla); estas son la lámina del panel, que es donde una
ilustración sí luce.

**La regla que las hace funcionar: tienen que parecer EL MISMO SITIO en cuatro
momentos, no cuatro pueblos distintos.** Si no, crecer parece un cambio de
casa. Tres trucos para conseguirlo:

- **Genera primero `f_aldea`** y, para las otras tres, adjúntala diciendo
  *"el mismo pueblo años después, ya más grande, con el mismo paisaje, el
  mismo río y la misma luz"*.
- **Repite los mismos anclajes** en los cuatro prompts: el río a la izquierda,
  las colinas al fondo, el depósito de agua en la loma. Están ya escritos
  abajo — no los cambies.
- **De villa en adelante, la iglesia con campanario**, que es la que da el
  salto de caserío a pueblo de verdad (el dibujo del mapa hace lo mismo).

### `f_aldea.png`
> Genera una imagen: una aldea pequeña de apenas ocho casas de piedra con
> tejados de teja roja agrupadas junto a un río que cruza por la izquierda,
> colinas verdes al fondo con un pequeño depósito de agua elevado sobre una
> loma, huertos y un camino de tierra entre las casas, sin iglesia

### `f_pueblo.png`
> Genera una imagen: el mismo pueblo años después, ahora de unas veinticinco
> casas de piedra con tejados de teja roja, con el mismo río cruzando por la
> izquierda y las mismas colinas verdes al fondo con su depósito de agua
> elevado sobre la loma, calles empedradas, algún huerto en las afueras

### `f_villa.png`
> Genera una imagen: el mismo pueblo convertido en una villa de unas sesenta
> casas apiñadas con tejados de teja roja y una iglesia de piedra con
> campanario alto en el centro, con el mismo río cruzando por la izquierda y
> las mismas colinas verdes al fondo con su depósito de agua elevado, una
> plaza y calles estrechas

### `f_ciudad.png`
> Genera una imagen: el mismo lugar convertido en una ciudad pequeña de
> edificios de tres y cuatro plantas con tejados de teja roja apretados
> alrededor de la iglesia de campanario alto, con el mismo río cruzando por la
> izquierda cruzado ahora por un puente y las mismas colinas verdes al fondo
> con dos depósitos de agua elevados, avenidas y una plaza mayor

### Las RUINAS (opcional): `f_<pieza>_ruina.png`

La ficha de una instalación abandonada del mapa enseña su lámina si existe
(`f_bomba_ruina`, `f_deposito_ruina`, `f_captacion_ruina`,
`f_depuradora_ruina` y `f_tanque_ruina` — las cinco que pueden aparecer
abandonadas). **El truco es partir de la ficha que ya tienes**: adjunta la
imagen original (`f_bomba.jpg`, etc.) y pide:

> Genera una imagen a partir de esta: la MISMA instalación, décadas después
> de abandonada — techos hundidos, óxido en los metales, cristales rotos,
> maleza y arbustos creciendo por dentro y por fuera, el mismo encuadre y el
> mismo paisaje de fondo pero descuidado, *(+ coletilla)*

Así la ruina de tu bomba se parece a TU bomba, que es lo que hace el clic de
"esto se puede recuperar". Sin archivo, la ficha sale igual con su texto: se
pueden ir generando de una en una.

### Las ÉPOCAS (opcional, para las comarcas)

Con el traslado de concesión, cada comarca nueva puede tener pueblos **más
modernos**: la ficha prueba primero `f_<escalón>_e2.jpg` (comarca 2) y
`f_<escalón>_e3.jpg` (comarca 3 en adelante), y si no existen cae a la base.
Son las mismas cuatro estampas con otro año encima — pide *"el mismo pueblo,
décadas después: casas renovadas, alguna placa solar, coches, el depósito
modernizado"* para la época 2, y una versión aún más contemporánea para la 3.
Ocho imágenes en total si haces las dos épocas; se pueden ir soltando de una
en una, como todo.

## Si alguna sale rara

- **Demasiado detalle o demasiado realista**: añade *"formas simples y limpias,
  poco detalle"*.
- **Se ve desde muy arriba o muy de frente**: repite *"vista en tres cuartos
  ligeramente elevada"* al principio Y al final.
- **Sale con carteles o números**: *"sin ningún texto, ni carteles ni números"*.
- **Los colores no pegan con las demás**: dile *"la misma paleta y la misma luz
  que esta"* y adjunta una que ya te guste.

---

# LA PORTADA (`h_portada.png`)

El cartel de la pantalla de inicio, encima del título y del botón de Empezar.
Es lo primero que ve cualquiera que abra el juego —o a quien se lo enseñes—,
así que tiene que ser LA promesa del juego entera: el territorio, el agua y la
red que lo une todo.

### `h_portada.png`
> Genera una imagen: vista panorámica de un valle con varios pueblos pequeños
> repartidos entre colinas, un río cruzándolo, un depósito de agua en lo alto
> de una loma y una conducción de agua que va uniendo los pueblos con el río,
> luz cálida de media tarde, sensación de mapa vivo visto desde una altura
> suave, *(+ coletilla)*

---

# LOS RESIDUOS DE LA LÍNEA (`residuos_hoja.png`)

Los 24 objetos que pasan por la cinta, con el estilo de las ilustraciones.
Van en UNA hoja con rejilla de **6 columnas × 4 filas** sobre fondo liso, y el
`optimizar.bat` recorta cada casilla y le quita el fondo (por eso el fondo
liso es obligatorio). **El orden de la rejilla es sagrado** — el juego asigna
cada casilla a su contenedor por posición:

|  |  |  |  |  |  |
|---|---|---|---|---|---|
| caja de cartón | periódico doblado | revista | huevera de cartón | rollo de cartón (tubo) | botella de vidrio verde |
| botella de vidrio marrón (cerveza) | tarro de cristal con tapa | frasco de colonia de vidrio | botella de plástico APLASTADA | lata de refresco | lata de conservas abierta |
| brik de zumo | vaso de yogur con la tapa a medio quitar | bote de aerosol | corazón de manzana | piel de plátano | raspa de pescado |
| muslo de pollo comido (hueso) | cáscara de huevo rota | bolsa de basura gris atada | pañal enrollado | maceta de cerámica rota | esponja de fregar amarilla y verde |

Las reglas de la selección, del oficio: **residuos CLAROS**, sin dobleces (el
zapato viejo se retiró — si sirve va a textil y si no a resto, y ese matiz no
cabe en una cinta). La botella de plástico va **aplastada, arrugada** a
propósito: es lo que la distingue del vidrio de un vistazo. Y los del resto
enseñan de verdad: pañal, maceta de CERÁMICA (el error clásico del iglú
verde) y esponja no tienen contenedor. **Nada de marcas reales** — rótulos
inventados y genéricos (SODA, ZUMO), que un logo registrado en un juego que
quizá se venda es un pleito.

### `residuos_hoja.png`
> Genera una imagen: rejilla de seis columnas por cuatro filas con
> veinticuatro objetos de basura doméstica del mismo tamaño, cada uno centrado
> en su casilla sobre fondo liso de un solo color lila claro, sin líneas de
> rejilla dibujadas y sin marcas comerciales reales, en este orden de
> izquierda a derecha y de arriba abajo: una caja de cartón cerrada, un
> periódico doblado, una revista, una huevera de cartón, un rollo de cartón de
> papel higiénico gastado, una botella de vidrio verde; una botella de vidrio
> marrón de cerveza, un tarro de cristal con tapa, un frasco de colonia de
> vidrio, una botella de plástico transparente aplastada y arrugada con tapón,
> una lata de refresco roja, una lata de conservas abierta; un brik de zumo
> con pajita, un vaso de yogur con la tapa a medio quitar, un bote de aerosol,
> un corazón de manzana mordida, una piel de plátano abierta, una raspa de
> pescado; un hueso de muslo de pollo comido, una cáscara de huevo rota, una
> bolsa de basura gris atada, un pañal enrollado y cerrado, una maceta de
> cerámica naranja rota y una esponja de fregar amarilla con lomo verde,
> *(+ coletilla)*

Consejos: fondo de un color que no salga en los objetos (un lila o rosa claro
va bien) y **sin líneas de rejilla dibujadas** — aunque el partidor ya entra
un 5% hacia dentro de cada casilla por si acaso. Las casillas se cortan a
sextos y cuartos exactos: si algún objeto sale montado sobre la raya de su
casilla, regenera, que recortado a la mitad no hay quien lo reconozca.

**Si el generador se empeña en pintar paisaje detrás** (pasó con esta hoja y
con la de contenedores), no hace falta pelearse con él:
`py assets/recortar_hojas.py` la parte igual — inunda el fondo por color y
conectividad y descarta el decorado por islas. Necesita Pillow
(`py -m pip install pillow`, una vez).

---

# LA NAVE DE LA LÍNEA DE RECICLAJE (`mini_reciclaje.png`)

El fondo del minijuego de la cinta: la nave de la planta, vista de frente,
donde el juego dibuja encima la cinta, los residuos y los contenedores. Se ve
OSCURECIDA con un velo para que lo jugable resalte, así que interesa una
escena con volumen y profundidad más que con detalle fino. **Sin cinta ni
contenedores en la imagen** — esos los pone el juego, y dos cintas a la vez
se pelearían.

### `mini_reciclaje.png`
> Genera una imagen: el interior de una nave industrial de una planta de
> reciclaje, vista frontal con las cerchas metálicas del techo, ventanales
> altos con luz de día entrando, sacas y balas de material prensado apiladas
> al fondo contra la pared, sin personas y sin maquinaria en primer plano,
> dejando despejada la mitad inferior de la imagen, *(+ coletilla)*

---

# LA HOJA DEL CAMIÓN (`camion_hoja.png`)

Los sprites CENITALES del minijuego de la ruta: el camión, cuatro coches y
los cinco contenedores, todos vistos desde arriba. `recortar_hojas.py` la
parte en 10 sprites (`cam_*.png`) y les quita el fondo; sin hoja, todo
sigue dibujado por código.

Tres reglas que importan:

- **La caja del camión, NEUTRA** (gris oscuro, sin colores): las tapas de
  las fracciones del día las pinta el juego encima — son la mecánica. La
  cabina arriba (el camión "mira" hacia arriba) y la caja ocupando los dos
  tercios de abajo.
- **Los coches mirando hacia ABAJO** (vienen de frente): se les ve el capó
  y el parabrisas delantero en la parte baja. Cuatro coches distintos de
  colores distintos, turismos normales de pueblo.
- **Los contenedores con la tapa CERRADA y lisa**: las bolsas del lleno y
  la rendija del a-medias las pinta el juego encima. El orden es sagrado:
  **gris (resto), amarillo (envases), marrón (orgánica), azul (papel),
  verde (vidrio)**.

Cuadrícula 5×2 sobre fondo liso de un color que no aparezca en los dibujos
(el lila de siempre va bien), **sin textos y sin sombras arrojadas** — la
sombra la pinta el juego. Tras generarla: `py assets/recortar_hojas.py`.

### `camion_hoja.png`
> Genera una imagen: hoja de sprites en cuadrícula de 5 columnas por 2
> filas sobre fondo lila liso uniforme, estilo cartoon de videojuego con
> contorno grueso y colores planos, todos los objetos VISTOS DESDE ARRIBA
> (vista cenital pura). Fila superior: un camión de recogida de basuras
> con la cabina blanca hacia arriba y la caja trasera gris oscuro NEUTRA
> sin colores, y cuatro turismos distintos (rojo, blanco, azul, verde
> oliva) mirando hacia abajo con el parabrisas delantero en su parte baja.
> Fila inferior: cinco contenedores de basura de calle con ruedas, con la
> tapa cerrada y lisa vista desde arriba, en este orden: gris, amarillo,
> marrón, azul, verde. Sin textos, sin sombras arrojadas, cada objeto
> centrado en su casilla, *(+ coletilla)*

---

# LOS CONTENEDORES DE LA LÍNEA (`contenedores_hoja.png`)

Los cuatro contenedores de calle del minijuego, ilustrados para que casen con
los residuos y la nave. El `optimizar.bat` parte la hoja en 4 sprites
(`cont_envases/organica/papel/vidrio.png`) y les quita el fondo. La cinta y
la mano del operario se quedan en código a propósito: la cinta ES la
animación y la mano cambia de postura con lo que llevas. La placa con el
nombre y el ✓/✗ los pinta el juego encima, así que **sin textos** en la
imagen.

El orden es sagrado: **amarillo (envases), marrón (orgánica), azul (papel),
verde (vidrio)**. Hoja apaisada 4:1 para que cada casilla salga cuadrada.

### `contenedores_hoja.png`
> Genera una imagen apaisada de proporción 4:1: cuatro contenedores de basura
> urbanos de calle en fila, del mismo tamaño, cada uno centrado en su cuarto
> de imagen sobre fondo liso de un solo color lila claro, sin líneas de
> separación dibujadas y sin ningún texto ni rótulo, vistos de frente: uno
> amarillo de envases, uno marrón de materia orgánica, uno azul de papel y
> cartón, y uno verde de vidrio, todos con tapa abombada y ruedas,
> *(+ coletilla)*

La hoja del autor (`contenedores_hoja2.png`, agosto 2026) vino con paisaje de
fondo y se partió con `recortar_hojas.py` (ver arriba): los cuatro salieron
limpios, con sus ruedas, y ya viven en `cont_*.png`.

---

# EL GUÍA (`guia.png` — o mejor, la hoja `guia_hoja.png`)

La cara que acompaña al bocadillo de los primeros pasos, flotando sobre el
mapa. Se ve RECORTADA EN CÍRCULO y pequeña (58 píxeles), así que manda el
rostro: primer plano, expresivo, y nada de detalle fino que se pierda.

## La HOJA de tres caras (`guia_hoja.png`) — la buena

El guía tiene tres estados de ánimo en el juego: explicando, celebrando un
paso conseguido, y preocupado cuando algo se rompe. **Las tres caras van en
UNA SOLA imagen, en fila** — pedirlas en tiradas separadas saca tres señores
parecidos pero distintos; de la misma tirada, la identidad se conserva.

### `guia_hoja.png`
> Genera una imagen: el mismo personaje tres veces en fila, un operario
> veterano de aguas con casco de obra y chaleco reflectante, retrato en primer
> plano de hombros hacia arriba, los tres retratos del mismo tamaño y a la
> misma altura sobre fondo liso de un solo color: a la izquierda con cara
> amable y serena, en el centro celebrando sonriente con el puño en alto, a la
> derecha preocupado rascándose el casco, *(+ coletilla)*

Suéltala en esta carpeta y el `optimizar.bat` la PARTE solo en las tres caras
(`guia.jpg`, `guia_bien.jpg`, `guia_mal.jpg`): el guía explicará con la
primera, celebrará cada paso con la segunda y pondrá cara de apuro con las
averías. El personaje es tuyo — una ingeniera joven, un fontanero con bigote —
solo respeta el primer plano, la fila de tres y el fondo liso.

## Una sola cara (`guia.png`) — para salir del paso

### `guia.png`
> Genera una imagen: retrato en primer plano de un operario veterano de aguas,
> sonriente y de cara amable, con casco de obra y chaleco reflectante, mirando
> al frente, fondo liso de un solo color, encuadre de hombros hacia arriba
> centrado, *(+ coletilla)*

---

# EL ICONO (`icono.png`)

El del navegador, la pestaña y la pantalla de inicio del móvil. **Se queda en
PNG tal cual** (el optimizador lo ignora a propósito: un icono no se convierte
a JPEG). Cuadrado, 512×512 o 1024×1024.

### `icono.png`
> Genera una imagen: icono de aplicación cuadrado, una gota de agua grande y
> estilizada con una pequeña válvula de compuerta integrada en su interior,
> estilo plano vectorial con dos o tres colores sobre fondo azul petróleo
> oscuro liso, sin texto, sin marco, centrado y con margen alrededor

Ojo: **sin texto ninguno** — a tamaño de icono cualquier letra se vuelve ruido.

---

# MÚSICA DE FONDO (`musica.ogg`, `musica.mp3` o `musica.wav`)

El juego la busca con esos nombres, en ese orden, y **si no la encuentra no
pasa nada** (el botón «Música» ni aparece). Suéltala aquí y recarga: suena en
bucle sin cortes, con su propio botón y su volumen en `CONFIG.sonido`.

Lo que hay que pedirle al generador:

> Genera una pieza instrumental de música de videojuego retro estilo chiptune
> de 8 bits, alegre y tranquila a la vez, con una melodía simple y pegadiza,
> tempo medio, sin voces y sin percusión estridente, pensada para sonar de
> fondo en bucle en un juego de gestión relajado sobre agua y pueblos.

Y los tres trucos que evitan los tropiezos típicos:

- **EL BUCLE ES LO PRIMERO.** Pídelo con estas palabras: *"que termine
  exactamente igual que empieza, para poder repetirla en bucle sin que se note
  el corte"*. Si aun así se nota el salto, recorta el final con cualquier
  editor (Audacity es gratis) hasta que el empalme caiga a tiempo con el
  compás: es un minuto de trabajo y transforma el resultado.
- **DOS O TRES MINUTOS, no treinta segundos.** Un bucle corto se hace bola
  enseguida; uno largo desaparece de la atención, que es su trabajo. Si el
  generador se queda corto, pídele una estructura A-B-A: melodía, variación,
  vuelta.
- **QUE SEA HUMILDE.** Va por debajo de los efectos (el clic de la bomba, la
  lluvia) y muy baja. Las piezas épicas u orquestales cansan en diez minutos de
  juego incremental; la de los juegos que recuerdas con cariño era modesta.

**Varias canciones**: `musica2`, `musica3`, `musica4`... hasta el primer
hueco. El juego las BARAJA — cada vuelta suena la lista entera en un orden
nuevo, sin repetir nunca dos veces seguidas la misma.

## El jingle de la portada (`intro.ogg`, `intro.mp3` o `intro.wav`)

Lo primero que se oye al pulsar Empezar; al terminar entra la música. Sin
archivo suena una fanfarria corta hecha por código, así que **es opcional**,
pero un jingle tuyo remata la entrada. Al contrario que la música, aquí NO
hace falta bucle — necesita FINAL, y claro:

> Genera una fanfarria corta de videojuego retro estilo chiptune de 8 bits, de
> unos seis segundos, luminosa y con aire de comienzo de aventura, que
> termine resuelta con una nota final clara, sin voces, en la misma paleta
> sonora que una música chiptune alegre y tranquila.

---

# YACIMIENTOS Y ZONA PROTEGIDA — la tanda nueva

Mismas reglas y misma coletilla de siempre. El optimizador ya coge los `a_*` y
el `h_*` igual que el resto.

## Los cinco yacimientos (`a_<tipo>.png`)

Presiden la ficha cuando afloran al picar. Son EXCAVACIONES en marcha: la cata
abierta, no el objeto en un museo.

### `a_poblado.png`
> Genera una imagen: una excavación arqueológica de un poblado antiguo, muros
> bajos de piedra formando calles y habitaciones vistos en una cata abierta en
> la tierra, con cuadrícula de cuerdas, herramientas de arqueólogo y fragmentos
> de cerámica sobre una mesa de campaña, *(+ coletilla)*

### `a_tesoro.png`
> Genera una imagen: una excavación arqueológica pequeña donde asoma un depósito
> de objetos antiguos, monedas y herramientas de bronce medio enterradas
> brillando en la tierra, con pinceles y una balanza de campaña al lado,
> *(+ coletilla)*

### `a_necropolis.png`
> Genera una imagen: una excavación arqueológica de una necrópolis antigua,
> varias tumbas de lajas de piedra abiertas en cuadrícula con cuerdas y
> banderitas de marcaje, arqueólogos trabajando con pincel arrodillados,
> *(+ coletilla)*

### `a_hominidos.png`
> Genera una imagen: una excavación paleontológica de restos de homínidos, un
> cráneo y huesos antiguos asomando con cuidado de la tierra en una cata con
> cuadrícula, arqueólogos con pincel y una carpa de campaña detrás,
> *(+ coletilla)*

### `a_dinosaurios.png`
> Genera una imagen: una excavación paleontológica con un esqueleto de
> dinosaurio asomando de la roca, costillas y cráneo a medio descubrir, un
> paleontólogo con martillo y cincel y una carpa de trabajo al fondo,
> *(+ coletilla)*

## La tarjeta de vuelta (`h_vuelta.png`)

Preside la tarjeta "Mientras no estabas", la que te recibe al volver tras horas
fuera con lo que ha pasado: dinero, población, agua servida. Tiene que dar
gusto volver — el pueblo funcionando solo, y la recaudación a la vista:

### `h_vuelta.png`
> Genera una imagen: un pueblo pequeño al amanecer con su depósito de agua en
> la colina y las casas con las luces encendiéndose, y en primer plano una mesa
> de oficina de aguas con monedas apiladas, billetes y un libro de cuentas
> abierto junto a un grifo del que cae agua limpia, *(+ coletilla)*

## El sondeo que da agua (`h_acuifero.png`)

Sale la primera vez que una perforación encuentra acuífero. Es un momento
alegre: el agua que no se veía, saliendo donde no hay río.

### `h_acuifero.png`
> Genera una imagen: un equipo de perforación de sondeos en un campo seco lejos
> de cualquier río, la torre de la máquina sobre el pozo recién abierto y un
> chorro de agua clara saliendo por la boca del entubado, con dos operarios
> celebrándolo y un pueblo pequeño al fondo entre lomas, *(+ coletilla)*

## La zona protegida (`h_proteccion.png`)

La tarjeta sale la primera vez que una obra tropieza con una zona de especial
conservación. Debe dar ganas de RODEARLA, no pena de tocarla:

### `h_proteccion.png`
> Genera una imagen: un humedal protegido rebosante de vida junto a un río,
> garzas y patos entre juncos, flores silvestres en la orilla y un cartel de
> madera de reserva natural con silueta de ave, con una tubería de obra que se
> desvía rodeando la zona a lo lejos, *(+ coletilla)*

---

# ESTILO D — TESELAS (vista cenital sobre cuadrícula)

El terreno es una **rejilla de celdas cuadradas vistas desde arriba**; cada
elemento ocupa su celda y las tuberías se trazan entre ellas. Suelta los PNG en
esta carpeta con el nombre exacto y el juego los usa solo (botón *Estilo → D*).
Lo que falte se sigue dibujando por código, así puedes ir de una en una.

**Las tuberías NO son arte**: se dibujan por código para que la animación del
agua siga el caudal real. No hace falta generarlas.

## CÓMO PEDIRLAS (esto importa tanto como el texto)

Los chats de imagen (Gemini y compañía) responden con TEXTO si les mandas un
documento explicando lo que quieres. Para que dibujen:

- **Empieza por el verbo**: "Genera una imagen cuadrada: …".
- **Una sola frase seguida.** Nada de títulos, listas, ni nombres de archivo
  (`t_hierba.png` no le dice nada al generador; el nombre es solo para guardar).
- **Pocas negaciones.** "sin texto ni marca de agua" y para de contar; los "no
  isométrica, no de lado…" se sustituyen por decir en positivo *"vista desde
  arriba en perpendicular"*.
- Si contesta con texto, insiste: **"Genérala como imagen"**.

## Reglas para que todas peguen

- **Vista CENITAL**: desde arriba, en perpendicular.
- **Imagen CUADRADA** (512×512 vale de sobra).
- **Luz suave y difusa**, igual en todas.
- **Sin texto ni marcas de agua.** (El paisaje anterior traía una abajo a la
  derecha; conviene pedirlo explícito.)
- **Terreno: fondo opaco. Edificios: fondo TRANSPARENTE.** Gemini sí da
  transparencia real si se la pides clara ("fondo transparente… solo el
  edificio, sin hierba ni añadidos"). Con el edificio recortado, el juego lo
  escala y lo apoya sobre la hierba con su sombra, sin parches cuadrados.
  Si alguna vez te lo devuelve con fondo pintado, avísame y lo recorto yo.

## Coletilla de estilo (pégala al final de CADA prompt)

> **, vista desde arriba en perpendicular, estilo render 3D cartoon de videojuego
> móvil, colores saturados y limpios, luz suave y difusa, sin texto ni marca de
> agua, imagen cuadrada**

---

## 1. Teselas de terreno (fondo OPACO y **repetible**)

Estas se repiten por todo el tablero, así que pide **textura continua
(seamless/tileable)**. Si no salen perfectas no pasa nada: la rejilla del juego
dibuja el borde de cada celda y las costuras se leen como líneas de cuadrícula.

### `t_hierba.png`
> Genera una imagen cuadrada: textura de césped verde corto vista desde arriba
> en perpendicular, uniforme y sin objetos, perfectamente repetible en mosaico
> (seamless tileable) *[+ coletilla]*

### `t_hierba_matojos.png`
> Genera una imagen cuadrada: textura de césped verde vista desde arriba con
> unos pocos arbustos y piedras pequeñas repartidos, repetible en mosaico
> (seamless tileable) *[+ coletilla]*

### `t_agua.png`
> Genera una imagen cuadrada: textura de agua de río vista desde arriba, azul
> turquesa con ondas suaves y reflejos, repetible en mosaico (seamless tileable)
> *[+ coletilla]*

### `t_orilla.png`
> Genera una imagen cuadrada: la orilla de un río vista desde arriba, con césped
> verde en la mitad izquierda, una franja de arena y guijarros en el centro y
> agua en la mitad derecha, con el borde recto en vertical *[+ coletilla]*

### `t_tierra.png` (opcional, para futuras ampliaciones)
> Genera una imagen cuadrada: textura de tierra compactada y grava vista desde
> arriba, repetible en mosaico (seamless tileable) *[+ coletilla]*

---

## 2. Teselas de instalaciones (SOLO el edificio, fondo transparente)

**La fórmula que funcionó** (probada con `t_bomba.png`): describe el edificio y
cierra con *"fondo transparente, solo el edificio, sin hierba ni añadidos"*. El
juego se encarga del resto: lo recorta por su silueta, lo escala a la celda, lo
apoya en la hierba y le pone la sombra.

**Dos cosas que ya sabemos:**

1. **La perspectiva en 3/4 está BIEN**, aunque le pidas planta pura. Es la
   convención del género y es lo que hace reconocible cada edificio. Se probó la
   planta cenital pura y solo se veía el tejado: mucho peor. No pelees con eso.
2. **No hace falta que llene el cuadro.** Da igual el margen transparente que
   deje: el juego lo recorta por su caja opaca.

### `t_captacion.png`
> Genera una imagen cuadrada: una estación de captación de agua vista desde
> arriba, con plataforma de hormigón, reja de toma y tuberías, construida en la
> orilla de un río; fondo transparente, solo la instalación, sin césped ni agua alrededor *[+ coletilla]*

### `t_bomba.png`
> Genera una imagen cuadrada: una caseta de bombeo de agua vista desde arriba,
> edificio pequeño rectangular con tejado a dos aguas y tuberías azules
> entrando y saliendo, fondo transparente, solo el edificio, sin hierba ni añadidos *[+ coletilla]*

### `t_deposito.png`
> Genera una imagen cuadrada: un depósito de agua circular visto desde arriba,
> gran tanque cilíndrico metálico con pasarela y escalera exterior, fondo transparente, solo el edificio, sin hierba ni añadidos *[+ coletilla]*

### `t_depuradora.png`
> Genera una imagen cuadrada: una estación depuradora de aguas residuales vista
> desde arriba, con dos tanques clarificadores circulares con brazos radiales,
> pasarelas metálicas y una caseta, fondo transparente, solo el edificio, sin hierba ni añadidos *[+ coletilla]*

### `t_tanque.png`
> Genera una imagen cuadrada: un tanque de tormentas enterrado visto desde
> arriba, gran tapa circular de hormigón con rejillas de ventilación y un
> aliviadero, fondo transparente, solo el edificio, sin hierba ni añadidos
> *[+ coletilla]*

---

## 3. Teselas de población (solo edificios, fondo transparente; ocupan 2×2 celdas)

Cuadradas también; el juego las estira a su bloque de 2×2.

### `t_pueblo_aldea.png`
> Genera una imagen cuadrada: una aldea vista desde arriba, con cuatro o cinco
> casitas de tejado rojo alrededor de un camino de tierra y algún árbol, fondo transparente, solo los edificios, sin césped alrededor *[+ coletilla]*

### `t_pueblo_villa.png`
> Genera una imagen cuadrada: un pueblo visto desde arriba, con una docena de
> casas de tejado rojo, calles empedradas, una plaza con fuente y una iglesia,
> fondo transparente, solo los edificios, sin césped alrededor *[+ coletilla]*

### `t_pueblo_ciudad.png`
> Genera una imagen cuadrada: una ciudad vista desde arriba, con manzanas de
> edificios de varias plantas, calles en cuadrícula, una plaza central y zonas
> verdes, fondo transparente, solo los edificios, sin césped alrededor *[+ coletilla]*

---

## Consejo

Ya están hechas `t_hierba.png` y `t_bomba.png`. Las siguientes que más cambian
el tablero son **`t_agua.png` y `t_orilla.png`**: con ellas el terreno queda
entero con arte. Después, las instalaciones y los tres tamaños de pueblo.

Si el encuadre o la escala no cuadran con alguna, dímelo y ajusto proporciones
en `escena_teselas.js`.

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
