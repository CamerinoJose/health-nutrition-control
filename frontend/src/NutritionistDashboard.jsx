import React, { useState, useEffect } from 'react';
import { ageFromBirthDate } from './age';
import { getPatients, getPatientDetails, getPatientHistory, getNutritionistAppointments, 
         updateAppointmentNotes, createRecommendation, getRecommendations,
         getRecipes, createRecipe, updateRecipe, deleteRecipe, proposeAppointmentChange, sendMessageToPatient } from './api';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import './nutritionist.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function NutritionistDashboard({ profile }) {
  const [activeTab, setActiveTab] = useState('patients');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientDetails, setPatientDetails] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Forms state
  const [recommendationForm, setRecommendationForm] = useState({
    patient_id: '',
    appointment_id: '',
    recommendation_text: '',
    diet_changes: '',
    exercise_plan: '',
    next_goals: ''
  });

  const [recipeForm, setRecipeForm] = useState({
    name: '',
    category: 'Proteínas',
    prep_time: 30,
    servings: 2,
    calories: 400,
    protein: 30,
    carbs: 40,
    fat: 15,
    ingredients: '',
    instructions: '',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800'
  });

  const [editingRecipe, setEditingRecipe] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive
  const [dashboardStats, setDashboardStats] = useState(null);

  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    if (activeTab === 'patients') {
      loadPatients();
    } else if (activeTab === 'appointments' || activeTab === 'calendar') {
      loadAppointments();
    } else if (activeTab === 'recipes') {
      loadRecipes();
    }
  }, [activeTab, calendarMonth]);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const data = await getPatients();
      const patientData = Array.isArray(data) ? data : [];
      setPatients(patientData);
      calculateDashboardStats(patientData);
    } catch (error) {
      console.error('Error loading patients:', error);
      setPatients([]);
    }
    setLoading(false);
  };

  const calculateDashboardStats = (patientsList) => {
    const totalPatients = patientsList.length;
    const activePatients = patientsList.filter(p => p.appointment_count > 0).length;
    const totalAppointments = patientsList.reduce((sum, p) => sum + (p.appointment_count || 0), 0);
    const recentlyActive = patientsList.filter(p => {
      if (!p.last_visit) return false;
      const lastVisit = new Date(p.last_visit);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return lastVisit >= thirtyDaysAgo;
    }).length;

    setDashboardStats({
      totalPatients,
      activePatients,
      totalAppointments,
      recentlyActive
    });
  };

  const loadPatientDetails = async (patientId) => {
    setLoading(true);
    try {
      const details = await getPatientDetails(patientId);
      const history = await getPatientHistory(patientId);
      const recs = await getRecommendations(patientId);
      
      setPatientDetails(details);
      setPatientHistory(Array.isArray(history) ? history : []);
      setRecommendations(Array.isArray(recs) ? recs : []);
      setSelectedPatient(patientId);
      
      // Pre-fill recommendation form with patient ID
      setRecommendationForm(prev => ({ ...prev, patient_id: patientId }));
    } catch (error) {
      console.error('Error loading patient details:', error);
    }
    setLoading(false);
  };

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const data = await getNutritionistAppointments();
      const appointmentData = Array.isArray(data) ? data : [];
      setAppointments(appointmentData);
    } catch (error) {
      console.error('Error loading appointments:', error);
      setAppointments([]);
    }
    setLoading(false);
  };

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const data = await getRecipes();
      const recipeData = Array.isArray(data) ? data : [];
      setRecipes(recipeData);
    } catch (error) {
      console.error('Error loading recipes:', error);
      setRecipes([]);
    }
    setLoading(false);
  };

  const handleUpdateAppointment = async (appointmentId, notes, status) => {
    try {
      await updateAppointmentNotes(appointmentId, { notes, status });
      alert('Cita actualizada correctamente');
      loadAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      alert('Error al actualizar la cita');
    }
  };

  const handleProposeChange = async (appointmentId, newDate, newTime, reason) => {
    try {
      await proposeAppointmentChange(appointmentId, {
        new_date: newDate,
        new_time: newTime,
        reason: reason
      });
      alert('Cambio de cita propuesto correctamente. El paciente recibirá una notificación.');
      loadAppointments();
    } catch (error) {
      console.error('Error proposing change:', error);
      alert('Error al proponer cambio de cita');
    }
  };

  const handleCreateRecommendation = async (e) => {
    e.preventDefault();
    try {
      // Preparar datos, convirtiendo appointment_id vacío a null
      const data = {
        ...recommendationForm,
        appointment_id: recommendationForm.appointment_id ? parseInt(recommendationForm.appointment_id) : null
      };
      await createRecommendation(data);
      alert('Recomendación creada correctamente');
      setRecommendationForm({
        patient_id: recommendationForm.patient_id,
        appointment_id: '',
        recommendation_text: '',
        diet_changes: '',
        exercise_plan: '',
        next_goals: ''
      });
      if (selectedPatient) {
        loadPatientDetails(selectedPatient);
      }
    } catch (error) {
      console.error('Error creating recommendation:', error);
      alert('Error al crear la recomendación');
    }
  };

  const handleCreateRecipe = async (e) => {
    e.preventDefault();
    try {
      if (editingRecipe) {
        await updateRecipe(editingRecipe.id, recipeForm);
        alert('Receta actualizada correctamente');
        setEditingRecipe(null);
      } else {
        await createRecipe(recipeForm);
        alert('Receta creada correctamente');
      }
      setRecipeForm({
        name: '',
        category: 'Proteínas',
        prep_time: 30,
        servings: 2,
        calories: 400,
        protein: 30,
        carbs: 40,
        fat: 15,
        ingredients: '',
        instructions: '',
        image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800'
      });
      loadRecipes();
    } catch (error) {
      console.error('Error saving recipe:', error);
      alert('Error al guardar la receta');
    }
  };

  const handleEditRecipe = (recipe) => {
    setEditingRecipe(recipe);
    setRecipeForm({
      name: recipe.name,
      category: recipe.category,
      prep_time: recipe.prep_time,
      servings: recipe.servings,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image_url: recipe.image_url
    });
  };

  const handleDeleteRecipe = async (recipeId) => {
    if (!confirm('¿Estás segura de eliminar esta receta?')) return;
    
    try {
      await deleteRecipe(recipeId);
      alert('Receta eliminada correctamente');
      loadRecipes();
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('Error al eliminar la receta');
    }
  };

  const getAppointmentsForDate = (date) => {
    return appointments.filter(apt => apt.appointment_date === date);
  };

  const renderCalendar = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
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
          className={`calendar-day ${isToday ? 'today' : ''} ${dayAppointments.length > 0 ? 'has-appointments' : ''}`}
        >
          <div className="day-number">{day}</div>
          {dayAppointments.length > 0 && (
            <div className="appointments-indicator">
              {dayAppointments.map((apt, i) => (
                <div 
                  key={i} 
                  className={`appointment-dot ${apt.status}`}
                  title={`${apt.appointment_time} - ${apt.title} (${apt.patient_name})`}
                  onClick={() => {
                    setSelectedAppointment(apt);
                    setShowAppointmentModal(true);
                  }}
                >
                  <span className="appointment-time">{apt.appointment_time}</span>
                  <span className="appointment-title">{apt.patient_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const getCalendarStats = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisMonth = appointments.filter(apt => apt.appointment_date.startsWith(calendarMonth));
    const upcoming = thisMonth.filter(apt => apt.appointment_date >= today && apt.status === 'scheduled');
    const completed = thisMonth.filter(apt => apt.status === 'completed');
    const cancelled = thisMonth.filter(apt => apt.status === 'cancelled');
    
    return { total: thisMonth.length, upcoming: upcoming.length, completed: completed.length, cancelled: cancelled.length };
  };

  const getFilteredPatients = () => {
    let filtered = patients;

    // Aplicar búsqueda
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Aplicar filtro de estado
    if (filterStatus === 'active') {
      filtered = filtered.filter(p => p.appointment_count > 0);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(p => p.appointment_count === 0);
    }

    return filtered;
  };

  const prepareProgressChartData = (history) => {
    if (!history || history.length === 0) return null;

    const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedHistory.map(entry => new Date(entry.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }));

    return {
      labels,
      datasets: [
        {
          label: 'Peso (kg)',
          data: sortedHistory.map(entry => entry.weight),
          borderColor: 'rgb(139, 92, 246)',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: '% Grasa',
          data: sortedHistory.map(entry => entry.fat_percentage),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        },
        {
          label: '% Músculo',
          data: sortedHistory.map(entry => entry.muscle_percentage),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Progreso del Paciente',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Peso (kg)'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Porcentaje (%)'
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const exportPatientReport = (patient, details, history) => {
    const reportData = {
      paciente: patient.name,
      email: patient.email,
      fecha_reporte: new Date().toLocaleDateString('es-ES'),
      perfil: details.health_profile || {},
      ultima_medicion: details.latest_history || {},
      historial: history,
      recomendaciones: recommendations
    };

    const reportText = `
==============================================
REPORTE DE PACIENTE
==============================================

Paciente: ${reportData.paciente}
Email: ${reportData.email}
Fecha del Reporte: ${reportData.fecha_reporte}

--- PERFIL DE SALUD ---
Edad: ${reportData.perfil.birth_date ? (ageFromBirthDate(reportData.perfil.birth_date) ?? 'N/A') : (reportData.perfil.age || 'N/A')} años${!reportData.perfil.birth_date ? ' (registrada)' : ''}
Sexo: ${reportData.perfil.sex || 'N/A'}
Altura: ${reportData.perfil.height || 'N/A'} cm
Peso Actual: ${reportData.perfil.weight || 'N/A'} kg
Peso Meta: ${reportData.perfil.target_weight || 'N/A'} kg
Nivel de Actividad: ${reportData.perfil.activity_level || 'N/A'}
Objetivos: ${reportData.perfil.goals || 'N/A'}

--- ÚLTIMA MEDICIÓN ---
Fecha: ${reportData.ultima_medicion.date || 'N/A'}
Peso: ${reportData.ultima_medicion.weight || 'N/A'} kg
% Grasa: ${reportData.ultima_medicion.fat_percentage || 'N/A'}%
% Músculo: ${reportData.ultima_medicion.muscle_percentage || 'N/A'}%

--- HISTORIAL DE MEDICIONES ---
${history.map(entry => `
Fecha: ${entry.date}
Peso: ${entry.weight} kg | % Grasa: ${entry.fat_percentage}% | % Músculo: ${entry.muscle_percentage}%`).join('\n')}

--- RECOMENDACIONES ---
${recommendations.map((rec, i) => `
${i + 1}. Fecha: ${new Date(rec.created_at).toLocaleDateString('es-ES')}
Por: ${rec.nutritionist_name}
Recomendación: ${rec.recommendation_text}
Cambios en dieta: ${rec.diet_changes || 'N/A'}
Plan de ejercicio: ${rec.exercise_plan || 'N/A'}
Próximas metas: ${rec.next_goals || 'N/A'}`).join('\n\n')}

==============================================
Fin del Reporte
==============================================
    `;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Reporte exportado correctamente');
  };

  // Handler for sending message to patient
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    try {
      await sendMessageToPatient(selectedPatient, messageText);
      alert("Mensaje enviado correctamente");
      setShowMessageModal(false);
      setMessageText("");
    } catch (err) {
      alert("Error al enviar el mensaje");
      console.error(err);
    }
  };

  return (
    <div className="nutritionist-dashboard">
      <div className="nutritionist-header">
        <h1>Panel de Nutrióloga</h1>
        <p>Bienvenida, {profile?.name}</p>
      </div>

      <div className="nutritionist-tabs">
        <button 
          className={activeTab === 'patients' ? 'active' : ''} 
          onClick={() => setActiveTab('patients')}
        >
          👥 Pacientes
        </button>
        <button 
          className={activeTab === 'appointments' ? 'active' : ''} 
          onClick={() => setActiveTab('appointments')}
        >
          📅 Citas
        </button>
        <button 
          className={activeTab === 'recipes' ? 'active' : ''} 
          onClick={() => setActiveTab('recipes')}
        >
          🍽️ Recetas
        </button>
        <button 
          className={activeTab === 'calendar' ? 'active' : ''} 
          onClick={() => setActiveTab('calendar')}
        >
          📅 Calendario
        </button>
      </div>

      <div className="nutritionist-content">
        {loading && <div className="loading">Cargando...</div>}

        {activeTab === 'patients' && dashboardStats && (
          <div className="dashboard-stats-overview">
            <div className="stat-card primary">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-number">{dashboardStats.totalPatients}</div>
                <div className="stat-label">Total Pacientes</div>
              </div>
            </div>
            <div className="stat-card success">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <div className="stat-number">{dashboardStats.activePatients}</div>
                <div className="stat-label">Pacientes Activos</div>
              </div>
            </div>
            <div className="stat-card info">
              <div className="stat-icon">📅</div>
              <div className="stat-content">
                <div className="stat-number">{dashboardStats.totalAppointments}</div>
                <div className="stat-label">Total Citas</div>
              </div>
            </div>
            <div className="stat-card warning">
              <div className="stat-icon">⏰</div>
              <div className="stat-content">
                <div className="stat-number">{dashboardStats.recentlyActive}</div>
                <div className="stat-label">Activos (30 días)</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="patients-view">
            <div className="patients-list">
              <h2>Lista de Pacientes ({getFilteredPatients().length})</h2>
              
              <div className="search-filters">
                <input
                  type="text"
                  className="search-input"
                  placeholder="🔍 Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="filter-buttons">
                  <button 
                    className={filterStatus === 'all' ? 'active' : ''}
                    onClick={() => setFilterStatus('all')}
                  >
                    Todos
                  </button>
                  <button 
                    className={filterStatus === 'active' ? 'active' : ''}
                    onClick={() => setFilterStatus('active')}
                  >
                    Activos
                  </button>
                  <button 
                    className={filterStatus === 'inactive' ? 'active' : ''}
                    onClick={() => setFilterStatus('inactive')}
                  >
                    Inactivos
                  </button>
                </div>
              </div>

              {getFilteredPatients().length === 0 ? (
                <div className="no-results">
                  <p>No se encontraron pacientes</p>
                </div>
              ) : (
                getFilteredPatients().map(patient => (
                <div 
                  key={patient.id} 
                  className={`patient-card ${selectedPatient === patient.id ? 'selected' : ''}`}
                  onClick={() => loadPatientDetails(patient.id)}
                >
                  <div className="patient-info">
                    <h3>{patient.name}</h3>
                    <p>{patient.email}</p>
                  </div>
                  <div className="patient-stats">
                    <span>{patient.appointment_count} citas</span>
                    {patient.last_visit && <span>Última: {patient.last_visit}</span>}
                  </div>
                </div>
              )))}
            </div>

            {patientDetails && (
              <div className="patient-details">
                <div className="patient-details-header">
                  <h2>{patientDetails.name}</h2>
                  <button 
                    className="btn-export"
                    onClick={() => exportPatientReport(
                      patients.find(p => p.id === selectedPatient),
                      patientDetails,
                      patientHistory
                    )}
                  >
                    📥 Exportar Reporte
                  </button>
                </div>
                
                {patientHistory.length > 0 && (
                  <div className="details-section">
                    <h3>📊 Gráfica de Progreso</h3>
                    <div className="progress-chart">
                      <Line 
                        data={prepareProgressChartData(patientHistory)} 
                        options={chartOptions}
                      />
                    </div>
                  </div>
                )}

                <div className="details-section">
                  <h3>Información General</h3>
                  <div className="info-grid">
                    <div><strong>Email:</strong> {patientDetails.email}</div>
                    <div><strong>Edad:</strong> {patientDetails.health_profile?.birth_date ? (ageFromBirthDate(patientDetails.health_profile.birth_date) ?? 'N/A') : (patientDetails.health_profile?.age || 'N/A')} años{!patientDetails.health_profile?.birth_date && ' (registrada)'}</div>
                    <div><strong>Sexo:</strong> {patientDetails.health_profile?.sex || 'N/A'}</div>
                    <div><strong>Altura:</strong> {patientDetails.health_profile?.height || 'N/A'} cm</div>
                    <div><strong>Peso Actual:</strong> {patientDetails.health_profile?.weight || 'N/A'} kg</div>
                    <div><strong>Peso Meta:</strong> {patientDetails.health_profile?.target_weight || 'N/A'} kg</div>
                  </div>
                </div>

                {patientDetails.latest_history && (
                  <div className="details-section">
                    <h3>Última Medición</h3>
                    <div className="info-grid">
                      <div><strong>Fecha:</strong> {patientDetails.latest_history.date}</div>
                      <div><strong>Peso:</strong> {patientDetails.latest_history.weight} kg</div>
                      <div><strong>% Grasa:</strong> {patientDetails.latest_history.fat_percentage}%</div>
                      <div><strong>% Músculo:</strong> {patientDetails.latest_history.muscle_percentage}%</div>
                    </div>
                  </div>
                )}

                <div className="details-section">
                  <h3>Historial de Progreso</h3>
                  <div className="history-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Peso</th>
                          <th>% Grasa</th>
                          <th>% Músculo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientHistory.map(entry => (
                          <tr key={entry.id}>
                            <td>{entry.date}</td>
                            <td>{entry.weight} kg</td>
                            <td>{entry.fat_percentage}%</td>
                            <td>{entry.muscle_percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="details-section">
                  <h3>Recomendaciones Anteriores</h3>
                  {recommendations.length === 0 ? (
                    <p>No hay recomendaciones previas</p>
                  ) : (
                    recommendations.map(rec => (
                      <div key={rec.id} className="recommendation-card">
                        <div className="rec-header">
                          <span className="rec-date">{new Date(rec.created_at).toLocaleDateString()}</span>
                          <span className="rec-author">Por: {rec.nutritionist_name}</span>
                        </div>
                        <div className="rec-content">
                          <p><strong>Recomendación:</strong> {rec.recommendation_text}</p>
                          {rec.diet_changes && <p><strong>Cambios en dieta:</strong> {rec.diet_changes}</p>}
                          {rec.exercise_plan && <p><strong>Plan de ejercicio:</strong> {rec.exercise_plan}</p>}
                          {rec.next_goals && <p><strong>Próximas metas:</strong> {rec.next_goals}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="details-section">
                  <h3>Nueva Recomendación</h3>
                  <form onSubmit={handleCreateRecommendation} className="recommendation-form">
                                    {/* Message Patient Button and Modal */}
                                    <div className="details-section">
                                      <h3>Mensajería</h3>
                                      <button
                                        className="btn-primary"
                                        style={{ marginBottom: '1em' }}
                                        onClick={() => setShowMessageModal(true)}
                                      >
                                        ✉️ Enviar Mensaje al Paciente
                                      </button>
                                      {showMessageModal && (
                                        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
                                          <div className="message-modal" onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 400, margin: '40px auto', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                                            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <h3>Enviar Mensaje a {patientDetails.name}</h3>
                                              <button className="modal-close" onClick={() => setShowMessageModal(false)}>✕</button>
                                            </div>
                                            <form onSubmit={handleSendMessage}>
                                              <div className="form-group">
                                                <label>Mensaje *</label>
                                                <textarea
                                                  required
                                                  value={messageText}
                                                  onChange={e => setMessageText(e.target.value)}
                                                  placeholder="Escribe tu mensaje..."
                                                  rows="4"
                                                  style={{ width: '100%' }}
                                                />
                                              </div>
                                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                <button type="button" className="btn-secondary" onClick={() => setShowMessageModal(false)}>Cancelar</button>
                                                <button type="submit" className="btn-primary">Enviar</button>
                                              </div>
                                            </form>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                    <div className="form-group">
                      <label>Cita asociada (opcional)</label>
                      <input
                        type="number"
                        value={recommendationForm.appointment_id}
                        onChange={(e) => setRecommendationForm({ ...recommendationForm, appointment_id: e.target.value })}
                        placeholder="ID de la cita"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Recomendación General *</label>
                      <textarea
                        required
                        value={recommendationForm.recommendation_text}
                        onChange={(e) => setRecommendationForm({ ...recommendationForm, recommendation_text: e.target.value })}
                        placeholder="Describe la recomendación general..."
                        rows="4"
                      />
                    </div>

                    <div className="form-group">
                      <label>Cambios en la Dieta</label>
                      <textarea
                        value={recommendationForm.diet_changes}
                        onChange={(e) => setRecommendationForm({ ...recommendationForm, diet_changes: e.target.value })}
                        placeholder="Especifica cambios en la alimentación..."
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label>Plan de Ejercicio</label>
                      <textarea
                        value={recommendationForm.exercise_plan}
                        onChange={(e) => setRecommendationForm({ ...recommendationForm, exercise_plan: e.target.value })}
                        placeholder="Rutina de ejercicios recomendada..."
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label>Próximas Metas</label>
                      <textarea
                        value={recommendationForm.next_goals}
                        onChange={(e) => setRecommendationForm({ ...recommendationForm, next_goals: e.target.value })}
                        placeholder="Objetivos para el siguiente período..."
                        rows="2"
                      />
                    </div>

                    <button type="submit" className="btn-primary">Crear Recomendación</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="appointments-view">
            <div className="appointments-header">
              <h2>📅 Citas Programadas</h2>
              <div className="view-options">
                <button className="btn-primary">Ver Calendario</button>
              </div>
            </div>

            {appointments.length === 0 ? (
              <div className="empty-state">
                <p>No hay citas programadas</p>
              </div>
            ) : (
              <div className="appointments-timeline">
                {/* Agrupar por fecha */}
                {Object.entries(
                  appointments.reduce((acc, apt) => {
                    const date = apt.appointment_date;
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(apt);
                    return acc;
                  }, {})
                ).sort((a, b) => a[0].localeCompare(b[0])).map(([date, dayAppointments]) => (
                  <div key={date} className="day-group">
                    <h3 className="day-header">
                      {new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </h3>
                    <div className="appointments-grid">
                      {dayAppointments.sort((a, b) => 
                        a.appointment_time.localeCompare(b.appointment_time)
                      ).map(appointment => (
                        <div key={appointment.id} className={`appointment-card status-${appointment.status}`}>
                          <div className="appointment-time-badge">
                            {appointment.appointment_time}
                          </div>
                          <div className="appointment-header">
                            <h3>{appointment.title}</h3>
                            <span className={`status-badge ${appointment.status}`}>
                              {appointment.status === 'scheduled' && '📅 Programada'}
                              {appointment.status === 'completed' && '✅ Completada'}
                              {appointment.status === 'cancelled' && '❌ Cancelada'}
                            </span>
                          </div>
                          <div className="appointment-body">
                            <p><strong>👤 Paciente:</strong> {appointment.patient_name}</p>
                            <p><strong>📝 Descripción:</strong> {appointment.description || 'Sin descripción'}</p>
                            {appointment.notes && <p><strong>📋 Notas:</strong> {appointment.notes}</p>}
                          </div>
                          {appointment.status === 'scheduled' && (
                            <div className="appointment-actions">
                              <button 
                                onClick={() => {
                                  const newDate = prompt('Nueva fecha (YYYY-MM-DD):', appointment.appointment_date);
                                  if (newDate) {
                                    const newTime = prompt('Nueva hora (HH:MM):', appointment.appointment_time);
                                    if (newTime) {
                                      const reason = prompt('Razón del cambio (opcional):');
                                      handleProposeChange(appointment.id, newDate, newTime, reason || '');
                                    }
                                  }
                                }}
                                className="btn-sm btn-info"
                                title="Proponer un cambio de fecha/hora al paciente"
                              >
                                📅 Proponer Cambio
                              </button>
                              <button 
                                onClick={() => {
                                  const notes = prompt('Notas de la cita:', appointment.notes || '');
                                  if (notes !== null) {
                                    handleUpdateAppointment(appointment.id, notes, 'completed');
                                  }
                                }}
                                className="btn-sm btn-success"
                              >
                                ✅ Completar
                              </button>
                              <button 
                                onClick={() => {
                                  const notes = prompt('Razón de cancelación:', appointment.notes || '');
                                  if (notes !== null) {
                                    handleUpdateAppointment(appointment.id, notes, 'cancelled');
                                  }
                                }}
                                className="btn-sm btn-danger"
                              >
                                ❌ Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recipes' && (
          <div className="recipes-view">
            <div className="recipes-form-section">
              <h2>{editingRecipe ? 'Editar Receta' : 'Nueva Receta'}</h2>
              <form onSubmit={handleCreateRecipe} className="recipe-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input
                      required
                      value={recipeForm.name}
                      onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                      placeholder="Nombre de la receta"
                    />
                  </div>

                  <div className="form-group">
                    <label>Categoría</label>
                    <select
                      value={recipeForm.category}
                      onChange={(e) => setRecipeForm({ ...recipeForm, category: e.target.value })}
                    >
                      <option value="Desayunos">Desayunos</option>
                      <option value="Ensaladas">Ensaladas</option>
                      <option value="Proteínas">Proteínas</option>
                      <option value="Vegetariana">Vegetariana</option>
                      <option value="Snacks">Snacks</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tiempo (min)</label>
                    <input
                      type="number"
                      value={recipeForm.prep_time}
                      onChange={(e) => setRecipeForm({ ...recipeForm, prep_time: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Porciones</label>
                    <input
                      type="number"
                      value={recipeForm.servings}
                      onChange={(e) => setRecipeForm({ ...recipeForm, servings: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Calorías</label>
                    <input
                      type="number"
                      value={recipeForm.calories}
                      onChange={(e) => setRecipeForm({ ...recipeForm, calories: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Proteína (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={recipeForm.protein}
                      onChange={(e) => setRecipeForm({ ...recipeForm, protein: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Carbohidratos (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={recipeForm.carbs}
                      onChange={(e) => setRecipeForm({ ...recipeForm, carbs: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Grasas (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={recipeForm.fat}
                      onChange={(e) => setRecipeForm({ ...recipeForm, fat: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>URL de Imagen</label>
                  <input
                    value={recipeForm.image_url}
                    onChange={(e) => setRecipeForm({ ...recipeForm, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="form-group">
                  <label>Ingredientes (uno por línea) *</label>
                  <textarea
                    required
                    value={recipeForm.ingredients}
                    onChange={(e) => setRecipeForm({ ...recipeForm, ingredients: e.target.value })}
                    placeholder="200g de pollo&#10;1 taza de arroz&#10;..."
                    rows="5"
                  />
                </div>

                <div className="form-group">
                  <label>Instrucciones (una por línea) *</label>
                  <textarea
                    required
                    value={recipeForm.instructions}
                    onChange={(e) => setRecipeForm({ ...recipeForm, instructions: e.target.value })}
                    placeholder="Calentar sartén...&#10;Cocinar pollo...&#10;..."
                    rows="6"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary">
                    {editingRecipe ? 'Actualizar Receta' : 'Crear Receta'}
                  </button>
                  {editingRecipe && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingRecipe(null);
                        setRecipeForm({
                          name: '', category: 'Proteínas', prep_time: 30, servings: 2,
                          calories: 400, protein: 30, carbs: 40, fat: 15,
                          ingredients: '', instructions: '',
                          image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800'
                        });
                      }}
                      className="btn-secondary"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="recipes-list-section">
              <h2>Recetas Existentes ({recipes.length})</h2>
              <div className="recipes-grid">
                {recipes.map(recipe => (
                  <div key={recipe.id} className="recipe-card">
                    <img src={recipe.image_url} alt={recipe.name} />
                    <div className="recipe-info">
                      <h3>{recipe.name}</h3>
                      <span className="recipe-category">{recipe.category}</span>
                      <div className="recipe-macros">
                        <span>{recipe.calories} cal</span>
                        <span>P: {recipe.protein}g</span>
                        <span>C: {recipe.carbs}g</span>
                        <span>G: {recipe.fat}g</span>
                      </div>
                      <div className="recipe-actions">
                        <button onClick={() => handleEditRecipe(recipe)} className="btn-sm">
                          Editar
                        </button>
                        <button onClick={() => handleDeleteRecipe(recipe.id)} className="btn-sm btn-danger">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="calendar-view">
            <div className="calendar-header">
              <h2>📅 Calendario de Citas</h2>
              <div className="calendar-stats">
                <div className="stat-card total">
                  <span className="stat-number">{getCalendarStats().total}</span>
                  <span className="stat-label">Total</span>
                </div>
                <div className="stat-card upcoming">
                  <span className="stat-number">{getCalendarStats().upcoming}</span>
                  <span className="stat-label">Próximas</span>
                </div>
                <div className="stat-card completed">
                  <span className="stat-number">{getCalendarStats().completed}</span>
                  <span className="stat-label">Completadas</span>
                </div>
                <div className="stat-card cancelled">
                  <span className="stat-number">{getCalendarStats().cancelled}</span>
                  <span className="stat-label">Canceladas</span>
                </div>
              </div>
            </div>

            <div className="calendar-controls">
              <button onClick={() => {
                const [year, month] = calendarMonth.split('-').map(Number);
                const date = new Date(year, month - 1, 1);
                date.setMonth(date.getMonth() - 1);
                setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
              }}>‹</button>
              
              <input 
                type="month" 
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(e.target.value)}
              />
              
              <button onClick={() => {
                const [year, month] = calendarMonth.split('-').map(Number);
                const date = new Date(year, month - 1, 1);
                date.setMonth(date.getMonth() + 1);
                setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
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

            <div className="calendar-legend">
              <h3>Leyenda</h3>
              <div className="legend-items">
                <div className="legend-item">
                  <span className="legend-dot scheduled"></span>
                  <span>Programada</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot completed"></span>
                  <span>Completada</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot cancelled"></span>
                  <span>Cancelada</span>
                </div>
              </div>
            </div>

            {showAppointmentModal && selectedAppointment && (
              <div className="modal-overlay" onClick={() => setShowAppointmentModal(false)}>
                <div className="appointment-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>📋 Detalles de la Cita</h3>
                    <button className="modal-close" onClick={() => setShowAppointmentModal(false)}>✕</button>
                  </div>
                  <div className="modal-body">
                    <div className="detail-row">
                      <span className="detail-label">👤 Paciente:</span>
                      <span className="detail-value">{selectedAppointment.patient_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">📅 Fecha:</span>
                      <span className="detail-value">{new Date(selectedAppointment.appointment_date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">🕐 Hora:</span>
                      <span className="detail-value">{selectedAppointment.appointment_time}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">📝 Título:</span>
                      <span className="detail-value">{selectedAppointment.title}</span>
                    </div>
                    {selectedAppointment.description && (
                      <div className="detail-row full-width">
                        <span className="detail-label">📋 Descripción:</span>
                        <span className="detail-value">{selectedAppointment.description}</span>
                      </div>
                    )}
                    {selectedAppointment.notes && (
                      <div className="detail-row full-width">
                        <span className="detail-label">📌 Notas:</span>
                        <span className="detail-value">{selectedAppointment.notes}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="detail-label">Estado:</span>
                      <span className={`status-badge ${selectedAppointment.status}`}>
                        {selectedAppointment.status === 'scheduled' && '📅 Programada'}
                        {selectedAppointment.status === 'completed' && '✅ Completada'}
                        {selectedAppointment.status === 'cancelled' && '❌ Cancelada'}
                      </span>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowAppointmentModal(false)}>Cerrar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default NutritionistDashboard;
