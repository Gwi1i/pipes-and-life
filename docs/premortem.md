# PRE-MORTEM de Pipes and Life (06/09/2026)

Ejercicio: es marzo de 2027 y Pipes and Life ha muerto — nadie lo juega y el
autor no lo toca desde diciembre. Escribimos la esquela ANTES de que pase:
cada causa con su probabilidad (a ojo, con los datos de hoy), la SEÑAL que la
delataría a tiempo, y la VACUNA. Ordenadas por probabilidad × daño.

## 1. Murió de soledad: nadie llegó (probabilidad ALTA)

**La esquela**: el juego era bueno, pero vivía en tres estanterías pequeñas
(itch, Newgrounds, la web). Reddit daba un pico por post y silencio; galaxy
lo rechazó por la IA; nunca hubo un canal con descubrimiento pasivo. Treinta
visitas por quincena no dan comunidad, y sin comunidad no hay boca a boca.
**Datos de hoy**: 30 visitas/2 semanas antes de Newgrounds; 11 en dos días
después; 25 de 37 juegos del Feedback Friday con cero respuestas.
**Señal**: menos de 20 jugadores nuevos a la semana tras el post grande
(semana del 8/09). Referrers: si el 80% sigue siendo "directo", no hay
canal.
**Vacunas**: (a) r/aigamedev como serie ("Semana N: así se hizo") — allí
la IA es la entrada, no la puerta cerrada; (b) cadencia quincenal, no
semanal, para que dure; (c) YouTubers pequeños de incrementales (5 correos,
una tarde); (d) la tienda de Google Play cuando haya señal de retención —
el único escaparate con algoritmo; (e) iAgua y prensa navarra, que son
públicos que nadie más puede tocar.

## 2. Llegaron y no volvieron (probabilidad ALTA)

**La esquela**: la portada convertía al 70% pero /vuelve/* nunca apareció.
El juego pedía quince minutos de atención en una cultura de treinta
segundos; no tenía final que perseguir ni razón concreta para volver mañana.
**Datos de hoy**: /vuelve/dia-1 = 0 con ~35 jugadores nuevos acumulados; la
encuesta: "el juego tiene final" es lo más popular; los jugadores quieren
"algo que hacer" en segundo monitor.
**Señal**: /vuelve/dia-1 sigue a cero con 60 jugadores nuevos acumulados
(a ese tamaño, un 10% de retención ya se vería: 6 personas).
**Vacunas**: (a) EL FINAL (docs/final.md): una meta visible desde el
principio — "36 pueblos"; (b) la tarjeta de VUELTA cuenta qué pasó fuera,
pero no qué HAY QUE HACER ahora: que enseñe el tajo pendiente; (c) probar
con el probador frío el "día 2": cargar una partida de 20 min tras 8 h
offline y ver si el primer minuto de vuelta engancha; (d) medir en el
contador el ABANDONO por tramo (qué hito es el último que alcanzan).

## 3. Se quedó plano: el dinero fácil (probabilidad MEDIA)

**La esquela**: a partir de la fase 2 la caja crecía sola, todo se
renovaba al máximo y no quedaba decisión. Los que llegaron a la hora se
fueron por aburrimiento, no por dificultad.
**Datos de hoy**: el autor lo ha dicho tres veces; la obra fija lo alivió
en el arranque; el sinclic a ritmo 4 clava la curva de referencia pero
peorServicio 0 al final (hay tensión) — sin medir el tramo 2-4 h.
**Señal**: el bot con 150→300 min: si la caja crece más que lineal en fase
3 con todos servidos, está plano. Y en el contador: /hito/fase2 alto y
/hito/fase3 bajo.
**Vacunas**: (a) medir 300 min con el bot (una tarde); (b) la tarifa como
palanca global, tocada con datos; (c) averías y estiaje que ESCALAN con la
mancomunidad en fase 3+ (hoy escalan por raíz; el juego largo pide más);
(d) el traslado como final natural, no como botón escondido.

## 4. Murió el autor, no el juego: desmotivación (probabilidad MEDIA-ALTA)

**La esquela**: semanas de trabajo, cero respuestas, un rechazo sin motivo.
El autor dejó de jugar su propio juego, luego dejó de pasar los viernes,
luego dejó de abrir la sesión. Nadie decidió parar; se paró.
**Datos de hoy**: "me desmotiva que nadie conteste"; el propósito escrito
es aventura y buen producto, NO vivir de ello.
**Señal**: dos viernes seguidos sin post ni partida propia; la sesión
abierta solo para pedir "más ideas".
**Vacunas**: (a) escribir la línea de "suficiente": qué es éxito para este
proyecto (¿100 jugadores que vuelven? ¿un colegio jugando La Gota?) — sin
esa línea, todo parece poco; (b) cadencia quincenal, borradores siempre
listos: el coste del autor son minutos, no tardes; (c) celebrar lo medible
(dos desconocidos jugando 15 minutos ES alguien); (d) La Gota como energía
nueva con un cliente real; (e) que el autor JUEGUE sin trabajar: una
partida a la semana sin cazar fallos.

## 5. Se rompió en silencio (probabilidad MEDIA)

**La esquela**: una actualización dejó partidas corruptas en móvil; el
cazador de errores enseñaba un banner que nadie fotografió; el zip de itch
se quedó tres versiones atrás. Los pocos que volvían encontraron un juego
roto y no lo dijeron.
**Datos de hoy**: pasó `flotarDinero is not a function` en vivo (caché de
Pages + archivo sin commit); itch estuvo un día por detrás de la web; los
errores solo se ven si el jugador hace una foto.
**Señal**: hoy NO HAY señal — ese es el fallo.
**Vacunas**: (a) el cazador cuenta `/tropiezo` en el contador (anónimo:
cuenta que hubo un error, no cuál ni de quién) — así un despliegue roto se
ve en el parte del lunes sin depender de fotos; (b) checklist de
publicación: web + zip itch + zip Newgrounds SIEMPRE juntos (un solo
script que genere los dos zips y recuerde subirlos); (c) el probador frío
en MÓVIL antes de cada post grande; (d) cada cambio de formato de guardado
con partida vieja cargada en la prueba (ya es regla: mantenerla).

## 6. El estigma de la IA (probabilidad MEDIA, daño ALTO)

**La esquela**: un hilo con votos llamó al juego "AI slop"; el autor
discutió; la etiqueta se pegó y cada post posterior nació muerto.
**Datos de hoy**: galaxy lo rechazó; la encuesta dice que para un segmento
es todo o nada; en r/incremental_games se lee "aparte del obvio juego
pesado de IA" como descalificación.
**Señal**: un comentario con más votos que el post, sobre la IA y no sobre
el juego.
**Vacunas**: (a) la misma divulgación exacta en todos los sitios (hecho);
(b) el humano DELANTE: el oficio, la mancomunidad, las decisiones — el
juego existe porque un técnico de aguas tenía algo que enseñar; (c) NUNCA
discutir; contestar una vez con hechos y seguir; (d) no promocionar en
comunidades anti-IA; hay públicos para los que la IA es la entrada.

## 7. Construimos lo que nadie vio (probabilidad ALTA, daño MEDIO)

**La esquela**: manantiales, Libro del Oficio, camión, cuello señalado,
comarcas... cada semana un sistema nuevo para treinta visitantes que no
pasaban del minuto 20. El juego creció hacia dentro mientras nadie llegaba.
**Datos de hoy**: la mitad de los hitos del contador tienen 1-2 personas.
**Señal**: semanas con commits de mecánica y ninguno de llegada/retención.
**Vacunas**: regla de reparto — por cada tarde de mecánica nueva, una de
llegada (post, correo, canal) o de retención (final, vuelta, día 2). Las
mecánicas de recámara esperan a que haya a quién enseñárselas.

## 8. Pequeños riesgos con nombre (probabilidad BAJA)

- La voz de Manuel sale de un servicio no oficial (edge-tts): si cambia o
  se corta, no se generan voces nuevas. Vacuna: el respaldo del
  sintetizador del navegador ya existe; los archivos generados son
  nuestros.
- Los nombres de pueblos reales (lugares.js) piden ubicación: opcional y
  sin guardar (ya). No tocarlo.
- Un cambio de política de itch/Newgrounds sobre IA: la divulgación exacta
  es la única defensa; y la web propia no depende de nadie.

## Las cinco vacunas que se ponen YA (esta semana)

1. `/tropiezo` en el cazador: un error en producción se ve en el parte
   (código: analitica + main, diez líneas; a proponer).
2. El FINAL en papel → aprobar y construir (docs/final.md).
3. La línea de "suficiente" escrita por el autor, en una frase.
4. Serie en r/aigamedev, quincenal, borradores listos por mi parte.
5. Bot a 300 minutos para ver si el juego largo se queda plano.
