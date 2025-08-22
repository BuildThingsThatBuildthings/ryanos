import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useVoiceStore } from '../stores/voiceStore';

// Auth initialization hook
export const useAuthInitialization = () => {
  const { initialize, user, isAuthenticated } = useAuthStore();
  const { fetchWorkouts, fetchExercises, subscribeToWorkouts, unsubscribeFromWorkouts } = useWorkoutStore();
  const { fetchSessions, subscribeToSessions, unsubscribeFromSessions } = useVoiceStore();

  useEffect(() => {
    // Initialize auth on app start
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Fetch initial data
      fetchWorkouts();
      fetchExercises();
      fetchSessions();

      // Set up real-time subscriptions
      subscribeToWorkouts(user.id);
      subscribeToSessions(user.id);

      // Cleanup on logout
      return () => {
        unsubscribeFromWorkouts();
        unsubscribeFromSessions();
      };
    }
  }, [isAuthenticated, user]);

  return { user, isAuthenticated };
};