import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TEST_CASES = [
  { id: 'auth-register', group: 'Cuenta', title: 'Registrar una cuenta nueva' },
  { id: 'auth-login', group: 'Cuenta', title: 'Iniciar sesión con correo' },
  { id: 'auth-google', group: 'Cuenta', title: 'Iniciar sesión con Google' },
  { id: 'auth-switch', group: 'Cuenta', title: 'Cambiar de cuenta sin mezclar datos' },
  { id: 'auth-logout', group: 'Cuenta', title: 'Cerrar sesión y ocultar datos locales' },
  { id: 'profile-contact', group: 'Perfil', title: 'Guardar contacto y preferencia' },
  { id: 'profile-persist', group: 'Perfil', title: 'Mantener perfil al reabrir' },
  { id: 'meals-upload', group: 'Alimentación', title: 'Subir PDF y extraer comidas' },
  { id: 'meals-open', group: 'Alimentación', title: 'Abrir recetas de las comidas' },
  { id: 'meals-offline', group: 'Alimentación', title: 'Guardar horarios sin conexión' },
  { id: 'meals-switch', group: 'Alimentación', title: 'No mezclar planes entre cuentas' },
  { id: 'medicine-fixed', group: 'Medicinas', title: 'Agregar medicina de hora fija' },
  { id: 'medicine-meal', group: 'Medicinas', title: 'Agregar medicina ligada a comida' },
  { id: 'medicine-taken', group: 'Medicinas', title: 'Marcar tomada y conservar estado' },
  { id: 'reminder-bg', group: 'Recordatorios', title: 'Avisar en segundo plano' },
  { id: 'reminder-close', group: 'Recordatorios', title: 'Avisar con app cerrada' },
  { id: 'reminder-restart', group: 'Recordatorios', title: 'Recuperar alarmas tras reiniciar' },
  { id: 'gemini-chat', group: 'Gemini', title: 'Responder una consulta real' },
  { id: 'gemini-copy', group: 'Gemini', title: 'Copiar una respuesta' },
  { id: 'gemini-history', group: 'Gemini', title: 'Conservar historial por cuenta' },
  { id: 'appointments', group: 'Citas', title: 'Crear y consultar una cita' },
  { id: 'messages', group: 'Mensajes', title: 'Enviar y recibir mensaje' },
  { id: 'progress', group: 'Progreso', title: 'Guardar y consultar progreso' },
];

export default function TestModeScreen({ onNavigate, profile }) {
  const accountId = profile?.user_id != null ? String(profile.user_id) : 'guest';
  const storageKey = `bienestar_test_results_v1:${accountId}`;
  const [results, setResults] = useState({});
  const [selectedId, setSelectedId] = useState(TEST_CASES[0].id);
  const [note, setNote] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((raw) => raw ? setResults(JSON.parse(raw)) : setResults({}))
      .catch(() => setResults({}));
  }, [storageKey]);

  const saveResults = async (next) => {
    setResults(next);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
  };

  const setStatus = (status) => {
    const current = results[selectedId] || {};
    saveResults({
      ...results,
      [selectedId]: { ...current, status, note: current.note || note, updatedAt: new Date().toISOString() },
    }).catch(() => Alert.alert('Error', 'No se pudieron guardar los resultados.'));
  };

  const saveNote = () => {
    const current = results[selectedId] || {};
    saveResults({
      ...results,
      [selectedId]: { ...current, note, updatedAt: new Date().toISOString() },
    }).catch(() => Alert.alert('Error', 'No se pudo guardar la nota.'));
  };

  const clearResults = () => {
    Alert.alert('Limpiar resultados', 'Se eliminarán las comprobaciones guardadas en esta cuenta.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpiar', style: 'destructive', onPress: () => {
        AsyncStorage.removeItem(storageKey).then(() => setResults({}));
      } },
    ]);
  };

  const selected = results[selectedId] || {};
  const counts = TEST_CASES.reduce((acc, item) => {
    acc[results[item.id]?.status || 'pending'] = (acc[results[item.id]?.status || 'pending'] || 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    setNote(results[selectedId]?.note || '');
  }, [selectedId, results]);

  const groups = [...new Set(TEST_CASES.map((item) => item.group))];
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="test-mode-back" onPress={() => onNavigate('settings')} style={styles.back}>
          <Text style={styles.backText}>← Configuración</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Modo de pruebas</Text>
        <TouchableOpacity onPress={clearResults}>
          <Text style={styles.clearText}>Limpiar</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>Pendientes: {counts.pending || 0}</Text>
          <Text style={styles.summaryText}>Aprobados: {counts.approved || 0}</Text>
          <Text style={styles.summaryText}>Fallidos: {counts.failed || 0}</Text>
        </View>
        {groups.map((group) => (
          <View key={group} style={styles.group}>
            <Text style={styles.groupTitle}>{group}</Text>
            {TEST_CASES.filter((item) => item.group === group).map((item) => (
              <TouchableOpacity
                key={item.id}
                testID={`test-case-${item.id}`}
                style={[styles.caseRow, selectedId === item.id && styles.caseSelected]}
                onPress={() => setSelectedId(item.id)}
              >
                <Text style={styles.caseTitle}>{item.title}</Text>
                <Text style={[styles.status, styles[`status_${results[item.id]?.status || 'pending'}`]]}>
                  {results[item.id]?.status === 'approved' ? 'Aprobado' : results[item.id]?.status === 'failed' ? 'Falló' : 'Pendiente'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>Caso seleccionado</Text>
          <Text style={styles.editorCase}>{TEST_CASES.find((item) => item.id === selectedId)?.title}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.action, styles.approve]} onPress={() => setStatus('approved')}>
              <Text style={styles.actionText}>Aprobado</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.action, styles.fail]} onPress={() => setStatus('failed')}>
              <Text style={styles.actionText}>Falló</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.notes}
            value={selected.status ? note : note}
            onChangeText={setNote}
            placeholder="Nota, dispositivo, cuenta o error observado"
            multiline
          />
          <TouchableOpacity style={styles.save} onPress={saveNote}>
            <Text style={styles.saveText}>Guardar nota</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { width: 120 },
  backText: { color: '#2563eb', fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '800' },
  clearText: { color: '#b91c1c', fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  summaryText: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 10, fontWeight: '700' },
  group: { marginBottom: 12 },
  groupTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  caseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginVertical: 3 },
  caseSelected: { borderColor: '#2563eb', borderWidth: 2 },
  caseTitle: { flex: 1, marginRight: 8, color: '#1f2937' },
  status: { fontSize: 12, fontWeight: '800', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  status_pending: { backgroundColor: '#fef3c7', color: '#92400e' },
  status_approved: { backgroundColor: '#dcfce7', color: '#166534' },
  status_failed: { backgroundColor: '#fee2e2', color: '#991b1b' },
  editor: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  editorTitle: { fontSize: 13, color: '#64748b', fontWeight: '700' },
  editorCase: { fontSize: 16, fontWeight: '800', marginVertical: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 8 },
  approve: { backgroundColor: '#16a34a' },
  fail: { backgroundColor: '#dc2626' },
  actionText: { color: '#fff', fontWeight: '800' },
  notes: { minHeight: 90, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginTop: 10, padding: 10, textAlignVertical: 'top' },
  save: { backgroundColor: '#2563eb', borderRadius: 8, alignItems: 'center', padding: 12, marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '800' },
});
