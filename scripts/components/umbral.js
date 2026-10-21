/* ==========================================================================
   Hazlo o No - Componente: umbral de la bienvenida
   ==========================================================================
   El umbral (1.1.1) y la respiración guiada (1.1.2): un
   segundo tiempo que convierte el clic en pausa consciente.

   Es un componente aparte porque lo usan dos módulos: el
   formulario (que registra sus botones) y el flujo (que lo
   retira al cambiar de paso). Al vivir aquí, y depender
   sólo de los datos, el grafo de módulos no forma ciclos.

   Su estado (si está visible, si se está respirando) es
   propio del componente: el resto no necesita saberlo.
   ========================================================================== */

import { secciones, pasoActual, transicionando } from '../datos.js';

/* --------------------------------------------------------------------------
   UMBRAL DE LA BIENVENIDA (1.1.1)
   --------------------------------------------------------------------------
   Un segundo tiempo que convierte el
   clic en pausa consciente: el usuario
   no entra de golpe a la reflexión,
   primero lee que no hay prisa.
   -------------------------------------------------------------------------- */

// El umbral de la bienvenida (1.1.1):
// la pausa consciente entre el clic y
// el primer paso. Vive solo en el paso 0.
let umbralVisible = false;

/**
 * Muestra el umbral: la bienvenida
 * cruza de la invitación a la pausa.
 * Solo vive en el paso 0 y sin
 * transición en curso.
 */
export function mostrarUmbral() {
    if (umbralVisible || pasoActual !== 0 || transicionando) {
        return;
    }
    const seccion = secciones[0];
    const umbral = seccion.querySelector('.bienvenida-umbral');
    const inicial = seccion.querySelector('.bienvenida-inicial');
    if (!umbral || !inicial) {
        return;
    }
    umbralVisible = true;
    seccion.classList.add('en-umbral');
    inicial.hidden = true;
    umbral.hidden = false;
    // La sección anuncia ahora el título
    // del umbral (el inicial queda oculto).
    seccion.setAttribute('aria-labelledby', 'titulo-umbral');
    const titulo = umbral.querySelector('h3');
    if (titulo) {
        titulo.setAttribute('tabindex', '-1');
        titulo.focus({ preventScroll: true });
    }
}

/**
 * Retira el umbral y devuelve la
 * bienvenida a su primer tiempo.
 */
export function ocultarUmbral() {
    if (!umbralVisible) {
        return;
    }
    // Si se estaba respirando, detener
    // la guía (sin mover el foco: la
    // transición ya gestiona el foco).
    terminarRespiracion(false);
    const seccion = secciones[0];
    umbralVisible = false;
    seccion.classList.remove('en-umbral');
    const umbral = seccion.querySelector('.bienvenida-umbral');
    const inicial = seccion.querySelector('.bienvenida-inicial');
    if (umbral) {
        umbral.hidden = true;
    }
    if (inicial) {
        inicial.hidden = false;
    }
    seccion.setAttribute('aria-labelledby', 'titulo-bienvenida');
}

/* --------------------------------------------------------------------------
   RESPIRACIÓN GUIADA (1.1.2)
   --------------------------------------------------------------------------
   3 ciclos 4-4-4 (inhala, sostén,
   exhala) con descanso breve entre
   ciclos. El anillo pasa de decorativo
   a guía; la fase se anuncia por
   role="status" y la cuenta atrás es
   visual.
   -------------------------------------------------------------------------- */

// Configuración de la técnica 4-4-4.
const RESPIRACION = {
    fases: [
        { nombre: 'Inhala', duracion: 4 },
        { nombre: 'Sostén', duracion: 4 },
        { nombre: 'Exhala', duracion: 4 }
    ],
    ciclos: 3,
    descanso: 1 // s entre ciclos
};
let respirando = false;
let temporizadorRespiracion = null;

/**
 * Entra en el modo respiración:
 * el umbral swapa a la guía 4-4-4.
 * @returns {void}
 */
export function iniciarRespiracion() {
    if (respirando || !umbralVisible) {
        return;
    }
    const seccion = secciones[0];
    const normal = seccion.querySelector('.umbral-normal');
    const guia = seccion.querySelector('.umbral-respiracion');
    const anillo = seccion.querySelector('.anillo-respiracion');
    if (!normal || !guia || !anillo) {
        return;
    }
    respirando = true;
    anillo.classList.add('guiado');
    normal.hidden = true;
    guia.hidden = false;
    // Foco al botón «Saltar» (la fase se
    // anuncia sola por role="status").
    const saltar = guia.querySelector('[data-saltar]');
    if (saltar) {
        saltar.focus({ preventScroll: true });
    }
    ejecutarFase(0, 0);
}

/**
 * Ejecuta una fase con su cuenta atrás.
 * @param {number} indiceFase - Índice en RESPIRACION.fases.
 * @param {number} ciclo      - Ciclo actual (0..RESPIRACION.ciclos-1).
 * @returns {void}
 */
function ejecutarFase(indiceFase, ciclo) {
    if (!respirando) {
        return;
    }
    const fase = RESPIRACION.fases[indiceFase];
    const faseEl = document.querySelector('#fase-respiracion');
    const cicloEl = document.querySelector('.ciclo-respiracion');
    const anillo = secciones[0].querySelector('.anillo-respiracion');
    faseEl.textContent = fase.nombre;
    if (cicloEl) {
        cicloEl.textContent = `Ciclo ${ciclo + 1} de ${RESPIRACION.ciclos}`;
    }
    anillo.classList.remove('inhala', 'exhala');
    if (indiceFase === 0) {
        anillo.classList.add('inhala');
    } else if (indiceFase === 2) {
        anillo.classList.add('exhala');
    }
    cuentaAtras(fase.duracion, () => {
        if (!respirando) {
            return;
        }
        if (indiceFase < RESPIRACION.fases.length - 1) {
            ejecutarFase(indiceFase + 1, ciclo);
        } else if (ciclo < RESPIRACION.ciclos - 1) {
            // Descanso breve entre ciclos.
            faseEl.textContent = 'Descansa';
            anillo.classList.remove('inhala', 'exhala');
            cuentaAtras(RESPIRACION.descanso, () => ejecutarFase(0, ciclo + 1));
        } else {
            terminarRespiracion();
        }
    });
}

/**
 * Cuenta atrás recursiva: encadena
 * temporizadores en vez de setInterval
 * (fácil de probar y de cancelar).
 * @param {number} segundos   - Segundos que quedan.
 * @param {Function} alTerminar - Al llegar a cero.
 * @returns {void}
 */
function cuentaAtras(segundos, alTerminar) {
    const cuentaEl = document.querySelector('.cuenta-respiracion');
    if (cuentaEl) {
        cuentaEl.textContent = String(segundos);
    }
    if (segundos > 1) {
        temporizadorRespiracion = setTimeout(() => {
            cuentaAtras(segundos - 1, alTerminar);
        }, 1000);
    } else {
        temporizadorRespiracion = setTimeout(alTerminar, 1000);
    }
}

/**
 * Sale del modo respiración: el umbral
 * vuelve a su tiempo normal.
 * @param {boolean} [moverFoco=true] - Devolver el foco al título del umbral.
 * @returns {void}
 */
export function terminarRespiracion(moverFoco = true) {
    respirando = false;
    if (temporizadorRespiracion) {
        clearTimeout(temporizadorRespiracion);
        temporizadorRespiracion = null;
    }
    const seccion = secciones[0];
    const normal = seccion.querySelector('.umbral-normal');
    const guia = seccion.querySelector('.umbral-respiracion');
    const anillo = seccion.querySelector('.anillo-respiracion');
    if (anillo) {
        anillo.classList.remove('guiado', 'inhala', 'exhala');
    }
    if (guia) {
        guia.hidden = true;
    }
    if (normal) {
        normal.hidden = false;
    }
    if (moverFoco) {
        // Foco de vuelta al título del umbral.
        const titulo = seccion.querySelector('#titulo-umbral');
        if (titulo) {
            titulo.focus({ preventScroll: true });
        }
    }
}
