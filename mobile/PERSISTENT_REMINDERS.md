# Recordatorios persistentes: primera versión Android

## Estado de continuidad — 2026-11-22

Este trabajo está en la PR borrador
https://github.com/CamerinoJose/health-nutrition-control/pull/7; no está
fusionado. La cuenta activa ya está conectada al puente nativo y separa sus
registros por cuenta. El cambio de cuenta, reinicio y aislamiento de alertas
antiguas fueron confirmados en teléfono el 2026-11-22; falta registrar el modelo
y la versión de Android.
Ver `..\TAREAS_PENDIENTES.md` para el estado y los siguientes pasos.

## Arquitectura encontrada

- Expo SDK 54 (`~54.0.31`), React Native 0.81.5, React 19.1 y
  `expo-notifications ~0.32.16`. Hay un proyecto Android prebuild versionado,
  con Kotlin y New Architecture; no es un proyecto exclusivamente managed.
  El lockfile instala Expo 54.0.37 y expo-notifications 0.32.17; no se cambiaron
  dependencias ni lockfile. La compilación resuelve minSdk 24 y targetSdk 36.
- `src/notifications.js`: consulta `/notifications` cada 5 segundos mientras
  JavaScript está activo, muestra notificaciones y las marca como leídas.
  «Leída» no representa realización de una tarea.
- `src/pushNotifications.js`: registro de push Expo, canal `default`, listeners
  y utilidades. `diabetesNotifications.js`, `MealPlanScreen.js` y
  `MedicinesScreen.js` programan notificaciones Expo diarias; almacenan sus IDs
  en claves separadas de AsyncStorage. Estas funciones se conservan.
- Medicamentos: API `/medicines`, ID del servidor, hora `HH:MM`, confirmación e
  historial remoto; caché AsyncStorage por usuario. Horas de comidas y ajustes
  también usan AsyncStorage. Las tareas del Dashboard son estado React local;
  no existía una entidad persistente de instancia de recordatorio.
- `App.js` tiene listeners Expo que dirigen a comidas y mensajes. La nueva
  ruta `com.bienestarappmobile://reminder/<id>` abre el modal de pendientes,
  también en arranque frío. Se excluye del procesamiento OAuth.
- El manifest de producción conserva RECEIVE_BOOT_COMPLETED y VIBRATE, y declara
  POST_NOTIFICATIONS y SCHEDULE_EXACT_ALARM para los recordatorios. No requiere
  permisos amplios de almacenamiento ni SYSTEM_ALERT_WINDOW; no usa pantalla
  completa ni servicios.
- `eas.json` ya dispone de perfiles development, preview y production.

## Estrategia y archivos

Expo puede programar notificaciones, pero su trigger de intervalo no ofrece
un comienzo arbitrario futuro seguido por un intervalo diferente de cinco
minutos. Un listener JavaScript que arranque la repetición al recibir la primera
notificación no basta con el proceso terminado. Una cola finita de alertas
tampoco cumple repetir hasta confirmar. Por eso se añade un módulo nativo pequeño,
sin sustituir Expo para los recordatorios actuales ni cambiar el backend.

- `src/reminderAlarm.js`: API genérica, validación, identidad de instancia,
  permisos, ruta de notificación y adaptador de próxima toma.
- `src/ReminderCenter.js`: formulario local, lista de pendientes, estado de
  permisos, cancelar y **✓ Hecho**. Accesible desde **Recordatorios** en el menú.
- `android/app/src/main/java/com/bienestarappmobile/reminders/ReminderEngine.java`:
  máquina de estados independiente de Android, con interfaces de persistencia y
  programación para probar la lógica real.
- `ReminderAlarmModule.kt` en el mismo directorio: SharedPreferences privado,
  AlarmManager, notificaciones, receiver y puente React Native.
- `MainApplication.kt` registra el paquete; `AndroidManifest.xml` declara
  permisos y receiver para alarma, reinicio, actualización, cambios de reloj y
  concesión del permiso de alarmas exactas.
- `android/.gitignore` excluye la caché `.kotlin/` generada al compilar.
- `App.js` monta el centro de recordatorios; `MedicinesScreen.js` añade la alarma
  de próxima toma sin reemplazar la notificación diaria existente.
- Pruebas: `src/__tests__/reminderAlarm.test.js`,
  `src/__tests__/ReminderCenter.test.js`,
  `android/reminder-tests/ReminderEngineTest.java` y
  `scripts/test-reminder-engine.ps1`.

## Estado, programación y confirmación

Cada instancia contiene `id`, `sourceType`, `sourceId`, `title`, `body`,
`scheduledAt`, `repeatMinutes` (5), `status`, `notificationIds`, `createdAt`,
`completedAt` y `nextAlertAt`. El ID deriva de fuente + ID de fuente + instante;
reintentar la misma instancia no crea otra. Una tarea nueva recibe un ID de
fuente nuevo. Tipos como medicine, task, water, meal, exercise o appointment
pueden utilizar la misma API; solo tareas y próxima toma tienen interfaz en v1.

SharedPreferences es la única fuente de verdad para estas instancias: el receiver
debe leer y escribir sin React Native ni AsyncStorage inicializados. No se crea
una segunda copia del estado en JavaScript. Las escrituras usan `commit()` antes
de tocar el planificador; errores de almacenamiento no se convierten en una lista
vacía. El motor serializa creación, entrega, reconciliación y finalización.

1. Crear persiste `scheduled` y programa una única alarma inicial.
2. El receiver marca `active`, persiste la siguiente alerta a cinco minutos
   desde la entrega real, rearma el mismo PendingIntent y publica la notificación.
   No hay horizonte finito ni JavaScript ejecutándose para repetir.
3. Cada instancia tiene una URI de PendingIntent distinta y un tag de
   notificación igual a su ID. Rearmar reemplaza; no acumula copias ni usa hashes
   que puedan colisionar. `notificationIds` contiene ese ID estable.
4. Deslizar, tocar, abrir o cerrar el modal no completa nada. Tocar la notificación
   abre y destaca la instancia pendiente; puede no mostrar detalles en la pantalla
   bloqueada por privacidad.
5. **✓ Hecho** guarda `completed` y `completedAt` antes de cancelar la alarma y
   retirar la notificación. Una entrega tardía consulta el estado y no la revive.
   Cancelar guarda `cancelled`, sin fingir que se hizo la tarea.
6. Al iniciar/resumir, se reconcilian todos los registros. También después de
   reiniciar Android (tras desbloquear), actualizar el APK o cambiar el reloj.
   Los terminales se conservan para impedir resurrecciones y reintentar una
   cancelación interrumpida. Los vencidos generan una alerta, no una ráfaga.

El temporizador de 30 segundos del modal actualiza únicamente la lista visible;
no entrega ni repite alarmas. Los intervalos existentes de polling tampoco son
parte de este mecanismo.

## Android, app cerrada y smartwatch

El canal `persistent-reminders-v1` usa importancia HIGH, sonido predeterminado,
vibración y visibilidad PRIVATE. No fuerza volumen, No molestar ni configuraciones
del usuario. Los canales son persistentes: modificar el código no revierte los
ajustes que el usuario haya cambiado en Android.

Se utiliza `setExactAndAllowWhileIdle` si el permiso está disponible;
si no, `setAndAllowWhileIdle` con aviso visible. No se declara USE_EXACT_ALARM,
no se pide excluir de batería y no se usa un foreground service para mantener
vivo JavaScript. WorkManager no es adecuado para intervalos de cinco minutos.

**Cinco minutos es el objetivo, no una garantía**: Doze limita incluso estas
alarmas (la documentación Android describe un mínimo de nueve minutos por app),
y fabricantes, permisos o ahorro de energía pueden añadir retrasos. El receiver
sigue funcionando tras muerte normal del proceso o al quitar la app de recientes,
sujeto a las restricciones del fabricante. **Forzar detención** impide entregas
hasta que se vuelva a abrir la app. Desinstalar/borrar datos elimina el estado.
Revocar alarmas exactas puede eliminar alarmas del sistema; reabrir reconcilia
con el modo inexacto. Bloquear notificaciones conserva pendientes, pero silencia
las alertas. Un corte de energía entre guardar y armar requiere reconciliación;
SharedPreferences y AlarmManager no tienen una transacción conjunta.

Las notificaciones permiten reflejo (`localOnly=false`), sin aplicación Wear OS
propia. Depende del emparejamiento, permisos de acceso a notificaciones de la app
del reloj, canal, No molestar y preferencias teléfono/reloj. No se garantiza
sonido/vibración simultánea ni comportamiento idéntico en todos los relojes.
Descartar desde el reloj tampoco completa la instancia.

Fuentes oficiales:
- [AlarmManager y permisos](https://developer.android.com/develop/background-work/services/alarms)
- [Restricciones Doze](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [Expo Notifications SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/)
- [Reflejo de notificaciones Wear OS](https://developer.android.com/training/wearables/notifications/bridger)

## Alcance y limitaciones de v1

- El motor conserva una pausa persistente por cuenta y cancela sus alarmas al
  cambiar o cerrar sesión. La implementación ya está conectada al perfil
  `/me`. Cambio de cuenta, reinicio y aislamiento de alertas antiguas fueron
  confirmados en teléfono el 2026-11-22.
- Android únicamente; requiere un **APK recompilado**. Expo Go, iOS, web y APK
  anteriores muestran que no está disponible; no simulan persistencia.
- Instancias locales de este dispositivo, independientes de sesión: cerrar
  sesión no las elimina ni detiene. Esto se indica en la interfaz. No hay
  sincronización con cuentas ni backend. En un teléfono compartido deben
  cancelarse los recordatorios que no deban permanecer.
- «Alarma persistente: próxima toma» programa una toma concreta a la próxima
  hora del medicamento (hoy o mañana). No genera automáticamente nuevas tomas
  diarias. La notificación diaria anterior sigue siendo una función separada:
  si se activan ambas, pueden recibirse ambas alertas.
- **✓ Hecho confirma la instancia local**, no escribe en el historial médico
  remoto. «Confirmar» en la lista de medicinas conserva su función de registrar
  la toma en el servidor; no equivale a completar esta instancia. La interfaz
  distingue ambos flujos. No se marca automáticamente el medicamento como tomado.
- No migra recordatorios Expo antiguos, no interpreta las tareas del Dashboard
  como alarmas, ni conecta automáticamente comidas, citas o diabetes.
- Fechas representan instantes absolutos: cambiar zona horaria no recalcula la
  hora local elegida. No hay edición de instancias; cancelar y crear otra.
- El historial terminal aún no se purga automáticamente.
- Al cerrar sesión, además de pausar el motor nativo, se detiene el polling
  del servidor y se cancelan las notificaciones programadas por Expo. También
  se limpian los registros locales de IDs de medicina, diabetes y comidas.
- El proyecto mantiene Android nativo versionado. No ejecutar
  `expo prebuild --clean`: regeneraría el registro y los cambios nativos manuales.
  Una futura migración a generación nativa necesitará un config plugin.

## Pruebas en Windows y Android físico

Desde `C:\Users\camer\git\health-nutrition-control\mobile`:

```powershell
npm.cmd ci
npm.cmd test -- --runInBand
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-reminder-engine.ps1
```

Para compilar e instalar un development build, con JDK 17, Android SDK y
depuración USB habilitados (aceptar la autorización RSA del teléfono):

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path += ";$env:ANDROID_HOME\platform-tools"
adb devices
npm.cmd run android -- --device
```

Si Metro no quedó ejecutándose, usar `npx.cmd expo start --dev-client` y abrir el
development build. Para pruebas sin Metro usar un APK preview con JS integrado
(`npx.cmd eas-cli build --platform android --profile preview`, después de revisar
el diff; este comando sube el proyecto a EAS y no se ejecutó como parte del trabajo).

1. Abrir 🔔 Recordatorios; permitir notificaciones Android 13+. En «Permitir
   alarmas y recordatorios», habilitar el acceso especial Android 12+ y regresar.
   Revisar Ajustes → Apps → Health & Nutrition Control → Notificaciones →
   Recordatorios persistentes: sonido, vibración e importancia.
2. Crear «Prueba» a dos minutos en el futuro. Debe aparecer una sola instancia.
3. Salir de la app, bloquear el teléfono, observar alerta inicial. Deslizarla;
   comprobar repetición aproximadamente cinco minutos después, sin abrir la app.
4. Tocar la siguiente alerta. Se abre el modal con esa tarea. Cerrar sin completar;
   comprobar que sigue pendiente y vuelve a alertar.
5. Abrir y pulsar **✓ Hecho**; esperar al menos dos intervalos. No debe volver a
   alertar. Reabrir/reiniciar y comprobar que no se reactiva.
6. Crear dos recordatorios y completar uno: el otro debe seguir pendiente.
   En Medicinas, pulsar dos veces «Alarma persistente: próxima toma» para la misma
   hora futura: debe haber una sola instancia para esa toma.
7. Dejar una pendiente, quitar app de recientes y reiniciar el teléfono. Tras
   desbloquear, debe recuperarse. Para comprobar muerte de proceso sin confundirla
   con force-stop, poner la app en segundo plano y usar
   `adb shell am kill com.bienestarappmobile`.
8. Probar offline y con permisos denegados. No debe informar éxito si las
   notificaciones están bloqueadas. Al restaurar permisos y reabrir, se reconcilia.
9. Probar Doze con `adb shell dumpsys deviceidle force-idle`; esperar retrasos.
   Salir con `adb shell dumpsys deviceidle unforce` y
   `adb shell dumpsys battery reset`. No exigir cinco minutos exactos en Doze.
10. Con reloj emparejado y reflejo habilitado, verificar aviso y descarte desde
    el reloj, seguido de otra alerta mientras no se pulse Hecho en la app.

Las pruebas automatizadas cubren el motor real y el adaptador JS, pero no sustituyen
estas comprobaciones físicas de sonido, vibración, Doze y reloj.

## Validación local realizada

- Build 12 generada el 2026-11-22 con perfil `release-apk`:
  https://expo.dev/artifacts/eas/z4yVIrLOtZ0X4t3sXUZNiQ6Eem1TQf59ZhLACAfCvgA.apk
  El paquete y las versiones quedaron verificadas localmente:
  `com.bienestarappmobile`, `0.1.0`, build `12`, minSdk 24 y targetSdk 36.
  La firma APK v2 pasó `apksigner`; SHA256:
  `E13372C3F3A877AA2A54C32A09ADE0A46B080784270E508AAC0CC0B0CA525FB2`.
- Evidencia física limitada: el usuario confirmó que la app abre y que los
  recordatorios suenan. No informó dispositivo ni versión de Android y no confirmó
  cambio de cuenta, cierre de sesión, reinicio ni pruebas completas en segundo
  plano o app cerrada.
- Corrección posterior: sin cuenta activa, el centro muestra un estado claro
  para iniciar sesión y no ofrece el formulario de creación. El puente nativo
  rechaza igualmente la creación sin sesión. Pasaron 108 pruebas Jest, 24
  comprobaciones Java y `assembleDebug`; falta probar una APK nueva en físico.
- Build 13 generada el 2026-11-22 con perfil `release-apk`:
  https://expo.dev/artifacts/eas/srL8PUNxwuW3maBroJHbeM2cMJuhfTDLXqZ8-e47zVE.apk
  Verificado: versión `0.1.0`, build `13`, firma APK v2 y SHA256
  `4B988165298A42C8B8CB1951F1A039DD4A6CC6CE83FEC2CC93FA613F0DCF9F8F`.
- La integración con sesiones fue añadida localmente: `/me` activa el `user_id`
  en el puente Android y el cierre de sesión pausa el motor activo. Los registros
  nativos usan un archivo privado distinto por cuenta.
- Suite móvil completa: 106 pruebas Jest aprobadas.
- Compilación Android debug: `assembleDebug` aprobada tras los cambios de
  aislamiento por cuenta.
- Suite Jest completa: 96 pruebas aprobadas; después se añadieron dos pruebas
  del modal y se ejecutaron las 12 pruebas de recordatorios, todas aprobadas.
  Total: 98 pruebas distintas aprobadas, sin eliminar pruebas existentes.
- Motor Java de producción: 16 comprobaciones aprobadas, incluyendo reinicio,
  duplicados, entrega atrasada, cancelación fallida y fallo de almacenamiento.
- `tsc --noEmit`: aprobado (el proyecto permite JS y no activa `checkJs`).
- Compilación Android Kotlin/Java debug: aprobada.
- Android Lint ejecutado: 3 errores preexistentes, verificados contra HEAD:
  `MissingPrefix` en los dos `intent-filter data-generated` del manifest y
  `NewApi` por `android:windowSplashScreenBehavior` en `res/values/styles.xml`.
  49 advertencias totales; el nuevo módulo solo recibe dos sugerencias `UseKtx`.
  No se ocultaron errores con un baseline ni se alteró el splash para este cambio.
- `git diff --check`: aprobado con la configuración normal CRLF del repositorio.
- No se probó en teléfono/reloj ni se instaló un APK en un dispositivo.
- Ningún archivo staged, commit o push. Los seis archivos locales copiados durante
  la preparación del workspace permanecen ignorados.
- La revisión encontró elementos **preexistentes y sin modificar**: una posible
  API key en `mobile/app.json` y una base `data.db` en la raíz ya versionada.
  Conviene revisar la clave y rotarla si es real, y revisar si esa base debe estar
  versionada. No se imprimieron valores en este documento ni se abrió la base.
  También existe el keystore de desarrollo Android versionado y plantillas
  `.env.example`; no se añadieron nuevas credenciales.
