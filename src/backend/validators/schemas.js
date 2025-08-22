const { z } = require('zod');

// Common schemas
const uuidSchema = z.string().uuid('Invalid UUID format');
const positiveIntSchema = z.number().int().positive('Must be a positive integer');
const positiveNumberSchema = z.number().positive('Must be a positive number');
const dateSchema = z.string().datetime().or(z.date());
const rpeSchema = z.number().min(1).max(10).optional();

// User schemas
const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  username: z.string().min(3).max(50).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  heightCm: z.number().min(50).max(300).optional(),
  weightKg: z.number().min(20).max(500).optional(),
  timezone: z.string().max(50).optional(),
  unitsPreference: z.enum(['metric', 'imperial']).optional()
});

const userLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const userUpdateSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  heightCm: z.number().min(50).max(300).optional(),
  weightKg: z.number().min(20).max(500).optional(),
  timezone: z.string().max(50).optional(),
  unitsPreference: z.enum(['metric', 'imperial']).optional()
});

// Voice schemas
const voiceSessionSchema = z.object({
  sessionType: z.enum(['workout', 'planning', 'query']),
  metadata: z.record(z.any()).optional()
});

const voiceEventSchema = z.object({
  sessionId: uuidSchema,
  intent: z.string().min(1).max(100),
  payload: z.record(z.any()),
  transcript: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  timestamp: dateSchema.optional()
});

// Exercise schemas
const exerciseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  muscleGroups: z.array(z.string()).min(1, 'At least one muscle group is required'),
  equipmentNeeded: z.array(z.string()).optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  instructions: z.string().optional(),
  videoUrl: z.string().url().optional(),
  variations: z.array(z.string()).optional()
});

const exerciseUpdateSchema = exerciseSchema.partial();

const exerciseSuggestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  muscleGroups: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  maxSuggestions: z.number().int().min(1).max(10).optional().default(5)
});

// Workout schemas
const workoutSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  workoutDate: z.string().date(),
  timeCapMinutes: positiveIntSchema.optional(),
  focus: z.string().max(100).optional(),
  exclusions: z.array(z.string()).optional(),
  workoutType: z.enum(['strength', 'cardio', 'mixed', 'flexibility', 'sport_specific']).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.enum(['manual', 'llm_generated', 'template', 'voice']).optional()
});

const workoutUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  timeCapMinutes: positiveIntSchema.optional(),
  focus: z.string().max(100).optional(),
  exclusions: z.array(z.string()).optional(),
  workoutType: z.enum(['strength', 'cardio', 'mixed', 'flexibility', 'sport_specific']).optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'skipped']).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  overallRpe: rpeSchema,
  actualDurationMinutes: positiveIntSchema.optional()
});

const workoutGenerateSchema = z.object({
  date: z.string().date(),
  timeCapMin: positiveIntSchema,
  focus: z.string().max(100).optional(),
  exclusions: z.array(z.string()).optional(),
  workoutType: z.enum(['strength', 'cardio', 'mixed', 'flexibility', 'sport_specific']).optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  equipment: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional()
});

// Set schemas
const setSchema = z.object({
  workoutId: uuidSchema,
  exerciseId: uuidSchema,
  setNumber: positiveIntSchema,
  reps: positiveIntSchema.optional(),
  weightKg: positiveNumberSchema.optional(),
  distanceM: positiveNumberSchema.optional(),
  durationSeconds: positiveIntSchema.optional(),
  rpe: rpeSchema,
  restSeconds: positiveIntSchema.optional(),
  tempo: z.number().optional(),
  notes: z.string().optional(),
  isWarmup: z.boolean().optional(),
  additionalMetrics: z.record(z.any()).optional()
});

const setUpdateSchema = z.object({
  reps: positiveIntSchema.optional(),
  weightKg: positiveNumberSchema.optional(),
  distanceM: positiveNumberSchema.optional(),
  durationSeconds: positiveIntSchema.optional(),
  rpe: rpeSchema,
  restSeconds: positiveIntSchema.optional(),
  tempo: z.number().optional(),
  notes: z.string().optional(),
  isWarmup: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
  additionalMetrics: z.record(z.any()).optional()
});

// Query parameter schemas
const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default(1),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

const dateRangeSchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional()
});

const workoutFilterSchema = paginationSchema.extend({
  status: z.enum(['planned', 'in_progress', 'completed', 'skipped']).optional(),
  workoutType: z.enum(['strength', 'cardio', 'mixed', 'flexibility', 'sport_specific']).optional(),
  focus: z.string().optional(),
  source: z.enum(['manual', 'llm_generated', 'template', 'voice']).optional()
}).merge(dateRangeSchema);

const exerciseFilterSchema = paginationSchema.extend({
  category: z.string().optional(),
  muscleGroup: z.string().optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  equipment: z.string().optional(),
  search: z.string().optional(),
  isActive: z.string().transform(val => val === 'true').optional()
});

// Summary schemas
const summaryQuerySchema = z.object({
  days: z.string().transform(Number).pipe(z.number().int().min(1).max(90)).optional().default(7),
  includePatterns: z.string().transform(val => val === 'true').optional().default(true),
  includeMuscleGroups: z.string().transform(val => val === 'true').optional().default(true),
  includeFlags: z.string().transform(val => val === 'true').optional().default(true)
});

module.exports = {
  // User schemas
  userRegistrationSchema,
  userLoginSchema,
  userUpdateSchema,
  
  // Voice schemas
  voiceSessionSchema,
  voiceEventSchema,
  
  // Exercise schemas
  exerciseSchema,
  exerciseUpdateSchema,
  exerciseSuggestSchema,
  
  // Workout schemas
  workoutSchema,
  workoutUpdateSchema,
  workoutGenerateSchema,
  
  // Set schemas
  setSchema,
  setUpdateSchema,
  
  // Filter schemas
  workoutFilterSchema,
  exerciseFilterSchema,
  summaryQuerySchema,
  
  // Common schemas
  paginationSchema,
  dateRangeSchema,
  uuidSchema
};