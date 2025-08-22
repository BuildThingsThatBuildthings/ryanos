// Core Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  instructions?: string[];
  videoUrl?: string;
  imageUrl?: string;
}

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weight?: number;
  time?: number; // seconds
  distance?: number; // meters
  rpe?: number; // 1-10 scale
  notes?: string;
  completed: boolean;
  completedAt?: string;
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  sets: WorkoutSet[];
  status: WorkoutStatus;
  totalVolume?: number;
  totalTime?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  type: GoalType;
  targetValue: number;
  currentValue: number;
  unit: string;
  targetDate: string;
  status: GoalStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceSession {
  id: string;
  userId: string;
  workoutId?: string;
  startTime: string;
  endTime?: string;
  transcript: string;
  processed: boolean;
  extractedData?: any;
  status: VoiceSessionStatus;
}

// Enums
export enum ExerciseCategory {
  STRENGTH = 'strength',
  CARDIO = 'cardio',
  FLEXIBILITY = 'flexibility',
  BALANCE = 'balance',
  MOBILITY = 'mobility',
  PLYOMETRIC = 'plyometric'
}

export enum MovementPattern {
  SQUAT = 'squat',
  HINGE = 'hinge',
  LUNGE = 'lunge',
  PUSH = 'push',
  PULL = 'pull',
  CARRY = 'carry',
  TWIST = 'twist',
  GAIT = 'gait'
}

export enum MuscleGroup {
  CHEST = 'chest',
  BACK = 'back',
  SHOULDERS = 'shoulders',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  FOREARMS = 'forearms',
  CORE = 'core',
  GLUTES = 'glutes',
  QUADRICEPS = 'quadriceps',
  HAMSTRINGS = 'hamstrings',
  CALVES = 'calves',
  TRAPS = 'traps',
  LATS = 'lats'
}

export enum Equipment {
  BARBELL = 'barbell',
  DUMBBELL = 'dumbbell',
  KETTLEBELL = 'kettlebell',
  CABLE = 'cable',
  MACHINE = 'machine',
  BODYWEIGHT = 'bodyweight',
  RESISTANCE_BAND = 'resistance_band',
  MEDICINE_BALL = 'medicine_ball',
  SUSPENSION_TRAINER = 'suspension_trainer',
  NONE = 'none'
}

export enum WorkoutStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum GoalType {
  WEIGHT = 'weight',
  REPS = 'reps',
  TIME = 'time',
  DISTANCE = 'distance',
  FREQUENCY = 'frequency',
  BODY_COMPOSITION = 'body_composition'
}

export enum GoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum VoiceSessionStatus {
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface WorkoutForm {
  name: string;
  description?: string;
  date: string;
  exerciseIds: string[];
}

export interface SetForm {
  exerciseId: string;
  reps?: number;
  weight?: number;
  time?: number;
  distance?: number;
  rpe?: number;
  notes?: string;
}

export interface GoalForm {
  title: string;
  description?: string;
  type: GoalType;
  targetValue: number;
  unit: string;
  targetDate: string;
  priority: Priority;
}

// UI State Types
export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  activeWorkout: Workout | null;
  voiceSession: VoiceSession | null;
  isOffline: boolean;
  syncQueue: any[];
}

// Navigation Types
export interface NavigationItem {
  path: string;
  label: string;
  icon: string;
  badge?: number;
}

// Training Load Types
export interface TrainingLoad {
  date: string;
  volume: number;
  intensity: number;
  load: number;
  movementPattern: MovementPattern;
  muscleGroups: MuscleGroup[];
}

export interface LoadSummary {
  weeklyVolume: number;
  weeklyIntensity: number;
  averageLoad: number;
  movementPatternDistribution: Record<MovementPattern, number>;
  muscleGroupDistribution: Record<MuscleGroup, number>;
  trend: 'increasing' | 'decreasing' | 'stable';
}

// Chart Data Types
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ProgressChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill?: boolean;
  }[];
}

// Offline Support Types
export interface SyncQueueItem {
  id: string;
  type: 'workout' | 'set' | 'goal' | 'voice';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: string;
  retryCount: number;
}

// IndexedDBSchema removed - offline functionality will be replaced with Supabase