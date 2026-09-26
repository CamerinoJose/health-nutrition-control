import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  SafeAreaView,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Application from 'expo-application';
import api from './api';

export default function SettingsScreen({ onNavigate, onLogout, onRefreshProfile, profile }) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState({
    enableReminders: false,
  });
  const [language, setLanguage] = useState(i18n.language);

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
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>🚪 Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>
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
});
