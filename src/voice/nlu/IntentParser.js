/**
 * IntentParser - Natural Language Understanding for fitness voice commands
 * Maps user utterances to structured intents and extracts parameters
 */

import { calculateLevenshteinDistance } from '../utils/StringUtils.js';
import { parseNumber } from '../utils/NumberParser.js';

class IntentParser {
  constructor(config = {}) {
    this.config = {
      confidenceThreshold: 0.7,
      fuzzyMatchThreshold: 0.8,
      maxEditDistance: 2,
      ...config
    };
    
    this.exerciseLibrary = new Map();
    this.synonyms = new Map();
    this.intentPatterns = this.initializeIntentPatterns();
    this.numberParser = new NumberParser();
    
    this.loadDefaultSynonyms();
  }

  /**
   * Load exercise library for fuzzy matching
   */
  loadExerciseLibrary(exercises) {
    this.exerciseLibrary.clear();
    
    exercises.forEach(exercise => {
      const name = exercise.name.toLowerCase();
      this.exerciseLibrary.set(name, exercise);
      
      // Add common variations
      if (name.includes('barbell')) {
        const variation = name.replace('barbell', 'bb');
        this.exerciseLibrary.set(variation, exercise);
      }
      
      if (name.includes('dumbbell')) {
        const variation = name.replace('dumbbell', 'db');
        this.exerciseLibrary.set(variation, exercise);
      }
      
      // Add abbreviations
      const words = name.split(' ');
      if (words.length > 1) {
        const abbreviation = words.map(w => w.charAt(0)).join('');
        this.exerciseLibrary.set(abbreviation, exercise);
      }
    });
  }

  /**
   * Parse user utterance into structured intent
   */
  parseIntent(utterance, context = {}) {
    const cleanText = this.preprocessText(utterance);
    const tokens = this.tokenize(cleanText);
    
    console.log('Parsing intent:', { utterance, cleanText, tokens });
    
    // Try to match intent patterns
    for (const pattern of this.intentPatterns) {
      const match = this.matchPattern(pattern, tokens, cleanText);
      if (match && match.confidence >= this.config.confidenceThreshold) {
        const enrichedMatch = this.enrichIntent(match, context);
        console.log('Intent matched:', enrichedMatch);
        return enrichedMatch;
      }
    }
    
    // Fallback to unknown intent
    return {
      intent: 'unknown',
      confidence: 0,
      parameters: {},
      utterance: cleanText,
      tokens,
      alternatives: this.suggestAlternatives(tokens)
    };
  }

  /**
   * Initialize intent patterns with regex and extraction logic
   */
  initializeIntentPatterns() {
    return [
      // Log set: "bench press 10 reps at 185 pounds RPE 8"
      {
        intent: 'log_set',
        patterns: [
          /^(.+?)\s+(\d+)\s+(reps?|repetitions?)\s+(?:at|@|with)?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kgs?|kilos?|kilograms?)(?:\s+rpe\s+(\d+(?:\.\d+)?))?(?:\s+set\s+(\d+))?/i,
          /^(\d+)\s+(reps?|repetitions?)\s+(.+?)\s+(?:at|@|with)?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kgs?|kilos?|kilograms?)(?:\s+rpe\s+(\d+(?:\.\d+)?))?/i,
          /^(.+?)\s+(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kgs?|kilos?|kilograms?)\s+(\d+)\s+(reps?|repetitions?)(?:\s+rpe\s+(\d+(?:\.\d+)?))?/i
        ],
        extractor: this.extractLogSetParams.bind(this),
        confidence: 0.9
      },
      
      // Start workout: "start workout" or "begin push day"
      {
        intent: 'start_workout',
        patterns: [
          /^(?:start|begin|commence)\s+(?:workout|training|session)(?:\s+(.+))?/i,
          /^(?:let's|lets)\s+(?:start|begin)\s+(?:workout|training)(?:\s+(.+))?/i,
          /^(?:workout|training)\s+(?:start|begin|time)/i
        ],
        extractor: this.extractStartWorkoutParams.bind(this),
        confidence: 0.95
      },
      
      // Edit last: "change weight to 200" or "edit last set reps to 12"
      {
        intent: 'edit_last',
        patterns: [
          /^(?:change|edit|modify|update)\s+(?:last\s+)?(?:set\s+)?(weight|reps?|repetitions?|rpe)\s+(?:to|=)\s*(.+)/i,
          /^(?:change|edit|modify|update)\s+(.+?)\s+(?:to|=)\s*(.+)/i,
          /^(?:last\s+)?(?:set\s+)?(weight|reps?|repetitions?|rpe)\s+(?:was|is)\s+(.+)/i
        ],
        extractor: this.extractEditLastParams.bind(this),
        confidence: 0.85
      },
      
      // Undo last: "undo" or "delete last set"
      {
        intent: 'undo_last',
        patterns: [
          /^(?:undo|cancel|delete|remove)(?:\s+(?:last|previous)\s+(?:set|entry|log))?/i,
          /^(?:oops|mistake|wrong)/i,
          /^(?:take\s+(?:that|it)\s+back)/i
        ],
        extractor: () => ({}),
        confidence: 0.9
      },
      
      // Rest timer: "rest for 3 minutes" or "set timer 90 seconds"
      {
        intent: 'rest_timer',
        patterns: [
          /^(?:rest|timer|break)\s+(?:for\s+)?(\d+)\s*(minutes?|mins?|seconds?|secs?)/i,
          /^(?:set\s+)?timer\s+(?:for\s+)?(\d+)\s*(minutes?|mins?|seconds?|secs?)/i,
          /^(\d+)\s*(minutes?|mins?|seconds?|secs?)\s+(?:rest|timer|break)/i
        ],
        extractor: this.extractRestTimerParams.bind(this),
        confidence: 0.9
      },
      
      // General exercise mention: "bench press" (might be start of log_set)
      {
        intent: 'exercise_mention',
        patterns: [
          /^(.+?)(?:\s+(?:exercise|movement|lift))?$/i
        ],
        extractor: this.extractExerciseMentionParams.bind(this),
        confidence: 0.5
      }
    ];
  }

  /**
   * Match utterance against intent pattern
   */
  matchPattern(pattern, tokens, text) {
    for (const regex of pattern.patterns) {
      const match = text.match(regex);
      if (match) {
        const parameters = pattern.extractor(match, tokens);
        return {
          intent: pattern.intent,
          confidence: pattern.confidence,
          parameters,
          utterance: text,
          tokens,
          rawMatch: match
        };
      }
    }
    return null;
  }

  /**
   * Extract parameters for log_set intent
   */
  extractLogSetParams(match, tokens) {
    const params = {};
    
    // Different patterns have different capture groups
    if (match[1] && !this.isNumeric(match[1])) {
      // Pattern 1: exercise first
      params.exercise = this.findExercise(match[1]);
      params.reps = parseInt(match[2]);
      params.weight = parseFloat(match[4]);
      params.unit = this.normalizeUnit(match[5]);
      params.rpe = match[6] ? parseFloat(match[6]) : null;
      params.setIndex = match[7] ? parseInt(match[7]) : null;
    } else if (this.isNumeric(match[1])) {
      // Pattern 2: reps first
      params.reps = parseInt(match[1]);
      params.exercise = this.findExercise(match[3]);
      params.weight = parseFloat(match[4]);
      params.unit = this.normalizeUnit(match[5]);
      params.rpe = match[6] ? parseFloat(match[6]) : null;
    } else {
      // Pattern 3: exercise weight reps
      params.exercise = this.findExercise(match[1]);
      params.weight = parseFloat(match[2]);
      params.unit = this.normalizeUnit(match[3]);
      params.reps = parseInt(match[4]);
      params.rpe = match[6] ? parseFloat(match[6]) : null;
    }
    
    return params;
  }

  /**
   * Extract parameters for start_workout intent
   */
  extractStartWorkoutParams(match, tokens) {
    return {
      title: match[1] ? match[1].trim() : null
    };
  }

  /**
   * Extract parameters for edit_last intent
   */
  extractEditLastParams(match, tokens) {
    const field = this.normalizeField(match[1]);
    let value = match[2];
    
    // Parse the value based on field type
    if (field === 'weight') {
      value = this.parseWeightValue(value);
    } else if (field === 'reps') {
      value = parseInt(value) || 0;
    } else if (field === 'rpe') {
      value = parseFloat(value) || 0;
    }
    
    return {
      field,
      value
    };
  }

  /**
   * Extract parameters for rest_timer intent
   */
  extractRestTimerParams(match, tokens) {
    const duration = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    // Convert to seconds
    let seconds = duration;
    if (unit.startsWith('min')) {
      seconds = duration * 60;
    }
    
    return {
      seconds,
      originalDuration: duration,
      originalUnit: unit
    };
  }

  /**
   * Extract parameters for exercise_mention intent
   */
  extractExerciseMentionParams(match, tokens) {
    const exercise = this.findExercise(match[1]);
    return {
      exercise
    };
  }

  /**
   * Find exercise using fuzzy matching
   */
  findExercise(query) {
    if (!query) return null;
    
    const cleanQuery = query.toLowerCase().trim();
    
    // Exact match first
    if (this.exerciseLibrary.has(cleanQuery)) {
      return this.exerciseLibrary.get(cleanQuery);
    }
    
    // Check synonyms
    if (this.synonyms.has(cleanQuery)) {
      const canonicalName = this.synonyms.get(cleanQuery);
      if (this.exerciseLibrary.has(canonicalName)) {
        return this.exerciseLibrary.get(canonicalName);
      }
    }
    
    // Fuzzy matching
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [exerciseName, exercise] of this.exerciseLibrary.entries()) {
      const score = this.calculateSimilarity(cleanQuery, exerciseName);
      if (score > bestScore && score >= this.config.fuzzyMatchThreshold) {
        bestScore = score;
        bestMatch = exercise;
      }
    }
    
    if (bestMatch) {
      console.log(`Fuzzy matched "${query}" to "${bestMatch.name}" (score: ${bestScore})`);
    }
    
    return bestMatch;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  calculateSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    
    const distance = calculateLevenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }

  /**
   * Enrich intent with context and confidence scoring
   */
  enrichIntent(intent, context) {
    // Add context-based adjustments
    if (context.currentWorkout && intent.intent === 'log_set') {
      // If in an active workout, boost confidence
      intent.confidence = Math.min(1.0, intent.confidence + 0.05);
    }
    
    if (context.lastExercise && intent.intent === 'log_set' && !intent.parameters.exercise) {
      // Use last exercise if no exercise specified
      intent.parameters.exercise = context.lastExercise;
      intent.parameters.exerciseInferred = true;
    }
    
    // Add disambiguation if confidence is low
    if (intent.confidence < 0.8) {
      intent.needsConfirmation = true;
      intent.disambiguation = this.generateDisambiguation(intent);
    }
    
    return intent;
  }

  /**
   * Generate disambiguation options
   */
  generateDisambiguation(intent) {
    const options = [];
    
    if (intent.intent === 'log_set' && intent.parameters.exercise) {
      // Suggest similar exercises
      const exerciseName = intent.parameters.exercise.name.toLowerCase();
      for (const [name, exercise] of this.exerciseLibrary.entries()) {
        if (name !== exerciseName && this.calculateSimilarity(exerciseName, name) > 0.6) {
          options.push({
            intent: 'log_set',
            parameters: { ...intent.parameters, exercise },
            description: `Did you mean ${exercise.name}?`
          });
        }
      }
    }
    
    return options.slice(0, 3); // Limit to 3 options
  }

  /**
   * Suggest alternatives for unknown intents
   */
  suggestAlternatives(tokens) {
    const suggestions = [];
    
    // Look for potential exercise names
    const potentialExercises = tokens.filter(token => 
      !this.isCommonWord(token) && token.length > 2
    );
    
    for (const token of potentialExercises) {
      const exercise = this.findExercise(token);
      if (exercise) {
        suggestions.push({
          type: 'exercise',
          value: exercise,
          description: `Did you mean to log ${exercise.name}?`
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Preprocess text for better parsing
   */
  preprocessText(text) {
    return text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s\.]/g, ' ') // Remove special chars except periods
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Tokenize text into words
   */
  tokenize(text) {
    return text.split(/\s+/).filter(token => token.length > 0);
  }

  /**
   * Check if string represents a number
   */
  isNumeric(str) {
    return !isNaN(parseFloat(str)) && isFinite(str);
  }

  /**
   * Normalize unit names
   */
  normalizeUnit(unit) {
    if (!unit) return 'lbs';
    
    const normalized = unit.toLowerCase();
    if (normalized.includes('kg') || normalized.includes('kilo')) {
      return 'kg';
    }
    return 'lbs';
  }

  /**
   * Normalize field names
   */
  normalizeField(field) {
    if (!field) return null;
    
    const normalized = field.toLowerCase();
    if (normalized.includes('rep')) return 'reps';
    if (normalized.includes('weight')) return 'weight';
    if (normalized.includes('rpe')) return 'rpe';
    return normalized;
  }

  /**
   * Parse weight value with unit detection
   */
  parseWeightValue(value) {
    const match = value.match(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kgs?|kilos?|kilograms?)?/i);
    if (match) {
      return {
        weight: parseFloat(match[1]),
        unit: this.normalizeUnit(match[2])
      };
    }
    return { weight: parseFloat(value) || 0, unit: 'lbs' };
  }

  /**
   * Check if word is common and should be ignored in analysis
   */
  isCommonWord(word) {
    const commonWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'can', 'may', 'might', 'must', 'shall', 'i', 'you', 'he', 'she', 'it',
      'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
      'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those'
    ]);
    return commonWords.has(word.toLowerCase());
  }

  /**
   * Load default synonyms for common exercise variations
   */
  loadDefaultSynonyms() {
    const synonymMappings = {
      // Bench press variations
      'bench': 'barbell bench press',
      'bp': 'barbell bench press',
      'flat bench': 'barbell bench press',
      
      // Squat variations  
      'squat': 'back squat',
      'back squat': 'back squat',
      'bs': 'back squat',
      
      // Deadlift variations
      'dl': 'deadlift',
      'dead': 'deadlift',
      'conventional deadlift': 'deadlift',
      
      // Overhead press variations
      'ohp': 'overhead press',
      'op': 'overhead press',
      'press': 'overhead press',
      'military press': 'overhead press',
      
      // Row variations
      'row': 'bent-over barbell row',
      'barbell row': 'bent-over barbell row',
      'bb row': 'bent-over barbell row'
    };
    
    for (const [synonym, canonical] of Object.entries(synonymMappings)) {
      this.synonyms.set(synonym, canonical.toLowerCase());
    }
  }

  /**
   * Add custom synonym
   */
  addSynonym(synonym, canonicalName) {
    this.synonyms.set(synonym.toLowerCase(), canonicalName.toLowerCase());
  }

  /**
   * Get intent parsing statistics
   */
  getStats() {
    return {
      exerciseLibrarySize: this.exerciseLibrary.size,
      synonymsCount: this.synonyms.size,
      intentPatternsCount: this.intentPatterns.length,
      confidenceThreshold: this.config.confidenceThreshold,
      fuzzyMatchThreshold: this.config.fuzzyMatchThreshold
    };
  }
}

export default IntentParser;