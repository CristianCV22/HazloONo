/* ==========================================================================
   Hazlo o No - Utilidades (almacenamiento local y preferencias)
   ==========================================================================
   Módulo de utilidades: acceso seguro al
   almacenamiento local, preferencia de
   animaciones y borrador (guardado, lectura
   y restauración).

   Depende del estado global (state.js) para
   el paso y las respuestas, y del formulario
   para rehacer el cierre al restaurar. La
   dependencia circular es segura: todo el
   acceso a esos módulos ocurre dentro de
   funciones (tiempo de ejecución), nunca
   al cargar.
   ========================================================================== */

import {
    secciones, respuestas, pasoActual, formulario,
    mostrarPaso
} from './state.js';
import { prepararCierre, actualizarEmocionUI } from './components/form.js';

/* --------------------------------------------------------------------------
   PREFERENCIA DE ANIMACIONES
   -------------------------------------------------------------------------- */

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

/* --------------------------------------------------------------------------
   BORRADOR LOCAL (Pilar 1 · T1: esquema de datos)
   --------------------------------------------------------------------------
   Una sola clave, un solo JSON. La reflexión
   en curso no se pierde si cierras la pestaña
   (T2 la guardará mientras escribes; T3 la
   restaurará al volver). Todo queda en el
   navegador: nunca sale del equipo.
   -------------------------------------------------------------------------- */

// Clave del borrador en el almacenamiento local.
const CLAVE_BORRADOR = 'hazlono-borrador';

/**
 * Esquema del borrador (v1):
 * {
 *   "version":   1,          // por si el esquema
 *                                // cambia (migración)
 *   "paso":      0..5,       // índice de la
 *                                // sección (0 = bienvenida)
 *   "respuestas": { ... },   // las 7 respuestas
 *   "guardado":  "ISO 8601"  // cuándo se guardó
 * }
 * @typedef {Object} Borrador
 * @property {number} version
 * @property {number} paso
 * @property {Object.<string, string>} respuestas
 * @property {string} guardado
 */

/**
 * Guarda el borrador actual (paso + respuestas).
 * Falla en silencio: sin almacenamiento (o si
 * está lleno/denegado), la reflexión simplemente
 * no persiste — la app sigue funcionando.
 * @param {number} paso - Índice de la sección actual.
 * @returns {boolean} true si se guardó.
 */
export function guardarBorrador(paso) {
    const almacen = almacenLocal();
    if (!almacen) {
        return false;
    }
    try {
        const borrador = {
            version: 1,
            paso: Math.max(0, Math.min(paso, secciones.length - 1)),
            respuestas: { ...respuestas },
            guardado: new Date().toISOString()
        };
        almacen.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
        return true;
    } catch (e) {
        /* almacenamiento lleno o denegado */
        return false;
    }
}

/**
 * Lee el borrador guardado, si existe y es
 * válido. Sanitiza: versión conocida, paso en
 * rango, solo las clases de respuesta conocidas
 * y solo cadenas (limitadas a 2000 caracteres).
 * @returns {Borrador|null} el borrador, o null.
 */
export function leerBorrador() {
    const almacen = almacenLocal();
    if (!almacen) {
        return null;
    }
    try {
        const crudo = almacen.getItem(CLAVE_BORRADOR);
        if (!crudo) {
            return null;
        }
        const datos = JSON.parse(crudo);
        if (!datos || typeof datos !== 'object') {
            return null;
        }
        if (Number(datos.version) !== 1) {
            return null; // versión futura: no arriesgar
        }
        const paso = Number(datos.paso);
        if (!Number.isInteger(paso) || paso < 0 || paso > secciones.length - 1) {
            return null;
        }
        const respuestasSeguras = {};
        for (const clave of Object.keys(respuestas)) {
            const valor = datos.respuestas && datos.respuestas[clave];
            respuestasSeguras[clave] =
                (typeof valor === 'string') ? valor.slice(0, 2000) : '';
        }
        return {
            version: 1,
            paso,
            respuestas: respuestasSeguras,
            guardado: (typeof datos.guardado === 'string') ? datos.guardado : ''
        };
    } catch (e) {
        /* JSON corrupto: ignorar */
        return null;
    }
}

/**
 * Borra el borrador guardado (lo usa «Reiniciar»,
 * T4; y al archivar la reflexión, T5).
 * @returns {boolean} true si se borró (o no había nada).
 */
export function borrarBorrador() {
    const almacen = almacenLocal();
    if (!almacen) {
        return false;
    }
    try {
        almacen.removeItem(CLAVE_BORRADOR);
        return true;
    } catch (e) {
        return false;
    }
}

/* Guardado automático (T2): la reflexión se
   guarda ~300 ms después de la última tecla.
   Debounce: cada llamada cancela la anterior,
   así se guarda cuando el usuario hace una
   pausa — no en cada pulsación.
   El temporizador es PRIVADO de este módulo:
   se cancela con cancelarGuardado(). */
let temporizadorBorrador = null;
const RETARDO_BORRADOR = 300; // ms

/**
 * Programa el guardado del borrador con el
 * paso y las respuestas ACTUALES.
 */
export function guardarPronto() {
    cancelarGuardado();
    temporizadorBorrador = setTimeout(() => {
        temporizadorBorrador = null;
        guardarBorrador(pasoActual);
    }, RETARDO_BORRADOR);
}

/**
 * Cancela un guardado pendiente (lo usan
 * «Reiniciar» y «Terminar»: sin reflexión
 * en curso, el debounce no debe escribir).
 */
export function cancelarGuardado() {
    if (temporizadorBorrador) {
        clearTimeout(temporizadorBorrador);
        temporizadorBorrador = null;
    }
}

/* Al cerrar la pestaña: si hay un guardado
   pendiente (el debounce no llegó a dispararse),
   guardar igual — los últimos textos no se
   pierden. (El entorno de pruebas no tiene
   window.addEventListener: se omite allí.) */
if (window.addEventListener) {
    window.addEventListener('beforeunload', () => {
        if (temporizadorBorrador) {
            guardarBorrador(pasoActual);
        }
    });
}

/**
 * Restaura el borrador guardado (T3): vuelve
 * al paso donde se quedó el usuario, con los
 * campos rellenos y la aguja en posición.
 * Sin borrador: no hace nada (la bienvenida
 * ya está visible).
 * @returns {boolean} true si se restauró.
 */
export function restaurarBorrador() {
    const borrador = leerBorrador();
    if (!borrador) {
        return false;
    }

    // Respuestas en memoria y en los campos
    // (solo textareas: los radios se marcan
    // aparte, más abajo).
    for (const clave of Object.keys(borrador.respuestas)) {
        respuestas[clave] = borrador.respuestas[clave];
        if (clave === 'eleccion') {
            continue;
        }
        const campo = formulario.querySelector(`textarea[name="${clave}"]`);
        if (campo) {
            campo.value = borrador.respuestas[clave];
        }
    }

    // La elección (radio) refleja lo guardado.
    if (respuestas.eleccion) {
        const radio = formulario.querySelector(
            `input[name="eleccion"][value="${respuestas.eleccion}"]`
        );
        if (radio) {
            radio.checked = true;
        }
    }

    // Volver al paso donde se quedó (sin mover
    // el foco: la carga no interrumpe).
    actualizarEmocionUI();
    mostrarPaso(borrador.paso, false);

    // En el cierre, rehacer el resumen con
    // las respuestas restauradas.
    if (borrador.paso === secciones.length - 1) {
        prepararCierre();
    }

    return true;
}
