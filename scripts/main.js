/* ==========================================================================
   Hazlo o No - Raíz de la aplicación
   ==========================================================================
   Punto de composición: importa los
   módulos, inicializa los componentes
   (que registran sus propios eventos)
   y arranca la aplicación.

   Módulo ES (script type="module"):
   se ejecuta tras parsear el HTML
   (diferido), con el DOM listo.
   ========================================================================== */

import { aplicarPreferenciaAnimacion, restaurarBorrador } from './utils.js';
import { mostrarPaso } from './state.js';
import { initForm, actualizarEmocionUI } from './components/form.js';
import { initModal } from './components/modal.js';

/**
 * Arranque de la aplicación.
 */
function iniciar() {
    // Marca el documento como "con JavaScript" (el
    // <script> inline de <head> ya lo hace antes de
    // pintar; esto es una red de seguridad).
    document.documentElement.classList.add('js');

    // Estado inicial: aguja centrada en "reflexión",
    // bienvenida visible (sin mover el foco, para no
    // interrumpir al cargar la página).
    mostrarPaso(0, false);

    // Preferencia de animaciones del usuario
    // (puede anular la del sistema).
    aplicarPreferenciaAnimacion();

    // Restaurar la reflexión en curso (T3): si
    // hay un borrador, volver a él — el mismo
    // paso, los campos rellenos y la aguja donde
    // se quedó (sin mover el foco).
    restaurarBorrador();

    actualizarEmocionUI();

    // Arranque completado: la red de seguridad
    // de index.html lo comprueba (si el módulo
    // no se evaluó, la página degrada al
    // layout sin JavaScript).
    window.hazloNoIniciado = true;
}

// Componentes: cada uno registra sus
// propios eventos dentro de su ámbito.
initForm();
initModal();

// Arranque diferido a DOMContentLoaded (los módulos
// ya están cargados: es una red de seguridad).
// En entornos sin addEventListener (tests), arranca ya.
if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', iniciar);
} else {
    iniciar();
}
