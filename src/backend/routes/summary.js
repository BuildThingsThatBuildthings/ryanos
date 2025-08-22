const express = require('express');
const { db } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../validators/validate');
const { summaryQuerySchema } = require('../validators/schemas');
const logger = require('../config/logger');

const router = express.Router();

// Get 7-day training summary
router.get('/7d',
  validate(summaryQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const {
      days = 7,
      includePatterns = true,
      includeMuscleGroups = true,
      includeFlags = true
    } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Base workout data
    const workouts = await db('workouts as w')
      .select([
        'w.id', 'w.name', 'w.workout_date', 'w.workout_type',
        'w.focus', 'w.status', 'w.actual_duration_minutes',
        'w.overall_rpe', 'w.total_volume_kg', 'w.source'
      ])
      .where('w.user_id', req.user.id)
      .whereBetween('w.workout_date', [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]])
      .orderBy('w.workout_date', 'desc');

    // Get sets data with exercise information
    const setsData = await db('sets as s')
      .join('workouts as w', 's.workout_id', 'w.id')
      .join('exercises as e', 's.exercise_id', 'e.id')
      .select([
        's.id', 's.workout_id', 's.reps', 's.weight_kg', 's.rpe',
        's.is_completed', 's.duration_seconds', 's.distance_m',
        'w.workout_date', 'w.workout_type', 'w.focus',
        'e.name as exercise_name', 'e.category', 'e.muscle_groups'
      ])
      .where('w.user_id', req.user.id)
      .where('s.is_completed', true)
      .whereBetween('w.workout_date', [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]])
      .orderBy('w.workout_date', 'desc');

    // Calculate basic metrics
    const summary = {
      period: {
        days,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      overview: calculateOverview(workouts, setsData),
      dailyBreakdown: calculateDailyBreakdown(workouts, setsData, days),
      trainingLoad: calculateTrainingLoad(workouts, setsData),
      volumeMetrics: calculateVolumeMetrics(setsData),
      workoutTypes: calculateWorkoutTypeDistribution(workouts)
    };

    // Add optional analyses
    if (includePatterns) {
      summary.patterns = await analyzeTrainingPatterns(req.user.id, workouts, setsData);
    }

    if (includeMuscleGroups) {
      summary.muscleGroupAnalysis = analyzeMuscleGroups(setsData);
    }

    if (includeFlags) {
      summary.flags = await generateFlags(req.user.id, workouts, setsData, days);
    }

    logger.info('Training summary generated', {
      userId: req.user.id,
      days,
      workoutCount: workouts.length,
      completedSets: setsData.length,
      requestId: req.requestId
    });

    res.json({
      summary,
      generatedAt: new Date().toISOString()
    });
  })
);

// Calculate overview metrics
function calculateOverview(workouts, setsData) {
  const completedWorkouts = workouts.filter(w => w.status === 'completed');
  const totalVolume = setsData.reduce((sum, set) => {
    return sum + ((set.weight_kg || 0) * (set.reps || 0));
  }, 0);

  const avgRpe = setsData.length > 0 ? 
    setsData.filter(s => s.rpe).reduce((sum, s) => sum + s.rpe, 0) / setsData.filter(s => s.rpe).length : 0;

  const totalDuration = completedWorkouts.reduce((sum, w) => sum + (w.actual_duration_minutes || 0), 0);

  return {
    totalWorkouts: workouts.length,
    completedWorkouts: completedWorkouts.length,
    completionRate: workouts.length > 0 ? (completedWorkouts.length / workouts.length * 100).toFixed(1) : 0,
    totalSets: setsData.length,
    totalVolumeKg: Math.round(totalVolume),
    averageRpe: avgRpe > 0 ? avgRpe.toFixed(1) : null,
    totalDurationMinutes: totalDuration,
    averageWorkoutDuration: completedWorkouts.length > 0 ? Math.round(totalDuration / completedWorkouts.length) : 0
  };
}

// Calculate daily breakdown
function calculateDailyBreakdown(workouts, setsData, days) {
  const dailyData = {};
  
  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    dailyData[dateStr] = {
      date: dateStr,
      workouts: 0,
      completedWorkouts: 0,
      sets: 0,
      volumeKg: 0,
      avgRpe: null,
      durationMinutes: 0
    };
  }

  // Populate with workout data
  workouts.forEach(workout => {
    const date = workout.workout_date;
    if (dailyData[date]) {
      dailyData[date].workouts += 1;
      if (workout.status === 'completed') {
        dailyData[date].completedWorkouts += 1;
        dailyData[date].durationMinutes += workout.actual_duration_minutes || 0;
      }
    }
  });

  // Populate with sets data
  const setsByDate = {};
  setsData.forEach(set => {
    const date = set.workout_date;
    if (!setsByDate[date]) setsByDate[date] = [];
    setsByDate[date].push(set);
  });

  Object.keys(setsByDate).forEach(date => {
    if (dailyData[date]) {
      const daySets = setsByDate[date];
      dailyData[date].sets = daySets.length;
      dailyData[date].volumeKg = daySets.reduce((sum, set) => {
        return sum + ((set.weight_kg || 0) * (set.reps || 0));
      }, 0);
      
      const rpeValues = daySets.filter(s => s.rpe).map(s => s.rpe);
      dailyData[date].avgRpe = rpeValues.length > 0 ? 
        (rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length).toFixed(1) : null;
    }
  });

  return Object.values(dailyData).sort((a, b) => b.date.localeCompare(a.date));
}

// Calculate training load metrics
function calculateTrainingLoad(workouts, setsData) {
  // RPE-based training load calculation
  const rpeLoad = setsData.reduce((sum, set) => {
    if (set.rpe && set.reps) {
      return sum + (set.rpe * set.reps);
    }
    return sum;
  }, 0);

  // Volume load (weight * reps)
  const volumeLoad = setsData.reduce((sum, set) => {
    return sum + ((set.weight_kg || 0) * (set.reps || 0));
  }, 0);

  // Time-based load
  const timeLoad = workouts
    .filter(w => w.status === 'completed')
    .reduce((sum, w) => sum + (w.actual_duration_minutes || 0), 0);

  return {
    rpeBasedLoad: Math.round(rpeLoad),
    volumeBasedLoad: Math.round(volumeLoad),
    timeBasedLoad: timeLoad,
    composite: Math.round((rpeLoad * 0.4) + (volumeLoad * 0.0001) + (timeLoad * 0.6))
  };
}

// Calculate volume metrics
function calculateVolumeMetrics(setsData) {
  const exerciseVolumes = {};
  const categoryVolumes = {};

  setsData.forEach(set => {
    const volume = (set.weight_kg || 0) * (set.reps || 0);
    
    // By exercise
    if (!exerciseVolumes[set.exercise_name]) {
      exerciseVolumes[set.exercise_name] = { volume: 0, sets: 0 };
    }
    exerciseVolumes[set.exercise_name].volume += volume;
    exerciseVolumes[set.exercise_name].sets += 1;

    // By category
    if (!categoryVolumes[set.category]) {
      categoryVolumes[set.category] = { volume: 0, sets: 0 };
    }
    categoryVolumes[set.category].volume += volume;
    categoryVolumes[set.category].sets += 1;
  });

  // Sort by volume
  const topExercises = Object.entries(exerciseVolumes)
    .sort((a, b) => b[1].volume - a[1].volume)
    .slice(0, 10)
    .map(([name, data]) => ({
      exercise: name,
      volumeKg: Math.round(data.volume),
      sets: data.sets
    }));

  const categoriesRanked = Object.entries(categoryVolumes)
    .sort((a, b) => b[1].volume - a[1].volume)
    .map(([category, data]) => ({
      category,
      volumeKg: Math.round(data.volume),
      sets: data.sets
    }));

  return {
    topExercises,
    byCategory: categoriesRanked
  };
}

// Calculate workout type distribution
function calculateWorkoutTypeDistribution(workouts) {
  const distribution = {};
  
  workouts.forEach(workout => {
    const type = workout.workout_type || 'unknown';
    if (!distribution[type]) {
      distribution[type] = { count: 0, completed: 0 };
    }
    distribution[type].count += 1;
    if (workout.status === 'completed') {
      distribution[type].completed += 1;
    }
  });

  return Object.entries(distribution).map(([type, data]) => ({
    type,
    count: data.count,
    completed: data.completed,
    completionRate: data.count > 0 ? ((data.completed / data.count) * 100).toFixed(1) : 0
  }));
}

// Analyze muscle groups
function analyzeMuscleGroups(setsData) {
  const muscleGroupData = {};

  setsData.forEach(set => {
    const muscleGroups = set.muscle_groups || [];
    const volume = (set.weight_kg || 0) * (set.reps || 0);

    muscleGroups.forEach(muscle => {
      if (!muscleGroupData[muscle]) {
        muscleGroupData[muscle] = { 
          sets: 0, 
          volumeKg: 0, 
          exercises: new Set(),
          avgRpe: [],
          workouts: new Set()
        };
      }
      
      muscleGroupData[muscle].sets += 1;
      muscleGroupData[muscle].volumeKg += volume;
      muscleGroupData[muscle].exercises.add(set.exercise_name);
      muscleGroupData[muscle].workouts.add(set.workout_id);
      
      if (set.rpe) {
        muscleGroupData[muscle].avgRpe.push(set.rpe);
      }
    });
  });

  return Object.entries(muscleGroupData)
    .map(([muscle, data]) => ({
      muscleGroup: muscle,
      sets: data.sets,
      volumeKg: Math.round(data.volumeKg),
      exercises: data.exercises.size,
      workouts: data.workouts.size,
      avgRpe: data.avgRpe.length > 0 ? 
        (data.avgRpe.reduce((sum, rpe) => sum + rpe, 0) / data.avgRpe.length).toFixed(1) : null
    }))
    .sort((a, b) => b.volumeKg - a.volumeKg);
}

// Analyze training patterns
async function analyzeTrainingPatterns(userId, workouts, setsData) {
  const patterns = {
    frequency: analyzeFrequency(workouts),
    consistency: analyzeConsistency(workouts),
    progression: await analyzeProgression(userId, setsData),
    balance: analyzeBalance(setsData)
  };

  return patterns;
}

function analyzeFrequency(workouts) {
  const completedWorkouts = workouts.filter(w => w.status === 'completed');
  const workoutDates = completedWorkouts.map(w => new Date(w.workout_date));
  
  if (workoutDates.length < 2) {
    return { averageDaysBetween: null, pattern: 'insufficient_data' };
  }

  workoutDates.sort((a, b) => a - b);
  const intervals = [];
  
  for (let i = 1; i < workoutDates.length; i++) {
    const daysDiff = Math.floor((workoutDates[i] - workoutDates[i-1]) / (1000 * 60 * 60 * 24));
    intervals.push(daysDiff);
  }

  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  
  let pattern = 'irregular';
  if (avgInterval <= 1.5) pattern = 'daily';
  else if (avgInterval <= 2.5) pattern = 'every_other_day';
  else if (avgInterval <= 3.5) pattern = 'three_times_week';
  else if (avgInterval <= 4.5) pattern = 'twice_week';
  else if (avgInterval <= 7) pattern = 'weekly';

  return {
    averageDaysBetween: avgInterval.toFixed(1),
    pattern,
    totalWorkouts: completedWorkouts.length
  };
}

function analyzeConsistency(workouts) {
  const completedWorkouts = workouts.filter(w => w.status === 'completed');
  const plannedWorkouts = workouts.filter(w => w.status === 'planned');
  const skippedWorkouts = workouts.filter(w => w.status === 'skipped');

  const consistencyScore = workouts.length > 0 ? 
    ((completedWorkouts.length / workouts.length) * 100) : 0;

  let level = 'poor';
  if (consistencyScore >= 80) level = 'excellent';
  else if (consistencyScore >= 60) level = 'good';
  else if (consistencyScore >= 40) level = 'fair';

  return {
    score: consistencyScore.toFixed(1),
    level,
    completed: completedWorkouts.length,
    planned: plannedWorkouts.length,
    skipped: skippedWorkouts.length
  };
}

async function analyzeProgression(userId, setsData) {
  // Look at top exercises and check for progression
  const exerciseData = {};
  
  setsData.forEach(set => {
    if (!exerciseData[set.exercise_name]) {
      exerciseData[set.exercise_name] = [];
    }
    
    exerciseData[set.exercise_name].push({
      date: set.workout_date,
      weight: set.weight_kg || 0,
      reps: set.reps || 0,
      volume: (set.weight_kg || 0) * (set.reps || 0)
    });
  });

  const progressions = [];

  Object.entries(exerciseData).forEach(([exercise, sets]) => {
    if (sets.length < 2) return;

    sets.sort((a, b) => a.date.localeCompare(b.date));
    
    const firstSet = sets[0];
    const lastSet = sets[sets.length - 1];
    
    const weightProgression = lastSet.weight - firstSet.weight;
    const volumeProgression = lastSet.volume - firstSet.volume;
    
    if (Math.abs(weightProgression) > 0.1 || Math.abs(volumeProgression) > 1) {
      progressions.push({
        exercise,
        weightChange: weightProgression.toFixed(1),
        volumeChange: Math.round(volumeProgression),
        sessions: sets.length,
        trend: weightProgression > 0 ? 'increasing' : weightProgression < 0 ? 'decreasing' : 'stable'
      });
    }
  });

  return progressions.sort((a, b) => Math.abs(b.weightChange) - Math.abs(a.weightChange)).slice(0, 5);
}

function analyzeBalance(setsData) {
  const categories = {};
  
  setsData.forEach(set => {
    const category = set.category || 'unknown';
    if (!categories[category]) {
      categories[category] = 0;
    }
    categories[category] += 1;
  });

  const total = Object.values(categories).reduce((sum, count) => sum + count, 0);
  
  return Object.entries(categories).map(([category, count]) => ({
    category,
    sets: count,
    percentage: total > 0 ? ((count / total) * 100).toFixed(1) : 0
  }));
}

// Generate training flags
async function generateFlags(userId, workouts, setsData, days) {
  const flags = [];

  // Low activity flag
  const completedWorkouts = workouts.filter(w => w.status === 'completed');
  if (completedWorkouts.length < Math.floor(days / 3)) {
    flags.push({
      type: 'warning',
      category: 'activity',
      message: 'Low training frequency detected',
      suggestion: 'Consider increasing workout frequency for better results'
    });
  }

  // High RPE flag
  const highRpeSets = setsData.filter(s => s.rpe && s.rpe >= 8.5);
  if (highRpeSets.length > setsData.length * 0.6) {
    flags.push({
      type: 'caution',
      category: 'intensity',
      message: 'High intensity training detected',
      suggestion: 'Consider incorporating more recovery and moderate intensity work'
    });
  }

  // Muscle group imbalance
  const muscleAnalysis = analyzeMuscleGroups(setsData);
  if (muscleAnalysis.length > 0) {
    const topMuscle = muscleAnalysis[0];
    const totalVolume = muscleAnalysis.reduce((sum, m) => sum + m.volumeKg, 0);
    
    if (topMuscle.volumeKg > totalVolume * 0.4) {
      flags.push({
        type: 'info',
        category: 'balance',
        message: `High focus on ${topMuscle.muscleGroup} detected`,
        suggestion: 'Consider balancing with opposing muscle groups'
      });
    }
  }

  // Consistency flag
  const skippedRate = workouts.length > 0 ? 
    (workouts.filter(w => w.status === 'skipped').length / workouts.length) : 0;
  
  if (skippedRate > 0.3) {
    flags.push({
      type: 'warning',
      category: 'consistency',
      message: 'High workout skip rate detected',
      suggestion: 'Review your schedule and set more realistic workout plans'
    });
  }

  return flags;
}

module.exports = router;