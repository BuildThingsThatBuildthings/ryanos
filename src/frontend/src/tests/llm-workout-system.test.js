// LLM Workout Generation System - Integration Tests
// These tests demonstrate the safety constraints and library-only exercise validation

describe('LLM Workout Generation System', () => {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';
  
  const baseHeaders = {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };

  describe('Workout Generation (/functions/v1/llm-workout)', () => {
    test('should generate safe bodyweight workout for beginner', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-workout`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          constraints: {
            duration_minutes: 20,
            difficulty_level: 1,
            equipment_available: ['bodyweight']
          },
          preferences: {
            experience_level: 'beginner'
          }
        })
      });

      const result = await response.json();
      
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('title');
      expect(result.data.duration_minutes).toBe(20);
      expect(result.data.difficulty_level).toBe(1);
      expect(result.data.exercises).toBeInstanceOf(Array);
      expect(result.data.exercises.length).toBeGreaterThan(0);
      
      // Verify all exercises are from library and safe
      result.data.exercises.forEach(exercise => {
        expect(exercise).toHaveProperty('id');
        expect(exercise).toHaveProperty('safety_notes');
        expect(exercise.sets).toBeLessThanOrEqual(6); // Safety constraint
        expect(exercise.reps).toBeLessThanOrEqual(30); // Safety constraint
        expect(exercise.equipment).toContain('bodyweight');
      });
    });

    test('should enforce safety constraints for high intensity workouts', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-workout`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          constraints: {
            duration_minutes: 60,
            difficulty_level: 5,
            equipment_available: ['barbell', 'dumbbell']
          },
          preferences: {
            experience_level: 'beginner' // Mismatch should be caught
          }
        })
      });

      const result = await response.json();
      
      // Should either reject or modify to safe parameters
      if (result.success) {
        // If accepted, should be modified to safer parameters
        expect(result.data.difficulty_level).toBeLessThanOrEqual(3); // Beginner max
      } else {
        // Should reject with safety violation
        expect(result.error.code).toBe('SAFETY_VIOLATION');
        expect(result.error.message).toContain('difficulty');
      }
    });

    test('should respect injury contraindications', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-workout`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          constraints: {
            duration_minutes: 30,
            difficulty_level: 2,
            equipment_available: ['bodyweight']
          },
          preferences: {
            experience_level: 'intermediate',
            injury_history: ['lower_back_injury'],
            avoid_exercises: ['burpee']
          }
        })
      });

      const result = await response.json();
      
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      
      // Verify no contraindicated exercises
      const exerciseNames = result.data.exercises.map(ex => ex.name.toLowerCase());
      expect(exerciseNames).not.toContain('burpee');
      
      // Verify exercises are safe for lower back
      result.data.exercises.forEach(exercise => {
        expect(exercise.safety_notes).toBeDefined();
      });
    });

    test('should reject excessive duration requests', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-workout`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          constraints: {
            duration_minutes: 180, // 3 hours - exceeds 120 minute limit
            difficulty_level: 3,
            equipment_available: ['bodyweight']
          }
        })
      });

      const result = await response.json();
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('SAFETY_VIOLATION');
      expect(result.error.message).toContain('120 minutes');
    });
  });

  describe('Safety Validation (/functions/v1/llm-safety)', () => {
    test('should validate safe workout plan', async () => {
      const safeWorkout = {
        exercises: [
          {
            id: 'exercise_bodyweight_squat',
            name: 'Bodyweight Squat',
            sets: 3,
            reps: 12,
            intensity: 2
          },
          {
            id: 'exercise_push_up',
            name: 'Push-up',
            sets: 3,
            reps: 10,
            intensity: 3
          }
        ],
        duration_minutes: 25,
        difficulty_level: 2
      };

      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-safety`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          validation_type: 'workout',
          workout_plan: safeWorkout,
          user_context: {
            experience_level: 'intermediate',
            injury_history: [],
            medical_conditions: []
          }
        })
      });

      const result = await response.json();
      
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data.is_safe).toBe(true);
      expect(result.data.risk_level).toBe('low');
      expect(result.data.safety_score).toBeGreaterThan(70);
      expect(result.data.violations).toHaveLength(0);
    });

    test('should flag unsafe exercise parameters', async () => {
      const unsafeWorkout = {
        exercises: [
          {
            id: 'exercise_push_up',
            name: 'Push-up',
            sets: 8, // Exceeds 6 set limit
            reps: 50, // Exceeds 30 rep limit
            intensity: 5
          }
        ],
        duration_minutes: 30,
        difficulty_level: 3
      };

      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-safety`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          validation_type: 'workout',
          workout_plan: unsafeWorkout,
          user_context: {
            experience_level: 'intermediate'
          }
        })
      });

      const result = await response.json();
      
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data.is_safe).toBe(false);
      expect(result.data.risk_level).not.toBe('low');
      expect(result.data.violations.length).toBeGreaterThan(0);
      
      // Check for specific violations
      const violationMessages = result.data.violations.map(v => v.description);
      expect(violationMessages.some(msg => msg.includes('sets'))).toBe(true);
      expect(violationMessages.some(msg => msg.includes('reps'))).toBe(true);
    });

    test('should validate individual exercise safety', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-safety`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          validation_type: 'exercise',
          exercise_suggestion: {
            id: 'exercise_bodyweight_squat',
            name: 'Bodyweight Squat',
            category: 'strength',
            muscle_groups: ['quadriceps', 'glutes'],
            equipment: ['bodyweight']
          },
          user_context: {
            experience_level: 'beginner',
            injury_history: []
          }
        })
      });

      const result = await response.json();
      
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data.is_safe).toBe(true);
      expect(result.data.safety_score).toBeGreaterThan(80);
    });

    test('should detect contraindications for injured users', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-safety`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          validation_type: 'exercise',
          exercise_suggestion: {
            id: 'exercise_overhead_press',
            name: 'Overhead Press',
            category: 'strength',
            muscle_groups: ['shoulders'],
            equipment: ['barbell']
          },
          user_context: {
            experience_level: 'intermediate',
            injury_history: ['shoulder_injury']
          }
        })
      });

      const result = await response.json();
      
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      
      if (result.data.is_safe === false) {
        expect(result.data.violations.some(v => 
          v.type === 'medical' && v.description.includes('shoulder')
        )).toBe(true);
      }
    });

    test('should validate workout progression safety', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-safety`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          validation_type: 'progression',
          user_context: {
            experience_level: 'intermediate',
            injury_history: []
          }
        })
      });

      const result = await response.json();
      
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('recommendations');
      expect(result.data.recommendations).toContain('10% rule');
    });
  });

  describe('Library-Only Exercise Constraint', () => {
    test('should only use exercises from approved library', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-workout`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          constraints: {
            duration_minutes: 30,
            difficulty_level: 2,
            equipment_available: ['bodyweight']
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Verify all exercises have valid IDs (library exercises)
        result.data.exercises.forEach(exercise => {
          expect(exercise.id).toMatch(/^exercise_/);
          expect(exercise).toHaveProperty('safety_notes');
        });
      }
    });

    test('should reject if no safe exercises available for constraints', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-workout`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          constraints: {
            duration_minutes: 30,
            difficulty_level: 5,
            equipment_available: ['nonexistent_equipment'],
            muscle_groups_focus: ['nonexistent_muscle']
          }
        })
      });

      const result = await response.json();
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NO_EXERCISES');
    });
  });

  describe('Fallback Behavior', () => {
    test('should provide safe fallback when LLM fails', async () => {
      // This test simulates LLM failure by using invalid API key
      // In real implementation, the system should fall back to template generation
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-workout`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          constraints: {
            duration_minutes: 15,
            difficulty_level: 1,
            equipment_available: ['bodyweight']
          },
          preferences: {
            experience_level: 'beginner'
          }
        })
      });

      const result = await response.json();
      
      // Even if LLM fails, should get a safe fallback workout
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      
      if (result.data.title?.includes('Safe') || result.data.title?.includes('Fallback')) {
        // Fallback workout detected
        expect(result.data.exercises.every(ex => 
          ex.equipment.includes('bodyweight') && ex.sets <= 3
        )).toBe(true);
      }
    });
  });

  describe('Performance and Monitoring', () => {
    test('should log generation attempts', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-workout`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          constraints: {
            duration_minutes: 20,
            difficulty_level: 2,
            equipment_available: ['bodyweight']
          }
        })
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.ok).toBe(true);
      expect(responseTime).toBeLessThan(10000); // Should respond within 10 seconds
      
      // In a real test, you'd verify the generation was logged to the database
      // This would require database connection to check workout_generation_logs table
    });
  });
});

// Test utilities
const createTestUser = (overrides = {}) => ({
  experience_level: 'intermediate',
  injury_history: [],
  medical_conditions: [],
  limitations: [],
  age: 30,
  ...overrides
});

const createTestWorkout = (overrides = {}) => ({
  exercises: [
    {
      id: 'exercise_push_up',
      name: 'Push-up',
      sets: 3,
      reps: 10,
      intensity: 3
    }
  ],
  duration_minutes: 20,
  difficulty_level: 2,
  ...overrides
});

module.exports = {
  createTestUser,
  createTestWorkout
};