# LLM Workout Generation System

## Overview

The LLM Workout Generation System provides AI-powered workout creation with strict safety constraints and library-only exercise validation. This system ensures all generated workouts are safe, personalized, and use only approved exercises from our curated library.

## Key Features

### 🛡️ Safety-First Design
- **Library-Only Exercises**: Only uses pre-approved exercises with safety ratings ≥3/5
- **Strict Safety Constraints**: Hard limits on sets, reps, duration, and intensity
- **Medical Contraindication Checking**: Validates against user injury history and medical conditions
- **Real-time Safety Validation**: Every generated workout is validated before delivery
- **Progressive Overload Limits**: Prevents dangerous progression rates

### 🎯 Personalization
- **User Profile Integration**: Considers fitness level, injury history, and goals
- **Workout History Analysis**: Avoids repetition and ensures progressive overload
- **Equipment-Based Filtering**: Only suggests exercises for available equipment
- **Experience-Level Scaling**: Adjusts complexity and intensity based on user level

### 📊 Monitoring & Compliance
- **Generation Logging**: Tracks all workout generation attempts with success/failure rates
- **Safety Validation Logging**: Records all safety checks and violations
- **Performance Monitoring**: Tracks LLM token usage, costs, and response times
- **Audit Trail**: Complete traceability for compliance and debugging

## API Endpoints

### 1. LLM Workout Generation
**POST** `/functions/v1/llm-workout`

Generates personalized, safe workouts using OpenAI's GPT-4.

#### Request Body
```json
{
  \"constraints\": {
    \"duration_minutes\": 45,
    \"difficulty_level\": 3,
    \"equipment_available\": [\"bodyweight\", \"dumbbell\"],
    \"muscle_groups_focus\": [\"chest\", \"triceps\"],
    \"limitations\": [\"lower_back_injury\"],
    \"goals\": [\"strength_building\"]
  },
  \"preferences\": {
    \"workout_style\": \"strength_training\",
    \"intensity_preference\": \"moderate\",
    \"focus_areas\": [\"upper_body\"],
    \"avoid_exercises\": [\"overhead_press\"],
    \"injury_history\": [\"shoulder_injury\"],
    \"experience_level\": \"intermediate\"
  },
  \"safety_override\": false
}
```

#### Response
```json
{
  \"success\": true,
  \"data\": {
    \"id\": \"workout_1234567890_abc\",
    \"title\": \"Intermediate Upper Body Strength\",
    \"description\": \"A safe, balanced upper body workout\",
    \"duration_minutes\": 45,
    \"difficulty_level\": 3,
    \"exercises\": [
      {
        \"id\": \"exercise_push_up\",
        \"name\": \"Push-up\",
        \"category\": \"strength\",
        \"muscle_groups\": [\"chest\", \"triceps\", \"shoulders\"],
        \"sets\": 3,
        \"reps\": 12,
        \"rest_seconds\": 90,
        \"intensity\": 3,
        \"instructions\": \"Detailed execution instructions\",
        \"modifications\": [\"knee push-up\", \"incline push-up\"],
        \"equipment\": [\"bodyweight\"],
        \"safety_notes\": \"Stop if wrist pain occurs\"
      }
    ],
    \"equipment_needed\": [\"bodyweight\", \"dumbbell\"],
    \"calories_estimate\": 280,
    \"tags\": [\"safe\", \"library\", \"personalized\"],
    \"warm_up\": {
      \"duration_minutes\": 8,
      \"exercises\": [\"arm_circles\", \"shoulder_rolls\"]
    },
    \"cool_down\": {
      \"duration_minutes\": 7,
      \"exercises\": [\"chest_stretch\", \"tricep_stretch\"]
    },
    \"safety_notes\": [\"Maintain proper form throughout\", \"Stop if pain occurs\"],
    \"generated_by\": \"llm\",
    \"created_at\": \"2024-01-15T10:30:00Z\"
  }
}
```

### 2. Safety Validation
**POST** `/functions/v1/llm-safety`

Validates workout safety against user profile and medical constraints.

#### Request Body
```json
{
  \"validation_type\": \"workout\",
  \"workout_plan\": {
    \"exercises\": [...],
    \"duration_minutes\": 45,
    \"difficulty_level\": 3
  },
  \"user_context\": {
    \"injury_history\": [\"lower_back\"],
    \"limitations\": [\"no_overhead_movements\"],
    \"experience_level\": \"intermediate\",
    \"age\": 35,
    \"medical_conditions\": []
  }
}
```

#### Response
```json
{
  \"success\": true,
  \"data\": {
    \"is_safe\": true,
    \"risk_level\": \"low\",
    \"safety_score\": 85,
    \"violations\": [],
    \"recommendations\": [
      \"Include proper warm-up\",
      \"Focus on form over intensity\"
    ],
    \"modifications\": [],
    \"contraindications\": []
  }
}
```

## Safety Constraints

### Hard Limits (Cannot be overridden)
- **Max Duration**: 120 minutes (2 hours)
- **Max Sets per Exercise**: 6
- **Max Reps per Set**: 30
- **Max Weight Progression**: 20% increase from previous
- **Required Rest Periods**: 
  - Strength: 60s minimum
  - Power: 120s minimum
  - Endurance: 30s minimum
- **Exercise Blacklist**: High-risk exercises requiring supervision

### Experience-Based Limits
| Level | Max Intensity | Max Sets/Session | Max Sets/Muscle/Week |
|-------|--------------|------------------|----------------------|
| Beginner | 3/5 | 16 | 10 |
| Intermediate | 4/5 | 20 | 16 |
| Advanced | 5/5 | 25 | 22 |

### Medical Contraindications
- **Hypertension**: No high-intensity cardio, avoid valsalva exercises
- **Diabetes**: No long fasting workouts, monitor blood sugar
- **Pregnancy**: No supine exercises after first trimester
- **Cardiac Issues**: Heart rate monitoring required
- **Osteoporosis**: Avoid spinal flexion, high-impact movements

## Exercise Library

### Curation Process
1. **Submission**: Exercises submitted by certified trainers
2. **Safety Review**: Independent safety assessment by exercise physiologists  
3. **Rating Assignment**: Safety rating (1-5) and difficulty level (1-5)
4. **Contraindication Mapping**: Identify injury/medical contraindications
5. **Approval**: Final approval by medical advisory board

### Safety Ratings
- **5/5**: Extremely safe, suitable for all populations
- **4/5**: Safe with proper form, minimal injury risk
- **3/5**: Moderate risk, requires experience/supervision
- **2/5**: High risk, advanced users only
- **1/5**: Very high risk, not approved for LLM generation

### Exercise Categories
- **Strength**: Resistance training exercises
- **Cardio**: Cardiovascular conditioning  
- **Flexibility**: Stretching and mobility
- **Balance**: Stability and proprioception
- **Mobility**: Joint range of motion
- **Plyometric**: Explosive movement training

## Implementation Details

### Database Schema
The system uses several interconnected tables:

- **`exercises`**: Curated exercise library with safety metadata
- **`user_profiles`**: Extended user profiles with medical/fitness data
- **`workout_plans`**: Generated workouts with safety validation
- **`workout_generation_logs`**: Audit trail of all generation attempts
- **`safety_validation_logs`**: Record of all safety checks
- **`workout_sessions`**: Actual workout performance tracking

### LLM Integration
- **Model**: OpenAI GPT-4 for optimal reasoning about exercise safety
- **Temperature**: 0.7 for balanced creativity and consistency
- **Max Tokens**: 2500 for detailed workout plans
- **Response Format**: Enforced JSON structure for consistency
- **Fallback**: Template-based generation if LLM fails

### Error Handling
1. **LLM Failures**: Automatic fallback to rule-based generation
2. **Safety Violations**: Block unsafe workouts, provide modifications
3. **API Errors**: Graceful degradation with user feedback
4. **Rate Limiting**: Queue requests during high usage
5. **Monitoring**: Real-time alerts for system issues

## Usage Examples

### Frontend Integration
```javascript
// Generate a safe workout
const generateWorkout = async (constraints, preferences) => {
  const response = await fetch('/functions/v1/llm-workout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ constraints, preferences })
  });
  
  if (!response.ok) {
    throw new Error('Workout generation failed');
  }
  
  return await response.json();
};

// Validate workout safety
const validateSafety = async (workout, userContext) => {
  const response = await fetch('/functions/v1/llm-safety', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      validation_type: 'workout',
      workout_plan: workout,
      user_context: userContext
    })
  });
  
  return await response.json();
};
```

### CLI Testing
```bash
# Generate workout
curl -X POST 'https://your-project.supabase.co/functions/v1/llm-workout' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    \"constraints\": {
      \"duration_minutes\": 30,
      \"difficulty_level\": 2,
      \"equipment_available\": [\"bodyweight\"]
    }
  }'

# Validate safety
curl -X POST 'https://your-project.supabase.co/functions/v1/llm-safety' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    \"validation_type\": \"exercise\",
    \"exercise_suggestion\": {
      \"id\": \"exercise_burpee\",
      \"name\": \"Burpee\"
    }
  }'
```

## Monitoring and Analytics

### Key Metrics
- **Generation Success Rate**: % of successful workout generations
- **Safety Score Distribution**: Average safety scores of generated workouts
- **User Satisfaction**: Ratings of generated workouts
- **API Performance**: Response times and error rates
- **Cost Tracking**: LLM token usage and associated costs

### Dashboards
- **Operational Dashboard**: Real-time system health and performance
- **Safety Dashboard**: Safety violation trends and risk assessments  
- **User Dashboard**: Workout generation patterns and preferences
- **Cost Dashboard**: LLM usage costs and optimization opportunities

### Alerting
- **Safety Violations**: Immediate alerts for critical safety issues
- **System Errors**: API failures and degraded performance
- **Usage Spikes**: Unexpected increases in generation requests
- **Cost Thresholds**: LLM usage approaching budget limits

## Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional
LLM_MODEL=gpt-4  # Default: gpt-4
LLM_TEMPERATURE=0.7  # Default: 0.7
MAX_GENERATION_RETRIES=3  # Default: 3
SAFETY_OVERRIDE_ENABLED=false  # Default: false
```

### Safety Configuration
The safety constraints are hardcoded in `/src/supabase/functions/llm-workout/index.ts` and cannot be overridden without code changes. This ensures consistent safety standards.

## Testing

### Unit Tests
```bash
# Test safety validation
npm test -- --grep \"safety validation\"

# Test workout generation
npm test -- --grep \"workout generation\"

# Test exercise library filtering
npm test -- --grep \"exercise library\"
```

### Integration Tests
```bash
# Test full workflow
npm run test:integration

# Test with real LLM calls (requires API key)
npm run test:integration:llm
```

### Load Testing
```bash
# Test concurrent workout generation
npm run test:load
```

## Deployment

### Prerequisites
1. Supabase project with database schema deployed
2. OpenAI API key with GPT-4 access
3. Exercise library populated with approved exercises
4. User profiles table with safety information

### Deployment Steps
```bash
# Deploy schema
supabase db push

# Deploy Edge Functions
supabase functions deploy llm-workout
supabase functions deploy llm-safety

# Set environment variables
supabase secrets set OPENAI_API_KEY=sk-...

# Verify deployment
curl -X POST 'https://your-project.supabase.co/functions/v1/llm-workout' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{\"constraints\":{\"duration_minutes\":30,\"difficulty_level\":1,\"equipment_available\":[\"bodyweight\"]}}'
```

## Compliance and Legal

### Data Privacy
- **User Data**: All personal and medical data encrypted at rest
- **Audit Logs**: Complete audit trail for compliance requirements
- **Data Retention**: Configurable retention periods for different data types
- **GDPR Compliance**: Right to deletion and data export supported

### Medical Disclaimers
⚠️ **Important**: This system provides fitness suggestions only and is not medical advice. Users should:
- Consult healthcare providers before starting any exercise program
- Stop immediately if experiencing pain or discomfort
- Seek medical attention for any exercise-related injuries

### Liability
- System provides safety guidelines but cannot eliminate all injury risk
- Users assume responsibility for following safety recommendations
- Professional supervision recommended for high-risk populations

## Troubleshooting

### Common Issues

**Issue**: Workout generation fails with \"No safe exercises found\"
**Solution**: Check that exercise library has approved exercises for the requested equipment/muscle groups

**Issue**: Safety validation blocks all workouts
**Solution**: Review user profile injury history and medical conditions for overly restrictive contraindications  

**Issue**: LLM responses are inconsistent
**Solution**: Verify prompt engineering and consider adjusting temperature parameter

**Issue**: High API costs
**Solution**: Implement caching for similar requests and optimize prompt length

### Debug Mode
Set `DEBUG=true` environment variable to enable detailed logging of:
- LLM prompts and responses
- Safety validation decisions
- Exercise filtering logic
- Performance timing

## Contributing

### Adding New Exercises
1. Follow exercise submission workflow
2. Include comprehensive safety assessment
3. Provide contraindication mapping
4. Submit for medical review
5. Update exercise library documentation

### Improving Safety Logic
1. Analyze safety violation logs for patterns
2. Propose evidence-based safety rule updates
3. Test changes thoroughly with edge cases
4. Update documentation and tests
5. Deploy with monitoring

### Performance Optimization
1. Profile LLM prompt efficiency
2. Optimize database queries
3. Implement intelligent caching
4. Monitor and alert on regressions
5. Document performance improvements

---

## Support

For technical issues or questions:
- **Email**: dev-team@yourcompany.com  
- **Slack**: #fitness-ai-support
- **Documentation**: Internal wiki at wiki.yourcompany.com/fitness-ai
- **Emergency**: Page on-call engineer for production issues

**Last Updated**: January 2024
**Version**: 1.0.0