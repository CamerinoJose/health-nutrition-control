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
const formatTime = date => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

function localAppointmentDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
}

export default function AppointmentsScreen({ onNavigate }) {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [archivedAppointments, setArchivedAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [activeTab, setActiveTab] = useState('active'); // active | archived
  const [showModal, setShowModal] = useState(false);
  const [picker, setPicker] = useState(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [form, setForm] = useState({
    title: '',
    description: '',
    appointment_date: '',
    appointment_time: '',
    notes: ''
  });
  const [selectedMonth, setSelectedMonth] = useState(formatDate(new Date()).slice(0, 7));

  useEffect(() => {
    loadAppointments();
  }, [selectedMonth]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      // Load active appointments
      const activeUrl = `/appointments?month=${selectedMonth}`;
      const activeResponse = await api.get(activeUrl);
      setAppointments(activeResponse.data || []);
      
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

  const handleCreateAppointment = async () => {
    if (submittingRef.current) return;
    if (!form.title.trim() || !form.appointment_date || !form.appointment_time) {
      Alert.alert('Error', 'Completa los campos requeridos');
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
      setForm({ title: '', description: '', appointment_date: '', appointment_time: '', notes: '' });
      Alert.alert('Éxito', 'Cita creada correctamente');
    } catch (error) {
      console.error('Error creating appointment:', error);
      const needsNutritionist = error.response?.data?.error === 'please assign a nutritionist before booking';
      Alert.alert('Error', needsNutritionist
        ? 'Primero asigna un nutriólogo a tu cuenta para poder agendar.'
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
    if (form.appointment_time) {
      const [hours, minutes] = form.appointment_time.split(':').map(Number);
      value.setHours(hours, minutes, 0, 0);
    }
    setPickerDate(value);
    setPicker(mode);
  };

  const handlePickerChange = (event, chosen) => {
    if (Platform.OS !== 'ios') setPicker(null);
    if (event.type === 'dismissed' || !chosen) return;
    setPickerDate(chosen);
    setForm(current => ({
      ...current,
      [picker === 'date' ? 'appointment_date' : 'appointment_time']:
        picker === 'date' ? formatDate(chosen) : formatTime(chosen),
    }));
  };

  const closeModal = () => {
    setPicker(null);
    setShowModal(false);
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
        <Text style={styles.appointmentTime}>🕐 {item.appointment_time}</Text>
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
              <Text style={styles.label}>Hora</Text>
              <TouchableOpacity
                style={styles.input}
                accessibilityRole="button"
                accessibilityLabel="Seleccionar hora"
                onPress={() => openPicker('time')}
              >
                <Text style={!form.appointment_time && styles.placeholder}>
                  {form.appointment_time || 'Seleccionar hora'}
                </Text>
              </TouchableOpacity>
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
                    setForm(current => ({
                      ...current,
                      [picker === 'date' ? 'appointment_date' : 'appointment_time']:
                        picker === 'date' ? formatDate(pickerDate) : formatTime(pickerDate),
                    }));
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
