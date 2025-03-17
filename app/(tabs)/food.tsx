import React, { useState, useCallback, memo, useEffect } from 'react';
import { StyleSheet, View, StatusBar as RNStatusBar, Platform, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { foodData } from '../../data/foodData'; // Keep as fallback
import { loadFoodData } from '../../data/realFoodData'; // Import our new data source
import { SwipeableCards } from '../../components/food/SwipeableCards';
import { FoodItem, SwipeHistoryItem } from '../../types/food';

const FoodScreen: React.FC = () => {
  const [likedFood, setLikedFood] = useState<FoodItem[]>([]);
  const [swipeHistory, setSwipeHistory] = useState<SwipeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);

  // Load the food data when the component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const data = await loadFoodData();
        setFoodItems(data);
      } catch (err) {
        console.error('Error loading food data:', err);
        setError('Failed to load food data. Please try again later.');
        // Fall back to mock data
        setFoodItems(foodData);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  const handleLike = useCallback((food: FoodItem) => {
    setLikedFood(prev => [...prev, food]);
    // Here you would typically trigger some API call to save the like
  }, []);

  const handleDislike = useCallback((food: FoodItem) => {
    // Here you would typically log this preference for future recommendations
  }, []);

  const handleSwipeHistoryUpdate = useCallback((history: SwipeHistoryItem[]) => {
    setSwipeHistory(history);
    // This could be used for analytics or to improve recommendations
  }, []);

  // Show loading indicator while data is being fetched
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#FF3B5C" />
        <Text style={styles.loadingText}>Loading delicious food...</Text>
      </View>
    );
  }

  // Show error message if data loading failed
  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="dark" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <SwipeableCards
        data={foodItems}
        onLike={handleLike}
        onDislike={handleDislike}
        onSwipeHistoryUpdate={handleSwipeHistoryUpdate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white', // Pure white background to focus on food images
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B5C',
    textAlign: 'center',
  },
});

export default memo(FoodScreen); 