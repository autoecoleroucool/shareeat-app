export const FALLBACK_AVATAR = 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?w=60';
export const FALLBACK_MEAL_IMAGE = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg';

export const KARMA_LIMIT = -10;
export const SHARES_FOR_CIRCLE = 10;
export const XP_PER_SHARE = 10;
export const MSG_MAX_LENGTH = 2000;
export const MSG_PAGE_SIZE = 30;

export const DIET_TAGS: { label: string; icon: string }[] = [
  { label: 'Végétarien', icon: '🌿' },
  { label: 'Vegan', icon: '🌱' },
  { label: 'Sans gluten', icon: '🌾' },
  { label: 'Sans lactose', icon: '🥛' },
  { label: 'Sans noix', icon: '🥜' },
  { label: 'Sans porc', icon: '🐷' },
  { label: 'Halal', icon: '☪' },
  { label: 'Casher', icon: '✡' },
  { label: 'Sans œuf', icon: '🥚' },
  { label: 'Sans soja', icon: '🫘' },
  { label: 'Sans fruits de mer', icon: '🦐' },
  { label: 'Sans arachide', icon: '🥜' },
  { label: 'Épicé', icon: '🌶️' },
  { label: 'Cru', icon: '🥗' },
  { label: 'Faible en sel', icon: '🧂' },
  { label: 'Sans sucre ajouté', icon: '🍬' },
];

export interface EditMealData {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  category: 'food_rescue' | 'homemade_meal';
  slots_total: number;
  allergens: string[];
  meal_date: string | null;
  expires_at: string | null;
  quantity: string | null;
  location_lat: number;
  location_lng: number;
  location_name: string;
}
