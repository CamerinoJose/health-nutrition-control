import React, { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';

const initialState = {
  age: '',
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
  goals: '',
};

const medicalConditionOptions = [
  { code: 'none', label: 'Ninguna', matchTokens: ['ninguna', 'none', 'no'] , exclusive: true },
  { code: 'diabetes2', label: 'Diabetes Tipo 2', matchTokens: ['diabetes tipo 2', 'type 2 diabetes', 't2d', 'diabetes'] },
  { code: 'hypertension', label: 'Hipertensión', matchTokens: ['hipertensión', 'hipertension', 'hypertension', 'hta'] },
  { code: 'hypothyroidism', label: 'Hipotiroidismo', matchTokens: ['hipotiroidismo', 'hypothyroidism'] },
  { code: 'high_cholesterol', label: 'Colesterol alto', matchTokens: ['colesterol alto', 'high cholesterol', 'cholesterol'] },
  { code: 'high_triglycerides', label: 'Triglicéridos altos', matchTokens: ['triglicéridos altos', 'trigliceridos altos', 'high triglycerides', 'triglycerides'] },
  { code: 'obesity', label: 'Obesidad', matchTokens: ['obesidad', 'obesity'] },
];

const allergyOptions = [
  { code: 'none', label: 'Ninguna', matchTokens: ['ninguna', 'none', 'no'], exclusive: true },
  { code: 'lactose', label: 'Lactosa', matchTokens: ['lactosa', 'lactose', 'dairy'] },
  { code: 'gluten', label: 'Gluten', matchTokens: ['gluten'] },
  { code: 'nuts', label: 'Nueces', matchTokens: ['nueces', 'nuts', 'nut'] },
  { code: 'shellfish', label: 'Mariscos', matchTokens: ['mariscos', 'shellfish'] },
  { code: 'egg', label: 'Huevo', matchTokens: ['huevo', 'egg'] },
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
    if (match) selected.add(match.code);
    else unmatched.push(part);
  }

  if (selected.has('none')) {
    return { selected: ['none'], custom: unmatched.join(', ') };
  }

  return { selected: Array.from(selected), custom: unmatched.join(', ') };
};

const joinSelectionsToText = (selectedCodes, customText, options) => {
  const selectedSet = new Set(selectedCodes || []);
  const noneSelected = selectedSet.has('none');

  const labels = noneSelected
    ? [options.find((o) => o.code === 'none')?.label].filter(Boolean)
    : options
        .filter((o) => o.code !== 'none' && selectedSet.has(o.code))
        .map((o) => o.label);

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

const mealScheduleOptions = [
  { label: 'Selecciona...', value: '' },
  { label: 'Regular (3 comidas al día)', value: 'regular_3' },
  { label: 'Regular (5 comidas al día)', value: 'regular_5' },
  { label: 'Irregular / variable', value: 'irregular' },
  { label: 'Trabajo por turnos / nocturno', value: 'shifts' },
  { label: 'Ayuno intermitente', value: 'intermittent_fasting' },
  { label: 'Otro (especificar)', value: 'custom' },
];

const allowedMealScheduleValues = new Set(mealScheduleOptions.map((o) => o.value));

const normalizeSex = (value) => {
  if (!value) return '';
  const v = String(value).trim().toLowerCase();
  if (v === 'm' || v === 'male' || v === 'masculino' || v === 'hombre') return 'male';
  if (v === 'f' || v === 'female' || v === 'femenino' || v === 'mujer') return 'female';
  if (v === 'other' || v === 'otro' || v === 'o') return 'other';
  if (v === 'prefer_not_say' || v === 'prefer not say' || v === 'prefiero no decir') return 'prefer_not_say';
  return '';
};

const normalizeActivityLevel = (value) => {
  if (!value) return '';
  const v = String(value).trim().toLowerCase();
  const allowed = new Set(['sedentary', 'light', 'moderate', 'active', 'very_active']);
  if (allowed.has(v)) return v;

  if (v.includes('sed') || v.includes('sedent')) return 'sedentary';
  if (v.includes('liger') || v.includes('light')) return 'light';
  if (v.includes('moder')) return 'moderate';
  if (v.includes('muy') || v.includes('very')) return 'very_active';
  if (v.includes('activ') || v.includes('alta')) return 'active';
  return '';
};

const normalizeMealSchedule = (value) => {
  if (!value) return { meal_schedule: '', meal_schedule_custom: '' };
  const v = String(value).trim();
  const lower = v.toLowerCase();

  if (allowedMealScheduleValues.has(v)) return { meal_schedule: v, meal_schedule_custom: '' };
  if (allowedMealScheduleValues.has(lower)) return { meal_schedule: lower, meal_schedule_custom: '' };

  return { meal_schedule: 'custom', meal_schedule_custom: v };
};

const toTextFormValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value === 0 ? '' : String(value);
  return String(value);
};

const normalizeInitialData = (data) => {
  const merged = { ...initialState, ...(data || {}) };
  const normalizedMealSchedule = normalizeMealSchedule(merged.meal_schedule);
  const parsedMedical = parseSelectionsFromText(merged.medical_conditions, medicalConditionOptions);
  const parsedAllergies = parseSelectionsFromText(merged.allergies, allergyOptions);
  return {
    ...merged,
    age: toTextFormValue(merged.age),
    height: toTextFormValue(merged.height),
    current_weight: toTextFormValue(merged.current_weight),
    goal_weight: toTextFormValue(merged.goal_weight),
    waist_circumference: toTextFormValue(merged.waist_circumference),
    glucose_fasting: toTextFormValue(merged.glucose_fasting),
    hba1c: toTextFormValue(merged.hba1c),
    cholesterol_total: toTextFormValue(merged.cholesterol_total),
    cholesterol_ldl: toTextFormValue(merged.cholesterol_ldl),
    cholesterol_hdl: toTextFormValue(merged.cholesterol_hdl),
    triglycerides: toTextFormValue(merged.triglycerides),
    sleep_hours: toTextFormValue(merged.sleep_hours),
    sex: normalizeSex(merged.sex),
    activity_level: normalizeActivityLevel(merged.activity_level),
    meal_schedule: normalizedMealSchedule.meal_schedule,
    meal_schedule_custom: normalizedMealSchedule.meal_schedule_custom,
    medical_conditions_selected: parsedMedical.selected,
    medical_conditions_custom: parsedMedical.custom,
    allergies_selected: parsedAllergies.selected,
    allergies_custom: parsedAllergies.custom,
  };
};

export default function HealthProfileForm({ onSubmit, initialData }) {
  const [form, setForm] = useState(() => normalizeInitialData(initialData));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const toIntOrZero = (value) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return 0;
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const toFloatOrZero = (value) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return 0;
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n : 0;
  };

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    // Validaciones
    const newErrors = {};
    if (!form.age || isNaN(form.age) || form.age < 1 || form.age > 120) newErrors.age = 'Edad inválida';
    if (!form.sex) newErrors.sex = 'Campo requerido';
    if (!form.height || isNaN(form.height) || form.height < 50 || form.height > 300) newErrors.height = 'Altura inválida';
    if (!form.current_weight || isNaN(form.current_weight) || form.current_weight < 20 || form.current_weight > 400) newErrors.current_weight = 'Peso inválido';
    if (form.goal_weight && (isNaN(form.goal_weight) || form.goal_weight < 20 || form.goal_weight > 400)) newErrors.goal_weight = 'Peso objetivo inválido';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setSubmitting(true);
    const payload = {
      ...form,
      age: toIntOrZero(form.age),
      height: toFloatOrZero(form.height),
      current_weight: toFloatOrZero(form.current_weight),
      goal_weight: toFloatOrZero(form.goal_weight),
      waist_circumference: toFloatOrZero(form.waist_circumference),
      glucose_fasting: toFloatOrZero(form.glucose_fasting),
      hba1c: toFloatOrZero(form.hba1c),
      cholesterol_total: toFloatOrZero(form.cholesterol_total),
      cholesterol_ldl: toFloatOrZero(form.cholesterol_ldl),
      cholesterol_hdl: toFloatOrZero(form.cholesterol_hdl),
      triglycerides: toFloatOrZero(form.triglycerides),
      sleep_hours: toFloatOrZero(form.sleep_hours),
      meal_schedule: form.meal_schedule === 'custom' ? form.meal_schedule_custom : form.meal_schedule,
      medical_conditions: joinSelectionsToText(form.medical_conditions_selected, form.medical_conditions_custom, medicalConditionOptions),
      allergies: joinSelectionsToText(form.allergies_selected, form.allergies_custom, allergyOptions),
    };
    delete payload.meal_schedule_custom;
    delete payload.medical_conditions_selected;
    delete payload.medical_conditions_custom;
    delete payload.allergies_selected;
    delete payload.allergies_custom;
    onSubmit && onSubmit(payload);
    setSubmitting(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Registro de Salud del Paciente</Text>
      <Text style={styles.privacyNotice}>
        Estos datos ayudan a tu nutriólogo o profesional relacionado a personalizar tu seguimiento,
        detectar cambios y darte recomendaciones más útiles. Comparte solo lo que te sientas cómodo
        proporcionando; la app no sustituye una consulta médica ni sirve para diagnósticos de emergencia.
      </Text>
      <TextInput style={[styles.input, errors.age && styles.inputError]} placeholder="Edad" keyboardType="numeric" value={form.age} onChangeText={v => handleChange('age', v)} />
      {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}

      <Text style={styles.label}>Sexo *</Text>
      <View style={[styles.pickerWrapper, errors.sex && styles.inputError]}>
        <Picker
          selectedValue={form.sex}
          onValueChange={(v) => handleChange('sex', v)}
          style={styles.picker}
        >
          <Picker.Item label="Selecciona..." value="" />
          <Picker.Item label="Masculino" value="male" />
          <Picker.Item label="Femenino" value="female" />
          <Picker.Item label="Otro" value="other" />
          <Picker.Item label="Prefiero no decir" value="prefer_not_say" />
        </Picker>
      </View>
      {errors.sex && <Text style={styles.errorText}>{errors.sex}</Text>}

      <TextInput style={[styles.input, errors.height && styles.inputError]} placeholder="Altura (cm)" keyboardType="numeric" value={form.height} onChangeText={v => handleChange('height', v)} />
      {errors.height && <Text style={styles.errorText}>{errors.height}</Text>}
      <TextInput style={[styles.input, errors.current_weight && styles.inputError]} placeholder="Peso actual (kg)" keyboardType="numeric" value={form.current_weight} onChangeText={v => handleChange('current_weight', v)} />
      {errors.current_weight && <Text style={styles.errorText}>{errors.current_weight}</Text>}
      <TextInput style={[styles.input, errors.goal_weight && styles.inputError]} placeholder="Peso objetivo (kg)" keyboardType="numeric" value={form.goal_weight} onChangeText={v => handleChange('goal_weight', v)} />
      {errors.goal_weight && <Text style={styles.errorText}>{errors.goal_weight}</Text>}
      <TextInput style={styles.input} placeholder="Circunferencia de cintura (cm)" keyboardType="numeric" value={form.waist_circumference} onChangeText={v => handleChange('waist_circumference', v)} />

      <Text style={styles.label}>Condiciones médicas</Text>
      <View style={styles.optionsGrid}>
        {medicalConditionOptions.map((opt) => {
          const selected = (form.medical_conditions_selected || []).includes(opt.code);
          return (
            <View key={opt.code} style={styles.optionItem}>
              <Button
                title={selected ? `✓ ${opt.label}` : opt.label}
                onPress={() => handleChange('medical_conditions_selected', toggleMultiSelect(form.medical_conditions_selected, opt.code, medicalConditionOptions))}
              />
            </View>
          );
        })}
      </View>
      <TextInput
        style={styles.textarea}
        placeholder="Otros / detalles (opcional)"
        multiline
        value={form.medical_conditions_custom}
        onChangeText={(v) => handleChange('medical_conditions_custom', v)}
      />

      <TextInput style={styles.input} placeholder="Medicamentos" value={form.medications} onChangeText={v => handleChange('medications', v)} />

      <Text style={styles.label}>Alergias</Text>
      <View style={styles.optionsGrid}>
        {allergyOptions.map((opt) => {
          const selected = (form.allergies_selected || []).includes(opt.code);
          return (
            <View key={opt.code} style={styles.optionItem}>
              <Button
                title={selected ? `✓ ${opt.label}` : opt.label}
                onPress={() => handleChange('allergies_selected', toggleMultiSelect(form.allergies_selected, opt.code, allergyOptions))}
              />
            </View>
          );
        })}
      </View>
      <TextInput
        style={styles.textarea}
        placeholder="Otras alergias / detalles (opcional)"
        multiline
        value={form.allergies_custom}
        onChangeText={(v) => handleChange('allergies_custom', v)}
      />

      <TextInput style={styles.input} placeholder="Glucosa en ayunas" keyboardType="numeric" value={form.glucose_fasting} onChangeText={v => handleChange('glucose_fasting', v)} />
      <TextInput style={styles.input} placeholder="HbA1c" keyboardType="numeric" value={form.hba1c} onChangeText={v => handleChange('hba1c', v)} />
      <TextInput style={styles.input} placeholder="Colesterol total" keyboardType="numeric" value={form.cholesterol_total} onChangeText={v => handleChange('cholesterol_total', v)} />
      <TextInput style={styles.input} placeholder="Colesterol LDL" keyboardType="numeric" value={form.cholesterol_ldl} onChangeText={v => handleChange('cholesterol_ldl', v)} />
      <TextInput style={styles.input} placeholder="Colesterol HDL" keyboardType="numeric" value={form.cholesterol_hdl} onChangeText={v => handleChange('cholesterol_hdl', v)} />
      <TextInput style={styles.input} placeholder="Triglicéridos" keyboardType="numeric" value={form.triglycerides} onChangeText={v => handleChange('triglycerides', v)} />

      <Text style={styles.label}>Nivel de actividad</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={form.activity_level}
          onValueChange={(v) => handleChange('activity_level', v)}
          style={styles.picker}
        >
          <Picker.Item label="Selecciona..." value="" />
          <Picker.Item label="Sedentario" value="sedentary" />
          <Picker.Item label="Actividad ligera" value="light" />
          <Picker.Item label="Actividad moderada" value="moderate" />
          <Picker.Item label="Activo" value="active" />
          <Picker.Item label="Muy activo" value="very_active" />
        </Picker>
      </View>

      <Text style={styles.label}>Horario de comidas</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={form.meal_schedule}
          onValueChange={(v) => handleChange('meal_schedule', v)}
          style={styles.picker}
        >
          {mealScheduleOptions.map((opt) => (
            <Picker.Item key={opt.value || 'empty'} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>
      {form.meal_schedule === 'custom' && (
        <TextInput
          style={styles.input}
          placeholder="Especifica tu horario de comidas"
          value={form.meal_schedule_custom}
          onChangeText={(v) => handleChange('meal_schedule_custom', v)}
        />
      )}

      <TextInput style={styles.input} placeholder="Horas de sueño" keyboardType="numeric" value={form.sleep_hours} onChangeText={v => handleChange('sleep_hours', v)} />
      <TextInput style={styles.textarea} placeholder="Metas, gustos, restricciones..." multiline value={form.goals} onChangeText={v => handleChange('goals', v)} />
      <Button title={submitting ? 'Guardando...' : 'Guardar'} onPress={handleSubmit} disabled={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    inputError: { borderColor: 'red' },
    errorText: { color: 'red', marginBottom: 8 },
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  privacyNotice: { backgroundColor: '#eef4ff', borderRadius: 8, color: '#374151', lineHeight: 20, marginBottom: 16, padding: 12 },
  label: { marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 10 },
  pickerWrapper: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 10, overflow: 'hidden' },
  picker: { width: '100%' },
  optionsGrid: { marginBottom: 10 },
  optionItem: { marginBottom: 8 },
  textarea: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, minHeight: 60, marginBottom: 10 },
});
