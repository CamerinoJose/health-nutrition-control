# Mobile Testing Guide with ngrok

**Current Setup:**
- Backend: http://localhost:8080
- ngrok Tunnel: https://nonillusional-searingly-loren.ngrok-free.dev
- Frontend Web: http://localhost:5174
- Mobile App: Configured to use ngrok URL ✅

---

## Step 1: Ensure Everything is Running

### Terminal 1 - Backend (Go)
```bash
cd backend
go run main.go
# Should output: "Server running on :8080"
```

### Terminal 2 - Frontend Web (React)
```bash
cd frontend
npm run dev
# Should show: "VITE v5.x.x  ready in xxx ms"
```

### Terminal 3 - Mobile App (React Native)
```bash
cd mobile
npm start
# Follow prompts to run on your device
```

### Terminal 4 - ngrok (already running)
```
Your ngrok is active:
Forwarding: https://nonillusional-searingly-loren.ngrok-free.dev -> http://localhost:8080
```

---

## Step 2: Testing Workflow

### Option A: Two Devices (Recommended)
- **Device 1**: Regular user account
- **Device 2**: Nutritionist account (or use web frontend for nutritionist)

### Option B: Single Device with Account Switching
1. Log in as user
2. Log out → Export data
3. Log in as nutritionist
4. Test features
5. Log out → Switch back to user

---

## Step 3: Create Test Accounts

### Option 0: Use Default Seeded Accounts (Fastest)
If you're running locally with SQLite, the backend seeds these accounts automatically:
- User: `user@test.com` / `password123`
- Nutritionist: `nutritionist@test.com` / `password123`
- Admin: `admin@test.com` / `password123`

If login fails (especially after older runs), delete `backend/data.db` and restart the backend so it recreates the DB and re-seeds users.

### Create User Account
1. Open mobile app → Register
2. Email: `user@test.com`
3. Password: `password123`
4. Complete health profile:
   - Age: 30
   - Height: 175 cm
   - Weight: 80 kg
   - Activity Level: Moderate
   - Goal: Weight Loss

### Create Nutritionist Account
1. Open web frontend (http://localhost:5174)
2. Register with:
   - Email: `nutritionist@test.com`
   - Password: `password123`
   - Role: Nutritionist

Or in mobile app:
1. Register as regular user first
2. Contact backend admin to promote to nutritionist role
3. Or use the database to update user role

---

## Step 4: Testing Checklist

### User Features to Test
- [ ] **Register & Login** via ngrok
- [ ] **Health Profile** - Update personal info
- [ ] **Appointments** - View/create appointments with nutritionist
- [ ] **Meal Plans** - View assigned meal plans
- [ ] **Recipes** - Browse available recipes
- [ ] **Messages** - Send/receive messages from nutritionist
- [ ] **Progress Tracking** - Log weight & health metrics
- [ ] **Notifications** - Receive push notifications
- [ ] **Gemini Chat** - AI health assistant

### Nutritionist Features to Test
- [ ] **Patient List** - View all assigned patients
- [ ] **Patient Details** - View patient health profile
- [ ] **Create Recipes** - Add new recipes
- [ ] **Create Meal Plans** - Design weekly meal plans
- [ ] **Send Recommendations** - Create diet/exercise recommendations
- [ ] **Schedule Appointments** - Create appointments with patients
- [ ] **Send Messages** - Communicate with patients
- [ ] **Export Reports** - Export patient data

---

## Step 5: API Endpoints to Verify

### Authentication
```
POST /api/register          → Create new user
POST /api/login             → User login
GET  /api/user/profile      → Get user profile
PUT  /api/user/profile      → Update profile
```

### Nutritionist Endpoints
```
GET  /api/nutritionist/patients          → List patients
GET  /api/nutritionist/patients/:id      → Patient details
GET  /api/nutritionist/patients/:id/recommendations → Patient recommendations
POST /api/nutritionist/patients/:id/meal-plan      → Create meal plan
GET  /api/nutritionist/recipes           → List recipes
POST /api/nutritionist/recipes           → Create recipe
GET  /api/nutritionist/appointments      → List appointments
POST /api/nutritionist/appointments      → Create appointment
```

### User Endpoints
```
GET  /api/user/appointments              → View appointments
GET  /api/user/meal-plans                → View meal plans
GET  /api/user/messages                  → View messages
POST /api/user/messages                  → Send message
POST /api/user/progress                  → Log progress
```

---

## Step 6: Troubleshooting

### Mobile App Can't Connect to Backend
**Problem**: "Network Error" or "Connection refused"
**Solution**:
1. Verify ngrok is running: `https://nonillusional-searingly-loren.ngrok-free.dev`
2. Check backend is running: `localhost:8080`
3. Mobile device must be on same WiFi or use ngrok (already configured)
4. Restart mobile app

### OAuth/Google Login Issues
**Problem**: Google auth fails through ngrok
**Solution**:
1. Update OAuth redirect URLs in Google Console to include ngrok domain
2. Google OAuth Settings:
   - Add: `https://nonillusional-searingly-loren.ngrok-free.dev/api/auth/google/callback`
   - Add: `com.bienestarapp://auth` (mobile deep link)

### Token/Authentication Errors
**Problem**: "Unauthorized" or "Invalid token"
**Solution**:
1. Clear app data → Re-login
2. Check JWT token expiry in backend (currently 24 hours)
3. Verify Authorization header is being sent

### ngrok URL Changes
**Problem**: ngrok URL changes on restart
**Solution**:
1. Upgrade ngrok plan for static URL
2. Or update `mobile/src/api.js` with new URL
3. Restart mobile app after URL change

---

## Step 7: Test Scenarios

### Scenario 1: User Consultation Flow
1. **User**: Register and create health profile
2. **Nutritionist**: Accept patient from pending list
3. **Nutritionist**: Create meal plan and recommendations
4. **User**: View meal plan and recommendations
5. **Both**: Exchange messages about health goals
6. **User**: Log progress and weight changes
7. **Nutritionist**: Export patient report

### Scenario 2: Meal Plan Testing
1. **Nutritionist**: Create recipe with macros
2. **Nutritionist**: Create 7-day meal plan with recipes
3. **Nutritionist**: Send plan to patient
4. **User**: View meal plan on mobile
5. **User**: View individual meal details
6. **User**: Rate meal plan (if feature available)

### Scenario 3: Appointment Booking
1. **Nutritionist**: Create available time slot
2. **User**: View available appointments
3. **User**: Book appointment
4. **Nutritionist**: Confirm or reject
5. **User**: Receive notification
6. **Both**: Use message feature to prepare

### Scenario 4: Multi-User Testing
1. Create 2-3 user accounts
2. Create 1-2 nutritionist accounts
3. Create relationships between them
4. Test simultaneous messages/updates
5. Verify data isolation (users can't see other users' data)

---

## Step 8: Performance Testing

### Bandwidth Check
Monitor ngrok dashboard at: http://127.0.0.1:4040
- Check request latency
- Monitor bandwidth usage
- Verify all requests are successful

### Load Testing
1. Create multiple appointments
2. Send multiple messages
3. Upload large images
4. Check response times

### Data Sync
1. Create data on mobile
2. Verify it appears on web frontend
3. Update from nutritionist side
4. Verify changes reflect on user mobile

---

## Step 9: Debug Tools

### View Network Requests
```
# ngrok Web Interface
http://127.0.0.1:4040
- Inspect all HTTP requests/responses
- Replay requests
- Check headers and bodies
```

### Mobile Console Logs
```bash
# If using Expo
npm start
# Press 'j' for logs
# Press 'r' to reload
# Press 'd' for debugger
```

### Backend Logs
```bash
# In backend terminal, you'll see:
[GIN] 200 GET  /api/nutritionist/patients
[GIN] 201 POST /api/nutritionist/recipes
```

---

## Step 10: Key Test Cases for New Features

### RecipesScreen (Mobile)
- [ ] Load recipe list
- [ ] Create new recipe
- [ ] Edit recipe
- [ ] Delete recipe
- [ ] Search recipes
- [ ] Filter by category
- [ ] View nutritional info

### MealPlansScreen (Mobile)
- [ ] View current meal plan
- [ ] Create 7-day meal plan
- [ ] Add 5 meals per day
- [ ] Save meal plan
- [ ] Update plan
- [ ] View meals by day

### RecommendationsScreen (Mobile)
- [ ] View recommendations
- [ ] Create new recommendation
- [ ] Link to appointments
- [ ] View multiple sections (diet/exercise/goals)
- [ ] Delete recommendation

### PatientsScreen (Mobile Nutritionist)
- [ ] View patient list
- [ ] View patient details
- [ ] View recommendations tab
- [ ] Export patient report via Share
- [ ] View weight history

---

## Useful Commands

```bash
# Start everything at once (from root directory)
cd backend && go run main.go &
cd frontend && npm run dev &
cd mobile && npm start &

# Kill all processes (if needed)
lsof -ti:8080 | xargs kill -9    # Backend
lsof -ti:5174 | xargs kill -9    # Frontend
pkill -f "expo"                   # Mobile

# Check ngrok health
curl -s http://127.0.0.1:4040/api/tunnels | jq

# Test API directly
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://nonillusional-searingly-loren.ngrok-free.dev/api/user/profile
```

---

## Success Indicators

✅ **Mobile app connects to backend through ngrok**
✅ **Can register and login on mobile**
✅ **Can perform CRUD operations (create, read, update, delete)**
✅ **Real-time data sync between mobile and web**
✅ **Notifications work correctly**
✅ **Export functionality works**
✅ **No "Unauthorized" errors**
✅ **Smooth user experience with <500ms latency**

---

**Good luck with testing! 🚀**
