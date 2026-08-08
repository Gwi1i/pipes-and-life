# Red Hidráulica — versión clicker

Juego incremental de abastecimiento de agua. Eres una **mancomunidad**: bombea a
golpe de clic, construye depósitos para acumular reserva, mantén servidos a tus
pueblos, depura las aguas antes de devolverlas al cauce y ve creciendo hasta
gestionar varios núcleos.

> Esta es la rama `clicker`. La versión original —de estrategia sobre terreno
> generado por procedimiento, con red de tuberías y solver hidráulico— vive en
> la rama `master`.

---

## Cómo empezar a jugar

1. **Bombea.** Cada clic en la escena (o la barra espaciadora) saca agua del
   río. Sin depósito, el agua va directa al pueblo: si dejas de clicar, se
   queda seco enseguida.
2. **Construye el depósito.** Con lo que ganes sirviendo agua, cómpralo en el
   panel de *Mejoras*. A partir de ahí el agua se **acumula** y el pueblo bebe
   de la reserva mientras descansas.
3. **Cobra.** Solo se paga el agua que llega. Cuanto mejor el servicio, más
   caja.

---

## Cómo ejecutarlo

**No basta con abrir `index.html` haciendo doble clic.** El proyecto usa módulos
ES (`import` / `export`), y los navegadores los bloquean sobre el protocolo
`file://` por seguridad. Necesitas un servidor local.

```bash
py -m http.server 8000
```

Y abre `http://localhost:8000` en el navegador. Sin proceso de build: se edita
un archivo, se recarga y ya está. (Si venías de otra versión, fuerza una recarga
sin caché con `Ctrl`+`F5`: el navegador cachea los módulos ES.)

---

## Arquitectura

```
red-hidraulica/
├── index.html          Estructura de la página: escena y paneles
├── css/estilos.css     Aspecto
└── src/
    ├── config.js       TODOS los parámetros ajustables
    ├── util.js         Funciones puras: formato, interpolación, color
    ├── estado.js       Dinero, agua, tiempo y persistencia
    ├── simulacion.js   El motor: balance de agua, consumo y facturación
    ├── escena.js       El diorama animado (canvas, solo lee estado)
    ├── entrada.js      Ratón, tacto y teclado → acciones
    ├── ui.js           DOM fuera de la escena: HUD, tienda, paneles
    └── main.js         Ensamblado y bucle principal
```

### La regla que sostiene todo

Cada módulo tiene **una** responsabilidad y no invade las demás:

- `escena.js` **lee** el estado, nunca lo modifica
- `simulacion.js` no sabe dibujar ni de interfaz
- `entrada.js` no toca el estado: emite acciones que `main.js` ejecuta
- `config.js` no importa nada de nadie

**Bucle principal** (`main.js`): `entrada → acciones → simulación → economía →
escena + ui`

---

## El balance de agua

El corazón del juego, en `simulacion.js`, es deliberadamente simple:

- **Entra** agua con cada clic de bomba (`bombear`), hasta el tope de capacidad.
- **La capacidad** es un chorrito sin depósito y una reserva grande con él: es
  el único número que separa "atado al clic" de "puedo soltar el ratón".
- **Sale** agua según la demanda de la población en cada paso.
- Se **factura** solo lo que se sirve.

No es un modelo hidráulico: no hay presiones ni pérdidas de carga. Eso era la
versión de estrategia. Aquí el interés está en el ritmo clicker y en el reparto
del dinero entre mejoras.

---

## Estado actual (Hitos 1-5)

**Funciona:**

- Clic de bombeo, consumo continuo, facturación.
- **Vías de mejora** que compiten por el dinero: potencia de bomba, depósito,
  captación (producción pasiva), depuradora y personal de mantenimiento.
- **Multi-pueblo (mancomunidad)**: al crecer el primer pueblo se desbloquea un
  segundo. Cada pueblo es un sistema propio (bomba, depósito, captación,
  depuradora, mantenimiento, auto-bombeo), y se alterna con pestañas. La **caja**,
  el **reloj/estación** y el **cauce** son comunes a la mancomunidad.
- **Saneamiento y cauce**: al crecer, un pueblo genera aguas residuales. Sin
  depurar ensucian el cauce común → **multa** y **freno al crecimiento** de todos.
  Se limpia a mano (botón LIMPIAR CAUCE) o, mejor, con la depuradora de cada pueblo.
- **Auto-bombeo como función especial**: no es una mejora más, sino un aliciente
  que se gana cumpliendo requisitos (niveles + población) y pagando caro. El
  código deja un gancho documentado (`CONFIG.premium.autobomba.desbloqueoExterno`)
  para, en el futuro, permitir desbloquearlo por otra vía (anuncio o pago). Ese
  pago/anuncio real NO está implementado.
- **La población crece o mengua** según el servicio: bien abastecida y sin cortes,
  crece y pide más agua; mal servida, se despuebla.
- **El año vivo**: el consumo sube y baja con la hora del día (punta de mañana y
  tarde) y la captación con la estación (en verano, estiaje). El cielo de la
  escena hace su ciclo día/noche.
- **Averías**: la instalación se rompe y para la producción automática (el clic
  manual sigue). Se repara a mano pagando, o sola si tienes personal de
  mantenimiento.
- **Progreso offline**: al volver, se acredita (con tope) lo producido mientras
  no estabas.
- **Escena "dibujos animados"**: muestra el CICLO DEL AGUA completo del pueblo
  activo (río → captación → bombeo → depósito → pueblo → saneamiento →
  depuradora → de vuelta al cauce). Con estilo cartoon (contornos, sombreado
  plano, rebote al clicar), **clima por estación** (sol, lluvia, nieve, flores),
  **árboles** con follaje estacional, colinas y nubes con parallax, ciclo
  día/noche, y el cauce que se enturbia con la contaminación. El vertido se ve
  sucio si no hay depuradora y limpio si la hay.

**Siguientes ideas:** más pueblos, más funciones especiales, eventos.

---

## Regla de oro: los números van en config.js

**TODOS los números ajustables van en `config.js`.** Un coste, un umbral, una
tasa, un color: se crea ahí con su nombre y su comentario, y se importa. Se puede
reequilibrar el juego entero sin abrir un archivo de lógica.
