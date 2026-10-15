/* ==========================================================================
   Hazlo o No - Componente: formulario (flujo de reflexión)
   ==========================================================================
   Componente del flujo: umbral de la
   bienvenida, respiración guiada,
   validación por paso, cierre,
   etiquetado emocional y eventos.

   Recibe su ámbito del DOM global (el
   <form id="reflexion"> y sus secciones,
   desde state.js) y registra sus eventos
   en initForm(): ningún listener queda
   activo hasta que la aplicación lo
   inicializa (main.js).
   ========================================================================== */

import {
    secciones, pasoActual, transicionando, respuestas,
    pieConsejo, formulario, mostrarError, enfocarTitulo,
    mostrarPaso, transicionarA, archivarReflexion
} from '../state.js';
import {
    guardarPronto, borrarBorrador, cancelarGuardado,
    movimientoReducido
} from '../utils.js';
import { actualizarLogo, actualizarAmbiente } from './logo.js';

/* --------------------------------------------------------------------------
   UMBRAL DE LA BIENVENIDA (1.1.1)
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
function iniciarRespiracion() {
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
    const cuentaEl = document.querySelector('.cuenta-respiracion');
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

/* --------------------------------------------------------------------------
   VALIDACIÓN
   -------------------------------------------------------------------------- */

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
            mostrarError(seccion, 'Por favor, completa este campo para continuar.');
            area.focus();
            return false;
        }
    }

    // 2) Grupo de radios (elección final): al menos uno
    //    debe estar marcado.
    const radios = seccion.querySelectorAll('input[type="radio"][required]');
    if (radios.length > 0 && !seccion.querySelector('input[type="radio"]:checked')) {
        mostrarError(seccion, 'Selecciona una de las dos opciones para continuar.');
        radios[0].focus();
        return false;
    }

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

        if (boton.hasAttribute('data-avanzar')) {
            if (!validarPasoActual()) {
                return; // No avanzar hasta que el paso sea válido.
            }
            transicionarA(pasoActual + 1, 'adelante');
        }

        if (boton.hasAttribute('data-retroceder')) {
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
