/*
  # Share Eat - Initial Schema

  ## New Tables

  ### profiles
  - `id` (uuid, PK, references auth.users)
  - `name` (text)
  - `avatar_url` (text)
  - `rating` (numeric, default 5.0)
  - `trust_level` (integer, default 1)
  - `meals_shared` (integer, default 0)
  - `created_at` (timestamptz)

  ### meals
  - `id` (uuid, PK)
  - `title` (text)
  - `description` (text)
  - `image_url` (text)
  - `host_id` (uuid, references profiles)
  - `slots_total` (integer, minimum 3)
  - `slots_taken` (integer, default 0)
  - `confirmed` (boolean, default false)
  - `location_lat` (numeric)
  - `location_lng` (numeric)
  - `location_name` (text)
  - `allergens` (text[])
  - `meal_date` (timestamptz)
  - `price` (numeric, default 0)
  - `created_at` (timestamptz)

  ### meal_participants
  - `id` (uuid, PK)
  - `meal_id` (uuid, references meals)
  - `user_id` (uuid, references profiles)
  - `joined_at` (timestamptz)

  ### messages
  - `id` (uuid, PK)
  - `sender_id` (uuid, references profiles)
  - `receiver_id` (uuid, references profiles)
  - `meal_id` (uuid, references meals, nullable)
  - `content` (text)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Public read for meals and profiles
  - Authenticated write for own data
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  rating numeric DEFAULT 5.0,
  trust_level integer DEFAULT 1,
  meals_shared integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  image_url text DEFAULT '',
  host_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  slots_total integer NOT NULL DEFAULT 3 CHECK (slots_total >= 3),
  slots_taken integer NOT NULL DEFAULT 0,
  confirmed boolean DEFAULT false,
  location_lat numeric DEFAULT 48.8566,
  location_lng numeric DEFAULT 2.3522,
  location_name text DEFAULT '',
  allergens text[] DEFAULT '{}',
  meal_date timestamptz DEFAULT now(),
  price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meals are viewable by everyone"
  ON meals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can create meals"
  ON meals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update own meals"
  ON meals FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can delete own meals"
  ON meals FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

CREATE TABLE IF NOT EXISTS meal_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(meal_id, user_id)
);

ALTER TABLE meal_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants are viewable by everyone"
  ON meal_participants FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can join meals"
  ON meal_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave meals"
  ON meal_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_id uuid REFERENCES meals(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Authenticated users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

INSERT INTO meals (title, description, image_url, slots_total, slots_taken, confirmed, location_lat, location_lng, location_name, allergens, meal_date, price)
VALUES
  (
    'Homemade Lasagna',
    'Classic Italian layered pasta with rich bolognese and béchamel sauce, baked to perfection.',
    'https://images.pexels.com/photos/4255489/pexels-photo-4255489.jpeg',
    5, 1, false,
    48.8606, 2.3376,
    'Marais, Paris',
    ARRAY['Gluten', 'Dairy'],
    now() + interval '1 hour',
    0
  ),
  (
    'Homemade Sourdough & Shakshuka',
    'Fresh sourdough bread paired with spiced tomato and egg shakshuka.',
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
    4, 1, false,
    48.8556, 2.3686,
    'Bastille, Paris',
    ARRAY['Gluten'],
    now() + interval '2 hours',
    12
  ),
  (
    'Mediterranean Mezze Platter',
    'Authentic mezze spread with hummus, falafel, tabbouleh, olives and warm pita.',
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
    6, 5, false,
    48.8484, 2.3534,
    'Montparnasse, Paris',
    ARRAY['Sesame', 'Gluten'],
    now() + interval '26 hours',
    15
  ),
  (
    'Fusion Tacos Night',
    'Korean-Mexican fusion tacos with bulgogi beef, kimchi slaw and avocado crema.',
    'https://images.pexels.com/photos/2087748/pexels-photo-2087748.jpeg',
    5, 0, false,
    48.8666, 2.3256,
    'Opéra, Paris',
    ARRAY['Gluten'],
    now() + interval '4 hours',
    10
  );
