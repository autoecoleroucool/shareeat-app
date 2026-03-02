import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface XpLogEntry {
  id: string;
  delta: number;
  reason: string;
  meal_id: string | null;
  created_at: string;
  meals?: { title: string } | null;
}

interface XpHistoryTabProps {
  currentUserId: string | null;
  xp: number;
  karma: number;
}

const REASON_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  meal_given: { label: 'Repas partagé', icon: 'volunteer_activism', color: '#49e619' },
  meal_taken: { label: 'Repas récupéré', icon: 'takeout_dining', color: '#3b82f6' },
  premium_activated: { label: 'Premium activé', icon: 'workspace_premium', color: '#f59e0b' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffH < 1) return "il y a moins d'1h";
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD === 1) return 'hier';
  if (diffD < 7) return `il y a ${diffD} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function XpHistoryTab({ currentUserId, xp, karma }: XpHistoryTabProps) {
  const [log, setLog] = useState<XpLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLog = useCallback(async () => {
    if (!currentUserId) { setLoading(false); return; }
    setLoading(true);

    const { data } = await supabase
      .from('user_xp_log')
      .select('id, delta, reason, meal_id, created_at, meals(title)')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setLog(data as unknown as XpLogEntry[]);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => { loadLog(); }, [loadLog]);

  if (loading) {
    return (
      <div className="space-y-3 px-6 mt-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-4 flex gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
            <div className="w-12 h-6 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-6 mt-4">
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-2xl p-4 border border-slate-50 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Total XP gagné</p>
          <p className="text-2xl font-extrabold text-[#49e619]">{xp} XP</p>
          <p className="text-[11px] text-slate-400 mt-0.5">+10 XP par repas</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-50 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Balance Karma</p>
          <p className={`text-2xl font-extrabold ${karma >= 0 ? 'text-[#49e619]' : karma >= -5 ? 'text-amber-500' : 'text-red-500'}`}>
            {karma > 0 ? `+${karma}` : karma}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">partagés - récupérés</p>
        </div>
      </div>

      {log.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-slate-400 text-[28px]">history</span>
          </div>
          <p className="font-bold text-slate-700">Aucune activité pour l'instant</p>
          <p className="text-xs text-slate-400 mt-1">Tes gains de XP et karma apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Historique récent</p>
          {log.map((entry) => {
            const config = REASON_LABELS[entry.reason] || { label: entry.reason, icon: 'star', color: '#64748b' };
            const isPositive = entry.delta > 0;
            return (
              <div key={entry.id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-slate-50">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${config.color}18` }}
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ color: config.color }}>
                    {config.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {(entry.meals as { title?: string } | null)?.title || config.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{config.label} · {formatDate(entry.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className={`text-sm font-extrabold ${isPositive ? 'text-[#49e619]' : 'text-red-500'}`}>
                    {isPositive ? `+${entry.delta * 10}` : entry.delta * 10} XP
                  </span>
                  <span className={`text-[10px] font-bold ${isPositive ? 'text-[#49e619]' : 'text-red-400'}`}>
                    {isPositive ? `+${entry.delta}` : entry.delta} karma
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
