# Dónde está cada cosa

> ⚠️ **Este archivo es PÚBLICO** (está en el repositorio). Aquí van direcciones,
> nunca contraseñas ni claves. Si algún día necesitas guardar una contraseña,
> usa un gestor de contraseñas, jamás un archivo de texto.

---

## Los cuatro sitios

| Qué | Dirección | Para qué entras |
|---|---|---|
| **El juego** | https://gwi1i.github.io/pipes-and-life/ | Es EL enlace. El que se reparte. |
| **El repositorio** | https://github.com/Gwi1i/pipes-and-life | El código. Se actualiza solo al hacer `git push`. |
| **La ficha de itch.io** | https://gwiii.itch.io/pipes-and-life | La otra tienda. Se actualiza **a mano**, subiendo el zip. |
| **El contador** | https://gwi.goatcounter.com | Cuánta gente entra y **cuánta vuelve**. |

Cuenta de GitHub: **Gwi1i** · Código del contador: **gwi**

---

## Las dos formas de publicar, que NO son la misma

Esto es lo que más se olvida:

- **La web** (GitHub Pages) se actualiza **sola** con cada `git push`. Tarda uno
  o dos minutos.
- **itch.io** se actualiza **a mano**: doble clic en `hacer_zip.bat`, y subes el
  zip nuevo encima del viejo en tu panel de itch.

Si arreglas algo, la web lo tiene enseguida y itch **se queda con la versión
vieja** hasta que subas el zip. Es el despiste clásico.

---

## Comandos del día a día

Jugar en local (doble clic en `jugar.bat`), o por consola:

```bash
py servidor.py
```

Publicar en la web los cambios ya guardados:

```bash
git push
```

Generar el paquete para itch.io (lo deja en el escritorio):

```bash
hacer_zip.bat
```

Medir el equilibrio de la partida sin jugarla — desde la consola del navegador:

```javascript
(await import('/medir_partida.mjs')).medir(0.25, 120)
```

---

## Qué mirar en el contador

Entra en https://gwi.goatcounter.com y busca estas etiquetas:

- **`/visita`** frente a **`/empieza`** — cuántos entran y cuántos pasan de la
  portada. Mucha diferencia significa que la portada no convence.
- **`/vuelve/dia-1`, `/vuelve/dia-7`** — **la métrica que importa.** Es la
  respuesta a "¿gusta?". Tarda por definición: los de día 7 llegan a la semana.
- **`/hito/...`** — hasta dónde llega la gente. Si nadie pasa del primer hito,
  el arranque es demasiado lento.
- **`/minijuego/...`** — si los descubren siquiera.

Se apaga poniendo `codigo: null` en `CONFIG.analitica` (`src/config.js`).

---

## Los prompts de las ilustraciones

Todos, con sus trucos, en [`assets/PROMPTS.md`](../assets/PROMPTS.md).
Después de generar algo nuevo: doble clic en `assets/optimizar.bat`.

Y si el generador se empeña en pintar fondo detrás de una hoja de sprites:

```bash
py assets/recortar_hojas.py
```
