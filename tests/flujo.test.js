/* Prueba funcional de los módulos ES con un DOM mínimo simulado.
   Verifica: navegación entre pasos, validación, aguja del logo,
   ticks de progreso, resumen, cierre y reinicio.

   Los módulos se concatenan en un solo ámbito (como si fueran
   scripts clásicos): se eliminan las líneas import/export y el
   orden de carga reproduce las dependencias. Las declaraciones
   de función se elevan; las constantes quedan en orden válido.

   Nota: la concatenación crea un ámbito compartido, así que una
   importación faltante NO se detecta aquí (los nombres existen
   como "globales" del ámbito). Las sondas CDP (pruebas/) cargan
   la página real con <script type="module"> y capturan las
   excepciones de la consola: son las que vigilan las importaciones. */

const fs = require('fs');
const BASE = 'C:/Users/valde/OneDrive/Documentos/Proyectos/HazloONo/';
const html = fs.readFileSync(BASE + 'index.html', 'utf-8');
const MODULOS_JS = [
    'scripts/utils.js',
    'scripts/state.js',
    'scripts/components/logo.js',
    'scripts/components/form.js',
    'scripts/components/modal.js',
    'scripts/main.js'
];
const js = MODULOS_JS.map((m) => fs.readFileSync(BASE + m, 'utf-8')
    // Quitar las importaciones (pueden
    // ocupar varias líneas) y el
    // prefijo export de las
    // declaraciones.
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export (?=(?:function|const|let|class)\b)/gm, '')
).join('\n');

/* ---------- Mini DOM ---------- */
class El {
    constructor(tag, attrs) {
        this.tag = tag;
        this.attrs = attrs || {};
        this.children = [];
        this.parent = null;
        // En un navegador real, input.value refleja el atributo value
        this.value = (tag === 'input' && attrs.value) ? attrs.value : '';
        this.checked = false;
        this.hidden = 'hidden' in this.attrs;
        this.listeners = {};
        this._foco = false;
        // classList sincronizado con attrs.class (lo lee el CSS simulado)
        this._clases = (this.attrs.class || '').split(/\s+/).filter(Boolean);
        const self = this;
        const sincronizar = () => { self.attrs.class = self._clases.join(' '); };
        this.classList = {
            add(...cs) { cs.forEach(c => { if (!self._clases.includes(c)) self._clases.push(c); }); sincronizar(); },
            remove(...cs) { self._clases = self._clases.filter(c => !cs.includes(c)); sincronizar(); },
            toggle(c, forzar) {
                const activa = forzar === undefined ? !self._clases.includes(c) : Boolean(forzar);
                if (activa && !self._clases.includes(c)) self._clases.push(c);
                if (!activa) self._clases = self._clases.filter(x => x !== c);
                sincronizar();
            },
            contains(c) { return self._clases.includes(c); }
        };
    }
    // textContent: asignarlo reemplaza los
    // hijos (como el DOM real); leerlo
    // devuelve el texto propio, o el
    // texto concatenado de los hijos
    // si los hay.
    get textContent() {
        if (this.children.length === 0
            && Object.prototype.hasOwnProperty.call(this, '_texto')) {
            return this._texto;
        }
        let out = '';
        for (const c of this.children) {
            out += c.textContent;
        }
        return out;
    }
    set textContent(valor) {
        this._texto = String(valor);
        this.children = [];
    }
    get id() { return this.attrs.id || ''; }
    get name() { return this.attrs.name || ''; }
    hasAttribute(a) { return a in this.attrs; }
    getAttribute(a) { return this.attrs[a] !== undefined ? this.attrs[a] : null; }
    setAttribute(a, v) { this.attrs[a] = String(v); }
    removeAttribute(a) { delete this.attrs[a]; }
    addEventListener(tipo, fn) { (this.listeners[tipo] = this.listeners[tipo] || []).push(fn); }
    // Despacha con bubbling hacia los ancestros (como el DOM real)
    dispatch(tipo, ev) {
        ev.target = ev.target || this;
        let n = this;
        while (n) {
            (n.listeners[tipo] || []).forEach(fn => fn(ev));
            n = n.parent;
        }
    }
    contains(nodo) { let n = nodo; while (n) { if (n === this) return true; n = n.parent; } return false; }
    closest(selector) { let n = this; while (n) { if (matches(n, selector)) return n; n = n.parent; } return null; }
    appendChild(nodo) { nodo.parent = this; this.children.push(nodo); return nodo; }
    focus() { this._foco = true; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) { return this._todos().filter(n => n !== this && matches(n, sel)); }
    _todos() {
        let out = [];
        for (const c of this.children) { out.push(c); out = out.concat(c._todos()); }
        return out;
    }
    reset() {
        this._todos().forEach(n => {
            if (n.tag === 'textarea' || n.tag === 'input') {
                // En un navegador real, reset() restaura el
                // valor por defecto (el atributo value).
                n.value = (n.tag === 'input' && n.attrs.value) ? n.attrs.value : '';
                n.checked = false;
            }
        });
    }
}

/* Divide un selector en partes respetando comillas (p. ej. [aria-label="Progreso de la reflexión"]) */
function splitSelector(sel) {
    const partes = [];
    let actual = '', comillas = false;
    for (const ch of sel) {
        if (ch === '"') comillas = !comillas;
        if (ch === ' ' && !comillas) { if (actual) partes.push(actual); actual = ''; }
        else actual += ch;
    }
    if (actual) partes.push(actual);
    return partes;
}

function matches(el, sel) {
    const partes = splitSelector(sel);
    if (!simpleMatch(el, partes[partes.length - 1])) return false;
    let nodo = el.parent;
    for (let i = partes.length - 2; i >= 0; i--) {
        let encontrado = false;
        while (nodo) {
            if (simpleMatch(nodo, partes[i])) { encontrado = true; break; }
            nodo = nodo.parent;
        }
        if (!encontrado) return false;
        nodo = nodo.parent;
    }
    return true;
}

function simpleMatch(el, p) {
    let resto = p;
    if (resto.startsWith('#')) {
        const id = resto.slice(1).replace(/[.\[:].*$/, '');
        if (el.id !== id) return false;
        resto = resto.slice(id.length + 1);
    }
    const tagM = resto.match(/^[a-z][a-z0-9]*/i);
    if (tagM) { if (el.tag !== tagM[0].toLowerCase()) return false; resto = resto.slice(tagM[0].length); }
    let m;
    while ((m = resto.match(/^\.([a-zA-Z0-9_-]+)/))) {
        const cls = (el.attrs.class || '').split(/\s+/);
        if (!cls.includes(m[1])) return false;
        resto = resto.slice(m[0].length);
    }
    while ((m = resto.match(/^\[([a-zA-Z-]+)(?:="([^"]*)")?\]/))) {
        if (!(m[1] in el.attrs)) return false;
        if (m[2] !== undefined && el.attrs[m[1]] !== m[2]) return false;
        resto = resto.slice(m[0].length);
    }
    if (resto.startsWith(':checked')) {
        if (!el.checked) return false;
        resto = resto.slice(':checked'.length);
    }
    return resto === '';
}

/* Construir el árbol desde el HTML (se eliminan comentarios:
   pueden contener literales como "<section>" que confunden al parser) */
const htmlLimpio = html.replace(/<!--[\s\S]*?-->/g, '');
const raiz = new El('body');
const pila = [raiz];
const VACIOS = ['meta', 'link', 'br', 'hr', 'input', 'img', 'source', 'path', 'polygon', 'circle', 'line', 'use', 'stop'];
const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z0-9-]+(?:="[^"]*")?)*)\s*(\/?)>/g;
let tok;
while ((tok = tagRe.exec(htmlLimpio))) {
    const [, cierre, tag, attrsStr] = tok;
    if (cierre) { pila.pop(); continue; }
    const attrs = {};
    const aRe = /([a-zA-Z0-9-]+)(?:="([^"]*)")?/g;
    let am;
    while ((am = aRe.exec(attrsStr))) attrs[am[1]] = am[2] !== undefined ? am[2] : '';
    const el = new El(tag.toLowerCase(), attrs);
    el.parent = pila[pila.length - 1];
    el.parent.children.push(el);
    if (!VACIOS.includes(el.tag)) pila.push(el);
}

/* ---------- Entorno para los módulos ---------- */
const documento = {
    querySelector(sel) { return raiz.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) { return raiz.querySelectorAll(sel); },
    createElement(tag) { return new El(tag); },
    body: raiz, // el script pone clases de ambiente en <body>
    documentElement: raiz // el script marca .js en <html>
};
// El script usa window.matchMedia (prefers-reduced-motion) y
// setTimeout (transiciones). En la prueba: movimiento NO reducido
// y transiciones síncronas (setTimeout ejecuta al instante).
const ventana = { matchMedia: () => ({ matches: false }) };

// Almacenamiento local simulado: la preferencia
// de animaciones lo usa (localStorage no existe
// en Node; el script lo lee como variable libre
// del ámbito global).
const almacenSimulado = new Map();
global.localStorage = {
    getItem: (k) => (almacenSimulado.has(k) ? almacenSimulado.get(k) : null),
    setItem: (k, v) => { almacenSimulado.set(k, String(v)); },
    removeItem: (k) => { almacenSimulado.delete(k); }
};

const entorno = { document: documento, window: ventana, console, Object, String, Number, Array };
const setTimeoutReal = setTimeout;
global.setTimeout = (fn) => { fn(); return 0; };
const fn = new Function(...Object.keys(entorno),
    js + '\nreturn {secciones, pasosIndicador, respuestas, navIndicador, piePaso, logo: document.querySelector(".logo"), mostrarPaso, borrador: { guardar: guardarBorrador, leer: leerBorrador, borrar: borrarBorrador, clave: CLAVE_BORRADOR, restaurar: restaurarBorrador }, historial: { archivar: archivarReflexion, leer: leerHistorial, clave: CLAVE_HISTORIAL }};');
const api = fn(...Object.values(entorno));
// Nota: el stub de setTimeout permanece activo durante toda la
// prueba para que las transiciones sean síncronas (el proceso
// de prueba termina al finalizar, no hace falta restaurarlo).

/* ---------- Utilidades de prueba ---------- */
let fallos = 0;
function comprobar(desc, cond) {
    console.log((cond ? '  ✓ ' : '  ✗ FALLO: ') + desc);
    if (!cond) fallos++;
}
function clic(el) { el.dispatch('click', { target: el }); }
function escribir(el, texto) { el.value = texto; el.dispatch('input', { target: el }); }
function visible(i) { return api.secciones[i].classList.contains('activa'); }
function botonDe(i, attr) { return api.secciones[i].querySelectorAll('button').find(b => b.hasAttribute(attr)); }
const logo = api.logo;
const claseLogo = () => logo.attrs.class || '';
const alertaDe = (i) => (api.secciones[i].querySelector('p[role="alert"]').textContent || '');

/* ---------- PRUEBAS ---------- */
console.log('PRUEBA DEL FLUJO HAZLO O NO\n');

console.log('1. Estado inicial');
comprobar('Solo la bienvenida (paso 0) está visible', visible(0) && api.secciones.slice(1).every(s => !s.classList.contains('activa')));
comprobar('Aguja centrada (.reflexion)', claseLogo().includes('reflexion'));
comprobar('Indicador: "Bienvenida" tiene aria-current', api.pasosIndicador[0].hasAttribute('aria-current'));
comprobar('Indicador de progreso OCULTO en la bienvenida', api.navIndicador.hidden === true);
comprobar('Pie de página dice "Bienvenida"', (api.piePaso.textContent || '') === 'Bienvenida');
comprobar('Aguja en posición del paso 0 (.paso-0)', claseLogo().includes('paso-0'));
comprobar('Aguja dividida (mitades azul/naranja)', Boolean(logo.querySelector('.needle-blue') && logo.querySelector('.needle-orange')));
comprobar('Onda de decisión presente (.pulso-decision)', Boolean(logo.querySelector('.pulso-decision')));
comprobar('Marcadores de dirección presentes', Boolean(logo.querySelector('.marca-superior') && logo.querySelector('.marca-inferior')));
comprobar('Ejes de la rueda presentes', Boolean(logo.querySelector('.eje-izquierdo') && logo.querySelector('.eje-derecho')));
comprobar('Primera visual: marca en el escenario (sin .en-flujo)', !documento.body.classList.contains('en-flujo'));

console.log('2. Bienvenida → paso 2 (decisión)');
clic(botonDe(0, 'data-empezar')); // bienvenida → umbral (1.1.1)
clic(botonDe(0, 'data-avanzar')); // umbral → decisión
comprobar('Avanza al paso de decisión', visible(1));
comprobar('En los pasos, la marca pasa a segundo plano (.en-flujo)', documento.body.classList.contains('en-flujo'));
comprobar('Indicador de progreso APARECE desde el paso 2', api.navIndicador.hidden === false);
comprobar('Indicador: "Decisión" es aria-current', api.pasosIndicador[1].hasAttribute('aria-current'));
comprobar('Aguja barre al paso 1 (.paso-1)', claseLogo().includes('paso-1'));
comprobar('Foco movido al título del paso (accesibilidad)', api.secciones[1].querySelector('h2')._foco === true);

console.log('3. Validación: decisión vacía');
clic(botonDe(1, 'data-avanzar'));
comprobar('No avanza con la decisión vacía', visible(1));
comprobar('Muestra mensaje de error accesible', alertaDe(1) !== '');
comprobar('El error dice "completa este campo"', alertaDe(1).includes('completa este campo'));

console.log('4. Paso 3 · consecuencias');
escribir(documento.querySelector('#decision'), 'Estudiar para el examen');
clic(botonDe(1, 'data-avanzar'));
comprobar('Avanza al paso de consecuencias', visible(2));
comprobar('Respuesta guardada en memoria', api.respuestas.decision === 'Estudiar para el examen');
comprobar('Pie: "Paso 2 de 5 · Consecuencias"', (api.piePaso.textContent || '') === 'Paso 2 de 5 · Consecuencias');
clic(botonDe(2, 'data-avanzar'));
comprobar('No avanza con consecuencias vacías', visible(2));
comprobar('Error visible en consecuencias', alertaDe(2) !== '');
escribir(documento.querySelector('#consecuencias-hacer'), 'Aprobaré y me sentiré tranquilo');
escribir(documento.querySelector('#consecuencias-no-hacer'), 'Evito el esfuerzo pero arriesgo el resultado');
clic(botonDe(2, 'data-avanzar'));
comprobar('Avanza tras rellenar consecuencias', visible(3));

console.log('5. Paso 4 · reflexión con resumen en vivo');
comprobar('Aguja en el paso 3 de reflexión (.paso-3)', claseLogo().includes('paso-3'));
comprobar('Resumen muestra la decisión', (documento.querySelector('#resumen-decision').textContent || '').includes('Estudiar para el examen'));
clic(botonDe(3, 'data-avanzar'));
comprobar('No avanza con campos de reflexión vacíos', visible(3));
escribir(documento.querySelector('#consecuencias-importantes'), 'Mi salud y tranquilidad');
escribir(documento.querySelector('#ganancias-sacrificios'), 'Gano claridad, sacrifico una noche');
clic(botonDe(3, 'data-avanzar'));
comprobar('Avanza al paso de elección', visible(4));

console.log('6. Paso 5 · elección final (radio → aguja)');
comprobar('Aguja en el paso de elección (.paso-4)', claseLogo().includes('paso-4'));
comprobar('Sin elección, la aguja sigue en reflexión', claseLogo().includes('reflexion'));
const radioHacer = documento.querySelector('input[value="hacerlo"]');
const radioNoHacer = documento.querySelector('input[value="no-hacerlo"]');
radioHacer.checked = true;
radioHacer.dispatch('change', { target: radioHacer });
comprobar('Al elegir "hacerlo", la aguja gira a la derecha (.hacerlo)', claseLogo().includes('hacerlo'));
comprobar('La aguja se asienta (hacerlo, sin .paso-4)', claseLogo().includes('hacerlo') && !claseLogo().includes('paso-4'));
comprobar('Respuesta eleccion guardada', api.respuestas.eleccion === 'hacerlo');

console.log('7. Validación: terminar sin motivo');
clic(botonDe(4, 'data-terminar'));
comprobar('No cierra sin motivo', visible(4));
comprobar('Error visible en elección', alertaDe(4) !== '');

console.log('8. Cierre');
escribir(documento.querySelector('#motivo'), 'Mi tranquilidad vale más');
clic(botonDe(4, 'data-terminar'));
comprobar('Muestra la sección de cierre', visible(5));
const cierre = documento.querySelector('#cierre').textContent || '';
comprobar('Cierre menciona la elección HACERLO', cierre.includes('decidido: HACERLO'));
comprobar('Cierre menciona la decisión', cierre.includes('Estudiar para el examen'));
comprobar('Cierre menciona el motivo', cierre.includes('Mi tranquilidad vale más'));
comprobar('Indicador mantiene "Elección" como paso actual', api.pasosIndicador[4].hasAttribute('aria-current'));
comprobar('Cierre ofrece "Modificar mi elección"', Boolean(botonDe(5, 'data-retroceder')));

console.log('8b. Modificar la opción desde el cierre');
clic(botonDe(5, 'data-retroceder'));
comprobar('Vuelve al paso de elección', visible(4));
radioNoHacer.checked = true;
radioNoHacer.dispatch('change', { target: radioNoHacer });
comprobar('Al cambiar la elección, la aguja gira (.no-hacerlo)', claseLogo().includes('no-hacerlo'));
comprobar('Ambiente se tiñe de azul al instante', documento.body.classList.contains('estado-no-hacerlo') && !documento.body.classList.contains('estado-hacerlo'));
clic(botonDe(4, 'data-terminar'));
comprobar('Cierre con la opción modificada', visible(5));
comprobar('El cierre menciona NO HACERLO', (documento.querySelector('#cierre').textContent || '').includes('decidido: NO HACERLO'));

console.log('9. Aguja también gira a la izquierda con "no hacerlo"');
// Simular otra elección directamente
radioNoHacer.checked = true;
radioNoHacer.dispatch('change', { target: radioNoHacer });
comprobar('Aguja a la izquierda (.no-hacerlo)', claseLogo().includes('no-hacerlo'));

console.log('10. Reiniciar');
clic(botonDe(5, 'data-reiniciar'));
comprobar('Vuelve a la bienvenida', visible(0));
comprobar('Al reiniciar, vuelve la primera visual (sin .en-flujo)', !documento.body.classList.contains('en-flujo'));
comprobar('Aguja centrada de nuevo', claseLogo().includes('reflexion'));
comprobar('Respuestas borradas', Object.values(api.respuestas).every(v => v === ''));
comprobar('Campos del formulario vacíos', documento.querySelector('#decision').value === '' && !radioHacer.checked);
comprobar('Pie vuelve a "Bienvenida"', (api.piePaso.textContent || '') === 'Bienvenida');

console.log('11. Ambiente se tiñe según la elección');
// Elegir "hacerlo" en la elección final de nuevo
clic(botonDe(0, 'data-empezar')); // bienvenida → umbral (1.1.1)
clic(botonDe(0, 'data-avanzar')); // umbral → decisión // bienvenida → decisión
escribir(documento.querySelector('#decision'), 'Salir a caminar');
clic(botonDe(1, 'data-avanzar'));
escribir(documento.querySelector('#consecuencias-hacer'), 'Me siento bien');
escribir(documento.querySelector('#consecuencias-no-hacer'), 'Me pierdo el día');
clic(botonDe(2, 'data-avanzar'));
escribir(documento.querySelector('#consecuencias-importantes'), 'Mi salud');
escribir(documento.querySelector('#ganancias-sacrificios'), 'Energía');
clic(botonDe(3, 'data-avanzar'));
radioNoHacer.checked = true;
radioNoHacer.dispatch('change', { target: radioNoHacer });
comprobar('Ambiente azul con "no hacerlo" (body.estado-no-hacerlo)', documento.body.classList.contains('estado-no-hacerlo'));
comprobar('Ambiente naranja ausente', !documento.body.classList.contains('estado-hacerlo'));

console.log('12. Menú principal');
const botonReiniciarMenu = raiz.querySelectorAll('button').find(b => b.hasAttribute('data-menu-reiniciar'));
const botonAyudaMenu = raiz.querySelectorAll('button').find(b => b.hasAttribute('data-menu-ayuda'));
comprobar('El menú tiene "Ayuda" y "Reiniciar"', Boolean(botonAyudaMenu && botonReiniciarMenu));
clic(botonReiniciarMenu);
comprobar('"Reiniciar" del menú vuelve a la bienvenida', visible(0));
comprobar('Respuestas borradas por el menú', Object.values(api.respuestas).every(v => v === ''));

console.log('13. Preferencia de animaciones');
const radiosAnimacion = raiz.querySelectorAll('input[name="animacion"]');
comprobar('El diálogo ofrece las 3 opciones (seguir/activar/desactivar)', radiosAnimacion.length === 3);
comprobar('Existe la nota para sistemas con animaciones reducidas', Boolean(documento.querySelector('#nota-animacion')));
comprobar('Nota oculta (en la prueba el sistema NO reduce movimiento)', documento.querySelector('#nota-animacion').hidden === true);
comprobar('Al inicio se sigue el sistema (sin clases de fuerza)', !documento.documentElement.classList.contains('fuerza-animacion') && !documento.documentElement.classList.contains('fuerza-reduccion'));
comprobar('La opción "Seguir el sistema" queda marcada', Boolean(raiz.querySelector('input[name="animacion"][value="seguir"]').checked));

const radioActivar = raiz.querySelector('input[name="animacion"][value="activar"]');
radioActivar.checked = true;
radioActivar.dispatch('change', { target: radioActivar });
comprobar('Al elegir "Activar", <html> recibe .fuerza-animacion', documento.documentElement.classList.contains('fuerza-animacion'));
comprobar('La preferencia se guarda en el navegador', almacenSimulado.get('hazlono-animacion') === 'activar');

const radioDesactivar = raiz.querySelector('input[name="animacion"][value="desactivar"]');
radioDesactivar.checked = true;
radioDesactivar.dispatch('change', { target: radioDesactivar });
comprobar('Al elegir "Desactivar", <html> recibe .fuerza-reduccion', documento.documentElement.classList.contains('fuerza-reduccion') && !documento.documentElement.classList.contains('fuerza-animacion'));

const radioSeguir = raiz.querySelector('input[name="animacion"][value="seguir"]');
radioSeguir.checked = true;
radioSeguir.dispatch('change', { target: radioSeguir });
comprobar('Al volver a "Seguir", se quitan las clases de fuerza', !documento.documentElement.classList.contains('fuerza-animacion') && !documento.documentElement.classList.contains('fuerza-reduccion'));

console.log('14. Borrador local (T1 · esquema de datos)');
// Guardar
comprobar('Borrador bajo la clave "hazlono-borrador"', api.borrador.clave === 'hazlono-borrador');
comprobar('guardarBorrador retorna true (hay almacen)', api.borrador.guardar(2) === true);
const crudo = almacenSimulado.get('hazlono-borrador');
comprobar('El borrador se guarda como JSON', Boolean(crudo));
const datos = JSON.parse(crudo);
comprobar('Esquema: version 1', datos.version === 1);
comprobar('Esquema: paso guardado (2)', datos.paso === 2);
comprobar('Esquema: respuestas guardadas', Boolean(datos.respuestas) && typeof datos.respuestas.decision === 'string');
comprobar('Esquema: fecha en formato ISO 8601', /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(datos.guardado));
comprobar('Paso fuera de rango se ajusta al tope', (() => { api.borrador.guardar(99); return JSON.parse(almacenSimulado.get('hazlono-borrador')).paso; })() === 5);

// Leer (round-trip)
const leido = api.borrador.leer();
comprobar('leerBorrador devuelve el borrador', Boolean(leido) && leido.paso === 5);
comprobar('Las respuestas viajan completas', leido.respuestas.decision === api.respuestas.decision);

// Sanitización
almacenSimulado.set('hazlono-borrador', JSON.stringify({ version: 99, paso: 2, respuestas: {} }));
comprobar('Versión desconocida → null', api.borrador.leer() === null);
almacenSimulado.set('hazlono-borrador', 'no es json {{{');
comprobar('JSON corrupto → null', api.borrador.leer() === null);
almacenSimulado.set('hazlono-borrador', JSON.stringify({ version: 1, paso: 99, respuestas: {} }));
comprobar('Paso fuera de rango → null', api.borrador.leer() === null);
almacenSimulado.set('hazlono-borrador', JSON.stringify({ version: 1, paso: 1, respuestas: { decision: 42, eleccion: 'hacerlo', desconocida: '<script>' } }));
const saneado = api.borrador.leer();
comprobar('Respuesta no-cadena → cadena vacía', saneado.respuestas.decision === '');
comprobar('Respuesta cadena viaja', saneado.respuestas.eleccion === 'hacerlo');
comprobar('Clave desconocida se descarta', !('desconocida' in saneado.respuestas));

// Borrar
comprobar('borrarBorrador retorna true', api.borrador.borrar() === true);
comprobar('Tras borrar, no hay borrador', api.borrador.leer() === null);

// Sin almacenamiento disponible
const almacenAnterior = global.localStorage;
global.localStorage = undefined;
comprobar('Sin almacenamiento: guardar retorna false', api.borrador.guardar(0) === false);
comprobar('Sin almacenamiento: leer retorna null', api.borrador.leer() === null);
comprobar('Sin almacenamiento: borrar retorna false', api.borrador.borrar() === false);
global.localStorage = almacenAnterior;

console.log('15. Guardado automático (T2)');
almacenSimulado.delete('hazlono-borrador');
// Avanzar: el paso se guarda al navegar
clic(botonDe(0, 'data-empezar')); // bienvenida → umbral (1.1.1)
clic(botonDe(0, 'data-avanzar')); // umbral → decisión // bienvenida → decisión
comprobar('Al avanzar, el borrador guarda el paso 1', JSON.parse(almacenSimulado.get('hazlono-borrador')).paso === 1);
// Escribir: el texto se guarda (debounce síncrono en la prueba)
escribir(documento.querySelector('#decision'), 'Aprender a nadar');
comprobar('Al escribir, el borrador guarda el texto', JSON.parse(almacenSimulado.get('hazlono-borrador')).respuestas.decision === 'Aprender a nadar');
// Rellenar consecuencias y avanzar
clic(botonDe(1, 'data-avanzar')); // decisión → consecuencias
escribir(documento.querySelector('#consecuencias-hacer'), 'Me siento bien');
escribir(documento.querySelector('#consecuencias-no-hacer'), 'Me pierdo el día');
clic(botonDe(2, 'data-avanzar')); // consecuencias → reflexión
comprobar('El paso 3 se guarda al avanzar', JSON.parse(almacenSimulado.get('hazlono-borrador')).paso === 3);
comprobar('Los textos viajan en el borrador', JSON.parse(almacenSimulado.get('hazlono-borrador')).respuestas.consecuenciasHacer === 'Me siento bien');
// Elegir: la elección se guarda
escribir(documento.querySelector('#consecuencias-importantes'), 'Mi salud');
escribir(documento.querySelector('#ganancias-sacrificios'), 'Energía');
clic(botonDe(3, 'data-avanzar')); // reflexión → elección
const radioHacerT2 = raiz.querySelector('input[name="eleccion"][value="hacerlo"]');
radioHacerT2.checked = true;
radioHacerT2.dispatch('change', { target: radioHacerT2 });
const trasEleccion = JSON.parse(almacenSimulado.get('hazlono-borrador'));
comprobar('La elección se guarda en el borrador', trasEleccion.respuestas.eleccion === 'hacerlo');
comprobar('El borrador queda en el paso de elección (4)', trasEleccion.paso === 4);
comprobar('Fecha de guardado actualizada', Boolean(trasEleccion.guardado));

console.log('16. Restaurar borrador (T3)');
// Un borrador "de otra sesión", a mitad de flujo
almacenSimulado.set('hazlono-borrador', JSON.stringify({
    version: 1,
    paso: 2,
    respuestas: {
        decision: 'Viajar a Japón',
        consecuenciasHacer: 'Fotos y recuerdos',
        consecuenciasNoHacer: 'Me lo pierdo',
        consecuenciasImportantes: '',
        gananciasYSacrificios: '',
        eleccion: '',
        motivo: ''
    },
    guardado: '2026-10-12T10:00:00.000Z'
}));
comprobar('restaurarBorrador retorna true', api.borrador.restaurar() === true);
comprobar('Vuelve al paso guardado (consecuencias)', visible(2));
comprobar('El campo decisión se rellena', documento.querySelector('#decision').value === 'Viajar a Japón');
comprobar('El campo consecuencias se rellena', documento.querySelector('#consecuencias-hacer').value === 'Fotos y recuerdos');
comprobar('Las respuestas en memoria coinciden', api.respuestas.decision === 'Viajar a Japón');
comprobar('Indicador marca el paso restaurado', api.pasosIndicador[2].hasAttribute('aria-current'));
comprobar('Pie de página actualizado', (api.piePaso.textContent || '').includes('Paso 2 de 5'));

// Borrador con elección: aguja y ambiente se visten
almacenSimulado.set('hazlono-borrador', JSON.stringify({
    version: 1,
    paso: 4,
    respuestas: {
        decision: 'Estudiar',
        consecuenciasHacer: 'Aprobar',
        consecuenciasNoHacer: 'Reprobar',
        consecuenciasImportantes: 'Mi futuro',
        gananciasYSacrificios: 'Tiempo',
        eleccion: 'hacerlo',
        motivo: 'Mi tranquilidad'
    },
    guardado: '2026-10-12T11:00:00.000Z'
}));
api.borrador.restaurar();
comprobar('Radio "hacerlo" queda marcado', Boolean(raiz.querySelector('input[name="eleccion"][value="hacerlo"]').checked));
comprobar('El motivo se rellena', documento.querySelector('#motivo').value === 'Mi tranquilidad');
comprobar('Aguja se viste de naranja (.hacerlo)', claseLogo().includes('hacerlo'));
comprobar('Ambiente naranja (estado-hacerlo)', documento.body.classList.contains('estado-hacerlo'));

// Borrador en el cierre: se rehace el resumen
almacenSimulado.set('hazlono-borrador', JSON.stringify({
    version: 1,
    paso: 5,
    respuestas: {
        decision: 'Cambiar de trabajo',
        consecuenciasHacer: 'Nuevos retos',
        consecuenciasNoHacer: 'Estancamiento',
        consecuenciasImportantes: 'Crecimiento',
        gananciasYSacrificios: 'Estabilidad',
        eleccion: 'no-hacerlo',
        motivo: 'Mi paz'
    },
    guardado: '2026-10-12T12:00:00.000Z'
}));
api.borrador.restaurar();
comprobar('Cierre restaurado', visible(5));
comprobar('El resumen del cierre se rehace', (documento.querySelector('#cierre').textContent || '').includes('decidido: NO HACERLO'));

// Sin borrador: no hace nada (la bienvenida ya está)
almacenSimulado.delete('hazlono-borrador');
comprobar('Sin borrador: restaurar retorna false', api.borrador.restaurar() === false);
comprobar('Sin borrador: el paso no cambia', visible(5));

console.log('17. Reiniciar borra el borrador (T4)');
// Un borrador "de otra sesión"
almacenSimulado.set('hazlono-borrador', JSON.stringify({
    version: 1,
    paso: 3,
    respuestas: {
        decision: 'Algo pendiente',
        consecuenciasHacer: 'x',
        consecuenciasNoHacer: 'y',
        consecuenciasImportantes: '',
        gananciasYSacrificios: '',
        eleccion: '',
        motivo: ''
    },
    guardado: '2026-10-12T09:00:00.000Z'
}));
comprobar('Hay borrador antes de reiniciar', Boolean(almacenSimulado.get('hazlono-borrador')));
// Escribir justo antes de reiniciar (guardado reciente)
escribir(documento.querySelector('#decision'), 'Última tecla');
clic(botonReiniciarMenu);
comprobar('Reiniciar borra el borrador guardado', almacenSimulado.get('hazlono-borrador') === undefined);
comprobar('Volvió a la bienvenida', visible(0));
comprobar('El campo quedó vacío', documento.querySelector('#decision').value === '');
// Un segundo reiniciar (ya sin borrador) tampoco crea uno
clic(botonReiniciarMenu);
comprobar('Reiniciar sin borrador no crea uno', almacenSimulado.get('hazlono-borrador') === undefined);

console.log('18. Archivar al terminar (T5)');
almacenSimulado.delete('hazlono-historial');
almacenSimulado.delete('hazlono-borrador');
// Completar el flujo hasta la elección final
clic(botonDe(0, 'data-empezar')); // bienvenida → umbral (1.1.1)
clic(botonDe(0, 'data-avanzar')); // umbral → decisión
escribir(documento.querySelector('#decision'), 'Aprender a nadar');
clic(botonDe(1, 'data-avanzar'));
escribir(documento.querySelector('#consecuencias-hacer'), 'Me siento bien');
escribir(documento.querySelector('#consecuencias-no-hacer'), 'Me pierdo el día');
clic(botonDe(2, 'data-avanzar'));
escribir(documento.querySelector('#consecuencias-importantes'), 'Mi salud');
escribir(documento.querySelector('#ganancias-sacrificios'), 'Energía');
clic(botonDe(3, 'data-avanzar'));
const radioT5 = raiz.querySelector('input[name="eleccion"][value="hacerlo"]');
radioT5.checked = true;
radioT5.dispatch('change', { target: radioT5 });
escribir(documento.querySelector('#motivo'), 'Mi tranquilidad');
comprobar('Antes de terminar: sin historial', almacenSimulado.get('hazlono-historial') === undefined);
clic(botonDe(4, 'data-terminar'));
const historial = JSON.parse(almacenSimulado.get('hazlono-historial') || '{"version":1,"entradas":[]}');
comprobar('Al terminar se crea el historial', historial.entradas.length === 1);
comprobar('La entrada guarda la decisión', historial.entradas[0].decision === 'Aprender a nadar');
comprobar('La entrada guarda la elección', historial.entradas[0].eleccion === 'hacerlo');
comprobar('La entrada guarda el motivo', historial.entradas[0].motivo === 'Mi tranquilidad');
comprobar('La entrada tiene fecha', Boolean(historial.entradas[0].fecha));
comprobar('El borrador se borra al archivar', almacenSimulado.get('hazlono-borrador') === undefined);
comprobar('El cierre queda visible', visible(5));
// Volver y re-terminar agrega otra entrada
clic(botonDe(5, 'data-retroceder'));
escribir(documento.querySelector('#motivo'), 'Otro motivo');
clic(botonDe(4, 'data-terminar'));
const entradas2 = JSON.parse(almacenSimulado.get('hazlono-historial')).entradas;
comprobar('Re-terminar agrega otra entrada', entradas2.length === 2);
comprobar('La segunda entrada tiene el nuevo motivo', entradas2[1].motivo === 'Otro motivo');
comprobar('El borrador sigue ausente', almacenSimulado.get('hazlono-borrador') === undefined);
// Sin almacenamiento: archivar falla en silencio
const almacenT5 = global.localStorage;
global.localStorage = undefined;
comprobar('Sin almacenamiento: archivar retorna false', api.historial.archivar() === false);
comprobar('Sin almacenamiento: leer retorna vacío', api.historial.leer().length === 0);
global.localStorage = almacenT5;

console.log('19. Ver el historial (T6)');
const botonHistorial = raiz.querySelectorAll('button').find(b => b.hasAttribute('data-menu-historial'));
comprobar('El menú tiene "Historial"', Boolean(botonHistorial));
const dialogoHistorial = documento.querySelector('#historial');
comprobar('Existe el diálogo del historial', Boolean(dialogoHistorial));
const listaHistorial = documento.querySelector('#lista-historial');
const vacioHistorial = documento.querySelector('#historial-vacio');
// Simular showModal (el shim no tiene <dialog> nativo)
let abiertoT6 = false;
dialogoHistorial.showModal = () => { abiertoT6 = true; };
// Abrir con el historial de las pruebas T5 (2 entradas)
clic(botonHistorial);
comprobar('Abrir historial abre el diálogo', abiertoT6);
comprobar('Se renderizan las entradas', listaHistorial.children.length === 2);
comprobar('La primera es la más reciente', (listaHistorial.children[0].textContent || '').includes('Otro motivo'));
comprobar('La segunda es la anterior', (listaHistorial.children[1].textContent || '').includes('Mi tranquilidad'));
comprobar('La elección aparece en el texto', (listaHistorial.children[0].textContent || '').includes('HACERLO'));
comprobar('La lista es visible (sin hidden)', !listaHistorial.hidden);
comprobar('El estado vacío está oculto', vacioHistorial.hidden);
// Estado vacío: borrar el historial y abrir de nuevo
almacenSimulado.delete('hazlono-historial');
clic(botonHistorial);
comprobar('Sin entradas: lista vacía', listaHistorial.children.length === 0);
comprobar('Sin entradas: lista oculta', listaHistorial.hidden);
comprobar('Sin entradas: estado vacío visible', !vacioHistorial.hidden);

console.log('20. Borrar historial (T7)');
// Preparar: archivar una reflexión
api.historial.archivar();
comprobar('Hay historial para borrar', almacenSimulado.get('hazlono-historial') !== undefined);
const botonBorrar = raiz.querySelector('[data-borrar-historial]');
const avisoHistorial = documento.querySelector('#aviso-historial');
comprobar('El diálogo tiene «Borrar historial»', Boolean(botonBorrar));
// Temporizador controlado (el stub
// síncrono no permite observar la
// confirmación pendiente).
const timersT7 = [];
global.setTimeout = (fn, ms) => { timersT7.push({ fn, ms }); return timersT7.length; };
// Primera pulsación: pide confirmación
clic(botonBorrar);
comprobar('Primera pulsación cambia el botón', (botonBorrar.textContent || '') === '¿Seguro? Pulsa de nuevo');
comprobar('El aviso se muestra', !avisoHistorial.hidden);
comprobar('Queda una confirmación pendiente', timersT7.length === 1);
comprobar('Aún no borra', almacenSimulado.get('hazlono-historial') !== undefined);
// Segunda pulsación: borra de verdad
clic(botonBorrar);
comprobar('Segunda pulsación borra el historial', almacenSimulado.get('hazlono-historial') === undefined);
comprobar('El botón vuelve a la normalidad', (botonBorrar.textContent || '') === 'Borrar historial');
comprobar('La lista queda vacía', documento.querySelector('#lista-historial').children.length === 0);
comprobar('El estado vacío se muestra', !documento.querySelector('#historial-vacio').hidden);
// Si pasa el plazo sin confirmar: todo vuelve
clic(botonBorrar); // primera pulsación de nuevo
comprobar('Otra vez pide confirmación', (botonBorrar.textContent || '') === '¿Seguro? Pulsa de nuevo');
const pendiente = timersT7.pop();
pendiente.fn(); // expira el plazo
comprobar('Al expirar, el botón vuelve a la normalidad', (botonBorrar.textContent || '') === 'Borrar historial');
comprobar('Al expirar, el aviso se oculta', avisoHistorial.hidden);
clic(botonBorrar); // tras expirar, vuelve a ser "primera pulsación"
comprobar('Tras expirar, pide confirmación otra vez', (botonBorrar.textContent || '') === '¿Seguro? Pulsa de nuevo');
// Dejar la confirmación limpia (expira el temporizador pendiente)
const pendienteFinal = timersT7.pop();
if (pendienteFinal) {
    pendienteFinal.fn();
}
// Restaurar el stub síncrono
global.setTimeout = (fn) => { fn(); return 0; };

console.log('21. Degradación elegante (T8)');
const avisoAlmacenamiento = documento.querySelector('#aviso-almacenamiento');
comprobar('Existe el aviso de almacenamiento en Ayuda', Boolean(avisoAlmacenamiento));
comprobar('El aviso empieza oculto (hay almacenamiento)', avisoAlmacenamiento.hidden);
// Abrir Ayuda con almacenamiento funcionando
clic(botonAyudaMenu);
comprobar('Ayuda con almacenamiento: aviso oculto', avisoAlmacenamiento.hidden);
// Abrir Ayuda sin almacenamiento
const almacenT8 = global.localStorage;
global.localStorage = undefined;
clic(botonAyudaMenu);
comprobar('Ayuda sin almacenamiento: aviso visible', !avisoAlmacenamiento.hidden);
global.localStorage = almacenT8;
// Al volver a haber almacenamiento, se oculta
clic(botonAyudaMenu);
comprobar('Al restaurar: aviso oculto de nuevo', avisoAlmacenamiento.hidden);

console.log('22. Prueba de punta a punta (T9)');
// --- E1: primera visita, todo en blanco
almacenSimulado.clear();
clic(botonReiniciarMenu);
comprobar('E1. Bienvenida visible', visible(0));
comprobar('E1. Sin borrador ni historial', almacenSimulado.get('hazlono-borrador') === undefined && almacenSimulado.get('hazlono-historial') === undefined);

// --- E2: la reflexión de Ana («aprender a nadar»)
clic(botonDe(0, 'data-empezar')); // bienvenida → umbral (1.1.1)
clic(botonDe(0, 'data-avanzar')); // umbral → decisión
escribir(documento.querySelector('#decision'), 'Aprender a nadar');
clic(botonDe(1, 'data-avanzar'));
escribir(documento.querySelector('#consecuencias-hacer'), 'Me siento libre');
escribir(documento.querySelector('#consecuencias-no-hacer'), 'Me lo pierdo');
clic(botonDe(2, 'data-avanzar'));
escribir(documento.querySelector('#consecuencias-importantes'), 'Mi valentía');
escribir(documento.querySelector('#ganancias-sacrificios'), 'Tiempo libre');
clic(botonDe(3, 'data-avanzar'));
const radioE2E = raiz.querySelector('input[name="eleccion"][value="hacerlo"]');
radioE2E.checked = true;
radioE2E.dispatch('change', { target: radioE2E });
escribir(documento.querySelector('#motivo'), 'Para vencer mi miedo');
// Mientras escribe, el borrador se guarda (T2)
const borradorE2E = JSON.parse(almacenSimulado.get('hazlono-borrador') || 'null');
comprobar('E2. El borrador se guarda mientras escribe', Boolean(borradorE2E));
comprobar('E2. Borrador en el paso de elección (4)', Boolean(borradorE2E) && borradorE2E.paso === 4);
comprobar('E2. El borrador tiene la decisión', Boolean(borradorE2E) && borradorE2E.respuestas.decision === 'Aprender a nadar');

// --- E3: termina
clic(botonDe(4, 'data-terminar'));
comprobar('E3. Cierre visible', visible(5));
comprobar('E3. Resumen completo', (documento.querySelector('#cierre').textContent || '').includes('Aprender a nadar'));
const historialE2E = JSON.parse(almacenSimulado.get('hazlono-historial') || '{"entradas":[]}');
comprobar('E3. Historial archiva la reflexión', historialE2E.entradas.length === 1);
comprobar('E3. Borrador borrado al archivar', almacenSimulado.get('hazlono-borrador') === undefined);

// --- E4: recarga (lo que hace el INICIO):
// sin borrador → bienvenida; el historial
// pervive
api.mostrarPaso(0, false);
api.borrador.restaurar();
comprobar('E4. Recarga: vuelve a la bienvenida', visible(0));
comprobar('E4. El historial pervive', almacenSimulado.get('hazlono-historial') !== undefined);

// --- E5: segunda reflexión («viajar a Japón»)
clic(botonDe(0, 'data-empezar')); // bienvenida → umbral (1.1.1)
clic(botonDe(0, 'data-avanzar')); // umbral → decisión
escribir(documento.querySelector('#decision'), 'Viajar a Japón');
clic(botonDe(1, 'data-avanzar'));
escribir(documento.querySelector('#consecuencias-hacer'), 'Fotos y recuerdos');
escribir(documento.querySelector('#consecuencias-no-hacer'), 'Me lo pierdo');
clic(botonDe(2, 'data-avanzar'));
escribir(documento.querySelector('#consecuencias-importantes'), 'Mi curiosidad');
escribir(documento.querySelector('#ganancias-sacrificios'), 'Mis ahorros');
clic(botonDe(3, 'data-avanzar'));
const radioE2E2 = raiz.querySelector('input[name="eleccion"][value="no-hacerlo"]');
radioE2E2.checked = true;
radioE2E2.dispatch('change', { target: radioE2E2 });
escribir(documento.querySelector('#motivo'), 'Ahora no es el momento');
clic(botonDe(4, 'data-terminar'));
const historialE2E2 = JSON.parse(almacenSimulado.get('hazlono-historial')).entradas;
comprobar('E5. Segunda reflexión archivada', historialE2E2.length === 2);

// --- E6: abre el historial (reciente primero)
clic(botonHistorial);
comprobar('E6. El historial muestra 2 entradas', documento.querySelector('#lista-historial').children.length === 2);
comprobar('E6. La más reciente primero', (documento.querySelector('#lista-historial').children[0].textContent || '').includes('Viajar a Japón'));
comprobar('E6. La elección se ve (NO HACERLO)', (documento.querySelector('#lista-historial').children[0].textContent || '').includes('NO HACERLO'));

// --- E7: borra el historial (doble
// pulsación; con reloj controlado,
// como en T7)
const timersT9 = [];
global.setTimeout = (fn2, ms) => { timersT9.push({ fn: fn2, ms }); return timersT9.length; };
const botonBorrarE2E = raiz.querySelector('[data-borrar-historial]');
clic(botonBorrarE2E);
comprobar('E7. Primera pulsación pide confirmación', (botonBorrarE2E.textContent || '') === '¿Seguro? Pulsa de nuevo');
clic(botonBorrarE2E);
comprobar('E7. Historial borrado', almacenSimulado.get('hazlono-historial') === undefined);
comprobar('E7. Queda el estado vacío', !documento.querySelector('#historial-vacio').hidden);
global.setTimeout = (fn2) => { fn2(); return 0; };

// --- E8: reinicia desde el menú: todo
// vuelve a cero
clic(botonReiniciarMenu);
comprobar('E8. Reiniciar: bienvenida', visible(0));
comprobar('E8. Respuestas vacías', Object.values(api.respuestas).every(v => v === ''));
comprobar('E8. Sin borrador ni historial', almacenSimulado.get('hazlono-borrador') === undefined && almacenSimulado.get('hazlono-historial') === undefined);

console.log('23. El umbral de la bienvenida (1.1.1)');
// Estado inicial: solo la invitación
const umbral = documento.querySelector('.bienvenida-umbral');
const inicial = documento.querySelector('.bienvenida-inicial');
comprobar('El umbral existe y empieza oculto', Boolean(umbral) && umbral.hidden);
comprobar('La invitación inicial es visible', !inicial.hidden);
// Pulsar «Comienza la reflexión» muestra el umbral
const botonEmpezar = raiz.querySelector('button[data-empezar]');
const tituloUmbral = documento.querySelector('#titulo-umbral');
clic(botonEmpezar);
comprobar('El umbral se muestra', !umbral.hidden && inicial.hidden);
comprobar('La sección lleva .en-umbral', api.secciones[0].classList.contains('en-umbral'));
comprobar('La sección anuncia el título del umbral', api.secciones[0].getAttribute('aria-labelledby') === 'titulo-umbral');
comprobar('Foco en el título del umbral (accesibilidad)', tituloUmbral._foco === true);
// Nota: el texto del umbral es markup estático
// (el shim no parsea texto): se verifica en
// el navegador real.
// El botón «Comenzar cuando quieras» entra al paso 1
clic(botonDe(0, 'data-avanzar'));
comprobar('«Comenzar cuando quieras» entra a Decisión', visible(1));
comprobar('El umbral se retira al entrar', umbral.hidden && !inicial.hidden);
// Volver atrás (retroceder) también retira el umbral
clic(botonDe(1, 'data-retroceder'));
comprobar('Retroceder a la bienvenida retira el umbral', !api.secciones[0].classList.contains('en-umbral'));
// «Volver» dentro del umbral regresa a la invitación
clic(botonDe(0, 'data-empezar'));
const botonVolver = raiz.querySelector('button[data-volver]');
clic(botonVolver);
comprobar('«Volver» oculta el umbral', umbral.hidden && !inicial.hidden);
comprobar('«Volver» devuelve el foco al título inicial', documento.querySelector('#titulo-bienvenida')._foco === true);
// Reiniciar deja la bienvenida limpia
clic(botonDe(0, 'data-empezar'));
clic(botonReiniciarMenu);
comprobar('Reiniciar limpia el umbral', !api.secciones[0].classList.contains('en-umbral') && !inicial.hidden);

console.log('24. Respiración guiada (1.1.2)');
const normalUmbral = documento.querySelector('.umbral-normal');
const guiaUmbral = documento.querySelector('.umbral-respiracion');
const anilloUmbral = documento.querySelector('.anillo-respiracion');
const faseEl = documento.querySelector('#fase-respiracion');
const botonRespirar = raiz.querySelector('button[data-respirar]');
const botonSaltar = raiz.querySelector('button[data-saltar]');
comprobar('El botón «Respirar conmigo» existe', Boolean(botonRespirar));
comprobar('La guía existe y empieza oculta', Boolean(guiaUmbral) && guiaUmbral.hidden);
comprobar('El modo normal del umbral está visible', !normalUmbral.hidden);
// Reloj controlado: la respiración es
// tiempo (el stub síncrono ejecutaría
// los 3 ciclos al instante).
const timersR = [];
global.setTimeout = (fn, ms) => { timersR.push({ fn, ms }); return timersR.length; };
// Entrar al modo respiración
clic(botonDe(0, 'data-empezar'));
clic(botonRespirar);
comprobar('La guía se muestra', !guiaUmbral.hidden);
comprobar('El modo normal se oculta', normalUmbral.hidden);
comprobar('El anillo pasa a modo guía (.guiado)', anilloUmbral.classList.contains('guiado'));
comprobar('La fase «Inhala» se anuncia', (faseEl.textContent || '') === 'Inhala');
comprobar('Foco en «Saltar» (accesibilidad)', botonSaltar._foco === true);
// Saltar: sale de la respiración
clic(botonSaltar);
comprobar('Saltar oculta la guía', guiaUmbral.hidden);
comprobar('Vuelve el modo normal', !normalUmbral.hidden);
comprobar('El anillo pierde .guiado', !anilloUmbral.classList.contains('guiado'));
comprobar('Foco de vuelta al título del umbral', tituloUmbral._foco === true);
// Restaurar el stub síncrono
global.setTimeout = (fn) => { fn(); return 0; };

console.log('25. Clic consciente (1.1.3)');
// Estado limpio: bienvenida inicial
clic(botonReiniciarMenu);
comprobar('Estado limpio: bienvenida', visible(0));
// 1) Clic en zonas que NO son botones no avanzan
const h2Bienvenida = documento.querySelector('#titulo-bienvenida');
clic(h2Bienvenida); // el título no es un botón
comprobar('Clic en el título no avanza', visible(0));
const divInicial = documento.querySelector('.bienvenida-inicial');
clic(divInicial); // el contenedor no es un botón
comprobar('Clic en el contenedor no avanza', visible(0));
// 2) El avance exige el botón explícito
clic(botonDe(0, 'data-empezar'));
comprobar('Solo el botón data-empezar muestra el umbral', !documento.querySelector('.bienvenida-umbral').hidden);
// 3) En el umbral, clic fuera de los botones no hace nada
const divUmbral = documento.querySelector('.bienvenida-umbral');
clic(divUmbral); // el fondo del umbral no es un botón
comprobar('Clic en el fondo del umbral no avanza', visible(0) && !divUmbral.hidden);
// 4) Doble clic durante la transición: el segundo se ignora
const timersC = [];
global.setTimeout = (fn, ms) => { timersC.push({ fn, ms }); return timersC.length; };
clic(botonDe(0, 'data-avanzar')); // primera: empieza la transición
clic(botonDe(0, 'data-avanzar')); // segunda: ignorada (transicionando)
comprobar('Doble clic avanza solo una vez', visible(1));
// Limpiar la transición pendiente
const pendienteC = timersC.pop();
if (pendienteC) {
    pendienteC.fn();
}
global.setTimeout = (fn) => { fn(); return 0; };
// 5) El formulario no tiene botón submit (sin envío accidental)
const submitEnFormulario = documento.querySelector('#reflexion button[type="submit"]');
comprobar('No hay botón submit en el formulario', !submitEnFormulario);
// 6) Todos los botones de navegación son type="button" (no envían el formulario)
const botonesNavegacion = raiz.querySelectorAll('#reflexion button[data-avanzar], #reflexion button[data-retroceder], #reflexion button[data-terminar], #reflexion button[data-empezar]');
const todosTypeButton = Array.from(botonesNavegacion).every(b => b.attrs.type === 'button');
comprobar('Los botones de navegación son type="button"', todosTypeButton);

console.log('\n' + (fallos === 0 ? '✅ TODAS LAS PRUEBAS PASARON' : '❌ ' + fallos + ' FALLO(S)'));
process.exit(fallos === 0 ? 0 : 1);

