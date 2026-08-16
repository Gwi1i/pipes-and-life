# CLAUDE.md

Guía para trabajar en este repositorio.

## Regla de trabajo

**No modifiques ningún archivo sin decirme antes cuál y por qué.** Propón el
cambio, indica qué archivo tocas y qué problema resuelve, y espera respuesta.
Esto vale también para los archivos nuevos.

## Qué es el proyecto

**El juego se llama PIPES AND LIFE** (decisión del autor: el logo va rotulado
en el cartel de la portada y en el vídeo). "Red Hidráulica" queda como nombre
interno del repositorio y de las claves de guardado — las claves de
localStorage NUNCA se renombran por marca: borraría las partidas.

Red Hidráulica es un juego de abastecimiento de agua. Hay **dos versiones** en
ramas distintas:

- **`master`** — la versión de **estrategia**: sobre un terreno generado por
  procedimiento, el jugador coloca captaciones, depósitos y bombeos, tiende
  tuberías y lleva agua con presión suficiente a cuatro núcleos, con un solver
  hidráulico, terreno con hidrología, economía, estiaje, crecimiento y averías.
- **`clicker`** (esta rama) — la versión **incremental/clicker**: se bombea a
  golpe de clic, se acumula en un depósito y se abastece a una población. Arrancó
  sustituyendo el mapa por una escena decorativa, pero ha vuelto a tener mapa: uno
  **de exploración**, de teselas tapadas que se destapan clicando, con pueblos y
  ruinas que encontrar y las redes trazadas a mano sobre él. Las escenas
  decorativas siguen ahí como estilos alternativos.

Técnicamente, ambas comparten:

- **JavaScript con módulos ES** (`import` / `export`)
- **Sin dependencias externas.** No hay `package.json`, ni `node_modules`, ni
  paso de compilación
- **Sin framework.** DOM y Canvas 2D a pelo

No añadas dependencias, empaquetadores ni frameworks sin plantearlo antes.

## Cómo se ejecuta

**Doble clic en `jugar.bat`.** Busca Python, levanta el servidor y abre el
navegador solo. Se cierra cerrando esa ventana.

Por consola, si prefieres:

```bash
py servidor.py
```

**No funciona abriendo `index.html` con doble clic**, y no es algo que se pueda
arreglar: el proyecto usa módulos ES y los navegadores los bloquean sobre el
protocolo `file://` por seguridad. Hace falta que algo lo sirva por http. De ahí
el lanzador; las alternativas serían meter un empaquetador o volver a scripts
clásicos sin `import`/`export`, y las dos rompen lo que hay.

`servidor.py` no es `http.server` a secas: manda `Cache-Control: no-store` y
busca puerto libre desde el 8000. Lo primero importa más de lo que parece —el
navegador cachea los módulos ES con muchas ganas, y sin esa cabecera editabas un
`.js`, recargabas y seguías viendo el viejo—. Con el servidor del proyecto no
hace falta `Ctrl`+`F5`: se edita, se recarga normal y ya está.

Sigue sin haber proceso de build.

## Arquitectura (rama clicker)

```
red-hidraulica/
├── jugar.bat           Doble clic para jugar: levanta el servidor y abre el navegador
├── servidor.py         Servidor local sin caché (los módulos ES no van por file://)
├── Explicaciones.txt   Cajón de ideas del autor, con notas mías marcadas "// Claude:"
├── index.html          Estructura de la página: escena y paneles
├── css/estilos.css     Aspecto
└── src/
    ├── config.js       TODOS los parámetros ajustables
    ├── util.js         Funciones puras: formato, interpolación, color
    ├── estado.js       Dinero, agua, tiempo y persistencia
    ├── simulacion.js   El motor: balance de agua, consumo y facturación
    ├── mapa.js         El territorio: generación, niebla, red y diámetros
    ├── escena_mapa.js  Estilo M (el principal): el mapa de exploración
    ├── escena.js       El diorama animado (canvas), estilo A: "falso 3D"
    ├── escena_svg.js   Estilo B: sprites SVG dibujados a mano (hereda de escena)
    ├── escena_assets.js Estilo C: imágenes PNG de assets/ (hereda de escena)
    ├── escena_teselas.js Estilo D: vista cenital sobre cuadrícula (hereda)
    ├── sonido.js       Efectos sintetizados con Web Audio (sin archivos de audio)
    ├── tutorial.js     La guía de los primeros pasos (solo lee estado)
    ├── diagramas.js    Los esquemas animados de cada instalación (módulo puro)
    ├── entrada.js      Ratón, tacto, teclado → acciones
    ├── ui.js           DOM fuera de la escena: HUD, tienda, paneles
    ├── analitica.js    Contador anónimo de visitas y vueltas (solo reacciona)
    └── main.js         Ensamblado y bucle principal
```

**Cada módulo tiene una responsabilidad única y no invade las demás.** Los
límites que hay que respetar:

- **`escena.js` solo lee estado, nunca lo modifica.** Dibuja el pueblo ACTIVO y
  el cauce común, con estilo cartoon y "falso 3D" (Canvas 2D a mano: sin sprites
  ni dependencias). Lo único que guarda es su reloj de animación y los efectos
  pasajeros (clima, destellos, aparición de estructuras). El contexto del
  fotograma se cachea en `this._W/_H/_p/_res/luz/est/suciedad/bruma` para no
  pasarlo a cada método. `estacion(horas)` da la paleta interpolada y el clima;
  las partículas de clima (lluvia/nieve/flores) se reciclan por tipo.
  El volumen ("falso 3D") sale de: luz direccional con caras iluminadas/en
  sombra (`oscurecer`/`aclarar` sobre el color base), cilindros (depósito,
  clarificadores), casas en vista 3/4 (`casa3d`: cara frontal + lateral +
  tejado a dos aguas), sombras arrojadas (`sombraSuelo`) y perspectiva
  atmosférica (mezcla hacia `this.bruma` según lejanía). Si hace falta más
  detalle sin perder fluidez, pre-renderiza a un canvas oculto (como hacía el
  terreno en `master`).
- **`escena_mapa.js` (`EscenaMapa`) es LA vista del juego.** Hubo cuatro estilos
  mas para tantear por donde tirar (diorama en falso 3D, sprites SVG, PNG de IA y
  una vista cenital de la parcela); se borraron al quedar claro cual valia.
  `escena.js` se queda como CLASE BASE: de ahi salen los destellos, el clima, las
  estaciones y los helpers `mezclarColor`/`oscurecer`/`aclarar`. No se dibuja
  nunca por si sola.
  El mapa de exploracion: niebla, hallazgos, construcciones, las redes con su
  color y su grosor, las averias y la previsualizacion de lo que vas a hacer.
- **`entrada.js` no toca el estado.** Traduce eventos del navegador a acciones y
  las encola; `main.js` es quien las ejecuta. La lógica de juego queda en un
  solo sitio.
- **`config.js` no importa nada de nadie.** Es una hoja del árbol de
  dependencias: solo exporta datos.
- `simulacion.js` no sabe dibujar ni de interfaz.
- `ui.js` toca el DOM; `escena.js` toca el canvas. No se mezclan.

Flujo del bucle principal (`main.js`):

```
entrada → acciones → simulación → economía → escena + ui
```

## Regla de oro: los números van en config.js

**TODOS los números ajustables van en `config.js`. Nunca metas constantes
numéricas en la lógica.** Un coste, un umbral, una tasa, un color, una velocidad:
se crea en `config.js` con su nombre y su comentario, y se importa.

Excepción razonable: constantes matemáticas y de conversión que no son
ajustables (los 86400 s de un día, etc.). Esas no son parámetros de juego.

## El idioma: castellano fuente, inglés capa

El juego está traducido al inglés SIN mover el castellano de su sitio: los
textos siguen viviendo donde siempre (config.js, comentarios.js, index.html,
las plantillas de ui.js/main.js/mapa.js) y el inglés es una CAPA que
`src/idioma.js` mezcla encima al arrancar — la misma idea que el tinte de
las regiones. Se elige por `navigator.language`, con botón en la cabecera y
en la portada; la preferencia (`redHidraulica_idioma`) sobrevive a Reiniciar
y el contador lleva la etiqueta `/idioma/en`. La regla que hace esto
sostenible: **lo que falte en el diccionario sale en castellano** — un texto
sin traducir se enseña, nunca se esconde, así que añadir texto nuevo no
rompe nada; solo queda como deber.

El diccionario es `src/idiomas/en.js`, con tres capas: `config` (pisa claves
de CONFIG — solo las que EXISTEN, una errata no puede inventar parámetros),
`pagina` (selector CSS → innerHTML para el HTML estático) y `frases` (las de
la etiqueta `t`). Los textos que el código monta en vivo se escriben
`` t`Renovar a ${x} de ${y}.` `` : el castellano queda ahí como fuente y la
clave del diccionario es el ESQUELETO (partes fijas con `{0}`,`{1}`, en
inglés pueden ir en otro orden). Tres reglas aprendidas a golpes:

- **Ninguna variable local puede llamarse `t`** en un módulo que importe la
  etiqueta: la tapa en silencio, y hubo una que además daba ReferenceError
  por TDZ. Hay comentarios de aviso donde se renombraron.
- **`py assets/extraer_frases.py`** compara los esqueletos del código con el
  diccionario (jugando, `juego.sinTraducir` en consola dice lo mismo). Tras
  tocar cualquier texto etiquetado, correrlo. Y en los comentarios de los
  .js, nada de acentos graves alrededor de una t suelta: el extractor se los
  toma por código.
- **Lo que es clave de archivo no se traduce.** El `nombre` de los escalones
  del caserío nombra las imágenes (`f_aldea.jpg`): la pantalla usa su
  `titulo`, que sí se traduce. El género (`art`) viaja como valor y la frase
  inglesa lo ignora.

La VOZ de Manuel va en los dos idiomas: `generar_voces.py` genera los dos
juegos de archivos (es-ES-Alvaro / en-GB-Ryan) leyendo el castellano del
código y el inglés del diccionario; conviven en assets/voz/ porque el nombre
lleva la huella del texto, y las huellas PLIEGAN los espacios antes de la
cuenta (misma regla en sonido.js y en Python — así una plantilla multilínea
y su texto en una línea son la misma frase). Los textos de Manuel en
comentarios.js llevan `t` pero SIN interpolación: el generador los lee con
una expresión sencilla. `--listar` enseña las líneas sin internet.

## Modelo multi-pueblo (mancomunidad)

Una MANCOMUNIDAD gestiona varios pueblos, y desde el mapa grande los pueblos
son DINÁMICOS: se arranca solo con el de origen y el resto viven repartidos por
el mapa en ANILLOS de distancia (`CONFIG.nucleos`), 36 en total, con nombre y
tamaño sembrados por la semilla. Se incorporan alcanzándolos con una tubería y
pagando el CANON (`canonIncorporacion()`, geométrico con el tamaño de la
mancomunidad: esa es la palanca que hace la dificultad exponencial — la tubería
crece lineal con la distancia, el canon crece geométrico con cada núcleo).

Las FASES (`CONFIG.fases.umbrales`: 5, 10, 15, 21, 28 pueblos) abren los
anillos: el anillo N solo se puede incorporar en fase >= N. Medido con el bot:
fase 2 a la hora, fase 3 a las dos horas y media, y de ahí en adelante el juego
tiende a infinito, que es la intención. La red de cada tipo arranca de TODOS los
pueblos incorporados (BFS multi-fuente en `alcanzadasPorLaRed`): una línea
tendida desde el décimo pueblo vale igual que una del primero. Clicar cualquier
pueblo incorporado lo hace activo Y bombea.

`CONFIG.aceleradores` es el gancho para una futura monetización (anuncios/pagos
que aceleren). Como el auto-bombeo: NO hay pago ni anuncio implementado y no se
debe simular ninguno falso.

**Dos obstáculos de trazado, y son distintos a propósito.** Los YACIMIENTOS
(`CONFIG.arqueologia`) están escondidos y afloran al picar: cada uno ES algo
concreto (`tipos`, con peso de rareza y renta propia — de poblado antiguo a
fósiles de dinosaurio, el más raro y el que más renta) y se puede excavar y
poner en valor. Las ZONAS DE ESPECIAL CONSERVACIÓN (`CONFIG.proteccion`) se ven
desde el principio, son manchas orgánicas de fauna o flora, y NO tienen premio:
no se construye ni se traza dentro nunca, y `puedeColocar`/`puedeSeguirTrazado`
dan la pega de protección ANTES que ninguna otra. Si los lixiviados de un
vertedero las alcanzan (`celda.insalubre > 0.05`), el Estado multa por hora y
casilla mientras dure el daño — la multa se anuncia al ARRANCAR, no cada paso.
El hito `proteccion` sale al primer tropiezo. Es la restricción real del oficio:
los trazados dan rodeos enormes para no tocar espacios protegidos.

El logro `todosServidos` pide **seis** pueblos bien atendidos a la vez: con dos
saltaba nada más empezar en el mundo de 36 núcleos.

**El agua que no se ve.** Más de la mitad de los núcleos están lejos de un río
—25 de 37, medido— y a esos hay que llegar con kilómetros de tubería. El
subsuelo es la otra respuesta, en TRES pasos que no se saltan (`CONFIG.acuiferos`):

1. **Estudio hidrogeológico** (`estudiarZona`): barato, cubre 5×5, y NO encuentra
   agua — revela qué casillas tienen `indicios`.
2. **Sondeo** (`sondear`): caro, una casilla, y puede salir **seco**. Ahí es donde
   se pierde el dinero, y es la lección entera.
3. **Pozo**: la pieza `acuifero` ya solo se puede poner sobre un sondeo positivo
   (`requiereSondeo`); antes pedía `terreno` + `lejosDeAgua` y no producía nada.

**Los indicios NO son el acuífero, y esa separación es la mecánica.** Se marcan
sobre las masas con agua Y sobre `señuelos` sin ella. Está medido: con
`haloIndicios: 1` acertabas el 19% de las veces —el estudio no se pagaba— y con
el halo a 0 más los señuelos sale **65% con indicios contra 1,2% a ciegas**. Si
el estudio acertara siempre, perforar dejaría de ser una decisión.

El resultado del sondeo **no es un dado**: depende de si hay agua ahí debajo,
sembrada con la semilla. La misma casilla da siempre lo mismo, así que no se
puede recargar la partida hasta acertar; lo que decides es *dónde* perforas.

**Dos clases, y son distintas a propósito** (`acuiferos.clases`): la de montaña
(karst, en relieve y pedregal) da menos y perforar cuesta más, pero le da igual
el año seco; la aluvial (en llano) da más y es más barata, y sí nota el estiaje.
Por eso `caudalCaptacion(pueblo, estado, estiaje)` aplica el estiaje **por
fuente** en vez de multiplicar al final: con una sola fuente daba lo mismo, con
dos ya no.

**El acuífero se agota, y la unidad es la MASA, no la casilla.** Cada mancha
sembrada lleva su número (`celda.masa`) y su nivel vive en `estado.acuiferos`
(0..1, se guarda). `tickAcuiferos()` hace el balance una vez por paso: entra la
recarga (que es lluvia, así que en verano casi nada) y sale lo que bombean los
pozos CONECTADOS de esa masa. Por debajo de `umbralMerma` el pozo da cada vez
menos, que es lo que pasa de verdad cuando hay que bombear desde más hondo.

Está calibrado para que **UN pozo se sostenga en la masa más pequeña y DOS no**,
y ojo con el número: la recarga se calibra contra la lluvia MEDIA del año (0,64
del máximo), no contra el máximo. Calibrarlo contra el máximo fue un fallo real —
un solo pozo dejaba el acuífero al 39% y parecía que la mecánica estaba rota—.
`caudalSostenible()` es la función que dice la verdad y la que se enseña.

Lo bonito sale solo de las cuentas: en equilibrio la extracción iguala a la
recarga, así que **dos pozos acaban dando lo mismo que uno** (medido: 0,88 L/s
contra 0,85). Has pagado un pozo de más para tener el nivel por los suelos. No se
prohíbe: se avisa una vez al cruzar `avisoNivel` y el panel lo cuenta.

El panel compara lo que los pozos **PIDEN** (a acuífero lleno) con lo sostenible,
nunca lo que están sacando ya mermado: con eso, un acuífero hundido se anunciaba
como "extracción sostenible", que es justo lo que no hay que creerse. Y va en la
ficha de OBRA además de en la de casilla, porque al construir el pozo la de
casilla deja de salir — justo cuando el nivel importa.

**LA VERSIÓN DEL MUNDO (`mapaMundo.mundo`) es la guardia de la siembra.** El
terreno se REGENERA de la semilla en cada carga, así que cambiar cualquier
`sembrar*` movería el mundo bajo las tuberías de las partidas vivas (la
misma guardia que el río). El número viaja en el guardado: una partida vieja
(sin campo = 1) regenera SU siembra exacta — por eso existe
`arqueologia.cantidadV1` y por eso `crecerZona`/`elegirYacimiento` se
extrajeron SIN cambiar un sorteo. Si tocas la siembra: sube el número, deja
el camino viejo intacto, y añade lo nuevo AL FINAL de `generarMapa` (todo lo
anterior consume el azar en su orden de siempre).

**Y EL ARRANQUE SE SIEMBRA (`CONFIG.arranque`, mundo >= 2).** La primera
media hora se juega en un radio corto, y con siembra uniforme lo
interesante caía donde el jugador nuevo no llega (dixit el autor: "si en la
primera media hora se aburre, no habrá descubierto nada de lo que hemos
preparado"). Medido en el mundo 1: 1 yacimiento y CERO zonas protegidas en
el radio 12. `sembrarArranque()` cuenta lo que la siembra normal dejó ahí y
COMPLETA hasta los mínimos (ruinas, yacimientos, ZEC) — con una semilla
generosa no añade nada — y re-corre `garantizarAcceso()` por si una ZEC
nueva encajona un núcleo.

**`garantizarAcceso()` en `mapa.js` es una garantía, no un adorno**: recorre el
mapa desde el origen y, si una zona protegida ha dejado un núcleo incomunicado,
le abre el pasillo mínimo. Que llegar cueste una fortuna es dificultad; que no
haya manera de llegar es una partida rota que además no se ve venir.

Lo que es de cada pueblo y lo que es común está separado a propósito:

- **Por pueblo** (`estado.pueblos[i]`): agua, habitantes, servicio, racha,
  `mejoras{}` (bomba, depósito, captación, depuradora, mantenimiento),
  `servicios{}` (cuáles tiene en marcha), `autobombaActivo`, `desbloqueado`. Casi todas
  las funciones de `simulacion.js` reciben un `pueblo`.
- **Común** (`estado`): `dinero` (una sola caja), `horas` (un reloj),
  `contaminacion` (un solo cauce) y `averias` (lo que está roto sobre el mapa).

La UI muestra SIEMPRE el pueblo activo (`estado.activo`, índice en
`estado.puebloActivo`); las pestañas cambian cuál. La tienda, el panel de
detalle, las averías y el premium se refieren al activo. El cauce y la caja son
comunes. `ui.invalidarCache()` fuerza redibujar todo al cambiar de pueblo.

El CUARTO pueblo incorporado (`pluviales.abreConPueblos`) activa
`estado.pluvialesActivas`, que desbloquea
las mejoras marcadas con `requiere: 'pluviales'` (la UI las oculta hasta
entonces). Ya no existe `comprobarDesbloqueo()` ni la lista fija
`CONFIG.poblaciones`: incorporar pasa por `incorporarPueblo()` de
`simulacion.js`, que usan la acción `abastecerPueblo` y el bot de medida.

**Lluvia, pluviales y tanque de tormentas.** `factorLluvia(horas)` da la
intensidad por estación (misma fórmula de fase que usa la escena, para que lo
que ves llover sea lo que moja la ciudad). Con saneamiento activo, la
escorrentía urbana entra al colector; la **red de pluviales** separa una
fracción (que además se aprovecha en parte para el depósito) y el resto se suma
a las aguas residuales. La **depuradora** trata hasta `capacidadTratamiento()`
L/h; lo que excede lo retiene el **tanque de tormentas** (`pueblo.tanqueAgua`) y
se trata luego, cuando sobra capacidad. Lo que ni se trata ni se retiene es un
**alivio**: va crudo al cauce. Pluviales y tanque suben además
`calidadServicio()`, que multiplica el crecimiento.

## Notas de la simulación

`simulacion.js` hace un balance de agua muy simple, sin red ni presiones:

1. **Entra** agua con cada `bombear(pueblo)`, hasta el tope de `capacidad(pueblo)`.
2. `capacidad(pueblo)` vale poco sin depósito (hay que clicar sin parar) y mucho
   con él. Ese contraste es lo que hace que el primer depósito se note.
3. `avanzar(estado, dt)` recorre los pueblos desbloqueados: cada uno produce,
   consume, **factura solo lo servido** a la caja común, y vierte sus aguas
   residuales sin depurar al cauce común. Devuelve el resultado efímero del
   pueblo ACTIVO más los datos del cauce (contaminación, multa); NO lo guarda.

**Saneamiento y cauce.** Al superar `servicios.saneamiento.activaEnHabitantes`,
el pueblo abre ese servicio y genera aguas residuales (`fraccionResidual` del agua
servida). La depuradora (`fraccionTratada(pueblo, estado)`) trata un %; lo que llega
crudo sube `estado.contaminacion`. La contaminación cuesta una multa (a la caja)
y multiplica a la baja el crecimiento de TODOS los pueblos (`frenoCrec`). Baja
sola despacio (`recuperacionNatural`) y de golpe con el botón LIMPIAR CAUCE
(acción `limpiarCauce`). Los umbrales, tasas y multa están en `CONFIG.cauce`.

La demanda de la población se calcula SOLO en `demandaMedia()`. En la versión de
estrategia, duplicar esa fórmula ya provocó una vez que la demanda cambiara sola
a los dos segundos de partida. No la repitas en línea.

**Dos escalas de tiempo, a propósito.** `avanzar(estado, dt)` recibe el `dt`
REAL en segundos. Dentro distingue:
- *Flujos de mundo* (consumo, captación): en L/s de juego, escalados por las
  horas de juego (`dt · horasPorSegundo`). El estiaje del Hito 3 los modulará.
- *Flujos de acción* (clic manual, auto-bombeo): ritmo humano, en tiempo real,
  como el propio clicar.
Por eso el auto-bombeo se compara con el clic y la captación con la demanda, no
al revés. Si mezclas las escalas, los números se van por órdenes de magnitud.

**Solo hay UNA mecánica de mantenimiento: las averías.** Hubo un contador de
DESGASTE que bajaba solo y se subía con un botonazo ENGRASAR. Se quitó entero:
eran dos mantenimientos a la vez y el abstracto —un número oculto y un botón—
no significaba nada. Lo que se rompe tiene sitio en el mapa y se arregla yendo
allí. `eficiencia()` se queda devolviendo 1 como gancho por si algo vuelve a
mermar el rendimiento.

**El operario.** Vive en `main.js` (`tickOperario`), no en el estado: aparece
cada `CONFIG.visita` segundos, y `recogerOperario()` intercepta el clic de
bombear si cae encima. Da prima y deja el desgaste a cero. La escena solo lo
pinta (`escena.operario`).

**Construir sobre el mapa.** `CONFIG.construibles` dice dónde puede ir cada
pieza (`terreno`, `junto`, `lejosDeAgua`) y `puedeColocar()` lo comprueba
devolviendo SIEMPRE un motivo legible: si el jugador no entiende por qué no le
deja, la regla parece un fallo.

**Las tuberías se trazan A MANO**, casilla a casilla (`puedeSeguirTrazado`,
`costeTrazado`). Hubo una versión con A* que buscaba la ruta más barata sola y
se quitó a propósito: decidir el recorrido —y si compensa rodear un bosque o
pagar el desbroce— ES el juego. No la reintroduzcas como comportamiento por
defecto.

**Lo construido solo cuenta si está CONECTADO.** `construccionesConectadas()`
recorre la red desde la casilla del pueblo saltando por casillas con tubería, y
cuenta lo que está SOBRE la red o PEGADO a ella (acometida lateral). Exigir que
la tubería pasara justo por encima de la casilla fue un fallo real: llevabas la
conducción hasta la puerta del pueblo, se veía conectada, y el juego decía que
no. No lo endurezcas otra vez;
`avanzar()` cachea el recuento en `estado._conectado` una vez por paso y
`capacidad`/`caudalCaptacion`/`litrosPorClic` le suman `CONFIG.aportePorPieza`.
Una pieza suelta en mitad del campo no aporta nada: es lo que convierte el
trazado en una decisión y no en un adorno.

**Un pueblo es un conjunto de SERVICIOS, no una lista de mejoras.**
`CONFIG.servicios` es la espina dorsal: cada entrada agrupa sus `mejoras`, apunta
a su `red` y dice cuándo se abre (`siempre`, `activaEnHabitantes`, `requiere`).
El estado vive en `pueblo.servicios[clave] = { activo }`, y `servicioActivo()` es
la ÚNICA puerta para preguntarlo —antes era un booleano suelto
(`saneamientoActivo`) consultado desde diez sitios—. `abrirServicios()` los
enciende y devuelve los recién abiertos para poder anunciarlos.

**Servicio NO es lo mismo que red.** Son dos tablas a propósito: `explotacion`
(el personal) no tiene tubería, y los RESIDUOS que vienen tampoco —se recogen en
camión, con rutas—. Fundirlas ahora dejaría fuera la mitad de lo que falta. Las
`piezas` construibles NO se repiten en `servicios`: viven solo en
`CONFIG.redes[red].piezas`. La tienda se genera agrupada por servicio, y una
mejora que no figure en ninguno cae en un grupo "Otras" en vez de desaparecer sin
avisar, que sería un fallo mudo.

**Cada servicio tiene SU red.** `CONFIG.redes` define `abastecimiento` (trae agua
limpia), `saneamiento` (se lleva la sucia), `pluviales` (saca la lluvia del
colector) y `residuos` (**una CARRETERA**, no una tubería), cada una con su color
y su lista de `piezas`. Las tuberías llevan `red` y **no se mezclan**: un colector que pasa por
encima de una captación no la conecta a nada, y una depuradora no la engancha la
tubería de agua potable. Todo el recorrido de red (`alcanzadasPorLaRed`,
`construccionesConectadas`, `lineasConectadas`, `cuelloDeBotella`,
`inventarioConectado`) recibe la red como parámetro; `avanzar()` cachea las dos
(`estado._conectadoRed[red]` y `estado._redes[red]`, con atajos `_conectado`,
`_red`, `_conectadoSan`, `_redSan`). Añadir una cuarta red debería ser una
entrada más en `CONFIG.redes`: las pluviales se metieron así y no hizo falta
tocar la mecánica.

**Cada red tiene SU escala.** Las de tubería se miden en diámetros
(`CONFIG.tuberia.diametros`); la de residuos, en clases de vía
(`CONFIG.viales.clases`). Lo dice `CONFIG.redes[red].tiers` y lo resuelve
`escalaDeRed()`; `diametro()` y `nivelDiametro()` reciben SIEMPRE la red. Por eso
`estado.dnActual` es un objeto por red y no una cadena: elegir doble calzada no
debe cambiar con qué diámetro tiendes tuberías de agua. La mecánica es la misma
—manda el tramo peor, renovar a medias no sirve—, solo cambia cómo se llama y en
qué se mide. Al calibrar una escala nueva, mueve `caudalMax` y `habitantesMax`
JUNTOS: con caudales sueltos una pista de tierra daba para cinco mil habitantes y
la carretera no era un cuello de botella nunca.

**Cada pieza del mapa es ALGUIEN.** Lleva su nombre propio ("Depósito 2" —
`bautizarObra()` numera con el MAYOR usado, no contando vivas: con el derribo,
contar repetía nombres), su `nivel` y su ficha al seleccionarla: qué aporta con
números, su situación (AVERIADA / SIN CONECTAR, porque en esos estados no
aporta nada y callárselo parece un timo) y su botón AMPLIAR
(`CONFIG.ampliacion`, coste geométrico). La clave del encaje:
`inventarioConectado()` suma NIVELES, no unidades — una pieza a nivel 3 cuenta
como tres — y así todas las fórmulas de aporte recogen la ampliación sin
tocarlas. El reparto de papeles, que confundía de verdad: la TIENDA ("Mejoras
del pueblo") sube la instalación municipal del pueblo activo; cada pieza del
MAPA se amplía seleccionándola. El vertedero queda FUERA de la ampliación
genérica: su `nivel` es el vaso y tiene su propio botón. Las partidas viejas
bautizan sus obras al cargar.

**El CUPO de obra: la mancomunidad justifica lo que sirve.** Tope por tipo
de pieza = `base + porPueblo × pueblos` (`CONFIG.cupos`; un tipo sin entrada
no tiene tope), comprobado en `puedeColocar()` — que ahora recibe `nPueblos`
al final; sin él NO comprueba cupo, a propósito: la ficha de casilla lo
omite porque ahí se habla del terreno, no del expediente. Petición del
autor: sin tope se empapelaba el mapa de captaciones y se trampeaba el
juego. La válvula legítima es AMPLIAR (nivel 4 rinde por cuatro sin gastar
cupo). El bot pasa por el mismo cupo.

**LA LUZ: las piezas con motor pagan energía.** `CONFIG.energia.porHora`
(€/h por NIVEL conectado; depósito, tanque y vertedero a gravedad no
figuran) se descuenta en `avanzar()` y sale en `resultado.luzHora`. Lo
suelto o averiado no consume, igual que no aporta. La ficha de cada pieza
dice su consumo (`queAporta`, que ahora recibe `desc` de respaldo para que
la luz no borre la descripción de las piezas sin línea de aporte). La ficha
del bombeo siempre presumió de que la energía era la mayor partida del
coste de explotación: ahora es verdad.

**Equivocarse tiene salida, pero no gratis.** Toda obra lleva DERRIBAR al final
de su ficha (recupera `CONFIG.derribo.fraccionRecuperada` de lo invertido,
pieza y ampliaciones; la avería de la casilla se va con el escombro) y toda
línea se puede LEVANTAR (al `tuberia.valorRecuperado`), desde el panel de la
casilla o de la obra. La CASILLA COMPARTIDA no pregunta: si hay obra y tubería
en el mismo sitio, el panel enseña las dos con el bloque "Por aquí pasa..." —
mejor que un diálogo. Los dos pasan por `confirm()`, como Reiniciar.

**El vertedero se llena, y gotea.** Cada uno lleva su `nivel` y sus toneladas
(`lleno`) EN LA PROPIA CONSTRUCCIÓN, no en el pueblo: son de la mancomunidad y
hay varios. Lleno deja de tragar y la basura se queda en la calle; se amplía
seleccionándolo en el mapa (`panel-obra`) o se abre otro. Y suelta lixiviados
sobre las masas de agua a `radioContaminacion`: sube `celda.insalubre` (0..1, se
guarda en la partida) y eso RECORTA `caudalCaptacion()` — envenenar tu propia
toma es el castigo por ponerlo mal. `lixiviar()` recorre TODOS los vertederos con
carga, **no solo los conectados**: si dependiera de la conexión, levantar el
último tramo de carretera pararía la fuga por arte de magia.

**Colocarlo mal se AVISA, no se prohíbe.** El vertedero tenía `lejosDeAgua: 3` y
el lixiviado alcanza 3: un vertedero legal no podía envenenar nada nunca, o sea
que la mecánica nacía muerta. Ahora lleva `avisaSiAguaCerca` y `puedeColocar()`
devuelve `{ok:true, aviso}`: la previsualización lo pinta en ámbar y tú decides.
Un juego que no te deja equivocarte no tiene nada que decidir.

**Residuos: el primer servicio que INGRESA.** La basura
(`residuos.kgPorHabitanteDia`) sale del pueblo por carretera. Sin vía tendida no
sale nada —como en pluviales, aquí no hay red vieja de la que tirar—; lo que no
se recoge se pudre (`pueblo.basuraCalle`, 0..1) y frena el crecimiento igual que
el cauce sucio. Enterrar en el vertedero solo cuesta; la planta de reciclaje abre
una fracción por nivel (`residuos.fracciones`) y cada una se VENDE. Los precios
por tonelada son los reales y así se quedan —lo que importa es que el aceite
valga mucho más que la orgánica—, pero la economía del juego va inflada (el agua
a 14 €/m³), así que `escalaEconomica` sube el conjunto sin tocar las proporciones.
Sin él, reciclar daba 7 €/h contra 115 del agua y no compensaba ni mirarlo.

**Las pluviales, al revés que el colector.** Sin red de saneamiento se supone la
red unitaria vieja (el diámetro más estrecho): el pueblo siempre ha evacuado por
algún sitio. Pero `capacidadPluviales()` devuelve **cero** si no has tendido la
red: separar la lluvia no lo hace nadie por ti, y esa asimetría es justo lo que
describe `Explicaciones.txt`. Lo que separa es lo que le quepa por el tubo, así
que aquí el diámetro no es un detalle, es la mecánica entera.

**El colector no estrangula: REBOSA.** En abastecimiento, quedarse corto de
diámetro significa que llega menos agua; en saneamiento significa que el agua
sucia **se sale antes de llegar a la depuradora** y va cruda al río
(`capacidadColector()`, `holguraColector`). Y ojo con el orden del tapón, que se
comprobó jugando: al ensanchar el colector el problema se MUDA a la depuradora, y
si la UI no lo dice, el jugador renueva la línea, ve el río igual de sucio y cree
que no ha servido de nada. Por eso `avisosRed()` distingue los tres casos (no hay
depuradora / rebosa el colector / no da abasto la depuradora).
Las depuradoras del mapa suman **caudal Y calidad**
(`aportePorPieza.depuradora` y `depuradoraCalidad`): con solo el caudal, el agua
pasaba por dentro de la planta y salía igual de sucia.

**Diámetros: manda el tramo MÁS ESTRECHO.** Cada línea de tubería lleva su `dn`
(`CONFIG.tuberia.diametros`: fibrocemento → polietileno → fundición dúctil, con
`caudalMax`, `habitantesMax`, `fugas` y `costeRelativo`). `cuelloDeBotella()` mira
solo las líneas ENGANCHADAS al pueblo (`lineasConectadas()`) y devuelve la peor:
eso tapa `caudalCaptacion()`, resta `fugas` a todo lo que entra y pone techo al
crecimiento en `crecer()`. Renovar medio recorrido no sirve de nada —es la
gracia—, y el tope FRENA pero no encoge: una partida vieja por encima del techo
no se despuebla de golpe. Sin ninguna línea conectada se supone la red heredada
(el diámetro más estrecho): el pueblo siempre ha bebido de algo. Hoy la red es
COMÚN porque solo hay una conducción, la del pueblo de origen; cuando cada pueblo
tenga la suya, `estado._red` pasará a calcularse por pueblo.

**NUEVE terrenos en tres familias.** `CONFIG.terrenos` ya no son tres tipos a
secas: llano (prado/pastizal/pedregal), arbolado (matorral/pinar/bosque cerrado)
y relieve (colina/sierra/roca viva), cada uno con su `costeExtra` al destapar y
su entrada en `tuberia.costePorCasilla` al atravesar. Los saltos de precio son
grandes A PROPOSITO: con diferencias pequenas rodear no compensaria nunca y
trazar volveria a ser ir en linea recta.

No es solo precio. `construibles[x].terreno` decide donde cabe cada pieza, y ahi
el terreno deja de ser decorado: al deposito le vale una COLINA (barata de
encontrar) aunque tambien acepte sierra y roca — exigirle sierra dejaba a media
partida sin sitio para el primer deposito.

El dibujo va por `familia`, no por tipo, y dentro de cada familia cambia lo que
se ve ENCIMA: el pastizal echa matas altas, el pedregal esta sembrado de piedras,
el matorral son arbustos sin tronco y el bosque cerrado una masa apretada. La
densidad ES la informacion: si lo ves tupido, ya sabes que cruzarlo cuesta.

Y `suavizarArranque()` rebaja cada familia a su variante barata cerca del pueblo
(`radioAmable`). Empezar rodeado de roca viva por capricho de la semilla no es
dificultad, es mala suerte.

**El lateral va por SOLAPAS.** Los paneles contextuales (guía, averías,
instalación, casilla, hallazgo, almacén) siguen arriba porque salen solos cuando
tocan; el resto se reparte en tres hojas —Mapa, Pueblo, Mancomunidad—. Eran doce
bloques apilados y había que bajar media pantalla para llegar al registro.

**Clicar terreno pelado abre su FICHA** (`refrescarCasilla`): qué terreno es, qué
cuesta cruzarlo con cada red y qué piezas admite. Con nueve terrenos y precios de
12 a 190 €, mirar antes de decidir tiene que ser gratis. La miniatura NO es un
icono aparte: se pinta prestándole el contexto a `escena.dibujarTerreno()`, así
no hay dos verdades sobre qué aspecto tiene un pedregal.

**Los DIAGRAMAS (`diagramas.js`) no son el dibujo del mapa.** En el mapa la pieza
se ve DESDE ARRIBA y lo que importa es reconocerla; en la ficha se ve EN SECCIÓN
y lo que importa es entender por dónde va el agua. Una vista cenital de un
depósito no explica que el agua baja por gravedad, y ese es justo el dato. Son
esquemas de manual —pocas formas, mucho contraste, UNA sola cosa moviéndose— y lo
que se mueve es siempre lo que la pieza le hace al agua. Van a 60 fps aunque el
HUD se refresque a 10: una animación a tirones no llama la atención, que es
precisamente su trabajo.

**Los HITOS paran el juego, y por eso son pocos.** `CONFIG.hitos` tiene una
tarjeta por momento en que CAMBIA EL PROBLEMA: se abre el saneamiento, las
pluviales, los residuos, entra el segundo pueblo. Cuenta tres cosas y en este
orden: qué ha pasado, qué hay que conseguir ahora y POR QUÉ importa. Ese tercero
es el que justifica tapar la pantalla — es lo que el jugador se está preguntando
justo en ese momento.

Se enseña UNA vez (`estado.hitosVistos`, se guarda). Si se repitiera dejaría de
ser un momento y pasaría a ser un estorbo, y con tres o cuatro en toda la partida
puede permitirse interrumpir; un panel lateral más se lo saltaría todo el mundo.
La imagen es `assets/h_<id>.jpg` y si falta la tarjeta sale igual con su texto.

**Cada pieza tiene su FICHA DIVULGATIVA** (`construibles[x].ficha`): qué es de
verdad, para qué sirve y un dato del oficio. El autor trabaja en abastecimiento y
quiere que quien juegue acabe sabiendo algo, así que esto NO es texto de juego —
no habla de costes ni de niveles— y va en su propio bloque con otro aire. Se lee
al elegir la pieza para construir (antes de pagarla, que es cuando apetece) y al
clicar una ya construida — ahí va PLEGADA en un `<details>` (una línea "¿Qué es
esto?"): abierta empujaba el lateral media pantalla y el autor pidió poder
quitarla de en medio; al elegir pieza nueva sigue abierta. **Si añades una pieza, escríbele su ficha**: una
instalación sin explicar rompe justo lo que el juego quiere hacer.

**El clic vive EN EL MAPA.** Bombear es clicar EL PUEBLO, y solo el pueblo.
Antes habia un botonazo BOMBEAR ocupando un cuarto de pantalla y ademas clicar
cualquier casilla vacia bombeaba, que no significaba nada. Ahora cada clic sobre
el terreno hace lo que corresponde a lo que hay debajo: repara si esta roto,
selecciona si es tuyo, destapa si esta en niebla, bombea si es el pueblo. (La
tira de ENGRASAR se fue con el desgaste; no queda ningún botón de acción fuera
del mapa.)

**LA CARTA DEL TAJO: el "¿y ahora qué?" contestado.** La tarjeta fija de
arriba del lateral (`panel-tajo`) enseña UN solo paso siguiente, mascado y
con botón — la respuesta al muro de la media partida ("hay que dárselo
mascado", petición del autor). La cadena va del final de la guía al primer
traslado: textos en `CONFIG.tajos` (en orden: el orden ES la prioridad),
condiciones en `src/tajos.js` (lectura pura, como tutorial.js) — se enseña
el PRIMER tajo pendiente, y si su mecánica aún no ha nacido se salta: la
carta nunca pide lo que el juego no da todavía. El botón (`irTajo` en
main.js) hace lo obvio de cada paso: abre la solapa, arma la herramienta de
tender o colocar, o centra el mapa en el vecino. Dos cierres a propósito:
nunca sale con la guía en marcha, y DESAPARECE en la comarca 2 — quien ya
se trasladó no necesita capataz.

**LA INTERFAZ SE GANA, como los pueblos.** Los otros dos frentes del mismo
plan: el HUD arranca con TRES métricas (Agua, Caja, Servicio) y las demás
se incorporan cuando nace su mecánica (`ui.refrescarMetricas`: Población
con la guía hecha, Producción y reloj con la primera captación, Cauce al
verter, Expansión al destapar); y las solapas igual
(`ui.refrescarSolapas`): Mancomunidad no existe hasta el segundo pueblo —
con una SALVAGUARDA: si el cauce necesita su panel, la solapa aparece
antes, porque nada útil puede quedar detrás de una solapa escondida — y
«La red» espera a la primera tubería. Todo estreno lleva el mismo guiño
(`.estreno`, una vez y sin latido) y la misma regla innegociable: las
condiciones salen del ESTADO — a una partida cargada no se le quita nada,
solo se retrasa lo que el jugador nuevo aún no necesita.

**EL MAPA ES EL SELECTOR de pueblos; la barra, el parte de alertas.** Las
pestañas por pueblo no escalaban a 36 y se quitaron: tocar un pueblo en el
mapa ya lo hace activo, y desde `estiloMapa.zoomNombres` cada núcleo lleva
su NOMBRE rotulado bajo el caserío (azul el activo, blanco los tuyos,
dorado los por incorporar — el color dice de quién es). La fila de arriba
(`reconstruirPestanas`) queda en una barra fina: el pueblo activo (tocarlo
CENTRA la cámara — el "¿dónde estaba yo?" del móvil), la fase, y los CHIPS
DE ALERTA: un pueblo con servicio por debajo de `servicioMalo` o una
avería sacan su botón rojo que lleva al problema (`irProblema`,
`irAAveria`). Con veinte pueblos: cero pestañas, salvo problemas.

**LA REGLA DE ESCALA: nada que crezca con la partida se pinta entero.**
Doctrina del autor tras lo de las pestañas, y vale para TODO el juego: lo
que la partida multiplica (pueblos, averías, líneas, piezas rescatadas,
chips de alerta) se enseña ACOTADO — los peores o los más antiguos con
nombre y botón, y el resto agrupado con su cuenta y una línea que dice que
al atender estos van entrando. Los topes viven en `CONFIG.interfaz`
(chipsDeSed, averiasEnPanel, lineasEnPanel); el registro ya nació cortado a
8 y el almacén agrupa por tipo ("Bombeo ×3"). Al añadir CUALQUIER lista
nueva que dependa del tamaño de la partida, pregúntate qué pasa con veinte
antes de pintarla.

**El guía se llama MANUEL y comenta la partida.** `comentarios.js` es el motor
(lectura pura, como `tutorial.js`): una lista de comentarios con su condición,
en orden de prioridad — lo que duele antes que lo que luce. La regla que lo
salva de ser un incordio: CONTEXTUAL O NADA — Manuel habla del depósito lleno
de ESTE jugador, nunca ánimos genéricos. Guardas: silencio mínimo entre
comentarios (`CONFIG.comentarios`), cada uno se dice UNA vez y no vuelve hasta
RE-ARMARSE (su condición debe apagarse y volver), y jamás habla durante la
guía, con un hito pendiente, en el minijuego o sobre la portada. El bocadillo
flotante tiene DOS modos: guía de pasos y "Manuel dice" (sin título ni botón
de saltar). Los CHASCARRILLOS son el segundo escalón (batallitas de veterano,
también con contexto: la del 96 sale cuando LLUEVE): cualquier aviso les pasa
delante y llevan su propio silencio, mucho más largo.

La VOZ de Manuel son ARCHIVOS neuronales (assets/voz/, es-ES-AlvaroNeural) que
genera `generar_voces.py` (`pip install edge-tts`, una vez; internet solo al
generar): la síntesis del navegador sonaba a robot y quedó de RESPALDO. El
sistema anti-audios-mentirosos: el nombre de cada archivo lleva la HUELLA del
texto (`huellaVoz()` en sonido.js = djb2 UTF-8, la misma cuenta en Python) —
si un texto cambia, el archivo viejo jamás se reproduce (cae al sintetizador)
y re-ejecutar el script genera el nuevo y borra el huérfano. Los textos se
LEEN de config.js y comentarios.js: una sola fuente. Tras cambiar cualquier
texto de Manuel: `py generar_voces.py`. APAGADA por defecto (decisión del
autor) con botón propio que solo existe si hay CÓMO hablar; al encenderla,
Manuel se presenta (texto en `CONFIG.sonido.voz.presentacion` — vive en config
para que el generador lo lea). Lee pasos de guía y comentarios.

**La ANALÍTICA es un contador, no telemetría.** `analitica.js` responde a lo
único que no se puede preguntar ("¿te ha gustado?" siempre se contesta que sí):
cuántos entran, cuántos pasan de la portada, **cuántos vuelven al día
siguiente** y hasta dónde llegan. Cuatro reglas que no se negocian: NO carga el
script de nadie (solo pide una imagen de 1px, como el resto del proyecto no
admite código ajeno); cuenta QUÉ pasa y jamás QUIÉN (sin identificador, sin
ubicación, sin nada de la partida); con `CONFIG.analitica.codigo` a null el
módulo entero está mudo y no pide nada ni en local (como la música sin
archivos); y respeta «No rastrear». Los sucesos de progreso NO se instrumentan
a mano: se cuelgan de `contarHito()`, que ya ES la lista de momentos que
importan. Cada etiqueta se manda UNA vez por sesión — se cuentan jugadores que
llegan a un sitio, no veces que pasan. El contador de días vive en su propia
clave (`redHidraulica_visitas`) y no en el guardado: tiene que sobrevivir a
Reiniciar, porque si no cada reinicio parecería un jugador nuevo y la retención
medida sería mentira. Y el AUTOR se excluye con `juego.noContarme()` en la
consola (revierte `juego.contarme()`; clave `redHidraulica_noContar`): sus
pruebas ensuciaban la medición real.

**Publicar son DOS sitios distintos.** La web (GitHub Pages, rama `clicker`) se
actualiza con `git push` y nada más. El paquete de itch.io lo genera
`hacer_zip.bat` y hay que subirlo a mano. Dos avisos que costaron un rato: el
zip se hace con `tar.exe` de System32 y NO con `Compress-Archive`, que escribe
las rutas con barra invertida y hay descompresores que entonces dejan todo en
un archivo con el nombre lleno de barras; y se llama por ruta completa porque
el `tar` de Git aparece antes en el PATH y toma la «C:» por un servidor remoto.
El material de referencia suelto en `assets/` (esquemas, fondos viejos,
capturas de otros juegos) se queda FUERA del zip: son 23 MB que nadie descarga
para jugar. Los textos de la ficha de itch están en `docs/itch.md`.

**La guía tiene CAPÍTULOS (`CONFIG.guias`).** Al abrirse un servicio nuevo
(saneamiento, pluviales, residuos), el hito cuenta el PORQUÉ y su capítulo
enseña el CÓMO con el mismo motor de la guía inicial (tutorial.js): pasos
que se cumplen consiguiéndolos, saltables, con su estado en `estado.guias`
(se guarda). Tres reglas: una partida vieja con el servicio YA abierto no ve
su capítulo (lo decide `cargar()` — un veterano no necesita clase); mientras
hay capítulo activo, el TAJO y los comentarios de Manuel callan (dos
maestros a la vez es uno de más); y los ids de los pasos alimentan la VOZ
(`generar_voces.py` los lee), así que van en `\w+` sin guiones. OJO al
fallo que destapó esto: el recorrido de red arranca del propio pueblo, así
que una pieza pegada a él cuenta como conectada SIN tubería — el paso
'tuberia' de la guía exigía "algo conectado" y se cumplía solo; ahora exige
captación+bombeo+depósito conectados los tres.

**La guía envejece mal y nadie lo ve.** El tutorial llegó a pedir "pulsa
BOMBEAR" y "engrasa la instalación" dos versiones después de quitarse ambos: el
texto de los primeros pasos no lo relee nadie al refactorizar. Si quitas o
renombras algo con lo que interactúa el jugador, busca su nombre en
`CONFIG.tutorial` y en los hitos.

**El sonido se fabrica por código, como el dibujo.** `sonido.js` sintetiza todo
con Web Audio: ni un archivo de audio en el repo. Es un módulo como la escena
—solo reacciona, nunca toca el estado— y despierta perezoso porque el navegador
no deja sonar nada antes del primer gesto. Reglas: el clic de bombear lleva azar
en el tono (es el sonido más repetido con diferencia y sin azar suena a martillo
pilón); `contarHito()` es el ÚNICO sitio que suena la tarjeta, para que ningún
momento suene dos veces; la lluvia es lo único continuo y va bajísimo; y la
preferencia de silencio vive en su propia clave de localStorage
(`redHidraulica_sonido`), no en el guardado — tiene que sobrevivir al botón
Reiniciar. Los volúmenes van en `CONFIG.sonido`; las frecuencias y envolventes
de cada efecto son decisiones musicales y viven con el código, como los trazos
del dibujo.

La MÚSICA es la excepción: archivos del autor (`assets/musica.ogg|mp3|wav`,
`musica2`... hasta el primer hueco, generados como las ilustraciones), por
`AudioBufferSourceNode` —sin el hueco que mete `<audio loop>`— y con canal y
botón propios, independientes de los efectos: hay quien juega con música y sin
efectos, y al revés. Las pistas van BARAJADAS en bolsa (`siguientePista()`):
cada vuelta suena la lista entera en un orden nuevo y jamás repite dos veces
seguidas — empezar siempre por la misma canción cantaba a monotonía (dixit el
autor). Si no hay archivos, el botón NI APARECE (un mando que no manda nada es
peor que ningún mando) y el juego suena igual que antes de tener música.

El ARRANQUE (`sonido.arranque()`): lo primero que se oye al primer gesto —
normalmente el botón de la portada, que es además el gesto que el navegador
exige para dejar sonar nada; por eso la portada NO puede tener sonido antes
del clic, es el navegador, no un descuido—. Con jingle del autor
(`assets/intro.*`) suena entero y la música entra al terminar; sin él, una
fanfarria corta de código. Suena UNA vez por sesión. El prompt y los trucos
del bucle están en `assets/PROMPTS.md`.

**El tacto es un ciudadano de primera.** El zoom táctil es el PELLIZCO:
`entrada.js` lleva los dedos en un mapa y con dos reparte el gesto en `pellizco`
(factor) + `arrastrar`; `ampliarFactor()` es la única cuenta de zoom y la rueda
pasa por ella. Tres detalles que costaron caro: `#escena` lleva
`touch-action:none` (sin él el navegador se queda el gesto para hacer scroll y
corta el arrastre con un `pointercancel`); `setPointerCapture` va en try/catch
(si falla, tumbaba el manejador entero); y el clic fantasma — al soltar un dedo
del pellizco antes que el otro colaba un tap — se bloquea con `fuePellizco`
hasta soltar TODOS los dedos. En móvil (≤640px) el HUD pasa a rejilla 4×2
porque en fila se cortaban cuatro números de ocho, entre ellos Servicio.

**Explorar tiene RUMBO: las señales de camino.** Cada núcleo siembra una
señal (`hallazgo: 'senal'`, `sembrarSenales`) a `senalDistMin..Max` casillas
hacia el origen. Destapada, es un poste con flecha y distancia que apunta al
pueblo SIN RESOLVER más cercano (`nucleoMasCercano`, calculado EN VIVO: al
incorporar ese pueblo pasa sola al siguiente). No late como los premios —es
un cartel, no un hallazgo pendiente— y no bloquea obra. Y descubrir un
PUEBLO ya no es una línea del registro: sale la TARJETA (`mostrarDescubierto`
en main, overlay `descubierto-fondo`) con la estampa de su escalón, el nombre
y sus vecinos pidiendo el agua, más fanfarria propia (`sonido.descubierto` —
distinta del hito, que sigue siendo solo de `contarHito`). Sale CADA vez: 36
pueblos son 36 momentos, no un hito de una sola vez.

**Las redes van por CARRILES.** Cuando varias cruzan la misma casilla ya no
se tapan (se solapaban en el centro exacto y la última pintada ganaba): cada
red lleva un desvío diagonal fijo (`estiloMapa.carril`, orden el de
`CONFIG.redes`) y se ven las cuatro en paralelo, como una zanja de servicios.

**Las piezas llevan TINTA.** `estiloMapa.tinta` es el alfa de la silueta
oscura que los ayudantes isométricos (isoCaja, isoCilindro, isoTejado) trazan
alrededor de cada pieza — el mismo lenguaje que los minijuegos y los
residuos. A 0 se apaga.

**El agua BRUTA se potabiliza, o frena.** La POTABILIZADORA (ETAP) es pieza
de la red de abastecimiento. `aguaBrutaLh()` dice cuánta agua necesita
tratamiento: TODA la superficial (un río limpio no es un río potable) más la
de pozos sobre masas por debajo de `umbralMerma` (al bajar el nivel se
concentran las partículas por millón — lo trajo el autor, que es del oficio).
`capacidadPotabilizacion()` es lo que las ETAP conectadas tratan; el déficit
FRENA el crecimiento (`calidad.penalizacionBruta`, como el cauce sucio y la
basura: frena, no mata). El aviso vive en `avisosRed` y en un comentario de
Manuel — el freno era silencioso y sin contarlo el jugador ve el pueblo
estancado sin saber por qué. En el mapa, la ETAP son balsas RECTANGULARES
(cuadrado = beber; círculo = devolver, que es la depuradora). Medido: la ETAP
temprana retrasa fase 2 de 58 a 69 min — es el precio de la decisión, no un
error de calibrado.

**El clic sirve AL CONJUNTO.** Los pueblos que comparten red de
abastecimiento funcionan como uno (petición del autor): el golpe de bomba
se da donde clicas —el pueblo, el depósito, cualquier pieza conectada—
pero el agua va al pueblo MÁS SEDIENTO del conjunto
(`conjuntoDeRed()` en mapa.js recorre la mancha de tubería desde la
casilla clicada). Mismos litros por clic: repartir con cabeza no
multiplica el caudal, así no hay que topar cuántos pueblos comparten red.
Si el agua fue a otro pueblo, allí también destella — sin eso, tu depósito
no sube y el clic parece perdido.

**El clic tiene dos límites** (`CONFIG.bombeo`): con el depósito LLENO cada
golpe se DERRAMA y ensucia el cauce un poco (`contaminacionPorDesborde`, lo
aplica `bombear()` en simulacion; main le pone cara: sin destello, sonido
seco y un aviso la primera vez). Y hay TOPE DE RITMO
(`maxClicsPorSegundo`): más clics de los que da una mano se ignoran. NO es un
detector de autoclickers — en un juego que corre entero en el navegador del
jugador no se puede detectar de verdad, y perseguirlos castigaría a los
rápidos legítimos —: los vuelve INÚTILES, que es mejor que prohibirlos.

**El mapa y el abastecimiento son UN SOLO bucle.** `poderExpansion(estado)` sale
de la población, el nivel de servicio, el desgaste y las averías, y DIVIDE el
coste en clics de destapar casillas (`clicsParaDestapar`). Es lo que impide que
el mapa se convierta en un juego aparte: si desatiendes el abastecimiento,
explorar se encarece; si lo cuidas, el territorio se abre. Cualquier mecánica
nueva del mapa debería engancharse aquí y no vivir por su cuenta.

**El desglose de producción es LA fuente, no un espejo.** La solapa Pueblo abre
con "De dónde sale el agua" (`refrescarDiagnostico`): río, pozos y cada merma
—estiaje, tope de tubería, fugas, lixiviados, averías— con su número y su
remedio, y el cierre produce-contra-demanda. Lo importante es el orden de las
dependencias: `desgloseProduccion()` en `simulacion.js` ES la cuenta, y
`caudalCaptacion()` y `redEstrangula()` derivan de ella. Se hizo así a propósito
—el panel podría haber calculado su propia versión— porque duplicar una fórmula
ya provocó una vez dos verdades distintas con la demanda. Cada línea sale solo
si duele: un desglose lleno de ceros no lo lee nadie.

**Ojo con el tope de ingresos.** Solo se factura el agua SERVIDA, así que la
recaudación está topada por la demanda del pueblo: en cuanto la superas, clicar
más no da nada. Por eso el crecimiento de población es agresivo
(`tasaCrecimientoAnual`): es lo que hace que la demanda te persiga y el clic
siga teniendo sentido. Si algún día bajas el crecimiento, el juego se queda sin
tensión a los pocos minutos.

**Mejoras.** La tienda se genera sola desde `CONFIG.mejoras`: cada entrada tiene
`costeBase`, `factorCoste`, `nivelMax` y sus parámetros de efecto. El nivel vive
en `pueblo.mejoras[clave]` (por pueblo); el coste del siguiente nivel es
`costeBase · factorCoste^nivel` (`costeMejora()`). Añadir una vía nueva es añadir
una entrada en config y, si necesita efecto, leerlo en `simulacion.js`. No hace
falta tocar la UI ni `entrada.js`.

**Crecimiento.** En `crecer()`: la población crece solo tras una *racha* de buen
servicio sostenido (un corte la resetea), mengua si va mal servida, y se queda
igual en la zona templada. Al crecer sube la demanda, lo que realimenta la
necesidad de más mejoras.

**Y el pueblo SE VE crecer.** El caserío tenía tres casas fijas: daba igual 200
habitantes que 6.000, así que el premio del bucle central (servir bien → crecer)
era un número subiendo en el HUD. Ahora hay cuatro escalones
(`CONFIG.caserio.escalones`: aldea, pueblo, villa, ciudad) y a partir de villa
sale la IGLESIA con su campanario, que es la silueta que se reconoce de lejos.
Los umbrales no son redondos por capricho: son los topes de la escala de
tuberías (400/1600/6000), así el pueblo cambia de aspecto justo cuando la
conducción se le queda pequeña. `nivelCaserio()` vive en `simulacion.js` y la
usan la escena (cuántas casas pinta) y `main.js` (el aviso): duplicar esa cuenta
daría un pueblo dibujado como villa mientras el aviso dice otra cosa. Los
núcleos SIN incorporar también enseñan su tamaño (`celda.habIni`), así se ve
desde lejos si lo que hay allí es una aldea o una ciudad. El cambio de escalón
se anuncia como un GUIÑO —destello, sonido y una línea—, no como tarjeta a
pantalla completa: los hitos paran el juego porque son cuatro en la partida, y
esto pasa muchas veces. Ojo con el género al escribir los textos: los escalones
llevan `art` porque es "un pueblo" pero "una aldea".

**El pueblo tiene FICHA, y es donde va la ilustración.** `fichaPueblo()` sale al
clicar cualquier núcleo, tuyo o por incorporar: nombre, escalón, habitantes, lo
que pide y el servicio, más la lección divulgativa del tamaño (`escalones[].ficha`
— por qué una aldea es el núcleo más ingrato de abastecer, por qué en una ciudad
un corte es una noticia). Antes, en cuanto incorporabas un pueblo el panel se
escondía: clicar tu propio pueblo no enseñaba NADA. La ILUSTRACIÓN
(`assets/f_<escalón>.jpg`) va aquí y NO en el mapa, y la razón es la de siempre
en este proyecto: en el mapa hay que casar con la isométrica del depósito y el
bombeo, aguantar el zoom y llevar encima niebla, halo, selección y avería —una
lámina ahí se ve pegada con celo—; en el panel es tamaño fijo, sin estados y sin
vecinos. Cambia sola al crecer, que es medio premio. Ojo con la firma de caché:
lleva habitantes y servicio porque cambian solos, y sin ellos la ficha se queda
enseñando los datos del momento en que la abriste.

**Ciclo del mundo.** `coefHora()` modula el consumo por la hora del día
(`curvaDiaria`) y `factorEstiaje()` modula la captación por la estación
(`estiaje`, sobre `tiempo.horasPorAño`). Se aplican dentro de `avanzar()`.

Las tres curvas del año —estaciones de la escena, estiaje y lluvia— comparten la
misma fase. `factorEstiaje()` lleva un desfase de 1/8 de año a propósito para que
su mínimo caiga en pleno VERANO; sin él, el panel decía "estiaje (verano)"
mientras la escena ya pintaba otoño lloviendo. Si tocas una curva, comprueba las
otras dos: `nombreEstacion()` es la fuente única del nombre.

**MINIJUEGOS: opcionales o no son.** La regla de oro, escrita en
`CONFIG.minijuegos`: salen de momentos que ya existen, dan ventaja a quien los
juega y NUNCA son puerta de progreso. Módulos autocontenidos (su telón, su
lienzo, su rAF, sus escuchas) que NO tocan el estado: devuelven el resultado
por callback y `main.js` decide qué significa. EL TALLER (solapa Mancomunidad)
los ofrece en modo ensayo, sin premio ni castigo — nació para que el autor
probara sin esperar una avería y se queda para que el jugador ensaye gratis.

1. REPARACIÓN A MANO (`minijuego_tuberias.js`): desde el panel de averías, un
tablero de tuberías contrarreloj — el tablero nace LLENO de piezas giradas al
azar y el clic solo GIRA: hay que recomponer el camino de entrada a salida
antes de que el agua tope con un desencaje. Hubo una versión en que se
COLOCABAN piezas de una cola y se quitó a petición del autor: una pieza mal
puesta no tenía arreglo y un clic condenaba la partida — girar siempre tiene
vuelta atrás. La generación EXCAVA primero un camino solución (paseo
autoevitante de boca a boca, con el este en ventaja), pone en él las piezas
correctas (`rotBuena`, guardada solo para poder verificar por consola),
rellena el resto y baraja los giros comprobando con `yaResuelto()` que el azar
no lo dejó resuelto de fábrica: un puzle sin solución no es difícil, es una
estafa — y uno resuelto de serie, tampoco es un puzle. Hay CUATRO formas
(recto, codo, te, cruceta — `formasExtra` reparte las dos últimas, también
dentro del camino) y UNA sola regla de flujo, `salidaDe()`: el agua sigue
RECTO si puede y si no gira — la cruceta se cruza de largo en cualquier
posición y la te puede mandar el agua por donde no pensabas. `giroQueUne()`
comprueba el FLUJO, no solo la conexión: en una te no basta con que las dos
bocas estén abiertas, y por eso puede devolver null. La pieza mojada guarda
`entradaAgua` para dibujarse llena por su recorrido real (las ramas de sobra
quedan secas). Premio: la avería queda gratis. UN intento por avería
(`av.aManoJugada`, se gasta al ENTRAR — abandonar también cuenta): con
reintentos infinitos, la llave no tendría sentido.

2. LA LÍNEA DE RECICLAJE (`minijuego_reciclaje.js`): desde la ficha de la
planta, "echar un turno" — agarrar cada residuo de la cinta y soltarlo en su
contenedor, LOS DE VERDAD (amarillo envases, azul papel, verde vidrio, marrón
orgánica). La lección escondida: el RESTO no se toca — dejarlo seguir hasta el
vertedero ES lo correcto, porque no todo se recicla. Esa regla se cuenta EN
GRANDE antes de arrancar la cinta (el preludio: `preludioSegundos`, con los
cuatro del resto dibujados y toque para saltar) — vivía en la letra pequeña
del telón y no la leía nadie. El plantel son 24
residuos CLAROS (regla del autor, que es del oficio: nada ambiguo — el zapato
se retiró porque si sirve va a textil y si no a resto, y ese matiz no cabe en
la cinta; los del resto enseñan: pañal, maceta de CERÁMICA —el error clásico
del iglú verde— y esponja). Solo salen a la cinta los que TIENEN estampa
(sprite `assets/res_*.png` de la hoja 6×4 o dibujo por código:
`residuoAlAzar` filtra), así la lista va por delante del arte sin que aparezca
un bulto sin cara. La mano del operario ES el cursor (guante por código,
abierta/puño; `cursor:none` en el lienzo). Premio: la venta de
reciclado sube según puntería (`factorTurnoReciclaje`, multiplica
`precioMedioReciclaje`) durante `horasBonus`; `estado.turnoReciclaje` se
guarda, y no hay segundo turno hasta que venza el bono.

3. LA RUTA DEL CAMIÓN (`minijuego_camion.js`): desde la ficha del VERTEDERO,
"sacar la ruta". VISTA CENITAL, diseño del autor (hubo una versión lateral
de "parar junto al contenedor" que se sustituyó entera a petición suya): el
camión va abajo y se mueve a los lados con las flechas o dos botonazos ◀ ▶
—nada de arrastrar, que conducir con el dedo era lo delicado—, y la calle
baja hacia él con contenedores y TRÁFICO. Se recoge PASANDO POR ENCIMA, y
solo puntúan los LLENOS (se les ven las bolsas) de las fracciones del día:
llevarse uno vacío, a medias o de otra fracción es recogida en balde, y un
coche te deja clavado (`aturdimientoSegundos`) con la jornada corriendo.
Jornadas DOBLES con camión bicompartimentado — dos tapas pintadas, dos
fracciones en una sola ruta sin mezclar: el dato es real y de la casa del
autor (Mancomunidad de Montejurra). Premio: `estado.rutaCamion` (se guarda)
sube `capacidadRecogida()` según puntería durante `horasBonus`; sin bono
vencido no hay segunda ruta. Números en `CONFIG.minijuegos.camion`.

**Averías: tienen SITIO en el mapa.** Viven en `estado.averias`
(`{col, fila, clics, desde}`) y son de la mancomunidad, no de un pueblo. Caen
sobre una PIEZA construida —sin instalación no hay averías, lo que mantiene
limpio el arranque— y su castigo es que esa pieza deja de contar como conectada
(`construccionesConectadas` la filtra): la avería se paga justo en lo que esa
pieza aportaba, no en un porcentaje suelto.

Se reparan YENDO ALLÍ y clicando encima (`clicAveria` en `main.js`), y cada golpe
de llave cuesta `costePorClic`. El panel lateral NO repara: lista lo roto y
centra la cámara. Hubo antes un botón que lo arreglaba de lejos y un operario que
aparecía solo por la pantalla cada minuto; los dos se quitaron a propósito —el
personaje automático cansaba y el botón convertía la avería en un trámite—.
`tickAverias()` sigue fuera de `avanzar()` y solo corre en la partida viva (nunca
offline: sería injusto), y el riesgo sube con la instalación por RAÍZ del número
de piezas, no en línea recta: multiplicando por el número salían averías en
cadena con solo dos piezas.

**Auto-bombeo = función especial, no una mejora.** Vive en `CONFIG.premium`, no
en `CONFIG.mejoras`. Es un booleano por pueblo (`pueblo.autobombaActivo`), no un
nivel. Se activa con `requisitosAutobomba(pueblo)` + pago alto. El campo
`desbloqueoExterno` es el gancho para una futura vía de anuncio/pago: NO hay pago
ni anuncio real implementado, y no se debe simular uno falso.

**COMARCAS: la estructura de partidas.** El TRASLADO DE CONCESIÓN (desde fase
`comarcas.faseParaTrasladarse`, en Mancomunidad): la partida se borra, el
LEGADO (`src/legado.js`, clave `redHidraulica_legado`) sobrevive con la
VETERANÍA ganada — por pueblo BIEN servido según su escalón
(`veteraniaAlTrasladarse()` en simulacion.js, cuenta única para panel y
traslado). Se gasta en el EXPEDIENTE: ventajas permanentes que quitan
FRICCIÓN, nunca multiplican ingresos (cartografía = radio inicial, manos
curtidas = clics de destapar, ojo clínico = coste del estudio, fama = SOLO el
primer canon de cada comarca) — así la primera partida queda intacta y el bot
con legado vacío tiene que dar la curva de siempre. La SEMILLA es de la
partida (`estado.semilla`, viaja en el guardado y en la copia de seguridad;
`cargar()` regenera el mapa si difiere); el río también sale de ella, CON
GUARDIA: con la semilla de siempre se usan las constantes de siempre, exactas
— mover el río a las partidas existentes las dejaría con las tuberías sobre
otro mundo (verificado regenerando idéntica). Cada comarca tiene REGIÓN
(`comarcas.regiones`, cíclicas): nombre y tinte que `aplicarRegion()` mezcla
sobre `CONFIG.terrenos` UNA vez al arrancar — la comarca 1 va sin tinte. Las
estampas de la ficha del pueblo prueban `f_<escalón>_e2/_e3.jpg` según
`epocaActual()` (pueblos más modernos, si el autor los genera) y caen a la
base. Reiniciar borra TODO, legado incluido: para conservar la experiencia
está el traslado, y el confirm lo dice. El hito `traslado` solo salta en la
comarca 1.

CALIBRADO (medido con el bot, 14/08/2026): la curva base NO se movió con las
comarcas (fase 2 en 58,3, fase 3 en 148, contaminación 0 — la referencia
exacta), y la comarca 424242 con expediente tier-1 da una curva sana
(fase 3 en 143). El hallazgo importante: la veteranía "de hoy" SUBE a ~13 y
luego BAJA (los pueblos menguan en el juego largo) — quien más se quedaba
podía cobrar menos. Por eso existe `estado.mejorVeterania` (se guarda): el
traslado paga el MÁXIMO alcanzado, no el estado del momento. El encaje de
números: primer traslado (fase 3) da ~13-22 según mapa, y el tier-1 completo
del expediente cuesta 15 — el primer traslado compra la mayoría; los tier-2
(30) piden quedarse a criar villas (4) y ciudades (7), que es justo la
partida larga de ~8 h que quiere el autor. Las ventajas actúan sobre la
EXPLORACIÓN, que el bot se salta: su aceleración medida (~3%) es un suelo
muy por debajo de la real.

**Offline.** `progresoOffline()` en `main.js` simula el tiempo ausente a pasos
(la curva diaria y el estiaje cambian por el camino) con tope `offline.maxHoras`
(8 h: la noche entera cabe, decidido al empezar a medir retención) y al
`offline.rendimiento` (50%): de la GANANCIA solo se cobra la mitad —
las pérdidas se pagan enteras, la ausencia no es un escudo—. Y LA NOCHE NO
DESPUEBLA (petición del autor: 8 h reales son AÑOS de juego, y volver al día
siguiente con los pueblos vacíos obligaba a conectarse cada poco): en tu
ausencia los pueblos pueden CRECER si quedaron bien servidos, pero nunca
menguar — el clamp por pueblo va al final de `progresoOffline()`. Las
multas y el cauce sí corren. Ampliar horas o
rendimiento es el gancho de monetización (`offline.desbloqueoExterno`): NO hay
pago implementado y no se simula ninguno falso. Usa `estado.ultimoInstante`,
que `guardar()` sella en cada guardado Y al esconderse la pestaña
(`visibilitychange`): sin eso, volver de otra aplicación —el caso normal del
móvil— perdía el tiempo ausente. La tarjeta de vuelta (`mostrarVuelta`) cuenta
el resultado con el tiempo en el calendario del juego; el tiempo FUERA se dice
entero aunque se simule menos.

**LUGARES: pueblos con nombres de la comarca del jugador.** `src/lugares.js` es
la ÚNICA pieza que habla con un servicio externo (Overpass/OpenStreetMap) y esa
dependencia se queda encapsulada ahí. Dos reglas sagradas: SIEMPRE opcional (un
botón en Mancomunidad; sin permiso, sin internet o sin ganas, los nombres
inventados de siempre) y la ubicación NO SE GUARDA — sale una sola vez, en la
consulta anónima; lo que se guarda es la lista de nombres
(`redHidraulica_lugares`, ordenada por cercanía: los pueblos que el jugador
reconoce son los primeros en aparecer). `nombreDeNucleo()` mira esa lista antes
que los inventados; los pueblos ya incorporados conservan su nombre guardado.
OJO: la geolocalización exige contexto seguro (https o localhost) — desde el
móvil por http://IP-local el navegador la negará; funcionará cuando el juego se
sirva con https.

**Las líneas ENVEJECEN, y el dato es del oficio.** Cada material tiene
`vidaAños` (fibrocemento 40 —una canalización de más de 40 se considera
susceptible de cambiarse—, polietileno 50, fundición 70). Pasada la vida, la
línea no revienta: FUGA cada año más (`tuberia.envejecimiento`, con techo — una
red vieja sangra, no mata). `fugasDe(tuberia, horas)` es la única cuenta;
`tasaFugasRed()` toma la peor línea conectada y de ahí beben el desglose y
`rendimientoRed()`. `nacida` (horas de juego) se sella al tender y al renovar;
renovar AL MISMO calibre solo se ofrece para líneas pasadas de vida — sin eso,
una fundición vieja no tenía cura. Las líneas sin fecha (bot, partidas viejas)
nacen al cargar: estrenar la mecánica robando 40 años sería un timo. El
calendario deja la vida útil en ~10 horas reales de partida: mantenimiento de
fondo, no un fastidio continuo.

## Trampas conocidas

- El navegador cachea los módulos ES con ganas. `servidor.py` lo desactiva con
  `no-store`, así que con el lanzador del proyecto no da guerra. Si arrancas con
  `py -m http.server` a pelo, vuelve el problema: editas un `.js`, recargas y
  sigues viendo el viejo. Ahí hace falta `Ctrl`+`F5`.
- `localStorage` guarda bajo `CONFIG.guardado.clave`. La clave clicker
  (`redHidraulica_clicker_v3`, subida con el mapa grande y los pueblos dinámicos) es distinta de la
  de estrategia a propósito. Si un cambio rompe el formato guardado, hay que
  borrarla (botón *Reiniciar*). `Estado.cargar()` reconstruye los pueblos desde
  la definición actual y vuelca lo guardado encima, así añadir una mejora o un
  pueblo no rompe una partida vieja.
- Los botones van por delegación (`data-accion`, y `data-clave` para la mejora,
  el índice de pueblo, el diámetro o la red). `entrada.js` escucha varios
  contenedores — la lista ÚNICA y verdadera es la del bucle `for(const id of
  [...])` en `entrada.js`; hoy: `tienda`, `premium`, `panel-averias`,
  `pestanas`, `panel-cauce`, `construir`, `hallazgo`, `almacen`, `panel-guia`,
  `red`, `obra`, `hito`, `casilla`, `vuelta`, `lugares`, `taller`,
  `respaldo` y `expediente`. Añadir un botón dentro de uno de ellos no obliga a tocar el
  listener; añadir un contenedor NUEVO sí, y es un fallo silencioso: el botón
  se pinta y no hace nada.
- La COPIA DE SEGURIDAD (bloque `respaldo`, Mancomunidad): `estado.exportar()`
  vuelca el guardado a un texto `PIPES1:<base64>` y `Estado.importar(texto)`
  lo valida y lo repone. Importar recarga la página anulando antes
  `estado.guardar` — el sello del adiós resucitaría la partida vieja, el mismo
  fantasma que mordió a Reiniciar.

## Depuración

**Medir la partida sin jugarla**: `medir_partida.mjs` es un bot que juega
acelerado con los módulos reales (clica, compra, construye, repara, renueva
calibres) y devuelve en qué minuto cae cada hito. Tras cualquier cambio de
equilibrio, re-medir cuesta segundos:
`(await import('/medir_partida.mjs')).medir(0.25, 120)` desde la consola.
Se salta el coste de explorar, así que sus tiempos son un suelo.

**Romper la partida sin jugarla**: `probar_caos.mjs` es el bot CAÓTICO
(petición del autor: los fallos viven en los caminos que nadie planeó). Hace
acciones legales pero desordenadas con semilla reproducible —construir sin
conectar, tender redes desde ninguna parte, derribar lo recién pagado,
incorporar el pueblo más lejano, guardar/cargar a mitad— y vigila
INVARIANTES: nada a NaN, nada negativo, ninguna excepción, y el desglose y
el guardado tienen que tragarse cualquier estado alcanzable.
`(await import('/probar_caos.mjs')).caos(123, 90)` desde la consola; aparta
el guardado real y lo repone pase lo que pase. Su primera presa fue real: a
10 clics/s, tres minutos de aporrear a depósito lleno ponían el cauce a 100
y la partida joven moría en espiral de multas — de ahí
`bombeo.desbordeTope` (el derrame ensucia hasta un tope: es agua limpia).


`main.js` expone `window.juego` con `estado`, `entrada`, `escena` y `CONFIG`.
Desde la consola del navegador:

- `juego.dinero(n)` fija el saldo (común) para probar sin clicar
- `juego.agua(n)` fija el agua del pueblo activo

## Estilo

- Todo en castellano: nombres de variables, funciones, comentarios y textos de
  interfaz. Mantenlo.
- Los comentarios explican **por qué**, no qué. Hay varios que documentan
  decisiones y fallos pasados; no los borres al refactorizar.
