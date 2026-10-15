// Verifica en el navegador real que un
// borrador se restaura al recargar (T3).
const http = require('http');
const { spawn } = require('child_process');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PUERTO = 9335;
const URL = 'http://localhost:8472/index.html';
const PERFIL = 'C:\\Users\\valde\\AppData\\Local\\Temp\\opencode\\edge-borrador-' + Date.now();

function getJSON(path) {
    return new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port: PUERTO, path }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        });
        req.on('error', reject);
    });
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const proc = spawn(EDGE, [
        '--headless=new',
        `--remote-debugging-port=${PUERTO}`,
        '--user-data-dir=' + PERFIL,
        '--no-first-run',
        'about:blank'
    ], { stdio: 'ignore' });

    let objetivo = null;
    for (let i = 0; i < 60 && !objetivo; i++) {
        try {
            const lista = await getJSON('/json/list');
            objetivo = lista.find((t) => t.type === 'page');
        } catch (e) { /* no listo */ }
        if (!objetivo) await esperar(200);
    }

    const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

    let id = 1;
    const pendientes = new Map();
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pendientes.has(msg.id)) {
            pendientes.get(msg.id)(msg);
            pendientes.delete(msg.id);
        }
    };
    const enviar = (metodo, params = {}) => new Promise((resolve) => {
        const miId = id++;
        pendientes.set(miId, resolve);
        ws.send(JSON.stringify({ id: miId, method: metodo, params }));
    });

    await enviar('Page.enable');
    await enviar('Runtime.enable');
    await enviar('Network.enable');
    await enviar('Network.setCacheDisabled', { cacheDisabled: true });

    const evaluar = async (expression) => {
        const r = await enviar('Runtime.evaluate', { expression, returnByValue: true });
        return r.result.result.value;
    };
    // Versión que espera promesas (para
    // medir tiempos reales en la página).
    const evaluarAsync = async (expression) => {
        const r = await enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        return r.result.result.value;
    };

    // Esperar a que la app termine de
    // inicializar: la aguja lleva una
    // clase de estado («reflexion
    // paso-0», «hacerlo», ...). Sin
    // esto, una recarga lenta puede
    // medir la página a medias.
    const esperarAppLista = async () => {
        for (let i = 0; i < 40; i++) {
            const clases = await evaluar(`document.querySelector('.logo').getAttribute('class')`);
            if (clases && clases !== 'logo') {
                return;
            }
            await esperar(150);
        }
    };

    await enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await enviar('Page.navigate', { url: URL });
    await esperar(500);
    await esperarAppLista();

    // 1.1.3: clic consciente — pulsar zonas
    // que no son botones no avanza
    await evaluar(`document.querySelector('#titulo-bienvenida').click()`);
    await esperar(200);
    const clicTitulo = await evaluar(`[...document.querySelectorAll('#reflexion section')].findIndex(s => s.classList.contains('activa'))`);
    console.log('Clic en título (no avanza): paso = ' + clicTitulo);
    await evaluar(`document.querySelector('.bienvenida-inicial').click()`);
    await esperar(200);
    const clicContenedor = await evaluar(`[...document.querySelectorAll('#reflexion section')].findIndex(s => s.classList.contains('activa'))`);
    console.log('Clic en contenedor (no avanza): paso = ' + clicContenedor);

    // 1.2.1: el respiro entre pasos — medir
    // que hay ~0.4 s de calma (sección
    // activa, contenido invisible) antes
    // de la cascada
    const respiroTiming = await evaluarAsync(`new Promise((resolve) => {
        const t0 = performance.now();
        document.querySelector('[data-empezar]').click();
        setTimeout(() => {
            const btn = document.querySelector('#reflexion section.activa [data-avanzar]');
            if (btn) btn.click();
            setTimeout(() => {
                const seccion = document.querySelector('#reflexion section.activa');
                const primerHijo = seccion.querySelector('h2, p');
                const estilo = getComputedStyle(primerHijo);
                const durante = estilo.opacity;
                const childDelays = [...seccion.children].map(c => c.tagName + ':' + getComputedStyle(c).animationDelay).join(', ');
                const pasoActivo = [...document.querySelectorAll('#reflexion section')].findIndex(s => s.classList.contains('activa'));
                const retardoHijoH2 = estilo.getPropertyValue('--retardo-hijo');
                const retardoRespiroH2 = estilo.getPropertyValue('--retardo-respiro');
                const retardoEscenaH2 = estilo.getPropertyValue('--retardo-escena');
                setTimeout(() => {
                    const tras = getComputedStyle(primerHijo).opacity;
                    resolve(JSON.stringify({
                        pasoActivo,
                        seccionId: seccion.getAttribute('aria-labelledby'),
                        animationName: estilo.animationName,
                        animationDelay: estilo.animationDelay,
                        retardoHijoH2,
                        retardoRespiroH2,
                        retardoEscenaH2,
                        retardoRespiroBody: getComputedStyle(document.body).getPropertyValue('--retardo-respiro').trim(),
                        childDelays,
                        opacidadDuranteRespiro: durante,
                        opacidadTrasCascada: tras,
                        tiempoMedicion: Math.round(performance.now() - t0)
                    }));
                }, 1000);
            }, 400);
        }, 1200);
    })`);
    console.log('Respiro timing (1.2.1): ' + respiroTiming);

    // Guardar un borrador "de otra sesión"
    await evaluar(`localStorage.setItem('hazlono-borrador', JSON.stringify({
        version: 1,
        paso: 2,
        respuestas: {
            decision: 'Aprender a tocar el piano',
            consecuenciasHacer: 'Música en casa',
            consecuenciasNoHacer: 'Nada de música',
            consecuenciasImportantes: '',
            gananciasYSacrificios: '',
            eleccion: 'hacerlo',
            motivo: ''
        },
        guardado: '2026-10-12T10:00:00.000Z'
    }))`);

    // Recargar: la app debe restaurar la sesión
    await enviar('Page.reload', {});
    await esperar(800);
    await esperarAppLista();

    const estado = await evaluar(`JSON.stringify({
        pasoActivo: [...document.querySelectorAll('#reflexion section')].findIndex(s => s.classList.contains('activa')),
        decision: document.querySelector('#decision').value,
        consecuenciasHacer: document.querySelector('#consecuencias-hacer').value,
        radioMarcado: document.querySelector('input[name="eleccion"][value="hacerlo"]').checked,
        logo: document.querySelector('.logo').className.baseVal !== undefined ? document.querySelector('.logo').className.baseVal : document.querySelector('.logo').getAttribute('class'),
        cuerpo: document.body.className,
        pie: document.querySelector('#pie-paso').textContent,
        borradorAunAhi: Boolean(localStorage.getItem('hazlono-borrador'))
    })`);
    console.log('Tras recargar con borrador: ' + estado);

    // Y avanzar desde el estado restaurado guarda el nuevo paso
    await evaluar(`document.querySelector('#reflexion section.activa [data-avanzar]').click()`);
    await esperar(700);
    const trasAvanzar = await evaluar(`JSON.stringify({
        pasoActivo: [...document.querySelectorAll('#reflexion section')].findIndex(s => s.classList.contains('activa')),
        borrador: JSON.parse(localStorage.getItem('hazlono-borrador')).paso
    })`);
    console.log('Tras avanzar desde lo restaurado: ' + trasAvanzar);

    // T4: escribir y reiniciar inmediatamente (dentro
    // del debounce de 300 ms) → el guardado pendiente
    // se cancela y el borrador NO resucita
    await evaluar(`localStorage.removeItem('hazlono-borrador')`);
    await evaluar(`document.querySelector('#decision').value = 'Texto a medio guardar'`);
    await evaluar(`document.querySelector('#decision').dispatchEvent(new Event('input', { bubbles: true }))`);
    await evaluar(`document.querySelector('[data-menu-reiniciar]').click()`);
    await esperar(600); // más que el debounce: si no se canceló, aquí resucitaría
    const t4 = await evaluar(`JSON.stringify({
        borradorAusente: !localStorage.getItem('hazlono-borrador'),
        pasoActivo: [...document.querySelectorAll('#reflexion section')].findIndex(s => s.classList.contains('activa')),
        decisionVacia: document.querySelector('#decision').value === ''
    })`);
    console.log('T4 (escribir + reiniciar rápido): ' + t4);

    // T5: completar el flujo y terminar →
    // historial + sin borrador. La transición
    // programa un guardado del borrador que
    // el archivo debe cancelar (no resucita).
    // Verificar primero el umbral (1.1.1):
    // micro-copy, anillo, foco y aria-labelledby.
    await evaluar(`document.querySelector('[data-empezar]').click()`);
    await esperar(400);
    const umbralTxt = await evaluar(`JSON.stringify({
        umbralVisible: !document.querySelector('.bienvenida-umbral').hidden,
        inicialOculta: document.querySelector('.bienvenida-inicial').hidden,
        texto: document.querySelector('#titulo-umbral').textContent,
        anilloPresente: Boolean(document.querySelector('.anillo-respiracion')),
        focoEnTitulo: document.activeElement === document.querySelector('#titulo-umbral'),
        ariaLabelledby: document.querySelector('#reflexion section').getAttribute('aria-labelledby')
    })`);
    console.log('Umbral (1.1.1): ' + umbralTxt);
    // Verificar la respiración guiada (1.1.2):
    // entrar, comprobar la guía y salir.
    await evaluar(`document.querySelector('[data-respirar]').click()`);
    await esperar(300);
    const respTxt = await evaluar(`JSON.stringify({
        guiaVisible: !document.querySelector('.umbral-respiracion').hidden,
        fase: document.querySelector('#fase-respiracion').textContent,
        cuenta: document.querySelector('.cuenta-respiracion').textContent,
        anilloGuiado: document.querySelector('.anillo-respiracion').classList.contains('guiado'),
        focoEnSaltar: document.activeElement === document.querySelector('[data-saltar]')
    })`);
    console.log('Respiración (1.1.2): ' + respTxt);
    await evaluar(`document.querySelector('[data-saltar]').click()`);
    await esperar(200);
    const respFin = await evaluar(`JSON.stringify({
        guiaOculta: document.querySelector('.umbral-respiracion').hidden,
        anilloLibre: !document.querySelector('.anillo-respiracion').classList.contains('guiado')
    })`);
    console.log('Respiración sale: ' + respFin);
    await evaluarAsync(`(async () => {
        const esperar = (ms) => new Promise(r => setTimeout(r, ms));
        const clic = async (sel) => { document.querySelector(sel).click(); await esperar(560); };
        const escribir = (sel, valor) => {
            const campo = document.querySelector(sel);
            campo.value = valor;
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        };
        await clic('#reflexion section.activa [data-avanzar]');
        escribir('#decision', 'Aprender a cocinar');
        await clic('#reflexion section.activa [data-avanzar]');
        escribir('#consecuencias-hacer', 'Comer rico');
        escribir('#consecuencias-no-hacer', 'Hambre');
        await clic('#reflexion section.activa [data-avanzar]');
        escribir('#consecuencias-importantes', 'Mi salud');
        escribir('#ganancias-sacrificios', 'Tiempo');
        await clic('#reflexion section.activa [data-avanzar]');
        document.querySelector('input[name="eleccion"][value="hacerlo"]').click();
        escribir('#motivo', 'Mi bienestar');
        document.querySelector('#reflexion section.activa [data-terminar]').click();
        return true;
    })()`);
    await esperar(800); // más que el debounce: el borrador no debe resucitar
    const t5 = await evaluar(`JSON.stringify({
        pasoActivo: [...document.querySelectorAll('#reflexion section')].findIndex(s => s.classList.contains('activa')),
        cierre: document.querySelector('#cierre').textContent,
        historial: JSON.parse(localStorage.getItem('hazlono-historial') || '{"version":1,"entradas":[]}'),
        borradorAusente: !localStorage.getItem('hazlono-borrador')
    })`);
    console.log('T5 tras terminar: ' + t5);

    // Recargar: sin borrador → bienvenida;
    // el historial permanece intacto
    await enviar('Page.reload', {});
    await esperar(800);
    await esperarAppLista();
    const t5r = await evaluar(`JSON.stringify({
        pasoActivo: [...document.querySelectorAll('#reflexion section')].findIndex(s => s.classList.contains('activa')),
        historialAhi: Boolean(localStorage.getItem('hazlono-historial')),
        entradas: JSON.parse(localStorage.getItem('hazlono-historial')).entradas.length
    })`);
    console.log('T5 tras recargar: ' + t5r);

    // T6: abrir el historial (diálogo
    // nativo) con la entrada del T5
    await evaluar(`document.querySelector('[data-menu-historial]').click()`);
    await esperar(300);
    const t6 = await evaluar(`JSON.stringify({
        abierto: Boolean(document.querySelector('#historial').open),
        entradas: [...document.querySelectorAll('#lista-historial li')].map(li => li.textContent),
        listaVisible: !document.querySelector('#lista-historial').hidden,
        vacioOculto: document.querySelector('#historial-vacio').hidden
    })`);
    console.log('T6 con una entrada: ' + t6);

    // Estado vacío: cerrar, borrar el
    // historial y reabrir
    await evaluar(`document.querySelector('#historial').close()`);
    await evaluar(`localStorage.removeItem('hazlono-historial')`);
    await evaluar(`document.querySelector('[data-menu-historial]').click()`);
    await esperar(300);
    const t6v = await evaluar(`JSON.stringify({
        abierto: Boolean(document.querySelector('#historial').open),
        listaVacia: document.querySelectorAll('#lista-historial li').length === 0,
        listaOculta: document.querySelector('#lista-historial').hidden,
        vacioVisible: !document.querySelector('#historial-vacio').hidden
    })`);
    console.log('T6 sin entradas: ' + t6v);
    await evaluar(`document.querySelector('#historial').close()`);

    // T7: borrar el historial
    // (doble pulsación)
    await evaluar(`localStorage.setItem('hazlono-historial', JSON.stringify({
        version: 1,
        entradas: [{
            decision: 'Probar T7',
            eleccion: 'no-hacerlo',
            motivo: 'Calma',
            fecha: new Date().toISOString()
        }]
    }))`);
    await evaluar(`document.querySelector('[data-menu-historial]').click()`);
    await esperar(300);
    // Primera pulsación: pide
    // confirmación
    await evaluar(`document.querySelector('[data-borrar-historial]').click()`);
    await esperar(100);
    const t7a = await evaluar(`JSON.stringify({
        boton: document.querySelector('[data-borrar-historial]').textContent,
        avisoVisible: !document.querySelector('#aviso-historial').hidden,
        historialAhi: Boolean(localStorage.getItem('hazlono-historial'))
    })`);
    console.log('T7 primera pulsación: ' + t7a);
    // Segunda pulsación: borra
    await evaluar(`document.querySelector('[data-borrar-historial]').click()`);
    await esperar(100);
    const t7b = await evaluar(`JSON.stringify({
        historialAusente: !localStorage.getItem('hazlono-historial'),
        boton: document.querySelector('[data-borrar-historial]').textContent,
        vacioVisible: !document.querySelector('#historial-vacio').hidden,
        aviso: document.querySelector('#aviso-historial').textContent
    })`);
    console.log('T7 segunda pulsación: ' + t7b);
    // Dejar pasar el plazo: el
    // botón vuelve a la normalidad
    await evaluar(`document.querySelector('[data-borrar-historial]').click()`);
    await esperar(100);
    await esperar(4500); // expira el plazo de confirmación
    const t7c = await evaluar(`JSON.stringify({
        boton: document.querySelector('[data-borrar-historial]').textContent,
        avisoOculto: document.querySelector('#aviso-historial').hidden
    })`);
    console.log('T7 tras expirar: ' + t7c);
    await evaluar(`document.querySelector('#historial').close()`);

    // T8: degradación elegante
    // (almacenamiento denegado)
    await evaluar(`document.querySelector('[data-menu-ayuda]').click()`);
    await esperar(100);
    const t8ok = await evaluar(`JSON.stringify({
        avisoOculto: document.querySelector('#aviso-almacenamiento').hidden
    })`);
    console.log('T8 con almacenamiento: ' + t8ok);
    await evaluar(`document.querySelector('#ayuda').close()`);
    // Sabotear el almacenamiento
    // (un getter que lanza, como
    // cuando está denegado)
    await evaluar(`(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('denegado'); }, configurable: true }); return true; })()`);
    await evaluar(`document.querySelector('[data-menu-ayuda]').click()`);
    await esperar(100);
    const t8 = await evaluar(`JSON.stringify({
        avisoVisible: !document.querySelector('#aviso-almacenamiento').hidden,
        texto: document.querySelector('#aviso-almacenamiento').textContent,
        appFunciona: Boolean(document.querySelector('#reflexion section.activa'))
    })`);
    console.log('T8 sin almacenamiento: ' + t8);
    await evaluar(`document.querySelector('#ayuda').close()`);

    ws.close();
    proc.kill();
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
