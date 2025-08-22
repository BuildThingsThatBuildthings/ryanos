import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const { login, register, resetPassword, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (isRegisterMode) {
      if (password !== confirmPassword) {
        return; // Handle password mismatch
      }
      try {
        await register({ name, email, password, confirmPassword });
        // Show success message - user needs to verify email
      } catch (error) {
        // Error is already handled in the store
      }
    } else {
      try {
        await login({ email, password });
      } catch (error) {
        // Error is already handled in the store
      }
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      return; // Show error - email required
    }
    try {
      await resetPassword(email);
      // Show success message
    } catch (error) {
      // Error is already handled in the store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isRegisterMode ? 'Create your account' : 'Sign in to your account'}
          </h2>
        </div>
        
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <Input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            {isRegisterMode && (
              <Input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            )}

            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading 
                ? (isRegisterMode ? 'Creating Account...' : 'Signing In...') 
                : (isRegisterMode ? 'Create Account' : 'Sign In')
              }
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              onClick={() => setIsRegisterMode(!isRegisterMode)}
              className="text-blue-600 hover:text-blue-500 text-sm"
            >
              {isRegisterMode 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Sign up"
              }
            </button>
            
            {!isRegisterMode && (
              <button
                type="button"
                onClick={handleResetPassword}
                className="block w-full text-blue-600 hover:text-blue-500 text-sm"
              >
                Forgot your password?
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};