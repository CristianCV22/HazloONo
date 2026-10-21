# Changelog

Todas las novedades del proyecto se anotan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
el proyecto usa [semver](https://semver.org/lang/es/).

## [No publicado]

## [1.0.0] — 2026-10-21

Primera versión pública: la herramienta está completa, verificada y
publicada.

### Añadido

- **Flujo de reflexión en 5 pasos** (bienvenida con umbral y respiración
  guiada, decisión, consecuencias, reflexión y elección) más el cierre
  con el resumen de la decisión.
- **Persistencia local**: el borrador se guarda solo (300 ms después de la
  última tecla) y se recupera al volver, incluso si se cierra la pestaña
  (`beforeunload`, `pagehide` y `visibilitychange`).
- **Historial** de hasta 50 reflexiones terminadas, con borrado por doble
  pulsación y sin `confirm()`.
- **Etiquetado emocional** opcional al empezar (miedo, ilusión, duda, calma).
- **Logotipo vivo**: rueda de decisión en SVG, con aguja dividida mientras
  se reflexiona, color y movimiento según la elección.
- **Preferencia de animaciones** (seguir al sistema / activar / desactivar),
  guardada en el navegador.
- **Degradación elegante**: sin JavaScript la página se lee y se puede
  escribir (con un aviso que lo explica); sin almacenamiento, la app sigue
  funcionando; si el módulo ES no carga (por ejemplo abierto como
  `file://`), la página vuelve al layout sin JavaScript.
- **Accesibilidad**: HTML semántico, `aria-current="step"`, `aria-live`,
  `role="alert"`, foco al título de cada paso, `aria-invalid` y
  `aria-describedby` en los errores, `prefers-reduced-motion` respetado
  (con opción de anularlo) y foco visible.
- **Pruebas**: suite funcional en Node sin dependencias (234 aserciones),
  verificador del grafo de módulos (con detección de ciclos) y sondas en
  navegador real (CDP).
- **Documentación**: README, `PRINCIPIOS.md`, `CONTRIBUTING.md` y este
  changelog.

### Corregido

- Las pruebas ya no dependen de una ruta absoluta: `npm test` funciona en
  cualquier sistema.
- El foco se mueve al título de cada paso incluso con movimiento
  reducido (antes se perdía en `<body>`).
- El contenido de un paso ya no se solapa en pantallas bajas: hace scroll
  interno.
- «Reiniciar» limpia también el estado emocional.
- El historial no se duplica al volver a modificar la elección: la entrada
  se actualiza.
- Las fechas corruptas del historial ya no se muestran como «Invalid Date».
- La marca, el menú y el pie no tardan 3 segundos en aparecer sin
  JavaScript.
- Los errores de validación nombran el campo que falta.

### Cambiado

- El grafo de módulos es **acíclico** (`datos.js` y `almacen.js` son hojas;
  el umbral pasa a su propio componente) y el verificador lo comprueba.
- ESLint y Stylelint en formato plano y autocontenido: `npm run lint` y
  `npm run lint:css` sin instalar nada en el proyecto.

[No publicado]: https://github.com/CristianCV22/HazloONo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/CristianCV22/HazloONo/releases/tag/v1.0.0
