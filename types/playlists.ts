import { SupabaseMenuItem } from './supabase'; // Assuming base menu item type is here

// Represents a row in the 'playlists' table
export interface Playlist {
  id: string; // uuid
  user_id: string; // uuid
  name: string;
  description?: string | null;
  emoji?: string | null;
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

// Represents a row in the 'playlist_items' table, potentially joined with 'menu_items'
export interface PlaylistItem {
  id: string; // playlist_items uuid
  playlist_id: string; // uuid
  user_id: string; // uuid
  menu_item_id: string; // uuid
  added_at: string; // timestamptz
  notes?: string | null;
  // Joined data from menu_items (adjust based on actual needs)
  menu_item?: SupabaseMenuItem | null; 
}

// Type specifically for the result of getPlaylistItems which includes menu item details
export type PlaylistItemWithDetails = PlaylistItem & {
    menu_item: SupabaseMenuItem; // Make menu_item non-nullable for this specific type
}; 