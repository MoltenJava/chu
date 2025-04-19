import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Share
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { FoodCard } from '../food/FoodCard';
import { CoupleSession, CoupleMatch, PriceRange } from '../../types/database';
import { SupabaseMenuItem } from '../../types/supabase';
import { 
  recordSwipe, 
  getSessionMatches, 
  endSession,
  subscribeToSession,
  subscribeToMatches
} from '../../utils/coupleModeService';
import { Ionicons } from '@expo/vector-icons';
import { SwipeDirection } from '../../types/food';
import { useRouter, useLocalSearchParams } from 'expo-router';

interface CoupleSwipingScreenProps {
  session: CoupleSession;
  foodItems: SupabaseMenuItem[];
}

// Define our rustic Palm Springs colors
const rustWheat = '#E5D3B3';       // Light tan/wheat color
const rustWood = '#A67C52';        // Medium wood tone
const rustBark = '#715031';        // Darker wood/bark
const rustCharcoal = '#3A3A3A';    // Charcoal gray
const rustEmber = '#BF5942';       // Ember/burnt orange accent
const rustSand = '#DDC9A3';        // Lighter sand color
const rustShadow = '#292522';      // Dark shadow color for text

export const CoupleSwipingScreen: React.FC<CoupleSwipingScreenProps> = ({ session, foodItems }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<CoupleMatch[]>([]);
  const [showMatches, setShowMatches] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [showPartnerJoinedAlert, setShowPartnerJoinedAlert] = useState(false);
  const [currentSession, setCurrentSession] = useState<CoupleSession>(session);
  const [filteredData, setFilteredData] = useState<SupabaseMenuItem[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSwipeInProgress, setIsSwipeInProgress] = useState(false);
  
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Initialize filtered data when food items change
  useEffect(() => {
    if (foodItems && foodItems.length > 0) {
      // Ensure restaurant names are properly set with fallback chain
      const processedFoodItems = foodItems.map(item => {
        // Log each item to debug restaurant names
        console.log(`[COUPLE-SWIPE] Processing item: id=${item.id}, name=${item.name}, restaurant=${item.restaurant?.name || item.title}`);
        
        // Convert price_level to PriceRange type
        const priceRange = (item.price_level === '$' || item.price_level === '$$' || 
                           item.price_level === '$$$' || item.price_level === '$$$$') 
                           ? item.price_level as PriceRange 
                           : '$$' as PriceRange;
        
        return {
          ...item,
          title: item.restaurant?.name || item.title || 'Unknown Restaurant',
          // Preserve the original restaurant object if it exists, only provide fallback if missing
          restaurant: item.restaurant ?? {
            id: item.id,
            place_id: '',
            name: item.title || 'Unknown Restaurant',
            address: item.address || null,
            price_range: priceRange,
            latitude: item.latitude || null,
            longitude: item.longitude || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        };
      });
      setFilteredData(processedFoodItems);
      setIsInitialLoad(false);
    }
  }, [foodItems]);

  // Log the first few items to debug restaurant names
  useEffect(() => {
    if (filteredData.length > 0) {
      console.log('[COUPLE-SWIPE] First 3 food items:');
      filteredData.slice(0, 3).forEach((item, index) => {
        console.log(`[COUPLE-SWIPE] Item ${index}: id=${item.id}, name=${item.name}, restaurant=${item.restaurant?.name || item.title}`);
      });
    }
  }, [filteredData]);

  // Memoize handleSwipe to prevent recreation on every render
  const handleSwipe = useCallback((food: SupabaseMenuItem, direction: SwipeDirection) => {
    if (!user) return;

    recordSwipe(
      session.id,
      user.id,
      food.id,
      direction === 'right'
    )
      .then(() => {
        setCurrentIndex(prev => prev + 1);
      })
      .catch(error => {
        console.error('Error recording swipe:', error);
        Alert.alert('Error', 'Failed to record swipe. Please try again.');
      });
  }, [user, session.id]);

  // Create a stable reference to handleSwipe that won't change
  const stableHandleSwipe = useMemo(() => handleSwipe, [handleSwipe]);

  // Pre-load the next set of cards
  useEffect(() => {
    if (currentIndex < filteredData.length) {
      const nextCards = filteredData.slice(currentIndex, currentIndex + 3);
      nextCards.forEach(card => {
        if (card?.s3_url) {
          Image.prefetch(card.s3_url).catch(() => {});
        }
      });
    }
  }, [currentIndex, filteredData]);

  // Subscribe to session updates
  useEffect(() => {
    if (!currentSession) return;

    const channel = subscribeToSession(currentSession.id, (payload) => {
      // Check if partner has joined
      if (payload.new.joined_by && !currentSession.joined_by) {
        setPartnerJoined(true);
        setShowPartnerJoinedAlert(true);
        
        // Auto-hide the alert after 3 seconds
        setTimeout(() => {
          setShowPartnerJoinedAlert(false);
        }, 3000);
      }
      
      setCurrentSession(payload.new);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [currentSession]);

  // Subscribe to new matches
  useEffect(() => {
    if (!currentSession) return;

    const channel = subscribeToMatches(currentSession.id, (payload) => setMatches(prev => [...prev, payload.new]));
    return () => {
      channel.unsubscribe();
    };
  }, [currentSession]);

  const handleEndSession = useCallback(async () => {
    if (!currentSession) return;
    try {
      setIsLoading(true);
      await endSession(currentSession.id);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to end session.');
    } finally {
      setIsLoading(false);
    }
  }, [currentSession, router]);

  const handleShareSessionCode = useCallback(async () => {
    try {
      const message = `Join my Chewz couple session! Use code: ${session.session_code}`;
      await Share.share({
        message,
        title: 'Join Chewz Couple Session'
      });
    } catch (error) {
      console.error('Error sharing session code:', error);
    }
  }, [session.session_code]);

  const renderToolbar = useCallback(() => (
    <View>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={handleEndSession} style={styles.toolbarButton}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>Couple Mode</Text>
        <TouchableOpacity onPress={() => setShowMatches(true)} style={styles.toolbarButton}>
          <Ionicons name="heart" size={24} color="white" />
          {matches.length > 0 && (
            <View style={styles.matchesBadge}>
              <Text style={styles.matchesCount}>{matches.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.sessionCodeContainer}>
        <Text style={styles.sessionCodeLabel}>Session Code:</Text>
        <Text style={styles.sessionCodeText}>{session.session_code}</Text>
        <TouchableOpacity onPress={handleShareSessionCode} style={styles.shareButton}>
          <Ionicons name="share-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  ), [handleEndSession, matches.length, session.session_code, handleShareSessionCode]);

  // Memoize the entire card stack to prevent re-renders from state changes
  const memoizedCards = useMemo(() => {
    if (filteredData.length === 0 || currentIndex >= filteredData.length) {
      return (
        <View style={styles.noMoreItemsContainer}>
          <Text style={styles.noMoreItemsText}>No more items to swipe!</Text>
          <TouchableOpacity style={styles.viewMatchesButton} onPress={() => setShowMatches(true)}>
            <Text style={styles.viewMatchesText}>View Matches ({matches.length})</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cardContainer}>
        {currentIndex + 2 < filteredData.length && (
          <FoodCard
            key={filteredData[currentIndex + 2].id}
            food={filteredData[currentIndex + 2]}
            onSwipe={stableHandleSwipe}
            isFirst={false}
            index={2}
          />
        )}
        {currentIndex + 1 < filteredData.length && (
          <FoodCard
            key={filteredData[currentIndex + 1].id}
            food={filteredData[currentIndex + 1]}
            onSwipe={stableHandleSwipe}
            isFirst={false}
            index={1}
          />
        )}
        <FoodCard
          key={filteredData[currentIndex].id}
          food={filteredData[currentIndex]}
          onSwipe={stableHandleSwipe}
          isFirst={true}
          index={0}
        />
      </View>
    );
  }, [filteredData, currentIndex, stableHandleSwipe, matches.length]);

  // Render the swiping screen with memoized cards
  const renderSwiping = useCallback(() => (
    <View style={styles.container}>
      {showPartnerJoinedAlert && (
        <View style={styles.partnerJoinedAlert}>
          <Text style={styles.partnerJoinedText}>Partner joined! You can now swipe together</Text>
        </View>
      )}
      
      {isInitialLoad ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B5C" />
        </View>
      ) : (
        memoizedCards
      )}
    </View>
  ), [showPartnerJoinedAlert, isInitialLoad, memoizedCards]);

  const renderMatchesModal = useCallback(() => (
    <Modal visible={showMatches} transparent animationType="slide" onRequestClose={() => setShowMatches(false)}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>Matches</Text>
        <FlatList
          data={matches.map(m => filteredData.find(f => f.id === m.food_item_id)).filter(Boolean) as SupabaseMenuItem[]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.matchItem}>
              {item.s3_url && <Image source={{ uri: item.s3_url }} style={styles.matchImage} />}
              <Text style={styles.matchName}>{item.name}</Text>
            </View>
          )}
        />
        <TouchableOpacity onPress={() => setShowMatches(false)}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  ), [showMatches, matches, filteredData]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {renderToolbar()}
      {renderSwiping()}
      {renderMatchesModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: rustWheat },
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: rustWheat },
  toolbar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: rustWood,
    backgroundColor: rustSand,
    ...Platform.select({
      ios: {
        shadowColor: rustShadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  toolbarTitle: { fontSize: 18, fontWeight: '600', color: rustShadow },
  toolbarButton: { 
    padding: 8,
    borderRadius: 12,
    backgroundColor: rustCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    width: 40,
  },
  cardContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    position: 'relative'
  },
  noMoreItemsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noMoreItemsText: { fontSize: 18, color: rustBark, marginBottom: 16, textAlign: 'center' },
  viewMatchesButton: { backgroundColor: rustEmber, padding: 12, borderRadius: 10 },
  viewMatchesText: { color: rustSand, fontSize: 16, fontWeight: '600' },
  matchesButton: { position: 'absolute', bottom: 20, right: 20, backgroundColor: rustSand, padding: 12, borderRadius: 30, shadowColor: rustShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  matchesBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: rustEmber, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  matchesCount: { color: rustSand, fontSize: 12, fontWeight: 'bold' },
  partnerJoinedAlert: { position: 'absolute', top: 20, left: 20, right: 20, backgroundColor: rustWood, padding: 12, borderRadius: 8, zIndex: 10 },
  partnerJoinedText: { color: rustSand, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  modal: { flex: 1, backgroundColor: rustWheat, padding: 24, paddingTop: 48, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: rustShadow },
  matchItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  matchImage: { width: 60, height: 60, borderRadius: 10, marginRight: 12 },
  matchName: { fontSize: 16, color: rustShadow },
  closeText: { marginTop: 20, textAlign: 'center', color: rustEmber },
  endButton: { position: 'absolute', bottom: 20, left: 20, backgroundColor: rustWheat, padding: 12, borderRadius: 10 },
  endButtonText: { color: rustBark, fontSize: 16, fontWeight: '600' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: rustWheat,
  },
  emptyCard: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  sessionCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: rustSand,
    borderBottomWidth: 1,
    borderBottomColor: rustWood,
  },
  sessionCodeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: rustBark,
    marginRight: 8,
  },
  sessionCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: rustShadow,
    marginRight: 8,
  },
  shareButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: rustCharcoal,
    borderWidth: 1,
    borderColor: rustCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
    height: 34,
    width: 34,
  },
}); 