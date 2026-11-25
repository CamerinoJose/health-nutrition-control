import AsyncStorage from '@react-native-async-storage/async-storage';

export const REMINDER_SETTINGS_STORAGE_KEY = 'bienestar_reminder_settings_v1';

export const DEFAULT_REMINDER_SETTINGS = {
  medicineMealOffsetMinutes: 30,
  diabetesPreMealMinutesBefore: 15,
  diabetesGlucoseHoursAfter: 2,
  diabetesActivityMinutesAfter: 30,
};

function toInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function clampInt(value, min, max, fallback) {
  const n = toInt(value);
  if (n == null) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeReminderSettings(input) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    medicineMealOffsetMinutes: clampInt(src.medicineMealOffsetMinutes, 1, 180, DEFAULT_REMINDER_SETTINGS.medicineMealOffsetMinutes),
    diabetesPreMealMinutesBefore: clampInt(src.diabetesPreMealMinutesBefore, 1, 180, DEFAULT_REMINDER_SETTINGS.diabetesPreMealMinutesBefore),
    diabetesGlucoseHoursAfter: clampInt(src.diabetesGlucoseHoursAfter, 0, 12, DEFAULT_REMINDER_SETTINGS.diabetesGlucoseHoursAfter),
    diabetesActivityMinutesAfter: clampInt(src.diabetesActivityMinutesAfter, 0, 180, DEFAULT_REMINDER_SETTINGS.diabetesActivityMinutesAfter),
  };
}

export async function loadReminderSettings(accountId) {
  try {
    const key = accountId
      ? `${REMINDER_SETTINGS_STORAGE_KEY}:${String(accountId)}`
      : REMINDER_SETTINGS_STORAGE_KEY;
    const raw = await AsyncStorage.getItem(key);
    if (!raw && accountId) {
      const legacy = await AsyncStorage.getItem(REMINDER_SETTINGS_STORAGE_KEY);
      if (legacy) return normalizeReminderSettings(JSON.parse(legacy));
    }
    if (!raw) return { ...DEFAULT_REMINDER_SETTINGS };
    const parsed = JSON.parse(raw);
    return normalizeReminderSettings(parsed);
  } catch (_) {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
}

export async function saveReminderSettings(settings, accountId) {
  const normalized = normalizeReminderSettings(settings);
  try {
    const key = accountId
      ? `${REMINDER_SETTINGS_STORAGE_KEY}:${String(accountId)}`
      : REMINDER_SETTINGS_STORAGE_KEY;
    await AsyncStorage.setItem(key, JSON.stringify(normalized));
  } catch (_) {
    // ignore
  }
  return normalized;
}
