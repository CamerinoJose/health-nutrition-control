import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Alert, Linking, Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { reminderAlarmsAvailable, reconcileReminders, completeReminder, cancelReminder,
  createReminder, reminderCapabilities, openExactAlarmSettings, subscribeReminderOpen,
  reminderIdFromUrl, isPendingReminder } from './reminderAlarm';

export default function ReminderCenter({ hidden = false }) {
  const [visible, setVisible] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [rows, setRows] = useState([]);
  const [caps, setCaps] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const actionRunning = useRef(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date(Date.now() + 60000));
  const [picker, setPicker] = useState(null);
  const available = reminderAlarmsAvailable();
  const refresh = useCallback(async () => {
    if (!reminderAlarmsAvailable()) return;
    try {
      setRows(await reconcileReminders());
      setCaps(await reminderCapabilities());
      setError('');
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    const show = (id) => { setSelectedId(id); setVisible(true); void refresh(); };
    const stop = subscribeReminderOpen(show);
    const url = ({ url: value }) => { const id = reminderIdFromUrl(value); if (id) show(id); };
    const links = Linking.addEventListener('url', url);
    Linking.getInitialURL().then((value) => value && url({ url: value })).catch(() => {});
    const state = AppState.addEventListener('change', (next) => { if (next === 'active') void refresh(); });
    void refresh();
    // Refreshes UI only. Alarm delivery and repetition never depend on this timer.
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    return () => { stop(); links.remove(); state.remove(); clearInterval(timer); };
  }, [refresh]);

  async function perform(action) {
    if (actionRunning.current) return;
    actionRunning.current = true;
    setBusy(true);
    try { await action(); await refresh(); }
    catch (e) { setError(e.message); }
    finally { actionRunning.current = false; setBusy(false); }
  }
  const pending = rows.filter(isPendingReminder).sort((a, b) =>
    a.id === selectedId ? -1 : b.id === selectedId ? 1 : a.scheduledAt - b.scheduledAt);
  const selected = rows.find((r) => r.id === selectedId);
  if (hidden) return null;
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir recordatorios persistentes"
      style={styles.launcher} onPress={() => { setVisible(true); void refresh(); }}>
      <Text style={styles.white}>🔔 {pending.length || 'Recordatorios'}</Text>
    </TouchableOpacity>
    <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
      <SafeAreaView style={styles.page}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Recordatorios persistentes</Text>
          <Text style={styles.info}>Solo la cuenta iniciada puede verlos o reactivarlos. Se repiten aproximadamente cada 5 minutos hasta confirmar ✓ Hecho. Android puede retrasarlos.</Text>
          <TouchableOpacity style={styles.secondary} onPress={() => setVisible(false)}><Text>Cerrar sin completar</Text></TouchableOpacity>
          {!available && <Text style={styles.error}>Esta función requiere un APK Android nuevo. No funciona en Expo Go, iOS o web.</Text>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {available && <>
            {caps && !caps.notifications && <View style={styles.card}>
              <Text style={styles.error}>Las notificaciones están desactivadas. Los pendientes se conservan.</Text>
              <TouchableOpacity onPress={() => Linking.openSettings().catch(() => setError('Abre Ajustes de Android manualmente.'))}><Text style={styles.link}>Abrir ajustes de notificaciones</Text></TouchableOpacity>
            </View>}
            {caps && !caps.exactAlarms && <View style={styles.card}>
              <Text>Sin permiso de alarmas exactas, las alertas pueden retrasarse más.</Text>
              <TouchableOpacity onPress={() => perform(openExactAlarmSettings)}><Text style={styles.link}>Permitir alarmas y recordatorios</Text></TouchableOpacity>
            </View>}
            {caps && caps.paused && <View style={styles.card}>
              <Text style={styles.error}>Inicia sesión con tu cuenta para crear o ver recordatorios locales.</Text>
            </View>}
            <Text style={styles.heading}>Pendientes ({pending.length})</Text>
            {selected && !isPendingReminder(selected) && <Text>Este recordatorio ya está {selected.status === 'completed' ? 'completado' : 'cancelado'}.</Text>}
            {selectedId && !selected && <Text>No se encontró este recordatorio en el dispositivo.</Text>}
            {!pending.length && <Text>No tienes recordatorios pendientes.</Text>}
            {pending.map((r) => <View key={r.id} style={[styles.card, r.id === selectedId && styles.selected]}>
              <Text style={styles.title}>{r.title}</Text>
              <Text>{r.body}</Text>
              <Text style={styles.info}>{new Date(r.scheduledAt).toLocaleString()} · {r.status === 'active' ? 'Pendiente de confirmar' : 'Programado'}</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.primary} disabled={busy}
                onPress={() => perform(() => completeReminder(r.id))}><Text style={styles.white}>✓ Hecho</Text></TouchableOpacity>
              <TouchableOpacity disabled={busy} style={styles.secondary} onPress={() => Alert.alert('Cancelar recordatorio',
                'Se detendrán las alertas sin marcar la tarea como realizada.', [
                  { text: 'Volver', style: 'cancel' },
                  { text: 'Cancelar recordatorio', onPress: () => perform(() => cancelReminder(r.id)) },
                ])}><Text>Cancelar recordatorio</Text></TouchableOpacity>
            </View>)}
            {!caps?.paused && <>
              <Text style={styles.heading}>Nuevo recordatorio</Text>
              <TextInput accessibilityLabel="Título del recordatorio" placeholder="¿Qué necesitas recordar?" value={title} onChangeText={setTitle} style={styles.input} maxLength={160} />
              <TouchableOpacity style={styles.secondary} onPress={() => setPicker('date')}><Text>Fecha: {date.toLocaleDateString()}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={() => setPicker('time')}><Text>Hora: {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></TouchableOpacity>
              {picker && <DateTimePicker value={date} mode={picker} is24Hour onChange={(event, chosen) => {
                setPicker(null);
                if (event.type !== 'dismissed' && chosen) { chosen.setSeconds(0, 0); setDate(chosen); }
              }} />}
              <TouchableOpacity disabled={busy} style={styles.primary} onPress={() => perform(async () => {
                await createReminder({ sourceId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, title, scheduledAt: date });
                setTitle('');
              })}><Text style={styles.white}>{busy ? 'Guardando…' : 'Programar recordatorio'}</Text></TouchableOpacity>
            </>}
            <Text style={styles.info}>Cerrar esta pantalla o deslizar una notificación no completa la tarea. «Hecho» se guarda localmente; no modifica el historial médico del servidor.</Text>
          </>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  launcher: { position: 'absolute', right: 12, bottom: 80, backgroundColor: '#1d4ed8', borderRadius: 24, padding: 12, elevation: 5 },
  page: { flex: 1, backgroundColor: '#fff' }, content: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', marginVertical: 12 }, title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  card: { padding: 14, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, marginVertical: 8 },
  selected: { borderWidth: 2, borderColor: '#1d4ed8' }, info: { color: '#475569', marginVertical: 8 },
  primary: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  white: { color: '#fff', fontWeight: '700' }, secondary: { padding: 14, backgroundColor: '#f1f5f9', borderRadius: 8, marginTop: 8 },
  error: { color: '#b91c1c', marginVertical: 10 }, link: { color: '#1d4ed8', paddingVertical: 12 },
  input: { borderWidth: 1, borderColor: '#94a3b8', borderRadius: 8, padding: 12 },
});
