import { test, expect } from '@playwright/test';

test.describe('Complete Workout Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'user-1',
              email: 'test@example.com',
              name: 'Test User',
            },
            token: 'mock-jwt-token',
            refreshToken: 'mock-refresh-token',
          },
        }),
      });
    });

    await page.route('**/api/workouts', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'workout-1',
                userId: 'user-1',
                name: 'Push Day Workout',
                description: 'Chest, shoulders, and triceps',
                date: new Date().toISOString().split('T')[0],
                status: 'planned',
                sets: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
            hasNext: false,
            hasPrev: false,
          }),
        });
      } else if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'workout-2',
              userId: 'user-1',
              name: 'New Workout',
              status: 'planned',
              sets: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });

    await page.route('**/api/exercises', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'exercise-1',
              name: 'Push-ups',
              category: 'strength',
              movementPattern: 'push',
              primaryMuscles: ['chest', 'shoulders', 'triceps'],
              secondaryMuscles: ['core'],
              equipment: ['bodyweight'],
            },
            {
              id: 'exercise-2',
              name: 'Bench Press',
              category: 'strength',
              movementPattern: 'push',
              primaryMuscles: ['chest'],
              secondaryMuscles: ['shoulders', 'triceps'],
              equipment: ['barbell'],
            },
          ],
        }),
      });
    });

    // Navigate to the app
    await page.goto('/');
  });

  test('should complete full workout creation and execution flow', async ({ page }) => {
    // Step 1: Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Wait for dashboard to load
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Step 2: Navigate to workouts
    await page.click('[data-testid="nav-workouts"]');
    await expect(page).toHaveURL(/.*workouts/);

    // Step 3: Create new workout
    await page.click('[data-testid="create-workout-button"]');
    
    // Fill workout form
    await page.fill('[data-testid="workout-name-input"]', 'My E2E Test Workout');
    await page.fill('[data-testid="workout-description-input"]', 'Created during E2E testing');
    await page.selectOption('[data-testid="workout-date-input"]', new Date().toISOString().split('T')[0]);
    
    // Add exercises
    await page.click('[data-testid="add-exercise-button"]');
    await page.click('[data-testid="exercise-push-ups"]');
    await page.click('[data-testid="exercise-bench-press"]');
    await page.click('[data-testid="confirm-exercises"]');
    
    // Save workout
    await page.click('[data-testid="save-workout-button"]');
    
    // Verify workout was created
    await expect(page.locator('[data-testid="workout-card"]')).toContainText('My E2E Test Workout');

    // Step 4: Start the workout
    await page.click('[data-testid="start-workout-button"]');
    await expect(page).toHaveURL(/.*workout\/.*\/active/);

    // Step 5: Add and complete sets
    // Add first set for push-ups
    await page.click('[data-testid="add-set-exercise-1"]');
    await page.fill('[data-testid="reps-input"]', '10');
    await page.click('[data-testid="save-set-button"]');

    // Complete the set
    await page.click('[data-testid="complete-set-button"]');
    await expect(page.locator('[data-testid="set-completed-indicator"]')).toBeVisible();

    // Add second set for push-ups
    await page.click('[data-testid="add-set-exercise-1"]');
    await page.fill('[data-testid="reps-input"]', '8');
    await page.click('[data-testid="save-set-button"]');
    await page.click('[data-testid="complete-set-button"]');

    // Add set for bench press
    await page.click('[data-testid="add-set-exercise-2"]');
    await page.fill('[data-testid="reps-input"]', '12');
    await page.fill('[data-testid="weight-input"]', '60');
    await page.click('[data-testid="save-set-button"]');
    await page.click('[data-testid="complete-set-button"]');

    // Step 6: Use rest timer
    await page.click('[data-testid="start-rest-timer-button"]');
    await expect(page.locator('[data-testid="rest-timer"]')).toBeVisible();
    await expect(page.locator('[data-testid="timer-display"]')).toContainText('03:00');

    // Skip timer for test
    await page.click('[data-testid="skip-rest-button"]');

    // Step 7: Finish workout
    await page.click('[data-testid="finish-workout-button"]');
    
    // Confirm finish
    await page.click('[data-testid="confirm-finish-button"]');

    // Step 8: Verify workout completion
    await expect(page).toHaveURL(/.*workouts/);
    await expect(page.locator('[data-testid="workout-status"]')).toContainText('Completed');
    
    // Check workout stats
    await expect(page.locator('[data-testid="workout-stats"]')).toContainText('3 sets');
    await expect(page.locator('[data-testid="workout-volume"]')).toContainText('720 kg'); // (10+8)*0 + 12*60
  });

  test('should handle workout cancellation', async ({ page }) => {
    // Login and navigate to workouts
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');

    // Start existing workout
    await page.click('[data-testid="start-workout-button"]');

    // Add a set
    await page.click('[data-testid="add-set-exercise-1"]');
    await page.fill('[data-testid="reps-input"]', '5');
    await page.click('[data-testid="save-set-button"]');

    // Cancel workout
    await page.click('[data-testid="cancel-workout-button"]');
    
    // Confirm cancellation
    await page.click('[data-testid="confirm-cancel-button"]');

    // Verify back to workout list
    await expect(page).toHaveURL(/.*workouts/);
    await expect(page.locator('[data-testid="workout-status"]')).toContainText('Planned');
  });

  test('should handle offline scenario', async ({ page, context }) => {
    // Login first
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');

    // Go offline
    await context.setOffline(true);

    // Try to create workout offline
    await page.click('[data-testid="create-workout-button"]');
    await page.fill('[data-testid="workout-name-input"]', 'Offline Workout');
    await page.click('[data-testid="save-workout-button"]');

    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('1');

    // Go back online
    await context.setOffline(false);

    // Should sync automatically
    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('0');
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
  });

  test('should search and filter exercises', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await page.click('[data-testid="nav-exercises"]');

    // Search for exercises
    await page.fill('[data-testid="exercise-search-input"]', 'push');
    await expect(page.locator('[data-testid="exercise-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="exercise-card"]')).toContainText('Push-ups');

    // Filter by category
    await page.selectOption('[data-testid="category-filter"]', 'strength');
    await expect(page.locator('[data-testid="exercise-card"]')).toHaveCount(2);

    // Filter by muscle group
    await page.selectOption('[data-testid="muscle-filter"]', 'chest');
    await expect(page.locator('[data-testid="exercise-card"]')).toHaveCount(2);

    // Clear filters
    await page.click('[data-testid="clear-filters-button"]');
    await expect(page.locator('[data-testid="exercise-card"]')).toHaveCount(2);
  });

  test('should handle workout timer and rest periods', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');

    await page.click('[data-testid="start-workout-button"]');

    // Check workout timer started
    await expect(page.locator('[data-testid="workout-timer"]')).toBeVisible();
    await expect(page.locator('[data-testid="workout-timer"]')).toContainText('00:00');

    // Wait a moment and check timer updated
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="workout-timer"]')).toContainText('00:0');

    // Complete a set to trigger rest timer
    await page.click('[data-testid="add-set-exercise-1"]');
    await page.fill('[data-testid="reps-input"]', '10');
    await page.click('[data-testid="save-set-button"]');
    await page.click('[data-testid="complete-set-button"]');

    // Rest timer should start automatically
    await expect(page.locator('[data-testid="rest-timer"]')).toBeVisible();
    await expect(page.locator('[data-testid="rest-timer-display"]')).toContainText('03:00');

    // Test pause/resume rest timer
    await page.click('[data-testid="pause-rest-timer"]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid="resume-rest-timer"]');

    // Skip rest
    await page.click('[data-testid="skip-rest-button"]');
    await expect(page.locator('[data-testid="rest-timer"]')).not.toBeVisible();
  });

  test('should display workout statistics and progress', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Navigate to progress page
    await page.click('[data-testid="nav-progress"]');

    // Should show workout statistics
    await expect(page.locator('[data-testid="total-workouts"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-volume"]')).toBeVisible();
    await expect(page.locator('[data-testid="avg-duration"]')).toBeVisible();

    // Should show charts
    await expect(page.locator('[data-testid="volume-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="frequency-chart"]')).toBeVisible();

    // Filter by date range
    await page.selectOption('[data-testid="date-range-filter"]', '7d');
    await expect(page.locator('[data-testid="volume-chart"]')).toBeVisible();

    await page.selectOption('[data-testid="date-range-filter"]', '30d');
    await expect(page.locator('[data-testid="volume-chart"]')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/workouts', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Internal server error',
        }),
      });
    });

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load workouts');

    // Should have retry button
    await page.click('[data-testid="retry-button"]');
    
    // Error should persist since mock is still active
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Navigation should be collapsed on mobile
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="desktop-nav"]')).not.toBeVisible();

    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();

    // Navigate using mobile menu
    await page.click('[data-testid="mobile-nav-workouts"]');
    await expect(page).toHaveURL(/.*workouts/);

    // Cards should stack vertically on mobile
    await expect(page.locator('[data-testid="workout-card"]')).toHaveCSS('width', '100%');
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');

    // Navigate using Tab key
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should focus on first interactive element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Press Enter on focused element
    await page.keyboard.press('Enter');
    
    // Should trigger the focused element's action
    // (This would depend on what element is focused)
  });
});