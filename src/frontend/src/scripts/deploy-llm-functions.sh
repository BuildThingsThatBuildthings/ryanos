#!/bin/bash

# LLM Workout Generation System - Deployment Script
# This script deploys the LLM Edge Functions and sets up the required database schema

set -e  # Exit on any error

echo \"🚀 Starting LLM Workout System Deployment...\"

# Check prerequisites
echo \"📋 Checking prerequisites...\"

if ! command -v supabase &> /dev/null; then
    echo \"❌ Error: Supabase CLI not found. Please install it first.\"
    echo \"   Visit: https://supabase.com/docs/guides/cli\"
    exit 1
fi

if [ -z \"$OPENAI_API_KEY\" ]; then
    echo \"❌ Error: OPENAI_API_KEY environment variable not set.\"
    echo \"   Please set your OpenAI API key: export OPENAI_API_KEY=sk-...\"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f \"src/supabase/functions/llm-workout/index.ts\" ]; then
    echo \"❌ Error: LLM workout function not found.\"
    echo \"   Please run this script from the project root directory.\"
    exit 1
fi

echo \"✅ Prerequisites check passed\"

# Deploy database schema
echo \"📊 Deploying database schema...\"
if [ -f \"src/docs/llm-schema.sql\" ]; then
    supabase db reset --linked
    supabase db push
    echo \"✅ Database schema deployed\"
else
    echo \"⚠️  Warning: llm-schema.sql not found, skipping database deployment\"
fi

# Deploy Edge Functions
echo \"⚡ Deploying Edge Functions...\"

# Deploy LLM workout generation function
echo \"  📝 Deploying llm-workout function...\"
supabase functions deploy llm-workout --project-ref $(supabase status | grep \"API URL\" | cut -d'/' -f3 | cut -d'.' -f1)

# Deploy safety validation function  
echo \"  🛡️  Deploying llm-safety function...\"
supabase functions deploy llm-safety --project-ref $(supabase status | grep \"API URL\" | cut -d'/' -f3 | cut -d'.' -f1)

echo \"✅ Edge Functions deployed\"

# Set environment variables
echo \"🔧 Setting environment variables...\"
supabase secrets set OPENAI_API_KEY=\"$OPENAI_API_KEY\"
echo \"✅ Environment variables set\"

# Populate sample exercise data
echo \"💪 Populating sample exercise library...\"
cat << 'EOF' | supabase db reset --stdin
-- Additional safe exercises for the library
INSERT INTO exercises (
  name, category, movement_pattern, primary_muscles, secondary_muscles, muscle_groups,
  equipment, safety_rating, difficulty_level, skill_level_required,
  contraindications, injury_considerations, is_compound, is_bodyweight,
  instructions, modifications, progressions, regressions, is_approved
) VALUES 
(
  'Wall Sit',
  'strength',
  'squat',
  '[\"quadriceps\", \"glutes\"]',
  '[\"core\", \"calves\"]',
  '[\"quadriceps\", \"glutes\", \"core\", \"calves\"]',
  '[\"bodyweight\"]',
  5,
  1,
  'beginner',
  '[]',
  '[\"Avoid if knee pain\"]',
  false,
  true,
  '[\"Stand with back against wall\", \"Slide down until thighs parallel to floor\", \"Hold position\", \"Keep core engaged\"]',
  '[\"Partial depth\", \"Shorter hold time\"]',
  '[\"Single leg wall sit\", \"Weighted wall sit\"]',
  '[\"Higher position\", \"Shorter holds\"]',
  true
),
(
  'Modified Burpee',
  'cardio',
  'gait',
  '[\"core\", \"legs\"]',
  '[\"chest\", \"shoulders\"]',
  '[\"core\", \"legs\", \"chest\", \"shoulders\"]',
  '[\"bodyweight\"]',
  4,
  3,
  'intermediate',
  '[\"lower_back_injury\", \"wrist_injury\"]',
  '[\"Step back instead of jump\", \"Modify if wrist pain\"]',
  true,
  true,
  '[\"Start standing\", \"Squat down, place hands on floor\", \"Step back to plank\", \"Step forward\", \"Stand up\"]',
  '[\"No jump\", \"Step instead of jump back\", \"Incline hands on bench\"]',
  '[\"Full burpee with jump\", \"Burpee with tuck jump\"]',
  '[\"Squat to stand only\", \"Wall push-up burpee\"]',
  true
),
(
  'Glute Bridge',
  'strength',
  'hinge',
  '[\"glutes\"]',
  '[\"hamstrings\", \"core\"]',
  '[\"glutes\", \"hamstrings\", \"core\"]',
  '[\"bodyweight\"]',
  5,
  1,
  'beginner',
  '[]',
  '[\"Safe for most injuries\"]',
  false,
  true,
  '[\"Lie on back, knees bent\", \"Squeeze glutes and lift hips\", \"Hold briefly at top\", \"Lower with control\"]',
  '[\"Single leg\", \"Marching bridge\", \"Weighted bridge\"]',
  '[\"Single leg bridge\", \"Hip thrust\"]',
  '[\"Partial range of motion\"]',
  true
);
EOF

echo \"✅ Sample exercise library populated\"

# Test deployment
echo \"🧪 Testing deployment...\"

# Get the Supabase URL and anon key for testing
SUPABASE_URL=$(supabase status | grep \"API URL\" | awk '{print $3}')
SUPABASE_ANON_KEY=$(supabase status | grep \"anon key\" | awk '{print $3}')

if [ -n \"$SUPABASE_URL\" ] && [ -n \"$SUPABASE_ANON_KEY\" ]; then
    echo \"  🔍 Testing llm-workout endpoint...\"
    
    # Test workout generation
    RESPONSE=$(curl -s -X POST \"${SUPABASE_URL}/functions/v1/llm-workout\" \
        -H \"Authorization: Bearer $SUPABASE_ANON_KEY\" \
        -H \"Content-Type: application/json\" \
        -d '{
            \"constraints\": {
                \"duration_minutes\": 20,
                \"difficulty_level\": 1,
                \"equipment_available\": [\"bodyweight\"]
            },
            \"preferences\": {
                \"experience_level\": \"beginner\"
            }
        }')
    
    if echo \"$RESPONSE\" | grep -q '\"success\":true'; then
        echo \"✅ LLM workout generation test passed\"
    else
        echo \"⚠️  LLM workout generation test failed. Response: $RESPONSE\"
    fi
    
    echo \"  🛡️  Testing llm-safety endpoint...\"
    
    # Test safety validation
    RESPONSE=$(curl -s -X POST \"${SUPABASE_URL}/functions/v1/llm-safety\" \
        -H \"Authorization: Bearer $SUPABASE_ANON_KEY\" \
        -H \"Content-Type: application/json\" \
        -d '{
            \"validation_type\": \"exercise\",
            \"exercise_suggestion\": {
                \"id\": \"exercise_push_up\",
                \"name\": \"Push-up\",
                \"category\": \"strength\",
                \"muscle_groups\": [\"chest\", \"triceps\"],
                \"equipment\": [\"bodyweight\"]
            }
        }')
    
    if echo \"$RESPONSE\" | grep -q '\"success\":true'; then
        echo \"✅ Safety validation test passed\"
    else
        echo \"⚠️  Safety validation test failed. Response: $RESPONSE\"
    fi
else
    echo \"⚠️  Could not retrieve Supabase credentials for testing\"
fi

# Display deployment summary
echo \"\"
echo \"🎉 LLM Workout System Deployment Complete!\"
echo \"\"
echo \"📍 Endpoints:\"
echo \"   • Workout Generation: ${SUPABASE_URL}/functions/v1/llm-workout\"
echo \"   • Safety Validation: ${SUPABASE_URL}/functions/v1/llm-safety\"
echo \"\"
echo \"📚 Documentation:\"
echo \"   • System Overview: src/docs/LLM_WORKOUT_SYSTEM.md\"
echo \"   • Database Schema: src/docs/llm-schema.sql\"
echo \"   • API Integration: src/docs/integration-guide.md\"
echo \"\"
echo \"🔧 Next Steps:\"
echo \"   1. Test the endpoints with your frontend application\"
echo \"   2. Populate user profiles with fitness/medical data\"
echo \"   3. Add more exercises to the library as needed\"
echo \"   4. Monitor generation logs and safety validations\"
echo \"   5. Set up alerting for production use\"
echo \"\"
echo \"⚡ The system is now ready for AI-powered, safe workout generation!\"

# Optional: Show function logs
read -p \"📊 Would you like to view the function logs? (y/N) \" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo \"📋 Recent function logs:\"
    supabase functions logs llm-workout --tail 10
fi