/**
 * VoiceLogger - React component for voice input with push-to-talk and VOX modes
 * Provides real-time transcription, confidence indicators, and voice feedback
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import VoiceService from '../core/VoiceService.js';
import WebSpeechProvider from '../providers/WebSpeechProvider.js';
import WhisperProvider from '../providers/WhisperProvider.js';
import IntentParser from '../nlu/IntentParser.js';
import TTSQueue from '../tts/TTSQueue.js';
import './VoiceLogger.css';

const VoiceLogger = ({ 
  onIntent, 
  onTranscript, 
  exerciseLibrary = [],
  disabled = false,
  config = {} 
}) => {
  // State management
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [mode, setMode] = useState('push-to-talk'); // 'push-to-talk' or 'vox'
  const [voiceProvider, setVoiceProvider] = useState('webSpeech');
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState(null);
  const [recentIntents, setRecentIntents] = useState([]);
  const [showTranscript, setShowTranscript] = useState(true);

  // Refs
  const voiceServiceRef = useRef(null);
  const intentParserRef = useRef(null);
  const ttsQueueRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const volumeTimerRef = useRef(null);
  const pushToTalkRef = useRef(false);
  const voxThresholdRef = useRef(0.1);
  const voxTimeoutRef = useRef(null);

  // Configuration
  const voiceConfig = {
    confidenceThreshold: 0.7,
    voxSensitivity: 0.1,
    voxTimeout: 2000,
    maxTranscriptLength: 500,
    ...config
  };

  // Initialize voice service
  useEffect(() => {
    const initializeVoiceService = async () => {
      try {
        // Create voice service
        const voiceService = new VoiceService({
          defaultSTTProvider: voiceProvider,
          confidenceThreshold: voiceConfig.confidenceThreshold
        });

        // Register providers
        voiceService.registerProvider('webSpeech', new WebSpeechProvider());
        voiceService.registerProvider('whisper', new WhisperProvider({
          apiKey: process.env.REACT_APP_OPENAI_API_KEY
        }));

        // Create intent parser
        const intentParser = new IntentParser();
        intentParser.loadExerciseLibrary(exerciseLibrary);

        // Create TTS queue
        const ttsQueue = new TTSQueue(voiceService);

        voiceServiceRef.current = voiceService;
        intentParserRef.current = intentParser;
        ttsQueueRef.current = ttsQueue;

        // Setup audio context for volume monitoring
        if (mode === 'vox') {
          await setupAudioMonitoring();
        }

      } catch (error) {
        console.error('Failed to initialize voice service:', error);
        setError('Failed to initialize voice recognition');
      }
    };

    initializeVoiceService();

    return () => {
      stopListening();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [voiceProvider, mode]);

  // Setup audio monitoring for VOX mode
  const setupAudioMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      if (mode === 'vox') {
        startVolumeMonitoring();
      }
    } catch (error) {
      console.error('Failed to setup audio monitoring:', error);
      setError('Microphone access denied');
    }
  };

  // Start volume monitoring for VOX
  const startVolumeMonitoring = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkVolume = () => {
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / bufferLength;
      const normalizedVolume = average / 255;
      
      setVolume(normalizedVolume);

      // VOX triggering logic
      if (mode === 'vox' && !isListening && normalizedVolume > voxThresholdRef.current) {
        startListening();
      } else if (mode === 'vox' && isListening && normalizedVolume < voxThresholdRef.current * 0.5) {
        // Start timeout to stop listening if volume stays low
        if (voxTimeoutRef.current) {
          clearTimeout(voxTimeoutRef.current);
        }
        voxTimeoutRef.current = setTimeout(() => {
          if (isListening) {
            stopListening();
          }
        }, voiceConfig.voxTimeout);
      } else if (mode === 'vox' && isListening && normalizedVolume > voxThresholdRef.current) {
        // Cancel timeout if volume goes back up
        if (voxTimeoutRef.current) {
          clearTimeout(voxTimeoutRef.current);
          voxTimeoutRef.current = null;
        }
      }

      if (mode === 'vox') {
        volumeTimerRef.current = requestAnimationFrame(checkVolume);
      }
    };

    checkVolume();
  };

  // Start listening
  const startListening = useCallback(async () => {
    if (!voiceServiceRef.current || isListening || disabled) return;

    try {
      setIsListening(true);
      setError(null);
      setCurrentTranscript('');
      setFinalTranscript('');
      setConfidence(0);

      const result = await voiceServiceRef.current.transcribe(null, {
        provider: voiceProvider,
        continuous: mode === 'vox',
        interimResults: true,
        onInterim: (interim) => {
          setCurrentTranscript(interim.text);
          setConfidence(interim.confidence);
        }
      });

      // Process final result
      if (result.text) {
        setFinalTranscript(result.text);
        setConfidence(result.confidence);
        await processTranscript(result.text, result.confidence);
      }

    } catch (error) {
      console.error('Speech recognition error:', error);
      setError(error.message);
    } finally {
      setIsListening(false);
    }
  }, [voiceProvider, mode, disabled, isListening]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (!isListening) return;

    try {
      if (voiceServiceRef.current && typeof voiceServiceRef.current.stopListening === 'function') {
        voiceServiceRef.current.stopListening();
      }
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }

    setIsListening(false);
    
    if (volumeTimerRef.current) {
      cancelAnimationFrame(volumeTimerRef.current);
    }
    
    if (voxTimeoutRef.current) {
      clearTimeout(voxTimeoutRef.current);
      voxTimeoutRef.current = null;
    }
  }, [isListening]);

  // Process transcript and extract intent
  const processTranscript = async (transcript, confidence) => {
    if (!transcript.trim() || !intentParserRef.current) return;

    setIsProcessing(true);

    try {
      // Parse intent
      const intent = intentParserRef.current.parseIntent(transcript, {
        currentWorkout: true, // TODO: Get from context
        lastExercise: null // TODO: Get from context
      });

      // Add to recent intents
      setRecentIntents(prev => [
        { ...intent, timestamp: Date.now() },
        ...prev.slice(0, 4)
      ]);

      // Call callbacks
      if (onTranscript) {
        onTranscript(transcript, confidence);
      }

      if (onIntent && intent.confidence >= voiceConfig.confidenceThreshold) {
        await onIntent(intent);
        
        // Generate TTS confirmation
        const confirmation = generateConfirmation(intent);
        if (confirmation && ttsQueueRef.current) {
          ttsQueueRef.current.enqueue(confirmation, { priority: 'normal' });
        }
      } else if (intent.needsConfirmation) {
        // Ask for confirmation on low confidence
        const clarification = `I heard "${transcript}". Did you mean to ${intent.intent.replace('_', ' ')}?`;
        if (ttsQueueRef.current) {
          ttsQueueRef.current.enqueue(clarification, { priority: 'high' });
        }
      }

    } catch (error) {
      console.error('Error processing transcript:', error);
      setError('Failed to process voice command');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate confirmation message based on intent
  const generateConfirmation = (intent) => {
    if (!ttsQueueRef.current) return null;

    switch (intent.intent) {
      case 'log_set':
        return ttsQueueRef.current.generateSetConfirmation(intent.parameters);
      case 'start_workout':
        return ttsQueueRef.current.generateWorkoutStartConfirmation(intent.parameters);
      case 'edit_last':
        return ttsQueueRef.current.generateEditConfirmation(intent.parameters);
      case 'undo_last':
        return ttsQueueRef.current.generateUndoConfirmation();
      case 'rest_timer':
        return ttsQueueRef.current.generateRestTimerStart(intent.parameters.seconds);
      default:
        return null;
    }
  };

  // Handle push-to-talk events
  const handleMouseDown = () => {
    if (mode === 'push-to-talk') {
      pushToTalkRef.current = true;
      startListening();
    }
  };

  const handleMouseUp = () => {
    if (mode === 'push-to-talk' && pushToTalkRef.current) {
      pushToTalkRef.current = false;
      stopListening();
    }
  };

  // Handle keyboard events for push-to-talk
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (mode === 'push-to-talk' && e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        pushToTalkRef.current = true;
        startListening();
      }
    };

    const handleKeyUp = (e) => {
      if (mode === 'push-to-talk' && e.code === 'Space' && pushToTalkRef.current) {
        e.preventDefault();
        pushToTalkRef.current = false;
        stopListening();
      }
    };

    if (mode === 'push-to-talk') {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, startListening, stopListening]);

  // Toggle VOX mode
  const toggleVOX = () => {
    if (mode === 'vox') {
      stopListening();
      setMode('push-to-talk');
    } else {
      setMode('vox');
      if (analyserRef.current) {
        startVolumeMonitoring();
      }
    }
  };

  // Clear transcript
  const clearTranscript = () => {
    setCurrentTranscript('');
    setFinalTranscript('');
    setConfidence(0);
    setError(null);
  };

  // Undo last action
  const undoLast = () => {
    if (recentIntents.length > 0 && onIntent) {
      const undoIntent = {
        intent: 'undo_last',
        confidence: 1.0,
        parameters: {},
        utterance: 'undo',
        timestamp: Date.now()
      };
      onIntent(undoIntent);
      
      if (ttsQueueRef.current) {
        const confirmation = ttsQueueRef.current.generateUndoConfirmation();
        ttsQueueRef.current.enqueue(confirmation, { priority: 'normal' });
      }
    }
  };

  return (
    <div className={`voice-logger ${disabled ? 'disabled' : ''}`}>
      {/* Header Controls */}
      <div className="voice-logger__header">
        <div className="voice-logger__mode-controls">
          <button
            className={`mode-toggle ${mode === 'push-to-talk' ? 'active' : ''}`}
            onClick={() => setMode('push-to-talk')}
            disabled={disabled}
          >
            Push to Talk
          </button>
          <button
            className={`mode-toggle ${mode === 'vox' ? 'active' : ''}`}
            onClick={toggleVOX}
            disabled={disabled}
          >
            VOX
          </button>
        </div>

        <div className="voice-logger__provider-select">
          <select
            value={voiceProvider}
            onChange={(e) => setVoiceProvider(e.target.value)}
            disabled={disabled || isListening}
          >
            <option value="webSpeech">Web Speech</option>
            <option value="whisper">Whisper</option>
          </select>
        </div>
      </div>

      {/* Main Voice Input Area */}
      <div className="voice-logger__input-area">
        {/* Microphone Button */}
        <button
          className={`voice-logger__mic-button ${
            isListening ? 'listening' : ''
          } ${isProcessing ? 'processing' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          disabled={disabled || (mode === 'vox' && isListening)}
          title={mode === 'push-to-talk' ? 'Hold to speak or press spacebar' : 'VOX mode active'}
        >
          <div className="mic-icon">
            {isListening ? '🎤' : '🎙️'}
          </div>
          {mode === 'vox' && (
            <div className="volume-indicator">
              <div 
                className="volume-bar" 
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          )}
        </button>

        {/* Status Indicators */}
        <div className="voice-logger__status">
          {isListening && (
            <div className="status-indicator listening">
              Listening...
            </div>
          )}
          {isProcessing && (
            <div className="status-indicator processing">
              Processing...
            </div>
          )}
          {error && (
            <div className="status-indicator error">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Transcript Display */}
      {showTranscript && (
        <div className="voice-logger__transcript">
          <div className="transcript-header">
            <span>Transcript</span>
            <div className="transcript-controls">
              <button onClick={() => setShowTranscript(false)} className="minimize-btn">
                −
              </button>
              <button onClick={clearTranscript} className="clear-btn">
                Clear
              </button>
            </div>
          </div>
          
          <div className="transcript-content">
            {currentTranscript && (
              <div className="current-transcript">
                <span className="transcript-text">{currentTranscript}</span>
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill" 
                    style={{ width: `${confidence * 100}%` }}
                  />
                  <span className="confidence-text">
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
              </div>
            )}
            
            {finalTranscript && (
              <div className="final-transcript">
                <strong>{finalTranscript}</strong>
                <span className="confidence-badge">
                  {Math.round(confidence * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Intents */}
      {recentIntents.length > 0 && (
        <div className="voice-logger__recent-intents">
          <div className="recent-intents-header">
            Recent Commands
            <button onClick={undoLast} className="undo-btn" disabled={disabled}>
              Undo Last
            </button>
          </div>
          <div className="recent-intents-list">
            {recentIntents.map((intent, index) => (
              <div key={intent.timestamp} className={`intent-item ${intent.intent}`}>
                <div className="intent-summary">
                  <span className="intent-name">
                    {intent.intent.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="intent-confidence">
                    {Math.round(intent.confidence * 100)}%
                  </span>
                </div>
                <div className="intent-details">
                  {intent.utterance}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="voice-logger__instructions">
        {mode === 'push-to-talk' ? (
          <p>Hold the microphone button or press spacebar to speak</p>
        ) : (
          <p>VOX mode active - speak naturally when volume exceeds threshold</p>
        )}
      </div>
    </div>
  );
};

export default VoiceLogger;