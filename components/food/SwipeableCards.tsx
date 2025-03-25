import React, { useState, useCallback, useEffect, memo, useRef, Fragment } from 'react';
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
import { FoodItem, SwipeDirection, SwipeHistoryItem, FoodType } from '../../types/food';
import { FoodCard } from './FoodCard';
import FoodFilter from './FoodFilter';
import WaiterButton from './WaiterButton';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Number of cards to render in the stack
const VISIBLE_CARDS = 2; // Reduced from 3 to minimize render load
// Disable preloading completely
const PRELOAD_CARDS = 0;
// Flag to disable preloading completely
const DISABLE_PRELOADING = true;
// Debug flag to enable detailed crash debugging logs
const DEBUG_ENABLED = false;
// Flag to disable swiping during problematic stages
const DISABLE_SWIPE_DURING_LOAD = true;

interface SwipeableCardsProps {
  data: FoodItem[];
  onLike?: (food: FoodItem) => void;
  onDislike?: (food: FoodItem) => void;
  onSwipeHistoryUpdate?: (history: SwipeHistoryItem[]) => void;
  onRequestRestaurantItems?: (restaurant: string) => Promise<FoodItem[]>;
}

// Centralized error logging function
const logError = (location: string, error: any, additionalInfo: any = {}) => {
  console.error(`[ERROR] ${location}:`, error);
  if (Object.keys(additionalInfo).length > 0) {
    console.error('Additional info:', additionalInfo);
  }
};

const SwipeableCardsComponent: React.FC<SwipeableCardsProps> = ({
  data,
  onLike,
  onDislike,
  onSwipeHistoryUpdate,
  onRequestRestaurantItems,
}) => {
  console.log('[CRASH-DEBUG] Mounting SwipeableCards component');
  
  // Debug flags to turn off all logging and prevent animations
  const NO_FOOD_LOGGING = false;
  
  // Create a unique stable ID for this component instance to use in keys
  const componentId = useRef(`swipe-${Date.now()}`).current;
  
  // Store reference to the complete dataset to ensure we have access to all 3000 items
  const fullDatasetRef = useRef<FoodItem[]>(data);
  
  // Add debug log
  console.log(`[FULL-DATASET-DEBUG] Initial data length: ${data.length}, fullDatasetRef length: ${fullDatasetRef.current.length}`);
  
  // Batch size constants for better performance
  const INITIAL_BATCH_SIZE = 50;
  const MAX_VISIBLE_ITEMS = 200;
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeHistory, setSwipeHistory] = useState<SwipeHistoryItem[]>([]);
  const [savedItems, setSavedItems] = useState<FoodItem[]>([]);
  const [savedItemsVisible, setSavedItemsVisible] = useState(false);
  const [currentRange, setCurrentRange] = useState<number>(10);
  const [selectedFilters, setSelectedFilters] = useState<FoodType[]>([]);
  // Load only a subset of data initially
  const [batchedData, setBatchedData] = useState<FoodItem[]>([]);
  const [filteredData, setFilteredData] = useState<FoodItem[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [cameraSelectionModalVisible, setCameraSelectionModalVisible] = useState(false);
  const [selectedItemForCamera, setSelectedItemForCamera] = useState<FoodItem | null>(null);
  // New state for favorites and tab selection
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  
  // Waiter mode state
  const [waiterModeActive, setWaiterModeActive] = useState<boolean>(false);
  const [currentRestaurant, setCurrentRestaurant] = useState<string | null>(null);
  
  // Track mounted state
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const previousDataRef = useRef<FoodItem[]>([]);
  // Add a stabilization flag to prevent repeated rerenders
  const initialRenderRef = useRef(true);
  // Track if a swipe is in progress to prevent image loading
  const isSwipingRef = useRef(false);
  // Track the last swipe time to add delay before preloading
  const lastSwipeTimeRef = useRef(0);
  
  // New refs to store pre-waiter mode state
  const preWaiterModeDataRef = useRef<FoodItem[]>([]);
  const preWaiterModeIndexRef = useRef<number>(0);
  const isExitingWaiterModeRef = useRef<boolean>(false);
  
  // Reanimated shared values for animations
  const fadeAnim = useSharedValue(1);
  const savedBadgeScale = useSharedValue(1);
  const filterModalAnim = useSharedValue(-50);
  const mapExpandAnim = useSharedValue(0);

  // Add these button animation values at the component level
  const mapScale = useSharedValue(1);
  const cameraScale = useSharedValue(1);
  const profileScale = useSharedValue(1);

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

  // Initial data batching with enhanced logging
  useEffect(() => {
    if (data && data.length > 0) {
      // Add detailed logging about the data being received
      console.log(`[DATA-DEBUG] Received data with ${data.length} items`);
      
      // Log some unique restaurant names as a sanity check
      const restaurantSet = new Set<string>();
      data.forEach(item => {
        if (item.restaurant) restaurantSet.add(item.restaurant);
      });
      console.log(`[DATA-DEBUG] Found ${restaurantSet.size} unique restaurants in this dataset`);
      
      // Sample the first few restaurants for debugging
      const restaurantSample = Array.from(restaurantSet).slice(0, 5);
      console.log(`[DATA-DEBUG] Sample restaurants: ${restaurantSample.join(', ')}`);
      
      // Store the full dataset in our ref - IMPORTANT: This must contain ALL items from S3
      fullDatasetRef.current = [...data];
      console.log(`[FULL-DATA] Stored complete dataset with ${fullDatasetRef.current.length} items in fullDatasetRef`);
      
      // Check if this is likely the full dataset or just a partial batch
      if (data.length >= 1000) {
        console.log(`[DATA-DEBUG] Detected full dataset with ${data.length} items`);
      } else {
        console.log(`[DATA-DEBUG] Warning: Received smaller dataset (${data.length} items) - may not be complete`);
      }
      
      // Take only the first batch for initial render (for performance)
      const initialBatch = data.slice(0, INITIAL_BATCH_SIZE);
      console.log(`[CRASH-DEBUG] Initializing with first ${initialBatch.length} items out of ${data.length}`);
      setBatchedData(initialBatch);
    }
  }, [data]);
  
  // Load more data as user swipes
  useEffect(() => {
    // Skip if in waiter mode - we've already loaded all restaurant items
    if (waiterModeActive) {
      console.log("[BATCH-DEBUG] Skipping batch loading while in waiter mode");
      return;
    }
  
    // If we're approaching the end of our batched data, load more
    if (currentIndex > batchedData.length - 10 && batchedData.length < Math.min(data.length, MAX_VISIBLE_ITEMS)) {
      const nextBatchSize = Math.min(data.length - batchedData.length, INITIAL_BATCH_SIZE);
      
      if (nextBatchSize > 0) {
        console.log(`[CRASH-DEBUG] Loading next batch of ${nextBatchSize} items`);
        const nextBatch = data.slice(batchedData.length, batchedData.length + nextBatchSize);
        setBatchedData(prev => [...prev, ...nextBatch]);
      }
    }
  }, [currentIndex, batchedData.length, data, waiterModeActive]);
  
  // Create refs to keep track of latest state values without causing effect reruns
  const filteredDataRef = useRef(filteredData);
  const currentIndexRef = useRef(currentIndex);

  // Update refs when the actual state changes
  useEffect(() => {
    filteredDataRef.current = filteredData;
  }, [filteredData]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  
  // Main effect for handling both waiter mode and filter changes
  useEffect(() => {
    // Skip if component is not mounted or during animation
    if (!isMountedRef.current) return;
    
    // CRITICAL FIX: Use our ref flag to completely skip this effect when exiting waiter mode
    if (isExitingWaiterModeRef.current) {
      console.log("[WAITER-EXIT-DEBUG] Skipping filter effect because we're in the process of exiting waiter mode");
      return;
    }
    
    // Skip if waiter mode is active - we handle that directly in the handleWaiterButtonPress
    if (waiterModeActive && currentRestaurant) {
      console.log("Skipping filter effect because waiter mode is already active");
      return;
    }
    
    console.log("Data filter effect running, waiter mode:", waiterModeActive, "restaurant:", currentRestaurant);
    
    try {
      // Get current visible item before making any changes
      const currentItem = filteredDataRef.current[currentIndexRef.current];
      
      // Create a new filtered dataset based on current conditions
      let newFilteredData;
      
      // Apply regular filters
      if (selectedFilters.length > 0) {
        console.log("Filtering by food types:", selectedFilters);
        // Apply selected food type filters
        newFilteredData = batchedData.filter(item => 
          item.foodType.some(type => selectedFilters.includes(type))
        );
      } else {
        // No filters, show all batched data
        console.log("No filters applied, showing all data");
        newFilteredData = [...batchedData];
      }
      
      // Skip filtering if nothing changed
      if (JSON.stringify(newFilteredData) === JSON.stringify(filteredData)) {
        return;
      }
      
      console.log(`Updating filtered data with ${newFilteredData.length} items`);
      
      // Update filtered data with the new dataset
      setFilteredData(newFilteredData);
      
      // If current item exists, try to find it in the new dataset
      if (currentItem) {
        const newIndex = newFilteredData.findIndex(item => item.id === currentItem.id);
        
        // If we can't find the item in the new dataset
        if (newIndex === -1) {
          // Check if we're exiting waiter mode
          const isPostWaiterMode = !waiterModeActive && currentRestaurant === null;
          
          if (isPostWaiterMode) {
            // If we're right after waiter mode, try to maintain a reasonable position
            const safeIndex = Math.min(currentIndexRef.current, newFilteredData.length - 1);
            console.log(`[WAITER-EXIT] Maintaining position near index ${safeIndex} after waiter mode`);
            if (safeIndex >= 0) {
              setCurrentIndex(safeIndex);
            }
          } else {
            // Normal case - reset to first item
            console.log("Current item not found in new dataset, resetting to first item");
            setCurrentIndex(0);
          }
        } else if (newIndex !== currentIndexRef.current) {
          // Found item at different position, update index
          setCurrentIndex(newIndex);
        }
        // Otherwise keep the current index (stay on the same card)
      }
    } catch (error) {
      console.error("Error updating filtered data:", error);
      
      // Fallback to showing all batched data
      setFilteredData(batchedData);
    }
    
  }, [batchedData, selectedFilters, waiterModeActive, currentRestaurant]);

  // Track mount status and initialize references
  useEffect(() => {
    // Set up initial value for previousDataRef
    if (data && data.length > 0) {
      previousDataRef.current = [...data];
    }
    
    // Mark first render as complete after a delay
    const initialRenderTimeoutId = setTimeout(() => {
      initialRenderRef.current = false;
    }, 100);
    
    timeoutsRef.current.push(initialRenderTimeoutId);
    
    return () => {
      isMountedRef.current = false;
      
      // Clear all timeouts
      timeoutsRef.current.forEach(timeout => {
        try {
          clearTimeout(timeout);
        } catch (error) {
          // Ignore errors during cleanup
        }
      });
      
      // Clear the timeouts array
      timeoutsRef.current = [];
    };
  }, [data]);
  
  // Update currentRestaurant when currentIndex changes (for waiter mode)
  // Completely rewritten to prevent unnecessary rerenders
  useEffect(() => {
    // Skip if not in waiter mode or component is not mounted
    if (!waiterModeActive || !isMountedRef.current) return;
    
    // Skip if no filtered data or index out of bounds
    if (!filteredData || filteredData.length === 0 || currentIndex >= filteredData.length) return;
    
    // In waiter mode, we don't need to update the restaurant since it's already set
    // This prevents the reload loop by keeping the restaurant constant
  }, [currentIndex, waiterModeActive, filteredData]);

  // Create all animated styles at component level
  const fadeAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value
    };
  });

  const savedBadgeScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: savedBadgeScale.value }]
    };
  });

  const filterModalAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: filterModalAnim.value }]
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

  // Handle fade out and in for filter changes
  const handleFadeOutComplete = useCallback((currentData: FoodItem[], currentFilters: FoodType[]) => {
    if (!isMountedRef.current) return;
    
    try {
      // After fade out, update the filtered data with a timeout for smoother transition
      const updateDataTimeout = setTimeout(() => {
        if (!isMountedRef.current) return;
        
        try {
          let newFilteredData = currentData;
          
          if (currentFilters.length > 0) {
            // Apply filters - show foods that match ANY of the selected filters
            newFilteredData = currentData.filter((foodItem: FoodItem) => 
              foodItem && foodItem.foodType && Array.isArray(foodItem.foodType) && 
              foodItem.foodType.some((type: FoodType) => currentFilters.includes(type))
            );
          }
          
          // Update state safely
          if (isMountedRef.current) {
            setFilteredData(newFilteredData);
            setCurrentIndex(0);
            setPreloadedImages(new Set());
          }
          
          // Fade back in with a small delay for smoother transition
          const fadeInTimeout = setTimeout(() => {
            if (!isMountedRef.current) return;
            
            fadeAnim.value = withTiming(1, {
              duration: 300,
              easing: Easing.out(Easing.cubic)
            }, () => {
              runOnJS(setIsFilterChanging)(false);
            });
          }, 100);
          
          // Store timeout for cleanup
          timeoutsRef.current.push(fadeInTimeout);
        } catch (error) {
          console.error("Error updating filtered data:", error);
          if (isMountedRef.current) {
            setIsFilterChanging(false);
            fadeAnim.value = 1;
          }
        }
      }, 50);
      
      // Store timeout for cleanup
      timeoutsRef.current.push(updateDataTimeout);
    } catch (error) {
      console.error("Error in filter animation callback:", error);
      if (isMountedRef.current) {
        setIsFilterChanging(false);
        fadeAnim.value = 1;
      }
    }
  }, [fadeAnim]);

  // Apply filters when selectedFilters changes
  useEffect(() => {
    // Store local copies of state to avoid closure issues
    const currentData = data ? [...data] : [];
    const currentFilters = selectedFilters ? [...selectedFilters] : [];
    
    try {
      // Safety check to ensure data is available
      if (!currentData || !Array.isArray(currentData)) {
        console.warn('data is not available or not an array');
        return;
      }

      // Start the transition - fade out current cards
      if (isMountedRef.current) {
        setIsFilterChanging(true);
      }
      
      // Use Reanimated for the fade out animation
      fadeAnim.value = withTiming(0, {
        duration: 200,
        easing: Easing.out(Easing.cubic)
      }, () => {
        runOnJS(handleFadeOutComplete)(currentData, currentFilters);
      });
    } catch (error) {
      console.error("Error applying filters:", error);
      if (isMountedRef.current) {
        setIsFilterChanging(false);
      }
    }
  }, [selectedFilters, data, fadeAnim, handleFadeOutComplete]);

  // Create a global debounce function for swipe handling
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: any[]) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        func(...args);
      }, wait);
    };
  };

  // Error-caught preload function
  const preloadImagesMemoized = useCallback(async () => {
    // Do nothing - completely disabled
    return;
  }, []);

  // Handle swipe action
  const handleSwipe = useCallback((foodItem: FoodItem, direction: SwipeDirection) => {
    // Don't process if component is unmounted
    if (!isMountedRef.current) return;
    
    try {
      // Create a safe copy of the food item to avoid reference issues
      const safeFoodItem: FoodItem = {
        id: foodItem.id || '',
        name: foodItem.name || '',
        imageUrl: foodItem.imageUrl || '',
        restaurant: foodItem.restaurant || '',
        price: foodItem.price || '',
        cuisine: foodItem.cuisine || '',
        description: foodItem.description || '',
        foodType: foodItem.foodType ? [...foodItem.foodType] : [],
        deliveryServices: foodItem.deliveryServices ? [...foodItem.deliveryServices] : [],
        deliveryUrls: foodItem.deliveryUrls ? { ...foodItem.deliveryUrls } : {}
      };
      
      // Create a new history item
      const historyItem: SwipeHistoryItem = {
        foodItem: safeFoodItem,
        direction,
        timestamp: Date.now()
      };
      
      // Update swipe history - use functional update
      setSwipeHistory(prevHistory => {
        const newHistory = [...prevHistory, historyItem];
        
        // Call the onSwipeHistoryUpdate callback if provided
        if (onSwipeHistoryUpdate) {
          try {
            // Use setTimeout to ensure state updates don't happen during render
            const timeoutId = setTimeout(() => {
              if (isMountedRef.current) {
                onSwipeHistoryUpdate(newHistory);
              }
            }, 0);
            
            // Store timeout for cleanup
            timeoutsRef.current.push(timeoutId);
          } catch (error) {
            console.error("Error in onSwipeHistoryUpdate callback:", error);
          }
        }
        
        return newHistory;
      });
      
      // Trigger haptic feedback based on swipe direction
      if (direction === 'right') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (direction === 'left') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Handle like/dislike callbacks
      if (direction === 'right' && onLike) {
        // Update saved items - use functional update
        setSavedItems(prevItems => {
          return [...prevItems, safeFoodItem];
        });
        
        // Animate the badge
        savedBadgeScale.value = withTiming(1.3, { duration: 150 }, () => {
          savedBadgeScale.value = withTiming(1, { duration: 150 });
        });
        
        // Call onLike callback with a delay to avoid blocking
        if (isMountedRef.current) {
          const timeoutId = setTimeout(() => {
            if (isMountedRef.current) {
              try {
                onLike(safeFoodItem);
              } catch (error) {
                console.error("Error in onLike callback:", error);
              }
            }
          }, 0);
          
          // Store timeout for cleanup
          timeoutsRef.current.push(timeoutId);
        }
      } else if (direction === 'left' && onDislike) {
        // Call onDislike callback with a delay to avoid blocking
        if (isMountedRef.current) {
          const timeoutId = setTimeout(() => {
            if (isMountedRef.current) {
              try {
                onDislike(safeFoodItem);
              } catch (error) {
                console.error("Error in onDislike callback:", error);
              }
            }
          }, 0);
          
          // Store timeout for cleanup
          timeoutsRef.current.push(timeoutId);
        }
      }
      
      // Move to next card - use functional update
      setCurrentIndex(prevIndex => prevIndex + 1);
    } catch (error) {
      console.error("Error in handleSwipe:", error);
      // Still increment the index to avoid getting stuck
      setCurrentIndex(prevIndex => prevIndex + 1);
    }
  }, [onSwipeHistoryUpdate, onLike, onDislike, savedBadgeScale]);

  // Toggle filter modal - modified to prevent issues
  const toggleFilterModal = useCallback(() => {
    // Using a setTimeout to prevent blocking the UI thread
    if (isMountedRef.current) {
      setTimeout(() => {
        if (isMountedRef.current) {
          setFilterModalVisible(prev => !prev);
        }
      }, 0);
    }
  }, []);

  // Handle filter changes from the FoodFilter component - make it safer
  const handleFilterChange = useCallback((filters: FoodType[]) => {
    try {
      if (!isMountedRef.current) return;
      
      // If filters include 'all', treat it as no filters selected
      const actualFilters = filters.includes('all') ? [] : filters;
      
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

  // Check if we've gone through all cards
  const isFinished = currentIndex >= filteredData.length;

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
      console.log(`Opening delivery URL: ${url}`);
      Alert.alert(
        "Open Delivery Service",
        `Would you like to order ${foodName} from ${serviceName}?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Open", 
            onPress: () => {
              console.log(`Opening URL: ${url}`);
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

  // Clear all non-favorited items
  const clearNonFavorites = useCallback(() => {
    setSavedItems(prev => prev.filter(item => favoriteItems.has(item.id)));
  }, [favoriteItems]);

  // Update range settings
  const updateRange = useCallback((range: number) => {
    setCurrentRange(range);
  }, []);

  // Cycle through range options when tapped
  const cycleRange = useCallback(() => {
    const ranges = [5, 10, 15, 20];
    const currentIndex = ranges.indexOf(currentRange);
    const nextIndex = (currentIndex + 1) % ranges.length;
    updateRange(ranges[nextIndex]);
  }, [currentRange, updateRange]);

  // Toggle map expanded state with smooth animation
  const toggleMapExpanded = useCallback(() => {
    // Toggle the state
    setIsMapExpanded(prev => {
      const newValue = !prev;
      
      if (newValue) {
        // Expand with a spring animation for natural feel
        mapExpandAnim.value = withSpring(80, {
          damping: 18,
          stiffness: 90,
          mass: 0.8
        });
      } else {
        // Collapse with a gentler timing animation - slower than before
        mapExpandAnim.value = withTiming(0, {
          duration: 350, // Increased duration for smoother collapse
          easing: Easing.bezier(0.25, 0.1, 0.25, 1) // Custom bezier curve for natural feel
        });
      }
      
      return newValue;
    });
  }, [mapExpandAnim]);

  // Special reset function to handle unresponsive cards
  const resetCardStack = useCallback(() => {
    // This function can be called when cards become unresponsive
    if (isMountedRef.current) {
      // Force all values to default
      fadeAnim.value = 1;
      setIsFilterChanging(false);
      
      // Ensure we can generate new cards by forcing a re-render with a key change
      // Create a new set of filtered data with the same content
      const resetFilteredData = [...filteredData];
      setFilteredData(resetFilteredData);
      
      // If we're at a valid position, stay there, otherwise reset to beginning
      if (currentIndex >= filteredData.length && filteredData.length > 0) {
        setCurrentIndex(0);
      }
    }
  }, [currentIndex, filteredData, fadeAnim]);

  // Function to fetch all restaurant items directly from API
  const fetchAllRestaurantItems = async (restaurant: string): Promise<FoodItem[]> => {
    try {
      console.log(`Fetching ALL items for ${restaurant} directly from API`);
      const response = await fetch(`https://test-westwood.vercel.app/api/restaurants/${encodeURIComponent(restaurant)}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const restaurantItems = await response.json();
      console.log(`Successfully fetched ${restaurantItems.length} items for ${restaurant} from API`);
      return restaurantItems;
    } catch (error) {
      console.error('Error fetching restaurant items:', error);
      return [];
    }
  };

  // Handle waiter button press - improved to use the callback to request ALL restaurant items
  const handleWaiterButtonPress = useCallback((newIsActive: boolean) => {
    console.log("[WAITER-BUTTON] Waiter button toggled to:", newIsActive, "Current waiter mode active:", waiterModeActive);
    
    // Debug the state of data references
    console.log(`[WAITER-DEBUG] Current data state:
    - fullDatasetRef: ${fullDatasetRef.current.length} items
    - batchedData: ${batchedData.length} items
    - filteredData: ${filteredData.length} items
    - currentIndex: ${currentIndex}`);
    
    // Skip if not mounted
    if (!isMountedRef.current) return;
    
    // CRITICAL FIX: Always force the UI state to match the incoming toggle state
    // This ensures the toggle works both ways
    if (newIsActive !== waiterModeActive) {
      console.log(`[WAITER-DEBUG] Forcing waiter mode state from ${waiterModeActive} to ${newIsActive}`);
    }
    
    // If activating waiter mode, use the callback to request ALL restaurant items
    if (newIsActive && filteredData.length > 0 && currentIndex < filteredData.length) {
      // SAVE STATE: Store the current data before entering waiter mode
      preWaiterModeDataRef.current = [...filteredData];
      console.log(`[WAITER-DEBUG] Saved pre-waiter mode data: ${preWaiterModeDataRef.current.length} items`);
      
      const currentItem = filteredData[currentIndex];
      if (currentItem) {
        const restaurant = currentItem.restaurant;
        
        console.log(`[WAITER-DEBUG] Activating waiter mode for restaurant: ${restaurant}`);
        
        // First, try to find all items for this restaurant in our current dataset
        const currentDatasetItems = fullDatasetRef.current.filter(item => item.restaurant === restaurant);
        console.log(`[WAITER-DEBUG] Found ${currentDatasetItems.length} items in current dataset for ${restaurant}`);
        
        // Save the ETA values from the current card to use for all restaurant items
        const currentDistanceFromUser = currentItem.distanceFromUser;
        const currentEstimatedDuration = currentItem.estimatedDuration;
        console.log(`[WAITER-DEBUG] Using distance: ${currentDistanceFromUser} and duration: ${currentEstimatedDuration} for all restaurant items`);
        
        // Set waiter mode UI first to avoid stuttering - IMPORTANT FIX
        setWaiterModeActive(true);
        setCurrentRestaurant(restaurant);
        
        // Use the callback to request ALL items for this restaurant from the complete S3 dataset
        if (onRequestRestaurantItems) {
          console.log(`[WAITER-DEBUG] Requesting ALL items for ${restaurant} from complete S3 dataset`);
          
          // DO NOT show loading indicator while in waiter mode - prevents stutter
          // setIsFilterChanging(true); - REMOVED
          
          onRequestRestaurantItems(restaurant)
            .then(allRestaurantItems => {
              console.log(`[WAITER-DEBUG] Successfully retrieved ${allRestaurantItems.length} items for ${restaurant} from full dataset`);
              
              if (allRestaurantItems.length > 0) {
                // Log the first few items as a sample
                allRestaurantItems.slice(0, 3).forEach((item, index) => {
                  console.log(`  Item ${index + 1}: ${item.name}`);
                });
                
                if (allRestaurantItems.length > 1) {
                  // Find the current item in the new dataset
                  const currentItemId = currentItem.id;
                  const currentItemIndex = allRestaurantItems.findIndex(item => item.id === currentItemId);
                  
                  console.log(`[WAITER-DEBUG] Current item ID: ${currentItemId}`);
                  console.log(`[WAITER-DEBUG] Current item index in new dataset: ${currentItemIndex}`);
                  
                  // FIX STUTTER: Already set waiter mode state before API call - REMOVED
                  // setWaiterModeActive(true);
                  // setCurrentRestaurant(restaurant);
                  
                  // Use a better approach to prevent UI jumps/stutter
                  if (isMountedRef.current) {
                    // FIX 1: Reorder the array to make current item appear as #1
                    let reorderedItems = [...allRestaurantItems];
                    
                    if (currentItemIndex !== -1) {
                      // Move the current item to the beginning of the array
                      const currentItemObj = reorderedItems.splice(currentItemIndex, 1)[0];
                      reorderedItems = [currentItemObj, ...reorderedItems];
                      console.log(`[WAITER-DEBUG] Reordered items to make ${currentItemObj.name} appear as #1`);
                    }
                    
                    // FIX ETA: Add the distance and duration values from the current item to ALL restaurant items
                    const processedItems = reorderedItems.map(item => ({
                      ...item,
                      distanceFromUser: currentDistanceFromUser,
                      estimatedDuration: currentEstimatedDuration
                    }));
                    console.log(`[WAITER-DEBUG] Added distance and duration values to all ${processedItems.length} restaurant items`);
                    
                    // Set reordered restaurant items - avoid any delay that might cause stutter
                    console.log(`[WAITER-DEBUG] Setting filtered data with ${processedItems.length} items`);
                    setFilteredData(processedItems);
                    
                    // Always start at index 0 since we moved the current item there
                    if (currentIndex !== 0) {
                      setCurrentIndex(0);
                    }
                  }
                  
                  // No alert - removed as requested
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
                  const currentItemId = currentItem.id;
                  const currentItemIndex = currentDatasetItems.findIndex(item => item.id === currentItemId);
                  
                  // Set waiter mode first was already done above - REMOVED
                  // setWaiterModeActive(true);
                  // setCurrentRestaurant(restaurant);
                  
                  if (isMountedRef.current) {
                    // Reorder the array to make current item appear as #1
                    let reorderedItems = [...currentDatasetItems];
                    
                    if (currentItemIndex !== -1) {
                      // Move the current item to the beginning of the array
                      const currentItemObj = reorderedItems.splice(currentItemIndex, 1)[0];
                      reorderedItems = [currentItemObj, ...reorderedItems];
                    }
                    
                    setFilteredData(reorderedItems);
                    
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
                const currentItemId = currentItem.id;
                const currentItemIndex = currentDatasetItems.findIndex(item => item.id === currentItemId);
                
                // Set waiter mode first was already done - REMOVED
                // setWaiterModeActive(true);
                // setCurrentRestaurant(restaurant);
                
                if (isMountedRef.current) {
                  // Reorder the array to make current item appear as #1
                  let reorderedItems = [...currentDatasetItems];
                  
                  if (currentItemIndex !== -1) {
                    // Move the current item to the beginning of the array
                    const currentItemObj = reorderedItems.splice(currentItemIndex, 1)[0];
                    reorderedItems = [currentItemObj, ...reorderedItems];
                  }
                  
                  setFilteredData(reorderedItems);
                  
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
            })
            .finally(() => {
              // No need to hide loading indicator since we never showed it - REMOVED
              // setIsFilterChanging(false);
            });
        } else {
          // No callback provided, fallback to current data (limited dataset)
          console.log(`[WAITER-DEBUG] No callback provided to get full dataset, using available data only`);
          
          if (currentDatasetItems.length > 1) {
            console.log(`[WAITER-DEBUG] Activating waiter mode with ${currentDatasetItems.length} items from current dataset`);
            
            // Find the current item in the current dataset items
            const currentItemId = currentItem.id;
            const currentItemIndex = currentDatasetItems.findIndex(item => item.id === currentItemId);
            
            // Set waiter mode first was already done above - REMOVED
            // setWaiterModeActive(true);
            // setCurrentRestaurant(restaurant);
            
            if (isMountedRef.current) {
              // Reorder the array to make current item appear as #1
              let reorderedItems = [...currentDatasetItems];
              
              if (currentItemIndex !== -1) {
                // Move the current item to the beginning of the array
                const currentItemObj = reorderedItems.splice(currentItemIndex, 1)[0];
                reorderedItems = [currentItemObj, ...reorderedItems];
              }
              
              setFilteredData(reorderedItems);
              
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
      const currentItem = filteredData[currentIndex];
      console.log(`[WAITER-DEBUG] Current item before deactivation: ${currentItem?.name} from ${currentItem?.restaurant}, at index ${currentIndex}`);
      
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
          item.restaurant === currentItem.restaurant
        );
        
        console.log(`[WAITER-DEBUG] Original entry point was index ${originalEntryPoint}`);
        
        // Create new data: current card + everything after original entry point
        const newData = [
          currentItem,
          ...preWaiterModeDataRef.current.slice(originalEntryPoint + 1)
        ];
        
        console.log(`[WAITER-DEBUG] Created new stack with ${newData.length} items`);
        console.log(`[WAITER-DEBUG] Current card ${currentItem.name} at index 0, followed by regular cards`);
        
        // Set the new data and reset index to 0 to start with current card
        setFilteredData(newData);
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
  }, [filteredData, currentIndex, batchedData, selectedFilters, onRequestRestaurantItems, waiterModeActive]);

  // Handle camera permission and opening
  const openCamera = useCallback(async (foodItem: FoodItem) => {
    try {
      // Store the selected item
      setSelectedItemForCamera(foodItem);
      
      // Close the selection modal first to prevent UI from becoming unresponsive
      setCameraSelectionModalVisible(false);
      
      // Small delay to ensure modal is closed before proceeding
      setTimeout(() => {
        if (!isMountedRef.current) return;
        
        // Show a mock camera experience instead of using actual camera
        // This avoids potential permission issues or device-specific problems
        Alert.alert(
          'Camera Opening',
          `Taking a photo of ${foodItem.name}...`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                if (isMountedRef.current) {
                  setSelectedItemForCamera(null);
                }
              }
            },
            {
              text: 'Simulate Photo Taken',
              onPress: () => {
                // Simulate successful photo capture
                setTimeout(() => {
                  if (isMountedRef.current) {
                    Alert.alert(
                      'Photo Captured!',
                      `Your photo of ${foodItem.name} has been saved.`,
                      [{ text: 'Great!' }]
                    );
                    setSelectedItemForCamera(null);
                  }
                }, 500);
              }
            }
          ],
          { cancelable: true }
        );
      }, 300);
    } catch (error) {
      console.error('Error in camera flow:', error);
      
      // Make sure we show an error message even if something goes wrong
      Alert.alert(
        'Camera Error',
        'There was a problem with the camera. Please try again later.',
        [{ text: 'OK' }]
      );
      
      // Reset the selected item
      setSelectedItemForCamera(null);
      
      // Ensure the modal is closed
      setCameraSelectionModalVisible(false);
    }
  }, []);
  
  // Handle opening the camera selection modal
  const handleCameraButtonPress = useCallback(() => {
    try {
      // Check if there are saved items
      if (savedItems.length === 0) {
        Alert.alert(
          'No Saved Items',
          'You need to save some food items first before taking pictures. Swipe right on foods you like to save them.',
          [{ text: 'Got it' }]
        );
        return;
      }
      
      // Open the selection modal with a slight delay to ensure UI responsiveness
      setTimeout(() => {
        if (isMountedRef.current) {
          setCameraSelectionModalVisible(true);
        }
      }, 50);
    } catch (error) {
      console.error('Error opening camera selection modal:', error);
      
      // Show error message
      Alert.alert(
        'Error',
        'There was a problem opening the camera selection. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [savedItems]);

  // Render cards
  const renderCards = useCallback(() => {
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

    // Show loading indicator while filter is changing, but never during waiter mode operations
    if (isFilterChanging && !waiterModeActive) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B5C" />
        </View>
      );
    }

    // Safety check - ensure we have data to display
    if (!filteredData || filteredData.length === 0 || currentIndex >= filteredData.length) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyStateText}>No dishes match your criteria</Text>
        </View>
      );
    }

    // Only get cards that actually exist in the filtered data
    const visibleCards = filteredData
      .slice(currentIndex, Math.min(currentIndex + VISIBLE_CARDS, filteredData.length));
    
    // Check for duplicate cards (same card shown twice in a row)
    // This can happen in waiter mode if there are only a few items from the restaurant
    if (visibleCards.length > 1) {
      const currentId = visibleCards[0].id;
      let hasDuplicate = false;
      
      for (let i = 1; i < visibleCards.length; i++) {
        if (visibleCards[i].id === currentId) {
          console.log(`Duplicate card detected: ${currentId}, card ${i}`);
          hasDuplicate = true;
          break;
        }
      }
      
      if (hasDuplicate) {
        console.log("Detected duplicate cards, adjusting index");
        // Increment index to skip the duplicate
        setTimeout(() => {
          if (isMountedRef.current) {
            setCurrentIndex(prev => prev + 1);
          }
        }, 100);
      }
    }
    
    // In waiter mode, log info about current restaurant cards
    if (waiterModeActive && currentRestaurant) {
      console.log(`Displaying card ${currentIndex + 1} of ${filteredData.length} for ${currentRestaurant}`);
    }

    // Show top cards in stack - reverse for correct z-index
    return (
      <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, fadeAnimStyle]}>
        {visibleCards
          .map((item, index) => {
            // Create consistent stable keys using the component ID and food ID
            const uniqueKey = `${componentId}-${item.id}-${currentIndex + index}`;
            return (
              <FoodCard
                key={uniqueKey}
                food={item}
                onSwipe={handleSwipe}
                isFirst={index === 0}
                index={index}
              />
            );
          })
          .reverse()}
      </Animated.View>
    );
  }, [currentIndex, filteredData, handleSwipe, isFinished, fadeAnimStyle, isFilterChanging, waiterModeActive, componentId, currentRestaurant]);

  // Render filter modal
  const renderFilterModal = useCallback(() => {
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => {
          setFilterModalVisible(false);
        }}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setFilterModalVisible(false)}
        >
          <Animated.View 
            style={[
              styles.filterModalContent,
              { 
                top: 60, // Position below the status bar and at filter icon level
                marginTop: 10
              },
              filterModalAnimStyle
            ]}
          >
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Foods</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FoodFilter 
              onFilterChange={handleFilterChange} 
              initialSelectedFilters={selectedFilters}
            />
          </Animated.View>
        </Pressable>
      </Modal>
    );
  }, [filterModalVisible, handleFilterChange, selectedFilters, filterModalAnimStyle]);

  // Render app header with chewz brand, waiter in middle, filter/menu on right
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerLeftContainer}>
          <Text style={styles.brandName}>
            chewz
          </Text>
        </View>
        
        {/* Waiter Button in the center */}
        <View style={styles.headerCenterContainer}>
          <WaiterButton
            onPress={handleWaiterButtonPress}
            isActive={waiterModeActive}
          />
        </View>
        
        <View style={styles.headerRightContainer}>
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
                  
                  let iconComponent = null;
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
  }, [savedItems.length, toggleSavedItems, selectedFilters, toggleFilterModal, savedBadgeScaleStyle, waiterModeActive, handleWaiterButtonPress]);

  // Render the bottom toolbar with map, camera, profile buttons
  const renderBottomToolbar = useCallback(() => {
    // Button press handlers with animations
    const handleMapPress = () => {
      // Animate button press
      mapScale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
      
      // Call toggle with a slight delay for better feel
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          toggleMapExpanded();
        }
      }, 50);
      
      // Store timeout for cleanup
      timeoutsRef.current.push(timeoutId);
    };
    
    const handleCameraPress = () => {
      // Animate button press
      cameraScale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
      
      // Call camera handler with a slight delay
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          try {
            handleCameraButtonPress();
          } catch (error) {
            console.error("Error handling camera press:", error);
          }
        }
      }, 50);
      
      // Store timeout for cleanup
      timeoutsRef.current.push(timeoutId);
    };
    
    const handleProfilePress = () => {
      // Animate button press
      profileScale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
      
      // Call alert with a slight delay
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          try {
            alert('Profile feature coming soon!');
          } catch (error) {
            console.error("Error showing profile alert:", error);
          }
        }
      }, 50);
      
      // Store timeout for cleanup
      timeoutsRef.current.push(timeoutId);
    };
    
    return (
      <View style={styles.bottomToolbarContainer}>
        <View style={styles.toolbarBentoContainer}>
          {/* Map Button */}
          <Animated.View style={[styles.toolbarBentoBox, mapAnimStyle]}>
            <TouchableOpacity 
              style={styles.toolbarBentoTouchable}
              onPress={handleMapPress}
              activeOpacity={0.8}
            >
              <Animated.View style={[
                styles.toolbarIconContainer, 
                mapIconStyle
              ]}>
                <Ionicons name="map" size={30} color={isMapExpanded ? "white" : "#FF3B5C"} />
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
          
          {/* Camera Button (in middle) */}
          <Animated.View style={[styles.toolbarBentoBox, cameraAnimStyle]}>
            <TouchableOpacity 
              style={styles.toolbarBentoTouchable}
              onPress={handleCameraPress}
              activeOpacity={0.8}
            >
              <View style={styles.toolbarIconContainer}>
                <Ionicons name="camera" size={30} color="#FF3B5C" />
              </View>
            </TouchableOpacity>
          </Animated.View>
          
          {/* Profile Button */}
          <Animated.View style={[styles.toolbarBentoBox, profileAnimStyle]}>
            <TouchableOpacity 
              style={styles.toolbarBentoTouchable}
              onPress={handleProfilePress}
              activeOpacity={0.8}
            >
              <View style={styles.toolbarIconContainer}>
                <Ionicons name="person" size={30} color="#FF3B5C" />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
        
        {/* Expanded Map View with Location and Range Settings */}
        <Animated.View style={[styles.expandedMapContainer, mapExpandAnimStyle]}>
          <Animated.View style={mapContentOpacityStyle}>
            <View style={styles.bentoContainer}>
              {/* Location Bento Box */}
              <View style={styles.bentoBox}>
                <View style={styles.bentoIconContainer}>
                  <Ionicons name="location" size={14} color="#FF3B5C" />
                </View>
                <View style={styles.bentoContent}>
                  <Text style={styles.bentoLabel}>Location</Text>
                  <TouchableOpacity style={styles.bentoValueContainer}>
                    <Text style={styles.bentoValue}>90210</Text>
                    <MaterialIcons name="edit" size={12} color="#FF3B5C" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Range Bento Box */}
              <View style={styles.bentoBox}>
                <View style={styles.bentoIconContainer}>
                  <Ionicons name="compass" size={14} color="#FF3B5C" />
                </View>
                <View style={styles.bentoContent}>
                  <Text style={styles.bentoLabel}>Range</Text>
                  <TouchableOpacity 
                    onPress={cycleRange} 
                    style={styles.bentoValueContainer}
                  >
                    <Text style={styles.bentoValue}>{currentRange} miles</Text>
                    <Ionicons name="chevron-down" size={12} color="#FF3B5C" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    );
  }, [currentRange, cycleRange, isMapExpanded, toggleMapExpanded, mapExpandAnimStyle, mapContentOpacityStyle, handleCameraButtonPress, mapAnimStyle, cameraAnimStyle, profileAnimStyle, mapIconStyle, mapScale, cameraScale, profileScale]);

  // Saved Items Modal
  const renderSavedItemsModal = () => {
    // Filter items based on favorites status
    const favoriteItemsList = savedItems.filter(item => favoriteItems.has(item.id));
    const nonFavoriteItemsList = savedItems.filter(item => !favoriteItems.has(item.id));
    
    // Combine lists with favorites at the top
    const sortedItems = [...favoriteItemsList, ...nonFavoriteItemsList];
    
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
              <TouchableOpacity onPress={toggleSavedItems} style={styles.closeModalButton}>
                <Ionicons name="close" size={28} color="#555" />
              </TouchableOpacity>
            </View>
            
            {/* Clear Non-Favorites Button */}
            {savedItems.length > 0 && (
              <View style={styles.clearButtonContainer}>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={clearNonFavorites}
                >
                  <Text style={styles.clearButtonText}>Clear Non-Favorites</Text>
                </TouchableOpacity>
              </View>
            )}

            {savedItems.length === 0 ? (
              <View style={styles.emptyListContainer}>
                <Ionicons name="restaurant-outline" size={70} color="#ccc" />
                <Text style={styles.emptyListText}>No saved dishes yet!</Text>
                <Text style={styles.emptyListSubtext}>
                  Swipe right on dishes you like to save them here
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.savedItemsSubtitle}>
                  Tap on a delivery service to order your favorite dishes
                </Text>
                <FlatList
                  data={sortedItems}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.savedItemsList}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isFavorite = favoriteItems.has(item.id);
                    
                    return (
                      <View style={styles.savedItemCard}>
                        <Image source={{ uri: item.imageUrl }} style={styles.savedItemImage} />
                        <View style={styles.savedItemInfo}>
                          <View style={styles.savedItemHeader}>
                            <View style={styles.savedItemTitleContainer}>
                              <Text style={styles.savedItemName}>{item.name}</Text>
                              <Text style={styles.savedItemRestaurant}>{item.restaurant}</Text>
                            </View>
                            <TouchableOpacity 
                              style={styles.favoriteButton}
                              onPress={() => toggleFavorite(item.id)}
                            >
                              <Ionicons 
                                name={isFavorite ? "heart" : "heart-outline"} 
                                size={28} 
                                color={isFavorite ? "#FF3B5C" : "#777"} 
                              />
                            </TouchableOpacity>
                          </View>
                          
                          {/* Delivery options */}
                          <View style={styles.deliveryOptionsContainer}>
                            {item.deliveryServices && item.deliveryServices.length > 0 ? (
                              <View style={styles.deliveryButtonsContainer}>
                                {item.deliveryUrls?.uberEats && (
                                  <TouchableOpacity
                                    style={styles.deliveryIconButton}
                                    onPress={() => handleDeliveryPress(item.name, 'Uber Eats', item.deliveryUrls?.uberEats || '')}
                                  >
                                    <FontAwesome5 name="uber" size={18} color="#000000" />
                                  </TouchableOpacity>
                                )}
                                
                                {item.deliveryUrls?.doorDash && (
                                  <TouchableOpacity
                                    style={styles.deliveryIconButton}
                                    onPress={() => handleDeliveryPress(item.name, 'DoorDash', item.deliveryUrls?.doorDash || '')}
                                  >
                                    <MaterialIcons name="restaurant" size={18} color="#FF3008" />
                                  </TouchableOpacity>
                                )}
                                
                                {item.deliveryUrls?.postmates && (
                                  <TouchableOpacity
                                    style={styles.deliveryIconButton}
                                    onPress={() => handleDeliveryPress(item.name, 'Postmates', item.deliveryUrls?.postmates || '')}
                                  >
                                    <MaterialIcons name="delivery-dining" size={18} color="#FFBD00" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            ) : (
                              <View style={styles.noDeliveryContainer}>
                                <Ionicons name="information-circle-outline" size={16} color="#888" />
                                <Text style={styles.noDeliveryText}>No delivery options available</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  }}
                />
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  // Add an effect to always ensure fadeAnim value is 1 
  // This prevents any fade in/out loops after a swipe
  useEffect(() => {
    // Set fadeAnim to 1 after any currentIndex change
    if (!initialRenderRef.current && isMountedRef.current) {
      // Make sure it's fully visible
      fadeAnim.value = 1;
    }
  }, [currentIndex, fadeAnim]);
  
  // Force fadeAnim to 1 when the component mounts
  useEffect(() => {
    // Ensure it's fully visible on mount
    fadeAnim.value = 1;
    
    return () => {
      // Also set to 1 on unmount to avoid any flashing during cleanup
      fadeAnim.value = 1;
    };
  }, [fadeAnim]);

  // Add an effect to force a fresh state when the data changes significantly
  useEffect(() => {
    // If we have data but the component gets stuck (no items visible),
    // this will force a reset to the initial state
    if (data && data.length > 0 && filteredData.length > 0 && currentIndex >= filteredData.length) {
      // Reset to the beginning
      setCurrentIndex(0);
      
      // Ensure animation value is reset
      fadeAnim.value = 1;
      
      // And reset any loading states
      setIsFilterChanging(false);
    }
  }, [data, filteredData, currentIndex, fadeAnim]);

  // Helper function to log current card status
  const logCardStatus = useCallback(() => {
    if (waiterModeActive && currentRestaurant && filteredData.length > 0) {
      const currentPosition = currentIndex + 1;
      console.log(`Displaying card ${currentPosition} of ${filteredData.length} for ${currentRestaurant}`);
    }
  }, [currentIndex, filteredData.length, waiterModeActive, currentRestaurant]);

  // Effect to log card status after currentIndex changes
  useEffect(() => {
    if (isMountedRef.current) {
      logCardStatus();
    }
  }, [currentIndex, logCardStatus]);

  // Simplify the renderSafeContent function to avoid hook order issues
  const renderSafeContent = () => {
    if (DEBUG_ENABLED) console.log('[CRASH-DEBUG] Rendering main component');
    
    try {    
      return (
        <GestureHandlerRootView style={styles.container}>
          <SafeAreaView style={styles.safeArea}>
            {/* App Header with Chewzy Brand and Saved Items Folder */}
            {renderHeader()}

            {/* Render the filter modal */}
            {renderFilterModal()}

            {/* Main Content Container */}
            <View style={styles.mainContentContainer}>
              {/* Display message when no items match filter */}
              {selectedFilters.length > 0 && filteredData.length === 0 && (
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

              {/* Cards Container */}
              <View style={styles.cardsContainer}>
                {renderCards()}
              </View>
            </View>
            
            {/* Bottom Toolbar with Map, Upload, and Profile */}
            {!isFinished && renderBottomToolbar()}
          </SafeAreaView>
          
          {/* Saved Items Modal */}
          {renderSavedItemsModal()}
          
          {/* Camera Item Selection Modal */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={cameraSelectionModalVisible}
            onRequestClose={() => setCameraSelectionModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.cameraSelectionModalContent}>
                <View style={styles.cameraModalHeader}>
                  <Text style={styles.cameraModalTitle}>Select Food to Photograph</Text>
                  <TouchableOpacity 
                    onPress={() => setCameraSelectionModalVisible(false)} 
                    style={styles.closeModalButton}
                    hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
                  >
                    <Ionicons name="close" size={24} color="#555" />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.cameraSelectionSubtitle}>
                  Choose which saved dish you're about to photograph
                </Text>
                
                {savedItems.length > 0 ? (
                  <FlatList
                    data={savedItems}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.cameraSelectionList}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={4}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.cameraSelectionItem}
                        onPress={() => openCamera(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.cameraSelectionImageContainer}>
                          <Image 
                            source={{ uri: item.imageUrl }} 
                            style={styles.cameraSelectionImage}
                            onError={(e) => {
                              if (DEBUG_ENABLED) console.log('Image loading error:', e.nativeEvent.error);
                            }}
                          />
                          {/* Overlay for better text visibility */}
                          <View style={styles.imageOverlay} />
                        </View>
                        <View style={styles.cameraSelectionInfo}>
                          <Text style={styles.cameraSelectionName} numberOfLines={1} ellipsizeMode="tail">
                            {item.name}
                          </Text>
                          <Text style={styles.cameraSelectionRestaurant} numberOfLines={1} ellipsizeMode="tail">
                            {item.restaurant}
                          </Text>
                        </View>
                        <View style={styles.cameraIconContainer}>
                          <Ionicons name="camera" size={24} color="#FF3B5C" />
                        </View>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyListContainer}>
                        <Text style={styles.emptyListText}>No saved dishes yet</Text>
                      </View>
                    }
                  />
                ) : (
                  <View style={styles.emptyListContainer}>
                    <Ionicons name="restaurant-outline" size={60} color="#ccc" />
                    <Text style={styles.emptyListText}>No saved dishes yet!</Text>
                    <Text style={styles.emptyListSubtext}>Swipe right on dishes you like to save them here</Text>
                    <TouchableOpacity 
                      style={styles.closeButton}
                      onPress={() => setCameraSelectionModalVisible(false)}
                    >
                      <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        </GestureHandlerRootView>
      );
    } catch (error) {
      if (DEBUG_ENABLED) console.error('[CRASH-DEBUG] Error in mainRender:', error);
      logError('mainRender', error);
      
      // Return a simple error fallback UI
      return (
        <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ fontSize: 18, color: '#FF3B5C', marginBottom: 20 }}>
            App crashed. Please restart.
          </Text>
          <Text style={{ fontSize: 14, color: '#555', marginBottom: 30, textAlign: 'center' }}>
            We're sorry for the inconvenience.{'\n'}The app encountered an error while displaying food cards.
          </Text>
        </SafeAreaView>
      );
    }
  };

  // Update the main component return to use renderSafeContent directly
  return renderSafeContent();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff0f3',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : 25,
    backgroundColor: '#fff0f3',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ffccd5',
    backgroundColor: '#fff8f9',
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCenterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandName: {
    fontSize: 32,
    fontFamily: Platform.OS === 'ios' ? 'Futura' : 'sans-serif-medium',
    fontWeight: '700',
    color: '#FF3B5C',
    letterSpacing: 1,
  },
  filterButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  filterButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
  filterButtonContainerActive: {
    borderColor: '#FF3B5C',
    backgroundColor: '#fff0f3',
    shadowColor: '#FF3B5C',
    shadowOpacity: 0.25,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
  badgeContainer: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B5C',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mainContentContainer: {
    flex: 1,
    backgroundColor: '#fff0f3',
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    paddingTop: 5,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
    marginTop: 15,
  },
  noResultsSubText: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  changeFilterButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FF3B5C',
    borderRadius: 25,
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  changeFilterButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  locationSettingsContainerBottom: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e8e8ec',
  },
  bentoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bentoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 6,
    marginHorizontal: 5,
    flex: 1,
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ffccd5',
  },
  bentoIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 92, 0.08)',
    marginRight: 8,
    borderWidth: 0,
  },
  bentoContent: {
    flexDirection: 'column',
    flex: 1,
  },
  bentoLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#888',
    marginBottom: 1,
  },
  bentoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bentoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  // Modal styles for filter
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModalContent: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingBottom: 30,
    maxHeight: '75%',
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ffccd5',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  // Saved items modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalContent: {
    flex: 1,
    paddingTop: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF3B5C',
  },
  closeModalButton: {
    padding: 8,
    borderRadius: 20,
  },
  clearButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  clearButton: {
    backgroundColor: '#FF3B5C',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  clearButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  savedItemsSubtitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 10,
    paddingHorizontal: 30,
  },
  savedItemCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginVertical: 10,
    marginHorizontal: 15,
    padding: 0,
    height: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  savedItemImage: {
    width: 120,
    height: 150,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  savedItemInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  savedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
  },
  savedItemTitleContainer: {
    flex: 1,
  },
  favoriteButton: {
    padding: 5,
    marginLeft: 8,
  },
  savedItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  savedItemRestaurant: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  deliveryOptionsContainer: {
    paddingTop: 8,
    paddingBottom: 5,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 'auto',
  },
  deliveryButtonsContainer: {
    flexDirection: 'row',
    marginTop: 5,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  deliveryIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  noDeliveryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  noDeliveryText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 4,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyListText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
    marginVertical: 15,
  },
  emptyListSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#555',
  },
  resetButton: {
    backgroundColor: '#FF3B5C',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Updated styles for the bottom toolbar
  bottomToolbarContainer: {
    backgroundColor: 'rgba(255, 248, 249, 0.95)',
    borderTopWidth: 0.5,
    borderTopColor: '#ffccd5',
    paddingBottom: Platform.OS === 'ios' ? 16 : 8, // Reduced padding
    paddingTop: 6, // Reduced padding
  },
  toolbarBentoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 0,
    paddingHorizontal: 10,
  },
  toolbarBentoBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 0,
    width: 90,
    height: 60, // Reduced height from 70 to 60
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ffccd5',
  },
  toolbarBentoBoxActive: {
    borderColor: '#FF3B5C',
    backgroundColor: '#fff0f3',
    shadowColor: '#FF3B5C',
    shadowOpacity: 0.25,
  },
  toolbarIconContainer: {
    width: 90,
    height: 60,
    borderRadius: 14,
    justifyContent: 'center', // This centers vertically
    alignItems: 'center', // This centers horizontally
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingBottom: 0, // Remove any padding that might be affecting centering
    paddingTop: 0, // Remove any padding that might be affecting centering
  },
  toolbarIconContainerActive: {
    backgroundColor: '#FF3B5C',
    borderColor: '#FF3B5C',
    transform: [{ scale: 1 }],
  },
  expandedMapContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    paddingBottom: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#ffccd5',
    backgroundColor: 'rgba(255, 248, 249, 0.98)',
    overflow: 'hidden',
  },
  toolbarBentoTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center', // This centers vertically
    alignItems: 'center', // This centers horizontally
    paddingBottom: 0, // Remove any padding that might be affecting centering
    paddingTop: 0, // Remove any padding that might be affecting centering
  },
  bentoContentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  // Updated camera selection modal styles
  cameraSelectionModalContent: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: 'white',
    borderRadius: 20,
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
  cameraModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cameraModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  cameraSelectionSubtitle: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
  },
  cameraSelectionList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  cameraSelectionItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 12,
    alignItems: 'center',
  },
  cameraSelectionImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraSelectionImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    resizeMode: 'cover',
  },
  cameraSelectionInfo: {
    flex: 1,
    marginLeft: 16,
  },
  cameraSelectionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cameraSelectionRestaurant: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
  cameraIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff0f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#ffccd5',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
  },
  closeButton: {
    fontSize: 24,
    color: '#555',
    padding: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  tab: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ffccd5',
    borderRadius: 10,
  },
  activeTab: {
    borderColor: '#FF3B5C',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#FF3B5C',
  },
  deliveryOptionsRow: {
    marginTop: 'auto',
  },
  savedItemsList: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  restaurantIndicatorContainer: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 10,
  },
  restaurantIndicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Add these missing styles for error handling
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  noMoreCardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noMoreCardsText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B5C',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: '#FF3B5C',
    borderRadius: 25,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  cardsAnimatedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    paddingTop: 5,
  },
  cardWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Memoize the component to prevent unnecessary re-renders
const SwipeableCards = memo(SwipeableCardsComponent);

export { SwipeableCards }; 