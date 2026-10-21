// Sonda CDP: verifica el comportamiento REAL de la app en Edge headless,
// muestreando estilos computados en tiempo real (no virtual).
// Uso: node pruebas\sonda-cdp.js [no-preference|reduce]
const http = require('http');
const { spawn } = require('child_process');

/* Rutas portables: el navegador, el puerto y la carpeta
   temporal se resuelven aquí (ver pruebas/navegador.js). */
const {
    resolverNavegador, puertoServidor, urlPagina, perfilTemporal
} = require('./navegador');
const EDGE = resolverNavegador();
const PUERTO = puertoServidor(9333);
const URL = urlPagina('http://localhost:8471/index.html');
const PERFIL = perfilTemporal('edge-sonda');

const MODO = process.argv[2] || 'default'; // default | no-preference | reduce

function getJSON(path) {
    return new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port: PUERTO, path }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
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
        '--no-default-browser-check',
        'about:blank'
    ], { stdio: 'ignore' });

    // Esperar el endpoint de depuración
    let objetivo = null;
    for (let i = 0; i < 60 && !objetivo; i++) {
        try {
            const lista = await getJSON('/json/list');
            objetivo = lista.find((t) => t.type === 'page');
        } catch (e) { /* aún no listo */ }
        if (!objetivo) await esperar(200);
    }
    if (!objetivo) { console.error('No se encontró el objetivo'); proc.kill(); process.exit(1); }

    const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

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
    // Sin caché: cada corrida ve los archivos
    // tal como están en disco.
    await enviar('Network.setCacheDisabled', { cacheDisabled: true });

    // Forzar la preferencia de movimiento si se pidió
    if (MODO !== 'default') {
        await enviar('Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-reduced-motion', value: MODO }]
        });
    }

    // Navegar
    await enviar('Page.navigate', { url: URL });
    await esperar(600); // carga + ejecución de scripts

    const EXPRESION = `JSON.stringify({
        reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
        fondo: (() => { const c = getComputedStyle(document.body, '::before'); return c.opacity + ' | ' + c.transform; })(),
        markers: getComputedStyle(document.querySelector('.markers')).opacity,
        marks: getComputedStyle(document.querySelector('.marks')).opacity,
        aguja: (() => { const c = getComputedStyle(document.querySelector('.needle-position')); return c.opacity + ' | ' + c.transform; })(),
        anillo: getComputedStyle(document.querySelector('.inner-ring')).opacity,
        h1: getComputedStyle(document.querySelector('header h1')).opacity,
        menu: getComputedStyle(document.querySelector('header nav')).opacity,
        pie: getComputedStyle(document.querySelector('footer')).opacity,
        titulo: getComputedStyle(document.querySelector('#reflexion section.activa h2')).opacity,
        seccion: (() => { const c = getComputedStyle(document.querySelector('#reflexion section.activa')); return c.opacity + ' | ' + c.transform; })(),
        logo: document.querySelector('.logo').getAttribute('class'),
        cuerpo: document.body.className
    })`;

    const muestrear = async (etiqueta) => {
        const r = await enviar('Runtime.evaluate', { expression: EXPRESION, returnByValue: true });
        let v = {};
        try { v = JSON.parse(r.result.result.value); } catch (e) { v = { error: String(e) }; }
        return { etiqueta, ...v };
    };

    const reporte = [];
    const tiempos = [60, 300, 700, 1100, 1600, 2100, 2600, 3100, 3600, 4200, 5000, 6000, 7000];
    const t0 = Date.now();
    for (const t of tiempos) {
        await esperar(Math.max(0, t - (Date.now() - t0)));
        reporte.push(await muestrear(`t=${t}`));
    }

    // Avanzar al paso 2 y muestrear la transición
    await enviar('Runtime.evaluate', {
        expression: `document.querySelector('#reflexion section.activa [data-avanzar]').click()`,
        returnByValue: true
    });
    for (const d of [40, 180, 500]) {
        await esperar(d === 40 ? 40 : d - 40);
        reporte.push(await muestrear(`avance +${d}`));
    }

    // Rellenar el campo y avanzar hasta la elección (paso 5)
    for (let paso = 0; paso < 4; paso++) {
        await enviar('Runtime.evaluate', {
            expression: `(function(){
                var s = document.querySelector('#reflexion section.activa');
                var area = s.querySelector('textarea');
                if (area) { area.value = 'Texto de prueba ' + paso; }
                var boton = s.querySelector('[data-avanzar], [data-terminar]');
                if (boton) boton.click();
                return 'ok';
            })()`,
            returnByValue: true
        });
        await esperar(600);
    }
    reporte.push(await muestrear('en elección'));

    // Elegir "hacerlo" y ver la aguja
    await enviar('Runtime.evaluate', {
        expression: `document.querySelector('input[value="hacerlo"]').click()`,
        returnByValue: true
    });
    await esperar(900);
    reporte.push(await muestrear('decisión hacerlo'));

    // Terminar
    await enviar('Runtime.evaluate', {
        expression: `document.querySelector('[data-terminar]').click()`,
        returnByValue: true
    });
    await esperar(600);
    reporte.push(await muestrear('cierre'));

    console.log('MODO: ' + MODO);
    console.log(JSON.stringify(reporte, null, 1));

    ws.close();
    proc.kill();
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
