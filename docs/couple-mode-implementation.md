# Couple Mode Implementation Plan

## 1. Database Setup

### 1.1 Create Tables in Supabase

```sql
-- Active couple sessions
create table couple_sessions (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references auth.users(id),
  joined_by uuid references auth.users(id),
  status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  session_code text unique not null, -- For easy sharing
  deleted_at timestamp with time zone -- For soft deletion
);

-- Track swipes in the session
create table couple_swipes (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references couple_sessions(id),
  food_item_id uuid,
  user_id uuid references auth.users(id),
  decision boolean,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  -- Add unique constraint to prevent duplicate swipes
  unique(session_id, user_id, food_item_id)
);

-- Store matches when both users like the same item
create table couple_matches (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references couple_sessions(id),
  food_item_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  -- Add unique constraint to prevent duplicate matches
  unique(session_id, food_item_id)
);

-- Add indexes for performance
create index idx_couple_sessions_code on couple_sessions(session_code);
create index idx_couple_swipes_session on couple_swipes(session_id);
create index idx_couple_matches_session on couple_matches(session_id);
```

## 2. Core Types

```typescript
// types/couple.ts
interface CoupleSession {
  id: string;
  created_by: string;
  joined_by: string | null;
  status: 'active' | 'completed';
  created_at: string;
  session_code: string;
  deleted_at?: string;
}

interface CoupleSwipe {
  id: string;
  session_id: string;
  food_item_id: string;
  user_id: string;
  decision: boolean;
  created_at: string;
}

interface CoupleMatch {
  id: string;
  session_id: string;
  food_item_id: string;
  created_at: string;
}
```

## 3. Service Layer

```typescript
// services/coupleMode.ts
export const coupleModeService = {
  // Create a new session
  async createSession(userId: string): Promise<CoupleSession> {
    const sessionCode = generateSessionCode(); // Implement this helper
    const { data, error } = await supabase
      .from('couple_sessions')
      .insert({
        created_by: userId,
        session_code: sessionCode
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Join an existing session
  async joinSession(userId: string, sessionCode: string): Promise<CoupleSession> {
    const { data, error } = await supabase
      .from('couple_sessions')
      .update({ joined_by: userId })
      .eq('session_code', sessionCode)
      .eq('status', 'active')
      .is('deleted_at', null)
      .is('joined_by', null) // Safety check to avoid overwriting existing joined_by
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Record a swipe
  async recordSwipe(sessionId: string, userId: string, foodItemId: string, decision: boolean): Promise<void> {
    // Use a transaction to ensure atomicity
    const { error } = await supabase.rpc('record_swipe_and_check_match', {
      p_session_id: sessionId,
      p_user_id: userId,
      p_food_item_id: foodItemId,
      p_decision: decision
    });

    if (error) throw error;
  },

  // Get session matches
  async getSessionMatches(sessionId: string): Promise<CoupleMatch[]> {
    const { data, error } = await supabase
      .from('couple_matches')
      .select('*')
      .eq('session_id', sessionId);

    if (error) throw error;
    return data;
  },

  // Soft delete a session
  async endSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('couple_sessions')
      .update({ 
        status: 'completed',
        deleted_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) throw error;
  }
};

// Create a stored procedure for atomic swipe and match checking
// This should be added to your Supabase database
/*
create or replace function record_swipe_and_check_match(
  p_session_id uuid,
  p_user_id uuid,
  p_food_item_id uuid,
  p_decision boolean
) returns void as $$
declare
  v_match_exists boolean;
begin
  -- Insert the swipe
  insert into couple_swipes (session_id, user_id, food_item_id, decision)
  values (p_session_id, p_user_id, p_food_item_id, p_decision)
  on conflict (session_id, user_id, food_item_id) do nothing;
  
  -- Check if both users have swiped right on this item
  select exists (
    select 1 from couple_swipes
    where session_id = p_session_id
    and food_item_id = p_food_item_id
    and decision = true
    group by session_id, food_item_id
    having count(*) = 2
  ) into v_match_exists;
  
  -- If both users liked it, create a match
  if v_match_exists then
    begin
      insert into couple_matches (session_id, food_item_id)
      values (p_session_id, p_food_item_id);
    exception
      when unique_violation then
        -- Ignore duplicate match errors (race condition)
        null;
    end;
  end if;
end;
$$ language plpgsql;
*/
```

## 4. UI Components

### 4.1 Session Creation Modal

```typescript
// components/couple/CreateSessionModal.tsx
const CreateSessionModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSessionCreated: (session: CoupleSession) => void;
}> = ({ visible, onClose, onSessionCreated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleCreate = async () => {
    try {
      setLoading(true);
      setError(null);
      const session = await coupleModeService.createSession(user.id);
      onSessionCreated(session);
      onClose();
    } catch (error) {
      console.error('Error creating session:', error);
      setError('Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Start Couple Mode</Text>
        <Text style={styles.description}>
          Create a session and share the code with your partner
        </Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity 
          style={styles.button}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating...' : 'Create Session'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};
```

### 4.2 Join Session Modal

```typescript
// components/couple/JoinSessionModal.tsx
const JoinSessionModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSessionJoined: (session: CoupleSession) => void;
}> = ({ visible, onClose, onSessionJoined }) => {
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleJoin = async () => {
    try {
      setLoading(true);
      setError(null);
      const session = await coupleModeService.joinSession(user.id, sessionCode);
      onSessionJoined(session);
      onClose();
    } catch (error) {
      console.error('Error joining session:', error);
      setError('Invalid session code or session is no longer active.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Join Couple Mode</Text>
        <TextInput
          style={styles.input}
          value={sessionCode}
          onChangeText={setSessionCode}
          placeholder="Enter session code"
          autoCapitalize="characters"
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity 
          style={styles.button}
          onPress={handleJoin}
          disabled={loading || !sessionCode}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Joining...' : 'Join Session'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};
```

### 4.3 Couple Mode Screen

```typescript
// screens/CoupleModeScreen.tsx
const CoupleModeScreen: React.FC = () => {
  const [session, setSession] = useState<CoupleSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<CoupleMatch[]>([]);
  const [showMatchToast, setShowMatchToast] = useState(false);
  const [lastMatch, setLastMatch] = useState<CoupleMatch | null>(null);
  const [isSwiping, setIsSwiping] = useState(false); // Prevent multiple swipes
  const { user } = useAuth();
  const swipeThrottleRef = useRef<number | null>(null);

  // Subscribe to session updates
  useEffect(() => {
    if (!session) return;

    const subscription = supabase
      .from('couple_sessions')
      .on('UPDATE', payload => {
        setSession(payload.new);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [session]);

  // Subscribe to new matches
  useEffect(() => {
    if (!session) return;

    const subscription = supabase
      .from('couple_matches')
      .on('INSERT', payload => {
        setMatches(prev => [...prev, payload.new]);
        setLastMatch(payload.new);
        setShowMatchToast(true);
        
        // Hide toast after 3 seconds
        setTimeout(() => {
          setShowMatchToast(false);
        }, 3000);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [session]);

  // Subscribe to partner's swipes for sync animation with throttling
  useEffect(() => {
    if (!session) return;

    const subscription = supabase
      .from('couple_swipes')
      .on('INSERT', payload => {
        // Only animate if it's the partner's swipe
        if (payload.new.user_id !== user.id) {
          // Throttle UI updates to prevent performance issues
          if (swipeThrottleRef.current) {
            clearTimeout(swipeThrottleRef.current);
          }
          
          swipeThrottleRef.current = setTimeout(() => {
            // Trigger partner swipe animation
            // This would be implemented in your SwipeableCards component
          }, 100); // 100ms throttle
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      if (swipeThrottleRef.current) {
        clearTimeout(swipeThrottleRef.current);
      }
    };
  }, [session, user.id]);

  const handleSwipe = async (direction: SwipeDirection) => {
    if (!session || isSwiping) return; // Prevent multiple swipes

    try {
      setIsSwiping(true);
      const foodItem = data[currentIndex];
      await coupleModeService.recordSwipe(
        session.id,
        user.id,
        foodItem.id,
        direction === 'right'
      );

      setCurrentIndex(prev => prev + 1);
    } catch (error) {
      console.error('Error recording swipe:', error);
      Alert.alert('Error', 'Failed to record swipe. Please try again.');
    } finally {
      setIsSwiping(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    
    try {
      await coupleModeService.endSession(session.id);
      setSession(null);
    } catch (error) {
      console.error('Error ending session:', error);
      Alert.alert('Error', 'Failed to end session. Please try again.');
    }
  };

  const handleCopySessionCode = () => {
    if (!session) return;
    
    Clipboard.setString(session.session_code);
    Alert.alert('Copied!', 'Session code copied to clipboard');
  };

  const handleShareSessionCode = () => {
    if (!session) return;
    
    Share.share({
      message: `Join my Couple Mode session with code: ${session.session_code}`,
      title: 'Join Couple Mode'
    });
  };

  return (
    <View style={styles.container}>
      {!session ? (
        <View style={styles.startContainer}>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.buttonText}>Start New Session</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => setShowJoinModal(true)}
          >
            <Text style={styles.buttonText}>Join Session</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <View style={styles.sessionCodeContainer}>
              <Text style={styles.sessionCode}>
                Session Code: {session.session_code}
              </Text>
              <View style={styles.codeActions}>
                <TouchableOpacity 
                  style={styles.codeActionButton}
                  onPress={handleCopySessionCode}
                >
                  <Ionicons name="copy-outline" size={20} color="#FF3B5C" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.codeActionButton}
                  onPress={handleShareSessionCode}
                >
                  <Ionicons name="share-outline" size={20} color="#FF3B5C" />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={handleEndSession}>
              <Text style={styles.endButton}>End Session</Text>
            </TouchableOpacity>
          </View>
          <SwipeableCards
            data={data}
            onSwipe={handleSwipe}
            currentIndex={currentIndex}
            disabled={isSwiping} // Disable swiping while processing
          />
          <TouchableOpacity 
            style={styles.matchesButton}
            onPress={() => setShowMatches(true)}
          >
            <Text style={styles.matchesButtonText}>
              View Matches ({matches.length})
            </Text>
          </TouchableOpacity>
          
          {/* Match Toast */}
          {showMatchToast && lastMatch && (
            <Animated.View style={styles.matchToast}>
              <Text style={styles.matchToastText}>It's a match! 🎉</Text>
            </Animated.View>
          )}
        </>
      )}

      <CreateSessionModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSessionCreated={setSession}
      />

      <JoinSessionModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSessionJoined={setSession}
      />

      <MatchesModal
        visible={showMatches}
        onClose={() => setShowMatches(false)}
        matches={matches}
      />
    </View>
  );
};
```

## 5. Implementation Steps

1. **Database Setup**
   - Create the three tables in Supabase
   - Set up appropriate indexes and constraints
   - Add the stored procedure for atomic swipe and match checking
   - Test basic CRUD operations

2. **Core Functionality**
   - Implement the service layer
   - Add helper functions for session code generation
   - Set up real-time subscriptions
   - Implement proper error handling

3. **UI Components**
   - Create the modals for session creation/joining
   - Implement the main couple mode screen
   - Add the matches view
   - Add match toast notifications
   - Add one-tap copy/share for session codes

4. **Integration**
   - Connect the UI to the service layer
   - Add error handling and loading states
   - Implement real-time updates
   - Add partner swipe animations with throttling
   - Implement UI thread safety for swipes

5. **Testing**
   - Test session creation and joining
   - Verify swipe recording
   - Check match detection
   - Test real-time updates
   - Test with simulated latency to ensure smooth experience
   - Test edge cases (simultaneous swipes, network issues)
   - Test race conditions and concurrent operations

6. **Polish**
   - Add animations for matches
   - Improve error messages
   - Add session timeout handling
   - Implement proper cleanup
   - Add partner status indicators
   - Optimize performance with throttling and debouncing

## 6. Additional Features (Post-MVP)

1. **Session Controls**
   - Allow both users to vote on continuing
   - Add session pause/resume
   - Implement session timeout
   - Add session history

2. **Match Management**
   - Add match categories
   - Allow match notes/comments for emotional connection
   - Enable match sharing
   - Add match statistics

3. **UI Enhancements**
   - Add match animations
   - Improve session code sharing
   - Add partner status indicators
   - Add typing indicators when partner is swiping

4. **Future Social Features** (after core loop is addictive)
   - Add friend system
   - Enable social sharing of matches
   - Add couple profiles 