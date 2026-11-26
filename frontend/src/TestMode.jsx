import React, { useEffect, useState } from 'react'
import './test-mode.css'

export const TEST_CASES = [
  ['Cuenta', 'Registrar una cuenta nueva'],
  ['Cuenta', 'Iniciar sesión con correo'],
  ['Cuenta', 'Iniciar sesión con Google'],
  ['Cuenta', 'Cambiar de cuenta sin mezclar datos'],
  ['Cuenta', 'Cerrar sesión y ocultar datos locales'],
  ['Perfil', 'Guardar contacto y preferencia'],
  ['Perfil', 'Mantener perfil al reabrir'],
  ['Alimentación', 'Subir PDF y extraer comidas'],
  ['Alimentación', 'Abrir recetas de las comidas'],
  ['Alimentación', 'Guardar horarios sin conexión'],
  ['Alimentación', 'No mezclar planes entre cuentas'],
  ['Medicinas', 'Agregar medicina de hora fija'],
  ['Medicinas', 'Agregar medicina ligada a comida'],
  ['Medicinas', 'Marcar tomada y conservar estado'],
  ['Citas', 'Crear y consultar una cita'],
  ['Mensajes', 'Enviar y recibir mensaje'],
  ['Progreso', 'Guardar y consultar progreso'],
  ['Gemini', 'Responder una consulta real'],
  ['Gemini', 'Copiar una respuesta'],
  ['Gemini', 'Conservar historial por cuenta'],
]

export default function TestMode({ profile }) {
  const accountId = profile?.user_id != null ? String(profile.user_id) : 'guest'
  const storageKey = `bienestar_test_results_v1:${accountId}`
  const [results, setResults] = useState({})
  const [selected, setSelected] = useState(0)
  const [note, setNote] = useState('')

  useEffect(() => {
    try {
      setResults(JSON.parse(localStorage.getItem(storageKey) || '{}'))
    } catch {
      setResults({})
    }
  }, [storageKey])

  useEffect(() => {
    setNote(results[selected]?.note || '')
  }, [selected, results])

  const save = (next) => {
    setResults(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const setStatus = (status) => {
    save({
      ...results,
      [selected]: {
        ...(results[selected] || {}),
        status,
        note,
        updatedAt: new Date().toISOString(),
      },
    })
  }

  const saveNote = () => {
    save({
      ...results,
      [selected]: {
        ...(results[selected] || {}),
        note,
        updatedAt: new Date().toISOString(),
      },
    })
  }

  const clear = () => {
    if (!window.confirm('¿Limpiar todos los resultados de pruebas de esta cuenta?')) return
    localStorage.removeItem(storageKey)
    setResults({})
  }

  const counts = { pending: 0, approved: 0, failed: 0 }
  TEST_CASES.forEach((_, index) => {
    counts[results[index]?.status || 'pending'] += 1
  })

  const groups = [...new Set(TEST_CASES.map(([group]) => group))]

  return (
    <div className="test-mode">
      <div className="test-mode-header">
        <h2>🧪 Modo de pruebas</h2>
        <button type="button" className="test-mode-clear" onClick={clear}>Limpiar</button>
      </div>
      <div className="test-mode-summary">
        <span>Pendientes: {counts.pending}</span>
        <span>Aprobados: {counts.approved}</span>
        <span>Fallidos: {counts.failed}</span>
      </div>
      {groups.map((group) => (
        <section className="test-mode-group" key={group}>
          <h3>{group}</h3>
          {TEST_CASES.map(([caseGroup, title], index) => caseGroup === group && (
            <button
              type="button"
              key={index}
              className={`test-mode-case ${selected === index ? 'selected' : ''}`}
              onClick={() => setSelected(index)}
            >
              <span>{title}</span>
              <span className={`test-mode-status ${results[index]?.status || 'pending'}`}>
                {results[index]?.status === 'approved' ? 'Aprobado' : results[index]?.status === 'failed' ? 'Falló' : 'Pendiente'}
              </span>
            </button>
          ))}
        </section>
      ))}
      <section className="test-mode-editor">
        <h3>Caso seleccionado</h3>
        <p>{TEST_CASES[selected][1]}</p>
        <div className="test-mode-actions">
          <button type="button" className="approved" onClick={() => setStatus('approved')}>Aprobado</button>
          <button type="button" className="failed" onClick={() => setStatus('failed')}>Falló</button>
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Nota, navegador, cuenta o error observado"
        />
        <button type="button" className="save" onClick={saveNote}>Guardar nota</button>
      </section>
    </div>
  )
}
