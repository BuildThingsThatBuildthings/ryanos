import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { ToastProvider } from './components/ui/Toast';
import { HomePage } from './pages/HomePage';
import { WorkoutListPage } from './pages/WorkoutListPage';
import { LoginForm } from './components/auth/LoginForm';
import { useAuthStore } from './stores/authStore';
import { useOfflineStore } from './stores/offlineStore';
import { useWorkoutStore } from './stores/workoutStore';
import { useVoiceStore } from './stores/voiceStore';
import { supabase } from './lib/supabase';

// Placeholder components for routes not yet implemented
const AddWorkoutPage = () => <div className="p-4 pb-20"><h1>Add Workout (Coming Soon)</h1></div>;
const VoicePage = () => <div className="p-4 pb-20"><h1>Voice Logger (Coming Soon)</h1></div>;
const GoalsPage = () => <div className="p-4 pb-20"><h1>Goals Dashboard (Coming Soon)</h1></div>;
const LoginPage = () => <div className="p-4"><h1>Login (Coming Soon)</h1></div>;

function App() {
  const { isAuthenticated, initialize, initialized, user } = useAuthStore();
  const { setOnlineStatus } = useOfflineStore();
  const { subscribeToWorkouts, unsubscribeFromWorkouts } = useWorkoutStore();
  const { subscribeToSessions, unsubscribeFromSessions } = useVoiceStore();

  useEffect(() => {
    // Initialize Supabase auth
    initialize();
    
    // Set initial online status
    setOnlineStatus(navigator.onLine);

    // Set up Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        if (event === 'SIGNED_IN' && session) {
          // User signed in, initialize will handle the state update
          await initialize();
        } else if (event === 'SIGNED_OUT') {
          // User signed out, clean up subscriptions
          unsubscribeFromWorkouts();
          unsubscribeFromSessions();
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
      unsubscribeFromWorkouts();
      unsubscribeFromSessions();
    };
  }, [initialize, setOnlineStatus, unsubscribeFromWorkouts, unsubscribeFromSessions]);

  // Set up real-time subscriptions when user is authenticated
  useEffect(() => {
    if (user) {
      subscribeToWorkouts(user.id);
      subscribeToSessions(user.id);
    }
  }, [user, subscribeToWorkouts, subscribeToSessions]);

  // Show loading screen while initializing
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <ToastProvider />
        </div>
      </Router>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        
        <main className="pt-16">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/workouts" element={<WorkoutListPage />} />
            <Route path="/add-workout" element={<AddWorkoutPage />} />
            <Route path="/voice" element={<VoicePage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <BottomNavigation />
        <ToastProvider />
      </div>
    </Router>
  );
}

export default App;
