// Test configuration and setup utilities

const path = require('path');
const customMatchers = require('./custom-matchers');

// Add custom matchers to Jest
expect.extend(customMatchers);

// Test database configuration
const TEST_DB_CONFIG = {
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

// Test server configuration
const TEST_SERVER_CONFIG = {
  port: process.env.TEST_PORT || 3001,
  host: 'localhost',
  cors: {
    origin: true,
    credentials: true
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // Much higher for tests
  }
};

// Test user configurations
const TEST_USERS = {
  user1: {
    email: 'testuser1@example.com',
    password: 'TestPassword123!',
    name: 'Test User 1'
  },
  user2: {
    email: 'testuser2@example.com',
    password: 'TestPassword456!',
    name: 'Test User 2'
  },
  admin: {
    email: 'admin@example.com',
    password: 'AdminPassword789!',
    name: 'Admin User',
    role: 'admin'
  }
};

// Mock data generators
const generateMockWorkout = (overrides = {}) => ({
  id: `workout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  userId: 'user-test-1',
  name: 'Mock Workout',
  description: 'Generated for testing',
  date: new Date().toISOString().split('T')[0],
  status: 'planned',
  sets: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

const generateMockSet = (overrides = {}) => ({
  id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  exerciseId: 'exercise-test-1',
  setNumber: 1,
  reps: 10,
  weight: 50,
  completed: false,
  ...overrides
});

const generateMockExercise = (overrides = {}) => ({
  id: `exercise-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Mock Exercise',
  category: 'strength',
  movementPattern: 'push',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  equipment: ['bodyweight'],
  ...overrides
});

const generateMockGoal = (overrides = {}) => ({
  id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  userId: 'user-test-1',
  title: 'Mock Goal',
  description: 'Generated for testing',
  type: 'weight',
  targetValue: 100,
  currentValue: 50,
  unit: 'kg',
  targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'active',
  priority: 'medium',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

const generateMockVoiceSession = (overrides = {}) => ({
  id: `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  userId: 'user-test-1',
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 60000).toISOString(),
  transcript: 'Mock voice transcript for testing',
  processed: true,
  extractedData: {
    exercises: [
      {
        name: 'Push-ups',
        sets: [{ reps: 10 }]
      }
    ]
  },
  status: 'completed',
  ...overrides
});

// Test utilities
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retry = async (fn, maxAttempts = 3, delay = 100) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await waitFor(delay);
      }
    }
  }
  
  throw lastError;
};

const expectAsyncError = async (asyncFn, expectedError) => {
  try {
    await asyncFn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (expectedError instanceof RegExp) {
      expect(error.message).toMatch(expectedError);
    } else if (typeof expectedError === 'string') {
      expect(error.message).toContain(expectedError);
    } else {
      expect(error).toBeInstanceOf(expectedError);
    }
  }
};

const measureExecutionTime = async (fn) => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  
  return {
    result,
    executionTime: Number(end - start) / 1000000 // Convert to milliseconds
  };
};

// Database test utilities
const cleanDatabase = async (sequelize) => {
  const models = Object.values(sequelize.models);
  
  // Disable foreign key checks
  await sequelize.query('PRAGMA foreign_keys = OFF');
  
  // Clear all tables
  for (const model of models) {
    await model.destroy({ where: {}, force: true });
  }
  
  // Re-enable foreign key checks
  await sequelize.query('PRAGMA foreign_keys = ON');
};

const seedTestData = async (seeder) => {
  return {
    users: await seeder.seedUsers(),
    exercises: await seeder.seedExercises(),
    workouts: await seeder.seedWorkouts(),
    sets: await seeder.seedSets(),
    goals: await seeder.seedGoals(),
    voiceSessions: await seeder.seedVoiceSessions(),
  };
};

// API test utilities
const createAuthenticatedRequest = (request, token) => {
  return request.set('Authorization', `Bearer ${token}`);
};

const expectValidationError = (response, fields = []) => {
  expect(response.status).toBe(400);
  expect(response.body).toHaveValidationErrors(fields);
};

const expectUnauthorized = (response) => {
  expect(response.status).toBe(401);
  expect(response.body).toBeErrorApiResponse('Authentication required');
};

const expectNotFound = (response, resource = 'Resource') => {
  expect(response.status).toBe(404);
  expect(response.body).toBeErrorApiResponse(`${resource} not found`);
};

// Mock utilities
const createMockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  ...overrides
});

const createMockResponse = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    send: jest.fn(() => res),
    cookie: jest.fn(() => res),
    clearCookie: jest.fn(() => res),
    redirect: jest.fn(() => res),
    locals: {}
  };
  return res;
};

const createMockNext = () => jest.fn();

// Environment setup
const setupTestEnvironment = () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.BCRYPT_ROUNDS = '1'; // Faster for tests
  
  // Mock console methods to reduce noise in tests
  const originalConsole = { ...console };
  
  beforeAll(() => {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = originalConsole.error; // Keep error logging
  });
  
  afterAll(() => {
    Object.assign(console, originalConsole);
  });
};

// Performance testing utilities
const performanceTest = (name, fn, options = {}) => {
  const {
    maxExecutionTime = 1000,
    iterations = 1,
    warmupIterations = 0
  } = options;
  
  return test(name, async () => {
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }
    
    // Actual test
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const { executionTime } = await measureExecutionTime(fn);
      times.push(executionTime);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTime = Math.max(...times);
    
    console.log(`Performance test "${name}":`, {
      avgTime: `${avgTime.toFixed(2)}ms`,
      maxTime: `${maxTime.toFixed(2)}ms`,
      iterations
    });
    
    expect(avgTime).toBeWithinTimeLimit(maxExecutionTime);
    expect(maxTime).toBeWithinTimeLimit(maxExecutionTime * 2);
  });
};

// Load testing utilities
const loadTest = (name, fn, options = {}) => {
  const {
    concurrency = 10,
    duration = 5000,
    maxErrors = 0
  } = options;
  
  return test(name, async () => {
    const endTime = Date.now() + duration;
    const workers = [];
    const results = { success: 0, error: 0, errors: [] };
    
    // Create workers
    for (let i = 0; i < concurrency; i++) {
      workers.push(
        (async () => {
          while (Date.now() < endTime) {
            try {
              await fn();
              results.success++;
            } catch (error) {
              results.error++;
              results.errors.push(error);
            }
          }
        })()
      );
    }
    
    // Wait for all workers to complete
    await Promise.all(workers);
    
    console.log(`Load test "${name}":`, {
      success: results.success,
      error: results.error,
      errorRate: `${((results.error / (results.success + results.error)) * 100).toFixed(2)}%`
    });
    
    expect(results.error).toBeLessThanOrEqual(maxErrors);
    expect(results.success).toBeGreaterThan(0);
  }, duration + 5000); // Add buffer to test timeout
};

module.exports = {
  TEST_DB_CONFIG,
  TEST_SERVER_CONFIG,
  TEST_USERS,
  generateMockWorkout,
  generateMockSet,
  generateMockExercise,
  generateMockGoal,
  generateMockVoiceSession,
  waitFor,
  retry,
  expectAsyncError,
  measureExecutionTime,
  cleanDatabase,
  seedTestData,
  createAuthenticatedRequest,
  expectValidationError,
  expectUnauthorized,
  expectNotFound,
  createMockRequest,
  createMockResponse,
  createMockNext,
  setupTestEnvironment,
  performanceTest,
  loadTest,
};