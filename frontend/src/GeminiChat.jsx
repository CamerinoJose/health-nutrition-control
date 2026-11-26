import React, { useState, useRef, useEffect } from 'react';
import api from './api';
import './gemini.css';

const GeminiChat = ({ onNavigate }) => {
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: '¡Hola! Soy tu asistente de nutrición basado en IA. Puedo ayudarte con:\n\n• Consejos nutricionales\n• Recomendaciones de recetas\n• Información sobre alimentos\n• Planes de alimentación\n• Preguntas sobre salud\n\n¿En qué puedo ayudarte hoy?',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharingAccepted, setSharingAccepted] = useState(false);
  const [reportingMessageId, setReportingMessageId] = useState(null);
  const [reportReason, setReportReason] = useState('unsafe_medical_advice');
  const [reportError, setReportError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportedMessageIds, setReportedMessageIds] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const submitReport = async (message) => {
    setReporting(true);
    setReportError('');
    try {
      await api.post('/gemini/reports', {
        responseText: message.text,
        reason: reportReason,
      });
      setReportedMessageIds((previous) => [...previous, message.id]);
      setReportingMessageId(null);
    } catch {
      setReportError('No se pudo enviar el reporte. Inténtalo de nuevo.');
    } finally {
      setReporting(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !sharingAccepted) return;
    // Limitar a 5 mensajes por sesión
    if (messages.filter(m => m.sender === 'user').length >= 5) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          text: 'Has alcanzado el límite de mensajes gratuitos por sesión. Intenta más tarde.',
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
      setLoading(false);
      return;
    }
    // Evitar mensajes repetidos consecutivos
    if (
      messages.length > 0 &&
      messages[messages.length - 1].text === inputText &&
      messages[messages.length - 1].sender === 'user'
    ) {
      setLoading(false);
      return;
    }

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
    } catch {
      console.error('Gemini chat request failed.');
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: '❌ Error al conectar con el asistente de IA. Por favor, intenta de nuevo.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        text: '¡Hola! Soy tu asistente de nutrición basado en IA. ¿En qué puedo ayudarte hoy?',
        sender: 'bot',
        timestamp: new Date(),
      },
    ]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="gemini-container">
      <div className="gemini-header">
        <button className="gemini-back-btn" onClick={() => onNavigate('home')}>
          ← Atrás
        </button>
        <h1 className="gemini-title">Gemini AI</h1>
        <button className="gemini-clear-btn" onClick={clearChat}>
          🗑️
        </button>
      </div>

      <div className="gemini-messages">
        <p className="gemini-disclosure" role="note">
          Gemini es una función de IA: al enviar, tu mensaje se comparte con Google Gemini.
          No incluyas información que te identifique. No sustituye a un profesional de salud.
        </p>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`gemini-message ${msg.sender === 'user' ? 'user' : 'bot'}`}
          >
            <div className="gemini-bubble">
              <p className="gemini-text">{msg.text}</p>
              <span className="gemini-timestamp">
                {msg.timestamp.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {msg.sender === 'bot' && msg.id !== '1' && (
                <div className="gemini-report">
                  {reportedMessageIds.includes(msg.id) ? (
                    <span role="status">Reporte enviado</span>
                  ) : reportingMessageId === msg.id ? (
                    <div className="gemini-report-form">
                      <label>
                        Motivo del reporte
                        <select
                          value={reportReason}
                          onChange={(event) => setReportReason(event.target.value)}
                          disabled={reporting}
                        >
                          <option value="unsafe_medical_advice">Consejo médico inseguro</option>
                          <option value="harmful">Contenido dañino</option>
                          <option value="privacy">Privacidad</option>
                          <option value="other">Otro</option>
                        </select>
                      </label>
                      {reportError && <p role="alert">{reportError}</p>}
                      <button type="button" disabled={reporting} onClick={() => submitReport(msg)}>
                        {reporting ? 'Enviando…' : 'Enviar reporte'}
                      </button>
                      <button type="button" disabled={reporting} onClick={() => setReportingMessageId(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label="Reportar respuesta"
                      onClick={() => {
                        setReportError('');
                        setReportReason('unsafe_medical_advice');
                        setReportingMessageId(msg.id);
                      }}
                    >
                      Reportar respuesta
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="gemini-message bot">
            <div className="gemini-bubble">
              <div className="gemini-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p className="gemini-loading-text">Gemini está escribiendo...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="gemini-input-container">
        <label className="gemini-consent">
          <input
            type="checkbox"
            checked={sharingAccepted}
            onChange={(event) => setSharingAccepted(event.target.checked)}
            aria-label="Acepto compartir mis mensajes con Google Gemini"
          />
          Entiendo que mis mensajes se envían a Google Gemini para generar respuestas.
        </label>
        <textarea
          className="gemini-input"
          placeholder="Pregunta a Gemini..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          rows="3"
          maxLength="500"
        />
        <button
          className="gemini-send-btn"
          onClick={sendMessage}
          disabled={loading || !inputText.trim() || !sharingAccepted}
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default GeminiChat;
