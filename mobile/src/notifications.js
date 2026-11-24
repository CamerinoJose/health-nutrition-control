import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Skip notification setup entirely in Expo Go on Android
if (!isExpoGo || Platform.OS !== 'android') {
  // Configure notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// Polling interval for checking new notifications (in milliseconds)
const NOTIFICATION_POLL_INTERVAL = 5000; // 5 seconds

let notificationPollInterval = null;
let lastCheckedTime = null;
let shownNotificationIds = new Set(); // Track shown notifications to prevent duplicates

/**
 * Start listening for notifications
 * This sets up polling to check the backend for new notifications
 */
export async function startNotificationListening() {
  console.log('[Notifications] Starting notification listening...');

  // Skip push notification registration in Expo Go on Android
  if (isExpoGo && Platform.OS === 'android') {
    console.warn('[Notifications] Running in Expo Go on Android - Skipping push notifications. Polling only.');
    // Still allow polling for notifications, just skip permission request
    lastCheckedTime = new Date();
    
    if (notificationPollInterval) {
      clearInterval(notificationPollInterval);
    }

    notificationPollInterval = setInterval(async () => {
      try {
        await pollForNotifications();
      } catch (err) {
        console.warn('[Notifications] Poll error:', err.message);
      }
    }, NOTIFICATION_POLL_INTERVAL);
    
    return;
  }

  // Request notification permissions for production/dev builds
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[Notifications] Notification permissions not granted');
      return;
    }
  } catch (error) {
    console.warn('[Notifications] Error requesting permissions:', error.message);
    return;
  }

  // Initialize last checked time
  lastCheckedTime = new Date();

  // Start polling for notifications
  if (notificationPollInterval) {
    clearInterval(notificationPollInterval);
  }

  notificationPollInterval = setInterval(async () => {
    try {
      await pollForNotifications();
    } catch (err) {
      console.warn('[Notifications] Poll error:', err.message);
    }
  }, NOTIFICATION_POLL_INTERVAL);

  console.log('[Notifications] Notification polling started');
}

/**
 * Stop listening for notifications
 */
export function stopNotificationListening() {
  if (notificationPollInterval) {
    clearInterval(notificationPollInterval);
    notificationPollInterval = null;
    shownNotificationIds.clear(); // Clear tracked notifications
    lastCheckedTime = null;
    console.log('[Notifications] Notification polling stopped');
  }
}

export async function cancelAccountScheduledNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn('No se pudieron cancelar todas las notificaciones Expo');
  }

  try {
    await AsyncStorage.multiRemove([
      'bienestar_medicine_notif_ids_v1',
      'bienestar_diabetes_notif_ids_v1',
      'bienestar_meal_reminder_ids_v1',
    ]);
  } catch (error) {
    console.warn('No se pudieron limpiar los registros locales de notificaciones');
  }
}

/**
 * Poll the backend for new notifications
 */
async function pollForNotifications() {
  try {
    const response = await api.get('/notifications');
    const notifications = Array.isArray(response.data) ? response.data : [];

    // Check for unread notifications since last check
    if (lastCheckedTime) {
      const now = new Date();
      const newNotifications = notifications.filter(notif => {
        const notifTime = new Date(notif.created_at);
        const isNew = notifTime > lastCheckedTime && !notif.is_read;
        const notShownYet = !shownNotificationIds.has(notif.id);
        return isNew && notShownYet;
      });

      // Show local notification for each new notification and mark as read
      for (const notif of newNotifications) {
        const displayed = await showLocalNotification(notif);
        if (!displayed) return;
        shownNotificationIds.add(notif.id); // Track that we showed this
        // Mark as read immediately to prevent duplicates
        await markNotificationAsRead(notif.id);
      }

      lastCheckedTime = now;
    }
  } catch (err) {
    console.warn('[Notifications] Error polling notifications:', err.message);
  }
}

/**
 * Show a local notification
 */
async function showLocalNotification(notif) {
  // Skip showing notifications in Expo Go on Android
  if (isExpoGo && Platform.OS === 'android') {
    console.log('[Notifications] Skipping notification display in Expo Go');
    return false;
  }
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notif.title || 'Nueva notificación',
        body: notif.message || 'Tienes una nueva notificación',
        data: {
          notificationId: notif.id,
          type: notif.type,
          relatedId: notif.related_id,
        },
      },
      trigger: null, // Show immediately
    });
    return true;
  } catch (err) {
    console.error('[Notifications] Error showing notification');
    return false;
  }
}

/**
 * Handle notification response (when user taps on notification)
 */
export function setupNotificationResponseHandler(onNotificationResponse) {
  // Skip in Expo Go on Android
  if (isExpoGo && Platform.OS === 'android') {
    console.log('[Notifications] Skipping notification response handler in Expo Go');
    return () => {};
  }
  
  if (typeof onNotificationResponse !== 'function') {
    console.warn('[Notifications] onNotificationResponse is not a function');
    return () => {};
  }

  try {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      response => {
        onNotificationResponse(response.notification.request.content.data);
      }
    );

    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  } catch (err) {
    console.error('[Notifications] Error setting up response handler:', err);
    return () => {};
  }
}

/**
 * Fetch and mark notifications as read
 */
export async function fetchUnreadNotifications() {
  try {
    const response = await api.get('/notifications');
    return Array.isArray(response.data) ? response.data : [];
  } catch (err) {
    console.error('[Notifications] Error fetching notifications:', err.message);
    return [];
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId) {
  try {
    await api.put(`/notifications/${notificationId}/read`);
    console.log('[Notifications] Marked notification', notificationId, 'as read');
  } catch (err) {
    console.error('[Notifications] Error marking notification as read:', err.message);
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  try {
    await api.put('/notifications/read-all');
    console.log('[Notifications] Marked all notifications as read');
  } catch (err) {
    console.error('[Notifications] Error marking all as read:', err.message);
  }
}
