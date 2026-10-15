/* ==========================================================================
   Hazlo o No - Componente: diálogos (Ayuda e Historial)
   ==========================================================================
   Componente de los <dialog> nativos:
   Ayuda (con la preferencia de
   animaciones) e Historial (con su
   confirmación de borrado por doble
   pulsación).

   Registra sus eventos en initModal():
   la llama main.js al cargar la
   aplicación.
   ========================================================================== */

import {
    almacenamientoDisponible, guardarPreferenciaAnimacion,
    aplicarPreferenciaAnimacion
} from '../utils.js';
import { leerHistorial, borrarHistorial, menu } from '../state.js';
import { reiniciar } from './form.js';

/**
 * Abre el diálogo de ayuda (<dialog> nativo:
 * foco atrapado, se cierra con Esc o con el botón).
 * T8: si el almacenamiento no funciona (denegado
 * o lleno), muestra el aviso de que la reflexión
 * no se guardará. Se comprueba en cada apertura:
 * cubre también que se llene a mitad de sesión.
 */
export function abrirAyuda() {
    const dialogo = document.querySelector('#ayuda');
    if (!dialogo) {
        return;
    }

    // Degradación elegante (T8): el
    // aviso solo aparece cuando no
    // se puede guardar.
    const aviso = document.querySelector('#aviso-almacenamiento');
    if (aviso) {
        aviso.hidden = almacenamientoDisponible();
    }

    if (typeof dialogo.showModal === 'function') {
        dialogo.showModal();
    }
}

/**
 * Renderiza la lista del historial
 * (más reciente primero) y alterna
 * el estado vacío.
 * @returns {number} entradas mostradas.
 */
export function renderizarHistorial() {
    const lista = document.querySelector('#lista-historial');
    const vacio = document.querySelector('#historial-vacio');
    if (!lista || !vacio) {
        return 0;
    }

    const entradas = leerHistorial();

    // Renderizar (la más reciente primero).
    lista.textContent = '';
    for (let i = entradas.length - 1; i >= 0; i--) {
        const entrada = entradas[i];
        const eleccionTexto =
            (entrada.eleccion === 'hacerlo') ? 'HACERLO' : 'NO HACERLO';
        const fecha = entrada.fecha
            ? new Date(entrada.fecha).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric'
            })
            : '';
        const item = document.createElement('li');
        item.textContent =
            `«${entrada.decision}» — ${eleccionTexto}. ` +
            `Motivo: ${entrada.motivo}${fecha ? ` (${fecha})` : ''}`;
        lista.appendChild(item);
    }

    // Estado vacío cuando no hay nada.
    vacio.hidden = entradas.length > 0;
    lista.hidden = entradas.length === 0;

    return entradas.length;
}

/**
 * Abre el diálogo del historial
 * (T6): foco atrapado, se cierra
 * con Esc o con el botón.
 */
export function abrirHistorial() {
    const dialogo = document.querySelector('#historial');
    if (!dialogo) {
        return;
    }

    renderizarHistorial();

    if (typeof dialogo.showModal === 'function') {
        dialogo.showModal();
    }
}

/* Confirmación de borrado (T7):
   doble pulsación. Sin confirm()
   ni alert(): el botón pide una
   segunda pulsación y un aviso con
   role="status" lo anuncia. */
let confirmandoBorrado = false;
let temporizadorConfirmar = null;
const RETARDO_CONFIRMAR = 4000; // ms

/**
 * Maneja «Borrar historial» (T7):
 * la primera pulsación pide
 * confirmación (el botón cambia su
 * texto y el aviso lo anuncia); la
 * segunda borra de verdad. Si pasa
 * el plazo sin confirmar, todo
 * vuelve a la normalidad.
 */
export function solicitarBorrarHistorial() {
    const boton = document.querySelector('[data-borrar-historial]');
    const aviso = document.querySelector('#aviso-historial');
    if (!boton || !aviso) {
        return;
    }

    if (confirmandoBorrado) {
        // Segunda pulsación: borrar
        // el historial y mostrar el
        // estado vacío.
        confirmandoBorrado = false;
        if (temporizadorConfirmar) {
            clearTimeout(temporizadorConfirmar);
            temporizadorConfirmar = null;
        }
        borrarHistorial();
        renderizarHistorial();
        aviso.textContent = 'Historial borrado.';
        aviso.hidden = false;
        boton.textContent = 'Borrar historial';
        return;
    }

    // Primera pulsación: pedir
    // confirmación.
    confirmandoBorrado = true;
    boton.textContent = '¿Seguro? Pulsa de nuevo';
    aviso.textContent = 'Pulsa «¿Seguro? Pulsa de nuevo» para borrar el historial.';
    aviso.hidden = false;
    temporizadorConfirmar = setTimeout(() => {
        confirmandoBorrado = false;
        temporizadorConfirmar = null;
        boton.textContent = 'Borrar historial';
        aviso.hidden = true;
    }, RETARDO_CONFIRMAR);
}

/* --------------------------------------------------------------------------
   EVENTOS (se registran en initModal)
   -------------------------------------------------------------------------- */

// Preferencia de animaciones (diálogo de ayuda):
// el usuario puede anular el sistema.
const dialogoAyuda = document.querySelector('#ayuda');

// Diálogo del historial: «Borrar
// historial» (doble pulsación, T7).
const botonBorrarHistorial = document.querySelector('[data-borrar-historial]');

/**
 * Inicializa el componente: registra
 * los eventos de los diálogos y del
 * menú principal dentro de su ámbito.
 * La llama main.js al cargar la
 * aplicación.
 */
export function initModal() {
    if (dialogoAyuda) {
        dialogoAyuda.addEventListener('change', (evento) => {
            if (evento.target.name === 'animacion') {
                guardarPreferenciaAnimacion(evento.target.value);
                aplicarPreferenciaAnimacion();
            }
        });
    }

    // Menú principal: Ayuda (diálogo), Historial
    // (diálogo) y Reiniciar.
    if (menu) {
        menu.addEventListener('click', (evento) => {
            const boton = evento.target.closest('button');
            if (!boton) {
                return;
            }

            if (boton.hasAttribute('data-menu-ayuda')) {
                abrirAyuda();
            }

            if (boton.hasAttribute('data-menu-historial')) {
                abrirHistorial();
            }

            if (boton.hasAttribute('data-menu-reiniciar')) {
                reiniciar();
            }
        });
    }

    if (botonBorrarHistorial) {
        botonBorrarHistorial.addEventListener('click', solicitarBorrarHistorial);
    }
}
