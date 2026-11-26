import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Alert,
  Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from './api';
import { DEFAULT_MEAL_TIMES, loadMealTimes, saveMealTimes, normalizeMealTimes } from './mealTimes';
import { DEFAULT_REMINDER_SETTINGS, loadReminderSettings, saveReminderSettings, normalizeReminderSettings } from './reminderSettings';
import { setupDiabetesNotifications } from './diabetesNotifications';
import { getActiveAccountId } from './auth';

const MEAL_REMINDER_IDS_KEY = 'bienestar_meal_reminder_ids_v1';
const PENDING_MEAL_SETTINGS_KEY = 'bienestar_pending_meal_settings_v1';

export function normalizeMealPlanLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function findMealForDayAndType(meals, day, type) {
  const normalizedDay = normalizeMealPlanLabel(day);
  const normalizedType = normalizeMealPlanLabel(type);
  const list = Array.isArray(meals) ? meals : [];
  return list.find((meal) => {
    const mealDay = normalizeMealPlanLabel(meal.day_of_week);
    let mealType = normalizeMealPlanLabel(meal.meal_type);
    if (mealType === 'almuerzo') mealType = 'comida';
    return mealDay === normalizedDay && mealType === normalizedType;
  });
}

export function buildMealUploadMessage(mealsCount) {
  const count = Number(mealsCount || 0);
  if (count === 0) {
    return {
      title: 'PDF cargado, pero sin comidas detectadas',
      body: 'El PDF se recibió, pero el OCR no pudo identificar días y tipos de comida. Prueba un PDF con texto seleccionable o una imagen más legible.',
    };
  }
  return {
    title: '✅ Plan cargado',
    body: `Se detectaron ${count} comida${count === 1 ? '' : 's'} en el PDF.`,
  };
}

function isValidHHMM(str) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(str || ''));
}

function toDateForTimePicker(hhmm) {
  const d = new Date();
  d.setSeconds(0, 0);
  if (isValidHHMM(hhmm)) {
    const [hh, mm] = hhmm.split(':').map(Number);
    d.setHours(hh, mm, 0, 0);
  }
  return d;
}

function formatHHMMFromDate(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function MealPlanScreen({ onNavigate }) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState(null);
  const [meals, setMeals] = useState([]);
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [schedulingMeals, setSchedulingMeals] = useState(false);
  const [schedulingDiabetes, setSchedulingDiabetes] = useState(false);
  const [mealTimes, setMealTimes] = useState(DEFAULT_MEAL_TIMES);
  const [showMealTimesModal, setShowMealTimesModal] = useState(false);
  const [mealTimesDraft, setMealTimesDraft] = useState(DEFAULT_MEAL_TIMES);
  const [reminderSettings, setReminderSettings] = useState(DEFAULT_REMINDER_SETTINGS);
  const [reminderSettingsDraft, setReminderSettingsDraft] = useState(DEFAULT_REMINDER_SETTINGS);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMealKey, setTimePickerMealKey] = useState('breakfast');
  const [timePickerValue, setTimePickerValue] = useState(() => toDateForTimePicker(DEFAULT_MEAL_TIMES.breakfast));
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMeal, setSelectedMeal] = useState(null);

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const mealTypes = ['Desayuno', 'Comida', 'Cena'];

  useEffect(() => {
    loadMealPlan();
    loadFoodLogs();
  }, [selectedDate]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const accountId = await getActiveAccountId();
        const pendingRaw = await AsyncStorage.getItem(PENDING_MEAL_SETTINGS_KEY);
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw);
          if (!pending.accountId || String(pending.accountId) === String(accountId)) {
            await api.put('/settings', pending.payload);
            await AsyncStorage.removeItem(PENDING_MEAL_SETTINGS_KEY);
          }
        }
      } catch (_) {}
      const accountId = await getActiveAccountId();
      const saved = await loadMealTimes(accountId);
      const savedReminderSettings = await loadReminderSettings(accountId);
      if (!isMounted) return;
      setMealTimes(saved);
      setMealTimesDraft(saved);
      setReminderSettings(savedReminderSettings);
      setReminderSettingsDraft(savedReminderSettings);
      setTimePickerValue(toDateForTimePicker(saved.breakfast));

    // Best-effort: sync from server (so settings survive reinstall / other devices)
    try {
      const res = await api.get('/settings');
      const serverMealTimes = res?.data?.meal_times;
      const serverReminderSettings = res?.data?.reminder_settings;
      if (serverMealTimes && typeof serverMealTimes === 'object') {
        const normalized = normalizeMealTimes(serverMealTimes);
        await saveMealTimes(normalized, accountId);
        if (!isMounted) return;
        setMealTimes(normalized);
        setMealTimesDraft(normalized);
        setTimePickerValue(toDateForTimePicker(normalized.breakfast));
      }
      if (serverReminderSettings && typeof serverReminderSettings === 'object') {
        const normalizedRS = normalizeReminderSettings(serverReminderSettings);
        await saveReminderSettings(normalizedRS, accountId);
        if (!isMounted) return;
        setReminderSettings(normalizedRS);
        setReminderSettingsDraft(normalizedRS);
      }
    } catch (_) {
      // ignore (offline / no session)
    }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const programarRecordatoriosComidas = async () => {
    if (schedulingMeals) return;
    setSchedulingMeals(true);
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos requeridos', 'Activa las notificaciones en Ajustes para recibir recordatorios.');
        return;
      }

      // Cancel only previous meal reminders (do not cancel all app notifications)
      try {
        const prevRaw = await AsyncStorage.getItem(MEAL_REMINDER_IDS_KEY);
        const prevIds = JSON.parse(prevRaw || '[]');
        if (Array.isArray(prevIds)) {
          await Promise.all(prevIds.map((id) => Notifications.cancelScheduledNotificationAsync(String(id)).catch(() => null)));
        }
      } catch (_) {
        // ignore
      }

      const newIds = [];
      const normalizedTimes = normalizeMealTimes(mealTimes);
      const mealsToSchedule = [
        { key: 'breakfast', label: 'Desayuno', time: normalizedTimes.breakfast },
        { key: 'lunch', label: 'Comida', time: normalizedTimes.lunch },
        { key: 'dinner', label: 'Cena', time: normalizedTimes.dinner },
      ];

      for (const meal of mealsToSchedule) {
        const [hour, minute] = String(meal.time).split(':').map(Number);
        if (isNaN(hour) || isNaN(minute)) continue;
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `🍽️ Hora de ${meal.label}`,
            body: `Es momento de ${meal.label.toLowerCase()}.`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
          },
        });
        newIds.push(id);
      }

      try {
        await AsyncStorage.setItem(MEAL_REMINDER_IDS_KEY, JSON.stringify(newIds));
      } catch (_) {
        // ignore
      }

      Alert.alert('✅ Listo', 'Recordatorios de comidas programados.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudieron programar los recordatorios');
    } finally {
      setSchedulingMeals(false);
    }
  };

  function openMealTimePicker(mealKey) {
    setTimePickerMealKey(mealKey);
    setTimePickerValue(toDateForTimePicker(mealTimesDraft[mealKey]));
    setShowTimePicker(true);
  }

  function onMealTimePicked(event, selected) {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (event?.type === 'dismissed') return;
    if (!selected) return;

    const nextValue = formatHHMMFromDate(selected);
    setMealTimesDraft((prev) => ({ ...prev, [timePickerMealKey]: nextValue }));
    setTimePickerValue(selected);
  }

  function setDraftSetting(key, value) {
    setReminderSettingsDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function saveMealTimesFromModal() {
    const accountId = await getActiveAccountId();
    const saved = await saveMealTimes(mealTimesDraft, accountId);
    const savedRS = await saveReminderSettings(reminderSettingsDraft, accountId);
    setMealTimes(saved);
    setMealTimesDraft(saved);
    setReminderSettings(savedRS);
    setReminderSettingsDraft(savedRS);
    setShowMealTimesModal(false);

    let synced = false;
    try {
      const current = await api.get('/settings');
      const enableReminders = !!current?.data?.enable_reminders;
      const payload = {
        meal_times: saved,
        reminder_settings: savedRS,
        enable_reminders: enableReminders,
      };
      await api.put('/settings', payload);
      await AsyncStorage.removeItem(PENDING_MEAL_SETTINGS_KEY);
      synced = true;
    } catch (_) {
      const accountId = await getActiveAccountId();
      await AsyncStorage.setItem(PENDING_MEAL_SETTINGS_KEY, JSON.stringify({
        accountId,
        payload: {
          meal_times: saved,
          reminder_settings: savedRS,
        },
      }));
    }
    Alert.alert(
      synced ? '✅ Guardado' : 'Guardado en el dispositivo',
      synced
        ? 'Los horarios se guardaron y sincronizaron.'
        : 'Sin conexión. Se sincronizarán automáticamente al volver la conexión.',
    );
  }

  async function saveAndScheduleDiabetesFromModal() {
    if (schedulingDiabetes) return;
    setSchedulingDiabetes(true);
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos requeridos', 'Activa las notificaciones en Ajustes para recibir recordatorios.' );
        return;
      }

      const accountId = await getActiveAccountId();
      const savedTimes = await saveMealTimes(mealTimesDraft, accountId);
      const savedRS = await saveReminderSettings(reminderSettingsDraft, accountId);
      setMealTimes(savedTimes);
      setMealTimesDraft(savedTimes);
      setReminderSettings(savedRS);
      setReminderSettingsDraft(savedRS);

      let settingsSynced = false;
      try {
        const current = await api.get('/settings');
        const enableReminders = !!current?.data?.enable_reminders;
        await api.put('/settings', {
          meal_times: savedTimes,
          reminder_settings: savedRS,
          enable_reminders: enableReminders,
        });
        settingsSynced = true;
        await AsyncStorage.removeItem(PENDING_MEAL_SETTINGS_KEY);
      } catch (_) {
        const accountId = await getActiveAccountId();
        await AsyncStorage.setItem(PENDING_MEAL_SETTINGS_KEY, JSON.stringify({
          accountId,
          payload: {
            meal_times: savedTimes,
            reminder_settings: savedRS,
          },
        }));
      }

      const ok = await setupDiabetesNotifications({
        mealTimes: savedTimes,
        enableGlucoseReminders: true,
        enableActivityReminders: true,
        preMealMinutesBefore: savedRS.diabetesPreMealMinutesBefore,
        glucoseHoursAfter: savedRS.diabetesGlucoseHoursAfter,
        activityMinutesAfter: savedRS.diabetesActivityMinutesAfter,
      });

      if (ok) {
        Alert.alert(
          '✅ Listo',
          settingsSynced
            ? 'Horarios y notificaciones de diabetes guardados.'
            : 'Notificaciones programadas. Los horarios quedaron pendientes de sincronizar.',
        );
        setShowMealTimesModal(false);
      } else {
        Alert.alert('Error', 'No se pudieron programar las notificaciones de diabetes.');
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudieron programar las notificaciones');
    } finally {
      setSchedulingDiabetes(false);
    }
  }

  const handleUploadPlanPdf = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const asset = Array.isArray(result.assets) ? result.assets[0] : null;
      if (!asset?.uri) {
        Alert.alert('Error', 'No se pudo leer el archivo seleccionado.');
        return;
      }

      const formData = new FormData();
      formData.append('pdf', {
        uri: asset.uri,
        name: asset.name || 'plan.pdf',
        type: asset.mimeType || 'application/pdf',
      });

      const response = await api.post('/meal-plan/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const mealsCount = Number(response?.data?.meals_count || 0);
      const uploadMessage = buildMealUploadMessage(mealsCount);
      Alert.alert(uploadMessage.title, uploadMessage.body);
      setLoading(true);
      await loadMealPlan();
    } catch (error) {
      const msg = error?.response?.data?.error || error?.message || 'No se pudo subir el PDF.';
      Alert.alert('Error', msg);
    } finally {
      setUploading(false);
    }
  };

  const loadMealPlan = async () => {
    const accountId = await getActiveAccountId();
    const cacheKey = accountId
      ? `bienestar_meal_plan_v1:${String(accountId)}`
      : 'bienestar_meal_plan_v1';
    try {
      const response = await api.get('/meal-plan');
      const data = response.data || {};
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      setPlan(data.plan ?? null);
      setMeals(Array.isArray(data.meals) ? data.meals : []);
    } catch (error) {
      if (error.response?.status === 404) {
        setPlan(null);
        setMeals([]);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw);
          setPlan(cached?.plan ?? null);
          setMeals(Array.isArray(cached?.meals) ? cached.meals : []);
        }
      } catch (_) {}
      console.error('Error loading meal plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFoodLogs = async () => {
    try {
      const selected = new Date(selectedDate);
      const selectedDayIndex = (selected.getDay() + 6) % 7;

      const weekDates = days.map((_, index) => {
        const diff = index - selectedDayIndex;
        const date = new Date(selected);
        date.setDate(selected.getDate() + diff);
        return date.toISOString().split('T')[0];
      });

      const logsMap = {};
      const promises = weekDates.map(date =>
        api.get(`/food-log?date=${date}`)
          .then(response => {
            if (Array.isArray(response.data)) {
              response.data.forEach(log => {
                logsMap[`${log.date}_${log.meal_type}`] = log;
              });
            }
          })
          .catch(error => console.error('Error loading logs:', error))
      );

      await Promise.all(promises);
      setLogs(logsMap);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const toggleMealCompletionForDay = async (day, mealType) => {
    const dateForDay = getDateForDay(day);
    const logKey = `${dateForDay}_${mealType}`;
    const currentLog = logs[logKey];
    const newCompleted = !currentLog?.completed;

    try {
      await api.post('/food-log', {
        date: dateForDay,
        meal_type: mealType,
        completed: newCompleted,
        notes: currentLog?.notes || ''
      });

      loadFoodLogs();
    } catch (error) {
      console.error('Error logging food:', error);
      Alert.alert('Error', 'No se pudo guardar el registro');
    }
  };

  const getMealForDayAndType = (day, type) => {
    return findMealForDayAndType(meals, day, type);
  };

  const getDateForDay = (dayName) => {
    const dayIndex = days.indexOf(dayName);
    const selected = new Date(selectedDate);
    const selectedDayIndex = (selected.getDay() + 6) % 7;
    const diff = dayIndex - selectedDayIndex;
    const targetDate = new Date(selected);
    targetDate.setDate(selected.getDate() + diff);
    return targetDate.toISOString().split('T')[0];
  };

  const isCompletedForDay = (day, mealType) => {
    const dateForDay = getDateForDay(day);
    const logKey = `${dateForDay}_${mealType}`;
    return logs[logKey]?.completed || false;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🍽️ Plan de Comidas</Text>
          <View style={{ width: 60 }} />
        </View>
        <ActivityIndicator size="large" color="#3498db" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🍽️ Mi Plan</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={programarRecordatoriosComidas}
            style={[styles.reminderBtn, schedulingMeals && styles.uploadBtnDisabled]}
            disabled={schedulingMeals}
          >
            <Text style={styles.reminderBtnText}>{schedulingMeals ? '…' : '🔔'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setMealTimesDraft(mealTimes);
              setReminderSettingsDraft(reminderSettings);
              setShowMealTimesModal(true);
            }}
            style={styles.reminderBtn}
            accessibilityLabel="Editar horarios de comidas"
          >
            <Text style={styles.reminderBtnText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleUploadPlanPdf}
            style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
            disabled={uploading}
          >
            <Text style={styles.uploadBtnText}>{uploading ? 'Subiendo…' : 'Subir PDF'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showMealTimesModal && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMealTimesModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowMealTimesModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Horarios de comidas</Text>
              <TouchableOpacity onPress={saveMealTimesFromModal}>
                <Text style={styles.modalSaveBtn}>Guardar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.section}>
                <TouchableOpacity style={styles.timeRow} onPress={() => openMealTimePicker('breakfast')}>
                  <Text style={styles.timeRowLabel}>Desayuno</Text>
                  <Text style={styles.timeRowValue}>{mealTimesDraft.breakfast}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.timeRow} onPress={() => openMealTimePicker('lunch')}>
                  <Text style={styles.timeRowLabel}>Comida</Text>
                  <Text style={styles.timeRowValue}>{mealTimesDraft.lunch}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.timeRow} onPress={() => openMealTimePicker('dinner')}>
                  <Text style={styles.timeRowLabel}>Cena</Text>
                  <Text style={styles.timeRowValue}>{mealTimesDraft.dinner}</Text>
                </TouchableOpacity>

                <Text style={styles.timeHint}>
                  Estos horarios se usan para recordatorios (🔔) y para “ligada a comida” en Medicinas.
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.settingsSectionTitle}>Diabetes</Text>

                <Text style={styles.settingsRowLabel}>Medicina antes de comidas (min)</Text>
                <View style={styles.pillRow}>
                  {[5, 10, 15, 20, 30, 45, 60].map((v) => (
                    <TouchableOpacity
                      key={`pre-${v}`}
                      onPress={() => setDraftSetting('diabetesPreMealMinutesBefore', v)}
                      style={[styles.pill, reminderSettingsDraft.diabetesPreMealMinutesBefore === v && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, reminderSettingsDraft.diabetesPreMealMinutesBefore === v && styles.pillTextActive]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.settingsRowLabel}>Glucosa después de comer (horas)</Text>
                <View style={styles.pillRow}>
                  {[1, 2, 3].map((v) => (
                    <TouchableOpacity
                      key={`glu-${v}`}
                      onPress={() => setDraftSetting('diabetesGlucoseHoursAfter', v)}
                      style={[styles.pill, reminderSettingsDraft.diabetesGlucoseHoursAfter === v && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, reminderSettingsDraft.diabetesGlucoseHoursAfter === v && styles.pillTextActive]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.settingsRowLabel}>Actividad después de comer (min)</Text>
                <View style={styles.pillRow}>
                  {[0, 10, 15, 30, 45, 60].map((v) => (
                    <TouchableOpacity
                      key={`act-${v}`}
                      onPress={() => setDraftSetting('diabetesActivityMinutesAfter', v)}
                      style={[styles.pill, reminderSettingsDraft.diabetesActivityMinutesAfter === v && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, reminderSettingsDraft.diabetesActivityMinutesAfter === v && styles.pillTextActive]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.timeHint}>
                  Estos valores se usarán al programar notificaciones de diabetes.
                </Text>

                <TouchableOpacity
                  onPress={saveAndScheduleDiabetesFromModal}
                  style={[styles.primaryActionBtn, schedulingDiabetes && styles.uploadBtnDisabled]}
                  disabled={schedulingDiabetes}
                >
                  <Text style={styles.primaryActionBtnText}>
                    {schedulingDiabetes ? 'Programando…' : 'Programar notificaciones de diabetes'}
                  </Text>
                </TouchableOpacity>
              </View>

              {showTimePicker && (
                <View style={styles.timePickerWrap}>
                  <DateTimePicker
                    value={timePickerValue}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onMealTimePicked}
                  />
                </View>
              )}

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  onPress={() => setShowTimePicker(false)}
                  style={styles.doneBtn}
                >
                  <Text style={styles.doneBtnText}>Listo</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {plan ? (
        <ScrollView style={styles.content}>
          <View style={styles.planInfo}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planDate}>Desde: {plan.start_date}</Text>
          </View>
          {!meals.length && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>El plan existe, pero no contiene comidas visibles</Text>
              <Text style={styles.emptySubtext}>Actualiza o vuelve a subir el PDF para reconstruir el plan.</Text>
              <TouchableOpacity
                onPress={handleUploadPlanPdf}
                style={[styles.uploadBtnLarge, uploading && styles.uploadBtnDisabled]}
                disabled={uploading}
              >
                <Text style={styles.uploadBtnLargeText}>
                  {uploading ? 'Subiendo…' : 'Actualizar Plan PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.weeklyGrid}>
              {days.map(day => (
                <View key={day} style={styles.dayColumn}>
                  <Text style={styles.dayHeader}>{day}</Text>
                  {mealTypes.map(type => {
                    const meal = getMealForDayAndType(day, type);
                    const completed = isCompletedForDay(day, type);

                    return (
                      <View
                        key={`${day}-${type}`}
                        style={[styles.mealCard, completed && styles.mealCardCompleted]}
                      >
                        <View style={styles.mealCardHeader}>
                          <Text style={styles.mealType}>{type}</Text>
                          <TouchableOpacity
                            onPress={() => toggleMealCompletionForDay(day, type)}
                          >
                            <Text style={styles.checkbox}>
                              {completed ? '✓' : '○'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {meal ? (
                          <TouchableOpacity
                            style={styles.mealContent}
                            onPress={() => setSelectedMeal(meal)}
                          >
                            <Text style={styles.mealName}>{meal.name}</Text>
                            <Text style={styles.viewRecipeBtn}>Ver receta</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.noMeal}>-</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          {plan.snacks && (
            <View style={styles.snacksSection}>
              <Text style={styles.snacksTitle}>🍌 Snacks</Text>
              <Text style={styles.snacksText}>{plan.snacks}</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No hay plan de comidas</Text>
          <Text style={styles.emptySubtext}>Sube tu plan PDF o contacta a tu nutricionista</Text>
          <TouchableOpacity
            onPress={handleUploadPlanPdf}
            style={[styles.uploadBtnLarge, uploading && styles.uploadBtnDisabled]}
            disabled={uploading}
          >
            <Text style={styles.uploadBtnLargeText}>{uploading ? 'Subiendo…' : 'Subir Plan PDF'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedMeal && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedMeal(null)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedMeal(null)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalTitle}>{selectedMeal.name}</Text>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🛒 Ingredientes</Text>
                <Text style={styles.recipeText}>{selectedMeal.ingredients}</Text>
              </View>

              {selectedMeal.preparation && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>👨‍🍳 Preparación</Text>
                  <Text style={styles.recipeText}>{selectedMeal.preparation}</Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  backBtn: {
    padding: 5,
  },
  backBtnText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  modalSaveBtn: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  timeRowLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  timeRowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  timeHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  settingsSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    color: '#111827',
  },
  settingsRowLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginTop: 6,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },
  pillTextActive: {
    color: '#fff',
  },
  primaryActionBtn: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#3498db',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  timePickerWrap: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  doneBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#3498db',
    borderRadius: 10,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  uploadBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#3498db',
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnDisabled: {
    opacity: 0.6,
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 15,
  },
  planInfo: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  planDate: {
    fontSize: 14,
    color: '#666',
  },
  weeklyGrid: {
    flexDirection: 'row',
  },
  dayColumn: {
    marginRight: 10,
    alignItems: 'center',
  },
  dayHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    width: 70,
    textAlign: 'center',
  },
  mealCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    width: 70,
  },
  mealCardCompleted: {
    backgroundColor: '#e8f8f5',
    borderColor: '#27ae60',
  },
  mealCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mealType: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },
  checkbox: {
    fontSize: 16,
    color: '#27ae60',
  },
  mealContent: {
    alignItems: 'center',
  },
  mealName: {
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  viewRecipeBtn: {
    fontSize: 10,
    color: '#3498db',
    fontWeight: '600',
  },
  noMeal: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  snacksSection: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  snacksTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  snacksText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
  },
  uploadBtnLarge: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#3498db',
    borderRadius: 10,
  },
  uploadBtnLargeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  closeBtn: {
    fontSize: 28,
    color: '#999',
  },
  modalContent: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  recipeText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
