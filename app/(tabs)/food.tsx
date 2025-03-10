import React, { useState, useCallback, memo } from 'react';
import { StyleSheet, View, StatusBar as RNStatusBar, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { foodData } from '../../data/foodData';
import { SwipeableCards } from '../../components/food/SwipeableCards';
import { FoodItem, SwipeHistoryItem } from '../../types/food';

const FoodScreen: React.FC = () => {
  const [likedFood, setLikedFood] = useState<FoodItem[]>([]);
  const [swipeHistory, setSwipeHistory] = useState<SwipeHistoryItem[]>([]);

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

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <SwipeableCards
        data={foodData}
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
});

export default memo(FoodScreen); 