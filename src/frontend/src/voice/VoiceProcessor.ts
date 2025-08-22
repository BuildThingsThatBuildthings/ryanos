import { supabase } from '../lib/supabase';
import { uploadVoiceRecording, updateVoiceSessionWithAudio, analyzeAudioMetadata } from './supabase-voice';
import { VoiceSession, VoiceSessionStatus } from '../types';

export interface ProcessingOptions {
  enableRealTimeTranscription?: boolean;
  confidenceThreshold?: number;
  languageDetection?: boolean;
  workoutContextEnabled?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  transcript?: string;
  extractedData?: any;
  confidence?: number;
  processingTimeMs?: number;
  error?: string;
}

/**
 * Voice Processing Service
 * Handles audio processing, transcription, and workout data extraction
 */
export class VoiceProcessor {
  private options: ProcessingOptions;
  private processingStartTime: number = 0;

  constructor(options: ProcessingOptions = {}) {
    this.options = {
      enableRealTimeTranscription: false,
      confidenceThreshold: 0.7,
      languageDetection: true,
      workoutContextEnabled: true,
      ...options,
    };
  }

  /**
   * Process audio blob and extract workout data
   */
  async processAudio(
    audioBlob: Blob,
    sessionId: string,
    userId: string
  ): Promise<ProcessingResult> {
    this.processingStartTime = Date.now();

    try {
      // Step 1: Upload audio to storage
      const uploadResult = await uploadVoiceRecording(audioBlob, sessionId, userId);
      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error || 'Failed to upload audio',
        };
      }

      // Step 2: Analyze audio metadata
      const audioMetadata = await analyzeAudioMetadata(audioBlob);

      // Step 3: Update session with audio file info
      const audioUpdated = await updateVoiceSessionWithAudio(sessionId, {
        filePath: uploadResult.filePath!,
        fileSize: uploadResult.fileSize!,
        duration: audioMetadata.duration,
        format: audioMetadata.format,
      });

      if (!audioUpdated) {
        return {
          success: false,
          error: 'Failed to update session with audio metadata',
        };
      }

      // Step 4: Convert to base64 for processing
      const base64Audio = await this.convertToBase64(audioBlob);

      // Step 5: Call Supabase Edge Function for transcription and extraction
      const { data, error } = await supabase.functions.invoke('voice-sessions', {
        body: {
          sessionId,
          audioData: base64Audio,
          audioFilePath: uploadResult.filePath,
          options: this.options,
          metadata: {
            duration: audioMetadata.duration,
            size: audioMetadata.size,
            format: audioMetadata.format,
          },
        },
      });

      if (error) {
        throw new Error(`Processing failed: ${error.message}`);
      }

      const processingTimeMs = Date.now() - this.processingStartTime;

      // Step 6: Validate and return results
      const result: ProcessingResult = {\n        success: true,\n        transcript: data.transcript,\n        extractedData: data.extractedData,\n        confidence: data.confidence,\n        processingTimeMs,\n      };

      // Step 7: Update session with processing results\n      await this.updateSessionWithResults(sessionId, result, audioMetadata);

      return result;
    } catch (error: any) {
      console.error('Voice processing failed:', error);
      return {
        success: false,
        error: error.message || 'Processing failed',
        processingTimeMs: Date.now() - this.processingStartTime,
      };
    }
  }

  /**
   * Process audio in real-time chunks (for streaming)
   */
  async processAudioChunk(
    audioChunk: Blob,
    sessionId: string,
    chunkIndex: number
  ): Promise<Partial<ProcessingResult>> {
    if (!this.options.enableRealTimeTranscription) {
      return { success: false, error: 'Real-time transcription not enabled' };
    }

    try {
      const base64Chunk = await this.convertToBase64(audioChunk);

      const { data, error } = await supabase.functions.invoke('voice-chunk-process', {
        body: {
          sessionId,
          audioChunk: base64Chunk,
          chunkIndex,
          isRealTime: true,
        },
      });

      if (error) throw error;

      return {
        success: true,
        transcript: data.partialTranscript,
        confidence: data.confidence,
      };
    } catch (error: any) {
      console.error('Chunk processing failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Extract workout data from transcript
   */
  async extractWorkoutData(transcript: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('extract-workout-data', {
        body: {
          transcript,
          contextEnabled: this.options.workoutContextEnabled,
        },
      });

      if (error) throw error;

      return data.workoutData;
    } catch (error: any) {
      console.error('Workout data extraction failed:', error);
      return null;
    }
  }

  /**
   * Get processing analytics for a session
   */
  async getProcessingAnalytics(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from('voice_sessions')
        .select(`
          processing_time_ms,
          confidence_score,
          word_count,
          audio_duration,
          audio_file_size,
          language_detected,
          status,
          created_at,
          updated_at
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      return {
        processingTimeMs: data.processing_time_ms,
        confidenceScore: data.confidence_score,
        wordCount: data.word_count,
        audioDuration: data.audio_duration,
        audioFileSize: data.audio_file_size,
        languageDetected: data.language_detected,
        status: data.status,
        processingEfficiency: data.processing_time_ms ? data.audio_duration * 1000 / data.processing_time_ms : null,
        compressionRatio: data.audio_file_size && data.audio_duration ? data.audio_file_size / (data.audio_duration * 64000) : null, // Assuming 64kbps base
      };
    } catch (error: any) {
      console.error('Failed to get processing analytics:', error);
      return null;
    }
  }

  /**
   * Batch process multiple audio files
   */
  async batchProcessAudio(
    audioFiles: Array<{
      blob: Blob;
      sessionId: string;
      userId: string;
    }>
  ): Promise<ProcessingResult[]> {
    const results = await Promise.allSettled(
      audioFiles.map(({ blob, sessionId, userId }) =>
        this.processAudio(blob, sessionId, userId)
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: `Batch processing failed for file ${index + 1}: ${result.reason}`,
        };
      }
    });
  }

  /**
   * Convert blob to base64
   */
  private convertToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Update session with processing results
   */
  private async updateSessionWithResults(
    sessionId: string,
    result: ProcessingResult,
    audioMetadata: any
  ): Promise<void> {
    const updateData: any = {
      transcript: result.transcript,
      extracted_data: result.extractedData,
      processed: result.success,
      confidence_score: result.confidence,
      processing_time_ms: result.processingTimeMs,
      word_count: result.transcript ? result.transcript.split(' ').length : 0,
      status: result.success ? VoiceSessionStatus.COMPLETED : VoiceSessionStatus.ERROR,
      updated_at: new Date().toISOString(),
    };

    // Add language detection if enabled
    if (this.options.languageDetection && result.extractedData?.language) {
      updateData.language_detected = result.extractedData.language;
    }

    const { error } = await supabase
      .from('voice_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  /**
   * Get recommended processing options based on user history
   */
  async getRecommendedOptions(userId: string): Promise<ProcessingOptions> {
    try {
      const { data, error } = await supabase
        .from('voice_sessions')
        .select('confidence_score, processing_time_ms, language_detected')
        .eq('user_id', userId)
        .not('confidence_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !data.length) {
        return this.options;
      }

      const avgConfidence = data.reduce((sum, session) => sum + (session.confidence_score || 0), 0) / data.length;
      const avgProcessingTime = data.reduce((sum, session) => sum + (session.processing_time_ms || 0), 0) / data.length;
      const primaryLanguage = this.getMostFrequentLanguage(data.map(s => s.language_detected).filter(Boolean));

      return {
        ...this.options,
        confidenceThreshold: Math.max(0.5, avgConfidence - 0.1), // Slightly lower than average
        languageDetection: primaryLanguage !== 'en', // Only if non-English detected
        enableRealTimeTranscription: avgProcessingTime < 2000, // Enable if processing is fast
      };
    } catch (error: any) {
      console.error('Failed to get recommended options:', error);
      return this.options;
    }
  }

  /**
   * Get most frequent language from history
   */
  private getMostFrequentLanguage(languages: string[]): string {
    const counts: Record<string, number> = {};
    for (const lang of languages) {
      counts[lang] = (counts[lang] || 0) + 1;
    }
    return Object.entries(counts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'en';
  }
}