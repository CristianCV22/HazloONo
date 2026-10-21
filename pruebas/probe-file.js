const http = require('http');
const { spawn } = require('child_process');
/* Rutas portables: el navegador, el puerto y la carpeta
   temporal se resuelven aquí (ver pruebas/navegador.js). */
const {
    resolverNavegador, puertoServidor, urlArchivo, perfilTemporal
} = require('./navegador');
const EDGE = resolverNavegador();
const PUERTO = puertoServidor(9344);
const URL = urlArchivo('index.html');
const PERFIL = perfilTemporal('edge-file');
// Abrir el archivo DIRECTAMENTE (file://), como
// haría un doble clic — sin servidor HTTP.

function getJSON(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PUERTO, path }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
  });
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PUERTO}`, '--user-data-dir=' + PERFIL, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let objetivo = null;
  for (let i = 0; i < 60 && !objetivo; i++) {
    try { const lista = await getJSON('/json/list'); objetivo = lista.find((t) => t.type === 'page'); } catch (e) { }
    if (!objetivo) await esperar(200);
  }
  const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const pendientes = new Map();
  const consola = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pendientes.has(msg.id)) { pendientes.get(msg.id)(msg); pendientes.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      consola.push('EXCEPCIÓN: ' + (msg.params.exceptionDetails.exception || {}).description || msg.params.exceptionDetails.text);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      consola.push('log: ' + msg.params.entry.text);
    }
  };
  function enviar(m) { return new Promise((resolve) => { pendientes.set(m.id, resolve); ws.send(JSON.stringify(m)); }); }
  let idc = 0;
  async function evaluar(expr) {
    const m = { id: ++idc, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: false } };
    const resp = await enviar(m);
    if (resp.error) throw resp.error;
    return (resp.result.result || {}).value;
  }
  await enviar({ id: ++idc, method: 'Runtime.enable', params: {} });
  await enviar({ id: ++idc, method: 'Log.enable', params: {} });
  await enviar({ id: ++idc, method: 'Page.enable', params: {} });
  await enviar({ id: ++idc, method: 'Page.navigate', params: { url: URL } });
  await esperar(2500);
  const r = await evaluar("(() => { const secs = [...document.querySelectorAll('#reflexion section')]; const vis = secs.map(s => getComputedStyle(s).display !== 'none' && s.offsetParent !== null); const aguja = getComputedStyle(document.querySelector('.needle-blue')).fill; const aguja2 = getComputedStyle(document.querySelector('.needle-orange')).fill; return JSON.stringify({ marcaJs: document.documentElement.classList.contains('js'), seccionesVisibles: vis, todasVisibles: vis.every(Boolean), agujaAzul: aguja, agujaNaranja: aguja2 }); })()");
  console.log('file:// estado:', r);
  console.log('consola (' + consola.length + '):');
  consola.slice(0, 4).forEach(c => console.log('  ' + c));
  ws.close();
  proc.kill();
}
main().catch((e) => { console.error(e); process.exit(1); });
