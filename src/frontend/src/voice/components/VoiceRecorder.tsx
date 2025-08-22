import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Download, Settings } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/Card';
import { cn } from '../../utils/cn';
import { VoiceProcessor, ProcessingOptions } from '../VoiceProcessor';
import { useVoiceStore } from '../../stores/voiceStore';

interface VoiceRecorderProps {
  workoutId?: string;
  onRecordingComplete?: (result: any) => void;
  onTranscriptUpdate?: (transcript: string) => void;
  onError?: (error: string) => void;
  className?: string;
  autoSave?: boolean;
  processingOptions?: ProcessingOptions;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  workoutId,
  onRecordingComplete,
  onTranscriptUpdate,
  onError,
  className,
  autoSave = true,
  processingOptions,
}) => {
  const {
    isRecording,
    isProcessing,
    currentSession,
    startRecording,
    stopRecording,
    clearError,
  } = useVoiceStore();

  const [showSettings, setShowSettings] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [localOptions, setLocalOptions] = useState<ProcessingOptions>({
    enableRealTimeTranscription: false,
    confidenceThreshold: 0.7,
    languageDetection: true,
    workoutContextEnabled: true,
    ...processingOptions,
  });

  const intervalRef = useRef<NodeJS.Timeout>();
  const analyserRef = useRef<AnalyserNode>();
  const voiceProcessor = useRef(new VoiceProcessor(localOptions));

  // Update processor options when they change
  useEffect(() => {
    voiceProcessor.current = new VoiceProcessor(localOptions);
  }, [localOptions]);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  const setupAudioAnalyser = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start monitoring audio levels
      const monitorAudioLevel = () => {
        if (!analyserRef.current || !isRecording) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        setAudioLevel(average / 255); // Normalize to 0-1

        if (isRecording) {
          requestAnimationFrame(monitorAudioLevel);
        }
      };

      monitorAudioLevel();
    } catch (error) {
      console.error('Failed to setup audio analyser:', error);
    }
  };

  const handleStartRecording = async () => {
    try {
      clearError();
      await startRecording();
      setupAudioAnalyser();
    } catch (error: any) {
      console.error('Recording start failed:', error);
      if (onError) {
        onError('Failed to start recording');
      }
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopRecording();
      setAudioLevel(0);
    } catch (error: any) {
      console.error('Recording stop failed:', error);
      if (onError) {
        onError('Failed to stop recording');
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSettingsUpdate = (newOptions: ProcessingOptions) => {
    setLocalOptions(newOptions);
    setShowSettings(false);
  };

  const getRecordingStatusColor = () => {
    if (isProcessing) return 'text-yellow-600';
    if (isRecording) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Recording Interface */}
      <Card className="p-6">
        <div className="flex flex-col items-center space-y-4">
          {/* Audio Level Visualization */}
          {isRecording && (
            <div className="w-full max-w-xs">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-red-500 transition-all duration-150"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
              <div className="text-center text-xs text-gray-500 mt-1">
                Audio Level: {Math.round(audioLevel * 100)}%
              </div>
            </div>
          )}

          {/* Recording Button */}
          <div className="relative">
            <Button
              variant={isRecording ? 'error' : 'primary'}
              size="lg"
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={isProcessing}
              className={cn(
                'h-16 w-16 rounded-full transition-all duration-200',
                isRecording && 'animate-pulse scale-110'
              )}
              icon={isProcessing ? Square : isRecording ? MicOff : Mic}
            />
            
            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>

          {/* Status Display */}
          <div className="text-center">
            <div className={cn('text-lg font-medium', getRecordingStatusColor())}>
              {isProcessing ? 'Processing...' : isRecording ? `Recording (${formatTime(recordingTime)})` : 'Ready to Record'}
            </div>
            
            {currentSession && currentSession.transcript && (
              <div className="mt-2 text-sm text-gray-600 max-w-md">
                <div className="font-medium mb-1">Live Transcript:</div>
                <div className="bg-gray-100 p-2 rounded text-left">
                  {currentSession.transcript}
                </div>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSettings(true)}
              icon={Settings}
            >
              Settings
            </Button>
            
            {currentSession && autoSave && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Download functionality could be implemented here
                  console.log('Download session:', currentSession);
                }}
                icon={Download}
              >
                Download
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Settings Modal */}
      {showSettings && (
        <Modal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          title="Voice Recording Settings"
        >
          <div className="space-y-6">
            {/* Real-time Transcription */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Real-time Transcription</label>
                <p className="text-xs text-gray-500 mt-1">
                  Enable live transcription during recording
                </p>
              </div>
              <input
                type="checkbox"
                checked={localOptions.enableRealTimeTranscription}
                onChange={(e) => setLocalOptions(prev => ({
                  ...prev,
                  enableRealTimeTranscription: e.target.checked
                }))}
                className="toggle"
              />
            </div>

            {/* Confidence Threshold */}
            <div>
              <label className="text-sm font-medium block mb-2">
                Confidence Threshold: {Math.round((localOptions.confidenceThreshold || 0.7) * 100)}%
              </label>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.1"
                value={localOptions.confidenceThreshold || 0.7}
                onChange={(e) => setLocalOptions(prev => ({
                  ...prev,
                  confidenceThreshold: parseFloat(e.target.value)
                }))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher values require more accurate speech recognition
              </p>
            </div>

            {/* Language Detection */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Language Detection</label>
                <p className="text-xs text-gray-500 mt-1">
                  Automatically detect spoken language
                </p>
              </div>
              <input
                type="checkbox"
                checked={localOptions.languageDetection}
                onChange={(e) => setLocalOptions(prev => ({
                  ...prev,
                  languageDetection: e.target.checked
                }))}
                className="toggle"
              />
            </div>

            {/* Workout Context */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Workout Context</label>
                <p className="text-xs text-gray-500 mt-1">
                  Enhanced recognition for fitness terminology
                </p>
              </div>
              <input
                type="checkbox"
                checked={localOptions.workoutContextEnabled}
                onChange={(e) => setLocalOptions(prev => ({
                  ...prev,
                  workoutContextEnabled: e.target.checked
                }))}
                className="toggle"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSettingsUpdate(localOptions)}
              >
                Save Settings
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};