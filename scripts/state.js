/* ==========================================================================
   Hazlo o No — Estado de la aplicación
   --------------------------------------------------------------------------
   Módulo central: estado global, referencias
   al DOM, navegación entre pasos e historial.

   JavaScript mínimo (progressive enhancement):
   1. Pantalla fija: las secciones se superponen y solo
      la que tiene la clase .activa es visible.
   2. Navegación con transiciones direccionales
      (adelante → derecha, atrás → izquierda).
   3. Aguja del logo + ambiente según la elección.
   4. Borrador local: la reflexión en curso persiste
      en el navegador (Pilar 1 · T1: esquema).

   Importa utilidades (persistencia), el logotipo
   (vista) y el formulario (umbral). Las dependencias
   circulares son seguras: todo el acceso ocurre en
   tiempo de ejecución, nunca al cargar los módulos.

   Sin dependencias externas. Si JS falla, el HTML
   sigue siendo legible completo en flujo normal.
   ========================================================================== */

import {
    almacenLocal, guardarPronto, borrarBorrador,
    cancelarGuardado, movimientoReducido
} from './utils.js';
import { actualizarLogo, actualizarAmbiente } from './components/logo.js';
import { ocultarUmbral } from './components/form.js';

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
// y aparece desde el paso 2).
const navIndicador = document.querySelector('nav[aria-label="Progreso de la reflexión"]');

// Los 5 ítems del indicador de progreso (<nav><ol><li>).
const pasosIndicador = [
    ...document.querySelectorAll('nav[aria-label="Progreso de la reflexión"] li')
];

// Menú principal de la cabecera.
export const menu = document.querySelector('nav[aria-label="Menú principal"]');

// Las 6 secciones del flujo (5 pasos + cierre), en orden.
export const secciones = [...document.querySelectorAll('#reflexion section')];

// Pie de página: dónde está el usuario + consejo rotativo.
const piePaso = document.querySelector('#pie-paso');
export const pieConsejo = document.querySelector('#pie-consejo');

/* --------------------------------------------------------------------------
   ESTADO DE LA APLICACIÓN
   -------------------------------------------------------------------------- */

// Índice de la sección visible (0 = bienvenida).
export let pasoActual = 0;

// Evita clics duplicados mientras dura una transición.
export let transicionando = false;

// Respuestas del usuario. Se mantienen en memoria
// y se persisten como borrador (ver utils.js).
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

// Nombres de los 5 pasos (para el pie de página).
export const nombresPaso = ['Bienvenida', 'Decisión', 'Consecuencias', 'Reflexión', 'Elección', 'Cierre'];

/* --------------------------------------------------------------------------
   FUNCIONES DE ESTADO
   -------------------------------------------------------------------------- */

/**
 * Escribe un mensaje de error accesible dentro de una sección.
 * @param {HTMLElement} seccion - Sección que contiene <p role="alert">.
 * @param {string} texto        - Mensaje a anunciar.
 */
export function mostrarError(seccion, texto) {
    const mensaje = seccion.querySelector('p[role="alert"]');
    if (mensaje) {
        mensaje.textContent = texto; // role="alert" lo anuncia al instante

        // Reactiva el fade de entrada: quitar y
        // volver a poner la clase reinicia la
        // animación (solo si hay mensaje).
        mensaje.classList.remove('entrando');
        void mensaje.offsetWidth; // reflujo forzado
        if (texto) {
            mensaje.classList.add('entrando');
        }
    }
}

/**
 * Actualiza el pie de página: dónde está el usuario.
 * @param {number} indice - Índice de la sección actual.
 */
export function actualizarPie(indice) {
    if (!piePaso) {
        return;
    }

    if (indice === 0) {
        piePaso.textContent = 'Bienvenida';
    } else if (indice >= secciones.length - 1) {
        piePaso.textContent = 'Reflexión completa ✓';
    } else {
        piePaso.textContent = `Paso ${indice} de 5 · ${nombresPaso[indice]}`;
    }
}

/**
 * Actualiza el estado lógico y accesible del paso,
 * sin cambiar la visibilidad de las secciones:
 * indicador de progreso, pie, resumen, aguja y ambiente.
 * @param {number} indice - Índice de la sección actual.
 */
export function actualizarEstado(indice) {
    pasoActual = indice;

    // Visual de la marca: en la primera
    // pantalla (bienvenida) el logo tiene
    // todo el escenario; en los pasos
    // pasa a segundo plano (ver base.css,
    // apartado 4).
    document.body.classList.toggle('en-flujo', indice !== 0);

    // Indicador de progreso: oculto en la bienvenida (paso 0),
    // visible desde el paso 2. Entra con fade (ver base.css).
    navIndicador.hidden = indice === 0;

    // Marcar el paso activo con aria-current="step"
    // (los lectores de pantalla lo anuncian).
    // El cierre es el resumen de la reflexión, no un
    // paso nuevo: el indicador se queda en "Elección",
    // la última decisión del usuario.
    const ultimoPaso = pasosIndicador.length - 2;
    const pasoActivo = Math.min(indice, ultimoPaso);
    pasosIndicador.forEach((item, i) => {
        if (i === pasoActivo) {
            item.setAttribute('aria-current', 'step');
        } else {
            item.removeAttribute('aria-current');
        }
    });

    // Pie de página.
    actualizarPie(indice);

    // En la pantalla de reflexión, recordar al usuario sobre qué
    // está reflexionando (resumen en vivo, aria-live="polite").
    if (indice === 3) {
        const resumen = document.querySelector('#resumen-decision');
        if (resumen && respuestas.decision) {
            resumen.textContent = `Estás reflexionando sobre: «${respuestas.decision}»`;
        }
    }

    // Aguja del logo (progreso + decisión)
    // y ambiente de la pantalla.
    actualizarLogo();
    actualizarAmbiente();
}

/**
 * Mueve el foco al título de una sección para que los
 * lectores de pantalla anuncien el nuevo paso
 * (tabindex="-1" lo hace enfocable sin añadirlo
 * al orden de tabulación).
 * @param {HTMLElement} seccion
 */
export function enfocarTitulo(seccion) {
    const titulo = seccion.querySelector('h2');
    titulo.setAttribute('tabindex', '-1');
    titulo.focus({ preventScroll: true });
}

/* --------------------------------------------------------------------------
   HISTORIAL (Pilar 1 · T5)
   Al terminar, la reflexión completa pasa
   al historial y el borrador se borra: la
   reflexión ya no está "en curso".
   -------------------------------------------------------------------------- */

// Clave del historial y tope de entradas
// guardadas (las más antiguas se descartan).
const CLAVE_HISTORIAL = 'hazlono-historial';
const MAX_ENTRADAS = 50;

/**
 * Esquema del historial (v1):
 * {
 *   "version": 1,
 *   "entradas": [
 *     { "decision": "...", "eleccion": "hacerlo"|"no-hacerlo",
 *       "motivo": "...", "fecha": "ISO 8601" }
 *   ]
 * }
 * @typedef {Object} EntradaHistorial
 * @property {string} decision
 * @property {string} eleccion
 * @property {string} motivo
 * @property {string} fecha
 */

/**
 * Lee el historial guardado, sanitizado:
 * versión conocida, entradas con campos de
 * texto (máx. 2000 caracteres) y elección
 * válida. @returns {EntradaHistorial[]} la lista (vacía si no hay).
 */
export function leerHistorial() {
    const almacen = almacenLocal();
    if (!almacen) {
        return [];
    }
    try {
        const crudo = almacen.getItem(CLAVE_HISTORIAL);
        if (!crudo) {
            return [];
        }
        const datos = JSON.parse(crudo);
        if (!datos || Number(datos.version) !== 1 || !Array.isArray(datos.entradas)) {
            return [];
        }
        const entradas = [];
        for (const entrada of datos.entradas) {
            if (!entrada || typeof entrada !== 'object') {
                continue;
            }
            const texto = (valor) =>
                (typeof valor === 'string') ? valor.slice(0, 2000) : '';
            const eleccion =
                (entrada.eleccion === 'hacerlo' || entrada.eleccion === 'no-hacerlo')
                    ? entrada.eleccion : '';
            entradas.push({
                decision: texto(entrada.decision),
                eleccion,
                motivo: texto(entrada.motivo),
                fecha: texto(entrada.fecha)
            });
        }
        return entradas.slice(-MAX_ENTRADAS);
    } catch (e) {
        /* JSON corrupto: ignorar */
        return [];
    }
}

/**
 * Archiva la reflexión actual en el historial
 * (al terminar, T5) y borra el borrador: ya no
 * hay nada "en curso". Si el guardado falla,
 * el borrador se conserva — la reflexión no
 * se pierde.
 * @returns {boolean} true si se archivó.
 */
export function archivarReflexion() {
    const almacen = almacenLocal();
    if (!almacen) {
        return false;
    }
    try {
        const entradas = leerHistorial();
        entradas.push({
            decision: respuestas.decision,
            eleccion: respuestas.eleccion,
            motivo: respuestas.motivo,
            fecha: new Date().toISOString()
        });
        almacen.setItem(
            CLAVE_HISTORIAL,
            JSON.stringify({ version: 1, entradas: entradas.slice(-MAX_ENTRADAS) })
        );
        // Sin reflexión en curso: cancelar un
        // guardado pendiente (si no, el debounce
        // escribiría el estado del cierre) y
        // borrar el borrador.
        cancelarGuardado();
        borrarBorrador();
        return true;
    } catch (e) {
        /* almacenamiento lleno o denegado */
        return false;
    }
}

/**
 * Borra el historial guardado
 * (lo usa «Borrar historial», T7).
 * @returns {boolean} true si se borró (o no había nada).
 */
export function borrarHistorial() {
    const almacen = almacenLocal();
    if (!almacen) {
        return false;
    }
    try {
        almacen.removeItem(CLAVE_HISTORIAL);
        return true;
    } catch (e) {
        return false;
    }
}

/* --------------------------------------------------------------------------
   NAVEGACIÓN
   -------------------------------------------------------------------------- */

/**
 * Muestra el paso de forma instantánea (sin transición).
 * @param {number} indice         - Índice de la sección a mostrar.
 * @param {boolean} [enfocar=true] - Mover el foco al título.
 */
export function mostrarPaso(indice, enfocar = true) {
    // Visibilidad: solo la sección con .activa es visible.
    secciones.forEach((seccion, i) => {
        seccion.classList.toggle('activa', i === indice);
    });

    actualizarEstado(indice);

    // El umbral vive solo en la bienvenida:
    // al cambiar de paso se retira.
    ocultarUmbral();

    if (enfocar) {
        enfocarTitulo(secciones[indice]);
    }
}

/**
 * Cambia de paso con una transición direccional suave:
 * la sección actual sale por un lado y la siguiente
 * entra por el otro (0.35 s). Si el usuario prefiere
 * movimiento reducido, el cambio es instantáneo.
 * @param {number} indice              - Índice de la sección destino.
 * @param {'adelante'|'atras'} direccion - Dirección del movimiento.
 */
export function transicionarA(indice, direccion = 'adelante') {
    if (transicionando) {
        return; // Transición en curso: ignorar clics adicionales.
    }
    // El umbral vive solo en la bienvenida:
    // cualquier transición lo retira.
    ocultarUmbral();

    if (movimientoReducido() || indice === pasoActual) {
        mostrarPaso(indice);
        guardarPronto(); // T2: guardar el paso alcanzado
        return;
    }

    transicionando = true;

    const salida = secciones[pasoActual];
    const entrada = secciones[indice];

    // Clases según la dirección:
    //  adelante → la saliente va a la izquierda,
    //              la entrante viene de la derecha.
    //  atrás     → al revés.
    const desde = direccion === 'adelante' ? 'desde-derecha' : 'desde-izquierda';
    const sale = direccion === 'adelante' ? 'sale-izquierda' : 'sale-derecha';

    // 1) Estado lógico y accesible, inmediato
    //    (aria-current, pie, aguja, ambiente).
    actualizarEstado(indice);
    guardarPronto(); // T2: guardar el paso alcanzado

    // 2) La sección entrante empieza fuera de pantalla
    //    (aún invisible) y forzamos un reflujo para que
    //    el navegador aplique esa posición inicial.
    entrada.classList.add('pre-entrada', desde);
    void entrada.offsetWidth;

    // 3) Ambas se mueven: la saliente sale, la entrante entra.
    salida.classList.add(sale);
    entrada.classList.add('activa');
    entrada.classList.remove(desde);

    // 4) Al terminar la animación, se limpian las clases
    //    de transición y se mueve el foco al nuevo título.
    setTimeout(() => {
        salida.classList.remove('activa', sale);
        entrada.classList.remove('pre-entrada');
        transicionando = false;
        enfocarTitulo(entrada);
    }, 510);
}
