import { NativeModules, Platform } from 'react-native';
import { buildReminder, createReminder, completeReminder, cancelReminder, reconcileReminders,
  reminderIdFromUrl, subscribeReminderOpen, openReminder, scheduleNextMedicineReminder } from '../reminderAlarm';

beforeEach(() => {
  Platform.OS = 'android';
  Platform.Version = 30;
  NativeModules.ReminderAlarm = {
    capabilities: jest.fn(async () => ({ notifications: true, exactAlarms: true })),
    create: jest.fn(async (json) => json),
    finish: jest.fn(async () => {}),
    reconcile: jest.fn(async () => '[]'),
  };
});

test('stable occurrence identity and complete persistent fields', () => {
  const input = { sourceType: 'water', sourceId: 'cup/1', title: ' Agua ', scheduledAt: 10000 };
  const a = buildReminder(input, 1000);
  expect(a).toMatchObject({ title: 'Agua', status: 'scheduled', repeatMinutes: 5, completedAt: null, nextAlertAt: 10000 });
  expect(a.notificationIds).toEqual([a.id]);
  expect(buildReminder(input, 2000).id).toBe(a.id);
  expect(buildReminder({ ...input, scheduledAt: 20000 }, 1000).id).not.toBe(a.id);
});
test('rejects empty titles, invalid dates and dates in the past', () => {
  for (const scheduledAt of [NaN, 'not a date', 500]) {
    expect(() => buildReminder({ sourceId: '1', title: 'Task', scheduledAt }, 1000)).toThrow();
  }
  expect(() => buildReminder({ sourceId: '1', title: ' ', scheduledAt: 10000 }, 1000)).toThrow();
});
test('schedules through native storage and returns its identity', async () => {
  const r = await createReminder({ sourceId: '1', title: 'Task', scheduledAt: Date.now() + 60000 });
  expect(NativeModules.ReminderAlarm.create).toHaveBeenCalledTimes(1);
  expect(r.status).toBe('scheduled');
});
test('explicit done/cancel use distinct terminal actions', async () => {
  await completeReminder('one'); await cancelReminder('two');
  expect(NativeModules.ReminderAlarm.finish.mock.calls).toEqual([['one', true], ['two', false]]);
});
test('opening a notification only selects its instance', () => {
  const callback = jest.fn(); const remove = subscribeReminderOpen(callback);
  const id = 'medicine:1:1000';
  openReminder(reminderIdFromUrl(`com.bienestarappmobile://reminder/${encodeURIComponent(id)}`));
  expect(callback).toHaveBeenCalledWith(id);
  expect(NativeModules.ReminderAlarm.finish).not.toHaveBeenCalled();
  remove();
});
test('does not capture OAuth or unrelated deep links', () => {
  expect(reminderIdFromUrl('com.bienestarappmobile://oauth-callback?code=test')).toBeNull();
  expect(reminderIdFromUrl('https://example.org/reminder/a')).toBeNull();
  expect(reminderIdFromUrl('com.bienestarappmobile://reminder/%')).toBeNull();
});
test('restore delegates to native reconciliation without scheduling JS copies', async () => {
  await reconcileReminders(); await reconcileReminders();
  expect(NativeModules.ReminderAlarm.reconcile).toHaveBeenCalledTimes(2);
  expect(NativeModules.ReminderAlarm.create).not.toHaveBeenCalled();
});
test('denied notifications do not claim successful scheduling', async () => {
  NativeModules.ReminderAlarm.capabilities.mockResolvedValue({ notifications: false });
  await expect(createReminder({ sourceId: '1', title: 'Task', scheduledAt: Date.now() + 60000 })).rejects.toThrow('Activa');
  expect(NativeModules.ReminderAlarm.create).not.toHaveBeenCalled();
});
test('unsupported binary fails clearly instead of simulating background alarms', async () => {
  delete NativeModules.ReminderAlarm;
  await expect(reconcileReminders()).rejects.toThrow('APK Android');
});
test('medicine schedules the next dose and keeps identity across retries', async () => {
  const now = new Date(Date.now() + 86400000); now.setHours(23, 0, 0, 0);
  const a = await scheduleNextMedicineReminder({ id: 8, name: 'Test', time: '08:30' }, now);
  const b = await scheduleNextMedicineReminder({ id: 8, name: 'Test', time: '08:30' }, now);
  expect(a.id).toBe(b.id);
  expect(new Date(a.scheduledAt).getDate()).toBe(new Date(now.getTime() + 86400000).getDate());
  expect(new Date(a.scheduledAt).getHours()).toBe(8);
});
