import { useState, useEffect, useCallback, Fragment } from 'react';
import { Screen } from '../types';
import BottomNav from '../components/BottomNav';
import { supabase } from '../lib/supabase';
import EditProfileModal from '../components/settings/EditProfileModal';
import ReviewModal from '../components/ReviewModal';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullIndicator from '../components/PullIndicator';
import FavoritesTab from '../components/profile/FavoritesTab';
import XpHistoryTab from '../components/profile/XpHistoryTab';
import NotificationsModal from '../components/NotificationsModal';
import DonationModal from '../components/DonationModal';

interface EditMealData {
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

interface ProfileScreenProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  unreadBookings?: number;
  onNotificationsOpen?: () => void;
  onEditMeal?: (meal: EditMealData) => void;
}

interface Profile {
  id: string;
  name: string;
  avatar_url: string;
  bio: string;
  location_name: string;
  rating: number;
  xp: number;
  meals_given: number;
  meals_taken: number;
  karma_balance: number;
  shares_count: number;
  is_premium: boolean;
  created_at: string;
}

interface SharedMeal {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
  slots_taken: number;
  category: string | null;
  slots_total: number;
  allergens: string[];
  meal_date: string | null;
  expires_at: string | null;
  quantity: string | null;
  location_lat: number;
  location_lng: number;
  location_name: string;
}

interface RecoveredMeal {
  meal_id: string;
  joined_at: string;
  delivered: boolean;
  meals: {
    id: string;
    title: string;
    image_url: string | null;
    category: string | null;
    location_name: string;
    host_id: string;
  };
}

interface PendingBooking {
  id: string;
  joined_at: string;
  delivered: boolean;
  no_show: boolean;
  meal_id: string;
  user_id: string;
  meals: {
    id: string;
    title: string;
    image_url: string | null;
    category: string | null;
    slots_taken: number;
    slots_total: number;
  };
  profiles: {
    name: string;
    avatar_url: string | null;
  };
}

const SHARES_FOR_CIRCLE = 10;

function KarmaBar({ karma }: { karma: number }) {
  const [showInfo, setShowInfo] = useState(false);
  const pct = Math.min(Math.max((karma + 10) / 20, 0), 1) * 100;
  const color = karma >= 0 ? '#49e619' : karma >= -5 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Karma communautaire</span>
          <button onClick={() => setShowInfo((p) => !p)} className="text-slate-300 hover:text-slate-500 transition-colors">
            <span className="material-symbols-outlined text-[14px]">info</span>
          </button>
        </div>
        <span className="text-xs font-bold" style={{ color }}>
          {karma > 0 ? `+${karma}` : karma}
        </span>
      </div>
      {showInfo && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-2 text-[11px] text-slate-500 leading-relaxed">
          +1 karma chaque fois que tu partages un repas. -1 quand tu en récupères ou que tu ne te présentes pas. En dessous de -10, ton compte est temporairement restreint.
        </div>
      )}
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-400">-10 (bloqué)</span>
        <span className="text-[10px] text-slate-400">0</span>
        <span className="text-[10px] text-slate-400">+10</span>
      </div>
    </div>
  );
}

function XpBar({ xp }: { xp: number }) {
  const [showInfo, setShowInfo] = useState(false);
  const XP_PER_SHARE = 10;
  const nextMilestone = Math.ceil((xp + 1) / XP_PER_SHARE) * XP_PER_SHARE;
  const pct = Math.min((xp / Math.max(nextMilestone, XP_PER_SHARE)) * 100, 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Expérience (XP)</span>
          <button onClick={() => setShowInfo((p) => !p)} className="text-slate-300 hover:text-slate-500 transition-colors">
            <span className="material-symbols-outlined text-[14px]">info</span>
          </button>
        </div>
        <span className="text-xs font-bold text-[#49e619]">{xp} XP</span>
      </div>
      {showInfo && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-2 text-[11px] text-slate-500 leading-relaxed">
          +10 XP à chaque repas partagé. L'XP représente ton engagement dans la communauté ShareEat.
        </div>
      )}
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#49e619] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-1">+10 XP par repas partagé · Prochain palier : {nextMilestone} XP</p>
    </div>
  );
}

function SharesBar({ shares, max }: { shares: number; max: number }) {
  const pct = Math.min((shares / max) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Cercle Culinaire</span>
        <span className="text-xs font-bold text-[#49e619]">{shares} / {max} partages</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#49e619] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-slate-400 mt-1">
        {shares >= max ? 'Cercle Culinaire débloqué !' : `Plus que ${max - shares} partage${max - shares > 1 ? 's' : ''} pour rejoindre le Cercle Culinaire`}
      </p>
    </div>
  );
}


function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProfileScreen({ activeScreen, onNavigate, unreadBookings = 0, onNotificationsOpen, onEditMeal }: ProfileScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [sharedMeals, setSharedMeals] = useState<SharedMeal[]>([]);
  const [mealsLoading, setMealsLoading] = useState(true);
  const [recoveredMeals, setRecoveredMeals] = useState<RecoveredMeal[]>([]);
  const [recoveredLoading, setRecoveredLoading] = useState(true);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [reviewBooking, setReviewBooking] = useState<PendingBooking | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'activity' | 'favorites' | 'xp'>('activity');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDonation, setShowDonation] = useState(false);
  const [blockConfirmId, setBlockConfirmId] = useState<string | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancellingMealId, setCancellingMealId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [deleteMealConfirmId, setDeleteMealConfirmId] = useState<string | null>(null);
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null);
  const [noShowConfirmId, setNoShowConfirmId] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setMealsLoading(false); setRecoveredLoading(false); setPendingLoading(false); return; }
    setCurrentUserId(user.id);

    const [profileResult, mealsResult, recoveredResult] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_url, bio, location_name, rating, xp, meals_given, meals_taken, karma_balance, shares_count, is_premium, created_at').eq('id', user.id).maybeSingle(),
      supabase.from('meals').select('id, title, description, image_url, created_at, slots_taken, slots_total, category, allergens, meal_date, expires_at, quantity, location_lat, location_lng, location_name').eq('host_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('meal_participants').select('meal_id, joined_at, delivered, meals(id, title, image_url, category, location_name, host_id)').eq('user_id', user.id).eq('no_show', false).order('joined_at', { ascending: false }).limit(20),
    ]);

    if (profileResult.data) setProfile(profileResult.data as Profile);
    setLoading(false);

    const hostMealIds = mealsResult.data?.map((m: { id: string }) => m.id) ?? [];

    if (mealsResult.data) setSharedMeals(mealsResult.data as SharedMeal[]);
    setMealsLoading(false);

    if (recoveredResult.data) setRecoveredMeals(recoveredResult.data as RecoveredMeal[]);
    setRecoveredLoading(false);

    if (hostMealIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from('meal_participants')
        .select('id, joined_at, delivered, no_show, meal_id, user_id, meals(id, title, image_url, category, slots_taken, slots_total), profiles(name, avatar_url)')
        .in('meal_id', hostMealIds)
        .eq('delivered', false)
        .eq('no_show', false)
        .order('joined_at', { ascending: false });
      if (bookingsData) setPendingBookings(bookingsData as PendingBooking[]);
    }
    setPendingLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const { containerRef: profileScrollRef, indicatorRef: profileIndicatorRef } = usePullToRefresh(loadProfile);

  const karma = profile?.karma_balance ?? 0;
  const karmaBlocked = karma <= -10;
  const xp = profile?.xp ?? 0;
  const sharesCount = profile?.shares_count ?? 0;
  const mealsGiven = profile?.meals_given ?? 0;
  const mealsTaken = profile?.meals_taken ?? 0;
  const isPremium = profile?.is_premium ?? false;
  const isTrustedCook = sharesCount >= SHARES_FOR_CIRCLE;
  const memberYear = profile?.created_at ? new Date(profile.created_at).getFullYear() : '';

  async function confirmDelivery(booking: PendingBooking) {
    if (!currentUserId) return;
    setActionError(null);

    const { data: result, error: rpcError } = await supabase.rpc('confirm_pickup', {
      p_participant_id: booking.id,
      p_meal_id: booking.meal_id,
      p_host_id: currentUserId,
    });

    if (rpcError) {
      setActionError('Impossible de confirmer la récupération. Réessaie.');
      return;
    }

    if (result !== 'ok' && result !== 'not_found') {
      setActionError('Impossible de confirmer la récupération. Réessaie.');
      return;
    }

    setPendingBookings((prev) => prev.filter((b) => b.id !== booking.id));
    setSharedMeals((prev) => prev.filter((m) => m.id !== booking.meal_id));
    setReviewBooking(booking);

    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('meals_given, xp, karma_balance, shares_count')
      .eq('id', currentUserId)
      .maybeSingle();
    if (updatedProfile) {
      setProfile((prev) => prev ? { ...prev, ...updatedProfile } : prev);
    }
  }

  async function markNoShow(booking: PendingBooking) {
    const meal = booking.meals;
    const newSlotsTaken = Math.max(0, (meal.slots_taken ?? 1) - 1);
    setActionError(null);

    const [participantResult, guestProfileResult] = await Promise.all([
      supabase.from('meal_participants').update({ no_show: true }).eq('id', booking.id),
      supabase.from('profiles').select('karma_balance').eq('id', booking.user_id).maybeSingle(),
    ]);

    if (participantResult.error) {
      setActionError('Impossible de marquer comme absent. Réessaie.');
      return;
    }

    await Promise.all([
      supabase.from('meals').update({ slots_taken: newSlotsTaken, claimed: false }).eq('id', booking.meal_id),
      supabase.from('profiles')
        .update({ karma_balance: ((guestProfileResult.data as { karma_balance?: number } | null)?.karma_balance ?? 0) - 1 })
        .eq('id', booking.user_id),
    ]);

    setPendingBookings((prev) => prev.filter((b) => b.id !== booking.id));
    setSharedMeals((prev) =>
      prev.map((m) =>
        m.id === booking.meal_id ? { ...m, slots_taken: newSlotsTaken } : m
      )
    );
  }

  async function cancelBooking(mealId: string) {
    if (!currentUserId) return;
    setCancellingMealId(mealId);
    const { data: result } = await supabase.rpc('cancel_booking', {
      p_meal_id: mealId,
      p_user_id: currentUserId,
    });
    setCancellingMealId(null);
    setCancelConfirmId(null);
    if (result === 'ok' || result === 'not_found') {
      setRecoveredMeals((prev) => prev.filter((r) => r.meal_id !== mealId));
    }
  }

  async function blockUser(booking: PendingBooking) {
    if (!currentUserId) return;
    setBlockingUserId(booking.user_id);
    await supabase.from('blocked_users').upsert({
      blocker_id: currentUserId,
      blocked_id: booking.user_id,
    }, { onConflict: 'blocker_id,blocked_id' });
    await markNoShow(booking);
    setBlockConfirmId(null);
    setBlockingUserId(null);
  }

  async function deleteMeal(mealId: string) {
    if (!currentUserId) return;
    setDeletingMealId(mealId);
    const { data: result } = await supabase.rpc('delete_meal', {
      p_meal_id: mealId,
      p_host_id: currentUserId,
    });
    setDeletingMealId(null);
    setDeleteMealConfirmId(null);
    if (result === 'ok' || result === 'not_found') {
      setSharedMeals((prev) => prev.filter((m) => m.id !== mealId));
      setPendingBookings((prev) => prev.filter((b) => b.meal_id !== mealId));
    }
  }

  return (
    <div className="flex flex-col h-app bg-[#f6f8f6] font-display">
      <main ref={(el) => { profileScrollRef.current = el; }} className="flex-1 overflow-y-auto hide-scrollbar pb-24 relative">
        <PullIndicator ref={profileIndicatorRef} />

        <div className="bg-white px-6 pb-7 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 44px) + 14px)' }}>
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-[#49e619]/30">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400 text-[40px]">person</span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#49e619] rounded-full flex items-center justify-center border-2 border-white">
                <span className="material-symbols-outlined text-white text-[14px] fill-1">verified</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {loading ? (
                  <div className="h-7 w-36 bg-slate-100 rounded-lg animate-pulse" />
                ) : (
                  <h2 className="text-2xl font-bold text-slate-900">{profile?.name || 'Mon profil'}</h2>
                )}
                {isPremium && (
                  <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                    <span className="material-symbols-outlined text-[12px] fill-1">workspace_premium</span>
                    PREMIUM
                  </span>
                )}
                {isTrustedCook && (
                  <span className="flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-300">
                    <span className="material-symbols-outlined text-[12px] fill-1">emoji_food_beverage</span>
                    TRUSTED COOK
                  </span>
                )}
              </div>
              {loading ? (
                <div className="h-4 w-48 bg-slate-100 rounded mt-1.5 animate-pulse" />
              ) : (
                <p className="text-sm text-slate-500 mt-0.5">
                  {[profile?.location_name, memberYear ? `Membre depuis ${memberYear}` : ''].filter(Boolean).join(' • ')}
                </p>
              )}
              <div className="flex items-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="material-symbols-outlined text-yellow-400 text-[16px] fill-1">star</span>
                ))}
                <span className="text-sm font-bold text-slate-900 ml-1">{profile?.rating?.toFixed(1) ?? '–'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { setShowNotifications(true); onNotificationsOpen?.(); }}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center relative"
              >
                <span className="material-symbols-outlined text-slate-600 text-[20px]">notifications</span>
                {unreadBookings > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-white font-extrabold" style={{ fontSize: 8 }}>
                      {unreadBookings > 9 ? '9+' : unreadBookings}
                    </span>
                  </span>
                )}
              </button>
              <button
                onClick={() => onNavigate('settings')}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-slate-600 text-[20px]">settings</span>
              </button>
            </div>
          </div>

          {profile?.bio ? (
            <p className="text-sm text-slate-600 mt-4 leading-relaxed">{profile.bio}</p>
          ) : !loading ? (
            <button
              onClick={() => setShowEdit(true)}
              className="mt-4 text-sm text-slate-400 italic"
            >
              Ajoute une bio...
            </button>
          ) : null}

          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-[#f6f8f6] rounded-2xl p-3 text-center">
              <p className="text-xl font-extrabold text-slate-900">{mealsGiven}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Repas partagés</p>
            </div>
            <div className="bg-[#f6f8f6] rounded-2xl p-3 text-center">
              <p className="text-xl font-extrabold text-slate-900">{mealsTaken}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Repas récupérés</p>
            </div>
            <div className="bg-[#f6f8f6] rounded-2xl p-3 text-center">
              <p className="text-xl font-extrabold text-slate-900">{xp} XP</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Expérience</p>
            </div>
          </div>

          {karmaBlocked && (
            <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
              <span className="material-symbols-outlined text-red-500 text-[22px] flex-shrink-0 mt-0.5">block</span>
              <div>
                <p className="text-sm font-bold text-red-700">Compte temporairement restreint</p>
                <p className="text-xs text-red-500 mt-0.5 leading-relaxed">
                  Tu as pris trop de repas sans en partager en retour. Partage un repas pour débloquer ton compte.
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-4">
            <KarmaBar karma={karma} />
            <div className="h-px bg-slate-100" />
            <XpBar xp={xp} />
            <div className="h-px bg-slate-100" />
            <SharesBar shares={sharesCount} max={SHARES_FOR_CIRCLE} />
          </div>

          <button
            onClick={() => setShowDonation(true)}
            className="mt-5 w-full flex items-center gap-4 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-2xl p-4 text-left active:scale-[0.98] transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e8512a] to-[#c0392b] flex items-center justify-center shrink-0 shadow-md">
              <span className="material-symbols-outlined text-white text-[22px] fill-1">volunteer_activism</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm">Don solidaire</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Soutenir la communauté ShareEat et aider à réduire le gaspillage</p>
            </div>
            <span className="material-symbols-outlined text-orange-300 text-[20px] shrink-0">chevron_right</span>
          </button>

        </div>

        <div className="px-6 mt-5 space-y-2">
          <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
            {([
              { key: 'activity', label: 'Activité', icon: 'restaurant' },
              { key: 'favorites', label: 'Favoris', icon: 'favorite' },
              { key: 'xp', label: 'XP & Karma', icon: 'trending_up' },
            ] as { key: 'activity' | 'favorites' | 'xp'; label: string; icon: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                <span className={`material-symbols-outlined text-[13px] ${activeTab === tab.key ? 'fill-1' : ''}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'activity' && (
          <>
            {(pendingLoading || pendingBookings.length > 0) && (
          <div className="px-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Remises en attente</h3>
              {pendingBookings.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#f97316] text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingBookings.length}
                </span>
              )}
            </div>
            {pendingLoading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {actionError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-red-500 text-[16px] shrink-0">error</span>
                    <p className="text-sm text-red-600 flex-1">{actionError}</p>
                    <button onClick={() => setActionError(null)} className="text-red-400 shrink-0">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                )}
                {pendingBookings.map((booking) => {
                  const meal = booking.meals;
                  const guest = booking.profiles;
                  const isFoodRescue = meal.category === 'food_rescue';
                  const categoryLabel = isFoodRescue ? 'Anti-gaspi' : 'Repas maison';
                  const categoryColor = isFoodRescue ? '#16a34a' : '#f97316';
                  const fallbackImg = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg';
                  const hoursAgo = Math.round((Date.now() - new Date(booking.joined_at).getTime()) / (1000 * 60 * 60));
                  const timeLabel = hoursAgo < 1 ? "il y a moins d'1h" : `il y a ${hoursAgo}h`;
                  return (
                    <div key={booking.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative shrink-0">
                          {guest.avatar_url ? (
                            <img src={guest.avatar_url} alt={guest.name} className="w-10 h-10 rounded-full object-cover" loading="lazy" decoding="async" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                              <span className="material-symbols-outlined text-slate-400 text-[20px]">person</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{guest.name}</p>
                          <p className="text-xs text-slate-400">Réservé {timeLabel}</p>
                        </div>
                        <img
                          src={meal.image_url || fallbackImg}
                          alt={meal.title}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: categoryColor }}>
                          {categoryLabel}
                        </span>
                        <p className="text-sm font-semibold text-slate-800 truncate">{meal.title}</p>
                      </div>
                      {blockConfirmId === booking.user_id ? (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
                          <p className="text-xs font-bold text-red-700 mb-1">Bloquer cet utilisateur ?</p>
                          <p className="text-[11px] text-red-500 mb-3">Il ne pourra plus voir tes annonces. Son inscription sera aussi annulée.</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setBlockConfirmId(null)}
                              className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold transition-all active:scale-95"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => blockUser(booking)}
                              disabled={blockingUserId === booking.user_id}
                              className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[13px]">block</span>
                              Bloquer
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <button
                          onClick={() => confirmDelivery(booking)}
                          className="w-full py-3 rounded-xl bg-[#49e619] text-slate-900 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[17px]">check_circle</span>
                          Récupéré — Supprimer l'annonce
                        </button>
                        {noShowConfirmId === booking.id ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs font-bold text-amber-700 mb-1">Marquer comme absent ?</p>
                            <p className="text-[11px] text-amber-600 mb-3">-1 karma pour cet utilisateur. La place sera libérée.</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setNoShowConfirmId(null)}
                                className="flex-1 py-2 rounded-xl border border-amber-200 text-amber-700 text-xs font-bold transition-all active:scale-95"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={() => { markNoShow(booking); setNoShowConfirmId(null); }}
                                className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold transition-all active:scale-95"
                              >
                                Confirmer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setBlockConfirmId(booking.user_id)}
                              className="p-2.5 rounded-xl border border-slate-200 text-slate-400 text-xs font-bold transition-all active:scale-95 flex items-center justify-center"
                              title="Bloquer cet utilisateur"
                            >
                              <span className="material-symbols-outlined text-[16px]">block</span>
                            </button>
                            <button
                              onClick={() => setNoShowConfirmId(booking.id)}
                              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold transition-all active:scale-95"
                            >
                              Absent — Réactiver
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="px-6 mt-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Mes annonces partagées</h3>
          {mealsLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-3 flex gap-3 animate-pulse">
                  <div className="w-20 h-20 rounded-xl bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : sharedMeals.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-slate-400 text-[28px]">restaurant</span>
              </div>
              <p className="font-bold text-slate-700">Aucune annonce pour l'instant</p>
              <p className="text-xs text-slate-400 mt-1">Partage ton premier repas ou aliment !</p>
              <button
                onClick={() => onNavigate('create')}
                className="mt-4 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-full active:scale-95 transition-all"
              >
                Créer une annonce
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedMeals.map((meal) => {
                const isFoodRescue = meal.category === 'food_rescue';
                const categoryColor = isFoodRescue ? '#16a34a' : '#f97316';
                const categoryLabel = isFoodRescue ? 'Anti-gaspi' : 'Repas maison';
                const fallbackImage = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg';
                const isConfirmingDelete = deleteMealConfirmId === meal.id;
                const isDeleting = deletingMealId === meal.id;

                return (
                  <div key={meal.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50">
                    <div className="flex gap-3 p-3">
                      <div className="relative shrink-0">
                        <img
                          src={meal.image_url || fallbackImage}
                          alt={meal.title}
                          className="w-20 h-20 rounded-xl object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <span
                          className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: categoryColor }}
                        >
                          {categoryLabel}
                        </span>
                      </div>
                      <div className="flex-1 py-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-[15px] truncate">{meal.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(meal.created_at)}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="material-symbols-outlined text-slate-400 text-[14px]">group</span>
                          <span className="text-xs text-slate-500">{meal.slots_taken ?? 0} réclamé{(meal.slots_taken ?? 0) !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    {isConfirmingDelete ? (
                      <div className="px-3 pb-3 flex gap-2">
                        <button
                          onClick={() => setDeleteMealConfirmId(null)}
                          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold active:scale-95 transition-all"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => deleteMeal(meal.id)}
                          disabled={isDeleting}
                          className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          )}
                          Supprimer
                        </button>
                      </div>
                    ) : (
                      <div className="px-3 pb-3 flex gap-2">
                        <button
                          onClick={() => {
                            if (onEditMeal) {
                              onEditMeal({
                                id: meal.id,
                                title: meal.title,
                                description: meal.description,
                                image_url: meal.image_url,
                                category: (meal.category === 'food_rescue' ? 'food_rescue' : 'homemade_meal') as 'food_rescue' | 'homemade_meal',
                                slots_total: meal.slots_total,
                                allergens: meal.allergens ?? [],
                                meal_date: meal.meal_date,
                                expires_at: meal.expires_at,
                                quantity: meal.quantity,
                                location_lat: meal.location_lat,
                                location_lng: meal.location_lng,
                                location_name: meal.location_name,
                              });
                            }
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all hover:bg-slate-200"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                          Modifier
                        </button>
                        <button
                          onClick={() => setDeleteMealConfirmId(meal.id)}
                          className="py-2.5 px-4 rounded-xl bg-red-50 text-red-500 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all hover:bg-red-100"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 mt-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Récupéré récemment</h3>
          {recoveredLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-3 flex gap-3 animate-pulse">
                  <div className="w-20 h-20 rounded-xl bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recoveredMeals.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-slate-400 text-[24px]">takeout_dining</span>
              </div>
              <p className="font-semibold text-slate-600 text-sm">Aucun repas récupéré pour l'instant</p>
              <p className="text-xs text-slate-400 mt-1">Les repas que tu récupères apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recoveredMeals.map((item, idx) => {
                const meal = item.meals;
                const isFoodRescue = meal.category === 'food_rescue';
                const categoryColor = isFoodRescue ? '#16a34a' : '#f97316';
                const categoryLabel = isFoodRescue ? 'Anti-gaspi' : 'Repas maison';
                const fallbackImage = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg';
                const hoursAgo = Math.round((Date.now() - new Date(item.joined_at).getTime()) / (1000 * 60 * 60));
                const timeLabel = hoursAgo < 1 ? "il y a moins d'1h" : `il y a ${hoursAgo}h`;
                const canCancel = !item.delivered;
                return (
                  <div key={idx} className="bg-white rounded-2xl overflow-hidden p-3 shadow-sm border border-slate-50">
                    <div className="flex gap-3">
                      <div className="relative shrink-0">
                        <img
                          src={meal.image_url || fallbackImage}
                          alt={meal.title}
                          className="w-20 h-20 rounded-xl object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <span
                          className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: categoryColor }}
                        >
                          {categoryLabel}
                        </span>
                      </div>
                      <div className="flex-1 py-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-[15px] truncate">{meal.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{meal.location_name}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <span className={`material-symbols-outlined text-[14px] ${item.delivered ? 'text-[#49e619]' : 'text-amber-500'}`}>
                            {item.delivered ? 'check_circle' : 'schedule'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {item.delivered ? 'Remis' : 'En attente'} · {timeLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    {canCancel && cancelConfirmId === item.meal_id && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-xs font-bold text-red-700 mb-1">Annuler cette réservation ?</p>
                        <p className="text-[11px] text-red-500 mb-3">Ton karma sera restauré de +1.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCancelConfirmId(null)}
                            className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold active:scale-95 transition-all"
                          >
                            Garder
                          </button>
                          <button
                            onClick={() => cancelBooking(item.meal_id)}
                            disabled={cancellingMealId === item.meal_id}
                            className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {cancellingMealId === item.meal_id ? (
                              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[12px]">cancel</span>
                                Annuler
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    {canCancel && cancelConfirmId !== item.meal_id && (
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => setCancelConfirmId(item.meal_id)}
                          className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[13px]">cancel</span>
                          Annuler la réservation
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

          <div className="px-6 mt-6 mb-4">
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full py-4 rounded-full bg-white border border-slate-200 text-slate-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Se déconnecter
            </button>
          </div>
          </>
        )}

        {activeTab === 'favorites' && (
          <FavoritesTab currentUserId={currentUserId} />
        )}

        {activeTab === 'xp' && (
          <XpHistoryTab currentUserId={currentUserId} xp={xp} karma={karma} />
        )}


        <div className="h-8" />
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-slate-100">
        <BottomNav active={activeScreen} onChange={onNavigate} unreadBookings={unreadBookings} />
      </div>

      {showEdit && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEdit(false)}
          onSaved={loadProfile}
        />
      )}

      {reviewBooking && currentUserId && (
        <ReviewModal
          reviewedId={reviewBooking.user_id}
          reviewedName={reviewBooking.profiles.name}
          reviewedAvatar={reviewBooking.profiles.avatar_url}
          mealId={reviewBooking.meal_id}
          participantId={reviewBooking.id}
          reviewerId={currentUserId}
          onClose={() => setReviewBooking(null)}
          onSubmitted={() => setReviewBooking(null)}
        />
      )}

      {showNotifications && currentUserId && (
        <NotificationsModal
          userId={currentUserId}
          onClose={() => setShowNotifications(false)}
          onGoToMessages={() => onNavigate('messages')}
        />
      )}

      {showDonation && <DonationModal onClose={() => setShowDonation(false)} />}
    </div>
  );
}
