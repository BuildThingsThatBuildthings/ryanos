/**
 * StringUtils - Utility functions for string manipulation and comparison
 */

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of exercise names
 */
export function calculateLevenshteinDistance(str1, str2) {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score between two strings (0-1 scale)
 */
export function calculateSimilarity(str1, str2) {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = calculateLevenshteinDistance(str1, str2);
  return 1 - (distance / maxLength);
}

/**
 * Find the best match from a list of candidates
 */
export function findBestMatch(query, candidates, threshold = 0.6) {
  let bestMatch = null;
  let bestScore = 0;
  
  const queryLower = query.toLowerCase();
  
  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase();
    
    // Exact match gets highest score
    if (queryLower === candidateLower) {
      return { match: candidate, score: 1.0 };
    }
    
    // Substring match gets high score
    if (candidateLower.includes(queryLower) || queryLower.includes(candidateLower)) {
      const score = Math.max(queryLower.length, candidateLower.length) / 
                   Math.min(queryLower.length, candidateLower.length);
      if (score > bestScore) {
        bestScore = Math.min(0.95, score); // Cap at 0.95 for substring matches
        bestMatch = candidate;
      }
    }
    
    // Fuzzy match
    const score = calculateSimilarity(queryLower, candidateLower);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return bestMatch ? { match: bestMatch, score: bestScore } : null;
}

/**
 * Normalize text for comparison
 */
export function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract numbers from text
 */
export function extractNumbers(text) {
  const numberRegex = /\d+(?:\.\d+)?/g;
  const matches = text.match(numberRegex);
  return matches ? matches.map(Number) : [];
}

/**
 * Extract words from text
 */
export function extractWords(text) {
  const wordRegex = /[a-zA-Z]+/g;
  const matches = text.match(wordRegex);
  return matches ? matches.map(word => word.toLowerCase()) : [];
}

/**
 * Check if string contains any of the given keywords
 */
export function containsAny(text, keywords) {
  const textLower = text.toLowerCase();
  return keywords.some(keyword => textLower.includes(keyword.toLowerCase()));
}

/**
 * Check if string contains all of the given keywords
 */
export function containsAll(text, keywords) {
  const textLower = text.toLowerCase();
  return keywords.every(keyword => textLower.includes(keyword.toLowerCase()));
}

/**
 * Split camelCase or PascalCase strings
 */
export function splitCamelCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+(.)/g, (match, letter) => letter.toUpperCase())
    .replace(/^(.)/, letter => letter.toLowerCase());
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str, maxLength, suffix = '...') {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Pluralize word based on count
 */
export function pluralize(word, count, pluralForm = null) {
  if (count === 1) return word;
  
  if (pluralForm) return pluralForm;
  
  // Simple pluralization rules
  if (word.endsWith('y')) {
    return word.slice(0, -1) + 'ies';
  }
  
  if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
    return word + 'es';
  }
  
  return word + 's';
}

/**
 * Generate abbreviation from phrase
 */
export function generateAbbreviation(phrase, maxLength = 4) {
  const words = phrase.split(/\s+/);
  
  if (words.length === 1) {
    return words[0].substring(0, maxLength).toUpperCase();
  }
  
  // Take first letter of each word
  let abbreviation = words.map(word => word.charAt(0)).join('').toUpperCase();
  
  // If too long, take fewer letters
  if (abbreviation.length > maxLength) {
    abbreviation = abbreviation.substring(0, maxLength);
  }
  
  // If too short, add more letters from first word
  if (abbreviation.length < maxLength && words[0].length > 1) {
    const needed = maxLength - abbreviation.length;
    const extraLetters = words[0].substring(1, 1 + needed).toUpperCase();
    abbreviation = abbreviation.charAt(0) + extraLetters + abbreviation.substring(1);
  }
  
  return abbreviation;
}

/**
 * Remove common words from text
 */
export function removeStopWords(text) {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
    'had', 'what', 'said', 'each', 'which', 'their', 'time', 'if'
  ]);
  
  return text
    .split(/\s+/)
    .filter(word => !stopWords.has(word.toLowerCase()))
    .join(' ');
}

/**
 * Calculate Jaro-Winkler similarity
 */
export function jaroWinklerSimilarity(str1, str2) {
  const jaro = jaroSimilarity(str1, str2);
  
  if (jaro < 0.7) return jaro;
  
  // Find common prefix up to 4 characters
  let prefix = 0;
  for (let i = 0; i < Math.min(str1.length, str2.length, 4); i++) {
    if (str1[i] === str2[i]) {
      prefix++;
    } else {
      break;
    }
  }
  
  return jaro + (0.1 * prefix * (1 - jaro));
}

/**
 * Calculate Jaro similarity
 */
function jaroSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0 || len2 === 0) return 0;
  
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const str1Matches = new Array(len1).fill(false);
  const str2Matches = new Array(len2).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    
    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      
      str1Matches[i] = str2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0;
  
  // Find transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!str1Matches[i]) continue;
    
    while (!str2Matches[k]) k++;
    
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }
  
  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
}