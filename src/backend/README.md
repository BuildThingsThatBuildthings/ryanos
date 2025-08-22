# Fitness Tracker Backend API

A comprehensive Express.js/Node.js backend API for fitness tracking with voice integration, LLM-powered workout generation, and detailed analytics.

## Features

- **User Authentication & Management**: JWT-based auth with refresh tokens
- **Voice Integration**: Session and event tracking for voice-driven workouts
- **LLM-Powered Workouts**: AI-generated workout plans based on user preferences
- **Exercise Library**: Comprehensive exercise database with custom exercise creation
- **Set Tracking**: Detailed workout set logging with RPE, weight, reps tracking
- **Analytics**: 7-day training summaries with pattern analysis and insights
- **Security**: Rate limiting, input validation, SQL injection protection
- **Logging**: Comprehensive logging with Winston and request tracking

## Tech Stack

- **Framework**: Express.js
- **Database**: PostgreSQL with Knex.js ORM
- **Authentication**: JWT with bcrypt password hashing
- **Validation**: Zod schema validation
- **Logging**: Winston with daily file rotation
- **Security**: Helmet, CORS, rate limiting
- **AI Integration**: OpenAI GPT-4 for workout generation

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get user profile
- `PATCH /api/v1/auth/me` - Update user profile

### Voice Integration
- `POST /api/v1/voice/sessions` - Create voice session → {voice_session_id}
- `POST /api/v1/voice/events` - Log voice event → {intent, payload, transcript, ts}
- `GET /api/v1/voice/sessions` - Get user's voice sessions
- `GET /api/v1/voice/sessions/:id` - Get session with events
- `PATCH /api/v1/voice/sessions/:id/end` - End voice session

### Workouts
- `POST /api/v1/workouts` - Create manual workout
- `POST /api/v1/workouts/generate` - Generate LLM workout plan
- `GET /api/v1/workouts` - Get workouts with filtering/pagination
- `GET /api/v1/workouts/:id` - Get workout with sets
- `PATCH /api/v1/workouts/:id` - Update workout
- `DELETE /api/v1/workouts/:id` - Delete workout

### Sets
- `POST /api/v1/sets` - Create workout set → {workout_id, exercise_id, reps, weight_kg, rpe, ...}
- `GET /api/v1/sets/workout/:workoutId` - Get all sets for a workout
- `GET /api/v1/sets/:id` - Get set details
- `PATCH /api/v1/sets/:id` - Edit set → supports all set properties
- `DELETE /api/v1/sets/:id` - Delete set
- `PATCH /api/v1/sets/:id/start` - Start set timer

### Exercises
- `GET /api/v1/exercises` - Get active exercise library with filtering
- `GET /api/v1/exercises/:id` - Get exercise details with usage stats
- `POST /api/v1/exercises` - Create custom exercise (authenticated)
- `PATCH /api/v1/exercises/:id` - Update custom exercise
- `DELETE /api/v1/exercises/:id` - Delete custom exercise
- `POST /api/v1/exercises/suggest` - Get LLM exercise suggestions
- `GET /api/v1/exercises/meta/categories` - Get exercise categories
- `GET /api/v1/exercises/meta/muscle-groups` - Get muscle groups

### Analytics
- `GET /api/v1/summary/7d` → Training load by pattern/muscle + flags
  - Query params: `days`, `includePatterns`, `includeMuscleGroups`, `includeFlags`
  - Returns comprehensive 7-day training analysis with:
    - Daily breakdown and metrics
    - Training load calculations
    - Volume analysis by exercise/muscle group
    - Pattern recognition (frequency, consistency, progression)
    - Intelligent flags and recommendations

## Database Schema

### Users
- User profiles with authentication data
- Physical metrics (height, weight)
- Preferences (timezone, units)

### Voice Sessions & Events
- Voice interaction tracking
- Intent classification and payload storage
- Session lifecycle management

### Exercises
- Comprehensive exercise library
- Custom exercise creation
- Muscle group and equipment tagging

### Workouts
- Workout planning and tracking
- LLM generation parameter storage
- Status tracking (planned, in progress, completed)

### Sets
- Detailed set logging (reps, weight, RPE, etc.)
- Performance metrics and timing
- Additional metrics support (heart rate, etc.)

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd src/backend
   npm install
   ```

2. **Database setup**:
   ```bash
   # Create PostgreSQL database
   createdb fitness_tracker
   
   # Copy environment file
   cp .env.example .env
   
   # Edit .env with your database credentials and API keys
   ```

3. **Environment Configuration**:
   ```bash
   # Required environment variables
   NODE_ENV=development
   PORT=3001
   
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=fitness_tracker
   DB_USER=postgres
   DB_PASSWORD=your_password
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=24h
   
   # OpenAI (for LLM features)
   OPENAI_API_KEY=your-openai-api-key
   
   # CORS
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Database Migration & Seeding**:
   ```bash
   # Run migrations
   npm run migrate
   
   # Seed exercise database
   npm run seed
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`

## API Usage Examples

### Create LLM-Generated Workout
```javascript
POST /api/v1/workouts/generate
{
  "date": "2024-01-15",
  "timeCapMin": 45,
  "focus": "push",
  "exclusions": ["lower back"],
  "workoutType": "strength",
  "difficultyLevel": "intermediate",
  "equipment": ["barbell", "dumbbells", "bench"],
  "goals": ["muscle building", "strength"]
}
```

### Log Workout Set
```javascript
POST /api/v1/sets
{
  "workoutId": "workout-uuid",
  "exerciseId": "exercise-uuid",
  "setNumber": 1,
  "reps": 8,
  "weightKg": 80.5,
  "rpe": 7.5,
  "restSeconds": 120,
  "notes": "Felt strong today"
}
```

### Voice Event Logging
```javascript
POST /api/v1/voice/events
{
  "sessionId": "session-uuid",
  "intent": "set_complete",
  "payload": {
    "exercise": "bench press",
    "reps": 8,
    "weight": "80 kilos",
    "rpe": 7
  },
  "transcript": "I just completed 8 reps of bench press at 80 kilos, RPE 7",
  "confidenceScore": 0.95
}
```

### Get Training Summary
```javascript
GET /api/v1/summary/7d?days=7&includePatterns=true&includeMuscleGroups=true&includeFlags=true

Response:
{
  "summary": {
    "overview": {
      "totalWorkouts": 4,
      "completedWorkouts": 3,
      "totalSets": 45,
      "totalVolumeKg": 2840,
      "averageRpe": "7.2"
    },
    "trainingLoad": {
      "rpeBasedLoad": 324,
      "volumeBasedLoad": 2840,
      "composite": 287
    },
    "patterns": {
      "frequency": {
        "averageDaysBetween": "2.0",
        "pattern": "every_other_day"
      },
      "progression": [...],
      "consistency": {
        "score": "75.0",
        "level": "good"
      }
    },
    "flags": [
      {
        "type": "info",
        "category": "balance",
        "message": "High focus on chest detected",
        "suggestion": "Consider balancing with back exercises"
      }
    ]
  }
}
```

## Security Features

- **Authentication**: JWT with secure refresh token rotation
- **Authorization**: Resource ownership validation
- **Rate Limiting**: Per-IP and per-user limits
- **Input Validation**: Comprehensive Zod schema validation
- **SQL Injection Protection**: Parameterized queries with Knex.js
- **CORS**: Configurable cross-origin policies
- **Security Headers**: Helmet.js security headers
- **Password Security**: Bcrypt with high salt rounds

## Production Deployment

### Environment Setup
- Set `NODE_ENV=production`
- Use strong JWT secrets
- Configure production database
- Set up SSL/HTTPS
- Configure proper CORS origins
- Set up log rotation

### Database
- Use connection pooling
- Set up read replicas if needed
- Configure backup strategy
- Monitor query performance

### Monitoring
- Application logs with Winston
- Request/response logging
- Error tracking and alerting
- Performance monitoring

## Contributing

1. Follow the existing code style and patterns
2. Add comprehensive tests for new features
3. Update API documentation
4. Ensure all validations are in place
5. Add proper error handling and logging

## License

MIT License - see LICENSE file for details