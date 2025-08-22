import { create } from 'zustand';
import { VoiceSession, VoiceSessionStatus } from '../types';
import { supabase, handleSupabaseError, createRealtimeSubscription } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  uploadVoiceRecording,
  updateVoiceSessionWithAudio,
  analyzeAudioMetadata,
  VoiceUploadResult,
} from '../voice/supabase-voice';

interface VoiceState {
  currentSession: VoiceSession | null;
  sessions: VoiceSession[];
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
  transcriptBuffer: string;
  confidence: number;
  subscription: RealtimeChannel | null;
}

interface VoiceActions {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  processAudio: (audioBlob: Blob) => Promise<void>;
  clearSession: () => void;
  fetchSessions: () => Promise<void>;
  updateTranscript: (transcript: string, confidence: number) => void;
  clearError: () => void;
  subscribeToSessions: (userId: string) => void;
  unsubscribeFromSessions: () => void;
  saveSession: (session: VoiceSession) => Promise<void>;
}

export const useVoiceStore = create<VoiceState & VoiceActions>()((set, get) => ({
  // State
  currentSession: null,
  sessions: [],
  isRecording: false,
  isProcessing: false,
  error: null,
  mediaRecorder: null,
  audioChunks: [],
  transcriptBuffer: '',
  confidence: 0,
  subscription: null,

  // Actions
  startRecording: async () => {
    try {
      // Check for microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await get().processAudio(audioBlob);
        
        // Clean up
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        set({ 
          error: 'Recording failed. Please try again.',
          isRecording: false,
          mediaRecorder: null 
        });
      };

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create new session in Supabase
      const { data, error } = await supabase
        .from('voice_sessions')
        .insert({
          user_id: user.id,
          start_time: new Date().toISOString(),
          transcript: '',
          processed: false,
          status: VoiceSessionStatus.RECORDING,
        })
        .select()
        .single();

      if (error) throw error;

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

      mediaRecorder.start(1000); // Collect data every second

      set({
        currentSession: session,
        isRecording: true,
        mediaRecorder,
        audioChunks,
        transcriptBuffer: '',
        error: null,
      });

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      set({
        error: handleSupabaseError(error),
        isRecording: false,
      });
      throw error;
    }
  },

  stopRecording: async () => {
    const { mediaRecorder, currentSession } = get();
    
    if (!mediaRecorder || !currentSession) return;

    try {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }

      // Update session status in Supabase
      const { error } = await supabase
        .from('voice_sessions')
        .update({
          end_time: new Date().toISOString(),
          status: VoiceSessionStatus.PROCESSING,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentSession.id);

      if (error) throw error;

      const updatedSession = {
        ...currentSession,
        endTime: new Date().toISOString(),
        status: VoiceSessionStatus.PROCESSING,
      };

      set({
        currentSession: updatedSession,
        isRecording: false,
        isProcessing: true,
      });

    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      set({
        error: handleSupabaseError(error),
        isRecording: false,
      });
    }
  },

  pauseRecording: () => {
    const { mediaRecorder } = get();
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
    }
  },

  resumeRecording: () => {
    const { mediaRecorder } = get();
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
    }
  },

  processAudio: async (audioBlob: Blob) => {
    const { currentSession } = get();
    if (!currentSession) return;

    set({ isProcessing: true, error: null });

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Analyze audio metadata
      const audioMetadata = await analyzeAudioMetadata(audioBlob);

      // Upload audio file to Supabase Storage
      const uploadResult: VoiceUploadResult = await uploadVoiceRecording(
        audioBlob,
        currentSession.id,
        user.id
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload audio file');
      }

      // Update session with audio file information
      const audioUpdated = await updateVoiceSessionWithAudio(currentSession.id, {
        filePath: uploadResult.filePath!,
        fileSize: uploadResult.fileSize!,
        duration: audioMetadata.duration,
        format: audioMetadata.format,
      });

      if (!audioUpdated) {
        throw new Error('Failed to update session with audio data');
      }

      // Convert blob to base64 for Edge Function processing
      const base64Audio = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(audioBlob);
      });

      // Call Supabase Edge Function for audio processing
      const { data, error } = await supabase.functions.invoke('voice-sessions', {
        body: {
          sessionId: currentSession.id,
          audioData: base64Audio,
          audioFilePath: uploadResult.filePath,
        },
      });

      if (error) throw error;

      const { transcript, extractedData, confidence } = data;

      // Update session in Supabase with transcript and processing results
      const { error: updateError } = await supabase
        .from('voice_sessions')
        .update({
          transcript,
          extracted_data: extractedData,
          processed: true,
          status: VoiceSessionStatus.COMPLETED,
          confidence_score: confidence,
          word_count: transcript ? transcript.split(' ').length : 0,
          processing_time_ms: Date.now() - new Date(currentSession.startTime).getTime(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentSession.id);

      if (updateError) throw updateError;

      const processedSession = {
        ...currentSession,
        transcript,
        extractedData,
        processed: true,
        status: VoiceSessionStatus.COMPLETED,
      };

      set({
        currentSession: processedSession,
        sessions: [processedSession, ...get().sessions],
        isProcessing: false,
        confidence,
        transcriptBuffer: transcript,
      });

      // If workout data was extracted, notify workout store
      if (extractedData?.workoutData) {
        console.log('Extracted workout data:', extractedData.workoutData);
      }

    } catch (error: any) {
      console.error('Failed to process audio:', error);
      
      // Update session status to error in Supabase
      await supabase
        .from('voice_sessions')
        .update({
          status: VoiceSessionStatus.ERROR,
          processed: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentSession.id);

      const errorSession = {
        ...currentSession,
        status: VoiceSessionStatus.ERROR,
        processed: false,
      };

      set({
        currentSession: errorSession,
        isProcessing: false,
        error: handleSupabaseError(error),
      });
    }
  },

  clearSession: () => {
    const { mediaRecorder } = get();
    
    // Stop recording if active
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }

    set({
      currentSession: null,
      isRecording: false,
      isProcessing: false,
      mediaRecorder: null,
      audioChunks: [],
      transcriptBuffer: '',
      confidence: 0,
      error: null,
    });
  },

  fetchSessions: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('voice_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const sessions: VoiceSession[] = data.map((session) => ({
        id: session.id,
        userId: session.user_id,
        workoutId: session.workout_id,
        startTime: session.start_time,
        endTime: session.end_time,
        transcript: session.transcript,
        processed: session.processed,
        extractedData: session.extracted_data,
        status: session.status as VoiceSessionStatus,
      }));

      set({ sessions });
    } catch (error: any) {
      console.error('Failed to fetch voice sessions:', error);
      set({
        error: handleSupabaseError(error),
      });
    }
  },

  updateTranscript: (transcript: string, confidence: number) => {
    set({
      transcriptBuffer: transcript,
      confidence,
    });
  },

  clearError: () => {
    set({ error: null });
  },

  subscribeToSessions: (userId: string) => {
    const subscription = createRealtimeSubscription(
      'voice_sessions',
      `user_id=eq.${userId}`,
      (payload) => {
        console.log('Voice session realtime update:', payload);
        // Refetch sessions when changes occur
        get().fetchSessions();
      }
    );

    set({ subscription });
  },

  unsubscribeFromSessions: () => {
    const { subscription } = get();
    if (subscription) {
      supabase.removeChannel(subscription);
      set({ subscription: null });
    }
  },

  saveSession: async (session: VoiceSession) => {
    try {
      const { error } = await supabase
        .from('voice_sessions')
        .upsert({
          id: session.id,
          user_id: session.userId,
          workout_id: session.workoutId,
          start_time: session.startTime,
          end_time: session.endTime,
          transcript: session.transcript,
          processed: session.processed,
          extracted_data: session.extractedData,
          status: session.status,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error: any) {
      console.error('Failed to save voice session:', error);
      set({ error: handleSupabaseError(error) });
    }
  },
}));