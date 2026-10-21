/* ==========================================================================
   Hazlo o No — Flujo de la reflexión (navegación, borrador e historial)
   --------------------------------------------------------------------------
   Este módulo coordina el flujo: a qué paso se está, cómo se
   navega, cómo se guarda la reflexión en curso y cómo se archiva
   en el historial.

   Depende de las HOJAS del grafo (datos.js y almacen.js) y de
   las vistas (logo.js y umbral.js), pero ninguna vista depende
   de él: el grafo de módulos es acíclico.

   JavaScript mínimo (progressive enhancement):
   1. Pantalla fija: las secciones se superponen y solo la
      que tiene la clase .activa es visible.
   2. Navegación con transiciones direccionales
      (adelante → derecha, atrás → izquierda).
   3. Aguja del logo + ambiente según la elección.
   4. Borrador local: la reflexión en curso persiste
      en el navegador (Pilar 1 · T1: esquema).

   Sin dependencias externas. Si JS falla, el HTML
   sigue siendo legible completo en flujo normal.
   ========================================================================== */

import {
    secciones, pasoActual, transicionando, respuestas,
    fijarPasoActual, fijarTransicionando,
    formulario, navIndicador, pasosIndicador,
    piePaso, nombresPaso,
    obtenerIdReflexion, fijarIdReflexion
} from './datos.js';
import { almacenLocal, movimientoReducido } from './almacen.js';
import { actualizarLogo, actualizarAmbiente } from './components/logo.js';
import { ocultarUmbral } from './components/umbral.js';

/* --------------------------------------------------------------------------
   ERRORES Y FOCO
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
 * Enfoca un elemento cuando el navegador ya PUEDE hacerlo.
 *
 * Al cambiar de paso, la sección entrante acaba de recibir
 * la clase .activa pero todavía no es "renderizable": su
 * `visibility` pasa de hidden a visible en el siguiente
 * fotograma. Enfocar en ese instante lo rechaza el
 * navegador (el foco se quedaría en <body> y el lector de
 * pantalla no anunciaría el paso nuevo), así que el foco
 * se aplaza al fotograma siguiente.
 *
 * Con dos fotogramas: el primero aplica el cambio de
 * estilo, el segundo enfoca sobre un elemento ya visible.
 * @param {HTMLElement} elemento - Elemento a enfocar.
 */
function enfocarEnFotograma(elemento) {
    const aplicar = () => {
        try {
            elemento.focus({ preventScroll: true });
        } catch (e) {
            /* el navegador no permite el foco: se ignora */
        }
    };
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(aplicar));
    } else {
        setTimeout(aplicar, 0);
    }
}

/**
 * Mueve el foco al título de una sección para que los
 * lectores de pantalla anuncien el nuevo paso
 * (tabindex="-1" lo hace enfocable sin añadirlo
 * al orden de tabulación).
 * @param {HTMLElement} seccion
 */
export function enfocarTitulo(seccion) {
    if (!seccion) {
        return;
    }
    const titulo = seccion.querySelector('h2');
    if (!titulo) {
        return;
    }
    titulo.setAttribute('tabindex', '-1');
    enfocarEnFotograma(titulo);
}

/* --------------------------------------------------------------------------
   NAVEGACIÓN
   -------------------------------------------------------------------------- */

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
    // El estado vive en datos.js; aquí se refleja en el DOM.
    fijarPasoActual(indice);

    // Visual de la marca: en la primera
    // pantalla (bienvenida) el logo tiene
    // todo el escenario; en los pasos
    // pasa a segundo plano (ver base.css,
    // apartado 4).
    document.body.classList.toggle('en-flujo', indice !== 0);

    // Indicador de progreso: oculto en la bienvenida (paso 0),
    // visible desde el paso 1 (Decisión). Entra con fade
    // (ver base.css).
    navIndicador.hidden = indice === 0;

    // Marcar el paso activo con aria-current="step"
    // (los lectores de pantalla lo anuncian).
    // El cierre es el resumen de la reflexión, no un
    // paso nuevo: el indicador se queda en "Elección",
    // la última decisión del usuario.
    const ultimoPaso = pasosIndicador.length - 1;
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

    fijarTransicionando(true);

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
        fijarTransicionando(false);
        enfocarTitulo(entrada);
    }, 510);
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
 *   "id":        "r…",       // identidad de la reflexión
 *                                // (el historial actualiza
 *                                // la entrada en vez de
 *                                // duplicarla)
 *   "paso":      0..5,       // índice de la
 *                                // sección (0 = bienvenida)
 *   "respuestas": { ... },   // las 7 respuestas
 *   "guardado":  "ISO 8601"  // cuándo se guardó
 * }
 * @typedef {Object} Borrador
 * @property {number} version
 * @property {string} id
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
            id: obtenerIdReflexion(),
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
            id: (typeof datos.id === 'string') ? datos.id.slice(0, 64) : '',
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

/* Al cerrar la pestaña: si hay un guardado pendiente (el debounce
   no llegó a dispararse), guardar igual — los últimos textos no se
   pierden. Se escuchan varios eventos porque "beforeunload" no es
   fiable en móvil (iOS Safari lo ignora con frecuencia): "pagehide"
   y "visibilitychange" cubren esos casos.
   (El entorno de pruebas no tiene window.addEventListener: se omite
   allí.) */
if (window.addEventListener) {
    const guardarSiQuedaPendiente = () => {
        if (temporizadorBorrador) {
            guardarBorrador(pasoActual);
        }
    };

    window.addEventListener('beforeunload', guardarSiQuedaPendiente);
    window.addEventListener('pagehide', guardarSiQuedaPendiente);

    // La pestaña pasa a segundo plano (o se cierra): el
    // navegador puede descartar la página sin avisar.
    if (document.addEventListener) {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                guardarSiQuedaPendiente();
            }
        });
    }
}

/**
 * Restaura el borrador guardado (T3): vuelve
 * al paso donde se quedó el usuario, con los
 * campos rellenos y la aguja en posición.
 * Sin borrador: no hace nada (la bienvenida
 * ya está visible).
 *
 * La vista (el estado emocional y el resumen
 * del cierre) la actualiza la raíz (main.js):
 * aquí sólo se restaura el estado.
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

    // La reflexión conserva su identidad (así, si vuelve
    // más tarde para modificar su elección, el historial
    // actualiza la entrada en vez de duplicarla).
    if (borrador.id) {
        fijarIdReflexion(borrador.id);
    }

    // Volver al paso donde se quedó (sin mover
    // el foco: la carga no interrumpe).
    mostrarPaso(borrador.paso, false);

    return true;
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
 *     { "id": "...", "decision": "...",
 *       "eleccion": "hacerlo"|"no-hacerlo",
 *       "motivo": "...", "fecha": "ISO 8601" }
 *   ]
 * }
 * El "id" identifica la reflexión: si el usuario vuelve
 * atrás para modificar su elección, la entrada se ACTUALIZA
 * en vez de duplicarse. Las entradas antiguas (sin id)
 * siguen siendo válidas.
 * @typedef {Object} EntradaHistorial
 * @property {string} id
 * @property {string} decision
 * @property {string} eleccion
 * @property {string} motivo
 * @property {string} fecha
 */

/**
 * Comprueba si una fecha es utilizable: evita que una
 * fecha corrupta se muestre como "Invalid Date" en el
 * historial.
 * @param {string} fecha - Fecha en formato ISO 8601.
 * @returns {boolean}
 */
function fechaValida(fecha) {
    if (!fecha || typeof fecha !== 'string') {
        return false;
    }
    return !isNaN(Date.parse(fecha));
}

/**
 * Lee el historial guardado, sanitizado:
 * versión conocida, entradas con campos de
 * texto (máx. 2000 caracteres), elección
 * válida y fecha utilizable.
 * @returns {EntradaHistorial[]} la lista (vacía si no hay).
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
            const fecha = texto(entrada.fecha);
            entradas.push({
                id: texto(entrada.id).slice(0, 64),
                decision: texto(entrada.decision),
                eleccion,
                motivo: texto(entrada.motivo),
                fecha: fechaValida(fecha) ? fecha : ''
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
 *
 * Si la reflexión ya estaba archivada (el usuario volvió
 * atrás para modificar su elección), la entrada se
 * ACTUALIZA en lugar de duplicarse.
 * @returns {boolean} true si se archivó.
 */
export function archivarReflexion() {
    const almacen = almacenLocal();
    if (!almacen) {
        return false;
    }
    try {
        const id = obtenerIdReflexion();
        const entradas = leerHistorial();
        const entrada = {
            id,
            decision: respuestas.decision,
            eleccion: respuestas.eleccion,
            motivo: respuestas.motivo,
            fecha: new Date().toISOString()
        };
        // La misma reflexión: se retira la entrada previa
        // y se añade la versión actualizada (así queda
        // siempre como la más reciente).
        const indice = entradas.findIndex((e) => e.id && e.id === id);
        if (indice >= 0) {
            entradas.splice(indice, 1);
        }
        entradas.push(entrada);
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
