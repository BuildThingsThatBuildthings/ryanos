import { createAuthenticatedHandler, createResponse, createErrorResponse, handleCors, supabase } from '../_shared/auth.ts';
import { sanitizeInput, handleDatabaseError } from '../_shared/utils.ts';
import type { User, AuthenticatedRequest } from '../_shared/types.ts';

// Safety validation types
interface SafetyValidationRequest {
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

interface SafetyValidationResponse {
  is_safe: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'very_high';
  safety_score: number; // 0-100
  violations: SafetyViolation[];
  recommendations: string[];
  modifications: SafetyModification[];
  contraindications: string[];
}

interface SafetyViolation {
  type: 'volume' | 'intensity' | 'exercise' | 'progression' | 'medical';
  severity: 'warning' | 'error' | 'critical';
  description: string;
  affected_exercise?: string;
  recommendation: string;
}

interface SafetyModification {
  exercise_id: string;
  modification_type: 'replace' | 'reduce_sets' | 'reduce_reps' | 'reduce_weight' | 'add_rest';
  original_value: any;
  suggested_value: any;
  reason: string;
}

// Safety rules and thresholds
const SAFETY_RULES = {
  // Volume limits (sets per muscle group per week)
  volume_limits: {
    beginner: { max_sets_per_muscle_per_week: 10, max_sets_per_session: 16 },
    intermediate: { max_sets_per_muscle_per_week: 16, max_sets_per_session: 20 },
    advanced: { max_sets_per_muscle_per_week: 22, max_sets_per_session: 25 }
  },
  
  // Intensity limits (RPE scale)
  intensity_limits: {
    beginner: { max_rpe: 7, recommended_max: 6 },
    intermediate: { max_rpe: 8.5, recommended_max: 7.5 },
    advanced: { max_rpe: 9.5, recommended_max: 8.5 }
  },
  
  // Exercise-specific safety rules
  high_risk_exercises: {
    'deadlift': { max_rpe: 8, requires_warmup: true, min_rest_minutes: 3 },
    'squat': { max_rpe: 8.5, requires_warmup: true, min_rest_minutes: 3 },
    'bench_press': { max_rpe: 8.5, requires_spotter: true, min_rest_minutes: 2 },
    'overhead_press': { max_rpe: 8, contraindications: ['shoulder_injury', 'neck_injury'] }
  },
  
  // Progression limits
  progression_limits: {
    weight_increase: {
      beginner: 0.05, // 5% max increase
      intermediate: 0.025, // 2.5% max increase  
      advanced: 0.015 // 1.5% max increase
    },
    volume_increase: {
      weekly_max: 0.1 // 10% max increase per week
    }
  },
  
  // Medical contraindications
  medical_contraindications: {
    'hypertension': ['high_intensity_cardio', 'valsalva_exercises'],
    'diabetes': ['long_fasting_workouts', 'extreme_endurance'],
    'pregnancy': ['supine_exercises', 'high_impact', 'core_twisting'],
    'cardiac_issues': ['max_heart_rate_exceeded', 'isometric_holds'],
    'osteoporosis': ['spinal_flexion', 'high_impact_jumping']
  },
  
  // Injury-specific restrictions
  injury_restrictions: {
    'lower_back': {
      avoid_exercises: ['good_morning', 'jefferson_curl', 'toe_touch'],
      modify_exercises: ['deadlift', 'squat', 'row'],
      max_spinal_load: 0.8
    },
    'knee': {
      avoid_exercises: ['deep_squat', 'jumping_lunges', 'high_box_jumps'],
      max_knee_angle: 90,
      impact_restrictions: true
    },
    'shoulder': {
      avoid_exercises: ['behind_neck_press', 'upright_row', 'dips'],
      max_overhead_angle: 150,
      avoid_internal_rotation: true
    },
    'neck': {
      avoid_exercises: ['neck_bridge', 'heavy_shrugs', 'front_squats'],
      avoid_compression: true,
      max_rotation: 45
    }
  }
};

const handler = createAuthenticatedHandler(async (req: AuthenticatedRequest, user: User) => {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await validateSafety(req, user);
      
      default:
        return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
    }
  } catch (error) {
    console.error('Safety validation handler error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

async function validateSafety(req: AuthenticatedRequest, user: User): Promise<Response> {
  try {
    const body: SafetyValidationRequest = await req.json();
    const sanitizedBody = sanitizeInput(body);

    if (!sanitizedBody.validation_type) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'validation_type is required');
    }

    // Get user profile for personalized safety validation
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('injury_history, medical_conditions, fitness_level, age, limitations')
      .eq('user_id', user.id)
      .single();

    // Merge user context with profile data
    const userContext = {
      ...userProfile,
      ...sanitizedBody.user_context
    };

    let validationResult: SafetyValidationResponse;

    switch (sanitizedBody.validation_type) {
      case 'workout':
        if (!sanitizedBody.workout_plan) {
          return createErrorResponse(400, 'VALIDATION_ERROR', 'workout_plan is required for workout validation');
        }
        validationResult = await validateWorkoutSafety(sanitizedBody.workout_plan, userContext);
        break;
        
      case 'exercise':
        if (!sanitizedBody.exercise_suggestion) {
          return createErrorResponse(400, 'VALIDATION_ERROR', 'exercise_suggestion is required for exercise validation');
        }
        validationResult = await validateExerciseSafety(sanitizedBody.exercise_suggestion, userContext);
        break;
        
      case 'progression':
        validationResult = await validateProgressionSafety(sanitizedBody, userContext, user.id);
        break;
        
      default:
        return createErrorResponse(400, 'VALIDATION_ERROR', 'Invalid validation_type');
    }

    // Log safety validation for monitoring
    await logSafetyValidation(user.id, sanitizedBody.validation_type, validationResult);

    return createResponse<SafetyValidationResponse>(validationResult);
  } catch (error) {
    console.error('Safety validation error:', error);
    return createErrorResponse(400, 'VALIDATION_ERROR', 'Failed to validate safety');
  }
}

async function validateWorkoutSafety(
  workoutPlan: any,
  userContext: any
): Promise<SafetyValidationResponse> {
  const violations: SafetyViolation[] = [];
  const recommendations: string[] = [];
  const modifications: SafetyModification[] = [];
  const contraindications: string[] = [];

  const experienceLevel = userContext.experience_level || 'intermediate';
  const volumeLimits = SAFETY_RULES.volume_limits[experienceLevel];
  const intensityLimits = SAFETY_RULES.intensity_limits[experienceLevel];

  // 1. Validate overall workout volume
  const totalSets = workoutPlan.exercises.reduce((sum: number, ex: any) => sum + (ex.sets || 0), 0);
  if (totalSets > volumeLimits.max_sets_per_session) {
    violations.push({
      type: 'volume',
      severity: 'error',
      description: `Total workout volume (${totalSets} sets) exceeds safe limit for ${experienceLevel} (${volumeLimits.max_sets_per_session} sets)`,
      recommendation: `Reduce total sets to ${volumeLimits.max_sets_per_session} or split into multiple sessions`
    });
  }

  // 2. Validate workout duration
  if (workoutPlan.duration_minutes > 120) {
    violations.push({
      type: 'volume',
      severity: 'warning',
      description: `Workout duration (${workoutPlan.duration_minutes} minutes) is very long`,
      recommendation: 'Consider splitting into shorter sessions to maintain form and focus'
    });
  }

  // 3. Validate individual exercises
  for (const exercise of workoutPlan.exercises) {
    const exerciseValidation = await validateIndividualExercise(exercise, userContext, experienceLevel);
    violations.push(...exerciseValidation.violations);
    modifications.push(...exerciseValidation.modifications);
    contraindications.push(...exerciseValidation.contraindications);
  }

  // 4. Check for injury-specific contraindications
  if (userContext.injury_history) {
    for (const injury of userContext.injury_history) {
      const injuryRestrictions = SAFETY_RULES.injury_restrictions[injury];
      if (injuryRestrictions) {
        for (const exercise of workoutPlan.exercises) {
          if (injuryRestrictions.avoid_exercises?.includes(exercise.name)) {
            violations.push({
              type: 'medical',
              severity: 'critical',
              description: `Exercise ${exercise.name} is contraindicated for ${injury} injury`,
              affected_exercise: exercise.name,
              recommendation: `Replace with safer alternative for ${injury} recovery`
            });
          }
        }
      }
    }
  }

  // 5. Check medical conditions
  if (userContext.medical_conditions) {
    for (const condition of userContext.medical_conditions) {
      const conditionRestrictions = SAFETY_RULES.medical_contraindications[condition];
      if (conditionRestrictions) {
        contraindications.push(...conditionRestrictions);
      }
    }
  }

  // Calculate safety score
  const safetyScore = calculateSafetyScore(violations);
  const riskLevel = determineRiskLevel(violations, safetyScore);

  // Generate recommendations
  if (safetyScore < 80) {
    recommendations.push('Consider working with a qualified trainer');
  }
  if (violations.some(v => v.severity === 'critical')) {
    recommendations.push('Do not perform this workout without modifications');
  }
  if (userContext.injury_history?.length > 0) {
    recommendations.push('Prioritize proper warm-up and mobility work');
    recommendations.push('Stop immediately if you experience pain');
  }

  return {
    is_safe: violations.filter(v => v.severity === 'critical' || v.severity === 'error').length === 0,
    risk_level: riskLevel,
    safety_score: safetyScore,
    violations,
    recommendations,
    modifications,
    contraindications: [...new Set(contraindications)] // Remove duplicates
  };
}

async function validateExerciseSafety(
  exercise: any,
  userContext: any
): Promise<SafetyValidationResponse> {
  const violations: SafetyViolation[] = [];
  const recommendations: string[] = [];
  const modifications: SafetyModification[] = [];
  const contraindications: string[] = [];

  // Check if exercise exists in library and get safety rating
  const { data: libraryExercise } = await supabase
    .from('exercises')
    .select('safety_rating, contraindications, difficulty_level, injury_considerations')
    .eq('id', exercise.id)
    .single();

  if (!libraryExercise) {
    violations.push({
      type: 'exercise',
      severity: 'critical',
      description: 'Exercise not found in approved library',
      recommendation: 'Only use exercises from the approved exercise library'
    });
    return {
      is_safe: false,
      risk_level: 'very_high',
      safety_score: 0,
      violations,
      recommendations: ['Use only approved exercises'],
      modifications,
      contraindications
    };
  }

  // Check safety rating
  if (libraryExercise.safety_rating < 3) {
    violations.push({
      type: 'exercise',
      severity: 'error',
      description: `Exercise has low safety rating (${libraryExercise.safety_rating}/5)`,
      recommendation: 'Choose a safer alternative with rating 3 or higher'
    });
  }

  // Check contraindications against user profile
  if (libraryExercise.contraindications && userContext.injury_history) {
    const userContraindications = libraryExercise.contraindications.filter((contra: string) =>
      userContext.injury_history.some((injury: string) => 
        injury.toLowerCase().includes(contra.toLowerCase())
      )
    );
    
    if (userContraindications.length > 0) {
      violations.push({
        type: 'medical',
        severity: 'critical',
        description: `Exercise contraindicated due to injury history: ${userContraindications.join(', ')}`,
        recommendation: 'Choose alternative exercise without contraindications'
      });
    }
  }

  // Check difficulty level appropriateness
  const experienceLevel = userContext.experience_level || 'intermediate';
  const maxDifficulty = experienceLevel === 'beginner' ? 3 : experienceLevel === 'intermediate' ? 4 : 5;
  
  if (libraryExercise.difficulty_level > maxDifficulty) {
    violations.push({
      type: 'exercise',
      severity: 'warning',
      description: `Exercise difficulty (${libraryExercise.difficulty_level}) may be too high for ${experienceLevel} level`,
      recommendation: 'Consider starting with an easier variation'
    });
  }

  const safetyScore = calculateSafetyScore(violations);
  const riskLevel = determineRiskLevel(violations, safetyScore);

  return {
    is_safe: violations.filter(v => v.severity === 'critical' || v.severity === 'error').length === 0,
    risk_level: riskLevel,
    safety_score: safetyScore,
    violations,
    recommendations,
    modifications,
    contraindications
  };
}

async function validateProgressionSafety(
  request: SafetyValidationRequest,
  userContext: any,
  userId: string
): Promise<SafetyValidationResponse> {
  const violations: SafetyViolation[] = [];
  const recommendations: string[] = [];
  const modifications: SafetyModification[] = [];
  const contraindications: string[] = [];

  // Get user's recent workout history for progression analysis
  const { data: recentWorkouts } = await supabase
    .from('workout_sessions')
    .select(`
      workout_plans(exercises),
      completed_at
    `)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
    .order('completed_at', { ascending: false })
    .limit(20);

  if (recentWorkouts && recentWorkouts.length > 0) {
    // Analyze weekly volume progression
    const weeklyVolumes = calculateWeeklyVolumes(recentWorkouts);
    const volumeProgression = analyzeVolumeProgression(weeklyVolumes);
    
    if (volumeProgression.weeklyIncrease > SAFETY_RULES.progression_limits.volume_increase.weekly_max) {
      violations.push({
        type: 'progression',
        severity: 'error',
        description: `Weekly volume increase (${(volumeProgression.weeklyIncrease * 100).toFixed(1)}%) exceeds safe limit (${(SAFETY_RULES.progression_limits.volume_increase.weekly_max * 100)}%)`,
        recommendation: 'Reduce training volume increase to prevent overreaching'
      });
    }

    // Analyze intensity progression
    const intensityProgression = analyzeIntensityProgression(recentWorkouts);
    if (intensityProgression.tooFastProgression) {
      violations.push({
        type: 'progression',
        severity: 'warning',
        description: 'Intensity increasing too rapidly',
        recommendation: 'Allow more time for adaptation between intensity increases'
      });
    }
  }

  const safetyScore = calculateSafetyScore(violations);
  const riskLevel = determineRiskLevel(violations, safetyScore);

  // Add progression-specific recommendations
  recommendations.push('Follow the 10% rule: increase volume by no more than 10% per week');
  recommendations.push('Allow at least one full recovery day between intense sessions');
  if (userContext.experience_level === 'beginner') {
    recommendations.push('Focus on form and consistency before increasing intensity');
  }

  return {
    is_safe: violations.filter(v => v.severity === 'critical' || v.severity === 'error').length === 0,
    risk_level: riskLevel,
    safety_score: safetyScore,
    violations,
    recommendations,
    modifications,
    contraindications
  };
}

async function validateIndividualExercise(
  exercise: any,
  userContext: any,
  experienceLevel: string
): Promise<{ violations: SafetyViolation[], modifications: SafetyModification[], contraindications: string[] }> {
  const violations: SafetyViolation[] = [];
  const modifications: SafetyModification[] = [];
  const contraindications: string[] = [];

  const volumeLimits = SAFETY_RULES.volume_limits[experienceLevel];
  const intensityLimits = SAFETY_RULES.intensity_limits[experienceLevel];
  const highRiskRules = SAFETY_RULES.high_risk_exercises[exercise.name];

  // Validate sets
  if (exercise.sets > 6) {
    violations.push({
      type: 'volume',
      severity: 'warning',
      description: `${exercise.name}: ${exercise.sets} sets may be excessive`,
      affected_exercise: exercise.name,
      recommendation: 'Consider reducing sets to 3-5 for optimal recovery'
    });
    
    modifications.push({
      exercise_id: exercise.id,
      modification_type: 'reduce_sets',
      original_value: exercise.sets,
      suggested_value: Math.min(5, exercise.sets),
      reason: 'Reduce volume for better recovery'
    });
  }

  // Validate reps based on goals
  if (exercise.reps > 30) {
    violations.push({
      type: 'volume',
      severity: 'warning',
      description: `${exercise.name}: ${exercise.reps} reps is very high`,
      affected_exercise: exercise.name,
      recommendation: 'High rep ranges may compromise form'
    });
  }

  // Validate intensity for high-risk exercises
  if (highRiskRules && exercise.intensity) {
    const maxIntensityForExercise = Math.min(
      highRiskRules.max_rpe,
      intensityLimits.max_rpe
    );
    
    if (exercise.intensity > maxIntensityForExercise) {
      violations.push({
        type: 'intensity',
        severity: 'error',
        description: `${exercise.name}: Intensity (${exercise.intensity}) exceeds safe limit (${maxIntensityForExercise}) for this exercise`,
        affected_exercise: exercise.name,
        recommendation: `Reduce intensity to ${maxIntensityForExercise} or below`
      });
      
      modifications.push({
        exercise_id: exercise.id,
        modification_type: 'reduce_weight',
        original_value: exercise.intensity,
        suggested_value: maxIntensityForExercise,
        reason: 'Safety limit for high-risk exercise'
      });
    }
  }

  // Check contraindications for high-risk exercises
  if (highRiskRules?.contraindications && userContext.injury_history) {
    const applicableContraindications = highRiskRules.contraindications.filter((contra: string) =>
      userContext.injury_history.some((injury: string) => 
        injury.toLowerCase().includes(contra.replace('_injury', '').toLowerCase())
      )
    );
    
    if (applicableContraindications.length > 0) {
      violations.push({
        type: 'medical',
        severity: 'critical',
        description: `${exercise.name}: Contraindicated due to ${applicableContraindications.join(', ')}`,
        affected_exercise: exercise.name,
        recommendation: 'Replace with safer alternative exercise'
      });
    }
  }

  return { violations, modifications, contraindications };
}

function calculateSafetyScore(violations: SafetyViolation[]): number {
  let score = 100;
  
  for (const violation of violations) {
    switch (violation.severity) {
      case 'critical':
        score -= 30;
        break;
      case 'error':
        score -= 15;
        break;
      case 'warning':
        score -= 5;
        break;
    }
  }
  
  return Math.max(0, score);
}

function determineRiskLevel(violations: SafetyViolation[], safetyScore: number): 'low' | 'medium' | 'high' | 'very_high' {
  const hasCritical = violations.some(v => v.severity === 'critical');
  const hasMultipleErrors = violations.filter(v => v.severity === 'error').length > 1;
  
  if (hasCritical || safetyScore < 40) {
    return 'very_high';
  } else if (hasMultipleErrors || safetyScore < 60) {
    return 'high';
  } else if (violations.some(v => v.severity === 'error') || safetyScore < 80) {
    return 'medium';
  } else {
    return 'low';
  }
}

function calculateWeeklyVolumes(workouts: any[]): Array<{ week: string, volume: number }> {
  const weeklyVolumes: Record<string, number> = {};
  
  for (const workout of workouts) {
    const date = new Date(workout.completed_at);
    const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
    const weekKey = weekStart.toISOString().split('T')[0];
    
    const workoutVolume = workout.workout_plans?.exercises?.reduce(
      (sum: number, ex: any) => sum + (ex.sets * ex.reps || 0), 0
    ) || 0;
    
    weeklyVolumes[weekKey] = (weeklyVolumes[weekKey] || 0) + workoutVolume;
  }
  
  return Object.entries(weeklyVolumes)
    .map(([week, volume]) => ({ week, volume }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

function analyzeVolumeProgression(weeklyVolumes: Array<{ week: string, volume: number }>): { weeklyIncrease: number } {
  if (weeklyVolumes.length < 2) {
    return { weeklyIncrease: 0 };
  }
  
  const recent = weeklyVolumes.slice(-2);
  const increase = (recent[1].volume - recent[0].volume) / recent[0].volume;
  
  return { weeklyIncrease: Math.max(0, increase) };
}

function analyzeIntensityProgression(workouts: any[]): { tooFastProgression: boolean } {
  // Simple heuristic: if intensity increased in 3+ consecutive workouts, it might be too fast
  let consecutiveIncreases = 0;
  let previousAvgIntensity = 0;
  
  for (const workout of workouts.slice(-5)) { // Look at last 5 workouts
    const avgIntensity = workout.workout_plans?.exercises?.reduce(
      (sum: number, ex: any) => sum + (ex.intensity || 5), 0
    ) / (workout.workout_plans?.exercises?.length || 1);
    
    if (avgIntensity > previousAvgIntensity && previousAvgIntensity > 0) {
      consecutiveIncreases++;
    } else {
      consecutiveIncreases = 0;
    }
    
    previousAvgIntensity = avgIntensity;
  }
  
  return { tooFastProgression: consecutiveIncreases >= 3 };
}

async function logSafetyValidation(
  userId: string,
  validationType: string,
  result: SafetyValidationResponse
): Promise<void> {
  try {
    await supabase
      .from('safety_validation_logs')
      .insert({
        user_id: userId,
        validation_type: validationType,
        risk_level: result.risk_level,
        safety_score: result.safety_score,
        is_safe: result.is_safe,
        violations_count: result.violations.length,
        critical_violations: result.violations.filter(v => v.severity === 'critical').length,
        created_at: new Date().toISOString()
      });
  } catch (logError) {
    console.error('Failed to log safety validation:', logError);
    // Don't throw - logging shouldn't break the main flow
  }
}

// Main handler
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  return await handler(req);
});