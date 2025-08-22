import { test, expect } from '@playwright/test';

test.describe('Voice Logging Features', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant microphone permission
    await context.grantPermissions(['microphone']);

    // Mock MediaRecorder and related APIs
    await page.addInitScript(() => {
      class MockMediaRecorder {
        state: string = 'inactive';
        ondataavailable: ((event: any) => void) | null = null;
        onstop: ((event: any) => void) | null = null;
        onstart: ((event: any) => void) | null = null;
        
        constructor(public stream: MediaStream) {}

        start() {
          this.state = 'recording';
          if (this.onstart) {
            setTimeout(() => this.onstart!({} as any), 10);
          }
        }

        stop() {
          this.state = 'inactive';
          if (this.ondataavailable) {
            const mockBlob = new Blob(['mock audio data'], { type: 'audio/wav' });
            setTimeout(() => this.ondataavailable!({ data: mockBlob }), 10);
          }
          if (this.onstop) {
            setTimeout(() => this.onstop!({} as any), 20);
          }
        }

        pause() {
          this.state = 'paused';
        }

        resume() {
          this.state = 'recording';
        }
      }

      (window as any).MediaRecorder = MockMediaRecorder;
      (window as any).MediaRecorder.isTypeSupported = () => true;

      // Mock getUserMedia
      const mockGetUserMedia = () => Promise.resolve({
        getTracks: () => [{ stop: () => {} }],
        getAudioTracks: () => [{ stop: () => {} }],
        getVideoTracks: () => [],
      } as MediaStream);

      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = mockGetUserMedia;
      } else {
        (navigator as any).mediaDevices = { getUserMedia: mockGetUserMedia };
      }
    });

    // Mock API responses
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

    await page.route('**/api/voice/process', (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              transcript: 'I did 10 push-ups and then 15 squats with good form',
              extractedData: {
                exercises: [
                  {
                    name: 'Push-ups',
                    sets: [{ reps: 10 }],
                  },
                  {
                    name: 'Squats',
                    sets: [{ reps: 15 }],
                  },
                ],
              },
              confidence: 0.95,
            },
          }),
        });
      }
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
                name: 'Active Workout',
                status: 'in_progress',
                sets: [],
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        });
      }
    });

    await page.goto('/');
  });

  test('should record and process voice input for workout logging', async ({ page }) => {
    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Navigate to active workout
    await page.click('[data-testid="nav-workouts"]');
    await page.click('[data-testid="continue-workout-button"]');

    // Start voice recording
    const voiceButton = page.locator('[data-testid="voice-record-button"]');
    await expect(voiceButton).toBeVisible();
    await expect(voiceButton).toHaveAttribute('aria-label', 'Start voice recording');

    await voiceButton.click();

    // Should show recording state
    await expect(voiceButton).toHaveClass(/recording/);
    await expect(voiceButton).toHaveAttribute('aria-label', 'Stop voice recording');
    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="recording-pulse"]')).toBeVisible();

    // Should show recording duration
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-testid="recording-duration"]')).toContainText('00:01');

    // Stop recording
    await voiceButton.click();

    // Should show processing state
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-spinner"]')).toBeVisible();

    // Should show transcript after processing
    await expect(page.locator('[data-testid="voice-transcript"]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-transcript"]')).toContainText('I did 10 push-ups and then 15 squats');

    // Should show extracted exercise data
    await expect(page.locator('[data-testid="extracted-exercises"]')).toBeVisible();
    await expect(page.locator('[data-testid="exercise-push-ups"]')).toContainText('Push-ups: 10 reps');
    await expect(page.locator('[data-testid="exercise-squats"]')).toContainText('Squats: 15 reps');

    // Should have confidence indicator
    await expect(page.locator('[data-testid="confidence-score"]')).toContainText('95%');

    // Confirm and add to workout
    await page.click('[data-testid="confirm-voice-data"]');

    // Should add sets to workout
    await expect(page.locator('[data-testid="workout-sets"]')).toContainText('Push-ups');
    await expect(page.locator('[data-testid="workout-sets"]')).toContainText('Squats');
  });

  test('should handle voice recording errors', async ({ page }) => {
    // Mock microphone access denied
    await page.addInitScript(() => {
      const mockGetUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = mockGetUserMedia;
      } else {
        (navigator as any).mediaDevices = { getUserMedia: mockGetUserMedia };
      }
    });

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');

    const voiceButton = page.locator('[data-testid="voice-record-button"]');
    await voiceButton.click();

    // Should show permission error
    await expect(page.locator('[data-testid="voice-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-error"]')).toContainText('Microphone permission denied');
    
    // Should show help text
    await expect(page.locator('[data-testid="permission-help"]')).toBeVisible();
    await expect(page.locator('[data-testid="permission-help"]')).toContainText('Please allow microphone access');
  });

  test('should handle microphone not available', async ({ page }) => {
    // Mock no microphone device
    await page.addInitScript(() => {
      const mockGetUserMedia = () => Promise.reject(new DOMException('Device not found', 'NotFoundError'));
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = mockGetUserMedia;
      } else {
        (navigator as any).mediaDevices = { getUserMedia: mockGetUserMedia };
      }
    });

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    const voiceButton = page.locator('[data-testid="voice-record-button"]');
    await voiceButton.click();

    // Should show device error
    await expect(page.locator('[data-testid="voice-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-error"]')).toContainText('No microphone found');
    
    // Should show fallback options
    await expect(page.locator('[data-testid="manual-entry-button"]')).toBeVisible();
  });

  test('should support voice command shortcuts', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');
    await page.click('[data-testid="continue-workout-button"]');

    // Test keyboard shortcut for voice recording
    await page.keyboard.press('Space');
    
    // Should start recording
    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
    
    // Stop recording with space again
    await page.keyboard.press('Space');
    
    // Should stop recording
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
  });

  test('should handle long voice recordings', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');
    await page.click('[data-testid="continue-workout-button"]');

    const voiceButton = page.locator('[data-testid="voice-record-button"]');
    await voiceButton.click();

    // Wait for max recording time (simulate long recording)
    await page.waitForTimeout(5000);
    
    // Should automatically stop at max duration
    await expect(page.locator('[data-testid="recording-indicator"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
    
    // Should show warning about max duration
    await expect(page.locator('[data-testid="max-duration-warning"]')).toBeVisible();
  });

  test('should allow editing voice transcription', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');
    await page.click('[data-testid="continue-workout-button"]');

    // Record voice
    const voiceButton = page.locator('[data-testid="voice-record-button"]');
    await voiceButton.click();
    await voiceButton.click(); // Stop recording

    // Wait for processing
    await expect(page.locator('[data-testid="voice-transcript"]')).toBeVisible();

    // Edit transcript
    await page.click('[data-testid="edit-transcript-button"]');
    await page.clear('[data-testid="transcript-editor"]');
    await page.fill('[data-testid="transcript-editor"]', 'I did 20 burpees and 30 jumping jacks');
    await page.click('[data-testid="reprocess-transcript"]');

    // Should reprocess with edited transcript
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="extracted-exercises"]')).toContainText('burpees');
    await expect(page.locator('[data-testid="extracted-exercises"]')).toContainText('jumping jacks');
  });

  test('should show voice processing confidence levels', async ({ page }) => {
    // Mock low confidence response
    await page.route('**/api/voice/process', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            transcript: 'I did some exercises but not sure what',
            extractedData: {
              exercises: [
                {
                  name: 'Unknown Exercise',
                  sets: [{ reps: null }],
                },
              ],
            },
            confidence: 0.3,
          },
        }),
      });
    });

    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');
    await page.click('[data-testid="continue-workout-button"]');

    const voiceButton = page.locator('[data-testid="voice-record-button"]');
    await voiceButton.click();
    await voiceButton.click();

    // Should show low confidence warning
    await expect(page.locator('[data-testid="low-confidence-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="confidence-score"]')).toContainText('30%');
    
    // Should suggest manual review
    await expect(page.locator('[data-testid="manual-review-suggestion"]')).toBeVisible();
    
    // Should allow manual correction
    await expect(page.locator('[data-testid="manual-correction-button"]')).toBeVisible();
  });

  test('should support multiple languages', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Go to settings
    await page.click('[data-testid="nav-settings"]');
    
    // Change voice language
    await page.selectOption('[data-testid="voice-language-select"]', 'es-ES');
    await page.click('[data-testid="save-settings"]');
    
    // Go back to workout
    await page.click('[data-testid="nav-workouts"]');
    await page.click('[data-testid="continue-workout-button"]');
    
    // Voice button should reflect language change
    const voiceButton = page.locator('[data-testid="voice-record-button"]');
    await expect(voiceButton).toHaveAttribute('title', expect.stringContaining('español'));
  });

  test('should handle voice recording in background', async ({ page, context }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');
    await page.click('[data-testid="continue-workout-button"]');

    // Start recording
    const voiceButton = page.locator('[data-testid="voice-record-button"]');
    await voiceButton.click();

    // Minimize/background the page
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
    });

    // Recording should continue in background
    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
    
    // Bring page back to foreground
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Stop recording
    await voiceButton.click();
    
    // Should process normally
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
  });

  test('should provide voice feedback and hints', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="nav-workouts"]');
    await page.click('[data-testid="continue-workout-button"]');

    // Should show voice tips
    await expect(page.locator('[data-testid="voice-tips"]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-tips"]')).toContainText('Try saying: "I did 10 push-ups"');
    
    // Click for more tips
    await page.click('[data-testid="show-more-tips"]');
    await expect(page.locator('[data-testid="voice-examples"]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-examples"]')).toContainText('bench press');
    await expect(page.locator('[data-testid="voice-examples"]')).toContainText('with 135 pounds');
  });
});