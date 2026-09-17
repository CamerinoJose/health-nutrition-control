import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  FlatList
} from 'react-native';
import { useTranslation } from 'react-i18next';
import api from './api';

export default function DashboardScreen({ onNavigate, profile }) {
  const { t } = useTranslation();
  const [mealPlan, setMealPlan] = useState(null);
  const [foodLog, setFoodLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Tomar agua (8 vasos)', completed: false },
    { id: 2, text: 'Ejercicio 30 minutos', completed: false },
    { id: 3, text: 'Registrar comidas', completed: false },
  ]);
  const [appointments, setAppointments] = useState([]);

  console.log('[Dashboard] Component mounted, profile:', profile);

  useEffect(() => {
    console.log('[Dashboard] useEffect triggered, calling loadTodayData');
    loadTodayData();
  }, []);

  const loadTodayData = async () => {
    try {
      console.log('[Dashboard] loadTodayData started');
      const today = new Date().toISOString().split('T')[0];
      console.log('[Dashboard] Today date:', today);
      
      console.log('[Dashboard] Making API call to /meal-plan');
      const mealRes = await api.get('/meal-plan');
      console.log('[Dashboard] API response received:', mealRes.data);
      
      console.log('[Dashboard] Making API call to /food-log?date=' + today);
      const foodRes = await api.get(`/food-log?date=${today}`);
      console.log('[Dashboard] Food log response received:', foodRes.data);
      
      // Backend returns {plan: {...}, meals: [...]}
      // Extract just the meals array
      const mealsData = Array.isArray(mealRes.data?.meals) ? mealRes.data.meals : [];
      console.log('[Dashboard] Extracted meals:', mealsData.length, 'meals');
      console.log('[Dashboard] Setting mealPlan with', mealsData.length, 'meals');
      setMealPlan(mealsData);
      setFoodLog(foodRes.data || []);
      try {
        const appointmentRes = await api.get('/appointments');
        setAppointments(Array.isArray(appointmentRes.data) ? appointmentRes.data.slice(0, 3) : []);
      } catch (appointmentError) {
        console.warn('[Dashboard] Could not load appointments:', appointmentError?.message);
      }
    } catch (err) {
      console.error('[Dashboard] Error in loadTodayData:', err);
      console.error('[Dashboard] Error details:', err.message);
      setMealPlan([]);
    } finally {
      console.log('[Dashboard] loadTodayData finished, setting loading to false');
      setLoading(false);
    }
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const toggleMealCompletion = async (mealType) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const currentLog = foodLog.find(log => log.meal_type === mealType && log.date === today);
      const newCompleted = !currentLog?.completed;

      await api.post('/food-log', {
        date: today,
        meal_type: mealType,
        completed: newCompleted,
        notes: currentLog?.notes || ''
      });

      const foodRes = await api.get(`/food-log?date=${today}`);
      setFoodLog(foodRes.data || []);
    } catch (error) {
      console.error('Error toggling meal:', error);
    }
  };

  const isMealCompleted = (mealType) => {
    const today = new Date().toISOString().split('T')[0];
    return foodLog.some(log => log.meal_type === mealType && log.completed && log.date === today);
  };

  const getTodayMeals = () => {
    if (!mealPlan || !Array.isArray(mealPlan) || mealPlan.length === 0) {
      console.log('[Dashboard] No meal plan or meals:', { mealPlan });
      return null;
    }

    const today = new Date().getDay();
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = daysOfWeek[today];
    
    console.log('[Dashboard] Today is:', todayName, '- Day index:', today);
    console.log('[Dashboard] Total meals in plan:', mealPlan.length);

    const todayMealsList = mealPlan.filter(meal => meal.day_of_week === todayName);
    console.log('[Dashboard] Meals for today:', todayMealsList);

    if (todayMealsList.length === 0) return null;

    return {
      breakfast: todayMealsList.filter(m => m.meal_type === 'Desayuno'),
      lunch: todayMealsList.filter(m => m.meal_type === 'Comida'),
      dinner: todayMealsList.filter(m => m.meal_type === 'Cena'),
    };
  };

  const completedTasks = tasks.filter(t => t.completed).length;
  const taskProgress = (completedTasks / tasks.length) * 100;
  const todayMeals = getTodayMeals();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greeting}>👋 ¡Hola {profile?.name}!</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </View>

        <View style={styles.nutritionistCard}>
          <Text style={styles.nutritionistTitle}>👨‍⚕️ {profile?.nutritionist_name ? 'Tu nutriólogo' : '¿No tienes nutriólogo?'}</Text>
          <Text style={styles.nutritionistText}>
            {profile?.nutritionist_name
              ? `${profile.nutritionist_name} puede acompañarte en tu seguimiento.`
              : 'Asigna uno para que te acompañe en tu camino hacia el bienestar.'}
          </Text>
          {!profile?.nutritionist_id && (
            <TouchableOpacity style={styles.primaryButton} onPress={() => onNavigate('nutritionist-selection')}>
              <Text style={styles.primaryButtonText}>Elegir nutriólogo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resumen rápido</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Próxima comida</Text>
              <Text style={styles.summaryValue}>{todayMeals ? 'Plan de hoy' : 'Sin plan'}</Text>
              <Text style={styles.summaryHint}>{todayMeals ? 'Revisa tu plan de comidas' : 'Puedes solicitar un plan'}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Recordatorios</Text>
              <Text style={styles.summaryValue}>{profile?.enable_reminders ? 'Activos' : 'Inactivos'}</Text>
              <Text style={styles.summaryHint}>Notificaciones</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Atajos</Text>
          <View style={styles.shortcuts}>
            {[
              ['Plan de comidas', 'mealplan'],
              ['Progreso', 'progress'],
              ['Mensajes', 'messages'],
              ['Soporte', 'support'],
            ].map(([label, target]) => (
              <TouchableOpacity key={target} style={styles.shortcutButton} onPress={() => onNavigate(target)}>
                <Text style={styles.shortcutText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Próximas citas</Text>
          {appointments.length === 0 ? (
            <Text style={styles.emptyText}>Aún no tienes citas programadas.</Text>
          ) : appointments.map(appointment => (
            <Text key={appointment.id} style={styles.appointmentText}>
              {appointment.appointment_date} · {appointment.appointment_time} · {appointment.title}
            </Text>
          ))}
          <TouchableOpacity style={styles.outlineButton} onPress={() => onNavigate('appointments')}>
            <Text style={styles.outlineButtonText}>Ir a Citas</Text>
          </TouchableOpacity>
        </View>

        {/* Tasks Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>✅ Tareas de Hoy</Text>
            <Text style={styles.cardBadge}>{completedTasks}/{tasks.length}</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${taskProgress}%` }]}
            />
          </View>
          {tasks.map(task => (
            <View key={task.id} style={styles.taskItem}>
              <TouchableOpacity
                onPress={() => toggleTask(task.id)}
                style={styles.checkbox}
              >
                <Text style={styles.checkboxText}>
                  {task.completed ? '✓' : '○'}
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.taskText,
                  task.completed && styles.taskTextCompleted
                ]}
              >
                {task.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Meals Card */}
        {todayMeals ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🍽️ Comidas de Hoy</Text>
            </View>
            {[
              { type: 'breakfast', label: '🌅 Desayuno', meals: todayMeals.breakfast },
              { type: 'lunch', label: '☀️ Comida', meals: todayMeals.lunch },
              { type: 'dinner', label: '🍎 Cena', meals: todayMeals.dinner }
            ].map(section => (
              <View key={section.type}>
                <View style={styles.mealTypeHeader}>
                  <Text style={styles.mealTypeLabel}>{section.label}</Text>
                  <TouchableOpacity
                    style={styles.mealCheckbox}
                    onPress={() => toggleMealCompletion(section.type === 'breakfast' ? 'Desayuno' : section.type === 'lunch' ? 'Comida' : 'Cena')}
                  >
                    <Text style={styles.mealCheckboxText}>
                      {isMealCompleted(section.type === 'breakfast' ? 'Desayuno' : section.type === 'lunch' ? 'Comida' : 'Cena') ? '✓' : '○'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {section.meals && section.meals.length > 0 ? (
                  <Text style={styles.mealName}>{section.meals[0].name}</Text>
                ) : (
                  <Text style={styles.noMeal}>-</Text>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.noMealText}>
              📋 No tienes plan de comidas asignado. Contacta a tu nutricionista.
            </Text>
          </View>
        )}

        {/* Quick Access */}
        <View style={styles.quickAccessContainer}>
          <Text style={styles.quickAccessTitle}>⚡ Acceso Rápido</Text>
          <View style={styles.quickAccessGrid}>
            <TouchableOpacity
              style={styles.quickAccessBtn}
              onPress={() => onNavigate('mealplan')}
            >
              <Text style={styles.quickAccessIcon}>🍱</Text>
              <Text style={styles.quickAccessLabel}>Mi Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessBtn}
              onPress={() => onNavigate('progress')}
            >
              <Text style={styles.quickAccessIcon}>📊</Text>
              <Text style={styles.quickAccessLabel}>Progreso</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessBtn}
              onPress={() => onNavigate('recipes')}
            >
              <Text style={styles.quickAccessIcon}>📖</Text>
              <Text style={styles.quickAccessLabel}>Recetas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessBtn}
              onPress={() => onNavigate('appointments')}
            >
              <Text style={styles.quickAccessIcon}>📅</Text>
              <Text style={styles.quickAccessLabel}>Citas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 15,
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  date: {
    fontSize: 14,
    color: '#999',
    textTransform: 'capitalize',
  },
  nutritionistCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  nutritionistTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1b5e20',
    marginBottom: 6,
  },
  nutritionistText: {
    color: '#355e3b',
    lineHeight: 20,
    marginBottom: 12,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  summaryItem: {
    flex: 1,
    paddingRight: 8,
  },
  summaryLabel: {
    color: '#777',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '700',
  },
  summaryHint: {
    color: '#999',
    fontSize: 11,
    marginTop: 3,
  },
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  shortcutButton: {
    width: '48%',
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  shortcutText: {
    color: '#2563a6',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyText: {
    color: '#888',
    marginTop: 12,
  },
  appointmentText: {
    color: '#555',
    fontSize: 13,
    paddingTop: 10,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  outlineButtonText: {
    color: '#2878b8',
    fontWeight: '700',
  },
  cardBadge: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498db',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxText: {
    fontSize: 18,
    color: '#3498db',
  },
  taskText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  taskTextCompleted: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  mealTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mealTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  mealCheckbox: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealCheckboxText: {
    fontSize: 16,
    color: '#27ae60',
  },
  mealName: {
    fontSize: 12,
    color: '#666',
    marginLeft: 34,
    paddingVertical: 4,
  },
  noMeal: {
    fontSize: 12,
    color: '#999',
    marginLeft: 34,
    paddingVertical: 4,
  },
  noMealText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  quickAccessContainer: {
    marginBottom: 20,
  },
  quickAccessTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAccessBtn: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  quickAccessIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  quickAccessLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
});
