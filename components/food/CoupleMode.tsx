import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
  Share,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FoodCard } from './FoodCard';
import { FoodItem, CoupleSession, AgreeMatch, SwipeDirection } from '../../types/food';
import { SanityMenuItem } from '@/types/sanity';
import * as Haptics from 'expo-haptics';
import {
  createCoupleSession,
  joinCoupleSession,
  getCurrentSession,
  recordCoupleSwipe,
  getAgreedMatches,
  endCoupleSession,
  updateSessionIndex,
  startDecisionTimer,
  isDecisionTimeExpired,
  endDecisionTimer,
  DECISION_TIME_WINDOW,
  cancelCoupleSession,
  clearCurrentSessionData,
  debugListAllSessions,
  deepCleanupAllCoupleModeData,
  getCurrentSessionId,
  COUPLE_SESSIONS_KEY
} from '../../utils/coupleSessionService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CoupleModeProps {
  data: FoodItem[];
  onExit: () => void;
  userId: string;
}

interface DebugOverlayProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

const DebugOverlay: React.FC<DebugOverlayProps> = ({ visible, onClose, userId }) => {
  const [sessionData, setSessionData] = useState<any>(null);
  const [individualSessions, setIndividualSessions] = useState<any[]>([]);
  const [allKeys, setAllKeys] = useState<string[]>([]);
  
  useEffect(() => {
    if (visible) {
      loadDebugData();
    }
  }, [visible]);
  
  const loadDebugData = async () => {
    try {
      // Get all keys
      const keys = await AsyncStorage.getAllKeys();
      setAllKeys([...keys]); // Convert readonly array to mutable
      
      // Get central sessions data
      const sessionsJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
      if (sessionsJson) {
        setSessionData(JSON.parse(sessionsJson));
      }
      
      // Find individual sessions
      const sessionKeys = keys.filter(k => k.startsWith('SESSION_'));
      const sessions = [];
      for (const key of sessionKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          sessions.push({ key, data: JSON.parse(data) });
        }
      }
      setIndividualSessions(sessions);
    } catch (error) {
      console.error('Error loading debug data:', error);
    }
  };
  
  const clearAllData = async () => {
    try {
      await deepCleanupAllCoupleModeData();
      await loadDebugData();
      Alert.alert('Success', 'All session data cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  };
  
  if (!visible) return null;
  
  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      padding: 20,
      zIndex: 9999,
    }}>
      <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Debug Info</Text>
      <Text style={{ color: 'white', marginBottom: 10 }}>User ID: {userId}</Text>
      
      <ScrollView style={{ flex: 1 }}>
        <Text style={{ color: '#FFD700', marginTop: 10 }}>All AsyncStorage Keys:</Text>
        <Text style={{ color: 'white', fontSize: 12 }}>{JSON.stringify(allKeys, null, 2)}</Text>
        
        <Text style={{ color: '#FFD700', marginTop: 10 }}>Sessions in COUPLE_SESSIONS_KEY:</Text>
        <Text style={{ color: 'white', fontSize: 12 }}>{JSON.stringify(sessionData, null, 2)}</Text>
        
        <Text style={{ color: '#FFD700', marginTop: 10 }}>Individual Sessions:</Text>
        {individualSessions.map((session, index) => (
          <View key={index} style={{ marginBottom: 10 }}>
            <Text style={{ color: '#FF3B5C' }}>{session.key}:</Text>
            <Text style={{ color: 'white', fontSize: 12 }}>{JSON.stringify(session.data, null, 2)}</Text>
          </View>
        ))}
      </ScrollView>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <TouchableOpacity
          style={{ padding: 10, backgroundColor: '#FF3B5C', borderRadius: 5 }}
          onPress={clearAllData}
        >
          <Text style={{ color: 'white' }}>Clear All Data</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{ padding: 10, backgroundColor: '#333', borderRadius: 5 }}
          onPress={onClose}
        >
          <Text style={{ color: 'white' }}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Add this conversion function near the top of the file, before the CoupleMode component
// Convert FoodItem to SanityMenuItem for compatibility with FoodCard
const convertFoodItemToSanity = (food: FoodItem): SanityMenuItem => {
  return {
    _id: food.id,
    _createdAt: new Date().toISOString(),
    title: food.restaurant,
    menu_item: food.name,
    description: food.description,
    s3_url: food.imageUrl,
    postmates_url: food.deliveryUrls?.postmates,
    doordash_url: food.deliveryUrls?.doorDash,
    uber_eats_url: food.deliveryUrls?.uberEats,
    address: food.address || '',
    latitude: food.coordinates?.latitude || 0,
    longitude: food.coordinates?.longitude || 0,
    price: parseFloat(food.price.replace(/[^0-9.]/g, '')) || 0,
    price_level: '$',
    food_type: Array.isArray(food.foodType) ? food.foodType[0] : food.foodType,
    cuisine: food.cuisine,
    distance_from_user: food.distanceFromUser,
    estimated_duration: food.estimatedDuration
  };
};

const CoupleMode: React.FC<CoupleModeProps> = ({ data, onExit, userId }) => {
  // Session state
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<CoupleSession | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [currentFoodItem, setCurrentFoodItem] = useState<FoodItem | null>(null);
  const [agreedMatches, setAgreedMatches] = useState<AgreeMatch[]>([]);
  const [showResults, setShowResults] = useState(false);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add this new state for debug overlay
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  
  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExit();
      return true;
    });
    
    return () => backHandler.remove();
  }, []);
  
  // Load current session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        setIsLoading(true);
        const currentSession = await getCurrentSession();
        if (currentSession) {
          setSession(currentSession);
          
          // Load agreed matches
          const matches = await getAgreedMatches(currentSession.id);
          setAgreedMatches(matches);
          
          // Check timer status
          if (currentSession.endTime > 0) {
            const remaining = Math.max(0, currentSession.endTime - Date.now());
            setTimeLeft(remaining);
            setIsTimerActive(true);
          }
        }
      } catch (error) {
        console.error('Error loading couple session:', error);
        Alert.alert('Error', 'Failed to load couple mode session.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSession();
    
    // Clean up timer on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);
  
  // Update current food item when session changes
  useEffect(() => {
    if (session && data.length > 0) {
      const index = Math.min(session.currentIndex, data.length - 1);
      setCurrentFoodItem(data[index]);
    }
  }, [session, data]);
  
  // Handle timer updates
  useEffect(() => {
    if (isTimerActive && session) {
      // Start the timer
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          const newTime = Math.max(0, prevTime - 1000);
          
          // Check if timer has ended
          if (newTime === 0) {
            clearInterval(timerIntervalRef.current!);
            setIsTimerActive(false);
            
            // Move to next item
            handleTimerEnd();
          }
          
          return newTime;
        });
      }, 1000);
      
      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    }
  }, [isTimerActive, session]);
  
  // Format time left as MM:SS
  const formatTimeLeft = () => {
    const totalSeconds = Math.floor(timeLeft / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Handle timer end
  const handleTimerEnd = async () => {
    if (!session) return;
    
    try {
      await endDecisionTimer(session.id);
      
      // Get updated session
      const updatedSession = await getCurrentSession();
      setSession(updatedSession);
      
      // If we're at the end of the data, show results
      if (updatedSession && updatedSession.currentIndex >= data.length) {
        showFinalResults();
      }
    } catch (error) {
      console.error('Error ending decision timer:', error);
    }
  };
  
  // Handle clean exit
  const handleExit = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      console.log('Exiting couple mode...');
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      // Cancel the session if we have one
      if (session) {
        console.log('Cancelling active session before exit');
        await cancelCoupleSession(userId);
        setSession(null);
      } else {
        // If no session but we might have stale data, clear it
        console.log('No active session found, clearing any stale data');
        await clearCurrentSessionData();
        
        // If we still see issues after trying to clear, do a deep cleanup
        const currentSessionId = await getCurrentSessionId();
        if (currentSessionId) {
          console.log('WARNING: Session data still present after clearing, performing deep cleanup');
          await deepCleanupAllCoupleModeData();
        }
      }
    } catch (error) {
      console.error('Error during exit:', error);
      // Final fallback - deep cleanup on error
      try {
        await deepCleanupAllCoupleModeData();
      } catch (finalError) {
        console.error('Critical error during deep cleanup:', finalError);
      }
    } finally {
      setIsLoading(false);
      if (onExit) onExit();
    }
  };
  
  // Start a new session
  const handleCreateSession = async () => {
    try {
      setIsLoading(true);
      const newSession = await createCoupleSession(userId);
      setSession(newSession);
      
      // Vibrate to confirm
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create a new session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Join an existing session
  const handleJoinSession = async () => {
    if (!joinCode || joinCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-digit session code.');
      return;
    }
    
    try {
      setIsLoading(true);
      const joinedSession = await joinCoupleSession(joinCode, userId);
      
      if (!joinedSession) {
        Alert.alert('Session Not Found', 'No active session found with this code.');
        setIsLoading(false);
        return;
      }
      
      setSession(joinedSession);
      
      // Vibrate to confirm
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error joining session:', error);
      Alert.alert('Error', 'Failed to join session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Share session code
  const handleShareCode = async () => {
    if (!session) return;
    
    try {
      await Share.share({
        message: `Join my Chewz couple mode with code: ${session.sessionCode}`,
      });
    } catch (error) {
      console.error('Error sharing session code:', error);
    }
  };
  
  // Start the decision timer
  const handleStartDecision = async () => {
    if (!session) return;
    
    try {
      const updatedSession = await startDecisionTimer(session.id);
      if (updatedSession) {
        setSession(updatedSession);
        setTimeLeft(DECISION_TIME_WINDOW);
        setIsTimerActive(true);
      }
    } catch (error) {
      console.error('Error starting decision timer:', error);
    }
  };
  
  // Update the handleSwipe function to use the converter
  const handleSwipe = async (food: FoodItem, direction: SwipeDirection) => {
    if (!session || !isTimerActive) return;
    
    try {
      const match = await recordCoupleSwipe(session.id, userId, food, direction);
      
      if (match) {
        // Add match to local state
        setAgreedMatches(prev => [...prev, match]);
        
        // Vibrate to notify of match
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error recording swipe:', error);
    }
  };
  
  // Create a wrapper function to adapt the original handleSwipe to work with SanityMenuItem
  const handleCardSwipe = (food: SanityMenuItem, direction: SwipeDirection) => {
    if (!currentFoodItem) return;
    
    // We're using the actual currentFoodItem from state rather than trying to convert back
    // This ensures we're using the exact same object that's in our state
    handleSwipe(currentFoodItem, direction);
  };
  
  // End session and show results
  const showFinalResults = async () => {
    if (!session) return;
    
    try {
      // End the session
      await endCoupleSession(session.id);
      
      // Get final list of matches
      const finalMatches = await getAgreedMatches(session.id);
      setAgreedMatches(finalMatches);
      
      // Show results screen
      setShowResults(true);
      
      // Stop timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };
  
  // Add handleDebugSessions function
  const handleDebugSessions = async () => {
    console.log("Running session debug...");
    await debugListAllSessions();
    Alert.alert("Debug", "Check console logs for session data");
  };
  
  // Add this function to toggle the debug overlay
  const toggleDebugOverlay = () => {
    setShowDebugOverlay(!showDebugOverlay);
  };
  
  // Update the renderSetupScreen function to use the new styles
  const renderSetupScreen = () => (
    <View style={styles.sessionSelectionContainer}>
      <Text style={styles.title}>Couple Mode</Text>
      <Text style={styles.subtitle}>chewz together</Text>
      
      <View style={styles.optionsContainer}>
        <TouchableOpacity 
          style={[styles.optionButton, styles.createButton]}
          onPress={handleCreateSession}
        >
          <Text style={styles.optionButtonText}>Create New Session</Text>
        </TouchableOpacity>
        
        <View style={styles.separator}>
          <View style={styles.line} />
          <Text style={styles.separatorText}>OR</Text>
          <View style={styles.line} />
        </View>
        
        <View style={styles.joinContainer}>
          <Text style={styles.joinLabel}>Enter 6-digit code:</Text>
          <TextInput
            style={styles.codeInput}
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="Enter 6-digit code"
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity 
            style={[styles.optionButton, styles.joinButton]}
            onPress={handleJoinSession}
          >
            <Text style={styles.optionButtonText}>Join Session</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.cancelButton}
        onPress={handleExit}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
      
      {__DEV__ && (
        <TouchableOpacity style={styles.debugButton} onPress={handleDebugSessions}>
          <Text style={styles.debugButtonText}>Debug Sessions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
  
  // Update the renderWaitingScreen function to use the new styles
  const renderWaitingScreen = () => (
    <View style={styles.sessionSelectionContainer}>
      <Text style={styles.title}>Waiting for Partner</Text>
      <Text style={styles.codeDisplay}>{session?.sessionCode}</Text>
      <Text style={styles.codeInstruction}>Share this code with your partner</Text>
      
      <TouchableOpacity 
        style={[styles.optionButton, styles.createButton]}
        onPress={handleShareCode}
      >
        <Ionicons name="share-outline" size={24} color="white" />
        <Text style={styles.optionButtonText}>Share Code</Text>
      </TouchableOpacity>
      
      <ActivityIndicator size="large" color="#FF3B5C" style={styles.loader} />
      
      <TouchableOpacity 
        style={styles.cancelButton}
        onPress={handleExit}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
      
      {__DEV__ && (
        <TouchableOpacity style={styles.debugButton} onPress={handleDebugSessions}>
          <Text style={styles.debugButtonText}>Debug Sessions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
  
  // Add the renderResultsScreen function
  const renderResultsScreen = () => (
    <View style={styles.matchesContainer}>
      <Text style={styles.matchesHeader}>
        Your Matches!
      </Text>
      <Text style={styles.subtitle}>
        You both swiped right on {agreedMatches.length} items
      </Text>
      
      {agreedMatches.length === 0 ? (
        <View style={styles.container}>
          <MaterialIcons name="sentiment-dissatisfied" size={64} color="#ccc" />
          <Text style={styles.noMatchesText}>No matches found</Text>
        </View>
      ) : (
        <FlatList
          data={agreedMatches}
          keyExtractor={(item) => item.foodItem.id}
          renderItem={({ item }) => (
            <View style={styles.matchCard}>
              <View style={styles.matchImageContainer}>
                <Image 
                  source={{ uri: item.foodItem.imageUrl }} 
                  style={styles.matchImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.matchInfo}>
                <Text style={styles.matchTitle}>{item.foodItem.name}</Text>
                <Text style={styles.matchDescription}>{item.foodItem.description}</Text>
                <Text style={styles.restaurant}>{item.foodItem.restaurant}</Text>
              </View>
            </View>
          )}
        />
      )}
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.doneButton}
          onPress={handleExit}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  // Update the renderActiveSession function to use the converter
  const renderActiveSession = () => (
    <View style={styles.container}>
      {/* Timer */}
      <View style={styles.timerContainer}>
        <Text style={[
          styles.timerText, 
          timeLeft < 10000 && styles.warningText
        ]}>
          {formatTimeLeft()}
        </Text>
        
        {!isTimerActive && (
          <TouchableOpacity 
            style={[styles.optionButton, styles.createButton]}
            onPress={handleStartDecision}
          >
            <Text style={styles.optionButtonText}>Start 2-Minute Timer</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Food Card */}
      <View style={styles.cardContainer}>
        {currentFoodItem && (
          <FoodCard
            food={convertFoodItemToSanity(currentFoodItem)}
            onSwipe={handleCardSwipe}
            isFirst={true}
            index={0}
          />
        )}
      </View>
      
      {/* Match Counter */}
      <View style={styles.statusContainer}>
        <Text style={styles.partnerStatus}>
          {agreedMatches.length} Matches Found
        </Text>
      </View>
      
      {/* End Session Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.doneButton}
          onPress={showFinalResults}
        >
          <Text style={styles.doneButtonText}>End Session & See Results</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  // Main render function
  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B5C" />
          <Text style={styles.loadingText}>Loading couple mode...</Text>
        </View>
      ) : showResults ? (
        renderResultsScreen()
      ) : !session ? (
        renderSetupScreen()
      ) : session.status === 'pending' ? (
        renderWaitingScreen()
      ) : (
        renderActiveSession()
      )}
      
      {__DEV__ && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 40,
            right: 15,
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: 8,
            borderRadius: 4,
            zIndex: 1000,
          }}
          onPress={toggleDebugOverlay}
        >
          <Text style={{ color: 'white', fontSize: 12 }}>DEBUG</Text>
        </TouchableOpacity>
      )}
      
      <DebugOverlay 
        visible={showDebugOverlay} 
        onClose={() => setShowDebugOverlay(false)} 
        userId={userId}
      />
    </View>
  );
};

// Add the SessionSelection component as a new component in the file
const SessionSelection = ({ 
  onCreateSession, 
  onJoinSession, 
  isLoading, 
  joinError, 
  onExit 
}: {
  onCreateSession: () => void;
  onJoinSession: (code: string) => void;
  isLoading: boolean;
  joinError: string | null;
  onExit: () => void;
}) => {
  const [sessionCode, setSessionCode] = useState('');

  const handleDebug = async () => {
    console.log("Running session debug...");
    await debugListAllSessions();
    Alert.alert("Debug", "Check console logs for session data");
  };

  return (
    <View style={styles.sessionSelectionContainer}>
      <Text style={styles.title}>Couple Mode</Text>
      <Text style={styles.subtitle}>Match food with your partner</Text>
      
      <View style={styles.optionsContainer}>
        <TouchableOpacity 
          style={[styles.optionButton, styles.createButton]} 
          onPress={onCreateSession}
          disabled={isLoading}
        >
          <Text style={styles.optionButtonText}>Create New Session</Text>
        </TouchableOpacity>
        
        <View style={styles.separator}>
          <View style={styles.line} />
          <Text style={styles.separatorText}>OR</Text>
          <View style={styles.line} />
        </View>
        
        <View style={styles.joinContainer}>
          <Text style={styles.joinLabel}>Enter 6-digit code:</Text>
          <TextInput
            style={styles.codeInput}
            value={sessionCode}
            onChangeText={setSessionCode}
            placeholder="123456"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={6}
            autoCapitalize="none"
            editable={!isLoading}
          />
          
          <TouchableOpacity 
            style={[
              styles.optionButton, 
              styles.joinButton,
              sessionCode.length !== 6 && styles.disabledButton
            ]} 
            onPress={() => onJoinSession(sessionCode)}
            disabled={sessionCode.length !== 6 || isLoading}
          >
            <Text style={styles.optionButtonText}>Join Session</Text>
          </TouchableOpacity>
          
          {joinError && (
            <Text style={styles.errorText}>{joinError}</Text>
          )}
        </View>
      </View>
      
      {isLoading && (
        <ActivityIndicator size="large" color="#FF3B5C" style={styles.loader} />
      )}
      
      <TouchableOpacity style={styles.backButton} onPress={onExit}>
        <Ionicons name="arrow-back" size={24} color="#333" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      {__DEV__ && (
        <TouchableOpacity style={styles.debugButton} onPress={handleDebug}>
          <Text style={styles.debugButtonText}>Debug Sessions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Clean up the styles
const styles = StyleSheet.create({
  // Core layout
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#555',
  },
  
  // Session Selection
  sessionSelectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
    maxWidth: 400,
  },
  optionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  createButton: {
    backgroundColor: '#FF3B5C',
  },
  joinButton: {
    backgroundColor: '#FF3B5C',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  optionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  separatorText: {
    paddingHorizontal: 10,
    color: '#888',
  },
  joinContainer: {
    width: '100%',
  },
  joinLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  codeInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    textAlign: 'center',
    letterSpacing: 8,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    marginLeft: 5,
    fontSize: 16,
    color: '#333',
  },
  loader: {
    marginTop: 20,
  },
  errorText: {
    color: '#FF3B30',
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  
  // Card Content
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
  },
  cardContent: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 1.2,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    overflow: 'hidden',
  },
  
  // Code Display
  codeDisplay: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 8,
    color: '#FF3B5C',
    marginTop: 20,
    textAlign: 'center',
  },
  codeInstruction: {
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
    fontSize: 16,
  },
  waitingText: {
    marginTop: 30,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  
  // Buttons
  cancelButton: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
  },
  debugButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugButtonText: {
    color: '#666',
  },
  
  // Matches
  matchesContainer: {
    padding: 20,
    flex: 1,
  },
  matchesHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  matchCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    marginBottom: 15,
    padding: 15,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  matchImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 15,
  },
  matchImage: {
    width: '100%',
    height: '100%',
  },
  matchInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  matchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  matchDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  restaurant: {
    fontSize: 14,
    color: '#999',
  },
  noMatchesText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 40,
  },
  
  // Footer
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: '#FF3B5C',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Status and Timer
  statusContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  partnerStatus: {
    fontSize: 12,
    marginLeft: 5,
    color: '#666',
  },
  connectedText: {
    color: '#4CAF50',
  },
  disconnectedText: {
    color: '#FF3B30',
  },
  timerContainer: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
  },
  timerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  warningText: {
    color: '#FF3B30',
  },
});

export default CoupleMode; 