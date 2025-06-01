export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      couple_matches: {
        Row: {
          created_at: string | null
          food_item_id: string | null
          id: string
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          food_item_id?: string | null
          id?: string
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          food_item_id?: string | null
          id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couple_matches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "couple_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          joined_by: string | null
          session_code: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          joined_by?: string | null
          session_code: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          joined_by?: string | null
          session_code?: string
          status?: string | null
        }
        Relationships: []
      }
      couple_swipes: {
        Row: {
          created_at: string | null
          decision: boolean | null
          food_item_id: string | null
          id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          decision?: boolean | null
          food_item_id?: string | null
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          decision?: boolean | null
          food_item_id?: string | null
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couple_swipes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "couple_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_aesthetic_scores: {
        Row: {
          aesthetic_score: number | null
          menu_item_uuid: string
        }
        Insert: {
          aesthetic_score?: number | null
          menu_item_uuid: string
        }
        Update: {
          aesthetic_score?: number | null
          menu_item_uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_aesthetic_scores_menu_item_uuid_fkey"
            columns: ["menu_item_uuid"]
            isOneToOne: true
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_aesthetic_scores_menu_item_uuid_fkey"
            columns: ["menu_item_uuid"]
            isOneToOne: true
            referencedRelation: "menu_items_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_tags: {
        Row: {
          menu_item_uuid: string
          tag: string
        }
        Insert: {
          menu_item_uuid: string
          tag: string
        }
        Update: {
          menu_item_uuid?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_tags_menu_item_uuid_fkey"
            columns: ["menu_item_uuid"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_tags_menu_item_uuid_fkey"
            columns: ["menu_item_uuid"]
            isOneToOne: false
            referencedRelation: "menu_items_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items_raw: {
        Row: {
          created_at: string | null
          cuisines: string[] | null
          description: string | null
          diets_and_styles: string[] | null
          dish_types: string[] | null
          doordash_url: string | null
          drinks_and_snacks: string[] | null
          healthy_indulgent: number | null
          id: string
          image_index: string | null
          meal_timing: string[] | null
          name: string
          postmates_url: string | null
          price: number | null
          price_level: Database["public"]["Enums"]["price_level"] | null
          QualityScore: number | null
          restaurant_id: string | null
          s3_url: string | null
          safe_adventurous: number | null
          spiciness: number | null
          sweet_savory: number | null
          tag: string | null
          uber_eats_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cuisines?: string[] | null
          description?: string | null
          diets_and_styles?: string[] | null
          dish_types?: string[] | null
          doordash_url?: string | null
          drinks_and_snacks?: string[] | null
          healthy_indulgent?: number | null
          id?: string
          image_index?: string | null
          meal_timing?: string[] | null
          name: string
          postmates_url?: string | null
          price?: number | null
          price_level?: Database["public"]["Enums"]["price_level"] | null
          QualityScore?: number | null
          restaurant_id?: string | null
          s3_url?: string | null
          safe_adventurous?: number | null
          spiciness?: number | null
          sweet_savory?: number | null
          tag?: string | null
          uber_eats_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cuisines?: string[] | null
          description?: string | null
          diets_and_styles?: string[] | null
          dish_types?: string[] | null
          doordash_url?: string | null
          drinks_and_snacks?: string[] | null
          healthy_indulgent?: number | null
          id?: string
          image_index?: string | null
          meal_timing?: string[] | null
          name?: string
          postmates_url?: string | null
          price?: number | null
          price_level?: Database["public"]["Enums"]["price_level"] | null
          QualityScore?: number | null
          restaurant_id?: string | null
          s3_url?: string | null
          safe_adventurous?: number | null
          spiciness?: number | null
          sweet_savory?: number | null
          tag?: string | null
          uber_eats_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          added_at: string
          id: string
          menu_item_id: string
          notes: string | null
          playlist_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          menu_item_id: string
          notes?: string | null
          playlist_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          menu_item_id?: string
          notes?: string | null
          playlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birthdate: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          onboarding_completed: boolean | null
          preferences: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birthdate?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          onboarding_completed?: boolean | null
          preferences?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birthdate?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          onboarding_completed?: boolean | null
          preferences?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string | null
          Friday: string | null
          id: string
          latitude: number | null
          longitude: number | null
          Monday: string | null
          name: string
          place_id: string | null
          Saturday: string | null
          Sunday: string | null
          Thursday: string | null
          Tuesday: string | null
          updated_at: string | null
          Wednesday: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          Friday?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          Monday?: string | null
          name: string
          place_id?: string | null
          Saturday?: string | null
          Sunday?: string | null
          Thursday?: string | null
          Tuesday?: string | null
          updated_at?: string | null
          Wednesday?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          Friday?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          Monday?: string | null
          name?: string
          place_id?: string | null
          Saturday?: string | null
          Sunday?: string | null
          Thursday?: string | null
          Tuesday?: string | null
          updated_at?: string | null
          Wednesday?: string | null
        }
        Relationships: []
      }
      user_saved_items: {
        Row: {
          created_at: string
          last_ordered_at: string | null
          menu_item_id: string
          notes: string | null
          order_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          last_ordered_at?: string | null
          menu_item_id: string
          notes?: string | null
          order_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          last_ordered_at?: string | null
          menu_item_id?: string
          notes?: string | null
          order_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_saved_items_menu_item_id"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_saved_items_menu_item_id"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_saved_items_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      menu_items: {
        Row: {
          aesthetic_score: number | null
          created_at: string | null
          cuisines: string[] | null
          description: string | null
          diets_and_styles: string[] | null
          dish_types: string[] | null
          doordash_url: string | null
          drinks_and_snacks: string[] | null
          healthy_indulgent: number | null
          id: string | null
          image_index: string | null
          meal_timing: string[] | null
          name: string | null
          postmates_url: string | null
          price: number | null
          price_level: Database["public"]["Enums"]["price_level"] | null
          QualityScore: number | null
          restaurant_id: string | null
          s3_url: string | null
          safe_adventurous: number | null
          spiciness: number | null
          sweet_savory: number | null
          uber_eats_url: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      handle_join_session: {
        Args:
          | { p_session_code: string; p_joining_user_id: string }
          | { target_session_id: string; joining_user_id: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          joined_by: string | null
          session_code: string
          status: string | null
        }[]
      }
      nearby_restaurants: {
        Args: { lat: number; lng: number; radius_km?: number }
        Returns: {
          id: string
          name: string
          address: string
          latitude: number
          longitude: number
          distance_km: number
        }[]
      }
      record_swipe_and_check_match: {
        Args: {
          p_session_id: string
          p_user_id: string
          p_food_item_id: string
          p_decision: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      price_level: "$" | "$$" | "$$$" | "$$$$"
      price_range: "$" | "$$" | "$$$" | "$$$$"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      price_level: ["$", "$$", "$$$", "$$$$"],
      price_range: ["$", "$$", "$$$", "$$$$"],
    },
  },
} as const
