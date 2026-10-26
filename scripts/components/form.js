/* ==========================================================================
   Hazlo o No - Componente: formulario (flujo de reflexión)
   ==========================================================================
   Componente del flujo: validación por
   paso, cierre, etiquetado emocional y
   eventos del formulario.

   El umbral de la bienvenida y la respiración
   guiada viven en su propio componente
   (components/umbral.js).

   Recibe su ámbito del DOM global (el
   <form id="reflexion"> y sus secciones,
   desde datos.js) y registra sus eventos
   en initForm(): ningún listener queda
   activo hasta que la aplicación lo
   inicializa (main.js).
   ========================================================================== */

import {
    secciones, pasoActual, transicionando, respuestas,
    pieConsejo, formulario, reiniciarIdReflexion
} from '../datos.js';
import {
    mostrarError, enfocarTitulo, mostrarPaso, transicionarA,
    archivarReflexion, guardarPronto, borrarBorrador, cancelarGuardado
} from '../state.js';
import { movimientoReducido } from '../almacen.js';
import { actualizarLogo, actualizarAmbiente } from './logo.js';
import {
    mostrarUmbral, ocultarUmbral, iniciarRespiracion, terminarRespiracion
} from './umbral.js';

/* --------------------------------------------------------------------------
   VALIDACIÓN
   -------------------------------------------------------------------------- */

/**
 * Nombre legible de un campo: su etiqueta visible
 * («Consecuencias de hacerlo»). Sirve para nombrar
 * el campo en el mensaje de error: sin saber QUÉ
 * falta, el aviso es inútil.
 * @param {HTMLElement} campo - Campo a describir.
 * @returns {string} el nombre, o '' si no se puede averiguar.
 */
function nombreDelCampo(campo) {
    if (!campo || !campo.id) {
        return '';
    }
    const etiqueta = document.querySelector('label[for="' + campo.id + '"]');
    return (etiqueta && etiqueta.textContent) ? etiqueta.textContent.trim() : '';
}

/**
 * Marca un campo como inválido y lo asocia con su
 * mensaje de error: el lector de pantalla anuncia el
 * aviso (role="alert") y, al llegar al campo con el
 * teclado, lo vuelve a leer (aria-describedby).
 * @param {HTMLElement} campo   - Campo con el error.
 * @param {HTMLElement} seccion - Sección que contiene el aviso.
 * @param {string} mensaje      - Texto del aviso.
 */
function marcarInvalido(campo, seccion, mensaje) {
    const aviso = seccion.querySelector('p[role="alert"]');
    mostrarError(seccion, mensaje);
    if (!campo) {
        return;
    }
    campo.setAttribute('aria-invalid', 'true');
    if (aviso && aviso.id) {
        campo.setAttribute('aria-describedby', aviso.id);
    }
}

/**
 * Quita las marcas de error de un campo (al validarlo
 * con éxito, o al corregirlo).
 * @param {HTMLElement} campo - Campo a limpiar.
 */
function limpiarInvalido(campo) {
    if (!campo) {
        return;
    }
    campo.removeAttribute('aria-invalid');
    campo.removeAttribute('aria-describedby');
}

/**
 * Valida los campos obligatorios del paso actual.
 * Regla del Documento Maestro: máximo dos campos por
 * pantalla y avisar con claridad cuando algo falta.
 * @returns {boolean} true si el paso puede continuar.
 */
export function validarPasoActual() {
    const seccion = secciones[pasoActual];

    // Limpiar errores anteriores antes de revalidar.
    mostrarError(seccion, '');

    // 1) Textareas obligatorios del paso.
    const areas = seccion.querySelectorAll('textarea[required]');
    for (const area of areas) {
        if (area.value.trim() === '') {
            const nombre = nombreDelCampo(area);
            marcarInvalido(area, seccion, nombre
                ? 'Falta completar «' + nombre + '».'
                : 'Por favor, completa este campo para continuar.');
            area.focus();
            return false;
        }
        limpiarInvalido(area);
    }

    // 2) Grupo de radios (elección final): al menos uno
    //    debe estar marcado.
    const radios = seccion.querySelectorAll('input[type="radio"][required]');
    if (radios.length > 0 && !seccion.querySelector('input[type="radio"]:checked')) {
        marcarInvalido(radios[0], seccion, 'Selecciona una de las dos opciones para continuar.');
        radios[0].focus();
        return false;
    }
    radios.forEach(limpiarInvalido);

    return true;
}

/**
 * Escribe el resumen final en la pantalla de cierre.
 * Mensaje neutro y sin juicio, según la filosofía del proyecto.
 */
export function prepararCierre() {
    const cierre = document.querySelector('#cierre');
    const eleccionTexto = respuestas.eleccion === 'hacerlo' ? 'HACERLO' : 'NO HACERLO';
    const nombresEmocion = {
        miedo: 'miedo',
        ilusion: 'ilusión',
        duda: 'duda',
        calma: 'calma'
    };

    let reflexion = `Reflexionaste sobre «${respuestas.decision}»`;
    if (respuestas.emocion && nombresEmocion[respuestas.emocion]) {
        reflexion += ` estando con ${nombresEmocion[respuestas.emocion]}`;
    }
    reflexion += ` y tu motivo fue: «${respuestas.motivo}».`;

    cierre.textContent =
        `Has decidido: ${eleccionTexto}. ` + reflexion + ' ¡Anotamos tu decisión!';
}

/* --------------------------------------------------------------------------
   ACCIONES
   -------------------------------------------------------------------------- */

/**
 * Reinicia la reflexión: formulario vacío,
 * respuestas borradas, aguja centrada,
 * vuelta a la bienvenida y borrador
 * guardado eliminado (T4). (Lo usan el
 * cierre y el menú principal.)
 */
export function reiniciar() {
    formulario.reset();
    Object.keys(respuestas).forEach((clave) => {
        respuestas[clave] = '';
    });

    // El estado emocional también se limpia: los botones
    // vuelve a estar sin marcar (aria-pressed="false") y
    // el tinte de la pantalla desaparece.
    actualizarEmocionUI();

    // Reflexión nueva: la siguiente entrada del historial
    // será distinta (no actualizará la anterior).
    reiniciarIdReflexion();

    if (transicionando) {
        mostrarPaso(0); // Transición en curso: ir de inmediato.
    } else {
        transicionarA(0, 'atras');
    }

    // T4: sin reflexión en curso, no hay
    // borrador. Primero se cancela cualquier
    // guardado pendiente (si no, el debounce
    // de 300 ms volvería a escribir el estado
    // vacío después de borrar) y luego se
    // borra el borrador guardado.
    cancelarGuardado();
    borrarBorrador();
}

/* --------------------------------------------------------------------------
   PIE DE PÁGINA: CONSEJOS ROTATIVOS
   -------------------------------------------------------------------------- */

// Consejos que rotan en el pie cada 9 s (dan vida
// a la pantalla entre pasos, sin juzgar).
const consejos = [
    '«Antes de decidir, detente un momento.»',
    '«No hay una opción correcta: solo tu decisión.»',
    '«Piensa más allá del momento.»',
    '«¿Qué pasa si lo haces? ¿Y si no lo haces?»',
    '«La pausa es parte de la decisión.»',
    '«Decidir con calma es decidir mejor.»'
];
let indiceConsejo = 0;

/* --------------------------------------------------------------------------
   EVENTOS (se registran en initForm)
   -------------------------------------------------------------------------- */

/**
 * Inicializa el componente: registra los
 * eventos del formulario y del pie de
 * página dentro de su ámbito. La llama
 * main.js al cargar la aplicación.
 */
export function initForm() {
    // Guardar las respuestas mientras el usuario escribe (textareas).
    formulario.addEventListener('input', (evento) => {
        const { name, value } = evento.target;
        if (name in respuestas) {
            respuestas[name] = value;
            guardarPronto(); // T2: guardado automático del borrador
        }
    });

    // La aguja y el ambiente reaccionan de inmediato al elegir
    // entre "hacerlo" y "no hacerlo".
    formulario.addEventListener('change', (evento) => {
        if (evento.target.name === 'eleccion') {
            respuestas.eleccion = evento.target.value;
            actualizarLogo();
            actualizarAmbiente();
            guardarPronto(); // T2: guardar la elección en el borrador
        }
    });

    // Navegación entre pasos: los botones llevan atributos de
    // datos (data-avanzar, data-retroceder, data-terminar, data-reiniciar).
    // Clic consciente (1.1.3): el avance SOLO ocurre desde botones
    // explícitos con estos atributos. Clicar en el fondo, el texto o
    // cualquier otra zona no hace nada; no hay botón submit ni envío
    // implícito de formulario; y los dobles clics durante una
    // transición se ignoran (transicionando).
    formulario.addEventListener('click', (evento) => {
        const boton = evento.target.closest('button');
        if (!boton || !formulario.contains(boton)) {
            return; // El clic no fue en un botón del formulario.
        }

        if (boton.hasAttribute('data-empezar')) {
            mostrarUmbral();
            return;
        }

        if (boton.hasAttribute('data-volver')) {
            ocultarUmbral();
            // Foco de vuelta al título de la bienvenida.
            enfocarTitulo(secciones[0]);
            return;
        }

        if (boton.hasAttribute('data-respirar')) {
            iniciarRespiracion();
            return;
        }

        if (boton.hasAttribute('data-saltar')) {
            terminarRespiracion();
            return;
        }

        if (boton.hasAttribute('data-emocion')) {
            const valor = boton.getAttribute('data-emocion');
            respuestas.emocion = (respuestas.emocion === valor) ? '' : valor;
            actualizarEmocionUI();
            guardarPronto();
            return;
        }

        if (boton.hasAttribute('data-dual-state')) {
            // Activar la experiencia inmersiva Dual-State.
            if (window.dualState) {
                window.dualState.activar();
            }
            return;
        }

        if (boton.hasAttribute('data-avanzar')) {
            // Salir de la experiencia inmersiva si está activa.
            if (window.dualState && window.dualState.estaActivo()) {
                window.dualState.desactivar();
            }
            if (!validarPasoActual()) {
                return; // No avanzar hasta que el paso sea válido.
            }
            transicionarA(pasoActual + 1, 'adelante');
        }

        if (boton.hasAttribute('data-retroceder')) {
            // Salir de la experiencia inmersiva si está activa.
            if (window.dualState && window.dualState.estaActivo()) {
                window.dualState.desactivar();
            }
            if (transicionando) {
                return;
            }
            transicionarA(pasoActual - 1, 'atras');
        }

        if (boton.hasAttribute('data-terminar')) {
            if (!validarPasoActual()) {
                return;
            }
            prepararCierre();
            const seccionCierre = secciones[secciones.length - 1];
            seccionCierre.classList.add('pausa-final');
            transicionarA(secciones.length - 1, 'adelante');
            setTimeout(() => { seccionCierre.classList.remove('pausa-final'); }, 2000); // Sección de cierre.
            // T5: tras la transición (que programa
            // un guardado del borrador), archivar
            // en el historial y borrar el borrador.
            archivarReflexion();
        }

        if (boton.hasAttribute('data-reiniciar')) {
            reiniciar();
        }
    });

    /* PIE DE PÁGINA: CONSEJOS ROTATIVOS */
    // Cada 9 s se difunde un nuevo consejo (300 ms de fade).
    // Nunca compite con la reflexión: es pequeño y discreto.
    setInterval(() => {
        if (movimientoReducido() || !pieConsejo) {
            return;
        }

        indiceConsejo = (indiceConsejo + 1) % consejos.length;
        pieConsejo.classList.add('cambiando');

        setTimeout(() => {
            pieConsejo.textContent = consejos[indiceConsejo];
            pieConsejo.classList.remove('cambiando');
        }, 300);
    }, 9000);
}

/* --------------------------------------------------------------------------
   ETIQUETADO EMOCIONAL (1.3.x)
   -------------------------------------------------------------------------- */

/**
 * Refleja la emoción elegida: los botones
 * de emoción se marcan (aria-pressed) y
 * la pantalla se tiñe sutilmente.
 */
export function actualizarEmocionUI() {
    document.querySelectorAll('[data-emocion]').forEach(function (b) {
        b.setAttribute('aria-pressed', (b.getAttribute('data-emocion') === respuestas.emocion) ? 'true' : 'false');
    });
    aplicarTinteEmocion();
}

/**
 * Tinea el ambiente de la emoción
 * (las clases emocion-* y sus variables
 * están en states.css).
 */
function aplicarTinteEmocion() {
    const emociones = ['miedo', 'ilusion', 'duda', 'calma'];
    emociones.forEach(function (e) { document.body.classList.remove('emocion-' + e); });
    if (respuestas.emocion) {
        document.body.classList.add('emocion-' + respuestas.emocion);
    }
}
