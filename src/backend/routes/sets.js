const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate, sanitize } = require('../validators/validate');
const { setSchema, setUpdateSchema } = require('../validators/schemas');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

const router = express.Router();

// Create new set
router.post('/',
  sanitize(),
  validate(setSchema),
  asyncHandler(async (req, res) => {
    const {
      workoutId,
      exerciseId,
      setNumber,
      reps,
      weightKg,
      distanceM,
      durationSeconds,
      rpe,
      restSeconds,
      tempo,
      notes,
      isWarmup,
      additionalMetrics
    } = req.body;

    // Verify workout exists and belongs to user
    const workout = await db('workouts')
      .select(['id', 'user_id', 'status'])
      .where('id', workoutId)
      .first();

    if (!workout) {
      throw new NotFoundError('Workout not found');
    }

    if (workout.user_id !== req.user.id) {
      throw new ValidationError('You can only add sets to your own workouts');
    }

    // Verify exercise exists
    const exercise = await db('exercises')
      .select(['id', 'name'])
      .where('id', exerciseId)
      .where('is_active', true)
      .first();

    if (!exercise) {
      throw new NotFoundError('Exercise not found');
    }

    // Check for duplicate set number in the same workout
    const existingSet = await db('sets')
      .select(['id'])
      .where('workout_id', workoutId)
      .where('set_number', setNumber)
      .first();

    if (existingSet) {
      throw new ValidationError(`Set number ${setNumber} already exists in this workout`);
    }

    const setData = {
      id: uuidv4(),
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_number: setNumber,
      reps,
      weight_kg: weightKg,
      distance_m: distanceM,
      duration_seconds: durationSeconds,
      rpe,
      rest_seconds: restSeconds,
      tempo,
      notes,
      is_warmup: isWarmup || false,
      is_completed: false,
      additional_metrics: additionalMetrics ? JSON.stringify(additionalMetrics) : null
    };

    const [set] = await db('sets')
      .insert(setData)
      .returning([
        'id', 'workout_id', 'exercise_id', 'set_number', 'reps',
        'weight_kg', 'distance_m', 'duration_seconds', 'rpe',
        'rest_seconds', 'tempo', 'notes', 'is_warmup',
        'is_completed', 'additional_metrics', 'created_at'
      ]);

    logger.info('Set created', {
      setId: set.id,
      workoutId: set.workout_id,
      exerciseId: set.exercise_id,
      setNumber: set.set_number,
      userId: req.user.id,
      requestId: req.requestId
    });

    res.status(201).json({
      message: 'Set created successfully',
      set: {
        id: set.id,
        workoutId: set.workout_id,
        exerciseId: set.exercise_id,
        setNumber: set.set_number,
        reps: set.reps,
        weightKg: set.weight_kg,
        distanceM: set.distance_m,
        durationSeconds: set.duration_seconds,
        rpe: set.rpe,
        restSeconds: set.rest_seconds,
        tempo: set.tempo,
        notes: set.notes,
        isWarmup: set.is_warmup,
        isCompleted: set.is_completed,
        additionalMetrics: set.additional_metrics ? JSON.parse(set.additional_metrics) : null,
        createdAt: set.created_at,
        exercise: {
          name: exercise.name
        }
      }
    });
  })
);

// Get sets for a workout
router.get('/workout/:workoutId',
  asyncHandler(async (req, res) => {
    const workoutId = req.params.workoutId;

    // Verify workout belongs to user
    const workout = await db('workouts')
      .select(['id'])
      .where('id', workoutId)
      .where('user_id', req.user.id)
      .first();

    if (!workout) {
      throw new NotFoundError('Workout not found');
    }

    // Get sets with exercise details
    const sets = await db('sets as s')
      .join('exercises as e', 's.exercise_id', 'e.id')
      .select([
        's.id', 's.workout_id', 's.exercise_id', 's.set_number',
        's.reps', 's.weight_kg', 's.distance_m', 's.duration_seconds',
        's.rpe', 's.rest_seconds', 's.tempo', 's.notes',
        's.is_warmup', 's.is_completed', 's.started_at',
        's.completed_at', 's.additional_metrics', 's.created_at',
        'e.name as exercise_name', 'e.category as exercise_category',
        'e.muscle_groups', 'e.equipment_needed'
      ])
      .where('s.workout_id', workoutId)
      .orderBy('s.set_number', 'asc');

    res.json({
      sets: sets.map(set => ({
        id: set.id,
        workoutId: set.workout_id,
        exerciseId: set.exercise_id,
        setNumber: set.set_number,
        reps: set.reps,
        weightKg: set.weight_kg,
        distanceM: set.distance_m,
        durationSeconds: set.duration_seconds,
        rpe: set.rpe,
        restSeconds: set.rest_seconds,
        tempo: set.tempo,
        notes: set.notes,
        isWarmup: set.is_warmup,
        isCompleted: set.is_completed,
        startedAt: set.started_at,
        completedAt: set.completed_at,
        additionalMetrics: set.additional_metrics ? JSON.parse(set.additional_metrics) : null,
        createdAt: set.created_at,
        exercise: {
          name: set.exercise_name,
          category: set.exercise_category,
          muscleGroups: set.muscle_groups,
          equipmentNeeded: set.equipment_needed
        }
      }))
    });
  })
);

// Get set by ID
router.get('/:id',
  asyncHandler(async (req, res) => {
    const setId = req.params.id;

    // Get set with exercise and workout details
    const set = await db('sets as s')
      .join('exercises as e', 's.exercise_id', 'e.id')
      .join('workouts as w', 's.workout_id', 'w.id')
      .select([
        's.id', 's.workout_id', 's.exercise_id', 's.set_number',
        's.reps', 's.weight_kg', 's.distance_m', 's.duration_seconds',
        's.rpe', 's.rest_seconds', 's.tempo', 's.notes',
        's.is_warmup', 's.is_completed', 's.started_at',
        's.completed_at', 's.additional_metrics', 's.created_at',
        'e.name as exercise_name', 'e.category as exercise_category',
        'e.muscle_groups', 'e.equipment_needed',
        'w.name as workout_name', 'w.workout_date'
      ])
      .where('s.id', setId)
      .where('w.user_id', req.user.id)
      .first();

    if (!set) {
      throw new NotFoundError('Set not found');
    }

    res.json({
      set: {
        id: set.id,
        workoutId: set.workout_id,
        exerciseId: set.exercise_id,
        setNumber: set.set_number,
        reps: set.reps,
        weightKg: set.weight_kg,
        distanceM: set.distance_m,
        durationSeconds: set.duration_seconds,
        rpe: set.rpe,
        restSeconds: set.rest_seconds,
        tempo: set.tempo,
        notes: set.notes,
        isWarmup: set.is_warmup,
        isCompleted: set.is_completed,
        startedAt: set.started_at,
        completedAt: set.completed_at,
        additionalMetrics: set.additional_metrics ? JSON.parse(set.additional_metrics) : null,
        createdAt: set.created_at,
        exercise: {
          name: set.exercise_name,
          category: set.exercise_category,
          muscleGroups: set.muscle_groups,
          equipmentNeeded: set.equipment_needed
        },
        workout: {
          name: set.workout_name,
          date: set.workout_date
        }
      }
    });
  })
);

// Update set
router.patch('/:id',
  sanitize(),
  validate(setUpdateSchema),
  asyncHandler(async (req, res) => {
    const setId = req.params.id;

    // Verify set exists and belongs to user
    const existingSet = await db('sets as s')
      .join('workouts as w', 's.workout_id', 'w.id')
      .select(['s.id', 's.is_completed', 'w.user_id'])
      .where('s.id', setId)
      .first();

    if (!existingSet) {
      throw new NotFoundError('Set not found');
    }

    if (existingSet.user_id !== req.user.id) {
      throw new ValidationError('You can only edit your own sets');
    }

    const updates = {};
    
    // Map camelCase to snake_case
    if (req.body.reps !== undefined) updates.reps = req.body.reps;
    if (req.body.weightKg !== undefined) updates.weight_kg = req.body.weightKg;
    if (req.body.distanceM !== undefined) updates.distance_m = req.body.distanceM;
    if (req.body.durationSeconds !== undefined) updates.duration_seconds = req.body.durationSeconds;
    if (req.body.rpe !== undefined) updates.rpe = req.body.rpe;
    if (req.body.restSeconds !== undefined) updates.rest_seconds = req.body.restSeconds;
    if (req.body.tempo !== undefined) updates.tempo = req.body.tempo;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.isWarmup !== undefined) updates.is_warmup = req.body.isWarmup;
    if (req.body.additionalMetrics !== undefined) {
      updates.additional_metrics = req.body.additionalMetrics ? 
        JSON.stringify(req.body.additionalMetrics) : null;
    }

    // Handle completion status
    if (req.body.isCompleted !== undefined) {
      updates.is_completed = req.body.isCompleted;
      
      if (req.body.isCompleted && !existingSet.is_completed) {
        updates.completed_at = db.fn.now();
      } else if (!req.body.isCompleted && existingSet.is_completed) {
        updates.completed_at = null;
      }
    }

    updates.updated_at = db.fn.now();

    const [updatedSet] = await db('sets')
      .where('id', setId)
      .update(updates)
      .returning([
        'id', 'workout_id', 'exercise_id', 'set_number', 'reps',
        'weight_kg', 'distance_m', 'duration_seconds', 'rpe',
        'rest_seconds', 'tempo', 'notes', 'is_warmup',
        'is_completed', 'started_at', 'completed_at',
        'additional_metrics', 'updated_at'
      ]);

    // Calculate total volume for the workout
    if (updates.weight_kg !== undefined || updates.reps !== undefined) {
      await updateWorkoutVolume(updatedSet.workout_id);
    }

    logger.info('Set updated', {
      setId: updatedSet.id,
      workoutId: updatedSet.workout_id,
      userId: req.user.id,
      updatedFields: Object.keys(updates),
      isCompleted: updatedSet.is_completed,
      requestId: req.requestId
    });

    res.json({
      message: 'Set updated successfully',
      set: {
        id: updatedSet.id,
        workoutId: updatedSet.workout_id,
        exerciseId: updatedSet.exercise_id,
        setNumber: updatedSet.set_number,
        reps: updatedSet.reps,
        weightKg: updatedSet.weight_kg,
        distanceM: updatedSet.distance_m,
        durationSeconds: updatedSet.duration_seconds,
        rpe: updatedSet.rpe,
        restSeconds: updatedSet.rest_seconds,
        tempo: updatedSet.tempo,
        notes: updatedSet.notes,
        isWarmup: updatedSet.is_warmup,
        isCompleted: updatedSet.is_completed,
        startedAt: updatedSet.started_at,
        completedAt: updatedSet.completed_at,
        additionalMetrics: updatedSet.additional_metrics ? 
          JSON.parse(updatedSet.additional_metrics) : null,
        updatedAt: updatedSet.updated_at
      }
    });
  })
);

// Delete set
router.delete('/:id',
  asyncHandler(async (req, res) => {
    const setId = req.params.id;

    // Verify set exists and belongs to user
    const set = await db('sets as s')
      .join('workouts as w', 's.workout_id', 'w.id')
      .select(['s.id', 's.workout_id', 'w.user_id'])
      .where('s.id', setId)
      .first();

    if (!set) {
      throw new NotFoundError('Set not found');
    }

    if (set.user_id !== req.user.id) {
      throw new ValidationError('You can only delete your own sets');
    }

    // Delete the set
    await db('sets')
      .where('id', setId)
      .del();

    // Update workout volume
    await updateWorkoutVolume(set.workout_id);

    logger.info('Set deleted', {
      setId,
      workoutId: set.workout_id,
      userId: req.user.id,
      requestId: req.requestId
    });

    res.json({
      message: 'Set deleted successfully'
    });
  })
);

// Start set (for timing)
router.patch('/:id/start',
  asyncHandler(async (req, res) => {
    const setId = req.params.id;

    // Verify set exists and belongs to user
    const set = await db('sets as s')
      .join('workouts as w', 's.workout_id', 'w.id')
      .select(['s.id', 's.is_completed', 's.started_at', 'w.user_id'])
      .where('s.id', setId)
      .first();

    if (!set) {
      throw new NotFoundError('Set not found');
    }

    if (set.user_id !== req.user.id) {
      throw new ValidationError('You can only start your own sets');
    }

    if (set.is_completed) {
      throw new ValidationError('Cannot start a completed set');
    }

    if (set.started_at) {
      throw new ValidationError('Set already started');
    }

    const [updatedSet] = await db('sets')
      .where('id', setId)
      .update({
        started_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning(['id', 'started_at', 'updated_at']);

    logger.info('Set started', {
      setId: updatedSet.id,
      startedAt: updatedSet.started_at,
      userId: req.user.id,
      requestId: req.requestId
    });

    res.json({
      message: 'Set started successfully',
      set: {
        id: updatedSet.id,
        startedAt: updatedSet.started_at,
        updatedAt: updatedSet.updated_at
      }
    });
  })
);

// Helper function to update workout total volume
async function updateWorkoutVolume(workoutId) {
  try {
    const volumeResult = await db('sets')
      .where('workout_id', workoutId)
      .whereNotNull('weight_kg')
      .whereNotNull('reps')
      .sum(db.raw('weight_kg * reps as total_volume'));

    const totalVolume = volumeResult[0]?.total_volume || 0;

    await db('workouts')
      .where('id', workoutId)
      .update({
        total_volume_kg: totalVolume,
        updated_at: db.fn.now()
      });

  } catch (error) {
    logger.error('Failed to update workout volume', {
      workoutId,
      error: error.message
    });
  }
}

module.exports = router;