import * as Notifications from 'expo-notifications';
import api from '../api';
import { startNotificationListening, stopNotificationListening } from '../notifications';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: 'expo' },
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));
jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));

test('Expo Go on Android leaves an undisplayed notification unread', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  api.get.mockResolvedValue({ data: [{
    id: 2,
    title: 'Private title',
    created_at: '2026-01-01T00:00:01Z',
    is_read: false,
  }] });

  try {
    await startNotificationListening();
    await jest.advanceTimersByTimeAsync(5000);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  } finally {
    stopNotificationListening();
    jest.useRealTimers();
  }
});
