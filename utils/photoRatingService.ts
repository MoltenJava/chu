import AsyncStorage from '@react-native-async-storage/async-storage';
import { FoodItem, PhotoRating } from '../types/food';

// Storage key for the ratings
const RATINGS_STORAGE_KEY = 'photo_ratings';

/**
 * Interface for the ratings object stored in AsyncStorage
 */
interface PhotoRatings {
  [photoId: string]: PhotoRating;
}

/**
 * Load all photo ratings from storage
 */
export const loadPhotoRatings = async (): Promise<PhotoRatings> => {
  try {
    const ratingsJson = await AsyncStorage.getItem(RATINGS_STORAGE_KEY);
    if (ratingsJson) {
      return JSON.parse(ratingsJson) as PhotoRatings;
    }
    return {};
  } catch (error) {
    console.error('Error loading photo ratings:', error);
    return {};
  }
};

/**
 * Save a rating for a photo
 */
export const savePhotoRating = async (photoId: string, rating: PhotoRating): Promise<void> => {
  try {
    // Get existing ratings
    const ratings = await loadPhotoRatings();
    
    // Update the rating for this photo
    ratings[photoId] = rating;
    
    // Save back to storage
    await AsyncStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(ratings));
    
    console.log(`Saved rating "${rating}" for photo ${photoId}`);
  } catch (error) {
    console.error('Error saving photo rating:', error);
  }
};

/**
 * Clear all photo ratings
 */
export const clearPhotoRatings = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(RATINGS_STORAGE_KEY);
    console.log('Cleared all photo ratings');
  } catch (error) {
    console.error('Error clearing photo ratings:', error);
  }
};

/**
 * Apply ratings to a list of food items
 */
export const applyRatingsToFoodItems = async (foodItems: FoodItem[]): Promise<FoodItem[]> => {
  // Load all ratings
  const ratings = await loadPhotoRatings();
  
  // Add ratings to food items
  return foodItems.map(item => ({
    ...item,
    rating: ratings[item.id] || null
  }));
};

/**
 * Filter out items that have already been rated
 */
export const filterRatedItems = async (foodItems: FoodItem[]): Promise<FoodItem[]> => {
  // Load all ratings
  const ratings = await loadPhotoRatings();
  
  // Return only unrated items
  return foodItems.filter(item => !ratings[item.id]);
};

/**
 * Get all rated items with their ratings
 */
export const getRatedItems = async (foodItems: FoodItem[]): Promise<FoodItem[]> => {
  // Load all ratings
  const ratings = await loadPhotoRatings();
  
  // Apply ratings to all items
  const itemsWithRatings = await applyRatingsToFoodItems(foodItems);
  
  // Return only rated items
  return itemsWithRatings.filter(item => item.rating !== null);
}; 