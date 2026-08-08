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

- **`escena.js` solo lee estado, nunca lo modifica.** Todo lo que dibuja lo
  recibe por parámetro. Lo único que guarda es su propio reloj de animación y
  los efectos pasajeros (destellos de clic, aparición del depósito), que no son
  estado de juego.
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

## Notas de la simulación

`simulacion.js` hace un balance de agua muy simple, sin red ni presiones:

1. **Entra** agua con cada `bombear()`, hasta el tope de `capacidad()`.
2. `capacidad()` vale poco sin depósito (el jugador tiene que clicar sin parar)
   y mucho con él. Ese contraste es lo que hace que el primer depósito se note.
3. `avanzar(dtHoras)` resta el consumo de la población, sirve lo que hay, y
   **factura solo lo servido**. Devuelve un resultado efímero (nivel de
   servicio, m³ servidos) que UI y escena leen; NO lo guarda en el estado.

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
en `estado.mejoras[clave]`; el coste del siguiente nivel es
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

**Averías.** Viven FUERA de `avanzar()`, en `tickAverias()` de `main.js`, que
solo corre en la partida viva (nunca offline: sería injusto). Una avería es
`estado.averia = { desde }`; mientras exista, `avanzar()` corta la producción
automática (el clic manual sigue). Se repara pagando (`repararAveria`) o sola si
`mejoras.mantenimiento > 0`, tras un tiempo que baja con el nivel.

**Auto-bombeo = función especial, no una mejora.** Vive en `CONFIG.premium`, no
en `CONFIG.mejoras`. Es un booleano (`estado.autobombaActivo`), no un nivel. Se
activa con `requisitosAutobomba()` + pago alto. El campo `desbloqueoExterno` es
el gancho para una futura vía de anuncio/pago: NO hay pago ni anuncio real
implementado, y no se debe simular uno falso.

**Offline.** `progresoOffline()` en `main.js` simula el tiempo ausente a pasos
(la curva diaria y el estiaje cambian por el camino) con tope `offline.maxHoras`.
Usa `estado.ultimoInstante`, que `guardar()` sella en cada guardado.

## Trampas conocidas

- El navegador cachea los módulos ES: si un cambio no aparece, recarga sin caché.
- `localStorage` guarda bajo `CONFIG.guardado.clave`. La clave de la versión
  clicker (`redHidraulica_clicker_v1`) es distinta de la de estrategia a
  propósito, para que las dos versiones no se pisen la partida. Si un cambio
  rompe el formato guardado, hay que borrarla (botón *Reiniciar*).
- Los botones de la tienda se recrean con el panel: van por delegación, con el
  nombre de la acción en `data-accion`. Añadir una mejora no obliga a tocar el
  listener de `entrada.js`.

## Depuración

`main.js` expone `window.juego` con `estado`, `entrada`, `escena` y `CONFIG`.
Desde la consola del navegador:

- `juego.dinero(n)` fija el saldo para probar sin clicar
- `juego.agua(n)` fija el agua almacenada

## Estilo

- Todo en castellano: nombres de variables, funciones, comentarios y textos de
  interfaz. Mantenlo.
- Los comentarios explican **por qué**, no qué. Hay varios que documentan
  decisiones y fallos pasados; no los borres al refactorizar.
