-- We only need to store user interactions and basic metadata
-- Content (menu items, restaurants, etc.) will be managed in Sanity.io

-- Create user_saved_items table (for right swipes/favorites)
CREATE TABLE IF NOT EXISTS user_saved_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sanity_item_id TEXT NOT NULL, -- Reference to Sanity.io document ID
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  notes TEXT,
  order_count INTEGER DEFAULT 0,
  last_ordered_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, sanity_item_id)
);

-- Add RLS (Row Level Security) policies
ALTER TABLE user_saved_items ENABLE ROW LEVEL SECURITY;

-- Create policies
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