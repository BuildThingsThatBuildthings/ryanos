import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { cn } from '../../utils/cn';
import { getVoicePlaybackUrl, cleanupExpiredUrls } from '../supabase-voice';

interface VoicePlaybackProps {
  sessionId: string;
  audioFilePath: string;
  duration?: number;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onError?: (error: string) => void;
  className?: string;
  showControls?: boolean;
  autoPlay?: boolean;
}

export const VoicePlayback: React.FC<VoicePlaybackProps> = ({
  sessionId,
  audioFilePath,
  duration,
  onPlayStateChange,
  onError,
  className,
  showControls = true,
  autoPlay = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Load playback URL when component mounts
  useEffect(() => {
    loadPlaybackUrl();
  }, [sessionId, audioFilePath]);

  // Auto-play if requested
  useEffect(() => {
    if (autoPlay && playbackUrl && !isPlaying) {
      handlePlay();
    }
  }, [playbackUrl, autoPlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const loadPlaybackUrl = async () => {
    try {
      setIsLoading(true);
      
      // Check cache first
      const cacheKey = `playback-${sessionId}`;
      let cachedUrl = cleanupExpiredUrls.get(cacheKey);
      
      if (!cachedUrl) {
        const urlData = await getVoicePlaybackUrl(audioFilePath);
        if (!urlData) {
          throw new Error('Failed to get playback URL');
        }
        
        cachedUrl = urlData;
        cleanupExpiredUrls.set(cacheKey, cachedUrl);
      }
      
      setPlaybackUrl(cachedUrl.url);
      setupAudio(cachedUrl.url);
    } catch (error: any) {
      console.error('Failed to load playback URL:', error);
      if (onError) {
        onError('Failed to load audio for playback');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setupAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    // Event listeners
    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('play', () => {
      setIsPlaying(true);
      if (onPlayStateChange) {
        onPlayStateChange(true);
      }
    });

    audio.addEventListener('pause', () => {
      setIsPlaying(false);
      if (onPlayStateChange) {
        onPlayStateChange(false);
      }
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onPlayStateChange) {
        onPlayStateChange(false);
      }
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      setIsPlaying(false);
      if (onError) {
        onError('Audio playback failed');
      }
    });

    // Set initial volume
    audio.volume = volume;
    audio.muted = isMuted;
  };

  const handlePlay = async () => {
    if (!audioRef.current || !playbackUrl) return;

    try {
      await audioRef.current.play();
    } catch (error) {
      console.error('Play failed:', error);
      if (onError) {
        onError('Failed to start playback');
      }
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * audioDuration;

    audioRef.current.currentTime = Math.max(0, Math.min(newTime, audioDuration));
  };

  const handleSkipBack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const handleSkipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(audioDuration, audioRef.current.currentTime + 10);
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) {
      audioRef.current.muted = newMuted;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        <span className="ml-2 text-sm text-gray-600">Loading audio...</span>
      </div>
    );
  }

  if (!playbackUrl) {
    return (
      <div className={cn('flex items-center justify-center p-4 text-gray-500', className)}>
        <span className="text-sm">Audio not available</span>
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-50 rounded-lg p-4 space-y-3', className)}>
      {/* Progress Bar */}
      <div className="space-y-1">
        <div
          ref={progressRef}
          className="h-2 bg-gray-200 rounded-full cursor-pointer relative"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-150"
            style={{ width: `${progressPercentage}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 rounded-full shadow-sm"
            style={{ left: `${progressPercentage}%`, marginLeft: '-6px' }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(audioDuration)}</span>
        </div>
      </div>

      {showControls && (
        <>
          {/* Main Controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkipBack}
              className="h-8 w-8 p-0"
              title="Skip back 10s"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={isPlaying ? handlePause : handlePlay}
              className="h-10 w-10 p-0 rounded-full"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkipForward}
              className="h-8 w-8 p-0"
              title="Skip forward 10s"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              className="h-8 w-8 p-0 ml-2"
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMuteToggle}
              className="h-6 w-6 p-0"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(isMuted ? 0 : volume) * 100}%, #E5E7EB ${(isMuted ? 0 : volume) * 100}%, #E5E7EB 100%)`
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};