import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ImpactStats {
  mealsShared: number;
  mealsSaved: number;
  activeUsers: number;
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

export default function ImpactCounter() {
  const [stats, setStats] = useState<ImpactStats | null>(null);

  const fetchStats = async () => {
    const [mealsRes, savedRes, usersRes] = await Promise.all([
      supabase.from('meals').select('id', { count: 'exact', head: true }),
      supabase.from('meal_participants').select('id', { count: 'exact', head: true }).eq('delivered', true),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    setStats({
      mealsShared: mealsRes.count ?? 0,
      mealsSaved: savedRes.count ?? 0,
      activeUsers: usersRes.count ?? 0,
    });
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(8px)',
      borderRadius: 14,
      padding: '8px 12px',
      boxShadow: '0 2px 14px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <p style={{ fontSize: 9, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
        Impact communaute
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#16a34a', margin: 0 }}>{formatCount(stats.mealsShared)}</p>
          <p style={{ fontSize: 9, color: '#6b7280', margin: 0, fontWeight: 600 }}>partagés</p>
        </div>
        <div style={{ width: 1, background: '#e5e7eb' }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#d97706', margin: 0 }}>{formatCount(stats.mealsSaved)}</p>
          <p style={{ fontSize: 9, color: '#6b7280', margin: 0, fontWeight: 600 }}>sauvés</p>
        </div>
        <div style={{ width: 1, background: '#e5e7eb' }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#2563eb', margin: 0 }}>{formatCount(stats.activeUsers)}</p>
          <p style={{ fontSize: 9, color: '#6b7280', margin: 0, fontWeight: 600 }}>actifs</p>
        </div>
      </div>
    </div>
  );
}
