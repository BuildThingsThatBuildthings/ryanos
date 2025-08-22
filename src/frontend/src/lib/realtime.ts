import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Global real-time channel management
class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();

  subscribe(
    channelName: string,
    table: string,
    filter?: string,
    callback?: (payload: any) => void
  ): RealtimeChannel {
    // Remove existing channel if it exists
    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table,
          filter 
        }, 
        (payload) => {
          console.log(`Real-time update for ${table}:`, payload);
          callback?.(payload);
        }
      )
      .subscribe((status) => {
        console.log(`Channel ${channelName} subscription status:`, status);
      });

    this.channels.set(channelName, channel);
    return channel;
  }

  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  unsubscribeAll(): void {
    this.channels.forEach((channel, name) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }

  getChannel(channelName: string): RealtimeChannel | undefined {
    return this.channels.get(channelName);
  }

  isSubscribed(channelName: string): boolean {
    return this.channels.has(channelName);
  }
}

export const realtimeManager = new RealtimeManager();

// Pre-configured subscription helpers
export const subscribeToUserWorkouts = (userId: string, callback?: (payload: any) => void) => {
  return realtimeManager.subscribe(
    `user-workouts-${userId}`,
    'workouts',
    `user_id=eq.${userId}`,
    callback
  );
};

export const subscribeToUserVoiceSessions = (userId: string, callback?: (payload: any) => void) => {
  return realtimeManager.subscribe(
    `user-voice-${userId}`,
    'voice_sessions',
    `user_id=eq.${userId}`,
    callback
  );
};

export const subscribeToWorkoutSets = (workoutId: string, callback?: (payload: any) => void) => {
  return realtimeManager.subscribe(
    `workout-sets-${workoutId}`,
    'workout_sets',
    `workout_id=eq.${workoutId}`,
    callback
  );
};