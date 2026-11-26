import React from 'react';
import { useTranslation } from 'react-i18next';
import './sidebar.css';

export default function Sidebar({ isOpen, onClose, onNavigate, currentView, onLogout, userRole }) {
  const { t } = useTranslation();

  const menuItems = [
    { id: 'home', icon: '🏠', label: t('home') },
    { id: 'choose-nutritionist', icon: '👨‍⚕️', label: t('chooseNutritionist') },
    { id: 'diet', icon: '🍽️', label: t('myDiet') },
    { id: 'progress', icon: '📊', label: t('progress') },
    { id: 'achievements', icon: '🏆', label: t('achievements') },
    { id: 'recipes', icon: '📖', label: t('recipes') },
    { id: 'products', icon: '🛒', label: t('products') },
    { id: 'gemini', icon: '✨', label: t('geminiAI') },
    { id: 'messages', icon: '💬', label: t('messages') },
    { id: 'appointments', icon: '📅', label: t('appointments') },
    { id: 'book-appointment', icon: '🗓️', label: t('bookAppointment') },
    { id: 'whatsapp', icon: '📱', label: t('whatsappNutritionist') },
    { id: 'profile', icon: '👤', label: t('profile') },
    { id: 'settings', icon: '⚙️', label: t('settings') },
    { id: 'test-mode', icon: '🧪', label: 'Modo de pruebas' },
    { id: 'support', icon: '❓', label: t('support') },
  ];

  if (userRole === 'admin') {
    menuItems.push({ id: 'admin', icon: '⚙️', label: t('admin') });
  }

  const handleItemClick = (viewId) => {
    if (viewId === 'whatsapp') {
      // Open WhatsApp in new tab
      window.open('https://wa.me/', '_blank');
      return;
    }
    onNavigate(viewId);
    onClose();
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>{t('menu')}</h2>
          <button className="close-sidebar" onClick={onClose}>✕</button>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => handleItemClick(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-item logout" onClick={() => { onLogout(); onClose(); }}>
            <span className="sidebar-icon">🚪</span>
            <span className="sidebar-label">{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
