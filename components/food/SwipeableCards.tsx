import React, { useState, useCallback, useEffect, memo, useRef, Fragment, useMemo } from 'react';
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
  Linking
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, FontAwesome, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { SwipeDirection, FoodType } from '../../types/food';
import { SanityMenuItem } from '@/types/sanity';
import { FoodCard } from './FoodCard';
import FoodFilter from './FoodFilter';
import WaiterButton from './WaiterButton';
import CoupleMode from './CoupleMode';
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
  withSequence
} from 'react-native-reanimated';
import { batchPrefetchImages } from '@/utils/imageUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Number of cards to render in the stack - fixed at 2
const VISIBLE_CARDS = 2;
// Define card dimensions here to match FoodCard dimensions
const CARD_WIDTH = SCREEN_WIDTH * 0.87;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.715;
// Flag to disable swiping during problematic stages
const DISABLE_SWIPE_DURING_LOAD = true;

const PREFETCH_AHEAD = 3; // Number of images to prefetch ahead

interface SwipeHistoryItem {
  foodItem: SanityMenuItem;
  direction: 'left' | 'right';
  timestamp: number;
}

interface SwipeableCardsProps {
  data: SanityMenuItem[];
  onLike?: (food: SanityMenuItem) => void;
  onDislike?: (food: SanityMenuItem) => void;
  onSwipeHistoryUpdate?: (history: SwipeHistoryItem[]) => void;
  onRequestRestaurantItems?: (restaurant: string) => Promise<SanityMenuItem[]>;
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
  onRequestRestaurantItems
}) => {
  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeHistory, setSwipeHistory] = useState<SwipeHistoryItem[]>([]);
  const [savedItems, setSavedItems] = useState<SanityMenuItem[]>([]);
  const [savedItemsVisible, setSavedItemsVisible] = useState(false);
  const [currentRange, setCurrentRange] = useState<number>(10);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [cameraSelectionModalVisible, setCameraSelectionModalVisible] = useState(false);
  const [selectedItemForCamera, setSelectedItemForCamera] = useState<SanityMenuItem | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'couple'>('all');
  const [waiterModeActive, setWaiterModeActive] = useState<boolean>(false);
  const [currentRestaurant, setCurrentRestaurant] = useState<string | null>(null);
  const [showCoupleMode, setShowCoupleMode] = useState(false);

  // Refs
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const initialRenderRef = useRef(true);
  const isExitingWaiterModeRef = useRef<boolean>(false);
  const filteredDataRef = useRef(data);
  const currentIndexRef = useRef(currentIndex);
  const preWaiterModeDataRef = useRef<SanityMenuItem[]>([]);
  const preWaiterModeIndexRef = useRef<number>(0);
  const fullDatasetRef = useRef<SanityMenuItem[]>(data);

  // Reanimated shared values
  const fadeAnim = useSharedValue(1);
  const savedBadgeScale = useSharedValue(1);
  const filterModalAnim = useSharedValue(-50);
  const mapExpandAnim = useSharedValue(0);
  const mapScale = useSharedValue(1);
  const cameraScale = useSharedValue(1);
  const profileScale = useSharedValue(1);

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

  // Handle waiter button press - improved to use the callback to request ALL restaurant items
  const handleWaiterButtonPress = useCallback((newIsActive: boolean) => {
    console.log("[WAITER-BUTTON] Waiter button toggled to:", newIsActive, "Current waiter mode active:", waiterModeActive);
    
    // Debug the state of data references
    console.log(`[WAITER-DEBUG] Current data state:
    - fullDatasetRef: ${fullDatasetRef.current.length} items
    - data: ${data.length} items
    - currentIndex: ${currentIndex}`);
    
    // Skip if not mounted
    if (!isMountedRef.current) return;
    
    // CRITICAL FIX: Always force the UI state to match the incoming toggle state
    // This ensures the toggle works both ways
    if (newIsActive !== waiterModeActive) {
      console.log(`[WAITER-DEBUG] Forcing waiter mode state from ${waiterModeActive} to ${newIsActive}`);
    }
    
    // If activating waiter mode, use the callback to request ALL restaurant items
    if (newIsActive && data.length > 0 && currentIndex < data.length) {
      // SAVE STATE: Store the current data before entering waiter mode
      preWaiterModeDataRef.current = [...data];
      preWaiterModeIndexRef.current = currentIndex;
      console.log(`[WAITER-DEBUG] Saved pre-waiter mode data: ${preWaiterModeDataRef.current.length} items`);
      
      const currentItem = data[currentIndex];
      if (currentItem) {
        const restaurant = currentItem.title;
        
        console.log(`[WAITER-DEBUG] Activating waiter mode for restaurant: ${restaurant}`);
        
        // First, try to find all items for this restaurant in our current dataset
        const currentDatasetItems = fullDatasetRef.current.filter(item => 
          item.title === restaurant
        );
        console.log(`[WAITER-DEBUG] Found ${currentDatasetItems.length} items in current dataset for ${restaurant}`);
        
        // Save the ETA values from the current card to use for all restaurant items
        const currentDistanceFromUser = currentItem.distance_from_user;
        const currentEstimatedDuration = currentItem.estimated_duration;
        console.log(`[WAITER-DEBUG] Using distance: ${currentDistanceFromUser} and duration: ${currentEstimatedDuration} for all restaurant items`);
        
        // Set waiter mode UI first to avoid stuttering - IMPORTANT FIX
        setWaiterModeActive(true);
        setCurrentRestaurant(restaurant);
        
        // Use the callback to request ALL items for this restaurant from the complete dataset
        if (onRequestRestaurantItems) {
          console.log(`[WAITER-DEBUG] Requesting ALL items for ${restaurant} from complete dataset`);
          
          onRequestRestaurantItems(restaurant)
            .then(allRestaurantItems => {
              console.log(`[WAITER-DEBUG] Successfully retrieved ${allRestaurantItems.length} items for ${restaurant} from full dataset`);
              
              if (allRestaurantItems.length > 0) {
                // Log the first few items as a sample
                allRestaurantItems.slice(0, 3).forEach((item, index) => {
                  console.log(`  Item ${index + 1}: ${item.title}`);
                });
                
                if (allRestaurantItems.length > 1) {
                  // Find the current item in the new dataset
                  const currentItemId = currentItem._id;
                  const currentItemIndex = allRestaurantItems.findIndex(item => item._id === currentItemId);
                  
                  console.log(`[WAITER-DEBUG] Current item ID: ${currentItemId}`);
                  console.log(`[WAITER-DEBUG] Current item index in new dataset: ${currentItemIndex}`);
                  
                  if (isMountedRef.current) {
                    // FIX 1: Reorder the array to make current item appear as #1
                    let reorderedItems = [...allRestaurantItems];
                    
                    if (currentItemIndex !== -1) {
                      // Move the current item to the beginning of the array
                      const currentItemObj = reorderedItems.splice(currentItemIndex, 1)[0];
                      reorderedItems = [currentItemObj, ...reorderedItems];
                      console.log(`[WAITER-DEBUG] Reordered items to make ${currentItemObj.title} appear as #1`);
                    }
                    
                    // FIX ETA: Add the distance and duration values from the current item to ALL restaurant items
                    const processedItems = reorderedItems.map(item => ({
                      ...item,
                      distance_from_user: currentDistanceFromUser,
                      estimated_duration: currentEstimatedDuration
                    }));
                    console.log(`[WAITER-DEBUG] Added distance and duration values to all ${processedItems.length} restaurant items`);
                    
                    // Set temporary filtered items to show in stack - IMPORTANT: do NOT add to savedItems
                    // We're using filteredDataRef directly to avoid adding to savedItems
                    console.log(`[WAITER-DEBUG] Setting filtered data with ${processedItems.length} items`);
                    filteredDataRef.current = processedItems;
                    
                    // Always start at index 0 since we moved the current item there
                    if (currentIndex !== 0) {
                      setCurrentIndex(0);
                    }
                  }
                } else {
                  console.log(`[WAITER-DEBUG] Not enough items (${allRestaurantItems.length}) for restaurant ${restaurant}`);
                  Alert.alert(
                    "Waiter Mode",
                    `Sorry, we only found ${allRestaurantItems.length} item for ${restaurant}. Waiter mode requires multiple items.`,
                    [{ text: "OK" }]
                  );
                  setWaiterModeActive(false);
                  setCurrentRestaurant(null);
                }
              } else {
                console.log(`[WAITER-DEBUG] No items found for ${restaurant} in full dataset`);
                // Fallback to current dataset items if we found some there
                if (currentDatasetItems.length > 1) {
                  console.log(`[WAITER-DEBUG] Falling back to ${currentDatasetItems.length} items from current dataset`);
                  
                  // Find the current item in the current dataset items
                  const currentItemId = currentItem._id;
                  const currentItemIndex = currentDatasetItems.findIndex(item => item._id === currentItemId);
                  
                  if (isMountedRef.current) {
                    // Reorder the array to make current item appear as #1
                    let reorderedItems = [...currentDatasetItems];
                    
                    if (currentItemIndex !== -1) {
                      // Move the current item to the beginning of the array
                      const currentItemObj = reorderedItems.splice(currentItemIndex, 1)[0];
                      reorderedItems = [currentItemObj, ...reorderedItems];
                    }
                    
                    // Set only in filtered data ref, not in savedItems
                    filteredDataRef.current = reorderedItems;
                    
                    // Set the index to 0 only if needed
                    if (currentIndex !== 0) {
                      setCurrentIndex(0);
                    }
                  }
                } else {
                  Alert.alert(
                    "Waiter Mode",
                    `Sorry, we couldn't find enough dishes from ${restaurant}. Waiter mode requires multiple items.`,
                    [{ text: "OK" }]
                  );
                  setWaiterModeActive(false);
                  setCurrentRestaurant(null);
                }
              }
            })
            .catch(error => {
              console.error(`[WAITER-ERROR] Failed to get items for ${restaurant}:`, error);
              
              // Fallback to current dataset items if we found some there
              if (currentDatasetItems.length > 1) {
                console.log(`[WAITER-DEBUG] Falling back to ${currentDatasetItems.length} items from current dataset after error`);
                
                // Find the current item in the current dataset items
                const currentItemId = currentItem._id;
                const currentItemIndex = currentDatasetItems.findIndex(item => item._id === currentItemId);
                
                if (isMountedRef.current) {
                  // Reorder the array to make current item appear as #1
                  let reorderedItems = [...currentDatasetItems];
                  
                  if (currentItemIndex !== -1) {
                    // Move the current item to the beginning of the array
                    const currentItemObj = reorderedItems.splice(currentItemIndex, 1)[0];
                    reorderedItems = [currentItemObj, ...reorderedItems];
                  }
                  
                  // Set only in filtered data ref, not in savedItems
                  filteredDataRef.current = reorderedItems;
                  
                  // Set the index to 0 only if needed
                  if (currentIndex !== 0) {
                    setCurrentIndex(0);
                  }
                }
              } else {
                Alert.alert(
                  "Waiter Mode Error",
                  `Sorry, there was a problem loading dishes from ${restaurant}.`,
                  [{ text: "OK" }]
                );
                setWaiterModeActive(false);
                setCurrentRestaurant(null);
              }
            });
        } else {
          // No callback provided, fallback to current data (limited dataset)
          console.log(`[WAITER-DEBUG] No callback provided to get full dataset, using available data only`);
          
          if (currentDatasetItems.length > 1) {
            console.log(`[WAITER-DEBUG] Activating waiter mode with ${currentDatasetItems.length} items from current dataset`);
            
            // Find the current item in the current dataset items
            const currentItemId = currentItem._id;
            const currentItemIndex = currentDatasetItems.findIndex(item => item._id === currentItemId);
            
            if (isMountedRef.current) {
              // Reorder the array to make current item appear as #1
              let reorderedItems = [...currentDatasetItems];
              
              if (currentItemIndex !== -1) {
                // Move the current item to the beginning of the array
                const currentItemObj = reorderedItems.splice(currentItemIndex, 1)[0];
                reorderedItems = [currentItemObj, ...reorderedItems];
              }
              
              // Set only in filtered data ref, not in savedItems
              filteredDataRef.current = reorderedItems;
              
              // Set the index to 0 only if needed
              if (currentIndex !== 0) {
                setCurrentIndex(0);
              }
            }
          } else {
            console.log(`[WAITER-DEBUG] Not enough items (${currentDatasetItems.length}) for restaurant ${restaurant} in current dataset`);
            Alert.alert(
              "Waiter Mode",
              `Sorry, we only found ${currentDatasetItems.length} item for ${restaurant}. Waiter mode requires multiple items.`,
              [{ text: "OK" }]
            );
            setWaiterModeActive(false);
            setCurrentRestaurant(null);
          }
        }
      }
    } else {
      // FIXME: SEAMLESS EXIT WITH CURRENT POSITION - Continue from current card instead of resetting
      console.log("[WAITER-DEBUG] Deactivating waiter mode - SEAMLESS EXIT");
      
      // CRITICAL: Set the exiting flag to prevent the useEffect from running
      isExitingWaiterModeRef.current = true;
      
      // CRITICAL: Keep track of the current visible food item
      const currentItem = filteredDataRef.current[currentIndex];
      console.log(`[WAITER-DEBUG] Current item before deactivation: ${currentItem?.title} from ${currentItem?.title}, at index ${currentIndex}`);
      
      // Only update the waiter mode flags
      setWaiterModeActive(false);
      setCurrentRestaurant(null);
      
      // RESTORE original data with the CURRENT card at position 0, followed by original data
      if (preWaiterModeDataRef.current.length > 0 && currentItem) {
        // Super simple approach:
        // 1. Keep the current card at position 0
        // 2. Append all items from original stack AFTER where we started waiter mode
        
        console.log(`[WAITER-DEBUG] Creating new card stack with current item first`);
        
        // Find original entry point for waiter mode - what index did we enter from?
        // We can start from right after that point when exiting
        const originalEntryPoint = preWaiterModeDataRef.current.findIndex(item => 
          item.title === currentItem.title
        );
        
        console.log(`[WAITER-DEBUG] Original entry point was index ${originalEntryPoint}`);
        
        // Create new data: current card + everything after original entry point
        const newData = [
          currentItem,
          ...preWaiterModeDataRef.current.slice(originalEntryPoint + 1)
        ];
        
        console.log(`[WAITER-DEBUG] Created new stack with ${newData.length} items`);
        console.log(`[WAITER-DEBUG] Current card ${currentItem.title} at index 0, followed by regular cards`);
        
        // Set the new data to the filtered data ref, not savedItems
        filteredDataRef.current = newData;
        setCurrentIndex(0);
        
        // Reset the exitingWaiterMode flag after a short delay to ensure state updates complete
        setTimeout(() => {
          if (isMountedRef.current) {
            isExitingWaiterModeRef.current = false;
            console.log(`[WAITER-DEBUG] Exit process complete, cleared exiting flag`);
          }
        }, 100);
      } else {
        console.log(`[WAITER-DEBUG] No saved pre-waiter mode state or current item, keeping current stack`);
        // NO state updates to filteredData or currentIndex if we don't have saved state
        
        // Reset the exitingWaiterMode flag immediately since we're not changing state
        isExitingWaiterModeRef.current = false;
      }
    }
  }, [data, currentIndex, onRequestRestaurantItems, waiterModeActive]);

  // Add handlers for couple mode
  const handleCoupleModePress = useCallback(() => {
    setShowCoupleMode(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleCoupleModeExit = useCallback(() => {
    setShowCoupleMode(false);
  }, []);

  // Handle swipe action
  const handleSwipe = useCallback((item: SanityMenuItem, direction: SwipeDirection) => {
    if (!isMountedRef.current) return;
    
    try {
      if (direction === 'right') {
        onLike?.(item);
        // Only add to saved items if we're swiping right (like)
        // This is separate from filtered data which is used for displaying cards
        setSavedItems(prev => [...prev, item]);
        savedBadgeScale.value = withSequence(
          withSpring(1.2),
          withSpring(1)
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        onDislike?.(item);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Add to swipe history
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
      
      // Increment index immediately with no delay
      setCurrentIndex(prev => prev + 1);
    } catch (error) {
      console.error('Error in handleSwipe:', error);
      // Still increment index to avoid getting stuck
      setCurrentIndex(prev => prev + 1);
    }
  }, [onLike, onDislike, onSwipeHistoryUpdate, savedBadgeScale]);

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

  // Filter icon data for display
  const filterIcons = {
    'all': { icon: 'restaurant-menu', color: '#FF3B5C', iconFamily: 'MaterialIcons' },
    'spicy': { icon: 'fire', color: '#FF5252', iconFamily: 'FontAwesome5' },
    'vegan': { icon: 'leaf', color: '#4CAF50', iconFamily: 'FontAwesome5' },
    'dessert': { icon: 'ice-cream', color: '#FF80AB', iconFamily: 'Ionicons' },
    'healthy': { icon: 'heartbeat', color: '#2196F3', iconFamily: 'FontAwesome5' },
    'breakfast': { icon: 'coffee', color: '#FFA000', iconFamily: 'FontAwesome5' },
    'lunch': { icon: 'hamburger', color: '#795548', iconFamily: 'FontAwesome5' },
    'dinner': { icon: 'utensils', color: '#607D8B', iconFamily: 'FontAwesome5' },
    'comfort': { icon: 'home', color: '#9C27B0', iconFamily: 'FontAwesome5' },
    'seafood': { icon: 'fish', color: '#00BCD4', iconFamily: 'FontAwesome5' },
    'fast-food': { icon: 'hamburger', color: '#F44336', iconFamily: 'FontAwesome5' }
  };

  // Check if we've gone through all cards
  const isFinished = currentIndex >= data.length;

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
        stiffness: 100
      });
    } else {
      filterModalAnim.value = withSpring(-50, {
        damping: 15,
        stiffness: 100
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
  const filteredData = useMemo(() => {
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

  // Navigate to couple mode - updated to use the tab screen
  const navigateToCoupleMode = useCallback(() => {
    if (isMountedRef.current) {
      console.log("Navigating to couple mode");
      
      // This would normally use React Navigation or Expo Router to navigate
      try {
        // Example with Expo Router (would be imported at the top)
        // const router = useRouter();
        // router.push('/(tabs)/couple-mode');
        
        // Since we don't have direct access to the router, we'll use Alert for demo
        // In a real implementation, you would import and use the router
        Alert.alert(
          "Couple Mode", 
          "This would navigate to the CoupleMode tab. In a real implementation, you would use:\n\nconst router = useRouter();\nrouter.push('/(tabs)/couple-mode');",
          [{ text: "OK" }]
        );
      } catch (error) {
        console.error("Error navigating to couple mode:", error);
        Alert.alert("Navigation Error", "Could not navigate to couple mode");
      }
    }
  }, []);

  // Update render header to use the WaiterButton component properly
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerLeftContainer}>
          <TouchableOpacity 
            style={styles.companyButton}
            activeOpacity={0.6}
          >
            <View style={styles.companyButtonContainer}>
              <Image 
                source={require('../../assets/images/companybutton.png')} 
                style={styles.companyButtonImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        </View>
        
        {/* Empty middle space */}
        <View style={styles.headerCenterContainer} />
        
        <View style={styles.headerRightContainer}>
          {/* Waiter Button */}
          <WaiterButton
            onPress={handleWaiterButtonPress}
            isActive={waiterModeActive}
          />
          
          {/* Couple Mode Button */}
          <TouchableOpacity 
            style={styles.coupleButton} 
            onPress={handleCoupleModePress}
            activeOpacity={0.6}
          >
            <View style={styles.coupleButtonContainer}>
              <Ionicons name="heart" size={22} color="#FF3B5C" />
            </View>
          </TouchableOpacity>
          
          {/* Filter Button */}
          <TouchableOpacity 
            style={styles.filterButton} 
            onPress={toggleFilterModal}
            activeOpacity={0.6}
          >
            <View style={styles.filterButtonContainer}>
              {selectedFilters.length > 0 ? (
                // Show the first selected filter icon
                (() => {
                  const filter = selectedFilters[0];
                  const iconInfo = filterIcons[filter as keyof typeof filterIcons];
                  
                  if (!iconInfo) return <Ionicons name="options-outline" size={22} color="#FF3B5C" />;
                  
                  switch(filter) {
                    case 'spicy':
                      return <FontAwesome5 name="fire" size={22} color={iconInfo.color} />;
                    case 'vegan':
                      return <FontAwesome5 name="leaf" size={22} color={iconInfo.color} />;
                    case 'dessert':
                      return <Ionicons name="ice-cream" size={22} color={iconInfo.color} />;
                    case 'healthy':
                      return <FontAwesome5 name="heartbeat" size={22} color={iconInfo.color} />;
                    case 'breakfast':
                      return <FontAwesome5 name="coffee" size={22} color={iconInfo.color} />;
                    case 'lunch':
                    case 'fast-food':
                      return <FontAwesome5 name="hamburger" size={22} color={iconInfo.color} />;
                    case 'dinner':
                      return <FontAwesome5 name="utensils" size={22} color={iconInfo.color} />;
                    case 'comfort':
                      return <FontAwesome5 name="home" size={22} color={iconInfo.color} />;
                    case 'seafood':
                      return <FontAwesome5 name="fish" size={22} color={iconInfo.color} />;
                    default:
                      return <Ionicons name="options-outline" size={22} color="#FF3B5C" />;
                  }
                })()
              ) : (
                <Ionicons name="options-outline" size={22} color="#FF3B5C" />
              )}
            </View>
          </TouchableOpacity>

          {/* Menu Button */}
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={toggleSavedItems}
            activeOpacity={0.6}
          >
            <View style={styles.menuButtonContainer}>
              <Ionicons name="restaurant-outline" size={22} color="#FF3B5C" />
              {savedItems.length > 0 && (
                <Animated.View style={[styles.badgeContainer, savedBadgeScaleStyle]}>
                  <Text style={styles.badgeText}>{savedItems.length}</Text>
                </Animated.View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [
    waiterModeActive,
    handleWaiterButtonPress,
    handleCoupleModePress,
    savedItems.length,
    selectedFilters,
    toggleFilterModal,
    toggleSavedItems,
    savedBadgeScaleStyle
  ]);

  // Render filter modal
  const renderFilterModal = useCallback(() => {
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setFilterModalVisible(false)}
        >
          <Animated.View 
            style={[
              styles.filterModalContent,
              filterModalAnimStyle
            ]}
          >
            <View style={styles.filterModalTopHeader}>
              <Text style={styles.filterModalTopTitle}>Filter Foods</Text>
              <TouchableOpacity 
                onPress={() => setFilterModalVisible(false)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons name="close-outline" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <FoodFilter 
              onFilterChange={handleFilterChange} 
              initialSelectedFilters={selectedFilters}
              onClose={() => setFilterModalVisible(false)}
            />
            
            <View style={styles.filterButtonRow}>
              <TouchableOpacity 
                style={styles.clearAllButton}
                onPress={() => handleFilterChange([])}
              >
                <Text style={styles.clearAllButtonText}>Clear All</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.applyFiltersButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.applyFiltersButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  }, [filterModalVisible, filterModalAnimStyle, selectedFilters, handleFilterChange]);

  // Render bottom toolbar
  const renderBottomToolbar = useCallback(() => {
    return (
      <View style={styles.bottomToolbar}>
        <TouchableOpacity 
          style={[styles.toolbarButton, isMapExpanded && styles.toolbarButtonActive]}
          onPress={toggleMapExpanded}
        >
          <View style={styles.toolbarButtonInner}>
            <Ionicons name="map" size={30} color={isMapExpanded ? "#FF3B5C" : "#666"} />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.toolbarButton}
          onPress={() => {
            cameraScale.value = withSequence(
              withSpring(0.8),
              withSpring(1)
            );
            setCameraSelectionModalVisible(true);
          }}
        >
          <Animated.View style={[styles.toolbarButtonInner, { transform: [{ scale: cameraScale }] }]}>
            <Ionicons name="camera" size={30} color="#666" />
          </Animated.View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.toolbarButton}
          onPress={() => {
            profileScale.value = withSequence(
              withSpring(0.8),
              withSpring(1)
            );
          }}
        >
          <Animated.View style={[styles.toolbarButtonInner, { transform: [{ scale: profileScale }] }]}>
            <Ionicons name="person" size={30} color="#666" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  }, [
    isMapExpanded, 
    toggleMapExpanded, 
    cameraScale, 
    profileScale
  ]);

  // Render saved items modal
  const renderSavedItemsModal = useCallback(() => {
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={savedItemsVisible}
        onRequestClose={toggleSavedItems}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Saved Dishes</Text>
              <TouchableOpacity onPress={toggleSavedItems}>
                <Ionicons name="close" size={28} color="#555" />
              </TouchableOpacity>
            </View>

            {savedItems.length === 0 ? (
              <View style={styles.emptyListContainer}>
                <Ionicons name="restaurant-outline" size={70} color="#ccc" />
                <Text style={styles.emptyListText}>No saved dishes yet!</Text>
                <Text style={styles.emptyListSubtext}>
                  Swipe right on dishes you like to save them here
                </Text>
              </View>
            ) : (
              <FlatList
                data={savedItems}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <View style={styles.savedItemCard}>
                    <Image source={{ uri: item.s3_url }} style={styles.savedItemImage} />
                    <View style={styles.savedItemInfo}>
                      <Text style={styles.savedItemName}>{item.title}</Text>
                      <Text style={styles.savedItemRestaurant}>{item.title}</Text>
                      <View style={styles.deliveryOptionsContainer}>
                        {item.uber_eats_url && (
                          <TouchableOpacity
                            style={styles.deliveryButton}
                            onPress={() => handleDeliveryPress(item.title, 'Uber Eats', item.uber_eats_url)}
                          >
                            <FontAwesome5 name="uber" size={18} color="#000" />
                          </TouchableOpacity>
                        )}
                        {item.doordash_url && (
                          <TouchableOpacity
                            style={styles.deliveryButton}
                            onPress={() => handleDeliveryPress(item.title, 'DoorDash', item.doordash_url)}
                          >
                            <MaterialIcons name="delivery-dining" size={18} color="#FF3008" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    );
  }, [savedItemsVisible, savedItems, handleDeliveryPress]);

  // Render camera selection modal
  const renderCameraSelectionModal = useCallback(() => {
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={cameraSelectionModalVisible}
        onRequestClose={() => setCameraSelectionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cameraSelectionModalContent}>
            <View style={styles.cameraModalHeader}>
              <Text style={styles.cameraModalTitle}>Take a Photo</Text>
              <TouchableOpacity onPress={() => setCameraSelectionModalVisible(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>

            {savedItems.length === 0 ? (
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListText}>Save some dishes first!</Text>
              </View>
            ) : (
              <FlatList
                data={savedItems}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.cameraSelectionItem}
                    onPress={() => {
                      setSelectedItemForCamera(item);
                      setCameraSelectionModalVisible(false);
                      Alert.alert(
                        'Camera Opening',
                        `Taking a photo of ${item.title}...`,
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Image source={{ uri: item.s3_url }} style={styles.cameraSelectionImage} />
                    <View style={styles.cameraSelectionInfo}>
                      <Text style={styles.cameraSelectionName}>{item.title}</Text>
                      <Text style={styles.cameraSelectionRestaurant}>{item.title}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    );
  }, [cameraSelectionModalVisible, savedItems]);

  // Render cards
  const renderCards = useCallback(() => {
    const isFinished = currentIndex >= data.length;

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

    if (!data || data.length === 0 || currentIndex >= data.length) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyStateText}>No dishes match your criteria</Text>
        </View>
      );
    }

    // Take a slice of the data for visible cards - always show exactly 2 cards
    const visibleCards = data
      .slice(currentIndex, Math.min(currentIndex + VISIBLE_CARDS, data.length));

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
          key={`card-${item._id}`}
          food={item}
          onSwipe={handleSwipe}
          isFirst={index === 0}
          index={index}
        />
      ))
      .reverse();
  }, [currentIndex, data, handleSwipe, isFilterChanging]);

  // Restore all the beautiful UI components and functionality
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* App Header */}
        {renderHeader()}

        {/* Filter Modal */}
        {renderFilterModal()}

        {/* Main Content */}
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

          {/* Cards Container - simplified structure */}
          <View style={styles.cardsOuterContainer}>
            {renderCards()}
          </View>
        </View>

        {/* Bottom Toolbar */}
        {!isFinished && renderBottomToolbar()}
      </SafeAreaView>

      {/* Saved Items Modal */}
      {renderSavedItemsModal()}

      {/* Camera Selection Modal */}
      {renderCameraSelectionModal()}

      {/* Couple Mode */}
      {showCoupleMode && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={showCoupleMode}
          onRequestClose={handleCoupleModeExit}
        >
          <CoupleMode 
            data={data.map(item => ({
              id: item._id,
              name: item.menu_item,
              description: item.description || '',
              imageUrl: item.s3_url,
              restaurant: item.title,
              price: item.price_level || '$',
              cuisine: item.cuisine || '',
              foodType: item.food_type ? 
                [item.food_type as FoodType] : 
                ['all' as FoodType],
              deliveryUrls: {
                uberEats: item.uber_eats_url,
                doorDash: item.doordash_url,
                postmates: item.postmates_url,
              },
              address: item.address,
              coordinates: {
                latitude: item.latitude || 0,
                longitude: item.longitude || 0
              },
              distanceFromUser: item.distance_from_user,
              estimatedDuration: item.estimated_duration
            }))} 
            onExit={handleCoupleModeExit} 
            userId={Date.now().toString()} // Generate a simple userId
          />
        </Modal>
      )}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff0f3',
  },
  safeArea: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff8f9',
    borderBottomWidth: 1,
    borderBottomColor: '#ffccd5',
    zIndex: 10,
    position: 'relative',
  },
  headerLeftContainer: {
    flex: 0.8,
    justifyContent: 'center',
  },
  companyButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ffccd5',
  },
  companyButtonContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  companyButtonImage: {
    width: '100%',
    height: '100%',
  },
  headerCenterContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightContainer: {
    flex: 1.5,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  coupleButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ffccd5',
  },
  coupleButtonContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ffccd5',
  },
  filterButtonContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ffccd5',
  },
  menuButtonContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B5C',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'white',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  cardsOuterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    width: SCREEN_WIDTH,
    paddingVertical: 10,
    // Set height to match card dimensions with some padding
    height: CARD_HEIGHT + 30,
  },
  bottomToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff8f9',
    borderTopWidth: 1,
    borderTopColor: '#ffccd5',
    zIndex: 10,
    position: 'relative',
  },
  toolbarButton: {
    width: 90,
    height: 60,
  },
  toolbarButtonActive: {
    backgroundColor: '#fff0f3',
    borderColor: '#FF3B5C',
  },
  toolbarButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ffccd5',
  },
  mapExpandedContainer: {
    backgroundColor: '#fff8f9',
    borderTopWidth: 1,
    borderTopColor: '#ffccd5',
    padding: 16,
  },
  mapContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: '#FF3B5C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    // Add elevation for Android
    elevation: 5,
    // Add shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fadeAnimStyle: {
    // Add your fade animation styles here
  },
  mainContentContainer: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noResultsText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  noResultsSubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  changeFilterButton: {
    backgroundColor: '#FF3B5C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  changeFilterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModalContent: {
    backgroundColor: 'white',
    borderRadius: 30,
    width: '90%',
    paddingVertical: 20,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  filterModalTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  filterModalTopTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  filterButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginTop: 8,
  },
  clearAllButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  clearAllButtonText: {
    color: '#555',
    fontSize: 16,
    fontWeight: '600',
  },
  applyFiltersButton: {
    flex: 1,
    backgroundColor: '#FF3B5C',
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  applyFiltersButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyListContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyListText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyListSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  savedItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ffccd5',
  },
  savedItemImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 10,
  },
  savedItemInfo: {
    flex: 1,
  },
  savedItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  savedItemRestaurant: {
    fontSize: 14,
    color: '#666',
  },
  deliveryOptionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  deliveryButton: {
    padding: 5,
  },
  cameraSelectionModalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    width: '80%',
    maxHeight: '80%',
  },
  cameraModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cameraModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cameraSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ffccd5',
  },
  cameraSelectionImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 10,
  },
  cameraSelectionInfo: {
    flex: 1,
  },
  cameraSelectionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  cameraSelectionRestaurant: {
    fontSize: 14,
    color: '#666',
  },
});

const SwipeableCards = memo(SwipeableCardsComponent);

export { SwipeableCards }; 