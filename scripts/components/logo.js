/* ==========================================================================
   Hazlo o No - Componente: logotipo (aguja y ambiente)
   ==========================================================================
   Vista del estado: coloca la aguja y
   tiñe el ambiente según la elección.
   No registra eventos: responde a los
   cambios de estado (la llama state.js
   y el formulario).
   ========================================================================== */

import { logo, clasesPaso, respuestas, pasoActual } from '../state.js';




/**
 * Coloca la aguja del logotipo según el estado:
 *  - "hacerlo"    → aguja a la derecha  (clase .hacerlo)
 *  - "no-hacerlo" → aguja a la izquierda (clase .no-hacerlo)
 *  - sin elección → aguja barriendo según el
 *    paso (.reflexion + .paso-N): el indicador
 *    de progreso de la reflexión.
 * Las rotaciones y colores están en logo.css.
 */
export function actualizarLogo() {
    logo.classList.remove('hacerlo', 'no-hacerlo', 'reflexion', ...clasesPaso);

    if (respuestas.eleccion === 'hacerlo') {
        logo.classList.add('hacerlo');
    } else if (respuestas.eleccion === 'no-hacerlo') {
        logo.classList.add('no-hacerlo');
    } else {
        logo.classList.add('reflexion');

        // Progreso: la aguja avanza con el paso
        // (solo durante la reflexión).
        if (pasoActual < clasesPaso.length) {
            logo.classList.add(clasesPaso[pasoActual]);
        }
    }
}

/**
 * Tiñe sutilmente el ambiente de la pantalla según la
 * elección final (azul para "no hacerlo", naranja para
 * "hacerlo"). Las variables CSS están en states.css.
 */
export function actualizarAmbiente() {
    document.body.classList.toggle('estado-no-hacerlo', respuestas.eleccion === 'no-hacerlo');
    document.body.classList.toggle('estado-hacerlo', respuestas.eleccion === 'hacerlo');
}

