import React, { useState, useEffect, useCallback } from 'react';
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
  
  // Handle swipe events
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
            
            <View style={styles.instructionsContainer}>
              <View style={styles.instruction}>
                <Ionicons name="arrow-back" size={24} color="#FF3B5C" />
                <Text style={styles.instructionText}>Swipe Left for Bad Photos</Text>
              </View>
              <View style={styles.instruction}>
                <Ionicons name="arrow-up" size={24} color="#FFA500" />
                <Text style={styles.instructionText}>Swipe Up for Meh Photos</Text>
              </View>
              <View style={styles.instruction}>
                <Ionicons name="arrow-forward" size={24} color="#01DF8B" />
                <Text style={styles.instructionText}>Swipe Right for Good Photos</Text>
              </View>
            </View>
            
            <View style={styles.cardContainer}>
              {foodData.map((food, index) => {
                const isFirst = index === currentIndex;
                // Only render a few cards for performance
                if (index < currentIndex || index >= currentIndex + 3) return null;
                
                return (
                  <FoodCard
                    key={food.id}
                    food={food}
                    onSwipe={handleSwipe}
                    isFirst={isFirst}
                    index={index - currentIndex}
                  />
                );
              })}
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
    marginBottom: 5,
  },
  statsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
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
}); 