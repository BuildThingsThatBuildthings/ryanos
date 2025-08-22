import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LoginForm, RegisterForm } from '../types';
import { supabase, handleSupabaseError } from '../lib/supabase';
import { AuthError, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  session: Session | null;
  initialized: boolean;
}

interface AuthActions {
  login: (credentials: LoginForm) => Promise<void>;
  register: (userData: RegisterForm) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshSession: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  initialize: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      session: null,
      initialized: false,

      // Actions
      login: async (credentials: LoginForm) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (error) throw error;
          if (!data.session) throw new Error('No session created');

          // Get user profile from users table
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.warn('Failed to fetch user profile:', profileError);
          }

          const user: User = {
            id: data.user.id,
            email: data.user.email!,
            name: userProfile?.name || data.user.user_metadata?.name || 'User',
            avatar: userProfile?.avatar || data.user.user_metadata?.avatar_url,
            createdAt: userProfile?.created_at || data.user.created_at,
            updatedAt: userProfile?.updated_at || data.user.updated_at || data.user.created_at,
          };

          set({
            user,
            session: data.session,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          const errorMessage = handleSupabaseError(error);
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },

      register: async (userData: RegisterForm) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
              data: {
                name: userData.name,
              },
            },
          });

          if (error) throw error;
          if (!data.user) throw new Error('Registration failed');

          // Create user profile in users table
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email!,
              name: userData.name,
            });

          if (profileError) {
            console.warn('Failed to create user profile:', profileError);
          }

          set({ isLoading: false });

          // Note: User will need to verify email before session is created
        } catch (error: any) {
          const errorMessage = handleSupabaseError(error);
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },

      logout: async () => {
        try {
          await supabase.auth.signOut();
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            error: null,
          });
        } catch (error: any) {
          console.error('Logout error:', error);
          // Force logout locally even if API call fails
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      refreshSession: async () => {
        const { session } = get();
        if (!session) return;

        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) throw error;
          
          if (data.session) {
            set({ session: data.session });
          }
        } catch (error) {
          console.error('Session refresh failed:', error);
          // Session refresh failed, logout user
          await get().logout();
          throw error;
        }
      },

      updateUser: async (userData: Partial<User>) => {
        const { user } = get();
        if (!user) return;

        set({ isLoading: true, error: null });
        try {
          // Update auth metadata if name or avatar changed
          if (userData.name || userData.avatar) {
            const { error: authError } = await supabase.auth.updateUser({
              data: {
                name: userData.name || user.name,
                avatar_url: userData.avatar || user.avatar,
              },
            });
            if (authError) throw authError;
          }

          // Update user profile in users table
          const { error: profileError } = await supabase
            .from('users')
            .update({
              name: userData.name,
              avatar: userData.avatar,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (profileError) throw profileError;

          set({
            user: { ...user, ...userData, updatedAt: new Date().toISOString() },
            isLoading: false,
          });
        } catch (error: any) {
          const errorMessage = handleSupabaseError(error);
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },

      initialize: async () => {
        set({ isLoading: true });
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (session?.user) {
            // Get user profile from users table
            const { data: userProfile, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profileError && profileError.code !== 'PGRST116') {
              console.warn('Failed to fetch user profile:', profileError);
            }

            const user: User = {
              id: session.user.id,
              email: session.user.email!,
              name: userProfile?.name || session.user.user_metadata?.name || 'User',
              avatar: userProfile?.avatar || session.user.user_metadata?.avatar_url,
              createdAt: userProfile?.created_at || session.user.created_at,
              updatedAt: userProfile?.updated_at || session.user.updated_at || session.user.created_at,
            };

            set({
              user,
              session,
              isAuthenticated: true,
            });
          }

          set({ initialized: true, isLoading: false });
        } catch (error: any) {
          console.error('Auth initialization error:', error);
          set({
            error: handleSupabaseError(error),
            initialized: true,
            isLoading: false,
          });
        }
      },

      resetPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
          if (error) throw error;
          set({ isLoading: false });
        } catch (error: any) {
          const errorMessage = handleSupabaseError(error);
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
        initialized: state.initialized,
      }),
    }
  )
);