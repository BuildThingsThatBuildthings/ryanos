import { createAuthenticatedHandler, createResponse, createErrorResponse, handleCors, supabase } from '../_shared/auth.ts';
import { validateWorkoutConstraints, sanitizeInput, handleDatabaseError, calculateCaloriesBurned, generateWorkoutId } from '../_shared/utils.ts';
import type { WorkoutPlan, Exercise, WorkoutConstraints, User, AuthenticatedRequest } from '../_shared/types.ts';

// Safety constraints for LLM-generated workouts
interface SafetyConstraints {
  maxDurationMinutes: number;
  maxSetsPerExercise: number;
  maxRepsPerSet: number;
  maxWeightProgression: number;
  allowedEquipment: string[];
  requiredRestPeriods: Record<string, number>;
  intensityLimits: Record<string, number>;
  exerciseBlacklist: string[];
}

// Library-only exercise validation
interface LibraryExercise {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  equipment: string[];
  safety_rating: number; // 1-5, 5 being safest
  difficulty_level: number; // 1-5
  contraindications: string[];
  is_compound: boolean;
  movement_pattern: string;
}

interface LLMWorkoutRequest {
  constraints: WorkoutConstraints;
  preferences?: {
    workout_style?: string;
    intensity_preference?: string;
    focus_areas?: string[];
    avoid_exercises?: string[];
    injury_history?: string[];
    experience_level?: 'beginner' | 'intermediate' | 'advanced';
  };
  safety_override?: boolean; // Only for testing, requires admin
}

// Safety configuration - these are hard limits that cannot be overridden
const SAFETY_CONSTRAINTS: SafetyConstraints = {
  maxDurationMinutes: 120, // 2 hours max
  maxSetsPerExercise: 6,
  maxRepsPerSet: 30,
  maxWeightProgression: 1.2, // Max 20% increase from previous
  allowedEquipment: [
    'bodyweight', 'dumbbell', 'barbell', 'kettlebell', 'resistance_band',
    'cable', 'machine', 'suspension_trainer', 'medicine_ball'
  ],
  requiredRestPeriods: {
    'strength': 60, // minimum seconds between sets
    'power': 120,
    'endurance': 30,
    'flexibility': 15
  },
  intensityLimits: {
    'beginner': 3, // max intensity 1-5
    'intermediate': 4,
    'advanced': 5
  },
  exerciseBlacklist: [
    // High-risk exercises that require in-person supervision
    'clean_and_jerk',
    'snatch',
    'behind_the_neck_press',
    'upright_row_wide_grip',
    'bench_press_to_neck',
    'leg_press_deep_range'
  ]
};

const handler = createAuthenticatedHandler(async (req: AuthenticatedRequest, user: User) => {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await generateLLMWorkout(req, user);
      
      default:
        return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
    }
  } catch (error) {
    console.error('LLM workout handler error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

async function generateLLMWorkout(req: AuthenticatedRequest, user: User): Promise<Response> {
  try {
    const body: LLMWorkoutRequest = await req.json();
    const sanitizedBody = sanitizeInput(body);

    // Validate constraints
    const validationError = validateWorkoutConstraints(sanitizedBody.constraints);
    if (validationError) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validationError);
    }

    // Apply safety constraints
    const safetyValidation = await validateSafetyConstraints(sanitizedBody, user);
    if (!safetyValidation.isValid) {
      return createErrorResponse(400, 'SAFETY_VIOLATION', safetyValidation.error, safetyValidation.details);
    }

    // Get library exercises only (validated and safe)
    const libraryExercises = await getLibraryExercises(sanitizedBody.constraints);
    if (libraryExercises.length === 0) {
      return createErrorResponse(400, 'NO_EXERCISES', 'No safe exercises found for the given constraints');
    }

    // Get user's workout history for personalization
    const { data: recentWorkouts } = await supabase
      .from('workout_plans')
      .select('exercises, tags, difficulty_level, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user's injury history and limitations
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('injury_history, limitations, fitness_level, goals')
      .eq('user_id', user.id)
      .single();

    // Generate workout using LLM with strict safety prompts
    const workout = await generateSafeWorkoutWithLLM(
      sanitizedBody.constraints,
      sanitizedBody.preferences,
      libraryExercises,
      recentWorkouts || [],
      userProfile
    );

    // Final safety validation of generated workout
    const finalValidation = await validateGeneratedWorkout(workout, sanitizedBody.constraints);
    if (!finalValidation.isValid) {
      console.error('Generated workout failed safety validation:', finalValidation.error);
      // Fall back to template-based generation
      return createResponse(generateFallbackSafeWorkout(sanitizedBody.constraints, libraryExercises));
    }

    // Log successful generation for monitoring
    await logWorkoutGeneration(user.id, workout, 'llm', true);

    return createResponse<WorkoutPlan>(workout, 201);
  } catch (error) {
    console.error('Generate LLM workout error:', error);
    await logWorkoutGeneration(user.id, null, 'llm', false, error.message);
    return createErrorResponse(400, 'GENERATION_ERROR', 'Failed to generate safe workout');
  }
}

async function validateSafetyConstraints(
  request: LLMWorkoutRequest,
  user: User
): Promise<{ isValid: boolean; error?: string; details?: any }> {
  const { constraints, preferences } = request;

  // Check duration limits
  if (constraints.duration_minutes > SAFETY_CONSTRAINTS.maxDurationMinutes) {
    return {
      isValid: false,
      error: `Workout duration cannot exceed ${SAFETY_CONSTRAINTS.maxDurationMinutes} minutes`,
      details: { maxDuration: SAFETY_CONSTRAINTS.maxDurationMinutes }
    };
  }

  // Check equipment safety
  const unsafeEquipment = constraints.equipment_available.filter(
    eq => !SAFETY_CONSTRAINTS.allowedEquipment.includes(eq)
  );
  if (unsafeEquipment.length > 0) {
    return {
      isValid: false,
      error: 'Some equipment is not approved for LLM-generated workouts',
      details: { unsafeEquipment, allowedEquipment: SAFETY_CONSTRAINTS.allowedEquipment }
    };
  }

  // Check user experience level vs intensity
  if (preferences?.experience_level) {
    const maxIntensity = SAFETY_CONSTRAINTS.intensityLimits[preferences.experience_level];
    if (constraints.difficulty_level > maxIntensity) {
      return {
        isValid: false,
        error: `Difficulty level ${constraints.difficulty_level} exceeds maximum ${maxIntensity} for ${preferences.experience_level} level`,
        details: { maxIntensity, userLevel: preferences.experience_level }
      };
    }
  }

  // Check injury restrictions
  if (preferences?.injury_history && preferences.injury_history.length > 0) {
    const riskAssessment = await assessInjuryRisk(preferences.injury_history, constraints);
    if (riskAssessment.risk === 'high') {
      return {
        isValid: false,
        error: 'Workout constraints pose high risk given injury history',
        details: { riskFactors: riskAssessment.factors }
      };
    }
  }

  return { isValid: true };
}

async function getLibraryExercises(constraints: WorkoutConstraints): Promise<LibraryExercise[]> {
  // Only get exercises from curated library that meet safety criteria
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('*')
    .gte('safety_rating', 3) // Only exercises with safety rating 3 or higher
    .not('name', 'in', `(${SAFETY_CONSTRAINTS.exerciseBlacklist.map(e => `'${e}'`).join(',')})`) // Exclude blacklisted
    .overlaps('equipment', constraints.equipment_available.length > 0 ? constraints.equipment_available : ['bodyweight'])
    .lte('difficulty_level', constraints.difficulty_level);

  if (error) {
    console.error('Error fetching library exercises:', error);
    throw new Error('Failed to retrieve exercise library');
  }

  // Additional filtering for muscle groups if specified
  let filteredExercises = exercises || [];
  if (constraints.muscle_groups_focus && constraints.muscle_groups_focus.length > 0) {
    filteredExercises = filteredExercises.filter(exercise => 
      exercise.muscle_groups.some(mg => constraints.muscle_groups_focus!.includes(mg))
    );
  }

  return filteredExercises;
}

async function generateSafeWorkoutWithLLM(
  constraints: WorkoutConstraints,
  preferences: any = {},
  libraryExercises: LibraryExercise[],
  recentWorkouts: any[] = [],
  userProfile: any = null
): Promise<WorkoutPlan> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = createSafeWorkoutPrompt(
    constraints,
    preferences,
    libraryExercises,
    recentWorkouts,
    userProfile
  );

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a certified fitness trainer and exercise physiologist specializing in safe, evidence-based workout design. You MUST:
            
            1. ONLY use exercises from the provided library - no exceptions
            2. Follow all safety constraints strictly
            3. Consider user's injury history and limitations
            4. Provide proper warm-up and cool-down
            5. Include appropriate rest periods
            6. Scale intensity appropriately for user level
            7. Return valid JSON only - no additional text
            
            SAFETY IS PARAMOUNT. If you cannot create a safe workout with the given constraints, return a simplified bodyweight routine.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2500,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const llmResponse = await response.json();
    const workoutJson = llmResponse.choices[0]?.message?.content;

    if (!workoutJson) {
      throw new Error('No workout generated by LLM');
    }

    const workout = JSON.parse(workoutJson);
    
    // Ensure required fields and safety constraints
    workout.id = generateWorkoutId();
    workout.generated_by = 'llm';
    workout.created_at = new Date().toISOString();
    workout.calories_estimate = calculateCaloriesBurned(workout.exercises);
    
    // Apply safety limits to all exercises
    workout.exercises = workout.exercises.map((exercise: any) => ({
      ...exercise,
      sets: Math.min(exercise.sets || 3, SAFETY_CONSTRAINTS.maxSetsPerExercise),
      reps: Math.min(exercise.reps || 12, SAFETY_CONSTRAINTS.maxRepsPerSet),
      rest_seconds: Math.max(
        exercise.rest_seconds || 60,
        SAFETY_CONSTRAINTS.requiredRestPeriods[exercise.category] || 60
      )
    }));

    return workout;
  } catch (error) {
    console.error('LLM generation error:', error);
    throw error;
  }
}

function createSafeWorkoutPrompt(
  constraints: WorkoutConstraints,
  preferences: any,
  libraryExercises: LibraryExercise[],
  recentWorkouts: any[],
  userProfile: any
): string {
  const recentExerciseNames = recentWorkouts
    .flatMap(w => w.exercises || [])
    .map(e => e.name)
    .slice(0, 15);

  const injuryRestrictions = userProfile?.injury_history || preferences?.injury_history || [];
  const userLimitations = userProfile?.limitations || constraints.limitations || [];

  return `Generate a safe, effective workout plan with these STRICT requirements:

SAFETY CONSTRAINTS (MANDATORY):
- Maximum ${SAFETY_CONSTRAINTS.maxSetsPerExercise} sets per exercise
- Maximum ${SAFETY_CONSTRAINTS.maxRepsPerSet} reps per set
- Minimum rest periods: Strength=${SAFETY_CONSTRAINTS.requiredRestPeriods.strength}s
- ONLY use exercises from the provided library
- Include 5-10 minute warm-up
- Include 5-10 minute cool-down

WORKOUT REQUIREMENTS:
- Duration: ${constraints.duration_minutes} minutes (EXACT)
- Difficulty: ${constraints.difficulty_level}/5
- Equipment: ${constraints.equipment_available.join(', ')}
- Focus Areas: ${constraints.muscle_groups_focus?.join(', ') || 'Full body'}
- User Level: ${preferences?.experience_level || 'intermediate'}

USER PROFILE:
- Injury History: ${injuryRestrictions.join(', ') || 'None reported'}
- Limitations: ${userLimitations.join(', ') || 'None reported'}
- Recent Exercises (avoid repetition): ${recentExerciseNames.join(', ') || 'None'}

AVAILABLE LIBRARY EXERCISES (USE ONLY THESE):
${libraryExercises.map(e => `- ${e.name} (${e.category}): ${e.muscle_groups.join('/')}, Safety: ${e.safety_rating}/5, Equipment: ${e.equipment.join('/')}`).join('\n')}

WORKOUT STRUCTURE REQUIRED:
1. Warm-up (5-10 minutes): Dynamic movements, light cardio
2. Main workout: ${Math.floor((constraints.duration_minutes - 15) / 5)} exercises
3. Cool-down (5-10 minutes): Stretching, breathing

IMPORTANT SAFETY RULES:
- If user has injury history, modify exercises accordingly
- For beginners: Lower intensity, more rest time
- Include exercise modifications for different fitness levels
- Ensure balanced muscle group targeting
- No contraindicated exercises for reported injuries

Return ONLY this JSON format (no other text):
{
  "title": "Safe Workout Title",
  "description": "Brief description emphasizing safety",
  "duration_minutes": ${constraints.duration_minutes},
  "difficulty_level": ${constraints.difficulty_level},
  "exercises": [
    {
      "id": "exercise_id_from_library",
      "name": "Exact exercise name from library",
      "category": "category",
      "muscle_groups": ["primary", "secondary"],
      "sets": 3,
      "reps": 12,
      "duration_seconds": 0,
      "rest_seconds": 90,
      "intensity": 3,
      "instructions": "Clear, safe execution instructions",
      "modifications": ["easier option", "harder option"],
      "equipment": ["required_equipment"],
      "safety_notes": "Specific safety considerations"
    }
  ],
  "equipment_needed": ["equipment1", "equipment2"],
  "tags": ["safe", "library", "personalized"],
  "warm_up": {
    "duration_minutes": 8,
    "exercises": ["light_cardio", "dynamic_stretching"]
  },
  "cool_down": {
    "duration_minutes": 7,
    "exercises": ["static_stretching", "breathing_exercises"]
  },
  "safety_notes": ["Overall workout safety guidelines"]
}`;
}

async function validateGeneratedWorkout(
  workout: WorkoutPlan,
  originalConstraints: WorkoutConstraints
): Promise<{ isValid: boolean; error?: string; details?: any }> {
  // Validate duration
  if (Math.abs(workout.duration_minutes - originalConstraints.duration_minutes) > 5) {
    return {
      isValid: false,
      error: 'Generated workout duration deviates significantly from requested duration'
    };
  }

  // Validate exercise safety
  for (const exercise of workout.exercises) {
    // Check sets limit
    if (exercise.sets && exercise.sets > SAFETY_CONSTRAINTS.maxSetsPerExercise) {
      return {
        isValid: false,
        error: `Exercise ${exercise.name} has ${exercise.sets} sets, exceeding limit of ${SAFETY_CONSTRAINTS.maxSetsPerExercise}`
      };
    }

    // Check reps limit
    if (exercise.reps && exercise.reps > SAFETY_CONSTRAINTS.maxRepsPerSet) {
      return {
        isValid: false,
        error: `Exercise ${exercise.name} has ${exercise.reps} reps, exceeding limit of ${SAFETY_CONSTRAINTS.maxRepsPerSet}`
      };
    }

    // Check if exercise is in blacklist
    if (SAFETY_CONSTRAINTS.exerciseBlacklist.includes(exercise.name)) {
      return {
        isValid: false,
        error: `Exercise ${exercise.name} is blacklisted for safety reasons`
      };
    }

    // Verify exercise exists in library
    const { data: libraryExercise } = await supabase
      .from('exercises')
      .select('id, safety_rating')
      .eq('id', exercise.id)
      .single();

    if (!libraryExercise) {
      return {
        isValid: false,
        error: `Exercise ${exercise.name} (${exercise.id}) not found in exercise library`
      };
    }

    if (libraryExercise.safety_rating < 3) {
      return {
        isValid: false,
        error: `Exercise ${exercise.name} has safety rating ${libraryExercise.safety_rating}, below minimum of 3`
      };
    }
  }

  return { isValid: true };
}

function generateFallbackSafeWorkout(
  constraints: WorkoutConstraints,
  libraryExercises: LibraryExercise[]
): WorkoutPlan {
  // Generate a simple, safe bodyweight workout as fallback
  const safeExercises = libraryExercises
    .filter(ex => ex.equipment.includes('bodyweight') && ex.safety_rating >= 4)
    .slice(0, 5);

  const exercises = safeExercises.map(baseExercise => ({
    ...baseExercise,
    sets: Math.min(3, SAFETY_CONSTRAINTS.maxSetsPerExercise),
    reps: Math.min(15, SAFETY_CONSTRAINTS.maxRepsPerSet),
    duration_seconds: 0,
    rest_seconds: SAFETY_CONSTRAINTS.requiredRestPeriods.strength,
    intensity: Math.min(constraints.difficulty_level, 3),
    safety_notes: 'Bodyweight exercise - stop if you feel pain or discomfort'
  }));

  return {
    id: generateWorkoutId(),
    user_id: '',
    title: 'Safe Bodyweight Workout',
    description: 'A safe, library-based bodyweight workout generated as a fallback',
    duration_minutes: constraints.duration_minutes,
    difficulty_level: Math.min(constraints.difficulty_level, 3),
    exercises,
    equipment_needed: ['bodyweight'],
    calories_estimate: calculateCaloriesBurned(exercises),
    generated_by: 'llm',
    tags: ['safe', 'bodyweight', 'fallback'],
    created_at: new Date().toISOString()
  };
}

async function assessInjuryRisk(
  injuryHistory: string[],
  constraints: WorkoutConstraints
): Promise<{ risk: 'low' | 'medium' | 'high'; factors: string[] }> {
  const riskFactors: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Check for high-risk injury combinations
  const highRiskInjuries = ['lower_back', 'knee', 'shoulder', 'neck'];
  const userHighRiskInjuries = injuryHistory.filter(injury => 
    highRiskInjuries.some(risk => injury.toLowerCase().includes(risk))
  );

  if (userHighRiskInjuries.length > 0) {
    riskFactors.push(`High-risk injury history: ${userHighRiskInjuries.join(', ')}`);
    riskLevel = 'medium';
  }

  // Check if high intensity with injury history
  if (constraints.difficulty_level >= 4 && injuryHistory.length > 0) {
    riskFactors.push('High intensity workout with injury history');
    riskLevel = 'high';
  }

  // Check equipment risk with injuries
  const riskEquipment = ['barbell', 'heavy_weights'];
  if (constraints.equipment_available.some(eq => riskEquipment.includes(eq)) && 
      injuryHistory.length > 1) {
    riskFactors.push('High-risk equipment with multiple injury history');
    riskLevel = 'high';
  }

  return { risk: riskLevel, factors: riskFactors };
}

async function logWorkoutGeneration(
  userId: string,
  workout: WorkoutPlan | null,
  method: string,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    await supabase
      .from('workout_generation_logs')
      .insert({
        user_id: userId,
        method,
        success,
        workout_id: workout?.id,
        error_message: error,
        constraints: workout ? {
          duration: workout.duration_minutes,
          difficulty: workout.difficulty_level,
          equipment: workout.equipment_needed
        } : null,
        created_at: new Date().toISOString()
      });
  } catch (logError) {
    console.error('Failed to log workout generation:', logError);
    // Don't throw - logging shouldn't break the main flow
  }
}

// Main handler
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  return await handler(req);
});