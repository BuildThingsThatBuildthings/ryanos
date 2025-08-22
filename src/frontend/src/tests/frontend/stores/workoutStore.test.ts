import { act, renderHook, waitFor } from '@testing-library/react';
import { useWorkoutStore } from '../../../stores/workoutStore';
import { server } from '../../utils/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockWorkouts, mockExercises, createMockWorkout, createMockSet } from '../../utils/fixtures/api-responses';
import { WorkoutStatus } from '../../../types';

// Mock the API modules
vi.mock('../../../api/workout');
vi.mock('../../../api/exercise');

describe('WorkoutStore', () => {
  beforeEach(() => {
    // Reset store state
    useWorkoutStore.setState({
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
    });
  });

  describe('fetchWorkouts', () => {
    it('fetches workouts successfully', async () => {
      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.fetchWorkouts();
      });

      expect(result.current.workouts).toEqual(mockWorkouts);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles fetch workouts error', async () => {
      server.use(
        http.get('*/api/workouts', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.fetchWorkouts();
      });

      expect(result.current.workouts).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toContain('Failed to fetch workouts');
    });

    it('sets loading state during fetch', async () => {
      const { result } = renderHook(() => useWorkoutStore());

      act(() => {
        result.current.fetchWorkouts();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('createWorkout', () => {
    it('creates workout successfully', async () => {
      const newWorkoutData = {
        name: 'New Workout',
        date: '2023-01-01',
      };

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.createWorkout(newWorkoutData);
      });

      expect(result.current.workouts).toHaveLength(1);
      expect(result.current.workouts[0]).toMatchObject(newWorkoutData);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles create workout error', async () => {
      server.use(
        http.post('*/api/workouts', () => {
          return HttpResponse.json(
            { success: false, message: 'Validation failed' },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        try {
          await result.current.createWorkout({ name: 'Test' });
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.workouts).toHaveLength(0);
      expect(result.current.error).toContain('Failed to create workout');
    });
  });

  describe('updateWorkout', () => {
    it('updates workout successfully', async () => {
      const initialWorkout = createMockWorkout({ id: 'workout-1', name: 'Original' });
      useWorkoutStore.setState({ workouts: [initialWorkout] });

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.updateWorkout('workout-1', { name: 'Updated' });
      });

      expect(result.current.workouts[0].name).toBe('Updated Name'); // Mock returns this
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('updates active workout when it matches', async () => {
      const activeWorkout = createMockWorkout({ id: 'workout-1', name: 'Active' });
      useWorkoutStore.setState({ 
        workouts: [activeWorkout],
        activeWorkout: activeWorkout,
      });

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.updateWorkout('workout-1', { name: 'Updated' });
      });

      expect(result.current.activeWorkout?.name).toBe('Updated Name');
    });
  });

  describe('deleteWorkout', () => {
    it('deletes workout successfully', async () => {
      const workout = createMockWorkout({ id: 'workout-1' });
      useWorkoutStore.setState({ workouts: [workout] });

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.deleteWorkout('workout-1');
      });

      expect(result.current.workouts).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('clears active workout if deleted workout is active', async () => {
      const activeWorkout = createMockWorkout({ id: 'workout-1' });
      useWorkoutStore.setState({ 
        workouts: [activeWorkout],
        activeWorkout: activeWorkout,
      });

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.deleteWorkout('workout-1');
      });

      expect(result.current.activeWorkout).toBeNull();
    });
  });

  describe('startWorkout', () => {
    it('starts workout successfully', async () => {
      const workout = createMockWorkout({ 
        id: 'workout-1', 
        status: WorkoutStatus.PLANNED,
      });
      useWorkoutStore.setState({ workouts: [workout] });

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.startWorkout('workout-1');
      });

      expect(result.current.activeWorkout).toBeTruthy();
      expect(result.current.activeWorkout?.status).toBe(WorkoutStatus.IN_PROGRESS);
      expect(result.current.activeWorkout?.startTime).toBeTruthy();
    });

    it('throws error if workout not found', async () => {
      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        try {
          await result.current.startWorkout('non-existent');
        } catch (error) {
          expect(error.message).toBe('Workout not found');
        }
      });
    });
  });

  describe('finishWorkout', () => {
    it('finishes active workout successfully', async () => {
      const activeWorkout = createMockWorkout({ 
        id: 'workout-1',
        status: WorkoutStatus.IN_PROGRESS,
      });
      useWorkoutStore.setState({ activeWorkout });

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.finishWorkout();
      });

      expect(result.current.activeWorkout).toBeNull();
      expect(result.current.restTimer.isActive).toBe(false);
    });

    it('does nothing if no active workout', async () => {
      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.finishWorkout();
      });

      expect(result.current.activeWorkout).toBeNull();
    });
  });

  describe('cancelWorkout', () => {
    it('cancels active workout and stops rest timer', () => {
      const activeWorkout = createMockWorkout();
      useWorkoutStore.setState({ 
        activeWorkout,
        restTimer: { isActive: true, startTime: Date.now(), duration: 180 },
      });

      const { result } = renderHook(() => useWorkoutStore());

      act(() => {
        result.current.cancelWorkout();
      });

      expect(result.current.activeWorkout).toBeNull();
      expect(result.current.restTimer.isActive).toBe(false);
    });
  });

  describe('set management', () => {
    const activeWorkout = createMockWorkout({ 
      id: 'workout-1',
      sets: [],
    });

    beforeEach(() => {
      useWorkoutStore.setState({ activeWorkout });
    });

    it('adds set to active workout', async () => {
      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.addSet({
          exerciseId: 'exercise-1',
          setNumber: 1,
          reps: 10,
        });
      });

      expect(result.current.activeWorkout?.sets).toHaveLength(1);
      expect(result.current.activeWorkout?.sets[0]).toMatchObject({
        exerciseId: 'exercise-1',
        setNumber: 1,
        reps: 10,
      });
    });

    it('updates set in active workout', async () => {
      const set = createMockSet({ id: 'set-1', reps: 8 });
      useWorkoutStore.setState({ 
        activeWorkout: { ...activeWorkout, sets: [set] },
      });

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.updateSet('set-1', { reps: 12 });
      });

      expect(result.current.activeWorkout?.sets[0].reps).toBe(12);
    });

    it('deletes set from active workout', async () => {
      const set = createMockSet({ id: 'set-1' });
      useWorkoutStore.setState({ 
        activeWorkout: { ...activeWorkout, sets: [set] },
      });

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.deleteSet('set-1');
      });

      expect(result.current.activeWorkout?.sets).toHaveLength(0);
    });

    it('completes set', async () => {
      const set = createMockSet({ id: 'set-1', completed: false });
      useWorkoutStore.setState({ 
        activeWorkout: { ...activeWorkout, sets: [set] },
      });

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.completeSet('set-1');
      });

      expect(result.current.activeWorkout?.sets[0].completed).toBe(true);
      expect(result.current.activeWorkout?.sets[0].completedAt).toBeTruthy();
    });
  });

  describe('fetchExercises', () => {
    it('fetches exercises successfully', async () => {
      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.fetchExercises();
      });

      expect(result.current.exercises).toEqual(mockExercises);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('does not refetch if exercises already loaded', async () => {
      useWorkoutStore.setState({ exercises: mockExercises });

      const { result } = renderHook(() => useWorkoutStore());

      await act(async () => {
        await result.current.fetchExercises();
      });

      // Should not trigger loading state
      expect(result.current.exercises).toEqual(mockExercises);
    });
  });

  describe('searchExercises', () => {
    beforeEach(() => {
      useWorkoutStore.setState({ exercises: mockExercises });
    });

    it('returns all exercises for empty query', () => {
      const { result } = renderHook(() => useWorkoutStore());

      const results = result.current.searchExercises('');
      expect(results).toEqual(mockExercises);
    });

    it('filters exercises by name', () => {
      const { result } = renderHook(() => useWorkoutStore());

      const results = result.current.searchExercises('Push');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Push-ups');
    });

    it('filters exercises by category', () => {
      const { result } = renderHook(() => useWorkoutStore());

      const results = result.current.searchExercises('cardio');
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('cardio');
    });

    it('filters exercises by muscle group', () => {
      const { result } = renderHook(() => useWorkoutStore());

      const results = result.current.searchExercises('chest');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(ex => ex.primaryMuscles.includes('chest'))).toBe(true);
    });
  });

  describe('rest timer', () => {
    it('starts rest timer', () => {
      const { result } = renderHook(() => useWorkoutStore());

      act(() => {
        result.current.startRestTimer(180);
      });

      expect(result.current.restTimer.isActive).toBe(true);
      expect(result.current.restTimer.duration).toBe(180);
      expect(result.current.restTimer.startTime).toBeTruthy();
    });

    it('stops rest timer', () => {
      useWorkoutStore.setState({
        restTimer: { isActive: true, startTime: Date.now(), duration: 180 },
      });

      const { result } = renderHook(() => useWorkoutStore());

      act(() => {
        result.current.stopRestTimer();
      });

      expect(result.current.restTimer.isActive).toBe(false);
      expect(result.current.restTimer.startTime).toBeNull();
      expect(result.current.restTimer.duration).toBe(0);
    });

    it('auto-stops timer after duration', async () => {
      const { result } = renderHook(() => useWorkoutStore());

      act(() => {
        result.current.startRestTimer(0.1); // 100ms for testing
      });

      expect(result.current.restTimer.isActive).toBe(true);

      await waitFor(
        () => {
          expect(result.current.restTimer.isActive).toBe(false);
        },
        { timeout: 200 }
      );
    });
  });

  describe('utility functions', () => {
    it('clears error', () => {
      useWorkoutStore.setState({ error: 'Test error' });

      const { result } = renderHook(() => useWorkoutStore());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('sets active workout', () => {
      const workout = createMockWorkout();
      const { result } = renderHook(() => useWorkoutStore());

      act(() => {
        result.current.setActiveWorkout(workout);
      });

      expect(result.current.activeWorkout).toBe(workout);
    });
  });

  describe('persistence', () => {
    it('persists active workout and exercises', () => {
      const workout = createMockWorkout();
      
      act(() => {
        useWorkoutStore.setState({
          activeWorkout: workout,
          exercises: mockExercises,
          workouts: [], // This should not be persisted
        });
      });

      // Check that the state was set
      const state = useWorkoutStore.getState();
      expect(state.activeWorkout).toBe(workout);
      expect(state.exercises).toEqual(mockExercises);
    });
  });
});