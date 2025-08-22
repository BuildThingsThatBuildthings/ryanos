import { supabase, handleSupabaseError } from '../lib/supabase';
import { VoiceSession, VoiceSessionStatus } from '../types';

export interface VoiceUploadResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

export interface VoicePlaybackUrl {
  url: string;
  expiresAt: Date;
}

export interface AudioMetadata {
  duration: number;
  format: string;
  size: number;
  channels?: number;
  sampleRate?: number;
}

/**
 * Upload voice recording to Supabase Storage
 */
export const uploadVoiceRecording = async (
  audioBlob: Blob,
  sessionId: string,
  userId: string
): Promise<VoiceUploadResult> => {
  try {
    // Generate unique file path with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = getFileExtension(audioBlob.type);
    const fileName = `${sessionId}-${timestamp}.${extension}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to storage
    const { data, error } = await supabase.storage
      .from('voice-recordings')
      .upload(filePath, audioBlob, {
        contentType: audioBlob.type,
        upsert: false, // Don't overwrite existing files
        cacheControl: '3600', // Cache for 1 hour
      });

    if (error) {
      console.error('Storage upload error:', error);
      return {
        success: false,
        error: handleSupabaseError(error),
      };
    }

    return {
      success: true,
      filePath: data.path,
      fileSize: audioBlob.size,
    };
  } catch (error: any) {
    console.error('Voice upload failed:', error);
    return {
      success: false,
      error: handleSupabaseError(error),
    };
  }
};

/**
 * Get signed URL for voice playback
 */
export const getVoicePlaybackUrl = async (
  filePath: string,
  expiresIn: number = 3600
): Promise<VoicePlaybackUrl | null> => {
  try {
    const { data, error } = await supabase.storage
      .from('voice-recordings')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Signed URL creation failed:', error);
      return null;
    }

    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  } catch (error: any) {
    console.error('Failed to create playback URL:', error);
    return null;
  }
};

/**
 * Delete voice recording from storage
 */
export const deleteVoiceRecording = async (filePath: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from('voice-recordings')
      .remove([filePath]);

    if (error) {
      console.error('Storage deletion failed:', error);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('Voice deletion failed:', error);
    return false;
  }
};

/**
 * Update voice session with audio file information
 */
export const updateVoiceSessionWithAudio = async (
  sessionId: string,
  audioData: {
    filePath: string;
    fileSize: number;
    duration?: number;
    format?: string;
  }
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('voice_sessions')
      .update({
        audio_file_path: audioData.filePath,
        audio_file_size: audioData.fileSize,
        audio_duration: audioData.duration,
        audio_format: audioData.format,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Session update failed:', error);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('Failed to update session with audio data:', error);
    return false;
  }
};

/**
 * Get voice session with signed URL for playback
 */
export const getVoiceSessionWithPlayback = async (
  sessionId: string
): Promise<(VoiceSession & { playbackUrl?: string }) | null> => {
  try {
    const { data, error } = await supabase
      .from('voice_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Failed to fetch voice session:', error);
      return null;
    }

    const session: VoiceSession = {
      id: data.id,
      userId: data.user_id,
      workoutId: data.workout_id,
      startTime: data.start_time,
      endTime: data.end_time,
      transcript: data.transcript,
      processed: data.processed,
      extractedData: data.extracted_data,
      status: data.status as VoiceSessionStatus,
    };

    // Get playback URL if audio file exists
    let playbackUrl: string | undefined;
    if (data.audio_file_path) {
      const urlData = await getVoicePlaybackUrl(data.audio_file_path, 3600);
      playbackUrl = urlData?.url;
    }

    return {
      ...session,
      playbackUrl,
    };
  } catch (error: any) {
    console.error('Failed to get voice session with playback:', error);
    return null;
  }
};

/**
 * Analyze audio metadata from blob
 */
export const analyzeAudioMetadata = (audioBlob: Blob): Promise<AudioMetadata> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(audioBlob);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
    };

    const onLoadedMetadata = () => {
      const metadata: AudioMetadata = {
        duration: audio.duration,
        format: audioBlob.type,
        size: audioBlob.size,
      };

      cleanup();
      resolve(metadata);
    };

    const onError = () => {
      cleanup();
      reject(new Error('Failed to analyze audio metadata'));
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);
    audio.src = objectUrl;
  });
};

/**
 * Get file extension from MIME type
 */
const getFileExtension = (mimeType: string): string => {
  const extensions: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/webm;codecs=opus': 'webm',
    'audio/wav': 'wav',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/x-m4a': 'm4a',
  };

  return extensions[mimeType] || 'webm';
};

/**
 * Convert audio blob to different format (if needed)
 */
export const convertAudioFormat = async (
  audioBlob: Blob,
  targetFormat: string = 'audio/webm'
): Promise<Blob> => {
  // If already in target format, return as is
  if (audioBlob.type === targetFormat) {
    return audioBlob;
  }

  // For now, return the original blob
  // In the future, we could implement client-side audio conversion
  // using Web APIs or a library like ffmpeg.wasm
  return audioBlob;
};

/**
 * Estimate audio compression ratio
 */
export const estimateCompressionRatio = (
  originalSize: number,
  duration: number
): number => {
  // Estimate based on duration and common compression ratios
  // For webm/opus: ~64kbps = 8KB/s
  const estimatedCompressedSize = duration * 8000; // 8KB per second
  return originalSize / estimatedCompressedSize;
};

/**
 * Batch upload multiple voice recordings
 */
export const batchUploadVoiceRecordings = async (
  recordings: Array<{
    audioBlob: Blob;
    sessionId: string;
    userId: string;
  }>
): Promise<VoiceUploadResult[]> => {
  const results = await Promise.allSettled(
    recordings.map(({ audioBlob, sessionId, userId }) =>
      uploadVoiceRecording(audioBlob, sessionId, userId)
    )
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        error: `Upload failed for recording ${index + 1}: ${result.reason}`,
      };
    }
  });
};

/**
 * Get user's voice storage usage
 */
export const getVoiceStorageUsage = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('voice_sessions')
      .select('audio_file_size, audio_duration, created_at')
      .eq('user_id', userId)
      .not('audio_file_size', 'is', null);

    if (error) throw error;

    const totalSize = data.reduce((sum, session) => sum + (session.audio_file_size || 0), 0);
    const totalDuration = data.reduce((sum, session) => sum + (session.audio_duration || 0), 0);
    const recordingCount = data.length;

    return {
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      totalDurationSeconds: totalDuration,
      totalDurationMinutes: Math.round(totalDuration / 60 * 100) / 100,
      recordingCount,
      averageSizeKB: recordingCount > 0 ? Math.round(totalSize / recordingCount / 1024) : 0,
      averageDurationSeconds: recordingCount > 0 ? Math.round(totalDuration / recordingCount) : 0,
    };
  } catch (error: any) {
    console.error('Failed to get storage usage:', error);
    return null;
  }
};

/**
 * Clean up expired signed URLs cache (client-side)
 */
export const cleanupExpiredUrls = (() => {
  const urlCache = new Map<string, VoicePlaybackUrl>();

  return {
    set: (key: string, url: VoicePlaybackUrl) => {
      urlCache.set(key, url);
    },
    get: (key: string): VoicePlaybackUrl | null => {
      const cached = urlCache.get(key);
      if (!cached) return null;

      if (new Date() > cached.expiresAt) {
        urlCache.delete(key);
        return null;
      }

      return cached;
    },
    clear: () => {
      urlCache.clear();
    },
  };
})();