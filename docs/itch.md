# Material para la página de itch.io

Todo listo para copiar y pegar. Los campos van en el orden en que itch los
pide al crear el proyecto (**Dashboard → Create new project**).

---

## Ajustes de la página

| Campo | Qué poner |
|---|---|
| **Title** | `Pipes and Life` |
| **Short description / tagline** | `Abastece a tu mancomunidad, pueblo a pueblo. Un juego sobre el agua hecho por alguien del oficio.` |
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
incremental, idle, simulation, management, city-builder, water, educational, spanish, singleplayer, html5
```

> Si algún día lo traduces al inglés, quita `spanish` y añade el idioma en
> **Metadata → Languages**, que es donde la gente filtra de verdad.

---

## Descripción de la página

Copiar tal cual (itch admite este formato):

---

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

---

**Se juega en el navegador, también en el móvil.** Se guarda solo. Gratis y sin
anuncios.

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
