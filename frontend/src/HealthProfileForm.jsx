import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from './api';
import { ageFromBirthDate } from './age';
import './healthProfile.css';

const mealScheduleOptions = [
  { value: '', labelKey: 'select' },
  { value: 'regular_3', labelKey: 'mealScheduleOptionRegular3' },
  { value: 'regular_5', labelKey: 'mealScheduleOptionRegular5' },
  { value: 'irregular', labelKey: 'mealScheduleOptionIrregular' },
  { value: 'shifts', labelKey: 'mealScheduleOptionShifts' },
  { value: 'intermittent_fasting', labelKey: 'mealScheduleOptionIntermittentFasting' },
  { value: 'custom', labelKey: 'mealScheduleOptionCustom' },
];

const allowedMealScheduleValues = new Set(mealScheduleOptions.map((o) => o.value));

const normalizeMealSchedule = (value) => {
  if (!value) return { meal_schedule: '', meal_schedule_custom: '' };
  const v = String(value).trim();
  const lower = v.toLowerCase();
  if (allowedMealScheduleValues.has(v)) return { meal_schedule: v, meal_schedule_custom: '' };
  if (allowedMealScheduleValues.has(lower)) return { meal_schedule: lower, meal_schedule_custom: '' };
  return { meal_schedule: 'custom', meal_schedule_custom: v };
};

const medicalConditionOptions = [
  {
    code: 'none',
    labelKey: 'medicalConditionsNone',
    matchTokens: ['none', 'ninguna', 'no', 'na'],
    exclusive: true,
  },
  {
    code: 'diabetes2',
    labelKey: 'medicalConditionDiabetes2',
    matchTokens: ['diabetes tipo 2', 'type 2 diabetes', 't2d', 'diabetes2', 'diabetes'],
  },
  {
    code: 'hypertension',
    labelKey: 'medicalConditionHypertension',
    matchTokens: ['hipertensión', 'hipertension', 'hypertension', 'hta'],
  },
  {
    code: 'hypothyroidism',
    labelKey: 'medicalConditionHypothyroidism',
    matchTokens: ['hipotiroidismo', 'hypothyroidism'],
  },
  {
    code: 'high_cholesterol',
    labelKey: 'medicalConditionHighCholesterol',
    matchTokens: ['colesterol alto', 'high cholesterol', 'cholesterol'],
  },
  {
    code: 'high_triglycerides',
    labelKey: 'medicalConditionHighTriglycerides',
    matchTokens: ['triglicéridos altos', 'trigliceridos altos', 'high triglycerides', 'triglycerides'],
  },
  {
    code: 'obesity',
    labelKey: 'medicalConditionObesity',
    matchTokens: ['obesidad', 'obesity'],
  },
];

const allergyOptions = [
  {
    code: 'none',
    labelKey: 'allergiesNone',
    matchTokens: ['none', 'ninguna', 'no', 'na'],
    exclusive: true,
  },
  { code: 'lactose', labelKey: 'allergyLactose', matchTokens: ['lactosa', 'lactose', 'dairy'] },
  { code: 'gluten', labelKey: 'allergyGluten', matchTokens: ['gluten'] },
  { code: 'nuts', labelKey: 'allergyNuts', matchTokens: ['nueces', 'nuts', 'nut'] },
  { code: 'shellfish', labelKey: 'allergyShellfish', matchTokens: ['mariscos', 'shellfish'] },
  { code: 'egg', labelKey: 'allergyEgg', matchTokens: ['huevo', 'egg'] },
];

const splitListText = (value) => {
  if (!value) return [];
  return String(value)
    .split(/[\n,;•]+/)
    .map((p) => p.trim())
    .filter(Boolean);
};

const parseSelectionsFromText = (value, options) => {
  const parts = splitListText(value);
  if (parts.length === 0) return { selected: [], custom: '' };

  const selected = new Set();
  const unmatched = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    const match = options.find((opt) => opt.matchTokens?.some((token) => lower.includes(String(token).toLowerCase())));
    if (match) {
      selected.add(match.code);
    } else {
      unmatched.push(part);
    }
  }

  const hasExclusiveNone = selected.has('none');
  if (hasExclusiveNone) {
    return { selected: ['none'], custom: unmatched.join(', ') };
  }

  return { selected: Array.from(selected), custom: unmatched.join(', ') };
};

const joinSelectionsToText = (selectedCodes, customText, options, t) => {
  const selectedSet = new Set(selectedCodes || []);
  const noneSelected = selectedSet.has('none');

  const labels = noneSelected
    ? [t(options.find((o) => o.code === 'none')?.labelKey || 'select')]
    : options
        .filter((o) => o.code !== 'none' && selectedSet.has(o.code))
        .map((o) => t(o.labelKey));

  const custom = String(customText || '').trim();
  const allParts = [...labels, ...(custom ? [custom] : [])].filter(Boolean);
  return allParts.join(', ');
};

const toggleMultiSelect = (current, code, options) => {
  const currentSet = new Set(current || []);
  const isExclusive = options.find((o) => o.code === code)?.exclusive;

  if (currentSet.has(code)) {
    currentSet.delete(code);
  } else {
    if (isExclusive) {
      currentSet.clear();
      currentSet.add(code);
    } else {
      currentSet.delete('none');
      currentSet.add(code);
    }
  }

  return Array.from(currentSet);
};

function HealthProfileForm({ onClose, onSave }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [profile, setProfile] = useState({
    age: '',
    birth_date: '',
    sex: '',
    height: '',
    current_weight: '',
    goal_weight: '',
    waist_circumference: '',
    medical_conditions: '',
    medical_conditions_selected: [],
    medical_conditions_custom: '',
    medications: '',
    allergies: '',
    allergies_selected: [],
    allergies_custom: '',
    glucose_fasting: '',
    hba1c: '',
    cholesterol_total: '',
    cholesterol_ldl: '',
    cholesterol_hdl: '',
    triglycerides: '',
    activity_level: '',
    meal_schedule: '',
    meal_schedule_custom: '',
    sleep_hours: '',
    goals: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get('/health-profile');
      if (res.data && res.data.id) {
        const normalizedMealSchedule = normalizeMealSchedule(res.data.meal_schedule);
        const parsedMedical = parseSelectionsFromText(res.data.medical_conditions, medicalConditionOptions);
        const parsedAllergies = parseSelectionsFromText(res.data.allergies, allergyOptions);
        setProfile({
          ...res.data,
          birth_date: res.data.birth_date || '',
          meal_schedule: normalizedMealSchedule.meal_schedule,
          meal_schedule_custom: normalizedMealSchedule.meal_schedule_custom,
          medical_conditions_selected: parsedMedical.selected,
          medical_conditions_custom: parsedMedical.custom,
          allergies_selected: parsedAllergies.selected,
          allergies_custom: parsedAllergies.custom,
        });
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const toggleMedicalCondition = (code) => {
    setProfile((prev) => ({
      ...prev,
      medical_conditions_selected: toggleMultiSelect(prev.medical_conditions_selected, code, medicalConditionOptions),
    }));
  };

  const toggleAllergy = (code) => {
    setProfile((prev) => ({
      ...prev,
      allergies_selected: toggleMultiSelect(prev.allergies_selected, code, allergyOptions),
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'meal_schedule') {
      setProfile(prev => ({
        ...prev,
        meal_schedule: value,
        meal_schedule_custom: value === 'custom' ? prev.meal_schedule_custom : '',
      }));
      return;
    }
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});

    // Validaciones
    const newErrors = {};
    const age = ageFromBirthDate(profile.birth_date);
    if (age === null || age < 1 || age > 120) newErrors.birth_date = t('invalidBirthDate');
    if (!profile.sex) newErrors.sex = 'Campo requerido';
    if (!profile.height || isNaN(profile.height) || profile.height < 50 || profile.height > 300) newErrors.height = 'Altura inválida';
    if (!profile.current_weight || isNaN(profile.current_weight) || profile.current_weight < 20 || profile.current_weight > 400) newErrors.current_weight = 'Peso inválido';
    if (profile.goal_weight && (isNaN(profile.goal_weight) || profile.goal_weight < 20 || profile.goal_weight > 400)) newErrors.goal_weight = 'Peso objetivo inválido';
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setLoading(false);
      setError('Por favor corrige los campos marcados.');
      return;
    }

    try {
      const isUpdate = profile.id;
      const cleanedProfile = {
        ...profile,
        meal_schedule: profile.meal_schedule === 'custom' ? profile.meal_schedule_custom : profile.meal_schedule,
        medical_conditions: joinSelectionsToText(profile.medical_conditions_selected, profile.medical_conditions_custom, medicalConditionOptions, t),
        allergies: joinSelectionsToText(profile.allergies_selected, profile.allergies_custom, allergyOptions, t),
        age,
        height: profile.height ? parseFloat(profile.height) : 0,
        current_weight: profile.current_weight ? parseFloat(profile.current_weight) : 0,
        goal_weight: profile.goal_weight ? parseFloat(profile.goal_weight) : 0,
        waist_circumference: profile.waist_circumference ? parseFloat(profile.waist_circumference) : 0,
        glucose_fasting: profile.glucose_fasting ? parseFloat(profile.glucose_fasting) : 0,
        hba1c: profile.hba1c ? parseFloat(profile.hba1c) : 0,
        cholesterol_total: profile.cholesterol_total ? parseFloat(profile.cholesterol_total) : 0,
        cholesterol_ldl: profile.cholesterol_ldl ? parseFloat(profile.cholesterol_ldl) : 0,
        cholesterol_hdl: profile.cholesterol_hdl ? parseFloat(profile.cholesterol_hdl) : 0,
        triglycerides: profile.triglycerides ? parseFloat(profile.triglycerides) : 0,
        sleep_hours: profile.sleep_hours ? parseFloat(profile.sleep_hours) : 0,
      };

      delete cleanedProfile.meal_schedule_custom;
      delete cleanedProfile.medical_conditions_selected;
      delete cleanedProfile.medical_conditions_custom;
      delete cleanedProfile.allergies_selected;
      delete cleanedProfile.allergies_custom;

      let res;
      if (isUpdate) {
        res = await api.put('/health-profile', cleanedProfile);
      } else {
        res = await api.post('/health-profile', cleanedProfile);
      }

      if (res.data?.birth_date !== cleanedProfile.birth_date) {
        setError(t('birthDateNotSaved'));
        return;
      }
      if (onSave) onSave();
      if (onClose) onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="health-profile-modal">
      <div className="health-profile-content">
        <div className="modal-header">
          <h2>{t('healthProfile')}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="health-profile-form" noValidate>
          {error && <div className="error-message">{error}</div>}

          {/* Disclaimer */}
          <div className="disclaimer">
            <p><strong>⚠️ {t('disclaimer')}</strong></p>
            <p>{t('disclaimerText')}</p>
          </div>

          {/* Datos Básicos */}
          <section className="form-section">
            <h3>{t('basicData')}</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="birth-date-input">{t('birthDate')} *</label>
                <input id="birth-date-input" type="date" name="birth_date" value={profile.birth_date} onChange={handleChange} required className={fieldErrors.birth_date ? 'input-error' : ''} />
                {ageFromBirthDate(profile.birth_date) !== null && <span>{t('age')}: {ageFromBirthDate(profile.birth_date)} {t('years')}</span>}
                {!profile.birth_date && profile.age > 0 && <span>{t('addBirthDate')}</span>}
                {fieldErrors.birth_date && <span className="error-text">{fieldErrors.birth_date}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="sex-input">{t('sex')} *</label>
                <select id="sex-input" name="sex" value={profile.sex} onChange={handleChange} required className={fieldErrors.sex ? 'input-error' : ''}>
                  <option value="">{t('select')}</option>
                  <option value="male">{t('male')}</option>
                  <option value="female">{t('female')}</option>
                </select>
                {fieldErrors.sex && <span className="error-text">{fieldErrors.sex}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="height-input">{t('height')} (cm) *</label>
                <input id="height-input" type="number" step="0.1" name="height" value={profile.height} onChange={handleChange} required className={fieldErrors.height ? 'input-error' : ''} />
                {fieldErrors.height && <span className="error-text">{fieldErrors.height}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="current-weight-input">{t('currentWeight')} (kg) *</label>
                <input id="current-weight-input" type="number" step="0.1" name="current_weight" value={profile.current_weight} onChange={handleChange} required className={fieldErrors.current_weight ? 'input-error' : ''} />
                {fieldErrors.current_weight && <span className="error-text">{fieldErrors.current_weight}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="goal-weight-input">{t('goalWeight')} (kg)</label>
                <input id="goal-weight-input" type="number" step="0.1" name="goal_weight" value={profile.goal_weight} onChange={handleChange} className={fieldErrors.goal_weight ? 'input-error' : ''} />
                {fieldErrors.goal_weight && <span className="error-text">{fieldErrors.goal_weight}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="waist-circumference-input">{t('waistCircumference')} (cm)</label>
                <input id="waist-circumference-input" type="number" step="0.1" name="waist_circumference" value={profile.waist_circumference} onChange={handleChange} />
              </div>
            </div>
          </section>

          {/* Historial Médico */}
          <section className="form-section">
            <h3>{t('medicalHistory')}</h3>
            <div className="form-group">
              <label>{t('medicalConditions')}</label>
              <div className="checkbox-grid">
                {medicalConditionOptions.map((opt) => (
                  <label key={opt.code} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(profile.medical_conditions_selected || []).includes(opt.code)}
                      onChange={() => toggleMedicalCondition(opt.code)}
                    />
                    <span>{t(opt.labelKey)}</span>
                  </label>
                ))}
              </div>
              <textarea
                name="medical_conditions_custom"
                value={profile.medical_conditions_custom}
                onChange={handleChange}
                placeholder={t('medicalConditionsDetailsPlaceholder')}
                rows="2"
              />
            </div>
            <div className="form-group">
              <label>{t('medications')}</label>
              <textarea 
                name="medications" 
                value={profile.medications} 
                onChange={handleChange}
                placeholder={t('medicationsPlaceholder')}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>{t('allergies')}</label>
              <div className="checkbox-grid">
                {allergyOptions.map((opt) => (
                  <label key={opt.code} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(profile.allergies_selected || []).includes(opt.code)}
                      onChange={() => toggleAllergy(opt.code)}
                    />
                    <span>{t(opt.labelKey)}</span>
                  </label>
                ))}
              </div>
              <textarea
                name="allergies_custom"
                value={profile.allergies_custom}
                onChange={handleChange}
                placeholder={t('allergiesDetailsPlaceholder')}
                rows="2"
              />
            </div>
          </section>

          {/* Datos de Laboratorio */}
          <section className="form-section">
            <h3>{t('labData')}</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>{t('glucoseFasting')} (mg/dL)</label>
                <input type="number" step="0.1" name="glucose_fasting" value={profile.glucose_fasting} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>{t('hba1c')} (%)</label>
                <input type="number" step="0.1" name="hba1c" value={profile.hba1c} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>{t('cholesterolTotal')} (mg/dL)</label>
                <input type="number" step="0.1" name="cholesterol_total" value={profile.cholesterol_total} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>{t('cholesterolLDL')} (mg/dL)</label>
                <input type="number" step="0.1" name="cholesterol_ldl" value={profile.cholesterol_ldl} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>{t('cholesterolHDL')} (mg/dL)</label>
                <input type="number" step="0.1" name="cholesterol_hdl" value={profile.cholesterol_hdl} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>{t('triglycerides')} (mg/dL)</label>
                <input type="number" step="0.1" name="triglycerides" value={profile.triglycerides} onChange={handleChange} />
              </div>
            </div>
          </section>

          {/* Estilo de Vida */}
          <section className="form-section">
            <h3>{t('lifestyle')}</h3>
            <div className="form-group">
              <label>{t('activityLevel')}</label>
              <select name="activity_level" value={profile.activity_level} onChange={handleChange}>
                <option value="">{t('select')}</option>
                <option value="sedentary">{t('sedentary')}</option>
                <option value="light">{t('lightActivity')}</option>
                <option value="moderate">{t('moderateActivity')}</option>
                <option value="active">{t('active')}</option>
                <option value="very_active">{t('veryActive')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('mealSchedule')}</label>
              <select name="meal_schedule" value={profile.meal_schedule} onChange={handleChange}>
                {mealScheduleOptions.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
              {profile.meal_schedule === 'custom' && (
                <textarea
                  name="meal_schedule_custom"
                  value={profile.meal_schedule_custom}
                  onChange={handleChange}
                  placeholder={t('mealScheduleCustomPlaceholder')}
                  rows="2"
                />
              )}
            </div>
            <div className="form-group">
              <label>{t('sleepHours')}</label>
              <input type="number" step="0.5" name="sleep_hours" value={profile.sleep_hours} onChange={handleChange} />
            </div>
          </section>

          {/* Objetivos */}
          <section className="form-section">
            <h3>{t('healthGoals')}</h3>
            <div className="form-group">
              <label>{t('goals')}</label>
              <textarea 
                name="goals" 
                value={profile.goals} 
                onChange={handleChange}
                placeholder={t('goalsPlaceholder')}
                rows="3"
              />
            </div>
          </section>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? t('saving') : t('saveProfile')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default HealthProfileForm;
