# 🧪 Quick Start - Running Tests

## Frontend Tests (React with Vitest)

### Install Dependencies
```bash
cd frontend
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests with UI (Interactive)
```bash
npm run test:ui
# Opens browser at http://localhost:51204/
```

### Run Tests with Coverage Report
```bash
npm run test:coverage
# Creates coverage report in coverage/ folder
```

### Run Specific Test
```bash
npm test -- Messages.test.jsx
npm test -- api.test.js
npm test -- auth.test.js
```

### Watch Mode (Auto-rerun on file changes)
```bash
npm test -- --watch
```

---

## Backend Tests (Go)

### Run All Tests
```bash
cd backend
go test -v ./...
```

### Run Tests with Coverage
```bash
go test -cover ./...
```

### Generate HTML Coverage Report
```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
# Opens coverage.html in browser
```

### Run Specific Test
```bash
go test -run TestUserRegistration -v
go test -run TestMessages -v
```

### Run with Race Detector
```bash
go test -race ./...
```

---

## Test Summary

### Frontend Tests
| File | Tests | Status |
|------|-------|--------|
| Messages.test.jsx | 15 | ✅ Ready |
| Dashboard.test.jsx | 6 | ✅ Ready |
| api.test.js | 8 | ✅ Ready |
| auth.test.js | 18 | ✅ Ready |
| **Total** | **47** | **✅ Ready** |

### Backend Tests
| Suite | Tests | Status |
|-------|-------|--------|
| TestUserRegistration | 5 | ✅ Ready |
| TestUserLogin | 4 | ✅ Ready |
| TestJWTTokenGeneration | 4 | ✅ Ready |
| TestHealthProfile | 4 | ✅ Ready |
| TestMealPlan | 3 | ✅ Ready |
| TestRecipeOperations | 3 | ✅ Ready |
| TestAppointmentOperations | 3 | ✅ Ready |
| TestMessageOperations | 4 | ✅ Ready |
| TestAuthenticationMiddleware | 4 | ✅ Ready |
| TestRoleBasedAccess | 4 | ✅ Ready |
| TestDataValidation | 3 | ✅ Ready |
| **Total** | **43** | **✅ Ready** |

---

## What's Being Tested

### Core Features
✅ User Authentication & JWT tokens  
✅ Messaging system (send/receive)  
✅ Health profiles  
✅ Meal plans  
✅ Recipes  
✅ Appointments  
✅ Role-based access control  
✅ API integration  
✅ Error handling  

### Key Scenarios
✅ User registration with validation  
✅ User login with credentials  
✅ Message sending and loading  
✅ Conversation management  
✅ Token generation and validation  
✅ Permission checking (user/nutritionist/admin)  
✅ Data validation  
✅ Network error handling  

---

## Documentation

📖 **Detailed Guide:** See [TESTING_GUIDE.md](TESTING_GUIDE.md)

Topics covered:
- Complete setup instructions
- Writing new tests
- Testing best practices
- Mocking strategies
- Troubleshooting
- CI/CD integration

---

## Tips

### Frontend
- Tests use `@testing-library/react` for best practices
- All API calls are mocked (no real network requests)
- Tests run in jsdom environment (simulates browser)

### Backend  
- Uses Go's built-in testing package
- Table-driven test pattern for multiple scenarios
- Ready for integration into CI/CD pipelines

### Running All Tests
```bash
# Frontend
cd frontend && npm test -- --run

# Backend  
cd backend && go test -v ./...
```

---

**Last Updated:** January 3, 2026  
**Status:** ✅ All tests ready to use
