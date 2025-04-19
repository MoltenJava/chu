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
        
        // Log the first item to debug restaurant data
        if (data && data.length > 0) {
          console.log('First food item with restaurant data:', {
            id: data[0].id,
            name: data[0].name,
            restaurant: data[0].restaurant
          });
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