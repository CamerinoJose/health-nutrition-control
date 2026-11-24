import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getContactProfile,
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
