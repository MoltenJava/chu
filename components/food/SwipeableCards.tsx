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
import { CoupleModeScreen } from '../couple/CoupleModeScreen';
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
import { CoupleMatch, CoupleSwipe } from '../../types/database';
import { useColorScheme } from '@/hooks/useColorScheme';
import { createSession as createCoupleSession } from '../../utils/coupleModeService';
import SessionCreatedModal from '../couple/SessionCreatedModal';
import * as PlaylistService from '../../utils/playlistService';
import SettingsModal from '../settings/SettingsModal';

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
  onNavigateToPlaylist?: () => void;
}

interface FoodFilterProps {
  onFilterChange: (filters: string[]) => void;
  initialSelectedFilters: string[];
  categories?: string[];
}

const SwipeableCardsComponent: React.FC<SwipeableCardsProps> = ({
  data,
  onLike,
  onDislike,
  onSwipeHistoryUpdate,
  onRequestRestaurantItems,
  onNavigateToPlaylist
}) => {
  // State Management Integration
  const { coupleSession, setCoupleSession, user } = CoupleContext.useCoupleContext();

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeData, setActiveData] = useState<SupabaseMenuItem[]>(data);
  const [swipeHistory, setSwipeHistory] = useState<SwipeHistoryItem[]>([]);
  const [savedItems, setSavedItems] = useState<SupabaseMenuItem[]>([]);
  const [savedItemsVisible, setSavedItemsVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [currentRange, setCurrentRange] = useState<number>(10);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isFilterSelectorVisible, setIsFilterSelectorVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [cameraSelectionModalVisible, setCameraSelectionModalVisible] = useState(false);
  const [selectedItemForCamera, setSelectedItemForCamera] = useState<SupabaseMenuItem | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'couple'>('all');
  const [waiterModeActive, setWaiterModeActive] = useState<boolean>(false);
  const [currentRestaurant, setCurrentRestaurant] = useState<string | null>(null);
  const [showCoupleMode, setShowCoupleMode] = useState(false);
  const [isJoinCoupleModalVisible, setIsJoinCoupleModalVisible] = useState(false);
  const [isCoupleSessionModalVisible, setIsCoupleSessionModalVisible] = useState(false);
  const [isSessionCreatedModalVisible, setIsSessionCreatedModalVisible] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
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
  const previousJoinedByIdRef = useRef<string | null | undefined>(coupleSession?.joined_by);

  // Add state for expanded card
  const [expandingCardId, setExpandingCardId] = useState<string | null>(null);

  // Refs
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const initialRenderRef = useRef(true);
  const isExitingWaiterModeRef = useRef<boolean>(false);
  const filteredDataRef = useRef(data);
  const currentIndexRef = useRef(currentIndex);
  const preWaiterModeDataRef = useRef<SupabaseMenuItem[]>([]);
  const preWaiterModeIndexRef = useRef<number>(0);
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

  // Update refs when state changes
  useEffect(() => {
    filteredDataRef.current = data;
  }, [data]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Prefetch upcoming images
  useEffect(() => {
    const prefetchUpcomingImages = async () => {
      if (!data || data.length === 0) return;

      const startIndex = currentIndex;
      const endIndex = Math.min(startIndex + PREFETCH_AHEAD, data.length);
      const imagesToPrefetch = data
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
  }, [currentIndex, data]);

  // Ensure fullDatasetRef is updated when the main data prop changes
  useEffect(() => {
     if (data && data.length > 0) {
         fullDatasetRef.current = data;
         // Keep preWaiterModeDataRef for restoration
         if (!waiterModeActive && (!activeData || activeData.length === 0)) {
            setActiveData(data);
            // Initialize preWaiterModeDataRef here too? Maybe not necessary.
         }
     }
  }, [data]);

  // Handle waiter button press - Hybrid Exit Logic
  const handleWaiterButtonPress = useCallback((restaurantOrActive: boolean | string) => {
    if (!isMountedRef.current) return;

    // --- Entering Waiter Mode --- 
    if (restaurantOrActive === true || typeof restaurantOrActive === 'string') {
        // Store previous state accurately
        preWaiterModeIndexRef.current = currentIndex;
        preWaiterModeDataRef.current = [...activeData]; 
        
        let restaurant: string;
        let itemsToDisplay: SupabaseMenuItem[] = [];

        if (typeof restaurantOrActive === 'string') { 
            restaurant = restaurantOrActive;
            itemsToDisplay = fullDatasetRef.current.filter(item => item.title === restaurant);
        } else { 
            if (currentIndex < activeData.length) {
                const triggerCard = activeData[currentIndex];
                if (!triggerCard) return; 
                restaurant = triggerCard.title;
                itemsToDisplay = fullDatasetRef.current.filter(item => item.title === restaurant);
                const triggerCardId = triggerCard._id || triggerCard.id;
                const currentItemIndex = itemsToDisplay.findIndex(item => (item._id || item.id) === triggerCardId);
                if (currentItemIndex > 0) { 
                    const [itemToMove] = itemsToDisplay.splice(currentItemIndex, 1);
                    itemsToDisplay.unshift(itemToMove);
                }
            } else {
                Alert.alert("Waiter Mode", "Cannot activate Waiter Mode at the end of the list.");
                return;
            }
        }
        
        if (itemsToDisplay.length > 1) {
            console.log(`[WAITER-DEBUG] Entering waiter mode for: ${restaurant}. Storing index: ${preWaiterModeIndexRef.current}`);
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
      console.log("[WAITER-DEBUG] Exiting waiter mode. Replacing trigger card with current card.");
      
      // Ensure we have a valid state to restore from and a current card
      if (preWaiterModeDataRef.current && preWaiterModeDataRef.current.length > 0 && currentIndex < activeData.length) {
          
          const currentWaiterCard = activeData[currentIndex];
          const originalIndex = preWaiterModeIndexRef.current;
          const originalData = preWaiterModeDataRef.current;

          console.log(`[WAITER-DEBUG] Current waiter card ID: ${currentWaiterCard._id || currentWaiterCard.id}, Original Index: ${originalIndex}`);

          // Create the hybrid deck
          let hybridData = [...originalData]; 

          // Check if originalIndex is valid before replacing
          if (originalIndex >= 0 && originalIndex < hybridData.length) {
              console.log(`[WAITER-DEBUG] Replacing card at index ${originalIndex} with current waiter card.`);
              hybridData[originalIndex] = currentWaiterCard; // Replace element at the original index
          } else {
              console.warn(`[WAITER-DEBUG] Invalid originalIndex (${originalIndex}) for replacement. Cannot place current card correctly.`);
              // Fallback: Restore original data and index? Or try to insert?
              // Let's try restoring original and advancing past it as a safer fallback.
              hybridData = originalData; // Use original data
              setCurrentIndex(Math.min(originalIndex + 1, hybridData.length - 1)); // Advance past original
              setActiveData(hybridData);
              setWaiterModeActive(false);
              setCurrentRestaurant(null);
              return; // Exit early for fallback
          }

          // Set state with the hybrid deck, pointing to the current (waiter) card
          setActiveData(hybridData);
          setCurrentIndex(originalIndex); 
          console.log(`[WAITER-DEBUG] Set hybrid data, current index set to ${originalIndex}`);

      } else {
          // Fallback if refs/state are invalid
          console.warn("[WAITER-DEBUG] Pre-waiter state refs or current waiter index invalid. Falling back to full data reset.");
          setActiveData(fullDatasetRef.current); 
          setCurrentIndex(0); 
      }
      
      setWaiterModeActive(false);
      setCurrentRestaurant(null);
    }
  }, [activeData, currentIndex]);

  // Add handlers for couple mode
  const handleCoupleModePress = useCallback(() => {
    setShowCoupleMode(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleCoupleModeExit = useCallback(() => {
    setShowCoupleMode(false);
  }, []);

  // Handle swipe action
  const handleSwipe = useCallback(async (item: SupabaseMenuItem, direction: SwipeDirection) => {
    if (!isMountedRef.current || !user) return; // Ensure user exists too
    
    const isCoupleMode = !!coupleSession;
    const decision = direction === 'right';
    // Determine the correct food item ID (use 'id' if '_id' doesn't exist)
    const foodItemId = item.id || item._id;
    
    if (!foodItemId) {
        console.error("Error in handleSwipe: food item ID is missing", item);
        Alert.alert('Error', 'Could not process swipe: missing item ID.');
        // Still advance card maybe?
        setCurrentIndex(prev => prev + 1);
        return;
    }

    // --- Try recording swipe FIRST if in couple mode --- 
    if (isCoupleMode) {
        try {
            console.log(`[CoupleMode] Recording swipe: S_ID=${coupleSession.id}, U_ID=${user.id}, F_ID=${foodItemId}, Decision=${decision}`);
            await recordCoupleSwipe(coupleSession.id, user.id, foodItemId, decision);
            // Swipe recorded successfully for couple mode
        } catch (error) {
            console.error('Error recording couple swipe:', error);
            Alert.alert('Swipe Error', 'Could not record your swipe for the session. Please try again.');
            // Decide if we should block card progression on error
            // For now, let's allow progression
        }
    }

    // --- Single User Logic / Local State Updates --- 
    try {
      if (decision) { // Right swipe
        onLike?.(item);
        setSavedItems(prev => [...prev, item]);
        
        // Save to default playlist in the background (keep this)
        if (user) {
            PlaylistService.saveItemToDefaultPlaylist(user.id, foodItemId)
             .catch((err: Error) => console.error("Error saving item to default playlist:", err)); // Log error if background save fails
        }

        // --- Trigger saved badge animation ONLY IF NOT in couple mode --- 
        if (!coupleSession) {
          savedBadgeScale.value = withSequence(
            withSpring(1.2),
            withSpring(1)
          );
        }
      } else { // Left swipe
        onDislike?.(item);
      }
      
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
      
      // --- Advance Card Index --- 
      setCurrentIndex(prev => prev + 1);

    } catch (error) {
      console.error('Error in handleSwipe (local updates/saving):', error);
      setCurrentIndex(prev => prev + 1);
    }
  }, [
      coupleSession, 
      user,
      onLike, 
      onDislike, 
      onSwipeHistoryUpdate, 
      savedBadgeScale, 
      recordCoupleSwipe
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

  // Handle filter changes
  const handleFilterChange = useCallback((filters: string[]) => {
    try {
      if (!isMountedRef.current) return;
      
      // If filters include 'all', treat it as no filters selected
      const actualFilters = filters.includes('All') ? [] : filters.map(f => f.toLowerCase());
      
      // Use functional updates to ensure we have latest state
      setSelectedFilters(actualFilters);
      
      // Close the modal after applying filters, with small delay to prevent UI blocking
      const timeoutId = setTimeout(() => {
        try {
          if (isMountedRef.current) {
            setFilterModalVisible(false);
          }
        } catch (error) {
          console.error("Error closing filter modal:", error);
        }
      }, 50);
      
      // Store the timeout for cleanup
      timeoutsRef.current.push(timeoutId);
    } catch (error) {
      console.error("Error handling filter change:", error);
      // Fall back to showing all items
      if (isMountedRef.current) {
        setSelectedFilters([]);
        setFilterModalVisible(false);
      }
    }
  }, []); // Empty dependency array since we use functional updates

  // Filter the data based on selected filters
  const filteredByCategories = useMemo(() => {
    if (selectedFilters.length === 0) return data;
    return data.filter(item => 
      selectedFilters.some(filter => 
        item.food_type === filter || item.cuisine === filter
      )
    );
  }, [data, selectedFilters]);

  // Toggle saved items modal visibility
  const toggleSavedItems = useCallback(() => {
    setSavedItemsVisible(prev => !prev);
  }, []);

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

  const handleFilterSelect = (id: string) => {
    // New logic: Handle 'all' separately
    if (id === 'all') {
      setSelectedFilters([]); // Clear filter
    } else {
      setSelectedFilters([id]); // Set specific filter
    }
    setIsFilterSelectorVisible(false); // Always hide selector after a tap in the row
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Header button press logic - Now only toggles visibility
  const handleHeaderFilterPress = () => {
    // New logic: Header button tap always toggles filter row
    setIsFilterSelectorVisible(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // RE-ADD filter data (can be moved or fetched later)
  const subcategoryFilters = [
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

  // --- Render Header (Remove Logout Button & Dependency) --- 
  const renderHeader = useCallback(() => {
    const currentFilterEmoji = useMemo(() => {
      if (selectedFilters.length === 0) {
        return '🍽️'; // Default 'All' emoji
      }
      const selectedId = selectedFilters[0];
      const filter = subcategoryFilters.find(f => f.id === selectedId);
      return filter ? filter.emoji : '🍽️'; // Fallback to default
    }, [selectedFilters, subcategoryFilters]);

    const savedCount = savedItems.length;

    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerLeftContainer}>
          <TouchableOpacity 
            onPress={() => {
              if (coupleSession) {
                console.log('[SwipeableCards] Couple code tapped, opening modal.');
                setIsCoupleSessionModalVisible(true);
              } else {
                 setIsOptionsModalVisible(true); 
              }
            }}
            activeOpacity={0.7}
            style={styles.logoTouchable}
          >
            {coupleSession ? (
              <View style={styles.sessionCodeWrapper}>
                <Text style={styles.sessionCodeLabel}>Couple Code:</Text>
                <Text style={[styles.logoTextHeader, styles.sessionCodeHeader]}>
                  {coupleSession.session_code}
                </Text>
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
          <TouchableOpacity 
            style={styles.headerFilterButton} 
            onPress={handleHeaderFilterPress}
            activeOpacity={0.7}
          >
            <Text style={styles.headerFilterEmoji}>{currentFilterEmoji}</Text>
          </TouchableOpacity>

          <WaiterButton
            onPress={handleWaiterButtonPress}
            isActive={waiterModeActive}
          />

          {/* Saved Items Button */}
          <TouchableOpacity
            style={styles.menuButton} 
            onPress={toggleSavedItems} 
            activeOpacity={0.6}
          >
            <View style={styles.menuButtonInner}>
              <View style={styles.menuButtonContainer}>
                <Ionicons name="heart-outline" size={22} color={colorTextPrimary} />
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
    coupleSession,
    waiterModeActive,
    handleWaiterButtonPress,
    handleHeaderFilterPress,
    setIsCoupleSessionModalVisible,
    toggleSavedItems,
    savedItems.length,
    savedBadgeScaleStyle,
    selectedFilters,
    subcategoryFilters,
  ]);

  // Moved handleEndCoupleSession definition before renderHeader
  const handleEndCoupleSession = async () => {
    if (!coupleSession) return;

    Alert.alert(
      "End Session",
      "Are you sure you want to end this couple session for both users?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "End Session", 
          style: "destructive",
          onPress: async () => {
            setIsCoupleSessionModalVisible(false);
            try {
              await endSession(coupleSession.id);
              setCoupleSession(null);
              Alert.alert('Session Ended', 'The couple session has been closed.');
            } catch (error) {
              console.error('Error ending couple session:', error);
              Alert.alert('Error', 'Failed to end the session. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleShareCoupleCode = () => {
    if (!coupleSession) return;
    Share.share({
      message: `Join my Chewzee couple session! Use code: ${coupleSession.session_code}`,
      title: 'Join Chewzee Couple Session'
    }).catch(error => {
        console.error('Error sharing session code:', error);
        Alert.alert('Sharing Failed', 'Could not share the session code.');
    });
  };

  const handleCopyCoupleCode = () => {
    if (!coupleSession) return;
    Clipboard.setString(coupleSession.session_code);
    Alert.alert('Copied', 'Session code copied to clipboard.');
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

    if (isFilterChanging) {
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
  }, [currentIndex, activeData, handleSwipe, isFilterChanging, expandingCardId, globalExpansionProgress, handleExpandCard, handleCollapseCard]);

  // Update activeData when data prop changes
  useEffect(() => {
    setActiveData(data);
  }, [data]);

  // Update the filtered data to use correct property names
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Filter by selected categories
      if (selectedFilters.length > 0) {
        const itemCategory = item.food_type || item.category || '';
        if (!selectedFilters.includes(itemCategory)) {
          return false;
        }
      }
      return true;
    });
  }, [data, selectedFilters]);

  // Update the renderItem function to use correct property names
  const renderItem = ({ item, index }: { item: SupabaseMenuItem; index: number }) => {
    const isFirst = index === currentIndex;
    const isSecond = index === currentIndex + 1;
    
    if (!isFirst && !isSecond) return null;

    return (
      <FoodCard
        key={item.id}
        food={item}
        onSwipe={handleSwipe}
        isFirst={isFirst}
        index={index}
        expandingCardId={expandingCardId}
        globalExpansionProgress={globalExpansionProgress}
        onExpand={handleExpandCard}
        onCollapse={handleCollapseCard}
      />
    );
  };

  // Animate filter row height based on visibility state
  useEffect(() => {
    if (isFilterSelectorVisible) {
      filterRowHeight.value = withTiming(50, { duration: 250, easing: Easing.out(Easing.ease) }); // Reduced target height further
    } else {
      filterRowHeight.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) }); // Animate to 0 height
    }
  }, [isFilterSelectorVisible, filterRowHeight]);

  // Animated style for the filter row container
  const filterRowAnimatedStyle = useAnimatedStyle(() => {
    return {
      height: filterRowHeight.value,
      opacity: interpolate(filterRowHeight.value, [0, 25, 50], [0, 0.5, 1]), // Adjusted interpolation range
      overflow: 'hidden', // Clip content when height is 0
    };
  });

  // --- Update ref based on joined_by --- 
  useEffect(() => {
    if (!coupleSession) {
      console.log("[Ref Update Effect] Session is null, setting previousJoinedByIdRef to null");
      previousJoinedByIdRef.current = null;
    } else {
      // Update if session changes but isn't null
       if(previousJoinedByIdRef.current !== coupleSession.joined_by){
           console.log(`[Ref Update Effect] Session changed, updating ref to: ${coupleSession.joined_by}`);
           previousJoinedByIdRef.current = coupleSession.joined_by;
       } 
    }
  }, [coupleSession]); 

  // --- RE-ADD Effect for Fetching Initial Matches --- 
  useEffect(() => {
    const fetchInitialMatches = async () => {
      if (coupleSession?.id) {
        console.log(`[SwipeableCards] Fetching initial match IDs for session: ${coupleSession.id}`);
        try {
          const initialMatchIds = await getSessionMatchIds(coupleSession.id);
          setSessionMatchIds(initialMatchIds);
        } catch (error) {
          console.error("Error fetching initial session match IDs:", error);
        }
      } else {
        setSessionMatchIds(new Set());
      }
    };
    fetchInitialMatches();
  }, [coupleSession?.id]);

  // --- Effect for Realtime Subscriptions --- 
  useEffect(() => {
    if (!coupleSession?.id || !user?.id) {
      if (previousJoinedByIdRef.current !== null) {
          console.log("[Realtime Effect] No session, ensuring ref is null");
          previousJoinedByIdRef.current = null; 
      }
      return; 
    }
    
    console.log(`[REALTIME] Subscribing to channels for session: ${coupleSession.id}. Initial Ref joined_by: ${previousJoinedByIdRef.current}`);
    
    let matchesChannel: RealtimeChannel | null = null;
    let swipesChannel: RealtimeChannel | null = null;
    let sessionChannel: RealtimeChannel | null = null;

    // --- Subscribe to Matches (Trigger Badge Animation) --- 
    matchesChannel = supabase
      .channel(`couple-matches-${coupleSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'couple_matches',
          filter: `session_id=eq.${coupleSession.id}`,
        },
        (payload) => {
          console.log('[REALTIME] New Match Received:', payload.new);
          const newMatch = payload.new as CoupleMatch;
          runOnJS(setSessionMatchIds)(prevIds => new Set(prevIds).add(newMatch.food_item_id));
          
          // --- Trigger Badge Animation on Match --- 
          runOnJS(() => {
              savedBadgeScale.value = withSequence(
                  withSpring(1.2),
                  withSpring(1)
              );
          });
          
          // Existing toast logic
          setMatches((prev) => [...prev, newMatch]);
          setLastMatch(newMatch);
          runOnJS(setShowMatchToast)(true);
          matchToastAnim.value = withTiming(1, { duration: 300 });
          setTimeout(() => {
            matchToastAnim.value = withTiming(0, { duration: 300 }, () => {
              runOnJS(setShowMatchToast)(false);
            });
          }, 3000);
        }
      )
      .subscribe((status) => {
        console.log(`[REALTIME] Matches channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          // Optionally fetch initial matches here if needed
        }
      });

    // --- Subscribe to Swipes (MODIFIED for Reordering) --- 
    swipesChannel = supabase
      .channel(`couple-swipes-${coupleSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'couple_swipes',
          filter: `session_id=eq.${coupleSession.id}`,
        },
        (payload) => {
          const newSwipe = payload.new as CoupleSwipe;
          
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
      .channel(`couple-session-updates-${coupleSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couple_sessions',
          filter: `id=eq.${coupleSession.id}`,
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
          if (updatedSession.status === 'completed' && coupleSession?.status !== 'completed') {
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
            runOnJS(setCoupleSession)(null); 
            // ** REMOVE Alert.alert call **
            // runOnJS(Alert.alert)("Session Ended", "The couple session has been closed.");
          } else if (coupleSession?.id === updatedSession.id) { 
             runOnJS(setCoupleSession)(updatedSession); 
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
       console.log(`[REALTIME] Unsubscribing from channels for session: ${coupleSession.id}`);
       if (matchesChannel) supabase.removeChannel(matchesChannel).catch(err => console.warn("Error removing matches channel:", err));
       if (swipesChannel) supabase.removeChannel(swipesChannel).catch(err => console.warn("Error removing swipes channel:", err));
       if (sessionChannel) supabase.removeChannel(sessionChannel).catch(err => console.warn("Error removing session channel:", err));
       if (swipeThrottleRef.current) {
         clearTimeout(swipeThrottleRef.current);
       }
    };
  }, [coupleSession, user?.id, setCoupleSession, matchToastAnim, partnerJoinedToastAnim, sessionEndedToastAnim, swipeHistory]); 

  // NEW Handler to initiate session creation - UPDATED
  const handleInitiateCreateSession = useCallback(async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to create a session.");
      return;
    }
    
    // **Don't close the options modal here anymore**
    // setIsOptionsModalVisible(false); 
    
    setIsCreatingSession(true); // Set loading state
    
    try {
      console.log(`[SwipeableCards] Calling createCoupleSession for user: ${user.id}`);
      const newSession = await createCoupleSession(user.id);
      console.log('[SwipeableCards] Session created successfully:', newSession);
      
      // Success: Update context, THEN close options modal, then open success modal
      setCoupleSession(newSession); 
      setIsOptionsModalVisible(false); // Close options modal *after* success
      setIsSessionCreatedModalVisible(true); 
      
    } catch (error) {
      console.error('[SwipeableCards] Failed to create session:', error);
      Alert.alert(
        "Creation Failed", 
        error instanceof Error ? error.message : "An unknown error occurred while creating the session."
      );
      // **Keep options modal open on failure**
    } finally {
       setIsCreatingSession(false); // Turn off loading state regardless of outcome
    }
  }, [user, setCoupleSession, createCoupleSession, setIsOptionsModalVisible, setIsSessionCreatedModalVisible]); // Added modal setters to dependencies

  // Function to open settings modal (closes saved items first)
  const openSettingsModal = useCallback(() => {
     setSavedItemsVisible(false); 
     setTimeout(() => {
        setIsSettingsModalVisible(true);
     }, 300); 
  }, []);

  // Improve z-index and card container structure to prevent image peeking
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* App Header with highest z-index */}
        <View style={styles.headerOuterContainer}>
          {renderHeader()}
        </View>

        {/* Conditionally render Filter Row Container with Animation */}
        <Animated.View style={[styles.filterRowWrapper, filterRowAnimatedStyle]}>
          {isFilterSelectorVisible && (
            <View style={styles.filterRowContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
              >
                {subcategoryFilters.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.filterButton,
                      isSelected(category.id) && styles.filterButtonSelected
                    ]}
                    onPress={() => handleFilterSelect(category.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.filterEmojiOnly}>{category.emoji}</Text>
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

        {/* Saved Items Modal */}
        <SavedItemsModal
          visible={savedItemsVisible}
          onClose={toggleSavedItems}
          savedItems={savedItems}
          onWaiterMode={handleWaiterButtonPress}
          activeRestaurant={currentRestaurant}
          coupleSession={coupleSession}
          sessionMatchIds={sessionMatchIds}
          onOpenSettings={openSettingsModal}
        />

        <SettingsModal
           visible={isSettingsModalVisible}
           onClose={() => setIsSettingsModalVisible(false)}
        />

        {/* Camera Selection Modal */}
        <CameraSelectionModal
          visible={cameraSelectionModalVisible}
          onClose={() => setCameraSelectionModalVisible(false)}
          savedItems={savedItems}
          onSelectItem={setSelectedItemForCamera}
        />

        {/* Couple Mode */}
        {showCoupleMode && (
          <Modal
            animationType="slide"
            transparent={false}
            visible={showCoupleMode}
            onRequestClose={() => setShowCoupleMode(false)}
          >
            <CoupleModeScreen
              foodItems={data}
            />
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
             setIsJoinCoupleModalVisible(true);
          }}
          isLoading={isCreatingSession} // Pass the loading state
        />

        {/* ADD New SessionCreatedModal */}
        <SessionCreatedModal
          visible={isSessionCreatedModalVisible}
          onClose={() => setIsSessionCreatedModalVisible(false)}
          session={coupleSession} // Pass the current session state
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

        {/* Add Couple Session Modal */}
        {coupleSession && (
          <Modal
            animationType="slide"
            transparent={true}
            visible={isCoupleSessionModalVisible}
            onRequestClose={() => setIsCoupleSessionModalVisible(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setIsCoupleSessionModalVisible(false)}> 
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}> 
                <Text style={styles.modalTitle}>Couple Session</Text>
                <Text style={styles.modalSessionCode}>Code: {coupleSession.session_code}</Text>

                <TouchableOpacity style={styles.modalButton} onPress={handleShareCoupleCode}>
                  <Ionicons name="share-social-outline" size={20} color="#007AFF" />
                  <Text style={styles.modalButtonText}>Share Code</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalButton} onPress={handleCopyCoupleCode}>
                  <Ionicons name="copy-outline" size={20} color="#007AFF" />
                  <Text style={styles.modalButtonText}>Copy Code</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modalButton, styles.modalEndButton]} onPress={handleEndCoupleSession}>
                   <MaterialIcons name="logout" size={20} color="#FF3B30" />
                   <Text style={[styles.modalButtonText, styles.modalEndButtonText]}>End Session</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modalButton, styles.modalCloseButton]} onPress={() => setIsCoupleSessionModalVisible(false)}>
                   <Text style={[styles.modalButtonText, styles.modalCloseButtonText]}>Close</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {/* Join Session Modal */}
        <JoinSessionModal
          visible={isJoinCoupleModalVisible}
          onClose={() => setIsJoinCoupleModalVisible(false)}
          onSessionJoined={(session: CoupleSession) => {
            setCoupleSession(session); 
            setIsJoinCoupleModalVisible(false); 
            Alert.alert("Joined!", "Successfully joined the couple session.");
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
  headerRightContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  logoTouchable: { paddingVertical: 4 },
  logoImageHeader: { width: 120, height: 42, marginLeft: 0 },
  logoTextHeader: { fontSize: 24, fontWeight: '900', color: colorAccent, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', letterSpacing: -0.5, marginLeft: 5, marginRight: 10 },
  sessionCodeWrapper: { flexDirection: 'row', alignItems: 'baseline' },
  sessionCodeLabel: { fontSize: 14, fontWeight: '500', color: '#666', marginRight: 4 },
  sessionCodeHeader: { fontSize: 18, fontWeight: 'bold', color: '#FF3B5C' },
  menuButton: { 
    width: 40, // Match WaiterButton container size
    height: 40, // Match WaiterButton container size
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8, // Keep margin
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
  headerFilterButton: { padding: 8, marginRight: 8, backgroundColor: '#FFF0ED', borderRadius: 20 },
  filterEmojiOnly: { fontSize: 22 },
  headerFilterEmoji: { fontSize: 20 },
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
  filterScrollContent: { paddingHorizontal: 5, alignItems: 'center' },
  filterButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colorWhite, borderWidth: 1, borderColor: colorBorder, justifyContent: 'center', alignItems: 'center', marginHorizontal: 5, shadowColor: colorShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1.5, elevation: 1 },
  filterButtonSelected: { borderColor: colorAccent, borderWidth: 2, backgroundColor: '#FFF0ED' },
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
  modalSessionCode: { fontSize: 16, color: '#555', marginBottom: 25 },
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
});

const SwipeableCards = memo(SwipeableCardsComponent);

export { SwipeableCards }; 