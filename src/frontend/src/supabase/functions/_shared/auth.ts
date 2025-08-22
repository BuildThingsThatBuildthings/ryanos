import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { User, AuthenticatedRequest, APIResponse } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function authenticateRequest(req: Request): Promise<{ user: User | null; error: string | null }> {
  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return { user: null, error: 'Missing Authorization header' };
    }

    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      return { user: null, error: error.message };
    }

    if (!user) {
      return { user: null, error: 'Invalid or expired token' };
    }

    return { user, error: null };
  } catch (error) {
    console.error('Authentication error:', error);
    return { user: null, error: 'Authentication failed' };
  }
}

export function createAuthenticatedHandler<T>(
  handler: (req: AuthenticatedRequest, user: User) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    const { user, error } = await authenticateRequest(req);
    
    if (error || !user) {
      return createErrorResponse(401, 'UNAUTHORIZED', error || 'Authentication required');
    }

    try {
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.user = user;
      return await handler(authenticatedReq, user);
    } catch (error) {
      console.error('Handler error:', error);
      return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
    }
  };
}

export function createResponse<T>(data: T, status = 200): Response {
  const response: APIResponse<T> = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      request_id: crypto.randomUUID(),
      execution_time_ms: 0 // Will be calculated by caller if needed
    }
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export function createErrorResponse(status: number, code: string, message: string, details?: any): Response {
  const response: APIResponse = {
    success: false,
    error: {
      code,
      message,
      details
    },
    metadata: {
      timestamp: new Date().toISOString(),
      request_id: crypto.randomUUID(),
      execution_time_ms: 0
    }
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  return null;
}