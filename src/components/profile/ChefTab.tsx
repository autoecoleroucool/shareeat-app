import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import CulinaryGallery from '../culinary/CulinaryGallery';
import CulinaryInvitationModal from '../culinary/CulinaryInvitationModal';

interface ChefTabProps {
  currentUserId: string | null;
  onNavigateCreate: () => void;
}

export default function ChefTab({ currentUserId }: ChefTabProps) {
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [mealsCount, setMealsCount] = useState(0);
  const [showInvitations, setShowInvitations] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!currentUserId) { setLoading(false); return; }
    setLoading(true);

    const [mealsResult, profileResult] = await Promise.all([
      supabase
        .from('meals')
        .select('id', { count: 'exact', head: true })
        .eq('host_id', currentUserId),
      supabase
        .from('profiles')
        .select('meals_given, rating')
        .eq('id', currentUserId)
        .maybeSingle(),
    ]);

    setMealsCount(mealsResult.count ?? 0);
    if (profileResult.data) {
      setTotalParticipants(profileResult.data.meals_given ?? 0);
      setAvgRating(profileResult.data.rating ?? null);
    }
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="px-6 mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-5 pb-4">
      {showInvitations && currentUserId && (
        <CulinaryInvitationModal
          currentUserId={currentUserId}
          onClose={() => setShowInvitations(false)}
        />
      )}

      <div className="mx-6 mb-5">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900 p-5 shadow-xl">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, #fbbf24 0%, transparent 50%), radial-gradient(circle at 80% 20%, #f59e0b 0%, transparent 40%)'
          }} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-400/20 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-400 text-[20px] fill-1">emoji_food_beverage</span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/70">Espace chef</p>
                <h3 className="text-base font-extrabold text-amber-100 leading-tight">Cercle Culinaire</h3>
              </div>
              <div className="ml-auto">
                <span className="material-symbols-outlined text-amber-400 text-[22px] fill-1">verified</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-3 border border-amber-400/10 text-center">
                <p className="text-2xl font-extrabold text-amber-100">{mealsCount}</p>
                <p className="text-[10px] text-amber-300/60 mt-0.5 font-medium">Repas proposés</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 border border-amber-400/10 text-center">
                <p className="text-2xl font-extrabold text-amber-100">{totalParticipants}</p>
                <p className="text-[10px] text-amber-300/60 mt-0.5 font-medium">Personnes régalées</p>
              </div>
            </div>
            {avgRating !== null && avgRating > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className={`material-symbols-outlined text-[14px] fill-1 ${s <= Math.round(avgRating) ? 'text-amber-400' : 'text-amber-900'}`}>star</span>
                  ))}
                </div>
                <span className="text-sm font-bold text-amber-100">{avgRating.toFixed(1)}</span>
                <span className="text-xs text-amber-400/50">Note moyenne</span>
              </div>
            )}

            <button
              onClick={() => setShowInvitations(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-bold py-3 rounded-2xl active:scale-95 transition-all shadow-lg shadow-amber-900/40"
            >
              <span className="material-symbols-outlined text-[16px]">mail</span>
              Invitations du Cercle
            </button>
          </div>
        </div>
      </div>

      {currentUserId && (
        <div className="px-6 pb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[16px] fill-1 shrink-0 mt-0.5">star</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              Publie des photos de tes créations pour les partager en exclusivité avec les membres du Cercle.
            </p>
          </div>
          <CulinaryGallery userId={currentUserId} isOwner={true} />
        </div>
      )}
    </div>
  );
}
