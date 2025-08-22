import { createAuthenticatedHandler, createResponse, createErrorResponse, handleCors, supabase } from '../_shared/auth.ts';
import { handleDatabaseError } from '../_shared/utils.ts';
import type { Analytics7D, User, AuthenticatedRequest } from '../_shared/types.ts';

const handler = createAuthenticatedHandler(async (req: AuthenticatedRequest, user: User) => {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await get7DayAnalytics(user);
      
      default:
        return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only GET method is allowed');
    }
  } catch (error) {
    console.error('7-day summary handler error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

async function get7DayAnalytics(user: User): Promise<Response> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // Get workout sessions from the last 7 days
    const { data: sessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select(`
        id,
        workout_plan_id,
        started_at,
        completed_at,
        duration_minutes,
        calories_burned,
        status,
        workout_plans(
          title,
          difficulty_level,
          equipment_needed,
          exercises
        )
      `)
      .eq('user_id', user.id)
      .gte('started_at', sevenDaysAgoISO)
      .order('started_at', { ascending: false });

    if (sessionsError) {
      const dbError = handleDatabaseError(sessionsError);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    // Get workout logs from the last 7 days
    const { data: logs, error: logsError } = await supabase
      .from('workout_logs')
      .select(`
        exercise_id,
        sets_completed,
        reps_completed,
        duration_seconds,
        logged_at,
        exercises(name, category, muscle_groups)
      `)
      .eq('user_id', user.id)
      .gte('logged_at', sevenDaysAgoISO);

    if (logsError) {
      console.error('Logs query error:', logsError);
      // Continue without logs if query fails
    }

    // Calculate analytics
    const analytics = calculateAnalytics(sessions || [], logs || []);

    return createResponse<Analytics7D>(analytics);
  } catch (error) {
    console.error('Get 7-day analytics error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to calculate analytics');
  }
}

function calculateAnalytics(sessions: any[], logs: any[]): Analytics7D {
  const completedSessions = sessions.filter(s => s.status === 'completed');
  
  // Basic metrics
  const totalWorkouts = completedSessions.length;
  const totalDurationMinutes = completedSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const totalCaloriesBurned = completedSessions.reduce((sum, s) => sum + (s.calories_burned || 0), 0);
  const averageWorkoutDuration = totalWorkouts > 0 ? Math.round(totalDurationMinutes / totalWorkouts) : 0;

  // Exercise frequency analysis
  const exerciseFrequency: Record<string, number> = {};
  logs.forEach(log => {
    const exerciseName = log.exercises?.name;
    if (exerciseName) {
      exerciseFrequency[exerciseName] = (exerciseFrequency[exerciseName] || 0) + 1;
    }
  });

  const mostCommonExercises = Object.entries(exerciseFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([exercise_name, frequency]) => ({ exercise_name, frequency }));

  // Workout frequency by day
  const workoutsByDay: Record<string, number> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  completedSessions.forEach(session => {
    const date = new Date(session.started_at);
    const dayName = dayNames[date.getDay()];
    workoutsByDay[dayName] = (workoutsByDay[dayName] || 0) + 1;
  });

  const workoutFrequencyByDay = dayNames.map(day => ({
    day,
    workout_count: workoutsByDay[day] || 0
  }));

  // Difficulty distribution
  const difficultyDistribution: Record<string, number> = {};
  completedSessions.forEach(session => {
    const difficulty = session.workout_plans?.difficulty_level || 1;
    const key = `Level ${difficulty}`;
    difficultyDistribution[key] = (difficultyDistribution[key] || 0) + 1;
  });

  // Equipment usage
  const equipmentUsage: Record<string, number> = {};
  completedSessions.forEach(session => {
    const equipment = session.workout_plans?.equipment_needed || [];
    equipment.forEach((eq: string) => {
      equipmentUsage[eq] = (equipmentUsage[eq] || 0) + 1;
    });
  });

  // Completion rate (completed vs total sessions)
  const totalSessions = sessions.length;
  const completionRate = totalSessions > 0 ? Math.round((totalWorkouts / totalSessions) * 100) / 100 : 0;

  // Calculate streak
  const streakDays = calculateWorkoutStreak(completedSessions);

  // Improvement metrics
  const improvementMetrics = calculateImprovementMetrics(completedSessions);

  return {
    total_workouts: totalWorkouts,
    total_duration_minutes: totalDurationMinutes,
    total_calories_burned: totalCaloriesBurned,
    average_workout_duration: averageWorkoutDuration,
    most_common_exercises: mostCommonExercises,
    workout_frequency_by_day: workoutFrequencyByDay,
    difficulty_distribution: difficultyDistribution,
    equipment_usage: equipmentUsage,
    completion_rate: completionRate,
    streak_days: streakDays,
    improvement_metrics: improvementMetrics
  };
}

function calculateWorkoutStreak(sessions: any[]): number {
  if (sessions.length === 0) return 0;

  const workoutDates = sessions
    .map(s => new Date(s.started_at).toDateString())
    .filter((date, index, arr) => arr.indexOf(date) === index)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let streak = 0;
  const today = new Date().toDateString();
  let currentDate = new Date();

  for (let i = 0; i < 7; i++) {
    const dateString = currentDate.toDateString();
    
    if (workoutDates.includes(dateString)) {
      streak++;
    } else if (dateString !== today) {
      // Break streak if we hit a day without workout (except today)
      break;
    }
    
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}

function calculateImprovementMetrics(sessions: any[]): Analytics7D['improvement_metrics'] {
  if (sessions.length < 2) {
    return {
      duration_trend: 'stable',
      difficulty_trend: 'stable',
      consistency_score: sessions.length > 0 ? 1 : 0
    };
  }

  // Sort sessions by date
  const sortedSessions = sessions
    .filter(s => s.duration_minutes && s.workout_plans?.difficulty_level)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

  if (sortedSessions.length < 2) {
    return {
      duration_trend: 'stable',
      difficulty_trend: 'stable',
      consistency_score: sessions.length / 7
    };
  }

  // Calculate trends
  const firstHalf = sortedSessions.slice(0, Math.floor(sortedSessions.length / 2));
  const secondHalf = sortedSessions.slice(Math.floor(sortedSessions.length / 2));

  const firstHalfAvgDuration = firstHalf.reduce((sum, s) => sum + s.duration_minutes, 0) / firstHalf.length;
  const secondHalfAvgDuration = secondHalf.reduce((sum, s) => sum + s.duration_minutes, 0) / secondHalf.length;

  const firstHalfAvgDifficulty = firstHalf.reduce((sum, s) => sum + s.workout_plans.difficulty_level, 0) / firstHalf.length;
  const secondHalfAvgDifficulty = secondHalf.reduce((sum, s) => sum + s.workout_plans.difficulty_level, 0) / secondHalf.length;

  const durationChange = (secondHalfAvgDuration - firstHalfAvgDuration) / firstHalfAvgDuration;
  const difficultyChange = (secondHalfAvgDifficulty - firstHalfAvgDifficulty) / firstHalfAvgDifficulty;

  const durationTrend = Math.abs(durationChange) < 0.1 ? 'stable' : durationChange > 0 ? 'increasing' : 'decreasing';
  const difficultyTrend = Math.abs(difficultyChange) < 0.1 ? 'stable' : difficultyChange > 0 ? 'increasing' : 'decreasing';

  // Consistency score based on workout frequency and completion rate
  const workoutDays = new Set(sessions.map(s => new Date(s.started_at).toDateString())).size;
  const consistencyScore = Math.round((workoutDays / 7) * 100) / 100;

  return {
    duration_trend: durationTrend,
    difficulty_trend: difficultyTrend,
    consistency_score: consistencyScore
  };
}

// Main handler
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  return await handler(req);
});