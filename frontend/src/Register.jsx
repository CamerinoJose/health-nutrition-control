import React, {useState} from 'react'
import api from './api'
import './auth.css'

export default function Register({onRegistered, onSwitchToLogin}){
  const [name,setName] = useState('')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [err,setErr] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const submit = async (e)=>{
    e.preventDefault()
    setErr(null)
    try{
      await api.post('/register',{name,email,password})
      onRegistered()
    }catch(e){
      setErr(e.response?.data?.error || 'Error al crear la cuenta')
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-left">
        <div className="auth-welcome">
          <h1>¡Únete a nosotros! 🌟</h1>
          <p>Comienza tu transformación hacia un estilo de vida más saludable</p>
          <div className="auth-features">
            <div className="feature-item">
              <span className="feature-icon">💪</span>
              <span>Soporte personalizado</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🏆</span>
              <span>Logros y recompensas</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">👥</span>
              <span>Comunidad activa</span>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-right">
        <form onSubmit={submit} className="auth-form">
          <h2 data-testid="register-title">Crear Cuenta</h2>
          {err && <div className="auth-error">{err}</div>}
          
          <div className="input-group">
            <label htmlFor="name">Nombre Completo</label>
            <div className="input-with-icon">
              <span className="input-icon">👤</span>
              <input 
                id="name"
                type="text"
                value={name} 
                onChange={e=>setName(e.target.value)}
                placeholder="Tu nombre"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <div className="input-with-icon">
              <span className="input-icon">📧</span>
              <input 
                id="email"
                type="email"
                value={email} 
                onChange={e=>setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Contraseña</label>
            <div className="input-with-icon">
              <span className="input-icon">🔒</span>
              <input 
                id="password"
                type={showPassword ? "text" : "password"}
                value={password} 
                onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button 
                type="button" 
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <small className="input-hint">Mínimo 6 caracteres</small>
          </div>

          <button type="submit" className="auth-button">Crear Cuenta</button>
          
          <div className="auth-footer">
            <p>¿Ya tienes una cuenta? <button type="button" className="link-button" onClick={onSwitchToLogin}>Inicia sesión</button></p>
            <p><a href="/privacy-policy.html" target="_blank" rel="noreferrer">Política de privacidad</a></p>
          </div>
        </form>
      </div>
    </div>
  )
}
