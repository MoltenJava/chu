import React, { useState, memo, useCallback } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, Platform, Modal, TouchableOpacity, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  runOnJS,
  useAnimatedGestureHandler,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { FoodItem, SwipeDirection } from '../../types/food';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.92;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface FoodCardProps {
  food: FoodItem;
  onSwipe: (food: FoodItem, direction: SwipeDirection) => void;
  isFirst: boolean;
  index: number;
}

const FoodCardComponent: React.FC<FoodCardProps> = ({ food, onSwipe, isFirst, index }) => {
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  
  // Shared values for animations
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(index === 0 ? 1 : 0.98 - (index * 0.02));
  
  // Derived value for rotation to optimize performance
  const rotation = useDerivedValue(() => {
    return interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-8, 0, 8]
    );
  });

  // Gesture handler
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
      runOnJS(setIsSwiping)(true);
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;
      translateY.value = ctx.startY + event.translationY * 0.4; // Reduced vertical movement
    },
    onEnd: (event) => {
      const direction = event.translationX > SWIPE_THRESHOLD
        ? 'right'
        : event.translationX < -SWIPE_THRESHOLD
          ? 'left'
          : 'none';

      if (direction !== 'none') {
        // Swipe away animation - faster and smoother
        translateX.value = withTiming(
          direction === 'right' ? SCREEN_WIDTH * 1.2 : -SCREEN_WIDTH * 1.2,
          { duration: 250 },
          () => runOnJS(onSwipe)(food, direction)
        );
        translateY.value = withTiming(
          direction === 'right' ? 40 : -40,
          { duration: 250 }
        );
      } else {
        // Return to center animation - snappier spring
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
          mass: 0.8
        });
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
          mass: 0.8
        });
      }
      runOnJS(setIsSwiping)(false);
    },
  });

  // Animated styles
  const cardStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation.value}deg` },
        { scale: scale.value }
      ],
      zIndex: 1000 - index,
    };
  }, []);

  const likeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.6],
      [0, 1],
      { extrapolateRight: 'clamp' }
    );
    return { opacity };
  });

  const nopeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD * 0.6, 0],
      [1, 0],
      { extrapolateLeft: 'clamp' }
    );
    return { opacity };
  });

  const toggleDetails = useCallback(() => {
    if (!isSwiping) {
      setDetailsVisible(true);
    }
  }, [isSwiping]);

  const closeDetails = useCallback(() => {
    setDetailsVisible(false);
  }, []);

  return (
    <>
      <PanGestureHandler onGestureEvent={gestureHandler} enabled={isFirst}>
        <Animated.View style={[
          styles.card, 
          cardStyle,
          { 
            top: index * 4, // Reduced stacking offset
            opacity: index > 2 ? 0 : 1 - (index * 0.06) // Reduced opacity difference
          }
        ]}>
          <Pressable onPress={toggleDetails} disabled={isSwiping}>
            <View style={styles.cardContent}>
              <Image 
                source={{ uri: food.imageUrl }} 
                style={styles.image}
                resizeMode="cover"
              />
              
              <View style={styles.miniGradientOverlay} />
              
              <View style={styles.overlay}>
                <Animated.View style={[styles.likeContainer, likeStyle]}>
                  <Text style={styles.likeText}>LIKE</Text>
                </Animated.View>
                <Animated.View style={[styles.nopeContainer, nopeStyle]}>
                  <Text style={styles.nopeText}>NOPE</Text>
                </Animated.View>
              </View>

              <View style={styles.infoBar}>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.restaurantName}>{food.restaurant}</Text>
              </View>
            </View>
          </Pressable>
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
            />
            <View style={styles.modalImageOverlay} />
            
            <View style={styles.modalInfoContainer}>
              <Text style={styles.modalName}>{food.name}</Text>
              <Text style={styles.modalRestaurant}>{food.restaurant} • {food.price}</Text>
              <Text style={styles.modalCuisine}>{food.cuisine}</Text>
              <Text style={styles.modalDescription}>{food.description}</Text>
              
              <View style={styles.deliveryOptions}>
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

// Memoize component to prevent unnecessary re-renders
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
  cardContent: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  miniGradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '15%', // Even smaller overlay for text
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
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
  infoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  foodName: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  restaurantName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
}); 