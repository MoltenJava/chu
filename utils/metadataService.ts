import { FoodItem, FoodType } from '../types/food';

// The base URL for your AWS S3 bucket
const S3_BASE_URL = 'https://test-westwood.s3.us-west-1.amazonaws.com';
// Path to the metadata file in your S3 bucket
const METADATA_URL = 'https://test-westwood.s3.us-west-1.amazonaws.com/westwood_restaurant_metadata.json';

// Interface for the raw metadata from the JSON file - updated to match actual format
interface RestaurantMetadataItem {
  title: string;
  menu_item: string;
  s3_url: string;
  postmates_url: string | null;
  doordash_url: string | null;
  uber_eats_url: string | null;
}

// Interface for the entire metadata object
interface RestaurantMetadata {
  [imagePath: string]: RestaurantMetadataItem;
}

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
 * Converts price level from the metadata (e.g., "1", "2", "3") to display format ("$", "$$", "$$$")
 */
const formatPriceLevel = (priceLevel: string): string => {
  const level = parseInt(priceLevel, 10);
  if (isNaN(level)) return priceLevel; // Return as-is if not a number
  return '$'.repeat(level);
};

/**
 * Maps food type strings from metadata to FoodType enum values
 */
const mapFoodTypes = (types: string[]): FoodType[] => {
  const validFoodTypes: FoodType[] = [];
  
  types.forEach(type => {
    const lowerType = type.toLowerCase();
    // Map to our app's FoodType enum values
    switch (lowerType) {
      case 'spicy':
      case 'vegan':
      case 'dessert':
      case 'healthy':
      case 'breakfast':
      case 'lunch':
      case 'dinner':
      case 'comfort':
      case 'seafood':
      case 'fast-food':
        validFoodTypes.push(lowerType as FoodType);
        break;
      // Add mappings for other types as needed
      default:
        // Skip unknown types
        console.log(`Unknown food type: ${type}`);
        break;
    }
  });
  
  return validFoodTypes;
};

/**
 * Infer food types based on menu item name and restaurant
 */
const inferFoodTypes = (menuItem: string, restaurant: string): FoodType[] => {
  const itemLower = menuItem.toLowerCase();
  const restaurantLower = restaurant.toLowerCase();
  const types: FoodType[] = [];
  
  // Infer meal type
  if (itemLower.includes('breakfast') || 
      itemLower.includes('egg') || 
      itemLower.includes('scrambler')) {
    types.push('breakfast');
  }
  
  if (itemLower.includes('sandwich') || 
      itemLower.includes('burger') || 
      itemLower.includes('panini')) {
    types.push('lunch');
  }
  
  if (itemLower.includes('platter') || 
      itemLower.includes('ramen') || 
      restaurantLower.includes('grill')) {
    types.push('dinner');
  }
  
  // Infer food characteristics
  if (itemLower.includes('spicy') || 
      itemLower.includes('kimchi')) {
    types.push('spicy');
  }
  
  if (itemLower.includes('salad') || 
      itemLower.includes('vegan')) {
    types.push('healthy');
  }
  
  if (itemLower.includes('cake') || 
      itemLower.includes('sweet')) {
    types.push('dessert');
  }
  
  if (restaurantLower.includes('mexican') || 
      itemLower.includes('burrito') || 
      itemLower.includes('taco')) {
    types.push('comfort');
  }
  
  if (itemLower.includes('fish') || 
      itemLower.includes('sushi') || 
      restaurantLower.includes('seafood')) {
    types.push('seafood');
  }
  
  // If no types were inferred, add a default
  if (types.length === 0) {
    types.push('comfort');
  }
  
  return types;
};

/**
 * Converts a metadata item to our app's FoodItem format
 */
const convertToFoodItem = (imagePath: string, item: RestaurantMetadataItem, index: number): FoodItem => {
  // Extract delivery services
  const deliveryServices: string[] = [];
  const deliveryUrls: { uberEats?: string; postmates?: string; doorDash?: string } = {};
  
  // Simplify the checks to ensure we capture all delivery options
  // Check for Uber Eats URL
  if (item.uber_eats_url && item.uber_eats_url !== 'null' && item.uber_eats_url !== 'NaN') {
    deliveryServices.push('UberEats');
    deliveryUrls.uberEats = item.uber_eats_url;
  }
  
  // Check for Postmates URL
  if (item.postmates_url && item.postmates_url !== 'null' && item.postmates_url !== 'NaN') {
    deliveryServices.push('Postmates');
    deliveryUrls.postmates = item.postmates_url;
  }
  
  // Check for DoorDash URL
  if (item.doordash_url && item.doordash_url !== 'null' && item.doordash_url !== 'NaN') {
    deliveryServices.push('DoorDash');
    deliveryUrls.doorDash = item.doordash_url;
  }
  
  // ALWAYS add default delivery services for all items
  // This ensures every food item has at least one delivery option
  if (!deliveryServices.includes('UberEats')) {
    deliveryServices.push('UberEats');
    deliveryUrls.uberEats = 'https://www.ubereats.com';
  }
  
  if (!deliveryServices.includes('Postmates')) {
    deliveryServices.push('Postmates');
    deliveryUrls.postmates = 'https://www.postmates.com';
  }
  
  if (!deliveryServices.includes('DoorDash')) {
    deliveryServices.push('DoorDash');
    deliveryUrls.doorDash = 'https://www.doordash.com';
  }
  
  // Infer food types based on menu item name and restaurant
  const foodTypes = inferFoodTypes(item.menu_item, item.title);
  
  // Generate a description
  const description = `${item.menu_item} from ${item.title}. A delicious choice for your next meal!`;
  
  return {
    id: `${index + 1}`,
    name: item.menu_item,
    description: description,
    imageUrl: item.s3_url || `${S3_BASE_URL}${imagePath}`,
    restaurant: item.title,
    price: '$$', // Default price level since it's not in the metadata
    cuisine: 'Various', // Default cuisine since it's not in the metadata
    foodType: foodTypes,
    deliveryServices: deliveryServices,
    deliveryUrls: deliveryUrls
  };
};

/**
 * Fetches the restaurant metadata from S3 and converts it to FoodItem format
 */
export const fetchRestaurantMetadata = async (): Promise<FoodItem[]> => {
  try {
    console.log('Fetching metadata from:', METADATA_URL);
    
    const response = await fetch(METADATA_URL);
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text(); // Get raw text first
    console.log('Response text (first 100 chars):', text.substring(0, 100));
    
    try {
      // Replace NaN with null to make it valid JSON
      const validJsonText = text.replace(/NaN/g, 'null');
      const data = JSON.parse(validJsonText) as RestaurantMetadata;
      
      // Convert the object to an array of FoodItems
      const foodItems: FoodItem[] = [];
      let index = 0;
      
      for (const imagePath in data) {
        if (Object.prototype.hasOwnProperty.call(data, imagePath)) {
          const item = data[imagePath];
          
          // Skip items with missing required fields
          if (!item.title || !item.menu_item) {
            console.log(`Skipping item with missing required fields: ${imagePath}`);
            continue;
          }
          
          foodItems.push(convertToFoodItem(imagePath, item, index));
          index++;
        }
      }
      
      // Shuffle the array to randomize the order
      const shuffledItems = shuffleArray(foodItems);
      
      console.log(`Converted and randomized ${shuffledItems.length} items from metadata`);
      return shuffledItems;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw response text:', text);
      throw parseError;
    }
  } catch (error) {
    console.error('Error fetching restaurant metadata:', error);
    return [];
  }
};

/**
 * Fetches the restaurant metadata from a local file (for development/testing)
 * @param localPath Path to the local metadata file
 */
export const loadLocalMetadata = async (localPath: string): Promise<FoodItem[]> => {
  try {
    // In a real app, you'd use the file system API to read the local file
    // For now, we'll simulate this with a fetch to the file
    const response = await fetch(localPath);
    
    if (!response.ok) {
      throw new Error(`Failed to load local metadata: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    
    // Replace NaN with null to make it valid JSON
    const validJsonText = text.replace(/NaN/g, 'null');
    const data = JSON.parse(validJsonText) as RestaurantMetadata;
    
    // Convert the object to an array of FoodItems
    const foodItems: FoodItem[] = [];
    let index = 0;
    
    for (const imagePath in data) {
      if (Object.prototype.hasOwnProperty.call(data, imagePath)) {
        const item = data[imagePath];
        
        // Skip items with missing required fields
        if (!item.title || !item.menu_item) {
          console.log(`Skipping item with missing required fields: ${imagePath}`);
          continue;
        }
        
        foodItems.push(convertToFoodItem(imagePath, item, index));
        index++;
      }
    }
    
    // Shuffle the array to randomize the order
    const shuffledItems = shuffleArray(foodItems);
    
    return shuffledItems;
  } catch (error) {
    console.error('Error loading local metadata:', error);
    return [];
  }
}; 