import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from './api';
import './support.css';

const Support = () => {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState(null);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  const faqs = [
    {
      question: '¿Cómo subo mi plan de alimentación?',
      answer: 'Ve a "Mi Dieta" en el menú lateral y haz click en "Subir Plan". Puedes cargar un archivo PDF con tu plan semanal y el sistema lo procesará automáticamente.'
    },
    {
      question: '¿Cómo activo las notificaciones?',
      answer: 'Ve a Configuración (⚙️) en el menú, haz click en "Activar Notificaciones" y acepta los permisos del navegador. Luego configura tus horarios de comida.'
    },
    {
      question: '¿Cómo marco una comida como completada?',
      answer: 'En la página de inicio verás tus comidas del día con círculos a la izquierda. Haz click en el círculo para marcar como completada. También puedes hacerlo desde "Mi Dieta".'
    },
    {
      question: '¿Cómo registro mi peso y medidas?',
      answer: 'En tu perfil, en la sección "Subir Análisis OCR", puedes cargar una foto de tu análisis de composición corporal, o ingresar los datos manualmente.'
    },
    {
      question: '¿Puedo ver mi historial de peso?',
      answer: 'Sí, en la sección "Progreso" (📊) puedes ver gráficas de tu evolución de peso, grasa corporal y masa muscular.'
    },
    {
      question: '¿Cómo agendo una cita?',
      answer: 'Ve a "Citas" (📅) en el menú, haz click en cualquier día del calendario y completa el formulario con los detalles de tu cita.'
    },
    {
      question: '¿Puedo cambiar el idioma?',
      answer: 'Sí, en la parte superior derecha encontrarás los botones ES/EN para cambiar entre Español e Inglés.'
    },
    {
      question: '¿Los datos se guardan automáticamente?',
      answer: 'Sí, todos los datos se guardan automáticamente en el servidor cuando realizas cambios (comidas completadas, citas, medidas, etc.).'
    },
    {
      question: '¿Qué navegadores son compatibles?',
      answer: 'La aplicación funciona en Chrome, Firefox, Safari y Edge (versiones recientes). Para notificaciones push se requiere un navegador moderno.'
    },
    {
      question: '¿Puedo usar la app en móvil?',
      answer: 'Sí, la aplicación es completamente responsive y funciona en cualquier dispositivo móvil a través del navegador.'
    }
  ];

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    const subject = contactForm.subject.trim();
    const message = contactForm.message.trim();
    if (!subject || !message) {
      setFeedbackNotice({ error: true, text: t('feedbackRequired') });
      return;
    }
    setSubmitting(true);
    setFeedbackNotice(null);
    try {
      const res = await api.post('/feedback', { subject, message });
      if (res.status !== 201 || !Number.isInteger(res.data?.id) || res.data.id <= 0 || res.data.status !== 'pending') {
        throw new Error('Feedback was not confirmed');
      }
      setContactForm({ subject: '', message: '' });
      setFeedbackNotice({ error: false, text: t('feedbackSent') });
    } catch {
      setFeedbackNotice({ error: true, text: t('feedbackFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="support-container">
      <h2>❓ {t('support') || 'Soporte'}</h2>

      <div className="support-section">
        <h3>📚 Preguntas Frecuentes</h3>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div key={index} className={`faq-item ${openFaq === index ? 'open' : ''}`}>
              <div className="faq-question" onClick={() => toggleFaq(index)}>
                <span>{faq.question}</span>
                <span className="faq-icon">{openFaq === index ? '−' : '+'}</span>
              </div>
              {openFaq === index && (
                <div className="faq-answer">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="support-section">
        <h3>📞 Contacto</h3>
        <div className="contact-info">
          <div className="contact-item">
            <span className="contact-icon">📧</span>
            <div>
              <strong>Email</strong>
              <p><a href="mailto:healthnutritioncontrol@gmail.com">healthnutritioncontrol@gmail.com</a></p>
            </div>
          </div>
        </div>
      </div>

      <div className="support-section">
        <h3>✉️ {t('feedbackTitle')}</h3>
        <p>{t('feedbackPrivacy')}</p>
        {feedbackNotice && <p role={feedbackNotice.error ? 'alert' : 'status'}>{feedbackNotice.text}</p>}
        <form className="contact-form" onSubmit={handleContactSubmit}>
          <div className="form-group">
            <label htmlFor="feedback-subject">{t('subject')}</label>
            <input
              id="feedback-subject"
              type="text"
              value={contactForm.subject}
              onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
              placeholder="¿En qué podemos ayudarte?"
              maxLength={120}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="feedback-message">{t('message')}</label>
            <textarea
              id="feedback-message"
              value={contactForm.message}
              onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
              placeholder="Describe tu problema o pregunta..."
              rows="6"
              maxLength={2000}
              required
            />
          </div>
          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? t('feedbackSending') : t('feedbackSubmit')}
          </button>
        </form>
      </div>

      <div className="support-section quick-links">
        <h3>🔗 Enlaces Rápidos</h3>
        <div className="links-grid">
          <a href="#" className="link-card">
            <span className="link-icon">📖</span>
            <span>Guía de Inicio</span>
          </a>
          <a href="#" className="link-card">
            <span className="link-icon">🎥</span>
            <span>Video Tutoriales</span>
          </a>
          <a href="#" className="link-card">
            <span className="link-icon">🔒</span>
            <span>Privacidad</span>
          </a>
          <a href="#" className="link-card">
            <span className="link-icon">📋</span>
            <span>Términos de Uso</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Support;
