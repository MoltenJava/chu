import { supabase } from '../lib/supabase';
import { CoupleSession, CoupleSwipe, CoupleMatch } from '../types/database';
import { FoodItem } from '../types/food';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react-native';

/**
 * Generate a random 6-digit session code
 */
export const generateSessionCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create a new couple session
 */
export const createSession = async (userId: string): Promise<CoupleSession> => {
  const sessionCode = generateSessionCode();
  console.log('[CoupleModeService] Generating session code...');
  console.log(`[CoupleModeService] Session code generated: ${sessionCode}`);

  Sentry.addBreadcrumb({
    category: 'couple.session',
    message: 'Creating couple session',
    level: 'info',
    data: { userId },
  });

  try {
    const { data, error } = await supabase
      .from('couple_sessions')
      .insert({
        created_by: userId,
        session_code: sessionCode,
        status: 'active' // Initial status
      })
      .select()
      .single();

    if (error) {
      console.error('[CoupleModeService] Error creating couple session:', error);
      Sentry.captureException(error, { extra: { userId } });
      throw new Error('Failed to create couple session.');
    }
    if (!data) {
       console.error('[CoupleModeService] No data returned after creating session');
       Sentry.captureException(new Error('No data returned after creating session'), {
         extra: { userId },
         level: 'error'
       });
       throw new Error('Failed to create couple session (no data).');
    }

    console.log('[CoupleModeService] Couple session created:', data);
    return data as CoupleSession;
  } catch (err) {
    Sentry.captureException(err, { extra: { userId } });
    console.error('[CoupleModeService] Unexpected error in createSession:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred creating the session.');
  }
};

/**
 * Join an existing session using a database function
 */
export const joinSession = async (sessionCode: string, userId: string): Promise<CoupleSession> => {
  console.log(`[CoupleModeService] Calling RPC handle_join_session with code ${sessionCode}, user ${userId}`);
  Sentry.addBreadcrumb({
    category: 'couple.session',
    message: 'Attempting to join couple session',
    level: 'info',
    data: { userId, sessionCode },
  });

  try {
    const { data: updatedSessionData, error: rpcError } = await supabase
      .rpc('handle_join_session', {
        p_session_code: sessionCode, // Pass session code instead of ID
        p_joining_user_id: userId
      })
      .select() // Ensure we select the returned session data
      .single(); // Expect the function to return the single updated row or throw an error

    if (rpcError) {
      console.error('[CoupleModeService] Error calling handle_join_session RPC:', rpcError);
      Sentry.captureException(rpcError, { extra: { userId, sessionCode, message: 'Error in handle_join_session RPC' } });
      // The RPC function should raise specific errors that can be caught here if needed.
      // For now, re-throw a generic error, but ideally, parse rpcError.message
      // to provide more specific feedback (e.g., "Session not found", "Already joined").
      // Supabase RPC errors often have a 'details' or 'hint' field.
      const message = rpcError.message || 'Failed to join session via RPC.';
      // Example of checking specific error messages (adjust based on actual errors from SQL function)
      if (message.includes('Session not found')) {
          throw new Error('Session code is invalid or the session is no longer active.');
      } else if (message.includes('already joined')) {
          throw new Error('This session has already been joined by another user.');
      }
      throw new Error(message); // Throw a more specific or generic error
    }

    if (!updatedSessionData) {
      console.error('[CoupleModeService] No data returned from handle_join_session RPC');
      Sentry.captureException(new Error('No data returned from handle_join_session RPC'), {
        extra: { userId, sessionCode },
        level: 'error'
      });
      throw new Error('Failed to join session (RPC returned no data).');
    }

    console.log('[CoupleModeService] Successfully joined session:', updatedSessionData);
    return updatedSessionData as CoupleSession;
  } catch (err) {
    Sentry.captureException(err, { extra: { userId, sessionCode, message: 'Unexpected error in joinSession' } });
    console.error('[CoupleModeService] Unexpected error in joinSession:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred joining the session.');
  }
};

/**
 * Record a swipe and check for matches
 */
export const recordSwipe = async (
  sessionId: string,
  userId: string,
  foodItemId: string,
  decision: boolean
): Promise<void> => {
  // Validate inputs to prevent errors
  if (!sessionId || !userId || !foodItemId) {
    console.error(`[CoupleModeService] Invalid inputs: sessionId=${sessionId}, userId=${userId}, foodItemId=${foodItemId}`);
    throw new Error('Invalid swipe parameters: missing required fields');
  }

  const params = {
    p_session_id: sessionId,
    p_user_id: userId,
    p_food_item_id: foodItemId,
    p_decision: decision
  };
  console.log(`[CoupleModeService] Calling RPC record_swipe_and_check_match with params:`, JSON.stringify(params));
  
  Sentry.addBreadcrumb({
    category: 'couple.swipe',
    message: 'Recording couple swipe',
    level: 'debug',
    data: params,
  });

  try {
    const { error } = await supabase.rpc('record_swipe_and_check_match', params);

    if (error) {
      console.error('[CoupleModeService] Error calling record_swipe_and_check_match RPC:', error);
      Sentry.captureException(error, { extra: { ...params, message: 'Error in record_swipe_and_check_match RPC' } });
      let errorMsg = 'Database error recording swipe';
      
      // Provide more specific error messages based on the Supabase error
      if (error.message) {
        errorMsg += `: ${error.message}`;
        
        // Look for common issues in the error message
        if (error.message.includes('function') && error.message.includes('not exist')) {
          errorMsg = 'The swipe function needs to be updated in Supabase. Please contact support.';
        } else if (error.message.includes('permission denied')) {
          errorMsg = 'Permission denied: Unable to record your swipe. Please try signing out and back in.';
        }
      }
      
      throw new Error(errorMsg);
    }
    
    console.log(`[CoupleModeService] RPC record_swipe_and_check_match called successfully for user ${userId}, item ${foodItemId}`);
  } catch (err) {
    // Handle network errors or other unexpected issues
    console.error('[CoupleModeService] Unexpected error in recordSwipe:', err);
    Sentry.captureException(err, { extra: { ...params, message: 'Unexpected error in recordSwipe' } });
    if (err instanceof Error) {
      throw err; // Re-throw the error with our custom message
    } else {
      throw new Error(`Failed to record swipe: ${String(err)}`);
    }
  }
};

/**
 * Get session matches (returns full match objects)
 */
export const getSessionMatches = async (sessionId: string): Promise<CoupleMatch[]> => {
  Sentry.addBreadcrumb({
    category: 'couple.fetch',
    message: 'Fetching couple matches',
    level: 'debug',
    data: { sessionId },
  });
  try {
    const { data, error } = await supabase
      .from('couple_matches')
      .select('*')
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error getting session matches:', error);
      Sentry.captureException(error, { extra: { sessionId } });
      throw error;
    }

    return data;
  } catch (err) {
    Sentry.captureException(err, { extra: { sessionId, message: 'Unexpected error in getSessionMatches' } });
    console.error('[CoupleModeService] Unexpected error in getSessionMatches:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred fetching matches.');
  }
};

/**
 * Get only the food_item_ids for session matches
 */
export const getSessionMatchIds = async (sessionId: string): Promise<Set<string>> => {
  Sentry.addBreadcrumb({
    category: 'couple.fetch',
    message: 'Fetching couple match IDs',
    level: 'debug',
    data: { sessionId },
  });
  try {
    const { data, error } = await supabase
      .from('couple_matches')
      .select('food_item_id') // Select only the food_item_id column
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error getting session match IDs:', error);
      Sentry.captureException(error, { extra: { sessionId } });
      throw new Error('Failed to fetch session match IDs.');
    }

    // Convert the array of objects { food_item_id: string } to a Set of strings
    const matchIds = new Set(data.map(match => match.food_item_id));
    console.log(`[CoupleModeService] Fetched match IDs for session ${sessionId}:`, matchIds);
    return matchIds;
  } catch (err) {
    Sentry.captureException(err, { extra: { sessionId, message: 'Unexpected error in getSessionMatchIds' } });
    console.error('[CoupleModeService] Unexpected error in getSessionMatchIds:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred fetching match IDs.');
  }
};

/**
 * Get session swipes
 */
export const getSessionSwipes = async (sessionId: string): Promise<CoupleSwipe[]> => {
  Sentry.addBreadcrumb({
    category: 'couple.fetch',
    message: 'Fetching couple swipes',
    level: 'debug',
    data: { sessionId },
  });
  try {
    const { data, error } = await supabase
      .from('couple_swipes')
      .select('*')
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error getting session swipes:', error);
      Sentry.captureException(error, { extra: { sessionId } });
      throw error;
    }

    return data;
  } catch (err) {
    Sentry.captureException(err, { extra: { sessionId, message: 'Unexpected error in getSessionSwipes' } });
    console.error('[CoupleModeService] Unexpected error in getSessionSwipes:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred fetching swipes.');
  }
};

/**
 * Get user swipes in a session
 */
export const getUserSwipes = async (sessionId: string, userId: string): Promise<CoupleSwipe[]> => {
  Sentry.addBreadcrumb({
    category: 'couple.fetch',
    message: 'Fetching user swipes',
    level: 'debug',
    data: { sessionId, userId },
  });
  try {
    const { data, error } = await supabase
      .from('couple_swipes')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error getting user swipes:', error);
      Sentry.captureException(error, { extra: { sessionId, userId } });
      throw error;
    }

    return data;
  } catch (err) {
    Sentry.captureException(err, { extra: { sessionId, userId, message: 'Unexpected error in getUserSwipes' } });
    console.error('[CoupleModeService] Unexpected error in getUserSwipes:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred fetching user swipes.');
  }
};

/**
 * Get partner swipes in a session
 */
export const getPartnerSwipes = async (sessionId: string, userId: string): Promise<CoupleSwipe[]> => {
  Sentry.addBreadcrumb({
    category: 'couple.fetch',
    message: 'Fetching partner swipes',
    level: 'debug',
    data: { sessionId, userId },
  });
  try {
    // First, get the session to determine if the user is the creator or joiner
    const { data: session, error: sessionError } = await supabase
      .from('couple_sessions')
      .select('created_by, joined_by')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Error getting session:', sessionError);
      throw sessionError;
    }

    // Determine the partner's ID
    const partnerId = userId === session.created_by ? session.joined_by : session.created_by;

    if (!partnerId) {
      return []; // No partner yet
    }

    // Get the partner's swipes
    const { data, error } = await supabase
      .from('couple_swipes')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', partnerId);

    if (error) {
      console.error('Error getting partner swipes:', error);
      throw error;
    }

    return data;
  } catch (err) {
    Sentry.captureException(err, { extra: { sessionId, userId, message: 'Unexpected error in getPartnerSwipes' } });
    console.error('[CoupleModeService] Unexpected error in getPartnerSwipes:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred fetching partner swipes.');
  }
};

/**
 * End a session
 */
export const endSession = async (sessionId: string): Promise<void> => {
  console.log(`[CoupleModeService] Ending session ${sessionId}`);
  Sentry.addBreadcrumb({
    category: 'couple.session',
    message: 'Ending couple session',
    level: 'info',
    data: { sessionId },
  });
  try {
    const { error } = await supabase
      .from('couple_sessions')
      .update({ 
        status: 'completed',
        deleted_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error ending session:', error);
      Sentry.captureException(error, { extra: { sessionId } });
      throw new Error('Could not end session.');
    }
  } catch (err) {
    Sentry.captureException(err, { extra: { sessionId, message: 'Unexpected error in endSession' } });
    console.error('[CoupleModeService] Unexpected error in endSession:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred ending the session.');
  }
};

/**
 * Get active sessions for a user
 */
export const getActiveSessions = async (userId: string): Promise<CoupleSession[]> => {
  Sentry.addBreadcrumb({
    category: 'couple.fetch',
    message: 'Fetching active sessions for user',
    level: 'debug',
    data: { userId },
  });
  try {
    const { data, error } = await supabase
      .from('couple_sessions')
      .select('*')
      .or(`created_by.eq.${userId},joined_by.eq.${userId}`)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (error) {
      console.error('Error getting active sessions:', error);
      Sentry.captureException(error, { extra: { userId } });
      throw error;
    }

    return data;
  } catch (err) {
    Sentry.captureException(err, { extra: { userId, message: 'Unexpected error in getActiveSessions' } });
    console.error('[CoupleModeService] Unexpected error in getActiveSessions:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred fetching active sessions.');
  }
};

/**
 * Get a session by ID
 */
export const getSessionById = async (sessionId: string): Promise<CoupleSession | null> => {
  Sentry.addBreadcrumb({
    category: 'couple.fetch',
    message: 'Fetching session by ID',
    level: 'debug',
    data: { sessionId },
  });
  try {
    const { data, error } = await supabase
      .from('couple_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) {
      console.error('Error getting session by ID:', error);
      Sentry.captureException(error, { extra: { sessionId } });
      throw error;
    }
    return data as CoupleSession | null;
  } catch (err) {
    Sentry.captureException(err, { extra: { sessionId, message: 'Unexpected error in getSessionById' } });
    console.error('[CoupleModeService] Unexpected error in getSessionById:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred fetching session by ID.');
  }
};

/**
 * Get a session by code
 */
export const getSessionByCode = async (sessionCode: string): Promise<CoupleSession | null> => {
  Sentry.addBreadcrumb({
    category: 'couple.fetch',
    message: 'Fetching session by code',
    level: 'debug',
    data: { sessionCode },
  });
  try {
    const { data, error } = await supabase
      .from('couple_sessions')
      .select('*')
      .eq('session_code', sessionCode)
      .maybeSingle();

    if (error) {
      console.error('Error getting session by code:', error);
      Sentry.captureException(error, { extra: { sessionCode } });
      throw error;
    }
    // Add a check if data is null, indicating not found or RLS restricted
    if (!data) {
        console.log(`[CoupleModeService] Session not found for code ${sessionCode} (or RLS prevented access).`);
        return null;
    }
    return data as CoupleSession | null;
  } catch (err) {
    Sentry.captureException(err, { extra: { sessionCode, message: 'Unexpected error in getSessionByCode' } });
    console.error('[CoupleModeService] Unexpected error in getSessionByCode:', err);
    throw err instanceof Error ? err : new Error('An unexpected error occurred fetching session by code.');
  }
};

/**
 * Subscribe to session updates
 */
export const subscribeToSession = (
  sessionId: string,
  callback: (payload: { new: CoupleSession }) => void
): RealtimeChannel => {
  return supabase
    .channel(`couple_session:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'couple_sessions',
        filter: `id=eq.${sessionId}`
      },
      callback
    )
    .subscribe();
};

/**
 * Subscribe to new matches
 */
export const subscribeToMatches = (
  sessionId: string,
  callback: (payload: { new: CoupleMatch }) => void
): RealtimeChannel => {
  return supabase
    .channel(`couple_matches:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'couple_matches',
        filter: `session_id=eq.${sessionId}`
      },
      callback
    )
    .subscribe();
};

/**
 * Subscribe to new swipes
 */
export const subscribeToSwipes = (
  sessionId: string,
  callback: (payload: { new: CoupleSwipe }) => void
): RealtimeChannel => {
  return supabase
    .channel(`couple_swipes:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'couple_swipes',
        filter: `session_id=eq.${sessionId}`
      },
      callback
    )
    .subscribe();
}; 