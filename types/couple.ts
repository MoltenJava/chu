// types/couple.ts
export interface CoupleSession {
  id: string;
  created_by: string;
  joined_by?: string | null;
  status: 'active' | 'completed' | 'expired';
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  session_code: string;
  partner_id?: string | null;
  is_active?: boolean;
}

export interface CoupleSwipe {
  id: string;
  session_id: string;
  food_item_id: string;
  user_id: string;
  decision: boolean;
  created_at: string;
}

export interface CoupleMatch {
  id: string;
  session_id: string;
  food_item_id: string;
  created_at: string;
} 