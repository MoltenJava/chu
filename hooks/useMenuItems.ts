import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { SanityMenuItem } from '@/types/sanity';
import { getMenuItems, getNearbyMenuItems } from '@/lib/sanity';

export function useMenuItems(useLocation: boolean = false) {
  const [items, setItems] = useState<SanityMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      if (useLocation) {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          // If no permission, fall back to non-location based items
          const allItems = await getMenuItems();
          setItems(allItems);
          return;
        }

        const { coords } = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const nearbyItems = await getNearbyMenuItems(
          coords.latitude,
          coords.longitude,
          5 // 5km radius
        );
        setItems(nearbyItems);
      } else {
        const allItems = await getMenuItems();
        setItems(allItems);
      }
    } catch (err) {
      console.error('Error fetching menu items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch menu items');
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchItems();
  };

  useEffect(() => {
    fetchItems();
  }, [useLocation]);

  return {
    items,
    loading,
    error,
    refresh,
  };
} 