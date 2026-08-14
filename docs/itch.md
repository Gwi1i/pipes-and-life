# Material para la página de itch.io

Todo listo para copiar y pegar. Los campos van en el orden en que itch los
pide al crear el proyecto (**Dashboard → Create new project**).

---

## Ajustes de la página

| Campo | Qué poner |
|---|---|
| **Title** | `Pipes and Life` |
| **Short description / tagline** | `Bring water to 36 towns, one pipe at a time. Made by someone from the trade. En castellano y en inglés.` *(itch corta a 120 caracteres: este mide 104)* |
| **Classification** | Games |
| **Kind of project** | HTML (para que se juegue en la propia página) |
| **Release status** | Released *(o "In development" si prefieres avisar de que sigue creciendo)* |
| **Pricing** | No payments *(gratis; se puede activar propina más adelante)* |
| **Uploads** | El zip que genera `hacer_zip.bat` — marcar **"This file will be played in the browser"** |
| **Embed options** | Manually set size: **960 × 720**, con *Fullscreen button* y *Mobile friendly* activados |
| **Genre** | Simulation |
| **Community** | Comments *(déjalo abierto: es de donde saldrá el feedback)* |
| **Visibility** | Public, cuando lo tengas listo |

### Tags

Se ponen sin almohadilla, separados por comas:

```
incremental, idle, simulation, management, city-builder, water, educational, singleplayer, html5
```

> Ya está traducido: en **Metadata → Languages** marca **English** y
> **Spanish; Castilian** — es donde la gente filtra de verdad. El juego
> elige idioma solo por el navegador, y en la portada está el cambio.

---

## Descripción de la página

Copiar tal cual (itch admite este formato): primero el inglés — itch es un
escaparate anglosajón y el contador ya trajo visitas de EEUU y Países
Bajos —, la versión castellana debajo.

---

**Capture the water, store it high, carry it far and return it clean.**

Thirty-six towns are waiting, scattered across a fog-covered land. You start
with one town, a river nearby and little else: every click on the town is a
pump stroke, and with what you bill you will uncover land, raise intakes and
tanks, and lay pipes by hand, tile by tile, until you reach the next town.
And the next.

It is made by a water supply professional, and it shows in what the game
makes you learn:

🔧 **The narrowest stretch rules.** Renewing half a pipeline is worth nothing.

💧 **The water you cannot see.** More than half the towns are far from a
river. Reaching the groundwater takes three steps nobody skips: the
hydrogeological survey, the borehole — which can come up dry, and that is
where the money goes — and finally the well. And the aquifer runs out if you
squeeze it: two wells on the same body end up yielding the same as one.

🌳 **Some places you do not cross.** Special conservation areas are visible
from the start and are never touched. Routes take enormous detours around
them, as in real life.

♻️ **Not everything recycles.** On the sorting line, letting through what has
no container is the right answer.

🕰️ **A year you can feel.** Low flow in summer, storms that burst the sewer
in autumn, pipes that age and start leaking at forty.

Along the way you are joined by **Manuel**, a veteran of the trade who
teaches you the first steps, comments on your game and tells the odd war
story.

**Two optional minigames** — never mandatory, never a gate: repair a pipe by
turning pieces before the water arrives, and work a shift on the recycling
plant's sorting belt.

**Plays in the browser, phone included.** Saves on its own. Free, no ads.
In English and Spanish — switch on the title screen.

*Made with plain JavaScript: no dependencies, no frameworks, no game engine.
The code is [on GitHub](https://github.com/Gwi1i/pipes-and-life).*

---

🇪🇸 **En castellano:**

**Capta el agua, guárdala en alto, llévala lejos y devuélvela limpia.**

Treinta y seis pueblos esperan repartidos por un territorio cubierto de niebla.
Empiezas con uno, un río cerca y poco más: cada clic sobre el pueblo es una
bombada, y con lo que factures irás destapando terreno, levantando captaciones
y depósitos, y tendiendo tuberías a mano, casilla a casilla, hasta alcanzar el
siguiente pueblo. Y el siguiente.

Lo hace un profesional del abastecimiento de agua, y se nota en lo que el juego
te obliga a aprender:

🔧 **Manda el tramo más estrecho.** Renovar media conducción no sirve de nada.

💧 **El agua que no se ve.** Más de la mitad de los pueblos están lejos de un
río. Para llegar al subsuelo hay tres pasos que no se saltan: estudio
hidrogeológico, sondeo —que puede salir seco, y ahí es donde se pierde el
dinero— y por fin el pozo. Y el acuífero se agota si lo exprimes: dos pozos en
la misma masa acaban dando lo mismo que uno.

🌳 **Hay sitios por donde no se pasa.** Las zonas de especial conservación se
ven desde el principio y no se tocan nunca. Los trazados dan rodeos enormes
para esquivarlas, como en la vida real.

♻️ **No todo se recicla.** En la línea de reciclaje, dejar pasar lo que no
tiene contenedor es la respuesta correcta.

🕰️ **Un año que se nota.** Estiaje en verano, tormentas que revientan el
colector en otoño, tuberías que envejecen y empiezan a fugar a los cuarenta
años.

Por el camino te acompaña **Manuel**, un guía veterano que te enseña los
primeros pasos, comenta tu partida y suelta alguna batallita. Si quieres, te lo
cuenta en voz alta.

**Dos minijuegos opcionales** — nunca obligatorios, nunca puerta de progreso:
reparar una tubería girando piezas antes de que llegue el agua, y echar un
turno en la cinta de la planta de reciclaje.

**Se juega en el navegador, también en el móvil.** Se guarda solo. Gratis y sin
anuncios. En castellano y en inglés — el cambio está en la portada.

*Hecho con JavaScript a pelo: sin dependencias, sin frameworks y sin motor de
juego. El código está [en GitHub](https://github.com/Gwi1i/pipes-and-life).*

---

## Capturas

Están en `docs/capturas/`. Se suben en este orden (la primera es la portada
de la ficha, la que se ve en los listados):

1. `assets/h_portada.jpg` — el cartel
2. `docs/capturas/mapa.jpg` — el mapa de exploración
3. `docs/capturas/tuberias.jpg` — el minijuego de reparación
4. `docs/capturas/reciclaje.jpg` — la línea de reciclaje

> **Cover image** (la miniatura del listado, 630×500): itch la pide aparte.
> Vale el cartel recortado a esa proporción.

---

## Después de publicar

- **Devlog**: cada vez que subas algo gordo, una entrada corta. Es lo que hace
  que la gente vuelva a la página, y itch los reparte en su portada.
- **Actualizar el juego**: se vuelve a generar el zip y se sube encima. Ojo,
  eso NO actualiza la web de GitHub Pages ni al revés: son dos sitios.
- **Los comentarios son el oro.** Ahí es donde sale el feedback que no tienes.
