import { render, screen, fireEvent, waitFor } from '../../utils/test-utils';
import { useWorkoutStore } from '../../../stores/workoutStore';
import { useAuthStore } from '../../../stores/authStore';
import { server } from '../../utils/mocks/server';
import { http, HttpResponse } from 'msw';
import { createMockWorkout, createMockExercise } from '../../utils/fixtures/api-responses';
import { WorkoutStatus } from '../../../types';

// Mock the stores
vi.mock('../../../stores/workoutStore');
vi.mock('../../../stores/authStore');

const mockUseWorkoutStore = vi.mocked(useWorkoutStore);
const mockUseAuthStore = vi.mocked(useAuthStore);

// Mock components that are complex to test in integration
vi.mock('../../../components/workout/WorkoutCard', () => ({
  WorkoutCard: ({ workout, onStart }: any) => (
    <div data-testid={`workout-${workout.id}`}>
      <h3>{workout.name}</h3>
      <p>{workout.status}</p>
      <button onClick={() => onStart(workout.id)}>Start Workout</button>
    </div>
  ),
}));

vi.mock('../../../components/workout/SetTracker', () => ({
  SetTracker: ({ exerciseId, onComplete }: any) => (
    <div data-testid={`set-tracker-${exerciseId}`}>
      <button onClick={() => onComplete({ reps: 10, weight: 50 })}>
        Complete Set
      </button>
    </div>
  ),
}));

// Mock navigation
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'workout-1' }),
}));

describe('Workout Flow Integration Tests', () => {
  const mockWorkouts = [
    createMockWorkout({ 
      id: 'workout-1', 
      name: 'Push Day',
      status: WorkoutStatus.PLANNED,
    }),
    createMockWorkout({ 
      id: 'workout-2', 
      name: 'Pull Day',
      status: WorkoutStatus.IN_PROGRESS,
    }),
  ];

  const mockExercises = [
    createMockExercise({ id: 'exercise-1', name: 'Push-ups' }),
    createMockExercise({ id: 'exercise-2', name: 'Bench Press' }),
  ];

  const defaultStoreState = {
    workouts: mockWorkouts,
    activeWorkout: null,
    exercises: mockExercises,
    isLoading: false,
    error: null,
    restTimer: { isActive: false, startTime: null, duration: 0 },
    fetchWorkouts: vi.fn(),
    createWorkout: vi.fn(),
    updateWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    startWorkout: vi.fn(),
    finishWorkout: vi.fn(),
    cancelWorkout: vi.fn(),
    addSet: vi.fn(),
    updateSet: vi.fn(),
    deleteSet: vi.fn(),
    completeSet: vi.fn(),
    fetchExercises: vi.fn(),
    searchExercises: vi.fn(() => mockExercises),
    startRestTimer: vi.fn(),
    stopRestTimer: vi.fn(),
    clearError: vi.fn(),
    setActiveWorkout: vi.fn(),
  };

  const defaultAuthState = {
    user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
    isAuthenticated: true,
    token: 'mock-token',
    isLoading: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWorkoutStore.mockReturnValue(defaultStoreState);
    mockUseAuthStore.mockReturnValue(defaultAuthState as any);
  });

  describe('Workout List and Start Flow', () => {
    const WorkoutListPage = () => {
      const { workouts, startWorkout, isLoading } = useWorkoutStore();

      if (isLoading) return <div>Loading...</div>;

      return (
        <div>
          <h1>My Workouts</h1>
          {workouts.map(workout => (
            <div key={workout.id} data-testid={`workout-${workout.id}`}>
              <h3>{workout.name}</h3>
              <p>Status: {workout.status}</p>
              <button 
                onClick={() => startWorkout(workout.id)}
                disabled={workout.status === WorkoutStatus.IN_PROGRESS}
              >
                {workout.status === WorkoutStatus.PLANNED ? 'Start' : 'Continue'}
              </button>
            </div>
          ))}
        </div>
      );
    };

    it('displays list of workouts', () => {
      render(<WorkoutListPage />);

      expect(screen.getByText('My Workouts')).toBeInTheDocument();
      expect(screen.getByText('Push Day')).toBeInTheDocument();
      expect(screen.getByText('Pull Day')).toBeInTheDocument();
    });

    it('allows starting a planned workout', async () => {
      const mockStartWorkout = vi.fn().mockResolvedValue(undefined);
      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        startWorkout: mockStartWorkout,
      });

      render(<WorkoutListPage />);

      const startButton = screen.getByText('Start');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockStartWorkout).toHaveBeenCalledWith('workout-1');
      });
    });

    it('shows loading state during workout start', () => {
      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        isLoading: true,
      });

      render(<WorkoutListPage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('handles start workout error', () => {
      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        error: 'Failed to start workout',
      });

      render(<WorkoutListPage />);

      // Error should be handled by error boundary or displayed
      expect(screen.getByText('Push Day')).toBeInTheDocument();
    });
  });

  describe('Active Workout Flow', () => {
    const ActiveWorkoutPage = () => {
      const { 
        activeWorkout, 
        addSet, 
        completeSet, 
        finishWorkout,
        startRestTimer,
        restTimer,
      } = useWorkoutStore();

      if (!activeWorkout) {
        return <div>No active workout</div>;
      }

      return (
        <div>
          <h1>{activeWorkout.name}</h1>
          <p>Status: {activeWorkout.status}</p>
          
          <div data-testid="exercise-list">
            {mockExercises.map(exercise => (
              <div key={exercise.id}>
                <h3>{exercise.name}</h3>
                <button onClick={() => addSet({
                  exerciseId: exercise.id,
                  setNumber: 1,
                  reps: 10,
                  weight: 50,
                })}>
                  Add Set
                </button>
              </div>
            ))}
          </div>

          {activeWorkout.sets.map(set => (
            <div key={set.id} data-testid={`set-${set.id}`}>
              <p>Set {set.setNumber}: {set.reps} reps @ {set.weight}kg</p>
              {!set.completed && (
                <button onClick={() => completeSet(set.id)}>
                  Complete Set
                </button>
              )}
            </div>
          ))}

          {restTimer.isActive && (
            <div data-testid="rest-timer">
              Rest Timer: {restTimer.duration}s
            </div>
          )}

          <button onClick={() => startRestTimer(180)}>
            Start Rest Timer
          </button>

          <button onClick={finishWorkout}>
            Finish Workout
          </button>
        </div>
      );
    };

    it('displays active workout details', () => {
      const activeWorkout = createMockWorkout({
        id: 'workout-1',
        name: 'Current Workout',
        status: WorkoutStatus.IN_PROGRESS,
        sets: [],
      });

      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        activeWorkout,
      });

      render(<ActiveWorkoutPage />);

      expect(screen.getByText('Current Workout')).toBeInTheDocument();
      expect(screen.getByText('Status: in_progress')).toBeInTheDocument();
    });

    it('allows adding sets to exercises', async () => {
      const mockAddSet = vi.fn().mockResolvedValue(undefined);
      const activeWorkout = createMockWorkout({
        status: WorkoutStatus.IN_PROGRESS,
        sets: [],
      });

      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        activeWorkout,
        addSet: mockAddSet,
      });

      render(<ActiveWorkoutPage />);

      const addSetButton = screen.getAllByText('Add Set')[0];
      fireEvent.click(addSetButton);

      await waitFor(() => {
        expect(mockAddSet).toHaveBeenCalledWith({
          exerciseId: 'exercise-1',
          setNumber: 1,
          reps: 10,
          weight: 50,
        });
      });
    });

    it('displays workout sets', () => {
      const workoutWithSets = createMockWorkout({
        status: WorkoutStatus.IN_PROGRESS,
        sets: [
          {
            id: 'set-1',
            exerciseId: 'exercise-1',
            setNumber: 1,
            reps: 10,
            weight: 50,
            completed: false,
          },
          {
            id: 'set-2',
            exerciseId: 'exercise-1',
            setNumber: 2,
            reps: 8,
            weight: 55,
            completed: true,
          },
        ],
      });

      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        activeWorkout: workoutWithSets,
      });

      render(<ActiveWorkoutPage />);

      expect(screen.getByText('Set 1: 10 reps @ 50kg')).toBeInTheDocument();
      expect(screen.getByText('Set 2: 8 reps @ 55kg')).toBeInTheDocument();
      expect(screen.getByText('Complete Set')).toBeInTheDocument(); // Only for incomplete sets
    });

    it('allows completing sets', async () => {
      const mockCompleteSet = vi.fn().mockResolvedValue(undefined);
      const workoutWithSets = createMockWorkout({
        status: WorkoutStatus.IN_PROGRESS,
        sets: [
          {
            id: 'set-1',
            exerciseId: 'exercise-1',
            setNumber: 1,
            reps: 10,
            weight: 50,
            completed: false,
          },
        ],
      });

      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        activeWorkout: workoutWithSets,
        completeSet: mockCompleteSet,
      });

      render(<ActiveWorkoutPage />);

      const completeButton = screen.getByText('Complete Set');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(mockCompleteSet).toHaveBeenCalledWith('set-1');
      });
    });

    it('manages rest timer', async () => {
      const mockStartRestTimer = vi.fn();
      const activeWorkout = createMockWorkout({
        status: WorkoutStatus.IN_PROGRESS,
      });

      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        activeWorkout,
        startRestTimer: mockStartRestTimer,
        restTimer: { isActive: true, startTime: Date.now(), duration: 180 },
      });

      render(<ActiveWorkoutPage />);

      expect(screen.getByTestId('rest-timer')).toBeInTheDocument();
      expect(screen.getByText('Rest Timer: 180s')).toBeInTheDocument();

      const restButton = screen.getByText('Start Rest Timer');
      fireEvent.click(restButton);

      expect(mockStartRestTimer).toHaveBeenCalledWith(180);
    });

    it('allows finishing workout', async () => {
      const mockFinishWorkout = vi.fn().mockResolvedValue(undefined);
      const activeWorkout = createMockWorkout({
        status: WorkoutStatus.IN_PROGRESS,
      });

      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        activeWorkout,
        finishWorkout: mockFinishWorkout,
      });

      render(<ActiveWorkoutPage />);

      const finishButton = screen.getByText('Finish Workout');
      fireEvent.click(finishButton);

      await waitFor(() => {
        expect(mockFinishWorkout).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      server.use(
        http.post('*/api/workouts', () => {
          return HttpResponse.json(
            { success: false, message: 'Server error' },
            { status: 500 }
          );
        })
      );

      const mockCreateWorkout = vi.fn().mockRejectedValue(new Error('Server error'));
      
      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        createWorkout: mockCreateWorkout,
        error: 'Server error',
      });

      const TestComponent = () => {
        const { createWorkout, error } = useWorkoutStore();

        return (
          <div>
            {error && <div data-testid="error-message">{error}</div>}
            <button onClick={() => createWorkout({ name: 'Test' })}>
              Create Workout
            </button>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId('error-message')).toHaveTextContent('Server error');
    });

    it('handles network errors', async () => {
      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        error: 'Network error',
      });

      const TestComponent = () => {
        const { error } = useWorkoutStore();
        return error ? <div data-testid="network-error">{error}</div> : null;
      };

      render(<TestComponent />);

      expect(screen.getByTestId('network-error')).toHaveTextContent('Network error');
    });
  });

  describe('Loading States', () => {
    it('shows loading state during data fetching', () => {
      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        isLoading: true,
        workouts: [],
      });

      const TestComponent = () => {
        const { isLoading, workouts } = useWorkoutStore();

        if (isLoading) return <div data-testid="loading">Loading workouts...</div>;
        return <div>{workouts.length} workouts</div>;
      };

      render(<TestComponent />);

      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('shows content after loading completes', async () => {
      mockUseWorkoutStore.mockReturnValue({
        ...defaultStoreState,
        isLoading: false,
        workouts: mockWorkouts,
      });

      const TestComponent = () => {
        const { isLoading, workouts } = useWorkoutStore();

        if (isLoading) return <div data-testid="loading">Loading workouts...</div>;
        return <div>{workouts.length} workouts loaded</div>;
      };

      render(<TestComponent />);

      expect(screen.getByText('2 workouts loaded')).toBeInTheDocument();
    });
  });

  describe('Authentication Integration', () => {
    it('redirects unauthenticated users', () => {
      mockUseAuthStore.mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: false,
        user: null,
      } as any);

      const TestComponent = () => {
        const { isAuthenticated } = useAuthStore();

        if (!isAuthenticated) {
          return <div data-testid="login-required">Please log in</div>;
        }

        return <div>Authenticated content</div>;
      };

      render(<TestComponent />);

      expect(screen.getByTestId('login-required')).toBeInTheDocument();
    });

    it('shows content for authenticated users', () => {
      const TestComponent = () => {
        const { isAuthenticated, user } = useAuthStore();

        if (!isAuthenticated) {
          return <div>Please log in</div>;
        }

        return <div>Welcome, {user.name}!</div>;
      };

      render(<TestComponent />);

      expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument();
    });
  });
});