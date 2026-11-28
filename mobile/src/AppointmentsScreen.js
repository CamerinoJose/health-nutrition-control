import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  SafeAreaView,
  Alert,
  FlatList,
  Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from './api';

const pad = value => String(value).padStart(2, '0');
const formatDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function availableSlots(data) {
  if (!Array.isArray(data) || data.some(slot =>
    !slot || typeof slot.start_time !== 'string' ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.start_time) ||
    typeof slot.available !== 'boolean' || typeof slot.starts_at !== 'string' ||
    Number.isNaN(Date.parse(slot.starts_at)) || typeof slot.time_zone !== 'string' ||
    !slot.time_zone || typeof slot.utc_offset !== 'string' ||
    !/^[+-]\d{2}:\d{2}$/.test(slot.utc_offset)
  )) {
    throw new Error('Invalid appointment slots response');
  }
  return data.filter(slot => slot.available);
}

function localAppointmentDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
}

export default function AppointmentsScreen({ onNavigate }) {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [changesLoadError, setChangesLoadError] = useState(false);
  const [archivedAppointments, setArchivedAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [activeTab, setActiveTab] = useState('active'); // active | archived
  const [showModal, setShowModal] = useState(false);
  const [picker, setPicker] = useState(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [slots, setSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [slotsRevision, setSlotsRevision] = useState(0);
  const slotsRequest = useRef(0);
  const [form, setForm] = useState({
    title: '',
    description: '',
    appointment_date: '',
    appointment_time: '',
    starts_at: '',
    notes: ''
  });
  const [selectedMonth, setSelectedMonth] = useState(formatDate(new Date()).slice(0, 7));

  useEffect(() => {
    loadAppointments();
  }, [selectedMonth]);

  useEffect(() => {
    if (!showModal || !form.appointment_date) return;
    const request = ++slotsRequest.current;
    setSlotsLoading(true);
    setSlots(null);
    setSlotsError('');
    api.get('/available-slots', { params: { date: form.appointment_date } })
      .then(response => {
        const available = availableSlots(response.data);
        if (request === slotsRequest.current) setSlots(available);
      })
      .catch(error => {
        if (request !== slotsRequest.current) return;
        const code = error?.response?.data?.code;
        const needsProfessional = error?.response?.data?.error === 'no nutritionist assigned';
        setSlotsError(needsProfessional
          ? 'Primero asigna un nutriólogo a tu cuenta para poder agendar.'
          : code === 'schedule_not_configured' || code === 'legacy_zone_required'
            ? 'El profesional debe configurar su agenda y confirmar su zona horaria.'
            : 'No se pudieron cargar los horarios. Revisa tu conexión.');
      })
      .finally(() => {
        if (request === slotsRequest.current) setSlotsLoading(false);
      });
    return () => { slotsRequest.current++; };
  }, [showModal, form.appointment_date, slotsRevision]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      // Load active appointments
      const activeUrl = `/appointments?month=${selectedMonth}`;
      const activeResponse = await api.get(activeUrl);
      const active = Array.isArray(activeResponse.data) ? activeResponse.data : [];
      setAppointments(active);
      setChangesLoadError(false);
      const changesByAppointment = await Promise.all(active.map(async appointment => {
        try {
          const response = await api.get(`/appointment-changes/${appointment.id}`);
          return (Array.isArray(response.data) ? response.data : [])
            .filter(change => change.status === 'pending')
            .map(change => ({ ...change, appointment }));
        } catch {
          setChangesLoadError(true);
          return [];
        }
      }));
      setPendingChanges(changesByAppointment.flat());
      
      // Load archived appointments
      const archivedUrl = `/appointments?archived=true`;
      const archivedResponse = await api.get(archivedUrl);
      setArchivedAppointments(archivedResponse.data || []);
      setLoadError(false);
    } catch (error) {
      console.error('Error loading appointments:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const respondToChange = async (change, accept) => {
    try {
      await api.put(`/appointment-changes/${change.id}/${accept ? 'accept' : 'reject'}`, accept ? undefined : { reason: '' });
      Alert.alert('Cita actualizada', accept ? 'Se aceptó el cambio de horario.' : 'Se rechazó el cambio de horario.');
      await loadAppointments();
    } catch (error) {
      Alert.alert('No se pudo responder', error?.response?.status === 409
        ? 'Ese horario dejó de estar disponible. Contacta a tu profesional para recibir otra propuesta.'
        : 'Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  const handleCreateAppointment = async () => {
    if (submittingRef.current) return;
    if (!form.title.trim() || !form.appointment_date || !form.appointment_time || !form.starts_at) {
      Alert.alert('Error', 'Completa los campos requeridos');
      return;
    }
    if (slotsLoading || !slots?.some(slot => slot.starts_at === form.starts_at)) {
      Alert.alert('Error', 'Selecciona un horario disponible.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await api.post('/appointments', { ...form, title: form.title.trim() });
      const month = form.appointment_date.slice(0, 7);
      if (month === selectedMonth) {
        loadAppointments();
      } else {
        setSelectedMonth(month);
      }
      setShowModal(false);
      setForm({ title: '', description: '', appointment_date: '', appointment_time: '', starts_at: '', notes: '' });
      Alert.alert('Éxito', 'Cita creada correctamente');
    } catch (error) {
      console.error('Error creating appointment:', error);
      const needsNutritionist = error.response?.data?.error === 'please assign a nutritionist before booking';
      const conflict = error.response?.status === 409;
      if (conflict) {
        setForm(current => ({ ...current, appointment_time: '', starts_at: '' }));
        setSlotsRevision(current => current + 1);
      }
      Alert.alert('Error', needsNutritionist
        ? 'Primero asigna un nutriólogo a tu cuenta para poder agendar.'
        : conflict ? 'El horario ya no está disponible. Consulta los horarios actualizados.'
        : 'No se pudo crear la cita. Revisa tu conexión y vuelve a intentarlo.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const openPicker = (mode) => {
    const value = new Date();
    if (form.appointment_date) {
      const selectedDate = localAppointmentDate(form.appointment_date);
      value.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    }
    setPickerDate(value);
    setPicker(mode);
  };

  const handlePickerChange = (event, chosen) => {
    if (Platform.OS !== 'ios') setPicker(null);
    if (event.type === 'dismissed' || !chosen) return;
    setPickerDate(chosen);
    selectDate(chosen);
  };

  const selectDate = chosen => {
    const date = formatDate(chosen);
    if (date === form.appointment_date) return;
    setSlots(null);
    setForm(current => ({ ...current, appointment_date: date, appointment_time: '', starts_at: '' }));
  };

  const closeModal = () => {
    setPicker(null);
    setShowModal(false);
    setSlots(null);
    setForm(current => ({ ...current, appointment_time: '', starts_at: '' }));
  };

  const handleDeleteAppointment = async (id) => {
    Alert.alert('Confirmar', '¿Archivar esta cita?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        onPress: async () => {
          try {
            await api.delete(`/appointments/${id}`);
            loadAppointments();
            Alert.alert('Éxito', 'Cita archivada');
          } catch (error) {
            Alert.alert('Error', 'No se pudo archivar la cita');
          }
        }
      }
    ]);
  };

  const handleRestoreAppointment = async (id) => {
    Alert.alert('Confirmar', '¿Restaurar esta cita?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restaurar',
        onPress: async () => {
          try {
            await api.post(`/appointments/${id}/restore`);
            loadAppointments();
            Alert.alert('Éxito', 'Cita restaurada');
          } catch (error) {
            Alert.alert('Error', 'No se pudo restaurar la cita');
          }
        }
      }
    ]);
  };

  const renderAppointment = ({ item, onDelete }) => (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <Text style={styles.appointmentTitle}>{item.title}</Text>
        <TouchableOpacity onPress={() => onDelete(item.id)}>
          <Text style={styles.deleteBtn}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.appointmentDate}>
        📅 {localAppointmentDate(item.appointment_date).toLocaleDateString('es-ES')}
      </Text>
      {item.appointment_time && (
        <Text style={styles.appointmentTime}>🕐 {item.appointment_time}{item.time_zone ? ` · ${item.time_zone}` : ' · Zona por confirmar'}</Text>
      )}
      {item.description && (
        <Text style={styles.appointmentDesc}>{item.description}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📅 Citas</Text>
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
        <Text style={styles.title}>📅 Mis Citas</Text>
        <TouchableOpacity onPress={() => setShowModal(true)}>
          <Text style={styles.addBtn}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Activas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'archived' && styles.tabActive]}
          onPress={() => setActiveTab('archived')}
        >
          <Text style={[styles.tabText, activeTab === 'archived' && styles.tabTextActive]}>
            Historial
          </Text>
        </TouchableOpacity>
      </View>

      {loadError && (
        <View>
          <Text accessibilityRole="alert">No se pudieron actualizar las citas. La lista puede estar incompleta.</Text>
          <TouchableOpacity accessibilityRole="button" onPress={loadAppointments}><Text>Reintentar</Text></TouchableOpacity>
        </View>
      )}

      {activeTab === 'active' && pendingChanges.length > 0 && (
        <View style={styles.pendingChanges}>
          <Text style={styles.pendingTitle}>Cambios de cita pendientes</Text>
          {pendingChanges.map(change => (
            <View key={change.id} style={styles.pendingCard}>
              <Text style={styles.appointmentTitle}>{change.appointment.title}</Text>
              <Text>{change.new_date} · {change.new_time} ({change.appointment.time_zone || 'zona por confirmar'})</Text>
              {change.reason ? <Text>{change.reason}</Text> : null}
              <View style={styles.changeActions}>
                <TouchableOpacity accessibilityRole="button" onPress={() => respondToChange(change, true)}>
                  <Text style={styles.acceptChange}>Aceptar</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => respondToChange(change, false)}>
                  <Text style={styles.rejectChange}>Rechazar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
      {activeTab === 'active' && changesLoadError && (
        <View style={styles.pendingChanges}>
          <Text accessibilityRole="alert">No se pudieron revisar las propuestas de cambio.</Text>
          <TouchableOpacity accessibilityRole="button" onPress={loadAppointments}><Text>Reintentar</Text></TouchableOpacity>
        </View>
      )}

      <FlatList
        data={activeTab === 'active' ? appointments : archivedAppointments}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => renderAppointment({ 
          item, 
          onDelete: activeTab === 'active' ? handleDeleteAppointment : handleRestoreAppointment 
        })}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loadError && <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {activeTab === 'active' ? '📅 Sin citas programadas' : '📭 Sin citas archivadas'}
            </Text>
            {activeTab === 'active' && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowModal(true)}
              >
                <Text style={styles.addButtonText}>+ Agendar cita</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nueva Cita</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Título</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Consulta con nutricionista"
                value={form.title}
                onChangeText={text => setForm({ ...form, title: text })}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Fecha</Text>
              <TouchableOpacity
                style={styles.input}
                accessibilityRole="button"
                accessibilityLabel="Seleccionar fecha"
                onPress={() => openPicker('date')}
              >
                <Text style={!form.appointment_date && styles.placeholder}>
                  {form.appointment_date ? localAppointmentDate(form.appointment_date).toLocaleDateString('es-ES') : 'Seleccionar fecha'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Horarios del profesional</Text>
              {!form.appointment_date && <Text>Selecciona una fecha para consultar horarios.</Text>}
              {slotsLoading && <ActivityIndicator />}
              {!!slotsError && (
                <View>
                  <Text accessibilityRole="alert">{slotsError}</Text>
                  <TouchableOpacity accessibilityRole="button" onPress={() => setSlotsRevision(current => current + 1)}>
                    <Text>Reintentar horarios</Text>
                  </TouchableOpacity>
                </View>
              )}
              {slots && slots.length === 0 && <Text>No hay horarios disponibles para esta fecha.</Text>}
              {slots && slots.length > 0 && (
                <View>
                  <Text>Zona del profesional: {slots[0].time_zone}</Text>
                  {slots.map(slot => (
                    <TouchableOpacity
                      key={slot.starts_at}
                      accessibilityRole="button"
                      accessibilityState={{ selected: form.starts_at === slot.starts_at }}
                      style={styles.input}
                      onPress={() => setForm(current => ({
                        ...current, appointment_time: slot.start_time, starts_at: slot.starts_at,
                      }))}
                    >
                      <Text>{slot.start_time} (UTC{slot.utc_offset})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {picker && (
              <View>
                <DateTimePicker
                  testID="appointment-picker"
                  value={pickerDate}
                  mode={picker}
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handlePickerChange}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => {
                    selectDate(pickerDate);
                    setPicker(null);
                  }}>
                    <Text>Listo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notas sobre la cita..."
                value={form.description}
                onChangeText={text => setForm({ ...form, description: text })}
                multiline
                numberOfLines={4}
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateAppointment} disabled={submitting}>
              <Text style={styles.submitBtnText}>{submitting ? 'Guardando...' : 'Crear Cita'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  addBtn: {
    fontSize: 28,
    color: '#3498db',
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingHorizontal: 15,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3498db',
  },
  tabText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#3498db',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  pendingChanges: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 15,
    marginTop: 12,
    padding: 12,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9a3412',
    marginBottom: 8,
  },
  pendingCard: {
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
    paddingVertical: 10,
    gap: 5,
  },
  changeActions: {
    flexDirection: 'row',
    gap: 24,
    paddingTop: 6,
  },
  acceptChange: { color: '#15803d', fontWeight: 'bold' },
  rejectChange: { color: '#b91c1c', fontWeight: 'bold' },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appointmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  deleteBtn: {
    fontSize: 20,
    color: '#e74c3c',
  },
  appointmentDate: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  appointmentTime: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  appointmentDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 15,
  },
  addButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  closeBtn: {
    fontSize: 28,
    color: '#999',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    padding: 15,
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  placeholder: {
    color: '#999',
  },
  textArea: {
    textAlignVertical: 'top',
    minHeight: 100,
  },
  submitBtn: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
