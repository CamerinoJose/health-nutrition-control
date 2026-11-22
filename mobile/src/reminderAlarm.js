import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

const listeners = new Set();
const native = () => {
  if (Platform.OS !== 'android' || !NativeModules.ReminderAlarm) {
    throw new Error('Las alarmas persistentes requieren un APK Android nuevo; no están disponibles en Expo Go, iOS o web.');
  }
  return NativeModules.ReminderAlarm;
};
export const reminderAlarmsAvailable = () => Platform.OS === 'android' && !!NativeModules.ReminderAlarm;
export const isPendingReminder = (r) => r.status === 'scheduled' || r.status === 'active';

export function buildReminder({ sourceType = 'task', sourceId, title, body = '', scheduledAt }, now = Date.now()) {
  const at = new Date(scheduledAt).getTime();
  if (!title?.trim() || !sourceId || !sourceType || !Number.isFinite(at) || at <= now) {
    throw new Error('Escribe un título y elige una fecha y hora futuras.');
  }
  const id = `${encodeURIComponent(sourceType)}:${encodeURIComponent(String(sourceId))}:${at}`;
  return { id, sourceType, sourceId: String(sourceId), title: title.trim(), body,
    scheduledAt: at, repeatMinutes: 5, status: 'scheduled', notificationIds: [id],
    createdAt: now, completedAt: null, nextAlertAt: at };
}

export function reminderIdFromUrl(url) {
  const match = /^com\.bienestarappmobile:\/\/reminder\/([^?#]+)$/.exec(url || '');
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch (_) { return null; }
}

export async function createReminder(input) {
  const bridge = native();
  // Create the channel before requesting Android 13's permission.
  await bridge.capabilities();
  if (Platform.Version >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  const caps = await bridge.capabilities();
  if (!caps.notifications) throw new Error('Activa las notificaciones y el canal Recordatorios persistentes en Ajustes de Android.');
  const r = JSON.parse(await bridge.create(JSON.stringify(buildReminder(input))));
  openReminder(r.id);
  return r;
}
export const reconcileReminders = async () => JSON.parse(await native().reconcile());
export const completeReminder = (id) => native().finish(id, true);
export const cancelReminder = (id) => native().finish(id, false);
export const reminderCapabilities = () => native().capabilities();
export const openExactAlarmSettings = () => native().openExactAlarmSettings();
export function openReminder(id = null) { listeners.forEach((listener) => listener(id)); }
export function subscribeReminderOpen(listener) { listeners.add(listener); return () => listeners.delete(listener); }

export async function scheduleNextMedicineReminder(medicine, now = new Date()) {
  if (medicine.id == null || !/^([01]\d|2[0-3]):[0-5]\d$/.test(medicine.time || '')) {
    throw new Error('La medicina necesita un identificador y una hora válida.');
  }
  const [hour, minute] = medicine.time.split(':').map(Number);
  const scheduled = new Date(now);
  scheduled.setHours(hour, minute, 0, 0);
  if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1);
  return createReminder({ sourceType: 'medicine', sourceId: medicine.id,
    title: `Medicina: ${medicine.name}`, body: 'Confirma esta toma con ✓ Hecho. No vuelvas a tomarla si ya la tomaste.', scheduledAt: scheduled });
}
