import React, { useState, memo, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, Platform, Modal, TouchableOpacity, Pressable, ViewStyle, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { FoodItem, SwipeDirection, FoodType } from '../../types/food';
import * as Haptics from 'expo-haptics';
import { PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imageUtils';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedGestureHandler, 
  withSpring, 
  withTiming, 
  runOnJS,
  interpolate,
  Extrapolate,
  useAnimatedReaction,
  useDerivedValue
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.92;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.68;
const IMAGE_HEIGHT = CARD_HEIGHT * 0.75;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

type GestureContext = {
  startX: number;
  startY: number;
};

interface FoodCardProps {
  food: FoodItem;
  onSwipe: (food: FoodItem, direction: SwipeDirection) => void;
  isFirst: boolean;
  index: number;
}

// Debug flag - sync with SwipeableCards
const DEBUG_ENABLED = true;

// Centralized error logging function
const logError = (location: string, error: any, additionalInfo: any = {}) => {
  if (DEBUG_ENABLED) {
    console.error(`[FOOD-CARD-DEBUG] Error in ${location}:`, error);
    console.log(`[FOOD-CARD-DEBUG] Additional info:`, additionalInfo);
    
    // Log stack trace if available
    if (error?.stack) {
      console.log(`[FOOD-CARD-DEBUG] Stack trace:`, error.stack);
    }
  }
};

// Helper function to format distance
const formatDistance = (distance?: number): string => {
  if (distance === undefined) return '';
  
  if (distance < 0.1) {
    // Convert to feet (1 mile = 5280 feet)
    const feet = Math.round(distance * 5280);
    return `${feet} ft`;
  }
  
  if (distance < 1) {
    // Show as fraction of a mile
    return `${distance.toFixed(1)} mi`;
  }
  
  // Round to nearest mile for distances > 1 mile
  return `${Math.round(distance)} mi`;
};

// Helper function to format duration
const formatDuration = (seconds?: number): string => {
  if (seconds === undefined) return '';
  
  const minutes = Math.round(seconds / 60);
  
  if (minutes < 1) return 'Under 1 min';
  if (minutes === 1) return '1 min';
  if (minutes < 60) return `${minutes} min`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  
  if (remainingMins === 0) return `${hours} hr`;
  return `${hours}h ${remainingMins}m`;
};

// Create a better formatPriceLevel function that maintains the beautiful $ circles
const formatPriceLevel = (price?: string): { display: string; level: number } => {
  if (!price || price.trim() === '') return { display: '$$', level: 2 }; // Default
  
  // If price is already formatted as $ or $$ or $$$, convert to level
  if (/^[\$]+$/.test(price)) {
    return { display: price, level: price.length };
  }
  
  // Additional check for "$" prefix but with numbers (e.g., "$2")
  if (price.startsWith('$') && price.length > 1) {
    const numAfterDollar = parseInt(price.substring(1), 10);
    if (!isNaN(numAfterDollar) && numAfterDollar > 0 && numAfterDollar <= 3) {
      return { display: '$'.repeat(numAfterDollar), level: numAfterDollar };
    }
  }
  
  // If it's a number as string, convert to appropriate number of $ symbols
  const numValue = parseInt(price, 10);
  if (!isNaN(numValue) && numValue > 0 && numValue <= 3) {
    return { display: '$'.repeat(numValue), level: numValue };
  }
  
  // For actual dollar amounts (e.g., "12.99"), convert to price level
  const floatValue = parseFloat(price);
  if (!isNaN(floatValue)) {
    if (floatValue < 8) return { display: '$', level: 1 };
    if (floatValue < 15) return { display: '$$', level: 2 };
    return { display: '$$$', level: 3 };
  }
  
  return { display: '$$', level: 2 }; // Default if not matching expected formats
};

// Define the ref type for FoodCard
export interface FoodCardRef {
  reset: () => void;
  like: () => void;
  nope: () => void;
  meh: () => void;
  swipeLocked: () => boolean;
}

const FoodCardComponent = forwardRef<FoodCardRef, FoodCardProps>((props, ref) => {
  const { food, onSwipe, isFirst, index } = props;
  
  // Ensure food object is properly validated with defaults
  const validatedFood = useMemo(() => {
    return {
      ...food,
      name: food.name || 'Untitled Food',
      description: food.description || 'No description available',
      imageUrl: food.imageUrl || 'https://via.placeholder.com/400',
      restaurant: food.restaurant || 'Unknown Restaurant',
      price: food.price || '$$',
      cuisine: food.cuisine || 'Various',
      foodType: Array.isArray(food.foodType) && food.foodType.length > 0 
        ? food.foodType as FoodType[] 
        : ['comfort' as FoodType],
      deliveryServices: Array.isArray(food.deliveryServices) ? food.deliveryServices : [],
      deliveryUrls: food.deliveryUrls || {},
      address: food.address || '',
      coordinates: food.coordinates || { latitude: 0, longitude: 0 }
    };
  }, [food]);
  
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showLikeIndicator, setShowLikeIndicator] = useState(false);
  const [showNopeIndicator, setShowNopeIndicator] = useState(false);
  const [showMehIndicator, setShowMehIndicator] = useState(false);
  const [likeOpacity, setLikeOpacity] = useState(0);
  const [nopeOpacity, setNopeOpacity] = useState(0);
  const [mehOpacity, setMehOpacity] = useState(0);
  const [distanceInfo, setDistanceInfo] = useState({
    distance: food.distanceFromUser,
    duration: food.estimatedDuration
  });
  
  const isMountedRef = useRef(true);
  const gestureEnabledRef = useRef(true);
  const swipeLockRef = useRef(false);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const zIndex = useSharedValue(100 - index);
  
  const socialProofData = useRef({
    isTrending: food.id.charCodeAt(0) % 3 === 0,
    orderCount: Math.floor(Math.random() * 200) + 10,
    isLimitedTime: food.id.charCodeAt(0) % 5 === 0,
    availableUntil: food.id.charCodeAt(0) % 5 === 0 ? `${Math.floor(Math.random() * 3) + 6}PM` : null
  }).current;

  // Format the price for display - get both display format and level
  const priceInfo = formatPriceLevel(validatedFood.price);

  useAnimatedReaction(
    () => {
      return {
        x: translateX.value,
        y: translateY.value,
        isSwiping: isSwiping
      };
    },
    (current, previous) => {
      if (current.isSwiping) {
        const rightOpacity = Math.min(Math.max(current.x / SWIPE_THRESHOLD, 0), 1);
        const leftOpacity = Math.min(Math.max(-current.x / SWIPE_THRESHOLD, 0), 1);
        const upOpacity = Math.min(Math.max(-current.y / SWIPE_THRESHOLD, 0), 1);
        
        if (rightOpacity > 0) {
          runOnJS(setShowLikeIndicator)(true);
        } else {
          runOnJS(setShowLikeIndicator)(false);
        }
        
        if (leftOpacity > 0) {
          runOnJS(setShowNopeIndicator)(true);
        } else {
          runOnJS(setShowNopeIndicator)(false);
        }
        
        if (upOpacity > 0) {
          runOnJS(setShowMehIndicator)(true);
        } else {
          runOnJS(setShowMehIndicator)(false);
        }
        
        runOnJS(setLikeOpacity)(rightOpacity);
        runOnJS(setNopeOpacity)(leftOpacity);
        runOnJS(setMehOpacity)(upOpacity);
      } else {
        runOnJS(setShowLikeIndicator)(false);
        runOnJS(setShowNopeIndicator)(false);
        runOnJS(setShowMehIndicator)(false);
        runOnJS(setLikeOpacity)(0);
        runOnJS(setNopeOpacity)(0);
        runOnJS(setMehOpacity)(0);
      }
    },
    [isSwiping]
  );

  useEffect(() => {
    if (isMountedRef.current && (
      food.distanceFromUser !== distanceInfo.distance || 
      food.estimatedDuration !== distanceInfo.duration
    )) {
      setDistanceInfo({
        distance: food.distanceFromUser,
        duration: food.estimatedDuration
      });
    }
  }, [food.distanceFromUser, food.estimatedDuration, food.name]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const toggleDetails = useCallback(() => {
    if (isMountedRef.current) {
      setDetailsVisible(prev => !prev);
    }
  }, []);

  const closeDetails = useCallback(() => {
    if (isMountedRef.current) {
      setDetailsVisible(false);
    }
  }, []);

  const resetCard = useCallback(() => {
    if (!isMountedRef.current) return;
    
    translateX.value = withSpring(0, {
      damping: 15,
      stiffness: 150
    });
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 150
    });
    
    swipeLockRef.current = false;
    
    if (isMountedRef.current) {
      setIsSwiping(false);
      setShowLikeIndicator(false);
      setShowNopeIndicator(false);
      setShowMehIndicator(false);
      setLikeOpacity(0);
      setNopeOpacity(0);
      setMehOpacity(0);
    }
  }, [translateX, translateY]);

  const safeExecuteSwipe = useCallback((food: FoodItem, direction: SwipeDirection) => {
    try {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        
        const simpleFoodItem: FoodItem = {
          id: food.id,
          name: food.name,
          imageUrl: food.imageUrl,
          restaurant: food.restaurant,
          price: food.price,
          cuisine: food.cuisine,
          description: food.description,
          foodType: [...(food.foodType || [])],
          deliveryServices: [...(food.deliveryServices || [])],
          deliveryUrls: { ...food.deliveryUrls }
        };
        
        onSwipe(simpleFoodItem, direction);
      }, 100);
    } catch (error) {
      // Remove console error that could impact performance
      // console.error('Error during swipe execution:', error);
    } finally {
      if (isMountedRef.current) {
        swipeLockRef.current = false;
      }
    }
  }, [onSwipe]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: cardScale.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: cardOpacity.value,
    zIndex: isFirst ? 100 : zIndex.value,
  }));

  const gestureHandler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    { startX: number; startY: number }
  >({
    onStart: (_event, context) => {
      // Record starting position
      context.startX = translateX.value;
      context.startY = translateY.value;
    },
    
    onActive: (event, context) => {
      // Update position based on gesture - keep it simple
      translateX.value = context.startX + event.translationX;
      translateY.value = context.startY + event.translationY;
      
      // Calculate rotation based on horizontal translation (simple)
      rotate.value = (translateX.value / SCREEN_WIDTH) * 20;
    },
    
    onEnd: (event) => {
      // Simple threshold for completing swipe
      if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
        // Get direction
        const direction: SwipeDirection = translateX.value > 0 ? 'right' : 'left';
        
        // Complete swipe with animation
        translateX.value = withTiming(
          direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5, 
          { duration: 250 },
          () => {
            runOnJS(safeExecuteSwipe)(validatedFood, direction);
          }
        );
      } else {
        // Reset position if not swiped far enough
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withSpring(0);
      }
    },
    
    onCancel: () => {
      // Reset position
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      rotate.value = withSpring(0);
    },
  });

  const handleLike = useCallback(() => {
    if (!isFirst || swipeLockRef.current) return;
    
    swipeLockRef.current = true;
    setIsSwiping(true);
    setShowLikeIndicator(true);
    setLikeOpacity(1);
    
    translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 }, () => {
      runOnJS(safeExecuteSwipe)(validatedFood, 'right');
    });
  }, [validatedFood, translateX, safeExecuteSwipe, isFirst]);

  const handleNope = useCallback(() => {
    if (!isFirst || swipeLockRef.current) return;
    
    swipeLockRef.current = true;
    setIsSwiping(true);
    setShowNopeIndicator(true);
    setNopeOpacity(1);
    
    translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 }, () => {
      runOnJS(safeExecuteSwipe)(validatedFood, 'left');
    });
  }, [validatedFood, translateX, safeExecuteSwipe, isFirst]);

  const handleMeh = useCallback(() => {
    if (!isFirst || swipeLockRef.current) return;
    
    swipeLockRef.current = true;
    setIsSwiping(true);
    setShowMehIndicator(true);
    setMehOpacity(1);
    
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => {
      runOnJS(safeExecuteSwipe)(validatedFood, 'down');
    });
  }, [validatedFood, translateY, safeExecuteSwipe, isFirst]);

  const CardContent = useMemo(() => {
    const currentDistance = distanceInfo.distance;
    const currentDuration = distanceInfo.duration;
    
    return (
      <>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: validatedFood.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            defaultSource={PLACEHOLDER_IMAGE}
            onError={(e) => handleImageError(validatedFood.imageUrl, e.nativeEvent.error)}
          />

          <View style={styles.socialProofContainer}>
            {socialProofData.isTrending && (
              <View style={styles.trendingBadge}>
                <MaterialIcons name="trending-up" size={14} color="#fff" />
                <Text style={styles.trendingText}>Trending</Text>
              </View>
            )}
            
            {socialProofData.orderCount > 50 && (
              <View style={styles.ordersBadge}>
                <Text style={styles.ordersText}>{socialProofData.orderCount}+ ordered today</Text>
              </View>
            )}

            {socialProofData.isLimitedTime && socialProofData.availableUntil && (
              <View style={styles.limitedTimeBadge}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#fff" />
                <Text style={styles.limitedTimeText}>Until {socialProofData.availableUntil}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.infoButton}
            onPress={toggleDetails}
          >
            <Ionicons name="information-circle-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
            {validatedFood.name}
          </Text>
          
          <View style={styles.detailsRow}>
            <Text style={styles.restaurant} numberOfLines={1} ellipsizeMode="tail">
              {validatedFood.restaurant}
            </Text>
          </View>
          
          <View style={styles.metadataRow}>
            {/* Price indicator with circles */}
            {validatedFood.price && validatedFood.price.trim() !== '' && (
              <View style={styles.priceContainer}>
                <View style={styles.priceDotContainer}>
                  <View style={[styles.priceDot, priceInfo.level >= 1 ? styles.priceDotFilled : styles.priceDotEmpty]} />
                  <View style={[styles.priceDot, priceInfo.level >= 2 ? styles.priceDotFilled : styles.priceDotEmpty]} />
                  <View style={[styles.priceDot, priceInfo.level >= 3 ? styles.priceDotFilled : styles.priceDotEmpty]} />
                </View>
                <Text style={styles.priceText}>{priceInfo.display}</Text>
              </View>
            )}
            
            {/* Distance info */}
            {validatedFood.coordinates && currentDistance !== undefined && (
              <View style={styles.distanceInfoContainer}>
                <View style={styles.distanceItem}>
                  <FontAwesome5 name="map-marker-alt" size={14} color="#FF3B5C" />
                  <Text style={styles.distanceText}>
                    {formatDistance(currentDistance)}
                  </Text>
                </View>
                
                {currentDuration !== undefined && (
                  <View style={styles.distanceItem}>
                    <MaterialIcons name="access-time" size={14} color="#FF3B5C" />
                    <Text style={styles.distanceText}>
                      {formatDuration(currentDuration)}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            {/* Loading indicator for distance */}
            {validatedFood.coordinates && currentDistance === undefined && (
              <View style={styles.distanceInfoContainer}>
                <View style={styles.distanceItem}>
                  <FontAwesome5 name="map-marker-alt" size={14} color="#FF3B5C" />
                  <Text style={styles.distanceTextCalculating}>
                    <ActivityIndicator size="small" color="#FF3B5C" style={styles.smallLoader} /> 
                    Calculating...
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </>
    );
  }, [validatedFood, socialProofData, toggleDetails, priceInfo, distanceInfo]);

  const renderDetailsModal = () => (
    <Modal
      visible={detailsVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={closeDetails}
    >
      <Pressable style={styles.modalOverlay} onPress={closeDetails}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{validatedFood.name}</Text>
            <Ionicons name="close" size={24} color="#333" onPress={closeDetails} />
          </View>

          <Image
            source={{ uri: validatedFood.imageUrl }}
            style={styles.modalImage}
            resizeMode="cover"
            defaultSource={PLACEHOLDER_IMAGE}
          />

          <View style={styles.modalDetailsContainer}>
            <View style={styles.modalDetailRow}>
              <Text style={styles.modalDetailLabel}>Restaurant:</Text>
              <Text style={styles.modalDetailText}>{validatedFood.restaurant}</Text>
            </View>

            {validatedFood.price && validatedFood.price.trim() !== '' && (
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Price:</Text>
                <View style={styles.modalPriceContainer}>
                  <View style={styles.priceDotContainer}>
                    <View style={[styles.priceDot, priceInfo.level >= 1 ? styles.priceDotFilled : styles.priceDotEmpty]} />
                    <View style={[styles.priceDot, priceInfo.level >= 2 ? styles.priceDotFilled : styles.priceDotEmpty]} />
                    <View style={[styles.priceDot, priceInfo.level >= 3 ? styles.priceDotFilled : styles.priceDotEmpty]} />
                  </View>
                  <Text style={styles.modalPriceText}>{priceInfo.display}</Text>
                </View>
              </View>
            )}

            {validatedFood.address && (
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Address:</Text>
                <Text style={styles.modalDetailText}>{validatedFood.address}</Text>
              </View>
            )}

            {validatedFood.coordinates && distanceInfo.distance !== undefined && (
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Distance:</Text>
                <View style={styles.modalDistanceContainer}>
                  <FontAwesome5 name="map-marker-alt" size={14} color="#FF3B5C" style={{marginRight: 4}} />
                  <Text style={styles.modalDistanceText}>{formatDistance(distanceInfo.distance)}</Text>
                </View>
              </View>
            )}

            {validatedFood.coordinates && distanceInfo.duration !== undefined && (
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Est. Travel Time:</Text>
                <View style={styles.modalDistanceContainer}>
                  <MaterialIcons name="access-time" size={14} color="#FF3B5C" style={{marginRight: 4}} />
                  <Text style={styles.modalDistanceText}>{formatDuration(distanceInfo.duration)}</Text>
                </View>
              </View>
            )}

            <View style={styles.modalDetailRow}>
              <Text style={styles.modalDetailLabel}>Food Type:</Text>
              <Text style={styles.modalDetailText}>{validatedFood.foodType.join(', ')}</Text>
            </View>

            <View style={styles.modalDetailRow}>
              <Text style={styles.modalDetailLabel}>Description:</Text>
              <Text style={styles.modalDetailText}>{validatedFood.description}</Text>
            </View>

            <View style={styles.deliveryOptions}>
              <Text style={styles.modalDetailLabel}>Order on:</Text>
              <View style={styles.deliveryButtons}>
                {validatedFood.deliveryServices?.map((service, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.deliveryButton}
                    onPress={() => {
                      // Handle delivery service button press
                      let url;
                      if (service === 'UberEats' && validatedFood.deliveryUrls?.uberEats) {
                        url = validatedFood.deliveryUrls.uberEats;
                      } else if (service === 'DoorDash' && validatedFood.deliveryUrls?.doorDash) {
                        url = validatedFood.deliveryUrls.doorDash;
                      } else if (service === 'Postmates' && validatedFood.deliveryUrls?.postmates) {
                        url = validatedFood.deliveryUrls.postmates;
                      }

                      if (url) {
                        // Implement opening URL functionality
                        // console.log(`Opening ${service} URL: ${url}`);
                      }
                    }}
                  >
                    <Text style={styles.deliveryButtonText}>{service}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  React.useImperativeHandle(
    ref,
    () => ({
      reset: resetCard,
      like: handleLike,
      nope: handleNope,
      meh: handleMeh,
      swipeLocked: () => swipeLockRef.current
    })
  );

  return (
    <>
      <PanGestureHandler onGestureEvent={gestureHandler} enabled={isFirst && gestureEnabledRef.current}>
        <Animated.View style={[styles.card, animatedCardStyle]}>
          {CardContent}
          {showLikeIndicator && <View style={[styles.likeIndicator, { opacity: likeOpacity }]}>
            <Text style={styles.indicatorText}>LIKE</Text>
          </View>}
          {showNopeIndicator && <View style={[styles.nopeIndicator, { opacity: nopeOpacity }]}>
            <Text style={styles.indicatorText}>NOPE</Text>
          </View>}
          {showMehIndicator && <View style={[styles.mehIndicator, { opacity: mehOpacity }]}>
            <Text style={styles.indicatorText}>MEH</Text>
          </View>}
        </Animated.View>
      </PanGestureHandler>
      {renderDetailsModal()}
    </>
  );
});

export const FoodCard = memo(FoodCardComponent);

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    backgroundColor: 'white',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    padding: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    height: CARD_HEIGHT - IMAGE_HEIGHT,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
  },
  name: {
    color: '#333',
    fontSize: 22,
    fontWeight: 'bold',
    flexShrink: 1,
    marginBottom: 8,
  },
  restaurant: {
    color: '#666',
    fontSize: 16,
    flexShrink: 1,
    maxWidth: '90%',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 8,
  },
  priceDotContainer: {
    flexDirection: 'row',
    marginRight: 4,
  },
  priceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 2,
  },
  priceDotFilled: {
    backgroundColor: '#FF3B5C',
  },
  priceDotEmpty: {
    backgroundColor: '#FFE0E6',
    borderWidth: 1,
    borderColor: '#FFCCD5',
  },
  priceText: {
    color: '#FF3B5C',
    fontSize: 14,
    fontWeight: '600',
  },
  distanceInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  distanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3F5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFCCD5',
  },
  distanceText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 4,
    fontWeight: '600',
  },
  distanceTextCalculating: {
    fontSize: 13,
    color: '#333',
    marginLeft: 4,
    fontWeight: '500',
  },
  smallLoader: {
    marginRight: 2,
    transform: [{ scale: 0.7 }],
  },
  modalPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3F5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  modalPriceText: {
    color: '#FF3B5C',
    fontSize: 16,
    fontWeight: '600',
  },
  modalDistanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3F5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFCCD5',
  },
  modalDistanceText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  likeIndicator: {
    position: 'absolute',
    top: 40,
    right: 10,
    transform: [{ rotate: '15deg' }],
    borderWidth: 5,
    borderColor: '#01DF8B',
    borderRadius: 5,
    padding: 8,
  },
  nopeIndicator: {
    position: 'absolute',
    top: 40,
    left: 10,
    transform: [{ rotate: '-15deg' }],
    borderWidth: 5,
    borderColor: '#FF3B5C',
    borderRadius: 5,
    padding: 8,
  },
  mehIndicator: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    transform: [{ rotate: '0deg' }],
    borderWidth: 5,
    borderColor: '#FFA500',
    borderRadius: 5,
    padding: 8,
  },
  indicatorText: {
    fontSize: 42,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 1,
  },
  infoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContent: {
    width: '92%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalImage: {
    width: '100%',
    height: 280,
  },
  modalImageOverlay: {
    position: 'absolute',
    top: 180,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalInfoContainer: {
    padding: 22,
  },
  modalName: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#222',
  },
  modalRestaurant: {
    fontSize: 18,
    color: '#444',
    marginBottom: 4,
  },
  modalCuisine: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 20,
  },
  deliveryOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  deliveryButton: {
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  deliveryText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  closeButton: {
    marginVertical: 15,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 35,
    backgroundColor: '#FF3B5C',
    borderRadius: 25,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  socialProofContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: '60%',
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  trendingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  ordersBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  ordersText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  limitedTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  limitedTimeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  modalDetailsContainer: {
    padding: 20,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalDetailLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#444',
  },
  modalDetailText: {
    fontSize: 16,
    color: '#666',
  },
  deliveryButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deliveryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
  },
}); 