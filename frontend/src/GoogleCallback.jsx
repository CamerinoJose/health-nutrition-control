import React, { useEffect } from 'react'
import { saveToken, TOKEN_KEY } from './auth'

export default function GoogleCallback() {
  useEffect(() => {
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');
    
    if (token) {
      // Save token to localStorage
      saveToken(token);
      
      // Notify parent window (if opened from popup) and close immediately
      if (window.opener) {
        window.opener.postMessage({ type: 'oauth-token', token }, '*');
        setTimeout(() => window.close(), 100);
      } else {
        // A direct visit should still return to the application after saving.
        window.location.replace('/');
      }
      // If not opened from popup, just stay and show message
    } else if (error) {
      alert('Error: ' + error);
      if (window.opener) {
        window.close();
      } else {
        window.location.href = '/';
      }
    } else {
      // No token and no error - redirect to home
      if (window.opener) {
        window.close();
      } else {
        window.location.href = '/';
      }
    }
  }, []);
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      fontSize: '18px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{textAlign: 'center'}}>
        <h2>Procesando autenticación...</h2>
        <p>⏳ Por favor espera</p>
      </div>
    </div>
  );
}
