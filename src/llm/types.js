/**
 * Type definitions for LLM-based workout generation system
 * @file types.js
 */

/**
 * @typedef {Object} Exercise
 * @property {string} id - Exercise UUID
 * @property {string} name - Exercise name
 * @property {string} description - Exercise description
 * @property {string} category - Exercise category (strength, cardio, etc.)
 * @property {string[]} muscle_groups - Primary muscle groups targeted
 * @property {string[]} equipment_needed - Required equipment
 * @property {'beginner'|'intermediate'|'advanced'} difficulty_level - Difficulty level
 * @property {string} instructions - Performance instructions
 * @property {string} video_url - Instructional video URL
 * @property {Object[]} variations - Exercise variations
 * @property {boolean} is_active - Whether exercise is active in user library
 * @property {boolean} is_custom - Whether exercise is user-created
 */

/**
 * @typedef {Object} WorkoutSet
 * @property {number} set_number - Set number in sequence
 * @property {number} reps - Target repetitions
 * @property {number} weight - Weight in kg
 * @property {number} rest_seconds - Rest period after set
 * @property {number} rpe - Rate of Perceived Exertion (1-10)
 * @property {string} notes - Set-specific notes
 */

/**
 * @typedef {Object} WorkoutExercise
 * @property {string} exercise_id - Reference to exercise UUID
 * @property {string} exercise_name - Exercise name (for validation)
 * @property {number} order - Exercise order in workout
 * @property {WorkoutSet[]} sets - Array of sets
 * @property {string} notes - Exercise-specific notes
 * @property {number} rest_between_exercises - Rest before next exercise (seconds)
 */

/**
 * @typedef {Object} WorkoutBlock
 * @property {'warmup'|'strength'|'metcon'|'skill'|'cooldown'} type - Block type
 * @property {string} name - Block name
 * @property {WorkoutExercise[]} exercises - Exercises in block
 * @property {number} time_cap_minutes - Time limit for block
 * @property {string} notes - Block-specific notes
 */

/**
 * @typedef {Object} WorkoutPlan
 * @property {string} id - Workout UUID
 * @property {string} name - Workout name
 * @property {string} description - Workout description
 * @property {WorkoutBlock[]} blocks - Workout blocks
 * @property {number} estimated_duration - Estimated duration in minutes
 * @property {'strength'|'cardio'|'mixed'|'flexibility'|'sport_specific'} workout_type - Type of workout
 * @property {string} focus - Primary focus (push, pull, legs, etc.)
 * @property {number} overall_rpe_target - Target overall RPE
 * @property {string[]} equipment_required - All equipment needed
 * @property {string} rationale - AI rationale for workout design
 * @property {string[]} safety_notes - Safety considerations
 */

/**
 * @typedef {Object} TrainingHistory
 * @property {string} date - Workout date (ISO string)
 * @property {string} workout_id - Workout UUID
 * @property {string} focus - Workout focus
 * @property {'strength'|'cardio'|'mixed'|'flexibility'|'sport_specific'} workout_type - Workout type
 * @property {number} duration_minutes - Actual duration
 * @property {number} overall_rpe - Actual RPE
 * @property {number} total_volume_kg - Total volume lifted
 * @property {Object.<string, number>} muscle_group_volume - Volume by muscle group
 * @property {Object.<string, number>} movement_pattern_volume - Volume by pattern
 * @property {'completed'|'partial'|'skipped'} status - Completion status
 */

/**
 * @typedef {Object} UserConstraints
 * @property {string[]} available_equipment - Available equipment
 * @property {number} max_workout_duration - Max workout time in minutes
 * @property {string[]} excluded_exercises - Exercises to avoid
 * @property {string[]} excluded_muscle_groups - Muscle groups to avoid
 * @property {string[]} injury_considerations - Current injuries/limitations
 * @property {'beginner'|'intermediate'|'advanced'} fitness_level - User fitness level
 * @property {string[]} goals - Primary training goals
 * @property {number} weekly_frequency - Workouts per week
 */

/**
 * @typedef {Object} GenerationContext
 * @property {Exercise[]} exercise_library - User's active exercise library
 * @property {TrainingHistory[]} recent_history - Last 7-14 days of training
 * @property {UserConstraints} constraints - User constraints and preferences
 * @property {Object.<string, number>} fatigue_scores - Current fatigue by muscle group
 * @property {Object.<string, number>} volume_targets - Weekly volume targets
 * @property {boolean} is_deload_week - Whether this is a deload week
 * @property {number} current_week_in_cycle - Week in current training cycle
 */

/**
 * @typedef {Object} ExerciseSuggestion
 * @property {string} suggested_name - Name of suggested exercise
 * @property {string} reason - Why this exercise was suggested
 * @property {string[]} muscle_groups - Muscle groups it would target
 * @property {string[]} equipment_needed - Equipment requirements
 * @property {string} category - Exercise category
 * @property {'pending'|'approved'|'rejected'} status - Approval status
 * @property {string} timestamp - When suggestion was made
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} is_valid - Whether plan is valid
 * @property {string[]} errors - Validation errors
 * @property {string[]} warnings - Validation warnings
 * @property {ExerciseSuggestion[]} suggestions - Exercises that would need approval
 */

/**
 * @typedef {Object} LLMResponse
 * @property {WorkoutPlan} workout_plan - Generated workout plan
 * @property {string} rationale - AI reasoning for the plan
 * @property {number} confidence_score - Confidence in the plan (0-1)
 * @property {ExerciseSuggestion[]} exercise_suggestions - New exercises suggested
 * @property {string[]} safety_considerations - Safety notes
 * @property {string[]} progression_notes - Progression considerations
 */

module.exports = {
  // Export types for JSDoc validation
  // These are used for runtime validation in the application
};