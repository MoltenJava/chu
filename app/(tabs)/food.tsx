import React, { useState, useCallback, memo, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import SwipeableCards from '@/components/food/SwipeableCards';
import { useMenuItems } from '@/hooks/useMenuItems';
import { SupabaseMenuItem } from '@/types/supabase';
import { FoodItem, DisplayableFoodItem } from '@/types/food'; // Import DisplayableFoodItem
import { useNavigation } from 'expo-router';
import { useLocationContext } from '@/context/LocationContext'; // Import context
import { calculateBatchDistances, Coordinates } from '@/utils/locationService'; // Import distance calculation
import { supabase } from '@/lib/supabase';
import { convertToSupabaseMenuItem } from '@/types/supabase';

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
  // FoodScreen component for displaying swipeable food cards
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Items from useMenuItems (basic data without distance initially)
  const { 
    items: rawItems, 
    loading: loadingRawItems, 
    error: rawItemsError, 
    refresh,
    enterWaiterMode, // Destructure enterWaiterMode
    exitWaiterMode,   // Destructure exitWaiterMode
    isWaiterMode     // Destructure isWaiterMode to track actual waiter mode state
  } = useMenuItems(selectedFilters);
  
  const { currentUserLocationForApp } = useLocationContext();
  const [itemsWithDistance, setItemsWithDistance] = useState<DisplayableFoodItem[]>([]); // Changed type to DisplayableFoodItem[]
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  
  const navigation = useNavigation<any>();

  // Placeholder for swipe history update function
  const updateSwipeHistory = useCallback((history: any[]) => {
    console.log("[FoodScreen] Swipe history updated (placeholder):", history.length, "items");
    // Implement actual swipe history logic if needed
  }, []);

  useEffect(() => {
    console.log('[FoodScreen Effect 1] Triggered. loadingRawItems:', loadingRawItems, 'rawItems length:', rawItems?.length, 'rawItemsError:', rawItemsError, 'currentUserLocationForApp:', !!currentUserLocationForApp);
    if (rawItemsError) {
      console.error("[FoodScreen Effect 1] Error from useMenuItems:", rawItemsError);
      setItemsWithDistance([]); 
      setIsInitialLoading(false); 
      setDistanceError(rawItemsError); 
      return;
    }

    // If loadingRawItems is true, BUT we already have some rawItems, 
    // it implies the first chunk might be in but the loading flag from the hook hasn't propagated false yet for this exact render.
    // We should proceed if location is available.
    // If rawItems is empty, then definitely wait if loadingRawItems is true.
    if (loadingRawItems && (!rawItems || rawItems.length === 0)) {
      console.log('[FoodScreen Effect 1] Still loading raw items AND rawItems is empty. Returning early.');
      return; 
    }
    
    // If loadingRawItems is technically still true, but rawItems has been populated (first chunk from useMenuItems)
    // and location is ready, we can proceed with distance calculation for the available items.
    // The main screen loading indicator will still show due to FoodScreen's own isInitialLoading or isCalculatingDistance.
    if (rawItems && rawItems.length > 0) {
        if (currentUserLocationForApp) {
            const calculateDistances = async () => {
                console.log("[FoodScreen Effect 1] calculateDistances START for", rawItems.length, "items. Current isCalculatingDistance:", isCalculatingDistance);
                // Prevent re-calculation if already in progress for the same rawItems set (though dependencies should handle this)
                // if (isCalculatingDistance) return;
                setIsCalculatingDistance(true);
                setDistanceError(null);
                try {
                    const processedItems = await calculateBatchDistances(rawItems, currentUserLocationForApp);
                    console.log("[FoodScreen Effect 1] calculateDistances SUCCESS. Processed items count:", processedItems.length);
                    setItemsWithDistance(processedItems);
                } catch (err: any) {
                    console.error("[FoodScreen Effect 1] calculateDistances ERROR:", err);
                    setDistanceError("Could not calculate distances. Please try again.");
                    setItemsWithDistance(rawItems.map(item => ({ ...item, distanceFromUser: undefined, estimatedDuration: undefined })));
                } finally {
                    console.log("[FoodScreen Effect 1] calculateDistances FINALLY. Setting isCalculatingDistance to false.");
                    setIsCalculatingDistance(false);
                }
            };
            calculateDistances();
        } else {
            console.warn('[FoodScreen Effect 1] Raw items available, but location not available yet. Using rawItems without distance info.');
            setItemsWithDistance(rawItems.map(item => ({ ...item, distanceFromUser: undefined, estimatedDuration: undefined })));
            setIsCalculatingDistance(false); 
        }
    } else if (!loadingRawItems && rawItems && rawItems.length === 0) { // Not loading, and rawItems is definitively empty
      console.log('[FoodScreen Effect 1] Raw items loaded AND is empty. Setting itemsWithDistance to empty array.');
      setItemsWithDistance([]);
      setIsCalculatingDistance(false); // Ensure this is false too
    }
    // console.log('[FoodScreen Effect 1] End of effect logic.'); // This log might be too noisy now

  }, [rawItems, currentUserLocationForApp, rawItemsError, loadingRawItems]);

  // Combined loading state considering initial item fetch and distance calculation
  const isLoading = isInitialLoading || (loadingRawItems && itemsWithDistance.length === 0) || isCalculatingDistance;
  const displayError = rawItemsError || distanceError;
  
  // Restore handleFilterChange, handleLike, handleDislike
  const handleFilterChange = useCallback((newFilters: string[]) => {
    console.log('[FoodScreen] Filters changed:', newFilters);
    setSelectedFilters(newFilters); 
  }, []);

  const handleLike = (food: SupabaseMenuItem) => {
    console.log('Liked:', food.name);
    // Handle like logic
  };

  const handleDislike = (food: SupabaseMenuItem) => {
    console.log('Disliked:', food.name); 
    // Handle dislike logic
  };

  const handleEnterWaiterMode = useCallback((restaurantId: string, anchorItem: SupabaseMenuItem) => {
    console.log(`[FoodScreen] handleEnterWaiterMode called with restaurant ID: ${restaurantId} and anchor item: ${anchorItem.name}`);
    if (enterWaiterMode) {
      enterWaiterMode(restaurantId, anchorItem);
    } else {
      console.warn("[FoodScreen] enterWaiterMode function from useMenuItems is not available.");
    }
  }, [enterWaiterMode]);

  const handleExitWaiterMode = useCallback(() => {
    console.log("[FoodScreen] handleExitWaiterMode called");
    if (exitWaiterMode) {
      exitWaiterMode();
    } else {
      console.warn("[FoodScreen] exitWaiterMode function from useMenuItems is not available.");
    }
  }, [exitWaiterMode]);

  useEffect(() => {
    // This effect sets the local isInitialLoading flag based on loadingRawItems from the hook.
    console.log('[FoodScreen Effect 2] Triggered. loadingRawItems:', loadingRawItems, 'FoodScreen isInitialLoading:', isInitialLoading);
    if (!loadingRawItems && isInitialLoading) {
      console.log('[FoodScreen Effect 2] Raw items done loading, setting FoodScreen isInitialLoading to false.');
      setIsInitialLoading(false);
    }
  }, [loadingRawItems, isInitialLoading]);

  // Add function to fetch items for a specific restaurant (for waiter mode)
  const fetchItemsForRestaurant = async (restaurant: string): Promise<SupabaseMenuItem[]> => {
    try {
      console.log(`[FOOD_TAB] Fetching ALL items for restaurant from database: "${restaurant}"`);
      
      // Try direct query first to get ALL items for the specific restaurant
      const { data: directData, error: directError } = await supabase
        .from('menu_items')
        .select(`
          *,
          restaurants!inner (
            name,
            address,
            latitude,
            longitude,
            "Sunday",
            "Monday", 
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
          )
        `)
        .eq('restaurants.name', restaurant);

      if (directError) {
        console.error(`[FOOD_TAB] Direct query error:`, directError);
        console.log(`[FOOD_TAB] Falling back to RPC method...`);
        
        // Fallback to RPC method if direct query fails
        const { data: rpcData, error } = await supabase
          .rpc('get_random_menu_items', {
            limit_count: 10000 // Increase to capture all ~4000 items in database
          });

        if (error) {
          console.error(`[FOOD_TAB] RPC Error:`, error);
          throw error;
        }

        console.log(`[FOOD_TAB] RPC returned ${rpcData.length} total items from entire database`);

        // Debug: Log unique restaurant names to see what's available
        const uniqueRestaurants = [...new Set(rpcData.map((item: any) => item.restaurant_name))];
        console.log(`[FOOD_TAB] Available restaurants in database:`, uniqueRestaurants.slice(0, 10));
        
        // Filter items for the specific restaurant (exact match, case-insensitive)
        const restaurantItems = rpcData.filter((item: any) => 
          item.restaurant_name && 
          item.restaurant_name.toLowerCase() === restaurant.toLowerCase()
        );

        console.log(`[FOOD_TAB] Found ${restaurantItems.length} items for restaurant: "${restaurant}"`);

        // Convert to SupabaseMenuItem format
        const convertedItems = restaurantItems.map((item: any) => convertToSupabaseMenuItem(item));
        return convertedItems;
      }

      console.log(`[FOOD_TAB] Direct query returned ${directData.length} items for restaurant: "${restaurant}"`);

      // Convert direct query results to the format expected by convertToSupabaseMenuItem
      const convertedItems = directData.map((item: any) => {
        const restaurant = item.restaurants;
        return convertToSupabaseMenuItem({
          ...item,
          // Map restaurant fields to the expected format
          restaurant_name: restaurant.name,
          restaurant_address: restaurant.address,
          restaurant_latitude: restaurant.latitude,
          restaurant_longitude: restaurant.longitude,
          sunday_hours: restaurant.Sunday,
          monday_hours: restaurant.Monday,
          tuesday_hours: restaurant.Tuesday,
          wednesday_hours: restaurant.Wednesday,
          thursday_hours: restaurant.Thursday,
          friday_hours: restaurant.Friday,
          saturday_hours: restaurant.Saturday,
        });
      });
      
      return convertedItems;
    } catch (error) {
      console.error(`[FOOD_TAB] Error fetching items for restaurant "${restaurant}":`, error);
      throw error;
    }
  };

  // Add function to fetch ALL items matching the selected filters from database
  const fetchFilteredItems = async (filters: string[]): Promise<SupabaseMenuItem[]> => {
    try {
      console.log(`[FOOD_TAB] Fetching ALL items for filters from database: ${filters.join(', ')}`);
      
      // Use RPC method to get ALL items from database
      const { data: rpcData, error } = await supabase
        .rpc('get_random_menu_items', {
          limit_count: 10000 // Get all items in database
        });

      if (error) {
        console.error(`[FOOD_TAB] RPC Error for filter query:`, error);
        throw error;
      }

      console.log(`[FOOD_TAB] RPC returned ${rpcData.length} total items from entire database for filtering`);

      // Filter items that match ANY of the selected filters
      const filteredItems = rpcData.filter((item: any) => {
        return filters.some(filter => {
          // Parse dish_types if it's a string, or use as array
          let dishTypes: string[] = [];
          if (typeof item.dish_types === 'string') {
            try {
              dishTypes = JSON.parse(item.dish_types);
            } catch {
              dishTypes = [item.dish_types]; // Fallback to single item array
            }
          } else if (Array.isArray(item.dish_types)) {
            dishTypes = item.dish_types;
          }
          
          // Check if filter matches any dish_types (this is the main matching logic)
          if (dishTypes.some((type: string) => type.toLowerCase() === filter.toLowerCase())) {
            console.log(`[FILTER_MATCH] Item "${item.menu_item}" matches filter "${filter}" via dish_types: [${dishTypes.join(', ')}]`);
            return true;
          }
          
          // Also check category field for backwards compatibility
          if (item.category && item.category.toLowerCase().includes(filter.toLowerCase())) {
            console.log(`[FILTER_MATCH] Item "${item.menu_item}" matches filter "${filter}" via category: "${item.category}"`);
            return true;
          }
          
          // Check cuisines array if it exists
          let cuisines: string[] = [];
          if (typeof item.cuisines === 'string') {
            try {
              cuisines = JSON.parse(item.cuisines);
            } catch {
              cuisines = [item.cuisines];
            }
          } else if (Array.isArray(item.cuisines)) {
            cuisines = item.cuisines;
          }
          
          if (cuisines.some((cuisine: string) => cuisine.toLowerCase() === filter.toLowerCase())) {
            console.log(`[FILTER_MATCH] Item "${item.menu_item}" matches filter "${filter}" via cuisines: [${cuisines.join(', ')}]`);
            return true;
          }
          
          // Check if filter matches the menu item name (for broader matching)
          if (item.menu_item && item.menu_item.toLowerCase().includes(filter.toLowerCase())) {
            console.log(`[FILTER_MATCH] Item "${item.menu_item}" matches filter "${filter}" via menu item name`);
            return true;
          }
          
          return false;
        });
      });

      console.log(`[FOOD_TAB] Found ${filteredItems.length} items matching filters: ${filters.join(', ')}`);
      
      if (filteredItems.length > 0) {
        console.log(`[FOOD_TAB] First few matched items:`, 
          filteredItems.slice(0, 5).map(item => `${item.menu_item} from ${item.restaurant_name} (dish_types: ${item.dish_types})`));
      }

      // Convert to SupabaseMenuItem format
      const convertedItems = filteredItems.map((item: any) => convertToSupabaseMenuItem(item));
      return convertedItems;
    } catch (error) {
      console.error(`[FOOD_TAB] Error fetching filtered items for filters "${filters.join(', ')}":`, error);
      throw error;
    }
  };

  console.log('[FoodScreen Render] isLoading:', isLoading, 
              'itemsWithDistance.length:', itemsWithDistance.length, 
              'FoodScreen.isInitialLoading:', isInitialLoading, 
              'hook.loadingRawItems:', loadingRawItems, 
              'isCalculatingDistance:', isCalculatingDistance,
              'displayError:', displayError);

  if (isLoading && itemsWithDistance.length === 0 && !displayError) { 
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="dark" backgroundColor="#FAFAFA" />
        <ActivityIndicator size="large" color="#FF3B5C" />
        <Text style={styles.loadingText}>
          {isInitialLoading || loadingRawItems ? "Finding delicious food..." : "Calculating distances..."}
        </Text>
      </View>
    );
  }

  if (displayError) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="dark" backgroundColor="#FAFAFA" />
        <Text style={styles.errorText}>{displayError}</Text>
        {/* Optionally add a retry button here that calls refresh() or re-triggers distance calc */}
      </View>
    );
  }
  
  if (!isLoading && itemsWithDistance.length === 0 && !loadingRawItems && !rawItemsError && !distanceError) {
     return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="dark" backgroundColor="#FAFAFA" />
        <Text style={styles.loadingText}>No food items found. Try adjusting your filters!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FAFAFA" />
      <ErrorBoundary>
        <SwipeableCards
          key={`swipe-cards-${selectedFilters.join('-')}-${rawItems && rawItems.length > 0 ? rawItems[0]?.id : 'empty'}`}
          data={itemsWithDistance} // Pass items with distance info
          onLike={handleLike}
          onDislike={handleDislike}
          onSwipeHistoryUpdate={updateSwipeHistory}
          onRequestRestaurantItems={fetchItemsForRestaurant} // Use simple prop for fetching restaurant items
          onRequestFilteredItems={fetchFilteredItems} // Add function to fetch ALL filtered items from database
          onNavigateToPlaylist={() => navigation.navigate('Playlist')}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange} 
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