import { createAuthenticatedHandler, createResponse, createErrorResponse, handleCors, supabase } from '../_shared/auth.ts';
import { validateRequired, sanitizeInput, handleDatabaseError, generateSessionId } from '../_shared/utils.ts';
import type { VoiceSession, User, AuthenticatedRequest } from '../_shared/types.ts';

interface CreateSessionRequest {
  session_data?: Record<string, any>;
}

interface UpdateSessionRequest {
  status?: 'active' | 'completed' | 'failed';
  session_data?: Record<string, any>;
}

const handler = createAuthenticatedHandler(async (req: AuthenticatedRequest, user: User) => {
  const { method, url } = req;
  const urlParts = new URL(url).pathname.split('/');
  const sessionId = urlParts[urlParts.length - 1];

  try {
    switch (method) {
      case 'POST':
        return await createSession(req, user);
      
      case 'GET':
        if (sessionId && sessionId !== 'voice-sessions') {
          return await getSession(sessionId, user);
        }
        return await getUserSessions(user);
      
      case 'PUT':
        if (!sessionId || sessionId === 'voice-sessions') {
          return createErrorResponse(400, 'BAD_REQUEST', 'Session ID required for updates');
        }
        return await updateSession(sessionId, req, user);
      
      case 'DELETE':
        if (!sessionId || sessionId === 'voice-sessions') {
          return createErrorResponse(400, 'BAD_REQUEST', 'Session ID required for deletion');
        }
        return await deleteSession(sessionId, user);
      
      default:
        return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    }
  } catch (error) {
    console.error('Voice sessions handler error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

async function createSession(req: AuthenticatedRequest, user: User): Promise<Response> {
  try {
    const body: CreateSessionRequest = await req.json();
    const sanitizedBody = sanitizeInput(body);

    const sessionData: Partial<VoiceSession> = {
      id: generateSessionId(),
      user_id: user.id,
      status: 'active',
      started_at: new Date().toISOString(),
      session_data: sanitizedBody.session_data || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('voice_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      const dbError = handleDatabaseError(error);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    return createResponse<VoiceSession>(data, 201);
  } catch (error) {
    console.error('Create session error:', error);
    return createErrorResponse(400, 'INVALID_REQUEST', 'Invalid request body');
  }
}

async function getSession(sessionId: string, user: User): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('voice_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return createErrorResponse(404, 'SESSION_NOT_FOUND', 'Voice session not found');
      }
      const dbError = handleDatabaseError(error);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    return createResponse<VoiceSession>(data);
  } catch (error) {
    console.error('Get session error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to retrieve session');
  }
}

async function getUserSessions(user: User): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('voice_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      const dbError = handleDatabaseError(error);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    return createResponse<VoiceSession[]>(data || []);
  } catch (error) {
    console.error('Get user sessions error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to retrieve sessions');
  }
}

async function updateSession(sessionId: string, req: AuthenticatedRequest, user: User): Promise<Response> {
  try {
    const body: UpdateSessionRequest = await req.json();
    const sanitizedBody = sanitizeInput(body);

    const updateData: Partial<VoiceSession> = {
      updated_at: new Date().toISOString()
    };

    if (sanitizedBody.status) {
      updateData.status = sanitizedBody.status;
      if (sanitizedBody.status === 'completed' || sanitizedBody.status === 'failed') {
        updateData.ended_at = new Date().toISOString();
      }
    }

    if (sanitizedBody.session_data) {
      updateData.session_data = sanitizedBody.session_data;
    }

    const { data, error } = await supabase
      .from('voice_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return createErrorResponse(404, 'SESSION_NOT_FOUND', 'Voice session not found');
      }
      const dbError = handleDatabaseError(error);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    return createResponse<VoiceSession>(data);
  } catch (error) {
    console.error('Update session error:', error);
    return createErrorResponse(400, 'INVALID_REQUEST', 'Invalid request body');
  }
}

async function deleteSession(sessionId: string, user: User): Promise<Response> {
  try {
    const { error } = await supabase
      .from('voice_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) {
      const dbError = handleDatabaseError(error);
      return createErrorResponse(400, dbError.code, dbError.message, dbError.details);
    }

    return createResponse({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to delete session');
  }
}

// Main handler
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  return await handler(req);
});