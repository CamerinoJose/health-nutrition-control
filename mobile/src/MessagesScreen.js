import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  FlatList
} from 'react-native';
import { useTranslation } from 'react-i18next';
import api from './api';

export default function MessagesScreen({ onNavigate, profile }) {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [archivedMessages, setArchivedMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [restrictedLegacy, setRestrictedLegacy] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // active | archived

  const currentUserId = profile?.user_id ?? profile?.id;

  const nutritionistTarget = profile?.nutritionist_id
    ? { id: profile.nutritionist_id, name: profile?.nutritionist_name || 'Mi nutriólogo' }
    : null;

  const isInitialLoad = React.useRef(true);

  useEffect(() => {
    loadConversations();
    if (selectedConversation) {
      loadMessages(selectedConversation.user_id);
    }
  }, [selectedConversation, profile?.nutritionist_id]);

  useEffect(() => {
    if (nutritionistTarget && (!selectedConversation || selectedConversation.user_id !== nutritionistTarget.id)) {
      startNutritionistChat();
    }
  }, [nutritionistTarget?.id]);

  const deleteConversation = async (userId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta conversación?')) {
      return;
    }
    try {
      // Note: This is a client-side delete. Backend doesn't have a delete endpoint yet
      setConversations(conversations.filter(c => c.user_id !== userId));
    } catch (err) {
      console.error('Error deleting conversation:', err?.response?.status);
    }
  };

  const handleRefresh = () => {
    loadConversations();
    if (selectedConversation) {
      loadMessages(selectedConversation.user_id);
    }
  };

  const loadConversations = async () => {
    try {
      const res = await api.get('/messages/conversations');
      const conversationsData = Array.isArray(res.data) ? res.data : [];
      setRestrictedLegacy(res.headers?.['x-restricted-legacy-messages'] === 'true');
      setConversations(conversationsData);

      // Only auto-select on initial load
      if (isInitialLoad.current) {
        const nutritionistConversation = nutritionistTarget
          ? conversationsData.find(c => c.user_id === nutritionistTarget.id)
          : null;

        if (nutritionistConversation) {
          selectConversation(nutritionistConversation);
        } else if (conversationsData && conversationsData.length > 0) {
          selectConversation(conversationsData[0]);
        }
        isInitialLoad.current = false;
      }
    } catch (err) {
      console.error('Error loading conversations:', err?.response?.status);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (otherUserId) => {
    try {
      const res = await api.get(`/messages?user_id=${otherUserId}`);
      setMessages(res.data || []);
      // Also load archived messages
      loadArchivedMessages(otherUserId);
    } catch (err) {
      console.error('Error loading messages:', err?.response?.status);
    }
  };

  const loadArchivedMessages = async (otherUserId) => {
    try {
      const res = await api.get(`/messages/archived?user_id=${otherUserId}`);
      setArchivedMessages(res.data || []);
    } catch (err) {
      console.error('Error loading archived messages:', err?.response?.status);
      setArchivedMessages([]);
    }
  };

  const selectConversation = (conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.user_id);
  };

  const startNutritionistChat = () => {
    if (!nutritionistTarget) {
      alert('Aún no tienes un nutriólogo asignado.');
      return;
    }
    const conversation = { user_id: nutritionistTarget.id, user_name: nutritionistTarget.name };
    setSelectedConversation(conversation);
    setMessages([]); // show thread immediately
    // slight delay to ensure state updates before loading messages
    setTimeout(() => loadMessages(conversation.user_id), 50);
  };

  const startSupportChat = async () => {
    try {
      const res = await api.get('/support');
      if (!Number.isInteger(res.data?.id) || res.data.id <= 0) throw new Error('Invalid support account');
      const conversation = { user_id: res.data.id, user_name: res.data.name };
      setSelectedConversation(conversation);
      loadMessages(conversation.user_id);
    } catch (err) {
      console.error('Error opening support chat:', err?.response?.status);
      alert(t('supportUnavailable'));
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const msg = messages.find(m => m.id === messageId);
      await api.delete(`/messages/${messageId}`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      if (msg) {
        setArchivedMessages(prev => [msg, ...prev]);
      } else {
        loadArchivedMessages(selectedConversation?.user_id);
      }
      loadConversations();
      alert('✅ Mensaje movido al historial');
    } catch (err) {
      console.error('Error deleting message:', err?.response?.status);
      alert('❌ Error al mover mensaje');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const res = await api.post('/messages', {
        recipient_id: selectedConversation.user_id,
        content: newMessage.trim()
      });

      setMessages([...messages, res.data]);
      setNewMessage('');
      loadConversations();
    } catch (err) {
      console.error('Error sending message:', err?.response?.status);
      alert(t('messageSendFailed'));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.title}>💬 Mensajes</Text>
          <View style={{ width: 60 }} />
        </View>
        <ActivityIndicator size="large" color="#3498db" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💬 Mis Mensajes</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {restrictedLegacy && <Text style={styles.warning} accessibilityRole="alert">{t('restrictedLegacyMessages')}</Text>}
      {selectedConversation ? (
        <View style={styles.content}>
          <View style={styles.conversationHeader}>
            <TouchableOpacity onPress={() => setSelectedConversation(null)}>
              <Text style={styles.backSmall}>← </Text>
            </TouchableOpacity>
            <Text style={styles.conversationName}>
              {selectedConversation.user_name}
            </Text>
          </View>

          {/* Tabs para Bandeja / Historial */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
              onPress={() => setActiveTab('active')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'active' && styles.tabBtnTextActive]}>
                📥 Bandeja
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'archived' && styles.tabBtnActive]}
              onPress={() => setActiveTab('archived')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'archived' && styles.tabBtnTextActive]}>
                📦 Historial
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={activeTab === 'active' ? messages : archivedMessages}
            keyExtractor={(item, idx) => idx.toString()}
            renderItem={({ item }) => {
              const isOwn = item.sender_id === currentUserId;
              return (
                <View
                  style={[
                    styles.messageBubble,
                    isOwn ? styles.sentMessage : styles.receivedMessage
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isOwn ? styles.sentText : styles.receivedText
                    ]}
                  >
                    {item.content}
                  </Text>
                  {/* Botón de eliminar solo en mensajes propios y en tab activo */}
                  {activeTab === 'active' && isOwn && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => {
                        if (confirm('¿Mover este mensaje al historial?')) {
                          deleteMessage(item.id);
                        }
                      }}
                    >
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
            style={styles.messagesList}
          />

          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Escribe un mensaje..."
              value={newMessage}
              onChangeText={setNewMessage}
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
              <Text style={styles.sendBtnText}>→</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>😊 Sin conversaciones</Text>
          <Text style={styles.emptySubtext}>Tus mensajes son principalmente con tu nutriólogo asignado.</Text>
          {nutritionistTarget && (
            <TouchableOpacity style={styles.primaryCta} onPress={startNutritionistChat}>
              <Text style={styles.primaryCtaText}>Mensaje a mi nutriólogo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryCta} onPress={startSupportChat}>
            <Text style={styles.secondaryCtaText}>Chat con soporte</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.topCtas}>
            {nutritionistTarget && (
              <TouchableOpacity style={styles.primaryCta} onPress={startNutritionistChat}>
                <Text style={styles.primaryCtaText}>Mensaje a mi nutriólogo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.secondaryCta} onPress={startSupportChat}>
              <Text style={styles.secondaryCtaText}>Chat con soporte</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={conversations}
            keyExtractor={item => item.user_id.toString()}
            renderItem={({ item }) => (
              <View style={styles.conversationItemContainer}>
                <TouchableOpacity
                  style={styles.conversationItem}
                  onPress={() => selectConversation(item)}
                >
                  <View>
                    <Text style={styles.conversationItemName}>
                      {item.user_name}
                    </Text>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                      {item.last_message || 'Sin mensajes'}
                    </Text>
                  </View>
                  {item.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadCount}>{item.unread_count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteBtn}
                  onPress={() => deleteConversation(item.user_id)}
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
            style={styles.conversationsList}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  backBtn: {
    padding: 5,
  },
  backBtnText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshBtn: {
    width: 60,
    alignItems: 'flex-end',
    padding: 5,
  },
  refreshText: {
    color: '#3498db',
    fontSize: 18,
    fontWeight: '700',
  },
  warning: {
    padding: 12,
    backgroundColor: '#fff3cd',
    color: '#664d03',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
  },
  primaryCta: {
    marginTop: 14,
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryCtaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryCta: {
    marginTop: 10,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d6e3f0',
  },
  secondaryCtaText: {
    color: '#1f2937',
    fontWeight: '700',
    fontSize: 14,
  },
  topCtas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  content: {
    flex: 1,
    flexDirection: 'column',
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backSmall: {
    fontSize: 16,
    color: '#3498db',
    marginRight: 10,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  messageBubble: {
    marginVertical: 5,
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '80%',
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3498db',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecf0f1',
  },
  messageText: {
    fontSize: 14,
  },
  sentText: {
    color: '#fff',
  },
  receivedText: {
    color: '#333',
  },
  inputArea: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
  },
  sendBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498db',
    marginLeft: 10,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#3498db',
  },
  tabBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#3498db',
    fontWeight: '700',
  },
  deleteBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteBtnText: {
    fontSize: 14,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  conversationItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  deleteBtnText: {
    fontSize: 18,
  },
  conversationItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  lastMessage: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  unreadBadge: {
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
