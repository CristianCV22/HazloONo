# Hazlo o No

Herramienta digital para **detenerse y reflexionar** antes de tomar decisiones.
Guía al usuario por tres estados — **No Hacerlo** (🔵), **Reflexión** (⚪) y
**Hacerlo** (🟠) — representados por la posición de la aguja del logotipo.
Sin juicios ni persuasión: la interfaz es un espejo del proceso de decisión.

## 📂 Estructura

```
HazloONo/
├── index.html         # Estructura semántica: 5 pasos del flujo + cierre
├── styles/            # CSS organizado por componente
│   ├── variables.css      # Tokens: @property, paleta de marca, texto (:root)
│   ├── base.css           # Reset, layout, tipografía y responsive
│   ├── components/
│   │   ├── header.css       # Cabecera, menú, indicador de progreso, pie, diálogo
│   │   ├── logo.css         # Aguja del logotipo y ambiente
│   │   ├── form.css         # Secciones, formulario, umbral, respiración, emociones
│   │   └── buttons.css      # Botones de acción
│   └── states.css         # Modificadores de estado (variables contextuales) y accesibilidad
├── scripts/           # JS en módulos ES (type="module")
│   ├── main.js          # raíz: importa, inicializa y arranca
│   ├── datos.js         # estado y referencias al DOM (no importa nada)
│   ├── almacen.js       # almacenamiento local y preferencia de animaciones
│   ├── state.js         # navegación, borrador e historial
│   └── components/
│       ├── logo.js          # aguja y ambiente (actualizarLogo / actualizarAmbiente)
│       ├── umbral.js        # umbral de la bienvenida y respiración guiada
│       ├── form.js          # validación, cierre, etiquetado emocional (initForm)
│       └── modal.js         # diálogos Ayuda e Historial (initModal)
├── assets/
│   └── images/          # fondo.jpg, favicon.svg
├── tests/             # Pruebas (Node.js)
│   └── flujo.test.js    # Prueba funcional del flujo completo
├── pruebas/           # Verificación en navegador real (CDP)
│   ├── navegador.js       # rutas portables (navegador, puertos, perfiles)
│   ├── sonda-cdp.js       # coreografía de apertura, muestreo de estilos
│   ├── verificar-*.js     # anulación de movimiento, borrador, grafo de módulos
│   └── probe-*.js         # sondas puntuales (fondo, trazo, foco, emoción…)
├── package.json
├── eslint.config.js   # ESLint (formato plano) — opcional, vía npx
├── stylelint.config.js # Stylelint (formato plano) — opcional, vía npx
├── .gitignore
└── README.md
```

> **Arquitectura**: módulos ES nativos (`<script type="module">`),
> sin framework y sin bundler. `main.js` es la raíz: importa los
> módulos, inicializa los componentes (`initForm()`, `initModal()` —
> cada uno registra sus propios eventos dentro de su ámbito) y
> arranca la app en `DOMContentLoaded`.
>
> El grafo de módulos es **acíclico** (lo comprueba
> `npm run test:grafo`): las dependencias van siempre hacia abajo,
> así que el orden de evaluación de los módulos nunca importa.
>
> ```
> datos.js ─┬─► components/logo.js ──┐
>           │                        │
>           ├─► components/umbral.js ─┤
>           │                        ▼
>           └───────────────────► state.js ─► components/form.js ─┐
> almacen.js ────────────────────────┘       components/modal.js ┴─► main.js
> ```
>
> - `datos.js` y `almacen.js` son **hojas**: no importan nada. El
>   estado central (`respuestas`, `pasoActual`) y las referencias al
>   DOM viven en `datos.js`; el acceso al almacenamiento y la
>   preferencia de animaciones, en `almacen.js`.
> - `state.js` coordina: navegación, borrador e historial.
> - Los componentes son **vistas y eventos**: no dependen de
>   `state.js` en la otra dirección, así que no hay ciclos.
> - `main.js` es el único que conoce a todos: ahí se cablea lo que
>   cruza capas (por ejemplo, la vista del resumen del cierre al
>   restaurar un borrador).

## 🧩 Arquitectura JavaScript

- **Módulos ES**: cada archivo es un módulo (`import`/`export`);
  el navegador resuelve el grafo. Sin ámbito global compartido:
  las dependencias son explícitas (lo que antes eran "globales
  invisibles" entre scripts clásicos).
- **Estado central** (`datos.js`): `respuestas`, `pasoActual`,
  `transicionando`, `secciones`… Es una hoja del grafo: cualquier
  módulo lo consulta sin crear ciclos. El estado mutable se
  cambia con funciones explícitas (`fijarPasoActual`,
  `fijarTransicionando`): un módulo no puede reasignar el `let`
  de otro.
- **Coordinación** (`state.js`): la navegación (`mostrarPaso`,
  `transicionarA`), el borrador y el historial.
- **Componentes vanilla**: `form.js` y `modal.js` exponen
  `initForm()` / `initModal()` — reciben su ámbito del DOM y
  registran los listeners dentro de él. Ningún listener queda
  activo hasta que `main.js` inicializa el componente.
- **Vistas sin lógica** (`logo.js`): solo responde al estado
  (`actualizarLogo`, `actualizarAmbiente`); no registra eventos.
- **Componentes con estado propio** (`umbral.js`): su visibilidad
  y la guía de respiración viven aquí, no en el estado global.
- **Persistencia** (en `localStorage`, sin cifrar — solo del
  usuario, nunca sale del navegador):
  - `hazlono-borrador` — reflexión en curso (paso + respuestas +
    identificador de la reflexión, guardada 300 ms después de la
    última tecla y al cerrar).
  - `hazlono-historial` — reflexiones terminadas (máx. 50).
  - `hazlono-animacion` — preferencia de animaciones.
  - `hazlono-prueba` — clave temporal para comprobar que el
    almacenamiento funciona (se borra al instante).
- **Privacidad**: siempre hay forma de borrar todo — «Reiniciar»
  (borra el borrador) y «Borrar historial» (doble pulsación).
  Si el almacenamiento está denegado, la app funciona igual
  (degradación elegante, T8).
- **Degradación si falla el módulo** (p. ej. abierto desde
  `file://`, donde los módulos se bloquean por CORS): la
  red de seguridad de `index.html` retira la marca `.js`
  y la página vuelve al layout sin JavaScript (contenido
  completo y legible); la aguja partida es CSS puro.

## 🚀 Probar

**Servir la carpeta por HTTP** (los scripts son
módulos ES, que el navegador solo carga por
HTTP — abrir el archivo directamente con
doble clic (`file://`) los bloquea por CORS):

```bash
python -m http.server 8000
# → http://localhost:8000
```

> **Abrir desde `file://`**: la página degrada
> al layout sin JavaScript de forma automática
> (la red de seguridad de `index.html` retira
> la marca `.js`): contenido completo, legible
> y con scroll; la aguja partida (azul/naranja)
> se ve igual por CSS. Lo que no funciona es la
> interactividad — para la app completa, servir
> la carpeta.

Ejecutar las pruebas funcionales (sin dependencias):

```bash
node tests/flujo.test.js   # o: npm test
```

Comprobar que el grafo de importaciones de los módulos
es completo y consistente:

```bash
node pruebas/verificar-grafica.js   # o: npm run test:grafo
```

Linter opcional (se usa `npx`: no instala nada en el
proyecto, sólo lo descarga en la caché de npm):

```bash
npm run lint        # ESLint (formato plano)
npm run lint:css    # Stylelint (formato plano)
```

Verificación visual real con el navegador (Edge/Chrome
headless + CDP): las sondas `pruebas/sonda-cdp.js`
(opciones: `default` | `no-preference` | `reduce`),
`pruebas/verificar-anulacion.js` y
`pruebas/verificar-borrador.js` muestrean estilos
computados en tiempo real y reportan el estado de la
coreografía, las transiciones, la aguja y la
persistencia.

Las sondas son **portables**: el navegador, el puerto, la
URL y la carpeta de perfiles se resuelven en
`pruebas/navegador.js` y se pueden fijar con las
variables de entorno `NAVEGADOR`, `PUERTO_SERVIDOR`,
`URL_PAGINA` y `CARPETA_PERFILES`.

## 🔄 Flujo de la reflexión (5 pasos)

1. **Bienvenida** — "Antes de decidir, detente un momento." Al pulsar «Comienza la reflexión» aparece **el umbral**: un segundo tiempo que convierte el clic en pausa consciente — «Esto no es un sprint: tómate el tiempo que necesites», con un anillo que respira. Solo al pulsar «Comenzar cuando quieras» empieza la reflexión (o «← Volver» para retroceder). **«Respirar conmigo»** lanza una guía 4-4-4 de 3 ciclos (inhala, sostén, exhala) con cuenta atrás y «Saltar» para salir.
2. **Decisión** — ¿Qué decisión tienes que tomar?
3. **Consecuencias** — ¿Qué pasa si lo haces? / ¿Qué pasa si no lo haces?
4. **Reflexión** — Lo importante para ti + resumen en vivo de la decisión
5. **Elección** — Elección final (radios) + motivo → cierre con resumen

## 🔁 Modificar la opción

El cierre ofrece **"← Modificar mi elección"**:
vuelve al paso de elección con todas tus
respuestas intactas, cambias la opción (la
aguja y el ambiente reaccionan al instante)
y terminas de nuevo. Decidir es también
reconsiderar — sin juicio.

La reflexión conserva su **identidad**: al
volver a terminar, la entrada del historial se
**actualiza** en lugar de duplicarse. El
historial refleja siempre tu última decisión.

## 🎯 Anatomía del logotipo (SVG)

El logo es una **rueda de decisión** construida como
un sistema, no como un dibujo:

- **`<defs>` + `<use>`**: el arco se define *una* vez
  y se reutiliza dos veces (el naranja es el espejo
  del azul). Cambiar el arco cambia ambos lados.
- **La aguja es el dilema**: en reflexión está
  *dividida* (mitad azul, mitad naranja — las dos
  posibilidades, vivas e iguales, sin sesgo). Al
  decidir se viste del color elegido y su cola se
  desvanece, como un cometa.
- **Degradados de 3 paradas** (profundo → principal
  → vivo) en los arcos (el trazo se define en
  CSS, no en atributos); brillo radial en el centro.
- **Onda de decisión**: pulso único que expande desde
  la rueda al elegir (se reactiva al cambiar de
  opción); la mitad elegida de la rueda brilla
  (glow) y la aguja se asienta con overshoot
  elástico.
- **Escala de grosores**: 28 (anillo) · 12 (ejes) ·
  8 (marcadores) · 6 (aguja) · 5 (onda) · 4 (centro).
- **La aguja es el indicador de progreso**: barre
  de izquierda a derecha según el paso
  (`.paso-0`…`.paso-4`), perfectamente centrada en
  "Consecuencias" — el momento de equilibrio entre
  las dos caras. Oscila ±1.5° alrededor de su
  posición: la rueda está viva mientras piensas.
- **`<title>` + `<desc>`**: documentación del diseño
  (el SVG es `aria-hidden`; si se reutiliza sin él,
  ya es accesible).
- **Accesibilidad del SVG**: decorativo
  (`aria-hidden="true"`, `focusable="false"`);
  el `<h1>` «Hazlo o No» es el texto
  alternativo del enlace. Clase semántica
  por pieza (`.marca-superior`, `.eje-izquierdo`…)
  para estilizado y animación futura.
- **Favicon**: copia fiel de la misma geometría
  y colores (archivo separado, con `role="img"`
  y `<title>`/`<desc>` propios).

## 🎨 Estados: todo por variables

La clave de la extensibilidad: **toda la coloración
vive en CSS** y responde a variables de `<body>`.
JS solo pone clases (`estado-hacerlo` /
`estado-no-hacerlo`); las piezas del logo leen
`--aguja-acento` y `--aguja-centro`. Agregar
piezas nuevas al logo = se adaptan solas, sin
tocar una sola regla más.

La aguja gira según el estado (CSS puro, 0.6 s ease):

| Clase en `.logo` | Aguja | Cuándo |
|------------------|-------|--------|
| `.reflexion` + `.paso-N` | Dividida, barre -30° → +30° | Cada paso de la reflexión |
| `.hacerlo`       | Derecha, naranja, cola desvanecida (🟠) | El usuario elige "Hacerlo" |
| `.no-hacerlo`    | Izquierda, azul, cola desvanecida (🔵) | El usuario elige "No hacerlo" |

## 🖥️ Pantalla fija (sin scroll)

Con JavaScript, la app ocupa **una sola pantalla** (`100dvh`, sin scroll):

- Las secciones se **superponen**; solo la que tiene la
  clase `.activa` es visible.
- Avanzar/retroceder mueve las pantallas en **dirección**
  (adelante → derecha, atrás → izquierda).
- Los campos de texto crecen para llenar el espacio libre.
- **La marca vive según la visual**: en la
  bienvenida el logo es el protagonista
  (grande, centrado — todo el escenario,
  menú en la esquina); en los pasos pasa
  a segundo plano (compacto y centrado)
  con transición suave de 0.6 s.
- Si el contenido no cabe (pantalla muy corta), la sección
  hace scroll interno sin recortar: el contenido nunca se
  encoge por debajo de su tamaño (truco de flexbox con
  pseudo-elementos).
- **Sin JavaScript**: la página fluye normal con scroll
  (degradado elegante — el inline `<script>` de `<head>`
  marca `document.documentElement` con `.js`). La marca,
  el menú y el pie aparecen **de inmediato**: la coreografía
  de apertura es un enhancements, no un requisito. Un aviso
  (`<noscript>`) explica que sin JS se puede leer y escribir,
  pero no avanzar de paso ni guardar.

## 🎛️ Menú principal y pie de página

- **Menú** (cabecera): *Ayuda* abre un `<dialog>` nativo
  (foco atrapado, se cierra con Esc) — explica el flujo,
  el lenguaje de la aguja y la **preferencia de
  animaciones**; *Historial* lista tus reflexiones
  pasadas (ver «El historial»); *Reiniciar* vuelve al
  inicio.
- **Pie**: muestra dónde estás («Paso 2 de 5 · Consecuencias»)
  y un **consejo que rota** cada 9 s con fade suave.

## 🌊 Ambiente vivo

- El **fondo** entra con fade + zoom muy suave (4 s) y
  luego *deriva* lentamente (22 s): manchas azul/naranja
  que respiran.
- Al elegir, la pantalla se **tiñe** sutilmente — y el
  **color se funde** (0.9 s, gracias a `@property`):
  azul para «No hacerlo», naranja para «Hacerlo».
  La aguja y su centro también funden su color.
- El **indicador de progreso** pulsa suavemente en el paso
  activo; la **aguja** oscila ±1.5° y barre según el paso.
- Cada paso que entra muestra su contenido con entrada
  escalonada, y los botones dan un pulso de atención.
- **Nada aparece de la nada**: menú, pie, mensajes de
  error y el velo del diálogo entran en fade.
- **Viñeta cinematográfica** (6 % en las esquinas) que
  enmarca la escena sin tocar el contenido.
- **Vista previa con la aguja**: en la elección, al pasar
  el puntero sobre una opción, la aguja se inclina hacia
  ella (±12°) — considerar no es comprometerse; el color
  y el asentamiento (±45°) llegan al hacer clic.

## 🎬 Bienvenida: coreografía "La Pausa"

La primera pantalla encarna la filosofía del producto — calma, sin prisas.
**Nada aparece de la nada**: cada elemento entra suavemente, en su momento
(apertura total ≈ 5.6 s):

1. **Fondo**: fade + zoom muy suave (4 s, escala 1.04 → 1)
2. **La rueda se dibuja**: arcos en cascada (azul a 0.3 s → naranja a 0.6 s, 1.8 s de trazo)
3. **Pieza por pieza** (fade de 0.8 s): marcadores (1 s), ejes (1.3 s), anillo interior (1.9 s), centro (2.2 s)
4. **La marca completa**: nombre (2.5 s), menú en la esquina (2.8 s), pie de página (3 s)
5. **La aguja viaja**: aparece en fade *dentro* del viaje y explora «no hacerlo» (−45°) y «hacerlo» (+45°) antes de asentarse — la pregunta que abre la película (2.8 s, desde 2.8 s; se repite al volver a la bienvenida)
6. **El contenido**: espera a la escena (retardo 2.4 s) y entra escalonado (pasos de 0.12 s)
7. **Botón**: entra en su posición natural de lectura y da un único pulso de atención

En los pasos siguientes, las entradas son rápidas y sobrias (la calma ya
se estableció). Todo con `opacity` / `transform` / `stroke-dashoffset` /
`filter` — propiedades que el navegador puede interpolar en la GPU
— y se desactiva por completo con
`prefers-reduced-motion` (salvo que el usuario elija
«Activar» — ver «Animaciones: tu preferencia»).

> Excepción conocida: la deriva del ambiente (las manchas de
> color del fondo) anima `background-position`, que **sí**
> repinta. Es deliberado —un degradado que se desliza no se
> puede mover con `transform` sin capas extra— y afecta a una
> sola capa de fondo.

## 🎞️ Animaciones: tu preferencia

La experiencia sigue al sistema por defecto
(accesibilidad). Pero **tú mandas**: en
**Ayuda → Animaciones** eliges:

- **Seguir el sistema** (por defecto)
- **Activar**: la coreografía completa, aunque
  el sistema tenga las animaciones reducidas
  (la clase `.fuerza-animacion` en `<html>`
  anula el medio de CSS)
- **Desactivar**: todo instantáneo

La preferencia se guarda en `localStorage`.
Si tu sistema tiene las animaciones reducidas,
verás una nota explicándolo. Recarga la página
para ver la apertura completa tras cambiarla.

## 🚪 Avanzar entre pasos

Cambio de pantalla direccional (0.45 s, 4 rem):
la sección actual **sale** por un lado y la
siguiente **entra** por el otro (adelante →
izquierda/derecha; atrás → al revés). Entre
escena y escena hay un **respiro** (0.4 s, 1.2.1):
la pantalla queda en calma — solo fondo y
aguja — antes de que el contenido del nuevo
paso empiece a entrar. La aguja gira a su
nueva posición de forma suave (0.6 s) y
**nunca desaparece** durante el cambio.

## 💾 Persistencia local

Tu reflexión **no se pierde** al cerrar la pestaña:

- **Guardado automático**: mientras escribes, cada pausa
  guarda el borrador (`localStorage`, debounce de 300 ms).
  También al elegir, al avanzar y, como red de seguridad,
  al cerrar la pestaña.
- **Red de seguridad en móvil**: además de `beforeunload`
  (que iOS Safari ignora a menudo), el borrador se guarda
  con `pagehide` y al pasar la pestaña a segundo plano
  (`visibilitychange`): los últimos textos no se pierden.
- **Retorno**: al volver, recuperas el mismo paso, con los
  campos rellenos y la aguja en posición. En el cierre, el
  resumen se rehace con tus respuestas.
- **«Reiniciar»** borra el borrador: empiezas de cero, sin
  rastros de la reflexión anterior.
- **Al terminar**, la reflexión pasa al historial (ver más
  abajo) y el borrador se borra: ya no está «en curso».

Todo es **local**: nunca sale de tu equipo.

## 📖 El historial

El menú **«Historial»** abre un diálogo con tus reflexiones
terminadas, **la más reciente primero**:

> «Aprender a nadar» — HACERLO. Motivo: Para vencer mi
> miedo (12 de octubre de 2026)

- Muestra la decisión, la elección, el motivo y la fecha.
- Una reflexión es **una entrada**: si vuelves al cierre para
  modificar tu elección, la entrada se actualiza (no se
  duplica).
- **«Borrar historial»** lo vacía: pide **doble pulsación**
  (sin `confirm()`) y se deshace solo en 4 s.
- Con el historial vacío, un mensaje amable explica qué pasa.
- Tope de 50 entradas: las más antiguas se descartan.

## 🛟 Degradación elegante

Si el almacenamiento está **lleno o denegado**, la app sigue
funcionando — solo se pierde la persistencia. Al abrir
**Ayuda**, un aviso discreto (`role="status"`) te explica
que la reflexión no se guardará. La comprobación se hace
en cada apertura: también cubre que se llene a mitad de
sesión.

## ⚖️ Momento de la decisión (coreografía)

Al elegir, todo ocurre en cascada suave:
la aguja se asienta con **overshoot elástico**
(0.7 s) → la cola se desvanece (0.6 s) → la
**onda** expande desde la rueda (1.1 s) → la
mitad elegida de la rueda **brilla** (glow,
0.6 s) → el **marcador** de tu dirección da
un pulso firme con rebote (0.9 s).

Todo con `opacity` / `transform` / `stroke-dashoffset` / `filter`
— propiedades interpoladas por la GPU — y se desactiva por completo
con `prefers-reduced-motion`.

## ♿ Accesibilidad

- HTML5 semántico: `header`, `main`, `nav`, `section`, `fieldset`, `legend`, `label`
- `aria-current="step"` en el indicador de progreso (los 5
  pasos del flujo; el cierre es un resumen, no un paso más)
- `aria-live` para el resumen y `role="alert"` para errores de validación;
  `role="status"` para los avisos del historial y del almacenamiento
- Los errores de validación **nombran el campo** que falta
  («Falta completar «Consecuencias de hacerlo».»), lo marcan con
  `aria-invalid` y lo asocian a su aviso con `aria-describedby`
- El foco se mueve al título de cada paso (lectores de pantalla).
  Se aplaza al fotograma en que la sección ya es visible: con
  `prefers-reduced-motion` el foco también llega.
- Contraste WCAG AA (texto principal ~13:1,
  secundario ~7:1); el logo es marca
  (logotipo, exento de 1.4.11) y sus dos
  caras se distinguen 3.4:1 entre sí;
  foco visible, `prefers-reduced-motion`
  respetado (con opción del usuario para anularlo:
  accesibilidad con agencia)
- Sin `confirm()` ni `alert()`: las confirmaciones son
  doble pulsación en botones nativos (accesibles por teclado)
- **Clic consciente**: el avance solo ocurre desde botones
  explícitos — el fondo, el texto o cualquier otra zona no
  hacen nada; no hay envío implícito de formulario y los
  dobles clics se ignoran durante las transiciones
- Sin JavaScript: todas las secciones se muestran en
  flujo normal con scroll (contenido completo legible)

## 🧱 Principios técnicos

- **HTML-first / progressive enhancement**: el contenido funciona sin JS
- **CSS modular** (`styles/`): tokens en
  `variables.css`, componentes en
  `components/`, modificadores de estado en
  `states.css`; variables `--logo-*` (paleta
  del Documento Maestro) y de estado
  (`--aguja-acento`, `--aguja-centro`)
- **Clases mínimas en el layout**: el CSS aprovecha la
  semántica (selectores de elemento, atributo y `:has()`);
  las clases que existen son los estados del logo,
  `.activa`, `.texto-apoyo` y las piezas del SVG
  (necesarias como ganchos de estilo)
- **JS mínimo, sin dependencias externas**: módulos ES
  nativos (sin framework ni bundler); solo cambia clases
  y el atributo `hidden`
- **Accesibilidad con agencia**: la preferencia de
  animaciones (seguir/activar/desactivar) se guarda en
  `localStorage` y anula al sistema mediante clases en
  `<html>` (`.fuerza-animacion` / `.fuerza-reduccion`)
- **Pulido de producto**: favicon.svg (el logo en la pestaña), `theme-color`,
  grano de película estático sobre el fondo (4 %, carácter cinematográfico),
  selección de texto de marca, `overscroll-behavior: none` (sin tirada en
  móvil), sin destello al tocar y foco visible también en el enlace del logo
- **Transiciones de color**: las variables de color se registran con
  `@property` y se funden (0.9 s) al elegir; sin soporte, el cambio es
  instantáneo (degradado elegante)

## 🗺️ Hoja de ruta en curso: persistencia local

Mejora activa: la reflexión ya no se pierde
al cerrar la pestaña. Pilares: **(1) Guardado**
· **(2) Retorno** · **(3) Historial** ·
**(4) Privacidad y control)**.

- [x] **T1** — Esquema de datos: una clave
  `hazlono-borrador` con `{version, paso,
  respuestas, guardado}` + funciones
  `guardarBorrador` / `leerBorrador` /
  `borrarBorrador` (sanitiza y falla en
  silencio). Probado (21 aserciones).
- [x] **T2** — Guardado automático mientras
  se escribe (debounce 300 ms, al elegir y
  al avanzar; red de seguridad al cerrar
  la pestaña). Probado (7 aserciones).
- [x] **T3** — Restaurar el borrador al
  cargar (paso, campos, radio, aguja y
  ambiente; rehace el resumen del cierre).
  Probado (16 aserciones).
- [x] **T4** — «Reiniciar» borra el
  borrador (cancelando antes el guardado
  pendiente del debounce, para que no
  resucite el estado vacío). Probado
  (5 aserciones).
- [x] **T5** — Al terminar, archivar en
  historial (`hazlono-historial`:
  decisión, elección, motivo y fecha;
  tope de 50 entradas; el borrador se
  borra y no resucita). Probado
  (15 aserciones).
- [x] **T6** — Ver el historial
  (diálogo nativo «Historial» en el
  menú: lista la más reciente primero,
  con estado vacío). Probado
  (12 aserciones).
- [x] **T7** — Borrar historial
  (doble pulsación, sin confirm();
  aviso con role="status"; se
  deshace solo en 4 s). Probado
  (13 aserciones).
- [x] **T8** — Degradado elegante
  (comprobación de capacidad al
  abrir Ayuda: aviso si el
  almacenamiento está denegado
  o lleno). Probado (5 aserciones).
- [x] **T9** — Prueba de punta a
  punta: la historia completa del
  usuario en una secuencia limpia
  (E1–E8, 20 aserciones).
- [x] **T10** — README + accesibilidad
  final: guía de persistencia,
  historial y degradación;
  auditoría de aria-live y cierre
  del documento.

## 🩺 Auditoría de lectura y correcciones (T11)

Una revisión completa del proyecto (HTML, CSS, JS y
pruebas) detectó y corrigió los siguientes puntos, cada
uno con su prueba de regresión o con verificación en
navegador real.

**Corrección (defectos comprobados)**

- [x] **Pruebas portables**: la ruta del proyecto se
  calcula desde el propio archivo (`__dirname`), así que
  `npm test` funciona en cualquier sistema (antes
  dependía de una ruta absoluta de Windows).
- [x] **Foco al cambiar de paso**: el foco se aplaza al
  fotograma en que la sección ya es visible. Antes, con
  `prefers-reduced-motion` (o «Desactivar») el foco se
  perdía en `<body>` y el lector de pantalla no
  anunciaba el paso nuevo.
- [x] **Sin solapamientos en pantallas bajas**: el
  contenido de un paso ya no se encoge por debajo de su
  tamaño; si no cabe, la sección hace scroll interno
  (antes los textos se montaban unos sobre otros).
- [x] **«Reiniciar» limpia todo**: también el estado
  emocional (botones sin marcar y sin tinte).
- [x] **El historial no se duplica**: una reflexión es
  una entrada; si vuelves a modificarla, se actualiza.
- [x] **Cierre de pestaña en móvil**: el borrador se
  guarda también con `pagehide` y `visibilitychange`.
- [x] **Fechas corruptas**: el historial descarta las
  fechas inválidas (no aparece «Invalid Date»).

**Accesibilidad y contenido**

- [x] **La marca no tarda 3 s en aparecer**: la
  coreografía de apertura va solo con JavaScript. Sin
  él (o si el módulo no carga) la marca, el menú y el
  pie se ven desde el primer pintado.
- [x] **Aviso sin JavaScript**: un `<noscript>` explica
  qué se puede y qué no se puede hacer.
- [x] **Errores que nombran el campo**: «Falta completar
  «Consecuencias de hacerlo».», con `aria-invalid` y
  `aria-describedby` en el campo.
- [x] **Indicador de progreso coherente**: los 5 pasos
  del flujo (el cierre es un resumen, no un paso más).
- [x] **Preferencia de animaciones antes de pintar**:
  se aplica en el `<head>`, no al final de la carga.

**Herramientas y limpieza**

- [x] **Sondas portables**: `pruebas/navegador.js`
  resuelve el navegador, el puerto, la URL y el perfil
  (variables de entorno opcionales). Sin rutas absolutas.
- [x] **Linter utilizable**: ESLint y Stylelint en
  formato plano y autocontenido (`npm run lint`,
  `npm run lint:css`; se ejecutan con `npx`, sin
  dependencias en el proyecto).
- [x] **Fichero huérfano eliminado**: `assets/fonts`
  (copia de `favicon.svg`, sin usar en todo el
  historial).
- [x] **Documentación al día**: README, comentarios y
  configuración de lint corregidos.

Verificado con la suite funcional, el verificador del
grafo de módulos, los dos linters y con capturas en
navegador real (Firefox headless, con y sin movimiento
reducido, y en el modo sin JavaScript).

## 🧱 Grafo de módulos acíclico (T12)

Antes, `state.js`, `utils.js` y `form.js` se importaban
**entre sí** (tres ciclos). Funcionaba —los ciclos entre
módulos ES sólo fallan si el orden de evaluación cambia—,
 pero era una fragilidad latente: cualquier edición podía
romper el arranque sin que nada lo indicara.

Ahora el grafo es un **árbol** y `npm run test:grafo` lo
comprueba (incluida la detección de ciclos):

- `datos.js` — estado y referencias al DOM (hoja).
- `almacen.js` — almacenamiento local y preferencias (hoja).
- `components/logo.js`, `components/umbral.js` — vistas.
- `state.js` — navegación, borrador e historial.
- `components/form.js`, `components/modal.js` — eventos.
- `main.js` — raíz: cablea las piezas.

`utils.js` desaparece: su parte de almacenamiento pasa a
`almacen.js` y la del borrador, a `state.js`.

Además, la deriva del fondo (las manchas de color) se midió
en vez de suponer: animar `background-position` **no** cuesta
más que no animar nada (0 fotogramas perdidos, mismo coste
de hilo principal que el control), así que se mantiene tal
cual —cambiarlo exigiría añadir un elemento al HTML para
un beneficio que no se mide.
