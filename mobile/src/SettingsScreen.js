import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Application from 'expo-application';
import api from './api';

export default function SettingsScreen({ onNavigate, onLogout, onAccountDeleted, onRefreshProfile, profile }) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState({
    enableReminders: false,
  });
  const [language, setLanguage] = useState(i18n.language);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const deletingRef = useRef(false);

  const toggleReminders = async (value) => {
    setSettings({ ...settings, enableReminders: value });
    try {
      await api.put('/settings', { enable_reminders: value });
      Alert.alert('Éxito', value ? 'Recordatorios activados' : 'Recordatorios desactivados');
      if (onRefreshProfile) {
        await onRefreshProfile();
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'No se pudieron guardar los cambios');
    }
  };

  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
    Alert.alert('Idioma', `Idioma cambiado a ${lang.toUpperCase()}`);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const deleteAccount = async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await api.delete('/me', { data: { password } });
    } catch (error) {
      Alert.alert(
        'Error',
        'No se pudo eliminar la cuenta. Verifica tu contraseña o inicia sesión de nuevo y vuelve a intentarlo.',
      );
      deletingRef.current = false;
      setDeleting(false);
      setDeleteModalVisible(false);
      setPassword('');
      return;
    }
    deletingRef.current = false;
    setDeleting(false);
    if (onAccountDeleted) {
      onAccountDeleted();
    } else if (onLogout) {
      onLogout();
    }
  };

  const confirmDeleteAccount = () => {
    if (deletingRef.current) return;
    Alert.alert(
      'Eliminar cuenta',
      '¿Quieres eliminar tu cuenta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', style: 'destructive', onPress: () => setDeleteModalVisible(true) },
      ],
    );
  };

  const openPrivacyPolicy = async () => {
    try {
      await Linking.openURL('https://health-nutrition-control-web.onrender.com/privacy-policy.html');
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la política de privacidad.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⚙️ Configuración</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Notificaciones</Text>
          <View style={styles.settingItem}>
            <View>
              <Text style={styles.settingLabel}>Recordatorios de Comidas</Text>
              <Text style={styles.settingDesc}>Recibe notificaciones sobre tus comidas</Text>
            </View>
            <Switch
              value={settings.enableReminders}
              onValueChange={toggleReminders}
              trackColor={{ false: '#ccc', true: '#81c784' }}
              thumbColor="#3498db"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌍 Idioma</Text>
          <View style={styles.languageButtons}>
            <TouchableOpacity
              testID="settings-test-mode"
              style={[
                styles.langBtn,
                language === 'es' && styles.langBtnActive
              ]}
              onPress={() => changeLanguage('es')}
            >
              <Text style={[
                styles.langBtnText,
                language === 'es' && styles.langBtnTextActive
              ]}>
                Español
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.langBtn,
                language === 'en' && styles.langBtnActive
              ]}
              onPress={() => changeLanguage('en')}
            >
              <Text style={[
                styles.langBtnText,
                language === 'en' && styles.langBtnTextActive
              ]}>
                English
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Información</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Versión</Text>
            <Text style={styles.infoValue}>{Application.nativeApplicationVersion || 'No disponible'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Build</Text>
            <Text style={styles.infoValue}>{Application.nativeBuildVersion || 'No disponible'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Usuario</Text>
            <Text style={styles.infoValue}>{profile?.name || 'No disponible'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {profile?.email || 'No disponible'}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={openPrivacyPolicy}
            style={styles.infoItem}
          >
            <Text style={styles.privacyLink}>Política de privacidad</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.testModeBtn}
          onPress={() => onNavigate('test-mode')}
        >
          <Text style={styles.testModeBtnText}>🧪 Modo de pruebas</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>🚪 Cerrar Sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={confirmDeleteAccount}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityState={{ disabled: deleting }}
        >
          <Text style={styles.deleteBtnText}>{deleting ? 'Eliminando cuenta...' : 'Eliminar cuenta'}</Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) {
            setDeleteModalVisible(false);
            setPassword('');
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.deleteDialog} accessibilityViewIsModal>
            <Text style={styles.deleteTitle}>Confirma tu identidad</Text>
            <Text style={styles.deleteDescription}>
              Introduce tu contraseña actual. Si usas una cuenta de un proveedor externo, deja el campo vacío; es posible que debas iniciar sesión de nuevo y volver a intentarlo.
            </Text>
            <TextInput
              accessibilityLabel="Contraseña actual"
              placeholder="Contraseña actual"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!deleting}
              style={styles.passwordInput}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: deleting }}
              disabled={deleting}
              onPress={deleteAccount}
              style={styles.logoutBtn}
            >
              <Text style={styles.logoutBtnText}>{deleting ? 'Eliminando cuenta...' : 'Confirmar eliminación'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: deleting }}
              disabled={deleting}
              onPress={() => { setDeleteModalVisible(false); setPassword(''); }}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  content: {
    padding: 15,
  },
  section: {
    marginBottom: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  settingDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
  },
  languageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  langBtnActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  langBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  langBtnTextActive: {
    color: '#fff',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  privacyLink: {
    color: '#1558a6',
    fontSize: 14,
    fontWeight: '600',
  },
  testModeBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  testModeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutBtn: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  deleteBtnText: {
    color: '#b42318',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  deleteDialog: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  deleteDescription: {
    color: '#333',
    marginVertical: 12,
    lineHeight: 20,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    color: '#333',
  },
});
