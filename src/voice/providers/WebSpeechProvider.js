/**
 * WebSpeechProvider - Browser Web Speech API integration
 * Provides both Speech-to-Text and Text-to-Speech capabilities
 */

class WebSpeechProvider {
  constructor(config = {}) {
    this.type = 'both';
    this.config = {
      language: 'en-US',
      continuous: false,
      interimResults: true,
      maxAlternatives: 1,
      voice: null, // Will use default voice
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      ...config
    };
    
    this.isSupported = this.checkSupport();
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.voices = [];
    
    if (this.isSupported) {
      this.initializeRecognition();
      this.loadVoices();
    }
  }

  /**
   * Check if Web Speech API is supported
   */
  checkSupport() {
    const hasSTT = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const hasTTS = 'speechSynthesis' in window;
    
    if (!hasSTT) {
      console.warn('Speech Recognition not supported in this browser');
    }
    if (!hasTTS) {
      console.warn('Speech Synthesis not supported in this browser');
    }
    
    return { stt: hasSTT, tts: hasTTS };
  }

  /**
   * Initialize Speech Recognition
   */
  initializeRecognition() {
    if (!this.isSupported.stt) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;
    this.recognition.lang = this.config.language;
  }

  /**
   * Load available voices for TTS
   */
  loadVoices() {
    if (!this.isSupported.tts) return;
    
    const updateVoices = () => {
      this.voices = this.synthesis.getVoices();
      
      // Set default voice if not specified
      if (!this.config.voice && this.voices.length > 0) {
        this.config.voice = this.voices.find(voice => 
          voice.lang.startsWith(this.config.language.split('-')[0])
        ) || this.voices[0];
      }
    };
    
    updateVoices();
    
    // Voices may load asynchronously
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = updateVoices;
    }
  }

  /**
   * Transcribe audio (Speech-to-Text)
   */
  async transcribe(audioData, options = {}) {
    if (!this.isSupported.stt) {
      throw new Error('Speech Recognition not supported');
    }

    return new Promise((resolve, reject) => {
      const recognition = this.recognition;
      let finalTranscript = '';
      let interimTranscript = '';
      let confidence = 0;
      
      const config = { ...this.config, ...options };
      recognition.lang = config.language;
      recognition.continuous = config.continuous;
      recognition.interimResults = config.interimResults;
      
      recognition.onresult = (event) => {
        finalTranscript = '';
        interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          
          if (result.isFinal) {
            finalTranscript += transcript;
            confidence = result[0].confidence || 0.9; // Fallback confidence
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Return interim results if enabled
        if (config.interimResults && options.onInterim) {
          options.onInterim({
            text: interimTranscript,
            isFinal: false,
            confidence: 0.5
          });
        }
        
        // Return final result
        if (finalTranscript) {
          resolve({
            text: finalTranscript.trim(),
            confidence: confidence,
            alternatives: this.extractAlternatives(event.results),
            language: config.language
          });
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        reject(new Error(`Speech recognition failed: ${event.error}`));
      };
      
      recognition.onend = () => {
        if (!finalTranscript && !options.continuous) {
          reject(new Error('No speech detected'));
        }
      };
      
      recognition.start();
      
      // Auto-stop after timeout if not continuous
      if (!config.continuous && config.timeout) {
        setTimeout(() => {
          if (recognition) {
            recognition.stop();
          }
        }, config.timeout);
      }
    });
  }

  /**
   * Start continuous listening
   */
  startListening(options = {}) {
    if (!this.isSupported.stt) {
      throw new Error('Speech Recognition not supported');
    }

    return this.transcribe(null, {
      ...options,
      continuous: true,
      interimResults: true
    });
  }

  /**
   * Stop listening
   */
  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  /**
   * Synthesize speech (Text-to-Speech)
   */
  async speak(text, options = {}) {
    if (!this.isSupported.tts) {
      throw new Error('Speech Synthesis not supported');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const config = { ...this.config, ...options };
      
      // Set voice
      if (config.voice) {
        utterance.voice = typeof config.voice === 'string' 
          ? this.voices.find(v => v.name === config.voice) || this.voices[0]
          : config.voice;
      }
      
      utterance.rate = config.rate;
      utterance.pitch = config.pitch;
      utterance.volume = config.volume;
      utterance.lang = config.language;
      
      utterance.onend = () => {
        resolve({ success: true, text, duration: 0 }); // Duration not available in Web Speech
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        reject(new Error(`Speech synthesis failed: ${event.error}`));
      };
      
      // Cancel any ongoing speech
      this.synthesis.cancel();
      this.synthesis.speak(utterance);
    });
  }

  /**
   * Stop current speech synthesis
   */
  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking() {
    return this.synthesis && this.synthesis.speaking;
  }

  /**
   * Get available voices
   */
  getVoices() {
    return this.voices.map(voice => ({
      name: voice.name,
      lang: voice.lang,
      gender: voice.name.toLowerCase().includes('female') ? 'female' : 'male',
      isDefault: voice.default
    }));
  }

  /**
   * Set voice by name or language
   */
  setVoice(voiceNameOrLang) {
    const voice = this.voices.find(v => 
      v.name === voiceNameOrLang || v.lang === voiceNameOrLang
    );
    
    if (voice) {
      this.config.voice = voice;
      return true;
    }
    
    return false;
  }

  /**
   * Extract alternatives from recognition results
   */
  extractAlternatives(results) {
    const alternatives = [];
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      for (let j = 0; j < result.length; j++) {
        alternatives.push({
          text: result[j].transcript,
          confidence: result[j].confidence || 0.9
        });
      }
    }
    
    return alternatives.slice(0, this.config.maxAlternatives);
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      stt: {
        supported: this.isSupported.stt,
        continuous: true,
        interimResults: true,
        languages: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'zh-CN', 'ja-JP']
      },
      tts: {
        supported: this.isSupported.tts,
        voices: this.getVoices(),
        languages: [...new Set(this.voices.map(v => v.lang))]
      }
    };
  }

  /**
   * Configure provider settings
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.recognition) {
      this.recognition.lang = this.config.language;
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.maxAlternatives = this.config.maxAlternatives;
    }
  }
}

export default WebSpeechProvider;