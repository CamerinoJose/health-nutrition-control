# Estado y acuerdo vigente — continuidad de BienestarApp

Esta sección prevalece sobre los reportes históricos de abajo.

## Para continuar en un chat nuevo — 2026-11-22

1. Abrir la carpeta `C:\Users\camer\git\health-nutrition-control` y pedir al
   asistente que lea este archivo y `mobile\PERSISTENT_REMINDERS.md`. Un chat
   nuevo no recibe necesariamente el historial anterior.
2. Consultar el estado actual de la PR
   https://github.com/CamerinoJose/health-nutrition-control/pull/7 y de Git
   antes de actuar. El archivo de seguimiento contiene cambios **solo locales**;
   la PR es pública, está en borrador y no incluye este documento.
3. La copia local `main` está atrasada y tiene cambios sin confirmar. No hacer
   reset, checkout destructivo ni sincronizar encima de ellos. La PR se preparó
   en una copia separada sobre el código publicado, preservando la corrección
   OAuth. Verificar la rama y el diff antes de continuar.
4. Prioridad acordada: Android y web primero; iPhone después. La app aún no
   está lista para publicarse ni para depender de ella para recordatorios médicos.

### Siguientes pasos prioritarios

### Visión multifuncional acordada — plataforma integral de salud

BienestarApp debe evolucionar como una plataforma única para Android, web y
eventualmente iOS, organizada por perfil de usuario y no como aplicaciones
aisladas por función. Los módulos compartidos son:

- [ ] Identidad y roles: paciente, nutriólogo, familiar autorizado y administrador.
- [ ] Iniciar pruebas de flujos de nutriólogo y doctor con datos ficticios:
  acceso, pacientes asignados, citas, notas y medicinas según permisos.
- [ ] Bloqueador de privacidad: desplegar y verificar en entorno aislado los
  permisos clínicos por asignación y los accesos indirectos implementados
  localmente. No usar cuentas profesionales con datos reales antes de ello.
- [ ] Definir cómo verificar y recuperar mensajes anteriores a la migración:
  no se borran, pero quedan restringidos porque no consta el rol de cada
  participante cuando se enviaron.
- [ ] Configurar `SUPPORT_EMAIL` en el backend desplegado con una cuenta
  administradora de soporte y probar el chat; sin esa configuración estará
  deshabilitado.
- [ ] Diseñar el rol de secretaria para gestionar citas y confirmaciones de los
  profesionales asignados, sin acceso clínico por defecto; definir asignación,
  permisos, consentimiento y auditoría antes de implementarlo.
- [ ] Definir y verificar permisos del doctor y nutriólogo para consultar datos
  de pacientes autorizados y registrar notas, medicinas y recomendaciones.
- [ ] Consentimientos y privacidad: uso de datos, acceso profesional y eliminación.
- [ ] Perfil médico: contacto, condiciones, alergias, medicinas y preferencias.
- [ ] Historia clínica compartida: datos longitudinales con fuente y fecha.
- [ ] Medicinas y adherencia: dosis, horarios, confirmación y historial.
- [ ] Alimentación e hidratación: plan, comidas, líquidos, registros y objetivos.
- [ ] Indicadores de salud: peso, glucosa, presión, sueño, síntomas y progreso.
- [ ] Citas: disponibilidad, solicitud, cambio, aceptación y recordatorios.
- [ ] Mensajes: conversaciones entre usuario y profesional.
- [ ] Reportes: resumen exportable para compartir con profesionales.
- [ ] Recordatorios: Expo, servidor y alarmas Android sin duplicados.
- [ ] Gemini: asistencia educativa, sin diagnóstico ni sustitución médica.
- [ ] Recomendaciones: reglas por perfil y revisión profesional.
- [ ] Offline: caché por cuenta y cola de sincronización.
- [ ] Seguridad: mínimo privilegio, auditoría, cifrado y separación de datos.
- [ ] Publicación: Android/web primero, iOS cuando exista dispositivo de prueba.

Las comprobaciones médicas siempre deben permitir registrar datos sin
presentarlos como diagnóstico. Las recomendaciones clínicas deben configurarse
por el profesional correspondiente.

## Registro maestro de continuidad — actualizar al retomar

Esta sección debe prevalecer sobre ideas nuevas hasta completar el orden.
Al iniciar una conversación futura, leer primero `TAREAS_PENDIENTES.md` y
`ARQUITECTURA.md`, revisar GitHub Actions y no asumir que una versión móvil
incluye cambios locales hasta verificar su commit y build.

### Estado actual aprobado

- [x] Plataforma Android y web confirmada como base.
- [x] Backend Go con soporte PostgreSQL/Neon.
- [x] Cuenta, perfil y datos de contacto persistentes por usuario.
- [x] Cambio de cuenta y aislamiento de recordatorios locales probado.
- [x] Plan PDF visible y recetas abiertas en Android con build 23.
- [x] Copia de respuestas y historial local de Gemini implementados.
- [x] Modo de pruebas implementado en móvil y web.
- [x] CI base con Go/PostgreSQL, Jest, Vitest y Playwright.
- [ ] CI Android/Maestro debe completar su corrección de firma/gradle.
- [ ] Validar medicinas fija y ligada a comida en teléfono físico.
- [ ] Validar notificaciones con app abierta, segundo plano, cerrada y reinicio.
- [ ] Verificar citas, mensajes, progreso, recetas y perfil en web y móvil.
- [ ] Completar privacidad, consentimiento, respaldo, eliminación y publicación.
- [x] Auditoría nocturna automática: suites backend, móvil y web aprobadas.
- [x] Backend corregido para IDs PostgreSQL reales en registro, mensajes,
  recetas, recomendaciones y cambios de cita.
- [x] Citas corregidas para PostgreSQL: filtrado por mes, booleanos archivado
  y disponibilidad real por nutriólogo.
- [x] Compilaciones backend, móvil debug y frontend de producción aprobadas.

### Orden maestro acordado

### Próximo bloque operativo — pruebas físicas Android

- [ ] Validar medicinas de hora fija con app abierta.
- [ ] Validar medicinas ligadas a comidas.
- [ ] Confirmar persistencia de “tomada” tras cerrar y reiniciar.
- [ ] Validar alarmas con app en segundo plano y cerrada.
- [ ] Validar permisos y alarmas exactas.
- [ ] Validar cambio de cuenta e aislamiento de medicinas.
- [ ] Documentar dispositivo, Android, build y resultado sin asumir estados.

1. Estabilizar CI para frontend, móvil, backend y Android E2E.
2. Probar una matriz fija con datos ficticios en móvil y web.
3. Completar medicinas y recordatorios: horarios, toma, historial y alarmas.
4. Verificar alimentación: PDF/OCR, recetas, horarios y sincronización offline.
5. Verificar perfil: contacto, salud, permisos y separación por cuenta.
6. Verificar citas, mensajes, progreso, logros y recetas.
7. Probar Gemini sin divulgar datos innecesarios ni presentar diagnósticos.
8. Revisar seguridad móvil, privacidad, eliminación de cuenta y copias.
9. Ejecutar una última build firmada y repetir la matriz de aceptación.
10. No publicar como terminada una función sin evidencia física o CI verificable.

### Diseño funcional acordado

- Identidad: paciente, nutriólogo, familiar autorizado y administrador.
- Perfil médico único con condiciones, alergias, medicinas y preferencias.
- Historia clínica longitudinal con fecha, fuente y cambios auditables.
- Alimentación, hidratación, peso, glucosa, presión, sueño y síntomas.
- Medicinas con dosis, horario, confirmación e historial.
- Citas con disponibilidad, cambio, aceptación y recordatorios.
- Mensajes separados por conversación y usuario.
- Reportes exportables para profesionales.
- Gemini educativo, sin diagnóstico, dosis ni sustitución profesional.
- Offline por cuenta con caché y cola de sincronización.
- PostgreSQL como única base persistente; nunca fallback silencioso a SQLite.

- [x] En la PR #7, separar los recordatorios locales por cuenta y conectar la
  pausa al cierre de sesión; reanudar solo al iniciar con la misma cuenta.
  Probar cambio de cuenta, fallo de almacenamiento, reinicio y alertas antiguas.
  Confirmado por el usuario el 2026-11-22: cambio de cuenta, reinicio y
  aislamiento de alertas antiguos funcionaron en teléfono. Falta conservar
  evidencia del modelo y versión de Android.
- [ ] Revisar los recordatorios Expo, del servidor y nativos para evitar avisos
  duplicados o datos visibles de otra cuenta. El botón «Hecho» de la alarma local
  no registra por sí mismo la toma en el historial médico.
  Avance local: el cierre de sesión detiene el polling, cancela las notificaciones
  programadas por Expo y limpia sus registros de medicina, diabetes y comidas.
  Pasaron 112 pruebas móviles; falta confirmar en teléfono que no queda ninguna
  alerta antigua visible al cambiar de cuenta.
- [ ] Revisar firma de release y generar una APK nueva solo después de integrar
  las correcciones necesarias. Probar inicio Google, Gemini y recordatorios en
  teléfono físico, incluidos permisos, app cerrada, reinicio y falta de conexión.
  La build 11 instalada aún no incluye la limpieza móvil de OAuth de la PR #5.
- [ ] Confirmar el despliegue actual de Render, PostgreSQL y respaldos sin probar
  sobre datos reales. Revisar privacidad de Gemini, seguridad móvil con OWASP
  MASVS, eliminación de cuenta y requisitos de tienda antes de publicar.
- [ ] Ampliar las pruebas Maestro con datos ficticios. La prueba básica aprobada
  usó la APK build 11 anterior, no una APK de la PR. iOS permanece sin validar;
  el usuario todavía no sabe si tendrá un iPhone para las pruebas.
- [ ] Ejecutar el modo de pruebas en móvil y web para cubrir toda la matriz:
  cuenta, perfil, alimentación, medicinas, citas, mensajes, progreso, Gemini,
  recordatorios y cambio de cuenta.
- [ ] Mantener Playwright y Maestro en GitHub Actions con datos ficticios.
  Verificar el último run CI; frontend, backend y móvil ya tienen jobs separados.
- [x] Frontend unitario, backend Go/PostgreSQL, móvil Jest y Playwright aprobados
  en GitHub Actions run 45757156445.
- [x] Auditoría nocturna 2026-11-26: backend, móvil y frontend revisados.
  No quedan endpoints SQLite/`INSERT OR REPLACE` activos ni declaraciones
  `not implemented/TODO` en las rutas principales. Frontend Playwright aprobó
  2 pruebas; móvil Jest aprobó 123; backend Go aprobó sus suites.
- [ ] Android E2E se ejecuta manualmente o por etiqueta `android-e2e`; no falla
  automáticamente en cada push. Falta probar en dispositivo físico.

Para retomar, el usuario puede escribir: «Continuemos BienestarApp. Lee
TAREAS_PENDIENTES.md y revisa la PR #7 antes de hacer cambios».

## Forma de trabajo acordada

Conversar con ChatGPT para decidir cómo continuar y preparar prompts concretos para Codex. Codex implementa y verifica los cambios de código. Cuando el usuario solicita un prompt, entregar el prompt sin ejecutar por cuenta propia la implementación descrita. Al retomar, revisar este archivo y actualizarlo con evidencia.

Carpeta autorizada: C:\Users\camer\git\health-nutrition-control. No leer ni modificar OneDrive.
No hay recordatorios automáticos programados. Este archivo permite recuperar el contexto; no presupone memoria automática entre conversaciones distintas.

## Estado confirmado y reportado

- BienestarApp: Android y web; backend Go con soporte PostgreSQL; módulos de salud, alimentación, medicinas, recordatorios, progreso, citas y mensajes. No todos están verificados en producción.
- Dirección aprobada: convertir BienestarApp en una plataforma multifuncional
  de salud con identidad, roles, datos longitudinales, nutrición, medicinas,
  indicadores, citas, mensajes, reportes, recordatorios y asistencia Gemini.
  Debe mantener separación por cuenta, privacidad, consentimiento y revisión
  profesional. No usar Gemini para diagnosticar ni reemplazar atención médica.
- APK disponible: 0.1.0, build 11. https://expo.dev/artifacts/eas/yWcKwuHSSaE-XjgKRqVkTgs8XDnicsepDZEUPg3_hVo.apk
- APK build 12 generada el 2026-11-22 con perfil `release-apk`: https://expo.dev/artifacts/eas/z4yVIrLOtZ0X4t3sXUZNiQ6Eem1TQf59ZhLACAfCvgA.apk
  Paquete `com.bienestarappmobile`, versión `0.1.0`, build `12`, minSdk 24 y targetSdk 36.
  Firma APK v2 verificada; SHA256 `E13372C3F3A877AA2A54C32A09ADE0A46B080784270E508AAC0CC0B0CA525FB2`.
- APK build 13 generada el 2026-11-22 con perfil `release-apk`: https://expo.dev/artifacts/eas/srL8PUNxwuW3maBroJHbeM2cMJuhfTDLXqZ8-e47zVE.apk
  Paquete `com.bienestarappmobile`, versión `0.1.0`, build `13`, minSdk 24 y targetSdk 36.
  Firma APK v2 verificada; SHA256 `4B988165298A42C8B8CB1951F1A039DD4A6CC6CE83FEC2CC93FA613F0DCF9F8F`.
- Evidencia física limitada de la build 12: el usuario confirmó que la app abre
  y que los recordatorios suenan. No confirmó el modelo ni la versión de Android.
  No se ha probado ni marcado completado el cambio de cuenta, cierre de sesión,
  reinicio ni estado con app abierta, segundo plano y cerrada.
- Corrección local posterior a build 12: al cerrar sesión, el centro de
  recordatorios informa que se debe iniciar sesión y oculta el formulario.
  El puente también rechaza explícitamente la creación sin cuenta activa.
  Pasaron 108 pruebas móviles, 24 comprobaciones Java y la compilación Android
  debug; falta generar y probar una nueva APK.
- Mejora del registro móvil posterior a build 13: los formularios de registro e
  inicio incluyen etiquetas visibles, ejemplos y errores en español. El registro
  valida nombre, correo y contraseña mínima de 8 caracteres. Pasaron 110 pruebas
  móviles y la compilación Android debug; falta una APK física.
- APK build 14 generada el 2026-11-22 con perfil `release-apk`: https://expo.dev/artifacts/eas/QAEy1Ass5qtbwT9L5FRzTA7kQs_KXgH8S2JCW_T6RdU.apk
  Paquete `com.bienestarappmobile`, versión `0.1.0`, build `14`, minSdk 24 y targetSdk 36.
  Firma APK v2 verificada; SHA256 `86BE81CBC170F64CFCA342B01E318AC874D431EB38A9ED9231F946B2282D1C58`.
- Corrección posterior a build 14: los formularios de inicio y registro usan
  ajuste automático con el teclado y un ScrollView desplazable. Pasaron 110
  pruebas móviles y la compilación Android debug; falta una APK física.
- APK build 15 generada el 2026-11-22 con perfil `release-apk`: https://expo.dev/artifacts/eas/LOWqNlpiCqALanf1S5VbLvoHno_5aR2lOV-SJ40zsv4.apk
  Paquete `com.bienestarappmobile`, versión `0.1.0`, build `15`, minSdk 24 y targetSdk 36.
  Firma APK v2 verificada; SHA256 `902C8703AA17005947600567E2450CA1126A59134D1D14CB91B0E4AA6F8A65AC`.
- Soporte de nombre completo posterior a build 15: el registro conserva palabras
  separadas por espacios y normaliza espacios repetidos. El backend aplica la
  misma normalización. Pasaron 111 pruebas móviles y todas las pruebas Go.
- APK build 16 generada el 2026-11-22 con perfil `release-apk`: https://expo.dev/artifacts/eas/wnrNFNRfT_gWMXKLBkBCw0khbWMSWuQyl_56mgJ2Dr4.apk
  Paquete `com.bienestarappmobile`, versión `0.1.0`, build `16`, minSdk 24 y targetSdk 36.
  Firma APK v2 verificada; SHA256 `FBEBFAC91315AC5AF30917A3686BE013D254B031D6936AF85A0E9C507E78E3E3`.
- APK build 17 generada el 2026-11-23 con perfil `release-apk`: https://expo.dev/artifacts/eas/IwT-woCuhfizpXpRcIJBmJu8LKVsB1VVj0uSwjnRQnQ.apk
  Firma APK v2 verificada; SHA256 `552314268CBEDC16AABEE00C16745FFB2E2EB6D2AE26CF058978D4DC5FD53DDA`.
- APK build 18 generada el 2026-11-23 con perfil `release-apk`: https://expo.dev/artifacts/eas/MlltFLX4_jZdYEGCx5sC4y9gJXQmrPZrdRAjTdJrpso.apk
  Paquete `com.bienestarappmobile`, versión `0.1.0`, build `18`, minSdk 24 y targetSdk 36.
  Firma APK v2 verificada; SHA256 `D78DB17F83CB906BA01690DC01CFED71124DF6318E602745CD7FD8CC2380EEBE`.
- Persistencia de datos de contacto: el backend ya tiene prueba SQLite que guarda
  nombre, teléfono y preferencia mediante `/me/profile` y los devuelve mediante
  `/me`. El móvil conserva además un respaldo local separado por `user_id`.
  Pasaron las pruebas backend, 115 pruebas móviles y la compilación Android.
- APK build 19 generada el 2026-11-23 con perfil `release-apk`: https://expo.dev/artifacts/eas/Ruec8yww9GbcSsHex34QkC4L6a2RtXFNPHXkmAFgntY.apk
  Paquete `com.bienestarappmobile`, versión `0.1.0`, build `19`, minSdk 24 y targetSdk 36.
  Firma APK v2 verificada; SHA256 `5F65800C06996F8832B3C26B8E70C5DD0BE85F121C0CE081DB9D9DB133428DBB`.
- Gemini móvil posterior: historial local separado por cuenta y botón «Copiar»
  en las respuestas. Se añadieron reintentos backend para 503/429/504 y un
  mensaje temporal específico. Pasaron 115 pruebas móviles y el backend Go;
  compilar y desplegar requiere la build 18
  y Render actualizado.
- INSERT de medicines corregido para enviar false al campo booleano taken. Configuración obtiene versión y build nativos.
- 2026-11-21: el usuario confirmó que Gemini responde desde la APK build 11 con `GEMINI_MODEL=gemini-3.5-flash-lite` en Render. También confirmó que renovó `JWT_SECRET`, que el despliegue terminó y que volvió a iniciar sesión con Google. `/health` respondió 200 y la ruta pública `/api/auth/last-token` respondió 404. Las PR #5 y #6 están fusionadas; la APK build 11 aún no incluye la limpieza de registros sensibles del móvil.
- Preparación para publicación: el usuario eligió empezar por Android y web; todavía no sabe si tendrá un iPhone disponible para pruebas.
- Revisión inicial de la copia local: 99 pruebas móviles y 61 web aprobadas; `go test` pasó con PostgreSQL omitido por falta de una base de prueba configurada. Algunas pruebas del backend son estructuras sin implementación, por lo que estos resultados no prueban todas las funciones.
- La rama local `main` está detrás de la versión publicada y tiene cambios y archivos sin confirmar, incluidos recordatorios Android. No sobrescribirlos ni asumir que la copia local coincide con producción; comparar y preservar ambos antes de preparar una nueva release.
- El módulo local de recordatorios persistentes no aparece en la revisión `961db832` de `main` en GitHub. Revisar y probar esa diferencia antes de decidir qué incluir en una release.
- Se creó una copia de revisión aislada en la carpeta de la sesión, con el mismo árbol de archivos que `961db832`, sin modificar los cambios locales. El motor local de recordatorios pasó 16 comprobaciones Java; falta validarlo en un teléfono. Su implementación actual conserva recordatorios entre sesiones y puede mostrarlos a otra persona que use el dispositivo.
- Decisión del usuario: al cerrar sesión, pausar y ocultar los recordatorios locales y reanudarlos únicamente al volver a entrar con la misma cuenta. Pendiente implementar y probar este comportamiento, incluyendo cambios de cuenta, reinicios y los mecanismos de notificación existentes. No se ha integrado ni publicado.
- Avance local: el motor nativo admite una pausa persistente que cancela alertas y conserva los pendientes. Pasaron 24 comprobaciones Java, 99 pruebas móviles y la compilación local del código nativo Android. Aún no está conectada a la sesión ni a cuentas individuales y no modifica el comportamiento de la app; no presentar esto como solución completa.
- Seguridad y notificaciones: cambios locales para no registrar el contenido de notificaciones ni el token push en sus manejadores, y no marcar como leída una notificación que no se pudo mostrar. Pasaron 104 pruebas móviles; pendiente integrar con la revisión publicada y validar en una APK nueva. El resto del código y los datos almacenados requieren revisión; esto no acredita cumplimiento de OWASP MASVS.
- Implementación local de aislamiento por cuenta: `App.js` activa el `user_id` obtenido de `/me` y pausa los recordatorios al cerrar sesión; el puente Android usa almacenamiento separado por cuenta. Validación local actual: 106 pruebas móviles, 24 comprobaciones Java y compilación debug Android aprobadas. Falta confirmar cambio de cuenta e reinicio en teléfono físico.
- Maestro: prueba básica Android de arranque y menú ejecutada con éxito en un emulador aislado y vacío, con analíticas desactivadas y la APK release build 11 ya existente. Solo verifica esa APK anterior, no los cambios locales; faltan pruebas de sesiones, recordatorios y dispositivo físico.
- El trabajo de recordatorios, notificaciones y Maestro se subió como PR borrador https://github.com/CamerinoJose/health-nutrition-control/pull/7 sobre la versión publicada. CI de backend, web y móvil pasó. La PR no está fusionada: la pausa por cuenta y las pruebas en teléfono siguen pendientes. La copia local original conserva sus cambios y continúa detrás de GitHub; no se subieron sus versiones antiguas de OAuth ni este archivo de seguimiento.
- Evidencia anterior: regresión aprobada en PostgreSQL 18 aislado y 86 pruebas móviles aprobadas.
- Commit 3cf014e publicado en origin/main: https://github.com/CamerinoJose/health-nutrition-control/commit/3cf014e . Push confirmado en esta conversación. La copia local quedó limpia en ese momento; esta actualización documental es posterior.
- 2026-11-20: Render `/health` respondió 200 y `/api/gemini/chat` sin JWT respondió 401 tras publicar el proxy. El usuario confirmó la nueva clave en Render; no se hizo una llamada autenticada a Gemini. La conexión efectiva a PostgreSQL sigue sin confirmar.
- 2026-11-20: el usuario confirma que la app se actualizó y muestra «Version 0.1.0 build 10». Aún no confirma una respuesta real del chat Gemini.
- 2026-09-26: el usuario confirmó que la APK ya permite guardar medicinas en el teléfono. El fallo de guardado inicial queda resuelto según su prueba. Esta confirmación no identifica por sí sola el commit activo de Render ni acredita cada escenario de pruebas.

## Lista vigente en orden

- [ ] 1. Confirmar el commit actual desplegado en Render y la conexión a PostgreSQL.
- [x] 2a. Guardado de medicinas desde teléfono confirmado por el usuario el 2026-09-26.
- [ ] 2b. Registrar confirmación específica de ambos modos: hora fija y ligada a comida.
- [ ] 3. Comprobar persistencia y estado tomada después de cerrar y abrir la app.
- [x] 4. Versión 0.1.0/build 10 visible en la app, confirmado por el usuario el 2026-11-20.
- [ ] 5. Verificar recordatorios a la hora prevista y con la app en segundo plano.
- [ ] 6. Smartwatch EN ESPERA: el usuario no tiene uno actualmente (2026-09-26). Retomar cuando disponga de dispositivo; no bloquea el resto del proyecto.
- [ ] 7. Probar alimentación, perfil, progreso, citas y mensajes; registrar fallos concretos.
  - [x] Perfil confirmado.
  - [x] Cambio de cuenta, reinicio y datos de contacto persistentes.
  - [x] Plan de comidas PDF visible y abre recetas en Android build 23.
- [ ] 8. Depurar documentación histórica y sustituir porcentajes y estados antiguos por evidencia actual.
- [x] 9a. Proxy y perfil móvil fusionados en PR #2 y #3; Render `/health` devolvió 200 y `/api/gemini/chat` sin JWT devolvió 401. El usuario confirma que la clave nueva está configurada en Render.
- [x] 9b. EAS `release-apk` completada: versión 0.1.0, build 10; firma verificada y APK no-debuggable. Descarga: https://expo.dev/artifacts/eas/4Mo9sO4UOnB--G5SlUWKNDX4_w4-ciTd3Vllly0mv9Y.apk
- [x] 9c. El usuario reporta que la APK funcionó y la app se actualizó en su teléfono (2026-11-20).
- [x] 9d. Chat Gemini con sesión iniciada: respuesta confirmada por el usuario el 2026-11-21.
- [x] 9e. Acceso «Gemini AI» agregado al menú lateral y PR #4 fusionada.
- [x] 9f. EAS `release-apk` completada: versión 0.1.0, build 11; firma verificada y APK no-debuggable. Descarga: https://expo.dev/artifacts/eas/yWcKwuHSSaE-XjgKRqVkTgs8XDnicsepDZEUPg3_hVo.apk
- [x] 9g. APK build 11 instalada; acceso y respuesta real de Gemini confirmados por el usuario.
- [ ] 9h. Generar e instalar una APK release que incluya los cambios móviles de la PR #5; probar inicio de sesión Google y Gemini en el teléfono.
- [ ] 9i. Revisar la privacidad de datos enviados a Gemini: Google indica que el contenido del plan gratuito puede usarse para mejorar sus productos.

## Prioridad de producto acordada — recordatorios para personas con TDAH

El 2026-10-03 el usuario confirmó que el propósito central es ayudar especialmente a personas con TDAH a mantenerse al corriente con alimentación, medicamentos y otras tareas de salud, con recordatorios, notificaciones y alarmas, además de facilitar el seguimiento con su nutriólogo o doctor. El usuario eligió empezar las mejoras por la confiabilidad de recordatorios y alarmas. Este acuerdo es una dirección de trabajo, no evidencia de que las funciones ya estén verificadas.

### Orden de trabajo propuesto

- [ ] 1. Validar en un teléfono Android que un recordatorio de medicamento se programe y avise a la hora indicada, con la app abierta, en segundo plano y cerrada.
- [ ] 2. Repetir la validación sin conexión y después de reiniciar el teléfono; comprobar también cambios de hora y zona horaria, permisos de notificaciones y alarmas exactas, y documentar dispositivo, versión/build y resultados.
- [ ] 3. Verificar que marcar «Hecho» detenga avisos posteriores, que posponer/cancelar tenga un resultado claro y que abrir o cerrar la pantalla no complete accidentalmente una tarea.
- [ ] 4. Mapear los mecanismos existentes —notificaciones del servidor, notificaciones locales de Expo y alarmas persistentes nativas Android— para determinar qué tipo de recordatorio usa cada uno y evitar duplicados o comportamientos contradictorios.
- [ ] 5. Revisar el modo de medicina «Ligada a comida»: conservar la relación con la comida elegida y definir cómo se actualiza el aviso si cambia su horario, en lugar de depender únicamente de la hora calculada al guardar.
- [ ] 6. Después de validar lo anterior, evaluar acciones simples y lenguaje claro («Hecho», «Recordar más tarde», «Omitir por hoy») y opciones para que cada persona elija qué avisos recibe y cuándo.
- [ ] 7. Mantener los recordatorios como apoyo de organización: no sugerir cambios de dosis ni asumir que una medicina no fue tomada; los avisos clínicos deben configurarse con el profesional correspondiente.

Alcance conocido: las alarmas persistentes actuales requieren un APK Android que incluya el módulo nativo; no están disponibles en Expo Go, iOS o web. Las pruebas unitarias existentes simulan ese módulo y no sustituyen la validación en un teléfono. No marcar tareas como completadas sin evidencia o confirmación del usuario.

Cierre del 2026-09-26: el usuario solicita terminar por hoy y continuar mañana. Contexto y pendientes guardados; no se programó recordatorio. Al retomar, revisar qué comprobaciones del teléfono ya realizó y registrar resultados sin asumirlos: persistencia, estado tomada, ambos horarios y versión/build. Después priorizar recordatorios en segundo plano. La verificación técnica de Render sigue pendiente; smartwatch aplazado hasta contar con dispositivo. No hace falta generar otra APK solo para la corrección actual del backend.

---

# Registro histórico de seguimiento

# Seguimiento vigente de BienestarApp

Actualizado: 2026-09-25. Carpeta exclusiva: C:\Users\camer\github.
No leer ni modificar la copia de OneDrive.

## Acuerdo de seguimiento

- Al retomar el proyecto, revisar esta lista y elegir el siguiente pendiente prioritario.
- Actualizar el estado con evidencia al terminar; no marcar como completado por una propuesta o un reporte sin verificar.
- Sin fechas ni recordatorios programados por solicitud del usuario. Comunicar avances y bloqueos durante las conversaciones activas.
- Los resultados de Copilot indicados abajo fueron reportados por el usuario; falta verificarlos en este repositorio.

## Pendientes prioritarios

- [x] P1. Validar el guardado de medicinas en PostgreSQL de pruebas. Ejecutado sobre PostgreSQL 18 local aislado: POST autenticado, hora 07:30, taken=false almacenado y GET posterior. Véase evidencia abajo.
- [ ] P1. Publicar y verificar el backend en Render. Confirmar commit desplegado, arranque y conexión a PostgreSQL. No ejecutar pruebas automatizadas sobre datos de producción.
- [x] P1. APK preview terminada y descargada: versión 0.1.0, build 8, manifiesto y firma verificados. Instalación en teléfono pendiente.
- [ ] P1. Instalar y probar en teléfono: medicina de hora fija y ligada a comida; comprobar persistencia al cerrar y abrir. Requiere evidencia del dispositivo o confirmación del usuario.
- [ ] P2. Confirmar que Configuración muestra versión y build reales del binario mediante expo-application, sin el literal 1.0.0.
- [ ] P2. Verificar recordatorios en celular: permisos, hora programada y recepción con la app en segundo plano. Documentar dispositivo y resultado.
- [ ] P2. Definir y verificar soporte de smartwatch según el reloj del usuario; distinguir notificaciones reflejadas del teléfono de una app nativa de reloj.

## Evidencia verificada en esta sesión — 2026-09-25

- EAS: build `61d5b790-800d-4217-8fd5-86e3deb8ba00`, estado FINISHED, Android, perfil preview, distribución interna. Inicio 2026-09-26 05:10:35 UTC y fin 05:18:17 UTC.
- APK: https://expo.dev/artifacts/eas/SsYwNd4maI_IgtiZz6R1siBnxxJUkuPa9zxpE3EMsX4.apk . Descarga comprobada (91 803 386 bytes); `aapt dump badging` confirma paquete `com.bienestarappmobile`, versionName `0.1.0`, versionCode `8`, minSdk 24. `apksigner verify --print-certs` terminó correctamente. SHA256: `E3C74F84148CD2BA7D6E1B74A96E65AF86C9DDC0932BDE287F0C544FE4F2FCBB`.
- PostgreSQL: instancia desechable PostgreSQL 18 creada con initdb, escuchando exclusivamente en 127.0.0.1:55439, sin usar backend/.env ni bases existentes. MEDICINES_TEST_POSTGRES_DSN se configuró solo en el proceso de pruebas. `go test ./... -run '^TestMedicineCreationAndListWithBooleanTaken/postgres$' -count=1 -v`: PASS, subtest postgres ejecutado (no SKIP). Comprueba POST con JWT, taken=false almacenado y GET con hora 07:30. Después `go test ./... -count=1`: PASS con el mismo DSN. Servidor desechable detenido al terminar.
- Revisión: INSERT parametriza false; GET y POST extraídos a handlers compartidos con la regresión. expo-application muestra versión/build nativos; babel-preset-expo es dependencia directa; preview incrementa la versión remota. Dependencias raíz coherentes con package-lock.json. `git diff --check`: aprobado.
- Alcance de APK: EAS registra HEAD `8e173feab09fa6a876af0dc99bf3815c0d147573`, pero se compiló con cambios sin commit. Las fechas locales de SettingsScreen, package.json, package-lock.json y eas.json preceden el inicio del build, en consonancia con el reporte histórico. Esto no acredita por sí solo el contenido exacto del bundle: comprobar Configuración en el teléfono. En esta sesión no se modificó código móvil ni se generó otra APK; esta actualización documental es posterior al build. El backend se despliega por separado.
- Render BLOQUEADO: render.yaml declara bienestarapp-backend, rootDir backend y autoDeploy=true; origin es CamerinoJose/health-nutrition-control y rama local main. No se pudo verificar la vinculación efectiva del servicio, variables del panel ni logs. No se encontró CLI Render ni variables RENDER_API_KEY/RENDER_API_TOKEN del proceso/usuario/máquina; tampoco nombres RENDER_* en los .env revisados. La herramienta de navegador falla antes de enumerar pestañas, incluso tras reiniciarla. El usuario eligió habilitar acceso por navegador; queda pendiente recuperar ese acceso. Existe una integración Render disponible pero no instalada. GitHub no devolvió estados de commit ni despliegues que resuelvan la comprobación.
- No se creó commit ni se hizo push/despliegue: falta verificar la configuración efectiva de Render, condición de la autorización. Atención: el arranque existente puede recurrir a SQLite si falla PostgreSQL; verificar explícitamente el mensaje de conexión PostgreSQL y el commit al publicar. No se cambiaron datos, esquema ni credenciales de producción.
- Prueba manual pendiente: instalar esta APK; verificar 0.1.0/build 8 en Configuración; crear una medicina de hora fija 07:30 y otra ligada a una comida; comprobar que ambas aparecen inicialmente sin tomar, cerrar completamente y reabrir, y verificar persistencia de nombre y programación. Marcar una como tomada y repetir reapertura. Comprobar recordatorios con permiso concedido y app en segundo plano. El guardado seguirá dependiendo de publicar la corrección del backend; registrar dispositivo y resultados.
## Punto de partida reportado

Copilot reportó: INSERT parametrizado con false; regresión SQLite aprobada; PostgreSQL pendiente por autenticación; 86 pruebas móviles aprobadas; bundle Android generado, sin APK; Configuración adaptada a expo-application. No se reportaron commits, despliegues ni builds remotos realizados.

## Archivo histórico: requiere revisión antes de usarlo

El contenido siguiente es anterior a este seguimiento. Sus porcentajes, estados y prioridades no representan el estado actual confirmado. No compartir claves en el chat; configurar secretos mediante el mecanismo seguro correspondiente.

---

# 📋 TAREAS PENDIENTES - BienestarApp

**Fecha:** 1 de Enero, 2026
**Estado General:** Registro histórico; Gemini está implementado localmente y requiere despliegue y configuración segura de la clave del backend.

---

## 🔴 BLOQUEADAS (Requieren Acción del Usuario)

### 1️⃣ Rotar y configurar la clave Gemini
**Prioridad:** 🔴 CRÍTICA
La clave anterior estuvo incluida en el cliente y debe revocarse. Crea una clave nueva en Google AI Studio y configúrala como secreto `GEMINI_API_KEY` únicamente en el entorno del backend de Render. No la pegues en el chat ni la guardes en `app.json`, variables `VITE_*`/`EXPO_PUBLIC_*` o el repositorio.
Después de publicar el proxy, verifica que el backend responda y que Gemini funcione desde la web y la APK.

---

## 🟡 IMPLEMENTADO LOCALMENTE; DESPLIEGUE PENDIENTE

### 2️⃣ Gemini Chat en Mobile
- [x] Reutilizar la pantalla existente y llamar al endpoint autenticado `/api/gemini/chat`.
- [x] Retirar la clave y el SDK de Gemini del cliente móvil.
- [x] Pruebas móviles: 99 pruebas aprobadas; bundle Android exportado.
- [ ] Verificar el chat en un teléfono después de publicar el proxy y configurar la clave nueva en Render.

**Archivos principales:**
```
backend/gemini_handlers.go
mobile/src/GeminiChatScreen.js
mobile/src/api.js
```

---

### 3️⃣ Gemini Chat en Web
- [x] Reutilizar el chat existente y llamar al endpoint autenticado `/api/gemini/chat`.
- [x] Retirar la clave y el SDK de Gemini del cliente web.
- [x] Pruebas web: 61 pruebas aprobadas y build de producción completado.
- [ ] Verificar el chat en el navegador después de publicar el proxy y configurar la clave nueva en Render.

**Archivos principales:**
```
backend/gemini_handlers.go
frontend/src/GeminiChat.jsx
frontend/src/api.js
```

---

## 🟢 COMPLETADAS

✅ **Backend:**
- Google OAuth completamente integrado
- Endpoints para todos los módulos
- Token storage temporal para OAuth
- Deep link handling configurado

✅ **Frontend Web:**
- 12 páginas/componentes
- Google OAuth funcionando
- Dashboard, Recetas, Meal Plan, Progress, etc.
- Internacionalización ES/EN
- Responsive design

✅ **Mobile App:**
- Google OAuth funcionando en Android
- 9 pantallas completas
- Token storage con AsyncStorage
- Navegación con back buttons
- Internacionalización ES/EN
- APIs conectadas

---

## 📊 RESUMEN DE DEPENDENCIAS

### Mobile
```json
{
  "Gemini": "Usa el proxy autenticado del backend; no requiere SDK en el cliente",
  "react-native": "0.81.5 ✅",
  "expo": "54.0.30 ✅",
  "axios": "INSTALADO ✅",
  "@react-native-async-storage/async-storage": "INSTALADO ✅"
}
```

### Frontend
```json
{
  "Gemini": "Usa el proxy autenticado del backend; no requiere SDK en el cliente",
  "react": "18 ✅",
  "axios": "INSTALADO ✅",
  "react-i18next": "INSTALADO ✅",
  "chart.js": "INSTALADO ✅"
}
```

---

## 🎯 VERIFICACIÓN RÁPIDA

### Backend - ✅ Listo
```bash
cd backend
go run .
# Debe estar en :8080
```

### Frontend Web - ✅ Listo
```bash
cd frontend
npm run dev
# Accede a http://localhost:5174
```

### Mobile App - ✅ Listo
```bash
cd mobile
npm start
# O instalar APK en Android emulator
```

---

## 📝 NOTAS IMPORTANTES

1. **API Key de Gemini es GRATUITA** - No requiere tarjeta de crédito
2. **Límites de uso:** Tienes 60 requests/minuto (más que suficiente para un usuario)
3. **Variables de entorno:**
   - Backend: `GEMINI_API_KEY` (secreto solo del servidor)
   - Opcional: `GEMINI_MODEL` (por defecto `gemini-2.5-pro`)

---

## ❓ PREGUNTAS FRECUENTES

**P: ¿Será caro el Gemini API?**
R: No, es GRATIS. Google ofrece 60 requests/minuto sin costo.

**P: ¿Cuánto tiempo falta para terminar?**
R: Solo 2 minutos para obtener la API Key, luego 2-3 horas para implementar Gemini en ambas plataformas.

**P: ¿Necesito más API Keys?**
R: No, la misma key funciona en mobile y web.

---

## 📞 PRÓXIMO PASO

**👉 Obtén la API Key en:** https://aistudio.google.com/apikey

Una vez tengas la key, avísame y procedo inmediatamente con la implementación. ⚡
