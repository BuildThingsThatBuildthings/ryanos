-- LLM Workout Generation System - Database Schema
-- This schema supports the new LLM-based workout generation with safety constraints

-- User profiles table with fitness and medical information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Fitness profile
  fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'intermediate',
  experience_years INTEGER DEFAULT 0,
  goals TEXT[] DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  
  -- Medical and safety information
  injury_history TEXT[] DEFAULT '{}',
  medical_conditions TEXT[] DEFAULT '{}',
  limitations TEXT[] DEFAULT '{}',
  allergies TEXT[] DEFAULT '{}',
  medications TEXT[] DEFAULT '{}',
  
  -- Physical characteristics
  age INTEGER,
  weight_kg DECIMAL,
  height_cm DECIMAL,
  body_fat_percentage DECIMAL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Enhanced exercises table with safety ratings and contraindications
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Exercise categorization
  category TEXT NOT NULL CHECK (category IN ('strength', 'cardio', 'flexibility', 'balance', 'mobility', 'plyometric')),
  movement_pattern TEXT CHECK (movement_pattern IN ('squat', 'hinge', 'lunge', 'push', 'pull', 'carry', 'twist', 'gait')),
  
  -- Target muscles
  primary_muscles TEXT[] NOT NULL DEFAULT '{}',
  secondary_muscles TEXT[] DEFAULT '{}',
  muscle_groups TEXT[] NOT NULL DEFAULT '{}',
  
  -- Equipment and setup
  equipment TEXT[] DEFAULT '{}',
  space_required TEXT DEFAULT 'small',
  setup_time_minutes INTEGER DEFAULT 2,
  
  -- Safety and difficulty
  safety_rating INTEGER NOT NULL DEFAULT 3 CHECK (safety_rating >= 1 AND safety_rating <= 5),
  difficulty_level INTEGER NOT NULL DEFAULT 3 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  skill_level_required TEXT CHECK (skill_level_required IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
  
  -- Safety information
  contraindications TEXT[] DEFAULT '{}', -- e.g., ['shoulder_injury', 'lower_back_injury']
  injury_considerations TEXT[] DEFAULT '{}',
  form_cues TEXT[] DEFAULT '{}',
  common_mistakes TEXT[] DEFAULT '{}',
  
  -- Exercise specifications
  is_compound BOOLEAN DEFAULT false,
  is_unilateral BOOLEAN DEFAULT false,
  is_bodyweight BOOLEAN DEFAULT true,
  requires_spotter BOOLEAN DEFAULT false,
  
  -- Instructions and media
  instructions TEXT[] DEFAULT '{}',
  modifications TEXT[] DEFAULT '{}',
  progressions TEXT[] DEFAULT '{}',
  regressions TEXT[] DEFAULT '{}',
  
  -- Media references
  video_url TEXT,
  image_url TEXT,
  animation_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_approved BOOLEAN DEFAULT false,
  approval_date TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id)
);

-- Workout plans table (enhanced from existing)
CREATE TABLE IF NOT EXISTS workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic workout info
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 240),
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  
  -- Workout structure
  exercises JSONB NOT NULL DEFAULT '[]',
  equipment_needed TEXT[] DEFAULT '{}',
  
  -- Generation info
  generated_by TEXT CHECK (generated_by IN ('llm', 'template', 'user')) NOT NULL,
  generation_prompt TEXT,
  llm_model_used TEXT,
  safety_validated BOOLEAN DEFAULT false,
  safety_score INTEGER CHECK (safety_score >= 0 AND safety_score <= 100),
  
  -- Metadata
  calories_estimate INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  is_template BOOLEAN DEFAULT false,
  parent_template_id UUID REFERENCES workout_plans(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workout generation logs for monitoring LLM performance
CREATE TABLE IF NOT EXISTS workout_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Generation details
  method TEXT NOT NULL CHECK (method IN ('llm', 'template', 'manual')),
  success BOOLEAN NOT NULL,
  workout_id UUID REFERENCES workout_plans(id),
  
  -- Request details
  constraints JSONB,
  preferences JSONB,
  
  -- Response details
  generation_time_ms INTEGER,
  llm_model_used TEXT,
  llm_tokens_used INTEGER,
  llm_cost_cents INTEGER,
  
  -- Error details
  error_message TEXT,
  error_code TEXT,
  fallback_used BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safety validation logs
CREATE TABLE IF NOT EXISTS safety_validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Validation details
  validation_type TEXT NOT NULL CHECK (validation_type IN ('workout', 'exercise', 'progression')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
  safety_score INTEGER NOT NULL CHECK (safety_score >= 0 AND safety_score <= 100),
  is_safe BOOLEAN NOT NULL,
  
  -- Violations
  violations_count INTEGER DEFAULT 0,
  critical_violations INTEGER DEFAULT 0,
  warning_violations INTEGER DEFAULT 0,
  
  -- Reference data
  workout_id UUID REFERENCES workout_plans(id),
  exercise_id UUID REFERENCES exercises(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exercise library curation and approval workflow
CREATE TABLE IF NOT EXISTS exercise_library_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Submission details
  submitted_by UUID REFERENCES auth.users(id) NOT NULL,
  exercise_data JSONB NOT NULL,
  submission_type TEXT CHECK (submission_type IN ('new', 'modification', 'flag_unsafe')) NOT NULL,
  
  -- Review process
  status TEXT CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  
  -- Safety assessment
  safety_assessment JSONB,
  risk_factors TEXT[],
  contraindications_verified BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workout sessions table (tracking actual workouts performed)
CREATE TABLE IF NOT EXISTS workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_plan_id UUID REFERENCES workout_plans(id),
  
  -- Session details
  status TEXT CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')) DEFAULT 'planned',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Performance tracking
  actual_exercises JSONB DEFAULT '[]',
  total_volume INTEGER DEFAULT 0,
  perceived_exertion INTEGER CHECK (perceived_exertion >= 1 AND perceived_exertion <= 10),
  
  -- Notes and feedback
  notes TEXT,
  session_rating INTEGER CHECK (session_rating >= 1 AND session_rating <= 5),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User workout statistics and progress tracking
CREATE TABLE IF NOT EXISTS user_workout_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Weekly aggregated stats
  week_start_date DATE NOT NULL,
  
  -- Volume metrics
  total_sets INTEGER DEFAULT 0,
  total_reps INTEGER DEFAULT 0,
  total_weight_kg DECIMAL DEFAULT 0,
  total_duration_minutes INTEGER DEFAULT 0,
  
  -- Frequency metrics
  workout_count INTEGER DEFAULT 0,
  avg_workout_duration DECIMAL DEFAULT 0,
  
  -- Intensity metrics
  avg_rpe DECIMAL,
  max_rpe INTEGER,
  
  -- Progress metrics
  volume_progression DECIMAL DEFAULT 0, -- Week over week change
  intensity_progression DECIMAL DEFAULT 0,
  consistency_score DECIMAL DEFAULT 0, -- 0-1 based on planned vs completed
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, week_start_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exercises_safety_rating ON exercises(safety_rating);
CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises USING GIN(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_groups ON exercises USING GIN(muscle_groups);
CREATE INDEX IF NOT EXISTS idx_exercises_contraindications ON exercises USING GIN(contraindications);

CREATE INDEX IF NOT EXISTS idx_workout_plans_user_id ON workout_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_generated_by ON workout_plans(generated_by);
CREATE INDEX IF NOT EXISTS idx_workout_plans_difficulty ON workout_plans(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_workout_plans_safety_validated ON workout_plans(safety_validated);

CREATE INDEX IF NOT EXISTS idx_workout_generation_logs_user_id ON workout_generation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_generation_logs_method ON workout_generation_logs(method);
CREATE INDEX IF NOT EXISTS idx_workout_generation_logs_success ON workout_generation_logs(success);
CREATE INDEX IF NOT EXISTS idx_workout_generation_logs_created_at ON workout_generation_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_safety_validation_logs_user_id ON safety_validation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_validation_logs_risk_level ON safety_validation_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_safety_validation_logs_is_safe ON safety_validation_logs(is_safe);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_status ON workout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_completed_at ON workout_sessions(completed_at);

CREATE INDEX IF NOT EXISTS idx_user_workout_stats_user_id ON user_workout_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workout_stats_week_start ON user_workout_stats(week_start_date);

-- Row Level Security (RLS) Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_validation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workout_stats ENABLE ROW LEVEL SECURITY;

-- User profiles - users can only access their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Workout plans - users can access their own plans and public plans
CREATE POLICY "Users can view own workout plans" ON workout_plans
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can create own workout plans" ON workout_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout plans" ON workout_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout plans" ON workout_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Logs - users can only access their own logs
CREATE POLICY "Users can view own generation logs" ON workout_generation_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own safety logs" ON safety_validation_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Workout sessions - users can only access their own sessions
CREATE POLICY "Users can view own workout sessions" ON workout_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own workout sessions" ON workout_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout sessions" ON workout_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- User stats - users can only access their own stats
CREATE POLICY "Users can view own workout stats" ON user_workout_stats
  FOR SELECT USING (auth.uid() = user_id);

-- Exercises table - readable by all authenticated users, but only approved exercises
CREATE POLICY "Authenticated users can view approved exercises" ON exercises
  FOR SELECT USING (auth.role() = 'authenticated' AND is_approved = true);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_plans_updated_at BEFORE UPDATE ON workout_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exercise_library_submissions_updated_at BEFORE UPDATE ON exercise_library_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_sessions_updated_at BEFORE UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_workout_stats_updated_at BEFORE UPDATE ON user_workout_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample safe exercises data for the library
INSERT INTO exercises (
  name, category, movement_pattern, primary_muscles, secondary_muscles, muscle_groups,
  equipment, safety_rating, difficulty_level, skill_level_required,
  contraindications, injury_considerations, is_compound, is_bodyweight,
  instructions, modifications, progressions, regressions, is_approved
) VALUES 
(
  'Bodyweight Squat',
  'strength',
  'squat',
  '["quadriceps", "glutes"]',
  '["hamstrings", "core"]',
  '["quadriceps", "glutes", "hamstrings", "core"]',
  '["bodyweight"]',
  5, -- Very safe
  1, -- Easy difficulty
  'beginner',
  '[]', -- No contraindications
  '["Avoid if severe knee pain"]',
  true, -- Compound movement
  true, -- Bodyweight
  '["Stand with feet shoulder-width apart", "Lower your body by pushing hips back and bending knees", "Keep chest up and knees in line with toes", "Lower until thighs are parallel to floor", "Push through heels to return to standing"]',
  '["Hold onto a chair for balance", "Reduce range of motion", "Add jump for advanced"]',
  '["Single-leg squat", "Jump squat", "Weighted squat"]',
  '["Chair-assisted squat", "Partial range squat"]',
  true
),
(
  'Push-up',
  'strength',
  'push',
  '["chest", "triceps"]',
  '["shoulders", "core"]',
  '["chest", "triceps", "shoulders", "core"]',
  '["bodyweight"]',
  4, -- Safe with proper form
  2, -- Moderate difficulty
  'beginner',
  '["wrist_injury", "shoulder_impingement"]',
  '["Modify if wrist or shoulder pain"]',
  true, -- Compound movement
  true, -- Bodyweight
  '["Start in plank position with hands slightly wider than shoulders", "Lower chest toward floor while keeping body straight", "Push back up to starting position", "Keep core engaged throughout"]',
  '["Knee push-up", "Incline push-up against wall or bench", "Diamond push-up for advanced"]',
  '["Single-arm push-up", "Plyometric push-up", "Weighted push-up"]',
  '["Wall push-up", "Incline push-up", "Knee push-up"]',
  true
),
(
  'Plank',
  'strength',
  'gait',
  '["core"]',
  '["shoulders", "glutes"]',
  '["core", "shoulders", "glutes"]',
  '["bodyweight"]',
  5, -- Very safe
  1, -- Easy to moderate
  'beginner',
  '["lower_back_injury"]',
  '["Avoid if lower back pain", "Don''t hold breath"]',
  true, -- Isometric compound
  true, -- Bodyweight
  '["Start in push-up position with forearms on ground", "Keep body in straight line from head to heels", "Engage core and breathe normally", "Hold position for prescribed time"]',
  '["Knee plank", "Incline plank", "Side plank for variation"]',
  '["Single-arm plank", "Plank with leg lift", "Plank to push-up"]',
  '["Wall plank", "Incline plank", "Knee plank"]',
  true
);

-- Sample user profile for testing
-- Note: This would typically be created when a user registers
-- INSERT INTO user_profiles (user_id, fitness_level, goals) VALUES 
-- ((SELECT id FROM auth.users LIMIT 1), 'intermediate', '["weight_loss", "strength_building"]');

COMMENT ON TABLE exercises IS 'Curated exercise library with safety ratings and contraindications';
COMMENT ON TABLE workout_plans IS 'Generated and user-created workout plans with safety validation';
COMMENT ON TABLE workout_generation_logs IS 'Logs all workout generation attempts for monitoring LLM performance';
COMMENT ON TABLE safety_validation_logs IS 'Logs all safety validations for monitoring and compliance';
COMMENT ON TABLE user_profiles IS 'Extended user profiles with fitness and medical information';