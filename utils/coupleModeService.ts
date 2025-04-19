import { supabase } from '../lib/supabase';
import { CoupleSession, CoupleSwipe, CoupleMatch } from '../types/database';
import { FoodItem } from '../types/food';
import { RealtimeChannel } from '@supabase/supabase-js';

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
    throw new Error('Failed to create couple session.');
  }
  if (!data) {
     console.error('[CoupleModeService] No data returned after creating session');
     throw new Error('Failed to create couple session (no data).');
  }

  console.log('[CoupleModeService] Couple session created:', data);
  return data as CoupleSession;
};

/**
 * Join an existing session using a database function
 */
export const joinSession = async (sessionCode: string, userId: string): Promise<CoupleSession> => {
  console.log(`[CoupleModeService] Calling RPC handle_join_session with code ${sessionCode}, user ${userId}`);
  const { data: updatedSessionData, error: rpcError } = await supabase
    .rpc('handle_join_session', {
      p_session_code: sessionCode, // Pass session code instead of ID
      p_joining_user_id: userId
    })
    .select() // Ensure we select the returned session data
    .single(); // Expect the function to return the single updated row or throw an error

  if (rpcError) {
    console.error('[CoupleModeService] Error calling handle_join_session RPC:', rpcError);
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
    throw new Error('Failed to join session (RPC returned no data).');
  }

  console.log('[CoupleModeService] Successfully joined session:', updatedSessionData);
  return updatedSessionData as CoupleSession;
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
  const params = {
    p_session_id: sessionId,
    p_user_id: userId,
    p_food_item_id: foodItemId,
    p_decision: decision
  };
  console.log(`[CoupleModeService] Calling RPC record_swipe_and_check_match with params:`, JSON.stringify(params));
  
  const { error } = await supabase.rpc('record_swipe_and_check_match', params);

  if (error) {
    console.error('[CoupleModeService] Error calling record_swipe_and_check_match RPC:', error);
    // Re-throw the error so the caller (handleSwipe) can catch it and alert the user
    throw new Error(`Database error recording swipe: ${error.message}`);
  }
  
  console.log(`[CoupleModeService] RPC record_swipe_and_check_match called successfully for user ${userId}, item ${foodItemId}`);
};

/**
 * Get session matches (returns full match objects)
 */
export const getSessionMatches = async (sessionId: string): Promise<CoupleMatch[]> => {
  const { data, error } = await supabase
    .from('couple_matches')
    .select('*')
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error getting session matches:', error);
    throw error;
  }

  return data;
};

/**
 * Get only the food_item_ids for session matches
 */
export const getSessionMatchIds = async (sessionId: string): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from('couple_matches')
    .select('food_item_id') // Select only the food_item_id column
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error getting session match IDs:', error);
    throw new Error('Failed to fetch session match IDs.');
  }

  // Convert the array of objects { food_item_id: string } to a Set of strings
  const matchIds = new Set(data.map(match => match.food_item_id));
  console.log(`[CoupleModeService] Fetched match IDs for session ${sessionId}:`, matchIds);
  return matchIds;
};

/**
 * Get session swipes
 */
export const getSessionSwipes = async (sessionId: string): Promise<CoupleSwipe[]> => {
  const { data, error } = await supabase
    .from('couple_swipes')
    .select('*')
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error getting session swipes:', error);
    throw error;
  }

  return data;
};

/**
 * Get user swipes in a session
 */
export const getUserSwipes = async (sessionId: string, userId: string): Promise<CoupleSwipe[]> => {
  const { data, error } = await supabase
    .from('couple_swipes')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error getting user swipes:', error);
    throw error;
  }

  return data;
};

/**
 * Get partner swipes in a session
 */
export const getPartnerSwipes = async (sessionId: string, userId: string): Promise<CoupleSwipe[]> => {
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
};

/**
 * End a session
 */
export const endSession = async (sessionId: string): Promise<void> => {
  const { error } = await supabase
    .from('couple_sessions')
    .update({ 
      status: 'completed',
      deleted_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error ending session:', error);
    throw error;
  }
};

/**
 * Get active sessions for a user
 */
export const getActiveSessions = async (userId: string): Promise<CoupleSession[]> => {
  const { data, error } = await supabase
    .from('couple_sessions')
    .select('*')
    .or(`created_by.eq.${userId},joined_by.eq.${userId}`)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (error) {
    console.error('Error getting active sessions:', error);
    throw error;
  }

  return data;
};

/**
 * Get a session by ID
 */
export const getSessionById = async (sessionId: string): Promise<CoupleSession | null> => {
  const { data, error } = await supabase
    .from('couple_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('[CoupleModeService] Error fetching session by ID:', error);
    return null;
  }
  return data as CoupleSession | null;
};

/**
 * Get a session by code
 */
export const getSessionByCode = async (sessionCode: string): Promise<CoupleSession | null> => {
    const { data, error } = await supabase
      .from('couple_sessions')
      .select('*')
      .eq('session_code', sessionCode)
      .maybeSingle();

    if (error) {
      console.error('[CoupleModeService] Error fetching session by Code:', error);
      return null;
    }
    // Add a check if data is null, indicating not found or RLS restricted
    if (!data) {
        console.log(`[CoupleModeService] Session not found for code ${sessionCode} (or RLS prevented access).`);
        return null;
    }
    return data as CoupleSession | null;
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