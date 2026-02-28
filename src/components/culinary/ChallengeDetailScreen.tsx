import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CulinaryChallenge,
  CulinaryChallengeMember,
  CulinaryChallengeMeal,
  CulinaryChallengeRating,
} from '../../types';

interface Props {
  challenge: CulinaryChallenge;
  currentUserId: string;
  onClose: () => void;
  onContactMember: (id: string, name: string, avatar: string) => void;
}

type DetailTab = 'members' | 'meals' | 'ratings';

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function StarRating({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'text-[16px]' : 'text-[24px]';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(s)}
          className={`material-symbols-outlined ${sz} transition-all ${s <= value ? 'text-amber-400 fill-1' : 'text-amber-400/20'} ${onChange ? 'active:scale-110' : ''}`}
          style={{ fontVariationSettings: s <= value ? "'FILL' 1" : "'FILL' 0" }}
        >
          star
        </button>
      ))}
    </div>
  );
}

function statusLabel(status: string) {
  if (status === 'open') return { label: 'Ouvert', color: 'bg-green-500/20 text-green-300 border-green-500/20' };
  if (status === 'active') return { label: 'En cours', color: 'bg-amber-500/20 text-amber-300 border-amber-500/20' };
  return { label: 'Terminé', color: 'bg-white/10 text-white/40 border-white/10' };
}

function memberStatusLabel(status: string) {
  if (status === 'accepted') return { label: 'Confirmé', color: 'text-green-400' };
  if (status === 'pending') return { label: 'En attente', color: 'text-amber-400' };
  return { label: 'Décliné', color: 'text-red-400' };
}

export default function ChallengeDetailScreen({ challenge, currentUserId, onClose, onContactMember }: Props) {
  const [tab, setTab] = useState<DetailTab>('members');
  const [members, setMembers] = useState<CulinaryChallengeMember[]>([]);
  const [meals, setMeals] = useState<CulinaryChallengeMeal[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingMeals, setLoadingMeals] = useState(false);

  const [myMembership, setMyMembership] = useState<CulinaryChallengeMember | null>(null);
  const [joining, setJoining] = useState(false);

  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [circleMembers, setCircleMembers] = useState<{ id: string; name: string; avatar_url: string; shares_count: number; rating: number }[]>([]);
  const [loadingCircle, setLoadingCircle] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  const [showAddMeal, setShowAddMeal] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [newMealDesc, setNewMealDesc] = useState('');
  const [newMealDate, setNewMealDate] = useState('');
  const [savingMeal, setSavingMeal] = useState(false);

  const [ratingMeal, setRatingMeal] = useState<CulinaryChallengeMeal | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [savingRating, setSavingRating] = useState(false);

  const isCreator = challenge.creator_id === currentUserId;
  const isAccepted = myMembership?.status === 'accepted';
  const isPending = myMembership?.status === 'pending';
  const isOpen = challenge.status === 'open';
  const acceptedCount = members.filter((m) => m.status === 'accepted').length;

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    const { data } = await supabase
      .from('culinary_challenge_members')
      .select('*, profile:user_id(id, name, avatar_url, shares_count, rating), inviter:invited_by(id, name)')
      .eq('challenge_id', challenge.id)
      .order('created_at');
    const list = (data ?? []) as CulinaryChallengeMember[];
    setMembers(list);
    const me = list.find((m) => m.user_id === currentUserId) ?? null;
    setMyMembership(me);
    setLoadingMembers(false);
  }, [challenge.id, currentUserId]);

  const loadMeals = useCallback(async () => {
    setLoadingMeals(true);
    const { data: mealsData } = await supabase
      .from('culinary_challenge_meals')
      .select('*, host:host_id(id, name, avatar_url)')
      .eq('challenge_id', challenge.id)
      .order('created_at');

    if (!mealsData?.length) { setMeals([]); setLoadingMeals(false); return; }

    const mealIds = mealsData.map((m) => m.id);
    const { data: ratingsData } = await supabase
      .from('culinary_challenge_ratings')
      .select('*, rater:rater_id(id, name, avatar_url)')
      .in('challenge_meal_id', mealIds);

    const ratingsByMeal: Record<string, CulinaryChallengeRating[]> = {};
    (ratingsData ?? []).forEach((r: CulinaryChallengeRating) => {
      if (!ratingsByMeal[r.challenge_meal_id]) ratingsByMeal[r.challenge_meal_id] = [];
      ratingsByMeal[r.challenge_meal_id].push(r);
    });

    setMeals(
      mealsData.map((m) => {
        const rs = ratingsByMeal[m.id] ?? [];
        const avg = rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 0;
        const myR = rs.find((r) => r.rater_id === currentUserId) ?? null;
        return { ...m, ratings: rs, avg_rating: avg, my_rating: myR } as CulinaryChallengeMeal;
      })
    );
    setLoadingMeals(false);
  }, [challenge.id, currentUserId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => {
    if (tab === 'meals' || tab === 'ratings') loadMeals();
  }, [tab, loadMeals]);

  const joinChallenge = async () => {
    if (!isOpen || myMembership) return;
    setJoining(true);
    await supabase.from('culinary_challenge_members').insert({
      challenge_id: challenge.id,
      user_id: currentUserId,
      role: 'member',
      status: 'pending',
      invited_by: null,
    });
    await loadMembers();
    setJoining(false);
  };

  const respondToInvitation = async (accept: boolean) => {
    if (!myMembership) return;
    setJoining(true);
    await supabase
      .from('culinary_challenge_members')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', myMembership.id);
    if (accept && isCreator === false) {
      const newAccepted = acceptedCount + 1;
      if (newAccepted >= challenge.min_members && challenge.status === 'open') {
        await supabase.from('culinary_challenges').update({ status: 'active' }).eq('id', challenge.id);
      }
    }
    await loadMembers();
    setJoining(false);
  };

  const acceptMember = async (member: CulinaryChallengeMember) => {
    if (!isCreator) return;
    await supabase
      .from('culinary_challenge_members')
      .update({ status: 'accepted' })
      .eq('id', member.id);
    const newCount = acceptedCount + 1;
    if (newCount >= challenge.min_members && challenge.status === 'open') {
      await supabase.from('culinary_challenges').update({ status: 'active' }).eq('id', challenge.id);
    }
    await loadMembers();
  };

  const loadCircleMembers = async () => {
    setLoadingCircle(true);
    const memberIds = members.map((m) => m.user_id);
    let query = supabase
      .from('profiles')
      .select('id, name, avatar_url, shares_count, rating')
      .gte('shares_count', 10)
      .neq('id', currentUserId);
    if (memberIds.length > 0) {
      query = query.not('id', 'in', `(${memberIds.join(',')})`);
    }
    const { data } = await query.order('shares_count', { ascending: false }).limit(30);
    setCircleMembers(data ?? []);
    setLoadingCircle(false);
  };

  const openInviteSheet = () => {
    loadCircleMembers();
    setShowInviteSheet(true);
  };

  const inviteMember = async (memberId: string) => {
    setInviting(memberId);
    await supabase.from('culinary_challenge_members').insert({
      challenge_id: challenge.id,
      user_id: memberId,
      role: 'member',
      status: 'pending',
      invited_by: currentUserId,
    });
    await loadCircleMembers();
    await loadMembers();
    setInviting(null);
  };

  const addMeal = async () => {
    if (!newMealName.trim()) return;
    setSavingMeal(true);
    try {
      await supabase.from('culinary_challenge_meals').insert({
        challenge_id: challenge.id,
        host_id: currentUserId,
        meal_name: newMealName.trim(),
        meal_description: newMealDesc.trim(),
        proposed_date: newMealDate || null,
      });
      setNewMealName('');
      setNewMealDesc('');
      setNewMealDate('');
      setShowAddMeal(false);
      loadMeals();
    } finally {
      setSavingMeal(false);
    }
  };

  const markMealDone = async (meal: CulinaryChallengeMeal) => {
    await supabase.from('culinary_challenge_meals').update({ status: 'done' }).eq('id', meal.id);
    loadMeals();
  };

  const submitRating = async () => {
    if (!ratingMeal) return;
    setSavingRating(true);
    if (ratingMeal.my_rating) {
      await supabase
        .from('culinary_challenge_ratings')
        .update({ rating: ratingValue, comment: ratingComment.trim() })
        .eq('id', ratingMeal.my_rating.id);
    } else {
      await supabase.from('culinary_challenge_ratings').insert({
        challenge_meal_id: ratingMeal.id,
        rater_id: currentUserId,
        rating: ratingValue,
        comment: ratingComment.trim(),
      });
    }
    setSavingRating(false);
    setRatingMeal(null);
    setRatingValue(5);
    setRatingComment('');
    loadMeals();
  };

  const sl = statusLabel(challenge.status);
  const myMeal = meals.find((m) => m.host_id === currentUserId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(to bottom, #1c0a00, #0f0700, #000)' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(251,191,36,0.08) 0%, transparent 50%)',
        }}
      />

      <div className="relative flex items-center px-4 pt-14 pb-4 border-b border-amber-400/10">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 mr-3 shrink-0">
          <span className="material-symbols-outlined text-amber-300 text-[20px]">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">Défi Cercle</p>
          <h2 className="text-base font-extrabold text-amber-100 truncate">{challenge.title}</h2>
        </div>
        <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border ${sl.color} ml-2 shrink-0`}>
          {sl.label}
        </span>
      </div>

      <div className="relative px-4 py-3 border-b border-amber-400/10">
        <div className="flex items-center gap-3">
          <img
            src={challenge.creator?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
            alt={challenge.creator?.name}
            className="w-9 h-9 rounded-full object-cover border border-amber-400/20 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-400/50">Lancé par <span className="text-amber-200 font-semibold">{challenge.creator?.name}</span></p>
            {challenge.description && (
              <p className="text-xs text-amber-300/50 mt-0.5 line-clamp-2">{challenge.description}</p>
            )}
          </div>
          <div className="shrink-0 text-center">
            <p className="text-xl font-extrabold text-amber-300">{acceptedCount}</p>
            <p className="text-[9px] text-amber-400/40 uppercase tracking-wide">/{challenge.max_members}</p>
          </div>
        </div>

        {!myMembership && isOpen && acceptedCount < challenge.max_members && (
          <button
            onClick={joinChallenge}
            disabled={joining}
            className="mt-3 w-full py-3 rounded-2xl bg-amber-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {joining ? (
              <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>En cours...</>
            ) : (
              <><span className="material-symbols-outlined text-[14px]">group_add</span>Candidater pour rejoindre</>
            )}
          </button>
        )}

        {isPending && myMembership?.invited_by && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-center text-amber-300/50">Tu as été invité(e) à rejoindre ce défi</p>
            <div className="flex gap-2">
              <button onClick={() => respondToInvitation(false)} disabled={joining}
                className="flex-1 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold active:scale-95 transition-all disabled:opacity-40">
                Décliner
              </button>
              <button onClick={() => respondToInvitation(true)} disabled={joining}
                className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                Accepter
              </button>
            </div>
          </div>
        )}

        {isPending && !myMembership?.invited_by && (
          <div className="mt-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-xs text-amber-400/70">Candidature envoyée — en attente de confirmation</p>
          </div>
        )}
      </div>

      <div className="relative px-4 py-2 border-b border-amber-400/10">
        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1">
          {([
            { id: 'members', label: 'Membres', icon: 'group' },
            { id: 'meals', label: 'Repas', icon: 'restaurant' },
            { id: 'ratings', label: 'Notes', icon: 'star' },
          ] as { id: DetailTab; label: string; icon: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                tab === t.id ? 'bg-amber-500 text-white' : 'text-amber-300/40'
              }`}
            >
              <span className={`material-symbols-outlined text-[15px] ${tab === t.id ? 'fill-1' : ''}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto pb-6">
        {tab === 'members' && (
          <MembersTab
            members={members}
            loading={loadingMembers}
            currentUserId={currentUserId}
            isCreator={isCreator}
            isAccepted={isAccepted}
            challenge={challenge}
            acceptedCount={acceptedCount}
            onAcceptMember={acceptMember}
            onOpenInvite={openInviteSheet}
            onContact={onContactMember}
          />
        )}

        {tab === 'meals' && (
          <MealsTab
            meals={meals}
            loading={loadingMeals}
            currentUserId={currentUserId}
            isAccepted={isAccepted}
            myMeal={myMeal ?? null}
            showAddMeal={showAddMeal}
            newMealName={newMealName}
            newMealDesc={newMealDesc}
            newMealDate={newMealDate}
            savingMeal={savingMeal}
            onShowAddMeal={setShowAddMeal}
            onMealNameChange={setNewMealName}
            onMealDescChange={setNewMealDesc}
            onMealDateChange={setNewMealDate}
            onAddMeal={addMeal}
            onMarkDone={markMealDone}
            onRate={(meal) => {
              setRatingMeal(meal);
              setRatingValue(meal.my_rating?.rating ?? 5);
              setRatingComment(meal.my_rating?.comment ?? '');
            }}
          />
        )}

        {tab === 'ratings' && (
          <RatingsTab meals={meals} loading={loadingMeals} currentUserId={currentUserId} />
        )}
      </div>

      {showInviteSheet && (
        <InviteCircleMemberSheet
          circleMembers={circleMembers}
          loading={loadingCircle}
          inviting={inviting}
          existingMemberIds={members.map((m) => m.user_id)}
          onInvite={inviteMember}
          onClose={() => setShowInviteSheet(false)}
        />
      )}

      {ratingMeal && (
        <RatingSheet
          meal={ratingMeal}
          ratingValue={ratingValue}
          comment={ratingComment}
          saving={savingRating}
          onRatingChange={setRatingValue}
          onCommentChange={setRatingComment}
          onSubmit={submitRating}
          onClose={() => setRatingMeal(null)}
        />
      )}
    </div>
  );
}

function MembersTab({
  members,
  loading,
  currentUserId,
  isCreator,
  isAccepted,
  challenge,
  acceptedCount,
  onAcceptMember,
  onOpenInvite,
  onContact,
}: {
  members: CulinaryChallengeMember[];
  loading: boolean;
  currentUserId: string;
  isCreator: boolean;
  isAccepted: boolean;
  challenge: CulinaryChallenge;
  acceptedCount: number;
  onAcceptMember: (m: CulinaryChallengeMember) => void;
  onOpenInvite: () => void;
  onContact: (id: string, name: string, avatar: string) => void;
}) {
  if (loading) {
    return (
      <div className="px-4 pt-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/5 rounded-2xl h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  const canInvite = isAccepted && challenge.status === 'open' && acceptedCount < challenge.max_members;

  return (
    <div className="px-4 pt-3 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/40">
          {acceptedCount} confirmé{acceptedCount > 1 ? 's' : ''} · {challenge.min_members}–{challenge.max_members} membres requis
        </p>
        {canInvite && (
          <button
            onClick={onOpenInvite}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[13px]">person_add</span>
            Inviter
          </button>
        )}
      </div>

      {members.map((member) => {
        const sl = memberStatusLabel(member.status);
        const isMe = member.user_id === currentUserId;
        return (
          <div key={member.id} className="bg-white/5 border border-amber-400/10 rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <img
                src={member.profile?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                alt={member.profile?.name}
                className="w-10 h-10 rounded-full object-cover border border-amber-400/20 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-amber-100 truncate">{member.profile?.name}{isMe ? ' (moi)' : ''}</p>
                  {member.role === 'creator' && (
                    <span className="material-symbols-outlined text-amber-400 text-[12px] fill-1 shrink-0">emoji_food_beverage</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-semibold ${sl.color}`}>{sl.label}</span>
                  {member.invited_by && (
                    <span className="text-[10px] text-amber-400/30">· Invité(e) par {member.inviter?.name}</span>
                  )}
                </div>
              </div>
              {!isMe && member.status === 'accepted' && (
                <button
                  onClick={() => onContact(member.user_id, member.profile?.name ?? '', member.profile?.avatar_url ?? '')}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-amber-400/10 shrink-0"
                >
                  <span className="material-symbols-outlined text-amber-300/60 text-[14px]">chat_bubble</span>
                </button>
              )}
              {isCreator && !isMe && member.status === 'pending' && (
                <button
                  onClick={() => onAcceptMember(member)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-green-500/80 text-white text-[10px] font-bold active:scale-95 transition-all shrink-0"
                >
                  <span className="material-symbols-outlined text-[11px]">check</span>
                  Accepter
                </button>
              )}
            </div>
          </div>
        );
      })}

      {members.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-amber-400/30 text-[26px]">group</span>
          </div>
          <p className="text-amber-300/40 text-sm">Aucun membre pour l'instant</p>
        </div>
      )}
    </div>
  );
}

function MealsTab({
  meals,
  loading,
  currentUserId,
  isAccepted,
  myMeal,
  showAddMeal,
  newMealName,
  newMealDesc,
  newMealDate,
  savingMeal,
  onShowAddMeal,
  onMealNameChange,
  onMealDescChange,
  onMealDateChange,
  onAddMeal,
  onMarkDone,
  onRate,
}: {
  meals: CulinaryChallengeMeal[];
  loading: boolean;
  currentUserId: string;
  isAccepted: boolean;
  myMeal: CulinaryChallengeMeal | null;
  showAddMeal: boolean;
  newMealName: string;
  newMealDesc: string;
  newMealDate: string;
  savingMeal: boolean;
  onShowAddMeal: (v: boolean) => void;
  onMealNameChange: (v: string) => void;
  onMealDescChange: (v: string) => void;
  onMealDateChange: (v: string) => void;
  onAddMeal: () => void;
  onMarkDone: (meal: CulinaryChallengeMeal) => void;
  onRate: (meal: CulinaryChallengeMeal) => void;
}) {
  if (loading) {
    return (
      <div className="px-4 pt-3 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/5 rounded-2xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 space-y-3">
      {isAccepted && !myMeal && !showAddMeal && (
        <button
          onClick={() => onShowAddMeal(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-300 font-bold text-sm active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Proposer mon repas
        </button>
      )}

      {showAddMeal && (
        <div className="bg-black/40 rounded-3xl border border-amber-400/20 p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">Mon repas pour le cercle</p>
          <input
            type="text"
            value={newMealName}
            onChange={(e) => onMealNameChange(e.target.value)}
            placeholder="Nom du plat *"
            className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50"
          />
          <textarea
            value={newMealDesc}
            onChange={(e) => onMealDescChange(e.target.value)}
            placeholder="Décris ton repas (ambiance, ingrédients...)..."
            rows={2}
            className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50 resize-none"
          />
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/50 mb-1 block">Date proposée (optionnel)</label>
            <input
              type="datetime-local"
              value={newMealDate}
              onChange={(e) => onMealDateChange(e.target.value)}
              className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 outline-none focus:border-amber-400/50 [color-scheme:dark]"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => onShowAddMeal(false)}
              className="flex-1 py-2.5 rounded-xl border border-amber-400/20 text-amber-400/60 text-sm font-bold">
              Annuler
            </button>
            <button onClick={onAddMeal} disabled={savingMeal || !newMealName.trim()}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1">
              {savingMeal ? <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> : null}
              Confirmer
            </button>
          </div>
        </div>
      )}

      {meals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-amber-400/30 text-[26px]">restaurant</span>
          </div>
          <p className="text-amber-300/40 text-sm">Aucun repas proposé pour l'instant</p>
          {isAccepted && <p className="text-amber-400/25 text-xs mt-1">Chaque membre propose un repas chez lui</p>}
        </div>
      ) : (
        meals.map((meal) => {
          const isMyMeal = meal.host_id === currentUserId;
          const canRate = !isMyMeal && isAccepted && meal.status === 'done';
          return (
            <div key={meal.id} className="bg-white/5 border border-amber-400/10 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <img
                  src={meal.host?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                  alt={meal.host?.name}
                  className="w-9 h-9 rounded-full object-cover border border-amber-400/20 shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-amber-100 truncate">{meal.meal_name}</p>
                    {meal.status === 'done' ? (
                      <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/20 shrink-0">
                        Fait
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/20 shrink-0">
                        Planifié
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-400/50 mt-0.5">
                    {isMyMeal ? 'Mon repas' : `Par ${meal.host?.name}`}
                    {meal.proposed_date ? ` · ${formatDateShort(meal.proposed_date)}` : ''}
                  </p>
                  {meal.meal_description && (
                    <p className="text-xs text-amber-300/40 mt-1 line-clamp-2">{meal.meal_description}</p>
                  )}
                  {meal.avg_rating !== undefined && meal.avg_rating > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <StarRating value={Math.round(meal.avg_rating)} size="sm" />
                      <span className="text-[10px] text-amber-400/50">{meal.avg_rating.toFixed(1)} ({meal.ratings?.length})</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {isMyMeal && meal.status === 'planned' && (
                  <button onClick={() => onMarkDone(meal)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-bold active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    Marquer comme fait
                  </button>
                )}
                {canRate && (
                  <button onClick={() => onRate(meal)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-[13px]">{meal.my_rating ? 'edit' : 'star'}</span>
                    {meal.my_rating ? 'Modifier ma note' : 'Noter ce repas'}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function RatingsTab({ meals, loading, currentUserId }: { meals: CulinaryChallengeMeal[]; loading: boolean; currentUserId: string }) {
  if (loading) {
    return (
      <div className="px-4 pt-3 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/5 rounded-2xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  const doneMeals = meals.filter((m) => m.status === 'done');

  if (doneMeals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-amber-400/30 text-[26px]">star</span>
        </div>
        <p className="text-amber-300/40 text-sm">Les notes apparaîtront ici</p>
        <p className="text-amber-400/25 text-xs mt-1">Une fois les repas terminés</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 space-y-4">
      {doneMeals.map((meal) => {
        const ratings = meal.ratings ?? [];
        return (
          <div key={meal.id} className="bg-white/5 border border-amber-400/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-400/10 flex items-center gap-3">
              <img
                src={meal.host?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                alt={meal.host?.name}
                className="w-8 h-8 rounded-full object-cover border border-amber-400/20 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-100 truncate">{meal.meal_name}</p>
                <p className="text-[10px] text-amber-400/40">{meal.host?.id === currentUserId ? 'Mon repas' : `Par ${meal.host?.name}`}</p>
              </div>
              {meal.avg_rating !== undefined && meal.avg_rating > 0 ? (
                <div className="text-right shrink-0">
                  <p className="text-xl font-extrabold text-amber-300">{meal.avg_rating.toFixed(1)}</p>
                  <p className="text-[9px] text-amber-400/40">{ratings.length} note{ratings.length > 1 ? 's' : ''}</p>
                </div>
              ) : (
                <p className="text-[10px] text-amber-400/30 shrink-0">Pas encore noté</p>
              )}
            </div>
            {ratings.length > 0 && (
              <div className="divide-y divide-amber-400/5">
                {ratings.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                    <img
                      src={r.rater?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                      alt={r.rater?.name}
                      className="w-7 h-7 rounded-full object-cover border border-amber-400/10 shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-amber-200">{r.rater?.name}</p>
                        <StarRating value={r.rating} size="sm" />
                      </div>
                      {r.comment && <p className="text-xs text-amber-300/40 mt-0.5 italic">"{r.comment}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InviteCircleMemberSheet({
  circleMembers,
  loading,
  inviting,
  existingMemberIds,
  onInvite,
  onClose,
}: {
  circleMembers: { id: string; name: string; avatar_url: string; shares_count: number; rating: number }[];
  loading: boolean;
  inviting: string | null;
  existingMemberIds: string[];
  onInvite: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-60 flex flex-col" style={{ background: 'linear-gradient(to bottom, #1c0a00, #0f0700, #000)' }}>
      <div className="flex items-center px-4 pt-14 pb-4 border-b border-amber-400/10">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 mr-3">
          <span className="material-symbols-outlined text-amber-300 text-[20px]">arrow_back</span>
        </button>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">Défi Cercle</p>
          <h2 className="text-base font-extrabold text-amber-100">Inviter un membre</h2>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white/5 rounded-2xl h-16 animate-pulse" />
          ))
        ) : circleMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-amber-400/30 text-[26px]">group</span>
            </div>
            <p className="text-amber-300/40 text-sm">Tous les membres sont déjà invités</p>
          </div>
        ) : (
          circleMembers.map((m) => {
            const alreadyIn = existingMemberIds.includes(m.id);
            return (
              <div key={m.id} className="bg-white/5 border border-amber-400/10 rounded-2xl p-3 flex items-center gap-3">
                <img src={m.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'} alt={m.name}
                  className="w-10 h-10 rounded-full object-cover border border-amber-400/20 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-100 truncate">{m.name}</p>
                  <p className="text-[10px] text-amber-400/40">{m.shares_count} partages · {m.rating.toFixed(1)}</p>
                </div>
                {alreadyIn ? (
                  <span className="text-[10px] text-amber-400/30 shrink-0">Déjà invité</span>
                ) : (
                  <button onClick={() => onInvite(m.id)} disabled={inviting === m.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-40 shrink-0">
                    {inviting === m.id ? (
                      <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[12px]">person_add</span>
                    )}
                    Inviter
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function RatingSheet({
  meal,
  ratingValue,
  comment,
  saving,
  onRatingChange,
  onCommentChange,
  onSubmit,
  onClose,
}: {
  meal: CulinaryChallengeMeal;
  ratingValue: number;
  comment: string;
  saving: boolean;
  onRatingChange: (v: number) => void;
  onCommentChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-60 flex items-end" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full rounded-t-3xl border-t border-amber-400/20 p-6 space-y-5" style={{ background: '#1c0a00' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">Évaluer le repas</p>
            <h3 className="text-base font-extrabold text-amber-100">{meal.meal_name}</h3>
            <p className="text-xs text-amber-400/40 mt-0.5">Par {meal.host?.name}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5">
            <span className="material-symbols-outlined text-amber-300 text-[20px]">close</span>
          </button>
        </div>
        <div>
          <p className="text-xs text-amber-400/60 mb-2">Ta note</p>
          <StarRating value={ratingValue} onChange={onRatingChange} />
        </div>
        <div>
          <p className="text-xs text-amber-400/60 mb-1.5">Commentaire (optionnel)</p>
          <textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Qu'est-ce qui t'a particulièrement plu ?"
            rows={3}
            className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50 resize-none"
          />
        </div>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-amber-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? (
            <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Envoi...</>
          ) : (
            <><span className="material-symbols-outlined text-[16px]">star</span>Soumettre ma note</>
          )}
        </button>
      </div>
    </div>
  );
}
