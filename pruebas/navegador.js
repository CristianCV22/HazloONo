/* ==========================================================================
   Hazlo o No - Utilidades de las sondas (navegador y rutas)
   --------------------------------------------------------------------------
   Las sondas conducen un navegador real (Edge, Chrome o Chromium)
   en modo headless por el protocolo CDP. Este módulo centraliza
   las rutas para que las sondas funcionen en cualquier equipo:
   nada de rutas absolutas.

   Variables de entorno (opcionales):
   - NAVEGADOR        ruta o nombre del ejecutable del navegador
   - PUERTO_SERVIDOR  puerto del servidor local de la página
   - URL_PAGINA       URL completa de la página a probar
   - CARPETA_PERFILES  carpeta donde se crean los perfiles temporales
   ========================================================================== */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

/* Rutas en las que puede estar un navegador Chromium.
   La primera que exista gana; si no hay ninguna, se usa el
   nombre (el sistema lo busca en el PATH). */
const CANDIDATOS = {
    win32: [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ],
    darwin: [
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ],
    linux: [
        '/usr/bin/microsoft-edge',
        '/usr/bin/microsoft-edge-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium'
    ]
};

/**
 * Localiza el navegador para las sondas.
 * @returns {string} ruta del ejecutable (o su nombre, si se
 *                   busca en el PATH).
 */
function resolverNavegador() {
    if (process.env.NAVEGADOR) {
        return process.env.NAVEGADOR;
    }
    const lista = CANDIDATOS[process.platform] || [];
    for (const ruta of lista) {
        if (fs.existsSync(ruta)) {
            return ruta;
        }
    }
    return 'microsoft-edge';
}

/**
 * Puerto del servidor local que sirve la página.
 * @param {number} defecto - Puerto por defecto de la sonda.
 * @returns {number}
 */
function puertoServidor(defecto) {
    return Number(process.env.PUERTO_SERVIDOR || defecto);
}

/**
 * URL de la página a probar.
 * @param {string} defecto - URL por defecto de la sonda.
 * @returns {string}
 */
function urlPagina(defecto) {
    return process.env.URL_PAGINA || defecto;
}

/**
 * URL de un fichero del proyecto (file://). Sirve para probar
 * la degradación sin JavaScript abriendo el HTML directamente.
 * @param {string} relativo - Ruta relativa a la raíz del proyecto.
 * @returns {string}
 */
function urlArchivo(relativo) {
    return pathToFileURL(path.join(__dirname, '..', relativo)).href;
}

/**
 * Carpeta temporal donde se crea el perfil del navegador
 * (uno por sonda, para que no se pisen).
 * @param {string} nombre - Nombre de la sonda.
 * @returns {string}
 */
function perfilTemporal(nombre) {
    const base = process.env.CARPETA_PERFILES ||
        path.join(os.tmpdir(), 'hazlono-perfiles');
    fs.mkdirSync(base, { recursive: true });
    return path.join(base, nombre + '-' + Date.now());
}

module.exports = {
    resolverNavegador,
    puertoServidor,
    urlPagina,
    urlArchivo,
    perfilTemporal
};
