import { createClient } from '@sanity/client';
import { SanityMenuItem } from '@/types/sanity';

// Debug Sanity configuration
console.log('Sanity Config:', {
  projectId: process.env.EXPO_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.EXPO_PUBLIC_SANITY_DATASET
});

export const client = createClient({
  projectId: process.env.EXPO_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.EXPO_PUBLIC_SANITY_DATASET!,
  useCdn: true,
  apiVersion: '2024-03-19',
});

// Helper functions for common queries
export async function getMenuItems() {
  console.log('Fetching all menu items from Sanity...');
  const items = await client.fetch<SanityMenuItem[]>(`
    *[_type == "menuItem"] {
      _id,
      _createdAt,
      title,
      menu_item,
      s3_url,
      postmates_url,
      doordash_url,
      uber_eats_url,
      address,
      latitude,
      longitude,
      price,
      price_level
    }
  `);
  console.log('Fetched menu items:', {
    count: items.length,
    sampleItem: items[0]
  });
  return items;
}

export async function getMenuItem(id: string) {
  return client.fetch<SanityMenuItem>(`
    *[_type == "menuItem" && _id == $id][0] {
      _id,
      _createdAt,
      title,
      menu_item,
      s3_url,
      postmates_url,
      doordash_url,
      uber_eats_url,
      address,
      latitude,
      longitude,
      price,
      price_level
    }
  `, { id });
}

// Get menu items within a certain radius (in kilometers)
export async function getNearbyMenuItems(lat: number, lng: number, radiusKm: number = 5) {
  console.log('Fetching nearby menu items:', { lat, lng, radiusKm });
  
  // Convert radius to degrees (approximate)
  const radiusDegrees = radiusKm / 111;

  const items = await client.fetch<SanityMenuItem[]>(`
    *[_type == "menuItem" && 
      latitude >= ${lat - radiusDegrees} &&
      latitude <= ${lat + radiusDegrees} &&
      longitude >= ${lng - radiusDegrees} &&
      longitude <= ${lng + radiusDegrees}
    ] {
      _id,
      _createdAt,
      title,
      menu_item,
      s3_url,
      postmates_url,
      doordash_url,
      uber_eats_url,
      address,
      latitude,
      longitude,
      price,
      price_level
    }
  `);

  console.log('Fetched nearby items:', {
    count: items.length,
    sampleItem: items[0]
  });

  return items;
}

// Get all menu items for a specific restaurant
export async function getRestaurantMenuItems(restaurantTitle: string) {
  console.log('Fetching menu items for restaurant:', restaurantTitle);
  
  const items = await client.fetch<SanityMenuItem[]>(`
    *[_type == "menuItem" && title == $restaurantTitle] {
      _id,
      _createdAt,
      title,
      menu_item,
      s3_url,
      postmates_url,
      doordash_url,
      uber_eats_url,
      address,
      latitude,
      longitude,
      price,
      price_level
    }
  `, { restaurantTitle });

  console.log('Fetched restaurant items:', {
    count: items.length,
    restaurant: restaurantTitle,
    sampleItem: items[0]
  });

  return items;
} 