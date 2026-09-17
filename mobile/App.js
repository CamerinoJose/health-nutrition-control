import ActivateNotificationsScreen from './src/ActivateNotificationsScreen'
import React, {useState, useEffect, useRef} from 'react'
import { FlatList } from 'react-native'
import * as Notifications from 'expo-notifications'
// Simple in-app log buffer for debugging
const logBuffer = [];
function addLog(msg) {
  if (logBuffer.length > 20) logBuffer.shift();
  logBuffer.push(msg);
}
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { View, Text, Button, StyleSheet, TextInput, TouchableOpacity, Animated, Image, ImageBackground, ScrollView, RefreshControl, Modal, Platform, LogBox } from 'react-native'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'
import * as SplashScreen from 'expo-splash-screen'
import * as Linking from 'expo-linking'
import './src/i18n'
import { useTranslation } from 'react-i18next'
import api from './src/api'
import MedicinesScreen from './MedicinesScreen'
import DiabetesNotificationsScreen from './src/DiabetesNotificationsScreen'
import { saveToken, getToken, clearToken } from './src/auth'
import { startNotificationListening, stopNotificationListening, setupNotificationResponseHandler } from './src/notifications'
import MealPlanScreen from './src/MealPlanScreen'
import ProgressScreen from './src/ProgressScreen'
import MessagesScreen from './src/MessagesScreen'
import SupportScreen from './src/SupportScreen'
import AchievementsScreen from './src/AchievementsScreen'
import AppointmentsScreen from './src/AppointmentsScreen'
import RecipesScreen from './src/RecipesScreen'
import SettingsScreen from './src/SettingsScreen'
import GeminiChatScreen from './src/GeminiChatScreen'
import NutritionistSelectionScreen from './src/NutritionistSelectionScreen'
import NutritionistPatientsScreen from './src/nutritionist/PatientsScreen'
import NutritionistCalendarScreen from './src/nutritionist/CalendarScreen'
import NutritionistRecipesScreen from './src/nutritionist/RecipesScreen'
import NutritionistRecommendationsScreen from './src/nutritionist/RecommendationsScreen'
import NutritionistMealPlansScreen from './src/nutritionist/MealPlansScreen'
import ContactRequiredScreen from './src/ContactRequiredScreen'
import DashboardScreen from './src/DashboardScreen'

// Configura tu URL de backend
const BACKEND_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://health-nutrition-control.onrender.com').replace(/\/api$/, '')

// Función para determinar la temporada actual
function getCurrentSeason() {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return 'spring';  // Primavera: Marzo-Mayo
  if (month >= 6 && month <= 8) return 'summer';  // Verano: Junio-Agosto
  if (month >= 9 && month <= 11) return 'fall';   // Otoño: Septiembre-Noviembre
  return 'winter';  // Invierno: Diciembre-Febrero
}

// Función para obtener imagen de comida saludable según la temporada
function getSeasonalFoodImage() {
  const season = getCurrentSeason();
  const seasonalFoods = {
    spring: 'spring-vegetables-asparagus-peas',
    summer: 'summer-berries-watermelon-salad',
    fall: 'autumn-pumpkin-squash-vegetables',
    winter: 'winter-citrus-oranges-vegetables'
  };
  
  // Usando Unsplash Source API para imágenes aleatorias de comida saludable según temporada
  const query = seasonalFoods[season];
  return `https://source.unsplash.com/800x400/?healthy-food,${query}`;
}

WebBrowser.maybeCompleteAuthSession();

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
  'i18next::pluralResolver: Your environment seems not to be Intl API compatible',
]);

// Evita que la pantalla de bienvenida se oculte automáticamente
SplashScreen.preventAutoHideAsync().catch(err => {
  console.warn('SplashScreen preventAutoHide failed:', err);
});

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

function AppContent() {
      // ...medicine logic moved to MedicinesScreen.js
    // Configuración de notificaciones locales
    useEffect(() => {
      if (Platform.OS === 'web' || (Constants.appOwnership === 'expo' && Platform.OS === 'android')) {
        return;
      }

      // Solicitar permisos al iniciar la app
      (async () => {
        try {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'default',
              importance: Notifications.AndroidImportance.HIGH,
            });
          }

          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') {
            alert('Permiso de notificaciones no concedido');
          }
        } catch (error) {
          console.warn('No se pudo solicitar permisos de notificación:', error?.message || error);
        }
      })();

      // Listener para manejar cuando el usuario toca la notificación
      const subscription = Notifications.addNotificationResponseReceivedListener(response => {
        // Ejemplo: redirigir a la pantalla de recomendaciones
        setView('mealplan');
      });
      return () => subscription.remove();
    }, []);

    // Función de ejemplo para programar una notificación local
    async function programarNotificacionComida() {
      if (Constants.appOwnership === 'expo' && Platform.OS === 'android') {
        alert('En Expo Go Android esta función no está disponible. Usa el APK de desarrollo.');
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '¡Hora de preparar tu comida!',
          body: 'Revisa tus recomendaciones y prepárate para tu próxima comida.',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 12, // Cambia la hora según tu preferencia
          minute: 0,
          ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
        },
      });
      alert('Notificación diaria programada a las 12:00');
    }
  const { t, i18n } = useTranslation()
  const isExpoGo = Constants.appOwnership === 'expo'
  const isAndroid = Platform.OS === 'android'
  const skipNotifications = isExpoGo && isAndroid
  const [appIsReady, setAppIsReady] = useState(false);
  const [token, setToken] = useState(null)
  const [view, setView] = useState('home') // home | login | register | dashboard | mealplan | progress | achievements | recipes | appointments | messages | support | settings
  const [postLoginTarget, setPostLoginTarget] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [profile, setProfile] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [todayMeals, setTodayMeals] = useState([])
  const [loadingMeals, setLoadingMeals] = useState(false)
    const [displayedDay, setDisplayedDay] = useState('')
  const [upcomingAppointments, setUpcomingAppointments] = useState([])
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState(null)
  const drawerAnim = useRef(new Animated.Value(-260)).current
  const [imageError, setImageError] = useState(false)
  // home | login | register | dashboard | mealplan | progress | achievements | recipes | appointments | messages | support | settings | gemini

  const isNutritionist = profile?.role === 'nutritionist' || profile?.role === 'admin'
  
  // Store deeplink listener for cleanup
  const deeplinkListenerRef = useRef(null);
  const authHandledRef = useRef(false); // tracks if a login flow already completed

  const featureCards = [
    { icon: '📊', title: t('home_feature_progress'), desc: t('home_feature_progress_desc') },
    { icon: '📝', title: t('home_feature_ocr'), desc: t('home_feature_ocr_desc') },
    { icon: '🍱', title: t('home_feature_mealplan'), desc: t('home_feature_mealplan_desc') },
    { icon: '💊', title: t('home_feature_medicines') || 'Medicinas', desc: t('home_feature_medicines_desc') || 'Gestiona tus medicinas y programa recordatorios.' },
    { icon: '💬', title: t('home_feature_support'), desc: t('home_feature_support_desc') },
  ]

  const steps = [
    { label: '1', title: t('home_step1_title'), desc: t('home_step1_desc') },
    { label: '2', title: t('home_step2_title'), desc: t('home_step2_desc') },
    { label: '3', title: t('home_step3_title'), desc: t('home_step3_desc') },
  ]

  const highlights = []

  // --- Google Auth: Usar callback directo del backend ---
  async function handleGoogleLogin() {
    if (Constants.appOwnership === 'expo' && Platform.OS === 'android') {
      alert('Google login en Expo Go Android puede fallar con deep links. Usa login con email/contraseña o el APK de desarrollo.');
      return;
    }

    authHandledRef.current = false;
    try {
      // Crear el redirect URL que el backend debe usar
      const redirectUrl = Linking.createURL('oauth-callback');
      
      // Construir la URL de auth con el redirect_uri como parámetro
      const authUrl = `${BACKEND_URL}/api/auth/google?redirect_uri=${encodeURIComponent(redirectUrl)}`;
      
      console.log('Auth URL:', authUrl);
      console.log('Redirect URL:', redirectUrl);
      console.log('Opening browser for OAuth...');
      
      // Abrir el navegador para OAuth
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl, 
        redirectUrl
      );
      
      console.log('openAuthSessionAsync result:', result.type);
      
      // If the browser was dismissed (user closed manually or system closed it)
      if (result.type === 'dismiss' || result.type === 'cancel') {
        console.log('Browser was dismissed, checking if auth completed...');
        
        // Wait a bit for deep link to process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if we got a token from the deep link
        const existingToken = await getToken();
        if (existingToken) {
          console.log('Token found after browser dismissal - auth succeeded');
          return;
        } else {
          console.log('No token found - user cancelled auth');
          return;
        }
      }

      console.log('Navegador cerrado, handleDeepLink debería procesar el token...');

      if (authHandledRef.current) {
        console.log('Deep link already processed during auth session; skipping fallback.');
        return;
      }

      const existingToken = await getToken();
      if (existingToken) {
        console.log('Token already present after auth session; skipping fallback.');
        authHandledRef.current = true;
        return;
      }

      console.log('Browser closed, polling backend for token...');
      const token = await pollForToken();
      
      if (token) {
        authHandledRef.current = true;
        await completeLogin(token, '¡Bienvenido con Google!');
      } else {
        console.log('No token from backend, will wait for deep link...');
      }
      
    } catch (e) {
      console.warn('Google login error:', e);
      alert('Error en login: ' + (e?.message || 'Desconocido')); 
    }
  }

  function extractAccessToken(url) {
    try {
      console.log('Extracting token from URL:', url);
      
      // Try to parse as URL
      try {
        const urlObj = new URL(url);
        
        // Intentar obtener de hash (#token=...)
        const hash = url.split('#')[1];
        if (hash) {
          console.log('Hash found:', hash);
          const params = new URLSearchParams(hash);
          const token = params.get('access_token') || params.get('token');
          if (token) {
            console.log('Token found in hash');
            return token;
          }
        }
        
        // Intentar obtener de query params (?token=...)
        const token = urlObj.searchParams.get('token') || urlObj.searchParams.get('access_token');
        if (token) {
          console.log('Token found in query params');
          return token;
        }
        
        console.log('No token found in parsed URL');
        console.log('URL params:', Array.from(urlObj.searchParams.entries()));
      } catch (parseErr) {
        console.log('Could not parse as URL, trying string split:', parseErr.message);
        
        // Fallback: try manual parsing
        if (url.includes('?token=')) {
          const match = url.match(/[?&]token=([^&]*)/);
          if (match && match[1]) {
            const token = decodeURIComponent(match[1]);
            console.log('Token found in query string (regex)');
            return token;
          }
        }
      }
      
      console.log('No token found in URL');
      return null;
    } catch (err) {
      console.warn('Error parsing token from url', url, err);
      return null;
    }
  }

  async function completeLogin(token, welcomeMessage = '¡Bienvenido!') {
    console.log('[completeLogin] Finalizing login with token length:', token?.length);
    await saveToken(token);
    setToken(token);
    setEmail('');
    setPassword('');

    const nextView = postLoginTarget || 'home'
    setPostLoginTarget(null)

    try {
      console.log('[completeLogin] Fetching profile...');
      const loadedProfile = await fetchProfile(token);
      console.log('[completeLogin] Profile fetched successfully, setting view to dashboard');
      setView(loadedProfile?.contact_preference && (loadedProfile.contact_preference === 'app' || loadedProfile.phone)
        ? nextView
        : 'required-contact');
    } catch (e) {
      console.warn('[completeLogin] Profile fetch failed:', e);
      setView(nextView);
    }
  }

  function goToProtected(target) {
    if (token) {
      setView(target)
      return
    }
    setPostLoginTarget(target)
    setView('login')
  }

  // Handle deep link from OAuth callback
  async function handleDeepLink(event) {
    console.log('=== HANDLE DEEP LINK TRIGGERED ===');
    console.log('Deep link received:', event.url);
    const url = event.url;
    
    // Check for token in URL FIRST
    const token = extractAccessToken(url);
    console.log('Token extraction result:', token ? 'FOUND' : 'NOT FOUND');
    
    if (token) {
      authHandledRef.current = true;
      console.log('Token extracted from deep link, length:', token.length);
      
      // Close the browser immediately after getting the token
      setTimeout(() => {
        try {
          WebBrowser.dismissBrowser();
        } catch (e) {
          console.log('Browser already closed');
        }
      }, 100);
      
      await completeLogin(token, '¡Bienvenido con Google!');
    } else {
      console.log('No token found in deep link URL, checking AsyncStorage...');
      // Try to get token from storage (in case it was saved elsewhere)
      const storedToken = await getToken();
      if (storedToken) {
        console.log('Found token in storage from previous save');
        authHandledRef.current = true;
        await completeLogin(storedToken, '¡Bienvenido con Google!');
      } else {
        console.log('No token found anywhere, staying on login');
      }
    }
  }

  useEffect(() => {
    async function prepare() {
      try {
        console.log('App initializing...');
        setAppIsReady(true); // Set ready FIRST to show something
        
        const tk = await getToken();
        if (tk) {
          console.log('Token found, setting...');
          setToken(tk);
          setView('home');
          // Start listening for notifications (skip in Expo Go on Android)
          if (!skipNotifications) {
            await startNotificationListening();
          } else {
            console.log('Skipping notification listener (Expo Go on Android)');
          }
          // Fetch profile in background, don't wait
          fetchProfile(tk).catch(e => console.warn('Profile fetch failed:', e));
        }
        
        // Check for initial URL from cold start
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl != null) {
          console.log('Initial URL from cold start:', initialUrl);
          const token = extractAccessToken(initialUrl);
          if (token) {
            await saveToken(token);
            setToken(token);
            setView('home');
            if (!skipNotifications) {
              await startNotificationListening();
            } else {
              console.log('Skipping notification listener (Expo Go on Android)');
            }
            fetchProfile(token).catch(e => console.warn('Profile fetch failed:', e));
          }
        }
        
        // Hide splash screen with error handling
        setTimeout(() => {
          SplashScreen.hideAsync().catch(err => {
            console.warn('Hide splash failed:', err);
          });
        }, 100);
      } catch (e) {
        console.warn('Prepare error:', e);
        setAppIsReady(true); // Still show app even if error
      }
    }

    prepare();
    
    const subscription = Linking.addEventListener('url', handleDeepLink);
    deeplinkListenerRef.current = subscription;

    // Setup notification response handler
    const unsubscribeNotificationResponse = setupNotificationResponseHandler((data) => {
      console.log('[App] Notification tapped:', data);
      if (data.type === 'message') {
        // Navegar a la pantalla de mensajes
        // La lista de conversaciones mostrará unread_count para guiar al usuario
        setView('messages');
      }
    });
    
    return () => {
      if (deeplinkListenerRef.current) {
        deeplinkListenerRef.current.remove();
      }
      if (typeof unsubscribeNotificationResponse === 'function') {
        unsubscribeNotificationResponse();
      }
    };
  }, []);

  async function fetchProfile(tk){
    try{
      console.log('fetchProfile: Making API call to /me with token:', tk.substring(0, 20) + '...');
      const res = await api.get('/me',{ headers: { Authorization: `Bearer ${tk}` } })
      console.log('fetchProfile: Response received:', res.data);

      // Ensure nutritionist fields exist so messaging can prioritize the assigned nutritionist
      const enhancedProfile = {
        ...res.data,
        nutritionist_id: res.data?.nutritionist_id ?? null,
        nutritionist_name: res.data?.nutritionist_name ?? (res.data?.nutritionist_id ? 'Mi nutriólogo' : null),
      };

        setProfile(enhancedProfile)
        if (!enhancedProfile.contact_preference || (enhancedProfile.contact_preference === 'phone' && !enhancedProfile.phone)) {
          setView('required-contact')
        }

          // Send nutritionists/admins to dashboard by default
          const contactIncomplete = !enhancedProfile.contact_preference ||
            (enhancedProfile.contact_preference === 'phone' && !enhancedProfile.phone)
          if (!contactIncomplete && (res.data?.role === 'nutritionist' || res.data?.role === 'admin')) {
            setView(prev => (prev === 'nutri-patients' || prev === 'home') ? 'dashboard' : prev)
          }

        // Load today's meals after profile is loaded
        await loadTodayMeals(tk);
        // Load upcoming appointments summary
        await loadUpcomingAppointments(tk);
        return enhancedProfile;
    }catch(e){ 
      console.warn('fetchProfile: Error -', e.message, e.response?.status, e.response?.data);
      throw e;
    }
  }

  async function loadTodayMeals(tk) {
    try {
      setLoadingMeals(true);
      const today = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const spanishDays = {
        'Sunday': 'Domingo',
        'Monday': 'Lunes',
        'Tuesday': 'Martes',
        'Wednesday': 'Miércoles',
        'Thursday': 'Jueves',
        'Friday': 'Viernes',
        'Saturday': 'Sábado'
      };
      const dayName = dayNames[today.getDay()];
      const spanishDayName = spanishDays[dayName];
      
      console.log('[LoadTodayMeals] Loading meals for day:', spanishDayName);
      
      const response = await api.get('/meal-plan', {
        headers: { Authorization: `Bearer ${tk}` }
      });
      
      const { meals } = response.data;
      
      // Filter meals for today
      let todaysMeals = meals.filter(m => m.day_of_week === spanishDayName);
      let effectiveDay = spanishDayName;

      // Fallback: if today has no meals (e.g., Sunday not in plan), show the most recent available day
      if (todaysMeals.length === 0 && meals.length > 0) {
        const preferredFallback = spanishDayName === 'Domingo' ? 'Sábado' : null;
        const candidateDay = preferredFallback && meals.some(m => m.day_of_week === preferredFallback)
          ? preferredFallback
          : meals[0].day_of_week;
        todaysMeals = meals.filter(m => m.day_of_week === candidateDay);
        effectiveDay = candidateDay;
        console.log('[LoadTodayMeals] No meals for today, falling back to', candidateDay);
      }
      
      console.log('[LoadTodayMeals] Found', todaysMeals.length, 'meals for day', effectiveDay);
      setTodayMeals(todaysMeals);
      setDisplayedDay(effectiveDay);
    } catch (error) {
      console.warn('[LoadTodayMeals] Error:', error.message);
      setTodayMeals([]);
      setDisplayedDay('');
    } finally {
      setLoadingMeals(false);
    }
  }

  async function loadUpcomingAppointments(tk) {
    try {
      setLoadingAppointments(true);
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const res = await api.get(`/appointments`, {
        headers: { Authorization: `Bearer ${tk}` }
      });
      const list = Array.isArray(res.data) ? res.data : [];
      console.log('[Appointments] API returned', list.length, 'records');
      console.log('[Appointments] todayStr:', todayStr);
      
      // Only today or future, compare by date string to avoid TZ shift issues
      const upcoming = list
        .filter(a => {
          const d = (a.appointment_date || '').slice(0,10);
          const passes = d && d >= todayStr;
          console.log('[Appointments] Checking:', a.title, '| date:', d, '| passes:', passes);
          return passes;
        })
        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
        .slice(0, 2); // show next 2
      setUpcomingAppointments(upcoming);
      console.log('[Appointments] Loaded', upcoming.length, 'upcoming appointments');
    } catch (error) {
      console.warn('[Appointments] Error:', error.message);
      setUpcomingAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  }


  async function refreshProfile() {
    if (!token) return;
    try {
      await fetchProfile(token);
    } catch (e) {
      console.warn('refreshProfile: unable to refresh profile', e?.message || e);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
      if (token) {
        await loadTodayMeals(token);
        await loadUpcomingAppointments(token);
      }
    } catch (e) {
      console.warn('onRefresh error:', e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }

  async function pollForToken(maxAttempts = 10) {
    console.log('Polling backend for token...');
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await api.get('/auth/last-token');
        if (response.data && response.data.token) {
          console.log('Token found! Attempt:', i + 1);
          return response.data.token;
        }
      } catch (e) {
        // Token not ready yet, continue polling
        console.log('Poll attempt', i + 1, '- no token yet');
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log('No token found after', maxAttempts, 'attempts');
    return null;
  }

  async function handleLogin() {
    try {
      const res = await api.post('/login', { email, password });
      const tk = res.data.token;
      await completeLogin(tk, '¡Bienvenido!');
    } catch (e) {
      if (e.response?.status === 401) {
        alert('Credenciales incorrectas');
      } else {
        alert('Error al iniciar sesión');
      }
    }
  }

  async function handleRegister(){
    try{
      await api.post('/register',{ name, email, password })
      alert('Cuenta creada, ahora inicia sesión')
      setName('')
      setEmail('')
      setPassword('')
      setView('login')
    }catch(e){
      if(e.response?.status === 409){
        alert('El correo ya está registrado')
      }else{
        alert('Error al registrar')
      }
    }
  }

  async function handleLogout(){
    stopNotificationListening();
    await clearToken()
    setToken(null)
    setProfile(null)
    setDrawerOpen(false)
    setView('home')
  }

  function openDrawer() {
    setDrawerOpen(true)
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }

  function closeDrawer() {
    Animated.timing(drawerAnim, {
      toValue: -260,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDrawerOpen(false)
    })
  }

  function toggleDrawer() {
    if (drawerOpen) {
      closeDrawer()
    } else {
      openDrawer()
    }
  }

  function getBackTarget(currentView) {
    if (currentView === 'diabetesNotifications') return 'profile'
    if (currentView === 'medicinas') return 'home'
    if (currentView === 'login' || currentView === 'register') return 'home'
    if (currentView === 'dashboard') return 'home'
    return 'home'
  }

  function handleBackPress() {
    if (drawerOpen) {
      closeDrawer()
      return
    }
    setView(getBackTarget(view))
  }

  function navigate(nextView) {
    console.log('[navigate] Changing view to:', nextView)
    setView(nextView)
    setDrawerOpen(false)
  }

  // Guard: wait for app to be ready before rendering
  if (!appIsReady) {
    console.log('[App] Not ready, showing splash/loading screen');
    return (
      <View style={{flex: 1, backgroundColor: '#4CAF50'}}>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20}}>
          <Text style={{color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 10}}>Control de Salud</Text>
          <Text style={{color: '#fff', fontSize: 16}}>Cargando...</Text>
        </View>
      </View>
    );
  }

  const renderContent = () => {
    if (view === 'required-contact') {
      return (
        <ContactRequiredScreen
          profile={profile}
          onSaved={(updatedProfile) => {
            setProfile(updatedProfile)
            setView('dashboard')
          }}
        />
      )
    }
    if ((view === 'home' || view === 'dashboard') && token && profile) {
      return <DashboardScreen onNavigate={navigate} profile={profile} />
    }
    if (view === 'medicinas') {
      console.log('[renderContent] Showing MedicinesScreen');
      return <MedicinesScreen onBack={() => { console.log('[MedicinesScreen] onBack called, setting view to home'); setView('home'); }} />;
    }
    if (view === 'diabetesNotifications') {
      console.log('[renderContent] Showing DiabetesNotificationsScreen');
      return <DiabetesNotificationsScreen onBack={() => { console.log('[DiabetesNotificationsScreen] onBack called, setting view to profile'); setView('profile'); }} />;
    }
    if (view === 'profile') {
      const ProfileScreen = require('./src/ProfileScreen').default;
      return (
        <ProfileScreen
          onNavigate={(v) => setView(v)}
          accountProfile={profile}
          onAccountProfileUpdated={setProfile}
        />
      );
    }
    try {
      if (view === 'login') {
        return (
          <View style={{flex: 1, justifyContent: 'center', padding: 20}}>
            <Text style={styles.formTitle}>Iniciar Sesión</Text>
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <Button title="Login" onPress={handleLogin} />
            <View style={{marginVertical: 20}}>
              <Text style={{textAlign: 'center', color: '#666', marginBottom: 10}}>O inicia sesión con:</Text>
              <TouchableOpacity 
                style={{
                  backgroundColor: '#fff', 
                  padding: 12, 
                  borderRadius: 8, 
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#dadce0',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2
                }}
                onPress={handleGoogleLogin}
              >
                <View style={{marginRight: 12, backgroundColor: '#fff', borderRadius: 2}}>
                  <Text style={{fontSize: 18, fontWeight: '700', color: '#4285F4'}}>G</Text>
                </View>
                <Text style={{fontSize: 16, fontWeight: '500', color: '#3c4043'}}>Continuar con Google</Text>
              </TouchableOpacity>
            </View>
            <Button title="Volver" onPress={() => setView('home')} />
          </View>
        );
      }
      if (view === 'register') {
        return (
          <View style={{flex: 1, justifyContent: 'center', padding: 20}}>
            <Text style={styles.formTitle}>Registrarse</Text>
            <TextInput style={styles.input} placeholder="Nombre" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <Button title="Register" onPress={handleRegister} />
            <Button title="Volver" onPress={() => setView('home')} />
          </View>
        );
      }


        if (view === 'activate-notifications') {
          return <ActivateNotificationsScreen onNavigate={navigate} onRefreshProfile={refreshProfile} profile={profile} />;
        }

        if (view === 'dashboard') {
          return (
            <View style={{flex: 1, backgroundColor: '#f5f7fa'}}>
              {/* Banner para activar notificaciones si están inactivas */}
              {profile?.enable_reminders === false && (
                <View style={{backgroundColor: '#fff3cd', borderColor: '#ffeeba', borderWidth: 1, padding: 16, margin: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                  <View style={{flex: 1}}>
                    <Text style={{color: '#856404', fontWeight: 'bold', marginBottom: 4}}>Notificaciones desactivadas</Text>
                    <Text style={{color: '#856404'}}>Activa los recordatorios para recibir alertas de comidas y citas.</Text>
                  </View>
                  <TouchableOpacity style={{backgroundColor: '#ffe082', padding: 10, borderRadius: 6, marginLeft: 12}} onPress={() => navigate('activate-notifications')}>
                    <Text style={{color: '#856404', fontWeight: 'bold'}}>Activar</Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* ...existing dashboard code... */}
            </View>
          );
        }

        if (view === 'nutri-patients') {
          return <NutritionistPatientsScreen onNavigate={navigate} />
        }

        if (view === 'nutri-calendar') {
          return <NutritionistCalendarScreen onNavigate={navigate} />
        }

        if (view === 'nutri-recipes') {
          return <NutritionistRecipesScreen onNavigate={navigate} />
        }

        if (view === 'nutri-recommendations') {
          return <NutritionistRecommendationsScreen onNavigate={navigate} />
        }

        if (view === 'nutri-meal-plans') {
          return <NutritionistMealPlansScreen onNavigate={navigate} />
        }

      if (view === 'mealplan') {
        return <MealPlanScreen onNavigate={navigate} />
      }

      if (view === 'progress') {
        return <ProgressScreen onNavigate={navigate} />
      }

      if (view === 'messages') {
        return <MessagesScreen onNavigate={navigate} profile={profile} />
      }

      if (view === 'support') {
        return <SupportScreen onNavigate={navigate} />
      }

      if (view === 'appointments') {
        return <AppointmentsScreen onNavigate={navigate} />
      }

      if (view === 'recipes') {
        return <RecipesScreen onNavigate={navigate} />
      }

      if (view === 'achievements') {
        return <AchievementsScreen onNavigate={navigate} />
      }

      if (view === 'settings') {
        return <SettingsScreen onNavigate={navigate} onLogout={handleLogout} onRefreshProfile={refreshProfile} profile={profile} />
      }

      if (view === 'nutritionist-selection') {
        return <NutritionistSelectionScreen onNavigate={navigate} onAssigned={refreshProfile} />
      }

      if (view === 'gemini') {
        return <GeminiChatScreen onNavigate={navigate} profile={profile} />
      }
      
      return (
        <ScrollView style={{flex: 1, backgroundColor: '#f5f7fa'}} contentContainerStyle={{paddingBottom: 24}}>
          <ImageBackground
            source={{ uri: getSeasonalFoodImage() }}
            style={{minHeight: 340}}
            resizeMode="cover"
            onError={(e) => {
              console.log('Background image failed to load:', e.nativeEvent.error);
              setImageError(true);
            }}
          >
            <View style={{
              flex: 1,
              minHeight: 340,
              backgroundColor: imageError ? 'rgba(45, 80, 22, 0.85)' : 'rgba(0, 0, 0, 0.5)',
              paddingHorizontal: 20,
              paddingTop: 28,
              paddingBottom: 18,
              justifyContent: 'flex-end',
            }}>
              <Text style={{fontSize: 30, fontWeight: '800', color: '#fff', marginBottom: 8}}>
                {t('welcome_title') || 'BienestarApp'}
              </Text>
              <Text style={{fontSize: 16, color: '#fff', marginBottom: 16, opacity: 0.95}}>
                {t('welcome_subtitle') || 'Tu salud, nuestra prioridad'}
              </Text>

              {!token && (
                <View style={{flexDirection: 'row', gap: 10, marginBottom: 14}}>
                  <TouchableOpacity
                    style={{flex: 1, backgroundColor: '#4CAF50', paddingVertical: 14, borderRadius: 10, alignItems: 'center'}}
                    onPress={() => setView('login')}
                  >
                    <Text style={{color: '#fff', fontSize: 16, fontWeight: '700'}}>{t('login') || 'Iniciar Sesión'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.9)', paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#fff', alignItems: 'center'}}
                    onPress={() => setView('register')}
                  >
                    <Text style={{color: '#2d5016', fontSize: 16, fontWeight: '700'}}>{t('register') || 'Registrarse'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12}}>
                <Text style={{color: '#fff', fontWeight: '800', marginBottom: 4}}>
                  💡 {t('dailyRecommendation') || 'Recomendación del día'}
                </Text>
                <Text style={{color: '#fff', opacity: 0.95}}>{t('seasonalTip') || 'Pequeños cambios diarios hacen una gran diferencia.'}</Text>
              </View>
            </View>
          </ImageBackground>

          <View style={{paddingHorizontal: 16, marginTop: 16}}>
            <Text style={{fontSize: 18, fontWeight: '800', marginBottom: 10}}>{t('home_feature_title') || t('home_features') || 'Funciones principales'}</Text>
            <View style={{gap: 10}}>
              {featureCards.map((f) => {
                const target = f.icon === '📊'
                  ? 'progress'
                  : f.icon === '📝'
                    ? 'profile'
                    : f.icon === '🍱'
                      ? 'mealplan'
                      : f.icon === '💊'
                        ? 'medicinas'
                      : 'support'

                return (
                  <TouchableOpacity
                    key={f.title}
                    style={{backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e9eef5'}}
                    onPress={() => goToProtected(target)}
                    activeOpacity={0.8}
                  >
                    <View style={{width: 44, height: 44, borderRadius: 12, backgroundColor: '#f5f7fa', alignItems: 'center', justifyContent: 'center', marginRight: 12}}>
                      <Text style={{fontSize: 22}}>{f.icon}</Text>
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={{fontSize: 16, fontWeight: '800', marginBottom: 2}}>{f.title}</Text>
                      <Text style={{color: '#566', lineHeight: 18}}>{f.desc}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={{paddingHorizontal: 16, marginTop: 18}}>
            <Text style={{fontSize: 18, fontWeight: '800', marginBottom: 6}}>{t('home_steps_title') || 'Cómo funciona'}</Text>
            <Text style={{color: '#566', marginBottom: 10}}>{t('home_steps_subtitle') || 'En 3 pasos'}</Text>

            <View style={{gap: 10}}>
              {steps.map((s) => (
                <View key={s.label} style={{backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', borderWidth: 1, borderColor: '#e9eef5'}}>
                  <View style={{width: 34, height: 34, borderRadius: 10, backgroundColor: '#f5f7fa', alignItems: 'center', justifyContent: 'center', marginRight: 12}}>
                    <Text style={{fontWeight: '900'}}>{s.label}</Text>
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={{fontSize: 15, fontWeight: '800', marginBottom: 2}}>{s.title}</Text>
                    <Text style={{color: '#566', lineHeight: 18}}>{s.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      );
    } catch (err) {
      console.error('renderContent error:', err);
      return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20}}>
          <Text style={{color: '#f00', fontSize: 14}}>Error: {err.message}</Text>
        </View>
      );
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
          {view !== 'home' && (
            <TouchableOpacity onPress={handleBackPress} style={{paddingVertical: 6, paddingHorizontal: 8}}>
              <Text style={{fontSize: 20}}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={{fontSize: 20, fontWeight: 'bold', color: '#1e88e5'}}>BIENESTAR</Text>
        </View>
        <TouchableOpacity onPress={toggleDrawer} style={{marginLeft: 10}}>
          <Text style={{fontSize: 24}}>☰</Text>
        </TouchableOpacity>
      </View>
      {renderContent()}
      {/* Drawer lateral */}
      {drawerOpen && (
        <View style={styles.drawerOverlay}>
          <Animated.View style={[styles.drawerPane, { transform: [{ translateX: drawerAnim }] }]}> 
            <Text style={{fontWeight: 'bold', fontSize: 18, marginBottom: 16}}>Menú</Text>
            <TouchableOpacity style={styles.navButton} onPress={() => { setView('home'); closeDrawer(); }}>
              <Text style={styles.navButtonText}>🏠 Inicio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => { setView('profile'); closeDrawer(); }}>
              <Text style={styles.navButtonText}>👤 Perfil de Salud</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => { setView('mealplan'); closeDrawer(); }}>
              <Text style={styles.navButtonText}>🍱 Plan de Comidas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => { setView('appointments'); closeDrawer(); }}>
              <Text style={styles.navButtonText}>📅 Citas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => { setView('progress'); closeDrawer(); }}>
              <Text style={styles.navButtonText}>📊 Progreso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => { setView('messages'); closeDrawer(); }}>
              <Text style={styles.navButtonText}>💬 Mensajes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => { setView('settings'); closeDrawer(); }}>
              <Text style={styles.navButtonText}>⚙️ Ajustes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity style={styles.drawerBackdrop} onPress={closeDrawer} />
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f7fa' 
  },
  header: { 
    flexDirection: 'row', 
    padding: 12, 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: '#fff',
    height: 70,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  logo: { 
    width: 120, 
    height: 35, 
    resizeMode: 'contain' 
  },
  lang: { 
    flexDirection: 'row', 
    width: 100, 
    justifyContent: 'space-between' 
  },
  main: { 
    alignItems: 'center', 
    justifyContent: 'flex-start', 
    paddingTop: 20,
    paddingBottom: 40
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 12, 
    backgroundColor: '#fff',
    fontSize: 16
  },

  heroSection: {
    width: '100%',
    height: 500,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#2d5016',
  },
  heroImageStyle: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '85%',
    maxWidth: 280,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '85%',
    maxWidth: 280,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  googleButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4285F4',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButtonText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 320,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e88e5',
    marginBottom: 20,
    textAlign: 'center',
  },
  dailyTip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    width: '90%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  tipContent: {
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 20,
  },
  authActions: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
    gap: 12,
  },
  heroWrap: {
    width: '100%',
    alignItems: 'center',
  },
  heroBadge: {
    backgroundColor: 'rgba(30, 58, 138, 0.9)',
    color: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    fontWeight: '700',
    marginBottom: 12,
    fontSize: 12,
  },
  highlightGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 14,
  },
  highlightPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 12,
    minWidth: 130,
    maxWidth: 170,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    margin: 6,
  },
  highlightBadge: {
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    fontSize: 14,
  },
  highlightText: {
    color: '#fff',
    fontSize: 12,
  },
  featureGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    width: '46%',
    minWidth: 150,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    margin: 5,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureTitle: {
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
    color: '#111827',
  },
  featureDesc: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 18,
  },
  stepsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  stepsHeader: {
    marginBottom: 10,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  stepsSubtitle: {
    color: '#4b5563',
    marginTop: 2,
  },
  stepsGrid: {
    flexDirection: 'column',
    marginTop: 6,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  stepLabel: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  stepDesc: {
    color: '#4b5563',
    fontSize: 13,
    marginTop: 2,
  },
  linkText: {
    color: '#1e88e5',
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  loggedHome: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  profileLine: {
    color: '#4b5563',
    marginBottom: 6,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  navButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    margin: 4,
  },
  navButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#ef4444',
    borderRadius: 10,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
  },
  // Dashboard styles
  dashboardHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  menuIcon: {
    fontSize: 18,
    color: '#0f172a',
  },
  dashboardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dashboardGreeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  dashboardSub: {
    color: '#475569',
    marginTop: 4,
  },
  logoutBadge: {
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  logoutBadgeText: {
    color: '#fff',
    fontWeight: '700',
  },
  notificationBanner: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 6,
  },
  notificationText: {
    fontSize: 14,
    color: '#1e3a8a',
    marginBottom: 12,
    lineHeight: 20,
  },
  notificationButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  notificationButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  nutritionistCard: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  nutritionistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nutritionistIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  nutritionistLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 2,
  },
  nutritionistName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  nutritionistContact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    marginBottom: 12,
  },
  nutritionistContactLabel: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '500',
  },
  changeNutritionistButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  changeNutritionistText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  dashboardCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  metricLabel: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  metricSub: {
    color: '#94a3b8',
    marginTop: 4,
    fontSize: 12,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAction: {
    backgroundColor: '#e0f2fe',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  quickActionText: {
    color: '#0369a1',
    fontWeight: '700',
  },
  placeholderText: {
    color: '#475569',
    lineHeight: 20,
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    zIndex: 1000,
    elevation: 1000,
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  drawerPane: {
    width: 260,
    backgroundColor: '#fff',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  }
});
