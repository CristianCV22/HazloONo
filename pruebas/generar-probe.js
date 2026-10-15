// Genera probe.html: una copia de index.html con un script de sonda
// que muestrea el estado visual real (opacidades, animaciones,
// transiciones) en tiempo virtual y escribe un reporte en el DOM.
const fs = require('fs');
const path = require('path');

const carpeta = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(carpeta, 'index.html'), 'utf8');

const sonda = `
<script>
(function () {
    var R = [];
    function estado(el, props) {
        if (!el) return null;
        var c = getComputedStyle(el), o = {};
        for (var i = 0; i < props.length; i++) o[props[i]] = c[props[i]];
        return o;
    }
    function pseudo(el, props) {
        if (!el) return null;
        var c = getComputedStyle(el, '::before'), o = {};
        for (var i = 0; i < props.length; i++) o[props[i]] = c[props[i]];
        return o;
    }
    function sample(t) {
        R.push({
            t: t,
            reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
            noPreference: matchMedia('(prefers-reduced-motion: no-preference)').matches,
            fondo: pseudo(document.body, ['opacity', 'transform', 'animationName', 'animationDuration', 'animationDelay']),
            velo: pseudo(document.body, ['opacity']),
            markers: estado(document.querySelector('.markers'), ['opacity', 'animationName', 'animationDelay']),
            marks: estado(document.querySelector('.marks'), ['opacity', 'animationName', 'animationDelay']),
            needlePos: estado(document.querySelector('.needle-position'), ['opacity', 'transform', 'animationName', 'animationDelay']),
            anillo: estado(document.querySelector('.inner-ring'), ['opacity', 'animationName', 'animationDelay']),
            h1: estado(document.querySelector('header h1'), ['opacity', 'animationName', 'animationDelay']),
            nav: estado(document.querySelector('header nav'), ['opacity', 'animationName', 'animationDelay']),
            footer: estado(document.querySelector('footer'), ['opacity', 'animationName', 'animationDelay']),
            h2: estado(document.querySelector('#reflexion section.activa > h2'), ['opacity', 'animationName', 'animationDelay']),
            boton: estado(document.querySelector('#reflexion section.activa > button'), ['opacity', 'animationName', 'animationDelay'])
        });
    }
    [0, 300, 700, 1100, 1600, 2100, 2600, 3100, 3600, 4200, 5000, 6000, 7000].forEach(function (t) {
        setTimeout(function () { sample(t); }, t);
    });
    // Simula avanzar al paso 2 y muestrea la transición direccional
    setTimeout(function () {
        var btn = document.querySelector('#reflexion section.activa [data-avanzar]');
        if (btn) btn.click();
        [40, 180, 500].forEach(function (d) {
            setTimeout(function () {
                var s = document.querySelector('#reflexion section.activa');
                var cuerpo = document.body.className;
                R.push({
                    t: 7500 + d,
                    momento: 'avance paso 2',
                    clasesBody: cuerpo,
                    transicionando: (typeof transicionando !== 'undefined') ? transicionando : 'n/a',
                    seccion: estado(s, ['opacity', 'transform']),
                    h2: estado(s.querySelector('h2'), ['opacity', 'animationName', 'animationDelay']),
                    campo: estado(s.querySelector('textarea'), ['opacity', 'animationName', 'animationDelay'])
                });
            }, d);
        });
    }, 7500);
    window.addEventListener('error', function (e) {
        R.push({ error: e.message });
    });
    setTimeout(function () {
        var pre = document.createElement('pre');
        pre.id = 'probe-report';
        pre.textContent = 'PROBE-REPORT ' + JSON.stringify(R);
        document.body.appendChild(pre);
    }, 8200);
})();
</script>`;

const salida = html.replace('</body>', sonda + '\n</body>');
fs.writeFileSync(path.join(carpeta, 'probe.html'), salida);
console.log('probe.html generado');
