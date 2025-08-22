import {
  User,
  Workout,
  Exercise,
  Goal,
  VoiceSession,
  WorkoutSet,
  ExerciseCategory,
  MovementPattern,
  MuscleGroup,
  Equipment,
  WorkoutStatus,
  GoalType,
  GoalStatus,
  Priority,
  VoiceSessionStatus,
} from '../../../types';

export const mockUsers: User[] = [
  {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    email: 'jane@example.com',
    name: 'Jane Doe',
    createdAt: '2023-01-02T00:00:00Z',
    updatedAt: '2023-01-02T00:00:00Z',
  },
];

export const mockExercises: Exercise[] = [
  {
    id: 'exercise-1',
    name: 'Push-ups',
    description: 'Classic bodyweight exercise',
    category: ExerciseCategory.STRENGTH,
    movementPattern: MovementPattern.PUSH,
    primaryMuscles: [MuscleGroup.CHEST, MuscleGroup.SHOULDERS, MuscleGroup.TRICEPS],
    secondaryMuscles: [MuscleGroup.CORE],
    equipment: [Equipment.BODYWEIGHT],
    instructions: [
      'Start in a plank position',
      'Lower your body until chest nearly touches floor',
      'Push back up to starting position',
    ],
  },
  {
    id: 'exercise-2',
    name: 'Squats',
    description: 'Fundamental lower body movement',
    category: ExerciseCategory.STRENGTH,
    movementPattern: MovementPattern.SQUAT,
    primaryMuscles: [MuscleGroup.QUADRICEPS, MuscleGroup.GLUTES],
    secondaryMuscles: [MuscleGroup.HAMSTRINGS, MuscleGroup.CALVES, MuscleGroup.CORE],
    equipment: [Equipment.BODYWEIGHT],
    instructions: [
      'Stand with feet shoulder-width apart',
      'Lower hips back and down',
      'Keep chest up and knees tracking over toes',
      'Return to standing position',
    ],
  },
  {
    id: 'exercise-3',
    name: 'Deadlift',
    description: 'Compound posterior chain exercise',
    category: ExerciseCategory.STRENGTH,
    movementPattern: MovementPattern.HINGE,
    primaryMuscles: [MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES, MuscleGroup.BACK],
    secondaryMuscles: [MuscleGroup.TRAPS, MuscleGroup.FOREARMS, MuscleGroup.CORE],
    equipment: [Equipment.BARBELL],
  },
  {
    id: 'exercise-4',
    name: 'Running',
    description: 'Cardiovascular endurance exercise',
    category: ExerciseCategory.CARDIO,
    movementPattern: MovementPattern.GAIT,
    primaryMuscles: [MuscleGroup.QUADRICEPS, MuscleGroup.CALVES],
    secondaryMuscles: [MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES],
    equipment: [Equipment.NONE],
  },
];

export const mockSets: WorkoutSet[] = [
  {
    id: 'set-1',
    exerciseId: 'exercise-1',
    setNumber: 1,
    reps: 10,
    weight: null,
    completed: true,
    completedAt: '2023-01-01T10:15:00Z',
  },
  {
    id: 'set-2',
    exerciseId: 'exercise-1',
    setNumber: 2,
    reps: 8,
    weight: null,
    completed: true,
    completedAt: '2023-01-01T10:18:00Z',
  },
  {
    id: 'set-3',
    exerciseId: 'exercise-2',
    setNumber: 1,
    reps: 15,
    weight: null,
    completed: false,
  },
];

export const mockWorkouts: Workout[] = [
  {
    id: 'workout-1',
    userId: 'user-1',
    name: 'Upper Body Strength',
    description: 'Focus on chest, shoulders, and arms',
    date: '2023-01-01',
    startTime: '2023-01-01T10:00:00Z',
    endTime: '2023-01-01T10:45:00Z',
    sets: mockSets.slice(0, 2),
    status: WorkoutStatus.COMPLETED,
    totalVolume: 18,
    totalTime: 45,
    notes: 'Great workout, felt strong',
    createdAt: '2023-01-01T09:00:00Z',
    updatedAt: '2023-01-01T10:45:00Z',
  },
  {
    id: 'workout-2',
    userId: 'user-1',
    name: 'Lower Body Power',
    description: 'Legs and glutes focus',
    date: '2023-01-03',
    sets: [mockSets[2]],
    status: WorkoutStatus.IN_PROGRESS,
    createdAt: '2023-01-03T09:00:00Z',
    updatedAt: '2023-01-03T09:15:00Z',
  },
  {
    id: 'workout-3',
    userId: 'user-1',
    name: 'Full Body Circuit',
    description: 'High intensity circuit training',
    date: '2023-01-05',
    sets: [],
    status: WorkoutStatus.PLANNED,
    createdAt: '2023-01-04T20:00:00Z',
    updatedAt: '2023-01-04T20:00:00Z',
  },
];

export const mockGoals: Goal[] = [
  {
    id: 'goal-1',
    userId: 'user-1',
    title: 'Bench Press 100kg',
    description: 'Increase bench press to 100kg for 1 rep max',
    type: GoalType.WEIGHT,
    targetValue: 100,
    currentValue: 85,
    unit: 'kg',
    targetDate: '2023-06-01',
    status: GoalStatus.ACTIVE,
    priority: Priority.HIGH,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-15T00:00:00Z',
  },
  {
    id: 'goal-2',
    userId: 'user-1',
    title: 'Run 5K in 25 minutes',
    description: 'Improve 5K running time',
    type: GoalType.TIME,
    targetValue: 25,
    currentValue: 28,
    unit: 'minutes',
    targetDate: '2023-04-01',
    status: GoalStatus.ACTIVE,
    priority: Priority.MEDIUM,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-10T00:00:00Z',
  },
  {
    id: 'goal-3',
    userId: 'user-1',
    title: '100 Push-ups',
    description: 'Do 100 push-ups in a row',
    type: GoalType.REPS,
    targetValue: 100,
    currentValue: 50,
    unit: 'reps',
    targetDate: '2023-03-01',
    status: GoalStatus.COMPLETED,
    priority: Priority.LOW,
    createdAt: '2022-12-01T00:00:00Z',
    updatedAt: '2023-02-28T00:00:00Z',
  },
];

export const mockVoiceSessions: VoiceSession[] = [
  {
    id: 'voice-1',
    userId: 'user-1',
    workoutId: 'workout-1',
    startTime: '2023-01-01T10:00:00Z',
    endTime: '2023-01-01T10:05:00Z',
    transcript: 'I did 10 push-ups, then 8 more push-ups with good form',
    processed: true,
    extractedData: {
      exercises: [
        {
          name: 'Push-ups',
          sets: [
            { reps: 10 },
            { reps: 8 },
          ],
        },
      ],
    },
    status: VoiceSessionStatus.COMPLETED,
  },
  {
    id: 'voice-2',
    userId: 'user-1',
    workoutId: 'workout-2',
    startTime: '2023-01-03T09:00:00Z',
    transcript: 'Starting my leg workout with 15 squats',
    processed: false,
    status: VoiceSessionStatus.PROCESSING,
  },
];

// Mock API error responses
export const mockErrorResponses = {
  unauthorized: {
    success: false,
    message: 'Unauthorized access',
    error: 'UNAUTHORIZED',
  },
  notFound: {
    success: false,
    message: 'Resource not found',
    error: 'NOT_FOUND',
  },
  validationError: {
    success: false,
    message: 'Validation failed',
    error: 'VALIDATION_ERROR',
    details: [
      { field: 'name', message: 'Name is required' },
      { field: 'email', message: 'Invalid email format' },
    ],
  },
  serverError: {
    success: false,
    message: 'Internal server error',
    error: 'INTERNAL_ERROR',
  },
};

// Test data factories
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: `user-${Date.now()}`,
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  id: `workout-${Date.now()}`,
  userId: 'user-1',
  name: 'Test Workout',
  date: new Date().toISOString().split('T')[0],
  sets: [],
  status: WorkoutStatus.PLANNED,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: `exercise-${Date.now()}`,
  name: 'Test Exercise',
  category: ExerciseCategory.STRENGTH,
  movementPattern: MovementPattern.PUSH,
  primaryMuscles: [MuscleGroup.CHEST],
  secondaryMuscles: [],
  equipment: [Equipment.BODYWEIGHT],
  ...overrides,
});

export const createMockSet = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `set-${Date.now()}`,
  exerciseId: 'exercise-1',
  setNumber: 1,
  reps: 10,
  completed: false,
  ...overrides,
});

export const createMockGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: `goal-${Date.now()}`,
  userId: 'user-1',
  title: 'Test Goal',
  type: GoalType.WEIGHT,
  targetValue: 100,
  currentValue: 50,
  unit: 'kg',
  targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: GoalStatus.ACTIVE,
  priority: Priority.MEDIUM,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});