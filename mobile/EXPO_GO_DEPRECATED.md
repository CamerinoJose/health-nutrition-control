# Expo Go Deprecated for This Project

> Nota de continuidad: para el estado actual y el APK disponible, consulta
> `../TAREAS_PENDIENTES.md`. Usa una compilación de desarrollo para validar
> las funciones nativas y notificaciones en un dispositivo real.

## Why?
Expo Go no longer supports push notifications and many advanced features required by this app (as of SDK 53+). You must use a development build for all testing and development.

## What to Do
- Use EAS CLI to create a development build (see PROJECT_STATUS.md for instructions)
- Do not use Expo Go for push notifications, authentication, or any feature requiring native modules
- Remove or ignore any Expo Go-specific warnings

## References
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
