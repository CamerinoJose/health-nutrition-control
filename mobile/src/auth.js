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
  await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY)
}

const ACTIVE_ACCOUNT_KEY = 'bienestar_active_account_id'

export async function clearAccountLocalData(accountId) {
  const keys = await AsyncStorage.getAllKeys();
  const accountMarker = accountId == null ? null : `:${String(accountId)}`;
  const accountKeys = accountMarker
    ? keys.filter((key) => key.endsWith(accountMarker) || key.includes(`${accountMarker}:`))
    : [];
  const legacyKeys = [
    'bienestar_health_profile_v1',
    'bienestar_meal_times_v1',
    'bienestar_reminder_settings_v1',
    'bienestar_pending_meal_settings_v1',
    'bienestar_medicine_notif_ids_v1',
    'bienestar_diabetes_notif_ids_v1',
    'bienestar_meal_reminder_ids_v1',
    'diabetesNotificationConfig',
  ];
  await AsyncStorage.multiRemove([...new Set([...accountKeys, ...legacyKeys])]);
}

export async function saveActiveAccountId(accountId) {
  if (accountId == null) return
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, String(accountId))
}

export async function getActiveAccountId() {
  return await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY)
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
