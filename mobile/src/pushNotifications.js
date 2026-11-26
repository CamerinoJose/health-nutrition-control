import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configurar comportamiento de notificaciones cuando la app está en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Obtiene el token de push de Expo
 * @returns {Promise<string|null>} Token de push o null si falla
 */
export async function registerForPushNotificationsAsync() {
  let token;

  // Solo funciona en dispositivos reales
  if (!Device.isDevice) {
    console.log('⚠️ Push notifications solo funcionan en dispositivos físicos');
    return null;
  }

  try {
    // Configurar canal de notificaciones para Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#9b59b6',
        sound: 'default',
      });
    }

    // Pedir permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('⚠️ Permisos de notificaciones no otorgados');
      return null;
    }

    // Obtener token usando el projectId del app.json
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.log('⚠️ No se encontró projectId en la configuración');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    return token;
  } catch (error) {
    console.error('❌ Error obteniendo push token:', error);
    return null;
  }
}

/**
 * Envía el token de push al backend
 * @param {string} token - Token de push de Expo
 * @param {string} authToken - Token JWT de autenticación
 * @param {string} backendUrl - URL del backend
 */
export async function sendPushTokenToBackend(token, authToken, backendUrl) {
  if (!token) {
    console.log('⚠️ No hay token para enviar');
    return;
  }

  try {
    const response = await fetch(`${backendUrl}/api/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ 
        token,
        device_type: Platform.OS,
      }),
    });

    if (response.ok) {
      console.log('✅ Push token enviado al backend correctamente');
      return true;
    } else {
      const error = await response.json();
      console.error('❌ Error enviando token al backend:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error de red enviando token:', error);
    return false;
  }
}

/**
 * Programa una notificación de prueba local
 */
export async function scheduleTestNotification() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 ¡Notificaciones funcionando!',
        body: 'Las notificaciones están configuradas correctamente',
        data: { type: 'test' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
      },
    });
    
    console.log('✅ Notificación de prueba programada');
    return true;
  } catch (error) {
    console.error('❌ Error programando notificación:', error);
    return false;
  }
}

/**
 * Programa notificación de recordatorio de comida
 * @param {string} mealType - Tipo de comida (breakfast, lunch, dinner, snack)
 * @param {Date} scheduledTime - Hora programada
 */
export async function scheduleMealReminder(mealType, scheduledTime) {
  const mealNames = {
    breakfast: 'Desayuno',
    lunch: 'Almuerzo',
    dinner: 'Cena',
    snack: 'Snack',
  };

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🍽️ Hora de ${mealNames[mealType] || 'comer'}`,
        body: 'No olvides seguir tu plan de alimentación',
        data: { type: 'meal_reminder', mealType },
        sound: true,
      },
      trigger: scheduledTime,
    });

    console.log(`✅ Recordatorio de ${mealType} programado para ${scheduledTime}`);
    return true;
  } catch (error) {
    console.error('❌ Error programando recordatorio de comida:', error);
    return false;
  }
}

/**
 * Cancela todas las notificaciones programadas
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ Todas las notificaciones canceladas');
    return true;
  } catch (error) {
    console.error('❌ Error cancelando notificaciones:', error);
    return false;
  }
}

/**
 * Obtiene todas las notificaciones programadas
 */
export async function getScheduledNotifications() {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`📋 Notificaciones programadas: ${notifications.length}`);
    return notifications;
  } catch (error) {
    console.error('❌ Error obteniendo notificaciones programadas:', error);
    return [];
  }
}

/**
 * Configura listener para cuando se recibe una notificación
 * @param {Function} callback - Función a ejecutar cuando llega una notificación
 */
export function setupNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(notification => {
    if (callback) {
      callback(notification);
    }
  });
}

/**
 * Configura listener para cuando el usuario toca una notificación
 * @param {Function} callback - Función a ejecutar cuando el usuario toca la notificación
 */
export function setupNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    
    if (callback) {
      callback(data);
    }
  });
}
