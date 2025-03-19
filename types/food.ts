export interface FoodItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  restaurant: string;
  price: string;
  cuisine: string;
  foodType: FoodType[];
  deliveryServices?: string[];
  deliveryUrls?: {
    uberEats?: string;
    postmates?: string;
    doorDash?: string;
  };
  rating?: PhotoRating;
}

export type FoodType = 
  | 'all'
  | 'spicy' 
  | 'vegan' 
  | 'dessert' 
  | 'healthy' 
  | 'breakfast' 
  | 'lunch' 
  | 'dinner'
  | 'comfort'
  | 'seafood'
  | 'fast-food';

export type PhotoRating = 'good' | 'bad' | 'meh' | null;

export type SwipeDirection = 'left' | 'right' | 'up' | 'none';

export interface SwipeHistoryItem {
  foodItem: FoodItem;
  direction: SwipeDirection;
  timestamp: number;
}

export interface FilterOption {
  id: string;
  label: string;
  type: FoodType;
  icon: string;
  color: string;
  selected: boolean;
} 