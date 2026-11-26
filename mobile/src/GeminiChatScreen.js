import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';

const GeminiChatScreen = ({ onNavigate, profile }) => {
  const welcomeMessage = '¡Hola! Soy tu asistente de nutrición basado en IA. Puedo ayudarte con:\n\n• Consejos nutricionales\n• Recomendaciones de recetas\n• Información sobre alimentos\n• Planes de alimentación\n• Preguntas sobre salud\n\n¿En qué puedo ayudarte hoy?';
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: welcomeMessage,
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [reportMessage, setReportMessage] = useState(null);
  const [reporting, setReporting] = useState(false);
  const reportingRef = useRef(false);
  const scrollViewRef = useRef();
  const historyKey = `bienestar_gemini_history_v1:${profile?.user_id || 'guest'}`;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(historyKey)
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw);
        if (!Array.isArray(saved) || saved.length === 0) return;
        setMessages(saved.map((message) => ({
          ...message,
          timestamp: new Date(message.timestamp),
        })).filter((message) => message.timestamp instanceof Date && !Number.isNaN(message.timestamp.getTime())));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [historyKey]);

  useEffect(() => {
    AsyncStorage.setItem(historyKey, JSON.stringify(messages.map((message) => ({
      ...message,
      timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : new Date().toISOString(),
    })))).catch(() => {});
  }, [messages, historyKey]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || !consent || loading) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await api.post('/gemini/chat', {
        message: inputText,
      });
      const text = response.data?.text;
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Empty response from assistant');
      }

      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: text,
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
      scrollToBottom();
    } catch (error) {
      console.error('Gemini chat request failed.');
      const status = error?.response?.status;
      const text = status === 503
        ? '⚠️ El proveedor de IA está temporalmente ocupado. Intenta de nuevo en unos minutos.'
        : '❌ Error al conectar con el asistente de IA. Por favor, intenta de nuevo.';
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text,
        sender: 'bot',
        isError: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    Alert.alert(
      'Limpiar conversación',
      'Se eliminará el historial de Gemini guardado en este dispositivo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: () => {
            const welcome = [{
              id: '1',
              text: welcomeMessage,
              sender: 'bot',
              timestamp: new Date(),
            }];
            setMessages(welcome);
            AsyncStorage.removeItem(historyKey).catch(() => {});
          },
        },
      ],
    );
  };

  const copyMessage = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copiado', 'El texto quedó listo para pegar.');
  };

  const submitReport = async (reason) => {
    if (reportingRef.current || !reportMessage) return;
    reportingRef.current = true;
    setReporting(true);
    try {
      await api.post('/gemini/reports', { responseText: reportMessage.text, reason });
      setReportMessage(null);
      Alert.alert('Reporte enviado', 'Gracias por ayudarnos a mejorar.');
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar el reporte. Inténtalo de nuevo.');
    } finally {
      reportingRef.current = false;
      setReporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => onNavigate('home')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Gemini AI</Text>
        <TouchableOpacity
          onPress={clearChat}
          style={styles.clearButton}
        >
          <Text style={styles.clearButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          onContentSizeChange={scrollToBottom}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No hay mensajes. ¡Comienza una conversación!
              </Text>
            </View>
          ) : (
            messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageWrapper,
                  msg.sender === 'user' ? styles.userWrapper : styles.botWrapper,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    msg.sender === 'user'
                      ? styles.userBubble
                      : styles.botBubble,
                  ]}
                >
                  {msg.sender === 'bot' && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Copiar texto"
                      style={styles.copyButton}
                      onPress={() => copyMessage(msg.text)}
                    >
                      <Text style={styles.copyButtonText}>Copiar</Text>
                    </TouchableOpacity>
                  )}
                  {msg.sender === 'bot' && msg.text !== welcomeMessage && !msg.isError &&
                    !msg.text.startsWith('⚠️ El proveedor de IA está temporalmente ocupado.') &&
                    !msg.text.startsWith('❌ Error al conectar con el asistente de IA.') && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Reportar respuesta"
                      style={styles.copyButton}
                      onPress={() => setReportMessage(msg)}
                      disabled={reporting}
                      accessibilityState={{ disabled: reporting }}
                    >
                      <Text style={styles.reportButtonText}>Reportar</Text>
                    </TouchableOpacity>
                  )}
                  <Text
                    style={[
                      styles.messageText,
                      msg.sender === 'user'
                        ? styles.userText
                        : styles.botText,
                    ]}
                  >
                    {msg.text}
                  </Text>
                  <Text
                    style={[
                      styles.timestamp,
                      msg.sender === 'user'
                        ? styles.userTimestamp
                        : styles.botTimestamp,
                    ]}
                  >
                    {msg.timestamp.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B6B" />
              <Text style={styles.loadingText}>Gemini está escribiendo...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.disclosureContainer}>
          <Text style={styles.disclosureText}>
            Tus mensajes se envían a Google Gemini. No incluyas datos que te identifiquen. Esta herramienta no proporciona atención médica.
          </Text>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityLabel="Acepto enviar mis mensajes a Google Gemini"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent((previous) => !previous)}
            style={styles.consentControl}
          >
            <Text style={styles.checkbox} accessible={false}>{consent ? '☑' : '☐'}</Text>
            <Text style={styles.consentText}>Acepto enviar mis mensajes a Google Gemini</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Pregunta a Gemini..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (loading || !consent || !inputText.trim()) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={loading || !consent || !inputText.trim()}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            accessibilityState={{ disabled: loading || !consent || !inputText.trim() }}
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={!!reportMessage}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!reporting) setReportMessage(null); }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.reportDialog} accessibilityViewIsModal>
            <Text style={styles.reportTitle}>¿Por qué quieres reportar esta respuesta?</Text>
            {[
              ['Consejo médico inseguro', 'unsafe_medical_advice'],
              ['Contenido dañino', 'harmful'],
              ['Privacidad', 'privacy'],
              ['Otro', 'other'],
            ].map(([label, reason]) => (
              <TouchableOpacity
                key={reason}
                accessibilityRole="button"
                accessibilityState={{ disabled: reporting }}
                disabled={reporting}
                onPress={() => submitReport(reason)}
                style={styles.reasonButton}
              >
                <Text style={styles.reasonText}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: reporting }}
              disabled={reporting}
              onPress={() => setReportMessage(null)}
              style={styles.reasonButton}
            >
              <Text style={styles.reasonText}>Cancelar</Text>
            </TouchableOpacity>
            {reporting && <ActivityIndicator accessibilityLabel="Enviando reporte" />}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 18,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    padding: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  messageWrapper: {
    marginVertical: 8,
    flexDirection: 'row',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  botWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: '#FF6B6B',
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  botText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 6,
    opacity: 0.7,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  botTimestamp: {
    color: '#999',
  },
  copyButton: {
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
  copyButtonText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  reportButtonText: {
    color: '#a12b24',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  reportDialog: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  reasonButton: {
    paddingVertical: 14,
  },
  reasonText: {
    color: '#333',
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#999',
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  disclosureContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff8e6',
    borderTopWidth: 1,
    borderTopColor: '#ead69b',
  },
  disclosureText: {
    color: '#4d3b12',
    fontSize: 13,
    lineHeight: 19,
  },
  consentControl: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  checkbox: {
    fontSize: 22,
    color: '#333',
    marginRight: 8,
  },
  consentText: {
    color: '#333',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 14,
    backgroundColor: '#F9F9F9',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
});

export default GeminiChatScreen;
