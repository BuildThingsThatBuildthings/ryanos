/**
 * OfflineManager - Handles offline voice event queuing and synchronization
 * Provides persistent storage and automatic sync when connection is restored
 */

class OfflineManager {
  constructor(config = {}) {
    this.config = {
      storageKey: 'voice_offline_queue',
      sessionStorageKey: 'voice_session_data',
      maxQueueSize: 1000,
      syncRetryInterval: 30000, // 30 seconds
      maxRetries: 5,
      compressionEnabled: true,
      ...config
    };
    
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.retryCount = 0;
    this.syncTimer = null;
    
    this.initializeStorage();
    this.setupEventListeners();
    
    // Auto-sync when coming online
    if (this.isOnline) {
      this.startAutoSync();
    }
  }

  /**
   * Initialize local storage structure
   */
  initializeStorage() {
    try {
      const existing = localStorage.getItem(this.config.storageKey);
      if (!existing) {
        this.saveQueue([]);
      }
      
      const sessionData = sessionStorage.getItem(this.config.sessionStorageKey);
      if (!sessionData) {
        this.saveSessionData({});
      }
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
    }
  }

  /**
   * Setup online/offline event listeners
   */
  setupEventListeners() {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  /**
   * Handle coming online
   */
  async handleOnline() {
    console.log('OfflineManager: Coming online');
    this.isOnline = true;
    this.retryCount = 0;
    
    // Start auto-sync
    this.startAutoSync();
    
    // Attempt immediate sync
    await this.syncQueue();
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    console.log('OfflineManager: Going offline');
    this.isOnline = false;
    this.stopAutoSync();
  }

  /**
   * Handle page unload - save any pending data
   */
  handleBeforeUnload() {
    // Ensure any pending session data is saved
    this.flushSessionData();
  }

  /**
   * Queue a voice event for offline storage
   */
  queueEvent(event) {
    try {
      const queue = this.loadQueue();
      
      const queueItem = {
        id: this.generateId(),
        timestamp: Date.now(),
        event: this.compressEvent(event),
        retries: 0,
        priority: event.priority || 'normal'
      };
      
      // Add to queue
      queue.push(queueItem);
      
      // Maintain queue size limit
      if (queue.length > this.config.maxQueueSize) {
        // Remove oldest low-priority items first
        const filtered = queue
          .filter(item => item.priority === 'high')
          .concat(queue.filter(item => item.priority !== 'high').slice(-this.config.maxQueueSize + queue.filter(item => item.priority === 'high').length));
        
        this.saveQueue(filtered);
      } else {
        this.saveQueue(queue);
      }
      
      console.log(`OfflineManager: Queued event ${queueItem.id} (queue size: ${queue.length})`);
      return queueItem.id;
      
    } catch (error) {
      console.error('Failed to queue offline event:', error);
      return null;
    }
  }

  /**
   * Queue a voice session for offline storage
   */
  queueSession(session) {
    try {
      const sessionData = this.loadSessionData();
      
      sessionData[session.id] = {
        ...session,
        queuedAt: Date.now(),
        synced: false
      };
      
      this.saveSessionData(sessionData);
      console.log(`OfflineManager: Queued session ${session.id}`);
      
    } catch (error) {
      console.error('Failed to queue offline session:', error);
    }
  }

  /**
   * Sync queued events and sessions with server
   */
  async syncQueue() {
    if (!this.isOnline || this.syncInProgress) {
      return { success: false, reason: 'offline_or_syncing' };
    }
    
    this.syncInProgress = true;
    
    try {
      const results = {
        events: { synced: 0, failed: 0, errors: [] },
        sessions: { synced: 0, failed: 0, errors: [] }
      };
      
      // Sync sessions first
      await this.syncSessions(results.sessions);
      
      // Then sync events
      await this.syncEvents(results.events);
      
      console.log('OfflineManager: Sync completed', results);
      
      if (results.events.failed === 0 && results.sessions.failed === 0) {
        this.retryCount = 0;
      }
      
      return { success: true, results };
      
    } catch (error) {
      console.error('OfflineManager: Sync failed', error);
      this.retryCount++;
      
      return { success: false, error: error.message, retryCount: this.retryCount };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync queued sessions
   */
  async syncSessions(results) {
    const sessionData = this.loadSessionData();
    const unsyncedSessions = Object.values(sessionData).filter(session => !session.synced);
    
    for (const session of unsyncedSessions) {
      try {
        await this.syncSingleSession(session);
        
        // Mark as synced
        sessionData[session.id].synced = true;
        results.synced++;
        
      } catch (error) {
        console.error(`Failed to sync session ${session.id}:`, error);
        results.failed++;
        results.errors.push({ sessionId: session.id, error: error.message });
      }
    }
    
    this.saveSessionData(sessionData);
  }

  /**
   * Sync queued events
   */
  async syncEvents(results) {
    const queue = this.loadQueue();
    const successfulEvents = [];
    const failedEvents = [];
    
    for (const queueItem of queue) {
      try {
        const event = this.decompressEvent(queueItem.event);
        await this.syncSingleEvent(event, queueItem);
        
        successfulEvents.push(queueItem.id);
        results.synced++;
        
      } catch (error) {
        console.error(`Failed to sync event ${queueItem.id}:`, error);
        
        queueItem.retries++;
        if (queueItem.retries >= this.config.maxRetries) {
          console.warn(`Event ${queueItem.id} exceeded max retries, removing from queue`);
          results.failed++;
          results.errors.push({ eventId: queueItem.id, error: error.message });
        } else {
          failedEvents.push(queueItem);
        }
      }
    }
    
    // Update queue with only failed events that haven't exceeded max retries
    this.saveQueue(failedEvents);
  }

  /**
   * Sync a single session with the server
   */
  async syncSingleSession(session) {
    const response = await fetch('/api/voice/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        sessionType: session.type,
        metadata: {
          ...session.metadata,
          offlineQueued: true,
          originalTimestamp: session.startTime
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update session with backend ID
    const sessionData = this.loadSessionData();
    if (sessionData[session.id]) {
      sessionData[session.id].backendId = result.session.voiceSessionId;
      this.saveSessionData(sessionData);
    }
    
    return result;
  }

  /**
   * Sync a single event with the server
   */
  async syncSingleEvent(event, queueItem) {
    // Find the session for this event
    const sessionData = this.loadSessionData();
    const session = sessionData[event.sessionId];
    
    if (!session || !session.backendId) {
      throw new Error(`Session ${event.sessionId} not found or not synced`);
    }
    
    const response = await fetch('/api/voice/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        sessionId: session.backendId,
        intent: event.intent || event.type,
        payload: {
          ...event.payload,
          offlineQueued: true,
          originalTimestamp: event.timestamp
        },
        transcript: event.transcript,
        confidenceScore: event.confidence,
        timestamp: new Date(event.timestamp).toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Compress event data to save storage space
   */
  compressEvent(event) {
    if (!this.config.compressionEnabled) {
      return event;
    }
    
    // Simple compression: remove redundant data and compress strings
    const compressed = {
      ...event,
      transcript: this.compressString(event.transcript),
      // Remove large or redundant fields
      alternatives: undefined,
      rawMatch: undefined
    };
    
    return compressed;
  }

  /**
   * Decompress event data
   */
  decompressEvent(compressedEvent) {
    if (!this.config.compressionEnabled) {
      return compressedEvent;
    }
    
    return {
      ...compressedEvent,
      transcript: this.decompressString(compressedEvent.transcript)
    };
  }

  /**
   * Simple string compression using LZ-like algorithm
   */
  compressString(str) {
    if (!str || str.length < 50) return str;
    
    // Simple run-length encoding for repeated patterns
    return str.replace(/(.)\1{2,}/g, (match, char) => {
      return `${char}*${match.length}`;
    });
  }

  /**
   * Decompress string
   */
  decompressString(str) {
    if (!str || !str.includes('*')) return str;
    
    return str.replace(/(.)\*(\d+)/g, (match, char, count) => {
      return char.repeat(parseInt(count));
    });
  }

  /**
   * Load queue from local storage
   */
  loadQueue() {
    try {
      const data = localStorage.getItem(this.config.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      return [];
    }
  }

  /**
   * Save queue to local storage
   */
  saveQueue(queue) {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Load session data from session storage
   */
  loadSessionData() {
    try {
      const data = sessionStorage.getItem(this.config.sessionStorageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to load session data:', error);
      return {};
    }
  }

  /**
   * Save session data to session storage
   */
  saveSessionData(sessionData) {
    try {
      sessionStorage.setItem(this.config.sessionStorageKey, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  }

  /**
   * Flush any pending session data to persistent storage
   */
  flushSessionData() {
    try {
      const sessionData = this.loadSessionData();
      const persistentData = this.loadPersistentSessionData();
      
      // Merge session data into persistent storage
      Object.assign(persistentData, sessionData);
      
      localStorage.setItem('voice_persistent_sessions', JSON.stringify(persistentData));
    } catch (error) {
      console.error('Failed to flush session data:', error);
    }
  }

  /**
   * Load persistent session data
   */
  loadPersistentSessionData() {
    try {
      const data = localStorage.getItem('voice_persistent_sessions');
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to load persistent session data:', error);
      return {};
    }
  }

  /**
   * Start automatic sync attempts
   */
  startAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        const queue = this.loadQueue();
        const sessionData = this.loadSessionData();
        const unsyncedSessions = Object.values(sessionData).filter(s => !s.synced);
        
        if (queue.length > 0 || unsyncedSessions.length > 0) {
          console.log(`OfflineManager: Auto-sync triggered (${queue.length} events, ${unsyncedSessions.length} sessions)`);
          this.syncQueue();
        }
      }
    }, this.config.syncRetryInterval);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Get current offline status
   */
  getStatus() {
    const queue = this.loadQueue();
    const sessionData = this.loadSessionData();
    const unsyncedSessions = Object.values(sessionData).filter(s => !s.synced);
    
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      queuedEvents: queue.length,
      unsyncedSessions: unsyncedSessions.length,
      retryCount: this.retryCount,
      storageUsed: this.calculateStorageUsage()
    };
  }

  /**
   * Calculate storage usage
   */
  calculateStorageUsage() {
    try {
      const queueData = localStorage.getItem(this.config.storageKey);
      const sessionData = sessionStorage.getItem(this.config.sessionStorageKey);
      
      return {
        localStorage: queueData ? queueData.length : 0,
        sessionStorage: sessionData ? sessionData.length : 0,
        total: (queueData ? queueData.length : 0) + (sessionData ? sessionData.length : 0)
      };
    } catch (error) {
      return { localStorage: 0, sessionStorage: 0, total: 0 };
    }
  }

  /**
   * Clear all offline data
   */
  clearOfflineData() {
    try {
      localStorage.removeItem(this.config.storageKey);
      localStorage.removeItem('voice_persistent_sessions');
      sessionStorage.removeItem(this.config.sessionStorageKey);
      
      console.log('OfflineManager: All offline data cleared');
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }

  /**
   * Get authentication token
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.stopAutoSync();
    this.flushSessionData();
    
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
}

export default OfflineManager;