import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getToken } from './src/auth';
import { DEFAULT_MEAL_TIMES, loadMealTimes, normalizeMealTimes } from './src/mealTimes';
import { DEFAULT_REMINDER_SETTINGS, loadReminderSettings, saveReminderSettings } from './src/reminderSettings';
import api from './src/api';
import { scheduleNextMedicineReminder, openReminder } from './src/reminderAlarm';

const BACKEND_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://health-nutrition-control.onrender.com').replace(/\/api$/, '');
const API_BASE = `${BACKEND_URL}/api`;
const MEDICINES_CACHE_PREFIX = 'bienestar_medicines_v1:';
const USER_ID_CACHE_KEY = 'bienestar_user_id';
const MEDICINE_NOTIF_IDS_KEY = 'bienestar_medicine_notif_ids_v1';

function formatHHMMFromMinutes(totalMinutes) {
  const clamped = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function MedicinesScreen({ onBack }) {
  const [medicinas, setMedicinas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [historyRangeDays, setHistoryRangeDays] = useState(7);
  const [nuevaMedicina, setNuevaMedicina] = useState('');
  const [horaMedicina, setHoraMedicina] = useState('');

  const [horaModo, setHoraModo] = useState('fixed'); // 'fixed' | 'relative'
  const [comidaRef, setComidaRef] = useState('breakfast'); // breakfast | lunch | dinner
  const [cuandoRef, setCuandoRef] = useState('before'); // before | after
  const [mealTimes, setMealTimes] = useState(DEFAULT_MEAL_TIMES);
  const [mealOffsetMinutes, setMealOffsetMinutes] = useState(DEFAULT_REMINDER_SETTINGS.medicineMealOffsetMinutes);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerValue, setTimePickerValue] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  });

  const [loading, setLoading] = useState(false);

  function computeRelativeTime(mealKey, whenKey) {
    const normalized = normalizeMealTimes(mealTimes);
    const baseStr = normalized[mealKey] || normalized.breakfast;
    const [hh, mm] = String(baseStr).split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return '08:00';
    const base = (hh * 60) + mm;
    const safeOffset = Number.isFinite(Number(mealOffsetMinutes)) ? Math.max(1, Math.min(180, Math.trunc(Number(mealOffsetMinutes)))) : 30;
    const delta = whenKey === 'after' ? safeOffset : -safeOffset;
    return formatHHMMFromMinutes(base + delta);
  }

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const saved = await loadMealTimes();
      if (!isMounted) return;
      setMealTimes(saved);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const settings = await loadReminderSettings();
      if (!isMounted) return;
      setMealOffsetMinutes(settings.medicineMealOffsetMinutes);

      // Best-effort: sync from server settings
      try {
        const res = await api.get('/settings');
        const rs = res?.data?.reminder_settings;
        const serverOffset = rs?.medicineMealOffsetMinutes;
        const parsed = Math.trunc(Number(serverOffset));
        if (Number.isFinite(parsed)) {
          const clamped = Math.max(1, Math.min(180, parsed));
          await saveReminderSettings({ ...settings, medicineMealOffsetMinutes: clamped });
          if (!isMounted) return;
          setMealOffsetMinutes(clamped);
        }
      } catch (_) {
        // ignore (offline / no session)
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  async function updateMealOffsetMinutes(nextMinutes) {
    const parsed = Math.trunc(Number(nextMinutes));
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(1, Math.min(180, parsed));
    setMealOffsetMinutes(clamped);
    const current = await loadReminderSettings();
    const saved = await saveReminderSettings({ ...current, medicineMealOffsetMinutes: clamped });

    // Best-effort: persist to server, preserving other fields
    try {
      const remote = await api.get('/settings');
      const enableReminders = !!remote?.data?.enable_reminders;
      const mealTimesRemoteRaw = remote?.data?.meal_times;
      const mealTimesToSend = (mealTimesRemoteRaw && typeof mealTimesRemoteRaw === 'object') ? mealTimesRemoteRaw : mealTimes;
      const reminderSettingsRemoteRaw = remote?.data?.reminder_settings;
      const reminderSettingsRemote = (reminderSettingsRemoteRaw && typeof reminderSettingsRemoteRaw === 'object') ? reminderSettingsRemoteRaw : {};

      await api.put('/settings', {
        meal_times: normalizeMealTimes(mealTimesToSend),
        reminder_settings: { ...reminderSettingsRemote, medicineMealOffsetMinutes: saved.medicineMealOffsetMinutes },
        enable_reminders: enableReminders,
      });
    } catch (_) {
      // ignore
    }
  }

  async function getUserIdForCache(token) {
    try {
      const cached = await AsyncStorage.getItem(USER_ID_CACHE_KEY);
      if (cached) return cached;
    } catch (_) {
      // ignore
    }

    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      const userId = data?.user_id ?? data?.id;
      if (userId != null) {
        const asString = String(userId);
        try {
          await AsyncStorage.setItem(USER_ID_CACHE_KEY, asString);
        } catch (_) {
          // ignore
        }
        return asString;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  async function getMedicinesCacheKey(token) {
    const userId = await getUserIdForCache(token);
    return `${MEDICINES_CACHE_PREFIX}${userId || 'default'}`;
  }

  async function loadMedicinesFromCache(token) {
    try {
      const key = await getMedicinesCacheKey(token);
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch (_) {
      return null;
    }
  }

  async function saveMedicinesToCache(token, meds) {
    try {
      const key = await getMedicinesCacheKey(token);
      await AsyncStorage.setItem(key, JSON.stringify(Array.isArray(meds) ? meds : []));
    } catch (_) {
      // ignore
    }
  }
  const fetchHistorial = (token) => {
    return fetch(`${API_BASE}/medicines/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Error ${res.status} al consultar historial`);
        }
        return res.json();
      })
      .then(data => setHistorial(Array.isArray(data) ? data : []))
      .catch(() => setHistorial([]));
  };

  const fetchMedicinas = async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) {
      Alert.alert('Sesión', 'No se encontró sesión activa. Vuelve a iniciar sesión.');
      onBack && onBack();
      setLoading(false);
      return;
    }

    // Load cached meds first for a stable UX (and to survive backend resets)
    const cached = await loadMedicinesFromCache(token);
    if (Array.isArray(cached) && cached.length > 0) {
      setMedicinas(cached);
    }

    try {
      const res = await fetch(`${API_BASE}/medicines`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 401) {
        alert('Sesión expirada. Por favor inicia sesión de nuevo.');
        onBack && onBack();
        return;
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${res.status} al consultar medicinas`);
      }

      const data = await res.json().catch(() => []);
      const serverMeds = Array.isArray(data) ? data : [];

      // If server returns empty but we have cache, prefer cache to avoid "losing" items after a server reset.
      if (serverMeds.length === 0 && Array.isArray(cached) && cached.length > 0) {
        setMedicinas(cached);
      } else {
        setMedicinas(serverMeds);
        await saveMedicinesToCache(token, serverMeds);
      }

      await fetchHistorial(token);
    } catch (err) {
      // Keep whatever we have (prefer cache) instead of clearing
      if (!(Array.isArray(cached) && cached.length > 0)) {
        setMedicinas([]);
      }
      Alert.alert('Error', err?.message || 'No se pudieron cargar las medicinas');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void fetchMedicinas();
  }, []);

  const historialFiltrado = historial.filter((h) => {
    if (historyRangeDays === 0) return true;
    const takenAt = new Date(h.taken_at);
    if (isNaN(takenAt.getTime())) return false;
    const diffMs = Date.now() - takenAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= historyRangeDays;
  });

  function isValidTime(str) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(str);
  }

  function formatTimeFromDate(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function parseTimeToDate(str) {
    const d = new Date();
    d.setSeconds(0, 0);
    if (isValidTime(str)) {
      const [hh, mm] = str.split(':').map(Number);
      d.setHours(hh, mm, 0, 0);
    }
    return d;
  }

  function openTimePicker() {
    if (horaModo !== 'fixed') return;
    const base = parseTimeToDate(horaMedicina);
    setTimePickerValue(base);
    setShowTimePicker(true);
  }

  function onTimePickerChange(event, selected) {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (event?.type === 'dismissed') return;
    if (!selected) return;
    setTimePickerValue(selected);
    setHoraMedicina(formatTimeFromDate(selected));
  }

  useEffect(() => {
    if (horaModo !== 'relative') return;
    const computed = computeRelativeTime(comidaRef, cuandoRef);
    setHoraMedicina(computed);
    setTimePickerValue(parseTimeToDate(computed));
  }, [horaModo, comidaRef, cuandoRef, mealTimes, mealOffsetMinutes]);

  function agregarMedicina() {
    if (!nuevaMedicina || !horaMedicina) return alert('Completa nombre y hora');
    if (!isValidTime(horaMedicina)) return alert('Hora inválida. Usa formato HH:MM');
    setLoading(true);
    getToken().then(token => {
      if (!token) {
        Alert.alert('Sesión', 'No se encontró sesión activa. Vuelve a iniciar sesión.');
        onBack && onBack();
        setLoading(false);
        return;
      }

      fetch(`${API_BASE}/medicines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: nuevaMedicina, time: horaMedicina })
      })
        .then(async res => {
          if (res.status === 401) {
            alert('Sesión expirada. Por favor inicia sesión de nuevo.');
            onBack && onBack();
            return;
          }
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `Error ${res.status} al agregar medicina`);
          }
          setNuevaMedicina('');
          setHoraMedicina('');
          Alert.alert('✅ Éxito', 'Medicina agregada correctamente.');
          fetchMedicinas();
        })
        .catch((err) => Alert.alert('Error', err?.message || 'Error al agregar medicina'))
        .finally(() => setLoading(false));
    });
  }

  function marcarTomada(idx) {
    const med = medicinas[idx];
    setLoading(true);
    getToken().then(token => {
      if (!token) {
        Alert.alert('Sesión', 'No se encontró sesión activa. Vuelve a iniciar sesión.');
        onBack && onBack();
        setLoading(false);
        return;
      }

      fetch(`${API_BASE}/medicines/${med.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...med, taken: true })
      })
        .then(async res => {
          if (res.status === 401) {
            alert('Sesión expirada. Por favor inicia sesión de nuevo.');
            onBack && onBack();
            return;
          }
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `Error ${res.status} al confirmar medicina`);
          }
          fetchMedicinas();
        })
        .catch((err) => Alert.alert('Error', err?.message || 'Error al confirmar medicina'))
        .finally(() => setLoading(false));
    });
  }

  async function programarNotificacionesMedicinas() {
    if (medicinas.length === 0) {
      Alert.alert('Sin medicinas', 'Agrega al menos una medicina antes de programar notificaciones.');
      return;
    }
    setLoading(true);
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos requeridos', 'Activa las notificaciones en Ajustes para usar este recordatorio.');
        return;
      }

      // Cancel only previous medicine reminders (do not cancel meal reminders or other app notifications)
      try {
        const prevRaw = await AsyncStorage.getItem(MEDICINE_NOTIF_IDS_KEY);
        const prevIds = JSON.parse(prevRaw || '[]');
        if (Array.isArray(prevIds)) {
          await Promise.all(prevIds.map((id) => Notifications.cancelScheduledNotificationAsync(String(id)).catch(() => null)));
        }
      } catch (_) {
        // ignore
      }

      const newIds = [];
      let programadas = 0;
      for (const med of medicinas) {
        const [hora, minuto] = (med.time || '').split(':').map(Number);
        if (isNaN(hora) || isNaN(minuto)) continue;
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `💊 Recordatorio: ${med.name}`,
            body: '¿Ya tomaste tu medicina? Confirma en la app.',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: hora,
            minute: minuto,
            ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
          },
        });
        newIds.push(id);
        programadas++;
      }

      try {
        await AsyncStorage.setItem(MEDICINE_NOTIF_IDS_KEY, JSON.stringify(newIds));
      } catch (_) {
        // ignore
      }

      Alert.alert('✅ Listo', `${programadas} notificacion${programadas !== 1 ? 'es' : ''} de medicina programada${programadas !== 1 ? 's' : ''} diariamente.`);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron programar las notificaciones: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function programarAlarmaPersistente(medicine) {
    setLoading(true);
    try { await scheduleNextMedicineReminder(medicine); }
    catch (e) { Alert.alert('Recordatorio', e.message); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Medicinas</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Nombre de medicina"
          value={nuevaMedicina}
          onChangeText={setNuevaMedicina}
        />
        <TouchableOpacity
          style={styles.timeInput}
          onPress={openTimePicker}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Seleccionar hora"
        >
          <Text style={[styles.timeInputText, !horaMedicina && styles.timeInputPlaceholder]}>
            {horaMedicina || 'HH:MM'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={agregarMedicina} disabled={loading}>
          <Text style={styles.addBtnText}>Agregar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.linkRow}>
        <TouchableOpacity
          style={[styles.linkBtn, horaModo === 'fixed' && styles.linkBtnActive]}
          onPress={() => setHoraModo('fixed')}
          disabled={loading}
        >
          <Text style={[styles.linkBtnText, horaModo === 'fixed' && styles.linkBtnTextActive]}>Hora fija</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.linkBtn, horaModo === 'relative' && styles.linkBtnActive]}
          onPress={() => setHoraModo('relative')}
          disabled={loading}
        >
          <Text style={[styles.linkBtnText, horaModo === 'relative' && styles.linkBtnTextActive]}>Ligada a comida</Text>
        </TouchableOpacity>
      </View>

      {horaModo === 'relative' ? (
        <View style={styles.relativeBox}>
          <View style={styles.relativeRow}>
            <Text style={styles.relativeLabel}>Tomar:</Text>
            <TouchableOpacity
              style={[styles.relativePill, cuandoRef === 'before' && styles.relativePillActive]}
              onPress={() => setCuandoRef('before')}
              disabled={loading}
            >
              <Text style={[styles.relativePillText, cuandoRef === 'before' && styles.relativePillTextActive]}>{mealOffsetMinutes} min antes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.relativePill, cuandoRef === 'after' && styles.relativePillActive]}
              onPress={() => setCuandoRef('after')}
              disabled={loading}
            >
              <Text style={[styles.relativePillText, cuandoRef === 'after' && styles.relativePillTextActive]}>{mealOffsetMinutes} min después</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.relativeRow}>
            <Text style={styles.relativeLabel}>Min:</Text>
            {[10, 15, 20, 30, 45, 60].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.relativePill, mealOffsetMinutes === m && styles.relativePillActive]}
                onPress={() => updateMealOffsetMinutes(m)}
                disabled={loading}
              >
                <Text style={[styles.relativePillText, mealOffsetMinutes === m && styles.relativePillTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.relativeRow}>
            <Text style={styles.relativeLabel}>De:</Text>
            <TouchableOpacity
              style={[styles.relativePill, comidaRef === 'breakfast' && styles.relativePillActive]}
              onPress={() => setComidaRef('breakfast')}
              disabled={loading}
            >
              <Text style={[styles.relativePillText, comidaRef === 'breakfast' && styles.relativePillTextActive]}>Desayuno</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.relativePill, comidaRef === 'lunch' && styles.relativePillActive]}
              onPress={() => setComidaRef('lunch')}
              disabled={loading}
            >
              <Text style={[styles.relativePillText, comidaRef === 'lunch' && styles.relativePillTextActive]}>Comida</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.relativePill, comidaRef === 'dinner' && styles.relativePillActive]}
              onPress={() => setComidaRef('dinner')}
              disabled={loading}
            >
              <Text style={[styles.relativePillText, comidaRef === 'dinner' && styles.relativePillTextActive]}>Cena</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.relativeHint}>Se guardará la hora calculada: {horaMedicina || '—'}</Text>
        </View>
      ) : null}

      {showTimePicker ? (
        <View style={styles.timePickerBox}>
          <DateTimePicker
            value={timePickerValue}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimePickerChange}
          />
          {Platform.OS === 'ios' ? (
            <TouchableOpacity style={styles.timePickerDoneBtn} onPress={() => setShowTimePicker(false)}>
              <Text style={styles.timePickerDoneText}>Listo</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={medicinas}
          keyExtractor={(_, i) => i.toString()}
          style={{ flex: 1 }}
          ListEmptyComponent={<Text style={styles.empty}>No hay medicinas registradas</Text>}
          ListFooterComponent={
            historialFiltrado.length > 0 ? (
              <View style={styles.historyBox}>
                <Text style={styles.historyTitle}>Historial reciente</Text>
                <View style={styles.historyFilterRow}>
                  <TouchableOpacity
                    style={[styles.historyFilterBtn, historyRangeDays === 7 && styles.historyFilterBtnActive]}
                    onPress={() => setHistoryRangeDays(7)}
                  >
                    <Text style={[styles.historyFilterText, historyRangeDays === 7 && styles.historyFilterTextActive]}>7 días</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.historyFilterBtn, historyRangeDays === 30 && styles.historyFilterBtnActive]}
                    onPress={() => setHistoryRangeDays(30)}
                  >
                    <Text style={[styles.historyFilterText, historyRangeDays === 30 && styles.historyFilterTextActive]}>30 días</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.historyFilterBtn, historyRangeDays === 0 && styles.historyFilterBtnActive]}
                    onPress={() => setHistoryRangeDays(0)}
                  >
                    <Text style={[styles.historyFilterText, historyRangeDays === 0 && styles.historyFilterTextActive]}>Todo</Text>
                  </TouchableOpacity>
                </View>
                {historialFiltrado.slice(0, 12).map((h) => (
                  <Text key={h.id} style={styles.historyItem}>• {h.name} — {h.taken_date} {new Date(h.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <View style={styles.medicineRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15 }}>💊 {item.name}</Text>
                <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => programarAlarmaPersistente(item)}>
                  <Text style={{ color: '#1d4ed8', paddingVertical: 10 }}>🔔 Alarma persistente: próxima toma</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.timeLabel}>{item.time}</Text>
              <TouchableOpacity
                style={[styles.confirmBtn, item.taken && styles.confirmBtnDone]}
                onPress={() => !item.taken && marcarTomada(index)}
                disabled={item.taken}
              >
                <Text style={styles.confirmBtnText}>{item.taken ? '✓ Tomada' : 'Confirmar'}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => openReminder()}>
          <Text style={styles.backBtnText}>Pendientes / ✓ Hecho</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.notifBtn} onPress={programarNotificacionesMedicinas} disabled={loading}>
          <Text style={styles.notifBtnText}>🔔 Programar notificación diaria</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', margin: 16, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginRight: 8, fontSize: 15 },
  timeInput: { width: 80, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  timeInputText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  timeInputPlaceholder: { color: '#999', fontWeight: '500' },
  timePickerBox: { marginHorizontal: 16, marginBottom: 12, padding: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#f9fafb' },
  timePickerDoneBtn: { alignSelf: 'flex-end', marginTop: 8, backgroundColor: '#e5e7eb', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  timePickerDoneText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  linkRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 10 },
  linkBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999, paddingVertical: 8, alignItems: 'center', backgroundColor: '#fff' },
  linkBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  linkBtnText: { fontSize: 12, color: '#374151', fontWeight: '700' },
  linkBtnTextActive: { color: '#fff' },
  relativeBox: { marginHorizontal: 16, marginBottom: 12, padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#f9fafb' },
  relativeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  relativeLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginRight: 2 },
  relativePill: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#fff' },
  relativePillActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  relativePillText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  relativePillTextActive: { color: '#fff' },
  relativeHint: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
  addBtn: { backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
  medicineRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#f3f4f6', borderRadius: 10, padding: 12 },
  timeLabel: { color: '#6b7280', marginRight: 12, fontSize: 14 },
  confirmBtn: { backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  confirmBtnDone: { backgroundColor: '#d1fae5' },
  confirmBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  historyBox: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  historyTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6 },
  historyFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  historyFilterBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#fff' },
  historyFilterBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  historyFilterText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  historyFilterTextActive: { color: '#fff' },
  historyItem: { fontSize: 13, color: '#4b5563', marginBottom: 2 },
  bottomBar: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24, gap: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  notifBtn: { backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  notifBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  backBtn: { backgroundColor: '#e5e7eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  backBtnText: { color: '#374151', fontWeight: '600', fontSize: 15 },
});
