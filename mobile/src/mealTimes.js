import AsyncStorage from '@react-native-async-storage/async-storage';

export const MEAL_TIMES_STORAGE_KEY = 'bienestar_meal_times_v1';

export const DEFAULT_MEAL_TIMES = {
  breakfast: '08:00',
  lunch: '14:00',
  dinner: '20:00',
};

function isValidHHMM(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ''));
}

export function normalizeMealTimes(input) {
  const src = input && typeof input === 'object' ? input : {};
  const breakfast = isValidHHMM(src.breakfast) ? src.breakfast : DEFAULT_MEAL_TIMES.breakfast;
  const lunch = isValidHHMM(src.lunch) ? src.lunch : DEFAULT_MEAL_TIMES.lunch;
  const dinner = isValidHHMM(src.dinner) ? src.dinner : DEFAULT_MEAL_TIMES.dinner;
  return { breakfast, lunch, dinner };
}

export async function loadMealTimes(accountId) {
  try {
    const key = accountId
      ? `${MEAL_TIMES_STORAGE_KEY}:${String(accountId)}`
      : MEAL_TIMES_STORAGE_KEY;
    const raw = await AsyncStorage.getItem(key);
    if (!raw && accountId) {
      const legacy = await AsyncStorage.getItem(MEAL_TIMES_STORAGE_KEY);
      if (legacy) return normalizeMealTimes(JSON.parse(legacy));
    }
    if (!raw) return { ...DEFAULT_MEAL_TIMES };
    const parsed = JSON.parse(raw);
    return normalizeMealTimes(parsed);
  } catch (_) {
    return { ...DEFAULT_MEAL_TIMES };
  }
}

export async function saveMealTimes(mealTimes, accountId) {
  try {
    const normalized = normalizeMealTimes(mealTimes);
    const key = accountId
      ? `${MEAL_TIMES_STORAGE_KEY}:${String(accountId)}`
      : MEAL_TIMES_STORAGE_KEY;
    await AsyncStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  } catch (_) {
    return normalizeMealTimes(mealTimes);
  }
}
