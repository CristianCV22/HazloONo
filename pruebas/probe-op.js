const http = require('http');
const { spawn } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PUERTO = 9338;
const URL = 'http://localhost:8472/index.html';
const PERFIL = 'C:\\Users\\valde\\AppData\\Local\\Temp\\opencode\\edge-op-' + Date.now();
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
  const script = "(() => { const h = document.querySelector('#reflexion section.activa h2'); const t = performance.now(); window._samples=[]; const iv = setInterval(()=>{ const o=getComputedStyle(h).opacity; window._samples.push(Math.round((performance.now()-t))+'ms op='+o); if (window._samples.length>=13) clearInterval(iv);}, 300); return 'started'; })()";
  const mres = await evaluar(script);
  // wait ~4 sec then read samples
  await esperar(4200);
  const s = await evaluar('JSON.stringify(window._samples)');
  console.log('samples:', s);
  const cs = await evaluar("JSON.stringify({escena: getComputedStyle(document.querySelector('#reflexion section.activa h2')).getPropertyValue('--retardo-escena'), hijo: getComputedStyle(document.querySelector('#reflexion section.activa h2')).getPropertyValue('--retardo-hijo'), delay: getComputedStyle(document.querySelector('#reflexion section.activa h2')).animationDelay})");
  console.log('cs:', cs);
  ws.close();
  proc.kill();
}
main().catch((e) => { console.error(e); process.exit(1); });
