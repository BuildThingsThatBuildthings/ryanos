import type { DatabaseError } from './types.ts';

export function validateRequired(data: Record<string, any>, requiredFields: string[]): string | null {
  for (const field of requiredFields) {
    if (!(field in data) || data[field] === null || data[field] === undefined || data[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.trim();
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}

export function handleDatabaseError(error: DatabaseError): { code: string; message: string; details?: any } {
  console.error('Database error:', error);
  
  // Handle specific PostgreSQL error codes
  switch (error.code) {
    case '23505': // Unique violation
      return {
        code: 'DUPLICATE_RECORD',
        message: 'Record already exists',
        details: error.details
      };
    case '23503': // Foreign key violation
      return {
        code: 'INVALID_REFERENCE',
        message: 'Referenced record does not exist',
        details: error.details
      };
    case '23514': // Check violation
      return {
        code: 'CONSTRAINT_VIOLATION',
        message: 'Data violates database constraints',
        details: error.details
      };
    case '42P01': // Undefined table
      return {
        code: 'TABLE_NOT_FOUND',
        message: 'Database table not found',
        details: error.details
      };
    default:
      return {
        code: 'DATABASE_ERROR',
        message: error.message || 'Database operation failed',
        details: error.details
      };
  }
}

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export function measureExecutionTime<T>(fn: () => Promise<T>): Promise<[T, number]> {
  return new Promise(async (resolve) => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    resolve([result, end - start]);
  });
}

export function parseJsonBody(req: Request): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const text = await req.text();
      if (!text) {
        resolve({});
        return;
      }
      const json = JSON.parse(text);
      resolve(sanitizeInput(json));
    } catch (error) {
      reject(new Error('Invalid JSON body'));
    }
  });
}

export function validateWorkoutConstraints(constraints: any): string | null {
  const required = ['duration_minutes', 'difficulty_level', 'equipment_available'];
  const validationError = validateRequired(constraints, required);
  if (validationError) return validationError;

  if (constraints.duration_minutes < 5 || constraints.duration_minutes > 180) {
    return 'Duration must be between 5 and 180 minutes';
  }

  if (constraints.difficulty_level < 1 || constraints.difficulty_level > 5) {
    return 'Difficulty level must be between 1 and 5';
  }

  if (!Array.isArray(constraints.equipment_available)) {
    return 'Equipment available must be an array';
  }

  return null;
}

export function validateVoiceEvent(eventData: any): string | null {
  const required = ['session_id', 'event_type'];
  const validationError = validateRequired(eventData, required);
  if (validationError) return validationError;

  const validEventTypes = ['intent_recognized', 'workout_started', 'exercise_completed', 'session_ended'];
  if (!validEventTypes.includes(eventData.event_type)) {
    return `Invalid event type. Must be one of: ${validEventTypes.join(', ')}`;
  }

  if (eventData.confidence !== undefined) {
    if (typeof eventData.confidence !== 'number' || eventData.confidence < 0 || eventData.confidence > 1) {
      return 'Confidence must be a number between 0 and 1';
    }
  }

  return null;
}

export function calculateCaloriesBurned(
  exercises: Array<{ duration_seconds?: number; intensity?: number }>,
  userWeight = 70 // kg, default average
): number {
  // Simple calorie calculation based on METs (Metabolic Equivalent of Task)
  let totalCalories = 0;
  
  for (const exercise of exercises) {
    const durationMinutes = (exercise.duration_seconds || 0) / 60;
    const intensity = exercise.intensity || 3;
    
    // METs based on intensity (rough approximation)
    const mets = intensity * 2; // 1=2METs, 2=4METs, 3=6METs, 4=8METs, 5=10METs
    
    // Calories = METs × weight(kg) × time(hours)
    const calories = mets * userWeight * (durationMinutes / 60);
    totalCalories += calories;
  }
  
  return Math.round(totalCalories);
}

export function generateWorkoutId(): string {
  return `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}