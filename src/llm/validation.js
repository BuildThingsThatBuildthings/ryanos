/**
 * Validation utilities for workout plans and exercise library enforcement
 * @file validation.js
 */

const { z } = require('zod');

// Zod schemas for validation
const WorkoutSetSchema = z.object({
  set_number: z.number().int().positive(),
  reps: z.number().int().positive().max(500),
  weight: z.number().nonnegative().max(1000),
  rest_seconds: z.number().int().nonnegative().max(3600),
  rpe: z.number().min(1).max(10),
  notes: z.string().optional()
});

const WorkoutExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise_name: z.string().min(1).max(200),
  order: z.number().int().positive(),
  sets: z.array(WorkoutSetSchema).min(1).max(20),
  notes: z.string().optional(),
  rest_between_exercises: z.number().int().nonnegative().max(1800)
});

const WorkoutBlockSchema = z.object({
  type: z.enum(['warmup', 'strength', 'metcon', 'skill', 'cooldown']),
  name: z.string().min(1).max(200),
  exercises: z.array(WorkoutExerciseSchema).min(1).max(15),
  time_cap_minutes: z.number().int().positive().max(180),
  notes: z.string().optional()
});

const WorkoutPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  blocks: z.array(WorkoutBlockSchema).min(1).max(10),
  estimated_duration: z.number().int().positive().max(300),
  workout_type: z.enum(['strength', 'cardio', 'mixed', 'flexibility', 'sport_specific']),
  focus: z.string().min(1).max(100),
  overall_rpe_target: z.number().min(1).max(10),
  equipment_required: z.array(z.string()).max(20),
  rationale: z.string().min(10),
  safety_notes: z.array(z.string()).max(10)
});

class WorkoutValidator {
  constructor() {
    this.progressionLimits = {
      volume: 0.15, // ±15% week-over-week
      intensity: 0.10, // ±10% week-over-week
      frequency: 0.20 // ±20% week-over-week
    };
    
    this.safetyRules = {
      maxConsecutiveHeavyDays: 2,
      minRestBetweenHeavySessions: 48, // hours
      maxRPEForBackToBack: 8.5,
      deloadFrequency: 4 // weeks
    };
  }

  /**
   * Validates workout plan against user's exercise library
   * @param {Object} workoutPlan - Generated workout plan
   * @param {Array} exerciseLibrary - User's active exercise library
   * @param {Array} recentHistory - Recent training history
   * @param {Object} constraints - User constraints
   * @returns {Object} Validation result
   */
  validateWorkoutPlan(workoutPlan, exerciseLibrary, recentHistory = [], constraints = {}) {
    const result = {
      is_valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    try {
      // Schema validation
      const schemaResult = this.validateSchema(workoutPlan);
      if (!schemaResult.success) {
        result.errors.push(...schemaResult.errors);
        result.is_valid = false;
      }

      // Exercise library validation (STRICT)
      const libraryResult = this.validateExerciseLibrary(workoutPlan, exerciseLibrary);
      result.errors.push(...libraryResult.errors);
      result.suggestions.push(...libraryResult.suggestions);
      if (libraryResult.errors.length > 0) {
        result.is_valid = false;
      }

      // Safety rules validation
      const safetyResult = this.validateSafetyRules(workoutPlan, recentHistory);
      result.errors.push(...safetyResult.errors);
      result.warnings.push(...safetyResult.warnings);
      if (safetyResult.errors.length > 0) {
        result.is_valid = false;
      }

      // Progression validation
      const progressionResult = this.validateProgression(workoutPlan, recentHistory);
      result.warnings.push(...progressionResult.warnings);

      // Equipment validation
      const equipmentResult = this.validateEquipment(workoutPlan, constraints.available_equipment);
      result.errors.push(...equipmentResult.errors);
      if (equipmentResult.errors.length > 0) {
        result.is_valid = false;
      }

      // Constraint validation
      const constraintResult = this.validateConstraints(workoutPlan, constraints);
      result.warnings.push(...constraintResult.warnings);

    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
      result.is_valid = false;
    }

    return result;
  }

  /**
   * Validates workout plan schema
   * @param {Object} workoutPlan 
   * @returns {Object}
   */
  validateSchema(workoutPlan) {
    try {
      WorkoutPlanSchema.parse(workoutPlan);
      return { success: true, errors: [] };
    } catch (error) {
      const errors = error.errors.map(err => 
        `Schema validation: ${err.path.join('.')} - ${err.message}`
      );
      return { success: false, errors };
    }
  }

  /**
   * STRICT validation that ALL exercises exist in user's library
   * @param {Object} workoutPlan 
   * @param {Array} exerciseLibrary 
   * @returns {Object}
   */
  validateExerciseLibrary(workoutPlan, exerciseLibrary) {
    const errors = [];
    const suggestions = [];
    const libraryIds = new Set(exerciseLibrary.map(ex => ex.id));
    const libraryNames = new Set(exerciseLibrary.map(ex => ex.name.toLowerCase()));

    // Check all exercises in all blocks
    workoutPlan.blocks.forEach((block, blockIndex) => {
      block.exercises.forEach((exercise, exerciseIndex) => {
        // Check if exercise ID exists in library
        if (!libraryIds.has(exercise.exercise_id)) {
          // Check if it's a name mismatch
          if (libraryNames.has(exercise.exercise_name.toLowerCase())) {
            errors.push(
              `Block ${blockIndex + 1}, Exercise ${exerciseIndex + 1}: ` +
              `Exercise "${exercise.exercise_name}" exists in library but ID mismatch`
            );
          } else {
            // Exercise not in library at all - create suggestion
            errors.push(
              `Block ${blockIndex + 1}, Exercise ${exerciseIndex + 1}: ` +
              `Exercise "${exercise.exercise_name}" not found in user's library`
            );
            
            suggestions.push({
              suggested_name: exercise.exercise_name,
              reason: `Required for ${block.type} block in ${workoutPlan.name}`,
              muscle_groups: this.inferMuscleGroups(exercise.exercise_name),
              equipment_needed: this.inferEquipment(exercise.exercise_name),
              category: this.inferCategory(block.type),
              status: 'pending',
              timestamp: new Date().toISOString()
            });
          }
        }
      });
    });

    return { errors, suggestions };
  }

  /**
   * Validates safety rules and anti-overlap patterns
   * @param {Object} workoutPlan 
   * @param {Array} recentHistory 
   * @returns {Object}
   */
  validateSafetyRules(workoutPlan, recentHistory) {
    const errors = [];
    const warnings = [];

    // Check for consecutive heavy days
    const heavyDays = this.identifyHeavyDays(recentHistory);
    const plannedRPE = workoutPlan.overall_rpe_target;
    
    if (plannedRPE > 8.5 && heavyDays.consecutive >= this.safetyRules.maxConsecutiveHeavyDays) {
      errors.push(
        `Safety violation: ${heavyDays.consecutive} consecutive heavy days detected. ` +
        `Planned RPE ${plannedRPE} exceeds limit for back-to-back sessions.`
      );
    }

    // Check muscle group overlap
    const recentMuscleGroups = this.getRecentMuscleGroups(recentHistory, 2); // Last 2 days
    const plannedMuscleGroups = this.getPlannedMuscleGroups(workoutPlan);
    
    const overlap = recentMuscleGroups.filter(mg => 
      plannedMuscleGroups.includes(mg) && plannedRPE > 7
    );
    
    if (overlap.length > 0 && plannedRPE > 8) {
      warnings.push(
        `Muscle group overlap detected: ${overlap.join(', ')} trained in last 48h ` +
        `with planned high intensity (RPE ${plannedRPE})`
      );
    }

    // Check movement pattern overlap
    const recentPatterns = this.getRecentMovementPatterns(recentHistory, 1); // Yesterday
    const plannedPatterns = this.getPlannedMovementPatterns(workoutPlan);
    
    const patternOverlap = recentPatterns.filter(pattern => 
      plannedPatterns.includes(pattern) && plannedRPE > 8
    );
    
    if (patternOverlap.length > 0) {
      warnings.push(
        `Movement pattern overlap: ${patternOverlap.join(', ')} performed yesterday ` +
        `with planned high intensity`
      );
    }

    return { errors, warnings };
  }

  /**
   * Validates progression within safe limits
   * @param {Object} workoutPlan 
   * @param {Array} recentHistory 
   * @returns {Object}
   */
  validateProgression(workoutPlan, recentHistory) {
    const warnings = [];

    if (recentHistory.length < 7) {
      warnings.push('Insufficient history for progression analysis');
      return { warnings };
    }

    // Calculate recent averages
    const recentVolume = this.calculateAverageVolume(recentHistory, 7);
    const plannedVolume = this.estimateWorkoutVolume(workoutPlan);
    
    const volumeChange = (plannedVolume - recentVolume) / recentVolume;
    
    if (Math.abs(volumeChange) > this.progressionLimits.volume) {
      warnings.push(
        `Volume change of ${(volumeChange * 100).toFixed(1)}% exceeds ` +
        `recommended limit of ±${(this.progressionLimits.volume * 100)}%`
      );
    }

    // Check intensity progression
    const recentIntensity = this.calculateAverageIntensity(recentHistory, 7);
    const intensityChange = (workoutPlan.overall_rpe_target - recentIntensity) / recentIntensity;
    
    if (Math.abs(intensityChange) > this.progressionLimits.intensity) {
      warnings.push(
        `Intensity change of ${(intensityChange * 100).toFixed(1)}% exceeds ` +
        `recommended limit of ±${(this.progressionLimits.intensity * 100)}%`
      );
    }

    return { warnings };
  }

  /**
   * Validates equipment requirements
   * @param {Object} workoutPlan 
   * @param {Array} availableEquipment 
   * @returns {Object}
   */
  validateEquipment(workoutPlan, availableEquipment = []) {
    const errors = [];
    const required = workoutPlan.equipment_required || [];
    const available = new Set(availableEquipment.map(eq => eq.toLowerCase()));
    
    const missing = required.filter(eq => !available.has(eq.toLowerCase()));
    
    if (missing.length > 0) {
      errors.push(`Missing required equipment: ${missing.join(', ')}`);
    }

    return { errors };
  }

  /**
   * Validates user constraints
   * @param {Object} workoutPlan 
   * @param {Object} constraints 
   * @returns {Object}
   */
  validateConstraints(workoutPlan, constraints) {
    const warnings = [];

    // Check duration constraint
    if (constraints.max_workout_duration && 
        workoutPlan.estimated_duration > constraints.max_workout_duration) {
      warnings.push(
        `Workout duration ${workoutPlan.estimated_duration}min exceeds ` +
        `user limit of ${constraints.max_workout_duration}min`
      );
    }

    // Check excluded exercises
    if (constraints.excluded_exercises && constraints.excluded_exercises.length > 0) {
      const excludedNames = constraints.excluded_exercises.map(ex => ex.toLowerCase());
      const planExercises = this.getAllExerciseNames(workoutPlan);
      
      const violations = planExercises.filter(ex => 
        excludedNames.includes(ex.toLowerCase())
      );
      
      if (violations.length > 0) {
        warnings.push(`Workout includes excluded exercises: ${violations.join(', ')}`);
      }
    }

    return { warnings };
  }

  // Helper methods for validation logic
  identifyHeavyDays(history) {
    const recent = history.slice(-5); // Last 5 days
    let consecutive = 0;
    
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].overall_rpe > 8.5) {
        consecutive++;
      } else {
        break;
      }
    }
    
    return { consecutive, recent };
  }

  getRecentMuscleGroups(history, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return history
      .filter(w => new Date(w.date) >= cutoff)
      .flatMap(w => Object.keys(w.muscle_group_volume || {}))
      .filter((mg, i, arr) => arr.indexOf(mg) === i); // unique
  }

  getPlannedMuscleGroups(workoutPlan) {
    // This would need to be enhanced with exercise-to-muscle-group mapping
    // For now, infer from focus and exercise names
    const groups = [];
    
    if (workoutPlan.focus) {
      groups.push(workoutPlan.focus);
    }
    
    // Add logic to map exercises to muscle groups
    return groups;
  }

  getRecentMovementPatterns(history, days) {
    // Map exercises to movement patterns (squat, hinge, push, pull, etc.)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return history
      .filter(w => new Date(w.date) >= cutoff)
      .flatMap(w => Object.keys(w.movement_pattern_volume || {}))
      .filter((pattern, i, arr) => arr.indexOf(pattern) === i);
  }

  getPlannedMovementPatterns(workoutPlan) {
    // Infer movement patterns from planned exercises
    const patterns = [];
    
    workoutPlan.blocks.forEach(block => {
      block.exercises.forEach(exercise => {
        const pattern = this.inferMovementPattern(exercise.exercise_name);
        if (pattern && !patterns.includes(pattern)) {
          patterns.push(pattern);
        }
      });
    });
    
    return patterns;
  }

  calculateAverageVolume(history, days) {
    const recent = history.slice(-days);
    const totalVolume = recent.reduce((sum, w) => sum + (w.total_volume_kg || 0), 0);
    return totalVolume / recent.length;
  }

  calculateAverageIntensity(history, days) {
    const recent = history.slice(-days);
    const totalRPE = recent.reduce((sum, w) => sum + (w.overall_rpe || 0), 0);
    return totalRPE / recent.length;
  }

  estimateWorkoutVolume(workoutPlan) {
    let totalVolume = 0;
    
    workoutPlan.blocks.forEach(block => {
      block.exercises.forEach(exercise => {
        exercise.sets.forEach(set => {
          totalVolume += (set.weight || 0) * (set.reps || 0);
        });
      });
    });
    
    return totalVolume;
  }

  getAllExerciseNames(workoutPlan) {
    const names = [];
    
    workoutPlan.blocks.forEach(block => {
      block.exercises.forEach(exercise => {
        names.push(exercise.exercise_name);
      });
    });
    
    return names;
  }

  // Inference methods for exercise suggestions
  inferMuscleGroups(exerciseName) {
    const name = exerciseName.toLowerCase();
    const muscleMap = {
      'squat': ['quadriceps', 'glutes'],
      'deadlift': ['hamstrings', 'glutes', 'erector_spinae'],
      'bench': ['chest', 'triceps', 'anterior_deltoids'],
      'press': ['shoulders', 'triceps'],
      'row': ['latissimus_dorsi', 'rhomboids', 'biceps'],
      'pull': ['latissimus_dorsi', 'biceps'],
      'push': ['chest', 'triceps', 'shoulders'],
      'curl': ['biceps'],
      'extension': ['triceps']
    };
    
    for (const [pattern, muscles] of Object.entries(muscleMap)) {
      if (name.includes(pattern)) {
        return muscles;
      }
    }
    
    return ['unknown'];
  }

  inferEquipment(exerciseName) {
    const name = exerciseName.toLowerCase();
    const equipmentMap = {
      'barbell': ['barbell', 'weight_plates'],
      'dumbbell': ['dumbbells'],
      'cable': ['cable_machine'],
      'machine': ['machines'],
      'bodyweight': []
    };
    
    for (const [pattern, equipment] of Object.entries(equipmentMap)) {
      if (name.includes(pattern)) {
        return equipment;
      }
    }
    
    return ['unknown'];
  }

  inferCategory(blockType) {
    const categoryMap = {
      'strength': 'strength',
      'metcon': 'cardio',
      'skill': 'sport_specific',
      'warmup': 'flexibility',
      'cooldown': 'flexibility'
    };
    
    return categoryMap[blockType] || 'strength';
  }

  inferMovementPattern(exerciseName) {
    const name = exerciseName.toLowerCase();
    const patternMap = {
      'squat': 'squat',
      'deadlift': 'hinge',
      'lunge': 'lunge',
      'bench': 'horizontal_push',
      'press': 'vertical_push',
      'row': 'horizontal_pull',
      'pullup': 'vertical_pull',
      'chin': 'vertical_pull'
    };
    
    for (const [pattern, movement] of Object.entries(patternMap)) {
      if (name.includes(pattern)) {
        return movement;
      }
    }
    
    return null;
  }
}

module.exports = {
  WorkoutValidator,
  WorkoutPlanSchema,
  WorkoutExerciseSchema,
  WorkoutSetSchema,
  WorkoutBlockSchema
};