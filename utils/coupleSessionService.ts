import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgreeMatch, CoupleSession, FoodItem, SwipeDirection } from '../types/food';

// Keys for AsyncStorage
export const CURRENT_SESSION_KEY = 'CURRENT_SESSION_ID';
export const COUPLE_SESSIONS_KEY = 'COUPLE_SESSIONS';
export const AGREED_MATCHES_KEY = 'AGREED_MATCHES';
export const DECISION_TIME_WINDOW = 120000; // 2 minutes in milliseconds

/**
 * Generate a random 6-digit session code
 */
export const generateSessionCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create a new couple session with better error handling and verification
 */
export const createCoupleSession = async (userId: string): Promise<CoupleSession> => {
  try {
    // Test AsyncStorage first
    const storageTest = await testAsyncStorage();
    if (!storageTest) {
      console.error('[CRITICAL] AsyncStorage test failed before creating session');
      throw new Error('Storage system is not working correctly');
    }
    
    // Generate a unique session ID
    const sessionId = `${Date.now()}`;
    
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Create session object
    const session: CoupleSession = {
      id: sessionId,
      sessionCode: code,
      startTime: Date.now(),
      endTime: 0, // Will be set when the session completes
      status: 'pending',
      participants: [userId],
      currentIndex: 0
    };
    
    console.log(`[DEBUG] Created new session with ID: ${sessionId} and code: ${code}`);
    
    // First, save the session as an individual item for backup
    const individualKey = `SESSION_${sessionId}`;
    await AsyncStorage.setItem(individualKey, JSON.stringify(session));
    console.log(`[DEBUG] Saved individual session at key ${individualKey}`);
    
    // IMPORTANT: Use a more cautious approach with existing sessions
    let sessions: Record<string, CoupleSession> = {};
    
    try {
      const existingSessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
      if (existingSessionsJson) {
        console.log(`[DEBUG] Found existing sessions, will add new session to them`);
        try {
          sessions = JSON.parse(existingSessionsJson);
        } catch (parseError) {
          console.error(`[DEBUG] Error parsing existing sessions, starting fresh:`, parseError);
          // If JSON is invalid, start with empty object
        }
      } else {
        console.log(`[DEBUG] No existing sessions found, creating new sessions object`);
      }
    } catch (readError) {
      console.error('[DEBUG] Error reading existing sessions:', readError);
      // Continue with empty sessions object
    }
    
    // Store the session
    sessions[sessionId] = session;
    
    // Save ALL sessions back to storage
    try {
      const updatedSessionsJson = JSON.stringify(sessions);
      console.log(`[DEBUG] Saving sessions to storage: ${updatedSessionsJson.substring(0, 100)}...`);
      await AsyncStorage.setItem(COUPLE_SESSIONS_KEY, updatedSessionsJson);
      
      // Verify the write succeeded with a separate verification read
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      
      const verifyJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
      if (!verifyJson) {
        throw new Error('Failed to verify session storage - data not found after write');
      }
      
      console.log(`[DEBUG] Verified sessions are saved. Length: ${verifyJson.length}`);
    } catch (writeError: any) {
      console.error('[DEBUG] Error writing sessions:', writeError);
      // If we failed to write to the combined sessions object, we can still recover
      // from the individual session item we saved earlier
      
      throw new Error('Failed to save session: ' + (writeError?.message || 'Unknown error'));
    }
    
    // Set as the current session for this user
    try {
      await AsyncStorage.setItem(CURRENT_SESSION_KEY, sessionId);
      console.log(`[DEBUG] Set current session ID for user to: ${sessionId}`);
    } catch (currentSessionError) {
      console.error('[DEBUG] Error setting current session:', currentSessionError);
      // Session still exists, just not marked as current
    }
    
    return session;
  } catch (error) {
    console.error('Error creating couple session:', error);
    throw error;
  }
};

/**
 * Join an existing couple session with better error handling
 */
export const joinCoupleSession = async (code: string, userId: string): Promise<CoupleSession | null> => {
  try {
    // Test AsyncStorage first
    const storageTest = await testAsyncStorage();
    if (!storageTest) {
      console.error('[CRITICAL] AsyncStorage test failed before joining session');
      throw new Error('Storage system is not working correctly');
    }
    
    console.log(`[DEBUG] Attempting to join session with code: ${code}, userId: ${userId}`);
    
    // First try to get existing sessions
    let sessions: Record<string, CoupleSession> = {};
    let foundSession: CoupleSession | null = null;
    let sessionId = '';
    
    // Try getting from the main sessions object
    try {
      const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
      console.log(`[DEBUG] Retrieved sessions from storage: ${sessionsJson ? 'Found data (length: ' + sessionsJson.length + ')' : 'No data found'}`);
      
      if (sessionsJson) {
        sessions = JSON.parse(sessionsJson);
        console.log(`[DEBUG] Parsed sessions. Number of sessions: ${Object.keys(sessions).length}`);
        
        // Find the session with the matching code
        console.log(`[DEBUG] Looking for session with code: ${code}`);
        for (const id of Object.keys(sessions)) {
          const session = sessions[id];
          console.log(`[DEBUG] Checking session ${id}, code: ${session.sessionCode}, status: ${session.status}`);
          
          if (session.sessionCode === code && session.status === 'pending') {
            console.log(`[DEBUG] Found matching session: ${id}`);
            foundSession = session;
            sessionId = id;
            break;
          }
        }
      }
    } catch (error) {
      console.error('[DEBUG] Error reading sessions:', error);
    }
    
    // If no session found in main storage, try individual session records as fallback
    if (!foundSession) {
      console.log('[DEBUG] No session found in main storage, checking individual session records...');
      
      try {
        // Get all keys to find individual session records
        const keys = await AsyncStorage.getAllKeys();
        const sessionKeys = keys.filter(key => key.startsWith('SESSION_'));
        console.log(`[DEBUG] Found ${sessionKeys.length} individual session records`);
        
        // Check each individual session
        for (const key of sessionKeys) {
          try {
            const sessionJson = await AsyncStorage.getItem(key);
            if (sessionJson) {
              const session: CoupleSession = JSON.parse(sessionJson);
              console.log(`[DEBUG] Checking individual session ${key}, code: ${session.sessionCode}`);
              
              if (session.sessionCode === code && session.status === 'pending') {
                console.log(`[DEBUG] Found matching individual session: ${session.id}`);
                foundSession = session;
                sessionId = session.id;
                
                // Also add this session to the main sessions object if we have a valid ID
                if (sessionId) {
                  sessions[sessionId] = session;
                }
                break;
              }
            }
          } catch (error) {
            console.error(`[DEBUG] Error checking individual session ${key}:`, error);
          }
        }
      } catch (error) {
        console.error('[DEBUG] Error scanning for individual sessions:', error);
      }
    }
    
    if (!foundSession || !sessionId) {
      console.log(`[DEBUG] No active session found with code: ${code}`);
      return null;
    }
    
    // Update the session with the new participant
    if (!foundSession.participants.includes(userId)) {
      foundSession.participants.push(userId);
      console.log(`[DEBUG] Added user ${userId} to participants. New participant list:`, foundSession.participants);
    } else {
      console.log(`[DEBUG] User ${userId} is already in the session`);
    }
    
    // Update the session status if needed
    if (foundSession.participants.length >= 2) {
      foundSession.status = 'active';
      foundSession.startTime = Date.now();
      console.log(`[DEBUG] Session now active with ${foundSession.participants.length} participants`);
    }
    
    // Save the updated session back to AsyncStorage
    try {
      // Only proceed with valid sessionId
      if (sessionId) {
        // Save to both individual record and sessions object for redundancy
        await AsyncStorage.setItem(`SESSION_${sessionId}`, JSON.stringify(foundSession));
        
        // Update in main sessions object
        sessions[sessionId] = foundSession;
        const updatedSessionsJson = JSON.stringify(sessions);
        console.log(`[DEBUG] Saving updated sessions to storage. JSON length: ${updatedSessionsJson.length}`);
        await AsyncStorage.setItem(COUPLE_SESSIONS_KEY, updatedSessionsJson);
        
        // Save the current session ID for this user
        await AsyncStorage.setItem(CURRENT_SESSION_KEY, sessionId);
        console.log(`[DEBUG] Set current session for user ${userId} to ${sessionId}`);
        
        // Verify the session was saved correctly
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        const verifyJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
        if (verifyJson) {
          console.log(`[DEBUG] Verified updated sessions are saved. Length: ${verifyJson.length}`);
        } else {
          console.log(`[DEBUG] WARNING: Failed to verify session storage after update!`);
        }
      }
    } catch (error) {
      console.error('[DEBUG] Error saving updated session:', error);
      // If we failed to update the combined sessions object, at least we have the individual session updated
    }
    
    return foundSession;
  } catch (error) {
    console.error('Error joining couple session:', error);
    return null;
  }
};

/**
 * Get the current session
 */
export const getCurrentSession = async (): Promise<CoupleSession | null> => {
  try {
    const sessionId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    if (!sessionId) {
      console.log('[DEBUG] No current session ID found');
      return null;
    }
    
    // Get all sessions
    const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (!sessionsJson) {
      console.log('[DEBUG] No sessions found in storage');
      return null;
    }
    
    const sessions: Record<string, CoupleSession> = JSON.parse(sessionsJson);
    const session = sessions[sessionId];
    
    if (!session) {
      console.log(`[DEBUG] Session with ID ${sessionId} not found in sessions object`);
      return null;
    }
    
    console.log(`[DEBUG] Retrieved current session: ${sessionId}, status: ${session.status}`);
    return session;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
};

/**
 * Get current session ID 
 */
export const getCurrentSessionId = async (): Promise<string | null> => {
  try {
    const sessionId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    return sessionId;
  } catch (error) {
    console.error('Error getting current session ID:', error);
    return null;
  }
};

/**
 * Check session status
 */
export const checkSessionStatus = async (sessionId: string): Promise<CoupleSession | null> => {
  try {
    const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (!sessionsJson) return null;
    
    const sessions: Record<string, CoupleSession> = JSON.parse(sessionsJson);
    return sessions[sessionId] || null;
  } catch (error) {
    console.error('Error checking session status:', error);
    return null;
  }
};

/**
 * Start the decision timer for the current round
 */
export const startDecisionTimer = async (sessionId: string): Promise<CoupleSession | null> => {
  try {
    const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (!sessionsJson) return null;
    
    const sessions: Record<string, CoupleSession> = JSON.parse(sessionsJson);
    const session = sessions[sessionId];
    
    if (!session) return null;
    
    // Only if session is active
    if (session.status !== 'active') return null;
    
    // Set the decision end time
    session.endTime = Date.now() + DECISION_TIME_WINDOW;
    
    // Update the session in the sessions object
    sessions[sessionId] = session;
    
    // Save updated sessions
    await AsyncStorage.setItem(COUPLE_SESSIONS_KEY, JSON.stringify(sessions));
    
    return session;
  } catch (error) {
    console.error('Error starting decision timer:', error);
    return null;
  }
};

/**
 * Check if the decision time has expired
 */
export const isDecisionTimeExpired = (session: CoupleSession): boolean => {
  // If endTime is 0, no decision timer has been started
  if (session.endTime === 0) return false;
  
  return Date.now() > session.endTime;
};

/**
 * Record a swipe in a couple session
 */
export const recordCoupleSwipe = async (
  sessionId: string,
  userId: string,
  foodItem: FoodItem,
  direction: SwipeDirection
): Promise<AgreeMatch | null> => {
  try {
    // Get the session from the sessions object
    const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (!sessionsJson) {
      console.error(`[DEBUG] No sessions found when recording swipe for ${sessionId}`);
      return null;
    }
    
    const sessions: Record<string, CoupleSession> = JSON.parse(sessionsJson);
    const session = sessions[sessionId];
    
    if (!session) {
      console.error(`[DEBUG] Session ${sessionId} not found when recording swipe`);
      return null;
    }
    
    // Check if session is active
    if (session.status !== 'active') {
      console.log(`[DEBUG] Session ${sessionId} is not active for recording swipe`);
      return null;
    }
    
    // Store this user's swipe
    const swipeKey = `${COUPLE_SESSIONS_KEY}_${sessionId}_swipe_${foodItem.id}`;
    const existingSwipesJson = await AsyncStorage.getItem(swipeKey);
    const swipes: Record<string, SwipeDirection> = existingSwipesJson 
      ? JSON.parse(existingSwipesJson) 
      : {};
    
    // Record this user's swipe
    swipes[userId] = direction;
    await AsyncStorage.setItem(swipeKey, JSON.stringify(swipes));
    
    console.log(`[DEBUG] Recorded swipe for user ${userId} on item ${foodItem.id}: ${direction}`);
    
    // Check if both users have swiped right on this item
    if (Object.keys(swipes).length === 2) {
      const allLiked = Object.values(swipes).every(dir => dir === 'right');
      
      if (allLiked) {
        // Create a match
        const match: AgreeMatch = {
          foodItem,
          timestamp: Date.now()
        };
        
        // Add to agreed matches for this session
        const matchesKey = `${AGREED_MATCHES_KEY}_${sessionId}`;
        const existingMatchesJson = await AsyncStorage.getItem(matchesKey);
        const matches: AgreeMatch[] = existingMatchesJson 
          ? JSON.parse(existingMatchesJson) 
          : [];
        
        matches.push(match);
        await AsyncStorage.setItem(matchesKey, JSON.stringify(matches));
        
        console.log(`[DEBUG] New agreed match in session ${sessionId}: ${foodItem.name}`);
        return match;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error recording couple swipe:', error);
    throw error;
  }
};

/**
 * Get agreed matches for a session
 */
export const getAgreedMatches = async (sessionId: string): Promise<AgreeMatch[]> => {
  try {
    const matchesKey = `${AGREED_MATCHES_KEY}_${sessionId}`;
    const matchesJson = await AsyncStorage.getItem(matchesKey);
    
    if (!matchesJson) return [];
    
    return JSON.parse(matchesJson);
  } catch (error) {
    console.error('Error getting agreed matches:', error);
    return [];
  }
};

/**
 * End the current decision timer and move to the next item
 */
export const endDecisionTimer = async (sessionId: string): Promise<void> => {
  try {
    const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (!sessionsJson) return;
    
    const sessions: Record<string, CoupleSession> = JSON.parse(sessionsJson);
    const session = sessions[sessionId];
    
    if (!session) return;
    
    // Reset the endTime for the next decision
    session.endTime = 0;
    
    // Increment the current index
    session.currentIndex += 1;
    
    // Update the session in the sessions object
    sessions[sessionId] = session;
    
    // Save updated sessions
    await AsyncStorage.setItem(COUPLE_SESSIONS_KEY, JSON.stringify(sessions));
    
    console.log(`Ended decision timer for item at index ${session.currentIndex - 1}`);
  } catch (error) {
    console.error('Error ending decision timer:', error);
    throw error;
  }
};

/**
 * End a couple session
 */
export const endCoupleSession = async (sessionId: string): Promise<void> => {
  try {
    const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (!sessionsJson) return;
    
    const sessions: Record<string, CoupleSession> = JSON.parse(sessionsJson);
    const session = sessions[sessionId];
    
    if (!session) return;
    
    // Mark session as completed
    session.status = 'completed';
    session.endTime = Date.now();
    
    // Update the session in the sessions object
    sessions[sessionId] = session;
    
    // Save updated sessions
    await AsyncStorage.setItem(COUPLE_SESSIONS_KEY, JSON.stringify(sessions));
    
    // Clear current session if it's this one
    const currentSessionId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    if (currentSessionId === sessionId) {
      await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
    }
    
    console.log(`Ended couple session: ${sessionId}`);
  } catch (error) {
    console.error('Error ending couple session:', error);
    throw error;
  }
};

/**
 * Cancel a pending couple session
 */
export const cancelCoupleSession = async (userId: string): Promise<void> => {
  try {
    // Get current session
    const sessionId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    if (!sessionId) return;
    
    console.log(`[DEBUG] Cancelling session ${sessionId} for user ${userId}`);
    
    // Remove the current session reference immediately to prevent race conditions
    await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
    
    const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (!sessionsJson) return;
    
    const sessions: Record<string, CoupleSession> = JSON.parse(sessionsJson);
    const session = sessions[sessionId];
    
    if (!session) {
      console.log(`[DEBUG] Session ${sessionId} not found during cancellation`);
      return;
    }
    
    if (session.status === 'pending') {
      // If this is the creator of the session (first participant), delete the session
      if (session.participants[0] === userId) {
        // Delete the session by removing it from the sessions object
        delete sessions[sessionId];
        
        // Save the updated sessions
        await AsyncStorage.setItem(COUPLE_SESSIONS_KEY, JSON.stringify(sessions));
        
        console.log(`[DEBUG] Session ${sessionId} cancelled and deleted by creator`);
        
        // Also remove any related data for this session
        try {
          const keys = await AsyncStorage.getAllKeys();
          const relatedKeys = keys.filter(key => 
            key.includes(`_${sessionId}_`) || 
            key.includes(`_${sessionId}`)
          );
          
          if (relatedKeys.length > 0) {
            console.log(`[DEBUG] Removing ${relatedKeys.length} related keys for session ${sessionId}`);
            await AsyncStorage.multiRemove(relatedKeys);
          }
        } catch (cleanupError) {
          console.error('[DEBUG] Error cleaning up session data:', cleanupError);
        }
      } else {
        // If this is a participant, remove them from the session
        session.participants = session.participants.filter(id => id !== userId);
        
        // Update the session in the sessions object
        sessions[sessionId] = session;
        
        // Save the updated sessions
        await AsyncStorage.setItem(COUPLE_SESSIONS_KEY, JSON.stringify(sessions));
        
        console.log(`[DEBUG] User ${userId} removed from session ${sessionId}`);
      }
    }
    
    // Wait a moment for changes to be applied
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify that the changes were applied
    const verifyJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (verifyJson) {
      console.log(`[DEBUG] Verified sessions update after cancellation. Length: ${verifyJson.length}`);
    }
  } catch (error) {
    console.error('Error cancelling couple session:', error);
    throw error;
  }
};

/**
 * Clear all current session data
 */
export const clearCurrentSessionData = async (): Promise<void> => {
  try {
    // First try the gentler approach
    await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
    console.log('Cleared current session reference');
    
    // Then verify cleanup was successful
    const currentSessionId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    
    // If we still have a session reference, try a more aggressive approach
    if (currentSessionId) {
      console.warn('Session reference persisted, forcing deep cleanup');
      await deepCleanupAllCoupleModeData();
    }
  } catch (error) {
    console.error('Error clearing current session data:', error);
    // As a last resort for persistent issues
    try {
      await deepCleanupAllCoupleModeData();
    } catch (deepError) {
      console.error('Critical error during deep cleanup:', deepError);
    }
    throw error;
  }
};

/**
 * Update session index
 */
export const updateSessionIndex = async (sessionId: string, index: number): Promise<void> => {
  try {
    const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (!sessionsJson) {
      console.log(`[DEBUG] No sessions found when updating index for ${sessionId}`);
      return;
    }
    
    const sessions: Record<string, CoupleSession> = JSON.parse(sessionsJson);
    const session = sessions[sessionId];
    
    if (!session) {
      console.log(`[DEBUG] Session ${sessionId} not found when updating index`);
      return;
    }
    
    // Update index
    session.currentIndex = index;
    
    // Update the session in the sessions object
    sessions[sessionId] = session;
    
    // Save updated sessions
    await AsyncStorage.setItem(COUPLE_SESSIONS_KEY, JSON.stringify(sessions));
    
    console.log(`[DEBUG] Updated session ${sessionId} index to ${index}`);
  } catch (error) {
    console.error('Error updating session index:', error);
    throw error;
  }
};

/**
 * Deep cleanup of ALL couple mode data (emergency reset)
 * Only use this when there are persistent issues with sessions
 */
export const deepCleanupAllCoupleModeData = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    
    // Find all keys related to couple mode
    const coupleModeKeys = keys.filter(key => 
      key === CURRENT_SESSION_KEY || 
      key.startsWith(COUPLE_SESSIONS_KEY) || 
      key.startsWith(AGREED_MATCHES_KEY)
    );
    
    if (coupleModeKeys.length > 0) {
      await AsyncStorage.multiRemove(coupleModeKeys);
      console.log(`Deep cleaned ${coupleModeKeys.length} couple mode related items from storage`);
    } else {
      console.log('No couple mode data found to clean up');
    }
  } catch (error) {
    console.error('Error during deep cleanup:', error);
    throw error;
  }
};

// Add new function to check storage status
export const checkStorageStatus = async (): Promise<void> => {
  try {
    console.log('[DEBUG] Checking AsyncStorage status:');
    
    // Get and print all keys 
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`[DEBUG] All keys in AsyncStorage: ${allKeys.join(', ')}`);
    
    // Check for current session
    const currentSessionId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    console.log(`[DEBUG] Current session ID: ${currentSessionId || 'None'}`);
    
    // Check for sessions
    const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (sessionsJson) {
      const sessions = JSON.parse(sessionsJson);
      console.log(`[DEBUG] Found ${Object.keys(sessions).length} sessions`);
      Object.keys(sessions).forEach(id => {
        const session = sessions[id];
        console.log(`[DEBUG] Session ${id}: code=${session.sessionCode}, status=${session.status}, participants=${session.participants.length}`);
      });
    } else {
      console.log('[DEBUG] No sessions found');
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error checking storage status:', error);
    return Promise.reject(error);
  }
};

// Add the debugListAllSessions function if not already present
export const debugListAllSessions = async () => {
  try {
    console.log('[DEBUG] Listing all couple sessions:');
    await checkStorageStatus();
    
    const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    if (!sessionsJson) {
      console.log('[DEBUG] No sessions found in storage');
      return {};
    }
    
    const sessions = JSON.parse(sessionsJson);
    console.log('[DEBUG] All sessions:', JSON.stringify(sessions, null, 2));
    
    // Check current session
    const currentSessionId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    console.log(`[DEBUG] Current session ID: ${currentSessionId}`);
    
    return sessions;
  } catch (error) {
    console.error('Error listing sessions:', error);
    return {};
  }
};

/**
 * Direct test function to verify AsyncStorage functionality
 * This bypasses all the session-specific logic and tests raw AsyncStorage
 */
export const testAsyncStorage = async (): Promise<boolean> => {
  try {
    const TEST_KEY = 'TEST_ASYNC_STORAGE_KEY';
    const testValue = { test: true, timestamp: Date.now() };
    const testValueJson = JSON.stringify(testValue);
    
    console.log(`[TEST] Writing test value to AsyncStorage: ${testValueJson}`);
    await AsyncStorage.setItem(TEST_KEY, testValueJson);
    
    // Wait a brief moment to ensure the operation completes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Read the value back
    const readValue = await AsyncStorage.getItem(TEST_KEY);
    console.log(`[TEST] Read back value: ${readValue || 'null'}`);
    
    // Clean up
    await AsyncStorage.removeItem(TEST_KEY);
    
    // Verify the test was successful
    if (readValue === testValueJson) {
      console.log('[TEST] AsyncStorage test passed: write and read successful');
      return true;
    } else {
      console.error('[TEST] AsyncStorage test FAILED: value did not match');
      if (readValue === null) {
        console.error('[TEST] Read returned null - data was not saved');
      } else {
        console.error('[TEST] Read data did not match written data');
      }
      return false;
    }
  } catch (error) {
    console.error('[TEST] AsyncStorage test error:', error);
    return false;
  }
}; 