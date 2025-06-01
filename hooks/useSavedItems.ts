import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserSavedItem, Restaurant, MenuItem } from '@/types/database';
import { SupabaseMenuItem, convertToSupabaseMenuItem } from '@/types/supabase';
import * as Sentry from '@sentry/react-native';
import { useCoupleContext } from '@/context/CoupleContext';

export interface SavedItemWithDetails extends UserSavedItem {
  menu_items: MenuItem & { restaurant?: Restaurant };
}

export function useSavedItems() {
  const [savedItems, setSavedItems] = useState<SavedItemWithDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useCoupleContext();

  const fetchSavedItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: savedItemsData, error: supabaseError } = await supabase
        .from('user_saved_items')
        .select(`
          user_id,
          menu_item_id,
          created_at, 
          notes,
          order_count,
          last_ordered_at,
          menu_items ( 
            *,
            restaurants (*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;

      console.log(`[useSavedItems] Fetched ${savedItemsData?.length || 0} raw saved items.`);
      
      const processedData = savedItemsData
        ?.map(item => {
          const menuItemData = item.menu_items as unknown as (MenuItem & { restaurants?: Restaurant });
        
          if (!menuItemData || typeof menuItemData !== 'object' || Array.isArray(menuItemData)) {
              console.warn('Saved item found without valid menu item details:', item);
              return null;
          }
        
        return {
              user_id: item.user_id,
              menu_item_id: item.menu_item_id,
              created_at: item.created_at,
              notes: item.notes,
              order_count: item.order_count,
              last_ordered_at: item.last_ordered_at,
              menu_items: menuItemData
          } as SavedItemWithDetails; 
        })
        .filter((item): item is SavedItemWithDetails => item !== null);

      setSavedItems(processedData || []);
      Sentry.addBreadcrumb({
        category: 'data.fetch',
        message: 'Saved items fetched successfully',
        level: 'info',
        data: { count: processedData?.length || 0 }
      });

    } catch (err: any) {
      console.error('[useSavedItems] Error fetching saved items:', err);
      Sentry.captureException(err, { extra: { message: 'Error in fetchSavedItems' } });
      setError(err.message || 'Failed to fetch saved items');
    } finally {
      setLoading(false);
    }
  };

  const addSavedItem = async (menuItemId: string) => {
    console.log(`[useSavedItems] Attempting to add item: ${menuItemId}`);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log(`[useSavedItems] Got user: ${user?.id}, Error: ${userError}`);

      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      console.log(`[useSavedItems] Calling supabase.insert for user ${user.id}, item ${menuItemId}`);
      const { error: insertError } = await supabase
        .from('user_saved_items')
        .insert({
          user_id: user.id,
          menu_item_id: menuItemId,
        });
      console.log(`[useSavedItems] Supabase insert finished. Error: ${insertError}`);

      if (insertError) {
          if (insertError.code === '23505') {
            console.warn('[useSavedItems] Item already saved.');
          } else {
            throw insertError;
          }
      }

      // Optimistic update locally (add a placeholder or refetch partially)
      // For simplicity, just logging success breadcrumb for now
      Sentry.addBreadcrumb({
        category: 'data.mutate',
        message: 'Saved item added successfully (local state update pending refresh)',
        level: 'info',
        data: { userId: user.id, foodItemId: menuItemId }
      });

    } catch (err) {
      console.error('[useSavedItems] Error in addSavedItem catch block:', err);
      Sentry.captureException(err, { extra: { message: 'Error in addSavedItem' } });
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

      setSavedItems(prev => prev.filter(item => item.menu_item_id !== menuItemId));

      // Optimistic update locally (remove from state)
      // For simplicity, just logging success breadcrumb for now
      Sentry.addBreadcrumb({
        category: 'data.mutate',
        message: 'Saved item removed successfully (local state update pending refresh)',
        level: 'info',
        data: { userId: user.id, foodItemId: menuItemId }
      });

    } catch (err) {
      console.error('Error removing saved item:', err);
      Sentry.captureException(err, { extra: { message: 'Error in removeSavedItem' } });
      throw err;
    }
  };

  const updateSavedItem = async (menuItemId: string, updates: Partial<Omit<UserSavedItem, 'user_id' | 'menu_item_id' | 'created_at'>>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: updateError } = await supabase
        .from('user_saved_items')
        .update(updates)
        .eq('user_id', user.id)
        .eq('menu_item_id', menuItemId);

      if (updateError) throw updateError;

      await fetchSavedItems();
    } catch (err) {
      console.error('Error updating saved item:', err);
      throw err;
    }
  };

  const clearAllSavedItems = useCallback(async () => {
    if (!user?.id) {
      console.error('[useSavedItems] User not logged in for clear all');
      Sentry.captureMessage('Attempted to clear saved items without user', 'warning');
      throw new Error("User not logged in.");
    }

    setLoading(true);
    setError(null);

    Sentry.addBreadcrumb({
      category: 'data.mutate',
      message: 'Clearing all saved items',
      level: 'info',
      data: { userId: user.id },
    });

    try {
      const { error: deleteError } = await supabase
        .from('user_saved_items')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setSavedItems([]); // Clear local state
      Sentry.addBreadcrumb({
        category: 'data.mutate',
        message: 'All saved items cleared successfully',
        level: 'info',
        data: { userId: user.id },
      });

    } catch (error: any) {
      console.error('[useSavedItems] Error clearing all saved items:', error);
      Sentry.captureException(error, { extra: { message: 'Error in clearAllSavedItems' } });
      setError(error.message || 'Failed to clear items');
      throw error; // Rethrow
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

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
    clearAllSavedItems,
  };
} 