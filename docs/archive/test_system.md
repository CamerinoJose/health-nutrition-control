# BienestarApp - End-to-End System Test

## Pre-requisites

- ✅ Backend built: `backend/app.exe`
- ✅ Frontend dependencies installed: `frontend/node_modules/`
- ✅ Database: `backend/data.db`

## Test Procedure

### 1. Start Backend

```bash
cd backend
./app.exe
```

**Expected Output:**
```
[WARNING] JWT_SECRET environment variable not set; using development fallback
[GIN-debug] POST   /api/register
[GIN-debug] POST   /api/login
[GIN-debug] GET    /api/me
[GIN-debug] POST   /api/history
[GIN-debug] GET    /api/history
[GIN-debug] POST   /api/ocr
[GIN-debug] GET    /api/admin/users
[GIN-debug] GET    /api/admin/users/:id/history
[GIN-debug] PUT    /api/admin/users/:id/role
[GIN-debug] DELETE /api/admin/users/:id
[GIN-debug] GET    /api/admin/export
Server running on :8080
```

### 2. Start Frontend

```bash
cd frontend
npm run dev
```

**Expected Output:**
```
VITE v5.1.0 ready in XXX ms
Local: http://localhost:5173/
```

### 3. Open Browser

Navigate to: **http://localhost:5173/**

---

## Test Cases

### ✅ Test Case 1: User Registration

**Steps:**
1. Click "Register" / "Registro" button
2. Fill in:
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `password123`
3. Click Submit

**Expected Result:**
- Redirected to login view
- No error messages

---

### ✅ Test Case 2: User Login

**Steps:**
1. Click "Login" / "Iniciar Sesión"
2. Enter:
   - Email: `test@example.com`
   - Password: `password123`
3. Click Submit

**Expected Result:**
- Profile section appears
- Shows user ID, email, and role
- OCR upload section visible

---

### ✅ Test Case 3: Language Switching

**Steps:**
1. Click "ES" button
2. Verify text changes to Spanish
3. Click "EN" button
4. Verify text changes to English

**Expected Result:**
- All UI text updates immediately:
  - Welcome title/subtitle
  - Login/Register buttons
  - Profile labels
  - Logout button

---

### ✅ Test Case 4: OCR Image Upload

**Steps:**
1. Login as user
2. Scroll to "Upload Medical Report" section
3. Click "Choose File"
4. Select: `peso camerino.jpg` (or any image)
5. Click "Extract Data"

**Expected Result:**
- Shows "Processing..." while uploading
- Displays extracted data section:
  - Weight: (value or N/A)
  - Fat %: (value or N/A)
  - Muscle %: (value or N/A)
  - Confidence: "pending_ocr_setup"
- Note about OCR engine setup

---

### ✅ Test Case 5: Create History Entry (via API)

**Using cURL:**
```bash
# Login first to get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r '.token')

# Create history entry
curl -X POST http://localhost:8080/api/history \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "date": "2025-12-27",
    "weight": 75.5,
    "fat_percentage": 22.3,
    "muscle_percentage": 42.1
  }'
```

**Expected Result:**
```json
{"ok": true}
```

---

### ✅ Test Case 6: View History

**Using cURL:**
```bash
curl -X GET http://localhost:8080/api/history \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Result:**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "date": "2025-12-27",
    "weight": 75.5,
    "fat_percentage": 22.3,
    "muscle_percentage": 42.1
  }
]
```

---

### ✅ Test Case 7: Create Admin User

**Using DB Browser for SQLite:**
1. Open `backend/data.db`
2. Navigate to "Execute SQL" tab
3. Run:
```sql
INSERT INTO users (name, email, password, role) 
VALUES ('Admin User', 'admin@example.com', 
  '$2a$10$ZFzJH.8F5P0R3hQ1tXN4eOx5pQZLb5P5vK0bK0bK0bK0bK0bK0bK0b', 
  'admin');
```
4. Or update existing user:
```sql
UPDATE users SET role = 'admin' WHERE email = 'test@example.com';
```

---

### ✅ Test Case 8: Admin Panel Access

**Steps:**
1. Logout from frontend
2. Login with admin credentials
3. Scroll to profile section

**Expected Result:**
- "Admin Dashboard" section appears above OCR upload
- Three tabs visible: Users, Analytics, Export
- Users tab shows list of all users

---

### ✅ Test Case 9: View User History (Admin)

**Steps:**
1. Login as admin
2. Go to Admin Dashboard → Users tab
3. Click "View" button next to a user

**Expected Result:**
- User history table appears below users list
- Shows all history entries for that user
- Columns: Date, Weight, Fat %, Muscle %

---

### ✅ Test Case 10: Change User Role

**Steps:**
1. In Admin Dashboard → Users tab
2. Click "Change" button next to a user
3. Modal appears
4. Click "Make Admin" or "Make User"

**Expected Result:**
- Modal closes
- User list refreshes
- Role badge updates to new role
- Cannot demote yourself (error message)

---

### ✅ Test Case 11: Delete User

**Steps:**
1. In Admin Dashboard → Users tab
2. Click "Delete" button next to a user
3. Confirm in browser dialog

**Expected Result:**
- User removed from list
- Confirmation dialog appears first
- Cannot delete yourself (error message)
- User's history also deleted from DB

---

### ✅ Test Case 12: Export Data

**Steps:**
1. In Admin Dashboard → Export tab
2. Click "Download CSV Export"

**Expected Result:**
- CSV file downloads: `bienestarapp_export.csv`
- Contains all users and their history records
- Columns: user_id, user_name, email, role, record_id, date, weight, fat_percentage, muscle_percentage

---

### ✅ Test Case 13: Analytics Dashboard

**Steps:**
1. In Admin Dashboard → Analytics tab

**Expected Result:**
- Three stat cards displayed:
  - Total Users (count)
  - Admins (count)
  - Regular Users (count)
- Color-coded gradient cards

---

### ✅ Test Case 14: Logout

**Steps:**
1. Click "Logout" / "Cerrar Sesión" button

**Expected Result:**
- Returns to home view
- Login/Register buttons appear
- Profile section hidden
- Token cleared from localStorage

---

### ✅ Test Case 15: CORS Verification

**Steps:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Perform any action (login, API call)

**Expected Result:**
- No CORS errors in console
- All API calls succeed
- Network tab shows 200 status codes

---

## Database Verification

**Using SQLite CLI:**
```bash
cd backend
sqlite3 data.db

# View users table
SELECT * FROM users;

# View histories table
SELECT * FROM histories;

# Count users by role
SELECT role, COUNT(*) FROM users GROUP BY role;

# View user with their history
SELECT u.name, u.email, h.date, h.weight, h.fat_percentage, h.muscle_percentage
FROM users u
LEFT JOIN histories h ON u.id = h.user_id
ORDER BY u.id, h.date DESC;
```

---

## API Endpoint Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/register | No | Create new user |
| POST | /api/login | No | Get JWT token |
| GET | /api/me | Yes | Get current user profile |
| POST | /api/history | Yes | Create history entry |
| GET | /api/history | Yes | List user's history |
| POST | /api/ocr | Yes | Upload image for OCR |
| GET | /api/admin/users | Admin | List all users |
| GET | /api/admin/users/:id/history | Admin | Get user history |
| PUT | /api/admin/users/:id/role | Admin | Change user role |
| DELETE | /api/admin/users/:id | Admin | Delete user |
| GET | /api/admin/export | Admin | Export all data |

---

## Common Issues & Solutions

### Issue: Port 8080 already in use
**Solution:** Kill existing process
```bash
netstat -ano | grep :8080 | awk '{print $5}' | xargs -I {} taskkill //PID {} //F
```

### Issue: Frontend not updating after code changes
**Solution:** Hard refresh browser (Ctrl+Shift+R)

### Issue: Login fails
**Solution:** Check:
- Backend is running on 8080
- CORS configured correctly
- User exists in database
- Password matches

### Issue: Admin panel not showing
**Solution:** 
- Verify user role is 'admin' in database
- Logout and login again to refresh token

### Issue: OCR returns pending_ocr_setup
**Solution:** This is expected - real OCR engine needs setup (see OCR_README.md)

---

## Success Criteria

✅ All test cases pass without errors
✅ No CORS errors in browser console
✅ Language switching works instantly
✅ Admin panel visible only to admin users
✅ User data persists in database
✅ Token authentication works correctly
✅ CSV export contains valid data

---

## Next Steps After Testing

- [ ] Integrate real OCR engine (Tesseract/Google Vision)
- [ ] Add progress charts for data visualization
- [ ] Test mobile app with Expo
- [ ] Deploy to production environment
- [ ] Set up automated backups
- [ ] Add email notifications
- [ ] Implement password reset flow
