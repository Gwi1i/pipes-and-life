# EL FINAL — diseño en papel (v0, 05/09/2026)

## Por qué

La encuesta plusone 2025 (1.141 jugadores de incrementales): "el juego
tiene un final" es, en palabras de su autor, *abrumadoramente popular*.
Pipes and Life tiende a infinito a propósito (las fases abren anillos, el
canon crece geométrico) y no tiene final: quien lo juega bien se queda sin
un sitio donde terminar. Un final no quita el infinito: le pone una meta.

## Qué es el final

**La comarca entera**: el momento en que los **36 núcleos** están
incorporados. Es el único final natural que ya está en el juego — el
mapa entero encendido, sin dorados por descubrir. No pide mecánica nueva:
pide una CEREMONIA y un después.

## La ceremonia (una vez por comarca)

1. El mapa se centra y hace ZOOM ATRÁS hasta abarcar la comarca entera
   (la cámara ya sabe centrar; el zoomMin manda), con fiesta encadenada
   pueblo a pueblo en orden de incorporación — la historia de la partida
   contada en confeti, unos dos segundos por pueblo en aceleración.
2. Tarjeta de hito `comarcaEntera` (lámina `h_comarca.jpg`, prompt en
   PROMPTS.md): qué ha pasado (36 pueblos beben de tu red), qué has
   conseguido (habitantes servidos, kilómetros de tubería, años de juego)
   y por qué importa (la lección grande del oficio: una mancomunidad
   existe para que el pueblo de 40 vecinos tenga el mismo grifo que la
   ciudad; eso lo has hecho tú).
3. Manuel dice su frase de despedida-que-no-es-despedida (voz).
4. Créditos breves dentro de la tarjeta: el autor, el oficio, la
   Mancomunidad de Montejurra como inspiración, la IA como asistencia.

## El después (para que el final no sea un muro)

Dos botones, y ninguno borra nada:
- **Seguir gestionando**: la partida sigue tal cual — averías, estiaje,
  crecimiento, renovaciones. El infinito de siempre, ahora como
  posjuego declarado.
- **Trasladar la concesión**: el traslado de siempre (legado.js), con
  bonus de veteranía por comarca completa (`comarcas.bonusComarcaEntera`)
  — el final ES la puerta natural al traslado, que hasta ahora se ofrecía
  sin un momento que lo pidiera.

El logro `comarcaEntera` (gremio) queda para siempre en el expediente.

## Reglas

- Se enseña UNA vez por comarca (`estado.hitosVistos`, como todo hito).
- No para el juego más que cualquier hito; la ceremonia dura lo que dura
  la fiesta encadenada (~30 s a 36 pueblos con aceleración) y se puede
  saltar con un toque.
- Contador: `/hito/comarcaEntera` sale solo por `contarHito()` — es la
  métrica de "lo terminó", que hoy no existe.
- Números en `CONFIG.final` (duración por pueblo, aceleración, bonus).

## Coste estimado

Pequeño: la fiesta y la cámara existen, el hito es una entrada más en
`CONFIG.hitos`, el traslado existe. Lo nuevo es la secuencia de cámara
(escena) y la tarjeta con cifras (ui). Una tarde, más la lámina del autor.

## Preguntas para el autor

- ¿36 incorporados, o 36 BIEN servidos (servicio ≥ umbral)? Lo segundo
  es más del oficio y más difícil; lo primero es más claro. Propuesta:
  incorporados para la ceremonia, y "los 36 bien servidos" como logro
  aparte del gremio.
- Bonus de veteranía por comarca completa: ¿cuánto? (propuesta: +50%).
- La frase de Manuel.
