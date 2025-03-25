import React, { useState, useCallback, memo, useEffect, ReactNode } from 'react';
import { StyleSheet, View, StatusBar as RNStatusBar, Platform, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { foodData } from '../../data/foodData'; // Keep as fallback
import { loadFoodData, loadRealFoodData } from '../../data/realFoodData'; // Import our new data source
import { SwipeableCards } from '../../../chu/components/food/SwipeableCards';
import { FoodItem, SwipeHistoryItem } from '../../types/food';

// Simple Error Boundary component to catch and handle rendering errors gracefully
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error to an error reporting service
    console.error("Component error:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <View style={[styles.container, styles.centerContent]}>
          <StatusBar style="dark" />
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.loadingText}>Please restart the app</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

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
        
        // Use loadRealFoodData to get distance information
        const data = await loadRealFoodData();
        
        if (data && data.length > 0) {
          console.log(`Loaded ${data.length} items with distance info`);
          console.log(`Sample item: ${JSON.stringify(data[0])}`);
          setFoodItems(data);
        } else {
          console.warn('Real food data is empty, falling back to regular loadFoodData');
          const fallbackData = await loadFoodData();
          setFoodItems(fallbackData);
        }
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
      
      <ErrorBoundary>
        <SwipeableCards
          data={foodItems}
          onLike={handleLike}
          onDislike={handleDislike}
          onSwipeHistoryUpdate={handleSwipeHistoryUpdate}
        />
      </ErrorBoundary>
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