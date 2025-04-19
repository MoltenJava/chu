import { supabase } from '../lib/supabase';
import { SupabaseMenuItem } from '../types/supabase'; // Assuming this type exists
import { Playlist, PlaylistItem, PlaylistItemWithDetails } from '../types/playlists'; // Use defined types
import { SupabaseClient } from '@supabase/supabase-js'; // Import SupabaseClient for type hints if needed

const DEFAULT_PLAYLIST_NAME = "All Saved Items";
const DEFAULT_PLAYLIST_EMOJI = "🍽️";

/**
 * Finds or creates the default playlist for a user.
 * @param userId The user's ID.
 * @returns The ID of the default playlist.
 * @throws Error if Supabase operation fails.
 */
export const findOrCreateDefaultPlaylist = async (userId: string): Promise<string> => {
  console.log(`[PlaylistService] Finding/creating default playlist for user ${userId}`);

  // 1. Check if the default playlist exists
  const { data: existingPlaylist, error: findError } = await supabase
    .from('playlists')
    .select('id')
    .eq('user_id', userId)
    .eq('name', DEFAULT_PLAYLIST_NAME)
    .maybeSingle(); // Use maybeSingle to handle 0 or 1 result

  if (findError) {
    console.error("[PlaylistService] Error finding default playlist:", findError);
    throw new Error("Failed to check for default playlist.");
  }

  // 2. If yes, return its ID
  if (existingPlaylist) {
    console.log(`[PlaylistService] Found existing default playlist: ${existingPlaylist.id}`);
    return existingPlaylist.id;
  }

  // 3. If no, create it
  console.log(`[PlaylistService] Default playlist not found, creating...`);
  const { data: newPlaylist, error: createError } = await supabase
    .from('playlists')
    .insert({ 
      user_id: userId, 
      name: DEFAULT_PLAYLIST_NAME,
      emoji: DEFAULT_PLAYLIST_EMOJI,
      description: "All items you've saved by swiping right."
    })
    .select('id')
    .single(); // Expect exactly one row back after insert

  if (createError || !newPlaylist) {
    console.error("[PlaylistService] Error creating default playlist:", createError);
    throw new Error("Failed to create default playlist.");
  }

  console.log(`[PlaylistService] Created new default playlist: ${newPlaylist.id}`);
  return newPlaylist.id;
};

/**
 * Adds a menu item to a specific playlist for a user.
 * Handles potential unique constraint violations gracefully.
 * @param userId The user's ID.
 * @param playlistId The target playlist ID.
 * @param menuItemId The menu item's ID.
 * @param notes Optional notes for the item in this playlist.
 * @returns True if the item was added successfully (or already existed), false otherwise.
 */
export const addItemToPlaylist = async (
  userId: string,
  playlistId: string,
  menuItemId: string,
  notes?: string
): Promise<boolean> => {
  console.log(`[PlaylistService] Adding item ${menuItemId} to playlist ${playlistId} for user ${userId}`);
  
  const { error } = await supabase
    .from('playlist_items')
    .insert({ 
      user_id: userId, 
      playlist_id: playlistId,
      menu_item_id: menuItemId,
      notes: notes
    });

  if (error) {
    // Check if the error is a unique constraint violation (code 23505)
    if (error.code === '23505') {
      console.log(`[PlaylistService] Item ${menuItemId} already exists in playlist ${playlistId}.`);
      return true; // Treat as success if it already exists
    } else {
      console.error("[PlaylistService] Error adding item to playlist:", error);
      return false; // Indicate failure for other errors
    }
  }

  console.log(`[PlaylistService] Successfully added item ${menuItemId} to playlist ${playlistId}.`);
  return true;
};

/**
 * Saves an item to the user's default playlist.
 * Convenience function combining findOrCreateDefaultPlaylist and addItemToPlaylist.
 * @param userId The user's ID.
 * @param menuItemId The menu item's ID.
 */
export const saveItemToDefaultPlaylist = async (userId: string, menuItemId: string): Promise<void> => {
  console.log(`[PlaylistService] Saving item ${menuItemId} to default playlist for user ${userId}`);
  try {
    const defaultPlaylistId = await findOrCreateDefaultPlaylist(userId);
    const success = await addItemToPlaylist(userId, defaultPlaylistId, menuItemId);
    if (success) {
        console.log(`[PlaylistService] Successfully saved/ensured item ${menuItemId} in default playlist.`);
    } else {
        console.warn(`[PlaylistService] Failed to add item ${menuItemId} to default playlist.`);
    }
  } catch (error) {
    console.error("[PlaylistService] Error in saveItemToDefaultPlaylist:", error);
    // Decide if this should throw or just log
  }
};

/**
 * Fetches all playlists for a given user.
 * @param userId The user's ID.
 * @returns An array of Playlist objects.
 * @throws Error if Supabase operation fails.
 */
export const getUserPlaylists = async (userId: string): Promise<Playlist[]> => {
  console.log(`[PlaylistService] Fetching playlists for user ${userId}`);
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true }); // Optional: order by creation date

  if (error) {
    console.error("[PlaylistService] Error fetching user playlists:", error);
    throw new Error("Failed to fetch playlists.");
  }

  return data || [];
};

/**
 * Fetches all items within a specific playlist, including menu item details.
 * @param playlistId The playlist ID.
 * @returns An array of PlaylistItemWithDetails objects.
 * @throws Error if Supabase operation fails.
 */
export const getPlaylistItems = async (playlistId: string): Promise<PlaylistItemWithDetails[]> => {
  console.log(`[PlaylistService] Fetching items for playlist ${playlistId}`);

  // Define an intermediate type for the raw Supabase response
  type RawPlaylistItem = Omit<PlaylistItem, 'menu_item'> & { 
      menu_item: unknown // Expect menu_item but type it as unknown initially
  };

  // Select from playlist_items and join with menu_items
  const { data, error } = await supabase
    .from('playlist_items')
    .select(`
      id,
      playlist_id,
      user_id,
      menu_item_id,
      added_at,
      notes,
      menu_item:menu_items (*)
    `)
    .eq('playlist_id', playlistId)
    .order('added_at', { ascending: false }) as { data: RawPlaylistItem[] | null, error: any }; // Assert the response shape

  if (error) {
    console.error("[PlaylistService] Error fetching playlist items:", error);
    throw new Error("Failed to fetch playlist items.");
  }

  if (!data) {
      return []; // Return empty array if no data
  }

  // Filter out items where menu_item isn't a valid object
  const validItems = data
    .filter(item => 
      item.menu_item != null && 
      typeof item.menu_item === 'object' && 
      !Array.isArray(item.menu_item) &&
      ('_id' in (item.menu_item as object) || 'id' in (item.menu_item as object)) // Basic check for expected keys
    )
    .map((item): PlaylistItemWithDetails => {
      // Map to the final type, casting menu_item explicitly
      return {
          ...item,
          menu_item: item.menu_item as SupabaseMenuItem // Cast the validated menu_item
      };
    });

  return validItems;
};

/**
 * Creates a new playlist for the user.
 * @param userId The user's ID.
 * @param name The name of the new playlist.
 * @param description Optional description.
 * @param emoji Optional emoji.
 * @returns The newly created Playlist object.
 * @throws Error if Supabase operation fails.
 */
export const createPlaylist = async (
    userId: string, 
    name: string, 
    description?: string, 
    emoji?: string
): Promise<Playlist> => {
    console.log(`[PlaylistService] Creating playlist "${name}" for user ${userId}`);
    const { data, error } = await supabase
        .from('playlists')
        .insert({ 
            user_id: userId, 
            name: name.trim(), 
            description, 
            emoji 
        })
        .select('*')
        .single();

    if (error || !data) {
        console.error("[PlaylistService] Error creating playlist:", error);
        throw new Error("Failed to create playlist.");
    }
    return data;
};

/**
 * Removes a specific item instance from a playlist.
 * @param playlistItemId The ID of the row in the playlist_items table.
 * @param userId The ID of the user performing the action (for RLS check).
 * @returns True if deletion was successful, false otherwise.
 */
export const removeItemFromPlaylist = async (playlistItemId: string, userId: string): Promise<boolean> => {
    console.log(`[PlaylistService] Removing playlist item ${playlistItemId} for user ${userId}`);
    
    // We include userId to ensure RLS policies are correctly applied
    const { error } = await supabase
        .from('playlist_items')
        .delete()
        .eq('id', playlistItemId)
        .eq('user_id', userId); // Ensure user owns the item link

    if (error) {
        console.error("[PlaylistService] Error removing item from playlist:", error);
        return false;
    }
    return true;
};

/**
 * Removes all items from a specific playlist for a user.
 * Typically used for the "Clear All Saved Items" functionality.
 * @param playlistId The ID of the playlist to clear.
 * @param userId The user's ID.
 * @returns True if clearing was successful, false otherwise.
 */
export const clearPlaylist = async (playlistId: string, userId: string): Promise<boolean> => {
    console.log(`[PlaylistService] Clearing playlist ${playlistId} for user ${userId}`);
    const { error } = await supabase
        .from('playlist_items')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('user_id', userId); // Ensure user owns the items

    if (error) {
        console.error("[PlaylistService] Error clearing playlist:", error);
        return false;
    }
    return true;
};

// Add more functions as needed (updatePlaylist, deletePlaylist, etc.) 