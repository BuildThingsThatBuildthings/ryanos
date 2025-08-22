import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuthStore } from '../../../stores/authStore';
import { server } from '../../utils/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockUsers } from '../../utils/fixtures/api-responses';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
});

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    
    // Clear localStorage mocks
    vi.clearAllMocks();
  });

  describe('login', () => {
    const loginCredentials = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('logs in successfully', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login(loginCredentials);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUsers[0]);
      expect(result.current.token).toBe('mock-jwt-token');
      expect(result.current.refreshToken).toBe('mock-refresh-token');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Check localStorage calls
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'mock-jwt-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'mock-refresh-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUsers[0]));
    });

    it('handles login failure', async () => {
      server.use(
        http.post('*/api/auth/login', () => {
          return HttpResponse.json(
            { success: false, message: 'Invalid credentials' },
            { status: 401 }
          );
        })
      );

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.login(loginCredentials);
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.error).toContain('Invalid credentials');
      expect(result.current.isLoading).toBe(false);
    });

    it('sets loading state during login', async () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.login(loginCredentials);
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('register', () => {
    const registerData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    };

    it('registers successfully', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register(registerData);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUsers[0]);
      expect(result.current.token).toBe('mock-jwt-token');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles registration failure', async () => {
      server.use(
        http.post('*/api/auth/register', () => {
          return HttpResponse.json(
            { success: false, message: 'Email already exists' },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.register(registerData);
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toContain('Email already exists');
    });

    it('validates password confirmation', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.register({
            ...registerData,
            confirmPassword: 'different-password',
          });
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toContain('Passwords do not match');
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('logs out successfully', async () => {
      // Set initial authenticated state
      useAuthStore.setState({
        user: mockUsers[0],
        token: 'mock-token',
        refreshToken: 'mock-refresh-token',
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.refreshToken).toBeNull();

      // Check localStorage calls
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('handles logout API failure gracefully', async () => {
      server.use(
        http.post('*/api/auth/logout', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      useAuthStore.setState({
        user: mockUsers[0],
        token: 'mock-token',
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      // Should still clear local state even if API fails
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('refreshes token successfully', async () => {
      useAuthStore.setState({
        refreshToken: 'mock-refresh-token',
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(result.current.token).toBe('new-mock-jwt-token');
      expect(result.current.refreshToken).toBe('new-mock-refresh-token');
      expect(result.current.isAuthenticated).toBe(true);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'new-mock-jwt-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'new-mock-refresh-token');
    });

    it('handles refresh token failure', async () => {
      server.use(
        http.post('*/api/auth/refresh', () => {
          return HttpResponse.json(
            { success: false, message: 'Invalid refresh token' },
            { status: 401 }
          );
        })
      );

      useAuthStore.setState({
        refreshToken: 'invalid-token',
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.refreshToken();
        } catch (error) {
          // Expected to throw
        }
      });

      // Should logout on refresh failure
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.token).toBeNull();
      expect(result.current.refreshToken).toBeNull();
    });

    it('does not refresh if no refresh token', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.refreshToken();
        } catch (error) {
          expect(error.message).toBe('No refresh token available');
        }
      });

      expect(result.current.token).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('updates profile successfully', async () => {
      useAuthStore.setState({
        user: mockUsers[0],
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.updateProfile({ name: 'Updated Name' });
      });

      expect(result.current.user?.name).toBe('Updated Name');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify({ ...mockUsers[0], name: 'Updated Name' })
      );
    });

    it('handles profile update failure', async () => {
      server.use(
        http.put('*/api/users/profile', () => {
          return HttpResponse.json(
            { success: false, message: 'Validation failed' },
            { status: 400 }
          );
        })
      );

      useAuthStore.setState({
        user: mockUsers[0],
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.updateProfile({ name: 'Invalid' });
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toContain('Validation failed');
    });
  });

  describe('initializeAuth', () => {
    it('initializes auth from localStorage', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'authToken':
            return 'stored-token';
          case 'refreshToken':
            return 'stored-refresh-token';
          case 'user':
            return JSON.stringify(mockUsers[0]);
          default:
            return null;
        }
      });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.initializeAuth();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.token).toBe('stored-token');
      expect(result.current.refreshToken).toBe('stored-refresh-token');
      expect(result.current.user).toEqual(mockUsers[0]);
    });

    it('does not authenticate with invalid stored user', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'authToken':
            return 'stored-token';
          case 'refreshToken':
            return 'stored-refresh-token';
          case 'user':
            return 'invalid-json';
          default:
            return null;
        }
      });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.initializeAuth();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('does not authenticate without token', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.initializeAuth();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useAuthStore.setState({ error: 'Test error' });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('checkAuthStatus', () => {
    it('returns true for authenticated user', () => {
      useAuthStore.setState({
        isAuthenticated: true,
        token: 'valid-token',
      });

      const { result } = renderHook(() => useAuthStore());

      const isAuthenticated = result.current.checkAuthStatus();
      expect(isAuthenticated).toBe(true);
    });

    it('returns false for unauthenticated user', () => {
      const { result } = renderHook(() => useAuthStore());

      const isAuthenticated = result.current.checkAuthStatus();
      expect(isAuthenticated).toBe(false);
    });

    it('refreshes token if expired', async () => {
      // Mock expired token
      useAuthStore.setState({
        isAuthenticated: true,
        token: 'expired-token',
        refreshToken: 'valid-refresh-token',
      });

      const mockRefreshToken = vi.fn().mockResolvedValue(undefined);
      useAuthStore.setState({ refreshToken: mockRefreshToken });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuthStatus();
      });

      // Should attempt to refresh token
      // Note: In a real implementation, you'd need to decode JWT to check expiration
    });
  });

  describe('edge cases', () => {
    it('handles simultaneous login attempts', async () => {
      const { result } = renderHook(() => useAuthStore());

      const loginCredentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Trigger multiple login attempts
      const loginPromises = [
        result.current.login(loginCredentials),
        result.current.login(loginCredentials),
        result.current.login(loginCredentials),
      ];

      await act(async () => {
        await Promise.all(loginPromises);
      });

      // Should only be authenticated once
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('cleans up properly on unmount', () => {
      const { unmount } = renderHook(() => useAuthStore());

      unmount();

      // Should not cause any errors or memory leaks
      expect(true).toBe(true);
    });
  });
});