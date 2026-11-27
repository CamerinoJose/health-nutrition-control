import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getContactProfile,
  clearAccountLocalData,
  normalizeFullName,
  saveContactProfile,
  validateRegistration,
} from '../auth';

test('registration requires name, valid email and a strong password', () => {
  expect(validateRegistration({ name: 'A', email: 'correo', password: '123' }))
    .toBe('Escribe tu nombre completo.');
  expect(validateRegistration({ name: 'Ana López', email: 'correo', password: '12345678' }))
    .toBe('Escribe un correo electrónico válido.');
  expect(validateRegistration({ name: 'Ana López', email: 'ana@example.com', password: '123' }))
    .toBe('La contraseña debe tener al menos 8 caracteres.');
});

test('registration accepts complete trimmed values', () => {
  expect(validateRegistration({
    name: '  Ana López  ',
    email: '  ana@example.com  ',
    password: '12345678',
  })).toBeNull();
});

test('full names preserve words and collapse repeated spaces', () => {
  expect(normalizeFullName('  Ana   María  López  ')).toBe('Ana María López');
});

test('contact profile is stored and loaded per account', async () => {
  await saveContactProfile({
    user_id: 42,
    name: 'Camerino Jose',
    phone: '8711180250',
    contact_preference: 'phone',
  });
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'bienestar_contact_profile_v1:42',
    expect.any(String),
  );

  AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
    name: 'Camerino Jose',
    phone: '8711180250',
    contact_preference: 'phone',
  }));
  await expect(getContactProfile(42)).resolves.toMatchObject({
    phone: '8711180250',
    contact_preference: 'phone',
  });
});

test('account erasure clears current-account caches without removing other accounts', async () => {
  jest.clearAllMocks();
  AsyncStorage.getAllKeys.mockResolvedValueOnce([
    'bienestar_gemini_history_v1:42',
    'bienestar_health_profile_v1:42',
    'bienestar_health_profile_draft_v1:42',
    'bienestar_gemini_history_v1:420',
  ]);

  await clearAccountLocalData(42);

  const removed = AsyncStorage.multiRemove.mock.calls[0][0];
  expect(removed).toContain('bienestar_gemini_history_v1:42');
  expect(removed).toContain('bienestar_health_profile_v1:42');
  expect(removed).toContain('bienestar_health_profile_draft_v1:42');
  expect(removed).not.toContain('bienestar_gemini_history_v1:420');
  expect(removed).toContain('bienestar_health_profile_v1');
});
