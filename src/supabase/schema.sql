-- Fitness Tracker Database Schema for Supabase
-- This schema follows the PRD requirements exactly

-- UUID generation is built-in for PostgreSQL 17
-- No extension needed for gen_random_uuid()

-- Create custom types
CREATE TYPE goal_type AS ENUM ('strength', 'endurance', 'hypertrophy', 'general');
CREATE TYPE workout_intent AS ENUM ('strength', 'metcon', 'recovery', 'skill');
CREATE TYPE workout_creator AS ENUM ('llm', 'user');
CREATE TYPE log_type AS ENUM ('edit', 'delete', 'add');
CREATE TYPE log_entity AS ENUM ('workout', 'set', 'exercise');
CREATE TYPE voice_event_type AS ENUM ('utterance', 'confirmation', 'correction', 'system');
CREATE TYPE exercise_status AS ENUM ('active', 'archived');
CREATE TYPE movement_pattern AS ENUM ('hinge', 'squat', 'push', 'pull', 'carry', 'rotational', 'other');

-- 1. Users table (integrated with Supabase Auth)
-- Note: Supabase uses auth.users table for authentication
-- This extends it with fitness-specific data
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Goals table
CREATE TABLE public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type goal_type NOT NULL,
    target_metrics JSONB NOT NULL DEFAULT '{}',
    horizon_days INTEGER NOT NULL CHECK (horizon_days > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Equipment table
CREATE TABLE public.equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    available BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 4. Exercises table
CREATE TABLE public.exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    primary_muscles TEXT[] DEFAULT '{}',
    secondary_muscles TEXT[] DEFAULT '{}',
    movement_pattern movement_pattern NOT NULL,
    equipment_required TEXT[] DEFAULT '{}',
    instruction TEXT,
    video_url TEXT,
    status exercise_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 5. Workouts table
CREATE TABLE public.workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title TEXT NOT NULL,
    intent workout_intent NOT NULL,
    created_by workout_creator NOT NULL DEFAULT 'user',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Sets table
CREATE TABLE public.sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id),
    set_index INTEGER NOT NULL CHECK (set_index >= 0),
    reps INTEGER,
    weight_kg DECIMAL(10,2),
    rpe DECIMAL(3,1) CHECK (rpe >= 0 AND rpe <= 10),
    duration_sec INTEGER CHECK (duration_sec >= 0),
    distance_m INTEGER CHECK (distance_m >= 0),
    tempo TEXT,
    rest_sec INTEGER CHECK (rest_sec >= 0),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Logs table (for audit trail)
CREATE TABLE public.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type log_type NOT NULL,
    entity log_entity NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Nutrition daily table
CREATE TABLE public.nutrition_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    calories INTEGER CHECK (calories >= 0),
    protein_g DECIMAL(10,2) CHECK (protein_g >= 0),
    carbs_g DECIMAL(10,2) CHECK (carbs_g >= 0),
    fat_g DECIMAL(10,2) CHECK (fat_g >= 0),
    micro_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 9. Voice sessions table
CREATE TABLE public.voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    device TEXT,
    locale TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Voice events table
CREATE TABLE public.voice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_session_id UUID NOT NULL REFERENCES public.voice_sessions(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type voice_event_type NOT NULL,
    transcript TEXT,
    intent TEXT,
    json_payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_goals_user_id ON public.goals(user_id);
CREATE INDEX idx_equipment_user_id ON public.equipment(user_id);
CREATE INDEX idx_exercises_user_id ON public.exercises(user_id);
CREATE INDEX idx_exercises_status ON public.exercises(status);
CREATE INDEX idx_exercises_movement_pattern ON public.exercises(movement_pattern);
CREATE INDEX idx_workouts_user_id ON public.workouts(user_id);
CREATE INDEX idx_workouts_date ON public.workouts(date);
CREATE INDEX idx_sets_workout_id ON public.sets(workout_id);
CREATE INDEX idx_sets_exercise_id ON public.sets(exercise_id);
CREATE INDEX idx_logs_user_id ON public.logs(user_id);
CREATE INDEX idx_logs_created_at ON public.logs(created_at);
CREATE INDEX idx_nutrition_daily_user_id ON public.nutrition_daily(user_id);
CREATE INDEX idx_nutrition_daily_date ON public.nutrition_daily(date);
CREATE INDEX idx_voice_sessions_user_id ON public.voice_sessions(user_id);
CREATE INDEX idx_voice_events_session_id ON public.voice_events(voice_session_id);
CREATE INDEX idx_voice_events_ts ON public.voice_events(ts);

-- GIN indexes for JSONB and arrays
CREATE INDEX idx_goals_target_metrics ON public.goals USING GIN (target_metrics);
CREATE INDEX idx_exercises_tags ON public.exercises USING GIN (tags);
CREATE INDEX idx_exercises_primary_muscles ON public.exercises USING GIN (primary_muscles);
CREATE INDEX idx_logs_payload ON public.logs USING GIN (payload);
CREATE INDEX idx_voice_events_payload ON public.voice_events USING GIN (json_payload);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
-- Users table
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Goals table
CREATE POLICY "Users can manage own goals" ON public.goals
    FOR ALL USING (auth.uid() = user_id);

-- Equipment table
CREATE POLICY "Users can manage own equipment" ON public.equipment
    FOR ALL USING (auth.uid() = user_id);

-- Exercises table
CREATE POLICY "Users can manage own exercises" ON public.exercises
    FOR ALL USING (auth.uid() = user_id);

-- Workouts table
CREATE POLICY "Users can manage own workouts" ON public.workouts
    FOR ALL USING (auth.uid() = user_id);

-- Sets table (through workout ownership)
CREATE POLICY "Users can manage own sets" ON public.sets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workouts
            WHERE workouts.id = sets.workout_id
            AND workouts.user_id = auth.uid()
        )
    );

-- Logs table
CREATE POLICY "Users can manage own logs" ON public.logs
    FOR ALL USING (auth.uid() = user_id);

-- Nutrition daily table
CREATE POLICY "Users can manage own nutrition" ON public.nutrition_daily
    FOR ALL USING (auth.uid() = user_id);

-- Voice sessions table
CREATE POLICY "Users can manage own voice sessions" ON public.voice_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Voice events table (through session ownership)
CREATE POLICY "Users can manage own voice events" ON public.voice_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.voice_sessions
            WHERE voice_sessions.id = voice_events.voice_session_id
            AND voice_sessions.user_id = auth.uid()
        )
    );

-- Create functions for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON public.exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON public.workouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sets_updated_at BEFORE UPDATE ON public.sets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_nutrition_daily_updated_at BEFORE UPDATE ON public.nutrition_daily
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_voice_sessions_updated_at BEFORE UPDATE ON public.voice_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.workouts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.exercises;

-- Create view for 7-day summary (used by the API)
CREATE OR REPLACE VIEW public.workout_summary_7d AS
SELECT 
    w.user_id,
    COUNT(DISTINCT w.id) as workout_count,
    COUNT(s.id) as total_sets,
    SUM(s.reps * s.weight_kg) as total_volume,
    AVG(s.rpe) as avg_rpe,
    json_object_agg(
        DISTINCT e.movement_pattern,
        json_build_object(
            'count', COUNT(s.id) FILTER (WHERE e.movement_pattern IS NOT NULL),
            'volume', SUM(s.reps * s.weight_kg) FILTER (WHERE e.movement_pattern IS NOT NULL)
        )
    ) as pattern_distribution
FROM public.workouts w
LEFT JOIN public.sets s ON w.id = s.workout_id
LEFT JOIN public.exercises e ON s.exercise_id = e.id
WHERE w.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY w.user_id;

-- Grant permissions for the view
GRANT SELECT ON public.workout_summary_7d TO authenticated;

-- Create function for workout generation validation
CREATE OR REPLACE FUNCTION validate_workout_plan(
    p_user_id UUID,
    p_exercise_ids UUID[]
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if all exercises belong to the user and are active
    RETURN NOT EXISTS (
        SELECT 1
        FROM unnest(p_exercise_ids) AS exercise_id
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.exercises e
            WHERE e.id = exercise_id
            AND e.user_id = p_user_id
            AND e.status = 'active'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for exercise fuzzy matching
CREATE OR REPLACE FUNCTION find_similar_exercises(
    p_user_id UUID,
    p_search_term TEXT,
    p_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.name,
        similarity(e.name, p_search_term) AS similarity
    FROM public.exercises e
    WHERE e.user_id = p_user_id
    AND e.status = 'active'
    AND similarity(e.name, p_search_term) > p_threshold
    ORDER BY similarity DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;