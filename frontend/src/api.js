import axios from 'axios'
import { getToken } from './auth'

// Use VITE_BACKEND_URL for production (preferred), accept legacy VITE_API_URL,
// fallback to relative '/api' for dev proxy.
// Examples:
// - Render/prod: https://health-nutrition-control.onrender.com/api
// - ngrok:      https://<API_DOMAIN>.ngrok-free.dev/api
const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8'
  }
})

// Add token to every request automatically
api.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log(`[API] Request to ${config.method?.toUpperCase()} ${config.url} with token:`, token.substring(0, 20) + '...')
    } else {
      console.warn(`[API] Request to ${config.method?.toUpperCase()} ${config.url} WITHOUT TOKEN`)
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor to log errors
api.interceptors.response.use(
  (response) => {
    console.log(`[API] ✅ ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`)
    return response
  },
  (error) => {
    if (error.response) {
      console.error(`[API] ❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response.status}`, error.response.data)
    } else {
      console.error(`[API] ❌ Network error:`, error.message)
    }
    return Promise.reject(error)
  }
)

export default api

// Nutritionist API functions
export const listNutritionists = async () => {
  const res = await api.get('/nutritionists')
  return Array.isArray(res.data) ? res.data : []
}

export const assignNutritionist = async (nutritionistId) => {
  const res = await api.post('/assign-nutritionist', { nutritionist_id: nutritionistId })
  return res.data
}
export const getPatients = async () => {
  const res = await api.get('/nutritionist/patients')
  return res.data
}

export const getPatientDetails = async (patientId) => {
  const res = await api.get(`/nutritionist/patients/${patientId}`)
  return res.data
}

export const getPatientHistory = async (patientId) => {
  const res = await api.get(`/nutritionist/patients/${patientId}/history`)
  return res.data
}

export const getNutritionistAppointments = async () => {
  const res = await api.get('/nutritionist/appointments')
  return res.data
}

export const updateAppointmentNotes = async (appointmentId, data) => {
  const res = await api.put(`/nutritionist/appointments/${appointmentId}/notes`, data)
  return res.data
}

export const createRecommendation = async (data) => {
  const res = await api.post('/nutritionist/recommendations', data)
  return res.data
}

export const getRecommendations = async (patientId) => {
  const res = await api.get(`/nutritionist/recommendations/${patientId}`)
  return res.data
}

export const getRecipes = async () => {
  const res = await api.get('/recipes')
  return res.data
}

export const createRecipe = async (data) => {
  const res = await api.post('/nutritionist/recipes', data)
  return res.data
}

export const updateRecipe = async (recipeId, data) => {
  const res = await api.put(`/nutritionist/recipes/${recipeId}`, data)
  return res.data
}

export const deleteRecipe = async (recipeId) => {
  const res = await api.delete(`/nutritionist/recipes/${recipeId}`)
  return res.data
}

// Notifications
export const getNotifications = async () => {
  const res = await api.get('/notifications')
  return res.data
}

export const markNotificationAsRead = async (notificationId) => {
  const res = await api.put(`/notifications/${notificationId}/read`)
  return res.data
}

export const markAllNotificationsAsRead = async () => {
  const res = await api.put('/notifications/read-all')
  return res.data
}

// Appointment Changes
export const getAppointmentChanges = async (appointmentId) => {
  const res = await api.get(`/appointment-changes/${appointmentId}`)
  return res.data
}

export const acceptAppointmentChange = async (changeId) => {
  const res = await api.put(`/appointment-changes/${changeId}/accept`)
  return res.data
}

export const rejectAppointmentChange = async (changeId, reason) => {
  const res = await api.put(`/appointment-changes/${changeId}/reject`, { reason })
  return res.data
}

export const proposeAppointmentChange = async (appointmentId, data) => {
  const res = await api.post(`/nutritionist/appointments/${appointmentId}/propose-change`, data)
  return res.data
}

export const getNutritionistAvailability = async () => {
  const res = await api.get('/nutritionist/availability')
  return res.data
}

export const setNutritionistAvailability = async (data) => {
  const res = await api.post('/nutritionist/availability', data)
  return res.data
}

export const getAvailableSlots = async (date) => {
  const res = await api.get('/available-slots', { params: { date } })
  return res.data
}

// Meal Plans for Nutritionists
export const createMealPlanForPatient = async (patientId, data) => {
  const res = await api.post(`/nutritionist/patients/${patientId}/meal-plan`, data)
  return res.data
}

export const getPatientMealPlan = async (patientId) => {
  const res = await api.get(`/nutritionist/patients/${patientId}/meal-plan`)
  return res.data
}

// Messaging
export const sendMessageToPatient = async (recipientId, message) => {
  const res = await api.post('/messages', {
    recipient_id: recipientId,
    message
  });
  return res.data;
};