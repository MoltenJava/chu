import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { SanityMenuItem } from '@/types/sanity';
import { getMenuItems, getNearbyMenuItems, getRestaurantMenuItems } from '@/lib/sanity';

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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'We need your location to show you nearby food options. Please enable location services in your settings.',
          [
            { text: 'Not Now', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: openSettings
            }
          ]
        );
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error requesting location permission:', err);
      return false;
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
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
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