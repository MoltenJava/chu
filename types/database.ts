export type PriceRange = '$' | '$$' | '$$$' | '$$$$';

export interface Restaurant {
  id: string;
  place_id: string;
  name: string;
  address: string | null;
  price_range: PriceRange | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  category: string | null;
  dietary_info: {
    vegan?: boolean;
    vegetarian?: boolean;
    gluten_free?: boolean;
    dairy_free?: boolean;
    halal?: boolean;
    kosher?: boolean;
    nut_free?: boolean;
  } | null;
  spiciness: number | null;
  popularity_score: number | null;
  available: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSavedItem {
  id: string;
  user_id: string;
  sanity_item_id: string;
  saved_at: string;
  notes: string | null;
  order_count: number;
  last_ordered_at: string | null;
}

export type InteractionType = 'view' | 'left_swipe' | 'right_swipe';

export interface UserItemInteraction {
  id: string;
  user_id: string;
  menu_item_id: string;
  interaction_type: InteractionType;
  created_at: string;
}

export interface OrderLink {
  id: string;
  menu_item_id: string;
  restaurant_id: string;
  platform: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: Restaurant;
        Insert: Omit<Restaurant, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Restaurant, 'id' | 'created_at' | 'updated_at'>>;
      };
      menu_items: {
        Row: MenuItem;
        Insert: Omit<MenuItem, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MenuItem, 'id' | 'created_at' | 'updated_at'>>;
      };
      user_saved_items: {
        Row: UserSavedItem;
        Insert: Omit<UserSavedItem, 'id' | 'saved_at'>;
        Update: Partial<Omit<UserSavedItem, 'id' | 'saved_at'>>;
      };
      user_item_interactions: {
        Row: UserItemInteraction;
        Insert: Omit<UserItemInteraction, 'id' | 'created_at'>;
        Update: never; // Interactions should not be updated
      };
      order_links: {
        Row: OrderLink;
        Insert: Omit<OrderLink, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<OrderLink, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: never;
        Update: never;
      };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      price_range: PriceRange;
    };
  };
} 