import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Workout, WorkoutSet, WorkoutStatus, Exercise } from '../types';
import { supabase, handleSupabaseError, createRealtimeSubscription } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface WorkoutState {
  workouts: Workout[];
  activeWorkout: Workout | null;
  exercises: Exercise[];
  isLoading: boolean;
  error: string | null;
  restTimer: {
    isActive: boolean;
    startTime: number | null;
    duration: number; // seconds
  };
  subscription: RealtimeChannel | null;
}

interface WorkoutActions {
  // Workout management
  fetchWorkouts: () => Promise<void>;
  createWorkout: (workout: Partial<Workout>) => Promise<void>;
  updateWorkout: (id: string, updates: Partial<Workout>) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  
  // Active workout management
  startWorkout: (workoutId: string) => Promise<void>;
  finishWorkout: () => Promise<void>;
  cancelWorkout: () => void;
  
  // Set management
  addSet: (set: Omit<WorkoutSet, 'id'>) => Promise<void>;
  updateSet: (setId: string, updates: Partial<WorkoutSet>) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;
  completeSet: (setId: string) => Promise<void>;
  
  // Exercise management
  fetchExercises: () => Promise<void>;
  searchExercises: (query: string) => Exercise[];
  
  // Rest timer
  startRestTimer: (duration: number) => void;
  stopRestTimer: () => void;
  
  // Real-time subscriptions
  subscribeToWorkouts: (userId: string) => void;
  unsubscribeFromWorkouts: () => void;
  
  // Utility
  clearError: () => void;
  setActiveWorkout: (workout: Workout | null) => void;
}

export const useWorkoutStore = create<WorkoutState & WorkoutActions>()(
  persist(
    (set, get) => ({
      // State
      workouts: [],
      activeWorkout: null,
      exercises: [],
      isLoading: false,
      error: null,
      restTimer: {
        isActive: false,
        startTime: null,
        duration: 0,
      },
      subscription: null,

      // Workout management
      fetchWorkouts: async () => {
        set({ isLoading: true, error: null });
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');

          const { data: workoutData, error } = await supabase
            .from('workouts')
            .select(`
              *,
              workout_sets:workout_sets(
                *,
                exercise:exercises(*)
              )
            `)
            .eq('user_id', user.id)
            .order('date', { ascending: false });

          if (error) throw error;

          const workouts: Workout[] = workoutData.map((workout) => ({
            id: workout.id,
            userId: workout.user_id,
            name: workout.name,
            description: workout.description,
            date: workout.date,
            startTime: workout.start_time,
            endTime: workout.end_time,
            status: workout.status as WorkoutStatus,
            totalVolume: workout.total_volume,
            totalTime: workout.total_time,
            notes: workout.notes,
            createdAt: workout.created_at,
            updatedAt: workout.updated_at,
            sets: workout.workout_sets.map((set: any) => ({
              id: set.id,
              exerciseId: set.exercise_id,
              setNumber: set.set_number,
              reps: set.reps,
              weight: set.weight,
              time: set.time,
              distance: set.distance,
              rpe: set.rpe,
              notes: set.notes,
              completed: set.completed,
              completedAt: set.completed_at,
            })),
          }));

          set({ workouts, isLoading: false });
        } catch (error: any) {
          set({
            error: handleSupabaseError(error),
            isLoading: false,
          });
        }
      },

      createWorkout: async (workoutData: Partial<Workout>) => {
        set({ isLoading: true, error: null });
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');

          const { data, error } = await supabase
            .from('workouts')
            .insert({
              user_id: user.id,
              name: workoutData.name!,
              description: workoutData.description,
              date: workoutData.date || new Date().toISOString().split('T')[0],
              status: workoutData.status || WorkoutStatus.PLANNED,
              notes: workoutData.notes,
            })
            .select()
            .single();

          if (error) throw error;

          const newWorkout: Workout = {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            description: data.description,
            date: data.date,
            startTime: data.start_time,
            endTime: data.end_time,
            status: data.status as WorkoutStatus,
            totalVolume: data.total_volume,
            totalTime: data.total_time,
            notes: data.notes,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            sets: [],
          };

          set((state) => ({
            workouts: [newWorkout, ...state.workouts],
            isLoading: false,
          }));
        } catch (error: any) {
          set({
            error: handleSupabaseError(error),
            isLoading: false,
          });
          throw error;
        }
      },

      updateWorkout: async (id: string, updates: Partial<Workout>) => {
        set({ isLoading: true, error: null });
        try {
          const updateData: any = {};
          if (updates.name) updateData.name = updates.name;
          if (updates.description !== undefined) updateData.description = updates.description;
          if (updates.date) updateData.date = updates.date;
          if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
          if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
          if (updates.status) updateData.status = updates.status;
          if (updates.totalVolume !== undefined) updateData.total_volume = updates.totalVolume;
          if (updates.totalTime !== undefined) updateData.total_time = updates.totalTime;
          if (updates.notes !== undefined) updateData.notes = updates.notes;

          const { data, error } = await supabase
            .from('workouts')
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;

          const updatedWorkout: Workout = {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            description: data.description,
            date: data.date,
            startTime: data.start_time,
            endTime: data.end_time,
            status: data.status as WorkoutStatus,
            totalVolume: data.total_volume,
            totalTime: data.total_time,
            notes: data.notes,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            sets: get().workouts.find(w => w.id === id)?.sets || [],
          };

          set((state) => ({
            workouts: state.workouts.map((w) =>
              w.id === id ? updatedWorkout : w
            ),
            activeWorkout: state.activeWorkout?.id === id ? updatedWorkout : state.activeWorkout,
            isLoading: false,
          }));
        } catch (error: any) {
          set({
            error: handleSupabaseError(error),
            isLoading: false,
          });
          throw error;
        }
      },

      deleteWorkout: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const { error } = await supabase
            .from('workouts')
            .delete()
            .eq('id', id);

          if (error) throw error;

          set((state) => ({
            workouts: state.workouts.filter((w) => w.id !== id),
            activeWorkout: state.activeWorkout?.id === id ? null : state.activeWorkout,
            isLoading: false,
          }));
        } catch (error: any) {
          set({
            error: handleSupabaseError(error),
            isLoading: false,
          });
          throw error;
        }
      },

      // Active workout management
      startWorkout: async (workoutId: string) => {
        set({ isLoading: true, error: null });
        try {
          const workout = get().workouts.find((w) => w.id === workoutId);
          if (!workout) {
            throw new Error('Workout not found');
          }

          const updates = {
            status: WorkoutStatus.IN_PROGRESS,
            startTime: new Date().toISOString(),
          };

          await get().updateWorkout(workoutId, updates);
          
          const updatedWorkout = {
            ...workout,
            ...updates,
          };

          set({
            activeWorkout: updatedWorkout,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: handleSupabaseError(error),
            isLoading: false,
          });
          throw error;
        }
      },

      finishWorkout: async () => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        set({ isLoading: true, error: null });
        try {
          const updates = {
            status: WorkoutStatus.COMPLETED,
            endTime: new Date().toISOString(),
          };

          await get().updateWorkout(activeWorkout.id, updates);
          
          set({
            activeWorkout: null,
            isLoading: false,
          });

          // Stop rest timer if active
          get().stopRestTimer();
        } catch (error: any) {
          set({
            error: handleSupabaseError(error),
            isLoading: false,
          });
          throw error;
        }
      },

      cancelWorkout: () => {
        set({ activeWorkout: null });
        get().stopRestTimer();
      },

      // Set management
      addSet: async (setData: Omit<WorkoutSet, 'id'>) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase
            .from('workout_sets')
            .insert({
              workout_id: activeWorkout.id,
              exercise_id: setData.exerciseId,
              set_number: setData.setNumber,
              reps: setData.reps,
              weight: setData.weight,
              time: setData.time,
              distance: setData.distance,
              rpe: setData.rpe,
              notes: setData.notes,
              completed: setData.completed,
              completed_at: setData.completedAt,
            })
            .select()
            .single();

          if (error) throw error;

          const newSet: WorkoutSet = {
            id: data.id,
            exerciseId: data.exercise_id,
            setNumber: data.set_number,
            reps: data.reps,
            weight: data.weight,
            time: data.time,
            distance: data.distance,
            rpe: data.rpe,
            notes: data.notes,
            completed: data.completed,
            completedAt: data.completed_at,
          };
          
          const updatedWorkout = {
            ...activeWorkout,
            sets: [...activeWorkout.sets, newSet],
          };

          set({
            activeWorkout: updatedWorkout,
            isLoading: false,
          });

          // Update workout in workouts array
          set((state) => ({
            workouts: state.workouts.map((w) =>
              w.id === activeWorkout.id ? updatedWorkout : w
            ),
          }));
        } catch (error: any) {
          set({
            error: handleSupabaseError(error),
            isLoading: false,
          });
          throw error;
        }
      },

      updateSet: async (setId: string, updates: Partial<WorkoutSet>) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        set({ isLoading: true, error: null });
        try {
          const updateData: any = {};
          if (updates.reps !== undefined) updateData.reps = updates.reps;
          if (updates.weight !== undefined) updateData.weight = updates.weight;
          if (updates.time !== undefined) updateData.time = updates.time;
          if (updates.distance !== undefined) updateData.distance = updates.distance;
          if (updates.rpe !== undefined) updateData.rpe = updates.rpe;
          if (updates.notes !== undefined) updateData.notes = updates.notes;
          if (updates.completed !== undefined) updateData.completed = updates.completed;
          if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;

          const { data, error } = await supabase
            .from('workout_sets')
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq('id', setId)
            .select()
            .single();

          if (error) throw error;

          const updatedSet: WorkoutSet = {
            id: data.id,
            exerciseId: data.exercise_id,
            setNumber: data.set_number,
            reps: data.reps,
            weight: data.weight,
            time: data.time,
            distance: data.distance,
            rpe: data.rpe,
            notes: data.notes,
            completed: data.completed,
            completedAt: data.completed_at,
          };
          
          const updatedSets = activeWorkout.sets.map((s) =>
            s.id === setId ? updatedSet : s
          );

          const updatedWorkout = {
            ...activeWorkout,
            sets: updatedSets,
          };

          set({
            activeWorkout: updatedWorkout,
            isLoading: false,
          });

          // Update workout in workouts array
          set((state) => ({
            workouts: state.workouts.map((w) =>
              w.id === activeWorkout.id ? updatedWorkout : w
            ),
          }));
        } catch (error: any) {
          set({
            error: handleSupabaseError(error),
            isLoading: false,
          });
          throw error;
        }
      },

      deleteSet: async (setId: string) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        set({ isLoading: true, error: null });
        try {
          const { error } = await supabase
            .from('workout_sets')
            .delete()
            .eq('id', setId);

          if (error) throw error;
          
          const updatedSets = activeWorkout.sets.filter((s) => s.id !== setId);
          const updatedWorkout = {
            ...activeWorkout,
            sets: updatedSets,
          };

          set({
            activeWorkout: updatedWorkout,
            isLoading: false,
          });

          // Update workout in workouts array
          set((state) => ({
            workouts: state.workouts.map((w) =>
              w.id === activeWorkout.id ? updatedWorkout : w
            ),
          }));
        } catch (error: any) {
          set({
            error: handleSupabaseError(error),
            isLoading: false,
          });
          throw error;
        }
      },

      completeSet: async (setId: string) => {
        await get().updateSet(setId, {
          completed: true,
          completedAt: new Date().toISOString(),
        });
      },

      // Exercise management
      fetchExercises: async () => {
        if (get().exercises.length > 0) return; // Don't refetch if already loaded

        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase
            .from('exercises')
            .select('*')
            .order('name');

          if (error) throw error;

          const exercises: Exercise[] = data.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            description: exercise.description,
            category: exercise.category as any,
            movementPattern: exercise.movement_pattern as any,
            primaryMuscles: exercise.primary_muscles as any[],
            secondaryMuscles: exercise.secondary_muscles as any[],
            equipment: exercise.equipment as any[],
            instructions: exercise.instructions,
            videoUrl: exercise.video_url,
            imageUrl: exercise.image_url,
          }));

          set({ exercises, isLoading: false });
        } catch (error: any) {
          set({
            error: handleSupabaseError(error),
            isLoading: false,
          });
        }
      },

      searchExercises: (query: string) => {
        const { exercises } = get();
        if (!query.trim()) return exercises;

        const lowerQuery = query.toLowerCase();
        return exercises.filter(
          (exercise) =>
            exercise.name.toLowerCase().includes(lowerQuery) ||
            exercise.category.toLowerCase().includes(lowerQuery) ||
            exercise.primaryMuscles.some((muscle) =>
              muscle.toLowerCase().includes(lowerQuery)
            )
        );
      },

      // Rest timer
      startRestTimer: (duration: number) => {
        set({
          restTimer: {
            isActive: true,
            startTime: Date.now(),
            duration,
          },
        });

        // Auto-stop timer after duration
        setTimeout(() => {
          const { restTimer } = get();
          if (restTimer.isActive && restTimer.startTime === Date.now()) {
            get().stopRestTimer();
          }
        }, duration * 1000);
      },

      stopRestTimer: () => {
        set({
          restTimer: {
            isActive: false,
            startTime: null,
            duration: 0,
          },
        });
      },

      // Real-time subscriptions
      subscribeToWorkouts: (userId: string) => {
        const subscription = createRealtimeSubscription(
          'workouts',
          `user_id=eq.${userId}`,
          (payload) => {
            console.log('Workout realtime update:', payload);
            // Refetch workouts when changes occur
            get().fetchWorkouts();
          }
        );

        set({ subscription });
      },

      unsubscribeFromWorkouts: () => {
        const { subscription } = get();
        if (subscription) {
          supabase.removeChannel(subscription);
          set({ subscription: null });
        }
      },

      // Utility
      clearError: () => {
        set({ error: null });
      },

      setActiveWorkout: (workout: Workout | null) => {
        set({ activeWorkout: workout });
      },
    }),
    {
      name: 'workout-storage',
      partialize: (state) => ({
        activeWorkout: state.activeWorkout,
        exercises: state.exercises,
      }),
    }
  )
);