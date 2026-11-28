import React, { useState, useEffect } from 'react'
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  Modal, ActivityIndicator, StyleSheet, Alert, RefreshControl 
} from 'react-native'
import api from '../api'

export default function NutritionistRecipesScreen({ onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recipes, setRecipes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '',
    category: 'Proteínas',
    prep_time: '30',
    servings: '2',
    calories: '400',
    protein: '30',
    carbs: '40',
    fat: '15',
    ingredients: '',
    instructions: '',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800'
  })
  const [error, setError] = useState('')

  const categories = ['Proteínas', 'Carbohidratos', 'Verduras', 'Frutas', 'Snacks', 'Postres', 'Bebidas']

  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    setError('')
    try {
      setLoading(true)
      const res = await api.get('/recipes')
      setRecipes(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setError('Error al cargar recetas')
      console.error('[Recipes] Could not load recipes')
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadRecipes()
    setRefreshing(false)
  }

  const openCreateModal = () => {
    setEditingId(null)
    setForm({
      name: '',
      category: 'Proteínas',
      prep_time: '30',
      servings: '2',
      calories: '400',
      protein: '30',
      carbs: '40',
      fat: '15',
      ingredients: '',
      instructions: '',
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800'
    })
    setShowModal(true)
  }

  const openEditModal = (recipe) => {
    setEditingId(recipe.id)
    setForm({
      name: recipe.name || '',
      category: recipe.category || 'Proteínas',
      prep_time: String(recipe.prep_time || 30),
      servings: String(recipe.servings || 2),
      calories: String(recipe.calories || 400),
      protein: String(recipe.protein || 30),
      carbs: String(recipe.carbs || 40),
      fat: String(recipe.fat || 15),
      ingredients: recipe.ingredients || '',
      instructions: recipe.instructions || '',
      image_url: recipe.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800'
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'El nombre es requerido')
      return
    }

    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        prep_time: parseInt(form.prep_time) || 30,
        servings: parseInt(form.servings) || 2,
        calories: parseInt(form.calories) || 400,
        protein: parseFloat(form.protein) || 30,
        carbs: parseFloat(form.carbs) || 40,
        fat: parseFloat(form.fat) || 15,
        ingredients: form.ingredients.trim(),
        instructions: form.instructions.trim(),
        image_url: form.image_url.trim()
      }

      if (editingId) {
        await api.put(`/nutritionist/recipes/${editingId}`, payload)
        Alert.alert('Éxito', 'Receta actualizada')
      } else {
        await api.post('/nutritionist/recipes', payload)
        Alert.alert('Éxito', 'Receta creada')
      }

      setShowModal(false)
      loadRecipes()
    } catch (e) {
      console.error('[Recipes] Could not save recipe')
      Alert.alert('Error', 'No se pudo guardar la receta')
    }
  }

  const handleDelete = (id) => {
    Alert.alert(
      'Confirmar',
      '¿Eliminar esta receta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/nutritionist/recipes/${id}`)
              Alert.alert('Éxito', 'Receta eliminada')
              loadRecipes()
            } catch (e) {
              console.error('[Recipes] Could not delete recipe')
              Alert.alert('Error', 'No se pudo eliminar')
            }
          }
        }
      ]
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Recetas</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Crear</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && <ActivityIndicator size="large" color="#10b981" style={styles.loader} />}

        {!loading && recipes.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>📖 No hay recetas todavía</Text>
            <TouchableOpacity onPress={openCreateModal} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Crear primera receta</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && recipes.map(recipe => (
          <View key={recipe.id} style={styles.recipeCard}>
            <View style={styles.recipeHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recipeName}>{recipe.name}</Text>
                <Text style={styles.recipeCategory}>{recipe.category}</Text>
              </View>
              <View style={styles.recipeActions}>
                <TouchableOpacity onPress={() => openEditModal(recipe)} style={styles.editButton}>
                  <Text style={styles.editButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(recipe.id)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.recipeInfo}>
              <Text style={styles.infoText}>⏱️ {recipe.prep_time} min</Text>
              <Text style={styles.infoText}>👥 {recipe.servings} porciones</Text>
              <Text style={styles.infoText}>🔥 {recipe.calories} kcal</Text>
            </View>

            <View style={styles.macros}>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Proteína</Text>
                <Text style={styles.macroValue}>{recipe.protein}g</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Carbos</Text>
                <Text style={styles.macroValue}>{recipe.carbs}g</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Grasas</Text>
                <Text style={styles.macroValue}>{recipe.fat}g</Text>
              </View>
            </View>

            {recipe.ingredients && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ingredientes:</Text>
                <Text style={styles.sectionText}>{recipe.ingredients}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'Editar' : 'Crear'} Receta</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={val => setForm({ ...form, name: val })}
              placeholder="Ej: Ensalada César"
            />

            <Text style={styles.label}>Categoría</Text>
            <View style={styles.categoryGrid}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, form.category === cat && styles.categoryChipActive]}
                  onPress={() => setForm({ ...form, category: cat })}
                >
                  <Text style={[styles.categoryChipText, form.category === cat && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Tiempo (min)</Text>
                <TextInput
                  style={styles.input}
                  value={form.prep_time}
                  onChangeText={val => setForm({ ...form, prep_time: val })}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Porciones</Text>
                <TextInput
                  style={styles.input}
                  value={form.servings}
                  onChangeText={val => setForm({ ...form, servings: val })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Información Nutricional</Text>
            
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Calorías</Text>
                <TextInput
                  style={styles.input}
                  value={form.calories}
                  onChangeText={val => setForm({ ...form, calories: val })}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Proteína (g)</Text>
                <TextInput
                  style={styles.input}
                  value={form.protein}
                  onChangeText={val => setForm({ ...form, protein: val })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Carbohidratos (g)</Text>
                <TextInput
                  style={styles.input}
                  value={form.carbs}
                  onChangeText={val => setForm({ ...form, carbs: val })}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Grasas (g)</Text>
                <TextInput
                  style={styles.input}
                  value={form.fat}
                  onChangeText={val => setForm({ ...form, fat: val })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.label}>Ingredientes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.ingredients}
              onChangeText={val => setForm({ ...form, ingredients: val })}
              placeholder="Lista de ingredientes..."
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Instrucciones</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.instructions}
              onChangeText={val => setForm({ ...form, instructions: val })}
              placeholder="Pasos de preparación..."
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>URL de Imagen</Text>
            <TextInput
              style={styles.input}
              value={form.image_url}
              onChangeText={val => setForm({ ...form, image_url: val })}
              placeholder="https://..."
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  recipeCategory: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  recipeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    fontSize: 20,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 20,
  },
  recipeInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
  },
  macros: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    marginTop: 12,
  },
  sectionText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalClose: {
    fontSize: 24,
    color: '#6b7280',
    paddingHorizontal: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  categoryChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#6b7280',
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
})
