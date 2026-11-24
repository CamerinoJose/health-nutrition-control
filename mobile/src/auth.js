import AsyncStorage from '@react-native-async-storage/async-storage'
const TOKEN_KEY = 'bienestar_token'

export async function saveToken(token){
  await AsyncStorage.setItem(TOKEN_KEY, token)
}
export async function getToken(){
  return await AsyncStorage.getItem(TOKEN_KEY)
}
export async function clearToken(){
  await AsyncStorage.removeItem(TOKEN_KEY)
}

export async function saveContactProfile(profile) {
  const accountId = profile?.user_id != null ? String(profile.user_id) : null;
  if (!accountId) return;
  await AsyncStorage.setItem(
    `bienestar_contact_profile_v1:${accountId}`,
    JSON.stringify({
      name: profile?.name || '',
      phone: profile?.phone || '',
      contact_preference: profile?.contact_preference || '',
    }),
  );
}

export async function getContactProfile(accountId) {
  if (accountId == null) return null;
  const raw = await AsyncStorage.getItem(
    `bienestar_contact_profile_v1:${String(accountId)}`,
  );
  return raw ? JSON.parse(raw) : null;
}

export function normalizeFullName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

export function validateRegistration({ name, email, password }) {
  const cleanName = normalizeFullName(name);
  const cleanEmail = String(email || '').trim();
  if (cleanName.length < 2) return 'Escribe tu nombre completo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return 'Escribe un correo electrónico válido.';
  }
  if (String(password || '').length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  return null;
}
