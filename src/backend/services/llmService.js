const axios = require('axios');
const logger = require('../config/logger');
const { ExternalServiceError } = require('../middleware/errorHandler');

class LLMService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.baseURL = 'https://api.openai.com/v1';
    this.model = 'gpt-5';
    
    if (!this.openaiApiKey) {
      logger.warn('OpenAI API key not provided. LLM features will be disabled.');
    }
  }

  async generateWorkout(params) {
    if (!this.openaiApiKey) {
      throw new ExternalServiceError('LLM service not configured');
    }

    const {
      date,
      timeCapMin,
      focus,
      exclusions = [],
      workoutType = 'strength',
      difficultyLevel = 'intermediate',
      equipment = [],
      goals = [],
      userProfile = {}
    } = params;

    try {
      const prompt = this._buildWorkoutPrompt({
        date,
        timeCapMin,
        focus,
        exclusions,
        workoutType,
        difficultyLevel,
        equipment,
        goals,
        userProfile
      });

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this._getSystemPrompt('workout_generation')
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const workoutPlan = JSON.parse(response.data.choices[0].message.content);
      
      logger.info('LLM workout generated successfully', {
        timeCapMin,
        focus,
        workoutType,
        exerciseCount: workoutPlan.exercises?.length || 0
      });

      return this._formatWorkoutResponse(workoutPlan, params);

    } catch (error) {
      logger.error('LLM workout generation failed', {
        error: error.message,
        params
      });

      if (error.response?.status === 401) {
        throw new ExternalServiceError('Invalid LLM API credentials');
      } else if (error.response?.status === 429) {
        throw new ExternalServiceError('LLM API rate limit exceeded');
      } else if (error.code === 'ECONNABORTED') {
        throw new ExternalServiceError('LLM API timeout');
      }

      throw new ExternalServiceError('Failed to generate workout plan');
    }
  }

  async suggestExercises(params) {
    if (!this.openaiApiKey) {
      throw new ExternalServiceError('LLM service not configured');
    }

    const {
      prompt,
      muscleGroups = [],
      equipment = [],
      difficultyLevel,
      maxSuggestions = 5
    } = params;

    try {
      const systemPrompt = this._getSystemPrompt('exercise_suggestions');
      const userPrompt = this._buildExercisePrompt({
        prompt,
        muscleGroups,
        equipment,
        difficultyLevel,
        maxSuggestions
      });

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 1500,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      );

      const suggestions = JSON.parse(response.data.choices[0].message.content);
      
      logger.info('LLM exercise suggestions generated', {
        prompt: prompt.substring(0, 100),
        suggestionsCount: suggestions.exercises?.length || 0
      });

      return suggestions;

    } catch (error) {
      logger.error('LLM exercise suggestions failed', {
        error: error.message,
        prompt
      });
      throw new ExternalServiceError('Failed to generate exercise suggestions');
    }
  }

  _buildWorkoutPrompt(params) {
    const {
      date,
      timeCapMin,
      focus,
      exclusions,
      workoutType,
      difficultyLevel,
      equipment,
      goals,
      userProfile
    } = params;

    return `Generate a ${workoutType} workout plan with the following requirements:

**Workout Details:**
- Date: ${date}
- Time limit: ${timeCapMin} minutes
- Focus: ${focus || 'Full body'}
- Difficulty: ${difficultyLevel}
- Type: ${workoutType}

**Equipment Available:** ${equipment.length > 0 ? equipment.join(', ') : 'Basic gym equipment'}

**Exclusions:** ${exclusions.length > 0 ? exclusions.join(', ') : 'None'}

**Goals:** ${goals.length > 0 ? goals.join(', ') : 'General fitness'}

**User Profile:**
${userProfile.heightCm ? `- Height: ${userProfile.heightCm}cm` : ''}
${userProfile.weightKg ? `- Weight: ${userProfile.weightKg}kg` : ''}
${userProfile.unitsPreference ? `- Units: ${userProfile.unitsPreference}` : ''}

Please create an effective workout that:
1. Fits within the time constraint
2. Targets the specified focus areas
3. Avoids excluded movements/muscle groups
4. Matches the difficulty level
5. Uses available equipment
6. Progresses logically through the session

Include warm-up and cool-down if time permits.`;
  }

  _buildExercisePrompt(params) {
    const { prompt, muscleGroups, equipment, difficultyLevel, maxSuggestions } = params;

    return `${prompt}

**Additional Parameters:**
- Muscle groups: ${muscleGroups.length > 0 ? muscleGroups.join(', ') : 'Any'}
- Equipment: ${equipment.length > 0 ? equipment.join(', ') : 'Any'}
- Difficulty: ${difficultyLevel || 'Any'}
- Max suggestions: ${maxSuggestions}

Please provide creative and effective exercise suggestions.`;
  }

  _getSystemPrompt(type) {
    const prompts = {
      workout_generation: `You are an expert fitness trainer and workout designer. Create comprehensive, safe, and effective workout plans in JSON format.

Your response must be valid JSON with this structure:
{
  "name": "Workout name",
  "description": "Brief description",
  "estimatedDuration": 45,
  "warmup": [
    {
      "name": "Exercise name",
      "duration": "5 minutes",
      "instructions": "Brief instructions"
    }
  ],
  "exercises": [
    {
      "name": "Exercise name",
      "category": "strength/cardio/flexibility",
      "muscleGroups": ["chest", "triceps"],
      "sets": 3,
      "reps": "8-12",
      "restSeconds": 60,
      "weight": "bodyweight/light/moderate/heavy",
      "instructions": "Form cues and safety notes",
      "modifications": "Easier/harder variations"
    }
  ],
  "cooldown": [
    {
      "name": "Stretch name",
      "duration": "30 seconds",
      "instructions": "Stretch instructions"
    }
  ]
}

Focus on:
- Exercise safety and proper form
- Logical progression and flow
- Time management
- Clear, actionable instructions
- Appropriate intensity
- Muscle balance`,

      exercise_suggestions: `You are an expert fitness trainer specializing in exercise selection and programming. Suggest innovative and effective exercises in JSON format.

Your response must be valid JSON with this structure:
{
  "suggestions": [
    {
      "name": "Exercise name",
      "category": "strength/cardio/flexibility",
      "muscleGroups": ["primary", "secondary"],
      "equipment": ["barbell", "bench"],
      "difficultyLevel": "beginner/intermediate/advanced",
      "description": "What the exercise does",
      "instructions": "Step-by-step how to perform",
      "benefits": ["benefit1", "benefit2"],
      "safetyNotes": "Important safety considerations",
      "variations": ["easier variation", "harder variation"]
    }
  ]
}

Focus on:
- Exercise effectiveness
- Safety and proper form
- Variety and creativity
- Clear instructions
- Practical implementation`
    };

    return prompts[type] || '';
  }

  _formatWorkoutResponse(workoutPlan, originalParams) {
    return {
      workout: {
        name: workoutPlan.name || 'Generated Workout',
        description: workoutPlan.description || 'LLM generated workout plan',
        estimatedDuration: workoutPlan.estimatedDuration || originalParams.timeCapMin,
        focus: originalParams.focus,
        workoutType: originalParams.workoutType,
        difficultyLevel: originalParams.difficultyLevel,
        source: 'llm_generated',
        llmGenerationParams: originalParams
      },
      warmup: workoutPlan.warmup || [],
      exercises: workoutPlan.exercises || [],
      cooldown: workoutPlan.cooldown || []
    };
  }
}

module.exports = new LLMService();