import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Square, Play } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { useVoiceStore } from '../../stores/voiceStore';

interface VoiceButtonProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
  showStatus?: boolean;
  autoStop?: number; // Auto-stop after N seconds
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  size = 'md',
  variant = 'primary',
  showStatus = true,
  autoStop,
  onTranscript,
  onError,
  className,
}) => {
  const {
    isRecording,
    isProcessing,
    currentSession,
    error,
    transcriptBuffer,
    confidence,
    startRecording,
    stopRecording,
    clearSession,
    clearError,
  } = useVoiceStore();

  const [recordingTime, setRecordingTime] = useState(0);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Auto-stop timer
  useEffect(() => {
    if (isRecording && autoStop) {
      const timeout = setTimeout(() => {
        handleStop();
      }, autoStop * 1000);

      return () => clearTimeout(timeout);
    }
  }, [isRecording, autoStop]);

  // Handle transcript updates
  useEffect(() => {
    if (transcriptBuffer && onTranscript) {
      onTranscript(transcriptBuffer);
    }
  }, [transcriptBuffer, onTranscript]);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording) {
      setPulseAnimation(true);
      const interval = setInterval(() => {
        setPulseAnimation((prev) => !prev);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setPulseAnimation(false);
    }
  }, [isRecording]);

  const handleStart = async () => {
    try {
      clearError();
      await startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStop = async () => {
    try {
      await stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleToggle = () => {
    if (isRecording) {
      handleStop();
    } else {
      handleStart();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getButtonContent = () => {
    if (isProcessing) {
      return {
        icon: Square,
        text: 'Processing...',
      };
    }
    
    if (isRecording) {
      return {
        icon: MicOff,
        text: showStatus ? `Stop (${formatTime(recordingTime)})` : 'Stop',
      };
    }
    
    return {
      icon: Mic,
      text: 'Start Recording',
    };
  };

  const { icon: Icon, text } = getButtonContent();

  const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {/* Main Voice Button */}
      <div className="relative">
        <Button
          variant={isRecording ? 'error' : variant}
          size={size}
          icon={Icon}
          onClick={handleToggle}
          disabled={isProcessing}
          className={cn(
            'rounded-full touch-target transition-all duration-200',
            sizeClasses[size],
            isRecording && 'animate-pulse',
            pulseAnimation && 'scale-110'
          )}
        />
        
        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute -top-1 -right-1 h-3 w-3 bg-error-500 rounded-full animate-pulse" />
        )}
        
        {/* Processing indicator */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="spinner h-6 w-6" />
          </div>
        )}
      </div>

      {/* Status Text */}
      {showStatus && (
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {text}
          </div>
          
          {/* Confidence indicator */}
          {confidence > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Confidence: {Math.round(confidence * 100)}%
            </div>
          )}
        </div>
      )}

      {/* Live Transcript */}
      {transcriptBuffer && showStatus && (
        <div className="max-w-xs p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Live Transcript:
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {transcriptBuffer}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="max-w-xs p-2 bg-error-50 border border-error-200 rounded-lg">
          <div className="text-xs text-error-600 mb-1">Error:</div>
          <div className="text-sm text-error-700">{error}</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
            className="mt-2 text-error-600"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      {(isRecording || currentSession) && (
        <div className="flex items-center gap-2">
          {isRecording && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStop}
            >
              Stop & Save
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSession}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Recording Tips */}
      {!isRecording && !currentSession && showStatus && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-xs">
          Tap to start recording. Speak your workout sets clearly.
        </div>
      )}
    </div>
  );
};