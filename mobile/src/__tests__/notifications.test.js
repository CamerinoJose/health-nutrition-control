import * as Notifications from 'expo-notifications';
import api from '../api';
import { startNotificationListening, stopNotificationListening, setupNotificationResponseHandler } from '../notifications';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));
jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  jest.clearAllMocks();
  Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  api.get.mockResolvedValue({ data: [{
    id: 1,
    title: 'Private title',
    message: 'Private message',
    created_at: '2026-01-01T00:00:01Z',
    is_read: false,
  }] });
  api.put.mockResolvedValue({});
});

afterEach(() => {
  stopNotificationListening();
  jest.useRealTimers();
});

test('retries a notification when display fails without marking it read', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  Notifications.scheduleNotificationAsync
    .mockRejectedValueOnce(new Error('display failed'))
    .mockResolvedValueOnce('scheduled');
  await startNotificationListening();

  await jest.advanceTimersByTimeAsync(5000);
  expect(api.put).not.toHaveBeenCalled();

  await jest.advanceTimersByTimeAsync(5000);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  expect(api.put).toHaveBeenCalledWith('/notifications/1/read');
  expect(log.mock.calls.flat()).not.toContain('Private title');
  log.mockRestore();
});

test('notification callbacks do not log notification content', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const callback = jest.fn();
  setupNotificationResponseHandler(callback);
  const listener = Notifications.addNotificationResponseReceivedListener.mock.calls[0][0];
  const data = { privateMessage: 'confidential' };

  listener({ notification: { request: { content: { data } } } });

  expect(callback).toHaveBeenCalledWith(data);
  expect(log.mock.calls.flat()).not.toContain(data);
  log.mockRestore();
});
