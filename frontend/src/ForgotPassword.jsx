import React from 'react';
import './auth.css';

export default function ForgotPassword({ onBack }) {
  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Restablecer Contraseña</h2>
        <p>La recuperación de contraseña no está disponible temporalmente.</p>
        <p>Contacta a <a href="mailto:healthnutritioncontrol@gmail.com">soporte</a> para recibir orientación. No envíes contraseñas ni datos de salud.</p>
        <button className="link-button" onClick={() => onBack()} style={{marginTop: 16}}>Volver al inicio de sesión</button>
      </div>
    </div>
  );
}
