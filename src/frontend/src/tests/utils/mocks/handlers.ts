import { http, HttpResponse } from 'msw';
import { 
  mockUsers, 
  mockWorkouts, 
  mockExercises, 
  mockGoals,
  mockVoiceSessions 
} from '../fixtures/api-responses';

const API_BASE = 'http://localhost:3000/api';

export const handlers = [
  // Auth endpoints
  http.post(`${API_BASE}/auth/login`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        user: mockUsers[0],
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
      },
    });
  }),

  http.post(`${API_BASE}/auth/register`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        user: mockUsers[0],
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
      },
    });
  }),

  http.post(`${API_BASE}/auth/refresh`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        token: 'new-mock-jwt-token',
        refreshToken: 'new-mock-refresh-token',
      },
    });
  }),

  http.post(`${API_BASE}/auth/logout`, () => {
    return HttpResponse.json({ success: true });
  }),

  // User endpoints
  http.get(`${API_BASE}/users/profile`, () => {
    return HttpResponse.json({
      success: true,
      data: mockUsers[0],
    });
  }),

  http.put(`${API_BASE}/users/profile`, () => {
    return HttpResponse.json({
      success: true,
      data: { ...mockUsers[0], name: 'Updated Name' },
    });
  }),

  // Workout endpoints
  http.get(`${API_BASE}/workouts`, () => {
    return HttpResponse.json({
      success: true,
      data: mockWorkouts,
      total: mockWorkouts.length,
      page: 1,
      limit: 10,
      hasNext: false,
      hasPrev: false,
    });
  }),

  http.get(`${API_BASE}/workouts/:id`, ({ params }) => {
    const workout = mockWorkouts.find(w => w.id === params.id);
    if (!workout) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: workout,
    });
  }),

  http.post(`${API_BASE}/workouts`, async ({ request }) => {
    const data = await request.json() as any;
    const newWorkout = {
      id: `workout-${Date.now()}`,
      userId: 'user-1',
      sets: [],
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    return HttpResponse.json({
      success: true,
      data: newWorkout,
    });
  }),

  http.put(`${API_BASE}/workouts/:id`, async ({ params, request }) => {
    const data = await request.json() as any;
    const workout = mockWorkouts.find(w => w.id === params.id);
    if (!workout) {
      return new HttpResponse(null, { status: 404 });
    }
    const updatedWorkout = {
      ...workout,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({
      success: true,
      data: updatedWorkout,
    });
  }),

  http.delete(`${API_BASE}/workouts/:id`, ({ params }) => {
    const workout = mockWorkouts.find(w => w.id === params.id);
    if (!workout) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ success: true });
  }),

  // Exercise endpoints
  http.get(`${API_BASE}/exercises`, () => {
    return HttpResponse.json({
      success: true,
      data: mockExercises,
    });
  }),

  http.get(`${API_BASE}/exercises/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const filtered = mockExercises.filter(e => 
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.category.toLowerCase().includes(query.toLowerCase())
    );
    return HttpResponse.json({
      success: true,
      data: filtered,
    });
  }),

  // Set endpoints
  http.post(`${API_BASE}/workouts/:workoutId/sets`, async ({ params, request }) => {
    const data = await request.json() as any;
    const newSet = {
      id: `set-${Date.now()}`,
      workoutId: params.workoutId,
      setNumber: 1,
      completed: false,
      ...data,
    };
    return HttpResponse.json({
      success: true,
      data: newSet,
    });
  }),

  http.put(`${API_BASE}/sets/:id`, async ({ params, request }) => {
    const data = await request.json() as any;
    const updatedSet = {
      id: params.id,
      ...data,
      completedAt: data.completed ? new Date().toISOString() : null,
    };
    return HttpResponse.json({
      success: true,
      data: updatedSet,
    });
  }),

  http.delete(`${API_BASE}/sets/:id`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Goal endpoints
  http.get(`${API_BASE}/goals`, () => {
    return HttpResponse.json({
      success: true,
      data: mockGoals,
    });
  }),

  http.post(`${API_BASE}/goals`, async ({ request }) => {
    const data = await request.json() as any;
    const newGoal = {
      id: `goal-${Date.now()}`,
      userId: 'user-1',
      currentValue: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    return HttpResponse.json({
      success: true,
      data: newGoal,
    });
  }),

  // Voice endpoints
  http.post(`${API_BASE}/voice/process`, async ({ request }) => {
    const data = await request.json() as any;
    return HttpResponse.json({
      success: true,
      data: {
        transcript: data.audio ? 'Mock transcript from audio' : 'No audio provided',
        extractedData: {
          exercises: ['Push-ups', 'Squats'],
          sets: [
            { exercise: 'Push-ups', reps: 10, weight: null },
            { exercise: 'Squats', reps: 15, weight: null },
          ],
        },
        confidence: 0.95,
      },
    });
  }),

  http.get(`${API_BASE}/voice/sessions`, () => {
    return HttpResponse.json({
      success: true,
      data: mockVoiceSessions,
    });
  }),

  // Health check
  http.head(`${API_BASE}/health`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Error handlers for testing
  http.get(`${API_BASE}/error/500`, () => {
    return new HttpResponse(null, { status: 500 });
  }),

  http.get(`${API_BASE}/error/401`, () => {
    return HttpResponse.json({
      success: false,
      message: 'Unauthorized',
    }, { status: 401 });
  }),

  http.get(`${API_BASE}/error/network`, () => {
    return HttpResponse.error();
  }),
];