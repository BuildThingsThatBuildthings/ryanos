-- Supabase Storage Configuration for Voice Recordings
-- Run this in your Supabase SQL Editor

-- Create voice-recordings storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-recordings', 
  'voice-recordings', 
  false,  -- Private bucket
  52428800,  -- 50MB max file size
  ARRAY[
    'audio/webm', 
    'audio/wav', 
    'audio/mp3', 
    'audio/m4a',
    'audio/ogg',
    'audio/webm;codecs=opus'
  ]
);

-- Create RLS policies for voice recordings bucket
-- Users can only access their own voice recordings
CREATE POLICY "Users can upload their own voice recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own voice recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'voice-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own voice recordings"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'voice-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own voice recordings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'voice-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Update voice_sessions table to include audio file reference
ALTER TABLE public.voice_sessions 
ADD COLUMN IF NOT EXISTS audio_file_path TEXT,
ADD COLUMN IF NOT EXISTS audio_file_size BIGINT,
ADD COLUMN IF NOT EXISTS audio_duration REAL,
ADD COLUMN IF NOT EXISTS audio_format TEXT DEFAULT 'audio/webm';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_audio 
  ON public.voice_sessions(user_id, audio_file_path) 
  WHERE audio_file_path IS NOT NULL;

-- Add function to get signed URL for voice recordings
CREATE OR REPLACE FUNCTION get_voice_recording_url(
  session_id UUID,
  expires_in INTEGER DEFAULT 3600
) RETURNS TEXT AS $$
DECLARE
  file_path TEXT;
  signed_url TEXT;
BEGIN
  -- Get the file path from voice session
  SELECT audio_file_path INTO file_path
  FROM voice_sessions
  WHERE id = session_id
    AND user_id = auth.uid()
    AND audio_file_path IS NOT NULL;

  IF file_path IS NULL THEN
    RETURN NULL;
  END IF;

  -- Generate signed URL
  SELECT storage.create_signed_url('voice-recordings', file_path, expires_in) INTO signed_url;
  
  RETURN signed_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to clean up old voice recordings (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_voice_recordings()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  old_files RECORD;
BEGIN
  -- Delete recordings older than 90 days
  FOR old_files IN
    SELECT audio_file_path
    FROM voice_sessions
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND audio_file_path IS NOT NULL
  LOOP
    -- Delete from storage
    PERFORM storage.delete_object('voice-recordings', old_files.audio_file_path);
    deleted_count := deleted_count + 1;
  END LOOP;

  -- Update database records
  UPDATE voice_sessions
  SET audio_file_path = NULL,
      audio_file_size = NULL,
      audio_duration = NULL
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND audio_file_path IS NOT NULL;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run cleanup weekly (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-voice-recordings', '0 2 * * 0', 'SELECT cleanup_old_voice_recordings();');

-- Add helpful metadata columns for voice analysis
ALTER TABLE public.voice_sessions
ADD COLUMN IF NOT EXISTS confidence_score REAL,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS word_count INTEGER,
ADD COLUMN IF NOT EXISTS language_detected TEXT DEFAULT 'en';

-- Update RLS policies for voice_sessions if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_sessions' 
    AND policyname = 'Users can access their own voice sessions'
  ) THEN
    CREATE POLICY "Users can access their own voice sessions"
      ON public.voice_sessions
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Enable RLS on voice_sessions table
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;

-- Add trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_voice_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS voice_sessions_updated_at ON public.voice_sessions;
CREATE TRIGGER voice_sessions_updated_at
  BEFORE UPDATE ON public.voice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_session_timestamp();

-- Create materialized view for voice analytics (optional)
CREATE MATERIALIZED VIEW IF NOT EXISTS voice_session_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  user_id,
  COUNT(*) as session_count,
  AVG(audio_duration) as avg_duration,
  AVG(confidence_score) as avg_confidence,
  AVG(word_count) as avg_word_count,
  SUM(audio_file_size) as total_storage_used
FROM voice_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), user_id;

-- Create unique index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS voice_analytics_date_user_idx
  ON voice_session_analytics(date, user_id);

-- Add function to refresh analytics (can be called periodically)
CREATE OR REPLACE FUNCTION refresh_voice_analytics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY voice_session_analytics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE voice_sessions IS 'Stores voice recording sessions with audio file references and processing metadata';
COMMENT ON COLUMN voice_sessions.audio_file_path IS 'Storage path to the audio file in voice-recordings bucket';
COMMENT ON COLUMN voice_sessions.audio_duration IS 'Duration of the audio recording in seconds';
COMMENT ON COLUMN voice_sessions.confidence_score IS 'Average confidence score from speech recognition (0-1)';
COMMENT ON FUNCTION get_voice_recording_url IS 'Generates a signed URL for accessing voice recordings with security';