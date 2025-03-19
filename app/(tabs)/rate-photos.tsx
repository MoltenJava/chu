import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FoodItem, SwipeDirection } from '../../types/food';
import { loadFoodData } from '../../data/realFoodData';
import { savePhotoRating, filterRatedItems, clearPhotoRatings } from '../../utils/photoRatingService';
import { Stack } from 'expo-router';
import { FoodCard } from '../../components/food/FoodCard';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RatePhotosScreen() {
  const [foodData, setFoodData] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [ratedPhotos, setRatedPhotos] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const ratingHistory = useRef<{foodId: string, rating: 'good' | 'bad' | 'meh' | null}[]>([]);
  
  // Function to load food data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load all food data
      const allFood = await loadFoodData();
      
      // Filter out already rated items
      const unratedFood = await filterRatedItems(allFood);
      
      setFoodData(unratedFood);
      setTotalPhotos(allFood.length);
      setRatedPhotos(allFood.length - unratedFood.length);
      setCurrentIndex(0);
      setCanUndo(false);
      ratingHistory.current = [];
    } catch (error) {
      console.error('Error loading food data:', error);
      Alert.alert('Error', 'Failed to load food data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Add the undo functionality
  const handleUndo = useCallback(async () => {
    if (ratingHistory.current.length === 0) {
      setCanUndo(false);
      return;
    }
    
    // Get the last rating
    const lastRating = ratingHistory.current.pop();
    
    if (!lastRating) return;
    
    try {
      // Remove the rating
      await savePhotoRating(lastRating.foodId, null);
      
      // Decrease the rated photos count
      setRatedPhotos(prev => Math.max(0, prev - 1));
      
      // Move back to the previous card
      setCurrentIndex(prev => Math.max(0, prev - 1));
      
      // Disable undo if there's no more history
      if (ratingHistory.current.length === 0) {
        setCanUndo(false);
      }
    } catch (error) {
      console.error('Error undoing rating:', error);
      Alert.alert('Error', 'Failed to undo rating. Please try again.');
    }
  }, []);
  
  // Handle swipe events - update to save rating history
  const handleSwipe = useCallback(async (food: FoodItem, direction: SwipeDirection) => {
    let rating = null;
    
    // Map swipe direction to rating
    switch (direction) {
      case 'right':
        // Right swipe means "good"
        rating = 'good';
        break;
      case 'left':
        // Left swipe means "bad"
        rating = 'bad';
        break;
      case 'up':
        // Up swipe means "meh"
        rating = 'meh';
        break;
      default:
        return; // Don't save for 'none'
    }
    
    // Save the rating
    await savePhotoRating(food.id, rating as 'good' | 'bad' | 'meh');
    
    // Save to history for undo
    ratingHistory.current.push({
      foodId: food.id,
      rating: rating as 'good' | 'bad' | 'meh'
    });
    
    // Enable undo
    setCanUndo(true);
    
    // Update counters
    setRatedPhotos(prev => prev + 1);
    
    // Move to next photo
    setCurrentIndex(prev => prev + 1);
    
    // If we've gone through all photos, reload the data
    if (currentIndex >= foodData.length - 1) {
      loadData();
    }
  }, [currentIndex, foodData.length, loadData]);
  
  // Reset all ratings
  const handleResetRatings = useCallback(async () => {
    Alert.alert(
      'Reset Ratings',
      'Are you sure you want to reset all photo ratings? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            await clearPhotoRatings();
            loadData();
          }
        },
      ]
    );
  }, [loadData]);
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Rate Photos',
            headerLeft: () => (
              <TouchableOpacity 
                onPress={handleUndo} 
                disabled={!canUndo}
                style={[styles.headerButton, !canUndo && styles.headerButtonDisabled]}
              >
                <Ionicons name="arrow-back-circle" size={28} color={canUndo ? "#FF3B5C" : "#CCCCCC"} />
              </TouchableOpacity>
            ),
            headerRight: () => (
              <TouchableOpacity onPress={handleResetRatings} style={styles.resetButton}>
                <Ionicons name="refresh" size={24} color="#FF3B5C" />
              </TouchableOpacity>
            ),
          }} 
        />
        
        {isLoading ? (
          <ActivityIndicator size="large" color="#FF3B5C" />
        ) : foodData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="check-circle" size={60} color="#01DF8B" />
            <Text style={styles.emptyText}>All photos have been rated!</Text>
            <TouchableOpacity 
              style={styles.resetAllButton}
              onPress={handleResetRatings}
            >
              <Text style={styles.resetAllButtonText}>Reset All Ratings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.statsContainer}>
              <Text style={styles.statsText}>
                Rated: {ratedPhotos} / {totalPhotos} photos ({Math.round((ratedPhotos / totalPhotos) * 100)}%)
              </Text>
            </View>
            
            {foodData.length > currentIndex && (
              <View style={styles.currentItemInfo}>
                <Text style={styles.currentItemName} numberOfLines={2}>
                  {foodData[currentIndex].name}
                </Text>
                <Text style={styles.currentItemRestaurant}>
                  {foodData[currentIndex].restaurant} • {foodData[currentIndex].price}
                </Text>
              </View>
            )}
            
            <View style={styles.instructionsButtons}>
              <View style={styles.swipeButton}>
                <Ionicons name="arrow-back" size={24} color="#FF3B5C" />
                <Text style={styles.swipeButtonText}>Bad</Text>
              </View>
              <View style={styles.swipeButton}>
                <Ionicons name="arrow-up" size={24} color="#FFA500" />
                <Text style={styles.swipeButtonText}>Meh</Text>
              </View>
              <View style={styles.swipeButton}>
                <Ionicons name="arrow-forward" size={24} color="#01DF8B" />
                <Text style={styles.swipeButtonText}>Good</Text>
              </View>
            </View>
            
            <View style={styles.cardContainer}>
              {foodData.map((food, index) => {
                const isFirst = index === currentIndex;
                
                // Render more cards for smoother transitions but keep them hidden until needed
                // This prevents the "changing image" effect by having cards already rendered
                if (index < currentIndex || index >= currentIndex + 10) return null;
                
                return (
                  <FoodCard
                    key={`food-${food.id}`} // Keep stable key to prevent re-rendering
                    food={food}
                    onSwipe={handleSwipe}
                    isFirst={isFirst}
                    index={index - currentIndex}
                  />
                );
              })}
            </View>
            
            {/* Add Undo Button */}
            <View style={styles.undoButtonContainer}>
              <TouchableOpacity
                style={[styles.undoButton, !canUndo && styles.undoButtonDisabled]}
                onPress={handleUndo}
                disabled={!canUndo}
              >
                <Ionicons name="arrow-undo" size={18} color="white" />
                <Text style={styles.undoButtonText}>Undo Last Rating</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statsContainer: {
    padding: 12,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#777',
  },
  currentItemInfo: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    borderRadius: 12,
    width: '92%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  currentItemName: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#222',
  },
  currentItemRestaurant: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  instructionsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 5,
  },
  swipeButton: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  swipeButtonText: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
    color: '#333',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
  instructionsContainer: {
    padding: 15,
    marginBottom: 10,
  },
  instruction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 30,
    textAlign: 'center',
  },
  resetButton: {
    padding: 8,
  },
  resetAllButton: {
    backgroundColor: '#FF3B5C',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  resetAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  undoButtonContainer: {
    position: 'absolute',
    bottom: 85,
    width: '100%',
    alignItems: 'center',
    padding: 10,
    zIndex: 100,
  },
  undoButton: {
    backgroundColor: '#FF3B5C',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  undoButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  undoButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  headerButton: {
    padding: 8,
    marginLeft: 4,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
}); 