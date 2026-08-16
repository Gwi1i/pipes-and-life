# La cirugía: disolver la tienda en el mapa

**Rama `cirugia` — NO se funde con `clicker` hasta que el autor revise este
plan Y pruebe la rama.** Origen: "me parece duplicar cosas que podrían estar
en un mismo sitio" (el autor, 16/08). La tienda es el fósil del clicker sin
mapa: 6 de sus 8 mejoras tienen gemela en las piezas.

## El principio

**El mapa es el único hogar de la infraestructura.** Todo lo que produce,
almacena o trata vive como pieza: se coloca, se conecta, se amplía y se
avería ALLÍ. La progresión profunda que daba la tienda (25 niveles de
bomba) pasa a las ampliaciones, con topes altos y curvas recalibradas.

## Tabla de equivalencias

| Mejora de tienda | Destino | Efecto nuevo |
|---|---|---|
| Potencia de bomba (25 nv) | pieza BOMBEO | litros/clic = base + niveles conectados × aporte |
| Depósito de reserva (15 nv) | pieza DEPÓSITO | capacidad = buffer + niveles × aporte (sube el aporte) |
| Captación (20 nv) | pieza CAPTACIÓN | producción = niveles × 0,30 L/s (ya era así a medias) |
| Depuradora (6 nv) | pieza DEPURADORA | caudal y calidad = niveles conectados (se funden las dos mitades) |
| Red de pluviales (5 nv) | la propia RED | separación = LÍNEAS de pluviales conectadas × fracción por línea — tender ES el juego |
| Tanque de tormentas (5 nv) | pieza TANQUE | retención = niveles × aporte |
| Planta de reciclaje (7 nv) | pieza RECICLAJE | fracciones abiertas = niveles conectados (ampliar la planta abre fracción) |
| Personal de mantenimiento (8 nv) | LA CUADRILLA (mancomunidad) | compra común en la solapa Mancomunidad, junto a la caja; mismos efectos |

El auto-bombeo pide ahora niveles de pieza conectados (mismos números).
Los guiños de la escena vieja (aparecerDeposito...) pasan a dispararse al
COLOCAR la primera pieza.

## Curvas nuevas (`CONFIG.ampliacion.porTipo`)

Cada tipo con su tope y su factor (antes: todos a 4 y 1,7). Los topes
absorben la escalera municipal; los factores bajan para que 15-20 niveles
sean pagables. **Los calibra el bot, no el ojo**: la referencia es fase 2
en 58-69 min y fase 3 ~150.

## Migración de partidas vivas

Al cargar una partida con niveles de tienda comprados: **reembolso íntegro**
de lo invertido en las 6 mejoras disueltas (suma geométrica de costeMejora),
anotado en el registro con su porqué. El mantenimiento no se reembolsa: se
convierte en nivel de CUADRILLA equivalente (el mayor de los pueblos),
gratis. Nadie pierde lo pagado; nadie pierde el efecto de mantenimiento.

## Lo que toca (inventario del corte)

- `simulacion.js`: litrosPorClic, capacidad, desgloseProduccion (río),
  fraccionTratada, capacidadTratamiento, capacidadPluviales, capacidadTanque,
  nivelReciclaje, calidadServicio (bonus tanque/pluviales), requisitosAutobomba.
- `estado.js`: pueblo.mejoras desaparece del constructor (queda en cargar
  para la migración); nace estado.cuadrilla.
- `main.js`: caso comprar (muere), guiños de escena, clicsDeReparacion y
  reparación auto (leen cuadrilla), riesgo de averías (leía mejoras.captacion
  → niveles de pieza).
- `ui.js`: la tienda y su nota desaparecen; el diagnóstico y la ficha de
  pueblo leen piezas; el HUD conCaptacion lee piezas; compra de cuadrilla
  en Mancomunidad.
- `tajos.js`: condiciones 'mejora'/'pluviales'/'reciclaje' releídas a piezas
  y sus textos revisados.
- `entrada.js`: el contenedor 'tienda' sale de la lista (y 'cuadrilla' entra
  donde toque).
- bots (`medir_partida`, `probar_caos`): comprar → construir/ampliar.
- `en.js`: mueren las claves de la tienda (el extractor avisará SOBRAN),
  nacen las de la cuadrilla.
- `index.html`/`css`: bloque tienda fuera, bloque cuadrilla dentro.
- Textos de tutorial/hitos/comentarios que mencionen la tienda: revisar con
  `grep -i "tienda\|mejoras del pueblo"` en config y comentarios.

## Orden de ejecución (cada fase deja el juego arrancable)

1. Config: `ampliacion.porTipo` + efectos por pieza recalibrados.
2. `simulacion.js`: el corte de fórmulas (todas a piezas) + cuadrilla.
3. `main.js`/`ui.js`/`tajos.js`/`entrada.js`: la tienda fuera, la cuadrilla
   dentro, lectores a piezas.
4. Migración en `cargar()` + probar con partida vieja de verdad.
5. Bots reescritos + MEDIR: la curva debe volver a la banda.
6. Caos con tres semillas: invariantes intactos.
7. Diccionario y limpieza de claves muertas.
8. El autor juega la rama. Solo entonces, fundir.
