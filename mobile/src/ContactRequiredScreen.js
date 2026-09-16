import React, { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from './api';

export default function ContactRequiredScreen({ profile, onSaved }) {
  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [contactPreference, setContactPreference] = useState(profile?.contact_preference || '');
  const [saving, setSaving] = useState(false);

  const saveContact = async () => {
    const normalizedPhone = phone.trim();
    if (!contactPreference) {
      Alert.alert('Elige una opción', 'Indica cómo prefieres que nos comuniquemos contigo.');
      return;
    }
    if (contactPreference === 'phone' && !normalizedPhone) {
      Alert.alert('Teléfono requerido', 'Agrega un número para que podamos comunicarnos contigo.');
      return;
    }
    if (normalizedPhone.length > 30) {
      Alert.alert('Teléfono inválido', 'El teléfono no puede superar 30 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const response = await api.put('/me/profile', {
        name: name.trim(),
        phone: normalizedPhone,
        contact_preference: contactPreference,
      });
      onSaved({
        ...profile,
        name: response.data.name || name.trim() || profile?.name,
        phone: response.data.phone || normalizedPhone,
        contact_preference: response.data.contact_preference || contactPreference,
      });
    } catch (error) {
      console.error('Error saving required contact data:', error);
      Alert.alert('Error', 'No se pudieron guardar tus datos. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>📞</Text>
        <Text style={styles.title}>Completa tus datos de contacto</Text>
        <Text style={styles.description}>
          Estos datos ayudan a tu nutriólogo o profesional relacionado a darte un mejor seguimiento.
          No sustituyen una consulta médica y puedes modificar tus preferencias después desde Perfil.
        </Text>
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Tu nombre"
          maxLength={120}
        />
        <Text style={styles.label}>¿Cómo prefieres comunicarte?</Text>
        <TouchableOpacity style={styles.option} onPress={() => setContactPreference('phone')}>
          <Text style={styles.checkbox}>{contactPreference === 'phone' ? '☑' : '☐'}</Text>
          <Text style={styles.optionText}>Pueden contactarme por teléfono o WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => setContactPreference('app')}>
          <Text style={styles.checkbox}>{contactPreference === 'app' ? '☑' : '☐'}</Text>
          <Text style={styles.optionText}>Prefiero comunicarme solo por la app</Text>
        </TouchableOpacity>
        <Text style={styles.label}>Teléfono {contactPreference === 'phone' ? '*' : '(opcional)'}</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Ej. 55 1234 5678"
          keyboardType="phone-pad"
          maxLength={30}
          autoFocus={!phone}
        />
        <TouchableOpacity style={styles.button} onPress={saveContact} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Guardando...' : 'Continuar'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 22, elevation: 2 },
  icon: { fontSize: 40, textAlign: 'center', marginBottom: 10 },
  title: { fontSize: 23, fontWeight: '700', textAlign: 'center', color: '#1f2937' },
  description: { color: '#4b5563', lineHeight: 21, marginVertical: 16, textAlign: 'center' },
  label: { color: '#374151', fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: { fontSize: 24, color: '#4f46e5', marginRight: 8 },
  optionText: { flex: 1, color: '#374151' },
  button: { backgroundColor: '#4f46e5', borderRadius: 8, marginTop: 20, padding: 14 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
