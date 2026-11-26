import React, {useState, useEffect} from 'react'
import {useTranslation} from 'react-i18next'
import './styles.css'
import Sidebar from './Sidebar'
import Login from './Login'
import Register from './Register'
import Dashboard from './Dashboard'
import OCRUpload from './OCRUpload'
import MealPlan from './MealPlan'
import AdminPanel from './AdminPanel'
import Profile from './Profile'
import Settings from './Settings'
import Appointments from './Appointments'
import Support from './Support'
import Progress from './Progress'
import Achievements from './Achievements'
import Recipes from './Recipes'
import Messages from './Messages'
import NutritionistDashboard from './NutritionistDashboard'
import NotificationsBell from './NotificationsBell'
import GeminiChat from './GeminiChat'
import AccountDeletion from './AccountDeletion'
import GoogleCallback from './GoogleCallback'
import ChooseNutritionist from './ChooseNutritionist'
import BookAppointment from './BookAppointment'
import api from './api'
import TestMode from './TestMode'
import { getToken, clearToken, saveToken, TOKEN_KEY } from './auth'
import { initNotifications, requestNotificationPermission, scheduleMealReminders } from './notifications'

export default function App(){
  const { t, i18n } = useTranslation()
  const isAccountDeletionPage = new URLSearchParams(window.location.search).get('view') === 'delete-account'
  const [token, setToken] = useState(getToken())
  // Set initial view: if token exists, go to home/dashboard, else show landing
  const [view, setView] = useState(getToken()
    ? (isAccountDeletionPage ? 'delete-account' : 'home')
    : (isAccountDeletionPage ? 'login' : 'landing'))
  const [profile, setProfile] = useState(null)
  const [language, setLanguage] = useState(i18n.language)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(!!getToken())

  // Fallback display name if profile.name is empty
  const displayName = profile?.name || profile?.email || 'Usuario'

  function decodeTokenClaims(tkn) {
    try {
      const payload = tkn.split('.')[1]
      // JWT uses base64url (replace -_ and pad)
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - payload.length % 4) % 4)
      // Properly decode base64 with UTF-8 support
      const binaryString = atob(normalized)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const utf8String = new TextDecoder('utf-8').decode(bytes)
      const json = JSON.parse(utf8String)
      return json
    } catch (e) {
      console.error('Error decoding token:', e)
      return null
    }
  }
  
  // Check if we're on the callback page
  const isCallback = window.location.pathname === '/callback';

  const featureCards = [
    { icon: '📊', title: t('home_feature_progress'), desc: t('home_feature_progress_desc') },
    { icon: '📝', title: t('home_feature_ocr'), desc: t('home_feature_ocr_desc') },
    { icon: '🍱', title: t('home_feature_mealplan'), desc: t('home_feature_mealplan_desc') },
    { icon: '💬', title: t('home_feature_support'), desc: t('home_feature_support_desc') },
  ]

  const steps = [
    { label: '1', title: t('home_step1_title'), desc: t('home_step1_desc') },
    { label: '2', title: t('home_step2_title'), desc: t('home_step2_desc') },
    { label: '3', title: t('home_step3_title'), desc: t('home_step3_desc') },
  ]

  const highlights = []

  useEffect(() => {
    // Initialize notifications
    initNotifications();
    
    // Check for OAuth callback token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('token');
    const error = urlParams.get('error');
    
    if (oauthToken) {
      try {
        // Save token and clear URL
        setToken(oauthToken);
        saveToken(oauthToken);
        setView(isAccountDeletionPage ? 'delete-account' : 'home')
        window.history.replaceState({}, document.title, '/');
      } catch (e) {
        console.error('Error saving token to localStorage:', e);
        // Token is still set in state, just not persisted
        alert('Token guardado en sesión (no persistente)');
        window.history.replaceState({}, document.title, '/');
      }
    } else if (error) {
      alert('Error al iniciar sesión: ' + error);
      window.history.replaceState({}, document.title, '/');
    }
    
    // Listen for storage changes from OAuth popup
    const handleStorageChange = (e) => {
      if (e.key === TOKEN_KEY) {
        if (e.newValue) {
          setToken(e.newValue);
          const claims = decodeTokenClaims(e.newValue);
          if (claims) {
            setProfile(prev => prev || {
              user_id: claims.user_id,
              name: claims.name,
              email: claims.email,
              role: claims.role,
              picture: claims.picture,
              given_name: claims.given_name,
              family_name: claims.family_name,
              locale: claims.locale,
            });
          }
        } else {
          // Token was removed (logout in another tab or window)
          setToken(null);
          setProfile(null);
          setView('landing');
        }
      }
    };

    // Listen for postMessage from OAuth popup (cross-origin safe)
    const handleMessage = (event) => {
      if (!event?.data) return;
      const { type, token: messageToken } = event.data;
      if (type === 'oauth-token' && messageToken) {
        try {
          saveToken(messageToken);
        } catch (err) {
          console.error('Error saving token from postMessage:', err);
        }
        setToken(messageToken);
        const claims = decodeTokenClaims(messageToken)
        if (claims) {
          setProfile(prev => prev || {
            user_id: claims.user_id,
            name: claims.name,
            email: claims.email,
            role: claims.role,
            picture: claims.picture,
            given_name: claims.given_name,
            family_name: claims.family_name,
            locale: claims.locale,
          })
        }
        fetchProfile();
        setView(isAccountDeletionPage ? 'delete-account' : 'home')
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(()=>{
    if(token){
      setLoadingProfile(true);
      // Try to fetch profile from API
      fetchProfile()

      // Also set minimal profile from token claims to avoid empty header
      const claims = decodeTokenClaims(token)
      if (claims && (!profile || !profile.name)) {
        setProfile(prev => {
          // Only update if we don't have a profile yet
          if (!prev || !prev.name) {
            return {
              user_id: claims.user_id,
              name: claims.name,
              email: claims.email,
              role: claims.role,
              picture: claims.picture,
              given_name: claims.given_name,
              family_name: claims.family_name,
              locale: claims.locale,
            }
          }
          return prev
        })
      }
    }
  },[token])

  useEffect(() => {
    if (notificationsEnabled && profile?.meal_times) {
      const cleanup = scheduleMealReminders(profile.meal_times);
      return cleanup;
    }
  }, [notificationsEnabled, profile])

  async function fetchProfile(){
    try{
      const res = await api.get('/me')
      // Check if we got HTML instead of JSON (ngrok error page)
      if (typeof res.data === 'string' && res.data.includes('<!DOCTYPE')) {
        const claims = decodeTokenClaims(token)
        if (claims) {
          setProfile({
            user_id: claims.user_id,
            name: claims.name,
            email: claims.email,
            role: claims.role,
            picture: claims.picture,
            given_name: claims.given_name,
            family_name: claims.family_name,
            locale: claims.locale,
          })
        }
      } else {
        setProfile(res.data)
      }
    }catch(e){
      console.error('Error fetching profile:', e?.message)
      if(e.response?.status === 401){
        handleLogout()
      } else {
        // Even if fetch fails, try to use token claims for display
        const claims = decodeTokenClaims(token)
        if (claims) {
          setProfile({
            user_id: claims.user_id,
            name: claims.name,
            email: claims.email,
            role: claims.role,
            picture: claims.picture,
            given_name: claims.given_name,
            family_name: claims.family_name,
            locale: claims.locale,
          })
        }
      }
    } finally {
      setLoadingProfile(false);
    }
  }

  function handleLogout(){
    clearToken()
    setToken(null)
    setProfile(null)
    setView(isAccountDeletionPage ? 'login' : 'landing')
  }

  function handleAccountDeleted(){
    clearToken()
    setToken(null)
    setProfile(null)
    setView('account-deleted')
  }

  return (
    <div className="app">
      {isCallback && <GoogleCallback />}
      
      {!isCallback && token && (
        <>
          <button 
            className={`menu-toggle ${sidebarOpen ? 'hidden' : ''}`}
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <Sidebar 
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onNavigate={(v) => setView(v)}
            currentView={view}
            onLogout={handleLogout}
            userRole={profile?.role}
          />
        </>
      )}

      {!isCallback && (
      <header>
        <img 
          src="/images/logo.png" 
          alt="Bien" 
          className="logo" 
          onClick={()=>setView('home')}
          style={{cursor: 'pointer'}}
          title={t('goHome') || 'Ir a inicio'}
        />
        <div className="header-actions">
          {token && profile && (
            <div className="user-info">
              <span className="user-name">👤 {displayName}</span>
              {profile.role === 'nutritionist' && <span className="user-badge">Nutrióloga</span>}
              {profile.role === 'admin' && <span className="user-badge admin">Admin</span>}
            </div>
          )}
          {token && <NotificationsBell onNavigate={setView} userRole={profile?.role} />}
          <div className="lang">
            <button onClick={()=>{i18n.changeLanguage('es'); setLanguage('es')}}>ES</button>
            <button onClick={()=>{i18n.changeLanguage('en'); setLanguage('en')}}>EN</button>
          </div>
        </div>
      </header>
      )}

      <main>
        {!isCallback && (
        <>
        {/* Show loading spinner if token exists and profile is loading */}
        {loadingProfile && token && (
          <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'60vh'}}>
            <div className="spinner" style={{width:48,height:48,border:'6px solid #eee',borderTop:'6px solid #6c63ff',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
          </div>
        )}
        {/* Show landing page only if not logged in and not loading */}
        {!token && view === 'landing' && !loadingProfile && (
          <div className="home-landing">
            <div className="hero-section">
              <div className="hero-overlay">
                <h1 className="hero-title">{t('welcome_title')}</h1>
                <p className="hero-subtitle">{t('welcome_subtitle')}</p>

                <div className="hero-highlights">
                  {highlights.map((h) => (
                    <div key={h.badge} className="highlight-pill">
                      <span>{h.badge}</span>
                      <p>{h.text}</p>
                    </div>
                  ))}
                </div>
                
                <div className="auth-actions">
                  <button onClick={()=>setView('login')}>{t('login')}</button>
                  <button className="ghost" onClick={()=>setView('register')}>{t('register')}</button>
                </div>

                <div className="daily-tip">
                  <h3>💡 {t('dailyRecommendation')}</h3>
                  <p className="tip-content">{t('seasonalTip')}</p>
                </div>
              </div>
            </div>

            <section className="feature-grid">
              {featureCards.map((f) => (
                <article key={f.title} className="feature-card">
                  <div className="feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </article>
              ))}
            </section>

            <section className="home-steps">
              <div className="steps-header">
                <h3>{t('home_steps_title')}</h3>
                <p>{t('home_steps_subtitle')}</p>
              </div>
              <div className="steps-grid">
                {steps.map((s) => (
                  <div key={s.label} className="step-card">
                    <div className="step-label">{s.label}</div>
                    <div>
                      <h4>{s.title}</h4>
                      <p>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'login' && (
          <Login
            hideRegister={isAccountDeletionPage}
            onLogin={(tkn)=>{ setToken(tkn); setView(isAccountDeletionPage ? 'delete-account' : 'home') }}
            onSwitchToRegister={()=>setView('register')}
          />
        )}
        {view === 'register' && <Register onRegistered={()=>{ setView('login') }} onSwitchToLogin={()=>setView('login')} />}
        {view === 'account-deleted' && (
          <section className="settings-container" role="status">
            <h2>Cuenta eliminada</h2>
            <p>Tu cuenta y los datos asociados se eliminaron.</p>
            <a href="/">Volver al inicio</a>
          </section>
        )}
        
        {token && profile && !loadingProfile && (
          <>
            {view === 'home' && (
              profile.role === 'nutritionist' || profile.role === 'admin' 
                ? <NutritionistDashboard profile={profile} />
                : <Dashboard profile={profile} />
            )}
            
            {view === 'diet' && <MealPlan />}
            {view === 'profile' && <Profile token={token} profile={profile} />}
            {view === 'settings' && <Settings profile={profile} onUpdate={setProfile} />}
            {view === 'delete-account' && (
              <AccountDeletion
                onCancel={() => setView('settings')}
                onDeleted={handleAccountDeleted}
              />
            )}
            {view === 'test-mode' && <TestMode profile={profile} />}
            {view === 'appointments' && <Appointments />}
            {view === 'choose-nutritionist' && (
              <ChooseNutritionist onNavigate={setView} onAssigned={async()=>{
                try {
                  const res = await api.get('/me')
                  const json = res.headers['content-type']?.includes('application/json') ? res.data : null
                  setProfile(json || profile)
                } catch(e) {
                  console.warn('No se pudo refrescar el perfil tras asignar nutriólogo')
                }
              }} />
            )}
            {view === 'book-appointment' && (
              <BookAppointment onNavigate={setView} />
            )}
            {view === 'admin' && profile.role === 'admin' && <AdminPanel token={token} />}
            
            {view === 'progress' && (
              <Progress />
            )}
            
            {view === 'achievements' && (
              <Achievements />
            )}
            
            {view === 'recipes' && (
              <Recipes />
            )}
            
            {view === 'products' && (
              <section>
                <h2>🛒 {t('products')}</h2>
                <p>{t('productsComingSoon')}</p>
              </section>
            )}
            
            {view === 'messages' && (
              <Messages profile={profile} />
            )}
            
            {view === 'gemini' && (
              <GeminiChat onNavigate={setView} />
            )}
            
            {view === 'appointments' && (
              <section>
                <h2>📅 {t('appointments')}</h2>
                <p>{t('appointmentsComingSoon')}</p>
              </section>
            )}
            
            {view === 'support' && (
              <Support />
            )}
          </>
        )}
        </>
        )}

      </main>

      <footer>BienestarApp / WellnessApp</footer>
    </div>
  )
}
