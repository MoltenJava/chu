import { Database } from './database';

export type Tables = Database['public']['Tables'];
export type MenuItem = Tables['menu_items']['Row'];
export type Restaurant = Tables['restaurants']['Row'];

export interface SupabaseMenuItem extends MenuItem {
  // Add restaurant fields
  restaurant?: Restaurant | string;
  
  // Additional fields for menu items
  _id: string; // Same as id
  _createdAt: string; // Same as created_at
  menu_item: string; // Same as name
  title: string; // Restaurant name
  s3_url: string; // Image URL
  food_type?: string;
  cuisine?: string;
  distance_from_user?: number;
  estimated_duration?: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  uber_eats_url?: string;
  doordash_url?: string;
  postmates_url?: string;
  price_level: string;
}

export function convertToSupabaseMenuItem(
  menuItem: MenuItem,
  restaurant?: Restaurant
): SupabaseMenuItem {
  // Add debug logging to help troubleshoot
  console.log(`Converting menu item: ${menuItem.name}, Restaurant:`, restaurant);
  
  return {
    ...menuItem,
    restaurant,
    _id: menuItem.id,
    _createdAt: menuItem.created_at,
    menu_item: menuItem.name,
    title: restaurant?.name || 'Unknown Restaurant',
    s3_url: menuItem.s3_url || '',
    food_type: menuItem.category || '',
    address: restaurant?.address || '',
    latitude: restaurant?.latitude || 0,
    longitude: restaurant?.longitude || 0,
    distance_from_user: 0,
    estimated_duration: 0,
    price_level: restaurant?.price_range || '$$'
  };
} 
