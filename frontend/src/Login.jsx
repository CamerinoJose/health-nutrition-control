

import React, { useState } from 'react'
import api from './api'
import { saveToken } from './auth'
import ForgotPassword from './ForgotPassword'
import { useTranslation } from 'react-i18next'
import './auth.css'


export default function Login({onLogin, onSwitchToRegister}){
  const { t } = useTranslation();
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [err,setErr] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [loading, setLoading] = useState(false);



  const submit = async (e)=>{
    e.preventDefault()
    setErr(null)
    setLoading(true);
    try{
      const res = await api.post('/login',{email,password})
      const { token } = res.data
      saveToken(token)
      onLogin(token)
    }catch(e){
      setErr(e.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false);
    }
  }


  // Pre-fill email after password reset
  const handleForgotBack = (resetEmail) => {
    setShowForgot(false);
    if (resetEmail) setEmail(resetEmail);
  };

  if (showForgot) {
    return <ForgotPassword onBack={handleForgotBack} />;
  }

  return (
    <div className="auth-container">
      <div className="auth-left">
        <div className="auth-welcome">
          <h1>¡Bienvenido de nuevo! 👋</h1>
          <p>Tu viaje hacia una vida más saludable continúa aquí</p>
          <div className="auth-features">
            <div className="feature-item">
              <span className="feature-icon">🥗</span>
              <span>Planes personalizados</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span>Seguimiento diario</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🎯</span>
              <span>Alcanza tus metas</span>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-right">
        <form onSubmit={submit} className="auth-form">
          <h2 data-testid="login-title">{t('login')}</h2>
          {err && <div className="auth-error">{err}</div>}
          
          <div className="input-group">
            <label htmlFor="email">{t('email')}</label>
            <div className="input-with-icon">
              <span className="input-icon">📧</span>
              <input 
                id="email"
                data-testid="login-email"
                type="email"
                value={email} 
                onChange={e=>setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">{t('password') || 'Contraseña'}</label>
            <div className="input-with-icon">
              <span className="input-icon">🔒</span>
              <input 
                id="password"
                data-testid="login-password"
                type={showPassword ? "text" : "password"}
                value={password} 
                onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button 
                type="button" 
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-button" data-testid="login-submit" disabled={loading}>
            {loading ? t('loading') || 'Cargando...' : t('login')}
          </button>
          <button type="button" className="link-button" style={{marginTop: 8, marginBottom: 8}} onClick={() => setShowForgot(true)}>
            {t('forgotPassword') || '¿Olvidaste tu contraseña?'}
          </button>
          
          <div className="auth-divider">
            <span>{t('orContinueWith') || 'o continúa con'}</span>
          </div>

          <div className="social-login-buttons">
            <button type="button" className="social-button google" onClick={() => {
              const width = 500;
              const height = 600;
              const left = (window.innerWidth - width) / 2;
              const top = (window.innerHeight - height) / 2;
              const authBase = import.meta.env.VITE_BACKEND_URL || '/api';
              const redirect = encodeURIComponent(`${window.location.origin}/callback`);
              window.open(
                `${authBase}/auth/google?redirect_uri=${redirect}`,
                'GoogleLogin',
                `width=${width},height=${height},left=${left},top=${top}`
              );
            }}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t('google') || 'Google'}
            </button>
          </div>
          
          <div className="auth-footer">
            <p>{t('noAccount') || '¿No tienes una cuenta?'} <button type="button" className="link-button" onClick={onSwitchToRegister}>{t('register')}</button></p>
          </div>
        </form>
      </div>
    </div>
  )
}
