import React, { useState, useCallback, memo } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SwipeableCards } from '@/components/food/SwipeableCards';
import { useMenuItems } from '@/hooks/useMenuItems';
import { SupabaseMenuItem } from '@/types/supabase';
import { useNavigation } from 'expo-router';

// Define types for the Root Stack Navigator
// This needs to include all routes defined in app/_layout.tsx
type RootStackParamList = {
  '(tabs)': undefined;
  '(auth)': undefined;
  playlistList: undefined; // Add playlistList route
  playlistDetail: { playlistId: string; playlistName: string }; // Add playlistDetail route
  // Add other root routes if they exist
};

// Simple Error Boundary component to catch and handle rendering errors gracefully
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("Component error:", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={[styles.container, styles.centerContent]}>
          <StatusBar 
            style="dark" 
            backgroundColor="#FAFAFA" // Change background to #FAFAFA
          />
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.loadingText}>Please restart the app</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const FoodScreen: React.FC = () => {
  const [likedFood, setLikedFood] = useState<SupabaseMenuItem[]>([]);
  const { items, loading, error, refresh } = useMenuItems(true); // true to use location
  const navigation = useNavigation<any>(); // Using any temporarily, replace with correct type if available

  const handleLike = useCallback((food: SupabaseMenuItem) => {
    setLikedFood(prev => [...prev, food]);
    // Here you would typically trigger some API call to save the like
  }, []);

  const handleDislike = useCallback((food: SupabaseMenuItem) => {
    // Here you would typically log this preference for future recommendations
  }, []);

  // Show loading indicator while data is being fetched
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar 
          style="dark" 
          backgroundColor="#FAFAFA" // Change background to #FAFAFA
        />
        <ActivityIndicator size="large" color="#FF3B5C" />
        <Text style={styles.loadingText}>Finding delicious food near you...</Text>
      </View>
    );
  }

  // Show error message if data loading failed
  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar 
          style="dark" 
          backgroundColor="#FAFAFA" // Change background to #FAFAFA
        />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar 
        style="dark" 
        backgroundColor="#FAFAFA" // Change background to #FAFAFA
      />
      
      <ErrorBoundary>
        <SwipeableCards
          key="swipe-cards"
          data={items}
          onLike={handleLike}
          onDislike={handleDislike}
        />
      </ErrorBoundary>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA', // Change background to off-white
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#212121', // Change text color to dark gray
  },
  errorText: {
    fontSize: 16,
    color: '#F44336', // Keep a standard error red
    textAlign: 'center',
  },
});

export default memo(FoodScreen); 