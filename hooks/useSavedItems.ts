import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserSavedItem } from '@/types/database';
import { client } from '@/lib/sanity';

// This interface will be defined based on your Sanity.io schema
interface SanityMenuItem {
  _id: string;
  name: string;
  description?: string;
  image?: {
    asset: {
      url: string;
    };
  };
  restaurant: {
    name: string;
    location?: {
      address?: string;
    };
  };
  price?: number;
}

export interface SavedItemWithDetails extends UserSavedItem {
  menuItem: SanityMenuItem;
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

      // Get saved items from Supabase
      const { data: savedItemsData, error: supabaseError } = await supabase
        .from('user_saved_items')
        .select('*')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });

      if (supabaseError) throw supabaseError;

      // Get menu items from Sanity
      const sanityIds = savedItemsData.map(item => item.sanity_item_id);
      const menuItems = await client.fetch(`
        *[_type == "menuItem" && _id in $ids]{
          _id,
          name,
          description,
          image {
            asset-> {
              url
            }
          },
          restaurant-> {
            name,
            location {
              address
            }
          },
          price
        }
      `, { ids: sanityIds });

      // Combine Supabase and Sanity data
      const combinedData = savedItemsData.map(savedItem => {
        const menuItem = menuItems.find(item => item._id === savedItem.sanity_item_id);
        return {
          ...savedItem,
          menuItem,
        };
      });

      setSavedItems(combinedData);
    } catch (err) {
      console.error('Error fetching saved items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch saved items');
    } finally {
      setLoading(false);
    }
  };

  const addSavedItem = async (sanityItemId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: insertError } = await supabase
        .from('user_saved_items')
        .insert({
          user_id: user.id,
          sanity_item_id: sanityItemId,
        });

      if (insertError) throw insertError;

      // Refresh the saved items list
      await fetchSavedItems();
    } catch (err) {
      console.error('Error adding saved item:', err);
      throw err;
    }
  };

  const removeSavedItem = async (sanityItemId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: deleteError } = await supabase
        .from('user_saved_items')
        .delete()
        .eq('user_id', user.id)
        .eq('sanity_item_id', sanityItemId);

      if (deleteError) throw deleteError;

      // Update local state
      setSavedItems(prev => prev.filter(item => item.sanity_item_id !== sanityItemId));
    } catch (err) {
      console.error('Error removing saved item:', err);
      throw err;
    }
  };

  const updateSavedItem = async (sanityItemId: string, updates: Partial<UserSavedItem>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: updateError } = await supabase
        .from('user_saved_items')
        .update(updates)
        .eq('user_id', user.id)
        .eq('sanity_item_id', sanityItemId);

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