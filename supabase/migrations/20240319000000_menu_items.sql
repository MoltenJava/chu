-- Create enum for price ranges
CREATE TYPE price_range AS ENUM ('$', '$$', '$$$', '$$$$');

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_id TEXT UNIQUE NOT NULL, -- Google Places ID
  name TEXT NOT NULL,
  address TEXT,
  price_range price_range,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  image_url TEXT,
  category TEXT,
  dietary_info JSONB, -- Store dietary information (vegan, gluten-free, etc.)
  spiciness INTEGER CHECK (spiciness BETWEEN 0 AND 5),
  popularity_score DECIMAL(3,2) CHECK (popularity_score BETWEEN 0 AND 5),
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create user_saved_items table (for right swipes/favorites)
CREATE TABLE IF NOT EXISTS user_saved_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  notes TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  order_count INTEGER DEFAULT 0,
  last_ordered_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, menu_item_id)
);

-- Create user_item_interactions table (for tracking swipes and views)
CREATE TABLE IF NOT EXISTS user_item_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'left_swipe', 'right_swipe')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create order_links table (for delivery service links)
CREATE TABLE IF NOT EXISTS order_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- e.g., 'ubereats', 'doordash', etc.
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(menu_item_id, platform)
);

-- Add indexes for better query performance
CREATE INDEX idx_restaurants_place_id ON restaurants(place_id);
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_user_saved_items_user ON user_saved_items(user_id);
CREATE INDEX idx_user_saved_items_item ON user_saved_items(menu_item_id);
CREATE INDEX idx_user_interactions_user ON user_item_interactions(user_id);
CREATE INDEX idx_user_interactions_item ON user_item_interactions(menu_item_id);
CREATE INDEX idx_order_links_item ON order_links(menu_item_id);
CREATE INDEX idx_order_links_restaurant ON order_links(restaurant_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_item_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_links ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public restaurants are viewable by everyone"
  ON restaurants FOR SELECT
  USING (true);

CREATE POLICY "Public menu items are viewable by everyone"
  ON menu_items FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own saved items"
  ON user_saved_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved items"
  ON user_saved_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved items"
  ON user_saved_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved items"
  ON user_saved_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interactions"
  ON user_item_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own interactions"
  ON user_item_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public order links are viewable by everyone"
  ON order_links FOR SELECT
  USING (true);

-- Create functions for managing timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_restaurants_updated_at
    BEFORE UPDATE ON restaurants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
    BEFORE UPDATE ON menu_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_links_updated_at
    BEFORE UPDATE ON order_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 