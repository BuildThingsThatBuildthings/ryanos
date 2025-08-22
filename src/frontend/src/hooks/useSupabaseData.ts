import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseSupabaseDataOptions {
  table: string;
  filter?: string;
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  enabled?: boolean;
}

interface UseSupabaseDataResult<T> {
  data: T[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSupabaseData<T = any>({
  table,
  filter,
  select = '*',
  orderBy,
  limit,
  enabled = true,
}: UseSupabaseDataOptions): UseSupabaseDataResult<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<RealtimeChannel | null>(null);

  const fetchData = async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase.from(table).select(select);

      if (filter) {
        // Parse simple filters like "user_id=eq.123" or "status=eq.active"
        const [field, operation, value] = filter.split(/[=.]/);
        switch (operation) {
          case 'eq':
            query = query.eq(field, value);
            break;
          case 'neq':
            query = query.neq(field, value);
            break;
          case 'gt':
            query = query.gt(field, value);
            break;
          case 'lt':
            query = query.lt(field, value);
            break;
          case 'gte':
            query = query.gte(field, value);
            break;
          case 'lte':
            query = query.lte(field, value);
            break;
          default:
            query = query.eq(field, `${operation}.${value}`);
        }
      }

      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data: result, error } = await query;
      if (error) throw error;

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table,
          filter 
        }, 
        (payload) => {
          console.log(`Real-time update for ${table}:`, payload);
          fetchData(); // Refetch data when changes occur
        }
      )
      .subscribe();

    setSubscription(channel);

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [table, filter, enabled]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [table, filter, select, enabled]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// Hook for real-time authentication state
export function useSupabaseAuth() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}