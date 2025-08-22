import { supabase } from './supabase';
import { Workout, WorkoutSet, Exercise, VoiceSession, User } from '../types';

// Type-safe query builders
export const workoutQueries = {
  // Get all workouts for a user with sets and exercises
  getWorkoutsWithSets: (userId: string) =>
    supabase
      .from('workouts')
      .select(`
        *,
        workout_sets:workout_sets(
          *,
          exercise:exercises(*)
        )
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false }),

  // Get workout by ID with full details
  getWorkoutById: (workoutId: string) =>
    supabase
      .from('workouts')
      .select(`
        *,
        workout_sets:workout_sets(
          *,
          exercise:exercises(*)
        )
      `)
      .eq('id', workoutId)
      .single(),

  // Get recent workouts for stats
  getRecentWorkouts: (userId: string, days: number = 7) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return supabase
      .from('workouts')
      .select(`
        *,
        workout_sets:workout_sets(*)
      `)
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });
  },
};

export const exerciseQueries = {
  // Get all exercises
  getAllExercises: () =>
    supabase
      .from('exercises')
      .select('*')
      .order('name'),

  // Search exercises by name or muscle group
  searchExercises: (query: string) =>
    supabase
      .from('exercises')
      .select('*')
      .or(`name.ilike.%${query}%,category.ilike.%${query}%,primary_muscles.cs.{${query}}`)
      .order('name'),

  // Get exercises by category
  getExercisesByCategory: (category: string) =>
    supabase
      .from('exercises')
      .select('*')
      .eq('category', category)
      .order('name'),
};

export const voiceQueries = {
  // Get voice sessions for user
  getUserSessions: (userId: string, limit: number = 50) =>
    supabase
      .from('voice_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),

  // Get sessions by workout
  getWorkoutSessions: (workoutId: string) =>
    supabase
      .from('voice_sessions')
      .select('*')
      .eq('workout_id', workoutId)
      .order('start_time', { ascending: false }),
};

// Data transformation helpers
export const transformWorkoutData = (dbWorkout: any): Workout => ({
  id: dbWorkout.id,
  userId: dbWorkout.user_id,
  name: dbWorkout.name,
  description: dbWorkout.description,
  date: dbWorkout.date,
  startTime: dbWorkout.start_time,
  endTime: dbWorkout.end_time,
  status: dbWorkout.status,
  totalVolume: dbWorkout.total_volume,
  totalTime: dbWorkout.total_time,
  notes: dbWorkout.notes,
  createdAt: dbWorkout.created_at,
  updatedAt: dbWorkout.updated_at,
  sets: dbWorkout.workout_sets?.map(transformSetData) || [],
});

export const transformSetData = (dbSet: any): WorkoutSet => ({
  id: dbSet.id,
  exerciseId: dbSet.exercise_id,
  setNumber: dbSet.set_number,
  reps: dbSet.reps,
  weight: dbSet.weight,
  time: dbSet.time,
  distance: dbSet.distance,
  rpe: dbSet.rpe,
  notes: dbSet.notes,
  completed: dbSet.completed,
  completedAt: dbSet.completed_at,
});

export const transformExerciseData = (dbExercise: any): Exercise => ({
  id: dbExercise.id,
  name: dbExercise.name,
  description: dbExercise.description,
  category: dbExercise.category,
  movementPattern: dbExercise.movement_pattern,
  primaryMuscles: dbExercise.primary_muscles,
  secondaryMuscles: dbExercise.secondary_muscles,
  equipment: dbExercise.equipment,
  instructions: dbExercise.instructions,
  videoUrl: dbExercise.video_url,
  imageUrl: dbExercise.image_url,
});

export const transformVoiceSessionData = (dbSession: any): VoiceSession => ({
  id: dbSession.id,
  userId: dbSession.user_id,
  workoutId: dbSession.workout_id,
  startTime: dbSession.start_time,
  endTime: dbSession.end_time,
  transcript: dbSession.transcript,
  processed: dbSession.processed,
  extractedData: dbSession.extracted_data,
  status: dbSession.status,
});

export const transformUserData = (dbUser: any): User => ({
  id: dbUser.id,
  email: dbUser.email,
  name: dbUser.name,
  avatar: dbUser.avatar,
  createdAt: dbUser.created_at,
  updatedAt: dbUser.updated_at,
});

// Batch operations
export const batchOperations = {
  // Create workout with sets
  createWorkoutWithSets: async (
    userId: string,
    workoutData: Partial<Workout>,
    sets: Omit<WorkoutSet, 'id'>[]
  ) => {
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        name: workoutData.name!,
        description: workoutData.description,
        date: workoutData.date || new Date().toISOString().split('T')[0],
        status: workoutData.status || 'planned',
        notes: workoutData.notes,
      })
      .select()
      .single();

    if (workoutError) throw workoutError;

    if (sets.length > 0) {
      const setsData = sets.map((set, index) => ({
        workout_id: workout.id,
        exercise_id: set.exerciseId,
        set_number: set.setNumber || index + 1,
        reps: set.reps,
        weight: set.weight,
        time: set.time,
        distance: set.distance,
        rpe: set.rpe,
        notes: set.notes,
        completed: set.completed || false,
        completed_at: set.completedAt,
      }));

      const { error: setsError } = await supabase
        .from('workout_sets')
        .insert(setsData);

      if (setsError) throw setsError;
    }

    return transformWorkoutData(workout);
  },

  // Delete workout and all its sets
  deleteWorkoutWithSets: async (workoutId: string) => {
    // Supabase should handle cascade deletion if properly configured
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workoutId);

    if (error) throw error;
  },
};