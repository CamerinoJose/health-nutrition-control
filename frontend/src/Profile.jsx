import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from './api';
import HealthProfileForm from './HealthProfileForm';
import './profile.css';

export default function Profile({ token, profile }) {
  const { t } = useTranslation();
  const [history, setHistory] = useState([]);
  const [healthProfile, setHealthProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showHealthForm, setShowHealthForm] = useState(false);
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState('');

  useEffect(() => {
    loadHistory();
    loadHealthProfile();
  }, []);

  async function loadHistory() {
    try {
      const res = await api.get('/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadHealthProfile() {
    try {
      const res = await api.get('/health-profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHealthProfile(res.data);
    } catch (error) {
      console.error('Error loading health profile:', error);
    }
  }

  async function savePhone() {
    setSavingPhone(true);
    setPhoneMessage('');
    try {
      const res = await api.put('/me/contact', { phone: phone.trim() });
      setPhone(res.data.phone || '');
      setPhoneMessage('Teléfono guardado');
    } catch (error) {
      console.error('Error saving phone:', error);
      setPhoneMessage('No se pudo guardar el teléfono');
    } finally {
      setSavingPhone(false);
    }
  }

  const getLatestData = () => {
    if (history.length === 0) return null;
    return history[0];
  };

  const getTrend = () => {
    if (history.length < 2) return null;
    
    const latest = history[0];
    const previous = history[1];
    
    return {
      weight: (latest.weight - previous.weight).toFixed(1),
      fat: (latest.fat_percentage - previous.fat_percentage).toFixed(1),
      muscle: (latest.muscle_percentage - previous.muscle_percentage).toFixed(1)
    };
  };

  const generateRecommendations = () => {
    const latest = getLatestData();
    if (!latest) return [];

    const recommendations = [];
    const hp = healthProfile;

    // Diabetes-specific recommendations
    if (hp && hp.medical_conditions && hp.medical_conditions.toLowerCase().includes('diabetes')) {
      if (hp.hba1c && hp.hba1c > 7) {
        recommendations.push({
          type: 'warning',
          title: t('highHbA1c') || '⚠️ HbA1c elevada',
          message: t('highHbA1cRecommendation') || 'Tu HbA1c está por encima del objetivo (>7%). Es crucial mejorar el control glucémico.'
        });
      }

      if (hp.glucose_fasting && hp.glucose_fasting > 130) {
        recommendations.push({
          type: 'warning',
          title: t('highGlucose') || '⚠️ Glucosa elevada en ayunas',
          message: t('highGlucoseRecommendation') || 'Tu glucosa en ayunas está alta (>130 mg/dL).'
        });
      }

      recommendations.push({
        type: 'info',
        title: t('diabetesManagement') || '🩺 Manejo de Diabetes',
        message: t('diabetesManagementTip') || 'Tips diarios: distribuye carbohidratos en todas las comidas.'
      });
    }

    // Obesity-specific recommendations
    if (hp && hp.current_weight && hp.height) {
      const bmi = (hp.current_weight / ((hp.height / 100) ** 2)).toFixed(1);
      
      if (bmi >= 30) {
        const weightToLose = hp.goal_weight ? (hp.current_weight - hp.goal_weight).toFixed(1) : null;
        recommendations.push({
          type: 'warning',
          title: t('obesityAlert') || '⚠️ IMC en rango de obesidad',
          message: weightToLose 
            ? `Tu IMC es ${bmi} (obesidad). Meta: perder ${weightToLose} kg.`
            : `Tu IMC es ${bmi}. Enfócate en pérdida de peso gradual.`
        });
      } else if (bmi >= 25 && bmi < 30) {
        recommendations.push({
          type: 'info',
          title: t('overweightAlert') || '📊 Sobrepeso',
          message: `Tu IMC es ${bmi}. Estás cerca de un peso saludable.`
        });
      }
    }

    // Waist circumference
    if (hp && hp.waist_circumference) {
      const isMale = hp.sex === 'male';
      const riskThreshold = isMale ? 102 : 88;
      
      if (hp.waist_circumference > riskThreshold) {
        recommendations.push({
          type: 'warning',
          title: t('highWaistCircumference') || '⚠️ Circunferencia de cintura elevada',
          message: `Tu cintura (${hp.waist_circumference} cm) indica riesgo metabólico aumentado.`
        });
      }
    }

    // Cholesterol and triglycerides
    if (hp && hp.cholesterol_total && hp.cholesterol_total > 200) {
      recommendations.push({
        type: 'warning',
        title: t('highCholesterol') || '⚠️ Colesterol total elevado',
        message: t('cholesterolRecommendation') || 'Reduce grasas saturadas.'
      });
    }

    if (hp && hp.triglycerides && hp.triglycerides > 150) {
      recommendations.push({
        type: 'warning',
        title: t('highTriglycerides') || '⚠️ Triglicéridos elevados',
        message: t('triglyceridesRecommendation') || 'Limita azúcares y alcohol.'
      });
    }

    // Activity level
    if (hp && hp.activity_level === 'sedentary') {
      recommendations.push({
        type: 'info',
        title: t('sedentaryAlert') || '🚶 Aumenta tu actividad física',
        message: t('sedentaryRecommendation') || 'El sedentarismo afecta el metabolismo.'
      });
    }

    // Sleep
    if (hp && hp.sleep_hours && hp.sleep_hours < 7) {
      recommendations.push({
        type: 'info',
        title: t('insufficientSleep') || '😴 Mejora tu descanso',
        message: t('sleepRecommendation') || 'Dormir menos de 7 horas afecta tu salud.'
      });
    }

    // Body composition
    if (latest.fat_percentage > 30) {
      recommendations.push({
        type: 'warning',
        title: t('highBodyFat') || '⚠️ Porcentaje de grasa corporal elevado',
        message: t('bodyFatRecommendation') || 'Grasa corporal >30% aumenta riesgo de enfermedades.'
      });
    }

    if (latest.muscle_percentage < 30) {
      recommendations.push({
        type: 'info',
        title: t('lowMuscleMass') || '💪 Mejora tu masa muscular',
        message: t('muscleMassRecommendation') || 'Mayor masa muscular mejora el metabolismo.'
      });
    }

    // Positive reinforcement
    const trend = getTrend();
    if (trend) {
      if (parseFloat(trend.weight) < 0 && parseFloat(trend.fat) < 0) {
        recommendations.push({
          type: 'success',
          title: t('greatProgress') || '🎉 ¡Excelente progreso!',
          message: t('keepUpGoodWork') || 'Estás perdiendo peso y grasa. ¡Sigue así!'
        });
      }

      if (parseFloat(trend.muscle) > 0.5) {
        recommendations.push({
          type: 'success',
          title: t('muscleGain') || '💪 Ganancia de músculo',
          message: t('muscleGainCongrats') || '¡Felicidades! Estás ganando masa muscular.'
        });
      }
    }

    // Default message
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        title: t('generalHealth') || '✅ Continúa tu buen trabajo',
        message: t('generalHealthAdvice') || 'Mantén hábitos saludables.'
      });
    }

    return recommendations;
  };

  const handleHealthFormSave = () => {
    setShowHealthForm(false);
    loadHealthProfile();
  };

  const latest = getLatestData();
  const trend = getTrend();
  const recommendations = generateRecommendations();

  if (loading) {
    return <div className="profile-page"><p>{t('loading')}...</p></div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h2>{t('myProfile') || 'Mi Perfil'}</h2>
        <button 
          className="btn-health-profile" 
          onClick={() => setShowHealthForm(true)}
        >
          {healthProfile ? t('updateHealthProfile') : t('createHealthProfile')}
        </button>
      </div>

      {showHealthForm && (
        <HealthProfileForm 
          onClose={() => setShowHealthForm(false)}
          onSave={handleHealthFormSave}
        />
      )}

      <div className="profile-card">
        <h3>{t('personalInfo') || 'Información Personal'}</h3>
        <div className="info-grid">
          {profile.picture && (
            <div className="info-item" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
              <img src={profile.picture} alt="Profile" style={{ width: 80, height: 80, borderRadius: '50%' }} />
            </div>
          )}
          <div className="info-item">
            <label>{t('name')}:</label>
            <span>{profile.name}</span>
          </div>
          {profile.given_name && (
            <div className="info-item">
              <label>{t('given_name') || 'Nombre(s)'}:</label>
              <span>{profile.given_name}</span>
            </div>
          )}
          {profile.family_name && (
            <div className="info-item">
              <label>{t('family_name') || 'Apellido(s)'}:</label>
              <span>{profile.family_name}</span>
            </div>
          )}
          <div className="info-item">
            <label>{t('email')}:</label>
            <span>{profile.email}</span>
          </div>
          <div className="info-item">
            <label>Teléfono de contacto:</label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={30}
              placeholder="Opcional"
              aria-label="Teléfono de contacto"
            />
            <button type="button" className="btn-health-profile" onClick={savePhone} disabled={savingPhone}>
              {savingPhone ? 'Guardando...' : 'Guardar teléfono'}
            </button>
            {phoneMessage && <small>{phoneMessage}</small>}
          </div>
          <div className="info-item">
            <label>{t('role')}:</label>
            <span className={`role-badge ${profile.role}`}>{profile.role}</span>
          </div>
          {profile.locale && (
            <div className="info-item">
              <label>{t('locale') || 'Idioma'}:</label>
              <span>{profile.locale}</span>
            </div>
          )}
          {healthProfile && (
            <>
              <div className="info-item">
                <label>{t('age')}:</label>
                <span>{healthProfile.age} {t('years')}</span>
              </div>
              <div className="info-item">
                <label>{t('sex')}:</label>
                <span>{healthProfile.sex === 'male' ? t('male') : t('female')}</span>
              </div>
              <div className="info-item">
                <label>{t('height')}:</label>
                <span>{healthProfile.height} cm</span>
              </div>
              <div className="info-item">
                <label>{t('currentWeight')}:</label>
                <span>{healthProfile.current_weight} kg</span>
              </div>
              <div className="info-item">
                <label>{t('goalWeight')}:</label>
                <span>{healthProfile.goal_weight} kg</span>
              </div>
            </>
          )}
        </div>
      </div>

      {latest && (
        <div className="profile-card">
          <h3>{t('currentStats') || 'Estadísticas Actuales'}</h3>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">{t('weight')}</div>
              <div className="stat-value">{latest.weight} kg</div>
              {trend && (
                <div className={`stat-trend ${parseFloat(trend.weight) > 0 ? 'up' : 'down'}`}>
                  {parseFloat(trend.weight) > 0 ? '↑' : '↓'} {Math.abs(trend.weight)} kg
                </div>
              )}
            </div>
            <div className="stat-box">
              <div className="stat-label">{t('fat_percentage')}</div>
              <div className="stat-value">{latest.fat_percentage}%</div>
              {trend && (
                <div className={`stat-trend ${parseFloat(trend.fat) > 0 ? 'up' : 'down'}`}>
                  {parseFloat(trend.fat) > 0 ? '↑' : '↓'} {Math.abs(trend.fat)}%
                </div>
              )}
            </div>
            <div className="stat-box">
              <div className="stat-label">{t('muscle_percentage')}</div>
              <div className="stat-value">{latest.muscle_percentage}%</div>
              {trend && (
                <div className={`stat-trend ${parseFloat(trend.muscle) > 0 ? 'up' : 'down'}`}>
                  {parseFloat(trend.muscle) > 0 ? '↑' : '↓'} {Math.abs(trend.muscle)}%
                </div>
              )}
            </div>
          </div>
          <p className="last-update">{t('lastUpdate') || 'Última actualización'}: {latest.date}</p>
        </div>
      )}

      <div className="profile-card">
        <div className="card-header">
          <h3>{t('recommendations') || 'Recomendaciones Personalizadas'}</h3>
          <button 
            className="toggle-recommendations"
            onClick={() => setShowRecommendations(!showRecommendations)}
          >
            {showRecommendations ? (t('hide') || 'Ocultar') : (t('show') || 'Mostrar')}
          </button>
        </div>
        
        {showRecommendations && (
          <div className="recommendations-list">
            {recommendations.map((rec, idx) => (
              <div key={idx} className={`recommendation ${rec.type}`}>
                <h4>{rec.title}</h4>
                <p>{rec.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="profile-card">
        <h3>{t('history') || 'Historial de Mediciones'}</h3>
        {history.length === 0 ? (
          <p className="no-data">{t('noHistoryYet') || 'No hay mediciones registradas aún'}</p>
        ) : (
          <div className="history-table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('weight')} (kg)</th>
                  <th>{t('fat_percentage')}</th>
                  <th>{t('muscle_percentage')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{entry.weight}</td>
                    <td>{entry.fat_percentage}%</td>
                    <td>{entry.muscle_percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
