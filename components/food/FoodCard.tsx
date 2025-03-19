import React, { useState, memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, Platform, Modal, TouchableOpacity, Pressable, ViewStyle } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FoodItem, SwipeDirection } from '../../types/food';
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
  useAnimatedReaction
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

const FoodCardComponent: React.FC<FoodCardProps> = ({ food, onSwipe, isFirst, index }) => {
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showLikeIndicator, setShowLikeIndicator] = useState(false);
  const [showNopeIndicator, setShowNopeIndicator] = useState(false);
  const [showMehIndicator, setShowMehIndicator] = useState(false);
  const [likeOpacity, setLikeOpacity] = useState(0);
  const [nopeOpacity, setNopeOpacity] = useState(0);
  const [mehOpacity, setMehOpacity] = useState(0);
  
  const isMountedRef = useRef(true);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);
  
  const socialProofData = useRef({
    isTrending: food.id.charCodeAt(0) % 3 === 0,
    orderCount: Math.floor(Math.random() * 200) + 10,
    isLimitedTime: food.id.charCodeAt(0) % 5 === 0,
    availableUntil: food.id.charCodeAt(0) % 5 === 0 ? `${Math.floor(Math.random() * 3) + 6}PM` : null
  }).current;

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

  const handleSwipeComplete = useCallback((foodItem: FoodItem, direction: SwipeDirection) => {
    if (!isMountedRef.current) return;
    
    try {
      if (!foodItem || !foodItem.id) {
        console.warn("Invalid food item in handleSwipeComplete");
        return;
      }
      
      const safeFood = {...foodItem};
      
      setTimeout(() => {
        if (isMountedRef.current) {
          onSwipe(safeFood, direction);
        }
      }, 0);
    } catch (error) {
      console.error("Error in handleSwipeComplete:", error);
    }
  }, [onSwipe]);

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: cardScale.value },
        { 
          rotate: `${interpolate(
            translateX.value,
            [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
            [-8, 0, 8],
            Extrapolate.CLAMP
          )}deg` 
        }
      ],
      opacity: cardOpacity.value,
      zIndex: isFirst ? 1 : 0,
    };
  });

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: GestureContext) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
    },
    onActive: (event, ctx) => {
      if (!isFirst) return;
      
      translateX.value = ctx.startX + event.translationX;
      translateY.value = ctx.startY + event.translationY;
      
      if (Math.abs(event.translationX) > 10 || Math.abs(event.translationY) > 10) {
        runOnJS(setIsSwiping)(true);
      }
    },
    onEnd: (event) => {
      if (!isFirst) return;
      
      let direction: SwipeDirection = 'none';
      
      if (event.translationX > SWIPE_THRESHOLD) {
        direction = 'right';
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        direction = 'left';
      } else if (event.translationY < -SWIPE_THRESHOLD) {
        direction = 'up';
      }
      
      if (direction !== 'none') {
        if (direction === 'up') {
          translateY.value = withTiming(
            -SCREEN_HEIGHT * 1.2,
            { duration: 250 },
            () => {
              runOnJS(handleSwipeComplete)(food, direction);
            }
          );
        } else {
          translateX.value = withTiming(
            direction === 'right' ? SCREEN_WIDTH * 1.2 : -SCREEN_WIDTH * 1.2,
            { duration: 250 },
            () => {
              runOnJS(handleSwipeComplete)(food, direction);
            }
          );
          
          translateY.value = withTiming(
            direction === 'right' ? 30 : -30,
            { duration: 250 }
          );
        }
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
      }
      
      runOnJS(setIsSwiping)(false);
    },
  });

  return (
    <>
      <PanGestureHandler enabled={isFirst} onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.card, animatedCardStyle]}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: food.imageUrl }}
              style={styles.image}
              resizeMode="cover"
              defaultSource={PLACEHOLDER_IMAGE}
              onError={(e) => handleImageError(food.imageUrl, e.nativeEvent.error)}
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
              {food.name}
            </Text>
            <View style={styles.detailsRow}>
              <Text style={styles.restaurant} numberOfLines={1} ellipsizeMode="tail">
                {food.restaurant}
              </Text>
              <Text style={styles.price}>
                {food.price}
              </Text>
            </View>
          </View>

          {showLikeIndicator && (
            <View style={[styles.likeContainer, { opacity: likeOpacity }]}>
              <Text style={styles.likeText}>LIKE</Text>
            </View>
          )}
          
          {showNopeIndicator && (
            <View style={[styles.nopeContainer, { opacity: nopeOpacity }]}>
              <Text style={styles.nopeText}>NOPE</Text>
            </View>
          )}
          
          {showMehIndicator && (
            <View style={[styles.mehContainer, { opacity: mehOpacity }]}>
              <Text style={styles.mehText}>MEH</Text>
            </View>
          )}
        </Animated.View>
      </PanGestureHandler>

      <Modal
        animationType="fade"
        transparent={true}
        visible={detailsVisible}
        onRequestClose={closeDetails}
      >
        <Pressable style={styles.modalOverlay} onPress={closeDetails}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Image 
              source={{ uri: food.imageUrl }} 
              style={styles.modalImage}
              resizeMode="cover"
              defaultSource={PLACEHOLDER_IMAGE}
              onError={(e) => handleImageError(food.imageUrl, e.nativeEvent.error)}
            />
            
            <View style={styles.modalInfoContainer}>
              <Text style={styles.modalName}>{food.name}</Text>
              <Text style={styles.modalRestaurant}>{food.restaurant} • {food.price}</Text>
              <Text style={styles.modalCuisine}>{food.cuisine}</Text>
              <Text style={styles.modalDescription}>{food.description}</Text>
              
              <View style={styles.deliveryOptions}>
                {food.deliveryServices && food.deliveryServices.length > 0 ? (
                  food.deliveryServices.map((service, index) => {
                    let iconName: any = 'car-outline';
                    let iconColor = '#FF5A5F';
                    let serviceName = service;
                    
                    if (service.toLowerCase().includes('uber')) {
                      iconName = 'car-outline';
                      iconColor = '#000000';
                      serviceName = 'Uber Eats';
                    } else if (service.toLowerCase().includes('postmates')) {
                      iconName = 'bicycle-outline';
                      iconColor = '#FFBD00';
                      serviceName = 'Postmates';
                    } else if (service.toLowerCase().includes('doordash')) {
                      iconName = 'restaurant-outline';
                      iconColor = '#FF3008';
                      serviceName = 'DoorDash';
                    } else if (service.toLowerCase().includes('grubhub')) {
                      iconName = 'fast-food-outline';
                      iconColor = '#F63440';
                      serviceName = 'Grubhub';
                    }
                    
                    return (
                      <TouchableOpacity key={index} style={styles.deliveryButton}>
                        <Ionicons name={iconName} size={30} color={iconColor} />
                        <Text style={styles.deliveryText}>{serviceName}</Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <>
                    <TouchableOpacity style={styles.deliveryButton}>
                      <Ionicons name="car-outline" size={30} color="#FF5A5F" />
                      <Text style={styles.deliveryText}>Uber Eats</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deliveryButton}>
                      <Ionicons name="bicycle-outline" size={30} color="#FFBD00" />
                      <Text style={styles.deliveryText}>Postmates</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deliveryButton}>
                      <Ionicons name="restaurant-outline" size={30} color="#01A5EC" />
                      <Text style={styles.deliveryText}>DoorDash</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={closeDetails}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

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
    maxWidth: '70%',
  },
  price: {
    color: '#FF3B5C',
    fontSize: 18,
    fontWeight: 'bold',
  },
  likeContainer: {
    position: 'absolute',
    top: 40,
    left: 25,
    transform: [{ rotate: '-20deg' }],
    borderWidth: 5,
    borderColor: '#01DF8B',
    borderRadius: 5,
    padding: 8,
  },
  likeText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#01DF8B',
    letterSpacing: 1,
  },
  nopeContainer: {
    position: 'absolute',
    top: 40,
    right: 25,
    transform: [{ rotate: '20deg' }],
    borderWidth: 5,
    borderColor: '#FF3B5C',
    borderRadius: 5,
    padding: 8,
  },
  nopeText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FF3B5C',
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
  mehContainer: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    transform: [{ rotate: '0deg' }],
    borderWidth: 5,
    borderColor: '#FFA500',
    borderRadius: 5,
    padding: 8,
  },
  mehText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFA500',
    letterSpacing: 1,
  },
}); 