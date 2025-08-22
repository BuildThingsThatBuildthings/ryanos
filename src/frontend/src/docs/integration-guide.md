# Fitness Tracking API Integration Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Authentication Flow](#authentication-flow)
3. [Core Workflow Examples](#core-workflow-examples)
4. [Voice Integration](#voice-integration)
5. [LLM Workout Generation](#llm-workout-generation)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Offline Support](#offline-support)
9. [WebSocket Integration](#websocket-integration)
10. [Best Practices](#best-practices)

## Getting Started

### Base URLs
- **Development**: `http://localhost:3000/api`
- **Production**: `https://api.fitnessapp.com`

### Required Headers
```http
Content-Type: application/json
Authorization: Bearer {jwt_token}
```

### Response Format
All API responses follow this consistent format:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  }
}
```

## Authentication Flow

### 1. User Registration

```javascript
const registerUser = async (userData) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: userData.name,
      email: userData.email,
      password: userData.password,
      confirmPassword: userData.confirmPassword
    })
  });

  const result = await response.json();
  
  if (result.success) {
    // Store token securely
    localStorage.setItem('authToken', result.data.token);
    localStorage.setItem('user', JSON.stringify(result.data.user));
    return result.data;
  }
  
  throw new Error(result.error.message);
};
```

### 2. User Login

```javascript
const loginUser = async (credentials) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password
    })
  });

  const result = await response.json();
  
  if (result.success) {
    localStorage.setItem('authToken', result.data.token);
    localStorage.setItem('user', JSON.stringify(result.data.user));
    return result.data;
  }
  
  throw new Error(result.error.message);
};
```

### 3. Token Refresh

```javascript
const refreshToken = async () => {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    }
  });

  const result = await response.json();
  
  if (result.success) {
    localStorage.setItem('authToken', result.data.token);
    return result.data.token;
  }
  
  // Token refresh failed, redirect to login
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
};
```

### 4. Automatic Token Refresh

```javascript
// Axios interceptor for automatic token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

## Core Workflow Examples

### 1. Creating a Complete Workout

```javascript
const createWorkoutWithSets = async (workoutData) => {
  try {
    // Step 1: Create the workout
    const workoutResponse = await fetch('/api/workouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        name: workoutData.name,
        description: workoutData.description,
        date: workoutData.date
      })
    });

    const workout = await workoutResponse.json();
    
    if (!workout.success) {
      throw new Error(workout.error.message);
    }

    const workoutId = workout.data.id;

    // Step 2: Add sets to the workout
    const sets = [];
    for (const setData of workoutData.sets) {
      const setResponse = await fetch(`/api/workouts/${workoutId}/sets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          exerciseId: setData.exerciseId,
          setNumber: setData.setNumber,
          reps: setData.reps,
          weight: setData.weight,
          rpe: setData.rpe,
          notes: setData.notes
        })
      });

      const set = await setResponse.json();
      if (set.success) {
        sets.push(set.data);
      }
    }

    return {
      workout: workout.data,
      sets: sets
    };

  } catch (error) {
    console.error('Error creating workout:', error);
    throw error;
  }
};

// Usage example
const workoutData = {
  name: "Push Day",
  description: "Chest, shoulders, and triceps",
  date: "2024-01-15",
  sets: [
    {
      exerciseId: "exercise_bench_press",
      setNumber: 1,
      reps: 8,
      weight: 135,
      rpe: 7,
      notes: "Felt good, controlled movement"
    },
    {
      exerciseId: "exercise_bench_press",
      setNumber: 2,
      reps: 8,
      weight: 135,
      rpe: 8,
      notes: "Getting challenging"
    }
  ]
};

createWorkoutWithSets(workoutData);
```

### 2. Exercise Search and Filtering

```javascript
const searchExercises = async (filters) => {
  const params = new URLSearchParams();
  
  if (filters.search) params.append('search', filters.search);
  if (filters.category) params.append('category', filters.category);
  if (filters.muscle) params.append('muscle', filters.muscle);
  if (filters.equipment) params.append('equipment', filters.equipment);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);

  const response = await fetch(`/api/exercises?${params}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });

  const result = await response.json();
  
  if (result.success) {
    return {
      exercises: result.data.data,
      pagination: {
        total: result.data.total,
        page: result.data.page,
        limit: result.data.limit,
        hasNext: result.data.hasNext,
        hasPrev: result.data.hasPrev
      }
    };
  }
  
  throw new Error(result.error.message);
};

// Usage examples
searchExercises({ category: 'strength', muscle: 'chest' });
searchExercises({ search: 'bench press' });
searchExercises({ equipment: 'barbell', page: 1, limit: 20 });
```

### 3. Workout Progress Tracking

```javascript
const updateSetProgress = async (setId, updates) => {
  const response = await fetch(`/api/sets/${setId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      ...updates,
      completed: true,
      completedAt: new Date().toISOString()
    })
  });

  const result = await response.json();
  
  if (result.success) {
    return result.data;
  }
  
  throw new Error(result.error.message);
};

// Mark set as completed with actual performance
updateSetProgress('set_123', {
  reps: 8,
  weight: 140,
  rpe: 8,
  notes: 'Increased weight from last week'
});
```

## Voice Integration

### 1. Voice Session Management

```javascript
class VoiceWorkoutLogger {
  constructor() {
    this.sessionId = null;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  async startSession(workoutId = null) {
    const response = await fetch('/api/voice/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ workoutId })
    });

    const result = await response.json();
    
    if (result.success) {
      this.sessionId = result.data.id;
      return result.data;
    }
    
    throw new Error(result.error.message);
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      // Stop all audio tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  async processRecording() {
    if (this.audioChunks.length === 0) return;

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const response = await fetch('/api/voice/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        sessionId: this.sessionId,
        audioData: `data:audio/webm;base64,${base64Audio}`,
        mimeType: 'audio/webm'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      this.onTranscriptionReceived(result.data);
      return result.data;
    }
    
    throw new Error(result.error.message);
  }

  onTranscriptionReceived(data) {
    console.log('Transcript:', data.transcript);
    console.log('Extracted data:', data.extractedData);
    console.log('Confidence:', data.confidence);
    
    // Handle the extracted workout data
    if (data.extractedData && data.extractedData.exercises) {
      this.processExtractedWorkoutData(data.extractedData);
    }
  }

  async processExtractedWorkoutData(extractedData) {
    // Automatically create sets from voice data
    for (const exerciseData of extractedData.exercises) {
      for (const setData of exerciseData.sets) {
        await this.createSetFromVoice(exerciseData.id, setData);
      }
    }
  }

  async createSetFromVoice(exerciseId, setData) {
    // Implementation depends on current workout context
    // This is a simplified example
    const response = await fetch(`/api/workouts/${this.workoutId}/sets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        exerciseId: exerciseId,
        setNumber: setData.setNumber || 1,
        reps: setData.reps,
        weight: setData.weight,
        time: setData.time,
        rpe: setData.rpe,
        notes: `Added via voice: "${setData.originalText}"`
      })
    });

    return await response.json();
  }
}

// Usage
const voiceLogger = new VoiceWorkoutLogger();

// Start a voice session
await voiceLogger.startSession('workout_123');

// Start recording
await voiceLogger.startRecording();

// Stop recording (typically triggered by button or voice command)
voiceLogger.stopRecording();
```

### 2. Voice Command Processing

```javascript
const processVoiceCommand = async (command, context = {}) => {
  const response = await fetch('/api/voice/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      command: command,
      context: {
        currentWorkout: context.workoutId,
        currentExercise: context.exerciseId,
        ...context
      }
    })
  });

  const result = await response.json();
  
  if (result.success) {
    return result.data;
  }
  
  throw new Error(result.error.message);
};

// Example voice commands
const commands = [
  "Start a new workout",
  "Add bench press to my workout",
  "I just did 8 reps with 135 pounds",
  "Mark this set as complete",
  "End my workout",
  "What's my next exercise?"
];

// Process a command
const commandResult = await processVoiceCommand(
  "I just completed 3 sets of bench press with 135 pounds for 8 reps each",
  { workoutId: 'workout_123' }
);

console.log('Command action:', commandResult.action);
console.log('Parameters:', commandResult.parameters);
```

### 3. Real-time Voice Transcription

```javascript
class RealtimeVoiceTranscription {
  constructor() {
    this.websocket = null;
    this.mediaRecorder = null;
    this.isStreaming = false;
  }

  async connect() {
    const token = getAuthToken();
    this.websocket = new WebSocket(`wss://api.fitnessapp.com/voice/stream?token=${token}`);
    
    this.websocket.onopen = () => {
      console.log('Voice stream connected');
    };

    this.websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.onTranscriptUpdate(data);
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.websocket.onclose = () => {
      console.log('Voice stream disconnected');
      this.isStreaming = false;
    };
  }

  async startStreaming() {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000
      }
    });

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.websocket.readyState === WebSocket.OPEN) {
        // Send audio data to server for real-time processing
        this.websocket.send(event.data);
      }
    };

    this.mediaRecorder.start(100); // Send data every 100ms
    this.isStreaming = true;
  }

  stopStreaming() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    if (this.websocket) {
      this.websocket.close();
    }
    
    this.isStreaming = false;
  }

  onTranscriptUpdate(data) {
    if (data.type === 'transcript') {
      // Update UI with partial transcript
      this.updateTranscriptDisplay(data.text, data.isFinal);
    } else if (data.type === 'workout_data') {
      // Handle extracted workout data
      this.handleWorkoutData(data.data);
    }
  }

  updateTranscriptDisplay(text, isFinal) {
    const transcriptElement = document.getElementById('transcript');
    if (isFinal) {
      transcriptElement.innerHTML += `<p class="final">${text}</p>`;
    } else {
      transcriptElement.innerHTML = transcriptElement.innerHTML.replace(
        /<p class="interim">.*<\/p>$/,
        ''
      ) + `<p class="interim">${text}</p>`;
    }
  }
}
```

## LLM Workout Generation

### 1. Basic Workout Generation

```javascript
const generateWorkout = async (prompt, preferences = {}) => {
  const response = await fetch('/api/workouts/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      prompt: prompt,
      preferences: {
        duration: preferences.duration || 60,
        equipment: preferences.equipment || [],
        targetMuscles: preferences.targetMuscles || [],
        level: preferences.level || 'intermediate',
        goals: preferences.goals || [],
        limitations: preferences.limitations || []
      }
    })
  });

  const result = await response.json();
  
  if (result.success) {
    return result.data;
  }
  
  throw new Error(result.error.message);
};

// Example usage
const workout = await generateWorkout(
  "Create a 45-minute upper body strength workout focusing on compound movements",
  {
    duration: 45,
    equipment: ['barbell', 'dumbbell', 'bench'],
    targetMuscles: ['chest', 'shoulders', 'triceps', 'back'],
    level: 'intermediate',
    goals: ['strength', 'muscle_building'],
    limitations: ['no_overhead_pressing']
  }
);

console.log('Generated workout:', workout);
```

### 2. Advanced Workout Generation with Context

```javascript
const generateContextualWorkout = async (userContext) => {
  // First, get user's recent workout history
  const recentWorkouts = await fetch('/api/workouts?limit=5&status=completed', {
    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
  }).then(res => res.json());

  // Get user's exercise preferences
  const favorites = await fetch('/api/exercises/favorites', {
    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
  }).then(res => res.json());

  // Build contextual prompt
  const contextualPrompt = `
    Create a workout based on the following context:
    
    User Level: ${userContext.level}
    Available Time: ${userContext.duration} minutes
    Equipment: ${userContext.equipment.join(', ')}
    
    Recent Workouts (last 5):
    ${recentWorkouts.data?.data?.map(w => 
      `- ${w.name} (${w.date}): ${w.sets.length} sets total`
    ).join('\n') || 'No recent workouts'}
    
    Favorite Exercises: ${favorites.data?.map(e => e.name).join(', ') || 'None set'}
    
    Goals: ${userContext.goals.join(', ')}
    Limitations: ${userContext.limitations.join(', ')}
    
    Please create a balanced workout that:
    1. Considers recent training to avoid overuse
    2. Incorporates some favorite exercises if appropriate
    3. Matches the specified goals and constraints
    4. Provides proper progression from recent sessions
  `;

  return await generateWorkout(contextualPrompt, userContext);
};
```

### 3. Workout Template Generation

```javascript
const generateWorkoutTemplate = async (templateRequest) => {
  const prompt = `
    Create a reusable workout template with the following specifications:
    
    Template Name: ${templateRequest.name}
    Focus: ${templateRequest.focus}
    Duration: ${templateRequest.duration} minutes
    Frequency: ${templateRequest.frequency} times per week
    Equipment: ${templateRequest.equipment.join(', ')}
    
    The template should include:
    - Exercise selection with alternatives
    - Set and rep ranges (not fixed numbers)
    - Rest periods
    - Progression guidelines
    - Warm-up and cool-down
    
    Make it flexible enough to be used repeatedly with variations.
  `;

  const workout = await generateWorkout(prompt, templateRequest);
  
  // Save as template
  const templateResponse = await fetch('/api/workouts/templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      ...workout,
      isTemplate: true,
      name: templateRequest.name
    })
  });

  return await templateResponse.json();
};
```

## Error Handling

### 1. Comprehensive Error Handler

```javascript
class ApiErrorHandler {
  static handle(error) {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const errorData = error.response.data;

      switch (status) {
        case 400:
          return this.handleBadRequest(errorData);
        case 401:
          return this.handleUnauthorized(errorData);
        case 403:
          return this.handleForbidden(errorData);
        case 404:
          return this.handleNotFound(errorData);
        case 409:
          return this.handleConflict(errorData);
        case 422:
          return this.handleValidationError(errorData);
        case 429:
          return this.handleRateLimit(errorData);
        case 500:
          return this.handleServerError(errorData);
        default:
          return this.handleGenericError(errorData);
      }
    } else if (error.request) {
      // Network error
      return this.handleNetworkError();
    } else {
      // Other error
      return this.handleGenericError({ message: error.message });
    }
  }

  static handleBadRequest(errorData) {
    return {
      type: 'validation',
      message: 'Invalid request data',
      details: errorData.error?.details || errorData.error?.message,
      userMessage: 'Please check your input and try again.'
    };
  }

  static handleUnauthorized(errorData) {
    // Clear stored tokens
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    // Redirect to login
    window.location.href = '/login';
    
    return {
      type: 'auth',
      message: 'Authentication required',
      userMessage: 'Please log in to continue.'
    };
  }

  static handleValidationError(errorData) {
    const details = errorData.error?.details || {};
    const fieldErrors = Object.keys(details).map(field => ({
      field,
      message: details[field]
    }));

    return {
      type: 'validation',
      message: 'Validation failed',
      fieldErrors,
      userMessage: 'Please correct the highlighted fields.'
    };
  }

  static handleRateLimit(errorData) {
    const retryAfter = errorData.error?.retryAfter || 60;
    
    return {
      type: 'rate_limit',
      message: 'Rate limit exceeded',
      retryAfter,
      userMessage: `Too many requests. Please wait ${retryAfter} seconds before trying again.`
    };
  }

  static handleNetworkError() {
    return {
      type: 'network',
      message: 'Network connection failed',
      userMessage: 'Please check your internet connection and try again.'
    };
  }

  static handleServerError(errorData) {
    // Log error for debugging
    console.error('Server error:', errorData);
    
    return {
      type: 'server',
      message: 'Internal server error',
      userMessage: 'Something went wrong on our end. Please try again later.'
    };
  }
}

// Usage with async/await
const safeApiCall = async (apiCall) => {
  try {
    return await apiCall();
  } catch (error) {
    const handledError = ApiErrorHandler.handle(error);
    
    // Show user-friendly message
    showErrorMessage(handledError.userMessage);
    
    // Handle specific error types
    if (handledError.type === 'validation' && handledError.fieldErrors) {
      highlightFieldErrors(handledError.fieldErrors);
    }
    
    throw handledError;
  }
};
```

### 2. Retry Logic for Transient Errors

```javascript
const apiCallWithRetry = async (apiCall, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      const shouldRetry = attempt < maxRetries && isRetriableError(error);
      
      if (!shouldRetry) {
        throw error;
      }
      
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff
      delay *= 2;
    }
  }
};

const isRetriableError = (error) => {
  if (!error.response) {
    // Network errors are retriable
    return true;
  }
  
  const status = error.response.status;
  
  // Retry on server errors and rate limits
  return status >= 500 || status === 429;
};
```

## Rate Limiting

### 1. Understanding Rate Limits

The API implements the following rate limits:

| Endpoint Category | Limit | Window |
|------------------|-------|---------|
| Authentication | 5 requests | 15 minutes |
| Workouts | 100 requests | 1 hour |
| Exercises | 200 requests | 1 hour |
| Voice Processing | 50 requests | 1 hour |
| LLM Generation | 10 requests | 1 hour |

### 2. Rate Limit Headers

The API returns rate limit information in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### 3. Rate Limit Handling

```javascript
class RateLimitManager {
  constructor() {
    this.limits = new Map();
  }

  updateFromHeaders(headers) {
    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];

    if (limit && remaining && reset) {
      this.limits.set('current', {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: parseInt(reset) * 1000 // Convert to milliseconds
      });
    }
  }

  canMakeRequest() {
    const current = this.limits.get('current');
    if (!current) return true;
    
    return current.remaining > 0;
  }

  getTimeUntilReset() {
    const current = this.limits.get('current');
    if (!current) return 0;
    
    return Math.max(0, current.reset - Date.now());
  }

  getRemainingRequests() {
    const current = this.limits.get('current');
    return current ? current.remaining : null;
  }
}

const rateLimitManager = new RateLimitManager();

// Update rate limit info from response headers
const makeApiRequest = async (url, options) => {
  if (!rateLimitManager.canMakeRequest()) {
    const waitTime = rateLimitManager.getTimeUntilReset();
    throw new Error(`Rate limit exceeded. Reset in ${Math.ceil(waitTime / 1000)} seconds.`);
  }

  const response = await fetch(url, options);
  
  // Update rate limit info
  rateLimitManager.updateFromHeaders(response.headers);
  
  return response;
};
```

## Offline Support

### 1. Service Worker for Caching

```javascript
// sw.js
const CACHE_NAME = 'fitness-api-v1';
const CACHEABLE_ENDPOINTS = [
  '/api/exercises',
  '/api/workouts/templates',
  '/api/auth/profile'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/offline.html',
        '/app.js',
        '/styles.css'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (shouldCacheRequest(event.request)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          // Return cached version
          return response;
        }
        
        // Fetch and cache
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});

function shouldCacheRequest(request) {
  const url = new URL(request.url);
  return CACHEABLE_ENDPOINTS.some(endpoint => 
    url.pathname.startsWith(endpoint) && request.method === 'GET'
  );
}
```

### 2. Offline Queue Implementation

```javascript
class OfflineQueue {
  constructor() {
    this.queue = [];
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
    this.loadQueueFromStorage();
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async addToQueue(request) {
    const queueItem = {
      id: generateId(),
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(queueItem);
    await this.saveQueueToStorage();
    
    if (this.isOnline) {
      this.processQueue();
    }

    return queueItem.id;
  }

  async processQueue() {
    if (!this.isOnline || this.queue.length === 0) {
      return;
    }

    const itemsToProcess = [...this.queue];
    
    for (const item of itemsToProcess) {
      try {
        await this.processQueueItem(item);
        this.removeFromQueue(item.id);
      } catch (error) {
        console.error(`Failed to process queue item ${item.id}:`, error);
        item.retryCount++;
        
        if (item.retryCount >= 3) {
          // Remove after 3 failed attempts
          this.removeFromQueue(item.id);
        }
      }
    }

    await this.saveQueueToStorage();
  }

  async processQueueItem(item) {
    const response = await fetch(item.url, {
      method: item.method,
      headers: item.headers,
      body: item.body
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  removeFromQueue(id) {
    this.queue = this.queue.filter(item => item.id !== id);
  }

  async saveQueueToStorage() {
    localStorage.setItem('offlineQueue', JSON.stringify(this.queue));
  }

  loadQueueFromStorage() {
    const stored = localStorage.getItem('offlineQueue');
    if (stored) {
      this.queue = JSON.parse(stored);
    }
  }
}

const offlineQueue = new OfflineQueue();

// Modified fetch wrapper for offline support
const fetchWithOfflineSupport = async (url, options = {}) => {
  if (!navigator.onLine && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase())) {
    // Queue for later processing
    const queueId = await offlineQueue.addToQueue({ url, ...options });
    
    return {
      ok: true,
      status: 202,
      json: () => Promise.resolve({
        success: true,
        message: 'Request queued for offline processing',
        queueId
      })
    };
  }

  return fetch(url, options);
};
```

## WebSocket Integration

### 1. Real-time Workout Synchronization

```javascript
class WorkoutSync {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    const token = getAuthToken();
    this.ws = new WebSocket(`wss://api.fitnessapp.com/ws?token=${token}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.subscribe(['workout_updates', 'voice_sessions']);
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.reason);
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  subscribe(channels) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channels: channels
      }));
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'workout_updated':
        this.onWorkoutUpdated(message.data);
        break;
      case 'voice_session_processed':
        this.onVoiceSessionProcessed(message.data);
        break;
      case 'sync_required':
        this.onSyncRequired(message.data);
        break;
    }
  }

  onWorkoutUpdated(workout) {
    // Update local workout data
    updateLocalWorkout(workout);
    
    // Notify UI components
    dispatchEvent(new CustomEvent('workoutUpdated', { detail: workout }));
  }

  onVoiceSessionProcessed(session) {
    // Handle processed voice session
    if (session.extractedData) {
      this.processExtractedWorkoutData(session.extractedData);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnection attempt ${this.reconnectAttempts}`);
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  sendWorkoutUpdate(workoutId, update) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'workout_update',
        workoutId: workoutId,
        update: update
      }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Usage
const workoutSync = new WorkoutSync();
workoutSync.connect();

// Listen for workout updates
document.addEventListener('workoutUpdated', (event) => {
  console.log('Workout updated:', event.detail);
  // Update UI accordingly
});
```

## Best Practices

### 1. Security Best Practices

```javascript
// Secure token storage
class SecureStorage {
  static setToken(token) {
    // Use httpOnly cookies in production
    if (window.location.protocol === 'https:') {
      document.cookie = `authToken=${token}; Secure; HttpOnly; SameSite=Strict`;
    } else {
      // Fallback to localStorage for development
      localStorage.setItem('authToken', token);
    }
  }

  static getToken() {
    // Try to get from cookie first
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('authToken='));
    
    if (cookie) {
      return cookie.split('=')[1];
    }
    
    // Fallback to localStorage
    return localStorage.getItem('authToken');
  }

  static clearToken() {
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    localStorage.removeItem('authToken');
  }
}

// Input validation
const validateWorkoutData = (data) => {
  const errors = {};

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Workout name is required';
  }

  if (!data.date || !isValidDate(data.date)) {
    errors.date = 'Valid date is required';
  }

  if (data.sets && Array.isArray(data.sets)) {
    data.sets.forEach((set, index) => {
      if (set.weight && (set.weight < 0 || set.weight > 1000)) {
        errors[`sets.${index}.weight`] = 'Weight must be between 0 and 1000';
      }
      
      if (set.reps && (set.reps < 0 || set.reps > 1000)) {
        errors[`sets.${index}.reps`] = 'Reps must be between 0 and 1000';
      }
    });
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
```

### 2. Performance Optimization

```javascript
// Request deduplication
class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }

  async request(key, requestFn) {
    if (this.pendingRequests.has(key)) {
      // Return existing promise
      return this.pendingRequests.get(key);
    }

    const promise = requestFn().finally(() => {
      // Clean up after request completes
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}

const deduplicator = new RequestDeduplicator();

// Usage
const getExercise = (id) => {
  return deduplicator.request(`exercise:${id}`, () =>
    fetch(`/api/exercises/${id}`).then(res => res.json())
  );
};

// Batch requests
class RequestBatcher {
  constructor(batchFn, delay = 50) {
    this.batchFn = batchFn;
    this.delay = delay;
    this.queue = [];
    this.timer = null;
  }

  add(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      
      if (this.timer) {
        clearTimeout(this.timer);
      }
      
      this.timer = setTimeout(() => {
        this.processBatch();
      }, this.delay);
    });
  }

  async processBatch() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    try {
      const results = await this.batchFn(batch.map(b => b.item));
      
      batch.forEach((b, index) => {
        b.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(b => b.reject(error));
    }
  }
}

// Batch exercise fetches
const exerciseBatcher = new RequestBatcher(async (exerciseIds) => {
  const response = await fetch('/api/exercises/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ ids: exerciseIds })
  });
  
  const result = await response.json();
  return result.data;
});

// Usage
const exercise1 = await exerciseBatcher.add('exercise_1');
const exercise2 = await exerciseBatcher.add('exercise_2');
```

### 3. Data Caching Strategy

```javascript
class ApiCache {
  constructor(ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, data, customTtl) {
    const expiry = Date.now() + (customTtl || this.ttl);
    this.cache.set(key, { data, expiry });
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  invalidate(pattern) {
    if (typeof pattern === 'string') {
      this.cache.delete(pattern);
    } else if (pattern instanceof RegExp) {
      for (const key of this.cache.keys()) {
        if (pattern.test(key)) {
          this.cache.delete(key);
        }
      }
    }
  }

  clear() {
    this.cache.clear();
  }
}

const apiCache = new ApiCache();

// Cached API wrapper
const cachedFetch = async (url, options = {}, cacheKey, ttl) => {
  if (options.method && options.method !== 'GET') {
    // Don't cache non-GET requests
    return fetch(url, options);
  }

  const key = cacheKey || `${url}:${JSON.stringify(options)}`;
  const cached = apiCache.get(key);
  
  if (cached) {
    return {
      json: () => Promise.resolve(cached),
      ok: true,
      status: 200
    };
  }

  const response = await fetch(url, options);
  
  if (response.ok) {
    const data = await response.json();
    apiCache.set(key, data, ttl);
    
    return {
      json: () => Promise.resolve(data),
      ok: true,
      status: 200
    };
  }

  return response;
};
```

This comprehensive integration guide provides developers with everything they need to successfully integrate with the Fitness Tracking API, from basic authentication to advanced features like voice integration and LLM-powered workout generation.