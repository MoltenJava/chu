import { FoodItem } from '../types/food';
import { fetchRestaurantMetadata, loadLocalMetadata } from '../utils/metadataService';
import { foodData } from './foodData'; // Import the mock data as fallback

// Cache for the loaded food data
let cachedFoodData: FoodItem[] | null = null;

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