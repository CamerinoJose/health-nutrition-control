# Unit Testing Guide - BienestarApp

## Overview
This document describes the comprehensive unit testing suite for the BienestarApp project across frontend (React) and backend (Go).

## Frontend Testing (React with Vitest)

### Setup

#### Prerequisites
- Node.js 18+
- npm or yarn

#### Installation
```bash
cd frontend
npm install
```

This installs the testing dependencies:
- **vitest** - Modern JavaScript test framework
- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - DOM matchers
- **jsdom** - JavaScript implementation of web standards

### Running Tests

#### Run all tests
```bash
npm test
```

#### Run tests in UI mode (interactive)
```bash
npm run test:ui
```

#### Run tests with coverage
```bash
npm run test:coverage
```

#### Run specific test file
```bash
npm test -- Messages.test.jsx
```

#### Watch mode (re-run on file changes)
```bash
npm test -- --watch
```

### Test Files Structure

```
frontend/src/tests/
├── setup.js                 # Test environment setup
├── Messages.test.jsx        # Messages component tests
├── Dashboard.test.jsx       # Dashboard component tests
└── api.test.js             # API module tests
└── auth.test.js            # Authentication tests
```

### Test Coverage

#### Messages Component (`Messages.test.jsx`)
- **Tests:** 15 test cases
- **Coverage:**
  - ✅ Initial load and loading state
  - ✅ Loading conversations from API
  - ✅ Empty state handling
  - ✅ Conversation selection and message loading
  - ✅ Unread message marking
  - ✅ Message sending
  - ✅ Input validation and clearing
  - ✅ Send button disabled state
  - ✅ Message display (own vs other)
  - ✅ Read status indicators
  - ✅ Polling functionality
  - ✅ Error handling for API calls
  - ✅ Alert on send failure

#### API Module (`api.test.js`)
- **Tests:** 8 test cases
- **Coverage:**
  - ✅ Authorization header with token
  - ✅ Missing token handling
  - ✅ Base URL configuration
  - ✅ Environment variable support
  - ✅ Network error handling
  - ✅ 401 Unauthorized handling
  - ✅ 404 Not Found handling

#### Authentication (`auth.test.js`)
- **Tests:** 18 test cases
- **Coverage:**
  - ✅ Token storage and retrieval
  - ✅ Token clearing on logout
  - ✅ JWT structure validation
  - ✅ Payload decoding
  - ✅ Required field validation
  - ✅ Role identification (user, nutritionist, admin)
  - ✅ Role-based access control
  - ✅ Session management
  - ✅ Login/logout state tracking

#### Dashboard Component (`Dashboard.test.jsx`)
- **Tests:** 6 test cases
- **Coverage:**
  - ✅ Component rendering
  - ✅ Health profile loading
  - ✅ Profile data display
  - ✅ Error handling

### Writing New Tests

#### Basic Component Test Template
```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import MyComponent from '../MyComponent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render component', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    render(<MyComponent />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText('Updated Text')).toBeInTheDocument();
    });
  });
});
```

#### Mocking API Calls
```javascript
import * as apiModule from '../api';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// In test
apiModule.default.get.mockResolvedValueOnce({ data: mockData });
```

---

## Backend Testing (Go)

### Setup

#### Prerequisites
- Go 1.24+

### Running Tests

#### Run all tests
```bash
cd backend
go test ./...
```

#### Run tests with verbose output
```bash
go test -v ./...
```

#### Run tests with coverage
```bash
go test -cover ./...
```

#### Generate coverage HTML report
```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

#### Run specific test
```bash
go test -run TestUserRegistration ./...
```

### Test Files Structure

```
backend/
├── main_test.go           # Main test file with all test functions
```

### Test Coverage

#### Authentication Tests
- **TestUserRegistration** (5 cases)
  - ✅ Valid registration
  - ✅ Duplicate email rejection
  - ✅ Invalid email format
  - ✅ Weak password rejection
  - ✅ Empty email rejection

- **TestUserLogin** (4 cases)
  - ✅ Valid credentials
  - ✅ Wrong password
  - ✅ User not found
  - ✅ Empty credentials

#### JWT Token Tests
- **TestJWTTokenGeneration** (4 cases)
  - ✅ Valid user token
  - ✅ Valid nutritionist token
  - ✅ Valid admin token
  - ✅ Invalid user ID

#### Health Profile Tests
- **TestHealthProfile** (4 cases)
  - ✅ Valid health profile
  - ✅ Invalid age validation
  - ✅ Invalid height validation
  - ✅ Invalid weight validation

#### Meal Plan Tests
- **TestMealPlan** (3 cases)
  - ✅ Valid meal plan creation
  - ✅ Empty plan name rejection
  - ✅ Invalid user rejection

#### Recipe Tests
- **TestRecipeOperations** (3 cases)
  - ✅ Valid recipe creation
  - ✅ Invalid calories rejection
  - ✅ Empty recipe name rejection

#### Appointment Tests
- **TestAppointmentOperations** (3 cases)
  - ✅ Valid appointment creation
  - ✅ Invalid patient ID
  - ✅ Invalid status

#### Message Tests
- **TestMessageOperations** (4 cases)
  - ✅ Valid message sending
  - ✅ Empty content rejection
  - ✅ Invalid sender rejection
  - ✅ Self-message rejection

#### Middleware Tests
- **TestAuthenticationMiddleware** (4 cases)
  - ✅ Valid token
  - ✅ Invalid token
  - ✅ Expired token
  - ✅ Missing token

#### RBAC Tests
- **TestRoleBasedAccess** (4 cases)
  - ✅ User access to user resources
  - ✅ User denied nutritionist resources
  - ✅ Nutritionist access to own resources
  - ✅ Admin access to all resources

#### Data Validation Tests
- **TestDataValidation** (3 cases)
  - ✅ Valid user data
  - ✅ Invalid email format
  - ✅ Missing required fields

### Writing New Go Tests

#### Basic Test Template
```go
func TestMyFunction(t *testing.T) {
    testCases := []struct {
        name    string
        input   string
        want    string
        wantErr bool
    }{
        {
            name:    "Valid input",
            input:   "test",
            want:    "expected output",
            wantErr: false,
        },
        {
            name:    "Invalid input",
            input:   "",
            want:    "",
            wantErr: true,
        },
    }

    for _, tc := range testCases {
        t.Run(tc.name, func(t *testing.T) {
            got, err := MyFunction(tc.input)
            if (err != nil) != tc.wantErr {
                t.Errorf("got error %v, want error %v", err, tc.wantErr)
            }
            if got != tc.want {
                t.Errorf("got %s, want %s", got, tc.want)
            }
        })
    }
}
```

---

## Testing Best Practices

### Frontend
1. **Test behavior, not implementation** - Focus on what users see and interact with
2. **Use semantic queries** - Prefer `getByRole`, `getByLabelText` over `getByTestId`
3. **Mock external dependencies** - API calls, external libraries
4. **Test error states** - Not just happy paths
5. **Clean up after tests** - Use `beforeEach` and `afterEach`
6. **Use meaningful assertion messages** - Help debugging failures
7. **Keep tests focused** - One assertion per test when possible
8. **Avoid implementation details** - Don't test internal state directly

### Backend
1. **Table-driven tests** - Use struct slices for multiple test cases
2. **Descriptive names** - Test names should explain what's being tested
3. **Arrange-Act-Assert** - Clear test structure
4. **Test edge cases** - Empty inputs, invalid values, boundary conditions
5. **Use subtests** - `t.Run()` for organizing related tests
6. **Mock external services** - Databases, APIs, file systems
7. **Test concurrency carefully** - Use race detector: `go test -race`
8. **Keep tests independent** - Tests should not depend on execution order

---

## Continuous Integration

### Running Tests in CI/CD
```bash
# Frontend
cd frontend
npm install
npm test -- --run  # Single run, no watch mode

# Backend
cd backend
go test -v -race -cover ./...
```

---

## Coverage Goals

### Current Status
- **Frontend:** ~85% coverage for core components
- **Backend:** Test structure for all major functions

### Target Coverage
- **Frontend:** 80%+ for components and utilities
- **Backend:** 75%+ for critical paths

---

## Troubleshooting

### Frontend Tests

#### Tests timing out
```javascript
// Increase timeout for specific test
it('slow test', async () => {
  // test code
}, 10000); // 10 second timeout
```

#### API mocks not working
```javascript
// Clear all mocks in beforeEach
beforeEach(() => {
  vi.clearAllMocks();
});
```

#### React rendering issues
```javascript
// Ensure async operations complete
await waitFor(() => {
  expect(screen.getByText('text')).toBeInTheDocument();
}, { timeout: 3000 });
```

### Backend Tests

#### Tests failing intermittently
- Check for race conditions: `go test -race`
- Ensure test data cleanup
- Verify test isolation

#### Database test issues
- Use separate test database
- Reset state in `setUp`
- Use transactions for isolation

---

## Useful Resources

- [Vitest Documentation](https://vitest.dev)
- [React Testing Library](https://testing-library.com/react)
- [Go Testing Package](https://golang.org/pkg/testing/)
- [Jest Matchers](https://jestjs.io/docs/expect)

---

## Next Steps

1. **Expand Component Tests** - Add tests for remaining components
2. **Integration Tests** - Test component interactions
3. **E2E Tests** - User journey testing with Cypress/Playwright
4. **API Integration Tests** - Test frontend-backend integration
5. **Load Testing** - Performance testing for backend

---

**Last Updated:** January 3, 2026
**Test Suite Status:** ✅ Active and Maintained
