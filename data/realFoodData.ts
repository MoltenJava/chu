import { FoodItem } from '../types/food';
import { fetchRestaurantMetadata, loadLocalMetadata } from '../utils/metadataService';
import { foodData } from './foodData'; // Import the mock data as fallback
import { calculateBatchDistances } from '../utils/locationService';

// Cache for the loaded food data
let cachedFoodData: FoodItem[] | null = null;

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
export const loadRealFoodData = async (): Promise<FoodItem[]> => {
  try {
    // Get the base food items from the metadata service
    let foodItems = await fetchRestaurantMetadata();
    
    console.log(`Got ${foodItems.length} items from metadata, calculating distances progressively...`);
    
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
    const itemsWithDistance = await calculateBatchDistances(limitedItems);
    
    console.log(`Returning ${itemsWithDistance.length} items with progressive distance calculation (limited from ${foodItems.length})`);
    return itemsWithDistance;
  } catch (error) {
    console.error('Error loading real food data:', error);
    
    // Fallback to mock data
    return [];
  }
};

/**
 * Load food data from a local file for testing
 */
export const loadLocalFoodData = async (localPath: string): Promise<FoodItem[]> => {
  try {
    // Get the base food items from the local file
    let foodItems = await loadLocalMetadata(localPath);
    
    // Calculate distances for the food items
    foodItems = await calculateBatchDistances(foodItems);
    
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
};

/**
 * Gets the cached food data without loading
 * Returns null if no data is cached
 */
export const getCachedFoodData = (): FoodItem[] | null => {
  return cachedFoodData;
}; 