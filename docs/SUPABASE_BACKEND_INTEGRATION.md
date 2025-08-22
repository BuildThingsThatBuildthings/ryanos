# Supabase Backend Integration Documentation

## Overview
Complete Supabase backend infrastructure for the fitness tracking app has been successfully created using MCP tools. This document provides comprehensive integration patterns and usage examples.

## Project Details
- **Project Name**: ryanos
- **Project ID**: hvcsabqpstetwqvwrwqu
- **Region**: us-east-2
- **Status**: ACTIVE_HEALTHY
- **Database Host**: db.hvcsabqpstetwqvwrwqu.supabase.co

## Created Resources Summary

### Database Schema (fitness_app)
- **11 Tables Created**:
  - `profiles` - User profiles linked to auth.users
  - `exercises` - Exercise master data
  - `workouts` - Workout templates
  - `workout_sessions` - Actual workout instances
  - `sets` - Exercise sets within sessions
  - `voice_recordings` - Voice recording metadata
  - `voice_sessions` - Continuous recording sessions
  - `llm_interactions` - AI interaction history
  - `workout_summaries` - Weekly/monthly summaries
  - `realtime_activity` - Realtime event tracking
  - `storage_objects` - Storage metadata tracking

### Security (RLS Policies)
- **19 Policies Created** ensuring users can only access their own data
- Public workout templates are readable by all authenticated users
- Service role can bypass RLS for backend operations

### Indexes
- **32 Indexes Created** for optimal query performance
- Covering user lookups, workout queries, and voice recording searches

### Triggers
- **3 Realtime Triggers**:
  - Workout session updates
  - New sets added
  - Voice recordings processed

### Edge Functions
- **4 Active Functions**:
  1. `auth-profile` - Authentication and profile management
  2. `workout-llm` - AI-powered workout generation and analysis
  3. `voice-processor` - Voice recording and transcription
  4. `workout-summary` - 7-day workout summaries with insights

## Integration Patterns

### 1. Authentication Flow
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvcsabqpstetwqvwrwqu.supabase.co',
  'your-anon-key'
)

// Sign up new user
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password'
})

// Create user profile
await supabase.from('profiles').insert({
  id: data.user.id,
  display_name: 'John Doe',
  timezone: 'America/New_York'
})
```

### 2. Workout Management
```javascript
// Create a workout template
const { data: workout } = await supabase
  .from('workouts')
  .insert({
    title: 'Morning Strength Training',
    description: 'Full body workout',
    tags: ['strength', 'morning'],
    is_public: false
  })
  .select()
  .single()

// Start a workout session
const { data: session } = await supabase
  .from('workout_sessions')
  .insert({
    workout_id: workout.id,
    started_at: new Date().toISOString()
  })
  .select()
  .single()

// Record sets
await supabase.from('sets').insert({
  session_id: session.id,
  exercise_id: 'exercise-uuid',
  set_number: 1,
  reps: 12,
  weight: 135
})
```

### 3. Voice Recording Integration
```javascript
// Start voice session
const response = await supabase.functions.invoke('voice-processor', {
  body: {
    action: 'create_session',
    payload: { workout_session_id: session.id }
  }
})

// Register recording after upload
await supabase.functions.invoke('voice-processor', {
  body: {
    action: 'register_recording',
    payload: {
      session_id: voiceSession.id,
      file_path: 'recordings/2024/12/audio.webm',
      duration_seconds: 45,
      file_size_bytes: 524288
    }
  }
})

// Transcribe recording
await supabase.functions.invoke('voice-processor', {
  body: {
    action: 'transcribe',
    payload: { recording_id: 'recording-uuid' }
  }
})
```

### 4. LLM Integration
```javascript
// Generate personalized workout
const { data } = await supabase.functions.invoke('workout-llm', {
  body: {
    action: 'generate_workout',
    payload: {
      preferences: { equipment: ['dumbbells', 'barbell'] },
      goals: 'muscle building',
      duration: 45
    }
  }
})

// Analyze workout session
await supabase.functions.invoke('workout-llm', {
  body: {
    action: 'analyze_session',
    payload: { session_id: 'session-uuid' }
  }
})

// Get exercise suggestions
await supabase.functions.invoke('workout-llm', {
  body: {
    action: 'suggest_exercises',
    payload: {
      muscle_group: 'chest',
      equipment: 'dumbbells',
      difficulty: 'intermediate'
    }
  }
})
```

### 5. Realtime Subscriptions
```javascript
// Subscribe to workout session updates
const channel = supabase
  .channel('workout-updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'fitness_app',
      table: 'workout_sessions',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Session updated:', payload)
    }
  )
  .subscribe()

// Subscribe to voice transcription completions
supabase
  .channel('voice-transcripts')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'fitness_app',
      table: 'voice_recordings',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      if (payload.new.transcript) {
        console.log('Transcript ready:', payload.new.transcript)
      }
    }
  )
  .subscribe()

// Subscribe to realtime activity channel
supabase
  .channel(`user-activity:${userId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'fitness_app',
      table: 'realtime_activity',
      filter: `channel=eq.workout_sessions:${userId}`
    },
    (payload) => {
      console.log('Activity:', payload.new)
    }
  )
  .subscribe()
```

### 6. Weekly Summary Generation
```javascript
// Generate 7-day summary
const { data: summary } = await supabase.functions.invoke('workout-summary')

console.log('Weekly Stats:', {
  workouts: summary.total_workouts,
  duration: summary.total_duration_minutes,
  calories: summary.total_calories,
  achievements: summary.achievements,
  insights: summary.insights
})
```

### 7. Storage Operations
```javascript
// Upload voice recording
const { data, error } = await supabase.storage
  .from('voice-recordings')
  .upload(`${userId}/${Date.now()}.webm`, audioBlob, {
    contentType: 'audio/webm'
  })

// Get signed URL for playback
const { data: signedUrl } = await supabase.storage
  .from('voice-recordings')
  .createSignedUrl(filePath, 3600) // 1 hour expiry

// Upload workout image
await supabase.storage
  .from('workout-images')
  .upload(`workouts/${sessionId}/photo.jpg`, imageFile, {
    contentType: 'image/jpeg',
    upsert: true
  })
```

## Required Environment Variables

Add these to your Supabase project secrets:
- `OPENAI_API_KEY` - For LLM and transcription services
- `SUPABASE_SERVICE_ROLE_KEY` - For backend operations (keep secure!)

## Storage Buckets to Create

Via Supabase Dashboard, create these buckets:
1. `voice-recordings` (Private)
2. `workout-images` (Public read)
3. `profile-avatars` (Public read)
4. `exports` (Private)

## API Endpoints

### Edge Functions
- `POST /functions/v1/workout-llm` - AI workout features
- `POST /functions/v1/voice-processor` - Voice processing
- `POST /functions/v1/workout-summary` - Generate summaries
- `POST /functions/v1/auth-profile` - Profile management

### REST API (Auto-generated)
- `/rest/v1/workouts` - CRUD operations on workouts
- `/rest/v1/workout_sessions` - Session management
- `/rest/v1/exercises` - Exercise database
- `/rest/v1/sets` - Set tracking
- `/rest/v1/voice_recordings` - Voice metadata

## Security Considerations

1. **Authentication Required**: All tables have RLS enabled
2. **User Isolation**: Users can only access their own data
3. **Public Sharing**: Workouts/exercises can be marked public
4. **Service Role**: Use only in secure backend environments
5. **API Keys**: Never expose service role key to clients

## Performance Optimizations

1. **Indexed Queries**: All foreign keys and common filters indexed
2. **Partial Indexes**: Public workout queries optimized
3. **Trigger Efficiency**: Minimal logic in database triggers
4. **Edge Function Caching**: Consider caching LLM responses
5. **Batch Operations**: Use batch inserts for multiple sets

## Monitoring & Maintenance

1. **Check Function Logs**: Monitor edge function execution
2. **Database Metrics**: Watch query performance
3. **Storage Usage**: Monitor bucket sizes
4. **API Limits**: Track LLM API usage
5. **Error Rates**: Monitor failed transcriptions

## Next Steps

1. **Configure Secrets**: Add API keys in Supabase dashboard
2. **Create Storage Buckets**: Via dashboard or API
3. **Test Integration**: Run end-to-end tests
4. **Setup Monitoring**: Enable logging and alerts
5. **Deploy Frontend**: Connect your app to the backend

## Troubleshooting

### Common Issues
- **RLS Errors**: Ensure user is authenticated
- **Function Timeouts**: Split large operations
- **Transcription Fails**: Check audio format and size
- **LLM Rate Limits**: Implement retry logic

### Debug Queries
```sql
-- Check user's workouts
SELECT * FROM fitness_app.workouts WHERE user_id = 'user-uuid';

-- View RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'fitness_app';

-- Monitor realtime activity
SELECT * FROM fitness_app.realtime_activity ORDER BY created_at DESC LIMIT 10;
```

## Support

For issues or questions:
- Supabase Dashboard: https://app.supabase.com/project/hvcsabqpstetwqvwrwqu
- Database URL: postgresql://postgres.[password]@db.hvcsabqpstetwqvwrwqu.supabase.co:5432/postgres

---

Backend infrastructure created successfully using MCP tools!