/* ==========================================================================
   Hazlo o No - Raíz de la aplicación
   ==========================================================================
   Punto de composición: importa los
   módulos, inicializa los componentes
   (que registran sus propios eventos)
   y arranca la aplicación.

   Es el único módulo que conoce a todos
   los demás: aquí se cablean las piezas
   (por ejemplo, la vista del resumen del
   cierre tras restaurar un borrador).

   Módulo ES (script type="module"):
   se ejecuta tras parsear el HTML
   (diferido), con el DOM listo.
   ========================================================================== */

import { aplicarPreferenciaAnimacion } from './almacen.js';
import { pasoActual, secciones } from './datos.js';
import { mostrarPaso, restaurarBorrador } from './state.js';
import { initForm, actualizarEmocionUI, prepararCierre } from './components/form.js';
import { initModal } from './components/modal.js';
import { DualStateExperience } from './components/dual-state.js';

/**
 * Instancia de la experiencia inmersiva Dual-State.
 * Se expone en window.dualState para que form.js pueda
 * activarla sin crear dependencias de importación.
 */
let dualState = null;

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

    // La vista se sincroniza con el estado restaurado:
    // el etiquetado emocional y, si la reflexión
    // estaba en el cierre, su resumen.
    actualizarEmocionUI();
    if (pasoActual === secciones.length - 1) {
        prepararCierre();
    }

    // Inicializar la experiencia inmersiva Dual-State
    // (se activa solo cuando el usuario hace clic
    // en "Ver inmersivamente" desde el paso de Elección).
    const contenedor = document.querySelector('#dual-state-canvas');
    if (contenedor) {
        try {
            dualState = new DualStateExperience(contenedor);
            dualState.init();
            window.dualState = dualState;
        } catch (e) {
            /* Dual-State no disponible en este entorno
               (p. ej. pruebas sin Three.js). La app sigue
               funcionando sin la experiencia inmersiva. */
        }
    }

    // Cuando el usuario confirma desde la experiencia
    // inmersiva, se desactiva y se vuelve al flujo normal.
    if (document.addEventListener) {
        document.addEventListener('dual-state-confirmar', () => {
            if (dualState) {
                dualState.desactivar();
            }
        });
    }

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
