// Shared TypeScript types for Supabase Edge Functions

export interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface VoiceSession {
  id: string;
  user_id: string;
  status: 'active' | 'completed' | 'failed';
  started_at: string;
  ended_at?: string;
  session_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface VoiceEvent {
  id: string;
  session_id: string;
  event_type: 'intent_recognized' | 'workout_started' | 'exercise_completed' | 'session_ended';
  intent?: string;
  confidence?: number;
  event_data?: Record<string, any>;
  created_at: string;
}

export interface WorkoutPlan {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  difficulty_level: 1 | 2 | 3 | 4 | 5;
  exercises: Exercise[];
  equipment_needed: string[];
  calories_estimate: number;
  generated_by: 'llm' | 'template' | 'user';
  tags: string[];
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  sets?: number;
  reps?: number;
  duration_seconds?: number;
  rest_seconds?: number;
  intensity?: 1 | 2 | 3 | 4 | 5;
  instructions?: string;
  modifications?: string[];
  equipment?: string[];
}

export interface WorkoutConstraints {
  duration_minutes: number;
  difficulty_level: 1 | 2 | 3 | 4 | 5;
  equipment_available: string[];
  muscle_groups_focus?: string[];
  exercise_preferences?: string[];
  limitations?: string[];
  goals?: string[];
}

export interface Analytics7D {
  total_workouts: number;
  total_duration_minutes: number;
  total_calories_burned: number;
  average_workout_duration: number;
  most_common_exercises: Array<{
    exercise_name: string;
    frequency: number;
  }>;
  workout_frequency_by_day: Array<{
    day: string;
    workout_count: number;
  }>;
  difficulty_distribution: Record<string, number>;
  equipment_usage: Record<string, number>;
  completion_rate: number;
  streak_days: number;
  improvement_metrics: {
    duration_trend: 'increasing' | 'decreasing' | 'stable';
    difficulty_trend: 'increasing' | 'decreasing' | 'stable';
    consistency_score: number;
  };
}

export interface ExerciseSuggestion {
  exercise: Exercise;
  reason: string;
  confidence: number;
  alternative_exercises: Exercise[];
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    request_id: string;
    execution_time_ms: number;
  };
}

export interface DatabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

// LLM Workout Generation Types
export interface LLMWorkoutRequest {
  constraints: WorkoutConstraints;
  preferences?: {
    workout_style?: string;
    intensity_preference?: string;
    focus_areas?: string[];
    avoid_exercises?: string[];
    injury_history?: string[];
    experience_level?: 'beginner' | 'intermediate' | 'advanced';
  };
  safety_override?: boolean;
}

export interface SafetyConstraints {
  maxDurationMinutes: number;
  maxSetsPerExercise: number;
  maxRepsPerSet: number;
  maxWeightProgression: number;
  allowedEquipment: string[];
  requiredRestPeriods: Record<string, number>;
  intensityLimits: Record<string, number>;
  exerciseBlacklist: string[];
}

export interface LibraryExercise extends Exercise {
  safety_rating: number;
  difficulty_level: number;
  contraindications: string[];
  is_compound: boolean;
  movement_pattern: string;
}

// Safety Validation Types
export interface SafetyValidationRequest {
  workout_plan?: {
    exercises: Array<{
      id: string;
      name: string;
      sets?: number;
      reps?: number;
      weight?: number;
      duration_seconds?: number;
      intensity?: number;
    }>;
    duration_minutes: number;
    difficulty_level: number;
  };
  exercise_suggestion?: {
    id: string;
    name: string;
    category: string;
    muscle_groups: string[];
    equipment: string[];
  };
  user_context?: {
    injury_history?: string[];
    limitations?: string[];
    experience_level?: 'beginner' | 'intermediate' | 'advanced';
    age?: number;
    medical_conditions?: string[];
  };
  validation_type: 'workout' | 'exercise' | 'progression';
}

export interface SafetyValidationResponse {
  is_safe: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'very_high';
  safety_score: number;
  violations: SafetyViolation[];
  recommendations: string[];
  modifications: SafetyModification[];
  contraindications: string[];
}

export interface SafetyViolation {
  type: 'volume' | 'intensity' | 'exercise' | 'progression' | 'medical';
  severity: 'warning' | 'error' | 'critical';
  description: string;
  affected_exercise?: string;
  recommendation: string;
}

export interface SafetyModification {
  exercise_id: string;
  modification_type: 'replace' | 'reduce_sets' | 'reduce_reps' | 'reduce_weight' | 'add_rest';
  original_value: any;
  suggested_value: any;
  reason: string;
}