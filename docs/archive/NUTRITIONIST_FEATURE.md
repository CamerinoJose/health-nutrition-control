# Nutritionist Assignment Feature - Implementation Summary

## Overview
A complete feature has been implemented to allow users to select and assign a nutritionist to their account. This includes a dashboard notification banner and a dedicated nutritionist selection screen.

## Features Implemented

### 1. Backend Changes (Go/Gin)

#### Database Migration
- **File**: `backend/main.go` (Line 259)
- **Change**: Added `nutritionist_id INTEGER FOREIGN KEY(nutritionist_id) REFERENCES users(id)` to users table
- **Purpose**: Links users to their assigned nutritionist

#### API Endpoints

##### GET /api/nutritionists
- **Handler**: `listNutritionistsHandler` (Line 2855)
- **Purpose**: Retrieve list of all available nutritionists
- **Authentication**: Required (Bearer token)
- **Response**: JSON array of nutritionist objects with id, name, email, role
- **Example Response**:
  ```json
  [
    {
      "id": 10,
      "name": "Dr. Maria Garcia",
      "email": "maria.garcia@nutri.com",
      "role": "nutritionist"
    }
  ]
  ```

##### POST /api/assign-nutritionist
- **Handler**: `assignNutritionistHandler` (Line 2890)
- **Purpose**: Assign a nutritionist to the current user
- **Authentication**: Required (Bearer token)
- **Request Body**: 
  ```json
  {
    "nutritionist_id": 10
  }
  ```
- **Response**: 
  ```json
  {
    "message": "nutritionist assigned successfully"
  }
  ```
- **Validation**: 
  - Checks that nutritionist_id exists
  - Verifies the user has role='nutritionist'

#### Updated GET /api/me Handler
- **File**: `backend/main.go` (Line 456)
- **Changes**: 
  - Now queries nutritionist info along with user settings
  - Returns `nutritionist_id`, `nutritionist_name`, and `nutritionist_email` if assigned
  - Uses LEFT JOIN to safely handle unassigned users
- **Response Includes**:
  - `user_id`, `name`, `email`, `role`
  - `meal_times`, `enable_reminders`
  - `nutritionist_id`, `nutritionist_name`, `nutritionist_email` (when assigned)

### 2. Frontend Changes (React Native/Expo)

#### New Screen: NutritionistSelectionScreen
- **File**: `mobile/src/NutritionistSelectionScreen.js`
- **Purpose**: Dedicated UI for selecting and assigning a nutritionist
- **Features**:
  - Loads list of available nutritionists via GET /api/nutritionists
  - Shows nutritionist cards with name and email
  - Visual feedback (border highlight) when selected
  - Assign button (disabled until selection made)
  - Skip option to choose later
  - Loading states and error handling
  - Success notification after assignment
  - Auto-refresh profile after successful assignment

#### Updated Dashboard
- **File**: `mobile/App.js`
- **Changes**:
  1. Added notification banner (Lines 503-511) that appears when `!profile?.nutritionist_id`
  2. Banner displays:
     - Title: "👨‍⚕️ ¿No tienes nutriólogo?"
     - Message: "Asigna uno para que te acompañe en tu camino hacia el bienestar"
     - Button: "Elegir nutriólogo" that navigates to nutritionist selection
  3. Added CSS styles for banner (notification-related classes)
  4. Added route case for nutritionist-selection view (Lines 623-624)

#### Updated App Routing
- **File**: `mobile/App.js`
- **Import**: Line 25 - Added NutritionistSelectionScreen import
- **Route Case**: Line 623 - Added view routing for 'nutritionist-selection'
- **Navigation Props**: 
  - `onNavigate`: Function to navigate back to other views
  - `onAssigned`: Function called after successful assignment (triggers profile refresh)

## Styling

### Notification Banner Styles (mobile/App.js)
```javascript
notificationBanner: {
  backgroundColor: '#f0f9ff',          // Light blue background
  borderLeftWidth: 4,
  borderLeftColor: '#3b82f6',          // Blue left border accent
  borderRadius: 8,
  padding: 14,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: '#bfdbfe',              // Light blue border
}

notificationTitle: {
  fontSize: 16,
  fontWeight: '700',
  color: '#1e40af',                    // Dark blue text
  marginBottom: 6,
}

notificationText: {
  fontSize: 14,
  color: '#1e3a8a',                    // Darker blue text
  marginBottom: 12,
  lineHeight: 20,
}

notificationButton: {
  backgroundColor: '#3b82f6',          // Blue button
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 6,
  alignSelf: 'flex-start',
}
```

## User Flow

### Scenario 1: User without Nutritionist
1. User logs in and views Dashboard
2. Dashboard notification banner appears (since `profile.nutritionist_id` is null)
3. User taps "Elegir nutriólogo" button
4. NutritionistSelectionScreen loads with list of available nutritionists
5. User selects a nutritionist by tapping on their card
6. User taps "Asignar Nutriólogo" button
7. Backend updates `users.nutritionist_id`
8. Profile refreshes automatically
9. Dashboard notification disappears
10. Nutritionist name can be displayed in user's profile

### Scenario 2: User with Nutritionist
1. User logs in and views Dashboard
2. No notification banner appears (since `profile.nutritionist_id` has a value)
3. Dashboard shows normal content

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  role TEXT,
  nutritionist_id INTEGER,
  FOREIGN KEY(nutritionist_id) REFERENCES users(id)
);
```

## Testing Steps

### 1. Backend Endpoint Testing
```bash
# Register a test user
curl -X POST http://localhost:8080/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"user@test.com","password":"Test123!","role":"user"}'

# Register a nutritionist
curl -X POST http://localhost:8080/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Dr. Jane Smith","email":"jane@nutri.com","password":"Test123!","role":"nutritionist"}'

# Login to get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"Test123!"}' | jq -r '.token')

# List nutritionists
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/nutritionists

# Assign nutritionist
curl -X POST http://localhost:8080/api/assign-nutritionist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nutritionist_id": 2}'

# Verify in /api/me response
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/me
```

### 2. Frontend Testing
1. Start mobile app with `expo start` or `npm run start`
2. Login with test user account
3. Dashboard should show blue notification banner
4. Tap "Elegir nutriólogo" button
5. NutritionistSelectionScreen should display with list of nutritionists
6. Select a nutritionist (card should highlight)
7. Tap "Asignar Nutriólogo" button
8. Success notification should appear
9. Return to Dashboard (notification banner should be gone)

## Files Modified
- `backend/main.go` - Added nutritionist handlers and updated meHandler
- `mobile/App.js` - Added dashboard banner, imported NutritionistSelectionScreen, added routing
- `mobile/src/NutritionistSelectionScreen.js` - NEW file with full component

## Error Handling
- Invalid nutritionist ID returns 400 Bad Request
- Non-existent nutritionist ID returns 400 Bad Request
- Unauthorized requests (missing auth header) return 401
- Database errors return 500 with generic error message
- Frontend shows Alert dialogs for error cases

## Security Considerations
- All nutritionist endpoints require authentication
- Users can only assign nutritionists to their own account
- Role validation ensures only users with role='nutritionist' can be assigned
- JWT tokens validate user identity and permissions

## Next Steps (Optional Enhancements)
1. Add ability to view assigned nutritionist's profile
2. Add ability to change nutritionist after assignment
3. Send notification to nutritionist when assigned
4. Add nutritionist approval/rejection flow
5. Track history of nutritionist assignments
6. Add rating/review system for nutritionists
