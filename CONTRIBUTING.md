# Cómo contribuir

Gracias por mirar el proyecto. Esta guía explica cómo se trabaja aquí y
qué se espera de una contribución.

Antes de nada: lee [`PRINCIPIOS.md`](PRINCIPIOS.md). Las reglas del
proyecto están ahí (HTML primero, degradación elegante, pocas
dependencias, grafo acíclico…). El código las cita: si una contribución
las rompe, hay que actualizarlas o a cambiar el código.

## Poner en marcha

El proyecto **no tiene dependencias**: no hace falta `npm install`.

```bash
git clone https://github.com/CristianCV22/HazloONo.git
cd HazloONo
python -m http.server 8000     # → http://localhost:8000
```

> Hay que servirlo por HTTP: los módulos ES no se cargan desde `file://`
> (el navegador los bloquea por CORS). Si se abre el fichero directamente,
> la app degrada al layout sin JavaScript — funciona, pero sin interacción.

## Comprobar que todo está bien

```bash
npm run verificar     # las cuatro comprobaciones seguidas
```

O por separado:

| Comando | Qué comprueba |
|---|---|
| `npm test` | El flujo completo de la reflexión (234 aserciones, Node puro) |
| `npm run test:grafo` | Que el grafo de módulos es completo, consistente y **acíclico** |
| `npm run lint` | ESLint (formato plano, sin instalar nada: usa `npx`) |
| `npm run lint:css` | Stylelint (formato plano, sin instalar nada) |

Las mismas comprobaciones se ejecutan solas en cada push y en cada PR
(`.github/workflows/verificar.yml`).

### Pruebas en un navegador real

Las sondas de `pruebas/` conducen Edge o Chrome en modo headless por CDP.
Son **portables**: el navegador, el puerto, la URL y la carpeta de perfiles
se resuelven en `pruebas/navegador.js`, y se pueden fijar con las
variables de entorno `NAVEGADOR`, `PUERTO_SERVIDOR`, `URL_PAGINA` y
`CARPETA_PERFILES`.

```bash
node pruebas/sonda-cdp.js default      # la coreografía de apertura
node pruebas/verificar-borrador.js      # el borrador, de punta a punta
```

## Cómo escribir código aquí

**Estilo**

- Español (comentarios, textos de la interfaz, mensajes de commit).
- Sangría de 4 espacios; comillas simples en JS; `camelCase` en JS y
  `kebab-case` en CSS.
- Comentarios que explican **por qué**, no el qué. El código ya dice lo
  que hace.
- Todo módulo nuevo empieza con una cabecera que explica su papel.

**JavaScript**

- Módulos ES nativos. Nada de framework, nada de bundler.
- El grafo debe seguir siendo **acíclico**: las dependencias van hacia
  abajo. Si necesitas algo de otro módulo, mira antes si lo que quieres
  pertenece a una hoja (`datos.js`, `almacen.js`).
- JavaScript sólo escribe clases y `hidden`. Si un valor nuevo necesita
  un color o una animación, va por variable CSS.
- El estado mutable se cambia con funciones explícitas
  (`fijarPasoActual`), no reasignando el `let` de otro módulo.

**CSS**

- Los tokens van en `styles/variables.css`; los modificadores de estado,
  en `styles/states.css`; el resto, junto a su componente.
- Se prefiere el selector semántico (elemento, atributo, `:has()`,
  `:where()`) a una clase nueva.
- Si algo se solapa o se recorta, se arregla el layout (no se esconde el
  síntoma con `overflow: hidden`).

**HTML**

- Semántica antes que estilo: `section`, `fieldset`/`legend`, `label`,
  `dialog`.
- El contenido completo se lee sin JavaScript.
- Todo lo que sea decorativo, con `aria-hidden="true"`.

## Pull requests

1. Una idea por PR; si es grande, dilo antes (en una incidencia).
2. **Cada corrección de un defecto lleva su prueba de regresión** (en
   `tests/flujo.test.js` o en las sondas).
3. `npm run verificar` en verde.
4. Describe el **qué** y el **por qué** en la descripción del PR.
5. Si tocas el grafo de módulos, actualiza `pruebas/verificar-grafica.js`
   (las importaciones que se comprueban) — y añade el módulo nuevo a
   `tests/flujo.test.js` si tiene código que probar.
6. Si tocas el diseño, actualiza las capturas del README
   (`npm run capturas`) y el `CHANGELOG.md`.

##Licencia

MIT. Al contribuir, aceptas que tu trabajo se publique bajo esa licencia.
