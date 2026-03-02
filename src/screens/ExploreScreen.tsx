import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Meal, Screen, CulinaryChallenge } from '../types';
import { supabase } from '../lib/supabase';
import {
  CATEGORY_CONFIG,
  getMealCategory,
  formatExpiry,
  isExpiringSoon,
  formatMealTiming,
} from '../lib/mealUtils';
import BottomNav from '../components/BottomNav';
import BookingModal from '../components/BookingModal';
import ReportMealModal from '../components/ReportMealModal';
import MealDetailModal from '../components/MealDetailModal';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullIndicator from '../components/PullIndicator';
import CulinaryGallery from '../components/culinary/CulinaryGallery';

type CategoryFilter = 'all' | 'food_rescue' | 'homemade_meal' | 'cercle_culinaire';

interface ExploreScreenProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  unreadBookings?: number;
  onEditMeal?: (meal: Meal) => void;
  onContactMember?: (hostId: string, hostName: string, hostAvatar: string) => void;
  onNavigateToChallenges?: () => void;
}

const FALLBACK_AVATAR = 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?w=60';

const CATEGORY_TABS: { key: CategoryFilter; label: string; color: string }[] = [
  { key: 'all', label: 'Tout', color: '#374151' },
  { key: 'homemade_meal', label: '🍽️ Repas maison', color: '#f97316' },
  { key: 'food_rescue', label: '♻️ Anti-gaspi', color: '#16a34a' },
  { key: 'cercle_culinaire', label: 'Cercle', color: '#b91c1c' },
];

const FILTER_STORAGE_KEY = 'shareeat_filters';

function loadStoredFilters() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { categoryFilter: string; selectedDiets: string[] };
  } catch { return null; }
}

export default function ExploreScreen({
  activeScreen,
  onNavigate,
  unreadBookings = 0,
  onEditMeal,
  onContactMember,
  onNavigateToChallenges,
}: ExploreScreenProps) {
  const storedFilters = loadStoredFilters();
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(
    (storedFilters?.categoryFilter as CategoryFilter) ?? 'all'
  );
  const [selectedDiets, setSelectedDiets] = useState<Set<string>>(new Set(storedFilters?.selectedDiets ?? []));

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
          categoryFilter, selectedDiets: Array.from(selectedDiets),
        }));
      } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(timeout);
  }, [categoryFilter, selectedDiets]);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const pendingLikeRef = useRef<Set<string>>(new Set());
  const [blockedHostIds, setBlockedHostIds] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [bookingMeal, setBookingMeal] = useState<Meal | null>(null);
  const [bookedMeals, setBookedMeals] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserIsPremium, setCurrentUserIsPremium] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reportingMeal, setReportingMeal] = useState<Meal | null>(null);
  const [detailMeal, setDetailMeal] = useState<Meal | null>(null);
  const [challenges, setChallenges] = useState<CulinaryChallenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);

  const fetchChallenges = useCallback(async () => {
    setChallengesLoading(true);
    const { data } = await supabase
      .from('culinary_challenges')
      .select('*, creator:creator_id(id, name, avatar_url, shares_count)')
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) { setChallenges([]); setChallengesLoading(false); return; }

    const ids = (data as CulinaryChallenge[]).map((c) => c.id);
    const { data: membersData } = await supabase
      .from('culinary_challenge_members')
      .select('challenge_id, status')
      .in('challenge_id', ids)
      .eq('status', 'accepted');

    const countMap: Record<string, number> = {};
    (membersData ?? []).forEach((m: { challenge_id: string }) => {
      countMap[m.challenge_id] = (countMap[m.challenge_id] ?? 0) + 1;
    });

    setChallenges((data as CulinaryChallenge[]).map((c) => ({ ...c, member_count: countMap[c.id] ?? 0 })));
    setChallengesLoading(false);
  }, []);

  const fetchMeals = useCallback(async () => {
    setLoadError(false);
    const { data, error } = await supabase
      .from('meals')
      .select('*, host:profiles!host_id(id, name, avatar_url, shares_count)')
      .or('claimed.eq.false,claimed.is.null')
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .neq('meal_type', 'culinary_circle')
      .order('created_at', { ascending: false });
    if (error) { setLoadError(true); return; }
    if (data) setMeals((data as Meal[]).filter((m) => m.slots_taken < m.slots_total));
  }, []);

  const { containerRef: scrollRef, indicatorRef } = usePullToRefresh(() => { fetchMeals(); fetchChallenges(); });

  const toggleDiet = useCallback((tag: string) => {
    setSelectedDiets((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, [setSelectedDiets]);

  const resetFilters = useCallback(() => {
    setSelectedDiets(new Set());
    setCategoryFilter('all');
  }, [setSelectedDiets, setCategoryFilter]);

  useEffect(() => {
    const init = async () => {
      const [{ data: { user } }] = await Promise.all([supabase.auth.getUser()]);
      const uid = user?.id ?? null;
      setCurrentUserId(uid);

      if (uid) {
        const [participations, blockedResult, favoritesResult, profileResult] = await Promise.all([
          supabase
            .from('meal_participants')
            .select('meal_id')
            .eq('user_id', uid)
            .eq('delivered', false)
            .eq('no_show', false),
          supabase
            .from('blocked_users')
            .select('blocked_id')
            .eq('blocker_id', uid),
          supabase
            .from('chef_favorites')
            .select('chef_id')
            .eq('user_id', uid),
          supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', uid)
            .maybeSingle(),
        ]);

        if (participations.data) {
          setBookedMeals(new Set(participations.data.map((p: { meal_id: string }) => p.meal_id)));
        }
        if (blockedResult.data) {
          setBlockedHostIds(new Set(blockedResult.data.map((b: { blocked_id: string }) => b.blocked_id)));
        }
        if (favoritesResult.data) {
          setLikedIds(new Set(favoritesResult.data.map((f: { chef_id: string }) => f.chef_id)));
        }
        if (profileResult.data) {
          setCurrentUserIsPremium(profileResult.data.is_premium ?? false);
        }
      }
    };

    init();
    fetchMeals();
    fetchChallenges();

    const mealsSub = supabase
      .channel('meals-slots-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meals' },
        (payload) => {
          const updated = payload.new as { id: string; slots_taken: number; slots_total: number; claimed: boolean | null };
          setMeals((prev) => {
            const isFull = updated.slots_taken >= updated.slots_total;
            const isClaimed = updated.claimed === true;
            if (isFull || isClaimed) {
              return prev.filter((m) => m.id !== updated.id);
            }
            return prev.map((m) =>
              m.id === updated.id ? { ...m, slots_taken: updated.slots_taken } : m
            );
          });
          setDetailMeal((prev) => {
            if (!prev || prev.id !== updated.id) return prev;
            const isFull = updated.slots_taken >= updated.slots_total;
            if (isFull) return null;
            return { ...prev, slots_taken: updated.slots_taken };
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(mealsSub); };
  }, [fetchMeals, fetchChallenges]);

  async function toggleLike(chefId: string) {
    if (!currentUserId) return;
    if (pendingLikeRef.current.has(chefId)) return;

    pendingLikeRef.current.add(chefId);
    const wasLiked = likedIds.has(chefId);

    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(chefId);
      else next.add(chefId);
      return next;
    });

    let error: unknown = null;
    if (wasLiked) {
      const result = await supabase
        .from('chef_favorites')
        .delete()
        .eq('user_id', currentUserId)
        .eq('chef_id', chefId);
      error = result.error;
    } else {
      const result = await supabase
        .from('chef_favorites')
        .insert({ user_id: currentUserId, chef_id: chefId });
      error = result.error;
    }

    if (error) {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(chefId);
        else next.delete(chefId);
        return next;
      });
    }

    pendingLikeRef.current.delete(chefId);
  }

  const filteredMeals = useMemo(() => {
    return meals.filter((m) => {
      if (m.host_id && m.host_id !== currentUserId && blockedHostIds.has(m.host_id)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = m.title?.toLowerCase() || '';
        const desc = m.description?.toLowerCase() || '';
        const loc = m.location_name?.toLowerCase() || '';
        if (!title.includes(q) && !desc.includes(q) && !loc.includes(q)) return false;
      }

      if (categoryFilter === 'cercle_culinaire') {
        const hostSharesCount = (m.host as unknown as { shares_count?: number } | null)?.shares_count ?? 0;
        if (hostSharesCount < 10) return false;
        if (m.host_id === currentUserId) return false;
      } else if (categoryFilter !== 'all' && getMealCategory(m) !== categoryFilter) {
        return false;
      }

      if (selectedDiets.size > 0) {
        const tags = (m.allergens || []).map((a: string) => a.toLowerCase());
        const hasAny = tags.some((tag) => selectedDiets.has(tag));
        if (!hasAny) return false;
      }

      return true;
    });
  }, [meals, searchQuery, categoryFilter, selectedDiets, blockedHostIds, currentUserId]);

  const hasActiveFilters = selectedDiets.size > 0 || categoryFilter !== 'all';

  return (
    <div className="flex flex-col h-app bg-[#F5F5F0] font-display">
      <header className="sticky top-0 z-20 bg-[#F5F5F0]/90 backdrop-blur-md px-6 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 44px) + 12px)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Explorer</h1>
            <p className="text-sm text-slate-500">Réduisons le gaspillage ensemble</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 relative"
          >
            <span className="material-symbols-outlined text-slate-600 text-[22px]">tune</span>
            {hasActiveFilters && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#16a34a] rounded-full border-2 border-white" />
            )}
          </button>
        </div>
        <div className="relative mb-3">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
          <input
            className="w-full bg-white border-none rounded-xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-[#16a34a] outline-none placeholder:text-slate-400 text-slate-900"
            placeholder="Rechercher aliments, plats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCategoryFilter(tab.key)}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${tab.key === 'cercle_culinaire' && categoryFilter === tab.key ? 'text-white' : ''}`}
              style={tab.key === 'cercle_culinaire' ? {
                background: categoryFilter === tab.key
                  ? 'linear-gradient(135deg, #92400e, #78350f)'
                  : 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                color: categoryFilter === tab.key ? '#fef3c7' : '#92400e',
                border: `2px solid ${categoryFilter === tab.key ? '#92400e' : '#fcd34d'}`,
                boxShadow: categoryFilter === tab.key ? '0 2px 8px rgba(146,64,14,0.35)' : '0 1px 3px rgba(0,0,0,0.07)',
              } : {
                background: categoryFilter === tab.key ? tab.color : 'white',
                color: categoryFilter === tab.key ? 'white' : tab.color,
                border: `2px solid ${categoryFilter === tab.key ? tab.color : '#e5e7eb'}`,
                boxShadow: categoryFilter === tab.key ? `0 2px 8px ${tab.color}44` : '0 1px 3px rgba(0,0,0,0.07)',
              }}
            >
              {tab.key === 'cercle_culinaire' && (
                <span className="material-symbols-outlined text-[11px] fill-1">emoji_food_beverage</span>
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main ref={(el) => { scrollRef.current = el; }} className="flex-1 overflow-y-auto hide-scrollbar px-6 py-4 space-y-5 pb-28 relative">
        <PullIndicator ref={indicatorRef} />
        {categoryFilter === 'all' && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-lg">🌿</span>
            </div>
            <div>
              <p className="text-sm font-bold text-green-900">Repas partagés & aliments sauvés</p>
              <p className="text-xs text-green-700 leading-relaxed mt-0.5">
                Des voisins cuisinent pour partager, d'autres proposent des aliments qui arrivent à expiration. Tout est bienvenu.
              </p>
            </div>
          </div>
        )}
        {categoryFilter === 'food_rescue' && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-lg">♻️</span>
            </div>
            <div>
              <p className="text-sm font-bold text-green-900">Anti-gaspillage en priorité</p>
              <p className="text-xs text-green-700 leading-relaxed mt-0.5">
                ShareEat aide à sauver les aliments avant qu'ils expirent. Récupérez gratuitement, sans engagement.
              </p>
            </div>
          </div>
        )}

        {(categoryFilter === 'all' || categoryFilter === 'cercle_culinaire') && challenges.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#d97706,#92400e)' }}>
                  <span className="material-symbols-outlined text-white text-[15px]">emoji_events</span>
                </div>
                <h2 className="text-base font-bold text-slate-900">Défis culinaires</h2>
              </div>
              <button
                onClick={() => onNavigateToChallenges ? onNavigateToChallenges() : onNavigate('culinary')}
                className="text-xs font-bold text-amber-700 flex items-center gap-0.5"
              >
                Voir tous
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
              {challengesLoading
                ? [0, 1].map((i) => (
                    <div key={i} className="shrink-0 w-52 h-28 rounded-2xl bg-slate-100 animate-pulse" />
                  ))
                : challenges.map((c) => {
                    const statusLabel = c.status === 'open' ? 'Ouvert' : 'En cours';
                    const statusColor = c.status === 'open' ? '#16a34a' : '#d97706';
                    const spotsLeft = c.max_members - (c.member_count ?? 0);
                    return (
                      <button
                        key={c.id}
                        onClick={() => onNavigateToChallenges ? onNavigateToChallenges() : onNavigate('culinary')}
                        className="shrink-0 w-52 rounded-2xl text-left overflow-hidden border border-amber-100 shadow-sm"
                        style={{ background: 'linear-gradient(145deg, #fffbeb, #fef3c7)' }}
                      >
                        <div className="p-3.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: statusColor }}>
                              {statusLabel}
                            </span>
                            <span className="text-[10px] text-amber-700 font-semibold">
                              {c.member_count ?? 0}/{c.max_members} membres
                            </span>
                          </div>
                          <p className="text-sm font-bold text-amber-950 leading-tight line-clamp-2 mb-2">{c.title}</p>
                          <div className="flex items-center gap-1.5">
                            {c.creator?.avatar_url && (
                              <img src={c.creator.avatar_url} alt={c.creator.name} className="w-5 h-5 rounded-full object-cover" />
                            )}
                            <p className="text-[11px] text-amber-800 truncate">{c.creator?.name}</p>
                          </div>
                          {spotsLeft > 0 && c.status === 'open' && (
                            <div className="mt-2 pt-2 border-t border-amber-200">
                              <p className="text-[10px] font-bold text-amber-700">{spotsLeft} place{spotsLeft > 1 ? 's' : ''} disponible{spotsLeft > 1 ? 's' : ''}</p>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
            </div>
          </div>
        )}
        {categoryFilter === 'homemade_meal' && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-lg">🍽️</span>
            </div>
            <div>
              <p className="text-sm font-bold text-orange-900">Repas maison partagé</p>
              <p className="text-xs text-orange-700 leading-relaxed mt-0.5">
                Tu cuisines pour trop de monde ? Partage ton repas avec tes voisins.
              </p>
            </div>
          </div>
        )}
        {categoryFilter === 'cercle_culinaire' && !currentUserIsPremium && (
          <div className="flex flex-col items-center py-12 gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900 flex items-center justify-center shadow-xl">
                <span className="material-symbols-outlined text-amber-400 text-[38px] fill-1">workspace_premium</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-amber-950 text-[16px]">lock</span>
              </div>
            </div>
            <div className="text-center px-4">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Cercle Culinaire</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-1">
                Cet espace est réservé aux membres premium.
              </p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Les membres du Cercle se retrouvent ici pour s'inviter à des repas exclusifs entre passionnés.
              </p>
            </div>
            <div className="w-full bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, #fbbf24 0%, transparent 50%), radial-gradient(circle at 80% 20%, #f59e0b 0%, transparent 40%)'
              }} />
              <p className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-3 relative">Avantages inclus</p>
              <div className="space-y-3 relative">
                {[
                  { icon: 'restaurant', label: 'Repas exclusifs entre membres' },
                  { icon: 'group', label: 'Réseau privé de passionnés' },
                  { icon: 'star', label: 'Badge Cercle Culinaire visible' },
                  { icon: 'explore', label: 'Invitations sans limite de distance' },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-amber-400/20 rounded-lg flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-amber-400 text-[15px]">{icon}</span>
                    </div>
                    <p className="text-sm text-amber-100">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center px-4">
              Partage 10 repas pour débloquer le statut premium et rejoindre le Cercle.
            </p>
          </div>
        )}
        {categoryFilter === 'cercle_culinaire' && currentUserIsPremium && currentUserId && (
          <>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900 p-4 flex items-start gap-3">
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, #fbbf24 0%, transparent 50%), radial-gradient(circle at 80% 20%, #f59e0b 0%, transparent 40%)'
              }} />
              <div className="w-10 h-10 bg-amber-400/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5 relative">
                <span className="material-symbols-outlined text-amber-400 text-[20px] fill-1">workspace_premium</span>
              </div>
              <div className="relative">
                <p className="text-sm font-bold text-amber-100">Cercle Culinaire — Galerie privée</p>
                <p className="text-xs text-amber-300/70 leading-relaxed mt-0.5">
                  Les créations culinaires partagées en exclusivité par les membres du Cercle.
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-950/80 via-stone-900/90 to-amber-900/80 rounded-2xl p-4 mt-0">
              <CulinaryGallery userId={currentUserId} isOwner={true} isCommunityFeed currentUserId={currentUserId} />
            </div>
          </>
        )}

        {loadError && (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-red-400 text-[28px]">wifi_off</span>
            </div>
            <p className="font-bold text-slate-700">Impossible de charger les annonces</p>
            <p className="text-sm text-slate-400 text-center">Vérifie ta connexion et réessaie</p>
            <button
              onClick={() => { setLoadError(false); window.location.reload(); }}
              className="mt-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-full"
            >
              Réessayer
            </button>
          </div>
        )}

        {!loadError && meals.length === 0 &&
          [0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
              <div className="h-48 bg-slate-100" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-slate-100 rounded w-3/4" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-4 bg-slate-100 rounded w-1/3" />
              </div>
            </div>
          ))}

        {!(categoryFilter === 'cercle_culinaire') && filteredMeals.map((meal) => {
          const cat = getMealCategory(meal);
          const cfg = CATEGORY_CONFIG[cat];
          const isFoodRescue = cat === 'food_rescue';
          const mealWithExtra = meal as unknown as { category?: string; expires_at?: string | null; quantity?: string | null };
          const spotsLeft = meal.slots_total - meal.slots_taken;
          const timing = formatMealTiming(meal.meal_date);
          const hostName = meal.host?.name || 'Utilisateur';
          const hostAvatar = meal.host?.avatar_url || FALLBACK_AVATAR;
          const hostSharesCount = (meal.host as unknown as { shares_count?: number } | null)?.shares_count ?? 0;
          const isTrustedCook = hostSharesCount >= 10;
          const isLiked = meal.host_id ? likedIds.has(meal.host_id) : false;
          const isOwnMeal = meal.host_id === currentUserId;
          const expiringSoon = isFoodRescue && isExpiringSoon(mealWithExtra.expires_at);

          if (isFoodRescue) {
            return (
              <button
                key={meal.id}
                onClick={() => setDetailMeal(meal)}
                className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border text-left"
                style={{ borderColor: expiringSoon ? '#fca5a5' : '#d1fae5', borderLeftWidth: 4, borderLeftColor: cfg.color }}
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 text-3xl"
                      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
                      ♻️
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: cfg.color }}>
                          Anti-gaspi
                        </span>
                        {expiringSoon && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-red-700 bg-red-50 border border-red-200">
                            Expire bientôt
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight truncate">{meal.title}</h3>
                      {mealWithExtra.quantity && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{mealWithExtra.quantity}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <img src={hostAvatar} alt={hostName} className="w-5 h-5 rounded-full object-cover" />
                        <p className="text-xs text-slate-500">{hostName}</p>
                      </div>
                    </div>
                    {!isOwnMeal && meal.host_id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleLike(meal.host_id!); }}
                        className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0 transition-transform active:scale-90"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${isLiked ? 'fill-1 text-red-500' : 'text-slate-400'}`}>favorite</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                    <div>
                      {mealWithExtra.expires_at && (
                        <p className="text-sm font-semibold" style={{ color: expiringSoon ? '#dc2626' : '#16a34a' }}>
                          {formatExpiry(mealWithExtra.expires_at)}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[13px]">location_on</span>
                        {meal.location_name || 'Quartier'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {meal.host_id !== currentUserId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setReportingMeal(meal); }}
                          className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[17px]">flag</span>
                        </button>
                      )}
                      {meal.host_id === currentUserId ? (
                        <span className="font-bold py-2 px-5 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-default">
                          Mon annonce
                        </span>
                      ) : bookedMeals.has(meal.id) ? (
                        <span className="flex items-center gap-1 font-bold py-2.5 px-4 rounded-xl text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Réservé
                        </span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setBookingMeal(meal); }}
                          className="font-bold py-2.5 px-5 rounded-xl text-sm text-white transition-all active:scale-95"
                          style={{ background: cfg.color }}
                        >
                          Récupérer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          }

          return (
            <button
              key={meal.id}
              onClick={() => setDetailMeal(meal)}
              className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50 text-left"
            >
              <div className="relative h-48 w-full">
                <img
                  src={meal.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                  alt={meal.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: cfg.color }}>
                    Repas maison
                  </span>
                  <span className="bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full" style={{ background: spotsLeft <= 1 ? '#f97316' : '#16a34a' }} />
                    {spotsLeft} place{spotsLeft !== 1 ? 's' : ''}
                  </span>
                </div>
                {!isOwnMeal && meal.host_id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLike(meal.host_id!); }}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-sm transition-transform active:scale-90"
                  >
                    <span className={`material-symbols-outlined text-[19px] ${isLiked ? 'fill-1 text-red-500' : 'text-slate-900'}`}>favorite</span>
                  </button>
                )}
              </div>

              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-[17px] font-bold text-slate-900 leading-tight flex-1 pr-2">{meal.title}</h3>
                  <span className="flex items-center gap-1 bg-[#f0fdf4] px-2.5 py-1 rounded-full text-xs font-bold text-[#16a34a] shrink-0">
                    <span className="material-symbols-outlined text-[13px]">volunteer_activism</span>
                    Gratuit
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <img src={hostAvatar} alt={hostName} className="w-6 h-6 rounded-full object-cover bg-slate-200" />
                  <p className="text-sm text-slate-500">{hostName}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{timing.day}</span>
                    <span className="text-sm font-medium text-slate-700">{timing.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {meal.host_id !== currentUserId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setReportingMeal(meal); }}
                        className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[17px]">flag</span>
                      </button>
                    )}
                    {meal.host_id === currentUserId ? (
                      <span className="font-bold py-2.5 px-5 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-default">
                        Mon repas
                      </span>
                    ) : categoryFilter === 'cercle_culinaire' && onContactMember ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onContactMember(meal.host_id!, hostName, hostAvatar); }}
                        className="flex items-center gap-1.5 font-bold py-2.5 px-4 rounded-xl text-sm text-white transition-all active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #92400e, #78350f)' }}
                      >
                        <span className="material-symbols-outlined text-[16px]">chat</span>
                        Contacter
                      </button>
                    ) : bookedMeals.has(meal.id) ? (
                      <span className="flex items-center gap-1 font-bold py-2.5 px-4 rounded-xl text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Réservé
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setBookingMeal(meal); }}
                        className="font-bold py-2.5 px-5 rounded-xl text-sm text-white transition-all active:scale-95"
                        style={{ background: cfg.color }}
                      >
                        Rejoindre
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {filteredMeals.length === 0 && meals.length > 0 && categoryFilter !== 'cercle_culinaire' && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              {categoryFilter === 'food_rescue' ? '♻️' : categoryFilter === 'cercle_culinaire' ? '👨‍🍳' : '🍽️'}
            </div>
            <p className="font-bold text-slate-700 text-lg">Aucune annonce</p>
            <p className="text-sm text-slate-400 mt-1">
              {categoryFilter === 'food_rescue'
                ? "Pas d'aliments à sauver pour l'instant"
                : categoryFilter === 'cercle_culinaire'
                  ? 'Aucun chef du Cercle Culinaire disponible pour l\'instant'
                  : 'Pas de repas maison disponibles'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-4 px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-full"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
      </main>

      <div className="fixed right-6 bottom-28 z-30">
        <button
          onClick={() => onNavigate('create')}
          className="w-14 h-14 bg-slate-900 rounded-full shadow-2xl flex items-center justify-center text-white transition-transform active:scale-90"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-slate-100">
        <BottomNav active={activeScreen} onChange={onNavigate} unreadBookings={unreadBookings} />
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-md mx-auto">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '88dvh' }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Filtres</h2>
                <button
                  onClick={resetFilters}
                  className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Tout réinitialiser
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-4">
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-700">Catégorie</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setCategoryFilter(tab.key)}
                      className="px-4 py-2 rounded-full border text-sm font-semibold transition-all flex items-center gap-1.5"
                      style={tab.key === 'cercle_culinaire' ? {
                        borderColor: categoryFilter === tab.key ? '#92400e' : '#fcd34d',
                        background: categoryFilter === tab.key ? '#92400e18' : '#fffbeb',
                        color: '#92400e',
                      } : {
                        borderColor: categoryFilter === tab.key ? tab.color : '#e2e8f0',
                        background: categoryFilter === tab.key ? `${tab.color}18` : 'white',
                        color: categoryFilter === tab.key ? tab.color : '#475569',
                      }}
                    >
                      {tab.key === 'cercle_culinaire' && (
                        <span className="material-symbols-outlined text-[13px] fill-1">emoji_food_beverage</span>
                      )}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-700">Régime alimentaire</p>
                <div className="flex flex-wrap gap-2">
                  {[
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
                  ].map(({ label, icon }) => (
                    <button
                      key={label}
                      onClick={() => toggleDiet(label)}
                      className={`px-3 py-2 rounded-full border text-sm font-semibold transition-all flex items-center gap-1.5 ${
                        selectedDiets.has(label)
                          ? 'border-[#16a34a] bg-green-50 text-[#16a34a]'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 pb-8 pt-3 shrink-0 border-t border-slate-100">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full h-14 bg-slate-900 text-white font-bold rounded-full transition-transform active:scale-[0.98]"
              >
                Appliquer les filtres
              </button>
            </div>
          </div>
        </div>
      )}

      {detailMeal && (
        <MealDetailModal
          meal={detailMeal}
          currentUserId={currentUserId}
          onClose={() => setDetailMeal(null)}
          onBook={(m) => setBookingMeal(m)}
          isBooked={bookedMeals.has(detailMeal.id)}
          isFavorited={detailMeal.host_id ? likedIds.has(detailMeal.host_id) : false}
          onToggleFavorite={detailMeal.host_id && detailMeal.host_id !== currentUserId ? () => toggleLike(detailMeal.host_id!) : undefined}
          onEditMeal={onEditMeal ? (m) => { onEditMeal(m); setDetailMeal(null); } : undefined}
          onDeleteMeal={currentUserId === detailMeal.host_id ? async (mealId) => {
            const { data: result } = await supabase.rpc('delete_meal', {
              p_meal_id: mealId,
              p_host_id: currentUserId,
            });
            if (result === 'ok' || result === 'not_found') {
              setMeals((prev) => prev.filter((m) => m.id !== mealId));
              setDetailMeal(null);
            }
          } : undefined}
        />
      )}

      {bookingMeal && (
        <BookingModal
          meal={bookingMeal}
          hostName={bookingMeal.host?.name || 'Hôte'}
          hostAvatar={bookingMeal.host?.avatar_url || FALLBACK_AVATAR}
          timing={formatMealTiming(bookingMeal.meal_date)}
          onClose={() => setBookingMeal(null)}
          onBooked={(mealId) => {
            setBookedMeals((prev) => new Set(prev).add(mealId));
            const bookedMeal = meals.find((m) => m.id === mealId);
            if (bookedMeal) {
              const newSlotsTaken = bookedMeal.slots_taken + 1;
              const isFull = newSlotsTaken >= bookedMeal.slots_total;
              const isRescue = getMealCategory(bookedMeal) === 'food_rescue';
              if (isFull || isRescue) {
                setTimeout(() => {
                  setMeals((prev) => prev.filter((m) => m.id !== mealId));
                }, 3000);
              } else {
                setMeals((prev) =>
                  prev.map((m) => m.id === mealId ? { ...m, slots_taken: newSlotsTaken } : m)
                );
              }
            }
          }}
        />
      )}

      {reportingMeal && currentUserId && (
        <ReportMealModal
          mealId={reportingMeal.id}
          mealTitle={reportingMeal.title}
          reporterId={currentUserId}
          onClose={() => setReportingMeal(null)}
        />
      )}
    </div>
  );
}
