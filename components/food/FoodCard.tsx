import React, { useState, memo, useCallback, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, Platform, Modal, TouchableOpacity, Pressable, ActivityIndicator } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { FoodItem, SwipeDirection, FoodType } from '@/types/food';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedGestureHandler,
  withSpring,
  withTiming,
  runOnJS
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.92;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.68;
const IMAGE_HEIGHT = CARD_HEIGHT * 0.75;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x300';

interface FoodCardProps {
  food: FoodItem;
  onSwipe: (food: FoodItem, direction: SwipeDirection) => void;
  isFirst: boolean;
  index: number;
}

export interface FoodCardRef {
  reset: () => void;
  like: () => void;
  nope: () => void;
  swipeLocked: () => boolean;
}

const formatDistance = (distance?: number): string => {
  if (distance === undefined) return '';
  if (distance < 0.1) {
    const feet = Math.round(distance * 5280);
    return `${feet} ft`;
  }
  if (distance < 1) {
    return `${distance.toFixed(1)} mi`;
  }
  return `${Math.round(distance)} mi`;
};

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

const formatPriceLevel = (price?: string): { display: string; level: number } => {
  if (!price || price.trim() === '') return { display: '$$', level: 2 };
  if (/^[\$]+$/.test(price)) {
    return { display: price, level: price.length };
  }
  if (price.startsWith('$') && price.length > 1) {
    const numAfterDollar = parseInt(price.substring(1), 10);
    if (!isNaN(numAfterDollar) && numAfterDollar > 0 && numAfterDollar <= 3) {
      return { display: '$'.repeat(numAfterDollar), level: numAfterDollar };
    }
  }
  const numValue = parseInt(price, 10);
  if (!isNaN(numValue) && numValue > 0 && numValue <= 3) {
    return { display: '$'.repeat(numValue), level: numValue };
  }
  const floatValue = parseFloat(price);
  if (!isNaN(floatValue)) {
    if (floatValue < 8) return { display: '$', level: 1 };
    if (floatValue < 15) return { display: '$$', level: 2 };
    return { display: '$$$', level: 3 };
  }
  return { display: '$$', level: 2 };
};

const FoodCardComponent = forwardRef<FoodCardRef, FoodCardProps>((props, ref) => {
  const { food, onSwipe, isFirst, index } = props;
  
  const validatedFood = useMemo(() => {
    return {
      ...food,
      name: food.name || 'Untitled Food',
      description: food.description || 'No description available',
      imageUrl: food.imageUrl || PLACEHOLDER_IMAGE,
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

  const priceInfo = formatPriceLevel(validatedFood.price);

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
    
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    rotate.value = withSpring(0);
    
    swipeLockRef.current = false;
    
    if (isMountedRef.current) {
      setShowLikeIndicator(false);
      setShowNopeIndicator(false);
      setShowMehIndicator(false);
      setLikeOpacity(0);
      setNopeOpacity(0);
      setMehOpacity(0);
    }
  }, [translateX, translateY, rotate]);

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      context.startX = translateX.value;
      context.startY = translateY.value;
    },
    onActive: (event, context) => {
      translateX.value = context.startX + event.translationX;
      translateY.value = context.startY + event.translationY;
      rotate.value = (translateX.value / SCREEN_WIDTH) * 20;

      const rightOpacity = Math.min(Math.max(translateX.value / SWIPE_THRESHOLD, 0), 1);
      const leftOpacity = Math.min(Math.max(-translateX.value / SWIPE_THRESHOLD, 0), 1);
      
      runOnJS(setShowLikeIndicator)(rightOpacity > 0);
      runOnJS(setShowNopeIndicator)(leftOpacity > 0);
      runOnJS(setLikeOpacity)(rightOpacity);
      runOnJS(setNopeOpacity)(leftOpacity);
      runOnJS(setShowMehIndicator)(rightOpacity > 0 && leftOpacity > 0);
      runOnJS(setMehOpacity)(rightOpacity > 0 && leftOpacity > 0 ? 1 : 0);
    },
    onEnd: (event) => {
      if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
        const direction: SwipeDirection = translateX.value > 0 ? 'right' : 'left';
        translateX.value = withTiming(
          direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
          { duration: 250 },
          () => runOnJS(onSwipe)(validatedFood, direction)
        );
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withSpring(0);
        runOnJS(setShowLikeIndicator)(false);
        runOnJS(setShowNopeIndicator)(false);
        runOnJS(setShowMehIndicator)(false);
        runOnJS(setLikeOpacity)(0);
        runOnJS(setNopeOpacity)(0);
        runOnJS(setMehOpacity)(0);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` },
      ],
    };
  });

  const handleLike = useCallback(() => {
    if (!isFirst || swipeLockRef.current) return;
    swipeLockRef.current = true;
    setShowLikeIndicator(true);
    setLikeOpacity(1);
    translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 }, () => {
      runOnJS(onSwipe)(validatedFood, 'right');
    });
  }, [validatedFood, translateX, onSwipe, isFirst]);

  const handleNope = useCallback(() => {
    if (!isFirst || swipeLockRef.current) return;
    swipeLockRef.current = true;
    setShowNopeIndicator(true);
    setNopeOpacity(1);
    translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 }, () => {
      runOnJS(onSwipe)(validatedFood, 'left');
    });
  }, [validatedFood, translateX, onSwipe, isFirst]);

  React.useImperativeHandle(ref, () => ({
    reset: resetCard,
    like: handleLike,
    nope: handleNope,
    swipeLocked: () => swipeLockRef.current
  }));

  const CardContent = (
    <>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: validatedFood.imageUrl }}
          style={styles.image}
          resizeMode="cover"
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
          <View style={styles.priceContainer}>
            <View style={styles.priceDotContainer}>
              <View style={[styles.priceDot, priceInfo.level >= 1 ? styles.priceDotFilled : styles.priceDotEmpty]} />
              <View style={[styles.priceDot, priceInfo.level >= 2 ? styles.priceDotFilled : styles.priceDotEmpty]} />
              <View style={[styles.priceDot, priceInfo.level >= 3 ? styles.priceDotFilled : styles.priceDotEmpty]} />
            </View>
            <Text style={styles.priceText}>{priceInfo.display}</Text>
          </View>
          
          {validatedFood.coordinates && distanceInfo.distance !== undefined && (
            <View style={styles.distanceInfoContainer}>
              <View style={styles.distanceItem}>
                <FontAwesome5 name="map-marker-alt" size={14} color="#FF3B5C" />
                <Text style={styles.distanceText}>
                  {formatDistance(distanceInfo.distance)}
                </Text>
              </View>
              
              {distanceInfo.duration !== undefined && (
                <View style={styles.distanceItem}>
                  <MaterialIcons name="access-time" size={14} color="#FF3B5C" />
                  <Text style={styles.distanceText}>
                    {formatDuration(distanceInfo.duration)}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {validatedFood.coordinates && distanceInfo.distance === undefined && (
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

  const renderDetailsModal = () => (
    <Modal
      visible={detailsVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={closeDetails}
    >
      <Pressable style={styles.modalOverlay} onPress={closeDetails}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{validatedFood.name}</Text>
            <Ionicons name="close" size={24} color="#333" onPress={closeDetails} />
          </View>

          <Image
            source={{ uri: validatedFood.imageUrl }}
            style={styles.modalImage}
            resizeMode="cover"
          />

          <View style={styles.modalDetailsContainer}>
            <View style={styles.modalDetailRow}>
              <Text style={styles.modalDetailLabel}>Restaurant:</Text>
              <Text style={styles.modalDetailText}>{validatedFood.restaurant}</Text>
            </View>

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

            {validatedFood.description && (
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Description:</Text>
                <Text style={styles.modalDetailText}>{validatedFood.description}</Text>
              </View>
            )}

            <View style={styles.deliveryOptions}>
              <Text style={styles.modalDetailLabel}>Order on:</Text>
              <View style={styles.deliveryButtons}>
                {validatedFood.deliveryServices?.map((service, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.deliveryButton}
                    onPress={() => {
                      let url = validatedFood.deliveryUrls?.[service.toLowerCase() as keyof typeof validatedFood.deliveryUrls];
                      if (url) {
                        // Handle opening URL
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

  return (
    <View style={[styles.container, !isFirst && styles.stackedCard]}>
      <PanGestureHandler
        enabled={isFirst && !swipeLockRef.current}
        onGestureEvent={gestureHandler}
      >
        <Animated.View style={[styles.card, animatedStyle]}>
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
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: 'absolute',
    top: 0,
  },
  stackedCard: {
    position: 'absolute',
    top: 0,
  },
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalImage: {
    width: '100%',
    height: 200,
  },
  modalDetailsContainer: {
    padding: 16,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalDetailLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalDetailText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
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
  deliveryOptions: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  deliveryButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  deliveryButton: {
    backgroundColor: '#FFF3F5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFCCD5',
  },
  deliveryButtonText: {
    color: '#FF3B5C',
    fontSize: 14,
    fontWeight: '600',
  },
});

export const FoodCard = memo(FoodCardComponent); 