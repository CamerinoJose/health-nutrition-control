# Automatización de pruebas

## Web

```powershell
cd frontend
npm.cmd ci
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

El reporte queda en `frontend/playwright-report/`.

## Móvil Android

```powershell
cd mobile
npm.cmd ci
npm.cmd test -- --ci --runInBand
```

Maestro necesita un emulator o teléfono con el APK instalado:

```powershell
adb devices
maestro test .maestro
```

Los flujos viven en `mobile/.maestro/`. Usa cuentas y datos ficticios; no
agregues usuarios reales, PDFs médicos reales ni secretos a los archivos.

### Pruebas físicas pendientes: perfil, medicinas y citas

- [ ] Cambiar el perfil sin conexión, cerrar y abrir la app, y verificar que el
  borrador pendiente permanece en la misma cuenta. Restablecer la conexión y
  reintentar desde Editar; confirmar que persiste después de reiniciar.
- [ ] Con datos ficticios, verificar hora fija y ligada a comida, confirmar una
  toma y revisar su historial tras reiniciar. «Hecho» de Recordatorios no
  registra la toma; la confirmación se realiza en Medicinas.
- [ ] Probar alarmas y notificaciones con la app abierta, cerrada y después de
  reiniciar el teléfono; revisar también los permisos de Android.
- [ ] Agendar con fecha y hora, verificar el error sin profesional asignado y
  comprobar que una falla de conexión no se muestra como una lista vacía.

## Pruebas de profesionales — pendientes

Realizar estas pruebas solo en un entorno aislado con dos profesionales y dos
pacientes ficticios, asignando un paciente a cada profesional. Registrar
dispositivo, versión, build y resultado sin incluir información personal.

- [ ] Iniciar sesión como nutriólogo y comprobar que el paciente asignado
  aparece con sus datos de prueba, citas y recomendaciones.
- [ ] Verificar que el otro paciente no aparezca ni sea accesible por ID, y
  probar que tampoco se puedan consultar o modificar sus notas, historial,
  recomendaciones o plan alimenticio.
- [ ] Comprobar creación y lectura de una nota y una recomendación ficticias
  para el paciente asignado y su persistencia tras reiniciar.
- [ ] Verificar citas y cambios propuestos del profesional asignado.
- [ ] Repetir las pruebas de permisos con una cuenta paciente y una sesión
  cerrada; no deben acceder a rutas profesionales.
- [ ] Cambiar la asignación y comprobar que el profesional anterior no ve
  mensajes, notificaciones clínicas ni cambios de citas; el paciente conserva
  acceso a sus mensajes clínicos nuevos y a sus citas anteriores.
- [ ] Verificar el aviso de mensajes antiguos restringidos y el acceso a un
  mensaje nuevo enviado explícitamente a soporte.
- [ ] Configurar `SUPPORT_EMAIL` con una cuenta administradora ficticia en el
  entorno aislado; comprobar que no se usa un ID fijo y que, si falta la
  configuración o el rol no es administrador, soporte no está disponible.
- [ ] Definir el rol de doctor y sus permisos antes de probarlo; no asumir que
  ya existe ni que es equivalente al rol de nutriólogo.

**Estado:** las restricciones y pruebas automatizadas están solo en el código
local; aún deben desplegarse y probarse en un entorno aislado. No usar cuentas
profesionales con datos reales hasta completar esas pruebas.

Los mensajes anteriores a la migración no registran el rol de los participantes
en el momento del envío. Por privacidad quedan temporalmente inaccesibles sin
borrarse, incluidos mensajes antiguos de soporte; se muestra un aviso. No existe
todavía un procedimiento para restaurarlos de forma segura. Los mensajes nuevos
con profesionales requieren asignación vigente; los mensajes directos con una
cuenta administradora son conversaciones iniciadas expresamente.

### Comentarios y sugerencias

- [ ] Enviar un comentario ficticio desde Soporte en móvil y web. Sin conexión
  debe mostrarse un error y conservarse el texto; no debe confirmarse el envío.
- [ ] En el panel administrador, comprobar el orden de llegada, paginación,
  estados en curso/completado y reapertura. Una cuenta no administradora no
  debe consultar ni modificar la cola.
- [ ] Verificar en entorno aislado que eliminar la cuenta elimina también sus
  comentarios. No incluir datos de salud en las pruebas.

## CI

GitHub Actions ejecuta:

- pruebas Go con PostgreSQL;
- pruebas unitarias web y móvil;
- Playwright en Chromium;
- compilación Android y Maestro sobre un emulator.
