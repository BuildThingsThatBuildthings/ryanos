/**
 * TTSQueue - Text-to-Speech queue management with confirmation system
 * Handles queuing, prioritization, and voice persona settings
 */

class TTSQueue {
  constructor(voiceService, config = {}) {
    this.voiceService = voiceService;
    this.config = {
      maxQueueSize: 50,
      defaultPriority: 'normal',
      interruptOnHigh: true,
      debounceTime: 300, // ms to debounce rapid requests
      ...config
    };
    
    this.queue = [];
    this.isProcessing = false;
    this.currentUtterance = null;
    this.debounceTimer = null;
    this.voicePersona = this.initializeDefaultPersona();
  }

  /**
   * Initialize default voice persona settings
   */
  initializeDefaultPersona() {
    return {
      rate: 1.0,
      pitch: 1.0,
      volume: 0.8,
      voice: null, // Will use system default
      confirmationStyle: 'concise', // 'concise', 'detailed', 'minimal'
      useNaturalPauses: true,
      confirmationSounds: true
    };
  }

  /**
   * Add message to TTS queue
   */
  enqueue(message, options = {}) {
    const queueItem = {
      id: this.generateId(),
      message: this.processMessage(message, options),
      priority: options.priority || this.config.defaultPriority,
      timestamp: Date.now(),
      options: {
        ...this.voicePersona,
        ...options
      },
      retries: 0,
      maxRetries: options.maxRetries || 3
    };

    // Handle queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      // Remove oldest low-priority items
      this.queue = this.queue.filter(item => item.priority !== 'low').slice(-this.config.maxQueueSize + 1);
    }

    // Insert based on priority
    this.insertByPriority(queueItem);

    // Handle high priority interruption
    if (options.priority === 'high' && this.config.interruptOnHigh && this.isProcessing) {
      this.interrupt();
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return queueItem.id;
  }

  /**
   * Insert item into queue based on priority
   */
  insertByPriority(item) {
    const priorities = { 'high': 0, 'normal': 1, 'low': 2 };
    const itemPriority = priorities[item.priority] || 1;
    
    let insertIndex = this.queue.length;
    
    for (let i = 0; i < this.queue.length; i++) {
      const queuePriority = priorities[this.queue[i].priority] || 1;
      if (itemPriority < queuePriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, item);
  }

  /**
   * Process message text for better TTS output
   */
  processMessage(message, options) {
    let processed = message;

    // Add natural pauses for better flow
    if (this.voicePersona.useNaturalPauses) {
      processed = this.addNaturalPauses(processed);
    }

    // Handle numbers and units for better pronunciation
    processed = this.improveNumberPronunciation(processed);

    // Handle abbreviations
    processed = this.expandAbbreviations(processed);

    return processed;
  }

  /**
   * Add natural pauses to text
   */
  addNaturalPauses(text) {
    return text
      .replace(/([.!?])\s+/g, '$1 ') // Ensure pauses after sentences
      .replace(/,\s*/g, ', ') // Ensure pauses after commas
      .replace(/(\d+)\s+(reps?|pounds?|lbs|kilos?|kgs)/gi, '$1 $2') // Pause between numbers and units
      .replace(/RPE\s*(\d+)/gi, 'R P E $1'); // Spell out RPE
  }

  /**
   * Improve pronunciation of numbers and units
   */
  improveNumberPronunciation(text) {
    return text
      .replace(/\b(\d+)\s*lbs?\b/gi, '$1 pounds')
      .replace(/\b(\d+)\s*kgs?\b/gi, '$1 kilograms')
      .replace(/\b(\d+)\s*reps?\b/gi, '$1 repetitions')
      .replace(/\bRPE\s*(\d+)/gi, 'rate of perceived exertion $1')
      .replace(/\b(\d{3,})\b/g, (match) => {
        // Add pauses in large numbers: 1234 -> 12 34
        return match.replace(/(\d{2})(\d{2})$/, '$1 $2');
      });
  }

  /**
   * Expand common abbreviations for better pronunciation
   */
  expandAbbreviations(text) {
    const abbreviations = {
      'DB': 'dumbbell',
      'BB': 'barbell',
      'OHP': 'overhead press',
      'BP': 'bench press',
      'DL': 'deadlift',
      'BS': 'back squat',
      'FS': 'front squat'
    };

    for (const [abbr, expansion] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      text = text.replace(regex, expansion);
    }

    return text;
  }

  /**
   * Generate confirmation message for logged sets
   */
  generateSetConfirmation(setData) {
    const { exercise, reps, weight, unit, rpe } = setData;
    const style = this.voicePersona.confirmationStyle;

    switch (style) {
      case 'minimal':
        return `Logged.`;
      
      case 'detailed':
        let message = `Successfully logged ${reps} repetitions of ${exercise.name} at ${weight} ${unit}`;
        if (rpe) message += ` with RPE ${rpe}`;
        return message + '.';
      
      case 'concise':
      default:
        let concise = `Logged ${reps} reps, ${weight} ${unit}`;
        if (rpe) concise += `, RPE ${rpe}`;
        return concise + '.';
    }
  }

  /**
   * Generate confirmation message for workout start
   */
  generateWorkoutStartConfirmation(workoutData) {
    const { title } = workoutData;
    const style = this.voicePersona.confirmationStyle;

    switch (style) {
      case 'minimal':
        return 'Started.';
      
      case 'detailed':
        return title 
          ? `Successfully started your ${title} workout. Ready to log your first set.`
          : 'Successfully started your workout session. Ready to log your first set.';
      
      case 'concise':
      default:
        return title ? `Started ${title} workout.` : 'Workout started.';
    }
  }

  /**
   * Generate confirmation message for edits
   */
  generateEditConfirmation(editData) {
    const { field, value } = editData;
    const style = this.voicePersona.confirmationStyle;

    switch (style) {
      case 'minimal':
        return 'Updated.';
      
      case 'detailed':
        return `Successfully updated ${field} to ${value}.`;
      
      case 'concise':
      default:
        return `${field} changed to ${value}.`;
    }
  }

  /**
   * Generate confirmation message for undo
   */
  generateUndoConfirmation() {
    const style = this.voicePersona.confirmationStyle;

    switch (style) {
      case 'minimal':
        return 'Undone.';
      
      case 'detailed':
        return 'Last entry has been removed successfully.';
      
      case 'concise':
      default:
        return 'Last set removed.';
    }
  }

  /**
   * Generate rest timer announcement
   */
  generateRestTimerStart(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    let timeString;
    if (minutes > 0 && remainingSeconds > 0) {
      timeString = `${minutes} minute${minutes > 1 ? 's' : ''} and ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      timeString = `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      timeString = `${seconds} second${seconds > 1 ? 's' : ''}`;
    }
    
    return `Rest timer started for ${timeString}.`;
  }

  /**
   * Process the TTS queue
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      
      try {
        await this.speakItem(item);
      } catch (error) {
        console.error('TTS failed for item:', item.id, error);
        
        // Retry logic
        item.retries++;
        if (item.retries < item.maxRetries) {
          console.log(`Retrying TTS for item ${item.id} (${item.retries}/${item.maxRetries})`);
          this.queue.unshift(item); // Put back at front
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Speak a single queue item
   */
  async speakItem(item) {
    // Add confirmation sound if enabled
    if (this.voicePersona.confirmationSounds && item.options.priority !== 'low') {
      await this.playConfirmationSound();
    }

    // Speak the message
    this.currentUtterance = item;
    await this.voiceService.speak(item.message, item.options);
    this.currentUtterance = null;
  }

  /**
   * Play confirmation sound (subtle beep)
   */
  async playConfirmationSound() {
    try {
      // Create a short, subtle beep
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
      
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error) {
      console.warn('Could not play confirmation sound:', error);
    }
  }

  /**
   * Interrupt current speech and clear queue
   */
  interrupt() {
    // Stop current speech
    if (this.voiceService && typeof this.voiceService.stopSpeaking === 'function') {
      this.voiceService.stopSpeaking();
    }
    
    this.currentUtterance = null;
  }

  /**
   * Clear all queued items
   */
  clear() {
    this.queue = [];
    this.interrupt();
  }

  /**
   * Remove specific item from queue
   */
  remove(id) {
    this.queue = this.queue.filter(item => item.id !== id);
  }

  /**
   * Update voice persona settings
   */
  updatePersona(settings) {
    this.voicePersona = { ...this.voicePersona, ...settings };
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      currentUtterance: this.currentUtterance ? {
        id: this.currentUtterance.id,
        message: this.currentUtterance.message,
        priority: this.currentUtterance.priority
      } : null,
      persona: this.voicePersona
    };
  }

  /**
   * Debounced enqueue for rapid requests
   */
  debouncedEnqueue(message, options = {}) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.enqueue(message, options);
    }, this.config.debounceTime);
  }

  /**
   * Generate unique ID for queue items
   */
  generateId() {
    return `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set voice by name or characteristics
   */
  setVoice(voiceNameOrConfig) {
    if (typeof voiceNameOrConfig === 'string') {
      this.voicePersona.voice = voiceNameOrConfig;
    } else {
      this.voicePersona = { ...this.voicePersona, ...voiceNameOrConfig };
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const priorityCounts = this.queue.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    }, {});

    return {
      totalItems: this.queue.length,
      priorityCounts,
      isProcessing: this.isProcessing,
      averageWaitTime: this.calculateAverageWaitTime(),
      persona: this.voicePersona
    };
  }

  /**
   * Calculate average wait time for items in queue
   */
  calculateAverageWaitTime() {
    if (this.queue.length === 0) return 0;
    
    const now = Date.now();
    const totalWaitTime = this.queue.reduce((sum, item) => sum + (now - item.timestamp), 0);
    return Math.round(totalWaitTime / this.queue.length);
  }
}

export default TTSQueue;