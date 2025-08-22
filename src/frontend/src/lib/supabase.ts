import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database types based on our schema
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          avatar?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string;
          movement_pattern: string;
          primary_muscles: string[];
          secondary_muscles: string[];
          equipment: string[];
          instructions: string[] | null;
          video_url: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category: string;
          movement_pattern: string;
          primary_muscles: string[];
          secondary_muscles: string[];
          equipment: string[];
          instructions?: string[] | null;
          video_url?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string;
          movement_pattern?: string;
          primary_muscles?: string[];
          secondary_muscles?: string[];
          equipment?: string[];
          instructions?: string[] | null;
          video_url?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          date: string;
          start_time: string | null;
          end_time: string | null;
          status: string;
          total_volume: number | null;
          total_time: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          date: string;
          start_time?: string | null;
          end_time?: string | null;
          status?: string;
          total_volume?: number | null;
          total_time?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          date?: string;
          start_time?: string | null;
          end_time?: string | null;
          status?: string;
          total_volume?: number | null;
          total_time?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workout_sets: {
        Row: {
          id: string;
          workout_id: string;
          exercise_id: string;
          set_number: number;
          reps: number | null;
          weight: number | null;
          time: number | null;
          distance: number | null;
          rpe: number | null;
          notes: string | null;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          exercise_id: string;
          set_number: number;
          reps?: number | null;
          weight?: number | null;
          time?: number | null;
          distance?: number | null;
          rpe?: number | null;
          notes?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workout_id?: string;
          exercise_id?: string;
          set_number?: number;
          reps?: number | null;
          weight?: number | null;
          time?: number | null;
          distance?: number | null;
          rpe?: number | null;
          notes?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      voice_sessions: {
        Row: {
          id: string;
          user_id: string;
          workout_id: string | null;
          start_time: string;
          end_time: string | null;
          transcript: string;
          processed: boolean;
          extracted_data: any | null;
          status: string;
          audio_file_path: string | null;
          audio_file_size: number | null;
          audio_duration: number | null;
          audio_format: string | null;
          confidence_score: number | null;
          processing_time_ms: number | null;
          word_count: number | null;
          language_detected: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_id?: string | null;
          start_time: string;
          end_time?: string | null;
          transcript?: string;
          processed?: boolean;
          extracted_data?: any | null;
          status?: string;
          audio_file_path?: string | null;
          audio_file_size?: number | null;
          audio_duration?: number | null;
          audio_format?: string | null;
          confidence_score?: number | null;
          processing_time_ms?: number | null;
          word_count?: number | null;
          language_detected?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_id?: string | null;
          start_time?: string;
          end_time?: string | null;
          transcript?: string;
          processed?: boolean;
          extracted_data?: any | null;
          status?: string;
          audio_file_path?: string | null;
          audio_file_size?: number | null;
          audio_duration?: number | null;
          audio_format?: string | null;
          confidence_score?: number | null;
          processing_time_ms?: number | null;
          word_count?: number | null;
          language_detected?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          type: string;
          target_value: number;
          current_value: number;
          unit: string;
          target_date: string;
          status: string;
          priority: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          type: string;
          target_value: number;
          current_value?: number;
          unit: string;
          target_date: string;
          status?: string;
          priority?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          type?: string;
          target_value?: number;
          current_value?: number;
          unit?: string;
          target_date?: string;
          status?: string;
          priority?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Export typed Supabase client
export type SupabaseClient = typeof supabase;

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: any): string => {
  if (error?.message) {
    return error.message;
  }
  if (error?.error_description) {
    return error.error_description;
  }
  return 'An unexpected error occurred';
};

// Real-time subscription helpers
export const createRealtimeSubscription = (
  table: string,
  filter?: string,
  callback?: (payload: any) => void
) => {
  return supabase
    .channel(`realtime:${table}`)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table,
        filter 
      }, 
      callback || (() => {})
    )
    .subscribe();
};

// Auth helpers
export const getCurrentUser = () => {
  return supabase.auth.getUser();
};

export const getSession = () => {
  return supabase.auth.getSession();
};

// Database query helpers
export const createQuery = (table: string) => {
  return supabase.from(table);
};

export default supabase;