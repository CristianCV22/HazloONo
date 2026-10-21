const http = require('http');
const { spawn } = require('child_process');
/* Rutas portables: el navegador, el puerto y la carpeta
   temporal se resuelven aquí (ver pruebas/navegador.js). */
const {
    resolverNavegador, puertoServidor, urlPagina, perfilTemporal
} = require('./navegador');
const EDGE = resolverNavegador();
const PUERTO = puertoServidor(9343);
const URL = urlPagina('http://localhost:8472/index.html');
const PERFIL = perfilTemporal('edge-diag');

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
    if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
      consola.push('console.' + msg.params.type + ': ' + (msg.params.args || []).map(a => a.value || a.description || '').join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consola.push('EXCEPCIÓN: ' + d.text + ' ' + (d.exception && d.exception.description || '') + ' (línea ' + (d.lineNumber + 1) + ', col ' + (d.columnNumber + 1) + ')');
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      consola.push('log: ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
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
  await esperar(2000);
  const r = await evaluar("(() => JSON.stringify({ hayFormulario: Boolean(document.querySelector('#reflexion')), recursos: performance.getEntriesByType('resource').map(e => e.name).filter(n => n.indexOf('.js') >= 0) }))()");
  console.log('estado:', r);
  console.log('consola (' + consola.length + ' mensajes):');
  consola.forEach(c => console.log('  ' + c));
  ws.close();
  proc.kill();
}
main().catch((e) => { console.error(e); process.exit(1); });
