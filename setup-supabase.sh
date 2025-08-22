#!/bin/bash

# Supabase Setup Script for Fitness Tracker
# This script sets up your Supabase database with all required schemas

echo "🚀 Fitness Tracker - Supabase Setup"
echo "====================================="
echo ""

# Check if required tools are installed
command -v npx >/dev/null 2>&1 || { echo "❌ npx is required but not installed. Install Node.js first."; exit 1; }

# Supabase credentials
SUPABASE_URL="https://hvcsabqpstetwqvwrwqu.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2Y3NhYnFwc3RldHdxdndyd3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MjIwOTIsImV4cCI6MjA3MTM5ODA5Mn0.iOSp8pRT5NHZkPBD2FILphUUhalRDjB5gTyO1UY9jVw"

echo "📋 Configuration:"
echo "  URL: $SUPABASE_URL"
echo "  Project: hvcsabqpstetwqvwrwqu"
echo ""

# Create a temporary SQL file combining all schemas
echo "📝 Creating combined schema file..."
cat > /tmp/fitness-tracker-schema.sql << 'EOF'
-- Combined Schema for Fitness Tracker
-- Run this in your Supabase SQL Editor

EOF

# Append all schema files
if [ -f "src/supabase/schema.sql" ]; then
    echo "-- Main Database Schema" >> /tmp/fitness-tracker-schema.sql
    cat src/supabase/schema.sql >> /tmp/fitness-tracker-schema.sql
    echo "" >> /tmp/fitness-tracker-schema.sql
fi

if [ -f "src/supabase/storage-setup.sql" ]; then
    echo "-- Storage Configuration" >> /tmp/fitness-tracker-schema.sql
    cat src/supabase/storage-setup.sql >> /tmp/fitness-tracker-schema.sql
    echo "" >> /tmp/fitness-tracker-schema.sql
fi

if [ -f "src/docs/llm-schema.sql" ]; then
    echo "-- LLM Safety Schema" >> /tmp/fitness-tracker-schema.sql
    cat src/docs/llm-schema.sql >> /tmp/fitness-tracker-schema.sql
    echo "" >> /tmp/fitness-tracker-schema.sql
fi

echo "✅ Combined schema created at: /tmp/fitness-tracker-schema.sql"
echo ""

echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Go to your Supabase Dashboard:"
echo "   $SUPABASE_URL"
echo ""
echo "2. Navigate to SQL Editor"
echo ""
echo "3. Copy and paste the contents of:"
echo "   /tmp/fitness-tracker-schema.sql"
echo ""
echo "4. Click 'Run' to execute the schema"
echo ""
echo "5. Set up Edge Functions environment variables:"
echo "   - Go to Edge Functions → Settings"
echo "   - Add OPENAI_API_KEY with your OpenAI key"
echo ""
echo "6. Deploy Edge Functions (if you have Supabase CLI):"
echo "   supabase link --project-ref hvcsabqpstetwqvwrwqu"
echo "   supabase functions deploy --all"
echo ""
echo "7. Start the frontend:"
echo "   cd src/frontend"
echo "   npm install"
echo "   npm run dev"
echo ""

# Try to open the schema file for easy copying
if command -v code >/dev/null 2>&1; then
    echo "📂 Opening schema file in VS Code..."
    code /tmp/fitness-tracker-schema.sql
elif command -v open >/dev/null 2>&1; then
    echo "📂 Opening schema file..."
    open -e /tmp/fitness-tracker-schema.sql
else
    echo "📄 Schema file location: /tmp/fitness-tracker-schema.sql"
fi

echo ""
echo "🔗 Quick Links:"
echo "  Dashboard: $SUPABASE_URL"
echo "  SQL Editor: $SUPABASE_URL/project/hvcsabqpstetwqvwrwqu/editor"
echo "  Auth Settings: $SUPABASE_URL/project/hvcsabqpstetwqvwrwqu/auth/users"
echo "  Storage: $SUPABASE_URL/project/hvcsabqpstetwqvwrwqu/storage/buckets"
echo ""
echo "✨ Setup script complete!"