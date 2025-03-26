import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import { SanityMenuItem, SanityImage } from '@/types/sanity';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const client = createClient({
  projectId: process.env.EXPO_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.EXPO_PUBLIC_SANITY_DATASET!,
  useCdn: true,
  apiVersion: '2024-03-19',
});

// Set up the image URL builder
const imageBuilder = imageUrlBuilder(client);

// Helper function to generate optimized image URLs
export function urlFor(source: SanityImage, options?: {
  width?: number;
  height?: number;
  quality?: number;
}) {
  const builder = imageBuilder.image(source);

  // Default to screen width if no width specified
  const width = options?.width || SCREEN_WIDTH;
  
  return builder
    .auto('format') // Automatically choose best format (webp/jpeg)
    .width(Math.round(width))
    .quality(options?.quality || 80) // Good balance of quality and size
    .fit('max') // Maintain aspect ratio
    .url();
}

// Helper functions for common queries
export async function getMenuItems() {
  return client.fetch<SanityMenuItem[]>(`
    *[_type == "menuItem"] {
      _id,
      _createdAt,
      title,
      menu_item,
      image {
        asset-> {
          _ref,
          url
        }
      },
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
}

export async function getMenuItem(id: string) {
  return client.fetch<SanityMenuItem>(`
    *[_type == "menuItem" && _id == $id][0] {
      _id,
      _createdAt,
      title,
      menu_item,
      image {
        asset-> {
          _ref,
          url
        }
      },
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
  // Convert radius to degrees (approximate)
  const radiusDegrees = radiusKm / 111;

  return client.fetch<SanityMenuItem[]>(`
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
      image {
        asset-> {
          _ref,
          url
        }
      },
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
} 