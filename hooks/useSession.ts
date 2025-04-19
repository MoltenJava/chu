import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CoupleSession } from '../types/database';

export function useSession(sessionId: string) {
  const [session, setSession] = useState<CoupleSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSession() {
      if (!sessionId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('couple_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (error) throw error;
        setSession(data as CoupleSession);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSession();
  }, [sessionId]);

  return { session, isLoading, error };
} 