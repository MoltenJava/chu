import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserSavedItem } from '@/types/database';
import { SupabaseMenuItem, convertToSupabaseMenuItem } from '@/types/supabase';

export interface SavedItemWithDetails extends UserSavedItem {
  menuItem: SupabaseMenuItem;
}

export function useSavedItems() {
  const [savedItems, setSavedItems] = useState<SavedItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: savedItemsData, error: supabaseError } = await supabase
        .from('user_saved_items')
        .select('*')
        .order('saved_at', { ascending: false });

      if (supabaseError) throw supabaseError;

      // Get menu items from Supabase
      const menuItemIds = savedItemsData.map(item => item.menu_item_id);
      
      // Fetch menu items
      const { data: menuItems, error: menuItemsError } = await supabase
        .from('menu_items')
        .select('*')
        .in('id', menuItemIds);
        
      if (menuItemsError) throw menuItemsError;
      
      // Fetch restaurants for these menu items
      const restaurantIds = menuItems?.map(item => item.restaurant_id) || [];
      const { data: restaurants, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('*')
        .in('id', restaurantIds);
        
      if (restaurantsError) throw restaurantsError;
      
      // Create a map of restaurant IDs to restaurant objects
      const restaurantMap = new Map();
      restaurants?.forEach(restaurant => {
        restaurantMap.set(restaurant.id, restaurant);
      });

      // Combine Supabase data
      const combinedData = savedItemsData.map(savedItem => {
        const menuItem = menuItems?.find(item => item.id === savedItem.menu_item_id);
        const restaurant = menuItem ? restaurantMap.get(menuItem.restaurant_id) : undefined;
        
        return {
          ...savedItem,
          menuItem: menuItem ? convertToSupabaseMenuItem(menuItem, restaurant) : null,
        };
      }).filter(item => item.menuItem !== null) as SavedItemWithDetails[];

      setSavedItems(combinedData);
    } catch (err) {
      console.error('Error fetching saved items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch saved items');
    } finally {
      setLoading(false);
    }
  };

  const addSavedItem = async (menuItemId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: insertError } = await supabase
        .from('user_saved_items')
        .insert({
          user_id: user.id,
          menu_item_id: menuItemId,
        });

      if (insertError) throw insertError;

      // Refresh the saved items list
      await fetchSavedItems();
    } catch (err) {
      console.error('Error adding saved item:', err);
      throw err;
    }
  };

  const removeSavedItem = async (menuItemId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: deleteError } = await supabase
        .from('user_saved_items')
        .delete()
        .eq('user_id', user.id)
        .eq('menu_item_id', menuItemId);

      if (deleteError) throw deleteError;

      // Update local state
      setSavedItems(prev => prev.filter(item => item.menu_item_id !== menuItemId));
    } catch (err) {
      console.error('Error removing saved item:', err);
      throw err;
    }
  };

  const updateSavedItem = async (menuItemId: string, updates: Partial<UserSavedItem>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: updateError } = await supabase
        .from('user_saved_items')
        .update(updates)
        .eq('user_id', user.id)
        .eq('menu_item_id', menuItemId);

      if (updateError) throw updateError;

      // Refresh the saved items list
      await fetchSavedItems();
    } catch (err) {
      console.error('Error updating saved item:', err);
      throw err;
    }
  };

  // Fetch saved items on mount
  useEffect(() => {
    fetchSavedItems();
  }, []);

  return {
    savedItems,
    loading,
    error,
    addSavedItem,
    removeSavedItem,
    updateSavedItem,
    refreshSavedItems: fetchSavedItems,
  };
} 