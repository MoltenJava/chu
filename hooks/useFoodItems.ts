import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SupabaseMenuItem } from '../types/supabase';

export function useFoodItems() {
  const [foodItems, setFoodItems] = useState<SupabaseMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchFoodItems() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('menu_items')
          .select(`
            *,
            restaurant:restaurant_id (
              id,
              name,
              address,
              latitude,
              longitude,
              created_at,
              updated_at,
              place_id
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Enhanced logging to see the raw data structure
        if (data && data.length > 0) {
          console.log('[FOOD-ITEMS] Raw first item:', JSON.stringify(data[0], null, 2));
          console.log('[FOOD-ITEMS] Restaurant field:', data[0].restaurant);
          console.log('[FOOD-ITEMS] Restaurant_id field:', data[0].restaurant_id);
          
          // Check if we're getting the wrong field
          if (data[0].restaurant === null && data[0].restaurant_id) {
            console.log('[FOOD-ITEMS] WARNING: restaurant is null but restaurant_id exists:', data[0].restaurant_id);
          }
          
          // Transform the data to fix the restaurant field if needed
          const transformedData = data.map(item => {
            // If restaurant is null but restaurant_id is a string, it might be a name
            if (item.restaurant === null && typeof item.restaurant_id === 'string') {
              console.log(`[FOOD-ITEMS] Fixing item ${item.id}: Setting title from restaurant_id`);
              return {
                ...item,
                title: item.title || 'Restaurant Name', // Use existing title or fallback
                restaurant: item.restaurant_id // Keep the original restaurant_id
              };
            }
            // If restaurant is an object, make sure we set title from restaurant.name
            else if (item.restaurant && typeof item.restaurant === 'object') {
              return {
                ...item,
                title: item.restaurant.name || item.title || 'Unknown Restaurant'
              };
            }
            return item;
          });
          
          setFoodItems(transformedData as SupabaseMenuItem[]);
          return;
        }
        
        setFoodItems(data as SupabaseMenuItem[]);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching food items:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFoodItems();
  }, []);

  return { foodItems, isLoading, error };
} 