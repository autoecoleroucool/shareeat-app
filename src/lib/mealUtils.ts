export const CATEGORY_CONFIG = {
  food_rescue: { color: '#16a34a', label: 'Anti-gaspi', bg: '#f0fdf4', border: '#bbf7d0', emoji: '♻️' },
  homemade_meal: { color: '#f97316', label: 'Repas maison', bg: '#fff7ed', border: '#fed7aa', emoji: '🍽️' },
  culinary_circle: { color: '#d97706', label: 'Cercle Culinaire', bg: '#fef3c7', border: '#fde68a', emoji: '🏆' },
} as const;

export const DISTANCE_METERS: Record<string, number | null> = {
  'Toute distance': null,
  'Moins de 500m': 500,
  'Moins de 1 km': 1000,
  'Moins de 2 km': 2000,
};

export const DISTANCE_OPTIONS = ['Toute distance', 'Moins de 500m', 'Moins de 1 km', 'Moins de 2 km'];
export const TIME_OPTIONS = ["N'importe quand", "Aujourd'hui", 'Demain', 'Cette semaine'];

export function getMealCategory(meal: { category?: string | null; meal_type?: string | null }): 'food_rescue' | 'homemade_meal' | 'culinary_circle' {
  if (meal.meal_type === 'culinary_circle') return 'culinary_circle';
  if (meal.category === 'food_rescue') return 'food_rescue';
  return 'homemade_meal';
}

export function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expiré';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${mins} min restantes`;
  return `${hours}h${mins > 0 ? String(mins).padStart(2, '0') : ''} restantes`;
}

export function isExpiringSoon(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatMealTiming(mealDate: string | null | undefined): { day: string; time: string } {
  if (!mealDate) return { day: '', time: '' };
  const d = new Date(mealDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  let day: string;
  if (d >= today && d < tomorrow) day = "AUJOURD'HUI";
  else if (d >= tomorrow && d < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) day = 'DEMAIN';
  else day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return { day, time };
}

export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
