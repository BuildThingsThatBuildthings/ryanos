// Custom Jest matchers for fitness tracking application

const { matcherHint, printReceived, printExpected } = require('jest-matcher-utils');

// Workout-specific matchers
const toBeValidWorkout = function(received) {
  const pass = received &&
    typeof received.id === 'string' &&
    typeof received.name === 'string' &&
    typeof received.userId === 'string' &&
    ['planned', 'in_progress', 'completed', 'cancelled'].includes(received.status) &&
    Array.isArray(received.sets);

  const message = () =>
    `${matcherHint('.toBeValidWorkout', 'workout', '')}\n\n` +
    `Expected: ${printExpected('valid workout object')}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

const toBeValidSet = function(received) {
  const pass = received &&
    typeof received.id === 'string' &&
    typeof received.exerciseId === 'string' &&
    typeof received.setNumber === 'number' &&
    received.setNumber > 0 &&
    typeof received.completed === 'boolean' &&
    (received.reps == null || typeof received.reps === 'number') &&
    (received.weight == null || typeof received.weight === 'number') &&
    (received.time == null || typeof received.time === 'number') &&
    (received.distance == null || typeof received.distance === 'number');

  const message = () =>
    `${matcherHint('.toBeValidSet', 'set', '')}\n\n` +
    `Expected: ${printExpected('valid set object')}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

const toBeValidExercise = function(received) {
  const validCategories = ['strength', 'cardio', 'flexibility', 'balance', 'mobility', 'plyometric'];
  const validMovementPatterns = ['squat', 'hinge', 'lunge', 'push', 'pull', 'carry', 'twist', 'gait'];
  
  const pass = received &&
    typeof received.id === 'string' &&
    typeof received.name === 'string' &&
    validCategories.includes(received.category) &&
    validMovementPatterns.includes(received.movementPattern) &&
    Array.isArray(received.primaryMuscles) &&
    Array.isArray(received.secondaryMuscles) &&
    Array.isArray(received.equipment);

  const message = () =>
    `${matcherHint('.toBeValidExercise', 'exercise', '')}\n\n` +
    `Expected: ${printExpected('valid exercise object')}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

// Goal-specific matchers
const toBeValidGoal = function(received) {
  const validTypes = ['weight', 'reps', 'time', 'distance', 'frequency', 'body_composition'];
  const validStatuses = ['active', 'completed', 'paused', 'cancelled'];
  const validPriorities = ['low', 'medium', 'high'];

  const pass = received &&
    typeof received.id === 'string' &&
    typeof received.title === 'string' &&
    typeof received.userId === 'string' &&
    validTypes.includes(received.type) &&
    validStatuses.includes(received.status) &&
    validPriorities.includes(received.priority) &&
    typeof received.targetValue === 'number' &&
    typeof received.currentValue === 'number' &&
    typeof received.unit === 'string' &&
    typeof received.targetDate === 'string';

  const message = () =>
    `${matcherHint('.toBeValidGoal', 'goal', '')}\n\n` +
    `Expected: ${printExpected('valid goal object')}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

// API response matchers
const toBeSuccessfulApiResponse = function(received) {
  const pass = received &&
    typeof received === 'object' &&
    received.success === true &&
    received.hasOwnProperty('data');

  const message = () =>
    `${matcherHint('.toBeSuccessfulApiResponse', 'response', '')}\n\n` +
    `Expected: ${printExpected('successful API response with success: true and data')}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

const toBeErrorApiResponse = function(received, expectedMessage) {
  const pass = received &&
    typeof received === 'object' &&
    received.success === false &&
    typeof received.message === 'string' &&
    (expectedMessage ? received.message.includes(expectedMessage) : true);

  const message = () =>
    `${matcherHint('.toBeErrorApiResponse', 'response', expectedMessage || '')}\n\n` +
    `Expected: ${printExpected(`error API response with success: false${expectedMessage ? ` and message containing "${expectedMessage}"` : ''}`)}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

// Pagination matchers
const toBeValidPaginatedResponse = function(received) {
  const pass = received &&
    typeof received === 'object' &&
    Array.isArray(received.data) &&
    typeof received.total === 'number' &&
    typeof received.page === 'number' &&
    typeof received.limit === 'number' &&
    typeof received.hasNext === 'boolean' &&
    typeof received.hasPrev === 'boolean' &&
    received.page > 0 &&
    received.limit > 0 &&
    received.total >= 0;

  const message = () =>
    `${matcherHint('.toBeValidPaginatedResponse', 'response', '')}\n\n` +
    `Expected: ${printExpected('valid paginated response')}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

// Date/time matchers
const toBeRecentDate = function(received, withinMinutes = 5) {
  const receivedDate = new Date(received);
  const now = new Date();
  const diffMinutes = (now - receivedDate) / (1000 * 60);
  
  const pass = !isNaN(receivedDate.getTime()) && 
    diffMinutes >= 0 && 
    diffMinutes <= withinMinutes;

  const message = () =>
    `${matcherHint('.toBeRecentDate', 'date', withinMinutes.toString())}\n\n` +
    `Expected: ${printExpected(`date within ${withinMinutes} minutes of now`)}\n` +
    `Received: ${printReceived(received)} (${diffMinutes.toFixed(2)} minutes ago)`;

  return { actual: received, message, pass };
};

const toBeFutureDate = function(received) {
  const receivedDate = new Date(received);
  const now = new Date();
  
  const pass = !isNaN(receivedDate.getTime()) && receivedDate > now;

  const message = () =>
    `${matcherHint('.toBeFutureDate', 'date', '')}\n\n` +
    `Expected: ${printExpected('date in the future')}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

// Performance matchers
const toBeWithinTimeLimit = function(received, limitMs) {
  const pass = typeof received === 'number' && received <= limitMs;

  const message = () =>
    `${matcherHint('.toBeWithinTimeLimit', 'duration', limitMs.toString())}\n\n` +
    `Expected: ${printExpected(`execution time <= ${limitMs}ms`)}\n` +
    `Received: ${printReceived(`${received}ms`)}`;

  return { actual: received, message, pass };
};

// Voice processing matchers
const toBeValidVoiceSession = function(received) {
  const validStatuses = ['recording', 'processing', 'completed', 'error'];
  
  const pass = received &&
    typeof received.id === 'string' &&
    typeof received.userId === 'string' &&
    typeof received.startTime === 'string' &&
    typeof received.transcript === 'string' &&
    typeof received.processed === 'boolean' &&
    validStatuses.includes(received.status);

  const message = () =>
    `${matcherHint('.toBeValidVoiceSession', 'voiceSession', '')}\n\n` +
    `Expected: ${printExpected('valid voice session object')}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

const toHaveConfidenceScore = function(received, minConfidence = 0.7) {
  const pass = received &&
    typeof received.confidence === 'number' &&
    received.confidence >= minConfidence &&
    received.confidence <= 1;

  const message = () =>
    `${matcherHint('.toHaveConfidenceScore', 'voiceResult', minConfidence.toString())}\n\n` +
    `Expected: ${printExpected(`confidence score >= ${minConfidence}`)}\n` +
    `Received: ${printReceived(received?.confidence)}`;

  return { actual: received, message, pass };
};

// Validation matchers
const toHaveValidationErrors = function(received, expectedFields) {
  const pass = received &&
    received.success === false &&
    received.message && received.message.includes('Validation') &&
    Array.isArray(received.details) &&
    received.details.length > 0 &&
    (expectedFields ? expectedFields.every(field => 
      received.details.some(detail => detail.field === field)
    ) : true);

  const message = () =>
    `${matcherHint('.toHaveValidationErrors', 'response', expectedFields ? JSON.stringify(expectedFields) : '')}\n\n` +
    `Expected: ${printExpected(`validation error response${expectedFields ? ` with fields: ${expectedFields.join(', ')}` : ''}`)}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

// Statistics matchers
const toHaveValidWorkoutStats = function(received) {
  const pass = received &&
    (received.totalVolume == null || typeof received.totalVolume === 'number') &&
    (received.totalTime == null || typeof received.totalTime === 'number') &&
    (received.averageRPE == null || (typeof received.averageRPE === 'number' && received.averageRPE >= 1 && received.averageRPE <= 10));

  const message = () =>
    `${matcherHint('.toHaveValidWorkoutStats', 'workout', '')}\n\n` +
    `Expected: ${printExpected('valid workout statistics')}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

// Array matchers
const toBeNonEmptyArray = function(received) {
  const pass = Array.isArray(received) && received.length > 0;

  const message = () =>
    `${matcherHint('.toBeNonEmptyArray', 'received', '')}\n\n` +
    `Expected: ${printExpected('non-empty array')}\n` +
    `Received: ${printReceived(received)}`;

  return { actual: received, message, pass };
};

const toHaveUniqueElements = function(received, keyPath) {
  if (!Array.isArray(received)) {
    return {
      actual: received,
      message: () => `Expected array but received ${typeof received}`,
      pass: false
    };
  }

  const values = keyPath 
    ? received.map(item => keyPath.split('.').reduce((obj, key) => obj?.[key], item))
    : received;
  
  const uniqueValues = [...new Set(values)];
  const pass = values.length === uniqueValues.length;

  const message = () =>
    `${matcherHint('.toHaveUniqueElements', 'array', keyPath || '')}\n\n` +
    `Expected: ${printExpected('array with unique elements')}\n` +
    `Received: ${printReceived(`array with ${values.length} elements, ${uniqueValues.length} unique`)}`;

  return { actual: received, message, pass };
};

module.exports = {
  toBeValidWorkout,
  toBeValidSet,
  toBeValidExercise,
  toBeValidGoal,
  toBeSuccessfulApiResponse,
  toBeErrorApiResponse,
  toBeValidPaginatedResponse,
  toBeRecentDate,
  toBeFutureDate,
  toBeWithinTimeLimit,
  toBeValidVoiceSession,
  toHaveConfidenceScore,
  toHaveValidationErrors,
  toHaveValidWorkoutStats,
  toBeNonEmptyArray,
  toHaveUniqueElements,
};