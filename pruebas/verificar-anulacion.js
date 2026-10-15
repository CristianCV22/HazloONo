// Verifica que la preferencia «Activar» anule
// prefers-reduced-motion: reduce del sistema.
const http = require('http');
const { spawn } = require('child_process');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PUERTO = 9334;
const URL = 'http://localhost:8471/index.html';
const PERFIL = 'C:\\Users\\valde\\AppData\\Local\\Temp\\opencode\\edge-anular-' + Date.now();

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

    // 1) Estado del sistema (¿reduce activo?)
    await enviar('Page.navigate', { url: URL });
    await esperar(400);
    const reduceSistema = await evaliarSeguro();
    async function evaliarSeguro() {
        return await evaluar("matchMedia('(prefers-reduced-motion: reduce)').matches");
    }
    console.log('El sistema reporta reduce: ' + reduceSistema);

    // 2) Sin preferencia: ¿las animaciones están muertas?
    const sinPreferencia = await evaluar(`JSON.stringify({
        claseHtml: document.documentElement.className,
        duracion: getComputedStyle(document.querySelector('.markers')).animationDuration
    })`);
    console.log('SIN preferencia: ' + sinPreferencia);

    // 3) Guardar «activar» y recargar
    await evaluar("localStorage.setItem('hazlono-animacion', 'activar')");
    await enviar('Page.reload', {});
    await esperar(1200); // mitad de la apertura

    // 4) Con «activar»: la clase está y las animaciones VIVEN
    const conActivar = await evaluar(`JSON.stringify({
        claseHtml: document.documentElement.className,
        reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
        duracion: getComputedStyle(document.querySelector('.markers')).animationDuration,
        opacidadMarkers: getComputedStyle(document.querySelector('.markers')).opacity,
        opacidadFondo: getComputedStyle(document.body, '::before').opacity,
        transformFondo: getComputedStyle(document.body, '::before').transform
    })`);
    console.log('CON «Activar»: ' + conActivar);

    // 5) Y «desactivar» también funciona
    await evaluar("localStorage.setItem('hazlono-animacion', 'desactivar')");
    await enviar('Page.reload', {});
    await esperar(400);
    const conDesactivar = await evaluar(`JSON.stringify({
        claseHtml: document.documentElement.className,
        duracion: getComputedStyle(document.querySelector('.markers')).animationDuration
    })`);
    console.log('CON «Desactivar»: ' + conDesactivar);

    ws.close();
    proc.kill();
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
