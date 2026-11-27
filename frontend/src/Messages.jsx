import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from './api';
import './messages.css';

const Messages = ({ profile }) => {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [archivedMessages, setArchivedMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [restrictedLegacy, setRestrictedLegacy] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // active | archived
  const messagesEndRef = useRef(null);
  const pollingInterval = useRef(null);
  const isInitialLoad = useRef(true);

  // Initial load only
  useEffect(() => {
    loadConversations();
  }, []);

  // Polling setup - independent of selectedConversation
  useEffect(() => {
    pollingInterval.current = setInterval(() => {
      loadConversations();
      if (selectedConversation) {
        loadMessages(selectedConversation.user_id);
      }
    }, 5000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const res = await api.get('/messages/conversations');
      const data = Array.isArray(res.data) ? res.data : [];
      setConversations(data);
      setRestrictedLegacy(res.headers?.['x-restricted-legacy-messages'] === 'true');
      
      // Only auto-select the first conversation on initial load
      if (isInitialLoad.current && data && data.length > 0) {
        selectConversation(data[0]);
        isInitialLoad.current = false;
      }
    } catch (err) {
      console.error('Error loading conversations:', err?.message);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (otherUserId) => {
    try {
      const res = await api.get(`/messages?user_id=${otherUserId}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setMessages(data);
      
      // Mark unread messages as read
      const unreadMessages = data.filter(m => 
        !m.is_read && m.recipient_id === profile?.id
      );
      
      for (const msg of unreadMessages || []) {
        await api.put(`/messages/${msg.id}/read`);
      }
    } catch (err) {
      console.error('Error loading messages:', err?.message);
      setMessages([]);
    }
  };

  const loadArchivedMessages = async (otherUserId) => {
    try {
      const res = await api.get(`/messages/archived?user_id=${otherUserId}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setArchivedMessages(data);
    } catch (err) {
      console.error('Error loading archived messages:', err?.message);
      setArchivedMessages([]);
    }
  };

  const selectConversation = (conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.user_id);
    loadArchivedMessages(conversation.user_id);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) {
      return;
    }
    
    if (!selectedConversation) {
      console.log('[Messages] No conversation selected');
      alert('⚠️ Por favor selecciona una conversación primero');
      return;
    }

    try {
      const res = await api.post('/messages', {
        recipient_id: selectedConversation.user_id,
        content: newMessage.trim()
      });

      setMessages([...messages, res.data]);
      setNewMessage('');
      loadConversations(); // Refresh conversation list
    } catch (err) {
      console.error('[Messages] Error sending message:', err?.message);
      alert('❌ Error al enviar mensaje. Verifica que el backend esté corriendo.');
    }
  };

  const deleteMessage = async (messageId) => {
    const confirmed = window.confirm('¿Mover este mensaje al historial?');
    if (!confirmed) return;

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
      
      // Show success feedback
      alert('✅ Mensaje movido al historial');
    } catch (err) {
      console.error('[Messages] Error deleting message:', err?.message);
      alert('❌ Error: No se pudo mover el mensaje. Verifica que el backend esté corriendo.');
    }
  };

  const startNewConversation = async () => {
    try {
      const res = await api.get('/support');
      if (!Number.isInteger(res.data?.id) || res.data.id <= 0) throw new Error('Invalid support account');
      selectConversation({ user_id: res.data.id, user_name: res.data.name });
    } catch (err) {
      console.error('Error starting conversation:', err?.message);
      alert(t('supportUnavailable'));
    }
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) return 'Ahora';
    
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `Hace ${minutes} min`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `Hace ${hours}h`;
    }
    
    // Same year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    }
    
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="messages-container">
        <h2>💬 {t('messages') || 'Mensajes'}</h2>
        <p>Cargando mensajes...</p>
      </div>
    );
  }

  return (
    <div className="messages-container">
      <div className="messages-layout">
        {/* Conversations List */}
        <div className={`conversations-panel${selectedConversation ? ' hide' : ' flex'}`}> 
          <div className="conversations-header">
            <h3>💬 Conversaciones</h3>
            <button className="new-conversation-btn" onClick={startNewConversation}>
              ✉️ {t('supportChat')}
            </button>
          </div>
          {restrictedLegacy && <p className="messages-warning" role="status">{t('restrictedLegacyMessages')}</p>}
          
          <div className="conversations-list">
            {conversations.length === 0 ? (
              <div className="empty-conversations">
                <p>😊 No tienes conversaciones</p>
                <p>{t('supportChat')}</p>
                <button className="btn-start" onClick={startNewConversation}>
                  Iniciar Chat
                </button>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.user_id}
                  className={`conversation-item ${selectedConversation?.user_id === conv.user_id ? 'active' : ''}`}
                  onClick={() => selectConversation(conv)}
                >
                  <div className="conversation-avatar">
                    {conv.user_role === 'admin' ? '👨‍⚕️' : '👤'}
                  </div>
                  <div className="conversation-info">
                    <div className="conversation-name">
                      {conv.user_name}
                      {conv.user_role === 'admin' && <span className="role-badge">Nutricionista</span>}
                    </div>
                    <div className="conversation-last-message">
                      {conv.last_message || 'Sin mensajes'}
                    </div>
                  </div>
                  <div className="conversation-meta">
                    <div className="conversation-time">
                      {formatMessageTime(conv.last_message_time)}
                    </div>
                    {conv.unread_count > 0 && (
                      <div className="unread-badge">{conv.unread_count}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Messages Panel */}
        <div className={`messages-panel${selectedConversation ? ' flex' : ' hide'}`}> 
          {selectedConversation ? (
            <>
              <div className="messages-header">
                <button 
                  className="back-btn"
                  onClick={() => setSelectedConversation(null)}
                  title="Volver a conversaciones"
                >
                  ← Volver
                </button>
                <div className="header-user">
                  <div className="header-avatar">
                    {selectedConversation.user_role === 'admin' ? '👨‍⚕️' : '👤'}
                  </div>
                  <div>
                    <h3>{selectedConversation.user_name}</h3>
                    {selectedConversation.user_role === 'admin' && (
                      <span className="header-role">Nutricionista</span>
                    )}
                  </div>
                </div>
                <div className="messages-tabs">
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                    onClick={() => setActiveTab('active')}
                  >
                    Bandeja
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
                    onClick={() => setActiveTab('archived')}
                  >
                    Historial
                  </button>
                </div>
              </div>

              <div className="messages-body">
                {(activeTab === 'active' ? messages : archivedMessages).length === 0 ? (
                  <div className="empty-messages">
                    <p>📭 No hay mensajes en esta sección</p>
                    {activeTab === 'active' ? (
                      <p>Envía el primer mensaje para iniciar la conversación</p>
                    ) : (
                      <p>Los mensajes que archives aparecerán aquí</p>
                    )}
                  </div>
                ) : (
                  (activeTab === 'active' ? messages : archivedMessages).map((msg, index, arr) => {
                    const isOwn = msg.sender_id === profile.id;
                    const showDate = index === 0 || 
                      new Date(arr[index - 1].created_at).toDateString() !== 
                      new Date(msg.created_at).toDateString();

                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div className="message-date">
                            {new Date(msg.created_at).toLocaleDateString('es-ES', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </div>
                        )}
                        <div className={`message ${isOwn ? 'own' : 'other'}`}>
                          <div className="message-content">
                            {msg.content}
                          </div>
                          {activeTab === 'active' && isOwn && (
                            <div className="message-actions">
                              <button
                                type="button"
                                className="delete-msg-btn"
                                title="Enviar al historial"
                                onClick={() => deleteMessage(msg.id)}
                              >
                                🗑
                              </button>
                            </div>
                          )}
                          <div className="message-time">
                            {new Date(msg.created_at).toLocaleTimeString('es-ES', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                            {isOwn && (
                              <span className="message-status">
                                {msg.is_read ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="messages-input" onSubmit={sendMessage}>
                <input
                  type="text"
                  placeholder="Escribe un mensaje..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" disabled={!newMessage.trim()}>
                  📤 Enviar
                </button>
              </form>
            </>
          ) : (
            <div className="no-conversation-selected">
              <div className="no-conversation-icon">💬</div>
              <h3>Selecciona una conversación</h3>
              <p>Elige una conversación de la lista o inicia una nueva</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
