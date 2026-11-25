import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadMealTimes, saveMealTimes } from '../mealTimes';
import { loadReminderSettings, saveReminderSettings } from '../reminderSettings';

beforeEach(() => {
  jest.clearAllMocks();
});

test('meal times are isolated per account', async () => {
  await saveMealTimes({ breakfast: '07:30', lunch: '13:30', dinner: '19:30' }, '42');
  await saveMealTimes({ breakfast: '09:00', lunch: '15:00', dinner: '21:00' }, '43');

  AsyncStorage.getItem.mockImplementation((key) => {
    if (key.endsWith(':42')) return Promise.resolve(JSON.stringify({
      breakfast: '07:30', lunch: '13:30', dinner: '19:30',
    }));
    if (key.endsWith(':43')) return Promise.resolve(JSON.stringify({
      breakfast: '09:00', lunch: '15:00', dinner: '21:00',
    }));
    return Promise.resolve(null);
  });

  await expect(loadMealTimes('42')).resolves.toMatchObject({ breakfast: '07:30' });
  await expect(loadMealTimes('43')).resolves.toMatchObject({ breakfast: '09:00' });
});

test('reminder settings are isolated per account', async () => {
  await saveReminderSettings({ medicineMealOffsetMinutes: 20 }, '42');
  await saveReminderSettings({ medicineMealOffsetMinutes: 45 }, '43');

  AsyncStorage.getItem.mockImplementation((key) => {
    if (key.endsWith(':42')) return Promise.resolve(JSON.stringify({
      medicineMealOffsetMinutes: 20,
    }));
    if (key.endsWith(':43')) return Promise.resolve(JSON.stringify({
      medicineMealOffsetMinutes: 45,
    }));
    return Promise.resolve(null);
  });

  await expect(loadReminderSettings('42')).resolves.toMatchObject({ medicineMealOffsetMinutes: 20 });
  await expect(loadReminderSettings('43')).resolves.toMatchObject({ medicineMealOffsetMinutes: 45 });
});
