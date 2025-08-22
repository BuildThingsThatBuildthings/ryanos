const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate, sanitize } = require('../validators/validate');
const { 
  exerciseSchema, 
  exerciseUpdateSchema, 
  exerciseSuggestSchema,
  exerciseFilterSchema 
} = require('../validators/schemas');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const llmService = require('../services/llmService');
const logger = require('../config/logger');

const router = express.Router();

// Get exercises (public endpoint with optional auth)
router.get('/',
  validate(exerciseFilterSchema, 'query'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
      category,
      muscleGroup,
      difficultyLevel,
      equipment,
      search,
      isActive = true
    } = req.query;

    const offset = (page - 1) * limit;

    let query = db('exercises')
      .select([
        'id', 'name', 'description', 'category', 'muscle_groups',
        'equipment_needed', 'difficulty_level', 'instructions',
        'video_url', 'variations', 'is_custom', 'created_by', 'created_at'
      ])
      .where('is_active', isActive)
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset(offset);

    // Apply filters
    if (category) {
      query = query.where('category', 'like', `%${category}%`);
    }

    if (muscleGroup) {
      query = query.whereRaw('JSON_SEARCH(muscle_groups, "one", ?) IS NOT NULL', [`%${muscleGroup}%`]);
    }

    if (difficultyLevel) {
      query = query.where('difficulty_level', difficultyLevel);
    }

    if (equipment) {
      query = query.whereRaw('JSON_SEARCH(equipment_needed, "one", ?) IS NOT NULL', [`%${equipment}%`]);
    }

    if (search) {
      query = query.where(function() {
        this.where('name', 'like', `%${search}%`)
            .orWhere('description', 'like', `%${search}%`)
            .orWhere('category', 'like', `%${search}%`);
      });
    }

    // Filter out custom exercises from other users if not authenticated
    if (!req.user) {
      query = query.where('is_custom', false);
    } else {
      // Show public exercises and user's own custom exercises
      query = query.where(function() {
        this.where('is_custom', false)
            .orWhere('created_by', req.user.id);
      });
    }

    const exercises = await query;

    // Get total count with same filters
    let countQuery = db('exercises')
      .where('is_active', isActive)
      .count('* as count');

    if (category) {
      countQuery = countQuery.where('category', 'like', `%${category}%`);
    }
    if (muscleGroup) {
      countQuery = countQuery.whereRaw('JSON_SEARCH(muscle_groups, "one", ?) IS NOT NULL', [`%${muscleGroup}%`]);
    }
    if (difficultyLevel) {
      countQuery = countQuery.where('difficulty_level', difficultyLevel);
    }
    if (equipment) {
      countQuery = countQuery.whereRaw('JSON_SEARCH(equipment_needed, "one", ?) IS NOT NULL', [`%${equipment}%`]);
    }
    if (search) {
      countQuery = countQuery.where(function() {
        this.where('name', 'like', `%${search}%`)
            .orWhere('description', 'like', `%${search}%`)
            .orWhere('category', 'like', `%${search}%`);
      });
    }

    if (!req.user) {
      countQuery = countQuery.where('is_custom', false);
    } else {
      countQuery = countQuery.where(function() {
        this.where('is_custom', false)
            .orWhere('created_by', req.user.id);
      });
    }

    const [{ count }] = await countQuery;

    res.json({
      exercises: exercises.map(exercise => ({
        id: exercise.id,
        name: exercise.name,
        description: exercise.description,
        category: exercise.category,
        muscleGroups: exercise.muscle_groups,
        equipmentNeeded: exercise.equipment_needed,
        difficultyLevel: exercise.difficulty_level,
        instructions: exercise.instructions,
        videoUrl: exercise.video_url,
        variations: exercise.variations,
        isCustom: exercise.is_custom,
        createdBy: exercise.created_by,
        createdAt: exercise.created_at
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

// Get exercise by ID
router.get('/:id',
  asyncHandler(async (req, res) => {
    const exerciseId = req.params.id;

    let query = db('exercises')
      .select([
        'id', 'name', 'description', 'category', 'muscle_groups',
        'equipment_needed', 'difficulty_level', 'instructions',
        'video_url', 'variations', 'is_custom', 'created_by', 
        'created_at', 'updated_at'
      ])
      .where('id', exerciseId)
      .where('is_active', true);

    // Apply visibility rules
    if (!req.user) {
      query = query.where('is_custom', false);
    } else {
      query = query.where(function() {
        this.where('is_custom', false)
            .orWhere('created_by', req.user.id);
      });
    }

    const exercise = await query.first();

    if (!exercise) {
      throw new NotFoundError('Exercise not found');
    }

    // Get usage statistics if user is authenticated
    let usageStats = null;
    if (req.user) {
      const stats = await db('sets as s')
        .join('workouts as w', 's.workout_id', 'w.id')
        .select([
          db.raw('COUNT(*) as total_sets'),
          db.raw('COUNT(DISTINCT w.id) as total_workouts'),
          db.raw('AVG(s.rpe) as avg_rpe'),
          db.raw('MAX(s.weight_kg) as max_weight'),
          db.raw('MAX(s.created_at) as last_used')
        ])
        .where('s.exercise_id', exerciseId)
        .where('w.user_id', req.user.id)
        .first();

      usageStats = {
        totalSets: parseInt(stats.total_sets) || 0,
        totalWorkouts: parseInt(stats.total_workouts) || 0,
        avgRpe: stats.avg_rpe ? parseFloat(stats.avg_rpe).toFixed(1) : null,
        maxWeight: stats.max_weight ? parseFloat(stats.max_weight) : null,
        lastUsed: stats.last_used
      };
    }

    res.json({
      exercise: {
        id: exercise.id,
        name: exercise.name,
        description: exercise.description,
        category: exercise.category,
        muscleGroups: exercise.muscle_groups,
        equipmentNeeded: exercise.equipment_needed,
        difficultyLevel: exercise.difficulty_level,
        instructions: exercise.instructions,
        videoUrl: exercise.video_url,
        variations: exercise.variations,
        isCustom: exercise.is_custom,
        createdBy: exercise.created_by,
        createdAt: exercise.created_at,
        updatedAt: exercise.updated_at
      },
      usageStats
    });
  })
);

// Create custom exercise (authenticated users only)
router.post('/',
  sanitize(),
  validate(exerciseSchema),
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      category,
      muscleGroups,
      equipmentNeeded,
      difficultyLevel,
      instructions,
      videoUrl,
      variations
    } = req.body;

    // Check for duplicate name (case-insensitive)
    const existingExercise = await db('exercises')
      .whereRaw('LOWER(name) = ?', [name.toLowerCase()])
      .where('is_active', true)
      .where(function() {
        this.where('is_custom', false)
            .orWhere('created_by', req.user.id);
      })
      .first();

    if (existingExercise) {
      throw new ValidationError('Exercise with this name already exists');
    }

    const exerciseData = {
      id: uuidv4(),
      name,
      description,
      category,
      muscle_groups: JSON.stringify(muscleGroups),
      equipment_needed: equipmentNeeded ? JSON.stringify(equipmentNeeded) : null,
      difficulty_level: difficultyLevel,
      instructions,
      video_url: videoUrl,
      variations: variations ? JSON.stringify(variations) : null,
      is_custom: true,
      created_by: req.user.id
    };

    const [exercise] = await db('exercises')
      .insert(exerciseData)
      .returning([
        'id', 'name', 'description', 'category', 'muscle_groups',
        'equipment_needed', 'difficulty_level', 'instructions',
        'video_url', 'variations', 'is_custom', 'created_by', 'created_at'
      ]);

    logger.info('Custom exercise created', {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      userId: req.user.id,
      requestId: req.requestId
    });

    res.status(201).json({
      message: 'Exercise created successfully',
      exercise: {
        id: exercise.id,
        name: exercise.name,
        description: exercise.description,
        category: exercise.category,
        muscleGroups: JSON.parse(exercise.muscle_groups),
        equipmentNeeded: exercise.equipment_needed ? JSON.parse(exercise.equipment_needed) : null,
        difficultyLevel: exercise.difficulty_level,
        instructions: exercise.instructions,
        videoUrl: exercise.video_url,
        variations: exercise.variations ? JSON.parse(exercise.variations) : null,
        isCustom: exercise.is_custom,
        createdBy: exercise.created_by,
        createdAt: exercise.created_at
      }
    });
  })
);

// Update custom exercise (creator only)
router.patch('/:id',
  sanitize(),
  validate(exerciseUpdateSchema),
  asyncHandler(async (req, res) => {
    const exerciseId = req.params.id;

    // Verify exercise exists and user can edit it
    const exercise = await db('exercises')
      .select(['id', 'is_custom', 'created_by', 'name'])
      .where('id', exerciseId)
      .where('is_active', true)
      .first();

    if (!exercise) {
      throw new NotFoundError('Exercise not found');
    }

    if (!exercise.is_custom || exercise.created_by !== req.user.id) {
      throw new ValidationError('You can only edit your own custom exercises');
    }

    const updates = {};

    // Map and validate updates
    if (req.body.name) {
      // Check for duplicate name (excluding current exercise)
      const existingExercise = await db('exercises')
        .whereRaw('LOWER(name) = ?', [req.body.name.toLowerCase()])
        .where('is_active', true)
        .whereNot('id', exerciseId)
        .where(function() {
          this.where('is_custom', false)
              .orWhere('created_by', req.user.id);
        })
        .first();

      if (existingExercise) {
        throw new ValidationError('Exercise with this name already exists');
      }

      updates.name = req.body.name;
    }

    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.category) updates.category = req.body.category;
    if (req.body.muscleGroups) updates.muscle_groups = JSON.stringify(req.body.muscleGroups);
    if (req.body.equipmentNeeded !== undefined) {
      updates.equipment_needed = req.body.equipmentNeeded ? 
        JSON.stringify(req.body.equipmentNeeded) : null;
    }
    if (req.body.difficultyLevel) updates.difficulty_level = req.body.difficultyLevel;
    if (req.body.instructions !== undefined) updates.instructions = req.body.instructions;
    if (req.body.videoUrl !== undefined) updates.video_url = req.body.videoUrl;
    if (req.body.variations !== undefined) {
      updates.variations = req.body.variations ? 
        JSON.stringify(req.body.variations) : null;
    }

    updates.updated_at = db.fn.now();

    const [updatedExercise] = await db('exercises')
      .where('id', exerciseId)
      .update(updates)
      .returning([
        'id', 'name', 'description', 'category', 'muscle_groups',
        'equipment_needed', 'difficulty_level', 'instructions',
        'video_url', 'variations', 'updated_at'
      ]);

    logger.info('Custom exercise updated', {
      exerciseId: updatedExercise.id,
      exerciseName: updatedExercise.name,
      userId: req.user.id,
      updatedFields: Object.keys(updates),
      requestId: req.requestId
    });

    res.json({
      message: 'Exercise updated successfully',
      exercise: {
        id: updatedExercise.id,
        name: updatedExercise.name,
        description: updatedExercise.description,
        category: updatedExercise.category,
        muscleGroups: JSON.parse(updatedExercise.muscle_groups),
        equipmentNeeded: updatedExercise.equipment_needed ? 
          JSON.parse(updatedExercise.equipment_needed) : null,
        difficultyLevel: updatedExercise.difficulty_level,
        instructions: updatedExercise.instructions,
        videoUrl: updatedExercise.video_url,
        variations: updatedExercise.variations ? 
          JSON.parse(updatedExercise.variations) : null,
        updatedAt: updatedExercise.updated_at
      }
    });
  })
);

// Delete custom exercise (creator only)
router.delete('/:id',
  asyncHandler(async (req, res) => {
    const exerciseId = req.params.id;

    // Verify exercise exists and user can delete it
    const exercise = await db('exercises')
      .select(['id', 'is_custom', 'created_by', 'name'])
      .where('id', exerciseId)
      .where('is_active', true)
      .first();

    if (!exercise) {
      throw new NotFoundError('Exercise not found');
    }

    if (!exercise.is_custom || exercise.created_by !== req.user.id) {
      throw new ValidationError('You can only delete your own custom exercises');
    }

    // Check if exercise is used in any sets
    const usageCount = await db('sets')
      .where('exercise_id', exerciseId)
      .count('* as count');

    if (parseInt(usageCount[0].count) > 0) {
      // Soft delete - mark as inactive
      await db('exercises')
        .where('id', exerciseId)
        .update({
          is_active: false,
          updated_at: db.fn.now()
        });

      logger.info('Custom exercise soft deleted (has usage)', {
        exerciseId,
        exerciseName: exercise.name,
        userId: req.user.id,
        requestId: req.requestId
      });

      res.json({
        message: 'Exercise deactivated successfully (cannot delete due to existing usage)',
        action: 'deactivated'
      });
    } else {
      // Hard delete - no usage
      await db('exercises')
        .where('id', exerciseId)
        .del();

      logger.info('Custom exercise deleted', {
        exerciseId,
        exerciseName: exercise.name,
        userId: req.user.id,
        requestId: req.requestId
      });

      res.json({
        message: 'Exercise deleted successfully',
        action: 'deleted'
      });
    }
  })
);

// Get exercise suggestions from LLM
router.post('/suggest',
  sanitize(),
  validate(exerciseSuggestSchema),
  asyncHandler(async (req, res) => {
    const {
      prompt,
      muscleGroups,
      equipment,
      difficultyLevel,
      maxSuggestions
    } = req.body;

    const suggestions = await llmService.suggestExercises({
      prompt,
      muscleGroups,
      equipment,
      difficultyLevel,
      maxSuggestions
    });

    logger.info('Exercise suggestions generated', {
      userId: req.user.id,
      prompt: prompt.substring(0, 100),
      suggestionsCount: suggestions.suggestions?.length || 0,
      requestId: req.requestId
    });

    res.json({
      message: 'Exercise suggestions generated successfully',
      prompt,
      suggestions: suggestions.suggestions || []
    });
  })
);

// Get exercise categories
router.get('/meta/categories',
  asyncHandler(async (req, res) => {
    const categories = await db('exercises')
      .distinct('category')
      .whereNotNull('category')
      .where('is_active', true)
      .orderBy('category', 'asc');

    res.json({
      categories: categories.map(row => row.category).filter(Boolean)
    });
  })
);

// Get muscle groups
router.get('/meta/muscle-groups',
  asyncHandler(async (req, res) => {
    const exercises = await db('exercises')
      .select('muscle_groups')
      .whereNotNull('muscle_groups')
      .where('is_active', true);

    const muscleGroups = new Set();
    exercises.forEach(exercise => {
      const groups = exercise.muscle_groups;
      if (groups && Array.isArray(groups)) {
        groups.forEach(group => muscleGroups.add(group));
      }
    });

    res.json({
      muscleGroups: Array.from(muscleGroups).sort()
    });
  })
);

module.exports = router;