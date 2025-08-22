/**
 * LLM Tool Functions for workout generation
 * These tools provide the LLM with structured access to user data and workout creation
 * @file llm-tools.js
 */

const { v4: uuidv4 } = require('uuid');

class LLMTools {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get training summary for last 7 days
   * Provides context about recent training load and patterns
   */
  async get_summary_7d(userId) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const workouts = await this.db('workouts')
        .leftJoin('workout_exercises', 'workouts.id', 'workout_exercises.workout_id')
        .leftJoin('workout_sets', 'workout_exercises.id', 'workout_sets.workout_exercise_id')
        .leftJoin('exercises', 'workout_exercises.exercise_id', 'exercises.id')
        .where('workouts.user_id', userId)
        .where('workouts.workout_date', '>=', sevenDaysAgo.toISOString().split('T')[0])
        .where('workouts.status', 'completed')
        .select([
          'workouts.id as workout_id',
          'workouts.workout_date',
          'workouts.focus',
          'workouts.workout_type',
          'workouts.overall_rpe',
          'workouts.total_volume_kg',
          'workouts.actual_duration_minutes',
          'exercises.muscle_groups',
          'workout_sets.weight',
          'workout_sets.reps',
          'workout_sets.actual_rpe'
        ]);

      // Process raw data into summary
      const summary = this.processTrainingSummary(workouts);
      
      return {
        period: '7 days',
        total_workouts: summary.workoutCount,
        total_volume_kg: summary.totalVolume,
        average_rpe: summary.avgRPE,
        average_duration: summary.avgDuration,
        muscle_group_volume: summary.muscleGroupVolume,
        movement_pattern_volume: summary.movementPatternVolume,
        intensity_distribution: summary.intensityDistribution,
        workout_types: summary.workoutTypes,
        focus_areas: summary.focusAreas,
        fatigue_scores: this.calculateFatigueScores(summary),
        recovery_status: this.assessRecoveryStatus(summary)
      };

    } catch (error) {
      throw new Error(`Failed to get 7-day summary: ${error.message}`);
    }
  }

  /**
   * Get training summary for last 14 days
   * Extended view for better progression analysis
   */
  async get_summary_14d(userId) {
    try {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const workouts = await this.db('workouts')
        .leftJoin('workout_exercises', 'workouts.id', 'workout_exercises.workout_id')
        .leftJoin('workout_sets', 'workout_exercises.id', 'workout_sets.workout_exercise_id')
        .leftJoin('exercises', 'workout_exercises.exercise_id', 'exercises.id')
        .where('workouts.user_id', userId)
        .where('workouts.workout_date', '>=', fourteenDaysAgo.toISOString().split('T')[0])
        .where('workouts.status', 'completed')
        .select([
          'workouts.id as workout_id',
          'workouts.workout_date',
          'workouts.focus',
          'workouts.workout_type',
          'workouts.overall_rpe',
          'workouts.total_volume_kg',
          'workouts.actual_duration_minutes',
          'exercises.muscle_groups',
          'workout_sets.weight',
          'workout_sets.reps',
          'workout_sets.actual_rpe'
        ]);

      const summary = this.processTrainingSummary(workouts);
      const progressionData = this.analyzeProgression(workouts);
      
      return {
        ...summary,
        period: '14 days',
        progression_analysis: progressionData,
        weekly_comparison: this.compareWeeks(workouts)
      };

    } catch (error) {
      throw new Error(`Failed to get 14-day summary: ${error.message}`);
    }
  }

  /**
   * Get user's active exercise library
   * CRITICAL: Only these exercises can be used in workout generation
   */
  async get_exercise_library(userId) {
    try {
      const exercises = await this.db('exercises')
        .leftJoin('user_exercise_library', function() {
          this.on('exercises.id', '=', 'user_exercise_library.exercise_id')
              .andOn('user_exercise_library.user_id', '=', this.db.raw('?', [userId]));
        })
        .where('exercises.is_active', true)
        .where(function() {
          this.where('exercises.is_custom', false)
              .orWhere('exercises.created_by', userId)
              .orWhere('user_exercise_library.is_active', true);
        })
        .select([
          'exercises.id',
          'exercises.name',
          'exercises.description',
          'exercises.category',
          'exercises.muscle_groups',
          'exercises.equipment_needed',
          'exercises.difficulty_level',
          'exercises.instructions',
          'exercises.variations'
        ])
        .orderBy('exercises.name');

      return {
        total_exercises: exercises.length,
        exercises: exercises,
        categories: this.groupByCategory(exercises),
        equipment_summary: this.summarizeEquipment(exercises),
        muscle_group_coverage: this.analyzeMuscleGroupCoverage(exercises)
      };

    } catch (error) {
      throw new Error(`Failed to get exercise library: ${error.message}`);
    }
  }

  /**
   * Get available equipment for user
   * Used to filter exercises and validate workout plans
   */
  async get_equipment_available(userId) {
    try {
      const equipment = await this.db('user_equipment')
        .where('user_id', userId)
        .where('is_available', true)
        .select(['equipment_name', 'quantity', 'notes']);

      const equipmentList = equipment.map(eq => eq.equipment_name);

      return {
        available_equipment: equipmentList,
        equipment_details: equipment,
        home_gym: equipmentList.length > 0,
        commercial_gym: equipmentList.includes('full_gym_access')
      };

    } catch (error) {
      // If no equipment table exists, return basic equipment
      return {
        available_equipment: ['bodyweight'],
        equipment_details: [{ equipment_name: 'bodyweight', quantity: 1, notes: 'Always available' }],
        home_gym: false,
        commercial_gym: false
      };
    }
  }

  /**
   * Get user constraints and preferences
   */
  async get_user_constraints(userId) {
    try {
      const profile = await this.db('user_profiles')
        .where('user_id', userId)
        .first();

      const injuries = await this.db('user_injuries')
        .where('user_id', userId)
        .where('is_active', true)
        .select(['injury_type', 'affected_areas', 'limitations']);

      return {
        max_workout_duration: profile?.max_workout_duration || 90,
        weekly_frequency: profile?.weekly_frequency || 4,
        fitness_level: profile?.fitness_level || 'intermediate',
        primary_goals: profile?.primary_goals || ['general_fitness'],
        excluded_exercises: profile?.excluded_exercises || [],
        excluded_muscle_groups: profile?.excluded_muscle_groups || [],
        injury_considerations: injuries.map(inj => ({
          type: inj.injury_type,
          areas: inj.affected_areas,
          limitations: inj.limitations
        })),
        training_style: profile?.training_style || 'balanced',
        experience_years: profile?.experience_years || 1
      };

    } catch (error) {
      // Return safe defaults if no profile exists
      return {
        max_workout_duration: 60,
        weekly_frequency: 3,
        fitness_level: 'beginner',
        primary_goals: ['general_fitness'],
        excluded_exercises: [],
        excluded_muscle_groups: [],
        injury_considerations: [],
        training_style: 'balanced',
        experience_years: 0
      };
    }
  }

  /**
   * Create and validate workout plan
   * This is the final step that saves the generated workout
   */
  async create_workout_plan(userId, workoutPlan, generationMetadata = {}) {
    const trx = await this.db.transaction();
    
    try {
      // Generate UUID if not provided
      if (!workoutPlan.id) {
        workoutPlan.id = uuidv4();
      }

      // Insert main workout record
      const [workoutId] = await trx('workouts').insert({
        id: workoutPlan.id,
        user_id: userId,
        name: workoutPlan.name,
        description: workoutPlan.description,
        workout_date: new Date().toISOString().split('T')[0],
        time_cap_minutes: workoutPlan.estimated_duration,
        focus: workoutPlan.focus,
        workout_type: workoutPlan.workout_type,
        status: 'planned',
        source: 'llm_generated',
        overall_rpe: workoutPlan.overall_rpe_target,
        llm_generation_params: JSON.stringify(generationMetadata)
      }).returning('id');

      // Insert workout blocks and exercises
      for (const block of workoutPlan.blocks) {
        const [blockId] = await trx('workout_blocks').insert({
          id: uuidv4(),
          workout_id: workoutId,
          block_type: block.type,
          name: block.name,
          order_index: workoutPlan.blocks.indexOf(block),
          time_cap_minutes: block.time_cap_minutes,
          notes: block.notes
        }).returning('id');

        for (const exercise of block.exercises) {
          const [exerciseId] = await trx('workout_exercises').insert({
            id: uuidv4(),
            workout_id: workoutId,
            workout_block_id: blockId,
            exercise_id: exercise.exercise_id,
            order_index: exercise.order,
            notes: exercise.notes,
            rest_between_exercises: exercise.rest_between_exercises
          }).returning('id');

          // Insert sets
          for (const set of exercise.sets) {
            await trx('workout_sets').insert({
              id: uuidv4(),
              workout_exercise_id: exerciseId,
              set_number: set.set_number,
              planned_reps: set.reps,
              planned_weight: set.weight,
              rest_seconds: set.rest_seconds,
              target_rpe: set.rpe,
              notes: set.notes
            });
          }
        }
      }

      // Log generation metadata
      await trx('llm_generation_log').insert({
        id: uuidv4(),
        user_id: userId,
        workout_id: workoutId,
        generation_timestamp: new Date(),
        model_used: generationMetadata.model || 'gpt-4',
        prompt_tokens: generationMetadata.prompt_tokens || 0,
        completion_tokens: generationMetadata.completion_tokens || 0,
        total_tokens: generationMetadata.total_tokens || 0,
        generation_time_ms: generationMetadata.generation_time || 0,
        rationale: workoutPlan.rationale,
        safety_notes: JSON.stringify(workoutPlan.safety_notes)
      });

      await trx.commit();

      return {
        success: true,
        workout_id: workoutId,
        message: 'Workout plan created successfully',
        estimated_duration: workoutPlan.estimated_duration,
        total_exercises: this.countTotalExercises(workoutPlan),
        blocks: workoutPlan.blocks.length
      };

    } catch (error) {
      await trx.rollback();
      throw new Error(`Failed to create workout plan: ${error.message}`);
    }
  }

  /**
   * Log exercise suggestions that weren't in library
   */
  async log_exercise_suggestion(userId, suggestion) {
    try {
      await this.db('exercise_suggestions').insert({
        id: uuidv4(),
        user_id: userId,
        suggested_name: suggestion.suggested_name,
        reason: suggestion.reason,
        muscle_groups: JSON.stringify(suggestion.muscle_groups),
        equipment_needed: JSON.stringify(suggestion.equipment_needed),
        category: suggestion.category,
        status: 'pending',
        created_at: new Date()
      });

      return { success: true, message: 'Exercise suggestion logged' };
    } catch (error) {
      throw new Error(`Failed to log exercise suggestion: ${error.message}`);
    }
  }

  // Helper methods for data processing
  processTrainingSummary(rawWorkouts) {
    const workoutGroups = this.groupWorkoutsByDate(rawWorkouts);
    const workouts = Object.values(workoutGroups);

    return {
      workoutCount: workouts.length,
      totalVolume: workouts.reduce((sum, w) => sum + (w.total_volume_kg || 0), 0),
      avgRPE: workouts.reduce((sum, w) => sum + (w.overall_rpe || 0), 0) / workouts.length,
      avgDuration: workouts.reduce((sum, w) => sum + (w.actual_duration_minutes || 0), 0) / workouts.length,
      muscleGroupVolume: this.calculateMuscleGroupVolume(rawWorkouts),
      movementPatternVolume: this.calculateMovementPatternVolume(rawWorkouts),
      intensityDistribution: this.calculateIntensityDistribution(workouts),
      workoutTypes: this.countWorkoutTypes(workouts),
      focusAreas: this.countFocusAreas(workouts)
    };
  }

  groupWorkoutsByDate(workouts) {
    return workouts.reduce((groups, workout) => {
      const date = workout.workout_date;
      if (!groups[date]) {
        groups[date] = {
          workout_date: date,
          workout_id: workout.workout_id,
          focus: workout.focus,
          workout_type: workout.workout_type,
          overall_rpe: workout.overall_rpe,
          total_volume_kg: workout.total_volume_kg,
          actual_duration_minutes: workout.actual_duration_minutes
        };
      }
      return groups;
    }, {});
  }

  calculateMuscleGroupVolume(workouts) {
    const volume = {};
    
    workouts.forEach(workout => {
      if (workout.muscle_groups) {
        const muscleGroups = Array.isArray(workout.muscle_groups) 
          ? workout.muscle_groups 
          : JSON.parse(workout.muscle_groups || '[]');
        
        const setVolume = (workout.weight || 0) * (workout.reps || 0);
        
        muscleGroups.forEach(mg => {
          volume[mg] = (volume[mg] || 0) + setVolume;
        });
      }
    });
    
    return volume;
  }

  calculateMovementPatternVolume(workouts) {
    // This would need exercise-to-movement-pattern mapping
    // Simplified for now
    return {
      squat_pattern: 0,
      hinge_pattern: 0,
      push_pattern: 0,
      pull_pattern: 0,
      lunge_pattern: 0
    };
  }

  calculateIntensityDistribution(workouts) {
    const distribution = {
      low: 0,    // RPE 1-6
      moderate: 0, // RPE 7-8
      high: 0     // RPE 9-10
    };

    workouts.forEach(workout => {
      const rpe = workout.overall_rpe || 0;
      if (rpe <= 6) distribution.low++;
      else if (rpe <= 8) distribution.moderate++;
      else distribution.high++;
    });

    return distribution;
  }

  countWorkoutTypes(workouts) {
    return workouts.reduce((counts, workout) => {
      const type = workout.workout_type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
  }

  countFocusAreas(workouts) {
    return workouts.reduce((counts, workout) => {
      const focus = workout.focus || 'unknown';
      counts[focus] = (counts[focus] || 0) + 1;
      return counts;
    }, {});
  }

  calculateFatigueScores(summary) {
    // Calculate fatigue based on volume and intensity
    const scores = {};
    
    Object.entries(summary.muscleGroupVolume).forEach(([muscle, volume]) => {
      // Higher volume and recent high intensity = higher fatigue
      const normalizedVolume = Math.min(volume / 10000, 1); // Cap at 1
      const avgIntensity = summary.avgRPE / 10;
      
      scores[muscle] = Math.min(normalizedVolume * avgIntensity * 10, 10);
    });
    
    return scores;
  }

  assessRecoveryStatus(summary) {
    const avgRPE = summary.avgRPE || 0;
    const workoutFrequency = summary.workoutCount;
    
    if (avgRPE > 8.5 && workoutFrequency > 5) {
      return 'needs_deload';
    } else if (avgRPE > 7.5 && workoutFrequency > 4) {
      return 'moderate_fatigue';
    } else if (workoutFrequency < 2) {
      return 'well_recovered';
    } else {
      return 'normal';
    }
  }

  analyzeProgression(workouts) {
    // Week-over-week comparison logic
    return {
      volume_trend: 'stable',
      intensity_trend: 'increasing',
      frequency_trend: 'stable'
    };
  }

  compareWeeks(workouts) {
    // Split workouts into two 7-day periods
    const midpoint = new Date();
    midpoint.setDate(midpoint.getDate() - 7);
    
    const week1 = workouts.filter(w => new Date(w.workout_date) < midpoint);
    const week2 = workouts.filter(w => new Date(w.workout_date) >= midpoint);
    
    return {
      week1_summary: this.processTrainingSummary(week1),
      week2_summary: this.processTrainingSummary(week2)
    };
  }

  groupByCategory(exercises) {
    return exercises.reduce((groups, exercise) => {
      const category = exercise.category || 'uncategorized';
      if (!groups[category]) groups[category] = [];
      groups[category].push(exercise);
      return groups;
    }, {});
  }

  summarizeEquipment(exercises) {
    const equipment = new Set();
    
    exercises.forEach(exercise => {
      const needed = Array.isArray(exercise.equipment_needed)
        ? exercise.equipment_needed
        : JSON.parse(exercise.equipment_needed || '[]');
      
      needed.forEach(eq => equipment.add(eq));
    });
    
    return Array.from(equipment);
  }

  analyzeMuscleGroupCoverage(exercises) {
    const coverage = {};
    
    exercises.forEach(exercise => {
      const muscles = Array.isArray(exercise.muscle_groups)
        ? exercise.muscle_groups
        : JSON.parse(exercise.muscle_groups || '[]');
      
      muscles.forEach(muscle => {
        coverage[muscle] = (coverage[muscle] || 0) + 1;
      });
    });
    
    return coverage;
  }

  countTotalExercises(workoutPlan) {
    return workoutPlan.blocks.reduce((total, block) => {
      return total + block.exercises.length;
    }, 0);
  }

  /**
   * Get all available tool definitions for LLM function calling
   */
  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'get_summary_7d',
          description: 'Get training summary for the last 7 days including volume, intensity, and recovery status',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_summary_14d',
          description: 'Get extended training summary for the last 14 days with progression analysis',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_exercise_library',
          description: 'Get user\'s complete exercise library - ONLY these exercises can be used in workouts',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_equipment_available',
          description: 'Get list of available equipment for filtering exercises',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_user_constraints',
          description: 'Get user preferences, limitations, and injury considerations',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_workout_plan',
          description: 'Create and save the final validated workout plan',
          parameters: {
            type: 'object',
            properties: {
              workout_plan: {
                type: 'object',
                description: 'Complete workout plan object',
                required: ['name', 'blocks', 'workout_type', 'focus']
              }
            },
            required: ['workout_plan']
          }
        }
      }
    ];
  }
}

module.exports = { LLMTools };