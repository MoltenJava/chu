import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, Image, Modal, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, interpolate, Extrapolate } from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { SanityMenuItem } from '@/types/sanity';
import { FoodCard } from './FoodCard';
import WaiterButton from './WaiterButton';
import { FoodType, SwipeDirection } from '@/types/food';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.92;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.68;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface SwipeableCardsProps {
  data: SanityMenuItem[];
  onLike?: (food: SanityMenuItem) => void;
  onDislike?: (food: SanityMenuItem) => void;
  onWaiterModeToggle?: (isActive: boolean, restaurant: string | null) => void;
}

// Helper function to log errors with context
const logError = (location: string, error: any, additionalInfo: any = {}) => {
  console.error(`Error in ${location}:`, error, additionalInfo);
};

const SwipeableCardsComponent: React.FC<SwipeableCardsProps> = ({
  data,
  onLike,
  onDislike,
  onWaiterModeToggle
}) => {
  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filteredData, setFilteredData] = useState(data);
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const [waiterModeActive, setWaiterModeActive] = useState(false);
  const [currentRestaurant, setCurrentRestaurant] = useState<string | null>(null);

  // Refs for tracking state without causing effect reruns
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const initialRenderRef = useRef(true);
  const isExitingWaiterModeRef = useRef(false);
  const filteredDataRef = useRef(filteredData);
  const currentIndexRef = useRef(currentIndex);
  const preWaiterModeDataRef = useRef<SanityMenuItem[]>([]);

  // Animations
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardRotate = useSharedValue(0);

  // Update refs when state changes
  useEffect(() => {
    filteredDataRef.current = filteredData;
  }, [filteredData]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Handle waiter mode toggle
  const handleWaiterModeToggle = useCallback((newIsActive: boolean) => {
    console.log(`[WAITER-DEBUG] Toggling waiter mode: ${newIsActive}`);
    console.log(`Current state:
    - waiterMode: ${waiterModeActive}
    - restaurant: ${currentRestaurant}
    - filteredData: ${filteredData.length} items
    - currentIndex: ${currentIndex}`);
    
    if (!isMountedRef.current) return;
    
    if (newIsActive !== waiterModeActive) {
      console.log(`[WAITER-DEBUG] Forcing waiter mode state from ${waiterModeActive} to ${newIsActive}`);
    }
    
    if (newIsActive) {
      // Save current state before entering waiter mode
      preWaiterModeDataRef.current = [...filteredData];
      console.log(`[WAITER-DEBUG] Saved pre-waiter mode data: ${preWaiterModeDataRef.current.length} items`);
      
      const currentItem = filteredData[currentIndex];
      if (currentItem) {
        const restaurant = currentItem.title; // Using title as restaurant name
        
        console.log(`[WAITER-DEBUG] Activating waiter mode for restaurant: ${restaurant}`);
        
        // Find all items for this restaurant in our current dataset
        const restaurantItems = filteredData.filter(item => item.title === restaurant);
        
        if (restaurantItems.length > 1) {
          setWaiterModeActive(true);
          setCurrentRestaurant(restaurant);
          onWaiterModeToggle?.(true, restaurant);
          
          // Reorder items to show current item first
          const currentItemIndex = restaurantItems.findIndex(item => item._id === currentItem._id);
          if (currentItemIndex !== -1) {
            const reorderedItems = [...restaurantItems];
            const [movedItem] = reorderedItems.splice(currentItemIndex, 1);
            reorderedItems.unshift(movedItem);
            setFilteredData(reorderedItems);
            setCurrentIndex(0);
          }
        } else {
          Alert.alert(
            "Waiter Mode",
            `Sorry, we couldn't find enough dishes from ${restaurant}. Waiter mode requires multiple items.`,
            [{ text: "OK" }]
          );
        }
      }
    } else {
      console.log("[WAITER-DEBUG] Deactivating waiter mode - SEAMLESS EXIT");
      isExitingWaiterModeRef.current = true;
      
      const currentItem = filteredData[currentIndex];
      console.log(`[WAITER-DEBUG] Current item before deactivation: ${currentItem?.menu_item} from ${currentItem?.title}, at index ${currentIndex}`);
      
      setWaiterModeActive(false);
      setCurrentRestaurant(null);
      onWaiterModeToggle?.(false, null);
      
      if (preWaiterModeDataRef.current.length > 0 && currentItem) {
        console.log(`[WAITER-DEBUG] Creating new card stack with current item first`);
        
        const originalEntryPoint = preWaiterModeDataRef.current.findIndex(
          item => item.title === currentItem.title
        );
        
        console.log(`[WAITER-DEBUG] Original entry point was index ${originalEntryPoint}`);
        
        const newData = [
          currentItem,
          ...preWaiterModeDataRef.current.slice(originalEntryPoint + 1)
        ];
        
        console.log(`[WAITER-DEBUG] Created new stack with ${newData.length} items`);
        
        setFilteredData(newData);
        setCurrentIndex(0);
        
        setTimeout(() => {
          if (isMountedRef.current) {
            isExitingWaiterModeRef.current = false;
            console.log(`[WAITER-DEBUG] Exit process complete, cleared exiting flag`);
          }
        }, 100);
      }
    }
  }, [currentIndex, filteredData, waiterModeActive, currentRestaurant, onWaiterModeToggle]);

  // Handle swipe action
  const handleSwipe = useCallback((item: SanityMenuItem, direction: SwipeDirection) => {
    if (!isMountedRef.current) return;
    
    try {
      if (direction === 'right') {
        onLike?.(item);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        onDislike?.(item);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      setCurrentIndex(prev => prev + 1);
    } catch (error) {
      logError('handleSwipe', error, { direction, item });
    }
  }, [onLike, onDislike]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      timeoutsRef.current.forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  // Card animation styles
  const cardStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${cardRotate.value}deg` }
      ]
    };
  });

  // Render cards
  const renderCards = useCallback(() => {
    const isFinished = currentIndex >= filteredData.length;

    if (isFinished) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateText}>No more dishes to explore!</Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => setCurrentIndex(0)}
          >
            <Text style={styles.resetButtonText}>Start Over</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isFilterChanging) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B5C" />
        </View>
      );
    }

    if (filteredData.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyStateText}>No dishes match your criteria</Text>
        </View>
      );
    }

    const visibleCards = filteredData.slice(currentIndex, currentIndex + 2);
    
    return (
      <View style={styles.cardsContainer}>
        {visibleCards
          .map((item, index) => {
            const foodItem = {
              id: item._id,
              name: item.menu_item || '',
              description: item.description || '',
              imageUrl: item.s3_url || '',
              restaurant: item.title || '',
              price: item.price_level || item.price?.toString() || '',
              foodType: item.food_type ? [item.food_type as FoodType] : ['comfort' as FoodType],
              cuisine: item.cuisine || '',
              deliveryServices: [],
              deliveryUrls: {
                uberEats: item.uber_eats_url || '',
                doorDash: item.doordash_url || '',
                postmates: item.postmates_url || ''
              },
              address: item.address || '',
              coordinates: {
                latitude: item.latitude || 0,
                longitude: item.longitude || 0
              },
              distanceFromUser: item.distance_from_user || 0,
              estimatedDuration: item.estimated_duration || 0
            };
            
            return (
              <FoodCard
                key={`${item._id}-${currentIndex + index}`}
                food={foodItem}
                onSwipe={(_, direction) => {
                  if (direction === 'left' || direction === 'right') {
                    handleSwipe(item, direction);
                  }
                }}
                isFirst={index === 0}
                index={currentIndex + index}
              />
            );
          })
          .reverse()}
      </View>
    );
  }, [currentIndex, filteredData, isFilterChanging, handleSwipe]);

  return (
    <View style={styles.container}>
      <View style={styles.topToolbar}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FF3B5C' }}>chewz</Text>
        <TouchableOpacity>
          <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      {renderCards()}
      
      <View style={styles.bottomToolbar}>
        <TouchableOpacity>
          <Ionicons name="home-outline" size={28} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="camera-outline" size={28} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="person-outline" size={28} color="#333" />
        </TouchableOpacity>
      </View>
      
      <WaiterButton
        onPress={() => handleWaiterModeToggle(!waiterModeActive)}
        isActive={waiterModeActive}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 80,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: '#FF3B5C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topToolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bottomToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  }
});

export const SwipeableCards = React.memo(SwipeableCardsComponent); 