import { FoodItem, DisplayableFoodItem } from '../types/food';
import { SupabaseMenuItem } from '../types/supabase';

// Google API key
const GOOGLE_API_KEY = 'AIzaSyBaaoBruSs1Wl0YbmXqErLl6w8ZiepPdwk';

// Default user location (Westwood, LA)
export const DEFAULT_USER_LOCATION = {
  latitude: 34.04053500,
  longitude: -118.44994500
};

// Chewzee Service Area Definition
const SERVICE_AREA_CENTER: Coordinates = DEFAULT_USER_LOCATION; // Centered around Westwood
const SERVICE_AREA_RADIUS_MILES = 5; // 5-mile radius

// Interface for location coordinates
export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface RouteInfo {
  distanceMeters: number;
  duration: number;
  status: {
    code: number;
    message: string;
  };
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
    
    // console.log(`Making Routes API request from ${origin.latitude},${origin.longitude} to ${destination.latitude},${destination.longitude}`);
    
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
      // console.warn(`API request failed with status ${response.status}. Falling back to calculation.`);
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
      
      //console.log(`Routes API success: ${distanceInMiles.toFixed(2)} miles, ${durationInSeconds} seconds`);
      
      return {
        distance: distanceInMiles,
        duration: durationInSeconds
      };
    }
    
    // console.warn(`Routes API failed: No routes returned. Falling back to calculation.`);
    throw new Error(`Routes API failed: No routes returned`);
  } catch (error) {
    // console.error('Error with Routes API:', error);
    
    // Ensure we have valid coordinates before calculating fallback
    if (isNaN(origin.latitude) || isNaN(origin.longitude) || 
        isNaN(destination.latitude) || isNaN(destination.longitude)) {
      // console.warn('Invalid coordinates for fallback calculation, using default distance');
      return {
        distance: 1.5, // Default reasonable distance in miles
        duration: 180  // Default 3 minutes in seconds
      };
    }
    
    // Fallback to Haversine calculation
    const straightLineDistance = calculateStraightLineDistance(origin, destination);
    const estimatedDrivingDistance = straightLineDistance * 1.3; // Approximate driving distance
    const durationInSeconds = estimatedDrivingDistance * 120; // 2 minutes per mile
    
    // console.log(`Using calculated fallback: ${estimatedDrivingDistance.toFixed(2)} miles, ${durationInSeconds / 60} minutes`);
    
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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // console.log('User location obtained:', position.coords);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          // console.warn('Error getting user location or permission denied. Falling back to default. Error:', error);
          resolve(DEFAULT_USER_LOCATION); // Fallback to default if permission denied or error
        }
      );
    } else {
      // console.warn('Geolocation is not supported by this browser. Falling back to default.');
      resolve(DEFAULT_USER_LOCATION); // Fallback to default if geolocation not supported
    }
  });
};

/**
 * Check if a given location is within the defined service area.
 *
 * @param userLocation The user's current coordinates.
 * @returns True if within service area, false otherwise.
 */
export const isWithinServiceArea = (userLocation: Coordinates): boolean => {
  if (!userLocation || typeof userLocation.latitude !== 'number' || typeof userLocation.longitude !== 'number') {
    // console.warn('isWithinServiceArea: Invalid userLocation provided.', userLocation);
    return false; // Or handle as out of service area by default
  }
  const distance = calculateStraightLineDistance(SERVICE_AREA_CENTER, userLocation);
  // console.log(`Distance from service center: ${distance.toFixed(2)} miles. Service radius: ${SERVICE_AREA_RADIUS_MILES} miles.`);
  return distance <= SERVICE_AREA_RADIUS_MILES;
};

/**
 * Calculate distance for a food item from the user's location
 * 
 * @param foodItem The food item to calculate distance for
 * @param userLocation Optional user coordinates (will use default if not provided)
 * @returns Promise with the food item and its distance from the user
 */
export const calculateFoodItemDistance = async (
  foodItem: SupabaseMenuItem,
  userLocation: Coordinates
): Promise<DisplayableFoodItem> => {
  
  let itemLat: number | undefined | null = foodItem.latitude; // Directly from SupabaseMenuItem
  let itemLng: number | undefined | null = foodItem.longitude; // Directly from SupabaseMenuItem

  if (itemLat === undefined || itemLng === undefined || itemLat === null || itemLng === null || isNaN(itemLat) || isNaN(itemLng)) {
    // console.log(`Skipping distance calculation for ${foodItem.menu_item || foodItem.id} - no valid coordinates found on SupabaseMenuItem (lat: ${itemLat}, lng: ${itemLng}).`);
    return foodItem as DisplayableFoodItem; 
  }

  const itemCoordinates = { latitude: itemLat, longitude: itemLng };
  const userCoords = userLocation;
  
  try {
    //console.log(`Calculating distance from ${userCoords.latitude},${userCoords.longitude} to ${itemCoordinates.latitude},${itemCoordinates.longitude} for ${foodItem.menu_item || foodItem.id}`);
    
    const { distance, duration } = await calculateDistance(
      userCoords, 
      itemCoordinates
    );
    
    return {
      ...foodItem,
      distanceFromUser: distance,
      estimatedDuration: duration
    };
  } catch (error) {
    // console.error(`Failed to calculate distance for ${foodItem.menu_item || foodItem.id}:`, error);
    return foodItem as DisplayableFoodItem; // Return original item on error
  }
};

/**
 * Calculate distances for a batch of food items
 * @param foodItems Array of SupabaseMenuItem
 * @param userLocation The user's current coordinates
 * @returns Promise with DisplayableFoodItem array including distance information
 */
export async function calculateBatchDistances(
  items: SupabaseMenuItem[], 
  userLocation: Coordinates
): Promise<DisplayableFoodItem[]> {
  const itemsWithCoords = items.filter(item => item.latitude && item.longitude);
  const origin = `${userLocation.latitude},${userLocation.longitude}`;
  const MAX_WAYPOINTS = 25; // Max waypoints per request (excluding origin and destination)
  let processedIndex = 0;
  const results: DisplayableFoodItem[] = [];

  while (processedIndex < itemsWithCoords.length) {
    const batch = itemsWithCoords.slice(processedIndex, processedIndex + MAX_WAYPOINTS);
    // console.log(`Processing batch ${Math.floor(processedIndex / MAX_WAYPOINTS) + 1} of ${Math.ceil(itemsWithCoords.length / MAX_WAYPOINTS)}`);

    const waypoints = batch.map(item => `${item.latitude},${item.longitude}`);
    
    try {
      const routesData = await fetchRouteMatrix(origin, waypoints);
      
      batch.forEach((item, index) => {
        const routeInfo = routesData[index]; // Assuming routesData is an array corresponding to waypoints
        if (routeInfo && routeInfo.status.code === 0) { // OK status
          results.push({
            ...item,
            distanceFromUser: routeInfo.distanceMeters,
            estimatedDuration: routeInfo.duration,
          });
        } else {
          // console.warn(`Could not fetch route for item ${item.id}: ${routeInfo?.status?.message || 'Unknown error'}`);
          results.push({ ...item, distanceFromUser: undefined, estimatedDuration: undefined });
        }
      });
    } catch (error) {
      // console.error('Error fetching route matrix for batch:', error);
      // For items in this failed batch, add them without distance/duration
      batch.forEach(item => {
        results.push({ ...item, distanceFromUser: undefined, estimatedDuration: undefined });
      });
    }
    processedIndex += MAX_WAYPOINTS;
  }
  
  // Add back items that had no coords, without distance info
  items.forEach(item => {
    if (!item.latitude || !item.longitude) {
      results.push({ ...item, distanceFromUser: undefined, estimatedDuration: undefined });
    }
  });

  return results;
}

async function fetchRouteDetails(origin: string, destination: string): Promise<RouteInfo | null> {
  // console.log(`Calculating distance from ${origin} to ${destination} for ${destination}`);
  const API_KEY = process.env.EXPO_PUBLIC_ROUTES_API_KEY;
  if (!API_KEY) {
    // console.error('ROUTES API key is not set.');
    return null;
  }

  const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': API_KEY,
    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.steps.localized_values'
  };
  const body = JSON.stringify({
    origin: { location: { latLng: { latitude: parseFloat(origin.split(',')[0]), longitude: parseFloat(origin.split(',')[1]) } } },
    destination: { location: { latLng: { latitude: parseFloat(destination.split(',')[0]), longitude: parseFloat(destination.split(',')[1]) } } },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false,
    },
    languageCode: 'en-US',
    units: 'IMPERIAL'
  });

  try {
    // console.log(`Making Routes API request from ${origin} to ${destination}`);
    const response = await fetch(url, { method: 'POST', headers, body });
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const { distanceMeters, duration } = data.routes[0];
      // console.log(`Routes API success: ${(distanceMeters * 0.000621371).toFixed(2)} miles, ${parseInt(duration)} seconds`);
      return {
        distanceMeters: distanceMeters,
        duration: parseInt(duration.slice(0, -1)), // Remove 's' from duration and parse
        status: { code: 0, message: 'OK'} // Assuming OK if we get data
      };
    } else {
      // console.warn('Routes API did not return routes:', data);
      return { distanceMeters: 0, duration: 0, status: {code: data.error?.code || -1, message: data.error?.message || 'No routes found'}};
    }
  } catch (error) {
    // console.error('Routes API request failed:', error);
    return { distanceMeters: 0, duration: 0, status: {code: -1, message: (error as Error).message || 'Request failed'}};
  }
}

// New function for Batch Route Matrix
async function fetchRouteMatrix(originCoords: string, waypointCoords: string[]): Promise<RouteInfo[]> {
  const API_KEY = process.env.EXPO_PUBLIC_ROUTES_API_KEY;
  if (!API_KEY) {
    // console.error('ROUTES API key is not set for Matrix API.');
    return waypointCoords.map(() => ({ distanceMeters: 0, duration: 0, status: { code: -1, message: 'API Key not set' } }));
  }

  const url = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': API_KEY,
    'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status'
  };

  const origins = [{ waypoint: { location: { latLng: { latitude: parseFloat(originCoords.split(',')[0]), longitude: parseFloat(originCoords.split(',')[1]) } } } }];
  const destinations = waypointCoords.map(coords => ({ waypoint: { location: { latLng: { latitude: parseFloat(coords.split(',')[0]), longitude: parseFloat(coords.split(',')[1]) } } } }));

  const body = JSON.stringify({
    origins: origins,
    destinations: destinations,
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE' 
  });

  try {
    // console.log(`Batch request to Routes API with ${waypointCoords.length} waypoints.`);
    const response = await fetch(url, { method: 'POST', headers, body });
    const responseData = await response.json();

    if (Array.isArray(responseData)) {
      // console.log('Routes API Matrix success:', responseData.length, 'routes processed.');
      return responseData.map(item => ({
        distanceMeters: item.distanceMeters || 0,
        duration: item.duration ? parseInt(item.duration.slice(0, -1)) : 0,
        status: item.status || { code: -1, message: 'Unknown error in matrix response' }
      }));
    } else {
      // console.warn('Routes API Matrix did not return array:', responseData);
      return waypointCoords.map(() => ({ distanceMeters: 0, duration: 0, status: { code: -1, message: 'Invalid matrix response format' } }));
    }
  } catch (error) {
    // console.error('Routes API Matrix request failed:', error);
    return waypointCoords.map(() => ({ distanceMeters: 0, duration: 0, status: { code: -1, message: (error as Error).message || 'Matrix request failed' } }));
  }
} 