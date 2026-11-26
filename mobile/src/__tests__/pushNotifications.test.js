import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, setupNotificationReceivedListener, setupNotificationResponseListener } from '../pushNotifications';

jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } },
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('returns a push token without logging it', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'test-private-token' });

  await expect(registerForPushNotificationsAsync()).resolves.toBe('test-private-token');
  expect(log.mock.calls.flat()).not.toContain('test-private-token');
  log.mockRestore();
});

test('listeners forward notification data without logging it', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const received = jest.fn();
  const tapped = jest.fn();
  setupNotificationReceivedListener(received);
  setupNotificationResponseListener(tapped);
  const data = { privateMessage: 'confidential' };
  const notification = { request: { content: { data } } };
  const response = { notification };

  Notifications.addNotificationReceivedListener.mock.calls[0][0](notification);
  Notifications.addNotificationResponseReceivedListener.mock.calls[0][0](response);

  expect(received).toHaveBeenCalledWith(notification);
  expect(tapped).toHaveBeenCalledWith(data);
  expect(log.mock.calls.flat()).not.toContain(notification);
  expect(log.mock.calls.flat()).not.toContain(response);
  log.mockRestore();
});
