# CLAUDE.md

Guía para trabajar en este repositorio.

## Regla de trabajo

**No modifiques ningún archivo sin decirme antes cuál y por qué.** Propón el
cambio, indica qué archivo tocas y qué problema resuelve, y espera respuesta.
Esto vale también para los archivos nuevos.

## Qué es el proyecto

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
    ├── tutorial.js     La guía de los primeros pasos (solo lee estado)
    ├── diagramas.js    Los esquemas animados de cada instalación (módulo puro)
    ├── entrada.js      Ratón, tacto, teclado → acciones
    ├── ui.js           DOM fuera de la escena: HUD, tienda, paneles
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

## Modelo multi-pueblo (mancomunidad)

Una MANCOMUNIDAD gestiona varios pueblos. Lo que es de cada pueblo y lo que es
común está separado a propósito:

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

Los pueblos 2 y 3 arrancan `desbloqueado:false` y se abren en
`comprobarDesbloqueo()` de `main.js` al superar los habitantes TOTALES de la
mancomunidad su `desbloqueaEn` (en `CONFIG.poblaciones`). Abrir el TERCERO activa
además `estado.pluvialesActivas`, que desbloquea las mejoras marcadas con
`requiere: 'pluviales'` (la UI las oculta hasta entonces).

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
clicar una ya construida. **Si añades una pieza, escríbele su ficha**: una
instalación sin explicar rompe justo lo que el juego quiere hacer.

**El clic vive EN EL MAPA.** Bombear es clicar EL PUEBLO, y solo el pueblo.
Antes habia un botonazo BOMBEAR ocupando un cuarto de pantalla y ademas clicar
cualquier casilla vacia bombeaba, que no significaba nada. Ahora cada clic sobre
el terreno hace lo que corresponde a lo que hay debajo: repara si esta roto,
selecciona si es tuyo, destapa si esta en niebla, bombea si es el pueblo. Del
botonazo solo queda una tira fina para ENGRASAR, que no tiene sitio propio sobre
el terreno.

**El mapa y el abastecimiento son UN SOLO bucle.** `poderExpansion(estado)` sale
de la población, el nivel de servicio, el desgaste y las averías, y DIVIDE el
coste en clics de destapar casillas (`clicsParaDestapar`). Es lo que impide que
el mapa se convierta en un juego aparte: si desatiendes el abastecimiento,
explorar se encarece; si lo cuidas, el territorio se abre. Cualquier mecánica
nueva del mapa debería engancharse aquí y no vivir por su cuenta.

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

**Ciclo del mundo.** `coefHora()` modula el consumo por la hora del día
(`curvaDiaria`) y `factorEstiaje()` modula la captación por la estación
(`estiaje`, sobre `tiempo.horasPorAño`). Se aplican dentro de `avanzar()`.

Las tres curvas del año —estaciones de la escena, estiaje y lluvia— comparten la
misma fase. `factorEstiaje()` lleva un desfase de 1/8 de año a propósito para que
su mínimo caiga en pleno VERANO; sin él, el panel decía "estiaje (verano)"
mientras la escena ya pintaba otoño lloviendo. Si tocas una curva, comprueba las
otras dos: `nombreEstacion()` es la fuente única del nombre.

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

**Offline.** `progresoOffline()` en `main.js` simula el tiempo ausente a pasos
(la curva diaria y el estiaje cambian por el camino) con tope `offline.maxHoras`.
Usa `estado.ultimoInstante`, que `guardar()` sella en cada guardado.

## Trampas conocidas

- El navegador cachea los módulos ES con ganas. `servidor.py` lo desactiva con
  `no-store`, así que con el lanzador del proyecto no da guerra. Si arrancas con
  `py -m http.server` a pelo, vuelve el problema: editas un `.js`, recargas y
  sigues viendo el viejo. Ahí hace falta `Ctrl`+`F5`.
- `localStorage` guarda bajo `CONFIG.guardado.clave`. La clave clicker
  (`redHidraulica_clicker_v2`, subida al pasar a multi-pueblo) es distinta de la
  de estrategia a propósito. Si un cambio rompe el formato guardado, hay que
  borrarla (botón *Reiniciar*). `Estado.cargar()` reconstruye los pueblos desde
  la definición actual y vuelca lo guardado encima, así añadir una mejora o un
  pueblo no rompe una partida vieja.
- Los botones van por delegación (`data-accion`, y `data-clave` para la mejora,
  el índice de pueblo, el diámetro o la red). `entrada.js` escucha varios
  contenedores: `tienda`, `premium`, `panel-averias`, `pestanas`, `panel-cauce`,
  `construir`, `hallazgo`, `almacen`, `panel-guia` y `red`. Añadir un botón
  dentro de uno de ellos no obliga a tocar el listener; añadir un contenedor
  NUEVO sí, y es un fallo silencioso: el botón se pinta y no hace nada.

## Depuración

`main.js` expone `window.juego` con `estado`, `entrada`, `escena` y `CONFIG`.
Desde la consola del navegador:

- `juego.dinero(n)` fija el saldo (común) para probar sin clicar
- `juego.agua(n)` fija el agua del pueblo activo

## Estilo

- Todo en castellano: nombres de variables, funciones, comentarios y textos de
  interfaz. Mantenlo.
- Los comentarios explican **por qué**, no qué. Hay varios que documentan
  decisiones y fallos pasados; no los borres al refactorizar.
