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
  Animated,
  ActivityIndicator
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons, FontAwesome, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { FoodItem, SwipeDirection, SwipeHistoryItem, FoodType } from '../../types/food';
import { FoodCard } from './FoodCard';
import FoodFilter from './FoodFilter';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const fadeAnim = useRef(new Animated.Value(1)).current;

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

  // Apply filters when selectedFilters changes
  useEffect(() => {
    try {
      // Start the transition - fade out current cards
      setIsFilterChanging(true);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start(() => {
        // After fade out, update the filtered data
        setTimeout(() => {
          if (selectedFilters.length === 0) {
            // If no filters selected, show all data
            setFilteredData(data);
          } else {
            // Apply filters - show foods that match ANY of the selected filters
            const filtered = data.filter(foodItem => 
              foodItem.foodType.some(type => selectedFilters.includes(type))
            );
            setFilteredData(filtered);
          }
          
          // Reset index when filters change
          setCurrentIndex(0);
          
          // Fade back in with a small delay for smoother transition
          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true
            }).start(() => {
              setIsFilterChanging(false);
            });
          }, 100);
        }, 50);
      });
    } catch (error) {
      console.error("Error applying filters:", error);
      // Fall back to showing all data
      setFilteredData(data);
      setIsFilterChanging(false);
      fadeAnim.setValue(1);
    }
  }, [selectedFilters, data, fadeAnim]);

  // Toggle filter modal - modified to prevent issues
  const toggleFilterModal = useCallback(() => {
    // Using a setTimeout to prevent blocking the UI thread
    setTimeout(() => {
      setFilterModalVisible(prev => !prev);
    }, 0);
  }, []);

  const handleSwipe = useCallback((food: FoodItem, direction: SwipeDirection) => {
    // Record the swipe in history
    const historyItem: SwipeHistoryItem = {
      foodItem: food,
      direction,
      timestamp: Date.now(),
    };
    
    const updatedHistory = [...swipeHistory, historyItem];
    setSwipeHistory(updatedHistory);
    
    if (onSwipeHistoryUpdate) {
      onSwipeHistoryUpdate(updatedHistory);
    }
    
    // Save liked items
    if (direction === 'right') {
      if (onLike) {
        onLike(food);
      }
      
      // Add to saved items if not already there
      if (!savedItems.some(item => item.id === food.id)) {
        setSavedItems(prev => [...prev, food]);
      }
    } else if (direction === 'left' && onDislike) {
      onDislike(food);
    }
    
    // Move to the next card
    setCurrentIndex(prevIndex => prevIndex + 1);
  }, [swipeHistory, onLike, onDislike, onSwipeHistoryUpdate, savedItems]);

  // Handle filter changes from the FoodFilter component
  const handleFilterChange = useCallback((filters: FoodType[]) => {
    try {
      // If filters include 'all', treat it as no filters selected
      const actualFilters = filters.filter(filter => filter !== 'all');
      
      // Only close the modal if a filter was actually selected/changed
      if (actualFilters.length > 0 || selectedFilters.length > 0) {
        // Make these state updates in the next tick to avoid UI blocking
        setTimeout(() => {
          setSelectedFilters(actualFilters);
          // Close the modal after applying filters
          setFilterModalVisible(false);
        }, 10);
      } else {
        // Just update filters without closing if "All" was selected and we were already showing all
        setSelectedFilters([]);
      }
    } catch (error) {
      console.error("Error handling filter change:", error);
      // Fall back to showing all items
      setTimeout(() => {
        setSelectedFilters([]);
        setFilterModalVisible(false);
      }, 10);
    }
  }, [selectedFilters]);

  // Check if we've gone through all cards
  const isFinished = currentIndex >= filteredData.length;

  // Toggle saved items modal visibility
  const toggleSavedItems = useCallback(() => {
    setSavedItemsVisible(prev => !prev);
  }, []);

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
      <Animated.View style={{ opacity: fadeAnim, flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
  }, [currentIndex, filteredData, handleSwipe, isFinished, fadeAnim, isFilterChanging]);

  // Render app header with chewzy brand, active filters, and saved items
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerLeftContainer}>
          <Text style={styles.brandName}>chewzy</Text>
          
          {/* Active Filter Icons */}
          <View style={styles.activeFiltersContainer}>
            {selectedFilters.length > 0 ? (
              // Show selected filters
              selectedFilters.slice(0, 3).map((filter, index) => {
                // Render the appropriate icon based on filter type
                let iconComponent;
                
                switch(filter) {
                  case 'spicy':
                    iconComponent = <FontAwesome5 name="fire" size={12} color="white" />;
                    break;
                  case 'vegan':
                    iconComponent = <FontAwesome5 name="leaf" size={12} color="white" />;
                    break;
                  case 'dessert':
                    iconComponent = <Ionicons name="ice-cream" size={12} color="white" />;
                    break;
                  case 'healthy':
                    iconComponent = <FontAwesome5 name="heartbeat" size={12} color="white" />;
                    break;
                  case 'breakfast':
                    iconComponent = <FontAwesome5 name="coffee" size={12} color="white" />;
                    break;
                  case 'lunch':
                  case 'fast-food':
                    iconComponent = <FontAwesome5 name="hamburger" size={12} color="white" />;
                    break;
                  case 'dinner':
                    iconComponent = <FontAwesome5 name="utensils" size={12} color="white" />;
                    break;
                  case 'comfort':
                    iconComponent = <FontAwesome5 name="home" size={12} color="white" />;
                    break;
                  case 'seafood':
                    iconComponent = <FontAwesome5 name="fish" size={12} color="white" />;
                    break;
                  default:
                    iconComponent = <FontAwesome5 name="utensils" size={12} color="white" />;
                }
                
                const iconInfo = filterIcons[filter as keyof typeof filterIcons];
                return (
                  <View 
                    key={filter} 
                    style={[
                      styles.activeFilterIcon, 
                      { backgroundColor: iconInfo?.color || '#999' }
                    ]}
                  >
                    {iconComponent}
                  </View>
                );
              })
            ) : (
              // Show "All" icon when no filters selected
              <View 
                style={[
                  styles.activeFilterIcon, 
                  { backgroundColor: filterIcons['all'].color }
                ]}
              >
                <MaterialIcons name="restaurant-menu" size={12} color="white" />
              </View>
            )}
            
            {/* Show count if more than 3 filters */}
            {selectedFilters.length > 3 && (
              <View style={styles.moreFiltersIndicator}>
                <Text style={styles.moreFiltersText}>+{selectedFilters.length - 3}</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.headerRightContainer}>
          {/* Add Filter Button */}
          <TouchableOpacity 
            style={styles.filterButton} 
            onPress={toggleFilterModal}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={22} color="#FF3B5C" />
          </TouchableOpacity>

          {/* Original Saved Items Folder Button */}
          <TouchableOpacity 
            style={styles.savedButton}
            onPress={toggleSavedItems}
          >
            <MaterialIcons name="folder" size={28} color="#FF3B5C" />
            {savedItems.length > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{savedItems.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [savedItems.length, toggleSavedItems, selectedFilters, toggleFilterModal]);

  // Render the location and range settings at the bottom
  const renderLocationSettings = useCallback(() => {
    return (
      <View style={styles.locationSettingsContainerBottom}>
        <View style={styles.locationRow}>
          <Text style={styles.locationLabel}>Current Location:</Text>
          <TouchableOpacity style={styles.zipCodeContainer}>
            <Text style={styles.zipCodeText}>90210</Text>
            <MaterialIcons name="edit" size={16} color="#FF3B5C" style={styles.editIcon} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.rangeRow}>
          <Text style={styles.locationLabel}>Range:</Text>
          <TouchableOpacity onPress={cycleRange} style={styles.rangeValueContainer}>
            <Text style={styles.rangeValueText}>{currentRange} miles</Text>
            <View style={styles.underline} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [currentRange, cycleRange]);

  // Render filter modal
  const renderFilterModal = useCallback(() => {
    // Position the modal to start from the filter icon level
    const translateYAnim = useRef(new Animated.Value(-50)).current;
    
    useEffect(() => {
      if (filterModalVisible) {
        Animated.spring(translateYAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 50,
          velocity: 2
        }).start();
      } else {
        Animated.spring(translateYAnim, {
          toValue: -50,
          useNativeDriver: true,
          friction: 8,
          tension: 50
        }).start();
      }
    }, [filterModalVisible]);
    
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
                transform: [{ translateY: translateYAnim }], 
                top: 60, // Position below the status bar and at filter icon level
                marginTop: 10
              }
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
  }, [filterModalVisible, handleFilterChange, selectedFilters]);

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
        
        {/* Location and Range Settings at Bottom */}
        {!isFinished && renderLocationSettings()}
      </SafeAreaView>
      
      {/* Saved Items Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={savedItemsVisible}
        onRequestClose={toggleSavedItems}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Saved Dishes</Text>
              <TouchableOpacity onPress={toggleSavedItems} style={styles.closeModalButton}>
                <Ionicons name="close" size={28} color="#555" />
              </TouchableOpacity>
            </View>
            
            {savedItems.length === 0 ? (
              <View style={styles.emptyListContainer}>
                <Ionicons name="restaurant-outline" size={70} color="#ccc" />
                <Text style={styles.emptyListText}>No saved dishes yet!</Text>
                <Text style={styles.emptyListSubtext}>Swipe right on dishes you like to save them here</Text>
              </View>
            ) : (
              <FlatList
                data={savedItems}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.savedItemsList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.savedItemCard}>
                    <Image source={{ uri: item.imageUrl }} style={styles.savedItemImage} />
                    <View style={styles.savedItemInfo}>
                      <Text style={styles.savedItemName}>{item.name}</Text>
                      <Text style={styles.savedItemRestaurant}>{item.restaurant}</Text>
                      <View style={styles.deliveryOptionsRow}>
                        <TouchableOpacity style={styles.deliveryIconButton}>
                          <Ionicons name="logo-apple" size={30} color="#555" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deliveryIconButton}>
                          <FontAwesome name="motorcycle" size={30} color="#FF5A5F" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deliveryIconButton}>
                          <Ionicons name="fast-food" size={30} color="#FF9E1F" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : 25, // Simplified Android check
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontFamily: 'Futura', // Simplified font family
    fontWeight: '700',
    color: '#FF3B5C',
    letterSpacing: 1,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  activeFilterIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  moreFiltersIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#888',
    marginHorizontal: 2,
  },
  moreFiltersText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  savedButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5, // Add more spacing between filter and folder icons
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B5C',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mainContentContainer: {
    flex: 1,
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
    borderRadius: 20,
  },
  changeFilterButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  locationSettingsContainerBottom: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 14,
    color: '#777',
    marginRight: 8,
  },
  zipCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 5, // Reduce space to position closer to "Current Location:"
  },
  zipCodeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  editIcon: {
    marginLeft: 4,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rangeValueContainer: {
    flexDirection: 'column',
    marginLeft: 5,
  },
  rangeValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  underline: {
    height: 1,
    backgroundColor: '#333',
    marginTop: 2,
  },
  // Modal styles for filter
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  filterModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingBottom: 30,
    maxHeight: '75%', // Limit to 75% of screen height
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    marginHorizontal: 10,
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
  closeModalButton: {
    padding: 5,
  },
  savedItemsList: {
    padding: 16,
  },
  savedItemCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#eee',
  },
  savedItemImage: {
    width: 120,
    height: 120,
    resizeMode: 'cover',
  },
  savedItemInfo: {
    flex: 1,
    padding: 15,
    justifyContent: 'space-between',
  },
  savedItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  savedItemRestaurant: {
    fontSize: 14,
    color: '#777',
    marginBottom: 15,
  },
  deliveryOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 'auto',
  },
  deliveryIconButton: {
    padding: 10,
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
});

// Memoize the component to prevent unnecessary re-renders
const SwipeableCards = memo(SwipeableCardsComponent);

export { SwipeableCards }; 