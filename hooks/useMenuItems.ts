import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { SanityMenuItem } from '@/types/sanity';
import { getMenuItems, getNearbyMenuItems, getRestaurantMenuItems } from '@/lib/sanity';

// Westwood, Los Angeles coordinates
const WESTWOOD_LOCATION = {
  coords: {
    latitude: 34.0633,
    longitude: -118.4478,
    accuracy: 5,
    altitude: 0,
    altitudeAccuracy: -1,
    heading: -1,
    speed: -1
  },
  timestamp: Date.now()
};

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function useMenuItems(useLocation: boolean = false) {
  const [items, setItems] = useState<SanityMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRestaurant, setCurrentRestaurant] = useState<string | null>(null);

  const openSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (err) {
      console.error('Error opening settings:', err);
    }
  };

  const requestLocationPermission = async () => {
    try {
      // First request foreground permissions
      const foregroundPermission = await Location.requestForegroundPermissionsAsync();
      if (foregroundPermission.status !== 'granted') {
        console.log('Permission to access location was denied');
        return false;
      }

      // Then request background permissions if needed
      const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
      if (backgroundPermission.status !== 'granted') {
        console.log('Background location permission was denied');
        // Still return true as we at least have foreground permissions
        return true;
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  };

  const getLocation = async () => {
    // Use Westwood location in development
    if (__DEV__) {
      console.log('Using development location: Westwood, LA');
      return WESTWOOD_LOCATION;
    }

    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      console.log('Location permission not granted');
      return null;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      return location;
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);

      let fetchedItems: SanityMenuItem[];

      // If in waiter mode, fetch restaurant-specific items
      if (currentRestaurant) {
        console.log('Fetching items for restaurant:', currentRestaurant);
        fetchedItems = await getRestaurantMenuItems(currentRestaurant);
      } else if (useLocation) {
        const location = await getLocation();
        if (location) {
          console.log('Location fetched:', location);
          
          fetchedItems = await getNearbyMenuItems(
            location.coords.latitude,
            location.coords.longitude
          );
        } else {
          console.log('Location permission denied, fetching all items');
          fetchedItems = await getMenuItems();
        }
      } else {
        fetchedItems = await getMenuItems();
      }

      // Debug log the fetched items
      console.log('Fetched items:', {
        count: fetchedItems.length,
        firstItem: fetchedItems[0],
        waiterMode: !!currentRestaurant
      });

      // Randomize the items unless in waiter mode
      if (!currentRestaurant) {
        fetchedItems = shuffleArray(fetchedItems);
        console.log('Randomized items order');
      }

      setItems(fetchedItems);
    } catch (err) {
      console.error('Error fetching menu items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch menu items');
    } finally {
      setLoading(false);
    }
  };

  const refresh = useCallback(() => {
    fetchItems();
  }, [currentRestaurant, useLocation]);

  // Function to enter waiter mode for a specific restaurant
  const enterWaiterMode = useCallback((restaurantTitle: string) => {
    console.log('Entering waiter mode for restaurant:', restaurantTitle);
    setCurrentRestaurant(restaurantTitle);
  }, []);

  // Function to exit waiter mode
  const exitWaiterMode = useCallback(() => {
    console.log('Exiting waiter mode');
    setCurrentRestaurant(null);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [useLocation, currentRestaurant]);

  return {
    items,
    loading,
    error,
    refresh,
    currentRestaurant,
    enterWaiterMode,
    exitWaiterMode,
    isWaiterMode: !!currentRestaurant
  };
} 