import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { requestNotificationPermission, getNotificationStatus, showNotification } from './notifications';
import api from './api';
import './settings.css';

const Settings = ({ profile, onUpdate }) => {
  const { t } = useTranslation();
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [mealTimes, setMealTimes] = useState({
    breakfast: '08:00',
    lunch: '14:00',
    dinner: '20:00',
    snack: '16:00'
  });
  const [enableReminders, setEnableReminders] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotificationPermission(getNotificationStatus());
    if (profile?.meal_times) {
      setMealTimes(profile.meal_times);
    }
    if (profile?.enable_reminders) {
      setEnableReminders(profile.enable_reminders);
    }
  }, [profile]);

  const handleRequestPermission = async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      showNotification('✅ Notificaciones Activadas', {
        body: 'Recibirás recordatorios de tus comidas'
      });
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        meal_times: mealTimes,
        enable_reminders: enableReminders
      });
      
      if (onUpdate) {
        onUpdate({ ...profile, meal_times: mealTimes, enable_reminders: enableReminders });
      }
      
      alert('Configuración guardada');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = () => {
    showNotification('🔔 Notificación de Prueba', {
      body: 'Las notificaciones están funcionando correctamente'
    });
  };

  return (
    <div className="settings-container">
      <h2>⚙️ {t('settings')}</h2>

      <div className="settings-section">
        <h3>🔔 {t('pushNotifications')}</h3>
        <div className="permission-status">
          <p><strong>{t('status')}:</strong> {
            notificationPermission === 'granted' ? t('notificationsEnabled') :
            notificationPermission === 'denied' ? t('notificationsBlocked') :
            notificationPermission === 'unsupported' ? t('notificationsUnsupported') :
            t('notificationsUnconfigured')
          }</p>
        </div>

        {notificationPermission === 'default' && (
          <button className="btn-primary" onClick={handleRequestPermission}>
            {t('enableNotifications')}
          </button>
        )}

        {notificationPermission === 'denied' && (
          <p className="warning-text">
            {t('notificationsBlockedWarning')}
          </p>
        )}

        {notificationPermission === 'granted' && (
          <>
            <button className="btn-secondary" onClick={handleTestNotification}>
              {t('testNotification')}
            </button>

            <div className="setting-item">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={enableReminders}
                  onChange={(e) => setEnableReminders(e.target.checked)}
                />
                <span>{t('enableMealReminders')}</span>
              </label>
            </div>
          </>
        )}
      </div>

      {enableReminders && notificationPermission === 'granted' && (
        <div className="settings-section">
          <h3>⏰ {t('mealTimes')}</h3>
          <p className="section-description">
            {t('configureMealTimes')}
          </p>

          <div className="time-inputs">
            <div className="time-input-group">
              <label>🌅 {t('breakfast')}</label>
              <input
                type="time"
                value={mealTimes.breakfast}
                onChange={(e) => setMealTimes({ ...mealTimes, breakfast: e.target.value })}
              />
            </div>

            <div className="time-input-group">
              <label>☀️ {t('lunch')}</label>
              <input
                type="time"
                value={mealTimes.lunch}
                onChange={(e) => setMealTimes({ ...mealTimes, lunch: e.target.value })}
              />
            </div>

            <div className="time-input-group">
              <label>🍎 {t('snack')}</label>
              <input
                type="time"
                value={mealTimes.snack}
                onChange={(e) => setMealTimes({ ...mealTimes, snack: e.target.value })}
              />
            </div>

            <div className="time-input-group">
              <label>🌙 {t('dinner')}</label>
              <input
                type="time"
                value={mealTimes.dinner}
                onChange={(e) => setMealTimes({ ...mealTimes, dinner: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      <div className="settings-actions">
        <button 
          className="btn-save" 
          onClick={handleSaveSettings}
          disabled={saving}
        >
          {saving ? t('saving') : `💾 ${t('saveSettings')}`}
        </button>
      </div>
      <div className="settings-section">
        <h3>Privacidad y cuenta</h3>
        <p>Consulta cómo se usan tus datos o elimina tu cuenta de forma permanente.</p>
        <a href="/privacy-policy.html" target="_blank" rel="noreferrer">Política de privacidad</a>
        {' · '}
        <a href="/?view=delete-account">Eliminar cuenta</a>
      </div>
    </div>
  );
};

export default Settings;
