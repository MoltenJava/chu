import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  Modal,
  Alert,
  Share,
  Clipboard,
  Pressable
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { FoodCard } from '../food/FoodCard';
import { CoupleSession, CoupleMatch } from '../../types/database';
import { SupabaseMenuItem } from '../../types/supabase';
import { supabase } from '../../lib/supabase';
import {
  createSession,
  joinSession,
  recordSwipe,
  getSessionMatches,
  endSession,
  subscribeToSession,
  subscribeToMatches
} from '../../utils/coupleModeService';
import { Ionicons } from '@expo/vector-icons';
import { SwipeDirection } from '../../types/food';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CoupleModeScreenProps {
  foodItems: SupabaseMenuItem[];
}

export const CoupleModeScreen: React.FC<CoupleModeScreenProps> = ({ foodItems }) => {
  const [session, setSession] = useState<CoupleSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<CoupleMatch[]>([]);
  const [showMatches, setShowMatches] = useState(false);
  const [sessionCodeInput, setSessionCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasStartedSwiping, setHasStartedSwiping] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [showPartnerJoinedAlert, setShowPartnerJoinedAlert] = useState(false);
  const [isSessionModalVisible, setIsSessionModalVisible] = useState(false);
  
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSessionModalVisible) {
      console.log('[CoupleModeScreen] Session modal is now visible.');
    } else {
      console.log('[CoupleModeScreen] Session modal is now hidden.');
    }
  }, [isSessionModalVisible]);

  useEffect(() => {
    if (!session) return;

    const channel = subscribeToSession(session.id, (payload) => {
      if (payload.new.joined_by && !session.joined_by) {
        setPartnerJoined(true);
        setShowPartnerJoinedAlert(true);
        
        setTimeout(() => {
          setShowPartnerJoinedAlert(false);
        }, 3000);
      }
      
      setSession(payload.new);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const channel = subscribeToMatches(session.id, (payload) => setMatches(prev => [...prev, payload.new]));
    return () => {
      channel.unsubscribe();
    };
  }, [session]);

  const handleSwipe = async (food: SupabaseMenuItem, direction: SwipeDirection) => {
    if (!session || !user || currentIndex >= foodItems.length) return;
    try {
      setIsLoading(true);
      await recordSwipe(
        session.id,
        user.id,
        food.id,
        direction === 'right'
      );
      setCurrentIndex(prev => prev + 1);
    } catch (error) {
      console.error('Error recording swipe:', error);
      Alert.alert('Error', 'Failed to record swipe.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const newSession = await createSession(user.id);
      setSession(newSession);
    } catch {
      Alert.alert('Error', 'Failed to create session.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSession = async () => {
    if (!user || !sessionCodeInput) return;
    try {
      setIsLoading(true);
      const joined = await joinSession(user.id, sessionCodeInput);
      setSession(joined);
      setSessionCodeInput('');
    } catch (error: any) {
      console.error('Error joining session:', error);
      Alert.alert('Error Joining Session', error.message || 'Invalid code or session issue.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    Alert.alert(
      "End Session",
      "Are you sure you want to end this session for both users?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Session",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              setIsSessionModalVisible(false);
              await endSession(session.id);
              Alert.alert('Session Ended', 'The couple session has been ended.');
              setSession(null);
              setCurrentIndex(0);
              setMatches([]);
              setHasStartedSwiping(false);
              setPartnerJoined(false);
              router.back();
            } catch (error) {
              console.error("Error ending session:", error);
              Alert.alert('Error', 'Failed to end session.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleShareCode = () => {
    console.log('[CoupleModeScreen] handleShareCode called!');
    if (!session) return;
    Share.share({ message: `Join me on Chewzee with code: ${session.session_code}` });
  };

  const handleCopyCode = () => {
    if (!session) return;
    Clipboard.setString(session.session_code);
    Alert.alert('Copied', 'Session code copied');
  };

  const handleExit = () => {
    setSession(null);
    setCurrentIndex(0);
    setMatches([]);
    setHasStartedSwiping(false);
    setPartnerJoined(false);
    router.back();
  };

  const handleStartSwiping = () => {
    if (session) {
      router.push(`/couple-swipe?sessionId=${session.id}`);
    }
  };

  const renderWelcome = () => (
    <View style={styles.container}>
      <Text style={styles.heroTitle}>Chewzee Together</Text>
      <Text style={styles.heroSubtitle}>Swipe & Match as a couple</Text>

      <TouchableOpacity style={styles.ctaButton} onPress={handleCreateSession} disabled={isLoading}>
        <Text style={styles.ctaText}>Create Session</Text>
      </TouchableOpacity>

      <Text style={styles.or}>OR</Text>

      <TextInput
        style={styles.input}
        value={sessionCodeInput}
        onChangeText={setSessionCodeInput}
        placeholder="Enter Code"
        keyboardType="number-pad"
        maxLength={6}
      />
      <TouchableOpacity style={styles.joinButton} onPress={handleJoinSession} disabled={!sessionCodeInput}>
        <Text style={styles.ctaText}>Join</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCodeScreen = () => (
    <View style={styles.container}>
      <Text style={styles.instructionText}>Share this code with your partner:</Text>
      <Pressable onPress={() => {
        console.log('[CoupleModeScreen] Pressable tapped, setting modal visible.');
        setIsSessionModalVisible(true);
      }}>
        <View style={styles.codeContainer}>
          <Text style={styles.codeText}>{session?.session_code}</Text>
        </View>
      </Pressable>

      <Text style={styles.waitingText}>
        {session?.joined_by ? 'Partner joined! Ready to swipe.' : 'Waiting for partner...'}
      </Text>

      {session?.joined_by && (
         <TouchableOpacity style={styles.ctaButton} onPress={handleStartSwiping} disabled={isLoading}>
           <Text style={styles.ctaText}>Start Swiping!</Text>
         </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={isSessionModalVisible}
        onRequestClose={() => setIsSessionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Session Code: {session?.session_code}</Text>

            {/* Temporarily comment out modal share button for debugging */}
            {/* <TouchableOpacity style={styles.modalButton} onPress={handleShareCode}>
              <Ionicons name="share-social-outline" size={20} color="#007AFF" />
              <Text style={styles.modalButtonText}>Share Code</Text>
            </TouchableOpacity> */}

            <TouchableOpacity style={styles.modalButton} onPress={handleCopyCode}>
              <Ionicons name="copy-outline" size={20} color="#007AFF" />
              <Text style={styles.modalButtonText}>Copy Code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalButton, styles.endButton]} onPress={handleEndSession}>
               <Ionicons name="exit-outline" size={20} color="#FF3B30" />
               <Text style={[styles.modalButtonText, styles.endButtonText]}>End Session</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalButton, styles.closeButton]} onPress={() => setIsSessionModalVisible(false)}>
               <Text style={[styles.modalButtonText, styles.closeButtonText]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );

  const renderSwiping = () => (
    <View style={styles.container}>
      {showPartnerJoinedAlert && (
        <View style={styles.partnerJoinedAlert}>
          <Text style={styles.partnerJoinedText}>Partner joined! You can now swipe together</Text>
        </View>
      )}
      
      {currentIndex < foodItems.length ? (
        <View style={styles.cardContainer}>
          <FoodCard
            food={foodItems[currentIndex]}
            onSwipe={handleSwipe}
            isFirst={true}
            index={0}
          />
        </View>
      ) : (
        <View style={styles.noMoreItemsContainer}>
          <Text style={styles.noMoreItemsText}>No more items to swipe!</Text>
          <TouchableOpacity style={styles.viewMatchesButton} onPress={() => setShowMatches(true)}>
            <Text style={styles.viewMatchesText}>View Matches ({matches.length})</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <TouchableOpacity style={styles.matchesButton} onPress={() => setShowMatches(true)}>
        <Ionicons name="heart" size={24} color="#FF3B5C" />
        {matches.length > 0 && (
          <View style={styles.matchesBadge}>
            <Text style={styles.matchesCount}>{matches.length}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderMatchesModal = () => (
    <Modal visible={showMatches} transparent animationType="slide" onRequestClose={() => setShowMatches(false)}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>Matches</Text>
        <FlatList
          data={matches.map(m => foodItems.find(f => f.id === m.food_item_id)).filter(Boolean) as SupabaseMenuItem[]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.matchItem}>
              {item.s3_url && <Image source={{ uri: item.s3_url }} style={styles.matchImage} />}
              <Text style={styles.matchName}>{item.name}</Text>
            </View>
          )}
        />
        <TouchableOpacity onPress={() => setShowMatches(false)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {!session ? renderWelcome() : 
       session && !hasStartedSwiping ? renderCodeScreen() : 
       renderSwiping()}
      {renderMatchesModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  heroTitle: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  heroSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24, color: '#666' },
  ctaButton: { backgroundColor: '#FF3B5C', padding: 14, borderRadius: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  or: { textAlign: 'center', marginVertical: 16, color: '#888' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 10, fontSize: 16, marginBottom: 12 },
  joinButton: { backgroundColor: '#FF3B5C', padding: 12, borderRadius: 10, alignItems: 'center' },
  sessionLabel: { fontSize: 18, textAlign: 'center', marginBottom: 8 },
  sessionCode: { fontSize: 28, textAlign: 'center', fontWeight: 'bold', letterSpacing: 4 },
  codeActions: { flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 20 },
  startButton: { backgroundColor: '#FF3B5C', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  modal: { flex: 1, backgroundColor: 'white', padding: 24, paddingTop: 48, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  matchItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  matchImage: { width: 60, height: 60, borderRadius: 10, marginRight: 12 },
  matchName: { fontSize: 16 },
  closeText: { marginTop: 20, textAlign: 'center', color: '#FF3B5C' },
  cardContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noMoreItemsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noMoreItemsText: { fontSize: 18, color: '#666', marginBottom: 16, textAlign: 'center' },
  viewMatchesButton: { backgroundColor: '#FF3B5C', padding: 12, borderRadius: 10 },
  viewMatchesText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  matchesButton: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#fff', padding: 12, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  matchesBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FF3B5C', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  matchesCount: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  partnerJoinedAlert: { position: 'absolute', top: 20, left: 20, right: 20, backgroundColor: '#4CAF50', padding: 12, borderRadius: 8, zIndex: 10 },
  partnerJoinedText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  instructionText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  codeText: {
    fontSize: 40,
    fontWeight: 'bold',
    letterSpacing: 5,
    color: '#FFA500',
    marginRight: 10,
  },
  iconStyle: {
  },
  waitingText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 15,
    width: '100%',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 17,
    marginLeft: 10,
    color: '#007AFF',
    fontWeight: '500',
  },
  endButton: {
    backgroundColor: '#FFEBEB',
  },
  endButtonText: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  closeButton: {
     marginTop: 10,
     backgroundColor: 'transparent',
  },
  closeButtonText: {
      color: '#888',
      fontWeight: 'normal',
  },
});