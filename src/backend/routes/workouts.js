const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate, validateMultiple, sanitize } = require('../validators/validate');
const { 
  workoutSchema, 
  workoutUpdateSchema, 
  workoutGenerateSchema,
  workoutFilterSchema
} = require('../validators/schemas');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const llmService = require('../services/llmService');
const logger = require('../config/logger');

const router = express.Router();

// Create new workout (manual)
router.post('/',
  sanitize(),
  validate(workoutSchema),
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      workoutDate,
      timeCapMinutes,
      focus,
      exclusions,
      workoutType,
      notes,
      tags,
      source = 'manual'
    } = req.body;

    const workoutData = {
      id: uuidv4(),
      user_id: req.user.id,
      name: name || `Workout - ${workoutDate}`,
      description,
      workout_date: workoutDate,
      time_cap_minutes: timeCapMinutes,
      focus,
      exclusions: exclusions ? JSON.stringify(exclusions) : null,
      workout_type: workoutType || 'strength',
      status: 'planned',
      source,
      notes,
      tags: tags ? JSON.stringify(tags) : null
    };

    const [workout] = await db('workouts')
      .insert(workoutData)
      .returning([
        'id', 'user_id', 'name', 'description', 'workout_date',
        'time_cap_minutes', 'focus', 'exclusions', 'workout_type',
        'status', 'source', 'notes', 'tags', 'created_at'
      ]);

    logger.info('Workout created', {
      workoutId: workout.id,
      userId: req.user.id,
      workoutDate: workout.workout_date,
      source: workout.source,
      requestId: req.requestId
    });

    res.status(201).json({
      message: 'Workout created successfully',
      workout: {
        id: workout.id,
        name: workout.name,
        description: workout.description,
        workoutDate: workout.workout_date,
        timeCapMinutes: workout.time_cap_minutes,
        focus: workout.focus,
        exclusions: workout.exclusions ? JSON.parse(workout.exclusions) : null,
        workoutType: workout.workout_type,
        status: workout.status,
        source: workout.source,
        notes: workout.notes,
        tags: workout.tags ? JSON.parse(workout.tags) : null,
        createdAt: workout.created_at
      }
    });
  })
);

// Generate workout with LLM
router.post('/generate',
  sanitize(),
  validate(workoutGenerateSchema),
  asyncHandler(async (req, res) => {
    const {
      date,
      timeCapMin,
      focus,
      exclusions,
      workoutType,
      difficultyLevel,
      equipment,
      goals
    } = req.body;

    // Get user profile for better generation
    const userProfile = await db('users')
      .select(['height_cm', 'weight_kg', 'units_preference'])
      .where('id', req.user.id)
      .first();

    // Generate workout with LLM
    const generatedWorkout = await llmService.generateWorkout({
      date,
      timeCapMin,
      focus,
      exclusions,
      workoutType,
      difficultyLevel,
      equipment,
      goals,
      userProfile: {
        heightCm: userProfile.height_cm,
        weightKg: userProfile.weight_kg,
        unitsPreference: userProfile.units_preference
      }
    });

    // Create workout in database
    const workoutData = {
      id: uuidv4(),
      user_id: req.user.id,
      name: generatedWorkout.workout.name,
      description: generatedWorkout.workout.description,
      workout_date: date,
      time_cap_minutes: timeCapMin,
      focus,
      exclusions: exclusions ? JSON.stringify(exclusions) : null,
      workout_type: workoutType || 'strength',
      status: 'planned',
      source: 'llm_generated',
      llm_generation_params: JSON.stringify({
        timeCapMin,
        focus,
        exclusions,
        workoutType,
        difficultyLevel,
        equipment,
        goals
      })
    };

    const [workout] = await db('workouts')
      .insert(workoutData)
      .returning([
        'id', 'name', 'description', 'workout_date',
        'time_cap_minutes', 'focus', 'exclusions', 'workout_type',
        'status', 'source', 'llm_generation_params', 'created_at'
      ]);

    logger.info('LLM workout generated and saved', {
      workoutId: workout.id,
      userId: req.user.id,
      workoutDate: workout.workout_date,
      timeCapMin,
      focus,
      requestId: req.requestId
    });

    res.status(201).json({
      message: 'Workout generated successfully',
      workout: {
        id: workout.id,
        name: workout.name,
        description: workout.description,
        workoutDate: workout.workout_date,
        timeCapMinutes: workout.time_cap_minutes,
        focus: workout.focus,
        exclusions: workout.exclusions ? JSON.parse(workout.exclusions) : null,
        workoutType: workout.workout_type,
        status: workout.status,
        source: workout.source,
        llmGenerationParams: workout.llm_generation_params ? JSON.parse(workout.llm_generation_params) : null,
        createdAt: workout.created_at
      },
      generatedPlan: {
        warmup: generatedWorkout.warmup,
        exercises: generatedWorkout.exercises,
        cooldown: generatedWorkout.cooldown,
        estimatedDuration: generatedWorkout.workout.estimatedDuration
      }
    });
  })
);

// Get user's workouts with filtering and pagination
router.get('/',
  validate(workoutFilterSchema, 'query'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      sortBy = 'workout_date',
      sortOrder = 'desc',
      status,
      workoutType,
      focus,
      source,
      startDate,
      endDate
    } = req.query;

    const offset = (page - 1) * limit;

    let query = db('workouts')
      .select([
        'id', 'name', 'description', 'workout_date', 'time_cap_minutes',
        'actual_duration_minutes', 'focus', 'exclusions', 'workout_type',
        'status', 'source', 'notes', 'tags', 'overall_rpe',
        'total_volume_kg', 'started_at', 'completed_at', 'created_at'
      ])
      .where('user_id', req.user.id)
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset(offset);

    // Apply filters
    if (status) query = query.where('status', status);
    if (workoutType) query = query.where('workout_type', workoutType);
    if (focus) query = query.where('focus', 'like', `%${focus}%`);
    if (source) query = query.where('source', source);
    if (startDate) query = query.where('workout_date', '>=', startDate);
    if (endDate) query = query.where('workout_date', '<=', endDate);

    const workouts = await query;

    // Get total count
    let countQuery = db('workouts')
      .where('user_id', req.user.id)
      .count('* as count');

    if (status) countQuery = countQuery.where('status', status);
    if (workoutType) countQuery = countQuery.where('workout_type', workoutType);
    if (focus) countQuery = countQuery.where('focus', 'like', `%${focus}%`);
    if (source) countQuery = countQuery.where('source', source);
    if (startDate) countQuery = countQuery.where('workout_date', '>=', startDate);
    if (endDate) countQuery = countQuery.where('workout_date', '<=', endDate);

    const [{ count }] = await countQuery;

    res.json({
      workouts: workouts.map(workout => ({
        id: workout.id,
        name: workout.name,
        description: workout.description,
        workoutDate: workout.workout_date,
        timeCapMinutes: workout.time_cap_minutes,
        actualDurationMinutes: workout.actual_duration_minutes,
        focus: workout.focus,
        exclusions: workout.exclusions ? JSON.parse(workout.exclusions) : null,
        workoutType: workout.workout_type,
        status: workout.status,
        source: workout.source,
        notes: workout.notes,
        tags: workout.tags ? JSON.parse(workout.tags) : null,
        overallRpe: workout.overall_rpe,
        totalVolumeKg: workout.total_volume_kg,
        startedAt: workout.started_at,
        completedAt: workout.completed_at,
        createdAt: workout.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        totalPages: Math.ceil(count / limit)
      }
    });
  })
);

// Get workout by ID
router.get('/:id',
  asyncHandler(async (req, res) => {
    const workoutId = req.params.id;

    const workout = await db('workouts')
      .select([
        'id', 'name', 'description', 'workout_date', 'time_cap_minutes',
        'actual_duration_minutes', 'focus', 'exclusions', 'workout_type',
        'status', 'source', 'notes', 'tags', 'overall_rpe',
        'total_volume_kg', 'started_at', 'completed_at',
        'llm_generation_params', 'voice_session_id', 'created_at', 'updated_at'
      ])
      .where('id', workoutId)
      .where('user_id', req.user.id)
      .first();

    if (!workout) {
      throw new NotFoundError('Workout not found');
    }

    // Get workout sets with exercise details
    const sets = await db('sets as s')
      .join('exercises as e', 's.exercise_id', 'e.id')
      .select([
        's.id', 's.set_number', 's.reps', 's.weight_kg', 's.distance_m',
        's.duration_seconds', 's.rpe', 's.rest_seconds', 's.tempo',
        's.notes', 's.is_warmup', 's.is_completed', 's.started_at',
        's.completed_at', 's.additional_metrics', 's.created_at',
        'e.name as exercise_name', 'e.category as exercise_category',
        'e.muscle_groups', 'e.equipment_needed'
      ])
      .where('s.workout_id', workoutId)
      .orderBy('s.set_number', 'asc');

    res.json({
      workout: {
        id: workout.id,
        name: workout.name,
        description: workout.description,
        workoutDate: workout.workout_date,
        timeCapMinutes: workout.time_cap_minutes,
        actualDurationMinutes: workout.actual_duration_minutes,
        focus: workout.focus,
        exclusions: workout.exclusions ? JSON.parse(workout.exclusions) : null,
        workoutType: workout.workout_type,
        status: workout.status,
        source: workout.source,
        notes: workout.notes,
        tags: workout.tags ? JSON.parse(workout.tags) : null,
        overallRpe: workout.overall_rpe,
        totalVolumeKg: workout.total_volume_kg,
        startedAt: workout.started_at,
        completedAt: workout.completed_at,
        llmGenerationParams: workout.llm_generation_params ? 
          JSON.parse(workout.llm_generation_params) : null,
        voiceSessionId: workout.voice_session_id,
        createdAt: workout.created_at,
        updatedAt: workout.updated_at
      },
      sets: sets.map(set => ({
        id: set.id,
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
        additionalMetrics: set.additional_metrics,
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

// Update workout
router.patch('/:id',
  sanitize(),
  validate(workoutUpdateSchema),
  asyncHandler(async (req, res) => {
    const workoutId = req.params.id;

    // Check if workout exists and belongs to user
    const existingWorkout = await db('workouts')
      .select(['id', 'status'])
      .where('id', workoutId)
      .where('user_id', req.user.id)
      .first();

    if (!existingWorkout) {
      throw new NotFoundError('Workout not found');
    }

    const updates = {};
    
    // Map camelCase to snake_case and handle updates
    if (req.body.name) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.timeCapMinutes) updates.time_cap_minutes = req.body.timeCapMinutes;
    if (req.body.focus) updates.focus = req.body.focus;
    if (req.body.exclusions) updates.exclusions = JSON.stringify(req.body.exclusions);
    if (req.body.workoutType) updates.workout_type = req.body.workoutType;
    if (req.body.status) updates.status = req.body.status;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.tags) updates.tags = JSON.stringify(req.body.tags);
    if (req.body.overallRpe) updates.overall_rpe = req.body.overallRpe;
    if (req.body.actualDurationMinutes) updates.actual_duration_minutes = req.body.actualDurationMinutes;

    // Handle status-specific updates
    if (req.body.status === 'in_progress' && existingWorkout.status === 'planned') {
      updates.started_at = db.fn.now();
    }
    
    if (req.body.status === 'completed' && existingWorkout.status !== 'completed') {
      updates.completed_at = db.fn.now();
    }

    updates.updated_at = db.fn.now();

    const [updatedWorkout] = await db('workouts')
      .where('id', workoutId)
      .update(updates)
      .returning([
        'id', 'name', 'description', 'workout_date', 'time_cap_minutes',
        'actual_duration_minutes', 'focus', 'exclusions', 'workout_type',
        'status', 'notes', 'tags', 'overall_rpe', 'started_at',
        'completed_at', 'updated_at'
      ]);

    logger.info('Workout updated', {
      workoutId: updatedWorkout.id,
      userId: req.user.id,
      updatedFields: Object.keys(updates),
      newStatus: updatedWorkout.status,
      requestId: req.requestId
    });

    res.json({
      message: 'Workout updated successfully',
      workout: {
        id: updatedWorkout.id,
        name: updatedWorkout.name,
        description: updatedWorkout.description,
        workoutDate: updatedWorkout.workout_date,
        timeCapMinutes: updatedWorkout.time_cap_minutes,
        actualDurationMinutes: updatedWorkout.actual_duration_minutes,
        focus: updatedWorkout.focus,
        exclusions: updatedWorkout.exclusions ? JSON.parse(updatedWorkout.exclusions) : null,
        workoutType: updatedWorkout.workout_type,
        status: updatedWorkout.status,
        notes: updatedWorkout.notes,
        tags: updatedWorkout.tags ? JSON.parse(updatedWorkout.tags) : null,
        overallRpe: updatedWorkout.overall_rpe,
        startedAt: updatedWorkout.started_at,
        completedAt: updatedWorkout.completed_at,
        updatedAt: updatedWorkout.updated_at
      }
    });
  })
);

// Delete workout
router.delete('/:id',
  asyncHandler(async (req, res) => {
    const workoutId = req.params.id;

    // Check if workout exists and belongs to user
    const workout = await db('workouts')
      .select(['id'])
      .where('id', workoutId)
      .where('user_id', req.user.id)
      .first();

    if (!workout) {
      throw new NotFoundError('Workout not found');
    }

    // Delete workout (sets will be cascade deleted)
    await db('workouts')
      .where('id', workoutId)
      .del();

    logger.info('Workout deleted', {
      workoutId,
      userId: req.user.id,
      requestId: req.requestId
    });

    res.json({
      message: 'Workout deleted successfully'
    });
  })
);

module.exports = router;