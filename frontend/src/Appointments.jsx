import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from './api';
import { getAppointmentChanges, acceptAppointmentChange, rejectAppointmentChange, getAvailableSlots } from './api';
import './appointments.css';

const Appointments = () => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [view, setView] = useState('calendar'); // calendar | history
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingAppointment, setEditingAppointment] = useState(null);
  // Quick scheduler state
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickSlots, setQuickSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    appointment_date: '',
    appointment_time: '',
    notes: ''
  });

  useEffect(() => {
    loadAppointments();
  }, [selectedMonth]);

  const loadAppointments = async () => {
    try {
      // Si no hay mes seleccionado, cargar todas las citas
      const url = selectedMonth ? `/appointments?month=${selectedMonth}` : '/appointments';
      const response = await api.get(url);
      const appointmentsList = response.data || [];
      setAppointments(appointmentsList);
      
      // Si es la primera carga y hay citas, ajustar al mes de la primera cita
      if (!selectedMonth && appointmentsList.length > 0) {
        const firstDate = appointmentsList[0].appointment_date;
        const monthFromFirstAppointment = firstDate.slice(0, 7);
        setSelectedMonth(monthFromFirstAppointment);
      } else if (!selectedMonth && appointmentsList.length === 0) {
        // Si no hay citas, usar el mes actual
        setSelectedMonth(new Date().toISOString().slice(0, 7));
      }
      
      // Load pending changes for all appointments
      if (appointmentsList.length > 0) {
        await loadPendingChanges(appointmentsList);
      } else {
        setPendingChanges([]);
      }
    } catch (error) {
      console.error('Error loading appointments:', error?.message);
    }
  };

  const loadAvailableSlots = async (date) => {
    setLoadingSlots(true);
    try {
      const slots = await getAvailableSlots(date);
      setQuickSlots(Array.isArray(slots) ? slots : []);
    } catch (error) {
      console.error('Error loading available slots:', error?.message);
      setQuickSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const loadPendingChanges = async (appointmentsList) => {
    try {
      const changes = [];
      for (const apt of appointmentsList) {
        try {
          const aptChanges = await getAppointmentChanges(apt.id);
          
          const pending = aptChanges.filter(c => c.status === 'pending');
          
          if (pending.length > 0) {
            const changesWithAppointment = pending.map(c => ({ 
              ...c, 
              appointment: apt 
            }));
            changes.push(...changesWithAppointment);
          }
        } catch (err) {
          console.error('Error loading appointment changes:', err?.message);
        }
      }
      
      setPendingChanges(changes);
    } catch (error) {
      console.error('Error loading pending changes:', error?.message);
    }
  };

  const handleAcceptChange = async (change) => {
    try {
      await acceptAppointmentChange(change.id);
      alert('Cambio de cita aceptado');
      await loadAppointments();
    } catch (error) {
      console.error('Error accepting change:', error?.message);
      alert('Error al aceptar el cambio');
    }
  };

  const handleRejectChange = async (change) => {
    const reason = prompt('¿Por qué rechazas este cambio?');
    if (!reason) return;
    
    try {
      await rejectAppointmentChange(change.id, reason);
      alert('Cambio de cita rechazado');
      await loadAppointments();
    } catch (error) {
      console.error('Error rejecting change:', error?.message);
      alert('Error al rechazar el cambio');
    }
  };

  const handleCreateAppointment = async () => {
    try {
      if (editingAppointment) {
        await api.put(`/appointments/${editingAppointment.id}`, form);
      } else {
        await api.post('/appointments', form);
      }
      
      loadAppointments();
      closeModal();
    } catch (error) {
      console.error('Error saving appointment:', error?.message);
      alert('Error al guardar la cita');
    }
  };

  const handleDeleteAppointment = async (id) => {
    if (!confirm('¿Eliminar esta cita?')) return;
    
    try {
      await api.delete(`/appointments/${id}`);
      loadAppointments();
    } catch (error) {
      console.error('Error deleting appointment:', error?.message);
    }
  };

  const handleCompleteAppointment = async (appointment) => {
    try {
      await api.put(`/appointments/${appointment.id}`, {
        ...appointment,
        status: 'completed'
      });
      loadAppointments();
    } catch (error) {
      console.error('Error completing appointment:', error?.message);
    }
  };

  const openModal = (date = null, appointment = null) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setForm({
        title: appointment.title,
        description: appointment.description,
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time,
        notes: appointment.notes
      });
    } else {
      setEditingAppointment(null);
      setForm({
        title: '',
        description: '',
        appointment_date: date || '',
        appointment_time: '09:00',
        notes: ''
      });
    }
    setSelectedDate(date);
    setShowModal(true);
  };

  const handleSelectSlot = (date, time) => {
    // Prefill form with selected date/time and open modal
    setEditingAppointment(null);
    setForm({
      title: 'Consulta con nutricionista',
      description: '',
      appointment_date: date,
      appointment_time: time,
      notes: ''
    });
    setSelectedDate(date);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAppointment(null);
    setForm({
      title: '',
      description: '',
      appointment_date: '',
      appointment_time: '',
      notes: ''
    });
  };

  const getAppointmentsForDate = (date) => {
    return appointments.filter(apt => apt.appointment_date === date);
  };

  const renderCalendar = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = (firstDay.getDay() + 6) % 7; // Lunes = 0

    const days = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayAppointments = getAppointmentsForDate(date);
      const isToday = date === new Date().toISOString().split('T')[0];

      days.push(
        <div 
          key={day} 
          className={`calendar-day ${isToday ? 'today' : ''}`}
          onClick={() => openModal(date)}
        >
          <div className="day-number">{day}</div>
          {dayAppointments.length > 0 && (
            <div className="appointments-indicator">
              {dayAppointments.map((apt, i) => (
                <div 
                  key={i} 
                  className={`appointment-dot ${apt.status}`}
                  title={apt.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(date, apt);
                  }}
                >
                  <span className="appointment-time">{apt.appointment_time}</span>
                  <span className="appointment-title">{apt.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const getHistory = () => {
    const now = new Date().toISOString();
    return appointments.filter(apt => 
      `${apt.appointment_date} ${apt.appointment_time}` < now
    ).sort((a, b) => 
      `${b.appointment_date} ${b.appointment_time}`.localeCompare(`${a.appointment_date} ${a.appointment_time}`)
    );
  };

  const getUpcoming = () => {
    const now = new Date().toISOString();
    return appointments.filter(apt => 
      `${apt.appointment_date} ${apt.appointment_time}` >= now && apt.status === 'scheduled'
    ).sort((a, b) => 
      `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`)
    );
  };

  const getMonthStats = () => {
    const monthAppointments = appointments.filter(apt => 
      apt.appointment_date.startsWith(selectedMonth)
    );
    const completed = monthAppointments.filter(apt => apt.status === 'completed').length;
    const scheduled = monthAppointments.filter(apt => apt.status === 'scheduled').length;
    const cancelled = monthAppointments.filter(apt => apt.status === 'cancelled').length;
    
    return {
      total: monthAppointments.length,
      completed,
      scheduled,
      cancelled
    };
  };

  return (
    <div className="appointments-container">
      <div className="appointments-header">
        <div className="header-top">
          <h2>📅 {t('appointments') || 'Citas'}</h2>
          
          <div className="view-toggle">
            <button 
              className={view === 'calendar' ? 'active' : ''}
              onClick={() => setView('calendar')}
            >
              📅 Calendario
            </button>
            <button 
              className={view === 'history' ? 'active' : ''}
              onClick={() => setView('history')}
            >
              📋 Historial
            </button>
          </div>
        </div>
      </div>

      {/* Quick scheduler with nutritionist availability */}
      {view === 'calendar' && (
        <div className="quick-scheduler">
          <div className="qs-row">
            <div className="qs-title">🧑‍⚕️ Agendar rápida con tu Nutriólogo</div>
            <div className="qs-controls">
              <input
                type="date"
                value={quickDate}
                onChange={(e) => setQuickDate(e.target.value)}
              />
              <button className="qs-search" onClick={() => loadAvailableSlots(quickDate)}>
                Ver horarios
              </button>
            </div>
          </div>
          <div className="qs-slots">
            {loadingSlots && <div className="qs-loading">Cargando horarios...</div>}
            {!loadingSlots && quickSlots.length === 0 && (
              <div className="qs-empty">No hay horarios disponibles para esta fecha</div>
            )}
            {!loadingSlots && quickSlots.length > 0 && (
              <div className="qs-slot-grid">
                {quickSlots.map((slot, idx) => (
                  <button
                    key={idx}
                    className="qs-slot"
                    onClick={() => handleSelectSlot(quickDate, slot)}
                    title={`Reservar ${slot}`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mostrar cambios pendientes prominentemente */}
      {pendingChanges.length > 0 && (
        <div className="pending-changes-alert">
          <h3>⚠️ Tu Nutrióloga Propone Cambios de Cita ({pendingChanges.length})</h3>
          <p className="alert-subtitle">Por favor revisa y responde a las siguientes propuestas:</p>
          {pendingChanges.map(change => (
            <div key={change.id} className="pending-change-card">
              <div className="change-info">
                <h4>📌 {change.appointment.title}</h4>
                <div className="date-comparison">
                  <div className="date-box current">
                    <span className="date-label">Cita Actual</span>
                    <span className="date-value">📅 {change.appointment.appointment_date}</span>
                    <span className="time-value">🕐 {change.appointment.appointment_time}</span>
                  </div>
                  <div className="arrow">→</div>
                  <div className="date-box proposed">
                    <span className="date-label">Nueva Propuesta</span>
                    <span className="date-value">📅 {change.new_date}</span>
                    <span className="time-value">🕐 {change.new_time}</span>
                  </div>
                </div>
                {change.reason && change.reason.trim() && (
                  <p className="change-reason">
                    <strong>💬 Razón:</strong> {change.reason}
                  </p>
                )}
                <p className="change-meta">
                  📝 Propuesto por: <strong>{change.proposed_by_name}</strong> el {new Date(change.created_at).toLocaleDateString('es-ES', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="change-actions">
                <button 
                  className="btn-accept"
                  onClick={() => handleAcceptChange(change)}
                  title="Aceptar esta nueva fecha y hora"
                >
                  ✅ Aceptar Cambio
                </button>
                <button 
                  className="btn-reject"
                  onClick={() => handleRejectChange(change)}
                  title="Rechazar y mantener la cita original"
                >
                  ❌ Rechazar Cambio
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'calendar' && (
        <>
          <div className="month-stats">
            <div className="stat-card total">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-number">{getMonthStats().total}</div>
                <div className="stat-label">Total del Mes</div>
              </div>
            </div>
            <div className="stat-card scheduled">
              <div className="stat-icon">📅</div>
              <div className="stat-content">
                <div className="stat-number">{getMonthStats().scheduled}</div>
                <div className="stat-label">Programadas</div>
              </div>
            </div>
            <div className="stat-card completed">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <div className="stat-number">{getMonthStats().completed}</div>
                <div className="stat-label">Completadas</div>
              </div>
            </div>
            <div className="stat-card cancelled">
              <div className="stat-icon">❌</div>
              <div className="stat-content">
                <div className="stat-number">{getMonthStats().cancelled}</div>
                <div className="stat-label">Canceladas</div>
              </div>
            </div>
          </div>

          <div className="calendar-controls">
            <button onClick={() => {
              const [year, month] = selectedMonth.split('-').map(Number);
              const date = new Date(year, month - 1, 1);
              date.setMonth(date.getMonth() - 1);
              const newYear = date.getFullYear();
              const newMonth = String(date.getMonth() + 1).padStart(2, '0');
              setSelectedMonth(`${newYear}-${newMonth}`);
            }}>‹</button>
            
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
            
            <button onClick={() => {
              const [year, month] = selectedMonth.split('-').map(Number);
              const date = new Date(year, month - 1, 1);
              date.setMonth(date.getMonth() + 1);
              const newYear = date.getFullYear();
              const newMonth = String(date.getMonth() + 1).padStart(2, '0');
              setSelectedMonth(`${newYear}-${newMonth}`);
            }}>›</button>
          </div>

          <div className="calendar-grid">
            <div className="calendar-weekdays">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mié</div>
              <div>Jue</div>
              <div>Vie</div>
              <div>Sáb</div>
              <div>Dom</div>
            </div>
            <div className="calendar-days">
              {renderCalendar()}
            </div>
          </div>

          <div className="upcoming-section">
            <h3>📌 Próximas Citas</h3>
            {getUpcoming().length === 0 ? (
              <p className="no-data">No tienes citas próximas</p>
            ) : (
              <div className="upcoming-list">
                {getUpcoming().map(apt => (
                  <div key={apt.id} className="appointment-card upcoming">
                    <div className="apt-header">
                      <h4>{apt.title}</h4>
                      <span className="apt-datetime">
                        {new Date(apt.appointment_date).toLocaleDateString('es-ES', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short'
                        })} • {apt.appointment_time}
                      </span>
                    </div>
                    {apt.description && <p>{apt.description}</p>}
                    <div className="apt-actions">
                      <button onClick={() => openModal(null, apt)} className="btn-edit">Editar</button>
                      <button onClick={() => handleCompleteAppointment(apt)} className="btn-complete">Completar</button>
                      <button onClick={() => handleDeleteAppointment(apt.id)} className="btn-delete">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {view === 'history' && (
        <div className="history-section">
          <h3>📋 Historial de Citas</h3>
          {getHistory().length === 0 ? (
            <p className="no-data">No tienes citas en el historial</p>
          ) : (
            <div className="history-list">
              {getHistory().map(apt => (
                <div key={apt.id} className={`appointment-card history ${apt.status}`}>
                  <div className="apt-header">
                    <h4>{apt.title}</h4>
                    <span className="apt-datetime">
                      {new Date(apt.appointment_date).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })} • {apt.appointment_time}
                    </span>
                  </div>
                  {apt.description && <p>{apt.description}</p>}
                  {apt.notes && (
                    <div className="apt-notes">
                      <strong>Notas:</strong> {apt.notes}
                    </div>
                  )}
                  <div className="apt-status">
                    <span className={`status-badge ${apt.status}`}>
                      {apt.status === 'completed' ? '✓ Completada' : 
                       apt.status === 'cancelled' ? '✗ Cancelada' : 
                       '⏰ Agendada'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAppointment ? 'Editar Cita' : 'Nueva Cita'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Consulta con nutricionista"
                />
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalles de la cita..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fecha *</label>
                  <input
                    type="date"
                    value={form.appointment_date}
                    onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Hora *</label>
                  <input
                    type="time"
                    value={form.appointment_time}
                    onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notas adicionales..."
                  rows="2"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeModal}>Cancelar</button>
              <button 
                className="btn-save" 
                onClick={handleCreateAppointment}
                disabled={!form.title || !form.appointment_date || !form.appointment_time}
              >
                {editingAppointment ? 'Actualizar' : 'Crear Cita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
