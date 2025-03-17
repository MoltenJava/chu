import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
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
const VISIBLE_CARDS = 3;
// Number of cards to preload beyond visible ones
const PRELOAD_CARDS = 3;

interface SwipeableCardsProps {
  data: FoodItem[];
  onLike?: (food: FoodItem) => void;
  onDislike?: (food: FoodItem) => void;
  onSwipeHistoryUpdate?: (history: SwipeHistoryItem[]) => void;
}

const SwipeableCardsComponent: React.FC<SwipeableCardsProps> = ({
  data,
  onLike,
  onDislike,
  onSwipeHistoryUpdate,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeHistory, setSwipeHistory] = useState<SwipeHistoryItem[]>([]);
  const [savedItems, setSavedItems] = useState<FoodItem[]>([]);
  const [savedItemsVisible, setSavedItemsVisible] = useState(false);
  const [currentRange, setCurrentRange] = useState<number>(10);
  const [selectedFilters, setSelectedFilters] = useState<FoodType[]>([]);
  const [filteredData, setFilteredData] = useState<FoodItem[]>(data);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [cameraSelectionModalVisible, setCameraSelectionModalVisible] = useState(false);
  const [selectedItemForCamera, setSelectedItemForCamera] = useState<FoodItem | null>(null);
  // New state for favorites and tab selection
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  
  // Track mounted state
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  
  // Reanimated shared values for animations
  const fadeAnim = useSharedValue(1);
  const savedBadgeScale = useSharedValue(1);
  const filterModalAnim = useSharedValue(-50);
  const mapExpandAnim = useSharedValue(0);

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

  // Reset current index if data changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [data]);

  // Cleanup animations on unmount
  useEffect(() => {
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
  }, []);

  // Create animated styles
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
    // Improve the opacity interpolation for smoother fade in/out
    return {
      height: mapExpandAnim.value,
      opacity: interpolate(
        mapExpandAnim.value,
        [0, 10, 20, 80], // More gradual opacity transition
        [0, 0.2, 0.6, 1],
        Extrapolate.CLAMP
      ),
      overflow: 'hidden'
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

  // FIXED: Preload images with better error handling
  useEffect(() => {
    // Create a flag to track if this effect is still active
    let isEffectActive = true;
    let preloadTimeout: NodeJS.Timeout | null = null;
    
    const preloadImages = async () => {
      // Don't start preloading if component is unmounted
      if (!isMountedRef.current || !isEffectActive) return;
      
      try {
        // Safety check to ensure filteredData is available
        if (!filteredData || !Array.isArray(filteredData)) {
          console.warn('filteredData is not available or not an array');
          return;
        }

        // Create a local copy of the current index to avoid closure issues
        const currentIndexValue = currentIndex;
        
        // Create a local copy of the preloaded images set
        const currentPreloadedImages = new Set(preloadedImages);

        // Determine which images to preload
        const endIndex = Math.min(currentIndexValue + VISIBLE_CARDS + PRELOAD_CARDS, filteredData.length);
        const imagesToPreload = filteredData
          .slice(currentIndexValue, endIndex)
          .map(item => item?.imageUrl) // Use optional chaining
          .filter(url => url && typeof url === 'string' && url.trim() !== '' && !currentPreloadedImages.has(url));

        // Skip if no new images to preload
        if (!imagesToPreload || imagesToPreload.length === 0) return;

        // Mark these URLs as being preloaded - create a new Set to avoid modifying state directly
        const newPreloadedImages = new Set([...currentPreloadedImages]);
        
        // Use a small delay to avoid blocking the main thread
        preloadTimeout = setTimeout(async () => {
          // Process each image individually to avoid Promise.all failures
          for (const imageUrl of imagesToPreload) {
            // Check again if component is still mounted before each image
            if (!isMountedRef.current || !isEffectActive) return;
            
            if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') continue;
            
            try {
              await Image.prefetch(imageUrl);
              
              // Only update the set if the component is still mounted
              if (isMountedRef.current && isEffectActive) {
                newPreloadedImages.add(imageUrl);
              }
            } catch (error) {
              console.warn(`Failed to preload image: ${imageUrl}`, error);
              // Continue despite errors
            }
          }
          
          // Only update state if component is still mounted and there are new images
          if (isMountedRef.current && isEffectActive && newPreloadedImages.size > currentPreloadedImages.size) {
            setPreloadedImages(newPreloadedImages);
          }
        }, 50);
        
        // Store the timeout for cleanup
        timeoutsRef.current.push(preloadTimeout);
      } catch (error) {
        console.error("Error in image preloading:", error);
        // Don't rethrow - we want to fail gracefully
      }
    };

    // Start preloading
    preloadImages();
    
    // Cleanup function
    return () => {
      isEffectActive = false;
      
      // Clear the preload timeout if it exists
      if (preloadTimeout) {
        clearTimeout(preloadTimeout);
        preloadTimeout = null;
      }
    };
  }, [currentIndex, filteredData, preloadedImages]);

  // Handle swipe action
  const handleSwipe = useCallback((foodItem: FoodItem, direction: SwipeDirection) => {
    // Don't process if component is unmounted
    if (!isMountedRef.current) return;
    
    try {
      // Log the original food item to see what's coming in
      console.log('Original food item before saving:', {
        id: foodItem.id,
        name: foodItem.name,
        deliveryServices: foodItem.deliveryServices,
        deliveryUrls: foodItem.deliveryUrls
      });
      
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
      
      // Log the safe copy to verify it has the delivery info
      console.log('Safe copy of food item:', {
        id: safeFoodItem.id,
        name: safeFoodItem.name,
        deliveryServices: safeFoodItem.deliveryServices,
        deliveryUrls: safeFoodItem.deliveryUrls
      });
      
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
            onSwipeHistoryUpdate(newHistory);
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
          // Log the food item being saved
          console.log('Saving food item with delivery info:', {
            id: safeFoodItem.id,
            name: safeFoodItem.name,
            deliveryServices: safeFoodItem.deliveryServices,
            deliveryUrls: safeFoodItem.deliveryUrls
          });
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

  // Create a derived animated style for the content opacity
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

  // Initialize map animation value
  useEffect(() => {
    // Set initial value based on isMapExpanded
    mapExpandAnim.value = isMapExpanded ? 80 : 0;
    
    // Make sure to reset the animation value when component unmounts
    return () => {
      mapExpandAnim.value = 0;
    };
  }, []);

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

    // Show loading indicator while filter is changing
    if (isFilterChanging) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B5C" />
        </View>
      );
    }

    // Show top 3 cards in stack - reverse for correct z-index
    return (
      <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, fadeAnimStyle]}>
        {filteredData
          .slice(currentIndex, currentIndex + 3)
          .map((item, index) => (
            <FoodCard
              key={item.id}
              food={item}
              onSwipe={handleSwipe}
              isFirst={index === 0}
              index={index}
            />
          ))
          .reverse()}
      </Animated.View>
    );
  }, [currentIndex, filteredData, handleSwipe, isFinished, fadeAnimStyle, isFilterChanging]);

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

  // Render app header with chewz brand, active filters, and saved items
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerLeftContainer}>
          <Text style={styles.brandName}>
            chewz
          </Text>
        </View>
        
        <View style={styles.headerRightContainer}>
          {/* Filter Button - Now using the active filter icon */}
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

          {/* Menu Button - Now using a food-related icon */}
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
  }, [savedItems.length, toggleSavedItems, selectedFilters, toggleFilterModal, savedBadgeScaleStyle]);

  // Render the bottom toolbar with three bento boxes
  const renderBottomToolbar = useCallback(() => {
    // Create a shared value for each button's scale for press animation
    const mapScale = useSharedValue(1);
    const cameraScale = useSharedValue(1);
    const profileScale = useSharedValue(1);
    
    // Animated styles for button press effects
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
    
    // Create an animated style for the map icon background
    const mapIconStyle = useAnimatedStyle(() => {
      return {
        backgroundColor: isMapExpanded ? '#FF3B5C' : 'transparent',
      };
    });
    
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
          
          {/* Image Upload Button */}
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
  }, [currentRange, cycleRange, isMapExpanded, toggleMapExpanded, mapExpandAnimStyle, mapContentOpacityStyle, handleCameraButtonPress]);

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
                        onError={(e) => console.log('Image loading error:', e.nativeEvent.error)}
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
});

// Memoize the component to prevent unnecessary re-renders
const SwipeableCards = memo(SwipeableCardsComponent);

export { SwipeableCards }; 