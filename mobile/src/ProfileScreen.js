import React, { useState, useEffect } from 'react';
import { View, Text, Button, ActivityIndicator, Alert, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import HealthProfileForm from './HealthProfileForm';
import { getContactProfile, saveContactProfile } from './auth';
import { ageFromBirthDate } from './age';

const healthProfileStorageKey = (accountId) =>
  `bienestar_health_profile_v1:${accountId == null ? 'guest' : String(accountId)}`;
const healthProfileDraftKey = (accountId) =>
  `bienestar_health_profile_draft_v1:${String(accountId)}`;

export default function ProfileScreen({ onNavigate, accountProfile, onAccountProfileUpdated }) {
  const healthProfileKey = healthProfileStorageKey(accountProfile?.user_id);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftProfile, setDraftProfile] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [profileOffline, setProfileOffline] = useState(false);
  const [accountName, setAccountName] = useState(accountProfile?.name || '');
  const [accountPhone, setAccountPhone] = useState(accountProfile?.phone || '');
  const [contactPreference, setContactPreference] = useState(accountProfile?.contact_preference || 'app');
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    loadProfile();
    let active = true;
    getContactProfile(accountProfile?.user_id)
      .then((cached) => {
        if (!active || !cached) return;
        if (!accountProfile?.name && cached.name) setAccountName(cached.name);
        if (!accountProfile?.phone && cached.phone) setAccountPhone(cached.phone);
        if (!accountProfile?.contact_preference && cached.contact_preference) {
          setContactPreference(cached.contact_preference);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [accountProfile?.user_id]);

  const loadProfile = async () => {
    setLoading(true);
    setPendingDraft(false);
    setDraftProfile(null);
    setProfileLoadError(false);
    setProfileOffline(false);
    try {
      if (accountProfile?.user_id != null) {
        const draftRaw = await AsyncStorage.getItem(healthProfileDraftKey(accountProfile.user_id));
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
            throw new Error('El borrador local del perfil no es válido.');
          }
          setProfile(draft);
          setPendingDraft(true);
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo leer el borrador local del perfil. Inténtalo de nuevo antes de editar.');
      setProfileLoadError(true);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/health-profile');

      // Backend can return either { profile: null } or a profile object
      if (res?.data && typeof res.data === 'object' && Object.prototype.hasOwnProperty.call(res.data, 'profile')) {
        setProfile(res.data.profile);
      } else {
        setProfile(res.data);
      }

      try {
        if (res?.data) {
          await AsyncStorage.setItem(healthProfileKey, JSON.stringify(res.data));
        }
      } catch (_) {
        console.warn('No se pudo guardar la copia local del perfil.');
      }
    } catch (e) {
      try {
        const raw = await AsyncStorage.getItem(healthProfileKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const cached = parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'profile')
            ? parsed.profile : parsed;
          if (cached && typeof cached === 'object' && !Array.isArray(cached)) {
            setProfile(cached);
            setProfileOffline(true);
          } else {
            setProfileLoadError(true);
          }
        } else {
          setProfileLoadError(true);
        }
      } catch (_) {
        setProfileLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveAccountProfile = async () => {
    const phone = accountPhone.trim();
    if (contactPreference === 'phone' && !phone) {
      Alert.alert('Teléfono requerido', 'Agrega un número de teléfono para poder comunicarnos contigo.');
      return;
    }
    setSavingAccount(true);
    try {
      const response = await api.put('/me/profile', {
        name: accountName.trim(),
        phone,
        contact_preference: contactPreference,
      });
      const updated = {
        ...accountProfile,
        name: response.data.name || accountName.trim(),
        phone: response.data.phone || phone,
        contact_preference: response.data.contact_preference || contactPreference,
      };
      setAccountName(updated.name);
      setAccountPhone(updated.phone);
      await saveContactProfile(updated);
      if (onAccountProfileUpdated) onAccountProfileUpdated(updated);
      Alert.alert('Éxito', 'Datos personales actualizados');
    } catch (error) {
      console.error('Error updating account profile:', error);
      Alert.alert('Error', 'No se pudieron actualizar tus datos personales');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSave = async (data) => {
    setDraftProfile(data);
    setLoading(true);
    if (accountProfile?.user_id == null) {
      Alert.alert('Error', 'No se pudo identificar la cuenta. Inicia sesión de nuevo antes de guardar el perfil.');
      setLoading(false);
      return;
    }
    const draftKey = healthProfileDraftKey(accountProfile.user_id);
    try {
      await AsyncStorage.setItem(draftKey, JSON.stringify(data));
      setPendingDraft(true);
    } catch (error) {
      Alert.alert('Error', 'No se pudo conservar el borrador en este dispositivo. El perfil no se envió; inténtalo de nuevo.');
      setLoading(false);
      return;
    }
    try {
      let saved;
      // Create vs update
      if (profile) {
        try {
          saved = await api.put('/health-profile', data);
        } catch (err) {
          // If backend returns 404 because profile doesn't exist yet, fallback to create
          if (err?.response?.status === 404) {
            saved = await api.post('/health-profile', data);
          } else {
            throw err;
          }
        }
      } else {
        try {
          saved = await api.post('/health-profile', data);
        } catch (err) {
          // If it already exists, fallback to update
          if (err?.response?.status === 409) {
            saved = await api.put('/health-profile', data);
          } else {
            throw err;
          }
        }
      }

      if (saved?.data?.birth_date !== data.birth_date) {
        Alert.alert('Aviso', 'El servidor no confirmó la fecha de nacimiento. Actualiza el servicio antes de guardar el perfil.');
        return;
      }

      const refreshed = await api.get('/health-profile');
      const newProfile = refreshed?.data && typeof refreshed.data === 'object' && Object.prototype.hasOwnProperty.call(refreshed.data, 'profile')
        ? refreshed.data.profile
        : refreshed.data;

      if (!newProfile || newProfile.birth_date !== data.birth_date) {
        throw new Error('El servidor no devolvió el perfil actualizado.');
      }
      await AsyncStorage.removeItem(draftKey);
      setProfile(newProfile);
      setDraftProfile(null);
      setPendingDraft(false);
      setProfileOffline(false);

      try {
        await AsyncStorage.setItem(healthProfileKey, JSON.stringify(refreshed.data));
      } catch (_) {
        console.warn('No se pudo guardar la copia local del perfil.');
      }

      setEditing(false);
      Alert.alert('Éxito', 'Perfil guardado correctamente');
    } catch (e) {
      setProfile(data);
      setDraftProfile(null);
      setEditing(false);
      Alert.alert('Guardado pendiente', 'El borrador está en este dispositivo, pero no se confirmó en el servidor. Para reintentar, abre Editar y pulsa Guardar. Al hacerlo podrías reemplazar cambios de otro dispositivo.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{marginTop: 40}} />;

  if (profileLoadError) {
    return <View style={styles.container}>
      <Text>No se pudo cargar el perfil o su borrador local.</Text>
      <Button title="Reintentar" onPress={loadProfile} />
      <Button title="Volver" onPress={() => onNavigate && onNavigate('home')} />
    </View>;
  }

  if (editing || !profile) {
    return <HealthProfileForm initialData={draftProfile || profile} onSubmit={handleSave} />;
  }

  return (
    <ScrollView style={{flex: 1}}>
      <View style={styles.container}>
        <View style={styles.profileHeading}>
          {accountProfile?.picture ? (
            <Image
              source={{ uri: accountProfile.picture }}
              style={styles.profilePicture}
              accessibilityLabel="Foto de perfil de Google"
            />
          ) : (
            <View style={styles.profileInitials}>
              <Text style={styles.profileInitialsText}>
                {(accountProfile?.name || 'U').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.title}>Mi Perfil</Text>
        </View>
        <View style={styles.accountSection}>
          <Text style={styles.sectionTitle}>📇 Datos personales</Text>
          <Text style={styles.fieldLabel}>Nombre</Text>
          <TextInput
            style={styles.accountInput}
            value={accountName}
            onChangeText={setAccountName}
            maxLength={120}
          />
          <Text style={styles.fieldLabel}>Correo</Text>
          <Text style={styles.readOnlyValue}>{accountProfile?.email || 'No disponible'}</Text>
          {(accountProfile?.given_name || accountProfile?.family_name) && (
            <View style={styles.googleIdentity}>
              {accountProfile?.given_name && (
                <View style={styles.googleIdentityField}>
                  <Text style={styles.fieldLabel}>Nombre de Google</Text>
                  <Text style={styles.readOnlyValue}>{accountProfile.given_name}</Text>
                </View>
              )}
              {accountProfile?.family_name && (
                <View style={styles.googleIdentityField}>
                  <Text style={styles.fieldLabel}>Apellido de Google</Text>
                  <Text style={styles.readOnlyValue}>{accountProfile.family_name}</Text>
                </View>
              )}
            </View>
          )}
          <Text style={styles.fieldLabel}>
            Teléfono {contactPreference === 'phone' ? '*' : '(opcional)'}
          </Text>
          <TextInput
            style={styles.accountInput}
            value={accountPhone}
            onChangeText={setAccountPhone}
            keyboardType="phone-pad"
            maxLength={30}
            placeholder="Ej. 55 1234 5678"
          />
          <Text style={styles.fieldLabel}>Preferencia de comunicación</Text>
          <TouchableOpacity style={styles.preferenceRow} onPress={() => setContactPreference('phone')}>
            <Text style={styles.checkbox}>{contactPreference === 'phone' ? '☑' : '☐'}</Text>
            <Text>Pueden contactarme por teléfono o WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.preferenceRow} onPress={() => setContactPreference('app')}>
            <Text style={styles.checkbox}>{contactPreference === 'app' ? '☑' : '☐'}</Text>
            <Text>Prefiero comunicarme solo por la app</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveAccountButton} onPress={saveAccountProfile} disabled={savingAccount}>
            <Text style={styles.saveAccountText}>{savingAccount ? 'Guardando...' : 'Guardar datos personales'}</Text>
          </TouchableOpacity>
        </View>
        
        {/* Herramientas para Diabetes */}
        <View style={styles.diabetesSection}>
          <Text style={styles.sectionTitle}>🩺 Herramientas para Diabetes</Text>
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => onNavigate && onNavigate('medicinas')}
          >
            <Text style={styles.toolIcon}>💊</Text>
            <View style={styles.toolInfo}>
              <Text style={styles.toolTitle}>Medicinas</Text>
              <Text style={styles.toolDescription}>Administra tus medicamentos y programa recordatorios</Text>
            </View>
            <Text style={styles.toolArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => onNavigate && onNavigate('diabetesNotifications')}
          >
            <Text style={styles.toolIcon}>🔔</Text>
            <View style={styles.toolInfo}>
              <Text style={styles.toolTitle}>Notificaciones de Diabetes</Text>
              <Text style={styles.toolDescription}>Configura recordatorios de comidas, glucosa y actividad</Text>
            </View>
            <Text style={styles.toolArrow}>›</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.subtitle}>Información del perfil</Text>
      {pendingDraft && <Text accessibilityRole="alert">Cambios pendientes: solo están en este dispositivo. Abre Editar y pulsa Guardar para reintentar; podrías reemplazar cambios hechos en otro dispositivo.</Text>}
      {profileOffline && <Text accessibilityRole="alert">Copia local sin verificar: el perfil puede estar desactualizado.</Text>}
      <Text>Edad: {profile.birth_date ? `${ageFromBirthDate(profile.birth_date) ?? 'No disponible'} años` : `${profile.age || 'No disponible'} (registrada; agrega tu fecha de nacimiento para actualizarla)`}</Text>
      <Text>Sexo: {profile.sex}</Text>
      <Text>Altura: {profile.height} cm</Text>
      <Text>Peso actual: {profile.current_weight} kg</Text>
      <Text>Peso objetivo: {profile.goal_weight} kg</Text>
      <Text>Enfermedades: {profile.medical_conditions}</Text>
      <Text>Medicamentos: {profile.medications}</Text>
      <Text>Alergias: {profile.allergies}</Text>
      <Text>Glucosa en ayunas: {profile.glucose_fasting}</Text>
      <Text>HbA1c: {profile.hba1c}</Text>
      <Text>Colesterol total: {profile.cholesterol_total}</Text>
      <Text>Colesterol LDL: {profile.cholesterol_ldl}</Text>
      <Text>Colesterol HDL: {profile.cholesterol_hdl}</Text>
      <Text>Triglicéridos: {profile.triglycerides}</Text>
      <Text>Nivel de actividad: {profile.activity_level}</Text>
      <Text>Horario de comidas: {profile.meal_schedule}</Text>
      <Text>Horas de sueño: {profile.sleep_hours}</Text>
      <Text>Metas y preferencias: {profile.goals}</Text>
      <Button title="Editar" onPress={() => setEditing(true)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  profileHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePicture: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginRight: 14,
  },
  profileInitials: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginRight: 14,
    backgroundColor: '#1e88e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitialsText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  googleIdentity: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  googleIdentityField: {
    flex: 1,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  diabetesSection: {
    marginBottom: 24,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  accountSection: {
    backgroundColor: '#eef4ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  fieldLabel: {
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 5,
  },
  accountInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 11,
    fontSize: 16,
  },
  readOnlyValue: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    color: '#4b5563',
    padding: 11,
  },
  saveAccountButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    marginTop: 16,
    padding: 13,
  },
  saveAccountText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  preferenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 6,
  },
  checkbox: {
    color: '#2563eb',
    fontSize: 22,
    marginRight: 8,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toolIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  toolInfo: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  toolDescription: {
    fontSize: 13,
    color: '#666',
  },
  toolArrow: {
    fontSize: 24,
    color: '#999',
  },
});
