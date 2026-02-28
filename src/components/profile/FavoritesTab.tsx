import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { CATEGORY_CONFIG, formatMealTiming } from '../../lib/mealUtils';

interface FavoriteChef {
  id: string;
  name: string;
  avatar_url: string | null;
  rating: number;
  meals_given: number;
  bio: string | null;
  activeMeals: ActiveMeal[];
}

interface ActiveMeal {
  id: string;
  title: string;
  category: string | null;
  meal_date: string | null;
  slots_total: number;
  slots_taken: number;
  location_name: string;
}

interface FavoritesTabProps {
  currentUserId: string | null;
}

const FALLBACK_AVATAR = 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?w=60';

export default function FavoritesTab({ currentUserId }: FavoritesTabProps) {
  const [chefs, setChefs] = useState<FavoriteChef[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadFavoriteChefs = useCallback(async () => {
    if (!currentUserId) { setLoading(false); return; }
    setLoading(true);

    const { data: favData } = await supabase
      .from('chef_favorites')
      .select('chef_id, profiles!chef_id(id, name, avatar_url, rating, meals_given, bio)')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    if (!favData || favData.length === 0) {
      setChefs([]);
      setLoading(false);
      return;
    }

    const chefIds = favData.map((f: { chef_id: string }) => f.chef_id);

    const { data: mealsData } = await supabase
      .from('meals')
      .select('id, title, category, meal_date, slots_total, slots_taken, location_name, host_id')
      .in('host_id', chefIds)
      .or('claimed.eq.false,claimed.is.null')
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .lt('slots_taken', 'slots_total')
      .order('created_at', { ascending: false });

    const mealsByChef: Record<string, ActiveMeal[]> = {};
    if (mealsData) {
      for (const m of mealsData as (ActiveMeal & { host_id: string })[]) {
        if (m.slots_taken >= m.slots_total) continue;
        if (!mealsByChef[m.host_id]) mealsByChef[m.host_id] = [];
        mealsByChef[m.host_id].push(m);
      }
    }

    const result: FavoriteChef[] = favData
      .map((f: { chef_id: string; profiles: unknown }) => {
        const p = f.profiles as { id: string; name: string; avatar_url: string | null; rating: number; meals_given: number; bio: string | null } | null;
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          avatar_url: p.avatar_url,
          rating: p.rating ?? 0,
          meals_given: p.meals_given ?? 0,
          bio: p.bio,
          activeMeals: mealsByChef[p.id] ?? [],
        };
      })
      .filter((c): c is FavoriteChef => c !== null);

    setChefs(result);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => { loadFavoriteChefs(); }, [loadFavoriteChefs]);

  async function removeChef(chefId: string) {
    if (!currentUserId || removingId) return;
    setRemovingId(chefId);
    await supabase
      .from('chef_favorites')
      .delete()
      .eq('user_id', currentUserId)
      .eq('chef_id', chefId);
    setChefs((prev) => prev.filter((c) => c.id !== chefId));
    setRemovingId(null);
  }

  if (loading) {
    return (
      <div className="space-y-3 px-6 mt-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (chefs.length === 0) {
    return (
      <div className="px-6 mt-6">
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm">
          <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-orange-300 text-[28px]">person_heart</span>
          </div>
          <p className="font-bold text-slate-700">Aucun chef favori</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Appuie sur le coeur d'un hôte pour le suivre et voir ses prochains repas ici
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 mt-4 space-y-3">
      {chefs.map((chef) => (
        <div key={chef.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <img
                src={chef.avatar_url || FALLBACK_AVATAR}
                alt={chef.name}
                className="w-12 h-12 rounded-full object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-[15px] truncate">{chef.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {chef.rating > 0 && (
                    <div className="flex items-center gap-0.5">
                      <span className="material-symbols-outlined fill-1 text-amber-400 text-[13px]">star</span>
                      <span className="text-xs text-slate-500 font-medium">{chef.rating.toFixed(1)}</span>
                    </div>
                  )}
                  <span className="text-xs text-slate-400">{chef.meals_given} repas partagés</span>
                </div>
              </div>
              <button
                onClick={() => removeChef(chef.id)}
                disabled={removingId === chef.id}
                className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0 transition-transform active:scale-90"
              >
                <span className="material-symbols-outlined text-[17px] fill-1 text-red-400">favorite</span>
              </button>
            </div>

            {chef.bio && (
              <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{chef.bio}</p>
            )}

            {chef.activeMeals.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-slate-50 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {chef.activeMeals.length} repas disponible{chef.activeMeals.length > 1 ? 's' : ''}
                </p>
                {chef.activeMeals.slice(0, 2).map((meal) => {
                  const cat = (meal.category || 'homemade_meal') as 'food_rescue' | 'homemade_meal';
                  const cfg = CATEGORY_CONFIG[cat];
                  const timing = formatMealTiming(meal.meal_date);
                  const spotsLeft = meal.slots_total - meal.slots_taken;

                  return (
                    <div key={meal.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                        style={{ background: cfg.bg }}
                      >
                        {cat === 'food_rescue' ? '♻️' : '🍽️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{meal.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{timing.day} {timing.time} · {meal.location_name}</p>
                      </div>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {spotsLeft}p
                      </span>
                    </div>
                  );
                })}
                {chef.activeMeals.length > 2 && (
                  <p className="text-[10px] text-slate-400 text-center">
                    +{chef.activeMeals.length - 2} autres repas
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-slate-50">
                <p className="text-xs text-slate-400 text-center">Aucun repas disponible en ce moment</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
