import { FoodItem } from '../types/food';
import { fetchRestaurantMetadata, loadLocalMetadata, getBackupMetadata } from '../utils/metadataService';
import { foodData } from './foodData'; // Import the mock data as fallback
import { calculateBatchDistances, Coordinates } from '../utils/locationService';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Helper to detect if we're running in TestFlight
const isTestFlight = () => {
  if (Platform.OS !== 'ios') return false;
  
  try {
    // Access Constants safely without direct property access
    const manifest = Constants.manifest as any;
    if (manifest && manifest.extra && manifest.extra.appStoreReceipt) {
      const isTestFlightReceipt = manifest.extra.appStoreReceipt.includes('sandboxReceipt');
      console.log('[ENV CHECK] Running in TestFlight:', isTestFlightReceipt);
      return isTestFlightReceipt;
    }
  } catch (e) {
    console.log('[ENV CHECK] Error detecting environment:', e);
  }
  
  return false;
};

// Cache for the loaded food data
let cachedFoodData: FoodItem[] | null = null;

// Cache for the full dataset (all items from S3 without limitation)
let fullDatasetCache: FoodItem[] | null = null;

// Maximum number of items to load to avoid performance issues
const MAX_FOOD_ITEMS = 200;

/**
 * Shuffles an array using the Fisher-Yates algorithm
 * @param array The array to shuffle
 * @returns A new shuffled array
 */
const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array]; // Create a copy to avoid modifying the original
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; // Swap elements
  }
  return newArray;
};

/**
 * Load food data from the actual API or local cache
 */
export const loadRealFoodData = async (userLocation: Coordinates): Promise<FoodItem[]> => {
  try {
    console.log('[REAL-FOOD] Starting to load real food data, user location:', userLocation);
    const isTestFlightBuild = isTestFlight();
    console.log('[REAL-FOOD] Environment:', isTestFlightBuild ? 'TestFlight' : 'Development');
    
    // Get the base food items from the metadata service
    let foodItems = await fetchRestaurantMetadata();
    
    console.log(`[REAL-FOOD] Got ${foodItems.length} items from metadata, calculating distances progressively...`);
    
    // Check if we received any valid items
    if (foodItems.length === 0) {
      console.warn('[REAL-FOOD] No items returned from S3. Using backup data.');
      
      // In TestFlight, use more reliable backup data instead of mock data
      if (isTestFlightBuild) {
        console.log('[REAL-FOOD] Using backup restaurant data for TestFlight');
        foodItems = getBackupMetadata();
      } else {
        // In development, use mock data to keep dev/prod experiences similar
        foodItems = [...foodData];
      }
      
      console.log(`[REAL-FOOD] Using ${foodItems.length} fallback food items instead`);
    }
    
    // Store the full dataset in cache for later use by the waiter mode
    fullDatasetCache = [...foodItems];
    console.log(`[REAL-FOOD] Stored full dataset with ${fullDatasetCache.length} items in cache for waiter mode`);
    
    // Validate restaurant names
    const restaurantCounts: Record<string, number> = {};
    const unknownRestaurants = foodItems.filter(item => !item.restaurant || item.restaurant === 'unknown restaurant');
    
    if (unknownRestaurants.length > 0) {
      console.warn(`[REAL-FOOD] Found ${unknownRestaurants.length} items with unknown restaurants`);
    }
    
    // Log restaurant distribution
    foodItems.forEach(item => {
      if (item.restaurant) {
        restaurantCounts[item.restaurant] = (restaurantCounts[item.restaurant] || 0) + 1;
      }
    });
    
    console.log('[REAL-FOOD] Restaurant distribution:', 
      Object.entries(restaurantCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => `${name}: ${count}`)
        .join(', ')
    );
    
    // Ensure coordinates are present for every item (use default if missing)
    foodItems = foodItems.map(item => {
      if (!item.coordinates) {
        console.log(`Item ${item.name} is missing coordinates, using default`);
        return {
          ...item,
          coordinates: {
            // Default to Westwood area if missing
            latitude: 34.0611701,
            longitude: -118.4462
          }
        };
      }
      return item;
    });
    
    // Shuffle the array to get a random subset
    foodItems = shuffleArray(foodItems);
    
    // PERFORMANCE FIX: Limit the number of items to avoid crashes
    const limitedItems = foodItems.slice(0, MAX_FOOD_ITEMS);
    
    // Calculate distances for the limited items
    if (!userLocation) {
      console.error('[REAL-FOOD] User location is missing, cannot calculate distances.');
      // Decide on fallback behavior: return items without distance, or throw error, or use a default location?
      // For now, returning items as is, which means they might use mock/default distances if calculateBatchDistances has fallbacks
      // Or, if calculateBatchDistances strictly requires it, this will fail.
      // The previous step made userLocation required for calculateBatchDistances.
      // So, we must have a valid userLocation here.
      // Throwing an error or using a VERY clear default/error state for items is better.
      throw new Error("[REAL-FOOD] Critical: User location not available for distance calculation.");
    }
    const itemsWithDistance = await calculateBatchDistances(limitedItems, userLocation);
    
    console.log(`Returning ${itemsWithDistance.length} items with progressive distance calculation (limited from ${foodItems.length})`);
    return itemsWithDistance;
  } catch (error) {
    console.error('[REAL-FOOD] Error loading real food data:', error);
    
    // Fallback to backup data in TestFlight, mock data otherwise
    if (isTestFlight()) {
      console.log('[REAL-FOOD] Using backup data for TestFlight after error');
      return getBackupMetadata();
    }
    
    // Use mock data in development
    return foodData;
  }
};

/**
 * Get all items for a specific restaurant from the full dataset
 * Used by the waiter mode to show all items from a restaurant
 */
export const getRestaurantItems = async (restaurant: string): Promise<FoodItem[]> => {
  console.log(`[RESTAURANT-ITEMS] Fetching all items for ${restaurant}`);
  
  try {
    // If we already have the full dataset in memory, use it
    if (fullDatasetCache && fullDatasetCache.length > 0) {
      console.log(`[RESTAURANT-ITEMS] Using cached full dataset with ${fullDatasetCache.length} items`);
      
      // Filter for the requested restaurant
      const restaurantItems = fullDatasetCache.filter(item => item.restaurant === restaurant);
      console.log(`[RESTAURANT-ITEMS] Found ${restaurantItems.length} items for ${restaurant} in full dataset`);
      
      return restaurantItems;
    }
    
    // If not cached, fetch the full dataset
    console.log(`[RESTAURANT-ITEMS] Full dataset not in cache, fetching from S3`);
    const fullData = await fetchRestaurantMetadata();
    
    // Cache for future requests
    fullDatasetCache = fullData;
    
    // Filter for the requested restaurant
    const restaurantItems = fullData.filter(item => item.restaurant === restaurant);
    console.log(`[RESTAURANT-ITEMS] Found ${restaurantItems.length} items for ${restaurant} in freshly fetched dataset of ${fullData.length} items`);
    
    return restaurantItems;
  } catch (error) {
    console.error(`[RESTAURANT-ITEMS] Error fetching items for ${restaurant}:`, error);
    return [];
  }
};

/**
 * Load food data from a local file for testing
 */
export const loadLocalFoodData = async (localPath: string, userLocation: Coordinates): Promise<FoodItem[]> => {
  try {
    // Get the base food items from the local file
    let foodItems = await loadLocalMetadata(localPath);
    
    if (!userLocation) {
      throw new Error("[REAL-FOOD-LOCAL] Critical: User location not available for distance calculation.");
    }
    // Calculate distances for the food items
    foodItems = await calculateBatchDistances(foodItems, userLocation);
    
    // Sort by distance (closest first)
    foodItems.sort((a, b) => {
      const distA = a.distanceFromUser || Infinity;
      const distB = b.distanceFromUser || Infinity;
      return distA - distB;
    });
    
    return foodItems;
  } catch (error) {
    console.error('Error loading local food data:', error);
    
    // Fallback to empty array
    return [];
  }
};

/**
 * Loads food data from the restaurant metadata
 * Falls back to mock data if the metadata can't be loaded
 */
export const loadFoodData = async (): Promise<FoodItem[]> => {
  // Return cached data if available
  if (cachedFoodData && cachedFoodData.length > 0) {
    return cachedFoodData;
  }
  
  try {
    // Try to fetch from S3
    const metadataItems = await fetchRestaurantMetadata();
    
    if (metadataItems && metadataItems.length > 0) {
      cachedFoodData = metadataItems;
      return metadataItems;
    }
    
    // If S3 fetch fails or returns empty, try local file
    // You'll need to place the westwood_restaurant_metadata.json file in your assets directory
    const localItems = await loadLocalMetadata('./assets/westwood_restaurant_metadata.json');
    
    if (localItems && localItems.length > 0) {
      cachedFoodData = localItems;
      return localItems;
    }
    
    // If all else fails, use the mock data
    console.log('Using mock food data as fallback');
    cachedFoodData = foodData;
    return foodData;
  } catch (error) {
    console.error('Error loading food data:', error);
    // Fall back to mock data
    cachedFoodData = foodData;
    return foodData;
  }
};

/**
 * Clears the food data cache, forcing a reload on next request
 */
export const clearFoodDataCache = (): void => {
  cachedFoodData = null;
  fullDatasetCache = null;
};

/**
 * Gets the cached food data without loading
 * Returns null if no data is cached
 */
export const getCachedFoodData = (): FoodItem[] | null => {
  return cachedFoodData;
}; 