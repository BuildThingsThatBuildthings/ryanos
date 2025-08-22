import { createAuthenticatedHandler, createResponse, createErrorResponse, handleCors, supabase } from '../_shared/auth.ts';
import { validateWorkoutConstraints, sanitizeInput, handleDatabaseError, calculateCaloriesBurned, generateWorkoutId } from '../_shared/utils.ts';
import type { WorkoutPlan, Exercise, WorkoutConstraints, User, AuthenticatedRequest } from '../_shared/types.ts';

interface GenerateWorkoutRequest {
  constraints: WorkoutConstraints;
  preferences?: {
    workout_style?: string;
    intensity_preference?: string;
    focus_areas?: string[];
    avoid_exercises?: string[];
  };
  save_to_database?: boolean;
}

const handler = createAuthenticatedHandler(async (req: AuthenticatedRequest, user: User) => {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await generateWorkout(req, user);
      
      default:
        return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
    }
  } catch (error) {
    console.error('Workouts generate handler error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

async function callNewLLMWorkoutGeneration(
  request: GenerateWorkoutRequest,
  user: User
): Promise<WorkoutPlan> {
  // Call the new LLM workout generation endpoint
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  const response = await fetch(`${supabaseUrl}/functions/v1/llm-workout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      constraints: request.constraints,
      preferences: {
        ...request.preferences,
        experience_level: 'intermediate' // Default, should be from user profile
      }
    })
  });

  if (!response.ok) {
    throw new Error(`LLM workout generation failed: ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || 'LLM workout generation failed');
  }

  return result.data;
}

async function generateWorkout(req: AuthenticatedRequest, user: User): Promise<Response> {
  try {
    const body: GenerateWorkoutRequest = await req.json();
    const sanitizedBody = sanitizeInput(body);

    // Validate constraints
    const validationError = validateWorkoutConstraints(sanitizedBody.constraints);
    if (validationError) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validationError);
    }

    // Get user's workout history for personalization
    const { data: recentWorkouts } = await supabase
      .from('workout_plans')
      .select('exercises, tags, difficulty_level')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // NOTE: This function now delegates to the new LLM workout generation system
    // Use the new /llm-workout endpoint for enhanced safety and library-only exercises
    try {
      const workout = await callNewLLMWorkoutGeneration(sanitizedBody, user);
      
      // Save to database if requested
      if (sanitizedBody.save_to_database) {
        const workoutData: Partial<WorkoutPlan> = {
          ...workout,
          user_id: user.id,
          created_at: new Date().toISOString()
        };

        const { data: savedWorkout, error } = await supabase
          .from('workout_plans')
          .insert(workoutData)
          .select()
          .single();

        if (error) {
          console.error('Save workout error:', error);
          // Return generated workout even if save fails
          return createResponse<WorkoutPlan>(workout);
        }

        return createResponse<WorkoutPlan>(savedWorkout, 201);
      }
      
      return createResponse<WorkoutPlan>(workout);
    } catch (llmError) {
      console.error('New LLM generation failed, falling back to legacy:', llmError);
      // Fall back to the legacy generation method
      const workout = await generateWorkoutWithLLM(sanitizedBody.constraints, sanitizedBody.preferences, recentWorkouts || []);
      
      // Save to database if requested
      if (sanitizedBody.save_to_database) {
        const workoutData: Partial<WorkoutPlan> = {
          id: generateWorkoutId(),
          user_id: user.id,
          title: workout.title,
          description: workout.description,
          duration_minutes: workout.duration_minutes,
          difficulty_level: workout.difficulty_level,
          exercises: workout.exercises,
          equipment_needed: workout.equipment_needed,
          calories_estimate: workout.calories_estimate,
          generated_by: 'llm',
          tags: workout.tags,
          created_at: new Date().toISOString()
        };

        const { data: savedWorkout, error } = await supabase
          .from('workout_plans')
          .insert(workoutData)
          .select()
          .single();

        if (error) {
          console.error('Save workout error:', error);
          return createResponse<WorkoutPlan>(workout);
        }

        return createResponse<WorkoutPlan>(savedWorkout, 201);
      }
      
      return createResponse<WorkoutPlan>(workout);
    }

    // This code has been moved to the try/catch blocks above
  } catch (error) {
    console.error('Generate workout error:', error);
    return createErrorResponse(400, 'GENERATION_ERROR', 'Failed to generate workout');
  }
}

async function generateWorkoutWithLLM(
  constraints: WorkoutConstraints,
  preferences: any = {},
  recentWorkouts: any[] = []
): Promise<WorkoutPlan> {
  // Get available exercises from database
  const { data: availableExercises } = await supabase
    .from('exercises')
    .select('*')
    .in('equipment', constraints.equipment_available.length > 0 ? constraints.equipment_available : ['bodyweight']);

  // Create LLM prompt for workout generation
  const prompt = createWorkoutPrompt(constraints, preferences, recentWorkouts, availableExercises || []);

  try {
    // Call OpenAI API (you'll need to set OPENAI_API_KEY in Supabase secrets)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

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
            content: 'You are a professional fitness trainer and workout designer. Generate workout plans that are safe, effective, and tailored to user constraints. Always return valid JSON with the exact structure requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
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

    // Parse and validate LLM response
    const workout = JSON.parse(workoutJson);
    
    // Calculate calories estimate
    workout.calories_estimate = calculateCaloriesBurned(workout.exercises);
    
    // Ensure required fields
    workout.id = generateWorkoutId();
    workout.generated_by = 'llm';
    workout.created_at = new Date().toISOString();

    return workout;
  } catch (error) {
    console.error('LLM generation error:', error);
    
    // Fallback to template-based generation
    return generateFallbackWorkout(constraints, availableExercises || []);
  }
}

function createWorkoutPrompt(
  constraints: WorkoutConstraints,
  preferences: any,
  recentWorkouts: any[],
  availableExercises: Exercise[]
): string {
  const recentExercises = recentWorkouts
    .flatMap(w => w.exercises || [])
    .map(e => e.name)
    .slice(0, 20);

  return `Generate a workout plan with these constraints:

CONSTRAINTS:
- Duration: ${constraints.duration_minutes} minutes
- Difficulty: ${constraints.difficulty_level}/5
- Equipment: ${constraints.equipment_available.join(', ')}
${constraints.muscle_groups_focus ? `- Focus: ${constraints.muscle_groups_focus.join(', ')}` : ''}
${constraints.limitations ? `- Limitations: ${constraints.limitations.join(', ')}` : ''}
${constraints.goals ? `- Goals: ${constraints.goals.join(', ')}` : ''}

PREFERENCES:
${preferences.workout_style ? `- Style: ${preferences.workout_style}` : ''}
${preferences.intensity_preference ? `- Intensity: ${preferences.intensity_preference}` : ''}
${preferences.focus_areas ? `- Focus Areas: ${preferences.focus_areas.join(', ')}` : ''}
${preferences.avoid_exercises ? `- Avoid: ${preferences.avoid_exercises.join(', ')}` : ''}

RECENT EXERCISES (avoid repetition): ${recentExercises.join(', ')}

AVAILABLE EXERCISES: ${availableExercises.map(e => `${e.name} (${e.category})`).join(', ')}

Generate a workout plan that:
1. Fits exactly within the time constraint
2. Matches the difficulty level
3. Uses only available equipment
4. Avoids recently done exercises when possible
5. Includes proper warm-up and cool-down
6. Has realistic rep/set/duration targets

Return ONLY valid JSON in this exact format:
{
  "title": "Workout Title",
  "description": "Brief description",
  "duration_minutes": ${constraints.duration_minutes},
  "difficulty_level": ${constraints.difficulty_level},
  "exercises": [
    {
      "id": "exercise_id",
      "name": "Exercise Name",
      "category": "category",
      "muscle_groups": ["muscle1", "muscle2"],
      "sets": 3,
      "reps": 12,
      "duration_seconds": 30,
      "rest_seconds": 60,
      "intensity": 3,
      "instructions": "How to perform",
      "modifications": ["easier option", "harder option"],
      "equipment": ["equipment_needed"]
    }
  ],
  "equipment_needed": ["equipment1", "equipment2"],
  "tags": ["tag1", "tag2"]
}`;
}

function generateFallbackWorkout(constraints: WorkoutConstraints, availableExercises: Exercise[]): WorkoutPlan {
  // Simple fallback workout generation
  const exercises: Exercise[] = [];
  const timePerExercise = Math.floor((constraints.duration_minutes - 10) / 5); // Leave 10 min for warm-up/cool-down
  
  // Select exercises based on equipment and difficulty
  const filteredExercises = availableExercises.filter(exercise => 
    exercise.equipment?.some(eq => constraints.equipment_available.includes(eq)) ||
    constraints.equipment_available.includes('bodyweight')
  ).slice(0, 5);

  for (let i = 0; i < Math.min(5, filteredExercises.length); i++) {
    const baseExercise = filteredExercises[i];
    exercises.push({
      ...baseExercise,
      sets: constraints.difficulty_level <= 2 ? 2 : 3,
      reps: constraints.difficulty_level * 4 + 8,
      duration_seconds: timePerExercise * 60,
      rest_seconds: constraints.difficulty_level <= 2 ? 90 : 60,
      intensity: constraints.difficulty_level
    });
  }

  const workout: WorkoutPlan = {
    id: generateWorkoutId(),
    user_id: '',
    title: `${constraints.difficulty_level <= 2 ? 'Beginner' : constraints.difficulty_level <= 4 ? 'Intermediate' : 'Advanced'} Workout`,
    description: `A ${constraints.duration_minutes}-minute workout targeting multiple muscle groups`,
    duration_minutes: constraints.duration_minutes,
    difficulty_level: constraints.difficulty_level,
    exercises,
    equipment_needed: constraints.equipment_available,
    calories_estimate: calculateCaloriesBurned(exercises),
    generated_by: 'llm',
    tags: ['generated', 'full-body'],
    created_at: new Date().toISOString()
  };

  return workout;
}

// Main handler
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  return await handler(req);
});