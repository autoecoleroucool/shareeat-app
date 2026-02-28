export interface Profile {
  id: string;
  name: string;
  avatar_url: string;
  bio?: string;
  location_name?: string;
  rating: number;
  trust_level: number;
  meals_shared: number;
  xp: number;
  meals_taken: number;
  meals_given: number;
  karma_balance: number;
  is_premium: boolean;
  premium_activated_at: string | null;
  created_at: string;
  shares_count: number;
  onboarding_done?: boolean;
  push_notifications?: boolean;
  sms_alerts?: boolean;
  profile_visible?: boolean;
  location_sharing?: boolean;
}

export type MealType = 'standard' | 'solidarity' | 'premium';

export type ListingCategory = 'food_rescue' | 'homemade_meal';

export interface Meal {
  id: string;
  title: string;
  description: string;
  image_url: string;
  host_id: string | null;
  slots_total: number;
  slots_taken: number;
  confirmed: boolean;
  location_lat: number;
  location_lng: number;
  location_name: string;
  allergens: string[];
  meal_date: string;
  price: number;
  is_premium_meal: boolean;
  category: ListingCategory;
  expires_at: string | null;
  quantity: string | null;
  claimed: boolean | null;
  created_at: string;
  host?: Profile;
}

export interface FoodRescueItem {
  id: string;
  title: string;
  description: string;
  host_id: string | null;
  location_lat: number;
  location_lng: number;
  location_name: string;
  expires_at: string;
  quantity: string;
  created_at: string;
  host?: Profile;
}

export interface Conversation {
  id: string;
  meal_id: string | null;
  host_id: string;
  guest_id: string;
  last_message_at: string;
  last_message_text: string;
  created_at: string;
  other_profile: { id: string; name: string; avatar_url: string } | null;
  meal_title: string | null;
  unread_count: number;
  unread_by_me: number;
  is_blocked?: boolean;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  meal_id: string | null;
  conversation_id: string | null;
  content: string;
  created_at: string;
  read_at: string | null;
  sender?: Profile;
  receiver?: Profile;
}

export interface Review {
  id: string;
  reviewer_id: string;
  reviewed_id: string;
  meal_id: string | null;
  participant_id: string | null;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: { name: string; avatar_url: string | null };
}

export interface Donation {
  id: string;
  user_id: string;
  amount: number;
  association: string;
  meal_id: string | null;
  created_at: string;
}

export interface XpLogEntry {
  id: string;
  user_id: string;
  delta: number;
  reason: 'meal_given' | 'meal_taken' | 'premium_activated';
  meal_id: string | null;
  created_at: string;
}

export interface CulinaryPhoto {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  meal_name: string;
  likes_count: number;
  created_at: string;
  author?: { id: string; name: string; avatar_url: string };
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'next_time';

export interface CulinaryInvitation {
  id: string;
  host_id: string;
  guest_id: string;
  meal_id: string | null;
  message: string;
  meal_name: string;
  proposed_date: string | null;
  status: InvitationStatus;
  next_time_note: string;
  created_at: string;
  updated_at: string;
  host?: { id: string; name: string; avatar_url: string; shares_count: number };
  guest?: { id: string; name: string; avatar_url: string };
}

export type ChallengeStatus = 'open' | 'active' | 'completed';
export type ChallengeMemberStatus = 'pending' | 'accepted' | 'declined';
export type ChallengeMealStatus = 'planned' | 'done';

export interface CulinaryChallenge {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  status: ChallengeStatus;
  min_members: number;
  max_members: number;
  created_at: string;
  updated_at: string;
  creator?: { id: string; name: string; avatar_url: string; shares_count: number };
  members?: CulinaryChallengeMember[];
  member_count?: number;
}

export interface CulinaryChallengeMember {
  id: string;
  challenge_id: string;
  user_id: string;
  role: 'creator' | 'member';
  status: ChallengeMemberStatus;
  invited_by: string | null;
  created_at: string;
  profile?: { id: string; name: string; avatar_url: string; shares_count: number; rating: number };
  inviter?: { id: string; name: string };
}

export interface CulinaryChallengeMeal {
  id: string;
  challenge_id: string;
  host_id: string;
  meal_name: string;
  meal_description: string;
  proposed_date: string | null;
  status: ChallengeMealStatus;
  created_at: string;
  host?: { id: string; name: string; avatar_url: string };
  ratings?: CulinaryChallengeRating[];
  avg_rating?: number;
  my_rating?: CulinaryChallengeRating | null;
}

export interface CulinaryChallengeRating {
  id: string;
  challenge_meal_id: string;
  rater_id: string;
  rating: number;
  comment: string;
  created_at: string;
  rater?: { id: string; name: string; avatar_url: string };
}

export type Screen = 'map' | 'explore' | 'create' | 'messages' | 'profile' | 'settings' | 'culinary';
