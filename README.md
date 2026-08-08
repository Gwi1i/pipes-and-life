# Red Hidráulica

Juego de proyecto y explotación de una red de abastecimiento sobre terreno real.
Coloca captaciones, depósitos y bombeos, tiende tuberías, y lleva agua con
presión suficiente a cuatro núcleos de población.

---

## Cómo empezar a jugar

1. **Busca el agua.** Las líneas azules son cauces calculados sobre el propio
   terreno; los puntos turquesa son manantiales. La captación **solo** se puede
   colocar ahí.
2. **Sube el agua.** Los cauces van por el fondo del valle. Necesitas un bombeo
   y un depósito en cota alta.
3. **Reparte por gravedad.** Desde el depósito, tiende tuberías a cada núcleo.

Con la herramienta *Tubería*, los clics se encadenan: origen → destino →
siguiente destino. `Esc` para soltar el trazado.

---

## Cómo ejecutarlo

**No basta con abrir `index.html` haciendo doble clic.** El proyecto usa módulos
ES (`import` / `export`), y los navegadores los bloquean sobre el protocolo
`file://` por seguridad. Necesitas un servidor local.

Con el Python que ya tienes del OSGeo4W:

```bash
cd red-hidraulica
python -m http.server 8000
```

Y abre `http://localhost:8000` en el navegador.

Esto es una molestia de dos comandos, pero es cómo se trabaja de verdad. La
alternativa —meterlo todo en un archivo— no escala más allá de un prototipo.

---

## Arquitectura

```
red-hidraulica/
├── index.html          Estructura de la página: lienzo y paneles
├── css/estilos.css     Aspecto
└── src/
    ├── config.js       TODOS los parámetros ajustables
    ├── util.js         Funciones puras: azar sembrado, interpolación, color
    ├── terreno.js      Modelo de elevaciones y curvas de nivel
    ├── camara.js       Zoom, desplazamiento, mundo ↔ pantalla
    ├── grafo.js        Nodos, aristas, adyacencia, recorrido BFS
    ├── hidraulica.js   Solver: conectividad, caudales, presiones
    ├── render.js       Dibujo en canvas
    ├── entrada.js      Ratón, tacto, teclado, herramientas
    ├── estado.js       Economía y persistencia
    └── main.js         Ensamblado y bucle principal
```

### La regla que sostiene todo

Cada módulo tiene **una** responsabilidad y no invade las demás:

- `render.js` **lee** el estado, nunca lo modifica
- `hidraulica.js` no sabe dibujar ni de interfaz
- `entrada.js` no toca el grafo: emite acciones que `main.js` ejecuta
- `config.js` no importa nada de nadie

Si mañana quieres cambiar el aspecto, tocas un archivo. Si quieres cambiar el
modelo hidráulico, tocas otro. Eso es lo que un archivo único no te da.

---

## Las tres pasadas del solver

El corazón del juego está en `hidraulica.js`:

1. **Conectividad** — recorrido en anchura desde depósitos y captaciones.
   Devuelve un árbol de expansión: quién cuelga de quién.
2. **Caudales** — se recorre el árbol *al revés*, de hojas a raíz, sumando la
   demanda aguas abajo. Cuando llegas a un nudo, sus descendientes ya han
   sumado.
3. **Presiones** — se recorre en orden normal, de raíz a hojas, restando las
   pérdidas de carga acumuladas. Aquí es donde actúan los dos equipos que
   alteran la altura piezométrica: el **bombeo** la sube y la **válvula
   reductora** la recorta. Como el recorte se aplica antes de que los hijos
   lean la piezométrica de su padre, se propaga solo a toda la rama de aguas
   abajo, que es exactamente lo que hace una VRP real.

Es el patrón clásico de acumulación sobre árboles, y aparece en muchísimos
sitios: cálculo de caudales en redes ramificadas, agregación de superficies en
cuencas, propagación de costes en grafos.

### Lo que NO es

No es un modelo hidráulico real. Supone que la red es un **árbol** y resuelve de
una sola pasada. Un EPANET admite mallas cerradas y resuelve un sistema no lineal
por Newton-Raphson hasta converger.

La malla cerrada es la ampliación natural: cuando el agua puede llegar a un punto
por dos caminos, hay que repartir el caudal entre ambos de forma que las pérdidas
coincidan. Ahí es donde el problema se vuelve interesante de verdad.

---

## Lo que se aprende aquí

| Técnica | Dónde | Para qué te sirve fuera |
|---|---|---|
| Canvas 2D con cámara | `camara.js`, `render.js` | Cualquier visor de geometría |
| Ruido procedural | `terreno.js` | Generación de datos de prueba |
| Marching squares | `terreno.js` | Curvas de nivel desde un MDT |
| Relleno de depresiones | `terreno.js` | Preparar un MDT para hidrología |
| Dirección de flujo D8 | `terreno.js` | Fill → Flow Direction en QGIS |
| Acumulación de flujo | `terreno.js` | Extraer cauces de un MDT |
| Grafos y adyacencia | `grafo.js` | Topología de redes, CAD→EPANET |
| Recorrido BFS | `grafo.js` | Conectividad, sectorización, trazas |
| Acumulación sobre árbol | `hidraulica.js` | Caudales, cuencas, costes |
| Detección espacial | `grafo.js`, `util.js` | Selección en visores, limpieza CAD |
| Serialización de grafos | `grafo.js`, `estado.js` | Guardar cualquier topología |
| Módulos ES | todo | Cualquier proyecto que crezca |

---

## Estado actual

**Funciona:** terreno, cámara, colocación, tendido de tuberías, conectividad,
caudales, presiones, pérdidas de carga, bombeo con coste energético, válvulas
reductoras de presión, economía, guardado.

**Pendiente:** mallas cerradas, depósitos con volumen real, saneamiento.

## Qué mantiene viva la partida

Abastecer los cuatro núcleos no es el final, es el principio:

- **Ciclo diario de consumo.** La demanda no es constante: punta a las 8 y a las
  21, valle de madrugada. En punta se pide casi el doble que de media. Por eso
  existen los depósitos de regulación.
- **Crecimiento.** Un núcleo bien servido crece un 14 % al año; uno mal servido
  se despuebla. La red que hoy sobra, dentro de tres años se queda corta. Es el
  motor de que nunca termines.
- **Estiaje.** El caudal de los cauces cae en verano hasta un tercio. Tu
  captación de 20 L/s da 7 en agosto. Toca una segunda fuente, o sufrir.
- **Averías.** Las tuberías envejecen y revientan, y la sobrepresión lo acelera
  catorce veces. Un tramo roto deja de conducir hasta que lo reparas — y eso da
  por fin consecuencias reales al límite de presión máxima.

## Equilibrio

Con 78.000 € de partida das para captación, bombeo, depósito y unos tres tramos.
El cuarto núcleo hay que financiarlo con lo que recauda la red ya construida, o
sirviendo cubas. Está ajustado a propósito para que no puedas construirlo todo
de golpe: si te sobra dinero al terminar, baja `dineroInicial` en `config.js`.

---

## Siguientes pasos sugeridos

1. Juega y ajusta `config.js` hasta que el equilibrio funcione
2. Mejora el aspecto: el mapa se lee bien, pero se ve austero
3. Después, mallas cerradas — pero eso es reescribir el solver entero


---

## Nota sobre un fallo que merece recordar

La primera versión no colocaba nada al hacer clic, sin error ni aviso. La causa:

```js
emitir(tipo, datos = {}){ this.acciones.push({ tipo, ...datos }); }
// y se llamaba así:
this.emitir('colocar', { tipo: 'captacion', x, y });
```

El *spread* sobrescribía `tipo:'colocar'` con `tipo:'captacion'`, así que el
`switch` no encontraba caso y la acción desaparecía en silencio. JavaScript no
avisa de claves duplicadas al desestructurar.

Moraleja: cuando una función envuelve datos ajenos en un objeto propio,
conviene usar nombres que no puedan chocar (`elemento`, no `tipo`), o meter el
contenido en un subobjeto (`{ tipo, datos }`).
