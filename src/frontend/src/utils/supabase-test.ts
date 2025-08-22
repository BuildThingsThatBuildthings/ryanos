import { supabase } from '../lib/supabase';

// Supabase connection and functionality test
export const testSupabaseConnection = async () => {
  const results = {
    connection: false,
    auth: false,
    database: false,
    realtime: false,
    storage: false,
    functions: false,
    errors: [] as string[],
  };

  try {
    // Test basic connection
    const { data, error } = await supabase.from('exercises').select('count').limit(1);
    if (error) {
      results.errors.push(`Connection error: ${error.message}`);
    } else {
      results.connection = true;
    }
  } catch (error: any) {
    results.errors.push(`Connection failed: ${error.message}`);
  }

  try {
    // Test auth functionality
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      results.errors.push(`Auth error: ${error.message}`);
    } else {
      results.auth = true;
      console.log('Current session:', session);
    }
  } catch (error: any) {
    results.errors.push(`Auth test failed: ${error.message}`);
  }

  try {
    // Test database read access
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name')
      .limit(1);
    
    if (error) {
      results.errors.push(`Database error: ${error.message}`);
    } else {
      results.database = true;
      console.log('Database test result:', data);
    }
  } catch (error: any) {
    results.errors.push(`Database test failed: ${error.message}`);
  }

  try {
    // Test real-time capabilities
    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'workouts' }, 
        (payload) => console.log('Test real-time payload:', payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          results.realtime = true;
          console.log('Real-time test: SUBSCRIBED');
        } else if (status === 'CHANNEL_ERROR') {
          results.errors.push('Real-time subscription failed');
        }
      });

    // Clean up test channel after 2 seconds
    setTimeout(() => {
      supabase.removeChannel(channel);
    }, 2000);
  } catch (error: any) {
    results.errors.push(`Real-time test failed: ${error.message}`);
  }

  try {
    // Test Edge Functions (if available)
    const { data, error } = await supabase.functions.invoke('health-check', {
      body: { test: true },
    });
    
    if (error && error.message !== 'Function not found') {
      results.errors.push(`Functions error: ${error.message}`);
    } else if (!error) {
      results.functions = true;
      console.log('Functions test result:', data);
    }
  } catch (error: any) {
    // Functions might not be deployed, this is okay
    console.log('Functions test skipped:', error.message);
  }

  return results;
};

// Test specific features
export const testWorkoutOperations = async (userId: string) => {
  const testResults = [];

  try {
    // Test create workout
    const { data: workout, error: createError } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        name: 'Test Workout',
        description: 'Integration test workout',
        date: new Date().toISOString().split('T')[0],
        status: 'planned',
      })
      .select()
      .single();

    if (createError) {
      testResults.push(`Create workout failed: ${createError.message}`);
    } else {
      testResults.push('✓ Create workout successful');

      // Test update workout
      const { error: updateError } = await supabase
        .from('workouts')
        .update({ name: 'Updated Test Workout' })
        .eq('id', workout.id);

      if (updateError) {
        testResults.push(`Update workout failed: ${updateError.message}`);
      } else {
        testResults.push('✓ Update workout successful');
      }

      // Test delete workout
      const { error: deleteError } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workout.id);

      if (deleteError) {
        testResults.push(`Delete workout failed: ${deleteError.message}`);
      } else {
        testResults.push('✓ Delete workout successful');
      }
    }
  } catch (error: any) {
    testResults.push(`Workout operations failed: ${error.message}`);
  }

  return testResults;
};

// Helper to validate environment variables
export const validateSupabaseConfig = () => {
  const config = {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  const errors = [];

  if (!config.url || config.url === 'https://your-project.supabase.co') {
    errors.push('VITE_SUPABASE_URL is not set or using default value');
  }

  if (!config.anonKey || config.anonKey === 'your-anon-key-here') {
    errors.push('VITE_SUPABASE_ANON_KEY is not set or using default value');
  }

  return {
    config,
    errors,
    isValid: errors.length === 0,
  };
};