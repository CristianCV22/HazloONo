/* ==========================================================================
   Hazlo o No - Configuración de ESLint (formato plano, ESLint 9+)
   --------------------------------------------------------------------------
   El proyecto no tiene dependencias: ESLint se usa bajo demanda con
   npx (se descarga en la caché de npm, no se instala en el proyecto):

       npm run lint

   Reglas: pocas y las que importan. `no-undef` es un error (un nombre
   que no existe es un fallo real); el resto avisa.
   ========================================================================== */

module.exports = [
    {
        // Todo el JavaScript del proyecto.
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'commonjs',
            globals: {
                // Navegador
                window: 'readonly',
                document: 'readonly',
                localStorage: 'readonly',
                navigator: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                console: 'readonly',
                // Node (pruebas y sondas)
                require: 'readonly',
                module: 'writable',
                exports: 'writable',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                Buffer: 'readonly',
                // WebSocket global de Node (las sondas hablan CDP con él)
                WebSocket: 'readonly'
            }
        },
        rules: {
            // `caughtErrors: 'none'`: el proyecto captura errores a
            // propósito (catch (e) { /* comentario */ }) para fallar
            // en silencio.
            'no-unused-vars': ['warn', { caughtErrors: 'none' }],
            'no-undef': 'error',
            'no-console': 'off',
            eqeqeq: 'warn',
            'no-var': 'off'
        }
    },
    {
        // La aplicación: módulos ES nativos.
        files: ['scripts/**/*.js'],
        languageOptions: {
            sourceType: 'module'
        }
    },
    {
        // Pruebas y sondas: CommonJS de Node.
        files: ['tests/**/*.js', 'pruebas/**/*.js'],
        languageOptions: {
            sourceType: 'commonjs'
        }
    },
    {
        // Nada que lintar aquí.
        ignores: ['node_modules/**']
    }
];
