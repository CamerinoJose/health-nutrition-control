-- PostgreSQL CREATE TABLE scripts for BienestarApp

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    nutritionist_id INTEGER,
    phone TEXT
);

CREATE TABLE histories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date TEXT,
    weight DOUBLE PRECISION,
    fat_percentage DOUBLE PRECISION,
    muscle_percentage DOUBLE PRECISION
);

CREATE TABLE meal_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT,
    start_date TEXT,
    snacks TEXT,
    created_at TEXT
);

CREATE TABLE plan_meals (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES meal_plans(id),
    day_of_week TEXT,
    meal_type TEXT,
    name TEXT,
    ingredients TEXT,
    preparation TEXT
);

CREATE TABLE food_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date TEXT,
    meal_type TEXT,
    completed BOOLEAN,
    notes TEXT,
    UNIQUE(user_id, date, meal_type)
);

CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    meal_times TEXT,
    enable_reminders BOOLEAN DEFAULT FALSE
);

CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title TEXT,
    description TEXT,
    appointment_date TEXT,
    appointment_time TEXT,
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TEXT
);

CREATE TABLE recipes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    prep_time INTEGER,
    servings INTEGER,
    calories INTEGER,
    protein DOUBLE PRECISION,
    carbs DOUBLE PRECISION,
    fat DOUBLE PRECISION,
    ingredients TEXT,
    instructions TEXT,
    image_url TEXT,
    created_at TEXT
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id),
    recipient_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TEXT
);

CREATE TABLE deleted_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    message_id INTEGER REFERENCES messages(id),
    created_at TEXT,
    UNIQUE(user_id, message_id)
);

CREATE TABLE health_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    age INTEGER,
    sex TEXT,
    height DOUBLE PRECISION,
    current_weight DOUBLE PRECISION,
    goal_weight DOUBLE PRECISION,
    waist_circumference DOUBLE PRECISION,
    medical_conditions TEXT,
    medications TEXT,
    allergies TEXT,
    glucose_fasting DOUBLE PRECISION,
    hba1c DOUBLE PRECISION,
    cholesterol_total DOUBLE PRECISION,
    cholesterol_ldl DOUBLE PRECISION,
    cholesterol_hdl DOUBLE PRECISION,
    triglycerides DOUBLE PRECISION,
    activity_level TEXT,
    meal_schedule TEXT,
    sleep_hours DOUBLE PRECISION,
    goals TEXT,
    updated_at TEXT
);

CREATE TABLE appointment_changes (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id),
    proposed_by INTEGER REFERENCES users(id),
    new_date TEXT NOT NULL,
    new_time TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT,
    responded_at TEXT
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TEXT
);

CREATE TABLE nutritionist_availability (
    id SERIAL PRIMARY KEY,
    nutritionist_id INTEGER REFERENCES users(id),
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE recommendations (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES users(id),
    nutritionist_id INTEGER REFERENCES users(id),
    appointment_id INTEGER REFERENCES appointments(id),
    recommendation_text TEXT,
    diet_changes TEXT,
    exercise_plan TEXT,
    next_goals TEXT,
    created_at TEXT
);
