import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from './api'
import './admin.css'

const metricLabels = {
  total_users: 'Usuarios registrados',
  regular_users: 'Usuarios',
  nutritionists: 'Nutriólogos',
  admins: 'Administradores',
  assigned_users: 'Usuarios con nutriólogo',
  unassigned_users: 'Usuarios sin nutriólogo',
  pending_appointments: 'Citas pendientes',
  completed_appointments: 'Citas completadas',
  cancelled_appointments: 'Citas canceladas'
}

const reportReasonLabels = {
  unsafe_medical_advice: 'Consejo médico inseguro',
  harmful: 'Contenido dañino',
  privacy: 'Privacidad',
  other: 'Otro',
}

export default function AdminPanel({ token }) {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState('metrics')
  const [geminiReports, setGeminiReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState(null)
  const [updatingReportId, setUpdatingReportId] = useState(null)
  const canViewIndividualData = metrics?.can_view_individual_data === 1

  useEffect(() => {
    Promise.all([fetchMetrics(), fetchUsers()])
      .catch(() => setError(t('failedToLoadUsers')))
      .finally(() => setLoading(false))
  }, [token])

  async function fetchMetrics() {
    const res = await api.get('/admin/metrics')
    setMetrics(res.data)
  }

  async function fetchUsers() {
    const res = await api.get('/admin/users')
    setUsers(res.data || [])
  }

  async function showGeminiReports() {
    setView('gemini-reports')
    setReportsLoading(true)
    setReportsError(null)
    try {
      const res = await api.get('/admin/gemini-reports')
      setGeminiReports(Array.isArray(res.data) ? res.data : [])
    } catch {
      setReportsError('No se pudieron cargar los reportes de Gemini.')
    } finally {
      setReportsLoading(false)
    }
  }

  async function updateGeminiReport(reportId, status) {
    setUpdatingReportId(reportId)
    setReportsError(null)
    try {
      await api.put(`/admin/gemini-reports/${reportId}`, { status })
      const res = await api.get('/admin/gemini-reports')
      setGeminiReports(Array.isArray(res.data) ? res.data : [])
    } catch {
      setReportsError('No se pudo actualizar el reporte.')
    } finally {
      setUpdatingReportId(null)
    }
  }

  if (loading) return <div className="admin-panel">{t('loading')}</div>
  if (error) return <div className="admin-panel"><p className="error">{error}</p></div>

  return (
    <div className="admin-panel">
      <h2>{t('adminDashboard')}</h2>
      <p className="admin-privacy-note">
        Panel operativo con datos mínimos. La información clínica individual está restringida.
      </p>

      <div className="admin-tabs">
        <button className={view === 'metrics' ? 'active' : ''} onClick={() => setView('metrics')}>
          Resumen operativo
        </button>
        <button className={view === 'users' ? 'active' : ''} onClick={() => setView('users')}>
          Directorio
        </button>
        <button className={view === 'gemini-reports' ? 'active' : ''} onClick={showGeminiReports}>
          Reportes de Gemini
        </button>
      </div>

      {view === 'metrics' && (
        <div className="admin-section">
          <h3>Resumen de atención</h3>
          <div className="analytics-grid">
            {Object.entries(metricLabels).map(([key, label]) => (
              <div className="stat-card" key={key}>
                <h4>{label}</h4>
                <p className="stat-value">{metrics?.[key] ?? 0}</p>
              </div>
            ))}
          </div>
          <p className="admin-audit-note">
            Las consultas administrativas se registran para auditoría.
          </p>
        </div>
      )}

      {view === 'users' && (
        <div className="admin-section">
          <h3>Directorio operativo ({users.length})</h3>
          <p className="admin-privacy-note">
            {canViewIndividualData
              ? 'Tienes autorización designada para consultar datos identificables.'
              : 'Nombres y correos están enmascarados. Se requiere autorización de privacidad para ver datos identificables.'}
          </p>
          <div className="users-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t('name')}</th>
                  <th>{t('email')}</th>
                  <th>{t('role')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'gemini-reports' && (
        <div className="admin-section">
          <h3>Reportes de respuestas de Gemini</h3>
          <p className="admin-privacy-note">
            Solo administradores pueden consultar esta cola. Se guarda la respuesta reportada y su motivo, no la pregunta original.
          </p>
          {reportsError && <p className="error" role="alert">{reportsError}</p>}
          {reportsLoading ? (
            <p role="status">Cargando reportes…</p>
          ) : geminiReports.length === 0 ? (
            <p>No hay reportes pendientes.</p>
          ) : (
            <div className="reports-table">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Motivo</th>
                    <th>Respuesta reportada</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {geminiReports.map((report) => (
                    <tr key={report.id}>
                      <td>{new Date(report.created_at).toLocaleString()}</td>
                      <td>{reportReasonLabels[report.reason] || 'Otro'}</td>
                      <td className="report-content">{report.response_text}</td>
                      <td>{report.status}</td>
                      <td>
                        {report.status === 'pending' && (
                          <>
                            <button
                              className="action-btn"
                              disabled={updatingReportId === report.id}
                              onClick={() => updateGeminiReport(report.id, 'reviewed')}
                            >
                              Marcar revisado
                            </button>
                            <button
                              className="action-btn delete-btn"
                              disabled={updatingReportId === report.id}
                              onClick={() => updateGeminiReport(report.id, 'dismissed')}
                            >
                              Descartar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
