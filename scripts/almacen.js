/* ==========================================================================
   Hazlo o No - Almacenamiento local y preferencias
   ==========================================================================
   Módulo sin dependencias (hoja del grafo): acceso seguro al
   almacenamiento local y la preferencia de animaciones.

   Todo el acceso falla en silencio: si el navegador no
   permite guardar (denegado, lleno o modo estricto), la app
   sigue funcionando; solo se pierde la persistencia.

   El borrador y el historial viven en state.js (son estado
   de la aplicación); aquí solo está el acceso al almacén.
   ========================================================================== */

// Clave de la preferencia en el navegador.
const CLAVE_ANIMACION = 'hazlono-animacion'; // seguir | activar | desactivar

/**
 * Acceso seguro al almacenamiento local
 * (en entornos sin localStorage la preferencia
 * no persiste: no es un error, solo una
 * limitación del entorno).
 * @returns {Storage|null}
 */
export function almacenLocal() {
    try {
        if (typeof localStorage !== 'undefined') {
            return localStorage;
        }
    } catch (e) {
        /* almacenamiento no disponible */
    }
    return null;
}

/**
 * Comprueba si el almacenamiento
 * local funciona de verdad (T8):
 * escribir y leer una clave de
 * prueba. Cubre el almacenamiento
 * denegado (políticas, modos
 * privados estrictos) y lleno.
 * @returns {boolean} true si se puede guardar.
 */
export function almacenamientoDisponible() {
    const almacen = almacenLocal();
    if (!almacen) {
        return false;
    }
    try {
        const clave = 'hazlono-prueba';
        almacen.setItem(clave, '1');
        const valor = almacen.getItem(clave);
        almacen.removeItem(clave);
        return valor === '1';
    } catch (e) {
        /* almacenamiento lleno o denegado */
        return false;
    }
}

/**
 * Lee la preferencia de animaciones del usuario.
 * @returns {'seguir'|'activar'|'desactivar'}
 */
export function leerPreferenciaAnimacion() {
    const almacen = almacenLocal();
    if (!almacen) {
        return 'seguir';
    }
    try {
        const valor = almacen.getItem(CLAVE_ANIMACION);
        if (valor === 'activar' || valor === 'desactivar') {
            return valor;
        }
    } catch (e) {
        /* lectura denegada */
    }
    return 'seguir';
}

/**
 * ¿Debe reducirse el movimiento AHORA?
 * La preferencia del usuario puede anular la
 * del sistema: accesibilidad con agencia
 * (el sistema manda, salvo que el usuario
 * decida lo contrario).
 * @returns {boolean}
 */
export function movimientoReducido() {
    const preferencia = leerPreferenciaAnimacion();
    if (preferencia === 'activar') {
        return false;
    }
    if (preferencia === 'desactivar') {
        return true;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Aplica la preferencia al documento: las clases
 * en <html> permiten que CSS anule (o respete)
 * el ajuste del sistema. También marca la opción
 * elegida en el diálogo y muestra una nota cuando
 * el sistema tiene las animaciones reducidas.
 */
export function aplicarPreferenciaAnimacion() {
    const preferencia = leerPreferenciaAnimacion();
    document.documentElement.classList.toggle('fuerza-animacion', preferencia === 'activar');
    document.documentElement.classList.toggle('fuerza-reduccion', preferencia === 'desactivar');

    const nota = document.querySelector('#nota-animacion');
    if (nota) {
        const sistemaReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        nota.hidden = !sistemaReducido;
    }

    const opcion = document.querySelector(`input[name="animacion"][value="${preferencia}"]`);
    if (opcion) {
        opcion.checked = true;
    }
}

/**
 * Guarda la preferencia de animaciones.
 * @param {'seguir'|'activar'|'desactivar'} preferencia
 */
export function guardarPreferenciaAnimacion(preferencia) {
    const almacen = almacenLocal();
    if (almacen) {
        try {
            almacen.setItem(CLAVE_ANIMACION, preferencia);
        } catch (e) {
            /* escritura denegada */
        }
    }
}
