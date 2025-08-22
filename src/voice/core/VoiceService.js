/**
 * VoiceService - Core voice processing service with provider abstraction
 * Coordinates STT/TTS providers and manages voice sessions
 */

class VoiceService {
  constructor(config = {}) {
    this.config = {
      defaultSTTProvider: 'webSpeech',
      defaultTTSProvider: 'webSpeech',
      fallbackSTTProvider: 'whisper',
      confidenceThreshold: 0.7,
      maxRetries: 3,
      sessionTimeout: 300000, // 5 minutes
      ...config
    };
    
    this.providers = new Map();
    this.currentSession = null;
    this.eventQueue = [];
    this.isOnline = navigator.onLine;
    this.sessionStore = new Map();
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnlineStatus(true));
    window.addEventListener('offline', () => this.handleOnlineStatus(false));
  }

  /**
   * Register a voice provider (STT or TTS)
   */
  registerProvider(name, provider) {
    if (!provider.type || !['stt', 'tts', 'both'].includes(provider.type)) {
      throw new Error('Provider must specify type: stt, tts, or both');
    }
    
    this.providers.set(name, provider);
    console.log(`Voice provider registered: ${name} (${provider.type})`);
  }

  /**
   * Get available providers by type
   */
  getProviders(type = null) {
    if (!type) return Array.from(this.providers.keys());
    
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => 
        provider.type === type || provider.type === 'both'
      )
      .map(([name]) => name);
  }

  /**
   * Start a new voice session
   */
  async startSession(sessionType = 'workout', metadata = {}) {
    if (this.currentSession) {
      await this.endSession();
    }

    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      type: sessionType,
      startTime: Date.now(),
      metadata,
      events: [],
      status: 'active'
    };

    this.currentSession = session;
    this.sessionStore.set(sessionId, session);

    // If online, sync with backend
    if (this.isOnline) {
      try {
        await this.syncSessionWithBackend(session);
      } catch (error) {
        console.warn('Failed to sync session with backend:', error);
      }
    }

    this.dispatchEvent('sessionStarted', { session });
    return session;
  }

  /**
   * End current voice session
   */
  async endSession() {
    if (!this.currentSession) return null;

    const session = this.currentSession;
    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.status = 'completed';

    // If online, sync final session state
    if (this.isOnline) {
      try {
        await this.syncSessionWithBackend(session);
      } catch (error) {
        console.warn('Failed to sync session end with backend:', error);
      }
    }

    this.dispatchEvent('sessionEnded', { session });
    this.currentSession = null;
    return session;
  }

  /**
   * Transcribe audio using configured STT provider
   */
  async transcribe(audioData, options = {}) {
    const providerName = options.provider || this.config.defaultSTTProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider || !['stt', 'both'].includes(provider.type)) {
      throw new Error(`STT provider not found: ${providerName}`);
    }

    try {
      const result = await provider.transcribe(audioData, options);
      
      // Add to current session if active
      if (this.currentSession && result.confidence >= this.config.confidenceThreshold) {
        await this.addEventToSession({
          type: 'transcription',
          transcript: result.text,
          confidence: result.confidence,
          provider: providerName,
          timestamp: Date.now()
        });
      }
      
      return result;
    } catch (error) {
      console.error(`Transcription failed with ${providerName}:`, error);
      
      // Try fallback provider if available
      const fallbackProvider = this.config.fallbackSTTProvider;
      if (fallbackProvider && fallbackProvider !== providerName) {
        console.log(`Trying fallback STT provider: ${fallbackProvider}`);
        return this.transcribe(audioData, { ...options, provider: fallbackProvider });
      }
      
      throw error;
    }
  }

  /**
   * Synthesize speech using configured TTS provider
   */
  async speak(text, options = {}) {
    const providerName = options.provider || this.config.defaultTTSProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider || !['tts', 'both'].includes(provider.type)) {
      throw new Error(`TTS provider not found: ${providerName}`);
    }

    try {
      const result = await provider.speak(text, options);
      
      // Add to current session if active
      if (this.currentSession) {
        await this.addEventToSession({
          type: 'tts',
          text,
          provider: providerName,
          timestamp: Date.now()
        });
      }
      
      return result;
    } catch (error) {
      console.error(`TTS failed with ${providerName}:`, error);
      throw error;
    }
  }

  /**
   * Add event to current session
   */
  async addEventToSession(event) {
    if (!this.currentSession) {
      console.warn('No active session to add event to');
      return;
    }

    event.id = this.generateEventId();
    this.currentSession.events.push(event);

    // If offline, queue for later sync
    if (!this.isOnline) {
      this.eventQueue.push({
        sessionId: this.currentSession.id,
        event
      });
    } else {
      try {
        await this.syncEventWithBackend(this.currentSession.id, event);
      } catch (error) {
        console.warn('Failed to sync event with backend:', error);
        this.eventQueue.push({
          sessionId: this.currentSession.id,
          event
        });
      }
    }

    this.dispatchEvent('eventAdded', { sessionId: this.currentSession.id, event });
  }

  /**
   * Handle online/offline status changes
   */
  async handleOnlineStatus(isOnline) {
    this.isOnline = isOnline;
    
    if (isOnline && this.eventQueue.length > 0) {
      console.log(`Coming online, syncing ${this.eventQueue.length} queued events`);
      await this.syncQueuedEvents();
    }
    
    this.dispatchEvent('onlineStatusChanged', { isOnline });
  }

  /**
   * Sync queued events when coming back online
   */
  async syncQueuedEvents() {
    const queue = [...this.eventQueue];
    this.eventQueue = [];

    for (const { sessionId, event } of queue) {
      try {
        await this.syncEventWithBackend(sessionId, event);
      } catch (error) {
        console.error('Failed to sync queued event:', error);
        this.eventQueue.push({ sessionId, event }); // Re-queue failed events
      }
    }
  }

  /**
   * Sync session with backend API
   */
  async syncSessionWithBackend(session) {
    const response = await fetch('/api/voice/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        sessionType: session.type,
        metadata: session.metadata
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to sync session: ${response.statusText}`);
    }

    const result = await response.json();
    session.backendId = result.session.voiceSessionId;
    return result;
  }

  /**
   * Sync event with backend API
   */
  async syncEventWithBackend(sessionId, event) {
    const session = this.sessionStore.get(sessionId);
    if (!session || !session.backendId) {
      throw new Error('Session not found or not synced with backend');
    }

    const response = await fetch('/api/voice/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        sessionId: session.backendId,
        intent: event.type,
        payload: {
          text: event.text || event.transcript,
          confidence: event.confidence,
          provider: event.provider
        },
        transcript: event.transcript,
        confidenceScore: event.confidence,
        timestamp: new Date(event.timestamp).toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to sync event: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get authentication token (placeholder - implement based on your auth system)
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Dispatch custom events
   */
  dispatchEvent(type, detail) {
    const event = new CustomEvent(`voice:${type}`, { detail });
    window.dispatchEvent(event);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    return this.sessionStore.get(sessionId);
  }

  /**
   * Get current active session
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    return Array.from(this.sessionStore.values());
  }

  /**
   * Clear expired sessions
   */
  clearExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];
    
    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (session.status === 'completed' && 
          (now - session.endTime) > this.config.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }
    
    expiredSessions.forEach(sessionId => {
      this.sessionStore.delete(sessionId);
    });
    
    return expiredSessions.length;
  }
}

export default VoiceService;