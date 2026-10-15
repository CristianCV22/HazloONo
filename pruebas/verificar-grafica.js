const fs = require('fs');
const path = require('path');
const BASE = 'C:/Users/valde/OneDrive/Documentos/Proyectos/HazloONo/';

const MODULOS = {
    'scripts/utils.js': [
        ['./state.js', ['secciones', 'respuestas', 'pasoActual', 'formulario', 'mostrarPaso']],
        ['./components/form.js', ['prepararCierre', 'actualizarEmocionUI']]
    ],
    'scripts/state.js': [
        ['./utils.js', ['almacenLocal', 'guardarPronto', 'borrarBorrador', 'cancelarGuardado', 'movimientoReducido']],
        ['./components/logo.js', ['actualizarLogo', 'actualizarAmbiente']],
        ['./components/form.js', ['ocultarUmbral']]
    ],
    'scripts/components/logo.js': [
        ['../state.js', ['logo', 'clasesPaso', 'respuestas', 'pasoActual']]
    ],
    'scripts/components/form.js': [
        ['../state.js', ['secciones', 'pasoActual', 'transicionando', 'respuestas', 'pieConsejo', 'formulario', 'mostrarError', 'enfocarTitulo', 'mostrarPaso', 'transicionarA', 'archivarReflexion']],
        ['../utils.js', ['guardarPronto', 'borrarBorrador', 'cancelarGuardado', 'movimientoReducido']],
        ['./logo.js', ['actualizarLogo', 'actualizarAmbiente']]
    ],
    'scripts/components/modal.js': [
        ['../utils.js', ['almacenamientoDisponible', 'guardarPreferenciaAnimacion', 'aplicarPreferenciaAnimacion']],
        ['../state.js', ['leerHistorial', 'borrarHistorial', 'menu']],
        ['./form.js', ['reiniciar']]
    ],
    'scripts/main.js': [
        ['./utils.js', ['aplicarPreferenciaAnimacion', 'restaurarBorrador']],
        ['./state.js', ['mostrarPaso']],
        ['./components/form.js', ['initForm', 'actualizarEmocionUI']],
        ['./components/modal.js', ['initModal']]
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
for (const [rel, importaciones] of Object.entries(MODULOS)) {
    for (const [fuente, nombres] of importaciones) {
        const absoluta = normalizar(path.relative(BASE, path.resolve(path.dirname(BASE + rel), fuente)));
        const destino = contenido[absoluta];
        if (!destino) {
            console.error('✗ ' + rel + ': no se encontró ' + absoluta);
            ok = false;
            continue;
        }
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

// También: ningún módulo debe tener importaciones
// sueltas (toda línea import debe estar en la lista).
for (const rel of Object.keys(MODULOS)) {
    const lineas = contenido[rel].split('\n').filter((l) => /^\s*import\s/.test(l));
    if (lineas.length !== MODULOS[rel].length) {
        console.error('✗ ' + rel + ': ' + lineas.length + ' bloques import, esperaba ' + MODULOS[rel].length);
        ok = false;
    }
}

console.log('Importaciones comprobadas: ' + total);
console.log(ok ? '✓ la gráfica de módulos está completa y consistente' : '✗ hay fallos');
process.exit(ok ? 0 : 1);
