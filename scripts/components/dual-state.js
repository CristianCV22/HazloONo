/* ==========================================================================
   Hazlo o No - Componente: Dual-State WebGL (experiencia inmersiva)
   ==========================================================================
   Componente que renderiza una experiencia inmersiva de toma de
   decisiones mediante WebGL (Three.js). Transiciona suavemente entre
   dos estados atmosféricos según una variable normalizada `t`:

     t = 0.0 → "HAZLO"   (atmósfera cálida, ámbar, partículas arriba)
     t = 1.0 → "NO"      (atmósfera fría, pizarra/cian, partículas abajo)

   Es un módulo HOJA: no importa nada del proyecto, solo Three.js desde
   CDN. Así el grafo de módulos sigue siendo acíclico.

   La UI (titulular + botón) es HTML/CSS superpuesta sobre el canvas.
   El canvas tiene pointer-events: none para no bloquear el scroll
   nativo ni los clics del formulario.
   ========================================================================== */

import * as THREE from 'https://esm.sh/three@0.163.0/build/three.module.js';

/* --------------------------------------------------------------------------
   CONFIGURACIÓN DE LOS DOS ESTADOS
   -------------------------------------------------------------------------- */
const ESTADO_A = { // "HAZLO"
    nombre: 'hacerlo',
    colorFondo: 0xF8FAFC,   // azul pálido casi blanco
    colorLuz: 0xF59E0B,     // ámbar
    intensidadLuz: 1.2,
    colorNiebla: 0xFEF3C7,  // ámbar muy claro
    densidadNiebla: 0.0005,
    camaraPos: new THREE.Vector3(0, 2, 5),
    camaraMira: new THREE.Vector3(0, 0, 0),
    camaraFOV: 45,
    particionDireccion: new THREE.Vector3(0, 1, 0), // flotar hacia arriba
    particionVelocidad: 0.5,
    titulo: 'HAZLO'
};

const ESTADO_B = { // "NO"
    nombre: 'no-hacerlo',
    colorFondo: 0x1E293B,   // pizarra oscuro
    colorLuz: 0x06B6D4,     // cian frío
    intensidadLuz: 0.8,
    colorNiebla: 0x0F172A,  // pizarra muy oscuro
    densidadNiebla: 0.002,
    camaraPos: new THREE.Vector3(-2, 1, 6),
    camaraMira: new THREE.Vector3(-1, 0, 0),
    camaraFOV: 55,
    particionDireccion: new THREE.Vector3(0, -0.5, 0), // caer lentamente
    particionVelocidad: 0.2,
    titulo: 'NO'
};

/* --------------------------------------------------------------------------
   CLASE PRINCIPAL
   -------------------------------------------------------------------------- */
export class DualStateExperience {
    /**
     * @param {HTMLElement} contenedor - Elemento DOM donde insertar el canvas.
     */
    constructor(contenedor) {
        this.contenedor = contenedor;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.luces = {};
        this.particulas = null;
        this.geometriaParticulas = null;
        this.materialParticulas = null;
        this.posicionesParticulas = null;
        this.velocidadesParticulas = null;
        this.animationId = null;
        this.overlay = null;
        this.titulo = null;
        this.subtitulo = null;
        this.boton = null;

        // Estado de la variable normalizada t (0 = HAZLO, 1 = NO)
        this.t = 0;
        this.tTarget = 0;
        this.damping = 0.08;

        // Estado activo
        this.activo = false;

        // Preferencia de movimiento reducido
        this.reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Contador de frames para animación de partículas
        this.tiempo = 0;

        // Bind para mantener contexto en eventos
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onResize = this._onResize.bind(this);
        this._animar = this._animar.bind(this);
    }

    /* --------------------------------------------------------------------------
       INICIALIZACIÓN
       -------------------------------------------------------------------------- */
    init() {
        if (this.activo) {
            return;
        }

        // Detectar WebGL disponible
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) {
                console.warn('Dual-State: WebGL no disponible, experiencia inmersiva desactivada.');
                return false;
            }
        } catch (e) {
            console.warn('Dual-State: Error al inicializar WebGL.', e);
            return false;
        }

        this._crearEscena();
        this._crearUI();
        this._registrarEventos();

        this.activo = true;
        this._animar();

        return true;
    }

    _crearEscena() {
        // Escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(ESTADO_A.colorFondo);
        this.scene.fog = new THREE.Fog(ESTADO_A.colorNiebla, 1, 50);

        // Cámara
        this.camera = new THREE.PerspectiveCamera(
            ESTADO_A.camaraFOV,
            this.contenedor.clientWidth / this.contenedor.clientHeight || 1,
            0.1,
            100
        );
        this.camera.position.copy(ESTADO_A.camaraPos);
        this.camera.lookAt(ESTADO_A.camaraMira);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.contenedor.clientWidth, this.contenedor.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.contenedor.appendChild(this.renderer.domElement);

        // Luz principal (direccional)
        this.luces.direccional = new THREE.DirectionalLight(ESTADO_A.colorLuz, ESTADO_A.intensidadLuz);
        this.luces.direccional.position.set(5, 10, 7);
        this.scene.add(this.luces.direccional);

        // Luz de relleno cálida (estado A)
        this.luces.calida = new THREE.PointLight(0xF59E0B, 0.6, 30);
        this.luces.calida.position.set(-5, 5, -5);
        this.scene.add(this.luces.calida);

        // Luz de relleno fría (estado B)
        this.luces.fria = new THREE.PointLight(0x06B6D4, 0.2, 30);
        this.luces.fria.position.set(5, -5, -5);
        this.scene.add(this.luces.fria);

        // Luz ambiental suave
        this.luces.ambiental = new THREE.AmbientLight(0xFFFFFF, 0.4);
        this.scene.add(this.luces.ambiental);

        // Partículas
        this._crearParticulas(2500);
    }

    _crearParticulas(cantidad) {
        this.geometriaParticulas = new THREE.BufferGeometry();
        this.posicionesParticulas = new Float32Array(cantidad * 3);
        this.velocidadesParticulas = new Float32Array(cantidad * 3);

        for (let i = 0; i < cantidad; i++) {
            const i3 = i * 3;
            // Posición inicial aleatoria en un cubo
            this.posicionesParticulas[i3] = (Math.random() - 0.5) * 40;
            this.posicionesParticulas[i3 + 1] = (Math.random() - 0.5) * 20;
            this.posicionesParticulas[i3 + 2] = (Math.random() - 0.5) * 40;

            // Velocidad inicial
            this.velocidadesParticulas[i3] = (Math.random() - 0.5) * 0.1;
            this.velocidadesParticulas[i3 + 1] = ESTADO_A.particionVelocidad + Math.random() * 0.2;
            this.velocidadesParticulas[i3 + 2] = (Math.random() - 0.5) * 0.1;
        }

        this.geometriaParticulas.setAttribute('position', new THREE.BufferAttribute(this.posicionesParticulas, 3));
        this.geometriaParticulas.setAttribute('velocity', new THREE.BufferAttribute(this.velocidadesParticulas, 3));

        this.materialParticulas = new THREE.PointsMaterial({
            size: 0.15,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.6,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        // Colores iniciales de partículas (azul cálido)
        const colores = new Float32Array(cantidad * 3);
        for (let i = 0; i < cantidad; i++) {
            const i3 = i * 3;
            colores[i3] = 0.1;     // R
            colores[i3 + 1] = 0.4; // G
            colores[i3 + 2] = 0.8; // B
        }
        this.geometriaParticulas.setAttribute('color', new THREE.BufferAttribute(colores, 3));

        this.particulas = new THREE.Points(this.geometriaParticulas, this.materialParticulas);
        this.scene.add(this.particulas);
    }

    _crearUI() {
        // Contenedor del overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'dual-state-overlay';
        this.overlay.setAttribute('aria-hidden', 'true');
        this.overlay.innerHTML = `
            <div class="dual-state-hud">
                <h1 class="dual-title" id="dual-titulo">HAZLO</h1>
                <p class="dual-subtitle" id="dual-subtitulo">
                    Una experiencia inmersiva para sentir las dos caras
                    de tu decisión antes de comprometerte.
                </p>
                <button class="dual-btn-confirm" id="dual-btn-confirm" type="button">
                    <span>Confirmar decisión</span>
                    <span aria-hidden="true">→</span>
                </button>
            </div>
        `;
        document.body.appendChild(this.overlay);

        this.titulo = document.getElementById('dual-titulo');
        this.subtitulo = document.getElementById('dual-subtitulo');
        this.boton = document.getElementById('dual-btn-confirm');

        // El botón es el único elemento con pointer-events: auto
        this.boton.addEventListener('click', () => {
            this.desactivar();
            document.dispatchEvent(new CustomEvent('dual-state-confirmar', {
                detail: { eleccion: this.t >= 0.5 ? 'no-hacerlo' : 'hacerlo' }
            }));
        });
    }

    _registrarEventos() {
        // Movimiento del cursor sobre el canvas (sin bloquear scroll)
        this.contenedor.addEventListener('pointermove', this._onPointerMove, { passive: true });
        // Touch move (móvil)
        this.contenedor.addEventListener('touchmove', this._onTouchMove, { passive: true });
        // Rueda de scroll vertical
        window.addEventListener('wheel', this._onWheel, { passive: true });
        // Resize
        window.addEventListener('resize', this._onResize);
    }

    _onPointerMove(evento) {
        if (!this.activo || this.reducido) {
            return;
        }
        const rect = this.contenedor.getBoundingClientRect();
        const x = (evento.clientX - rect.left) / rect.width;
        const y = (evento.clientY - rect.top) / rect.height;
        // Normalizar a [-1, 1]
        const nx = x * 2 - 1;
        // Combinar X e Y en un objetivo de t (0 = HAZLO, 1 = NO)
        // Usamos una mezcla: el centro es neutral, hacia arriba = HAZLO, hacia abajo = NO
        const tDesdeY = (0.5 - y); // -0.5 (arriba) a 0.5 (abajo)
        const tDesdeX = nx * 0.3;  // ligera influencia X
        const objetivo = 0.5 + tDesdeY + tDesdeX;
        this.setTargetT(Math.max(0, Math.min(1, objetivo)));
    }

    _onTouchMove(evento) {
        if (!this.activo || this.reducido) {
            return;
        }
        const tacto = evento.touches[0];
        const rect = this.contenedor.getBoundingClientRect();
        const y = (tacto.clientY - rect.top) / rect.height;
        const tDesdeY = (0.5 - y);
        const objetivo = 0.5 + tDesdeY;
        this.setTargetT(Math.max(0, Math.min(1, objetivo)));
    }

    _onWheel(evento) {
        if (!this.activo || this.reducido) {
            return;
        }
        // Rueda vertical: paso corto
        const delta = -evento.deltaY * 0.001;
        this.setTargetT(this.tTarget + delta);
    }

    _onResize() {
        if (!this.activo || !this.camera || !this.renderer) {
            return;
        }
        this.camera.aspect = this.contenedor.clientWidth / this.contenedor.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.contenedor.clientWidth, this.contenedor.clientHeight);
    }

    /* --------------------------------------------------------------------------
       ESTADO Y TRANSICIÓN
       -------------------------------------------------------------------------- */
    /**
     * Establece el valor objetivo de t (0 = HAZLO, 1 = NO).
     * @param {number} valor - Valor entre 0 y 1.
     */
    setTargetT(valor) {
        this.tTarget = Math.max(0, Math.min(1, valor));
    }

    /**
     * Activa la experiencia inmersiva.
     * @returns {boolean} true si se activó.
     */
    activar() {
        if (this.activo) {
            return true;
        }
        return this.init();
    }

    /**
     * Desactiva la experiencia: limpia escena, overlay y eventos.
     */
    desactivar() {
        if (!this.activo) {
            return;
        }

        // Detener animación
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Quitar eventos
        this.contenedor.removeEventListener('pointermove', this._onPointerMove);
        this.contenedor.removeEventListener('touchmove', this._onTouchMove);
        window.removeEventListener('wheel', this._onWheel);
        window.removeEventListener('resize', this._onResize);

        // Quitar canvas del contenedor
        if (this.renderer && this.renderer.domElement && this.contenedor.contains(this.renderer.domElement)) {
            this.contenedor.removeChild(this.renderer.domElement);
        }

        // Quitar overlay del body
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }

        // Dispose de recursos Three.js
        this._dispose();

        this.activo = false;
        this.t = 0;
        this.tTarget = 0;
    }

    _dispose() {
        if (this.geometriaParticulas) {
            this.geometriaParticulas.dispose();
        }
        if (this.materialParticulas) {
            this.materialParticulas.dispose();
        }
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        this.scene = null;
        this.camera = null;
        this.luces = {};
        this.particulas = null;
        this.geometriaParticulas = null;
        this.materialParticulas = null;
        this.posicionesParticulas = null;
        this.velocidadesParticulas = null;
    }

    /* --------------------------------------------------------------------------
       BUCLE DE ANIMACIÓN
       -------------------------------------------------------------------------- */
    _animar() {
        if (!this.activo) {
            return;
        }

        this.animationId = requestAnimationFrame(this._animar);
        this.tiempo += 0.016;

        // 1) Interpolar t actual hacia tTarget (inercia)
        this.t += (this.tTarget - this.t) * this.damping;

        // 2) Interpolar entre estados A y B
        const a = ESTADO_A;
        const b = ESTADO_B;
        const t = this.t;

        // Fondo
        const colorFondo = new THREE.Color().lerpColors(new THREE.Color(a.colorFondo), new THREE.Color(b.colorFondo), t);
        this.scene.background = colorFondo;
        this.renderer.setClearColor(colorFondo);

        // Luces
        this.luces.direccional.color.lerpColors(new THREE.Color(a.colorLuz), new THREE.Color(b.colorLuz), t);
        this.luces.direccional.intensity = a.intensidadLuz + (b.intensidadLuz - a.intensidadLuz) * t;

        this.luces.calida.intensity = 0.6 * (1 - t);
        this.luces.fria.intensity = 0.2 + 0.8 * t;

        // Niebla
        this.scene.fog.color.lerpColors(new THREE.Color(a.colorNiebla), new THREE.Color(b.colorNiebla), t);
        this.scene.fog.density = a.densidadNiebla + (b.densidadNiebla - a.densidadNiebla) * t;

        // Cámara
        this.camera.position.lerpVectors(a.camaraPos, b.camaraPos, t);
        this.camera.lookAt(
            a.camaraMira.x + (b.camaraMira.x - a.camaraMira.x) * t,
            a.camaraMira.y + (b.camaraMira.y - a.camaraMira.y) * t,
            a.camaraMira.z + (b.camaraMira.z - a.camaraMira.z) * t
        );
        this.camera.fov = a.camaraFOV + (b.camaraFOV - a.camaraFOV) * t;
        this.camera.updateProjectionMatrix();

        // Partículas
        const direccionY = a.particionDireccion.y + (b.particionDireccion.y - a.particionDireccion.y) * t;
        const velocidad = a.particionVelocidad + (b.particionVelocidad - a.particionVelocidad) * t;

        for (let i = 0; i < this.posicionesParticulas.length / 3; i++) {
            const i3 = i * 3;
            // Movimiento
            this.posicionesParticulas[i3] += this.velocidadesParticulas[i3];
            this.posicionesParticulas[i3 + 1] += direccionY * velocidad;
            this.posicionesParticulas[i3 + 2] += this.velocidadesParticulas[i3 + 2];

            // Rebote en los límites para mantenerlas en escena
            if (this.posicionesParticulas[i3] > 20 || this.posicionesParticulas[i3] < -20) {
                this.velocidadesParticulas[i3] *= -1;
            }
            if (this.posicionesParticulas[i3 + 1] > 10 || this.posicionesParticulas[i3 + 1] < -10) {
                this.posicionesParticulas[i3 + 1] = t > 0.5 ? 10 : -10;
            }
            if (this.posicionesParticulas[i3 + 2] > 20 || this.posicionesParticulas[i3 + 2] < -20) {
                this.velocidadesParticulas[i3 + 2] *= -1;
            }

            // Color de partícula interpolado
            const colorAttr = this.geometriaParticulas.attributes.color;
            const r = 0.1 + (0.3 - 0.1) * t;
            const g = 0.4 + (0.1 - 0.4) * t;
            const b = 0.8 + (0.9 - 0.8) * t;
            colorAttr.setXYZ(i3, r, g, b);
        }

        this.geometriaParticulas.attributes.position.needsUpdate = true;
        this.geometriaParticulas.attributes.velocity.needsUpdate = true;
        this.geometriaParticulas.attributes.color.needsUpdate = true;

        // 3) Actualizar UI (titulular y clases de estado)
        this._actualizarUI(t);

        // 4) Render
        this.renderer.render(this.scene, this.camera);
    }

    _actualizarUI(t) {
        if (!this.titulo || !this.subtitulo || !this.boton) {
            return;
        }

        // Clase de estado en <body> para CSS
        document.body.classList.toggle('dual-estado-hacerlo', t < 0.5);
        document.body.classList.toggle('dual-estado-no-hacerlo', t >= 0.5);

        // Titular dinámico
        if (t < 0.5) {
            this.titulo.textContent = 'HAZLO';
            this.subtitulo.textContent = 'Una experiencia inmersiva para sentir las dos caras de tu decisión antes de comprometerte.';
            this.boton.textContent = 'Confirmar: HACERLO →';
        } else {
            this.titulo.textContent = 'NO';
            this.subtitulo.textContent = 'Una experiencia inmersiva para sentir las dos caras de tu decisión antes de comprometerte.';
            this.boton.textContent = 'Confirmar: NO →';
        }

        // Opacidad del titular según t (pulsar al cruzar el centro)
        const opacidad = 0.7 + 0.3 * Math.sin(t * Math.PI);
        this.titulo.style.opacity = opacidad;
    }

    /* --------------------------------------------------------------------------
       CONSULTAS
       -------------------------------------------------------------------------- */
    estaActivo() {
        return this.activo;
    }

    obtenerT() {
        return this.t;
    }
}
