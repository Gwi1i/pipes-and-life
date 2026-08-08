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
  golpe de clic, se acumula en un depósito y se abastece a una población. El
  mapa se sustituye por una **escena decorativa animada**.

Técnicamente, ambas comparten:

- **JavaScript con módulos ES** (`import` / `export`)
- **Sin dependencias externas.** No hay `package.json`, ni `node_modules`, ni
  paso de compilación
- **Sin framework.** DOM y Canvas 2D a pelo

No añadas dependencias, empaquetadores ni frameworks sin plantearlo antes.

## Cómo se ejecuta

Desde la raíz del proyecto:

```bash
py -m http.server 8000
```

Y abrir `http://localhost:8000`.

**No funciona abriendo `index.html` con doble clic.** El proyecto usa módulos
ES, y los navegadores los bloquean sobre el protocolo `file://` por seguridad.
Hace falta un servidor local.

Sin proceso de build: se edita un archivo, se recarga el navegador y ya está.
Aviso: el navegador **cachea los módulos ES** con agresividad. Si un cambio en un
`.js` no se refleja, fuerza recarga sin caché (`Ctrl`+`F5`).

## Arquitectura (rama clicker)

```
red-hidraulica/
├── index.html          Estructura de la página: escena y paneles
├── css/estilos.css     Aspecto
└── src/
    ├── config.js       TODOS los parámetros ajustables
    ├── util.js         Funciones puras: formato, interpolación, color
    ├── estado.js       Dinero, agua, tiempo y persistencia
    ├── simulacion.js   El motor: balance de agua, consumo y facturación
    ├── escena.js       El diorama animado (canvas)
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
  `autobombaActivo`, `averia`, `saneamientoActivo`, `desbloqueado`. Casi todas
  las funciones de `simulacion.js` reciben un `pueblo`.
- **Común** (`estado`): `dinero` (una sola caja), `horas` (un reloj), y
  `contaminacion` (un solo cauce).

La UI muestra SIEMPRE el pueblo activo (`estado.activo`, índice en
`estado.puebloActivo`); las pestañas cambian cuál. La tienda, el panel de
detalle, las averías y el premium se refieren al activo. El cauce y la caja son
comunes. `ui.invalidarCache()` fuerza redibujar todo al cambiar de pueblo.

El segundo pueblo arranca `desbloqueado:false` y se abre en `comprobarDesbloqueo()`
de `main.js` cuando el primero supera `CONFIG.desbloqueo.segundoPuebloEn`.

## Notas de la simulación

`simulacion.js` hace un balance de agua muy simple, sin red ni presiones:

1. **Entra** agua con cada `bombear(pueblo)`, hasta el tope de `capacidad(pueblo)`.
2. `capacidad(pueblo)` vale poco sin depósito (hay que clicar sin parar) y mucho
   con él. Ese contraste es lo que hace que el primer depósito se note.
3. `avanzar(estado, dt)` recorre los pueblos desbloqueados: cada uno produce,
   consume, **factura solo lo servido** a la caja común, y vierte sus aguas
   residuales sin depurar al cauce común. Devuelve el resultado efímero del
   pueblo ACTIVO más los datos del cauce (contaminación, multa); NO lo guarda.

**Saneamiento y cauce.** Al superar `saneamiento.habitantesUmbral`, el pueblo
activa `saneamientoActivo` y genera aguas residuales (`fraccionResidual` del agua
servida). La depuradora (`fraccionTratada(pueblo)`) trata un %; lo que llega
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

**Averías.** Por pueblo. Viven FUERA de `avanzar()`, en `tickAverias()` de
`main.js`, que recorre los pueblos y solo corre en la partida viva (nunca
offline: sería injusto). Una avería es `pueblo.averia = { desde }`; mientras
exista, `avanzar()` corta la producción automática de ESE pueblo (el clic manual
sigue). Se repara pagando (`repararAveria`, sobre el activo) o sola si
`pueblo.mejoras.mantenimiento > 0`, tras un tiempo que baja con el nivel.

**Auto-bombeo = función especial, no una mejora.** Vive en `CONFIG.premium`, no
en `CONFIG.mejoras`. Es un booleano por pueblo (`pueblo.autobombaActivo`), no un
nivel. Se activa con `requisitosAutobomba(pueblo)` + pago alto. El campo
`desbloqueoExterno` es el gancho para una futura vía de anuncio/pago: NO hay pago
ni anuncio real implementado, y no se debe simular uno falso.

**Offline.** `progresoOffline()` en `main.js` simula el tiempo ausente a pasos
(la curva diaria y el estiaje cambian por el camino) con tope `offline.maxHoras`.
Usa `estado.ultimoInstante`, que `guardar()` sella en cada guardado.

## Trampas conocidas

- El navegador cachea los módulos ES: si un cambio no aparece, recarga sin caché.
- `localStorage` guarda bajo `CONFIG.guardado.clave`. La clave clicker
  (`redHidraulica_clicker_v2`, subida al pasar a multi-pueblo) es distinta de la
  de estrategia a propósito. Si un cambio rompe el formato guardado, hay que
  borrarla (botón *Reiniciar*). `Estado.cargar()` reconstruye los pueblos desde
  la definición actual y vuelca lo guardado encima, así añadir una mejora o un
  pueblo no rompe una partida vieja.
- Los botones van por delegación (`data-accion`, y `data-clave` para la mejora o
  el índice de pueblo). `entrada.js` escucha varios contenedores: `tienda`,
  `premium`, `panel-averias`, `pestanas`, `panel-cauce`. Añadir un botón dentro
  de uno de ellos no obliga a tocar el listener.

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
