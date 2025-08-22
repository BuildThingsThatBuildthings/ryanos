import { createAuthenticatedHandler, createResponse, createErrorResponse, handleCors, supabase } from '../_shared/auth.ts';
import { validateRequired, sanitizeInput, handleDatabaseError, validateVoiceEvent } from '../_shared/utils.ts';
import type { VoiceEvent, User, AuthenticatedRequest } from '../_shared/types.ts';

interface CreateEventRequest {
  session_id: string;
  event_type: 'intent_recognized' | 'workout_started' | 'exercise_completed' | 'session_ended';
  intent?: string;
  confidence?: number;
  event_data?: Record<string, any>;
}

interface QueryEventsRequest {
  session_id?: string;
  event_type?: string;
  limit?: number;
  offset?: number;
}

const handler = createAuthenticatedHandler(async (req: AuthenticatedRequest, user: User) => {
  const { method, url } = req;
  const urlParts = new URL(url).pathname.split('/');
  const eventId = urlParts[urlParts.length - 1];

  try {
    switch (method) {
      case 'POST':
        return await createEvent(req, user);
      
      case 'GET':
        if (eventId && eventId !== 'voice-events') {
          return await getEvent(eventId, user);
        }
        return await queryEvents(req, user);
      
      case 'DELETE':
        if (!eventId || eventId === 'voice-events') {
          return createErrorResponse(400, 'BAD_REQUEST', 'Event ID required for deletion');
        }
        return await deleteEvent(eventId, user);
      
      default:
        return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    }
  } catch (error) {
    console.error('Voice events handler error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

async function createEvent(req: AuthenticatedRequest, user: User): Promise<Response> {
  try {
    const body: CreateEventRequest = await req.json();
    const sanitizedBody = sanitizeInput(body);

    // Validate required fields and event structure
    const validationError = validateVoiceEvent(sanitizedBody);
    if (validationError) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validationError);
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('voice_sessions')
      .select('id, user_id')
      .eq('id', sanitizedBody.session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return createErrorResponse(404, 'SESSION_NOT_FOUND', 'Voice session not found or does not belong to user');
    }

    const eventData: Partial<VoiceEvent> = {
      id: crypto.randomUUID(),
      session_id: sanitizedBody.session_id,
      event_type: sanitizedBody.event_type,
      intent: sanitizedBody.intent,
      confidence: sanitizedBody.confidence,
      event_data: sanitizedBody.event_data || {},
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('voice_events')
      .insert(eventData)
      .select()
      .single();

    if (error) {
      const dbError = handleDatabaseError(error);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    // If this is a session_ended event, update the session status
    if (sanitizedBody.event_type === 'session_ended') {
      await supabase
        .from('voice_sessions')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sanitizedBody.session_id)
        .eq('user_id', user.id);
    }

    return createResponse<VoiceEvent>(data, 201);
  } catch (error) {
    console.error('Create event error:', error);
    return createErrorResponse(400, 'INVALID_REQUEST', 'Invalid request body');
  }
}

async function getEvent(eventId: string, user: User): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('voice_events')
      .select(`
        *,
        voice_sessions!inner(user_id)
      `)
      .eq('id', eventId)
      .eq('voice_sessions.user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return createErrorResponse(404, 'EVENT_NOT_FOUND', 'Voice event not found');
      }
      const dbError = handleDatabaseError(error);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    // Remove the joined session data from response
    const { voice_sessions, ...eventData } = data;

    return createResponse<VoiceEvent>(eventData);
  } catch (error) {
    console.error('Get event error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to retrieve event');
  }
}

async function queryEvents(req: AuthenticatedRequest, user: User): Promise<Response> {
  try {
    const url = new URL(req.url);
    const params: QueryEventsRequest = {
      session_id: url.searchParams.get('session_id') || undefined,
      event_type: url.searchParams.get('event_type') || undefined,
      limit: parseInt(url.searchParams.get('limit') || '50'),
      offset: parseInt(url.searchParams.get('offset') || '0')
    };

    let query = supabase
      .from('voice_events')
      .select(`
        *,
        voice_sessions!inner(user_id)
      `)
      .eq('voice_sessions.user_id', user.id);

    if (params.session_id) {
      query = query.eq('session_id', params.session_id);
    }

    if (params.event_type) {
      query = query.eq('event_type', params.event_type);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(params.offset!, params.offset! + params.limit! - 1);

    const { data, error } = await query;

    if (error) {
      const dbError = handleDatabaseError(error);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    // Remove the joined session data from response
    const events = (data || []).map(({ voice_sessions, ...eventData }) => eventData);

    return createResponse<VoiceEvent[]>(events);
  } catch (error) {
    console.error('Query events error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to query events');
  }
}

async function deleteEvent(eventId: string, user: User): Promise<Response> {
  try {
    // First verify the event belongs to the user via session
    const { data: event, error: fetchError } = await supabase
      .from('voice_events')
      .select(`
        id,
        voice_sessions!inner(user_id)
      `)
      .eq('id', eventId)
      .eq('voice_sessions.user_id', user.id)
      .single();

    if (fetchError || !event) {
      return createErrorResponse(404, 'EVENT_NOT_FOUND', 'Voice event not found');
    }

    const { error } = await supabase
      .from('voice_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      const dbError = handleDatabaseError(error);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    return createResponse({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to delete event');
  }
}

// Main handler
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  return await handler(req);
});