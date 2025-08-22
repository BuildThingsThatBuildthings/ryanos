import React, { useState, useEffect, useRef } from 'react';
import { Mic, Play, Pause, Download, Trash2, Clock, FileAudio, Volume2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Toast } from '../../components/ui/Toast';
import { cn } from '../../utils/cn';
import { formatters } from '../../utils/formatters';
import { useVoiceStore } from '../../stores/voiceStore';
import { VoiceButton } from '../../components/voice/VoiceButton';
import {
  getVoiceSessionWithPlayback,
  getVoiceStorageUsage,
  deleteVoiceRecording,
  cleanupExpiredUrls,
} from '../supabase-voice';

export const VoiceLogger = ({ 
  workoutId,
  onTranscriptUpdate,
  className,
  showStorageInfo = true,
  maxRecordings = 10
}) => {
  const {
    sessions,
    currentSession,
    fetchSessions,
    clearSession,
    error,
    clearError,
  } = useVoiceStore();

  const [playingSessionId, setPlayingSessionId] = useState(null);
  const [loadingPlayback, setLoadingPlayback] = useState(new Set());
  const [storageInfo, setStorageInfo] = useState(null);
  const [localError, setLocalError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const audioRef = useRef(null);
  const playbackUrlCache = useRef(new Map());

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
    loadStorageInfo();
  }, [fetchSessions]);

  // Update transcript when new transcript is available
  useEffect(() => {
    if (currentSession?.transcript && onTranscriptUpdate) {
      onTranscriptUpdate(currentSession.transcript);
    }
  }, [currentSession?.transcript, onTranscriptUpdate]);

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      cleanupExpiredUrls.clear();
    };
  }, []);

  const loadStorageInfo = async () => {
    if (!showStorageInfo) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const usage = await getVoiceStorageUsage(user.id);
        setStorageInfo(usage);
      }
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  };

  const showToastMessage = (message, type = 'info') => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handlePlayRecording = async (sessionId) => {
    try {
      // Check if already playing this recording
      if (playingSessionId === sessionId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setPlayingSessionId(null);
        return;
      }

      setLoadingPlayback(prev => new Set(prev).add(sessionId));

      // Check cache first
      const cacheKey = `playback-${sessionId}`;
      let cachedUrl = cleanupExpiredUrls.get(cacheKey);

      if (!cachedUrl) {
        // Get fresh playback URL
        const sessionWithPlayback = await getVoiceSessionWithPlayback(sessionId);
        if (!sessionWithPlayback?.playbackUrl) {
          throw new Error('No audio file available for playback');
        }

        cachedUrl = {
          url: sessionWithPlayback.playbackUrl,
          expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
        };
        cleanupExpiredUrls.set(cacheKey, cachedUrl);
      }

      // Setup audio playback
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const audio = audioRef.current;
      audio.src = cachedUrl.url;
      audio.currentTime = 0;

      const onEnded = () => {
        setPlayingSessionId(null);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };

      const onError = (e) => {
        console.error('Audio playback error:', e);
        setLocalError('Failed to play recording. Please try again.');
        setPlayingSessionId(null);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);

      await audio.play();
      setPlayingSessionId(sessionId);
    } catch (error) {
      console.error('Playback failed:', error);
      setLocalError('Failed to play recording. Please try again.');
    } finally {
      setLoadingPlayback(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  };

  const handleDeleteRecording = async (session) => {
    if (!confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete from storage if audio file exists
      if (session.audio_file_path) {
        const deleted = await deleteVoiceRecording(session.audio_file_path);
        if (!deleted) {
          throw new Error('Failed to delete audio file');
        }
      }

      // Refresh sessions list
      await fetchSessions();
      await loadStorageInfo();

      showToastMessage('Recording deleted successfully', 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      setLocalError('Failed to delete recording. Please try again.');
    }
  };

  const handleDownloadRecording = async (session) => {
    try {
      const sessionWithPlayback = await getVoiceSessionWithPlayback(session.id);
      if (!sessionWithPlayback?.playbackUrl) {
        throw new Error('No audio file available for download');
      }

      // Create download link
      const link = document.createElement('a');
      link.href = sessionWithPlayback.playbackUrl;
      link.download = `voice-recording-${session.id.slice(0, 8)}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToastMessage('Download started', 'success');
    } catch (error) {
      console.error('Download failed:', error);
      setLocalError('Failed to download recording. Please try again.');
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024) * 100) / 100} MB`;
  };

  const recentSessions = sessions
    .filter(session => workoutId ? session.workoutId === workoutId : true)
    .slice(0, maxRecordings);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Voice Recording Interface */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Voice Logger
          </h3>
          {currentSession && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              Session Active
            </div>
          )}
        </div>

        {/* Voice Recording Button */}
        <div className="flex justify-center mb-4">
          <VoiceButton
            size="lg"
            showStatus={true}
            onTranscript={(transcript) => {
              if (onTranscriptUpdate) {
                onTranscriptUpdate(transcript);
              }
            }}
            onError={(error) => setLocalError(error)}
          />
        </div>

        {/* Error Display */}
        {(error || localError) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-700">{error || localError}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearError();
                  setLocalError('');
                }}
              >
                ×
              </Button>
            </div>
          </div>
        )}

        {/* Current Session Info */}
        {currentSession && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Current Session</h4>
            <div className="space-y-2 text-sm text-blue-700">
              <div>Started: {formatters.formatDateTime(currentSession.startTime)}</div>
              <div>Status: {currentSession.status}</div>
              {currentSession.transcript && (
                <div>
                  <div className="font-medium mb-1">Transcript:</div>
                  <div className="bg-white p-2 rounded border italic">
                    {currentSession.transcript}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Storage Information */}
      {showStorageInfo && storageInfo && (
        <Card className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <FileAudio className="h-4 w-4" />
            Storage Usage
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Total Size</div>
              <div className="font-medium">{storageInfo.totalSizeMB} MB</div>
            </div>
            <div>
              <div className="text-gray-500">Recordings</div>
              <div className="font-medium">{storageInfo.recordingCount}</div>
            </div>
            <div>
              <div className="text-gray-500">Total Duration</div>
              <div className="font-medium">{storageInfo.totalDurationMinutes} min</div>
            </div>
            <div>
              <div className="text-gray-500">Avg Size</div>
              <div className="font-medium">{storageInfo.averageSizeKB} KB</div>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Recordings */}
      <Card className="p-4">
        <h4 className="font-medium mb-4">Recent Recordings</h4>
        
        {recentSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileAudio className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recordings yet</p>
            <p className="text-sm">Start recording to see your sessions here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {formatters.formatDateTime(session.startTime)}
                    </span>
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      session.status === 'completed' && 'bg-green-100 text-green-700',
                      session.status === 'processing' && 'bg-yellow-100 text-yellow-700',
                      session.status === 'error' && 'bg-red-100 text-red-700'
                    )}>
                      {session.status}
                    </span>
                  </div>
                  
                  {session.transcript && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {session.transcript}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {session.audio_duration && (
                      <span>{formatDuration(session.audio_duration)}</span>
                    )}
                    {session.audio_file_size && (
                      <span>{formatFileSize(session.audio_file_size)}</span>
                    )}
                    {session.confidence_score && (
                      <span>Confidence: {Math.round(session.confidence_score * 100)}%</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-4">
                  {/* Play/Pause Button */}
                  {session.audio_file_path && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePlayRecording(session.id)}
                      disabled={loadingPlayback.has(session.id)}
                      className="h-8 w-8 p-0"
                    >
                      {loadingPlayback.has(session.id) ? (
                        <LoadingSpinner className="h-4 w-4" />
                      ) : playingSessionId === session.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {/* Download Button */}
                  {session.audio_file_path && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadRecording(session)}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRecording(session)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Toast Notifications */}
      {showToast && (
        <Toast
          message={toastMessage}
          type="info"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};