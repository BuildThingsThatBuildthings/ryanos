/**
 * Comprehensive test suite for the Voice Processing System
 * Tests all components: STT/TTS providers, NLU, intent parsing, and offline functionality
 */

import VoiceService from '../core/VoiceService.js';
import WebSpeechProvider from '../providers/WebSpeechProvider.js';
import WhisperProvider from '../providers/WhisperProvider.js';
import IntentParser from '../nlu/IntentParser.js';
import NumberParser from '../utils/NumberParser.js';
import TTSQueue from '../tts/TTSQueue.js';
import OfflineManager from '../offline/OfflineManager.js';
import { calculateLevenshteinDistance, findBestMatch } from '../utils/StringUtils.js';

// Mock DOM APIs
global.navigator = {
  onLine: true,
  mediaDevices: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    })
  }
};

global.window = {
  speechSynthesis: {
    speak: jest.fn(),
    cancel: jest.fn(),
    getVoices: jest.fn().mockReturnValue([]),
    speaking: false
  },
  SpeechSynthesisUtterance: jest.fn().mockImplementation((text) => ({
    text,
    rate: 1,
    pitch: 1,
    volume: 1,
    onend: null,
    onerror: null
  })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  AudioContext: jest.fn().mockImplementation(() => ({
    createOscillator: jest.fn().mockReturnValue({
      connect: jest.fn(),
      frequency: { setValueAtTime: jest.fn() },
      type: 'sine',
      start: jest.fn(),
      stop: jest.fn()
    }),
    createGain: jest.fn().mockReturnValue({
      connect: jest.fn(),
      gain: {
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn()
      }
    }),
    destination: {},
    currentTime: 0
  })),
  localStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  },
  sessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  }
};

global.fetch = jest.fn();

// Sample exercise library for testing
const mockExercises = [
  {
    id: '1',
    name: 'Barbell Bench Press',
    category: 'strength',
    muscle_groups: ['chest', 'triceps', 'shoulders']
  },
  {
    id: '2',
    name: 'Back Squat',
    category: 'strength',
    muscle_groups: ['quadriceps', 'glutes', 'hamstrings']
  },
  {
    id: '3',
    name: 'Deadlift',
    category: 'strength',
    muscle_groups: ['back', 'glutes', 'hamstrings']
  },
  {
    id: '4',
    name: 'Overhead Press',
    category: 'strength',
    muscle_groups: ['shoulders', 'triceps']
  },
  {
    id: '5',
    name: 'Pull-ups',
    category: 'strength',
    muscle_groups: ['back', 'biceps']
  }
];

describe('Voice Processing System', () => {
  
  describe('VoiceService Core', () => {
    let voiceService;
    
    beforeEach(() => {
      voiceService = new VoiceService();
    });
    
    test('should initialize with default configuration', () => {
      expect(voiceService.config.defaultSTTProvider).toBe('webSpeech');
      expect(voiceService.config.defaultTTSProvider).toBe('webSpeech');
      expect(voiceService.config.confidenceThreshold).toBe(0.7);
    });
    
    test('should register providers correctly', () => {
      const mockProvider = { type: 'stt', transcribe: jest.fn() };
      voiceService.registerProvider('test', mockProvider);
      
      expect(voiceService.providers.has('test')).toBe(true);
      expect(voiceService.getProviders('stt')).toContain('test');
    });
    
    test('should create and manage sessions', async () => {
      const session = await voiceService.startSession('workout', { test: true });
      
      expect(session.type).toBe('workout');
      expect(session.metadata.test).toBe(true);
      expect(session.status).toBe('active');
      expect(voiceService.currentSession).toBe(session);
    });
    
    test('should end sessions and calculate duration', async () => {
      await voiceService.startSession('workout');
      
      // Wait a bit to ensure duration > 0
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const endedSession = await voiceService.endSession();
      
      expect(endedSession.status).toBe('completed');
      expect(endedSession.duration).toBeGreaterThan(0);
      expect(voiceService.currentSession).toBe(null);
    });
  });
  
  describe('Intent Parser', () => {
    let intentParser;
    
    beforeEach(() => {
      intentParser = new IntentParser();
      intentParser.loadExerciseLibrary(mockExercises);
    });
    
    test('should parse log_set intents correctly', () => {
      const testCases = [
        {
          input: 'bench press 10 reps at 185 pounds',
          expected: {
            intent: 'log_set',
            exercise: 'Barbell Bench Press',
            reps: 10,
            weight: 185,
            unit: 'lbs'
          }
        },
        {
          input: 'squat 225 lbs 5 reps',
          expected: {
            intent: 'log_set',
            exercise: 'Back Squat',
            reps: 5,
            weight: 225,
            unit: 'lbs'
          }
        },
        {
          input: 'deadlift 8 reps 315 pounds RPE 9',
          expected: {
            intent: 'log_set',
            exercise: 'Deadlift',
            reps: 8,
            weight: 315,
            unit: 'lbs',
            rpe: 9
          }
        }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = intentParser.parseIntent(input);
        
        expect(result.intent).toBe(expected.intent);
        expect(result.parameters.exercise?.name).toBe(expected.exercise);
        expect(result.parameters.reps).toBe(expected.reps);
        expect(result.parameters.weight).toBe(expected.weight);
        expect(result.parameters.unit).toBe(expected.unit);
        
        if (expected.rpe) {
          expect(result.parameters.rpe).toBe(expected.rpe);
        }
      });
    });
    
    test('should parse start_workout intents', () => {
      const testCases = [
        {
          input: 'start workout',
          expected: { intent: 'start_workout', title: null }
        },
        {
          input: 'begin push day',
          expected: { intent: 'start_workout', title: 'push day' }
        },
        {
          input: 'lets start training',
          expected: { intent: 'start_workout', title: null }
        }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = intentParser.parseIntent(input);
        
        expect(result.intent).toBe(expected.intent);
        expect(result.parameters.title).toBe(expected.title);
      });
    });
    
    test('should parse edit_last intents', () => {
      const testCases = [
        {
          input: 'change weight to 200',
          expected: { intent: 'edit_last', field: 'weight', value: { weight: 200, unit: 'lbs' } }
        },
        {
          input: 'edit reps to 12',
          expected: { intent: 'edit_last', field: 'reps', value: 12 }
        },
        {
          input: 'modify RPE to 8',
          expected: { intent: 'edit_last', field: 'rpe', value: 8 }
        }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = intentParser.parseIntent(input);
        
        expect(result.intent).toBe(expected.intent);
        expect(result.parameters.field).toBe(expected.field);
        
        if (expected.field === 'weight') {
          expect(result.parameters.value.weight).toBe(expected.value.weight);
          expect(result.parameters.value.unit).toBe(expected.value.unit);
        } else {
          expect(result.parameters.value).toBe(expected.value);
        }
      });
    });
    
    test('should parse rest_timer intents', () => {
      const testCases = [
        {
          input: 'rest for 3 minutes',
          expected: { intent: 'rest_timer', seconds: 180 }
        },
        {
          input: 'timer 90 seconds',
          expected: { intent: 'rest_timer', seconds: 90 }
        },
        {
          input: '2 minutes break',
          expected: { intent: 'rest_timer', seconds: 120 }
        }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = intentParser.parseIntent(input);
        
        expect(result.intent).toBe(expected.intent);
        expect(result.parameters.seconds).toBe(expected.seconds);
      });
    });
    
    test('should handle fuzzy exercise name matching', () => {
      const testCases = [
        'bench', // Should match "Barbell Bench Press"
        'squat', // Should match "Back Squat"
        'dead lift', // Should match "Deadlift"
        'pullup', // Should match "Pull-ups"
        'ohp' // Should match "Overhead Press" through synonyms
      ];
      
      testCases.forEach(input => {
        const exercise = intentParser.findExercise(input);
        expect(exercise).not.toBe(null);
        expect(exercise.name).toBeDefined();
      });
    });
    
    test('should return unknown intent for unrecognized input', () => {
      const result = intentParser.parseIntent('this is completely random text');
      
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });
  
  describe('Number Parser', () => {
    let numberParser;
    
    beforeEach(() => {
      numberParser = new NumberParser();
    });
    
    test('should parse numeric values', () => {
      expect(numberParser.parseNumber('123')).toBe(123);
      expect(numberParser.parseNumber('45.5')).toBe(45.5);
      expect(numberParser.parseNumber('0')).toBe(0);
    });
    
    test('should parse word numbers', () => {
      expect(numberParser.parseNumber('one')).toBe(1);
      expect(numberParser.parseNumber('twenty')).toBe(20);
      expect(numberParser.parseNumber('fifty')).toBe(50);
      expect(numberParser.parseNumber('one hundred')).toBe(100);
      expect(numberParser.parseNumber('two hundred fifty')).toBe(250);
    });
    
    test('should parse weights with units', () => {
      const testCases = [
        { input: '185 pounds', expected: { weight: 185, unit: 'lbs' } },
        { input: '80 kg', expected: { weight: 80, unit: 'kg' } },
        { input: 'one fifty lbs', expected: { weight: 150, unit: 'lbs' } }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = numberParser.parseWeight(input);
        expect(result.weight).toBe(expected.weight);
        expect(result.unit).toBe(expected.unit);
      });
    });
    
    test('should parse time durations', () => {
      const testCases = [
        { input: '3 minutes', expected: { duration: 3, unit: 'minutes', seconds: 180 } },
        { input: '90 seconds', expected: { duration: 90, unit: 'seconds', seconds: 90 } },
        { input: 'two minutes', expected: { duration: 2, unit: 'minutes', seconds: 120 } }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = numberParser.parseTime(input);
        expect(result.duration).toBe(expected.duration);
        expect(result.unit).toBe(expected.unit);
        expect(result.seconds).toBe(expected.seconds);
      });
    });
    
    test('should parse RPE values', () => {
      const testCases = [
        { input: 'RPE 8', expected: 8 },
        { input: 'rpe nine', expected: 9 },
        { input: 'at 7', expected: 7 },
        { input: 'rated 6.5', expected: 6.5 }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = numberParser.parseRPE(input);
        expect(result.rpe).toBe(expected);
      });
    });
    
    test('should convert units correctly', () => {
      // Weight conversions
      expect(numberParser.convertWeight(100, 'kg', 'lbs')).toBeCloseTo(220.46, 1);
      expect(numberParser.convertWeight(200, 'lbs', 'kg')).toBeCloseTo(90.72, 1);
      
      // Time conversions
      expect(numberParser.convertTime(2, 'minutes', 'seconds')).toBe(120);
      expect(numberParser.convertTime(90, 'seconds', 'minutes')).toBe(1.5);
    });
  });
  
  describe('String Utils', () => {
    test('should calculate Levenshtein distance correctly', () => {
      expect(calculateLevenshteinDistance('bench', 'bench')).toBe(0);
      expect(calculateLevenshteinDistance('bench', 'bensh')).toBe(1);
      expect(calculateLevenshteinDistance('squat', 'squad')).toBe(1);
      expect(calculateLevenshteinDistance('deadlift', 'dead')).toBe(4);
    });
    
    test('should find best matches', () => {
      const candidates = ['Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Bench Press'];
      
      const result = findBestMatch('bench', candidates);
      expect(result.match).toContain('Bench Press');
      expect(result.score).toBeGreaterThan(0.5);
    });
  });
  
  describe('TTS Queue', () => {
    let ttsQueue;
    let mockVoiceService;
    
    beforeEach(() => {
      mockVoiceService = {
        speak: jest.fn().mockResolvedValue({ success: true }),
        stopSpeaking: jest.fn()
      };
      ttsQueue = new TTSQueue(mockVoiceService);
    });
    
    test('should enqueue messages with priority', () => {
      const id1 = ttsQueue.enqueue('Low priority message', { priority: 'low' });
      const id2 = ttsQueue.enqueue('High priority message', { priority: 'high' });
      const id3 = ttsQueue.enqueue('Normal priority message');
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id3).toBeDefined();
      
      const status = ttsQueue.getStatus();
      expect(status.queueLength).toBe(3);
    });
    
    test('should generate appropriate confirmations', () => {
      const setData = {
        exercise: { name: 'Bench Press' },
        reps: 10,
        weight: 185,
        unit: 'lbs',
        rpe: 8
      };
      
      const confirmation = ttsQueue.generateSetConfirmation(setData);
      expect(confirmation).toContain('10 reps');
      expect(confirmation).toContain('185 lbs');
      expect(confirmation).toContain('RPE 8');
    });
    
    test('should handle different confirmation styles', () => {
      ttsQueue.updatePersona({ confirmationStyle: 'minimal' });
      expect(ttsQueue.generateUndoConfirmation()).toBe('Undone.');
      
      ttsQueue.updatePersona({ confirmationStyle: 'detailed' });
      expect(ttsQueue.generateUndoConfirmation()).toBe('Last entry has been removed successfully.');
      
      ttsQueue.updatePersona({ confirmationStyle: 'concise' });
      expect(ttsQueue.generateUndoConfirmation()).toBe('Last set removed.');
    });
    
    test('should process message text for better TTS', () => {
      const processed = ttsQueue.processMessage('BP 185 lbs 10 reps RPE 8');
      expect(processed).toContain('bench press');
      expect(processed).toContain('pounds');
      expect(processed).toContain('repetitions');
      expect(processed).toContain('rate of perceived exertion');
    });
  });
  
  describe('Offline Manager', () => {
    let offlineManager;
    
    beforeEach(() => {
      // Reset localStorage mocks
      window.localStorage.getItem.mockReturnValue(null);
      window.sessionStorage.getItem.mockReturnValue(null);
      
      offlineManager = new OfflineManager();
    });
    
    afterEach(() => {
      offlineManager.destroy();
    });
    
    test('should initialize with empty storage', () => {
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'voice_offline_queue',
        JSON.stringify([])
      );
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
        'voice_session_data',
        JSON.stringify({})
      );
    });
    
    test('should queue events when offline', () => {
      const event = {
        type: 'transcription',
        transcript: 'bench press 10 reps 185 pounds',
        confidence: 0.95,
        sessionId: 'test-session'
      };
      
      const eventId = offlineManager.queueEvent(event);
      expect(eventId).toBeDefined();
      expect(eventId).toMatch(/^offline_/);
    });
    
    test('should queue sessions', () => {
      const session = {
        id: 'test-session',
        type: 'workout',
        startTime: Date.now(),
        metadata: { test: true }
      };
      
      offlineManager.queueSession(session);
      
      // Should have called sessionStorage.setItem
      expect(window.sessionStorage.setItem).toHaveBeenCalled();
    });
    
    test('should compress and decompress events', () => {
      const event = {
        transcript: 'this is a test transcript with repeated words words words',
        confidence: 0.95,
        alternatives: ['alt1', 'alt2'], // Should be removed in compression
        rawMatch: { some: 'data' } // Should be removed in compression
      };
      
      const compressed = offlineManager.compressEvent(event);
      expect(compressed.alternatives).toBeUndefined();
      expect(compressed.rawMatch).toBeUndefined();
      
      const decompressed = offlineManager.decompressEvent(compressed);
      expect(decompressed.transcript).toBe(event.transcript);
      expect(decompressed.confidence).toBe(event.confidence);
    });
    
    test('should provide status information', () => {
      const status = offlineManager.getStatus();
      
      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('syncInProgress');
      expect(status).toHaveProperty('queuedEvents');
      expect(status).toHaveProperty('unsyncedSessions');
      expect(status).toHaveProperty('storageUsed');
    });
  });
  
  describe('Web Speech Provider', () => {
    let provider;
    
    beforeEach(() => {
      // Mock Web Speech API
      global.window.webkitSpeechRecognition = jest.fn().mockImplementation(() => ({
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
        lang: 'en-US',
        onresult: null,
        onerror: null,
        onend: null,
        start: jest.fn(),
        stop: jest.fn()
      }));
      
      provider = new WebSpeechProvider();
    });
    
    test('should initialize correctly', () => {
      expect(provider.type).toBe('both');
      expect(provider.isSupported.stt).toBe(true);
      expect(provider.isSupported.tts).toBe(true);
    });
    
    test('should configure recognition settings', () => {
      provider.configure({
        language: 'es-ES',
        continuous: true,
        maxAlternatives: 3
      });
      
      expect(provider.config.language).toBe('es-ES');
      expect(provider.config.continuous).toBe(true);
      expect(provider.config.maxAlternatives).toBe(3);
    });
    
    test('should provide capabilities information', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities.stt.supported).toBe(true);
      expect(capabilities.tts.supported).toBe(true);
      expect(capabilities.stt.continuous).toBe(true);
      expect(capabilities.stt.interimResults).toBe(true);
    });
  });
  
  describe('Integration Tests', () => {
    let voiceService;
    let intentParser;
    let ttsQueue;
    
    beforeEach(() => {
      voiceService = new VoiceService();
      intentParser = new IntentParser();
      intentParser.loadExerciseLibrary(mockExercises);
      ttsQueue = new TTSQueue(voiceService);
      
      // Register mock provider
      const mockProvider = {
        type: 'both',
        transcribe: jest.fn().mockResolvedValue({
          text: 'bench press 10 reps 185 pounds',
          confidence: 0.95
        }),
        speak: jest.fn().mockResolvedValue({ success: true })
      };
      
      voiceService.registerProvider('mock', mockProvider);
    });
    
    test('should handle complete voice workflow', async () => {
      // Start session
      const session = await voiceService.startSession('workout');
      expect(session.status).toBe('active');
      
      // Mock transcription
      const transcription = await voiceService.transcribe(null, { provider: 'mock' });
      expect(transcription.text).toBe('bench press 10 reps 185 pounds');
      
      // Parse intent
      const intent = intentParser.parseIntent(transcription.text);
      expect(intent.intent).toBe('log_set');
      expect(intent.parameters.exercise.name).toBe('Barbell Bench Press');
      
      // Generate confirmation
      const confirmation = ttsQueue.generateSetConfirmation(intent.parameters);
      expect(confirmation).toContain('10 reps');
      
      // End session
      const endedSession = await voiceService.endSession();
      expect(endedSession.status).toBe('completed');
    });
    
    test('should handle error conditions gracefully', async () => {
      // Test with failing provider
      const failingProvider = {
        type: 'stt',
        transcribe: jest.fn().mockRejectedValue(new Error('Recognition failed'))
      };
      
      voiceService.registerProvider('failing', failingProvider);
      
      await expect(voiceService.transcribe(null, { provider: 'failing' }))
        .rejects.toThrow('Recognition failed');
    });
    
    test('should handle low confidence transcriptions', () => {
      const lowConfidenceText = 'unclear speech';
      const intent = intentParser.parseIntent(lowConfidenceText);
      
      expect(intent.intent).toBe('unknown');
      expect(intent.confidence).toBe(0);
      expect(intent.alternatives).toBeDefined();
    });
  });
  
  describe('Performance Tests', () => {
    test('should parse intents quickly', () => {
      const intentParser = new IntentParser();
      intentParser.loadExerciseLibrary(mockExercises);
      
      const testUtterances = [
        'bench press 10 reps 185 pounds',
        'squat 225 lbs 5 reps RPE 8',
        'deadlift 8 reps 315 pounds',
        'start workout push day',
        'rest for 3 minutes',
        'change weight to 200 pounds',
        'undo last set'
      ];
      
      const startTime = performance.now();
      
      testUtterances.forEach(utterance => {
        intentParser.parseIntent(utterance);
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / testUtterances.length;
      
      // Should process each intent in less than 10ms on average
      expect(averageTime).toBeLessThan(10);
    });
    
    test('should handle large exercise libraries efficiently', () => {
      const intentParser = new IntentParser();
      
      // Create large exercise library
      const largeLibrary = [];
      for (let i = 0; i < 1000; i++) {
        largeLibrary.push({
          id: i.toString(),
          name: `Exercise ${i}`,
          category: 'strength'
        });
      }
      
      const startTime = performance.now();
      intentParser.loadExerciseLibrary(largeLibrary);
      const loadTime = performance.now() - startTime;
      
      // Should load large library in less than 100ms
      expect(loadTime).toBeLessThan(100);
      
      // Test fuzzy matching performance
      const matchStartTime = performance.now();
      intentParser.findExercise('exercise 500');
      const matchTime = performance.now() - matchStartTime;
      
      // Should find matches in less than 50ms
      expect(matchTime).toBeLessThan(50);
    });
  });
});