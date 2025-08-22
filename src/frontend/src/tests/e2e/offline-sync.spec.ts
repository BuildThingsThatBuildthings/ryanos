import { test, expect } from '@playwright/test';

test.describe('Offline Functionality and Sync', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock API responses for initial load
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
            token: 'mock-jwt-token',
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
                name: 'Morning Workout',
                status: 'planned',
                sets: [],
                createdAt: new Date().toISOString(),
              },
            ],
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
            { id: 'exercise-1', name: 'Push-ups', category: 'strength' },
            { id: 'exercise-2', name: 'Squats', category: 'strength' },
          ],
        }),
      });
    });

    await page.goto('/');
  });

  test('should work offline and sync when online', async ({ page, context }) => {
    // Login first while online
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');

    // Verify initial data loaded
    await expect(page.locator('[data-testid="workout-card"]')).toContainText('Morning Workout');

    // Go offline
    await context.setOffline(true);

    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-badge"]')).toContainText('Offline');

    // Create workout while offline
    await page.click('[data-testid="create-workout-button"]');
    await page.fill('[data-testid="workout-name-input"]', 'Offline Workout');
    await page.fill('[data-testid="workout-description-input"]', 'Created while offline');
    await page.click('[data-testid="save-workout-button"]');

    // Should save locally and show in UI
    await expect(page.locator('[data-testid="workout-card"]')).toContainText('Offline Workout');
    
    // Should show sync queue indicator
    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('1');
    await expect(page.locator('[data-testid="sync-pending-badge"]')).toBeVisible();

    // Start the offline workout
    await page.click('[data-testid="start-workout-button"]');
    
    // Add sets while offline
    await page.click('[data-testid="add-set-exercise-1"]');
    await page.fill('[data-testid="reps-input"]', '15');
    await page.click('[data-testid="save-set-button"]');
    await page.click('[data-testid="complete-set-button"]');

    // Should update sync queue
    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('2');

    // Mock successful sync responses
    await page.route('**/api/workouts', (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'synced-workout-1',
              name: 'Offline Workout',
              description: 'Created while offline',
              status: 'planned',
              sets: [],
              createdAt: new Date().toISOString(),
            },
          }),
        });
      }
    });

    await page.route('**/api/sets', (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'synced-set-1',
              reps: 15,
              completed: true,
              completedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });

    // Go back online
    await context.setOffline(false);

    // Should show online indicator
    await expect(page.locator('[data-testid="online-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();

    // Should automatically sync
    await expect(page.locator('[data-testid="syncing-indicator"]')).toBeVisible();
    
    // Wait for sync to complete
    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('0');
    await expect(page.locator('[data-testid="syncing-indicator"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="sync-success-message"]')).toBeVisible();

    // Data should still be visible with server IDs
    await expect(page.locator('[data-testid="workout-card"]')).toContainText('Offline Workout');
  });

  test('should handle sync conflicts', async ({ page, context }) => {
    // Login and create workout
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');

    // Start a workout
    await page.click('[data-testid="start-workout-button"]');
    
    // Go offline
    await context.setOffline(true);

    // Modify workout offline
    await page.click('[data-testid="add-set-exercise-1"]');
    await page.fill('[data-testid="reps-input"]', '10');
    await page.click('[data-testid="save-set-button"]');

    // Mock conflict response when going online
    await page.route('**/api/sets', (route) => {
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Conflict detected',
          conflict: {
            local: { reps: 10 },
            server: { reps: 12 },
            lastModified: new Date().toISOString(),
          },
        }),
      });
    });

    // Go back online
    await context.setOffline(false);

    // Should show conflict resolution dialog
    await expect(page.locator('[data-testid="conflict-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="conflict-dialog"]')).toContainText('Sync Conflict Detected');
    
    // Should show both versions
    await expect(page.locator('[data-testid="local-version"]')).toContainText('Your version: 10 reps');
    await expect(page.locator('[data-testid="server-version"]')).toContainText('Server version: 12 reps');

    // Resolve conflict by choosing local version
    await page.click('[data-testid="use-local-version"]');
    
    // Should resolve conflict and continue sync
    await expect(page.locator('[data-testid="conflict-dialog"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="sync-success-message"]')).toBeVisible();
  });

  test('should cache essential data for offline use', async ({ page, context }) => {
    // Login and load data
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to exercises to cache them
    await page.click('[data-testid="nav-exercises"]');
    await expect(page.locator('[data-testid="exercise-card"]')).toHaveCount(2);

    // Navigate to workouts
    await page.click('[data-testid="nav-workouts"]');
    await expect(page.locator('[data-testid="workout-card"]')).toHaveCount(1);

    // Go offline
    await context.setOffline(true);

    // Should still show cached exercises
    await page.click('[data-testid="nav-exercises"]');
    await expect(page.locator('[data-testid="exercise-card"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="exercise-card"]').first()).toContainText('Push-ups');

    // Should still show cached workouts
    await page.click('[data-testid="nav-workouts"]');
    await expect(page.locator('[data-testid="workout-card"]')).toContainText('Morning Workout');

    // Should show cache freshness indicator
    await expect(page.locator('[data-testid="cache-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="last-sync-time"]')).toBeVisible();
  });

  test('should handle partial sync failures', async ({ page, context }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');

    // Go offline and create multiple items
    await context.setOffline(true);

    // Create first workout
    await page.click('[data-testid="create-workout-button"]');
    await page.fill('[data-testid="workout-name-input"]', 'Workout 1');
    await page.click('[data-testid="save-workout-button"]');

    // Create second workout
    await page.click('[data-testid="create-workout-button"]');
    await page.fill('[data-testid="workout-name-input"]', 'Workout 2');
    await page.click('[data-testid="save-workout-button"]');

    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('2');

    // Mock partial success responses
    let callCount = 0;
    await page.route('**/api/workouts', (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        callCount++;
        if (callCount === 1) {
          // First workout succeeds
          route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { id: 'workout-1', name: 'Workout 1' },
            }),
          });
        } else {
          // Second workout fails
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              message: 'Server error',
            }),
          });
        }
      }
    });

    // Go back online
    await context.setOffline(false);

    // Should partially sync
    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('1'); // One failed
    await expect(page.locator('[data-testid="sync-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="sync-warning"]')).toContainText('1 item failed to sync');

    // Should allow retry
    await page.click('[data-testid="retry-sync-button"]');
    await expect(page.locator('[data-testid="syncing-indicator"]')).toBeVisible();
  });

  test('should maintain data integrity during offline operations', async ({ page, context }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');
    await page.click('[data-testid="start-workout-button"]');

    // Go offline
    await context.setOffline(true);

    // Create sets with relationships
    await page.click('[data-testid="add-set-exercise-1"]');
    await page.fill('[data-testid="reps-input"]', '10');
    await page.click('[data-testid="save-set-button"]');

    await page.click('[data-testid="add-set-exercise-1"]');
    await page.fill('[data-testid="reps-input"]', '8');
    await page.click('[data-testid="save-set-button"]');

    // Sets should maintain proper order and relationships
    const sets = page.locator('[data-testid^="set-"]');
    await expect(sets).toHaveCount(2);
    await expect(sets.first()).toContainText('Set 1: 10 reps');
    await expect(sets.last()).toContainText('Set 2: 8 reps');

    // Complete sets in order
    await page.click('[data-testid="complete-set-1"]');
    await page.click('[data-testid="complete-set-2"]');

    // Should maintain completion state
    await expect(page.locator('[data-testid="set-1-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="set-2-completed"]')).toBeVisible();

    // Finish workout
    await page.click('[data-testid="finish-workout-button"]');
    await page.click('[data-testid="confirm-finish-button"]');

    // Should calculate stats correctly
    await expect(page.locator('[data-testid="workout-stats"]')).toContainText('2 sets');
    await expect(page.locator('[data-testid="workout-status"]')).toContainText('Completed');
  });

  test('should show appropriate offline messages', async ({ page, context }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Go offline
    await context.setOffline(true);

    // Should show offline banner
    await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-banner"]')).toContainText('You are currently offline');

    // Should disable certain features
    await page.click('[data-testid="nav-social"]');
    await expect(page.locator('[data-testid="offline-feature-disabled"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-feature-disabled"]')).toContainText('This feature requires internet connection');

    // Should show data freshness
    await page.click('[data-testid="nav-progress"]');
    await expect(page.locator('[data-testid="data-freshness-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-freshness-warning"]')).toContainText('Data may not be up to date');
  });

  test('should handle storage quota limits', async ({ page, context }) => {
    // Mock storage quota exceeded
    await page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem;
      let itemCount = 0;
      Storage.prototype.setItem = function(key, value) {
        itemCount++;
        if (itemCount > 5) { // Simulate quota exceeded after 5 items
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
        return originalSetItem.call(this, key, value);
      };
    });

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');

    // Go offline
    await context.setOffline(true);

    // Try to create many workouts to exceed quota
    for (let i = 1; i <= 10; i++) {
      await page.click('[data-testid="create-workout-button"]');
      await page.fill('[data-testid="workout-name-input"]', `Workout ${i}`);
      await page.click('[data-testid="save-workout-button"]');
      
      if (i > 5) {
        // Should show storage warning
        await expect(page.locator('[data-testid="storage-warning"]')).toBeVisible();
        await expect(page.locator('[data-testid="storage-warning"]')).toContainText('Storage space is running low');
        break;
      }
    }

    // Should offer storage management
    await page.click('[data-testid="manage-storage-button"]');
    await expect(page.locator('[data-testid="storage-manager"]')).toBeVisible();
    
    // Should allow clearing old data
    await page.click('[data-testid="clear-old-data"]');
    await expect(page.locator('[data-testid="storage-cleared-message"]')).toBeVisible();
  });

  test('should sync workout progress incrementally', async ({ page, context }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');
    await page.click('[data-testid="start-workout-button"]');

    // Go offline and work out
    await context.setOffline(true);

    // Add multiple sets
    for (let i = 1; i <= 5; i++) {
      await page.click('[data-testid="add-set-exercise-1"]');
      await page.fill('[data-testid="reps-input"]', `${i * 2}`);
      await page.click('[data-testid="save-set-button"]');
      await page.click('[data-testid="complete-set-button"]');
    }

    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('5');

    // Mock incremental sync responses
    let syncedCount = 0;
    await page.route('**/api/sets', (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        syncedCount++;
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: `set-${syncedCount}`, synced: true },
          }),
        });
      }
    });

    // Go back online
    await context.setOffline(false);

    // Should sync incrementally
    await expect(page.locator('[data-testid="sync-progress"]')).toBeVisible();
    
    // Watch sync progress
    await expect(page.locator('[data-testid="sync-progress-text"]')).toContainText('Syncing 1 of 5');
    
    // Eventually all should sync
    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('0');
    await expect(page.locator('[data-testid="sync-complete-message"]')).toBeVisible();
  });
});