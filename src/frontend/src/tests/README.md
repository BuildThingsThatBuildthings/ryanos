# Fitness Tracker Test Suite

A comprehensive test suite ensuring the reliability and quality of the fitness tracking application.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run specific test suites
npm run test              # Frontend unit tests with Vitest
npm run test:backend      # Backend tests with Jest
npm run test:e2e          # End-to-end tests with Playwright

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📁 Test Structure

```
src/tests/
├── backend/              # Backend API tests
│   ├── controllers/      # Controller unit tests
│   ├── services/         # Service layer tests
│   ├── integration/      # API integration tests
│   ├── database/         # Database tests
│   ├── auth/            # Authentication tests
│   └── voice/           # Voice processing tests
├── frontend/            # Frontend tests
│   ├── components/      # Component unit tests
│   ├── stores/          # Zustand store tests
│   ├── api/            # API client tests
│   ├── hooks/          # Custom hooks tests
│   └── integration/    # User flow integration tests
├── e2e/                # End-to-end tests
│   ├── workout-journey.spec.ts
│   ├── voice-logging.spec.ts
│   └── offline-sync.spec.ts
└── utils/              # Test utilities
    ├── mocks/          # Mock servers and handlers
    ├── fixtures/       # Test data and factories
    ├── custom-matchers.js
    └── test-config.js
```

## 🧪 Test Categories

### 1. Unit Tests
Fast, isolated tests for individual functions and components.

**Frontend (Vitest + React Testing Library)**
- ✅ Component rendering and interactions
- ✅ Store state management
- ✅ Utility functions
- ✅ Custom hooks

**Backend (Jest)**
- ✅ Controller logic
- ✅ Service methods
- ✅ Middleware functions
- ✅ Utility functions

### 2. Integration Tests
Test component interactions and API endpoints.

**Frontend Integration**
- ✅ User workflows and interactions
- ✅ Store-component integration
- ✅ API client with MSW mocks

**Backend Integration**
- ✅ Full API endpoint testing
- ✅ Database operations
- ✅ Authentication flows
- ✅ File upload handling

### 3. End-to-End Tests (Playwright)
Complete user journeys testing the entire application.

**Test Scenarios**
- ✅ Complete workout creation and execution
- ✅ Voice logging and processing
- ✅ Offline functionality and sync
- ✅ Responsive design and mobile views
- ✅ Accessibility compliance
- ✅ Performance requirements

### 4. Performance Tests
Ensure application meets performance standards.

- ✅ Response time benchmarks
- ✅ Memory usage validation
- ✅ Bundle size limits
- ✅ Lighthouse scores

## 🛠 Test Utilities

### Custom Matchers

```javascript
// Workout-specific assertions
expect(workout).toBeValidWorkout();
expect(set).toBeValidSet();
expect(goal).toBeValidGoal();

// API response validation
expect(response).toBeSuccessfulApiResponse();
expect(errorResponse).toBeErrorApiResponse('Not found');

// Date and time validation
expect(timestamp).toBeRecentDate();
expect(futureDate).toBeFutureDate();

// Performance assertions
expect(executionTime).toBeWithinTimeLimit(1000);
```

### Mock Data Factories

```javascript
import { createMockWorkout, createMockSet, createMockUser } from './fixtures/api-responses';

// Generate test data with overrides
const workout = createMockWorkout({ 
  name: 'Test Workout',
  status: 'in_progress' 
});

const set = createMockSet({ 
  reps: 15, 
  weight: 60 
});
```

### Database Seeding

```javascript
import { DatabaseSeeder } from './utils/database-seeder';

const seeder = new DatabaseSeeder();
await seeder.seedAll(); // Seeds all test data
const user = seeder.getTestUser(0);
const workout = seeder.getTestWorkout('Push Day');
```

## 📊 Coverage Requirements

### Coverage Thresholds
- **Global**: 80% lines, 80% functions, 80% branches, 80% statements
- **Controllers**: 90% functions, 85% lines, 80% branches
- **Services**: 85% functions, 85% lines, 75% branches
- **Components**: 80% functions, 80% lines, 75% branches

### Coverage Reports
- **HTML**: `coverage/index.html`
- **LCOV**: `coverage/lcov.info` 
- **JSON**: `coverage/coverage-final.json`

## 🚨 Test Configuration

### Environment Variables
```bash
NODE_ENV=test
JWT_SECRET=test-jwt-secret
DATABASE_URL=sqlite::memory:
OPENAI_API_KEY=test-key
```

### Browser Testing (Playwright)
```javascript
// playwright.config.ts
browsers: ['chromium', 'firefox', 'webkit']
viewports: ['desktop', 'tablet', 'mobile']
```

## 📈 CI/CD Integration

### GitHub Actions Workflow
- ✅ Unit and integration tests on Node.js 18.x, 20.x
- ✅ E2E tests on Ubuntu with browser matrix
- ✅ Performance testing with Lighthouse
- ✅ Security scanning with Trivy
- ✅ Accessibility testing with axe-core
- ✅ Code quality analysis with SonarCloud

### Quality Gates
- All tests must pass
- Coverage thresholds must be met
- Performance budgets must be respected
- Security vulnerabilities must be resolved
- Accessibility standards must be met

## 🔧 Debugging Tests

### Running Individual Tests
```bash
# Run specific test file
npm test -- workout.test.ts

# Run tests matching pattern
npm test -- --grep "should create workout"

# Debug mode
npm test -- --inspect-brk
```

### Test Debugging Tips
1. Use `console.log()` sparingly (prefer debugger)
2. Check mock implementations are correct
3. Verify async operations complete
4. Ensure proper cleanup in teardown
5. Use `screen.debug()` for DOM inspection

## 📚 Best Practices

### Writing Good Tests

1. **Descriptive Names**: Test names should explain what and why
   ```javascript
   it('should create workout with valid exercises', () => {})
   ```

2. **Arrange-Act-Assert**: Structure tests clearly
   ```javascript
   // Arrange
   const userData = { name: 'Test', email: 'test@example.com' };
   
   // Act
   const result = await createUser(userData);
   
   // Assert
   expect(result).toBeValidUser();
   ```

3. **Independent Tests**: Each test should be isolated
4. **Single Responsibility**: One test per behavior
5. **Avoid Implementation Details**: Test behavior, not internals

### Mock Guidelines

1. **Mock External Dependencies**: APIs, databases, file systems
2. **Keep Mocks Simple**: Return realistic data
3. **Reset Mocks**: Clear state between tests
4. **Mock at Boundaries**: Service/API boundaries, not internal functions

### Performance Testing

1. **Set Realistic Limits**: Based on user expectations
2. **Test Real Scenarios**: Use realistic data sizes
3. **Monitor Trends**: Track performance over time
4. **Profile Bottlenecks**: Identify slow operations

## 🐛 Troubleshooting

### Common Issues

**Tests Timing Out**
- Increase timeout in test configuration
- Check for unresolved promises
- Ensure proper cleanup

**Mock Issues**
- Verify mock implementation matches real API
- Check mock is reset between tests
- Ensure correct import paths

**Database Issues**
- Check database seeding
- Verify test isolation
- Ensure proper cleanup

**E2E Test Failures**
- Check element selectors
- Verify test data setup
- Ensure proper wait conditions

## 📖 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW (Mock Service Worker)](https://mswjs.io/)

---

For questions or issues with the test suite, please check the project's issue tracker or contact the development team.