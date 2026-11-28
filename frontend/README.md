# BienestarApp - Frontend (React + Vite)

Proyecto React con soporte i18n (es / en) y placeholders de imagen.

La agenda con selección de zona y horario profesional está en desarrollo local,
no publicada. La configuración profesional en web y la prueba integral siguen
pendientes. Consulta `../TAREAS_PENDIENTES.md` y `../TESTING_AUTOMATION.md`.

Instalación y ejecución:

```bash
cd frontend
npm install
npm run dev
```

La app estará disponible en http://localhost:5173 (por defecto con Vite).

Notas:
- Traducciones en `src/locales`.
- Imágenes de ejemplo en `public/images`.
- Cambia `src/i18n.js` para ajustar idioma por defecto.

## Capturas / GIFs de referencia
- Calendario pacientes (stats mensuales + UI): `public/images/calendar-pacientes.gif`
- Calendario nutrióloga (stats + leyenda + modal): `public/images/calendar-nutriologa.gif`
- Progreso paciente (gráfica peso/%grasa/%músculo + exporte): `public/images/progreso-paciente.gif`
- Botón Google con branding oficial: `public/images/login-google.png`

Sugerencia: usa rutas anteriores para guardar las capturas; Vite las servirá desde `/images/...`.
