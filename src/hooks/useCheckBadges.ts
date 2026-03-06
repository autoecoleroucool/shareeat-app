import { supabase } from '../lib/supabase';
import { BadgeSlug, BadgeConfig } from '../types';

export const BADGE_DEFINITIONS: BadgeConfig[] = [
  {
    slug: 'first_share',
    label: 'Premier partage',
    description: 'Tu as partagé ton premier repas',
    emoji: '🌱',
    color: '#16a34a',
    bg: '#f0fdf4',
    threshold: 1,
  },
  {
    slug: 'shares_10',
    label: '10 repas partagés',
    description: 'Tu as partagé 10 repas',
    emoji: '🍽️',
    color: '#d97706',
    bg: '#fffbeb',
    threshold: 10,
  },
  {
    slug: 'shares_25',
    label: '25 repas partagés',
    description: 'Un vrai pilier de la communauté',
    emoji: '⭐',
    color: '#b91c1c',
    bg: '#fef2f2',
    threshold: 25,
  },
  {
    slug: 'community_helper',
    label: 'Aide communautaire',
    description: 'Tu as partagé et reçu des repas',
    emoji: '🤝',
    color: '#0891b2',
    bg: '#ecfeff',
  },
  {
    slug: 'food_rescue_hero',
    label: 'Héros anti-gaspi',
    description: 'Tu as sauvé de la nourriture du gaspillage',
    emoji: '♻️',
    color: '#16a34a',
    bg: '#f0fdf4',
  },
];

export async function checkAndAwardBadges(
  userId: string,
  profile: { meals_given: number; shares_count: number; meals_taken: number; category_counts?: { food_rescue: number } }
): Promise<BadgeConfig[]> {
  const { data: existing } = await supabase
    .from('user_badges')
    .select('badge_slug')
    .eq('user_id', userId);

  const existingSlugs = new Set((existing ?? []).map((b: { badge_slug: string }) => b.badge_slug));

  const toAward: BadgeSlug[] = [];

  if (!existingSlugs.has('first_share') && profile.shares_count >= 1) {
    toAward.push('first_share');
  }
  if (!existingSlugs.has('shares_10') && profile.shares_count >= 10) {
    toAward.push('shares_10');
  }
  if (!existingSlugs.has('shares_25') && profile.shares_count >= 25) {
    toAward.push('shares_25');
  }
  if (!existingSlugs.has('community_helper') && profile.meals_given >= 5 && profile.meals_taken >= 5) {
    toAward.push('community_helper');
  }
  if (!existingSlugs.has('food_rescue_hero') && (profile.category_counts?.food_rescue ?? 0) >= 5) {
    toAward.push('food_rescue_hero');
  }

  if (toAward.length === 0) return [];

  await supabase.from('user_badges').upsert(
    toAward.map((slug) => ({ user_id: userId, badge_slug: slug })),
    { onConflict: 'user_id,badge_slug', ignoreDuplicates: true }
  );

  return toAward.map((slug) => BADGE_DEFINITIONS.find((b) => b.slug === slug)!).filter(Boolean);
}
