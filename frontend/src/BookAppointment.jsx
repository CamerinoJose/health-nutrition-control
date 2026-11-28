import React, { useEffect, useRef, useState } from 'react'
import { getAvailableSlots } from './api'
import api from './api'
import { availableSlots, localDateInput, slotErrorMessage, slotLabel } from './appointmentSlots'
import './bookings.css'

export default function BookAppointment({ onNavigate }) {
  const [date, setDate] = useState(() => localDateInput())
  const [slots, setSlots] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const slotsRequest = useRef(0)
  const [form, setForm] = useState({
    title: 'Consulta con nutricionista',
    description: '',
    notes: ''
  })

  const loadSlots = async () => {
    const request = ++slotsRequest.current
    setLoading(true)
    setError('')
    setSuccess('')
    setSelectedSlot(null)
    setSlots(null)
    try {
      const res = await getAvailableSlots(date)
      const available = availableSlots(res)
      if (request === slotsRequest.current) setSlots(available)
    } catch (e) {
      if (request === slotsRequest.current) {
        console.error('Error loading slots:', e.message)
        setError(slotErrorMessage(e))
      }
    } finally {
      if (request === slotsRequest.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadSlots()
    return () => { slotsRequest.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBook = async () => {
    if (!selectedSlot) {
      setError('Selecciona un horario')
      return
    }
    setError('')
    setSuccess('')
    try {
      await api.post('/appointments', {
        title: form.title,
        description: form.description,
        notes: form.notes,
        appointment_date: date,
        appointment_time: selectedSlot.start_time,
        starts_at: selectedSlot.starts_at
      })
      setSuccess('Cita creada correctamente')
      setTimeout(() => onNavigate ? onNavigate('appointments') : null, 600)
    } catch (e) {
      console.error('Error creating appointment:', e?.response?.status || e.message)
      setError(e?.response?.status === 409
        ? slotErrorMessage(e)
        : 'No se pudo crear la cita')
    }
  }

  return (
    <div className="booking-container">
      <div className="booking-header">
        <h2>🧑‍⚕️ Reservar Cita</h2>
        <button className="btn-back" onClick={() => onNavigate('appointments')}>← Volver</button>
      </div>

      <div className="booking-controls">
        <label>
          Fecha
          <input type="date" value={date} onChange={(e) => {
            slotsRequest.current++
            setDate(e.target.value)
            setSelectedSlot(null)
            setSlots(null)
            setLoading(false)
            setError('')
            setSuccess('')
          }} />
        </label>
        <button className="btn-primary" onClick={loadSlots}>Ver horarios</button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="slot-section">
        {loading && <div className="loading">Cargando horarios...</div>}
        {!loading && !error && slots && slots.length === 0 && (
          <div className="empty">No hay horarios disponibles para esta fecha</div>
        )}
        {!loading && slots && slots.length > 0 && (
          <>
          <p>Hora del profesional: {slots[0].time_zone}</p>
          <div className="slot-grid">
            {slots.map((slot) => (
              <button
                key={slot.starts_at}
                className={`slot ${selectedSlot?.starts_at === slot.starts_at ? 'selected' : ''}`}
                onClick={() => setSelectedSlot(slot)}
                title={`Reservar ${slotLabel(slot)}`}
              >
                {slotLabel(slot)}
              </button>
            ))}
          </div>
          </>
        )}
      </div>

      <div className="booking-form">
        <div className="form-group">
          <label>Título</label>
          <input
            type="text"
            value={form.title}
            onChange={(e)=> setForm({ ...form, title: e.target.value })}
            placeholder="Consulta con nutricionista"
          />
        </div>
        <div className="form-group">
          <label>Descripción</label>
          <textarea
            value={form.description}
            onChange={(e)=> setForm({ ...form, description: e.target.value })}
            placeholder="Detalles de tu consulta..."
            rows={3}
          />
        </div>
        <div className="form-group">
          <label>Notas</label>
          <textarea
            value={form.notes}
            onChange={(e)=> setForm({ ...form, notes: e.target.value })}
            placeholder="Notas adicionales"
            rows={2}
          />
        </div>
      </div>

      <div className="booking-actions">
        <button className="btn-secondary" onClick={() => onNavigate('appointments')}>Cancelar</button>
        <button className="btn-primary" onClick={handleBook} disabled={!selectedSlot}>Reservar</button>
      </div>
    </div>
  )
}
