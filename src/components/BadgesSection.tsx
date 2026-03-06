import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BADGE_DEFINITIONS } from '../hooks/useCheckBadges';
import { BadgeSlug } from '../types';

interface BadgesSectionProps {
  userId: string | null;
  mealsGiven: number;
  sharesCount: number;
}

export default function BadgesSection({ userId, mealsGiven, sharesCount }: BadgesSectionProps) {
  const [earned, setEarned] = useState<Set<BadgeSlug>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_badges')
      .select('badge_slug')
      .eq('user_id', userId)
      .then(({ data }) => {
        setEarned(new Set((data ?? []).map((b: { badge_slug: string }) => b.badge_slug as BadgeSlug)));
        setLoading(false);
      });
  }, [userId, mealsGiven, sharesCount]);

  if (loading) return null;
  if (earned.size === 0 && sharesCount === 0) return null;

  const earnedBadges = BADGE_DEFINITIONS.filter((b) => earned.has(b.slug));
  const lockedBadges = BADGE_DEFINITIONS.filter((b) => !earned.has(b.slug));

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Badges
      </p>

      {earnedBadges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: lockedBadges.length > 0 ? 10 : 0 }}>
          {earnedBadges.map((badge) => (
            <div
              key={badge.slug}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: badge.bg,
                border: `1.5px solid ${badge.color}22`,
                borderRadius: 20,
                padding: '5px 10px',
              }}
              title={badge.description}
            >
              <span style={{ fontSize: 14 }}>{badge.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: badge.color }}>{badge.label}</span>
            </div>
          ))}
        </div>
      )}

      {lockedBadges.length > 0 && earnedBadges.length > 0 && (
        <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 6 }}>A débloquer :</p>
      )}

      {lockedBadges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {lockedBadges.map((badge) => (
            <div
              key={badge.slug}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#f9fafb',
                border: '1.5px solid #e5e7eb',
                borderRadius: 20,
                padding: '4px 9px',
                opacity: 0.6,
              }}
              title={badge.description}
            >
              <span style={{ fontSize: 13, filter: 'grayscale(1)' }}>{badge.emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af' }}>{badge.label}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#d1d5db' }}>lock</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
