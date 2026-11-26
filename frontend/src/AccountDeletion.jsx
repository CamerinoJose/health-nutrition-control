import React, { useState } from 'react'
import api from './api'

export default function AccountDeletion({ onCancel, onDeleted }) {
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete(event) {
    event.preventDefault()
    if (confirmation !== 'ELIMINAR') return

    setDeleting(true)
    setError('')
    try {
      await api.delete('/me', { data: { password } })
      onDeleted()
    } catch (requestError) {
      setError(requestError.response?.status === 401
        ? 'No se pudo confirmar tu identidad. Verifica tu contraseña actual o vuelve a iniciar sesión con Google y reintenta.'
        : requestError.response?.data?.error || 'No se pudo eliminar la cuenta. Inténtalo de nuevo.')
    } finally {
      setDeleting(false)
    }
  }

  function reauthenticateWithGoogle() {
    const width = 500
    const height = 600
    const left = (window.innerWidth - width) / 2
    const top = (window.innerHeight - height) / 2
    const authBase = import.meta.env.VITE_BACKEND_URL || '/api'
    const redirect = encodeURIComponent(`${window.location.origin}/callback`)
    window.open(
      `${authBase}/auth/google?redirect_uri=${redirect}`,
      'GoogleLogin',
      `width=${width},height=${height},left=${left},top=${top}`,
    )
  }

  return (
    <section className="settings-container">
      <h2>Eliminar cuenta</h2>
      <p>Esta acción elimina permanentemente tu cuenta y los datos asociados, incluidos perfil de salud, historial, planes, mensajes, citas y reportes de Gemini. No se puede deshacer.</p>
      <p>Para confirmar, introduce tu contraseña actual si tu cuenta usa contraseña. Si iniciaste con Google, vuelve a autenticarte para confirmar tu identidad.</p>
      <form onSubmit={handleDelete}>
        <label htmlFor="delete-account-password">Contraseña actual (si aplica)</label>
        <input
          id="delete-account-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="button" className="link-button" onClick={reauthenticateWithGoogle}>
          Volver a iniciar sesión con Google
        </button>
        <label htmlFor="delete-account-confirmation">Escribe ELIMINAR para continuar</label>
        <input
          id="delete-account-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
        />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-button" type="submit" disabled={deleting || confirmation !== 'ELIMINAR'}>
          {deleting ? 'Eliminando…' : 'Eliminar mi cuenta permanentemente'}
        </button>
        <button className="link-button" type="button" onClick={onCancel} disabled={deleting}>
          Cancelar
        </button>
      </form>
    </section>
  )
}
