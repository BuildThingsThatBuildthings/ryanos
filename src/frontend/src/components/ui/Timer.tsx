import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, RotateCcw, Plus, Minus } from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent } from './Card';
import { cn } from '../../utils/cn';

interface TimerProps {
  initialDuration?: number; // in seconds
  autoStart?: boolean;
  onComplete?: () => void;
  onTick?: (remaining: number) => void;
  showControls?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'rest' | 'workout' | 'stopwatch';
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({
  initialDuration = 90,
  autoStart = false,
  onComplete,
  onTick,
  showControls = true,
  size = 'md',
  variant = 'rest',
  className,
}) => {
  const [duration, setDuration] = useState(initialDuration);
  const [timeRemaining, setTimeRemaining] = useState(initialDuration);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isCompleted, setIsCompleted] = useState(false);

  // Stopwatch mode state
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    setDuration(initialDuration);
    setTimeRemaining(initialDuration);
    setElapsedTime(0);
    setIsCompleted(false);
  }, [initialDuration]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      interval = setInterval(() => {
        if (variant === 'stopwatch') {
          setElapsedTime((prev) => {
            const newTime = prev + 1;
            if (onTick) onTick(newTime);
            return newTime;
          });
        } else {
          setTimeRemaining((prev) => {
            const newTime = prev - 1;
            if (onTick) onTick(newTime);
            
            if (newTime <= 0) {
              setIsRunning(false);
              setIsCompleted(true);
              if (onComplete) onComplete();
              
              // Send notification if available
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Timer Complete!', {
                  body: variant === 'rest' ? 'Rest time is over' : 'Workout timer finished',
                  icon: '/icon-192x192.png',
                });
              }
              
              // Vibrate if available
              if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 100]);
              }
              
              return 0;
            }
            
            return newTime;
          });
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, variant, onComplete, onTick]);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleStart = () => {
    setIsRunning(true);
    setIsCompleted(false);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    if (variant === 'stopwatch') {
      setElapsedTime(0);
    } else {
      setTimeRemaining(duration);
    }
    setIsCompleted(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    if (variant === 'stopwatch') {
      setElapsedTime(0);
    } else {
      setTimeRemaining(duration);
    }
    setIsCompleted(false);
  };

  const adjustDuration = (adjustment: number) => {
    const newDuration = Math.max(10, duration + adjustment);
    setDuration(newDuration);
    if (!isRunning && !isCompleted) {
      setTimeRemaining(newDuration);
    }
  };

  const getProgress = () => {
    if (variant === 'stopwatch') return 0;
    return duration > 0 ? ((duration - timeRemaining) / duration) * 100 : 0;
  };

  const getDisplayTime = () => {
    return variant === 'stopwatch' ? elapsedTime : timeRemaining;
  };

  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
  };

  const cardSizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <Card className={cn('text-center', className)}>
      <CardContent padding={false} className={cardSizeClasses[size]}>
        {/* Timer Display */}
        <div className={cn(
          'font-mono font-bold transition-colors duration-200',
          sizeClasses[size],
          isCompleted ? 'text-success-600' : 'text-gray-900 dark:text-gray-100',
          timeRemaining <= 10 && timeRemaining > 0 && variant !== 'stopwatch' && 'text-warning-600 animate-pulse'
        )}>
          {formatTime(getDisplayTime())}
        </div>

        {/* Progress Ring/Bar */}
        {variant !== 'stopwatch' && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={cn(
                  'h-2 rounded-full transition-all duration-1000',
                  isCompleted ? 'bg-success-600' : 'bg-primary-600'
                )}
                style={{ width: `${getProgress()}%` }}
              />
            </div>
          </div>
        )}

        {/* Duration Adjustment (for rest timer) */}
        {variant === 'rest' && showControls && !isRunning && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="ghost"
              size="sm"
              icon={Minus}
              onClick={() => adjustDuration(-15)}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400 min-w-16">
              {duration}s
            </span>
            <Button
              variant="ghost"
              size="sm"
              icon={Plus}
              onClick={() => adjustDuration(15)}
            />
          </div>
        )}

        {/* Controls */}
        {showControls && (
          <div className="flex items-center justify-center gap-2 mt-4">
            {!isRunning ? (
              <Button
                variant="primary"
                icon={Play}
                onClick={handleStart}
                disabled={variant !== 'stopwatch' && timeRemaining <= 0}
              >
                Start
              </Button>
            ) : (
              <Button
                variant="warning"
                icon={Pause}
                onClick={handlePause}
              >
                Pause
              </Button>
            )}

            <Button
              variant="secondary"
              icon={Square}
              onClick={handleStop}
            >
              Stop
            </Button>

            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={handleReset}
            >
              Reset
            </Button>
          </div>
        )}

        {/* Status Messages */}
        {isCompleted && (
          <div className="mt-4 p-2 bg-success-50 dark:bg-success-900/20 rounded-lg">
            <p className="text-sm font-medium text-success-700 dark:text-success-300">
              {variant === 'rest' ? 'Rest complete!' : 'Timer finished!'}
            </p>
          </div>
        )}

        {/* Quick Preset Buttons for Rest Timer */}
        {variant === 'rest' && !isRunning && !isCompleted && (
          <div className="flex items-center justify-center gap-2 mt-4">
            {[60, 90, 120, 180].map((preset) => (
              <Button
                key={preset}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDuration(preset);
                  setTimeRemaining(preset);
                }}
                className={cn(
                  'text-xs',
                  duration === preset && 'bg-primary-100 text-primary-700'
                )}
              >
                {preset}s
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};