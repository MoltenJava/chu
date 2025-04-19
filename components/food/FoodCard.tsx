import React, { useState, memo, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, Platform, Modal, TouchableOpacity, Pressable, ViewStyle, ActivityIndicator, LayoutChangeEvent, Linking, ScrollView, Alert } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent, TapGestureHandler, State, HandlerStateChangeEvent, TapGestureHandlerEventPayload, TapGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { SwipeDirection, FoodType } from '../../types/food';
import { SupabaseMenuItem } from '../../types/supabase';
import * as Haptics from 'expo-haptics';
import { PLACEHOLDER_IMAGE, handleImageError, safeImagePrefetch } from '../../utils/imageUtils';
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
  useDerivedValue,
  FadeIn,
  Layout,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import AddToPlaylistModal from '../playlists/AddToPlaylistModal';

// Define new color palette
const colorBackground = '#FAFAFA'; // Off-white
const colorTextPrimary = '#212121'; // Dark Gray
const colorTextSecondary = '#757575'; // Medium Gray
const colorBorder = '#E0E0E0';     // Light Gray
const colorAccent = '#FF6F61';     // Coral Pink
const colorWhite = '#FFFFFF';
const colorShadow = '#BDBDBD';     // Medium Gray for shadows
const colorLike = '#4CAF50';      // Green for Like
const colorNope = '#F44336';      // Red for Nope
const colorMeh = '#FFC107';       // Amber for Meh

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * .95;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.77;
const TEXT_CONTENT_HEIGHT = 120;
const IMAGE_HEIGHT = CARD_HEIGHT - TEXT_CONTENT_HEIGHT;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const TOOLBAR_HEIGHT = 80; // Estimate - adjust if needed

// Increase minimum height and define collapse distance
const MIN_IMAGE_HEIGHT = 240; // Further increased to reduce collapse by ~50% more
const SCROLL_DISTANCE_FOR_COLLAPSE = 250; // Make collapse happen over 250px scroll

type GestureContext = {
  startX: number;
  startY: number;
};

interface FoodCardProps {
  food: SupabaseMenuItem;
  onSwipe: (food: SupabaseMenuItem, direction: SwipeDirection) => void;
  isFirst: boolean;
  index: number;
  expandingCardId: string | null;
  globalExpansionProgress: Animated.SharedValue<number>;
  onExpand: (cardId: string) => void;
  onCollapse: () => void;
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
  const {
    food,
    onSwipe,
    isFirst,
    index,
    expandingCardId,
    globalExpansionProgress,
    onExpand,
    onCollapse,
  } = props;
  
  // Add logging to track when actual prop changes occur
  useEffect(() => {
    console.log('[FOOD-CARD] Rendered', food.id, { isFirst, index });
  }, [food.id, isFirst, index]);
  
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showLikeIndicator, setShowLikeIndicator] = useState(false);
  const [showNopeIndicator, setShowNopeIndicator] = useState(false);
  const [showMehIndicator, setShowMehIndicator] = useState(false);
  const [likeOpacity, setLikeOpacity] = useState(0);
  const [nopeOpacity, setNopeOpacity] = useState(0);
  const [mehOpacity, setMehOpacity] = useState(0);
  const [distanceInfo, setDistanceInfo] = useState<{
    distance?: number;
    duration?: number;
    isLoading: boolean;
  }>({
    distance: food.distance_from_user,
    duration: food.estimated_duration,
    isLoading: !food.distance_from_user && !food.estimated_duration
  });
  
  const isMountedRef = useRef(true);
  const gestureEnabledRef = useRef(true);
  const swipeLockRef = useRef(false);
  // Refs for gesture handlers
  const doubleTapRef = useRef<TapGestureHandler>(null);
  const panRef = useRef<PanGestureHandler>(null);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const rotate = useSharedValue(0);
  
  // Add a shared value to track active gesture state for zIndex
  const isActive = useSharedValue(false);
  // Add shared value for scroll position
  const scrollY = useSharedValue(0);

  // Memoize social proof data to prevent recalculation on re-renders
  const socialProofData = useMemo(() => {
    // Use deterministic values based on the food ID instead of random values
    // This ensures the same food always has the same social proof data
    const idHash = food.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const data = {
      isTrending: idHash % 3 === 0,
      orderCount: (idHash % 200) + 10,
      isLimitedTime: idHash % 5 === 0,
      availableUntil: idHash % 5 === 0 ? `${(idHash % 3) + 6}PM` : null
    };
    
    console.log(`[FOOD-CARD] Social proof data calculated for food ${food.id}:`, 
      `isTrending=${data.isTrending}, orderCount=${data.orderCount}, isLimitedTime=${data.isLimitedTime}`);
    
    return data;
  }, [food.id]); // Only recalculate when food.id changes

  // Format the price for display - get both display format and level
  const priceInfo = formatPriceLevel(food.price_level);

  const validatedFood = useMemo(() => {
    const base = {
      ...food,
      menu_item: food.menu_item || food.name || 'Untitled Food',
      description: food.description || 'No description available',
      s3_url: food.s3_url || 'https://via.placeholder.com/400',
      title: food.restaurant?.name || food.title || 'Unknown Restaurant',
      price: food.price || 0,
      price_level: food.price_level || '$$',
      food_type: food.food_type || food.category || 'comfort',
      address: food.address || '',
      latitude: food.latitude || 0,
      longitude: food.longitude || 0,
      uber_eats_url: food.uber_eats_url || '',
      doordash_url: food.doordash_url || '',
      postmates_url: food.postmates_url || '',
      distance_from_user: food.distance_from_user || 0,
      estimated_duration: food.estimated_duration || 0
    };
    return {
      ...base,
      id: food.id || base.id
    };
  }, [food]);

  // Add state for image loading
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const imageOpacity = useSharedValue(0);
  
  // Define unique transition tag for the name here
  const nameTransitionTag = `food-name-${validatedFood.id}`;
  
  // Prefetch image when component mounts
  useEffect(() => {
    const prefetchImage = async () => {
      if (validatedFood.s3_url) {
        try {
          await safeImagePrefetch(validatedFood.s3_url);
        } catch (error) {
          console.warn('Failed to prefetch image:', error);
        }
      }
    };
    prefetchImage();
  }, [validatedFood.s3_url]);

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
    if (isMountedRef.current) {
      setDistanceInfo({
        distance: food.distance_from_user,
        duration: food.estimated_duration,
        isLoading: !food.distance_from_user && !food.estimated_duration
      });
    }
  }, [food.distance_from_user, food.estimated_duration]);

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
    setDetailsVisible(false);
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

  const safeExecuteSwipe = useCallback((food: SupabaseMenuItem, direction: SwipeDirection) => {
    try {
      if (!isMountedRef.current) return;
      
      const menuItem: SupabaseMenuItem = {
        id: food.id,
        _id: food.id,
        _createdAt: food._createdAt,
        restaurant_id: food.restaurant_id ?? '',
        name: food.menu_item,
        menu_item: food.menu_item,
        description: food.description,
        price: food.price,
        category: food.food_type ?? '',
        s3_url: food.s3_url,
        created_at: food._createdAt,
        updated_at: food.updated_at ?? food._createdAt,
        title: food.title,
        price_level: food.price_level ?? '',
        food_type: food.food_type,
        dietary_info: food.dietary_info ?? {
          vegan: false,
          vegetarian: false,
          gluten_free: false,
          dairy_free: false,
          halal: false,
          kosher: false,
          nut_free: false
        },
        spiciness: food.spiciness ?? 0,
        popularity_score: food.popularity_score ?? 0,
        available: food.available ?? true,
        cuisine: food.cuisine,
        distance_from_user: food.distance_from_user,
        estimated_duration: food.estimated_duration,
        address: food.address,
        latitude: food.latitude,
        longitude: food.longitude,
        uber_eats_url: food.uber_eats_url,
        doordash_url: food.doordash_url,
        postmates_url: food.postmates_url
      };
      
      onSwipe(menuItem, direction);
    } catch (error) {
      // Log error more informatively if possible
      console.error("[FoodCard] Error during onSwipe execution:", error);
    } finally {
      // This finally block ensures lock is released even if onSwipe errors
      if (isMountedRef.current) {
        swipeLockRef.current = false;
        setIsSwiping(false);
      }
    }
  }, [onSwipe]);

  // Modified animatedCardStyle
  const animatedCardStyle = useAnimatedStyle(() => {
    'worklet'; // Ensure this runs on the UI thread

    const isCurrentlyExpanding = expandingCardId === food.id;
    const isAnyCardExpanding = expandingCardId !== null;
    const expansionProgress = globalExpansionProgress.value; // Use global value

    // --- Expansion Animations ---
    const expandedWidth = interpolate(expansionProgress, [0, 1], [CARD_WIDTH, SCREEN_WIDTH], Extrapolate.CLAMP);
    const expandedHeight = interpolate(expansionProgress, [0, 1], [CARD_HEIGHT, SCREEN_HEIGHT], Extrapolate.CLAMP);
    const expandedBorderRadius = interpolate(expansionProgress, [0, 1], [20, 0], Extrapolate.CLAMP);
    const expandedTranslateY = interpolate(expansionProgress, [0, 1], [0, 0], Extrapolate.CLAMP);

    // --- Swipe Animations (applied when NOT expanding) ---
    const swipeRotateZ = interpolate(translateX.value, [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2], [-15, 0, 15], Extrapolate.CLAMP);

    // --- Combine Animations ---
    const currentTranslateX = interpolate(expansionProgress, [0, 1], [translateX.value, 0]);
    const currentTranslateY = interpolate(expansionProgress, [0, 1], [translateY.value, expandedTranslateY]);
    const currentRotateZ = interpolate(expansionProgress, [0, 1], [swipeRotateZ, 0]);

    // --- Z-Index Logic ---
    const zIndex = interpolate(
      expansionProgress,
      [0, 1],
      [isFirst && !isAnyCardExpanding ? (isActive.value ? 100 : 10) : (isActive.value ? 100 : index),
       isCurrentlyExpanding ? 200 : index],
      Extrapolate.CLAMP
    );

    // --- Opacity Logic ---
    const opacity = interpolate(
      expansionProgress,
      [0, 0.5, 1], // Start fading quickly
      [cardOpacity.value, isCurrentlyExpanding ? cardOpacity.value : 0, isCurrentlyExpanding ? 1 : 0], // Non-first cards disappear
      Extrapolate.CLAMP
    );
    
    if (isAnyCardExpanding && !isCurrentlyExpanding) {
        return {
            position: 'absolute',
            opacity: 0,
            transform: [{ scale: 0.9 }], 
            width: CARD_WIDTH,
            height: CARD_HEIGHT, 
            zIndex: 0,
        };
    }

    return {
      position: 'absolute',
      width: expandedWidth,
      height: expandedHeight,
      borderRadius: expandedBorderRadius,
      opacity: opacity,
      zIndex: zIndex,
      transform: [
        { translateX: currentTranslateX },
        { translateY: currentTranslateY },
        { rotateZ: `${currentRotateZ}deg` },
        { scale: interpolate(expansionProgress, [0, 1], [1, 1]) }
      ],
    };
  }, [isFirst, index, expandingCardId, globalExpansionProgress, translateX, translateY, isActive, cardOpacity]);

  const likeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD * 0.75], [0, 1]),
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` }
    ]
  }));

  const gestureHandler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    { startX: number; startY: number }
  >({
    onStart: (_, context) => {
      if (swipeLockRef.current) return;
      context.startX = translateX.value;
      context.startY = translateY.value;
      runOnJS(setIsSwiping)(true);
      isActive.value = true;
    },
    
    onActive: (event, context) => {
      if (swipeLockRef.current) return;
      translateX.value = context.startX + event.translationX;
      translateY.value = context.startY + event.translationY;
      
      rotate.value = interpolate(
        translateX.value,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-15, 0, 15],
        Extrapolate.CLAMP
      );
    },
    
    onEnd: (event) => {
      if (swipeLockRef.current) {
        isActive.value = false;
        return;
      }
      
      let direction: SwipeDirection | null = null;
      
      if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
        direction = translateX.value > 0 ? 'right' : 'left';
      } else if (Math.abs(translateY.value) > SWIPE_THRESHOLD) {
        direction = 'down';
      }
      
      if (direction) {
        // ADD Haptic feedback here, based on direction
        runOnJS(Haptics.impactAsync)(direction === 'right' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        
        swipeLockRef.current = true;
        translateX.value = withTiming(direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(setIsSwiping)(false);
          runOnJS(safeExecuteSwipe)(validatedFood, direction!);
        });
        translateY.value = withTiming(
          direction === 'down' ? SCREEN_HEIGHT : 0,
          { duration: 250 }
        );
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withSpring(0);
        runOnJS(setIsSwiping)(false);
        isActive.value = false;
      }
    },
    
    onCancel: () => {
      if (swipeLockRef.current) return;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      rotate.value = withSpring(0);
      runOnJS(setIsSwiping)(false);
      isActive.value = false;
    },
    onFinish: () => {
      runOnJS(setIsSwiping)(false);
      isActive.value = false;
    }
  }, [onSwipe, validatedFood, isFirst, swipeLockRef, expandingCardId]);

  const handleLike = useCallback(() => {
    if (!isFirst || swipeLockRef.current || expandingCardId !== null) return;
    
    swipeLockRef.current = true;
    setIsSwiping(true);
    setShowLikeIndicator(true);
    setLikeOpacity(1);
    
    translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 }, () => {
      runOnJS(safeExecuteSwipe)(validatedFood, 'right');
    });
  }, [validatedFood, translateX, safeExecuteSwipe, isFirst, expandingCardId]);

  const handleNope = useCallback(() => {
    if (!isFirst || swipeLockRef.current || expandingCardId !== null) return;
    
    swipeLockRef.current = true;
    setIsSwiping(true);
    setShowNopeIndicator(true);
    setNopeOpacity(1);
    
    translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 }, () => {
      runOnJS(safeExecuteSwipe)(validatedFood, 'left');
    });
  }, [validatedFood, translateX, safeExecuteSwipe, isFirst, expandingCardId]);

  const handleMeh = useCallback(() => {
    if (!isFirst || swipeLockRef.current || expandingCardId !== null) return;
    
    swipeLockRef.current = true;
    setIsSwiping(true);
    setShowMehIndicator(true);
    setMehOpacity(1);
    
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => {
      runOnJS(safeExecuteSwipe)(validatedFood, 'down');
    });
  }, [validatedFood, translateY, safeExecuteSwipe, isFirst, expandingCardId]);

  const renderDistanceInfo = useCallback(() => {
    return (
      <View style={styles.distanceInfoContainer}>
        <FontAwesome5 name="map-marker-alt" size={16} color={colorAccent} style={styles.distanceIcon} />
        <Text style={styles.distanceText}>1 mi</Text>
        <Text style={styles.distanceSeparator}>•</Text>
        <MaterialIcons name="access-time" size={16} color={colorAccent} style={styles.distanceIcon} />
        <Text style={styles.distanceText}>5 min</Text>
      </View>
    );
  }, []);

  const socialProofBadges = useMemo(() => {
    return (
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
    );
  }, [socialProofData]);

  const CardContent = useMemo(() => {
    console.log(`[FOOD-CARD] CardContent rendering for food ${validatedFood.id}, isFirst=${isFirst}, index=${index}`);
    console.log(`[FOOD-CARD] Restaurant name: "${validatedFood.title}"`);
    const isThisCardExpanded = expandingCardId === validatedFood.id;

    return (
      <>
        <View style={styles.imageContainer}>
          {isImageLoading && (
            <View style={[styles.image, styles.loadingContainer]}>
              <ActivityIndicator size="large" color="#FF3B5C" />
            </View>
          )}
          
          <Animated.View
            style={[
              styles.imageWrapper,
              {
                opacity: isImageLoaded ? 1 : 0,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }
            ]}
          >
            <Image
              source={{ uri: validatedFood.s3_url }}
              style={styles.image}
              resizeMode="cover"
              defaultSource={PLACEHOLDER_IMAGE}
              onLoadStart={() => {
                console.log(`[FOOD-CARD] Image load started for food ${validatedFood.id}`);
                setIsImageLoading(true);
              }}
              onLoadEnd={() => {
                console.log(`[FOOD-CARD] Image load completed for food ${validatedFood.id}`);
                setIsImageLoading(false);
                setIsImageLoaded(true);
              }}
              onError={(e) => {
                console.log(`[FOOD-CARD] Image load error for food ${validatedFood.id}:`, e.nativeEvent.error);
                setIsImageLoading(false);
                handleImageError(validatedFood.s3_url, e.nativeEvent.error);
              }}
            />
          </Animated.View>

          {socialProofBadges}
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.textFlexContainer}> 
            <TouchableOpacity 
              onPress={() => { 
                  if (expandingCardId === null) { 
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onExpand(validatedFood.id); 
                  }
              }} 
              activeOpacity={0.7}
              disabled={!isFirst || expandingCardId !== null}
            >
              <Animated.Text 
                style={styles.name} 
                numberOfLines={isThisCardExpanded ? undefined : 2}
                ellipsizeMode="tail"
                // Add shared transition props
                sharedTransitionTag={nameTransitionTag}
                // Use default Layout animation
                layout={Layout}
              >
                {validatedFood.menu_item}
              </Animated.Text>
            </TouchableOpacity>
            
            <View style={styles.detailsRow}>
              <Text style={styles.restaurant} numberOfLines={1} ellipsizeMode="tail">
                {validatedFood.title}
              </Text>
            </View>
          </View>
          
          <View style={styles.metadataRow}>
            {validatedFood.price_level && (
              <View style={styles.priceContainer}>
                <Text style={styles.priceText}>{priceInfo.display}</Text>
              </View>
            )}
            
            {renderDistanceInfo()}
          </View>
        </View>
      </>
    );
  }, [
    validatedFood.id, validatedFood.s3_url, validatedFood.menu_item, validatedFood.title, validatedFood.price_level,
    isImageLoading, isImageLoaded, socialProofBadges, renderDistanceInfo, priceInfo,
    isFirst, index, toggleDetails, 
    expandingCardId, onExpand
  ]);

  // Update expandedImageStyle to be collapsible
  const expandedImageStyle = useAnimatedStyle(() => {
    'worklet';
    // Use the defined collapse distance
    const height = interpolate(
        scrollY.value, 
        [0, SCROLL_DISTANCE_FOR_COLLAPSE], // Input range (scroll distance)
        [IMAGE_HEIGHT, MIN_IMAGE_HEIGHT], // Output range (image height)
        Extrapolate.CLAMP 
    );
    return {
      height: height,
      // Opacity can also be interpolated if desired
      // opacity: interpolate(scrollY.value, [0, scrollDistance / 2], [1, 0], Extrapolate.CLAMP)
    };
    // Add scrollY to dependencies
  }, [globalExpansionProgress, scrollY]);

  // Animated style for the expanded content (fade-in)
  const expandedContentStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(
        globalExpansionProgress.value, 
        [0, 0.5, 1], // Start fading in halfway through animation
        [0, 0, 1],
        Extrapolate.CLAMP
    );
     const translateY = interpolate(
        globalExpansionProgress.value,
        [0, 0.5, 1],
        [20, 10, 0], // Slight upward slide
        Extrapolate.CLAMP
    );
    return {
      opacity: opacity,
      transform: [{translateY: translateY}]
    };
  }, [globalExpansionProgress]);

  // Re-add Order Modal state
  const [isOrderModalVisible, setIsOrderModalVisible] = useState(false);

  // Re-add Order Modal handlers
  const openOrderModal = useCallback(() => {
    if (isMountedRef.current) {
      console.log("[FOOD-CARD-ORDER] Opening order modal for:", validatedFood.menu_item);
      setIsOrderModalVisible(true);
    }
  }, [validatedFood?.menu_item]);

  const closeOrderModal = useCallback(() => {
    if (isMountedRef.current) {
      setIsOrderModalVisible(false);
    }
  }, []);

  const renderDetailsModal = () => (
    <Modal
      visible={detailsVisible}
      transparent
      animationType="slide"
      onRequestClose={closeDetails}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={closeDetails}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Image 
            source={{ uri: validatedFood.s3_url }} 
            style={styles.modalImage}
            onLoadStart={() => setIsImageLoading(true)}
            onLoadEnd={() => {
              setIsImageLoading(false);
              setIsImageLoaded(true);
            }}
          />
          <View style={styles.modalInfo}>
            <Text style={styles.modalTitle}>{validatedFood.menu_item}</Text>
            <Text style={styles.modalRestaurant}>{validatedFood.title}</Text>
            <Text style={styles.modalDescription}>{validatedFood.description}</Text>
            <Text style={styles.modalPrice}>
              {validatedFood.price ? `$${validatedFood.price.toFixed(2)}` : priceInfo.display}
            </Text>
            <View style={styles.modalDistanceContainer}>
              <FontAwesome5 name="map-marker-alt" size={16} color={colorAccent} style={styles.distanceIcon} />
              <Text style={styles.modalDistanceText}>1 mi</Text>
              <Text style={styles.distanceSeparator}>•</Text>
              <MaterialIcons name="access-time" size={16} color={colorAccent} style={styles.distanceIcon} />
              <Text style={styles.modalDistanceText}>5 min</Text>
            </View>
            {validatedFood.address && (
              <Text style={styles.modalAddress}>{validatedFood.address}</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  // Re-add Order Modal render function
  const renderOrderModal = () => {
    const hasLink = validatedFood.uber_eats_url || validatedFood.doordash_url || validatedFood.postmates_url;
    const links = [
      { name: 'Uber Eats', url: validatedFood.uber_eats_url, icon: 'uber' },
      { name: 'DoorDash', url: validatedFood.doordash_url, icon: 'truck-fast' },
      { name: 'Postmates', url: validatedFood.postmates_url, icon: 'cube-send' }
    ];

    return (
      <Modal
        visible={isOrderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeOrderModal}
      >
        <Pressable style={styles.orderModalOverlay} onPress={closeOrderModal}> 
          <Pressable style={styles.orderModalContent}> 
            <Text style={styles.orderModalTitle}>Order Now</Text>
            <Text style={styles.orderModalSubtitle}>{validatedFood.menu_item}</Text>
            <Text style={styles.orderModalRestaurant}>{validatedFood.title}</Text>

            <View style={styles.orderButtonContainer}>
              {!hasLink && (
                <Text style={styles.orderNoLinksText}>No ordering links available for this item.</Text>
              )}
              {links.map(link => link.url && (
                <TouchableOpacity 
                  key={link.name}
                  style={styles.orderButton}
                  onPress={() => Linking.openURL(link.url!)}
                  activeOpacity={0.7}
                >
                  {link.name === 'Uber Eats' && <FontAwesome5 name={link.icon} size={20} color={colorWhite} />} 
                  {(link.name === 'DoorDash' || link.name === 'Postmates') && <MaterialCommunityIcons name={link.icon as any} size={24} color={colorWhite} />} 
                  <Text style={styles.orderButtonText}>Order on {link.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.orderCloseButton}
              onPress={closeOrderModal}
            >
              <Text style={styles.orderCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // Define inline rendering for ordering links (still used in expanded view)
  const renderOrderingLinks = () => {
    const hasLink = validatedFood.uber_eats_url || validatedFood.doordash_url || validatedFood.postmates_url;
    const links = [
      { name: 'Uber Eats', url: validatedFood.uber_eats_url, icon: 'uber' },
      { name: 'DoorDash', url: validatedFood.doordash_url, icon: 'truck-fast' },
      { name: 'Postmates', url: validatedFood.postmates_url, icon: 'cube-send' }
    ];

    return (
      <View style={styles.orderButtonContainer}>
        {!hasLink && (
          <Text style={styles.orderNoLinksText}>No ordering links available for this item.</Text>
        )}
        {links.map(link => link.url && (
          <TouchableOpacity 
            key={link.name}
            style={styles.orderButton}
            onPress={() => Linking.openURL(link.url!)}
            activeOpacity={0.7}
          >
            {link.name === 'Uber Eats' && <FontAwesome5 name={link.icon} size={20} color={colorWhite} />} 
            {(link.name === 'DoorDash' || link.name === 'Postmates') && <MaterialCommunityIcons name={link.icon as any} size={24} color={colorWhite} />} 
            <Text style={styles.orderButtonText}>Order on {link.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Re-add Double tap handler
  const onDoubleTapEnd = useCallback((event: HandlerStateChangeEvent<any>) => {
    if (event.nativeEvent.state === State.END && isFirst && expandingCardId === null) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      openOrderModal(); 
    }
  }, [openOrderModal, isFirst, expandingCardId]);

  // Update single tap handler - Use onCollapse
  const onSingleTapEnd = useCallback((event: HandlerStateChangeEvent<any>) => {
    if (event.nativeEvent.state === State.END && expandingCardId === food.id) {
      onCollapse();
    }
  }, [expandingCardId, food.id, onCollapse]);

  // Define the scroll handler
  const scrollHandler = useAnimatedScrollHandler({
      onScroll: (event) => {
          scrollY.value = event.contentOffset.y;
      },
  });

  const isThisCardExpanded = expandingCardId === food.id;

  // --- Add state for AddToPlaylistModal --- 
  const [isAddToPlaylistModalVisible, setIsAddToPlaylistModalVisible] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string | null>(null);

  // --- Function to open the AddToPlaylistModal --- 
  const handleOpenAddToPlaylist = useCallback(() => {
    const menuItemId = food.id || food._id; // Get the ID
    if (menuItemId) {
      setSelectedMenuItemId(menuItemId);
      setIsAddToPlaylistModalVisible(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    } else {
      console.warn("[FoodCard] Cannot open AddToPlaylistModal: Missing menu item ID");
      Alert.alert("Error", "Could not identify the food item to add.");
    }
  }, [food.id, food._id]);

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
       {/* REMOVE backdrop */}
      {/* {isThisCardExpanded && (
        <Pressable 
          style={styles.expandedBackdrop} 
          onPress={onCollapse} // Collapse on backdrop press
        />
      )} */}
      
      <PanGestureHandler
        ref={panRef}
        enabled={isFirst && !swipeLockRef.current && expandingCardId === null}
        onGestureEvent={gestureHandler}
        simultaneousHandlers={doubleTapRef} // Re-add simultaneous handler
      >
        <Animated.View style={[styles.container, animatedCardStyle]}>
          {/* Re-add Double Tap Handler Wrapper */}
          <TapGestureHandler 
            ref={doubleTapRef}
            numberOfTaps={2}
            onEnded={onDoubleTapEnd}
            enabled={isFirst && expandingCardId === null}
            waitFor={panRef}
          >
            <TapGestureHandler
              numberOfTaps={1}
              onEnded={onSingleTapEnd}
              enabled={isThisCardExpanded}
            >
              <Animated.View style={{ flex: 1, borderRadius: 0, overflow: 'hidden' }}> 
                    {/* Conditionally render structure based on expansion */}
                    {!isThisCardExpanded ? (
                      // --- Default Card View ---
                      <>
                        {CardContent}
                        {/* Swipe Indicators */} 
                        {expandingCardId === null && showLikeIndicator && (
                            <View style={[styles.likeIndicator, { opacity: likeOpacity }]}>
                                <Text style={styles.indicatorText}>LIKE</Text>
                            </View>
                        )}
                        {expandingCardId === null && showNopeIndicator && (
                            <View style={[styles.nopeIndicator, { opacity: nopeOpacity }]}>
                                <Text style={styles.indicatorText}>NOPE</Text>
                            </View>
                        )}
                        {expandingCardId === null && showMehIndicator && (
                            <View style={[styles.mehIndicator, { opacity: mehOpacity }]}>
                                <Text style={styles.indicatorText}>MEH</Text>
                            </View>
                        )}
                      </>
                    ) : (
                      // --- Expanded Full-Screen View ---
                      <>
                        {/* Fixed Image Area - Apply collapsing style */} 
                        <Animated.View style={[styles.imageContainer, expandedImageStyle]}>
                            {/* You might want to keep the loading indicator and image logic here too */} 
                           {isImageLoading && (
                              <View style={[styles.image, styles.loadingContainer]}>
                                  <ActivityIndicator size="large" color="#FF3B5C" />
                              </View>
                           )}
                           <Animated.View style={[styles.imageWrapper, { opacity: isImageLoaded ? 1 : 0 }]}>
                              <Image
                                  source={{ uri: validatedFood.s3_url }}
                                  style={styles.image}
                                  resizeMode="cover"
                                  defaultSource={PLACEHOLDER_IMAGE} 
                                  // Keep onLoad/onError handlers if needed
                              />
                          </Animated.View>
                           {/* Maybe keep social proof badges on image? */} 
                           {socialProofBadges}
                        </Animated.View>

                        {/* Scrollable Content Area - Use Animated.ScrollView */}
                        <Animated.ScrollView 
                            style={styles.expandedScrollView}
                            contentContainerStyle={styles.expandedScrollContent}
                            showsVerticalScrollIndicator={false}
                            onScroll={scrollHandler}
                            scrollEventThrottle={16} 
                            // Add deceleration rate
                            decelerationRate="fast"
                            // Explicitly enable bouncing for smoother end scroll (iOS)
                            bounces={true} 
                        >
                          <Animated.View style={expandedContentStyle}>
                              {/* Content from CardContent (Name, Restaurant, Meta) */} 
                              <Animated.Text 
                                style={styles.expandedName} 
                                // Add shared transition props (MUST match)
                                sharedTransitionTag={nameTransitionTag}
                                // Use default Layout animation
                                layout={Layout} 
                              >
                                {validatedFood.menu_item}
                              </Animated.Text>
                              <Text style={styles.expandedRestaurant}>{validatedFood.title}</Text>
                               {/* Consider adding Price/Distance here too */} 
                              <View style={styles.expandedMetadataRow}>
                                   {validatedFood.price_level && (
                                      <View style={styles.priceContainer}>
                                          <Text style={styles.priceText}>{priceInfo.display}</Text>
                                      </View>
                                   )}
                                   {renderDistanceInfo()} 
                              </View>

                              {/* Description */} 
                              {validatedFood.description && validatedFood.description !== 'No description available' && (
                                  <>
                                      <Text style={styles.expandedSectionTitle}>Description</Text>
                                      <Text style={styles.expandedDescription}>{validatedFood.description}</Text>
                                  </>
                              )}

                              {/* Address */} 
                              {validatedFood.address && (
                                  <>
                                      <Text style={styles.expandedSectionTitle}>Location</Text>
                                      <Text style={styles.expandedAddress}>{validatedFood.address}</Text>
                                       {/* Optional: Add a map link */} 
                                      <TouchableOpacity onPress={() => openMap(validatedFood.latitude, validatedFood.longitude, validatedFood.address!)}>
                                          <Text style={styles.mapLink}>View on Map</Text>
                                      </TouchableOpacity>
                                  </>
                              )}

                              {/* Ordering Links */} 
                              <Text style={styles.expandedSectionTitle}>Order Now</Text>
                              {renderOrderingLinks()} 

                              {/* Nutrition Section */} 
                              <Text style={styles.expandedSectionTitle}>Estimated Nutrition</Text>
                              <View style={styles.nutritionSection}>
                                  <View style={styles.nutritionItem}>
                                      <Text style={styles.nutritionLabel}>Calories:</Text>
                                      <Text style={styles.nutritionValue}>450-650 kcal</Text>
                                  </View>
                                  <View style={styles.nutritionItem}>
                                      <Text style={styles.nutritionLabel}>Fat:</Text>
                                      <Text style={styles.nutritionValue}>20-35g</Text>
                                  </View>
                                  <View style={styles.nutritionItem}>
                                      <Text style={styles.nutritionLabel}>Protein:</Text>
                                      <Text style={styles.nutritionValue}>25-40g</Text>
                                  </View>
                                  <View style={styles.nutritionItem}>
                                      <Text style={styles.nutritionLabel}>Carbs:</Text>
                                      <Text style={styles.nutritionValue}>30-50g</Text>
                                  </View>
                              </View>
                          </Animated.View>
                        </Animated.ScrollView>
                      </>
                    )}
                  </Animated.View>
                </TapGestureHandler>
          </TapGestureHandler>
        </Animated.View>
      </PanGestureHandler>
      {/* Re-add Order Modal Render Call */}
      {renderOrderModal()}
      {renderDetailsModal()}

      {/* --- Add the AddToPlaylistModal --- */}
      <AddToPlaylistModal 
        visible={isAddToPlaylistModalVisible}
        onClose={() => setIsAddToPlaylistModalVisible(false)}
        menuItemId={selectedMenuItemId}
      />
    </>
  );
});

// Add helper function to open maps
const openMap = (lat?: number, long?: number, label?: string) => {
  if (!lat || !long) return;
  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
  const latLng = `${lat},${long}`;
  const url = Platform.select({
    ios: `${scheme}${label}@${latLng}`,
    android: `${scheme}${latLng}(${label})`
  });
  if (url) Linking.openURL(url);
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: colorBackground,
    position: 'absolute',
    overflow: 'hidden',
    shadowColor: colorShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: colorBorder,
  },
  cardImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
    resizeMode: 'cover',
  },
  textContainer: {
    padding: 12,
    backgroundColor: colorBackground,
    height: TEXT_CONTENT_HEIGHT,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  foodTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colorTextPrimary,
    flexShrink: 1,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  restaurantText: {
    fontSize: 14,
    fontWeight: '600',
    color: colorTextSecondary,
    marginRight: 4,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  description: {
    fontSize: 13,
    color: colorTextSecondary,
    marginBottom: 6,
    lineHeight: 16,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    color: colorTextSecondary,
    flex: 1,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: colorAccent,
  },
  socialProofContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
     flexWrap: 'wrap',
  },
  socialProofItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(191, 89, 66, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  socialProofText: {
    fontSize: 12,
    color: colorAccent,
    marginLeft: 4,
  },
  label: {
    position: 'absolute',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 3,
    borderRadius: 10,
    zIndex: 200,
  },
  likeLabel: {
    left: 20,
    top: 50,
    borderColor: colorBorder,
    transform: [{ rotate: '-25deg' }],
  },
  nopeLabel: {
    right: 20,
    top: 50,
    borderColor: colorAccent,
    transform: [{ rotate: '25deg' }],
  },
  mehLabel: {
    bottom: 100,
    alignSelf: 'center',
    borderColor: colorTextPrimary,
  },
  labelText: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  likeLabelText: {
    color: colorBorder,
  },
  nopeLabelText: {
    color: colorAccent,
  },
  mehLabelText: {
    color: colorMeh,
  },
  detailsButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colorShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: colorBorder,
  },
  detailsModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  detailsContent: {
    backgroundColor: colorWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colorTextPrimary,
  },
  detailsCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colorBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  detailsInfo: {
    padding: 20,
  },
  detailsRestaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailsRestaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: colorTextSecondary,
    marginRight: 6,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailsInfoLabel: {
    width: 100,
    fontSize: 15,
    color: colorTextSecondary,
  },
  detailsInfoValue: {
    flex: 1,
    fontSize: 15,
    color: colorTextPrimary,
  },
  detailsDescriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colorTextSecondary,
    marginBottom: 6,
  },
  detailsDescriptionText: {
    fontSize: 15,
    color: colorTextPrimary,
    lineHeight: 22,
  },
  detailsDeliveryOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingHorizontal: 10,
  },
  detailsDeliveryButton: {
    alignItems: 'center',
    padding: 10,
  },
  detailsDeliveryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colorBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailsDeliveryText: {
    fontSize: 14,
    color: colorTextSecondary,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colorBackground,
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  cardContent: {
    padding: 15,
    backgroundColor: colorWhite,
    height: TEXT_CONTENT_HEIGHT,
    justifyContent: 'space-between',
  },
  textFlexContainer: {
    flex: 1,
    overflow: 'hidden',
    marginBottom: 5,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
  },
  name: {
    color: colorTextPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    flexShrink: 1,
    marginBottom: 4,
    lineHeight: 24,
  },
  restaurant: {
    color: colorTextSecondary,
    fontSize: 16,
    flexShrink: 1,
    maxWidth: '90%',
    marginBottom: 8,
    lineHeight: 20,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 'auto',
    paddingTop: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 4,
  },
  priceText: {
    color: colorAccent,
    fontSize: 14,
    fontWeight: '600',
  },
  distanceInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  distanceIcon: {
    marginRight: 4,
    color: colorAccent,
  },
  distanceText: {
    fontSize: 14,
    color: colorTextPrimary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  distanceSeparator: {
    fontSize: 14,
    color: colorTextPrimary,
    fontWeight: 'bold',
    marginHorizontal: 6,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colorWhite,
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
  modalInfo: {
    padding: 22,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
    color: colorTextPrimary,
  },
  modalRestaurant: {
    fontSize: 18,
    color: colorTextSecondary,
    marginBottom: 4,
  },
  modalDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: colorTextPrimary,
    marginBottom: 20,
  },
  modalPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colorAccent,
  },
  modalDistanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  modalDistanceText: {
    fontSize: 16,
    color: colorTextPrimary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalAddress: {
    fontSize: 16,
    color: colorTextSecondary,
    marginTop: 10,
  },
  likeIndicator: {
    position: 'absolute',
    top: 40,
    right: 10,
    transform: [{ rotate: '15deg' }],
    borderWidth: 5,
    borderColor: colorLike,
    borderRadius: 5,
    padding: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
     zIndex: 10,
  },
  nopeIndicator: {
    position: 'absolute',
    top: 40,
    left: 10,
    transform: [{ rotate: '-15deg' }],
    borderWidth: 5,
    borderColor: colorNope,
    borderRadius: 5,
    padding: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    zIndex: 10,
  },
  mehIndicator: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    transform: [{ rotate: '0deg' }],
    borderWidth: 5,
    borderColor: colorMeh,
    borderRadius: 5,
    padding: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.8)',
    zIndex: 10,
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
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorAccent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
    marginRight: 6,
    alignSelf: 'flex-start',
  },
  trendingText: {
    color: colorWhite,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  ordersBadge: {
    backgroundColor: colorWhite,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
    marginRight: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colorBorder,
  },
  ordersText: {
    color: colorTextPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  limitedTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorAccent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
    marginRight: 6, 
    alignSelf: 'flex-start',
  },
  limitedTimeText: {
    color: colorWhite,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
  orderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderModalContent: {
    backgroundColor: colorWhite,
    borderRadius: 12,
    padding: 20,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  orderModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colorTextPrimary,
    marginBottom: 4,
  },
  orderModalSubtitle: {
    fontSize: 16,
    color: colorTextPrimary,
    marginBottom: 2,
    textAlign: 'center',
  },
  orderModalRestaurant: {
    fontSize: 14,
    color: colorTextSecondary,
    marginBottom: 15,
    textAlign: 'center',
  },
  orderButtonContainer: {
    width: '100%',
    marginBottom: 15,
  },
  orderButton: {
    backgroundColor: colorAccent,
    borderRadius: 8,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderButtonText: {
    color: colorWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  orderNoLinksText: {
    color: colorTextSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  orderCloseButton: {
    marginTop: 5,
    padding: 10,
  },
  orderCloseButtonText: {
    color: colorTextSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  // Styles for Expanded View
  expandedScrollView: {
    flex: 1, // Take remaining space below image
    backgroundColor: colorBackground, // Match background
  },
  expandedScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 150, // INCREASED bottom padding
  },
  expandedName: {
    fontSize: 28, 
    fontWeight: 'bold',
    color: colorTextPrimary,
    marginBottom: 8,
  },
  expandedRestaurant: {
    fontSize: 18,
    color: colorTextSecondary,
    marginBottom: 16,
  },
   expandedMetadataRow: { // Reuse existing styles if possible, or create new
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  expandedSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colorTextPrimary,
    marginTop: 24,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colorBorder,
    paddingBottom: 6,
  },
  expandedDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: colorTextPrimary,
  },
  expandedAddress: {
    fontSize: 16,
    lineHeight: 24,
    color: colorTextPrimary,
    marginBottom: 8,
  },
  mapLink: {
      fontSize: 16,
      color: colorAccent,
      fontWeight: '600',
      marginTop: 4,
  },
  // Styles for Nutrition Section
  nutritionSection: {
      marginTop: 8,
      backgroundColor: colorWhite,
      borderRadius: 10,
      padding: 15,
      borderWidth: 1,
      borderColor: colorBorder,
  },
  nutritionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
  },
  nutritionLabel: {
      fontSize: 15,
      color: colorTextSecondary,
  },
  nutritionValue: {
      fontSize: 15,
      color: colorTextPrimary,
      fontWeight: '500',
  },
  addToPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0ED', // Light accent background
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginVertical: 15,
    marginHorizontal: 20,
    alignSelf: 'center', // Center the button
    borderWidth: 1,
    borderColor: colorAccent, // Accent border
  },
  addToPlaylistButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: colorAccent,
  },
});


const FoodCard = memo(FoodCardComponent);

export { FoodCard };
