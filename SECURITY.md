# Seguridad

## Qué hace (y qué no hace) Hazlo o No

Hazlo o No es una herramienta local: **no hay servidor, no hay cuentas y
no hay analítica**. Todo lo que escribes se guarda en tu navegador
(`localStorage`) y nunca sale de tu equipo.

Esto reduce mucho la superficie de ataque, pero no la elimina. Si
encuentras un problema de seguridad, escríbeme.

## Cómo reportar un problema

Por favor, **no abras una incidencia pública** para un fallo de
seguridad. Escríbeme directamente:

- **Correo**: valdes2230@gmail.com
- O usa el formulario privado de «Security advisories» del repositorio
  (pestaña *Security* → *Report a vulnerability*).

Incluye, si puedes:

- Qué hace el problema y cómo se reproduce.
- Qué versión (commit) usaste.
- El impacto que crees que tiene.

Me comprometo a:

1. Confirmarte la recepción en 72 horas.
2. Evaluarlo y, si procede, preparar una corrección.
3. Publicar el aviso (y la corrección) cuando esté resuelto, credits a
   quien lo reporte, salvo que prefiera mantenerlo en privado.

## Lo que ya está resuelto por diseño

- **Los datos no salen del navegador**: no hay red, ni analítica, ni
  rastreadores. El historial y el borrador son de `localStorage`.
- **Se puede borrar todo**: «Reiniciar» borra el borrador y «Borrar
  historial» vacía el historial (doble pulsación, sin `confirm()`).
- **Sin `innerHTML` ni `eval`**: el contenido se inserta siempre como
  texto, así que un texto escrito por el usuario no puede inyectar
  marcado.
- **Sin dependencias de terceros**: no hay cadena de suministro que
  auditar (ni en el runtime ni en las herramientas de verificación, que
  se ejecutan bajo demanda con `npx`).
- **Almacenamiento saneado**: el borrador y el historial limitan la
  longitud de los textos, validan los campos y descartan las fechas
  corruptas.
