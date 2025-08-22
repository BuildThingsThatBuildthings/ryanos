import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Environment variables (set these in your .env file)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Create Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper functions for common operations
export const auth = {
  // Sign up new user
  signUp: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    
    if (error) throw error;
    
    // Create user profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          name,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      
      if (profileError) throw profileError;
    }
    
    return data;
  },

  // Sign in existing user
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current session
  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  // Get current user
  getUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Reset password
  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  // Update password
  updatePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },
};

// Database helpers
export const db = {
  // Workouts
  workouts: {
    list: async (userId: string) => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*, sets(*, exercises(*))')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    },

    create: async (workout: any) => {
      const { data, error } = await supabase
        .from('workouts')
        .insert(workout)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    update: async (id: string, updates: any) => {
      const { data, error } = await supabase
        .from('workouts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    delete: async (id: string) => {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
  },

  // Exercises
  exercises: {
    list: async (userId: string, status = 'active') => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', userId)
        .eq('status', status)
        .order('name');
      
      if (error) throw error;
      return data;
    },

    create: async (exercise: any) => {
      const { data, error } = await supabase
        .from('exercises')
        .insert(exercise)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    update: async (id: string, updates: any) => {
      const { data, error } = await supabase
        .from('exercises')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    findSimilar: async (userId: string, searchTerm: string) => {
      const { data, error } = await supabase
        .rpc('find_similar_exercises', {
          p_user_id: userId,
          p_search_term: searchTerm,
        });
      
      if (error) throw error;
      return data;
    },
  },

  // Sets
  sets: {
    create: async (set: any) => {
      const { data, error } = await supabase
        .from('sets')
        .insert(set)
        .select('*, exercises(*)')
        .single();
      
      if (error) throw error;
      return data;
    },

    update: async (id: string, updates: any) => {
      const { data, error } = await supabase
        .from('sets')
        .update(updates)
        .eq('id', id)
        .select('*, exercises(*)')
        .single();
      
      if (error) throw error;
      return data;
    },

    delete: async (id: string) => {
      const { error } = await supabase
        .from('sets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
  },

  // Voice
  voice: {
    createSession: async (userId: string, device?: string, locale?: string) => {
      const { data, error } = await supabase
        .from('voice_sessions')
        .insert({
          user_id: userId,
          device,
          locale,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    endSession: async (sessionId: string) => {
      const { data, error } = await supabase
        .from('voice_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    createEvent: async (event: any) => {
      const { data, error } = await supabase
        .from('voice_events')
        .insert(event)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
  },

  // Goals
  goals: {
    list: async (userId: string) => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },

    create: async (goal: any) => {
      const { data, error } = await supabase
        .from('goals')
        .insert(goal)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
  },

  // Equipment
  equipment: {
    list: async (userId: string) => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('user_id', userId)
        .order('name');
      
      if (error) throw error;
      return data;
    },

    available: async (userId: string) => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  },

  // Summary
  summary: {
    get7Day: async (userId: string) => {
      const { data, error } = await supabase
        .from('workout_summary_7d')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
  },
};

// Real-time subscriptions
export const realtime = {
  // Subscribe to workout changes
  subscribeToWorkouts: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('workouts-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workouts',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  // Subscribe to set changes for a workout
  subscribeToSets: (workoutId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`sets-${workoutId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sets',
          filter: `workout_id=eq.${workoutId}`,
        },
        callback
      )
      .subscribe();
  },

  // Subscribe to voice events
  subscribeToVoiceEvents: (sessionId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`voice-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_events',
          filter: `voice_session_id=eq.${sessionId}`,
        },
        callback
      )
      .subscribe();
  },
};

// Storage helpers
export const storage = {
  // Upload voice recording
  uploadVoiceRecording: async (file: File, sessionId: string) => {
    const fileName = `${sessionId}/${Date.now()}.webm`;
    const { data, error } = await supabase.storage
      .from('voice-recordings')
      .upload(fileName, file);
    
    if (error) throw error;
    return data;
  },

  // Get voice recording URL
  getVoiceRecordingUrl: (path: string) => {
    const { data } = supabase.storage
      .from('voice-recordings')
      .getPublicUrl(path);
    
    return data.publicUrl;
  },

  // Upload exercise video
  uploadExerciseVideo: async (file: File, exerciseId: string) => {
    const fileName = `exercises/${exerciseId}/${file.name}`;
    const { data, error } = await supabase.storage
      .from('exercise-media')
      .upload(fileName, file);
    
    if (error) throw error;
    return data;
  },

  // Get exercise video URL
  getExerciseVideoUrl: (path: string) => {
    const { data } = supabase.storage
      .from('exercise-media')
      .getPublicUrl(path);
    
    return data.publicUrl;
  },
};

export default supabase;