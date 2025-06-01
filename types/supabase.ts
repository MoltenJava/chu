import { Database } from './database';
import * as Sentry from '@sentry/react-native';

export type Tables = Database['public']['Tables'];
export type Views = Database['public']['Views'];
export type MenuItemFromView = Views['menu_items']['Row']; // This is what your view 'public.menu_items' returns
export type Restaurant = Tables['restaurants']['Row'];

// NEW: Interface for the flat structure returned by get_random_menu_items RPC
export interface RpcMenuItemWithRestaurant {
  // Fields from public.menu_items view (match your view and RPC RETURNS TABLE)
  id: string; // Assuming UUID is converted to string by the time it hits JS
  restaurant_id: string | null;
  name: string | null; // Dish name
  description: string | null;
  s3_url: string | null;
  postmates_url: string | null;
  doordash_url: string | null;
  uber_eats_url: string | null;
  price: number | null;
  spiciness: number | null;
  sweet_savory: number | null;
  safe_adventurous: number | null;
  healthy_indulgent: number | null;
  created_at: string | null;
  updated_at: string | null;
  price_level: string | null; // From menu_items view
  cuisines: string[] | null;
  diets_and_styles: string[] | null;
  drinks_and_snacks: string[] | null;
  meal_timing: string[] | null;
  image_index: string | null;
  QualityScore: number | null; // Assuming mixed-case "QualityScore" from view
  aesthetic_score: number | null; // Assuming lowercase, adjust if view has "AestheticScore"
  dish_types: string[] | null;

  // Fields from joined public.restaurants table (match your RPC AS aliases)
  restaurant_name: string | null;
  restaurant_address: string | null;
  restaurant_latitude: number | null;
  restaurant_longitude: number | null;
  // No restaurant_price_range_from_join needed here for SupabaseMenuItem as per our last discussion

  // NEW: Restaurant hours from join (using actual field names)
  sunday_hours: string | null;
  monday_hours: string | null;
  tuesday_hours: string | null;
  wednesday_hours: string | null;
  thursday_hours: string | null;
  friday_hours: string | null;
  saturday_hours: string | null;
}


// SupabaseMenuItem is the clean, final shape used in the app.
export interface SupabaseMenuItem {
  // Core identifier
  id: string; 

  // Essential display properties
  name: string;        // Dish name
  title: string;       // Restaurant name
  s3_url: string;      // Image URL
  
  // Scores
  QualityScore: number | null;
  aesthetic_score: number | null;

  // Details from MenuItemFromView (can be null or empty arrays)
  description: string | null;
  dish_types: string[] | null;
  cuisines: string[] | null;
  spiciness: number | null;
  price: number | null; 
  
  // Details from Restaurant
  address?: string; // Optional because it comes from join
  latitude?: number; // Optional
  longitude?: number; // Optional
  // This specific field was taken from menu_item's price_level as per previous logic
  restaurant_price_level?: string | null; 

  // URLs from MenuItemFromView
  doordash_url: string | null;
  uber_eats_url: string | null;
  postmates_url: string | null;

  // Additional categorizations from MenuItemFromView
  diets_and_styles: string[] | null;
  meal_timing: string[] | null;
  drinks_and_snacks: string[] | null;
  sweet_savory: number | null;
  healthy_indulgent: number | null;
  safe_adventurous: number | null;

  // Timestamps and other IDs
  created_at: string | null; 
  updated_at: string | null;
  restaurant_id: string | null;
  image_index: string | null;

  // App-specific processed or default fields
  _id: string;
  _createdAt: string; 
  menu_item: string; 
  food_type?: string; 
  distance_from_user?: number;
  estimated_duration?: number;
  price_level: string; // Ensure this is always set, e.g. from menu_item's price_level or default

  // NEW: Restaurant hours
  restaurant_sunday_hours?: string | null;
  restaurant_monday_hours?: string | null;
  restaurant_tuesday_hours?: string | null;
  restaurant_wednesday_hours?: string | null;
  restaurant_thursday_hours?: string | null;
  restaurant_friday_hours?: string | null;
  restaurant_saturday_hours?: string | null;
}

export function convertToSupabaseMenuItem(
  // Source is now the flat object from our RPC
  sourceItem: any // Use any to handle both formats flexibly
  // restaurantData argument is no longer the primary source for name/address/lat/lon
): SupabaseMenuItem {
  
  // Add this console.log for debugging
  //console.log('[convertToSupabaseMenuItem] Received sourceItem:', JSON.stringify(sourceItem, null, 2));

  Sentry.addBreadcrumb({
    category: 'conversion',
    message: 'Converting RPC menu item to SupabaseMenuItem',
    data: { 
      itemName: sourceItem.name, 
      itemId: sourceItem.id,
      // Try both field naming conventions
      restaurantNameFromJoin: sourceItem.restaurant_name_from_join || sourceItem.restaurant_name
    },
    level: 'debug'
  });

  const idFallback = `no_id_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const createdAtFallback = new Date().toISOString();
  const nameFallback = 'Unknown Item';
  const s3UrlFallback = '';

  // Get restaurant details - try both field naming conventions
  const restaurantName = sourceItem.restaurant_name_from_join || sourceItem.restaurant_name || 'Unknown Restaurant';
  const restaurantAddress = sourceItem.restaurant_address_from_join || sourceItem.restaurant_address || undefined;
  const restaurantLatitude = sourceItem.restaurant_latitude_from_join || sourceItem.restaurant_latitude || undefined;
  const restaurantLongitude = sourceItem.restaurant_longitude_from_join || sourceItem.restaurant_longitude || undefined;

  // Add this console.log for debugging the determined restaurantName
  //console.log(`[convertToSupabaseMenuItem] Determined restaurantName for ID ${sourceItem.id}:`, restaurantName);
  //console.log(`[convertToSupabaseMenuItem] sourceItem.restaurant_name_from_join was:`, sourceItem.restaurant_name_from_join);

  if (restaurantName === 'Unknown Restaurant' && sourceItem.name) {
     Sentry.captureMessage('Unknown Restaurant in RPC Conversion', {
      level: 'warning',
      tags: { issue: 'unknown_restaurant_for_title_rpc', component: 'convertToSupabaseMenuItem' },
      extra: { sourceItem }
    });
  }
  if (!sourceItem.id) {
    Sentry.captureMessage('RPC Menu Item has null ID during conversion', {
      level: 'error',
      tags: { issue: 'null_menu_item_id_rpc_conversion', component: 'convertToSupabaseMenuItem' },
      extra: { sourceItem }
    });
  }

  let derivedFoodType: string | undefined = undefined;
  if (sourceItem.dish_types && sourceItem.dish_types.length > 0) {
    derivedFoodType = sourceItem.dish_types.filter((dt: any) => dt !== null).join(', ');
  }
  
  // price_level for display comes from the menu item's own price_level
  const finalDisplayPriceLevel = sourceItem.price_level || '$$';

  return {
    // Fields from sourceItem (which includes menu_items view fields)
    id: sourceItem.id ?? idFallback,
    name: sourceItem.name ?? nameFallback, // Dish name
    description: sourceItem.description,
    s3_url: sourceItem.s3_url ?? s3UrlFallback,
    dish_types: sourceItem.dish_types ? sourceItem.dish_types.filter((dt: any) => dt !== null) as string[] : null,
    cuisines: sourceItem.cuisines,
    spiciness: sourceItem.spiciness,
    price: sourceItem.price,
    QualityScore: sourceItem.QualityScore, // Ensure case matches RpcMenuItemWithRestaurant
    aesthetic_score: sourceItem.aesthetic_score, // Ensure case matches
    restaurant_id: sourceItem.restaurant_id,
    doordash_url: sourceItem.doordash_url,
    uber_eats_url: sourceItem.uber_eats_url,
    postmates_url: sourceItem.postmates_url,
    diets_and_styles: sourceItem.diets_and_styles,
    meal_timing: sourceItem.meal_timing,
    drinks_and_snacks: sourceItem.drinks_and_snacks,
    sweet_savory: sourceItem.sweet_savory,
    healthy_indulgent: sourceItem.healthy_indulgent,
    safe_adventurous: sourceItem.safe_adventurous,
    created_at: sourceItem.created_at,
    updated_at: sourceItem.updated_at,
    image_index: sourceItem.image_index,

    // Processed/App-specific fields
    _id: sourceItem.id ?? idFallback,
    _createdAt: sourceItem.created_at ?? createdAtFallback,
    menu_item: sourceItem.name ?? nameFallback, // Dish name for menu_item field
    
    // Restaurant details now directly from the sourceItem (RPC join)
    title: restaurantName,       // Restaurant name
    address: restaurantAddress,
    latitude: restaurantLatitude,
    longitude: restaurantLongitude,
    
    // This uses the menu_item's own price_level as per existing logic for this specific field
    restaurant_price_level: sourceItem.price_level, 

    // Pass through restaurant hours - try both field naming conventions
    restaurant_sunday_hours: sourceItem.restaurant_sunday_hours || sourceItem.sunday_hours,
    restaurant_monday_hours: sourceItem.restaurant_monday_hours || sourceItem.monday_hours,
    restaurant_tuesday_hours: sourceItem.restaurant_tuesday_hours || sourceItem.tuesday_hours,
    restaurant_wednesday_hours: sourceItem.restaurant_wednesday_hours || sourceItem.wednesday_hours,
    restaurant_thursday_hours: sourceItem.restaurant_thursday_hours || sourceItem.thursday_hours,
    restaurant_friday_hours: sourceItem.restaurant_friday_hours || sourceItem.friday_hours,
    restaurant_saturday_hours: sourceItem.restaurant_saturday_hours || sourceItem.saturday_hours,

    food_type: derivedFoodType || '',
    distance_from_user: 0, 
    estimated_duration: 0, 
    price_level: finalDisplayPriceLevel, // The main display price_level
  };
} 
