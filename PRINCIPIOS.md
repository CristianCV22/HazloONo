# Principios

Las reglas del proyecto. El código las cita (en los comentarios, «regla del
Documento Maestro») y este fichero las hace públicas: quien lea el código
debe poder encontrar aquí **por qué** está escrito como está.

Cuando una decisión no encaje en estas reglas, o hay que romper una,
se cambia este documento y se explica por qué en el `CHANGELOG.md`.

---

## 1. HTML primero

**El HTML es el producto.** JavaScript y CSS lo mejoran; no lo sostienen.

- El contenido completo (las 6 secciones del flujo) está en el marcado y
  se lee sin JavaScript.
- Cada elemento es semántico: `header`, `main`, `nav`, `section`,
  `fieldset`, `legend`, `label`, `dialog`.
- No hay `div` donde quepa una etiqueta con significado.
- Las clases se usan lo justo: estados del logo, `.activa`, `.texto-apoyo`
  y las piezas del SVG (que hacen falta como ganchos de estilo). El resto
  se resuelve con selectores de elemento, atributo, `:has()` y `:where()`.

## 2. Degradación elegante

**Cada capacidad tiene su versión sin ella.** El usuario nunca se queda
en una pantalla rota.

| Si falla… | La app… |
|---|---|
| JavaScript | fluye con scroll, se lee y se escribe; un aviso lo explica |
| El módulo ES (por ejemplo, abierto como `file://`) | vuelve al layout sin JavaScript (red de seguridad en `index.html`) |
| `localStorage` (denegado o lleno) | sigue funcionando; solo se pierde la persistencia, y se avisa en «Ayuda» |
| `prefers-reduced-motion` | toda la coreografía se desactiva (o el usuario la anula) |
| `@property` | el cambio de color es instantáneo en vez de fundido |
| El navegador | el SVG del logo es la rueda completa, sin JS |

## 3. Pocas dependencias

**Cero dependencias de ejecución.** Ni framework, ni bundler, ni
bibliotecas: el navegador ya trae lo necesario (módulos ES, `<dialog>`,
`:has()`, `@property`).

- `package.json` no tiene `dependencies` (ni `devDependencies`): las
  herramientas de verificación se usan bajo demanda con `npx`.
- Todo el JavaScript son módulos ES nativos, cargados por el navegador.
- El CSS es CSS: variables, `@property` y módulos por componente.

## 4. Un grafo de módulos acíclico

**Las dependencias van siempre hacia abajo.** Un ciclo entre módulos
funciona mientras el orden de evaluación no cambie — y ese orden es un
detalle del documento, no una garantía.

```
datos.js ─┬─► components/logo.js ──┐
          │                        │
          ├─► components/umbral.js ─┤
          │                        ▼
          └───────────────────► state.js ─► components/form.js ─┐
almacen.js ────────────────────────┘       components/modal.js ┴─► main.js
```

- `datos.js` y `almacen.js` son **hojas**: no importan nada.
- `state.js` coordina (navegación, borrador, historial).
- Los componentes son vistas y eventos; no dependen de `state.js` en la
  otra dirección.
- `main.js` es el único que conoce a todos: ahí se cablea lo que cruza
  capas.

`npm run test:grafo` lo comprueba, incluida la detección de ciclos.

## 5. El estado es explícito

- El estado central (`respuestas`, `pasoActual`) vive en `datos.js` y se
  consulta; no se muta «a pelo» (un módulo no puede reasignar el `let` de
  otro: se cambia con funciones explícitas).
- Lo que sólo le importa a un componente (por ejemplo, si el umbral está
  visible) vive en ese componente.
- JavaScript **sólo** escribe clases y el atributo `hidden`. Todo lo demás
  —color, movimiento, tamaño— lo decide el CSS leyendo variables.

## 6. Un sistema, no un dibujo

**El logotipo es un sistema de piezas, no una ilustración.**

- El arco se define **una** vez (`<defs>` + `<use>`) y se reutiliza: el
  naranja es el espejo del azul. Cambiar el arco cambia ambos lados.
- La aguja es el dilema: dividida (mitad azul, mitad naranja) mientras se
  reflexiona; vestida del color elegido al decidir.
- La aguja es también el **indicador de progreso**: barre de izquierda a
  derecha según el paso.
- Toda la coloración vive en CSS (variables de `<body>`), no en
  atributos: añadir una pieza nueva la hace adaptable sola.

## 7. Todo por variables

- Los tokens de diseño (paleta, tipografía, tiempos) viven en
  `styles/variables.css`; los modificadores de estado, en
  `styles/states.css`.
- Las propiedades que se funden (`@property`) se registran para poder
  interpolarse; sin soporte, el cambio es instantáneo.
- El color de la interfaz móvil (`theme-color`), el grano de película y
  la viñeta son detalles, no adornos: sirven para mantener la calma.

## 8. La calma es una decisión de producto

No es un efecto: es la tesis de la herramienta.

- Nada aparece de la nada: todo entra con fade, en cascada, y en su
  momento.
- El primer clic **no** avanza: abre un umbral (una pausa consciente) y
  ofrece una guía de respiración 4-4-4.
- No hay juicios ni persuasión: ni en los textos, ni en los colores, ni
  en la interfaz. La herramienta es un espejo del proceso de decisión.
- El movimiento se puede apagar por completo, y el sistema manda por
  defecto sobre la Coreografía.

## 9. Accesibilidad con agencia

- **WCAG AA** como mínimo: contraste medido, foco visible, foco al
  título de cada paso, errores asociados a su campo
  (`aria-invalid` + `aria-describedby`), `role="alert"` para lo urgente
  y `role="status"` para lo informativo.
- **El sistema manda, el usuario decide**: `prefers-reduced-motion` se
  respeta siempre; la preferencia «Activar» permite al usuario (que ha
  pedido menos movimiento del sistema) recuperarlo. Accesibilidad con
  agencia, no a costa del usuario.
- **Nada de `confirm()` ni `alert()`**: las confirmaciones son doble
  pulsación en botones nativos, accesibles con teclado.
- El **clic consciente**: el avance sólo ocurre desde botones
  explícitos. El fondo, el texto o cualquier otra zona no hacen nada.

## 10. Privacidad por defecto

- **Todo es local**: la reflexión se guarda en el navegador
  (`localStorage`) y nunca sale del equipo. Sin cuentas, sin servidores,
  sin analítica.
- Siempre hay forma de borrar todo: «Reiniciar» (el borrador) y «Borrar
  historial» (doble pulsación).
- El estado del almacenamiento se comprueba en cada apertura de «Ayuda»:
  si no se puede guardar, se avisa.

## 11. Verificación

- Toda corrección de un defecto lleva **su prueba de regresión**.
- Las afirmaciones sobre el comportamiento se comprueban en un navegador
  real, no se deducen.
- Lo que no se ha medido se dice que no se ha medido (no se afirma «60 fps»
  sin medirlo).
