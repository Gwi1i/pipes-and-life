# CLAUDE.md

Guía para trabajar en este repositorio.

## Regla de trabajo

**No modifiques ningún archivo sin decirme antes cuál y por qué.** Propón el
cambio, indica qué archivo tocas y qué problema resuelve, y espera respuesta.
Esto vale también para los archivos nuevos.

## Qué es el proyecto

Red Hidráulica es un juego de **proyecto y explotación de una red de
abastecimiento de agua**. Sobre un terreno generado por procedimiento, el
jugador coloca captaciones, depósitos y bombeos, tiende tuberías y tiene que
llevar agua con presión suficiente a cuatro núcleos de población, gestionando a
la vez la economía, el estiaje, el crecimiento de la población y las averías.

Técnicamente:

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
Hace falta un servidor local, aunque sea el más tonto posible.

Sin proceso de build: se edita un archivo, se recarga el navegador y ya está.

## Arquitectura

```
red-hidraulica/
├── index.html          Estructura de la página: lienzo y paneles
├── css/estilos.css     Aspecto
└── src/
    ├── config.js       TODOS los parámetros ajustables
    ├── util.js         Funciones puras: azar sembrado, interpolación, color
    ├── terreno.js      Modelo de elevaciones, hidrología y curvas de nivel
    ├── camara.js       Zoom, desplazamiento, mundo ↔ pantalla
    ├── grafo.js        Nodos, aristas, adyacencia, recorrido BFS
    ├── hidraulica.js   Solver: conectividad, caudales, presiones
    ├── render.js       Dibujo en canvas
    ├── ui.js           DOM fuera del lienzo: barra, HUD, paneles
    ├── entrada.js      Ratón, tacto, teclado, herramientas
    ├── estado.js       Economía y persistencia
    └── main.js         Ensamblado y bucle principal
```

**Cada módulo de `src/` tiene una responsabilidad única y no invade las demás.**
Los límites concretos que hay que respetar:

- **`render.js` solo lee estado, nunca lo modifica.** Si el render tocara datos,
  sería imposible saber por qué algo cambia. Todo lo que dibuja lo recibe por
  parámetro.
- **`entrada.js` no toca el grafo.** Traduce eventos del navegador a
  *intenciones* y las encola como acciones; `main.js` es quien las ejecuta y
  modifica el grafo. Así la lógica de juego queda en un solo sitio.
- **`config.js` no importa nada de nadie.** Es una hoja del árbol de
  dependencias: solo exporta datos.
- `hidraulica.js` no sabe dibujar ni de interfaz.
- `ui.js` toca el DOM; `render.js` toca el canvas. No se mezclan.

Flujo del bucle principal (`main.js`):

```
entrada → acciones → solver → economía → render
```

## Regla de oro: los números van en config.js

**TODOS los números ajustables van en `config.js`. Nunca metas constantes
numéricas en la lógica.**

Si necesitas un número nuevo —un coste, un umbral, una tasa, un color, una
velocidad— créalo en `config.js` con su nombre y su comentario, e impórtalo. El
motor y los datos están separados a propósito: se puede reequilibrar el juego
entero sin abrir un solo archivo de lógica.

Excepción razonable: constantes matemáticas y físicas que no son ajustables
(`Math.PI`, los 9,81 m/s² de la gravedad, los 86400 s de un día, los factores de
conversión de unidades). Esos no son parámetros de juego.

## Notas del solver

`hidraulica.js` resuelve en tres pasadas sobre el árbol de expansión que
devuelve el BFS de `grafo.js`:

1. **Conectividad** — BFS desde depósitos y captaciones
2. **Caudales** — se recorre el orden de descubrimiento *al revés*, de hojas a
   raíz, acumulando la demanda aguas abajo
3. **Presiones** — en orden normal, de raíz a hojas, restando las pérdidas

Los dos equipos que alteran la altura piezométrica son **propiedades de un
nodo**, no nodos aparte: `nodo.bombeos` (un contador) y `nodo.valvula`
(`{ consigna }` o `null`). En una red real el grupo de impulsión va dentro de
la captación o del depósito, y la VRP va intercalada en la conducción; ninguno
de los dos es un punto de la red por sí mismo. Ambos se aplican en la tercera
pasada, **el bombeo primero y la válvula después** —una VRP recorta lo que le
llegue, incluido lo que acabe de meter una bomba— y como el recorte se hace
antes de que los hijos lean la piezométrica de su padre, se propaga solo a toda
la rama de aguas abajo.

La válvula **solo puede reducir**. Si la presión ya es menor que la consigna, no
hace nada. Cualquier cambio que la deje subiendo presión está mal.

**No es un modelo hidráulico real** y no pretende serlo. Supone que la red es un
**árbol** y resuelve de una sola pasada; las fórmulas de pérdida de carga están
inspiradas en Hazen-Williams pero con constantes elegidas para que se note
jugando. No intentes validarlas contra un cálculo real. Las mallas cerradas
(varios caminos hasta un mismo punto) quedan fuera: soportarlas es reescribir el
solver.

El solver solo se ejecuta cuando la red cambia (bandera `recalcular` en
`main.js`), no en cada fotograma.

## Trampas conocidas

- `entrada.emitir(tipo, datos)` hace `push({ tipo, ...datos })`. Si en `datos`
  metes una clave `tipo`, **sobrescribe el tipo de la acción** y el `switch` de
  `main.js` no la reconoce: fallo silencioso, sin error y sin efecto. Por eso la
  acción `colocar` usa la clave `elemento` y no `tipo`.
- El terreno se dibuja **una sola vez** a un lienzo aparte
  (`terreno.dibujarCapa()`). No lo repintes en el bucle.
- `Grafo` usa `Map`, que no se serializa solo a JSON: hay que pasar por
  `aObjeto()` / `desdeObjeto()`.
- La demanda de una población se calcula en `main.js` con `demandaMedia()`, y
  es la **media**: la punta la aplica el solver con `curvaDiaria`. Tener la
  fórmula duplicada ya provocó una vez que la demanda se dividiera sola entre
  1,6 a los dos segundos de partida. No la repitas en línea.
- Los botones del panel de detalle se recrean enteros en cada `mostrarNodo()`,
  así que van por delegación: el nombre de la acción viaja en el propio botón
  (`data-accion`, `data-id`, `data-delta`) y `main.js` lo emite tal cual. Para
  añadir un equipo nuevo no hace falta tocar el listener.
- El mundo se genera a partir de `mundo.semilla`. La misma semilla da siempre
  el mismo mapa; es lo que hace depurable la generación de terreno.

## Depuración

`main.js` expone `window.juego` con `grafo`, `estado`, `camara`, `terreno`,
`entrada` y `CONFIG`. Desde la consola del navegador:

- `juego.recalcular()` fuerza una pasada del solver si tocas el grafo a mano
- `juego.dinero(n)` fija el saldo para probar sin construir la economía

La partida se guarda en `localStorage` bajo la clave de `CONFIG.guardado.clave`.
Si un cambio rompe el formato guardado, hay que borrarla (botón *Reiniciar*) o
la carga fallará en silencio y arrancará una partida nueva.

## Estilo

- Todo en castellano: nombres de variables, funciones, comentarios y textos de
  interfaz. Mantenlo.
- Los comentarios explican **por qué**, no qué. Hay varios que documentan
  decisiones y fallos pasados; no los borres al refactorizar.
