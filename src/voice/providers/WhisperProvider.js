/**
 * WhisperProvider - OpenAI Whisper API integration for high-accuracy transcription
 * Provides Speech-to-Text using OpenAI's Whisper model
 */

class WhisperProvider {
  constructor(config = {}) {
    this.type = 'stt';
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      model: 'whisper-1',
      language: 'en',
      temperature: 0,
      response_format: 'verbose_json',
      endpoint: 'https://api.openai.com/v1/audio/transcriptions',
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
      supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
      ...config
    };
    
    this.isConfigured = !!this.config.apiKey;
    
    if (!this.isConfigured) {
      console.warn('WhisperProvider: API key not provided. Set OPENAI_API_KEY environment variable or pass apiKey in config.');
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribe(audioData, options = {}) {
    if (!this.isConfigured) {
      throw new Error('WhisperProvider not configured: API key required');
    }

    const config = { ...this.config, ...options };
    
    // Convert audio data to proper format if needed
    const audioFile = await this.prepareAudioFile(audioData, config);
    
    if (audioFile.size > this.config.maxFileSize) {
      throw new Error(`Audio file too large: ${audioFile.size} bytes. Maximum: ${this.config.maxFileSize} bytes`);
    }

    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', config.model);
    formData.append('response_format', config.response_format);
    
    if (config.language && config.language !== 'auto') {
      formData.append('language', config.language);
    }
    
    if (config.prompt) {
      formData.append('prompt', config.prompt);
    }
    
    if (config.temperature !== undefined) {
      formData.append('temperature', config.temperature.toString());
    }

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Whisper API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();
      
      return this.formatResponse(result, config);
    } catch (error) {
      console.error('Whisper transcription failed:', error);
      throw error;
    }
  }

  /**
   * Prepare audio file for upload
   */
  async prepareAudioFile(audioData, config) {
    // If audioData is already a File or Blob, use it directly
    if (audioData instanceof File || audioData instanceof Blob) {
      return audioData;
    }
    
    // If it's a data URL, convert to blob
    if (typeof audioData === 'string' && audioData.startsWith('data:')) {
      return this.dataURLToBlob(audioData);
    }
    
    // If it's an ArrayBuffer or Uint8Array, create blob
    if (audioData instanceof ArrayBuffer || audioData instanceof Uint8Array) {
      return new Blob([audioData], { type: 'audio/wav' });
    }
    
    // If it's a MediaRecorder result, handle it
    if (audioData.data) {
      return audioData.data;
    }
    
    throw new Error('Unsupported audio data format');
  }

  /**
   * Convert data URL to Blob
   */
  dataURLToBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Format Whisper API response
   */
  formatResponse(result, config) {
    const response = {
      text: result.text || '',
      confidence: 0.95, // Whisper doesn't provide confidence, use high default
      language: result.language || config.language,
      duration: result.duration || 0
    };

    // Add segments if available (verbose_json format)
    if (result.segments) {
      response.segments = result.segments.map(segment => ({
        text: segment.text,
        start: segment.start,
        end: segment.end,
        confidence: segment.avg_logprob ? Math.exp(segment.avg_logprob) : 0.95
      }));
      
      // Calculate overall confidence from segments
      if (response.segments.length > 0) {
        response.confidence = response.segments.reduce((sum, seg) => sum + seg.confidence, 0) / response.segments.length;
      }
    }

    // Add word-level timestamps if available
    if (result.words) {
      response.words = result.words.map(word => ({
        text: word.word,
        start: word.start,
        end: word.end,
        confidence: word.probability || 0.95
      }));
    }

    return response;
  }

  /**
   * Transcribe from URL
   */
  async transcribeFromURL(audioURL, options = {}) {
    try {
      const response = await fetch(audioURL);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio from URL: ${response.statusText}`);
      }
      
      const audioBlob = await response.blob();
      return this.transcribe(audioBlob, options);
    } catch (error) {
      console.error('Failed to transcribe from URL:', error);
      throw error;
    }
  }

  /**
   * Transcribe with custom prompt for context
   */
  async transcribeWithContext(audioData, context, options = {}) {
    return this.transcribe(audioData, {
      ...options,
      prompt: context
    });
  }

  /**
   * Batch transcription for multiple audio files
   */
  async transcribeBatch(audioFiles, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 5;
    
    for (let i = 0; i < audioFiles.length; i += batchSize) {
      const batch = audioFiles.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (audioData, index) => {
        try {
          const result = await this.transcribe(audioData, options);
          return { index: i + index, result, error: null };
        } catch (error) {
          return { index: i + index, result: null, error };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < audioFiles.length && options.delayBetweenBatches) {
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenBatches));
      }
    }
    
    return results;
  }

  /**
   * Get supported audio formats
   */
  getSupportedFormats() {
    return [...this.config.supportedFormats];
  }

  /**
   * Validate audio format
   */
  isFormatSupported(filename) {
    if (!filename) return false;
    
    const extension = filename.split('.').pop()?.toLowerCase();
    return this.config.supportedFormats.includes(extension);
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      stt: {
        supported: this.isConfigured,
        highAccuracy: true,
        languages: [
          'af', 'ar', 'hy', 'az', 'be', 'bs', 'bg', 'ca', 'zh', 'hr', 'cs', 'da', 'nl',
          'en', 'et', 'fi', 'fr', 'gl', 'de', 'el', 'he', 'hi', 'hu', 'is', 'id', 'it',
          'ja', 'kn', 'kk', 'ko', 'lv', 'lt', 'mk', 'ms', 'mr', 'mi', 'ne', 'no', 'fa',
          'pl', 'pt', 'ro', 'ru', 'sr', 'sk', 'sl', 'es', 'sw', 'sv', 'tl', 'ta', 'th',
          'tr', 'uk', 'ur', 'vi', 'cy'
        ],
        formats: this.config.supportedFormats,
        maxFileSize: this.config.maxFileSize,
        features: {
          segments: true,
          wordTimestamps: true,
          languageDetection: true,
          contextualPrompts: true
        }
      }
    };
  }

  /**
   * Configure provider settings
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.isConfigured = !!this.config.apiKey;
  }

  /**
   * Test connection to Whisper API
   */
  async testConnection() {
    if (!this.isConfigured) {
      throw new Error('API key not configured');
    }

    try {
      // Create a minimal audio file for testing
      const testAudio = this.createTestAudio();
      await this.transcribe(testAudio, { temperature: 0 });
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Create minimal test audio file
   */
  createTestAudio() {
    // Create a minimal WAV file with silence
    const sampleRate = 16000;
    const duration = 0.1; // 100ms
    const samples = Math.floor(sampleRate * duration);
    
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples * 2, true);
    
    // Silent audio data
    for (let i = 0; i < samples; i++) {
      view.setInt16(44 + i * 2, 0, true);
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }
}

export default WhisperProvider;