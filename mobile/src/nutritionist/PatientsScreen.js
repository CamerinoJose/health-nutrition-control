import React, { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, TextInput, StyleSheet, Alert, Share } from 'react-native'
import api from '../api'

export default function PatientsScreen({ onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [patients, setPatients] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [details, setDetails] = useState(null)
  const [history, setHistory] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('info') // info | recommendations
  const detailsRequest = useRef(0)

  const loadPatients = async () => {
    setError('')
    try {
      setLoading(true)
      const res = await api.get('/nutritionist/patients')
      const data = Array.isArray(res.data) ? res.data : []
      setPatients(data)
      if (!selectedId && data.length > 0) {
        loadDetails(data[0].id)
      }
    } catch (e) {
      setError('No se pudieron cargar los pacientes')
      setPatients([])
    } finally {
      setLoading(false)
    }
  }

  const loadDetails = async (patientId) => {
    const request = ++detailsRequest.current
    setSelectedId(patientId)
    setError('')
    setDetails(null)
    setHistory([])
    setRecommendations([])
    try {
      const [detailRes, historyRes, recRes] = await Promise.all([
        api.get(`/nutritionist/patients/${patientId}`),
        api.get(`/nutritionist/patients/${patientId}/history`),
        api.get(`/nutritionist/recommendations/${patientId}`)
      ])
      if (request !== detailsRequest.current) return
      setDetails(detailRes.data || null)
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : [])
      setRecommendations(Array.isArray(recRes.data) ? recRes.data : [])
    } catch (e) {
      if (request === detailsRequest.current) setError('No se pudo cargar el paciente seleccionado')
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadPatients()
    setRefreshing(false)
  }

  const exportPatientReport = async () => {
    if (!details) return

    try {
      const report = `REPORTE DE PACIENTE\n\n` +
        `Nombre: ${details.name || 'N/A'}\n` +
        `Email: ${details.email || 'N/A'}\n` +
        `Peso actual: ${details.health_profile?.weight || 'N/A'} kg\n` +
        `Último registro: ${details.latest_history?.date ? new Date(details.latest_history.date).toLocaleDateString('es-ES') : 'N/A'}\n\n` +
        `HISTORIAL DE PESO:\n` +
        history.slice(0, 10).map(h => 
          `${new Date(h.date).toLocaleDateString('es-ES')}: ${h.weight} kg` +
          (h.fat_percentage ? ` | Grasa: ${h.fat_percentage}%` : '') +
          (h.muscle_percentage ? ` | Músculo: ${h.muscle_percentage}%` : '')
        ).join('\n') +
        `\n\nRECOMENDACIONES:\n` +
        recommendations.slice(0, 5).map((r, i) => 
          `\n[${i + 1}] ${new Date(r.created_at).toLocaleDateString('es-ES')}\n` +
          `${r.recommendation_text || 'N/A'}`
        ).join('\n')

      await Share.share({
        message: report,
        title: `Reporte de ${details.name || 'Paciente'}`
      })
    } catch (e) {
      console.error('[Patients] Could not share report')
      Alert.alert('Error', 'No se pudo compartir el reporte')
    }
  }

  const filtered = patients.filter((p) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.email || '').toLowerCase().includes(term)
    )
  })

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pacientes</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={['#3b82f6']} />
        }
      >
        <TextInput
          style={styles.search}
          placeholder="Buscar por nombre o email"
          value={search}
          onChangeText={setSearch}
        />

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>Sin pacientes</Text>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              {filtered.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.card, selectedId === p.id && styles.cardActive]}
                  onPress={() => loadDetails(p.id)}
                >
                  <Text style={styles.cardName}>{p.name || 'Paciente'}</Text>
                  <Text style={styles.cardMeta}>{p.email || 'sin email'}</Text>
                  <Text style={styles.cardMeta}>Citas: {p.appointment_count ?? 0}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              {!selectedId && <Text style={styles.placeholderText}>Selecciona un paciente para ver detalles</Text>}
              {selectedId && !details && !error && (
                <Text style={styles.placeholderText}>Cargando detalle...</Text>
              )}
              {selectedId && details && (
                <View style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailTitle}>{details.name || 'Paciente'}</Text>
                    <TouchableOpacity onPress={exportPatientReport} style={styles.exportButton}>
                      <Text style={styles.exportText}>📄</Text>
                    </TouchableOpacity>
                  </View>

                  {details.email && <Text style={styles.detailMeta}>{details.email}</Text>}
                  
                  <View style={styles.tabs}>
                    <TouchableOpacity 
                      style={[styles.tab, activeTab === 'info' && styles.tabActive]}
                      onPress={() => setActiveTab('info')}
                    >
                      <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>Info</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.tab, activeTab === 'recommendations' && styles.tabActive]}
                      onPress={() => setActiveTab('recommendations')}
                    >
                      <Text style={[styles.tabText, activeTab === 'recommendations' && styles.tabTextActive]}>
                        Recomendaciones ({recommendations.length})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
                    {activeTab === 'info' && (
                      <View>
                        {details.latest_history?.date && (
                          <Text style={styles.detailMeta}>Último registro: {new Date(details.latest_history.date).toLocaleDateString('es-ES')}</Text>
                        )}
                        {details.health_profile?.weight > 0 && (
                          <Text style={styles.detailMeta}>Peso actual: {details.health_profile.weight} kg</Text>
                        )}
                        <Text style={[styles.detailMeta, { marginTop: 10, fontWeight: '700' }]}>Historial reciente</Text>
                        {history.length === 0 ? (
                          <Text style={styles.detailMeta}>Sin registros</Text>
                        ) : (
                          history.slice(0, 5).map((h) => (
                            <Text key={h.id || `${h.date}-${h.weight}`} style={styles.detailMeta}>
                              {new Date(h.date).toLocaleDateString('es-ES')} · {h.weight} kg
                              {h.fat_percentage ? ` · Grasa: ${h.fat_percentage}%` : ''}
                              {h.muscle_percentage ? ` · Músculo: ${h.muscle_percentage}%` : ''}
                            </Text>
                          ))
                        )}
                      </View>
                    )}

                    {activeTab === 'recommendations' && (
                      <View>
                        {recommendations.length === 0 ? (
                          <Text style={styles.detailMeta}>Sin recomendaciones aún</Text>
                        ) : (
                          recommendations.map((rec) => (
                            <View key={rec.id} style={styles.recCard}>
                              <Text style={styles.recDate}>
                                {new Date(rec.created_at).toLocaleDateString('es-ES', { 
                                  day: 'numeric', 
                                  month: 'short' 
                                })}
                              </Text>
                              <Text style={styles.recText} numberOfLines={3}>
                                {rec.recommendation_text}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e5e7eb'
  },
  backText: {
    fontSize: 18,
    color: '#0f172a'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  search: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    backgroundColor: '#fff'
  },
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  cardActive: {
    borderColor: '#3b82f6'
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827'
  },
  cardMeta: {
    color: '#6b7280',
    marginTop: 4,
    fontSize: 13
  },
  detailCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 500
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1
  },
  exportButton: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8
  },
  exportText: {
    fontSize: 18
  },
  tabs: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    padding: 4
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: 6
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1
  },
  tabText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600'
  },
  tabTextActive: {
    color: '#111827'
  },
  tabContent: {
    maxHeight: 320
  },
  detailMeta: {
    color: '#4b5563',
    marginTop: 6,
    fontSize: 13
  },
  recCard: {
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981'
  },
  recDate: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4
  },
  recText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 8
  },
  emptyText: {
    color: '#6b7280'
  },
  placeholderText: {
    color: '#6b7280'
  }
})
