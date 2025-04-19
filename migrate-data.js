// migrate-data.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
  try {
    // Read the JSON file
    const jsonData = JSON.parse(
      await fs.readFile('/Users/aryashapouri/Downloads/meta_address_price_updated.json', 'utf8')
    );

    // Create a map to store unique restaurants
    const restaurants = new Map();

    // Extract unique restaurants from the data
    Object.values(jsonData).forEach((item) => {
      if (!restaurants.has(item.title)) {
        restaurants.set(item.title, {
          name: item.title,
          address: item.address,        // Now including address
          latitude: item.latitude,      // Now including latitude
          longitude: item.longitude     // Now including longitude
        });
      }
    });

    // Insert restaurants first
    console.log('Inserting restaurants...');
    const { data: restaurantData, error: restaurantError } = await supabase
      .from('restaurants')
      .insert([...restaurants.values()])
      .select();

    if (restaurantError) {
      throw new Error(`Error inserting restaurants: ${restaurantError.message}`);
    }

    // Create a map of restaurant names to their IDs
    const restaurantIds = new Map(
      restaurantData.map(restaurant => [restaurant.name, restaurant.id])
    );

    // Prepare menu items
    const menuItems = Object.entries(jsonData).map(([_, item]) => ({
      restaurant_id: restaurantIds.get(item.title),
      name: item.menu_item,
      s3_url: item.s3_url,
      postmates_url: item.postmates_url,
      doordash_url: item.doordash_url,
      uber_eats_url: item.uber_eats_url,
      price: item.price,              // Now including price
      price_level: item.price_level,  // Now including price_level
      spiciness: item.spiciness,
      sweet_savory: item.sweet_savory,
      safe_adventurous: item.safe_adventurous,
      healthy_indulgent: item.healthy_indulgent
    }));

    // Insert menu items
    console.log('Inserting menu items...');
    const { error: menuItemError } = await supabase
      .from('menu_items')
      .insert(menuItems);

    if (menuItemError) {
      throw new Error(`Error inserting menu items: ${menuItemError.message}`);
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateData();