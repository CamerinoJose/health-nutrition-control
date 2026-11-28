# OAuth Debug Log

> Registro histórico de depuración, no instrucciones vigentes. La
> configuración OAuth actual se documenta en `../backend/README.md` y los
> pendientes del proyecto en `../TAREAS_PENDIENTES.md`.

## Test History

1. **Initial mobile login**: Used useAuthRequest and promptAsync. Result: redirect_uri mismatch, backend received exp://...
2. **Forced redirectUri in App.js**: Hardcoded Expo proxy URI. Result: Still exp://... sent, useAuthRequest overrides.
3. **Switched to AuthSession.startAsync**: Manually constructed URL. Result: startAsync undefined error.
4. **Tried openAuthSessionAsync**: Also undefined error.
5. **Updated expo-auth-session to latest**: No effect, startAsync still undefined.
6. **Direct named import for startAsync**: Also undefined error.
7. **Default import for AuthSession, called startAsync as method**: AuthSession undefined, method call fails.
8. **Dependency cleanup and reinstall**: No effect, errors persist.
9. **React/react-dom version mismatch fixed**: Peer dependency errors resolved, but startAsync still undefined.
10. **Current step**: Reverting to named import for startAsync and using it directly.

## Next steps
- Test Google login after this correction.
- If error persists, check expo-auth-session documentation for SDK 54 compatibility.
- Consider using useAuthRequest again with correct config if manual method fails.
