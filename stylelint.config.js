/* ==========================================================================
   Hazlo o No - Configuración de Stylelint (formato plano)
   --------------------------------------------------------------------------
   El proyecto no tiene dependencias: Stylelint se usa bajo demanda con
   npx (se descarga en la caché de npm, no se instala en el proyecto):

       npm run lint:css

   La configuración es AUTOCONTENIDA (no depende de
   "stylelint-config-standard"): así el linter funciona tal cual, sin
   instalar nada más.

   Reglas: las que importan (errores reales) y las del estilo del
   proyecto (4 espacios, comillas simples, especificidad sin
   diagnóstico, :has() y :where() permitidos…).
   ========================================================================== */

module.exports = {
    rules: {
        /* --- Errores reales --- */
        'at-rule-no-unknown': [true, { ignoreAtRules: ['property'] }],
        'block-no-empty': true,
        'color-no-invalid-hex': true,
        'declaration-block-no-duplicate-properties': [
            true,
            {
                // "height: 100vh; height: 100dvh;" es un fallback
                // legítimo (el navegador usa el último que entiende).
                ignore: ['consecutive-duplicates-with-different-values']
            }
        ],
        'declaration-block-no-shorthand-property-overrides': true,
        'font-family-no-missing-generic-family-keyword': true,
        'function-no-unknown': true,
        'keyframe-block-no-duplicate-selectors': true,
        'media-feature-name-no-unknown': true,
        'no-duplicate-selectors': true,
        'property-no-unknown': true,
        'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['where', 'has'] }],
        'selector-pseudo-element-no-unknown': true,
        'unit-no-unknown': true,

        /* --- Estilo del proyecto ---
           Nota: Stylelint 16 eliminó las reglas "estilísticas"
           (indentation, max-empty-lines, no-eol-whitespace…):
           el formato del CSS se cuida a mano, no con el linter.
           El CSS del proyecto agrupa las declaraciones y apila
           reglas relacionadas sin líneas en blanco intermedias. */

        /* El proyecto usa :has() anidado y clases purely
           semánticas: la especificidad descendente y los patrones
           de nombre no se diagnostican. */
        'no-descending-specificity': null,
        'selector-class-pattern': null,
        'selector-id-pattern': null,
        'custom-property-pattern': null,
        'value-keyword-case': null
    }
};
