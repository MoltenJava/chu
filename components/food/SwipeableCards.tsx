import React, { useState, useCallback, useEffect, memo, useRef, Fragment, useMemo, useContext } from 'react';
import {
  StyleSheet, 
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Modal,
  FlatList, 
  Image,
  SafeAreaView, 
  Platform, 
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  Clipboard
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, FontAwesome, MaterialIcons, FontAwesome5, MaterialCommunityIcons, Entypo } from '@expo/vector-icons';
import { SwipeDirection, FoodType } from '../../types/food';
import { SupabaseMenuItem } from '@/types/supabase';
import { FoodCard } from './FoodCard';
import FoodFilter from './FoodFilter';
import WaiterButton from './WaiterButton';
import { Animated as RNAnimated } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring, 
  withTiming,
  runOnJS,
  Easing,
  interpolate,
  Extrapolate,
  withSequence,
  useAnimatedGestureHandler,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { batchPrefetchImages } from '@/utils/imageUtils';
import SavedItemsModal from './SavedItemsModal';
import CameraSelectionModal from './CameraSelectionModal';
import { JoinSessionModal } from '../couple/JoinSessionModal';
import CoupleModeOptionsModal from '../couple/CoupleModeOptionsModal';
import { CoupleSession } from '@/types/couple';
import { endSession, recordSwipe as recordCoupleSwipe, getSessionMatchIds } from '../../utils/coupleModeService';
import * as CoupleContext from '../../context/CoupleContext';
import { supabase } from '../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { CoupleMatch, CoupleSwipe } from '../../types/couple';
import { Restaurant, MenuItemFromView as MenuItem } from '../../types/supabase';
import { useColorScheme } from '@/hooks/useColorScheme';
import { createSession as createCoupleSession } from '../../utils/coupleModeService';
import SessionCreatedModal from '../couple/SessionCreatedModal';
import * as PlaylistService from '../../utils/playlistService';
import { useSavedItems, SavedItemWithDetails } from '@/hooks/useSavedItems'; // <-- Import SavedItemWithDetails type
import * as Sentry from '@sentry/react-native';

// Define new color palette
const colorBackground = '#FAFAFA'; // Off-white
const colorTextPrimary = '#212121'; // Dark Gray
const colorTextSecondary = '#757575'; // Medium Gray
const colorBorder = '#E0E0E0';     // Light Gray
const colorAccent = '#FF6F61';     // Coral Pink
const colorWhite = '#FFFFFF';
const colorShadow = '#BDBDBD';     // Medium Gray for shadows

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Number of cards to render in the stack - fixed at 2
const VISIBLE_CARDS = 2;
// Define card dimensions here to match FoodCard dimensions
const CARD_WIDTH = SCREEN_WIDTH * 0.92;
// Reduce the overall card height to make the text section more compact
const CARD_HEIGHT = SCREEN_HEIGHT * 0.72;
// Flag to disable swiping during problematic stages
const DISABLE_SWIPE_DURING_LOAD = true;

const PREFETCH_AHEAD = 3; // Number of images to prefetch ahead

interface SwipeHistoryItem {
  foodItem: SupabaseMenuItem;
  direction: 'left' | 'right';
  timestamp: number;
}

interface SwipeableCardsProps {
  data: SupabaseMenuItem[];
  onLike?: (food: SupabaseMenuItem) => void;
  onDislike?: (food: SupabaseMenuItem) => void;
  onSwipeHistoryUpdate?: (history: SwipeHistoryItem[]) => void;
  onRequestRestaurantItems?: (restaurant: string) => Promise<SupabaseMenuItem[]>;
  onRequestFilteredItems?: (filters: string[]) => Promise<SupabaseMenuItem[]>;
  onNavigateToPlaylist?: () => void;
  selectedFilters: string[];
  onFilterChange: (filters: string[]) => void;
}

// Define filter type
interface FilterOption {
  id: string;
  label: string;
  emoji: string;
}

const SwipeableCardsComponent: React.FC<SwipeableCardsProps> = ({
  data,
  onLike,
  onDislike,
  onSwipeHistoryUpdate,
  onRequestRestaurantItems,
  onRequestFilteredItems,
  onNavigateToPlaylist,
  selectedFilters,
  onFilterChange,
}) => {
  // State Management Integration
  const { 
    coupleSession: parteeSession, 
    setCoupleSession: setParteeSession, 
    user, 
    // logout // <-- Assuming logout is NOT in CoupleContext based on error
  } = CoupleContext.useCoupleContext(); 
  
  // Assume logout comes from a different hook/context
  // const { logout } = useAuth(); // Example: uncomment and adjust if needed
  const logout = async () => { console.warn("Logout function not implemented yet!"); }; // Placeholder
  
  const { 
    savedItems, 
    addSavedItem, 
    removeSavedItem,
    loading: savedItemsLoading,
    error: savedItemsError,
    refreshSavedItems,
    clearAllSavedItems // <-- Get the new function from the hook
  } = useSavedItems();

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeData, setActiveData] = useState<SupabaseMenuItem[]>(data);
  const [swipeHistory, setSwipeHistory] = useState<SwipeHistoryItem[]>([]);
  const [savedItemsVisible, setSavedItemsVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [currentRange, setCurrentRange] = useState<number>(10);
  const [isFilterSelectorVisible, setIsFilterSelectorVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  // const [isFilterChanging, setIsFilterChanging] = useState(false); // Replaced with isLoadingFilteredData
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [cameraSelectionModalVisible, setCameraSelectionModalVisible] = useState(false);
  const [selectedItemForCamera, setSelectedItemForCamera] = useState<SupabaseMenuItem | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'couple'>('all');
  // Revert to local waiter mode state like the old version
  const [waiterModeActive, setWaiterModeActive] = useState<boolean>(false);
  const [currentRestaurant, setCurrentRestaurant] = useState<string | null>(null);
  const [showParteeMode, setShowParteeMode] = useState(false);
  const [isJoinParteeModalVisible, setIsJoinParteeModalVisible] = useState(false);
  const [isParteeSessionModalVisible, setIsParteeSessionModalVisible] = useState(false);
  const [isSessionCreatedModalVisible, setIsSessionCreatedModalVisible] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  // Add state for party button
  const [partyModeActive, setPartyModeActive] = useState<boolean>(false);
  // Add Realtime State
  const [matches, setMatches] = useState<CoupleMatch[]>([]);
  const [lastMatch, setLastMatch] = useState<CoupleMatch | null>(null);
  const [showMatchToast, setShowMatchToast] = useState(false);
  const matchToastAnim = useSharedValue(0); // For toast animation
  // --- Add state for Partner Joined Toast --- 
  const [showPartnerJoinedToast, setShowPartnerJoinedToast] = useState(false);
  const partnerJoinedToastAnim = useSharedValue(0);
  // --- Add state for Session Ended Toast --- 
  const [showSessionEndedToast, setShowSessionEndedToast] = useState(false);
  const sessionEndedToastAnim = useSharedValue(0);
  // --- Ref should track joined_by now --- 
  const previousJoinedByIdRef = useRef<string | null | undefined>(parteeSession?.joined_by);

  // Add state for expanded card
  const [expandingCardId, setExpandingCardId] = useState<string | null>(null);

  // Refs (simplified)
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const currentIndexRef = useRef(currentIndex);
  const preWaiterModeDataRef = useRef<SupabaseMenuItem[]>([]);
  const preWaiterModeIndexRef = useRef<number>(0);
  const preWaiterModeFiltersRef = useRef<string[]>([]);
  const fullDatasetRef = useRef<SupabaseMenuItem[]>(data);
  const swipeThrottleRef = useRef<NodeJS.Timeout | null>(null);

  // Reanimated shared values
  const fadeAnim = useSharedValue(1);
  const savedBadgeScale = useSharedValue(1);
  const filterModalAnim = useSharedValue(-50);
  const mapExpandAnim = useSharedValue(0);
  const mapScale = useSharedValue(1);
  const cameraScale = useSharedValue(1);
  const profileScale = useSharedValue(1);
  const filterRowHeight = useSharedValue(0);
  
  // Shared value for global expansion progress
  const globalExpansionProgress = useSharedValue(0);
  
  // Create animation styles
  const savedBadgeScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: savedBadgeScale.value }]
    };
  });

  const filterModalAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: filterModalAnim.value }],
      alignSelf: 'center'
    };
  });
  
  const mapExpandAnimStyle = useAnimatedStyle(() => {
    return {
      height: mapExpandAnim.value,
      opacity: interpolate(
        mapExpandAnim.value,
        [0, 10, 20, 80],
        [0, 0.2, 0.6, 1],
        Extrapolate.CLAMP
      ),
      overflow: 'hidden'
    };
  });

  const mapContentOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        mapExpandAnim.value,
        [0, 20, 40, 80],
        [0, 0.5, 0.8, 1],
        Extrapolate.CLAMP
      )
    };
  });

  // Toolbar button animations
  const mapAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: mapScale.value }],
      backgroundColor: isMapExpanded ? '#fff0f3' : 'white',
      borderColor: isMapExpanded ? '#FF3B5C' : '#ffccd5',
    };
  });

  const cameraAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: cameraScale.value }]
    };
  });

  const profileAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: profileScale.value }]
    };
  });
  
  // Map icon style
  const mapIconStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: isMapExpanded ? '#FF3B5C' : 'transparent',
    };
  });

  // Animation style for Match Toast
  const matchToastStyle = useAnimatedStyle(() => {
    return {
      opacity: matchToastAnim.value,
      transform: [
        {
          translateY: interpolate(
            matchToastAnim.value,
            [0, 1],
            [50, 0], // Slide up from bottom
            Extrapolate.CLAMP
          ),
        },
      ],
    };
  });

  // --- Add Animation style for Partner Joined Toast --- 
  const partnerJoinedToastStyle = useAnimatedStyle(() => {
    return {
      opacity: partnerJoinedToastAnim.value,
      transform: [
        {
          translateY: interpolate(
            partnerJoinedToastAnim.value,
            [0, 1],
            [50, 0], // Slide up from bottom
            Extrapolate.CLAMP
          ),
        },
      ],
    };
  });

  // --- Add Animation style for Session Ended Toast --- 
  const sessionEndedToastStyle = useAnimatedStyle(() => {
    return {
      opacity: sessionEndedToastAnim.value,
      transform: [
        {
          translateY: interpolate(
            sessionEndedToastAnim.value,
            [0, 1],
            [50, 0], // Slide up from bottom
            Extrapolate.CLAMP
          ),
        },
      ],
    };
  });

  // --- RE-ADD state for Session Match IDs --- 
  const [sessionMatchIds, setSessionMatchIds] = useState<Set<string>>(new Set());

  // Animated style for the filter row container
  const filterRowAnimatedStyle = useAnimatedStyle(() => {
    return {
      height: filterRowHeight.value,
      opacity: interpolate(filterRowHeight.value, [0, 25, 50], [0, 0.5, 1]), // Adjusted interpolation range
      overflow: 'hidden', // Clip content when height is 0
    };
  });

  // ADD Optimistic count state
  const [optimisticSavedCount, setOptimisticSavedCount] = useState(0);
  
  // Initialize optimistic count based on initial fetched data
  useEffect(() => {
      // Only set initial count if savedItems has loaded and optimistic count hasn't been set yet
      if (!savedItemsLoading && savedItems && optimisticSavedCount === 0) {
          setOptimisticSavedCount(savedItems.length);
      }
      // If savedItems changes later (e.g., after refresh), update optimistic count
      // This handles cases where background saves/deletes eventually update the hook state
      else if (!savedItemsLoading && savedItems && savedItems.length !== optimisticSavedCount) {
           // Debounce or be careful here to avoid loops if updates are frequent
           // For simplicity now, just update if different
           setOptimisticSavedCount(savedItems.length);
      }
  }, [savedItems, savedItemsLoading]); // Rerun when savedItems or loading state changes

  // Add ref to track recent waiter mode exits
  const justExitedWaiterModeRef = useRef(false);

  // Update refs when state changes (simplified)
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Update fullDatasetRef when data changes
  useEffect(() => {
    if (data) {
      fullDatasetRef.current = data;
    }
  }, [data]);

  // State for storing filtered data from database
  const [filteredData, setFilteredData] = useState<SupabaseMenuItem[]>(data);
  const [isLoadingFilteredData, setIsLoadingFilteredData] = useState(false);

  // Effect to fetch filtered data from database when filters change
  useEffect(() => {
    const fetchFilteredData = async () => {
      if (selectedFilters.length === 0) {
        console.log('[FILTER_DEBUG] No filters selected, using original data');
        setFilteredData(data);
        return;
      }

      if (!onRequestFilteredItems) {
        console.log('[FILTER_DEBUG] onRequestFilteredItems not provided, falling back to local filtering');
        // Fallback to local filtering if database fetching not available
        const localFiltered = data.filter(item => 
          selectedFilters.some(filter => {
            if (item.dish_types && item.dish_types.includes(filter)) return true;
            if (item.food_type && item.food_type.toLowerCase().includes(filter.toLowerCase())) return true;
            if (item.cuisines && item.cuisines.includes(filter)) return true;
            return false;
          })
        );
        setFilteredData(localFiltered);
        return;
      }

      console.log(`[FILTER_DEBUG] Fetching ALL items from database for filters: ${selectedFilters.join(', ')}`);
      setIsLoadingFilteredData(true);
      
      try {
        const allFilteredItems = await onRequestFilteredItems(selectedFilters);
        console.log(`[FILTER_DEBUG] Fetched ${allFilteredItems.length} items from database`);
        
        if (allFilteredItems.length > 0) {
          console.log(`[FILTER_DEBUG] First few database filtered items:`, 
            allFilteredItems.slice(0, 3).map(item => `${item.name} from ${item.title}`));
        }
        
        setFilteredData(allFilteredItems);
      } catch (error) {
        console.error('[FILTER_DEBUG] Error fetching filtered items from database:', error);
        // Fallback to local filtering on error
        const localFiltered = data.filter(item => 
          selectedFilters.some(filter => {
            if (item.dish_types && item.dish_types.includes(filter)) return true;
            if (item.food_type && item.food_type.toLowerCase().includes(filter.toLowerCase())) return true;
            if (item.cuisines && item.cuisines.includes(filter)) return true;
            return false;
          })
        );
        setFilteredData(localFiltered);
      } finally {
        setIsLoadingFilteredData(false);
      }
    };

    fetchFilteredData();
  }, [selectedFilters, data, onRequestFilteredItems]);

  // Update activeData when filteredData changes
  useEffect(() => {
    // Skip if waiter mode is active - let waiter logic handle activeData
    if (waiterModeActive) return;
    
    // Skip reset if we just exited waiter mode
    if (justExitedWaiterModeRef.current) {
      console.log(`[SW_CARDS_FILTER_EFFECT] Just exited waiter mode - skipping reset to preserve index`);
      justExitedWaiterModeRef.current = false; // Reset the flag
      return;
    }
    
    console.log(`[SW_CARDS_FILTER_EFFECT] Updating activeData with ${filteredData.length} filtered items`);
    if (filteredData.length > 0) {
      console.log(`[SW_CARDS_FILTER_EFFECT] First few filtered items:`, filteredData.slice(0, 3).map(item => `${item.name} from ${item.title}`));
    }
    setActiveData(filteredData);
    setCurrentIndex(0); // Reset to start when filters change
  }, [filteredData, waiterModeActive]);

  // Prefetch upcoming images
  useEffect(() => {
    const prefetchUpcomingImages = async () => {
      if (!activeData || activeData.length === 0) return;

      const startIndex = currentIndex;
      const endIndex = Math.min(startIndex + PREFETCH_AHEAD, activeData.length);
      const imagesToPrefetch = activeData
        .slice(startIndex, endIndex)
        .map(item => item.s3_url)
        .filter(url => url && typeof url === 'string');

      if (imagesToPrefetch.length > 0) {
        try {
          await batchPrefetchImages(imagesToPrefetch, (completed, total) => {
            console.log(`Prefetched ${completed}/${total} images`);
          });
        } catch (error) {
          console.warn('Error prefetching images:', error);
        }
      }
    };

    prefetchUpcomingImages();
  }, [currentIndex, activeData]);

  // Simple waiter mode effect - just track party mode state
  useEffect(() => {
    setPartyModeActive(!!parteeSession);
  }, [parteeSession]);

  // --- SIMPLIFIED handleWaiterButtonPress without excessive throttling and loading --- 
  const handleWaiterButtonPress = useCallback(async (restaurantOrActive: boolean | string) => {
    if (!isMountedRef.current) return;

    // --- Entering Waiter Mode --- 
    if (restaurantOrActive === true || typeof restaurantOrActive === 'string') {
        // Store previous state accurately INCLUDING filters
        preWaiterModeIndexRef.current = currentIndex;
        preWaiterModeDataRef.current = [...activeData]; 
        preWaiterModeFiltersRef.current = [...selectedFilters]; // Store current filters
        
        console.log(`[WAITER-DEBUG] Storing filters state: ${selectedFilters.join(', ')}`);
        
        let restaurant: string;
        let itemsToDisplay: SupabaseMenuItem[] = [];

        if (typeof restaurantOrActive === 'string') { 
            restaurant = restaurantOrActive;
            // Fetch ALL items from this restaurant from the database
            if (onRequestRestaurantItems) {
              console.log(`[WAITER-DEBUG] Fetching ALL items for restaurant: ${restaurant}`);
              try {
                itemsToDisplay = await onRequestRestaurantItems(restaurant);
                console.log(`[WAITER-DEBUG] Fetched ${itemsToDisplay.length} items from database for ${restaurant}`);
              } catch (error) {
                console.error(`[WAITER-DEBUG] Error fetching restaurant items:`, error);
                Alert.alert("Error", "Could not load restaurant items. Please try again.");
                return;
              }
            } else {
              // Fallback to current batch filtering if onRequestRestaurantItems not available
              itemsToDisplay = fullDatasetRef.current.filter(item => item.title === restaurant);
              console.log(`[WAITER-DEBUG] Fallback: Filtered ${itemsToDisplay.length} items from current batch`);
            }
        } else { 
            if (currentIndex < activeData.length) {
                const triggerCard = activeData[currentIndex];
                if (!triggerCard) return; 
                restaurant = triggerCard.title;
                console.log(`[WAITER-DEBUG] Trigger card restaurant: ${restaurant}`);
                
                // Fetch ALL items from this restaurant from the database
                if (onRequestRestaurantItems) {
                  console.log(`[WAITER-DEBUG] Fetching ALL items for restaurant: ${restaurant}`);
                  try {
                    itemsToDisplay = await onRequestRestaurantItems(restaurant);
                    console.log(`[WAITER-DEBUG] Fetched ${itemsToDisplay.length} items from database for ${restaurant}`);
                    
                    // Move the trigger card to the front if it exists in the fetched items
                    const triggerCardId = triggerCard._id || triggerCard.id;
                    const currentItemIndex = itemsToDisplay.findIndex(item => (item._id || item.id) === triggerCardId);
                    if (currentItemIndex > 0) { 
                        const [itemToMove] = itemsToDisplay.splice(currentItemIndex, 1);
                        itemsToDisplay.unshift(itemToMove);
                        console.log(`[WAITER-DEBUG] Moved trigger card from index ${currentItemIndex} to front`);
                    } else if (currentItemIndex === -1) {
                        // If trigger card not found in fetched items, add it to the front
                        itemsToDisplay.unshift(triggerCard);
                        console.log(`[WAITER-DEBUG] Added trigger card to front (not found in fetched items)`);
                    }
                  } catch (error) {
                    console.error(`[WAITER-DEBUG] Error fetching restaurant items:`, error);
                    Alert.alert("Error", "Could not load restaurant items. Please try again.");
                    return;
                  }
                } else {
                  // Fallback to current batch filtering if onRequestRestaurantItems not available
                  console.log(`[WAITER-DEBUG] Full dataset length: ${fullDatasetRef.current.length}`);
                  itemsToDisplay = fullDatasetRef.current.filter(item => item.title === restaurant);
                  console.log(`[WAITER-DEBUG] Fallback: Filtered items for ${restaurant}: ${itemsToDisplay.length} items`);
                  const triggerCardId = triggerCard._id || triggerCard.id;
                  const currentItemIndex = itemsToDisplay.findIndex(item => (item._id || item.id) === triggerCardId);
                  if (currentItemIndex > 0) { 
                      const [itemToMove] = itemsToDisplay.splice(currentItemIndex, 1);
                      itemsToDisplay.unshift(itemToMove);
                      console.log(`[WAITER-DEBUG] Moved trigger card from index ${currentItemIndex} to front`);
                  }
                }
            } else {
                Alert.alert("Waiter Mode", "Cannot activate Waiter Mode at the end of the list.");
                return;
            }
        }
        
        if (itemsToDisplay.length > 1) {
            console.log(`[WAITER-DEBUG] Entering waiter mode for: ${restaurant}. Storing index: ${preWaiterModeIndexRef.current}`);
            console.log(`[WAITER-DEBUG] Setting activeData to ${itemsToDisplay.length} restaurant items`);
            setWaiterModeActive(true);
            setCurrentRestaurant(restaurant);
            setActiveData(itemsToDisplay);
            setCurrentIndex(0);
        } else {
            Alert.alert(
              "Waiter Mode",
              `Sorry, we only found ${itemsToDisplay.length} item(s) for ${restaurant}. Waiter mode requires at least two.`,
              [{ text: "OK" }]
            );
        }
    } 
    // --- Exiting Waiter Mode --- 
    else {
      console.log("[WAITER-DEBUG] Exiting waiter mode. Restoring to original position and continuing with normal flow.");
      
      // Turn off waiter mode first
      setWaiterModeActive(false);
      setCurrentRestaurant(null);
      
      // Set flag to prevent filter effect from resetting index
      justExitedWaiterModeRef.current = true;
      
      // Ensure we have a valid state to restore from and a current card
      if (preWaiterModeDataRef.current && preWaiterModeDataRef.current.length > 0 && currentIndex < activeData.length) {
          
          const currentWaiterCard = activeData[currentIndex];
          const originalData = preWaiterModeDataRef.current;
          const originalIndex = preWaiterModeIndexRef.current;
          const originalFilters = preWaiterModeFiltersRef.current;

          console.log(`[WAITER-DEBUG] Current waiter card ID: ${currentWaiterCard._id || currentWaiterCard.id}`);
          console.log(`[WAITER-DEBUG] Restoring to original index: ${originalIndex}`);
          console.log(`[WAITER-DEBUG] Restoring original filters: [${originalFilters.join(', ')}]`);
          
          // Restore the original filter state first if we had filters
          if (originalFilters.length > 0) {
            onFilterChange(originalFilters);
          }

          // Reconstruct the full hybrid data based on original position
          const upcomingCards = originalData.slice(originalIndex + 1);
          const hybridData = [
              ...originalData.slice(0, originalIndex), // previously swiped cards
              currentWaiterCard, // current waiter card at original position
              ...upcomingCards // continue with original flow
          ];

          console.log(`[WAITER-DEBUG] Set hybrid data with ${hybridData.length} items, restoring to index: ${originalIndex}`);
          setActiveData(hybridData);
          setCurrentIndex(originalIndex); // restore original index
      }
    }
  }, [activeData, currentIndex, onRequestRestaurantItems, selectedFilters, onFilterChange]);

  // Add handlers for couple mode
  const handleParteeModePress = useCallback(() => {
    setShowParteeMode(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleParteeModeExit = useCallback(() => {
    setShowParteeMode(false);
  }, []);

  // --- Helper Functions ---
  const isMounted = () => isMountedRef.current;

  // --- Swipe Handling Logic --- 
  // Change direction parameter type to SwipeDirection
  const handleSwipe = useCallback(async (item: SupabaseMenuItem, direction: SwipeDirection) => {
    // Ignore swipes that aren't left or right
    if (direction !== 'left' && direction !== 'right') {
        console.log(`[SwipeableCards] Ignoring swipe direction: ${direction}`);
        return;
    }

    if (!isMounted()) return;
    console.log(`[SwipeableCards] handleSwipe called. Item ID: ${item.id}, Direction: ${direction}`);

    const foodItemId = item.id || item._id; // Ensure we have the correct ID
    if (!foodItemId) {
        console.error("[SwipeableCards] Swiped item has no ID.");
        setCurrentIndex(prev => prev + 1); // Still advance card to prevent getting stuck
        return; 
    }

    // Now direction is guaranteed to be 'left' or 'right'
    const decision = direction === 'right';

    // --- Trigger immediate UI updates first --- 
    if (decision) {
        // Trigger badge animation immediately
        if (!parteeSession) { 
          savedBadgeScale.value = withSequence(
            withSpring(1.2),
            withSpring(1)
          );
        }
        // Increment optimistic count immediately
        setOptimisticSavedCount(prev => prev + 1);
    }
    
    // --- Advance card immediately --- 
    console.log(`[SwipeableCards] Advancing card index from ${currentIndexRef.current}`);
    setCurrentIndex(prev => prev + 1);
    
    // --- Perform Async Operations in Background --- 
    // Couple Mode Swipe (already async, assume it doesn't block UI significantly)
    if (parteeSession && user) {
      console.log(`[SwipeableCards] Partee Mode: Recording swipe for user ${user.id}`);
      recordCoupleSwipe(parteeSession.id, user.id, foodItemId, decision)
        .then(() => console.log(`[SwipeableCards] Partee Mode: Swipe recorded successfully.`))
        .catch(error => {
            console.error('[SwipeableCards] Error recording partee swipe:', error);
            Sentry.captureException(error, { extra: { foodItemId, userId: user.id, sessionId: parteeSession.id, message: 'Error recording couple swipe' } });
            // Non-blocking alert or logging
            // Alert.alert('Swipe Error', 'Could not record your swipe for the partee. Please try again.');
        });
    }
    
    // Single User Like/Dislike Callbacks (if provided)
    if (decision) {
      onLike?.(item);
    } else {
      onDislike?.(item);
    }

    // Save item in background (no await)
    if (decision && user) {
      console.log(`[SwipeableCards] Calling addSavedItem in background for item: ${foodItemId}`);
      addSavedItem(foodItemId)
        .then(() => {
            console.log(`[SwipeableCards] Background addSavedItem call completed.`);
        })
        .catch(saveError => {
            console.error("[SwipeableCards] Background error calling addSavedItem:", saveError);
            Sentry.captureException(saveError, { extra: { foodItemId, userId: user.id, message: 'Error adding saved item in background' } });
            // TODO: Implement background error handling (e.g., retry, user notification)
            // Revert optimistic count on failure?
            // setOptimisticSavedCount(prev => prev - 1); // Careful with race conditions here
        });
    }

    // Update swipe history (local state, synchronous)
    const historyItem: SwipeHistoryItem = {
      foodItem: item,
      direction: direction as 'left' | 'right',
      timestamp: Date.now()
    };
    setSwipeHistory(prev => {
      const newHistory = [...prev, historyItem];
      onSwipeHistoryUpdate?.(newHistory);
      return newHistory;
    });

  }, [
      parteeSession, 
      user,
      onLike, 
      onDislike, 
      onSwipeHistoryUpdate, 
      savedBadgeScale, 
      addSavedItem, // Keep dependency
      // optimisticSavedCount is NOT needed as dependency, setState handles updates
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const toggleMapExpanded = useCallback(() => {
    setIsMapExpanded(prev => {
      const newValue = !prev;
      
      if (newValue) {
        // Expand with a spring animation
        mapExpandAnim.value = withSpring(80, {
          damping: 18,
          stiffness: 90
        });
      } else {
        // Collapse with a timing animation
        mapExpandAnim.value = withTiming(0, {
          duration: 350,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1)
        });
      }
      
      return newValue;
    });
  }, [mapExpandAnim]);

  // Toggle filter modal with animation
  const toggleFilterModal = useCallback(() => {
    console.log("toggleFilterModal was called - current state:", filterModalVisible);
    
    // Using a setTimeout to prevent blocking the UI thread
    setTimeout(() => {
      if (isMountedRef.current) {
        setFilterModalVisible(prev => !prev);
      }
    }, 0);
  }, []);

  // Filter modal animation effect
  useEffect(() => {
    if (filterModalVisible) {
      filterModalAnim.value = withSpring(0, {
        damping: 15,
        stiffness: 125,
        mass: 0.75
      });
    } else {
      filterModalAnim.value = withSpring(-50, {
        damping: 15,
        stiffness: 125,
        mass: 0.75
      });
    }
  }, [filterModalVisible, filterModalAnim]);

  // Toggle saved items modal visibility - Open immediately, refresh in background
  const toggleSavedItems = useCallback(() => {
    const opening = !savedItemsVisible;
    
    // Toggle visibility immediately
    setSavedItemsVisible(prev => !prev);

    if (opening) {
      console.log("[SwipeableCards] Opening SavedItemsModal, triggering background refresh...");
      // Trigger refresh in the background (no await)
      refreshSavedItems()
        .then(() => {
            console.log("[SwipeableCards] Background refreshSavedItems complete.");
        })
        .catch(refreshError => {
            console.error("[SwipeableCards] Background error refreshing saved items:", refreshError);
            Sentry.captureException(refreshError, { extra: { message: 'Error refreshing saved items in background' } });
            // Show an alert, but modal is already open
            Alert.alert("Update Failed", "Could not update saved items.");
        });
    }
    // No else needed, closing just toggles visibility

  }, [savedItemsVisible, refreshSavedItems]); // Dependencies remain the same

  // Toggle favorite status for a food item
  const toggleFavorite = useCallback((foodId: string) => {
    setFavoriteItems(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(foodId)) {
        newFavorites.delete(foodId);
      } else {
        newFavorites.add(foodId);
      }
      return newFavorites;
    });
  }, []);

  // --- Add Handler for Header Filter Button ---
  const handleHeaderFilterPress = useCallback(() => {
    if (waiterModeActive) {
      // Don't respond to taps when waiter mode is active
      return;
    }
    setIsFilterSelectorVisible(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [waiterModeActive]); // Add waiterModeActive dependency

  // Handle delivery service press
  const handleDeliveryPress = useCallback((foodName: string, serviceName: string, url?: string) => {
    if (url) {
      Alert.alert(
        "Open Delivery Service",
        `Would you like to order ${foodName} from ${serviceName}?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Open", 
            onPress: () => {
              Linking.openURL(url).catch(err => {
                console.error('Error opening URL:', err);
                Alert.alert('Error', 'Could not open the delivery service website');
              });
            }
          }
        ]
      );
    } else {
      Alert.alert("Service Unavailable", `${serviceName} ordering is not available for this item.`);
    }
  }, []);

  // RE-ADD filter selection logic
  const isSelected = (id: string) => {
    // If 'all' is conceptually selected (no specific filter), handle that if needed
    // For now, just check if the ID is in the array (single selection model)
    return selectedFilters.includes(id);
  };

  // --- Restore subcategoryFilters definition --- 
  const subcategoryFilters: FilterOption[] = [
      { id: 'all', label: 'All', emoji: '🍽️' },
      { id: 'burgers', label: 'Burgers', emoji: '🍔' },
      { id: 'pizza', label: 'Pizza', emoji: '🍕' },
      { id: 'pasta', label: 'Pasta', emoji: '🍝' },
      { id: 'salad', label: 'Salad', emoji: '🥗' },
      { id: 'tacos', label: 'Tacos', emoji: '🌮' },
      { id: 'sushi', label: 'Sushi', emoji: '🍣' },
      { id: 'bbq', label: 'BBQ', emoji: '🍖' },
      { id: 'seafood', label: 'Seafood', emoji: '🦞' },
      { id: 'sandwiches', label: 'Sandwiches', emoji: '🥪' },
      { id: 'soup', label: 'Soup', emoji: '🍲' },
      { id: 'mexican', label: 'Mexican', emoji: '🌶️' },
      { id: 'italian', label: 'Italian', emoji: '🍅' },
      { id: 'chinese', label: 'Chinese', emoji: '🥢' },
      { id: 'japanese', label: 'Japanese', emoji: '🍱' },
      { id: 'indian', label: 'Indian', emoji: '🍛' }
  ];

  // Update currentFilterEmoji to use the prop and typed param
  const currentFilterEmoji = useMemo(() => {
    if (selectedFilters.length === 0) {
      return '🍽️';
    }
    const selectedId = selectedFilters[0];
    // Add type to parameter f
    const filter = subcategoryFilters.find((f: FilterOption) => f.id === selectedId);
    return filter ? filter.emoji : '🍽️';
  }, [selectedFilters, subcategoryFilters]); // Keep subcategoryFilters dependency

  // --- Helper Functions ---
  const handleFilterSelect = (id: string) => {
    if (id === 'all') {
      onFilterChange([]); 
    } else {
      onFilterChange([id]);
    }
    setIsFilterSelectorVisible(false); 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // --- Render Header --- 
  const renderHeader = useCallback(() => {
    // No need to calculate currentFilterEmoji here anymore

    // Use optimistic count for the badge
    const savedCount = optimisticSavedCount;

    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerLeftContainer}>
          <TouchableOpacity 
            onPress={() => {
              // Logo no longer opens modals, just performs branding function
            }}
            activeOpacity={0.7}
            style={styles.logoTouchable}
          >
            {parteeSession ? (
              <View style={styles.sessionCodeWrapper}>
                <Text style={[styles.logoTextHeader, styles.sessionCodeHeader]}>
                  {parteeSession.session_code}
                </Text>
                <Text style={styles.sessionCodeLabel}>Partee Code</Text>
              </View>
            ) : (
              <Image 
                source={require('@/assets/images/chewzee.png')} 
                style={styles.logoImageHeader} 
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerCenterContainer}>
        </View>
        
        <View style={styles.headerRightContainer}>
          {/* Filter Button - Apply consistent styling */} 
          <TouchableOpacity 
            style={styles.filterButtonContainer} 
            onPress={handleHeaderFilterPress}
            activeOpacity={waiterModeActive ? 1 : 0.7}
            disabled={waiterModeActive}
          >
            {/* Inner view for background/border styling if needed */}
            <View style={[styles.filterButtonInner, waiterModeActive && styles.filterButtonHeaderDisabled]}> 
              <Text style={[styles.headerFilterEmoji, waiterModeActive && styles.filterEmojiDisabled]}>
                {currentFilterEmoji}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Party Button - Add marginLeft */} 
          <TouchableOpacity
            style={[styles.partyButton, { marginLeft: 8 }]} // Add marginLeft
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              // Conditional based on existing partee session
              if (parteeSession) {
                console.log('[SwipeableCards] Party button pressed with active session, opening session modal.');
                setIsParteeSessionModalVisible(true);
              } else {
                console.log('[SwipeableCards] Party button pressed, opening options modal.');
                setIsOptionsModalVisible(true);
              }
            }}
            activeOpacity={0.6}
          >
            <View style={[styles.partyButtonInner, partyModeActive && styles.partyButtonActive]}>
              <Text style={{fontSize: 20, color: partyModeActive ? "#FF3B5C" : colorTextPrimary}}>🎉</Text>
            </View>
          </TouchableOpacity>
        
          {/* Waiter Button - Add marginLeft via a wrapper or style prop */}
          <View style={{ marginLeft: 8 }}> 
            <WaiterButton
              onPress={handleWaiterButtonPress}
              isActive={waiterModeActive}
            />
          </View>

          {/* Saved Items Button - Keep marginLeft */} 
          <TouchableOpacity
            style={styles.menuButton} // Already has marginLeft: 8
            onPress={toggleSavedItems} 
            activeOpacity={0.6}
          >
            <View style={styles.menuButtonInner}>
              <View style={styles.menuButtonContainer}>
                <Ionicons name="heart-outline" size={22} color={colorTextPrimary} />
                {/* Use optimisticSavedCount here */}
                {savedCount > 0 && ( 
                  <Animated.View style={[styles.badgeContainer, savedBadgeScaleStyle]}>
                    <Text style={styles.badgeText}>{savedCount}</Text>
                  </Animated.View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [
    // Dependencies for renderHeader - remove selectedFilters/subcategoryFilters
    // Add currentFilterEmoji itself IF NEEDED, but likely not as it's stable between renders
    parteeSession, 
    waiterModeActive, 
    handleWaiterButtonPress, 
    handleHeaderFilterPress, // <-- Add the new handler here
    setIsParteeSessionModalVisible, 
    toggleSavedItems, 
    optimisticSavedCount, 
    savedBadgeScaleStyle, 
    partyModeActive,
    setIsOptionsModalVisible,
  ]);

  // Moved handleEndCoupleSession definition before renderHeader
  const handleEndParteeSession = async () => {
    if (!parteeSession) return;

    Alert.alert(
      "End Partee",
      "Are you sure you want to end this partee for everyone?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "End Partee", 
          style: "destructive",
          onPress: async () => {
            setIsParteeSessionModalVisible(false);
            try {
              await endSession(parteeSession.id);
              setParteeSession(null);
            } catch (error) {
              console.error('Error ending partee session:', error);
              Alert.alert('Error', 'Failed to end the partee. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleShareParteeCode = () => {
    if (!parteeSession) return;
    Share.share({
      message: `Join my Chewzee partee! Use code: ${parteeSession.session_code}`,
      title: 'Join Chewzee Partee'
    }).catch(error => {
        console.error('Error sharing partee code:', error);
        Alert.alert('Sharing Failed', 'Could not share the partee code.');
    });
  };

  const handleCopyParteeCode = () => {
    if (!parteeSession) return;
    Clipboard.setString(parteeSession.session_code);
    Alert.alert('Copied', 'Partee code copied to clipboard.');
  };

  // --- Expansion Handling --- 
  const handleExpandCard = useCallback((cardId: string) => {
    setExpandingCardId(cardId);
    globalExpansionProgress.value = withTiming(1, { duration: 300 });
  }, [globalExpansionProgress]);

  const handleCollapseCard = useCallback(() => {
    globalExpansionProgress.value = withTiming(0, { duration: 300 }, () => {
      // Reset the expanding ID *after* the animation finishes
      runOnJS(setExpandingCardId)(null);
    });
  }, [globalExpansionProgress]);

  // Render cards
  const renderCards = useCallback(() => {
    const isFinished = currentIndex >= activeData.length;

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

    if (isLoadingFilteredData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B5C" />
        </View>
      );
    }

    if (!activeData || activeData.length === 0 || currentIndex >= activeData.length) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyStateText}>No dishes match your criteria</Text>
        </View>
      );
    }

    // Take a slice of the data for visible cards - always show exactly 2 cards
    const visibleCards = activeData
      .slice(currentIndex, Math.min(currentIndex + VISIBLE_CARDS, activeData.length));

    if (visibleCards.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyStateText}>No more dishes to explore!</Text>
        </View>
      );
    }

    // Render cards in reverse order (second card under first)
    return visibleCards
      .map((item, index) => (
        <FoodCard
          key={`card-${item._id || item.id}`}
          food={item}
          onSwipe={handleSwipe}
          isFirst={index === 0}
          index={index}
          // Expansion props
          expandingCardId={expandingCardId}
          globalExpansionProgress={globalExpansionProgress}
          onExpand={handleExpandCard}
          onCollapse={handleCollapseCard}
        />
      ))
      .reverse();
  }, [currentIndex, activeData, handleSwipe, isLoadingFilteredData, expandingCardId, globalExpansionProgress, handleExpandCard, handleCollapseCard]);

  // --- SIMPLIFIED LOGIC TO REPLACE COMPLEX EFFECTS ---
  
  // Simple, clean effects like the old version
  
  // Animate filter row height based on visibility state
  useEffect(() => {
    if (isFilterSelectorVisible) {
      filterRowHeight.value = withTiming(50, { duration: 250, easing: Easing.out(Easing.ease) }); 
    } else {
      filterRowHeight.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) }); 
    }
  }, [isFilterSelectorVisible, filterRowHeight]);

  // --- Update ref based on joined_by --- 
  useEffect(() => {
    if (!parteeSession) {
      console.log("[Ref Update Effect] Session is null, setting previousJoinedByIdRef to null");
      previousJoinedByIdRef.current = null;
    } else {
      // Update if session changes but isn't null
       if(previousJoinedByIdRef.current !== parteeSession.joined_by){
           console.log(`[Ref Update Effect] Session changed, updating ref to: ${parteeSession.joined_by}`);
           previousJoinedByIdRef.current = parteeSession.joined_by;
       } 
    }
  }, [parteeSession]); 

  // --- RE-ADD Effect for Fetching Initial Matches --- 
  useEffect(() => {
    const fetchInitialMatches = async (retryCount = 0) => {
      if (parteeSession?.id) {
        console.log(`[SwipeableCards] Fetching initial match IDs for session: ${parteeSession.id}`);
        try {
          const initialMatchIds = await getSessionMatchIds(parteeSession.id);
          console.log(`[SwipeableCards] Initial matches fetched: ${initialMatchIds.size} matches found`);
          setSessionMatchIds(initialMatchIds);
          
          // For debugging: log the actual match IDs
          console.log(`[SwipeableCards] Match IDs: ${[...initialMatchIds].join(', ')}`);
        } catch (error) {
          console.error("Error fetching initial session match IDs:", error);
          
          // Retry up to 3 times with exponential backoff
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`[SwipeableCards] Retrying fetch matches in ${delay}ms (attempt ${retryCount + 1}/3)`);
            setTimeout(() => fetchInitialMatches(retryCount + 1), delay);
          }
        }
      } else {
        setSessionMatchIds(new Set());
      }
    };
    
    fetchInitialMatches();
    
    // Fetch matches periodically every 10 seconds as an additional fallback
    let intervalId: NodeJS.Timeout | null = null;
    
    if (parteeSession?.id) {
      intervalId = setInterval(async () => {
        try {
          console.log(`[SwipeableCards] Periodic match check for session: ${parteeSession.id}`);
          const currentMatchIds = await getSessionMatchIds(parteeSession.id);
          
          setSessionMatchIds(prevIds => {
            // Check if we found any new matches
            let hasNewMatches = false;
            currentMatchIds.forEach(id => {
              if (!prevIds.has(id)) {
                hasNewMatches = true;
              }
            });
            
            if (hasNewMatches) {
              console.log(`[SwipeableCards] Periodic check found new matches!`);
              return currentMatchIds;
            }
            return prevIds;
          });
        } catch (error) {
          console.error("Error in periodic match check:", error);
        }
      }, 10000); // Check every 10 seconds
    }
    
    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [parteeSession?.id]);

  // --- Effect for Realtime Subscriptions --- 
  useEffect(() => {
    if (!parteeSession?.id || !user?.id) {
      if (previousJoinedByIdRef.current !== null) {
          console.log("[Realtime Effect] No session, ensuring ref is null");
          previousJoinedByIdRef.current = null; 
      }
      return; 
    }
    
    console.log(`[REALTIME] Subscribing to channels for session: ${parteeSession.id}. Initial Ref joined_by: ${previousJoinedByIdRef.current}`);
    
    let matchesChannel: RealtimeChannel | null = null;
    let swipesChannel: RealtimeChannel | null = null;
    let sessionChannel: RealtimeChannel | null = null;

    // --- Subscribe to Matches (Trigger Badge Animation) --- 
    matchesChannel = supabase
      .channel(`couple-matches-${parteeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'couple_matches',
          filter: `session_id=eq.${parteeSession.id}`,
        },
        (payload) => {
          console.log('[REALTIME] New Match Received:', payload.new);
          const newMatch = payload.new as CoupleMatch;
          
          // Fetch ALL matches to ensure complete state on both devices
          runOnJS(async () => {
            try {
              console.log(`[REALTIME] Match event triggered - Fetching ALL matches for session: ${parteeSession.id}`);
              const allMatchIds = await getSessionMatchIds(parteeSession.id);
              console.log(`[REALTIME] Total matches found: ${allMatchIds.size}`);
              
              // Update state with complete match data
              runOnJS(setSessionMatchIds)(allMatchIds);
              
              // Always trigger animation and notification for the matched item
              runOnJS(() => {
                // Trigger badge animation
                savedBadgeScale.value = withSequence(
                  withSpring(1.2),
                  withSpring(1)
                );
                
                // Show match toast
                setMatches((prev) => [...prev, newMatch]);
                setLastMatch(newMatch);
                setShowMatchToast(true);
                matchToastAnim.value = withTiming(1, { duration: 300 });
                setTimeout(() => {
                  matchToastAnim.value = withTiming(0, { duration: 300 }, () => {
                    runOnJS(setShowMatchToast)(false);
                  });
                }, 3000);
              })();
            } catch (error) {
              console.error('[REALTIME] Error fetching all matches after match event:', error);
              Sentry.captureException(error, { extra: { sessionId: parteeSession.id, context: 'fetch all matches after match event' } });
              
              // Fallback to using just the event data
              runOnJS(setSessionMatchIds)(prevIds => new Set(prevIds).add(newMatch.food_item_id));
              runOnJS(setMatches)((prev) => [...prev, newMatch]);
              runOnJS(setLastMatch)(newMatch);
              runOnJS(setShowMatchToast)(true);
              matchToastAnim.value = withTiming(1, { duration: 300 });
              setTimeout(() => {
                matchToastAnim.value = withTiming(0, { duration: 300 }, () => {
                  runOnJS(setShowMatchToast)(false);
                });
              }, 3000);
            }
          })();
        }
      )
      .subscribe((status) => {
        console.log(`[REALTIME] Matches channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          // Fetch all matches whenever subscription is established/re-established
          (async () => {
            try {
              console.log(`[REALTIME] Match subscription established - Fetching ALL matches for session: ${parteeSession.id}`);
              const allMatchIds = await getSessionMatchIds(parteeSession.id);
              console.log(`[REALTIME] Total matches found on subscribe: ${allMatchIds.size}`);
              runOnJS(setSessionMatchIds)(allMatchIds);
            } catch (error) {
              console.error('[REALTIME] Error fetching matches on subscribe:', error);
              Sentry.captureException(error, { extra: { sessionId: parteeSession.id, context: 'fetch matches on subscribe' } });
            }
          })();
        }
      });

    // --- Subscribe to Swipes (MODIFIED for Reordering) --- 
    swipesChannel = supabase
      .channel(`couple-swipes-${parteeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'couple_swipes',
          filter: `session_id=eq.${parteeSession.id}`,
        },
        (payload) => {
          const newSwipe = payload.new as CoupleSwipe;
          
          // Fetch latest matches after ANY swipe in the session (by either user)
          // This ensures both users have the latest match state regardless of who triggered the match
          runOnJS(async () => {
            try {
              console.log(`[REALTIME] Swipe detected - Fetching latest matches for session: ${parteeSession.id}`);
              const latestMatchIds = await getSessionMatchIds(parteeSession.id);
              
              // Update match IDs and check for new ones
              setSessionMatchIds(prevIds => {
                const updatedMatchIds = new Set([...prevIds]);
                let foundNewMatches = false;
                
                latestMatchIds.forEach(id => {
                  if (!prevIds.has(id)) {
                    foundNewMatches = true;
                    updatedMatchIds.add(id);
                  }
                });
                
                if (foundNewMatches) {
                  console.log(`[REALTIME] Found new matches after swipe that weren't in local state`);
                  // Animate match notification
                  savedBadgeScale.value = withSequence(
                    withSpring(1.2),
                    withSpring(1)
                  );
                  
                  // Show match toast for the newly found match(es)
                  setShowMatchToast(true);
                  matchToastAnim.value = withTiming(1, { duration: 300 });
                  setTimeout(() => {
                    matchToastAnim.value = withTiming(0, { duration: 300 }, () => {
                      runOnJS(setShowMatchToast)(false);
                    });
                  }, 3000);
                }
                
                return updatedMatchIds;
              });
            } catch (error) {
              console.error('Error fetching latest matches after swipe notification:', error);
              Sentry.captureException(error, { extra: { sessionId: parteeSession.id, context: 'fetch matches after swipe event' } });
            }
          })();
          
          // --- Check if it's the PARTNER'S LIKE --- 
          if (newSwipe.user_id !== user.id && newSwipe.decision === true) {
            const likedItemId = newSwipe.food_item_id;
            console.log(`[REALTIME] Partner liked item: ${likedItemId}`);

            // --- Check if current user already swiped on this item --- 
            const alreadySwiped = swipeHistory.some(historyItem => (historyItem.foodItem.id || historyItem.foodItem._id) === likedItemId);
            if (alreadySwiped) {
              console.log(`[REALTIME] Current user already swiped on ${likedItemId}. No reorder.`);
              return; // Already swiped, do nothing
            }

            // --- Find item in the *upcoming* deck --- 
            // Use a function update for setActiveData to get the latest state
            runOnJS(setActiveData)(currentActiveData => {
              const currentIdx = currentIndexRef.current; // Use ref for current index
              const targetIndex = currentIdx + 1; // Insert as the *next* card

              // Find the index of the liked item *after* the current card
              const originalIndex = currentActiveData.findIndex((item, idx) => 
                idx >= currentIdx && (item.id || item._id) === likedItemId
              );

              // --- Reorder if found and not already close --- 
              if (originalIndex !== -1 && originalIndex > targetIndex) { // Found, and not already the next card
                console.log(`[REALTIME] Reordering: Found ${likedItemId} at index ${originalIndex}. Moving to ${targetIndex}.`);
                
                // Create a new array for immutability
                const reorderedData = [...currentActiveData];
                
                // Get the item object
                const [itemToMove] = reorderedData.splice(originalIndex, 1);
                
                // Insert it at the target index
                if (itemToMove) {
                  reorderedData.splice(targetIndex, 0, itemToMove);
                  console.log(`[REALTIME] Successfully reordered data.`);
                  return reorderedData; // Return the new array to update state
                } else {
                  console.warn(`[REALTIME] Failed to splice item ${likedItemId} from index ${originalIndex}`);
                  return currentActiveData; // Return original data on error
                }
              } else if (originalIndex === targetIndex) {
                  console.log(`[REALTIME] Item ${likedItemId} is already the next card. No reorder needed.`);
              } else if (originalIndex < currentIdx && originalIndex !== -1) {
                   console.log(`[REALTIME] Item ${likedItemId} was found at ${originalIndex} (already passed). No reorder.`);
              } else {
                   console.log(`[REALTIME] Item ${likedItemId} not found in upcoming deck. No reorder.`);
              }
              
              // If no reordering happened, return the original data
              return currentActiveData;
            });
          } else {
             // Handle partner's dislike or own swipe if needed (currently just logging partner swipes)
             if (newSwipe.user_id !== user.id) {
                console.log(`[REALTIME] Partner swiped ${newSwipe.decision ? 'Liked' : 'Disliked'} item ${newSwipe.food_item_id} (No reorder triggered)`);
             }
          }
        }
      )
      .subscribe((status) => {
        console.log(`[REALTIME] Swipes channel status: ${status}`);
      });

    // --- Subscribe to Session Updates (Check status) --- 
    sessionChannel = supabase
      .channel(`couple-session-updates-${parteeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couple_sessions',
          filter: `id=eq.${parteeSession.id}`,
        },
        (payload) => {
          console.log('[REALTIME] Session Updated Event Received:', payload.new);
          const updatedSession = payload.new as CoupleSession;
          
          const previousJoinedById = previousJoinedByIdRef.current;
          console.log(`[REALTIME Callback] Checking join/end: previousRef='${previousJoinedById}', updated joined_by='${updatedSession.joined_by}', updated status='${updatedSession.status}'`);
          
          // --- Check if Partner Just Joined --- 
          if (
            previousJoinedById === null &&           
            updatedSession.joined_by &&             
            updatedSession.joined_by !== user.id    
          ) {
            console.log('[REALTIME] Partner joined detected! Triggering toast.');
            runOnJS(setShowPartnerJoinedToast)(true);
            partnerJoinedToastAnim.value = withTiming(1, { duration: 300 });
            setTimeout(() => {
              partnerJoinedToastAnim.value = withTiming(0, { duration: 300 }, () => {
                 runOnJS(setShowPartnerJoinedToast)(false);
              });
            }, 3000);
          }
          
          // --- Check if Session Ended (using status, trigger toast) --- 
          if (updatedSession.status === 'completed' && parteeSession?.status !== 'completed') {
            console.log('[REALTIME] Session ended detected (status=completed)!');
            // Trigger Session Ended Toast
            runOnJS(setShowSessionEndedToast)(true);
            sessionEndedToastAnim.value = withTiming(1, { duration: 300 });
            // Hide toast after 3 seconds
            setTimeout(() => {
               sessionEndedToastAnim.value = withTiming(0, { duration: 300 }, () => {
                  runOnJS(setShowSessionEndedToast)(false);
               });
            }, 3000);
            
            // Still clear the local session state
            runOnJS(setParteeSession)(null); 
          } else if (parteeSession?.id === updatedSession.id) { 
             runOnJS(setParteeSession)(updatedSession); 
          }

          // Update the joined_by ref AFTER processing
          if (previousJoinedByIdRef.current !== updatedSession.joined_by) {
            console.log(`[REALTIME Callback] Updating joined_by ref from '${previousJoinedByIdRef.current}' to: '${updatedSession.joined_by}'`);
            previousJoinedByIdRef.current = updatedSession.joined_by;
          }
        }
      )
      .subscribe((status) => {
        console.log(`[REALTIME] Session updates channel status: ${status}`);
      });

    // --- Cleanup --- 
    return () => {
       console.log(`[REALTIME] Unsubscribing from channels for session: ${parteeSession.id}`);
       if (matchesChannel) supabase.removeChannel(matchesChannel).catch(err => { console.warn("Error removing matches channel:", err); Sentry.captureException(err, { extra: { channel: 'matches' } }); });
       if (swipesChannel) supabase.removeChannel(swipesChannel).catch(err => { console.warn("Error removing swipes channel:", err); Sentry.captureException(err, { extra: { channel: 'swipes' } }); });
       if (sessionChannel) supabase.removeChannel(sessionChannel).catch(err => { console.warn("Error removing session channel:", err); Sentry.captureException(err, { extra: { channel: 'session' } }); });
       if (swipeThrottleRef.current) {
         clearTimeout(swipeThrottleRef.current);
       }
    };
  }, [parteeSession, user?.id, setParteeSession, matchToastAnim, partnerJoinedToastAnim, sessionEndedToastAnim, swipeHistory]); 

  // NEW Handler to initiate session creation - UPDATED
  const handleInitiateCreateSession = useCallback(async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to start a partee.");
      return;
    }
    
    // **Don't close the options modal here anymore**
    // setIsOptionsModalVisible(false); 
    
    setIsCreatingSession(true); // Set loading state
    
    try {
      console.log(`[SwipeableCards] Calling createCoupleSession for user: ${user.id}`);
      Sentry.addBreadcrumb({ category: 'couple.session', message: 'Initiating session creation', level: 'info' });
      const newSession = await createCoupleSession(user.id);
      console.log('[SwipeableCards] Session created successfully:', newSession);
      Sentry.addBreadcrumb({ category: 'couple.session', message: 'Session created successfully', level: 'info', data: { sessionId: newSession.id } });
      
      // Success: Update context, THEN close options modal, then open success modal
      setParteeSession(newSession); 
      setIsOptionsModalVisible(false); // Close options modal *after* success
      setIsSessionCreatedModalVisible(true); 
      
    } catch (error) {
      console.error('[SwipeableCards] Failed to create session:', error);
      Sentry.captureException(error, { extra: { userId: user.id, message: 'Error creating couple session from SwipeableCards' } });
      Alert.alert(
        "Creation Failed", 
        error instanceof Error ? error.message : "An unknown error occurred while creating the session."
      );
      // **Keep options modal open on failure**
    } finally {
       setIsCreatingSession(false); // Turn off loading state regardless of outcome
    }
  }, [user, setParteeSession, createCoupleSession, setIsOptionsModalVisible, setIsSessionCreatedModalVisible]); // Added modal setters to dependencies

  // --- Handler for Logout Request from Modal --- 
  const handleLogoutRequest = useCallback(async () => {
    console.log("[SwipeableCards] Logout requested.");
    try {
      // Replace this placeholder with your actual logout call:
      Sentry.addBreadcrumb({ category: 'auth', message: 'Logout requested', level: 'info' });
      await logout(); 
      // Navigation likely handled by auth state listeners elsewhere
    } catch (error) {
      console.error("[SwipeableCards] Logout failed:", error);
      Sentry.captureException(error, { extra: { message: 'Error during logout attempt' } });
      Alert.alert("Logout Failed", "Could not log out. Please try again.");
    }
  }, [logout]); // Add logout dependency

  // --- Handler for Clearing All Saved Items --- 
  const handleClearAllSaved = useCallback(() => {
    // Only proceed if there are items to clear
    if (optimisticSavedCount === 0) {
      Alert.alert("No Items", "There are no saved items to clear.");
      return;
    }
    
    Alert.alert(
      "Clear All Saved Items?",
      "Are you sure you want to remove all your saved dishes? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive",
          onPress: async () => {
            console.log("[SwipeableCards] User confirmed clear all.");
            try {
              Sentry.addBreadcrumb({ category: 'data.mutate', message: 'Initiating clear all saved items', level: 'info' });
              await clearAllSavedItems();
              console.log("[SwipeableCards] clearAllSavedItems completed successfully.");
              Sentry.addBreadcrumb({ category: 'data.mutate', message: 'Clear all saved items successful', level: 'info' });
              // Optimistic count will update via the useEffect watching savedItems
              // Close the modal after clearing
              toggleSavedItems(); // Or maybe keep it open? User decision.
            } catch (clearError) {
              console.error("[SwipeableCards] Error calling clearAllSavedItems:", clearError);
              Sentry.captureException(clearError, { extra: { message: 'Error clearing all saved items from SwipeableCards' } });
              Alert.alert("Clear Failed", "Could not clear saved items. Please try again.");
            }
          }
        }
      ]
    );
  }, [clearAllSavedItems, optimisticSavedCount, toggleSavedItems]); // Add dependencies

  // --- Restore savedMenuItemsForModals --- 
  const savedMenuItemsForModals = useMemo(() => {
    const result = savedItems.map(savedItemDetail => {
        const mi = savedItemDetail.menu_items as unknown as (MenuItem & { restaurants?: Restaurant }); 
        const restaurantName = mi?.restaurants?.name || 'Unknown Restaurant';
        return {
            ...mi, 
            _id: mi.id,
            _createdAt: mi.created_at,
            title: restaurantName,
            menu_item: mi.name,
        } as SupabaseMenuItem;
    });
    console.log(`[SwipeableCards] Transformed ${result.length} items for SavedItemsModal.`);
    return result;
  }, [savedItems]);

  // --- JSX Return --- 
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* App Header with highest z-index */}
        <View style={styles.headerOuterContainer}>
          {renderHeader()}
        </View>

        {/* Conditionally render Filter Row Container with Animation - Grayed out in waiter mode */}
        <Animated.View style={[styles.filterRowWrapper, filterRowAnimatedStyle]}>
          {isFilterSelectorVisible && (
            <View style={[styles.filterRowContainer, waiterModeActive && styles.filterRowDisabled]}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
              >
                {subcategoryFilters.map((category: FilterOption) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.filterButton,
                      selectedFilters.includes(category.id) && styles.filterButtonSelected,
                      waiterModeActive && styles.filterButtonDisabled
                    ]}
                    onPress={waiterModeActive ? undefined : () => handleFilterSelect(category.id)}
                    activeOpacity={waiterModeActive ? 1 : 0.7}
                    disabled={waiterModeActive}
                  >
                    <Text style={[styles.filterEmojiOnly, waiterModeActive && styles.filterEmojiDisabled]}>
                      {category.emoji}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </Animated.View>

        {/* Main Content with lower z-index and overflow hidden */}
        <View style={styles.mainContentContainer}>
          {/* No Results Message */}
          {selectedFilters.length > 0 && data.length === 0 && (
            <View style={styles.noResultsContainer}>
              <MaterialIcons name="search-off" size={60} color="#ccc" />
              <Text style={styles.noResultsText}>No foods match your filter</Text>
              <Text style={styles.noResultsSubText}>Try selecting different filters</Text>
              <TouchableOpacity 
                style={styles.changeFilterButton}
                onPress={toggleFilterModal}
              >
                <Text style={styles.changeFilterButtonText}>Change Filters</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cards Container with clipping to prevent overlap */}
          <View style={styles.cardsOuterContainer}>
            {renderCards()}
          </View>
        </View>

        {/* Saved Items Modal - Pass the loading state */}
        <SavedItemsModal
          visible={savedItemsVisible}
          onClose={toggleSavedItems}
          savedItems={savedMenuItemsForModals}
          onWaiterMode={handleWaiterButtonPress}
          activeRestaurant={currentRestaurant}
          coupleSession={parteeSession}
          sessionMatchIds={sessionMatchIds}
          onLogoutRequest={handleLogoutRequest} 
          onClearAll={handleClearAllSaved}
          isLoading={savedItemsLoading} // <-- Pass loading state
        />

        {/* Camera Selection Modal - Pass mapped menu items */}
        <CameraSelectionModal
          visible={cameraSelectionModalVisible}
          onClose={() => setCameraSelectionModalVisible(false)}
          savedItems={savedMenuItemsForModals} // <-- Pass the mapped array
          onSelectItem={setSelectedItemForCamera}
        />

        {/* Couple Mode */}
        {showParteeMode && (
          <Modal
            animationType="slide"
            transparent={false}
            visible={showParteeMode}
            onRequestClose={handleParteeModeExit}
          >
          </Modal>
          
        )}

        {/* Update CoupleModeOptionsModal to pass isLoading state */}
        <CoupleModeOptionsModal
          visible={isOptionsModalVisible}
          onClose={() => setIsOptionsModalVisible(false)}
          onCreate={handleInitiateCreateSession} 
          onJoin={() => {
             // Keep existing join logic: close options, open join
             setIsOptionsModalVisible(false);
             setIsJoinParteeModalVisible(true);
          }}
          isLoading={isCreatingSession} // Pass the loading state
        />

        {/* ADD New SessionCreatedModal */}
        <SessionCreatedModal
          visible={isSessionCreatedModalVisible}
          onClose={() => setIsSessionCreatedModalVisible(false)}
          session={parteeSession} // Pass the current session state
        />

        {/* Match Toast Notification */} 
        {showMatchToast && (
          <Animated.View style={[styles.matchToastContainer, matchToastStyle]}>
            <Text style={styles.matchToastText}>It's a match! 🎉</Text>
          </Animated.View>
        )}

        {/* --- Add Partner Joined Toast Notification --- */}
        {showPartnerJoinedToast && (
          <Animated.View style={[styles.partnerJoinedToastContainer, partnerJoinedToastStyle]}> 
            <Text style={styles.partnerJoinedToastText}>Your partner joined! 🥳</Text>
          </Animated.View>
        )}

        {/* --- Add Session Ended Toast Notification --- */}
        {showSessionEndedToast && (
          <Animated.View style={[styles.sessionEndedToastContainer, sessionEndedToastStyle]}> 
            <Text style={styles.sessionEndedToastText}>Session Ended</Text>
          </Animated.View>
        )}

        {/* Update Session Modal - Use correct state variable */}
        {parteeSession && (
          <Modal
            animationType="slide"
            transparent={true}
            visible={isParteeSessionModalVisible}
            onRequestClose={() => setIsParteeSessionModalVisible(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setIsParteeSessionModalVisible(false)}> 
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}> 
                <Text style={styles.sessionCode}>{parteeSession.session_code}</Text>
                <Text style={styles.modalSessionCode}>Partee Code</Text>

                <TouchableOpacity style={styles.modalButton} onPress={handleShareParteeCode}>
                  <Ionicons name="share-social-outline" size={20} color="#007AFF" />
                  <Text style={styles.modalButtonText}>Share Code</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalButton} onPress={handleCopyParteeCode}>
                  <Ionicons name="copy-outline" size={20} color="#007AFF" />
                  <Text style={styles.modalButtonText}>Copy Code</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modalButton, styles.modalEndButton]} onPress={handleEndParteeSession}>
                   <MaterialIcons name="logout" size={20} color="#FF3B30" />
                   <Text style={[styles.modalButtonText, styles.modalEndButtonText]}>End Partee</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modalButton, styles.modalCloseButton]} onPress={() => setIsParteeSessionModalVisible(false)}>
                   <Text style={[styles.modalButtonText, styles.modalCloseButtonText]}>Close</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {/* Join Session Modal - Use correct state variable */}
        <JoinSessionModal
          visible={isJoinParteeModalVisible}
          onClose={() => setIsJoinParteeModalVisible(false)}
          onSessionJoined={(session: CoupleSession) => {
            setParteeSession(session); 
            setIsJoinParteeModalVisible(false); 
            Alert.alert("Joined!", "Successfully joined the partee.");
          }}
        />

      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colorBackground },
  safeArea: { flex: 1, backgroundColor: colorBackground },
  headerOuterContainer: { zIndex: 20, position: 'relative', backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', overflow: 'hidden' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, backgroundColor: colorBackground, borderBottomWidth: 1, borderBottomColor: colorBorder },
  headerLeftContainer: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerCenterContainer: { /* Potentially for future use */ },
  headerRightContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'flex-end' 
  },
  logoTouchable: { paddingVertical: 4 },
  logoImageHeader: { width: 120, height: 42, marginLeft: 0 },
  logoTextHeader: { fontSize: 24, fontWeight: '900', color: colorAccent, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', letterSpacing: -0.5, marginLeft: 5, marginRight: 10 },
  sessionCodeWrapper: { flexDirection: 'column', alignItems: 'center' },
  sessionCodeLabel: { fontSize: 13, fontWeight: '500', color: '#666', marginTop: 2 },
  sessionCodeHeader: { fontSize: 20, fontWeight: 'bold', color: '#FF3B5C', marginBottom: 0 },
  menuButton: { 
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8, // Keep this margin
  },
  menuButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 12, // Match WaiterButton border radius
    backgroundColor: colorWhite, // Use white background like WaiterButton default
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1, // Match WaiterButton border
    borderColor: colorBorder,
    shadowColor: colorShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, 
    shadowRadius: 3, 
    elevation: 3,
  },
  menuButtonContainer: { 
    position: 'relative', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  partyButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    // Remove marginRight: 8 from here, use marginLeft on the button instead
  },
  partyButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colorWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colorBorder,
    shadowColor: colorShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  partyButtonActive: {
    backgroundColor: '#FFF0ED',
    borderColor: '#FF3B5C',
  },
  badgeContainer: { 
    position: 'absolute', 
    top: -15, // Make more negative to move higher
    right: -15, // Keep horizontal position or adjust slightly if needed
    backgroundColor: colorAccent, 
    borderRadius: 10, 
    minWidth: 20, 
    height: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 6 
  },
  badgeText: { color: colorWhite, fontSize: 12, fontWeight: 'bold' },
  filterButtonContainer: { 
    width: 40, 
    height: 40, 
    justifyContent: 'center',
    alignItems: 'center',
    // No margin needed as it's the first item in the row
  },
  filterButtonInner: { // New inner view for styling
    width: 40,
    height: 40,
    borderRadius: 12, 
    backgroundColor: colorWhite, // Base background
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1, 
    borderColor: colorBorder,
    shadowColor: colorShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    // Optionally add a different background/border when a filter is active
    // backgroundColor: selectedFilters.length > 0 ? '#FFF0ED' : colorWhite, 
    // borderColor: selectedFilters.length > 0 ? colorAccent : colorBorder,
  },
  headerFilterEmoji: { 
    fontSize: 20 
  }, 
  matchToastContainer: { 
      position: 'absolute', 
      bottom: 80, 
      left: 0, 
      right: 0, 
      alignItems: 'center', 
      zIndex: 100 
  },
  matchToastText: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 16,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  filterRowWrapper: { backgroundColor: colorBackground },
  filterRowContainer: { paddingTop: 5, paddingBottom: 1, paddingHorizontal: 5 },
  filterRowDisabled: { opacity: 0.5 },
  filterScrollContent: { paddingHorizontal: 5, alignItems: 'center' },
  filterButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colorWhite, borderWidth: 1, borderColor: colorBorder, justifyContent: 'center', alignItems: 'center', marginHorizontal: 5, shadowColor: colorShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1.5, elevation: 1 },
  filterButtonSelected: { borderColor: colorAccent, borderWidth: 2, backgroundColor: '#FFF0ED' },
  filterButtonDisabled: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  filterEmojiOnly: { fontSize: 22 },
  filterEmojiDisabled: { opacity: 0.4 },
  cardsOuterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative', width: SCREEN_WIDTH, paddingVertical: 10, height: CARD_HEIGHT + 30, zIndex: 1, overflow: 'hidden' },
  bottomFilterBar: { paddingBottom: Platform.OS === 'ios' ? 30 : 20, paddingTop: 8, paddingHorizontal: 10, backgroundColor: colorBackground, borderTopWidth: 0, zIndex: 10, minHeight: 0 },
  ridgeContainer: { alignItems: 'center', justifyContent: 'center', height: 24, width: '100%', opacity: 0.8 },
  ridgeLine: { width: 36, height: 4, backgroundColor: colorBorder, borderRadius: 2, marginVertical: 2 },
  bottomToolbar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 24 : 16, paddingTop: 8, paddingHorizontal: 16, backgroundColor: colorBackground, borderTopWidth: 1, borderTopColor: colorBorder, zIndex: 10, position: 'relative' },
  emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyStateText: { fontSize: 18, color: colorTextSecondary, textAlign: 'center' },
  resetButton: { marginTop: 20, backgroundColor: colorAccent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25 },
  resetButtonText: { color: colorWhite, fontSize: 16, fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardWrapper: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#292522', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  fadeAnimStyle: {
    // Existing fade animation styles
  },
  mainContentContainer: { flex: 1, position: 'relative', zIndex: 2, overflow: 'hidden', backgroundColor: colorBackground, paddingTop: 10 },
  noResultsContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  noResultsText: { fontSize: 18, color: colorTextPrimary, textAlign: 'center', marginBottom: 20 },
  noResultsSubText: { fontSize: 14, color: colorTextSecondary, textAlign: 'center' },
  changeFilterButton: { backgroundColor: colorAccent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  changeFilterButtonText: { color: colorWhite, fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 25, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  sessionCode: { fontSize: 28, fontWeight: 'bold', color: colorAccent, marginBottom: 5, letterSpacing: 3 },
  modalSessionCode: { fontSize: 15, color: '#555', marginBottom: 25 },
  modalButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, marginBottom: 15, width: '100%', justifyContent: 'center' },
  modalButtonText: { fontSize: 17, marginLeft: 10, color: '#007AFF', fontWeight: '500' },
  modalEndButton: { backgroundColor: '#FFEBEB' },
  modalEndButtonText: { color: '#FF3B30', fontWeight: 'bold' },
  modalCloseButton: { marginTop: 10, backgroundColor: 'transparent' },
  modalCloseButtonText: { color: '#888', fontWeight: 'normal' },
  filterModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end' },
  filterModalContent: { backgroundColor: colorBackground, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  filterModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  filterModalTitle: { fontSize: 20, fontWeight: 'bold', color: colorTextPrimary },
  filterModalScrollView: {},
  filterCategoryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colorBorder },
  filterCategorySelected: { backgroundColor: '#E8F0FE' },
  filterCategoryText: { flex: 1, fontSize: 16, color: colorTextPrimary, marginLeft: 10 },
  filterModalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  filterModalActionButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, marginHorizontal: 5, alignItems: 'center' },
  filterModalApplyButton: { backgroundColor: colorAccent },
  filterModalClearButton: { backgroundColor: colorTextSecondary },
  filterModalButtonText: { color: colorWhite, fontWeight: '600' },
  filterModalCloseButton: { marginTop: 20, alignSelf: 'center' },
  filterModalCloseButtonText: { fontSize: 16, color: '#FF3B5C', fontWeight: '600' },
  // --- Add Styles for Partner Joined Toast --- 
  partnerJoinedToastContainer: {
      position: 'absolute', 
      bottom: 130, 
      left: 0, 
      right: 0, 
      alignItems: 'center', 
      zIndex: 101, 
  },
  partnerJoinedToastText: {
    backgroundColor: '#4CAF50', 
    color: 'white',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 16,
    fontWeight: 'bold',
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  // --- Add Styles for Session Ended Toast --- 
  sessionEndedToastContainer: {
      position: 'absolute', 
      bottom: 180, // Position above partner joined toast
      left: 0, 
      right: 0, 
      alignItems: 'center', 
      zIndex: 102, // Highest zIndex
  },
  sessionEndedToastText: {
    backgroundColor: '#757575', // Medium Gray background
    color: 'white',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 16,
    fontWeight: 'bold',
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.20,
    shadowRadius: 2.00,
    elevation: 2,
  },
  filterButtonHeaderDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
});

// Wrap component with memo if appropriate
// export default memo(SwipeableCardsComponent);
export default SwipeableCardsComponent; // Keep as is for now