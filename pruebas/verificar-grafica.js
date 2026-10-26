/* ==========================================================================
   Hazlo o No - Verificador del grafo de módulos
   --------------------------------------------------------------------------
   Comprueba tres cosas del grafo de importaciones:
   1. Que cada símbolo importado exista y lo exporte su módulo.
   2. Que no haya bloques «import» sueltos (todo está en la lista).
   3. Que el grafo sea ACÍCLICO: ningún módulo puede depender
      (directa o indirectamente) de sí mismo. Un ciclo funciona
      mientras el orden de evaluación no cambie — y el orden de
      evaluación de los módulos ES es el del documento: frágil.
      Un grafo acíclico no tiene ese problema.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
// Raíz del proyecto, calculada desde la ubicación de este
// archivo (sin rutas absolutas: la prueba es portable).
const BASE = path.join(__dirname, '..') + path.sep;

/* El grafo declarado: módulo → [módulo del que depende, símbolos] */
const MODULOS = {
    'scripts/datos.js': [],
    'scripts/almacen.js': [],
    'scripts/components/logo.js': [
        ['../datos.js', ['logo', 'clasesPaso', 'respuestas', 'pasoActual']]
    ],
    'scripts/components/umbral.js': [
        ['../datos.js', ['secciones', 'pasoActual', 'transicionando']]
    ],
    'scripts/components/dual-state.js': [
        ['https://esm.sh/three@0.163.0/build/three.module.js', ['*']]
    ],
    'scripts/state.js': [
        ['./datos.js', ['secciones', 'pasoActual', 'transicionando', 'respuestas', 'fijarPasoActual', 'fijarTransicionando', 'formulario', 'logo', 'menu', 'navIndicador', 'pasosIndicador', 'piePaso', 'clasesPaso', 'nombresPaso', 'obtenerIdReflexion', 'fijarIdReflexion']],
        ['./almacen.js', ['almacenLocal', 'movimientoReducido']],
        ['./components/logo.js', ['actualizarLogo', 'actualizarAmbiente']],
        ['./components/umbral.js', ['ocultarUmbral']]
    ],
    'scripts/components/form.js': [
        ['../datos.js', ['secciones', 'pasoActual', 'transicionando', 'respuestas', 'pieConsejo', 'formulario', 'reiniciarIdReflexion']],
        ['../state.js', ['mostrarError', 'enfocarTitulo', 'mostrarPaso', 'transicionarA', 'archivarReflexion', 'guardarPronto', 'borrarBorrador', 'cancelarGuardado']],
        ['../almacen.js', ['movimientoReducido']],
        ['./logo.js', ['actualizarLogo', 'actualizarAmbiente']],
        ['./umbral.js', ['mostrarUmbral', 'ocultarUmbral', 'iniciarRespiracion', 'terminarRespiracion']]
    ],
    'scripts/components/modal.js': [
        ['../almacen.js', ['almacenamientoDisponible', 'guardarPreferenciaAnimacion', 'aplicarPreferenciaAnimacion']],
        ['../state.js', ['leerHistorial', 'borrarHistorial']],
        ['../datos.js', ['menu']],
        ['./form.js', ['reiniciar']]
    ],
    'scripts/main.js': [
        ['./almacen.js', ['aplicarPreferenciaAnimacion']],
        ['./datos.js', ['pasoActual', 'secciones']],
        ['./state.js', ['mostrarPaso', 'restaurarBorrador']],
        ['./components/form.js', ['initForm', 'actualizarEmocionUI', 'prepararCierre']],
        ['./components/modal.js', ['initModal']],
        ['./components/dual-state.js', ['DualStateExperience']]
    ]
};

function normalizar(ruta) {
    return ruta.split(path.sep).join('/');
}

const contenido = {};
for (const rel of Object.keys(MODULOS)) {
    contenido[rel] = fs.readFileSync(path.join(BASE, rel), 'utf-8');
}

let ok = true;
let total = 0;

/* 1) Cada símbolo importado existe y lo exporta su módulo. */
const grafo = {}; // módulo → [módulos de los que depende]
for (const [rel, importaciones] of Object.entries(MODULOS)) {
    grafo[rel] = [];
    for (const [fuente, nombres] of importaciones) {
        // Ignorar importaciones de URLs externas (CDN, etc.): no son
        // archivos locales del proyecto y no afectan al grafo acíclico.
        if (fuente.startsWith('http://') || fuente.startsWith('https://')) {
            continue;
        }
        const absoluta = normalizar(path.relative(BASE, path.resolve(path.dirname(BASE + rel), fuente)));
        const destino = contenido[absoluta];
        if (!destino) {
            console.error('✗ ' + rel + ': no se encontró ' + absoluta);
            ok = false;
            continue;
        }
        grafo[rel].push(absoluta);
        for (const n of nombres) {
            total++;
            const re = new RegExp('^export (?:function|const|let|class) ' + n + '\\b', 'm');
            if (!re.test(destino)) {
                console.error('✗ ' + rel + ' importa "' + n + '" pero ' + absoluta + ' no lo exporta');
                ok = false;
            }
        }
    }
}

/* 2) Ningún módulo debe tener importaciones sueltas. */
for (const rel of Object.keys(MODULOS)) {
    const lineas = contenido[rel].split('\n').filter((l) => /^\s*import\s/.test(l));
    if (lineas.length !== MODULOS[rel].length) {
        console.error('✗ ' + rel + ': ' + lineas.length + ' bloques import, esperaba ' + MODULOS[rel].length);
        ok = false;
    }
}

/* 3) El grafo debe ser acíclico (detección por colores:
      0 = sin visitar, 1 = en el camino actual, 2 = terminado). */
const color = {};
for (const rel of Object.keys(grafo)) {
    color[rel] = 0;
}
const camino = [];

function visitar(rel) {
    if (color[rel] === 1) {
        const desde = camino.indexOf(rel);
        const ciclo = camino.slice(desde).concat(rel).join(' → ');
        console.error('✗ ciclo de importaciones: ' + ciclo);
        ok = false;
        return;
    }
    if (color[rel] === 2) {
        return;
    }
    color[rel] = 1;
    camino.push(rel);
    for (const destino of grafo[rel] || []) {
        if (grafo[destino]) {
            visitar(destino);
        }
    }
    camino.pop();
    color[rel] = 2;
}
for (const rel of Object.keys(grafo)) {
    visitar(rel);
}

console.log('Importaciones comprobadas: ' + total);
console.log('Módulos: ' + Object.keys(grafo).length + (ok ? ' — grafo acíclico ✓' : ''));
if (!ok) {
    console.error('✗ la gráfica de módulos tiene problemas');
    process.exit(1);
}
console.log('✓ la gráfica de módulos está completa, consistente y acíclica');
