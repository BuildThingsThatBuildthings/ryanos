import { createAuthenticatedHandler, createResponse, createErrorResponse, handleCors, supabase } from '../_shared/auth.ts';
import { validateRequired, sanitizeInput, handleDatabaseError } from '../_shared/utils.ts';
import type { Exercise, ExerciseSuggestion, User, AuthenticatedRequest } from '../_shared/types.ts';

interface SuggestExercisesRequest {
  target_muscle_groups: string[];
  equipment_available: string[];
  difficulty_level?: 1 | 2 | 3 | 4 | 5;
  exclude_exercises?: string[];
  max_suggestions?: number;
  context?: {
    current_workout?: string;
    recent_exercises?: string[];
    injury_limitations?: string[];
    goals?: string[];
  };
}

const handler = createAuthenticatedHandler(async (req: AuthenticatedRequest, user: User) => {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await suggestExercises(req, user);
      
      default:
        return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
    }
  } catch (error) {
    console.error('Exercise suggestions handler error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

async function suggestExercises(req: AuthenticatedRequest, user: User): Promise<Response> {
  try {
    const body: SuggestExercisesRequest = await req.json();
    const sanitizedBody = sanitizeInput(body);

    // Validate required fields
    const validationError = validateRequired(sanitizedBody, ['target_muscle_groups', 'equipment_available']);
    if (validationError) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validationError);
    }

    if (!Array.isArray(sanitizedBody.target_muscle_groups) || sanitizedBody.target_muscle_groups.length === 0) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'target_muscle_groups must be a non-empty array');
    }

    if (!Array.isArray(sanitizedBody.equipment_available)) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'equipment_available must be an array');
    }

    // Get user's recent workout history for personalization
    const { data: recentWorkouts } = await supabase
      .from('workout_sessions')
      .select(`
        workout_plans(exercises),
        completed_at
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
      .order('completed_at', { ascending: false })
      .limit(10);

    // Get available exercises from database
    const { data: availableExercises, error: exercisesError } = await supabase
      .from('exercises')
      .select('*')
      .overlaps('muscle_groups', sanitizedBody.target_muscle_groups);

    if (exercisesError) {
      const dbError = handleDatabaseError(exercisesError);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    // Generate suggestions using LLM
    const suggestions = await generateExerciseSuggestionsWithLLM(
      sanitizedBody,
      availableExercises || [],
      recentWorkouts || []
    );

    return createResponse<ExerciseSuggestion[]>(suggestions);
  } catch (error) {
    console.error('Suggest exercises error:', error);
    return createErrorResponse(400, 'SUGGESTION_ERROR', 'Failed to generate exercise suggestions');
  }
}

async function generateExerciseSuggestionsWithLLM(
  request: SuggestExercisesRequest,
  availableExercises: Exercise[],
  recentWorkouts: any[]
): Promise<ExerciseSuggestion[]> {
  const maxSuggestions = request.max_suggestions || 5;
  
  // Filter exercises by equipment and target muscles
  const filteredExercises = availableExercises.filter(exercise => {
    // Check if exercise uses available equipment
    const hasEquipment = exercise.equipment?.some(eq => 
      request.equipment_available.includes(eq)
    ) || request.equipment_available.includes('bodyweight');

    // Check if exercise targets desired muscle groups
    const targetsGroups = exercise.muscle_groups.some(mg => 
      request.target_muscle_groups.includes(mg)
    );

    // Exclude exercises if specified
    const isExcluded = request.exclude_exercises?.includes(exercise.name) || false;

    return hasEquipment && targetsGroups && !isExcluded;
  });

  // Get recently performed exercises to avoid repetition
  const recentExerciseNames = recentWorkouts
    .flatMap(w => w.workout_plans?.exercises || [])
    .map(e => e.name)
    .filter(Boolean);

  try {
    // Call OpenAI API for intelligent suggestions
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = createSuggestionPrompt(request, filteredExercises, recentExerciseNames);

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
            content: 'You are a professional fitness trainer specializing in exercise selection and workout optimization. Provide exercise suggestions with clear reasoning and alternatives. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const llmResponse = await response.json();
    const suggestionsJson = llmResponse.choices[0]?.message?.content;

    if (!suggestionsJson) {
      throw new Error('No suggestions generated by LLM');
    }

    const suggestions = JSON.parse(suggestionsJson);
    return suggestions.slice(0, maxSuggestions);
  } catch (error) {
    console.error('LLM suggestion error:', error);
    
    // Fallback to rule-based suggestions
    return generateFallbackSuggestions(request, filteredExercises, recentExerciseNames, maxSuggestions);
  }
}

function createSuggestionPrompt(
  request: SuggestExercisesRequest,
  availableExercises: Exercise[],
  recentExerciseNames: string[]
): string {
  return `Suggest ${request.max_suggestions || 5} exercises based on these requirements:

TARGET MUSCLE GROUPS: ${request.target_muscle_groups.join(', ')}
AVAILABLE EQUIPMENT: ${request.equipment_available.join(', ')}
DIFFICULTY LEVEL: ${request.difficulty_level || 'Any'}/5
${request.exclude_exercises ? `EXCLUDE: ${request.exclude_exercises.join(', ')}` : ''}

CONTEXT:
${request.context?.current_workout ? `Current Workout: ${request.context.current_workout}` : ''}
${request.context?.recent_exercises ? `Recent Exercises: ${request.context.recent_exercises.join(', ')}` : ''}
${request.context?.injury_limitations ? `Limitations: ${request.context.injury_limitations.join(', ')}` : ''}
${request.context?.goals ? `Goals: ${request.context.goals.join(', ')}` : ''}

RECENTLY PERFORMED (avoid if possible): ${recentExerciseNames.join(', ')}

AVAILABLE EXERCISES:
${availableExercises.map(e => `- ${e.name}: ${e.category}, targets ${e.muscle_groups.join('/')}, equipment: ${e.equipment?.join('/') || 'bodyweight'}`).join('\n')}

For each suggestion, provide:
1. The best exercise for the target muscles
2. Clear reason why it's recommended
3. Confidence score (0-1)
4. 2-3 alternative exercises

Return ONLY valid JSON in this exact format:
[
  {
    "exercise": {
      "id": "exercise_id",
      "name": "Exercise Name",
      "category": "category",
      "muscle_groups": ["muscle1", "muscle2"],
      "sets": 3,
      "reps": 12,
      "duration_seconds": 0,
      "rest_seconds": 60,
      "intensity": 3,
      "instructions": "Clear instructions",
      "modifications": ["easier", "harder"],
      "equipment": ["required_equipment"]
    },
    "reason": "Why this exercise is perfect for the user's needs",
    "confidence": 0.9,
    "alternative_exercises": [
      {
        "id": "alt_id",
        "name": "Alternative Exercise",
        "category": "category",
        "muscle_groups": ["muscle1"],
        "equipment": ["equipment"]
      }
    ]
  }
]`;
}

function generateFallbackSuggestions(
  request: SuggestExercisesRequest,
  filteredExercises: Exercise[],
  recentExerciseNames: string[],
  maxSuggestions: number
): ExerciseSuggestion[] {
  // Score exercises based on target muscle groups and recency
  const scoredExercises = filteredExercises.map(exercise => {
    let score = 0;
    
    // Score based on muscle group overlap
    const muscleOverlap = exercise.muscle_groups.filter(mg => 
      request.target_muscle_groups.includes(mg)
    ).length;
    score += muscleOverlap * 10;

    // Penalize recently performed exercises
    if (recentExerciseNames.includes(exercise.name)) {
      score -= 5;
    }

    // Bonus for exact difficulty match
    if (request.difficulty_level && exercise.intensity === request.difficulty_level) {
      score += 3;
    }

    return { exercise, score };
  });

  // Sort by score and take top suggestions
  const topExercises = scoredExercises
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);

  return topExercises.map(({ exercise, score }) => ({
    exercise: {
      ...exercise,
      sets: request.difficulty_level ? Math.max(2, request.difficulty_level) : 3,
      reps: request.difficulty_level ? request.difficulty_level * 4 + 8 : 12,
      rest_seconds: request.difficulty_level && request.difficulty_level <= 2 ? 90 : 60,
      intensity: request.difficulty_level || exercise.intensity || 3
    },
    reason: generateReason(exercise, request.target_muscle_groups),
    confidence: Math.min(0.9, (score / 20) + 0.5),
    alternative_exercises: findAlternatives(exercise, filteredExercises)
  }));
}

function generateReason(exercise: Exercise, targetMuscles: string[]): string {
  const matchingMuscles = exercise.muscle_groups.filter(mg => targetMuscles.includes(mg));
  
  if (matchingMuscles.length === 1) {
    return `Excellent for targeting ${matchingMuscles[0]} with ${exercise.category.toLowerCase()} movement pattern`;
  }
  
  return `Great compound exercise targeting ${matchingMuscles.slice(0, 2).join(' and ')} effectively`;
}

function findAlternatives(exercise: Exercise, allExercises: Exercise[]): Exercise[] {
  return allExercises
    .filter(alt => 
      alt.id !== exercise.id &&
      alt.category === exercise.category &&
      alt.muscle_groups.some(mg => exercise.muscle_groups.includes(mg))
    )
    .slice(0, 3)
    .map(alt => ({
      id: alt.id,
      name: alt.name,
      category: alt.category,
      muscle_groups: alt.muscle_groups,
      equipment: alt.equipment
    } as Exercise));
}

// Main handler
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  return await handler(req);
});