# 🎯 Testing Commands Reference Card

## Frontend (React with Vitest)

### Installation
```bash
cd frontend
npm install  # Install test dependencies
```

### Running Tests
```bash
# Run all tests
npm test

# Run in watch mode (auto-rerun on file changes)
npm test -- --watch

# Run single test file
npm test -- Messages.test.jsx
npm test -- auth.test.js
npm test -- api.test.js

# Run tests matching pattern
npm test -- api

# Single run (non-watch, good for CI)
npm test -- --run

# Interactive UI mode
npm run test:ui

# Coverage report
npm run test:coverage
```

### Advanced Options
```bash
# Verbose output
npm test -- --reporter=verbose

# Debug mode
npm test -- --inspect-brk

# Update snapshots
npm test -- -u

# Specific number of workers
npm test -- --threads 1
```

---

## Backend (Go)

### Running Tests
```bash
cd backend

# Run all tests
go test ./...

# Run all tests with verbose output
go test -v ./...

# Run specific test
go test -run TestUserRegistration -v

# Run tests matching pattern
go test -run Message -v

# Run with coverage
go test -cover ./...

# Generate coverage report
go test -coverprofile=coverage.out ./...

# View coverage in HTML
go tool cover -html=coverage.out

# Run tests with race detector (find race conditions)
go test -race ./...

# Combine options
go test -v -race -cover ./...
```

### Benchmarking
```bash
# Run benchmarks
go test -bench=. -benchmem

# Run specific benchmark
go test -bench=BenchmarkFunction
```

---

## 📊 Test Files Quick Reference

### Frontend Test Files
```
frontend/src/tests/
├── setup.js                      - Environment setup
├── Messages.test.jsx             - 15 tests
├── Dashboard.test.jsx            - 6 tests
├── NutritionistDashboard.test.jsx - 26 tests
├── api.test.js                   - 8 tests
└── auth.test.js                  - 18 tests
```

### Backend Test File
```
backend/
└── main_test.go                  - 11 test suites (43 tests)
```

---

## 🎯 Common Tasks

### Run All Frontend Tests
```bash
cd frontend && npm test -- --run
```

### Run All Backend Tests
```bash
cd backend && go test -v ./...
```

### Run Both Frontend and Backend Tests
```bash
# Frontend
cd frontend && npm test -- --run

# Backend
cd backend && go test -v ./...
```

### Check Coverage (Frontend)
```bash
cd frontend && npm run test:coverage
```

### Check Coverage (Backend)
```bash
cd backend && go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Debug Tests (Frontend)
```bash
cd frontend && npm test -- --inspect-brk Messages.test.jsx
```

### Watch Mode (Frontend)
```bash
cd frontend && npm test -- --watch
```

### Interactive UI (Frontend)
```bash
cd frontend && npm run test:ui
# Opens http://localhost:51204/
```

---

## 🔍 Finding Tests

### By Component
- **Messages:** `frontend/src/tests/Messages.test.jsx`
- **Dashboard:** `frontend/src/tests/Dashboard.test.jsx`
- **NutritionistDashboard:** `frontend/src/tests/NutritionistDashboard.test.jsx`
- **API Functions:** `frontend/src/tests/api.test.js`
- **Auth Functions:** `frontend/src/tests/auth.test.js`

### By Feature
- **Authentication:** `auth.test.js`, Go tests for login/register
- **Messaging:** `Messages.test.jsx`
- **Nutritionist Features:** `NutritionistDashboard.test.jsx`
- **API Integration:** `api.test.js`
- **Health Profiles:** Go tests in `main_test.go`

---

## 📈 Coverage Goals

### Current Coverage
- **Frontend:** 73 test cases across 6 files
- **Backend:** 43 test cases across 11 functions

### Target Coverage
- **Frontend:** 80%+ of components and utilities
- **Backend:** 75%+ of critical paths

---

## 🛠️ Test Configuration Files

### Frontend Configuration
```javascript
// vitest.config.js
- Environment: jsdom (simulates browser)
- Setup file: src/tests/setup.js
- Coverage reporter: v8
- Globals enabled (describe, it, expect)
```

### Backend Configuration
- Uses Go's built-in testing
- No configuration file needed
- Standard Go test patterns

---

## 📝 Writing New Tests

### Frontend Template
```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

describe('Component Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Backend Template
```go
func TestFeature(t *testing.T) {
  testCases := []struct {
    name string
    input string
    want string
  }{
    {
      name: "test case",
      input: "input",
      want: "output",
    },
  }

  for _, tc := range testCases {
    t.Run(tc.name, func(t *testing.T) {
      // Test code
    })
  }
}
```

---

## ⚠️ Common Issues & Solutions

### Frontend

**Problem:** Tests timeout
```bash
# Solution: Increase timeout
npm test -- --testTimeout=10000
```

**Problem:** API mocks not working
```javascript
// Solution: Clear mocks in beforeEach
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Problem:** Component not rendering
```javascript
// Solution: Use waitFor for async operations
await waitFor(() => {
  expect(screen.getByText('text')).toBeInTheDocument();
}, { timeout: 3000 });
```

### Backend

**Problem:** Race condition detected
```bash
# Solution: Use race detector
go test -race ./...
```

**Problem:** Test data issues
```go
// Solution: Clean up in test
defer cleanupTestData()
```

---

## 📚 Documentation Files

1. **TESTING_GUIDE.md** - Comprehensive testing guide
2. **RUN_TESTS.md** - Quick start guide
3. **TESTING_SUMMARY.md** - Complete test overview
4. **This file** - Commands reference

---

## 🚀 CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install && npm test -- --run

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.24'
      - run: cd backend && go test -v -race -cover ./...
```

---

## 📞 Quick Help

### Get Test Summary
```bash
# Frontend
npm test -- --reporter=verbose

# Backend
go test -v ./... | grep -E "^--- |^PASS|^FAIL"
```

### Watch Only Changed Tests
```bash
npm test -- --watch --changedSince=main
```

### Run Tests in Parallel
```bash
# Frontend (default, uses all available cores)
npm test

# Backend
go test -parallel 4 ./...
```

### Generate JSON Report
```bash
# Frontend
npm test -- --reporter=json

# Backend
go test -json ./... > test-report.json
```

---

**Last Updated:** January 3, 2026  
**Reference Version:** 1.0
