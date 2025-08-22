/**
 * NumberParser - Parse written numbers to digits and handle units
 * Supports "one hundred", "fifty", etc. and unit conversions
 */

class NumberParser {
  constructor() {
    this.numberWords = this.initializeNumberWords();
    this.unitConversions = this.initializeUnitConversions();
  }

  /**
   * Initialize number word mappings
   */
  initializeNumberWords() {
    return {
      // Basic numbers
      'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      
      // Tens
      'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
      'eighty': 80, 'ninety': 90,
      
      // Scale words
      'hundred': 100, 'thousand': 1000, 'million': 1000000,
      
      // Fractions and decimals
      'half': 0.5, 'quarter': 0.25, 'third': 0.33, 'eighth': 0.125,
      
      // Common alternatives
      'a': 1, 'an': 1, 'dozen': 12, 'score': 20,
      
      // Ordinals (for set numbers)
      'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
      'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10
    };
  }

  /**
   * Initialize unit conversion mappings
   */
  initializeUnitConversions() {
    return {
      // Weight units to pounds
      weight: {
        'kg': 2.20462, 'kgs': 2.20462, 'kilo': 2.20462, 'kilos': 2.20462, 'kilogram': 2.20462, 'kilograms': 2.20462,
        'lb': 1, 'lbs': 1, 'pound': 1, 'pounds': 1,
        'stone': 14, 'stones': 14,
        'oz': 0.0625, 'ounce': 0.0625, 'ounces': 0.0625
      },
      
      // Time units to seconds
      time: {
        'sec': 1, 'secs': 1, 'second': 1, 'seconds': 1,
        'min': 60, 'mins': 60, 'minute': 60, 'minutes': 60,
        'hr': 3600, 'hrs': 3600, 'hour': 3600, 'hours': 3600
      },
      
      // Distance units to meters
      distance: {
        'm': 1, 'meter': 1, 'meters': 1, 'metre': 1, 'metres': 1,
        'cm': 0.01, 'centimeter': 0.01, 'centimeters': 0.01,
        'km': 1000, 'kilometer': 1000, 'kilometers': 1000,
        'ft': 0.3048, 'foot': 0.3048, 'feet': 0.3048,
        'in': 0.0254, 'inch': 0.0254, 'inches': 0.0254,
        'yd': 0.9144, 'yard': 0.9144, 'yards': 0.9144,
        'mile': 1609.34, 'miles': 1609.34
      }
    };
  }

  /**
   * Parse text containing numbers and return numeric value
   */
  parseNumber(text) {
    if (!text) return null;
    
    const cleanText = text.toLowerCase().trim();
    
    // Try to parse as regular number first
    const numericValue = parseFloat(cleanText);
    if (!isNaN(numericValue)) {
      return numericValue;
    }
    
    // Parse word numbers
    return this.parseWordsToNumber(cleanText);
  }

  /**
   * Parse written numbers to numeric values
   */
  parseWordsToNumber(text) {
    const words = text.split(/\s+/);
    let result = 0;
    let current = 0;
    let i = 0;
    
    while (i < words.length) {
      const word = words[i].replace(/[^a-z]/g, ''); // Remove punctuation
      
      if (this.numberWords.hasOwnProperty(word)) {
        const value = this.numberWords[word];
        
        if (value === 100) {
          current *= 100;
        } else if (value === 1000 || value === 1000000) {
          result += current * value;
          current = 0;
        } else {
          current += value;
        }
      } else {
        // Handle compound numbers like "twenty-one"
        const parts = word.split('-');
        if (parts.length === 2) {
          const part1 = this.numberWords[parts[0]] || 0;
          const part2 = this.numberWords[parts[1]] || 0;
          current += part1 + part2;
        }
      }
      
      i++;
    }
    
    result += current;
    return result > 0 ? result : null;
  }

  /**
   * Parse number with unit (e.g., "185 pounds", "three minutes")
   */
  parseNumberWithUnit(text) {
    if (!text) return null;
    
    const cleanText = text.toLowerCase().trim();
    
    // Pattern: number + unit
    const numberUnitRegex = /(\d+(?:\.\d+)?|[a-z\-\s]+)\s*(\w+)/i;
    const match = cleanText.match(numberUnitRegex);
    
    if (!match) return null;
    
    const numberPart = match[1].trim();
    const unitPart = match[2].trim();
    
    const number = this.parseNumber(numberPart);
    if (number === null) return null;
    
    return {
      value: number,
      unit: unitPart,
      originalText: text
    };
  }

  /**
   * Convert weight to standard unit (pounds)
   */
  convertWeight(value, fromUnit, toUnit = 'lbs') {
    const fromKey = fromUnit.toLowerCase().replace(/[^a-z]/g, '');
    const toKey = toUnit.toLowerCase().replace(/[^a-z]/g, '');
    
    const fromMultiplier = this.unitConversions.weight[fromKey] || 1;
    const toMultiplier = this.unitConversions.weight[toKey] || 1;
    
    // Convert to pounds first, then to target unit
    const inPounds = value * fromMultiplier;
    return inPounds / toMultiplier;
  }

  /**
   * Convert time to standard unit (seconds)
   */
  convertTime(value, fromUnit, toUnit = 'seconds') {
    const fromKey = fromUnit.toLowerCase().replace(/[^a-z]/g, '');
    const toKey = toUnit.toLowerCase().replace(/[^a-z]/g, '');
    
    const fromMultiplier = this.unitConversions.time[fromKey] || 1;
    const toMultiplier = this.unitConversions.time[toKey] || 1;
    
    // Convert to seconds first, then to target unit
    const inSeconds = value * fromMultiplier;
    return inSeconds / toMultiplier;
  }

  /**
   * Parse weight expression (e.g., "one hundred eighty five pounds")
   */
  parseWeight(text) {
    if (!text) return null;
    
    const cleanText = text.toLowerCase().trim();
    
    // Look for patterns like "185 lbs", "one eighty five pounds", etc.
    const patterns = [
      /(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kgs?|kilos?|kilograms?)/i,
      /([a-z\s\-]+)\s+(lbs?|pounds?|kgs?|kilos?|kilograms?)/i
    ];
    
    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const numberPart = match[1].trim();
        const unit = match[2].trim();
        
        const weight = this.parseNumber(numberPart);
        if (weight !== null) {
          return {
            weight,
            unit: this.normalizeWeightUnit(unit),
            originalText: text
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Parse time expression (e.g., "three minutes", "90 seconds")
   */
  parseTime(text) {
    if (!text) return null;
    
    const cleanText = text.toLowerCase().trim();
    
    // Look for patterns like "3 min", "ninety seconds", etc.
    const patterns = [
      /(\d+(?:\.\d+)?)\s*(secs?|seconds?|mins?|minutes?|hrs?|hours?)/i,
      /([a-z\s\-]+)\s+(secs?|seconds?|mins?|minutes?|hrs?|hours?)/i
    ];
    
    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const numberPart = match[1].trim();
        const unit = match[2].trim();
        
        const time = this.parseNumber(numberPart);
        if (time !== null) {
          return {
            duration: time,
            unit: this.normalizeTimeUnit(unit),
            seconds: this.convertTime(time, unit, 'seconds'),
            originalText: text
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Parse RPE (Rate of Perceived Exertion) values
   */
  parseRPE(text) {
    if (!text) return null;
    
    const cleanText = text.toLowerCase().trim();
    
    // Look for RPE patterns
    const patterns = [
      /rpe\s*(\d+(?:\.\d+)?)/i,
      /rpe\s*([a-z\s\-]+)/i,
      /(\d+(?:\.\d+)?)\s*rpe/i,
      /([a-z\s\-]+)\s*rpe/i,
      /at\s*(\d+(?:\.\d+)?)/i, // "at 8" for RPE 8
      /rated?\s*(\d+(?:\.\d+)?)/i
    ];
    
    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const numberPart = match[1].trim();
        const rpe = this.parseNumber(numberPart);
        
        if (rpe !== null && rpe >= 1 && rpe <= 10) {
          return {
            rpe,
            originalText: text
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Normalize weight unit names
   */
  normalizeWeightUnit(unit) {
    const normalized = unit.toLowerCase().replace(/[^a-z]/g, '');
    
    if (['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'].includes(normalized)) {
      return 'kg';
    }
    
    return 'lbs'; // Default to pounds
  }

  /**
   * Normalize time unit names
   */
  normalizeTimeUnit(unit) {
    const normalized = unit.toLowerCase().replace(/[^a-z]/g, '');
    
    if (['min', 'mins', 'minute', 'minutes'].includes(normalized)) {
      return 'minutes';
    }
    
    if (['hr', 'hrs', 'hour', 'hours'].includes(normalized)) {
      return 'hours';
    }
    
    return 'seconds'; // Default to seconds
  }

  /**
   * Extract all numbers from text
   */
  extractAllNumbers(text) {
    const numbers = [];
    const words = text.toLowerCase().split(/\s+/);
    
    // Extract numeric values
    const numericRegex = /\d+(?:\.\d+)?/g;
    const numericMatches = text.match(numericRegex);
    if (numericMatches) {
      numbers.push(...numericMatches.map(Number));
    }
    
    // Extract word numbers
    for (const word of words) {
      const cleanWord = word.replace(/[^a-z\-]/g, '');
      if (this.numberWords.hasOwnProperty(cleanWord)) {
        numbers.push(this.numberWords[cleanWord]);
      }
    }
    
    return numbers;
  }

  /**
   * Check if text contains a number
   */
  containsNumber(text) {
    if (!text) return false;
    
    // Check for numeric digits
    if (/\d/.test(text)) return true;
    
    // Check for word numbers
    const words = text.toLowerCase().split(/\s+/);
    return words.some(word => {
      const cleanWord = word.replace(/[^a-z\-]/g, '');
      return this.numberWords.hasOwnProperty(cleanWord);
    });
  }

  /**
   * Format number as words (reverse operation)
   */
  numberToWords(num) {
    if (num === 0) return 'zero';
    
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' ' + this.numberToWords(num % 100) : '');
    
    return num.toString(); // Fallback for larger numbers
  }

  /**
   * Get supported units for a given type
   */
  getSupportedUnits(type) {
    return Object.keys(this.unitConversions[type] || {});
  }
}

export default NumberParser;