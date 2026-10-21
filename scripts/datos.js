/* ==========================================================================
   Hazlo o No - Datos de la aplicación (estado y DOM)
   --------------------------------------------------------------------------
   Este módulo es una HOJA del grafo: no importa nada.
   Aquí viven las respuestas del usuario, el paso actual y las
   referencias al DOM que todos los demás módulos comparten.

   Al no depender de nadie, cualquier módulo puede importarlo
   sin crear ciclos: es la base sobre la que se apoya todo lo
   demás (datos → vistas → flujo → componentes → raíz).
   ========================================================================== */

/* --------------------------------------------------------------------------
   REFERENCIAS AL DOM
   -------------------------------------------------------------------------- */
export const formulario = document.querySelector('#reflexion');
export const logo = document.querySelector('.logo');

// Clases de paso para la aguja: la aguja es
// el indicador de progreso de la reflexión
// (barre de izquierda a derecha, ver logo.css).
export const clasesPaso = ['paso-0', 'paso-1', 'paso-2', 'paso-3', 'paso-4'];

// Indicador de progreso (se oculta en la bienvenida
// y aparece desde el paso 1).
export const navIndicador = document.querySelector('nav[aria-label="Progreso de la reflexión"]');

// Los 5 ítems del indicador de progreso (<nav><ol><li>).
export const pasosIndicador = [
    ...document.querySelectorAll('nav[aria-label="Progreso de la reflexión"] li')
];

// Menú principal de la cabecera.
export const menu = document.querySelector('nav[aria-label="Menú principal"]');

// Las 6 secciones del flujo (5 pasos + cierre), en orden.
export const secciones = [...document.querySelectorAll('#reflexion section')];

// Pie de página: dónde está el usuario + consejo rotativo.
export const piePaso = document.querySelector('#pie-paso');
export const pieConsejo = document.querySelector('#pie-consejo');

/* --------------------------------------------------------------------------
   ESTADO DE LA APLICACIÓN
   -------------------------------------------------------------------------- */

// Índice de la sección visible (0 = bienvenida).
export let pasoActual = 0;

// Evita clics duplicados mientras dura una transición.
export let transicionando = false;

/**
 * Fija el paso visible. (Un módulo no puede asignar a
 * un `import`: el estado mutable se cambia con estas
 * funciones.)
 * @param {number} valor - Índice de la sección.
 */
export function fijarPasoActual(valor) {
    pasoActual = valor;
}

/**
 * Marca (o no) que hay una transición en curso.
 * @param {boolean} valor
 */
export function fijarTransicionando(valor) {
    transicionando = valor;
}

// Respuestas del usuario. Se mantienen en memoria
// y se persisten como borrador (ver state.js).
export const respuestas = {
    emocion: '',
    decision: '',
    consecuenciasHacer: '',
    consecuenciasNoHacer: '',
    consecuenciasImportantes: '',
    gananciasYSacrificios: '',
    eleccion: '',
    motivo: ''
};

// Nombres de los pasos (para el pie de página).
export const nombresPaso = ['Bienvenida', 'Decisión', 'Consecuencias', 'Reflexión', 'Elección', 'Cierre'];

/* --------------------------------------------------------------------------
   IDENTIDAD DE LA REFLEXIÓN
   --------------------------------------------------------------------------
   Identifica la reflexión en curso: permite ACTUALIZAR la
   entrada del historial cuando el usuario vuelve atrás para
   modificar su elección (sin esto, la misma reflexión se
   archivaría dos veces).

   Viaja con el borrador: si la pestaña se recarga, la
   reflexión conserva su identidad.
   -------------------------------------------------------------------------- */
let idReflexion = null;

/**
 * Genera un identificador de reflexión.
 * @returns {string}
 */
function generarIdReflexion() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Identificador de la reflexión en curso, creado si
 * todavía no existe.
 * @returns {string}
 */
export function obtenerIdReflexion() {
    if (!idReflexion) {
        idReflexion = generarIdReflexion();
    }
    return idReflexion;
}

/**
 * Fija el identificador de la reflexión (al restaurar
 * un borrador: la reflexión conserva su identidad).
 * @param {string} id
 */
export function fijarIdReflexion(id) {
    idReflexion = (typeof id === 'string' && id) ? id.slice(0, 64) : null;
}

/**
 * Empieza una reflexión nueva: la siguiente entrada
 * del historial será una distinta (no actualizará la
 * anterior). Lo llama «Reiniciar».
 */
export function reiniciarIdReflexion() {
    idReflexion = null;
}
