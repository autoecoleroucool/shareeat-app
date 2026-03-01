import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CulinaryChallenge,
  CulinaryChallengeMember,
  CulinaryChallengeMeal,
  CulinaryChallengeRating,
} from '../../types';
import ChallengeChat from './ChallengeChat';

interface Props {
  challenge: CulinaryChallenge;
  currentUserId: string;
  onClose: () => void;
  onContactMember: (id: string, name: string, avatar: string) => void;
  onViewMemberProfile?: (userId: string) => void;
}

type DetailTab = 'members' | 'meals' | 'ratings' | 'chat';

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
  if (status === 'closed') return { label: 'Fermé', color: 'bg-red-500/20 text-red-300 border-red-500/20' };
  return { label: 'Terminé', color: 'bg-white/10 text-white/40 border-white/10' };
}

export default function ChallengeDetailScreen({ challenge, currentUserId, onClose, onContactMember, onViewMemberProfile }: Props) {
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

  const [editingMeal, setEditingMeal] = useState<CulinaryChallengeMeal | null>(null);
  const [editMealName, setEditMealName] = useState('');
  const [editMealDesc, setEditMealDesc] = useState('');
  const [editMealDate, setEditMealDate] = useState('');
  const [savingEditMeal, setSavingEditMeal] = useState(false);

  const [ratingMeal, setRatingMeal] = useState<CulinaryChallengeMeal | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [savingRating, setSavingRating] = useState(false);

  const [showEditChallenge, setShowEditChallenge] = useState(false);
  const [editTitle, setEditTitle] = useState(challenge.title);
  const [editDesc, setEditDesc] = useState(challenge.description ?? '');
  const [savingEdit, setSavingEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  const isCreator = challenge.creator_id === currentUserId;
  const isAccepted = myMembership?.status === 'accepted';
  const isPending = myMembership?.status === 'pending';
  const isClosed = challenge.status === 'closed';
  const acceptedCount = members.filter((m) => m.status === 'accepted').length;
  const pendingCount = members.filter((m) => m.status === 'pending' && m.user_id !== currentUserId).length;
  const canClose = isCreator && !isClosed && challenge.status !== 'completed' && acceptedCount >= 3;

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
    if (myMembership) return;
    const canJoin = challenge.status === 'open' || challenge.status === 'active';
    if (!canJoin) return;
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

  const withdrawApplication = async () => {
    if (!myMembership || myMembership.status !== 'pending') return;
    setJoining(true);
    await supabase.from('culinary_challenge_members').delete().eq('id', myMembership.id);
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

  const removeMember = async (member: CulinaryChallengeMember) => {
    if (!isCreator || member.role === 'creator') return;
    setConfirmRemoveMemberId(member.id);
  };

  const confirmRemoveMember = async () => {
    if (!confirmRemoveMemberId) return;
    await supabase.from('culinary_challenge_members').delete().eq('id', confirmRemoveMemberId);
    setConfirmRemoveMemberId(null);
    await loadMembers();
  };

  const saveEditChallenge = async () => {
    if (!editTitle.trim()) return;
    setSavingEdit(true);
    await supabase
      .from('culinary_challenges')
      .update({ title: editTitle.trim(), description: editDesc.trim() })
      .eq('id', challenge.id);
    setSavingEdit(false);
    setShowEditChallenge(false);
    challenge.title = editTitle.trim();
    challenge.description = editDesc.trim();
  };

  const deleteChallenge = async () => {
    setDeleting(true);
    await supabase.from('culinary_challenge_ratings').delete().in(
      'challenge_meal_id',
      (await supabase.from('culinary_challenge_meals').select('id').eq('challenge_id', challenge.id)).data?.map((m: { id: string }) => m.id) ?? []
    );
    await supabase.from('culinary_challenge_meals').delete().eq('challenge_id', challenge.id);
    await supabase.from('culinary_challenge_members').delete().eq('challenge_id', challenge.id);
    await supabase.from('culinary_challenges').delete().eq('id', challenge.id);
    setDeleting(false);
    onClose();
  };

  const closeChallenge = async () => {
    setClosing(true);
    await supabase.from('culinary_challenges').update({ status: 'closed' }).eq('id', challenge.id);
    challenge.status = 'closed';
    setClosing(false);
    setShowCloseConfirm(false);
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

  const openEditMeal = (meal: CulinaryChallengeMeal) => {
    setEditingMeal(meal);
    setEditMealName(meal.meal_name);
    setEditMealDesc(meal.meal_description ?? '');
    setEditMealDate(meal.proposed_date ? meal.proposed_date.slice(0, 16) : '');
  };

  const saveEditMeal = async () => {
    if (!editingMeal || !editMealName.trim()) return;
    setSavingEditMeal(true);
    try {
      await supabase.from('culinary_challenge_meals').update({
        meal_name: editMealName.trim(),
        meal_description: editMealDesc.trim(),
        proposed_date: editMealDate || null,
      }).eq('id', editingMeal.id);
      setEditingMeal(null);
      loadMeals();
    } finally {
      setSavingEditMeal(false);
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
        {isCreator && (
          <div className="flex items-center gap-1 ml-2">
            {canClose && (
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-500/15 shrink-0"
                title="Fermer le défi"
              >
                <span className="material-symbols-outlined text-orange-400/80 text-[16px]">lock</span>
              </button>
            )}
            <button
              onClick={() => { setEditTitle(challenge.title); setEditDesc(challenge.description ?? ''); setShowEditChallenge(true); }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 shrink-0"
            >
              <span className="material-symbols-outlined text-amber-300/70 text-[16px]">edit</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 shrink-0"
            >
              <span className="material-symbols-outlined text-red-400/70 text-[16px]">delete</span>
            </button>
          </div>
        )}
      </div>

      <div className="relative px-4 py-4 border-b border-amber-400/10">
        <div className="flex items-center gap-3 mb-4">
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
        </div>

        {isCreator && pendingCount > 0 && (
          <button
            onClick={() => setTab('members')}
            className="w-full mb-3 bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-2.5 flex items-center gap-3 active:scale-[0.98] transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-red-400 text-[16px] animate-pulse">notifications_active</span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-extrabold text-red-300">
                {pendingCount} personne{pendingCount > 1 ? 's' : ''} {pendingCount > 1 ? 'veulent' : 'veut'} rejoindre votre défi
              </p>
              <p className="text-[10px] text-red-300/50">Appuie pour voir et accepter les candidatures</p>
            </div>
            <span className="material-symbols-outlined text-red-400/50 text-[16px]">chevron_right</span>
          </button>
        )}

        <TableVisual
          maxMembers={challenge.max_members}
          acceptedMembers={members.filter((m) => m.status === 'accepted')}
          currentUserId={currentUserId}
        />

        {!myMembership && (challenge.status === 'open' || challenge.status === 'active') && acceptedCount < challenge.max_members && (
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
            <div className="bg-amber-500/10 border border-amber-400/25 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-amber-400 text-[16px]">mail</span>
                <p className="text-xs font-bold text-amber-300">Tu as été invité(e) à rejoindre ce défi</p>
              </div>
              <p className="text-[11px] text-amber-300/50 mb-3">
                {acceptedCount} membre{acceptedCount > 1 ? 's' : ''} confirmé{acceptedCount > 1 ? 's' : ''} · {challenge.max_members - acceptedCount} place{challenge.max_members - acceptedCount > 1 ? 's' : ''} restante{challenge.max_members - acceptedCount > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <button onClick={() => respondToInvitation(false)} disabled={joining}
                  className="flex-1 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold active:scale-95 transition-all disabled:opacity-40">
                  Décliner
                </button>
                <button onClick={() => respondToInvitation(true)} disabled={joining}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  Accepter et rejoindre
                </button>
              </div>
            </div>
          </div>
        )}

        {isPending && !myMembership?.invited_by && (
          <div className="mt-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-400/80 text-[16px] mt-0.5">hourglass_empty</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-300/80">Candidature envoyée</p>
                <p className="text-[11px] text-amber-400/50 mt-0.5">
                  Le créateur doit accepter ta candidature. Tu seras notifié dès qu'il te confirme.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1 border-t border-amber-500/15">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-green-400/60 text-[13px]">check_circle</span>
                <span className="text-[11px] text-amber-300/60">
                  {acceptedCount} confirmé{acceptedCount > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-400/40 text-[13px]">event_seat</span>
                <span className="text-[11px] text-amber-300/50">
                  {challenge.max_members - acceptedCount} place{challenge.max_members - acceptedCount > 1 ? 's' : ''} libre{challenge.max_members - acceptedCount > 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={withdrawApplication}
                disabled={joining}
                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-500/25 text-red-400/70 text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[11px]">close</span>
                Retirer
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative px-4 py-2 border-b border-amber-400/10">
        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1">
          {([
            { id: 'members', label: 'Membres', icon: 'group' },
            { id: 'meals', label: 'Repas', icon: 'restaurant' },
            { id: 'ratings', label: 'Notes', icon: 'star' },
            { id: 'chat', label: 'Chat', icon: 'chat_bubble' },
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

      <div className={`relative flex-1 ${tab === 'chat' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto pb-6'}`}>
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
            onRemoveMember={removeMember}
            onOpenInvite={openInviteSheet}
            onContact={onContactMember}
            onViewProfile={onViewMemberProfile}
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
            editingMealId={editingMeal?.id ?? null}
            editMealName={editMealName}
            editMealDesc={editMealDesc}
            editMealDate={editMealDate}
            savingEditMeal={savingEditMeal}
            onOpenEditMeal={openEditMeal}
            onEditMealNameChange={setEditMealName}
            onEditMealDescChange={setEditMealDesc}
            onEditMealDateChange={setEditMealDate}
            onSaveEditMeal={saveEditMeal}
            onCancelEditMeal={() => setEditingMeal(null)}
          />
        )}

        {tab === 'ratings' && (
          <RatingsTab meals={meals} loading={loadingMeals} currentUserId={currentUserId} />
        )}

        {tab === 'chat' && (
          <ChallengeChat
            challengeId={challenge.id}
            currentUserId={currentUserId}
            currentUserName={members.find((m) => m.user_id === currentUserId)?.profile?.name ?? challenge.creator?.name ?? ''}
            currentUserAvatar={members.find((m) => m.user_id === currentUserId)?.profile?.avatar_url ?? challenge.creator?.avatar_url ?? ''}
            isAccepted={isAccepted || isCreator}
          />
        )}
      </div>

      {showInviteSheet && (
        <InviteCircleMemberSheet
          circleMembers={circleMembers}
          loading={loadingCircle}
          inviting={inviting}
          existingMemberIds={members.map((m) => m.user_id)}
          onInvite={inviteMember}
          onViewProfile={onViewMemberProfile}
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

      {showEditChallenge && (
        <div className="fixed inset-0 z-60 flex items-end" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full rounded-t-3xl border-t border-amber-400/20 p-6 space-y-4" style={{ background: '#1c0a00' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">Modifier le défi</p>
                <h3 className="text-base font-extrabold text-amber-100">Titre & description</h3>
              </div>
              <button onClick={() => setShowEditChallenge(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5">
                <span className="material-symbols-outlined text-amber-300 text-[20px]">close</span>
              </button>
            </div>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Titre du défi *"
              className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optionnel)"
              rows={3}
              className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowEditChallenge(false)}
                className="flex-1 py-3 rounded-2xl border border-amber-400/20 text-amber-400/60 text-sm font-bold">
                Annuler
              </button>
              <button onClick={saveEditChallenge} disabled={savingEdit || !editTitle.trim()}
                className="flex-1 py-3 rounded-2xl bg-amber-500 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {savingEdit ? (
                  <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Enregistrement...</>
                ) : (
                  <><span className="material-symbols-outlined text-[14px]">check</span>Enregistrer</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemoveMemberId && (
        <div className="fixed inset-0 z-60 flex items-end" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full rounded-t-3xl border-t border-red-500/30 p-6 space-y-4" style={{ background: '#1c0a00' }}>
            <div className="flex flex-col items-center text-center gap-3 pb-2">
              <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400 text-[28px]">person_remove</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-amber-100">Retirer ce membre ?</h3>
                <p className="text-xs text-amber-400/50 mt-1 leading-relaxed">
                  Ce membre sera retiré du défi et devra être réinvité pour participer à nouveau.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmRemoveMemberId(null)}
                className="flex-1 py-3 rounded-2xl border border-amber-400/20 text-amber-400/60 text-sm font-bold">
                Annuler
              </button>
              <button onClick={confirmRemoveMember}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[14px]">person_remove</span>
                Retirer du défi
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseConfirm && (
        <div className="fixed inset-0 z-60 flex items-end" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full rounded-t-3xl border-t border-orange-500/30 p-6 space-y-4" style={{ background: '#1c0a00' }}>
            <div className="flex flex-col items-center text-center gap-3 pb-2">
              <div className="w-14 h-14 rounded-full bg-orange-500/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-orange-400 text-[28px]">lock</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-amber-100">Fermer le défi ?</h3>
                <p className="text-xs text-amber-400/50 mt-1 leading-relaxed">
                  Le défi ne sera plus visible par d'autres personnes et n'acceptera plus de nouveaux membres. Les membres actuels restent dans le défi.
                </p>
              </div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-orange-400 text-[14px]">group</span>
              <p className="text-[11px] text-orange-300/80 font-semibold">{acceptedCount} membre{acceptedCount > 1 ? 's' : ''} confirmé{acceptedCount > 1 ? 's' : ''} · cercle fermé</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCloseConfirm(false)}
                className="flex-1 py-3 rounded-2xl border border-amber-400/20 text-amber-400/60 text-sm font-bold">
                Annuler
              </button>
              <button onClick={closeChallenge} disabled={closing}
                className="flex-1 py-3 rounded-2xl bg-orange-500 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {closing ? (
                  <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Fermeture...</>
                ) : (
                  <><span className="material-symbols-outlined text-[14px]">lock</span>Fermer le défi</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-end" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full rounded-t-3xl border-t border-red-500/30 p-6 space-y-4" style={{ background: '#1c0a00' }}>
            <div className="flex flex-col items-center text-center gap-3 pb-2">
              <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400 text-[28px]">delete_forever</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-amber-100">Supprimer ce défi ?</h3>
                <p className="text-xs text-amber-400/50 mt-1 leading-relaxed">
                  Cette action est irréversible. Tous les membres, repas et notes associés seront supprimés.
                </p>
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <p className="text-[11px] text-amber-300/70 text-center font-semibold">{challenge.title}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-2xl border border-amber-400/20 text-amber-400/60 text-sm font-bold">
                Annuler
              </button>
              <button onClick={deleteChallenge} disabled={deleting}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {deleting ? (
                  <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Suppression...</>
                ) : (
                  <><span className="material-symbols-outlined text-[14px]">delete</span>Supprimer définitivement</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TableVisual({
  maxMembers,
  acceptedMembers,
  currentUserId,
}: {
  maxMembers: number;
  acceptedMembers: CulinaryChallengeMember[];
  currentUserId: string;
}) {
  const slots = Array.from({ length: maxMembers });
  const angleStep = 360 / maxMembers;
  const radius = 54;
  const cx = 80;
  const cy = 80;

  const seatAngles = slots.map((_, i) => {
    const angle = (i * angleStep - 90) * (Math.PI / 180);
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle: i * angleStep - 90,
    };
  });

  return (
    <div className="flex flex-col items-center py-1">
      <div className="relative" style={{ width: 160, height: 160 }}>
        <svg width="160" height="160" className="absolute inset-0">
          {seatAngles.map((seat, i) => {
            const member = acceptedMembers[i];
            const isOccupied = !!member;
            const isMe = member?.user_id === currentUserId;
            const lineX2 = cx + (radius - 16) * Math.cos((seat.angle) * Math.PI / 180);
            const lineY2 = cy + (radius - 16) * Math.sin((seat.angle) * Math.PI / 180);
            return (
              <g key={i}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={lineX2}
                  y2={lineY2}
                  stroke={isOccupied ? (isMe ? 'rgba(251,191,36,0.7)' : 'rgba(251,191,36,0.35)') : 'rgba(255,255,255,0.08)'}
                  strokeWidth={isOccupied ? 1.5 : 1}
                  strokeDasharray={isOccupied ? 'none' : '3 3'}
                />
              </g>
            );
          })}

          <circle cx={cx} cy={cy} r={28}
            fill="rgba(251,191,36,0.06)"
            stroke="rgba(251,191,36,0.25)"
            strokeWidth={1.5}
          />
          <circle cx={cx} cy={cy} r={20}
            fill="rgba(251,191,36,0.04)"
            stroke="rgba(251,191,36,0.12)"
            strokeWidth={1}
          />

          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
            fontSize="18" fill="rgba(251,191,36,0.5)">
            🍽
          </text>
        </svg>

        {seatAngles.map((seat, i) => {
          const member = acceptedMembers[i];
          const isOccupied = !!member;
          const isMe = member?.user_id === currentUserId;

          return (
            <div
              key={i}
              className="absolute flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                left: seat.x - 16,
                top: seat.y - 16,
              }}
            >
              {isOccupied && member.profile?.avatar_url ? (
                <div className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition-all ${
                  isMe ? 'border-amber-400 shadow-lg shadow-amber-400/30' : 'border-amber-400/40'
                }`}>
                  <img
                    src={member.profile.avatar_url}
                    alt={member.profile.name}
                    className="w-full h-full object-cover"
                  />
                  {isMe && (
                    <div className="absolute inset-0 bg-amber-400/10" />
                  )}
                </div>
              ) : isOccupied ? (
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-bold ${
                  isMe ? 'border-amber-400 bg-amber-400/20 text-amber-300' : 'border-amber-400/40 bg-amber-400/10 text-amber-400/60'
                }`}>
                  {member.profile?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full border border-dashed border-white/15 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C9.8 2 8 3.8 8 6s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zM4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-amber-400/50 mt-1 font-semibold">
        {acceptedMembers.length}/{maxMembers} à table
      </p>
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
  onRemoveMember,
  onOpenInvite,
  onContact,
  onViewProfile,
}: {
  members: CulinaryChallengeMember[];
  loading: boolean;
  currentUserId: string;
  isCreator: boolean;
  isAccepted: boolean;
  challenge: CulinaryChallenge;
  acceptedCount: number;
  onAcceptMember: (m: CulinaryChallengeMember) => void;
  onRemoveMember: (m: CulinaryChallengeMember) => void;
  onOpenInvite: () => void;
  onContact: (id: string, name: string, avatar: string) => void;
  onViewProfile?: (userId: string) => void;
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
  const pendingMembers = members.filter((m) => m.status === 'pending');
  const acceptedMembers = members.filter((m) => m.status === 'accepted');
  const declinedMembers = members.filter((m) => m.status === 'declined');

  return (
    <div className="px-4 pt-3 pb-4 space-y-4">
      {isCreator && pendingMembers.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-red-500/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-400 text-[16px] animate-pulse">notifications_active</span>
            <div className="flex-1">
              <p className="text-xs font-extrabold text-red-300 uppercase tracking-widest">
                {pendingMembers.length} personne{pendingMembers.length > 1 ? 's' : ''} {pendingMembers.length > 1 ? 'intéressées' : 'intéressée'}
              </p>
              <p className="text-[10px] text-red-300/50 mt-0.5">Accepte-les pour les ajouter à la table</p>
            </div>
          </div>
          <div className="divide-y divide-red-500/10">
            {pendingMembers.map((member) => {
              const isMe = member.user_id === currentUserId;
              return (
                <div key={member.id} className="px-4 py-3 flex items-center gap-3">
                  <img
                    src={member.profile?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                    alt={member.profile?.name}
                    className="w-10 h-10 rounded-full object-cover border border-amber-400/20 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-100 truncate">{member.profile?.name}{isMe ? ' (moi)' : ''}</p>
                    <p className="text-[10px] text-amber-400/40">
                      {member.invited_by
                        ? `Invité(e) par ${member.inviter?.name}`
                        : 'Candidature spontanée'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onViewProfile && (
                      <button
                        onClick={() => onViewProfile(member.user_id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-amber-400/15 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-amber-300/60 text-[16px]">person</span>
                      </button>
                    )}
                    {!isMe && isCreator && (
                      <>
                        <button
                          onClick={() => onAcceptMember(member)}
                          className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-green-500 text-white text-[11px] font-bold active:scale-95 transition-all shadow-lg shadow-green-500/20"
                        >
                          <span className="material-symbols-outlined text-[13px]">check_circle</span>
                          Accepter
                        </button>
                        <button
                          onClick={() => onRemoveMember(member)}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/15 border border-red-500/25 active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-red-400 text-[16px]">person_remove</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/40">
            {acceptedCount} membre{acceptedCount > 1 ? 's' : ''} confirmé{acceptedCount > 1 ? 's' : ''} · {challenge.min_members}–{challenge.max_members} requis
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

        {acceptedMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-amber-400/30 text-[26px]">group</span>
            </div>
            <p className="text-amber-300/40 text-sm">Aucun membre confirmé pour l'instant</p>
          </div>
        ) : (
          <div className="space-y-2">
            {acceptedMembers.map((member) => {
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
                        <span className="text-[10px] font-semibold text-green-400">Confirmé</span>
                        {member.profile?.shares_count !== undefined && (
                          <span className="text-[10px] text-amber-400/30">· {member.profile.shares_count} partages</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onViewProfile && (
                        <button
                          onClick={() => onViewProfile(member.user_id)}
                          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-amber-400/15"
                        >
                          <span className="material-symbols-outlined text-amber-300/60 text-[16px]">person</span>
                        </button>
                      )}
                      {!isMe && (
                        <>
                          <button
                            onClick={() => onContact(member.user_id, member.profile?.name ?? '', member.profile?.avatar_url ?? '')}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-amber-500/15 border border-amber-400/20"
                          >
                            <span className="material-symbols-outlined text-amber-300 text-[16px]">chat_bubble</span>
                          </button>
                          {isCreator && member.role !== 'creator' && (
                            <button
                              onClick={() => onRemoveMember(member)}
                              className="w-9 h-9 flex items-center justify-center rounded-full bg-red-500/15 border border-red-500/25"
                            >
                              <span className="material-symbols-outlined text-red-400 text-[16px]">person_remove</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {declinedMembers.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/25 mb-2">
            {declinedMembers.length} décliné{declinedMembers.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-1.5">
            {declinedMembers.map((member) => (
              <div key={member.id} className="bg-white/3 border border-white/5 rounded-2xl p-3 flex items-center gap-3 opacity-50">
                <img
                  src={member.profile?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                  alt={member.profile?.name}
                  className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                />
                <p className="text-xs text-amber-300/40 truncate">{member.profile?.name}</p>
                <span className="ml-auto text-[10px] text-red-400/50">Décliné</span>
              </div>
            ))}
          </div>
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
  editingMealId,
  editMealName,
  editMealDesc,
  editMealDate,
  savingEditMeal,
  onOpenEditMeal,
  onEditMealNameChange,
  onEditMealDescChange,
  onEditMealDateChange,
  onSaveEditMeal,
  onCancelEditMeal,
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
  editingMealId: string | null;
  editMealName: string;
  editMealDesc: string;
  editMealDate: string;
  savingEditMeal: boolean;
  onOpenEditMeal: (meal: CulinaryChallengeMeal) => void;
  onEditMealNameChange: (v: string) => void;
  onEditMealDescChange: (v: string) => void;
  onEditMealDateChange: (v: string) => void;
  onSaveEditMeal: () => void;
  onCancelEditMeal: () => void;
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
          const isEditing = editingMealId === meal.id;
          return (
            <div key={meal.id} className="bg-white/5 border border-amber-400/10 rounded-2xl p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">Modifier mon repas</p>
                  <input
                    type="text"
                    value={editMealName}
                    onChange={(e) => onEditMealNameChange(e.target.value)}
                    placeholder="Nom du plat *"
                    className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50"
                  />
                  <textarea
                    value={editMealDesc}
                    onChange={(e) => onEditMealDescChange(e.target.value)}
                    placeholder="Décris ton repas (ambiance, ingrédients...)..."
                    rows={2}
                    className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50 resize-none"
                  />
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/50 mb-1 block">Date proposée (optionnel)</label>
                    <input
                      type="datetime-local"
                      value={editMealDate}
                      onChange={(e) => onEditMealDateChange(e.target.value)}
                      className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 outline-none focus:border-amber-400/50 [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={onCancelEditMeal}
                      className="flex-1 py-2.5 rounded-xl border border-amber-400/20 text-amber-400/60 text-sm font-bold">
                      Annuler
                    </button>
                    <button onClick={onSaveEditMeal} disabled={savingEditMeal || !editMealName.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1">
                      {savingEditMeal ? <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> : null}
                      Enregistrer
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                      <button onClick={() => onOpenEditMeal(meal)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-amber-400/15 text-amber-400/60 text-xs font-bold active:scale-95 transition-all">
                        <span className="material-symbols-outlined text-[13px]">edit</span>
                        Modifier
                      </button>
                    )}
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
                </>
              )}
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
  onViewProfile,
  onClose,
}: {
  circleMembers: { id: string; name: string; avatar_url: string; shares_count: number; rating: number }[];
  loading: boolean;
  inviting: string | null;
  existingMemberIds: string[];
  onInvite: (id: string) => void;
  onViewProfile?: (userId: string) => void;
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
                <div className="flex items-center gap-1.5 shrink-0">
                  {onViewProfile && (
                    <button
                      onClick={() => onViewProfile(m.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-amber-400/15"
                    >
                      <span className="material-symbols-outlined text-amber-300/60 text-[15px]">person</span>
                    </button>
                  )}
                  {alreadyIn ? (
                    <span className="text-[10px] text-amber-400/30">Déjà invité</span>
                  ) : (
                    <button onClick={() => onInvite(m.id)} disabled={inviting === m.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold active:scale-95 transition-all disabled:opacity-40">
                      {inviting === m.id ? (
                        <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[12px]">person_add</span>
                      )}
                      Inviter
                    </button>
                  )}
                </div>
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
