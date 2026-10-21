/* ==========================================================================
   Hazlo o No - Generador de capturas para el README
   --------------------------------------------------------------------------
   Genera las imágenes de `assets/capturas/` a partir de la aplicación
   real (no son dibujos: son la app funcionando).

   Uso:
       node pruebas/capturas.js

   Cómo funciona:
   1. Levanta un servidor local que sirve el proyecto.
   2. Para cada escena, sirve el index.html con un pequeño guion
      inyectado que lleva la aplicación a ese estado.
   3. Lanza el navegador en modo headless, que espera al evento
      `load` (el guion retrasa la carga unos segundos para que la
      escena esté lista) y guarda la captura.

   No necesita dependencias: sólo un navegador (Firefox o Chromium)
   instalado en el sistema.
   ========================================================================== */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const BASE = path.join(__dirname, '..') + path.sep;
const SALIDA = path.join(BASE, 'assets', 'capturas');
const VENTANA = '1200,900';
const ESPERA_MS = 3500; // retraso de la carga: da tiempo a la escena

/* --------------------------------------------------------------------------
   ESCENAS
   Cada una describe el estado al que hay que llevar la aplicación.
   ------------------------------------------------------------------------ */
const ESCENAS = [
    {
        nombre: 'bienvenida',
        titulo: 'La primera pantalla: una pausa antes de decidir',
        pasos: []
    },
    {
        nombre: 'umbral',
        titulo: 'El umbral: el clic se convierte en pausa consciente',
        pasos: ['empezar']
    },
    {
        nombre: 'consecuencias',
        titulo: 'Contemplar las dos caras de la decisión',
        pasos: ['empezar', 'avanzar', 'texto:decision:Estudiar para el examen',
            'avanzar', 'texto:consecuencias-hacer:Aprobaré y me sentiré tranquilo',
            'texto:consecuencias-no-hacer:Evito el esfuerzo, pero arriesgo el resultado']
    },
    {
        nombre: 'eleccion',
        titulo: 'La elección: la aguja se inclina hacia lo que consideras',
        pasos: ['empezar', 'avanzar', 'texto:decision:Aprender a nadar', 'avanzar',
            'texto:consecuencias-hacer:Me siento libre', 'texto:consecuencias-no-hacer:Me lo pierdo',
            'avanzar', 'texto:consecuencias-importantes:Mi valentía',
            'texto:ganancias-sacrificios:Tiempo libre', 'avanzar', 'emocion:calma']
    },
    {
        nombre: 'cierre',
        titulo: 'El cierre: un resumen neutro de tu decisión',
        pasos: ['empezar', 'avanzar', 'texto:decision:Aprender a nadar', 'avanzar',
            'texto:consecuencias-hacer:Me siento libre', 'texto:consecuencias-no-hacer:Me lo pierdo',
            'avanzar', 'texto:consecuencias-importantes:Mi valentía',
            'texto:ganancias-sacrificios:Tiempo libre', 'avanzar',
            'radio:hacerlo', 'texto:motivo:Para vencer mi miedo', 'terminar']
    },
    {
        nombre: 'historial',
        titulo: 'El historial: tus reflexiones pasadas, solo en tu equipo',
        pasos: ['empezar', 'avanzar', 'texto:decision:Aprender a nadar', 'avanzar',
            'texto:consecuencias-hacer:Me siento libre', 'texto:consecuencias-no-hacer:Me lo pierdo',
            'avanzar', 'texto:consecuencias-importantes:Mi valentía',
            'texto:ganancias-sacrificios:Tiempo libre', 'avanzar',
            'radio:hacerlo', 'texto:motivo:Para vencer mi miedo', 'terminar', 'historial']
    }
];

/* --------------------------------------------------------------------------
   GUION DE ESCENA (se inyecta en el index.html)
   ------------------------------------------------------------------------ */
const GUION = (pasos) => `
<script>
/* Guion de captura: lleva la aplicación a la escena pedida. */
(function () {
    var PASOS = ${JSON.stringify(pasos)};
    function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function activo() { return document.querySelector('#reflexion section.activa'); }
    function texto(id, valor) {
        var campo = document.getElementById(id);
        campo.value = valor;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function clic(sel) {
        var b = document.querySelector(sel);
        if (b) { b.click(); }
    }
    async function ejecutar() {
        for (var i = 0; i < PASOS.length; i++) {
            var paso = PASOS[i];
            if (paso === 'empezar') { clic('[data-empezar]'); }
            else if (paso === 'avanzar') { clic('#reflexion section.activa [data-avanzar]'); }
            else if (paso === 'terminar') { clic('#reflexion section.activa [data-terminar]'); }
            else if (paso === 'historial') { clic('[data-menu-historial]'); }
            else if (paso === 'emocion:calma') { clic('[data-emocion="calma"]'); }
            else if (paso.indexOf('radio:') === 0) {
                clic('input[value="' + paso.slice(6) + '"]');
            } else if (paso.indexOf('texto:') === 0) {
                var partes = paso.split(':');
                texto(partes[1], partes.slice(2).join(':'));
            }
            // Entre pasos hay que esperar a que termine la
            // transición de la app (510 ms): si se pulsa antes,
            // el clic se ignora.
            await esperar(700);
        }
        // Deja asentar la escena (la pausa final del cierre
        // tarda ~2 s en levantar sus hijos).
        await esperar(2600);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ejecutar);
    } else {
        ejecutar();
    }
})();
</script>
`;

/* --------------------------------------------------------------------------
   SERVIDOR LOCAL
   ------------------------------------------------------------------------ */
const TIPOS = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

function servir(puerto) {
    return new Promise((resolve) => {
        const servidor = http.createServer((peticion, respuesta) => {
            const url = peticion.url.split('?')[0];

            // Retraso para el evento load de la escena: la carga no
            // termina hasta que esta imagen responde, así que la
            // captura se toma con la escena ya lista.
            if (url === '/__esperar') {
                const ms = Number(new URL(peticion.url, 'http://x').searchParams.get('ms')) || ESPERA_MS;
                setTimeout(() => {
                    respuesta.writeHead(200, { 'Content-Type': 'image/gif' });
                    respuesta.end(Buffer.from(
                        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'
                    ));
                }, ms);
                return;
            }

            let ruta = path.join(BASE, decodeURIComponent(url === '/' ? '/index.html' : url));
            if (!ruta.startsWith(BASE)) {
                respuesta.writeHead(403).end('Prohibido');
                return;
            }
            if (fs.existsSync(ruta) && fs.statSync(ruta).isDirectory()) {
                ruta = path.join(ruta, 'index.html');
            }
            if (!fs.existsSync(ruta)) {
                respuesta.writeHead(404).end('No encontrado');
                return;
            }

            const tipo = TIPOS[path.extname(ruta).toLowerCase()] || 'application/octet-stream';
            let contenido = fs.readFileSync(ruta);
            if (ruta.endsWith('index.html')) {
                // Inyecta el guion de la escena (si la hay).
                const escena = ESCENAS.find((e) => e.nombre === new URL(peticion.url, 'http://x').searchParams.get('escena'));
                if (escena) {
                    // La espera se pide en el <head>, al parsear: si se
                    // añadiera más tarde, el evento load ya habría
                    // ocurrido y la captura saldría antes de tiempo.
                    const espera = escena.pasos.length * 700 + 2600 + 1500;
                    contenido = Buffer.from(contenido.toString('utf-8')
                        .replace('</head>',
                            '<img src="/__esperar?ms=' + espera + '" alt=""' +
                            ' style="position:absolute;width:1px;height:1px;opacity:0">' +
                            '</head>')
                        .replace('</body>', GUION(escena.pasos) + '</body>'));
                }
            }
            respuesta.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-store' });
            respuesta.end(contenido);
        });
        servidor.listen(puerto, '127.0.0.1', () => resolve(servidor));
    });
}

/* --------------------------------------------------------------------------
   NAVEGADOR
   ------------------------------------------------------------------------ */
function buscarNavegador() {
    const candidatos = [
        process.env.NAVEGADOR,
        'firefox', 'firefox-esr',
        'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
        'microsoft-edge', 'msedge'
    ].filter(Boolean);
    for (const nombre of candidatos) {
        const r = spawnSync('which', [nombre], { encoding: 'utf-8' });
        if (r.status === 0) {
            return { nombre, ruta: r.stdout.trim() };
        }
    }
    return null;
}

/**
 * Captura una escena con el navegador headless.
 *
 * OJO: el navegador se lanza de forma ASÍNCRONA (spawn, no
 * spawnSync): el servidor que sirve la página vive en este mismo
 * proceso, y bloquear el bucle de eventos impediría responder al
 * navegador (la carga nunca terminaría).
 *
 * @param {object} navegador - { nombre, ruta }
 * @param {string} url - URL de la escena.
 * @param {string} destino - Fichero PNG de destino.
 */
function capturar(navegador, url, destino) {
    return new Promise((resolve, reject) => {
    const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'hazlono-captura-'));
    const esFirefox = navegador.nombre.includes('firefox');
    if (esFirefox) {
        // Un perfil limpio abre la página de bienvenida y no termina:
        // se anula el primer arranque.
        fs.writeFileSync(path.join(perfil, 'user.js'), [
            'user_pref("browser.shell.checkDefaultBrowser", false);',
            'user_pref("browser.startup.homepage_override.mstone", "ignore");',
            'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
            ''
        ].join('\n'));
    }
    const args = esFirefox
        ? ['--headless', '--profile', perfil, '--window-size', VENTANA, '--screenshot', destino, url]
        : ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
            `--user-data-dir=${perfil}`, '--window-size=' + VENTANA, `--screenshot=${destino}`, url];

    const proceso = spawn(navegador.ruta, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let salida = '';
    proceso.stderr.on('data', (d) => { salida += d.toString(); });

    const limite = setTimeout(() => {
        proceso.kill('SIGKILL');
        reject(new Error('tiempo agotado (90 s)'));
    }, 90000);

    proceso.on('error', (e) => {
        clearTimeout(limite);
        fs.rmSync(perfil, { recursive: true, force: true });
        reject(e);
    });

    proceso.on('exit', () => {
        clearTimeout(limite);
        fs.rmSync(perfil, { recursive: true, force: true });
        if (!fs.existsSync(destino)) {
            const detalle = salida.split('\n')
                .filter((l) => l && !l.includes('headless mode'))
                .join(' ').trim();
            reject(new Error(detalle || 'el navegador no generó la captura'));
            return;
        }
        resolve();
    });
    });
}

/* --------------------------------------------------------------------------
   PROGRAMA
   ------------------------------------------------------------------------ */
async function main() {
    const navegador = buscarNavegador();
    if (!navegador) {
        console.error('✗ No se encontró ningún navegador (firefox, chrome o chromium).');
        console.error('  Instala uno o indica la ruta con la variable NAVEGADOR.');
        process.exit(1);
    }
    console.log('Navegador: ' + navegador.nombre);

    fs.mkdirSync(SALIDA, { recursive: true });
    const servidor = await servir(8473);
    const base = 'http://127.0.0.1:8473/';

    for (const escena of ESCENAS) {
        const destino = path.join(SALIDA, escena.nombre + '.png');
        try {
            await capturar(navegador, base + '?escena=' + escena.nombre, destino);
            console.log('  ✓ ' + escena.nombre + '.png  (' + escena.titulo + ')');
        } catch (e) {
            console.error('  ✗ ' + escena.nombre + ': ' + e.message);
        }
    }

    servidor.close();
    console.log('\nCapturas en ' + path.relative(BASE, SALIDA) + '/');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
