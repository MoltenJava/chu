import { FoodItem } from '../types/food';

// Google API key
const GOOGLE_API_KEY = 'AIzaSyBaaoBruSs1Wl0YbmXqErLl6w8ZiepPdwk';

// Default user location (Westwood, LA)
const DEFAULT_USER_LOCATION = {
  latitude: 34.04053500,
  longitude: -118.44994500
};

// Interface for location coordinates
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculate the distance between two points using Google Routes API
 * 
 * @param origin Starting coordinates
 * @param destination Ending coordinates
 * @returns Promise with distance in miles
 */
export const calculateDistance = async (
  origin: Coordinates,
  destination: Coordinates
): Promise<{ distance: number; duration: number }> => {
  try {
    // Use the new Google Routes API
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    
    console.log(`Making Routes API request from ${origin.latitude},${origin.longitude} to ${destination.latitude},${destination.longitude}`);
    
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.latitude,
            longitude: origin.longitude
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude
          }
        }
      },
      travelMode: "DRIVE"
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.warn(`API request failed with status ${response.status}. Falling back to calculation.`);
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      // Extract the distance and duration from the first route
      const route = data.routes[0];
      const distanceInMeters = route.distanceMeters;
      
      // Parse duration string (format: "123s")
      const durationString = route.duration;
      const durationInSeconds = parseInt(durationString.replace('s', ''), 10);
      
      // Convert meters to miles
      const distanceInMiles = distanceInMeters * 0.000621371;
      
      console.log(`Routes API success: ${distanceInMiles.toFixed(2)} miles, ${durationInSeconds} seconds`);
      
      return {
        distance: distanceInMiles,
        duration: durationInSeconds
      };
    }
    
    console.warn(`Routes API failed: No routes returned. Falling back to calculation.`);
    throw new Error(`Routes API failed: No routes returned`);
  } catch (error) {
    console.error('Error with Routes API:', error);
    
    // Ensure we have valid coordinates before calculating fallback
    if (isNaN(origin.latitude) || isNaN(origin.longitude) || 
        isNaN(destination.latitude) || isNaN(destination.longitude)) {
      console.warn('Invalid coordinates for fallback calculation, using default distance');
      return {
        distance: 1.5, // Default reasonable distance in miles
        duration: 180  // Default 3 minutes in seconds
      };
    }
    
    // Fallback to Haversine calculation
    const straightLineDistance = calculateStraightLineDistance(origin, destination);
    const estimatedDrivingDistance = straightLineDistance * 1.3; // Approximate driving distance
    const durationInSeconds = estimatedDrivingDistance * 120; // 2 minutes per mile
    
    console.log(`Using calculated fallback: ${estimatedDrivingDistance.toFixed(2)} miles, ${durationInSeconds / 60} minutes`);
    
    return {
      distance: estimatedDrivingDistance,
      duration: durationInSeconds
    };
  }
};

/**
 * Calculate straight-line distance between two points using the Haversine formula
 * This is a fallback for when the API call fails
 * 
 * @param origin Starting coordinates
 * @param destination Ending coordinates
 * @returns Distance in miles
 */
export const calculateStraightLineDistance = (
  origin: Coordinates,
  destination: Coordinates
): number => {
  const R = 3958.8; // Earth's radius in miles
  
  // Convert latitude and longitude from degrees to radians
  const lat1 = origin.latitude * Math.PI / 180;
  const lon1 = origin.longitude * Math.PI / 180;
  const lat2 = destination.latitude * Math.PI / 180;
  const lon2 = destination.longitude * Math.PI / 180;
  
  // Haversine formula
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

/**
 * Get the user's current location
 * Uses geolocation API if available, otherwise returns default location
 * 
 * @returns Promise with the user's coordinates
 */
export const getUserLocation = (): Promise<Coordinates> => {
  return new Promise((resolve) => {
    // For now, always return the default location
    resolve(DEFAULT_USER_LOCATION);
    
    // Later, this can be updated to use browser geolocation:
    /*
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => {
          resolve(DEFAULT_USER_LOCATION);
        }
      );
    } else {
      resolve(DEFAULT_USER_LOCATION);
    }
    */
  });
};

/**
 * Calculate distance for a food item from the user's location
 * 
 * @param foodItem The food item to calculate distance for
 * @param userLocation Optional user coordinates (will use default if not provided)
 * @returns Promise with the food item and its distance from the user
 */
export const calculateFoodItemDistance = async (
  foodItem: FoodItem, 
  userLocation?: Coordinates
): Promise<FoodItem & { distanceFromUser?: number; estimatedDuration?: number }> => {
  // If foodItem has no coordinates, return it as is without distance calculation
  if (!foodItem.coordinates) {
    console.log(`Skipping distance calculation for ${foodItem.name} - no coordinates available`);
    return foodItem;
  }
  
  // Check if food item has valid coordinates
  if (!foodItem.coordinates.latitude || 
      !foodItem.coordinates.longitude ||
      isNaN(foodItem.coordinates.latitude) ||
      isNaN(foodItem.coordinates.longitude)) {
    console.log(`Item ${foodItem.name} has invalid coordinates:`, foodItem.coordinates);
    
    // Return item without distance info since coordinates are invalid
    return foodItem;
  }
  
  // Get user location if not provided
  const userCoords = userLocation || await getUserLocation();
  
  // Calculate distance
  try {
    // Log the coordinates being used
    console.log(`Calculating distance from ${userCoords.latitude},${userCoords.longitude} to ${foodItem.coordinates.latitude},${foodItem.coordinates.longitude} for ${foodItem.name}`);
    
    const { distance, duration } = await calculateDistance(
      userCoords, 
      foodItem.coordinates
    );
    
    return {
      ...foodItem,
      distanceFromUser: distance,
      estimatedDuration: duration
    };
  } catch (error) {
    console.error(`Failed to calculate distance for ${foodItem.name}:`, error);
    return foodItem;
  }
};

/**
 * Calculate distances for a batch of food items
 * This implementation supports progressive loading by returning items immediately
 * while continuing to calculate distances in the background
 * 
 * @param foodItems Array of food items
 * @returns Promise with food items including distance information
 */
export const calculateBatchDistances = async (
  foodItems: FoodItem[]
): Promise<(FoodItem & { distanceFromUser?: number; estimatedDuration?: number })[]> => {
  // TEMPORARILY DISABLED REAL API CALLS
  // Instead, assign random distances between 0.5 and 5 miles
  
  console.log('Using mock distance data to reduce API calls and lag');
  
  // Generate mock distance and duration for all items
  return foodItems.map(item => {
    // Generate random distance between 0.5 and 5 miles
    const randomDistance = 0.5 + Math.random() * 4.5;
    // Estimate duration (2 minutes per mile)
    const randomDuration = randomDistance * 120;
    
    return {
      ...item,
      distanceFromUser: parseFloat(randomDistance.toFixed(2)),
      estimatedDuration: parseInt(randomDuration.toFixed(0))
    };
  });

  /* ORIGINAL CODE - TEMPORARILY COMMENTED OUT
  const userLocation = await getUserLocation();
  console.log(`Using user location: ${userLocation.latitude}, ${userLocation.longitude}`);
  
  // Create a copy of the food items that we'll update as distances are calculated
  const results = [...foodItems];
  
  // Track items that need distance calculation
  const itemsNeedingDistance = foodItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.coordinates && 
      item.coordinates.latitude && 
      item.coordinates.longitude && 
      !isNaN(item.coordinates.latitude) && 
      !isNaN(item.coordinates.longitude));
  
  console.log(`Starting progressive distance calculation for ${itemsNeedingDistance.length} items with coordinates`);
  
  // Start calculating distances in the background but don't wait for completion
  (async () => {
    // Process items in batches to avoid overwhelming the API
    const batchSize = 5; // Smaller batch size to avoid rate limits
    
    for (let i = 0; i < itemsNeedingDistance.length; i += batchSize) {
      const batch = itemsNeedingDistance.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(itemsNeedingDistance.length/batchSize)}`);
      
      // Process batch in parallel but with individual error handling
      const batchPromises = batch.map(async ({ item, index }) => {
        try {
          const itemWithDistance = await calculateFoodItemDistance(item, userLocation);
          
          // Update the results array with the distance information
          if (itemWithDistance.distanceFromUser !== undefined) {
            results[index] = itemWithDistance;
          }
          
          return itemWithDistance;
        } catch (error) {
          console.error(`Failed to process item ${item.name}:`, error);
          return item;
        }
      });
      
      await Promise.all(batchPromises);
      
      // Add a short delay between batches to avoid rate limiting
      if (i + batchSize < itemsNeedingDistance.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay
      }
    }
    
    // Count how many items have distance info
    const itemsWithDistance = results.filter(item => item.distanceFromUser !== undefined).length;
    console.log(`Successfully calculated distances for ${itemsWithDistance} out of ${foodItems.length} items`);
  })();
  
  // Return results immediately - they will be updated in the background
  return results;
  */
}; 