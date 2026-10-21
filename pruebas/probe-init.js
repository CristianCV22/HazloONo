const http = require('http');
const { spawn } = require('child_process');
/* Rutas portables: el navegador, el puerto y la carpeta
   temporal se resuelven aquí (ver pruebas/navegador.js). */
const {
    resolverNavegador, puertoServidor, urlPagina, perfilTemporal
} = require('./navegador');
const EDGE = resolverNavegador();
const PUERTO = puertoServidor(9337);
const URL = urlPagina('http://localhost:8472/index.html');
const PERFIL = perfilTemporal('edge-init');

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
  ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id && pendientes.has(msg.id)) { pendientes.get(msg.id)(msg); pendientes.delete(msg.id); } };
  function enviar(m) { return new Promise((resolve) => { pendientes.set(m.id, resolve); ws.send(JSON.stringify(m)); }); }
  let idc = 0;
  async function evaluar(expr) {
    const m = { id: ++idc, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: false } };
    const resp = await enviar(m);
    if (resp.error) throw resp.error;
    return (resp.result.result || {}).value;
  }
  const nav = { id: ++idc, method: 'Page.navigate', params: { url: URL } };
  await enviar(nav);
  await esperar(3800);
  const r0 = await evaluar("(() => { const s=document.querySelector('#reflexion section'); const h=s.querySelector('h2,p'); const cs=getComputedStyle(h); return JSON.stringify({escena: cs.getPropertyValue('--retardo-escena'), hijo: cs.getPropertyValue('--retardo-hijo'), delay: cs.animationDelay}); })()");
  console.log('WELCOME (apertura):', r0);
  ws.close();
  proc.kill();
}
main().catch((e) => { console.error(e); process.exit(1); });
