import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { getCurrentPosition, reverseGeocode } from '../lib/geolocation';
import { Screen, CulinaryPhoto, CulinaryInvitation, CulinaryChallenge } from '../types';
import BottomNav from '../components/BottomNav';
import ChallengeDetailScreen from '../components/culinary/ChallengeDetailScreen';
import MemberProfileModal from '../components/culinary/MemberProfileModal';

interface CulinaryScreenProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  unreadBookings?: number;
  onContactMember: (hostId: string, hostName: string, hostAvatar: string) => void;
  initialTab?: Tab;
  onInitialTabConsumed?: () => void;
}

type Tab = 'feed' | 'members' | 'invitations' | 'my_gallery' | 'challenges';

interface CircleMember {
  id: string;
  name: string;
  avatar_url: string;
  shares_count: number;
  rating: number;
  location_name?: string;
  photos: CulinaryPhoto[];
}

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1400;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
        else { w = Math.round((w * MAX) / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => {
        if (!b) { reject(new Error('Compression failed')); return; }
        resolve(b);
      }, 'image/jpeg', 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function CulinaryScreen({ activeScreen, onNavigate, unreadBookings = 0, onContactMember, initialTab, onInitialTabConsumed }: CulinaryScreenProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'challenges');

  const [challenges, setChallenges] = useState<CulinaryChallenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<CulinaryChallenge | null>(null);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDesc, setChallengeDesc] = useState('');
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [myPendingChallenges, setMyPendingChallenges] = useState(0);
  const [acceptedResponsibility, setAcceptedResponsibility] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const [feedPhotos, setFeedPhotos] = useState<CulinaryPhoto[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<CulinaryPhoto | null>(null);
  const [hidingPhoto, setHidingPhoto] = useState(false);

  const [members, setMembers] = useState<CircleMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  const [invitations, setInvitations] = useState<CulinaryInvitation[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invTab, setInvTab] = useState<'received' | 'sent'>('received');
  const [selectedInvitation, setSelectedInvitation] = useState<CulinaryInvitation | null>(null);
  const [showSendInvite, setShowSendInvite] = useState(false);
  const [inviteMember, setInviteMember] = useState<CircleMember | null>(null);
  const [mealName, setMealName] = useState('');
  const [invMessage, setInvMessage] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [sending, setSending] = useState(false);
  const [responding, setResponding] = useState(false);
  const [nextTimeNote, setNextTimeNote] = useState('');
  const [showNextTimeInput, setShowNextTimeInput] = useState(false);

  const [myPhotos, setMyPhotos] = useState<CulinaryPhoto[]>([]);
  const [myPhotosLoading, setMyPhotosLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photoMealName, setPhotoMealName] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoChallengeId, setPhotoChallengeId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedMyPhoto, setSelectedMyPhoto] = useState<CulinaryPhoto | null>(null);
  const [myAcceptedChallenges, setMyAcceptedChallenges] = useState<{ id: string; title: string }[]>([]);
  const [feedChallengeFilter, setFeedChallengeFilter] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
      onInitialTabConsumed?.();
    }
  }, [initialTab, onInitialTabConsumed]);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id;

    const [photosResult, hiddenResult] = await Promise.all([
      supabase
        .from('culinary_circle_photos')
        .select('*, author:profiles!user_id(id, name, avatar_url), challenge:culinary_challenges(id, title)')
        .order('created_at', { ascending: false })
        .limit(100),
      uid
        ? supabase.from('culinary_hidden_photos').select('photo_id').eq('user_id', uid)
        : Promise.resolve({ data: [] }),
    ]);

    const hiddenIds = new Set((hiddenResult.data ?? []).map((r: { photo_id: string }) => r.photo_id));
    const photos = (photosResult.data as CulinaryPhoto[]) ?? [];
    setFeedPhotos(photos.filter((p) => !hiddenIds.has(p.id)));
    setFeedLoading(false);
  }, []);

  const hidePhoto = useCallback(async (photo: CulinaryPhoto) => {
    if (!currentUserId || hidingPhoto) return;
    setHidingPhoto(true);
    await supabase.from('culinary_hidden_photos').insert({ user_id: currentUserId, photo_id: photo.id });
    setFeedPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setSelectedPhoto(null);
    setHidingPhoto(false);
  }, [currentUserId, hidingPhoto]);

  const loadMembers = useCallback(async () => {
    if (!currentUserId) return;
    setMembersLoading(true);

    const [profilesResult, hiddenResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, avatar_url, shares_count, rating, location_name')
        .gte('shares_count', 10)
        .neq('id', currentUserId)
        .order('shares_count', { ascending: false })
        .limit(100),
      supabase
        .from('culinary_circle_hidden_members')
        .select('hidden_user_id')
        .eq('user_id', currentUserId),
    ]);

    const profiles = profilesResult.data ?? [];
    const hiddenIds = new Set<string>(
      (hiddenResult.data ?? []).map((r: { hidden_user_id: string }) => r.hidden_user_id)
    );
    setHiddenMemberIds(hiddenIds);

    if (!profiles.length) { setMembers([]); setMembersLoading(false); return; }

    const ids = profiles.map((p: { id: string }) => p.id);
    const { data: photos } = await supabase
      .from('culinary_circle_photos')
      .select('id, user_id, image_url, caption, meal_name, likes_count, challenge_id, created_at')
      .in('user_id', ids)
      .order('created_at', { ascending: false });

    const photosByUser: Record<string, CulinaryPhoto[]> = {};
    (photos ?? []).forEach((ph: CulinaryPhoto) => {
      if (!photosByUser[ph.user_id]) photosByUser[ph.user_id] = [];
      if (photosByUser[ph.user_id].length < 6) photosByUser[ph.user_id].push(ph);
    });

    type PartialProfile = { id: string; name: string; avatar_url: string; shares_count: number; rating: number; location_name?: string };
    setMembers(
      (profiles as unknown as PartialProfile[]).map((p) => ({
        id: p.id,
        name: p.name,
        avatar_url: p.avatar_url,
        shares_count: p.shares_count,
        rating: p.rating,
        location_name: p.location_name,
        photos: photosByUser[p.id] ?? [],
      }))
    );
    setMembersLoading(false);
  }, [currentUserId]);

  const loadInvitations = useCallback(async () => {
    if (!currentUserId) return;
    setInvLoading(true);
    const { data } = await supabase
      .from('culinary_invitations')
      .select('*, host:host_id(id, name, avatar_url, shares_count), guest:guest_id(id, name, avatar_url)')
      .or(`host_id.eq.${currentUserId},guest_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });
    setInvitations((data ?? []) as CulinaryInvitation[]);
    setInvLoading(false);
  }, [currentUserId]);

  const loadMyPhotos = useCallback(async () => {
    if (!currentUserId) return;
    setMyPhotosLoading(true);
    const { data } = await supabase
      .from('culinary_circle_photos')
      .select('*, challenge:culinary_challenges(id, title)')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });
    setMyPhotos((data as CulinaryPhoto[]) ?? []);
    setMyPhotosLoading(false);
  }, [currentUserId]);

  const loadMyAcceptedChallenges = useCallback(async () => {
    if (!currentUserId) return;
    const { data: memberships } = await supabase
      .from('culinary_challenge_members')
      .select('challenge_id')
      .eq('user_id', currentUserId)
      .eq('status', 'accepted');
    if (!memberships || memberships.length === 0) { setMyAcceptedChallenges([]); return; }
    const ids = memberships.map((m: { challenge_id: string }) => m.challenge_id);
    const { data: challengesList } = await supabase
      .from('culinary_challenges')
      .select('id, title')
      .in('id', ids)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });
    setMyAcceptedChallenges((challengesList ?? []) as { id: string; title: string }[]);
  }, [currentUserId]);

  const loadChallenges = useCallback(async () => {
    if (!currentUserId) return;
    setChallengesLoading(true);
    const { data } = await supabase
      .from('culinary_challenges')
      .select('*, creator:creator_id(id, name, avatar_url, shares_count)')
      .order('created_at', { ascending: false })
      .limit(30);

    const list = (data ?? []) as CulinaryChallenge[];

    if (list.length > 0) {
      const ids = list.map((c) => c.id);
      const { data: membersData } = await supabase
        .from('culinary_challenge_members')
        .select('challenge_id, user_id, status, invited_by')
        .in('challenge_id', ids);

      const countByChallenge: Record<string, number> = {};
      const pendingByChallenge: Record<string, number> = {};
      (membersData ?? []).forEach((m: { challenge_id: string; user_id: string; status: string; invited_by: string | null }) => {
        if (m.status === 'accepted') {
          countByChallenge[m.challenge_id] = (countByChallenge[m.challenge_id] ?? 0) + 1;
        }
        if (m.status === 'pending') {
          pendingByChallenge[m.challenge_id] = (pendingByChallenge[m.challenge_id] ?? 0) + 1;
        }
      });

      const { data: myMemberships } = await supabase
        .from('culinary_challenge_members')
        .select('challenge_id, status, invited_by')
        .eq('user_id', currentUserId)
        .in('challenge_id', ids);

      const myStatusByChallenge: Record<string, { status: string; invited_by: string | null }> = {};
      (myMemberships ?? []).forEach((m: { challenge_id: string; status: string; invited_by: string | null }) => {
        myStatusByChallenge[m.challenge_id] = { status: m.status, invited_by: m.invited_by };
      });

      const enrichedList = list.map((c) => ({
        ...c,
        member_count: countByChallenge[c.id] ?? 0,
        pending_count: pendingByChallenge[c.id] ?? 0,
        my_status: myStatusByChallenge[c.id]?.status ?? null,
        my_invited_by: myStatusByChallenge[c.id]?.invited_by ?? null,
      }));

      let pendingForMe = 0;
      (myMemberships ?? []).forEach((m: { challenge_id: string; status: string; invited_by: string | null }) => {
        if (m.status === 'pending') pendingForMe++;
      });

      const myChallengeIds = enrichedList
        .filter((c) => c.creator_id === currentUserId)
        .map((c) => c.id);
      const pendingApplicationsOnMyChallenges = myChallengeIds.reduce(
        (sum, cid) => sum + (pendingByChallenge[cid] ?? 0),
        0
      );

      setMyPendingChallenges(pendingForMe + pendingApplicationsOnMyChallenges);
      const visibleList = enrichedList.filter((c) => {
        if (c.status !== 'closed') return true;
        return c.creator_id === currentUserId || (c.my_status === 'accepted');
      });
      setChallenges(visibleList);
    } else {
      setChallenges([]);
      setMyPendingChallenges(0);
    }
    setChallengesLoading(false);
  }, [currentUserId]);

  const getPosition = async (): Promise<{ lat: number; lng: number; name: string }> => {
    const pos = await getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
    if (!pos) return { lat: 48.8566, lng: 2.3522, name: 'France' };
    const name = await reverseGeocode(pos.latitude, pos.longitude);
    return { lat: pos.latitude, lng: pos.longitude, name };
  };

  const createChallenge = async () => {
    if (!challengeTitle.trim() || !currentUserId || !acceptedResponsibility) return;
    setChallengeError(null);
    setCreatingChallenge(true);

    const position = await getPosition();

    const { data: newChallenge, error: insertChallengeError } = await supabase
      .from('culinary_challenges')
      .insert({
        creator_id: currentUserId,
        title: challengeTitle.trim(),
        description: challengeDesc.trim(),
        location_lat: position.lat,
        location_lng: position.lng,
        location_name: position.name,
      })
      .select()
      .maybeSingle();

    if (insertChallengeError || !newChallenge) {
      setChallengeError(insertChallengeError?.message ?? 'Erreur lors de la création du défi.');
      setCreatingChallenge(false);
      return;
    }

    const { error: insertMealError } = await supabase.from('meals').insert({
      title: challengeTitle.trim(),
      description: challengeDesc.trim() || 'Défi Cercle Culinaire',
      image_url: '',
      host_id: currentUserId,
      slots_total: 5,
      slots_taken: 0,
      confirmed: false,
      location_lat: position.lat,
      location_lng: position.lng,
      location_name: position.name,
      allergens: [],
      meal_date: new Date().toISOString(),
      price: 0,
      is_premium_meal: false,
      meal_type: 'culinary_circle',
      category: 'homemade_meal',
      expires_at: null,
      quantity: null,
    });

    if (insertMealError) setChallengeError('Défi créé, mais erreur carte : ' + insertMealError.message);

    await supabase.from('culinary_challenge_members').insert({
      challenge_id: newChallenge.id,
      user_id: currentUserId,
      role: 'creator',
      status: 'accepted',
      invited_by: null,
    });

    setChallengeTitle('');
    setChallengeDesc('');
    setAcceptedResponsibility(false);
    setCreatingChallenge(false);
    await loadChallenges();
    setShowCreateChallenge(false);
  };

  useEffect(() => { loadFeed(); }, [loadFeed]);

  useEffect(() => {
    if (currentUserId) loadMyAcceptedChallenges();
  }, [currentUserId, loadMyAcceptedChallenges]);

  useEffect(() => {
    if (tab === 'members' && members.length === 0) loadMembers();
    if (tab === 'invitations') loadInvitations();
    if (tab === 'my_gallery') loadMyPhotos();
    if (tab === 'challenges') loadChallenges();
  }, [tab, members.length, loadMembers, loadInvitations, loadMyPhotos, loadChallenges]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setShowAddForm(true);
  };

  const handleUpload = async () => {
    if (!pendingFile || !photoMealName.trim() || !currentUserId) return;
    setUploading(true);
    setUploadError(null);
    let compressed: Blob;
    try {
      compressed = await compressImage(pendingFile);
    } catch {
      setUploadError('Impossible de traiter l\'image. Réessaie avec une autre photo.');
      setUploading(false);
      return;
    }
    const path = `${currentUserId}/${Date.now()}.jpg`;
    const { error: storageError } = await supabase.storage
      .from('culinary-photos')
      .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
    if (storageError) {
      setUploadError('Impossible d\'envoyer la photo. Vérifie ta connexion et réessaie.');
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('culinary-photos').getPublicUrl(path);
    await supabase.from('culinary_circle_photos').insert({
      user_id: currentUserId,
      image_url: publicUrl,
      meal_name: photoMealName.trim(),
      caption: photoCaption.trim(),
      challenge_id: photoChallengeId || null,
    });
    setPhotoMealName('');
    setPhotoCaption('');
    setPhotoChallengeId(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    setShowAddForm(false);
    setUploading(false);
    setUploadError(null);
    loadMyPhotos();
    loadFeed();
  };

  const cancelAdd = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    setPhotoMealName('');
    setPhotoCaption('');
    setPhotoChallengeId(null);
    setShowAddForm(false);
  };

  const handleDeletePhoto = async (photo: CulinaryPhoto) => {
    await supabase.from('culinary_circle_photos').delete().eq('id', photo.id);
    setSelectedMyPhoto(null);
    loadMyPhotos();
    loadFeed();
  };

  const hideMember = async (memberId: string) => {
    if (!currentUserId) return;
    await supabase.from('culinary_circle_hidden_members').insert({
      user_id: currentUserId,
      hidden_user_id: memberId,
    });
    setHiddenMemberIds((prev) => new Set([...prev, memberId]));
  };

  const unhideMember = async (memberId: string) => {
    if (!currentUserId) return;
    await supabase
      .from('culinary_circle_hidden_members')
      .delete()
      .eq('user_id', currentUserId)
      .eq('hidden_user_id', memberId);
    setHiddenMemberIds((prev) => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
  };

  const openSendInvite = (member: CircleMember) => {
    setInviteMember(member);
    setMealName('');
    setInvMessage('');
    setProposedDate('');
    setShowSendInvite(true);
  };

  const sendInvitation = async () => {
    if (!inviteMember || !mealName.trim() || !currentUserId) return;
    setSending(true);
    await supabase.from('culinary_invitations').insert({
      host_id: currentUserId,
      guest_id: inviteMember.id,
      meal_name: mealName.trim(),
      message: invMessage.trim(),
      proposed_date: proposedDate || null,
    });
    setSending(false);
    setShowSendInvite(false);
    setInviteMember(null);
    loadInvitations();
    setTab('invitations');
  };

  const respondToInvitation = async (inv: CulinaryInvitation, status: 'accepted' | 'declined' | 'next_time') => {
    setResponding(true);
    await supabase
      .from('culinary_invitations')
      .update({ status, next_time_note: status === 'next_time' ? nextTimeNote : '' })
      .eq('id', inv.id);
    setResponding(false);
    setSelectedInvitation(null);
    setNextTimeNote('');
    setShowNextTimeInput(false);
    loadInvitations();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: 'En attente', color: 'bg-amber-500/20 text-amber-300 border-amber-500/20' },
      accepted: { label: 'Acceptée', color: 'bg-green-500/20 text-green-300 border-green-500/20' },
      declined: { label: 'Déclinée', color: 'bg-red-500/20 text-red-300 border-red-500/20' },
      next_time: { label: 'Prochaine fois', color: 'bg-blue-500/20 text-blue-300 border-blue-500/20' },
    };
    const s = map[status] ?? map.pending;
    return (
      <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${s.color}`}>
        {s.label}
      </span>
    );
  };

  const received = invitations.filter((i) => i.guest_id === currentUserId);
  const sent = invitations.filter((i) => i.host_id === currentUserId);
  const pendingReceived = received.filter((i) => i.status === 'pending').length;

  return (
    <div className="flex flex-col w-full overflow-hidden h-app" style={{ background: 'linear-gradient(to bottom, #1c0a00, #0f0700, #000)' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 15% 10%, rgba(251,191,36,0.07) 0%, transparent 50%), radial-gradient(circle at 85% 90%, rgba(245,158,11,0.05) 0%, transparent 40%)',
        }}
      />

      <div className="relative px-5 pt-14 pb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">ShareEat</p>
          <h1 className="text-xl font-extrabold text-amber-100 leading-tight flex items-center gap-2">
            Cercle Culinaire
            <span className="material-symbols-outlined text-amber-400 text-[20px] fill-1">verified</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {pendingReceived > 0 && (
            <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
              <span className="text-white font-extrabold text-[10px]">{pendingReceived > 9 ? '9+' : pendingReceived}</span>
            </div>
          )}
          <div className="w-9 h-9 bg-amber-400/10 border border-amber-400/20 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-400 text-[18px] fill-1">emoji_food_beverage</span>
          </div>
        </div>
      </div>

      <div className="relative px-5 pb-3">
        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1">
          {([
            { id: 'challenges', label: 'Défis', icon: 'emoji_events' },
            { id: 'members', label: 'Membres', icon: 'group' },
            { id: 'invitations', label: 'Invitations', icon: 'mail' },
            { id: 'feed', label: 'Galerie', icon: 'grid_view' },
            { id: 'my_gallery', label: 'Moi', icon: 'photo_camera' },
          ] as { id: Tab; label: string; icon: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all relative ${
                tab === t.id ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-300/40'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${tab === t.id ? 'fill-1' : ''}`}>{t.icon}</span>
              {t.label}
              {t.id === 'invitations' && pendingReceived > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border border-black text-[8px] text-white font-extrabold flex items-center justify-center">
                  {pendingReceived}
                </span>
              )}
              {t.id === 'challenges' && myPendingChallenges > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border border-black text-[8px] text-white font-extrabold flex items-center justify-center">
                  {myPendingChallenges}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        {tab === 'feed' && (
          <FeedTab
            photos={feedPhotos}
            loading={feedLoading}
            challengeFilter={feedChallengeFilter}
            onChallengeFilterChange={setFeedChallengeFilter}
            onSelectPhoto={setSelectedPhoto}
          />
        )}
        {tab === 'challenges' && (
          <ChallengesTab
            challenges={challenges}
            loading={challengesLoading}
            currentUserId={currentUserId ?? ''}
            showCreate={showCreateChallenge}
            challengeTitle={challengeTitle}
            challengeDesc={challengeDesc}
            creating={creatingChallenge}
            acceptedResponsibility={acceptedResponsibility}
            createError={challengeError}
            onShowCreate={() => setShowCreateChallenge(true)}
            onTitleChange={setChallengeTitle}
            onDescChange={setChallengeDesc}
            onAcceptResponsibility={setAcceptedResponsibility}
            onCreate={createChallenge}
            onCancelCreate={() => { setShowCreateChallenge(false); setChallengeTitle(''); setChallengeDesc(''); setAcceptedResponsibility(false); setChallengeError(null); }}
            onSelectChallenge={setSelectedChallenge}
          />
        )}
        {tab === 'members' && (
          <MembersTab
            members={members}
            loading={membersLoading}
            hiddenMemberIds={hiddenMemberIds}
            showHidden={showHidden}
            onToggleShowHidden={() => setShowHidden((v) => !v)}
            onInvite={openSendInvite}
            onContact={onContactMember}
            onHide={hideMember}
            onUnhide={unhideMember}
            onViewProfile={setViewProfileUserId}
          />
        )}
        {tab === 'invitations' && (
          <InvitationsTab
            received={received}
            sent={sent}
            loading={invLoading}
            invTab={invTab}
            onChangeInvTab={setInvTab}
            onSelectInvitation={setSelectedInvitation}
            statusBadge={statusBadge}
          />
        )}
        {tab === 'my_gallery' && (
          <MyGalleryTab
            photos={myPhotos}
            loading={myPhotosLoading}
            showAddForm={showAddForm}
            uploading={uploading}
            uploadError={uploadError}
            onDismissError={() => setUploadError(null)}
            previewUrl={previewUrl}
            photoMealName={photoMealName}
            photoCaption={photoCaption}
            photoChallengeId={photoChallengeId}
            myAcceptedChallenges={myAcceptedChallenges}
            onPhotoMealNameChange={setPhotoMealName}
            onPhotoCaptionChange={setPhotoCaption}
            onPhotoChallengeIdChange={setPhotoChallengeId}
            onAddClick={() => fileInputRef.current?.click()}
            onUpload={handleUpload}
            onCancelAdd={cancelAdd}
            onSelectPhoto={setSelectedMyPhoto}
          />
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {showSendInvite && inviteMember && (
        <SendInviteSheet
          member={inviteMember}
          mealName={mealName}
          message={invMessage}
          proposedDate={proposedDate}
          sending={sending}
          onMealNameChange={setMealName}
          onMessageChange={setInvMessage}
          onProposedDateChange={setProposedDate}
          onSend={sendInvitation}
          onClose={() => { setShowSendInvite(false); setInviteMember(null); }}
        />
      )}

      {selectedInvitation && (
        <InvitationDetailSheet
          invitation={selectedInvitation}
          currentUserId={currentUserId ?? ''}
          nextTimeNote={nextTimeNote}
          onNextTimeNoteChange={setNextTimeNote}
          responding={responding}
          showNextTimeInput={showNextTimeInput}
          onShowNextTimeInput={setShowNextTimeInput}
          onRespond={respondToInvitation}
          onClose={() => { setSelectedInvitation(null); setShowNextTimeInput(false); setNextTimeNote(''); }}
          statusBadge={statusBadge}
        />
      )}

      {selectedChallenge && currentUserId && (
        <ChallengeDetailScreen
          challenge={selectedChallenge}
          currentUserId={currentUserId}
          onClose={() => { setSelectedChallenge(null); loadChallenges(); }}
          onContactMember={onContactMember}
          onViewMemberProfile={setViewProfileUserId}
        />
      )}

      {viewProfileUserId && (
        <MemberProfileModal
          userId={viewProfileUserId}
          onClose={() => setViewProfileUserId(null)}
          onContact={(id, name, avatar) => { setViewProfileUserId(null); onContactMember(id, name, avatar); }}
        />
      )}

      <BottomNav active={activeScreen} onChange={onNavigate} unreadBookings={unreadBookings} />

      {selectedPhoto && createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col bg-black" onClick={() => setSelectedPhoto(null)}>
          <div className="flex items-center justify-between px-4 pb-3 shrink-0" style={{ paddingTop: 'max(52px, env(safe-area-inset-top))' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {selectedPhoto.author && (
                <img src={selectedPhoto.author.avatar_url || ''} alt={selectedPhoto.author.name} className="w-9 h-9 rounded-full object-cover border border-amber-400/30 shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="text-white font-bold text-base leading-tight truncate">{selectedPhoto.meal_name}</h3>
                {selectedPhoto.author && <p className="text-amber-300/60 text-xs">{selectedPhoto.author.name}</p>}
                {selectedPhoto.challenge && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-amber-400 text-[11px] fill-1">emoji_events</span>
                    <p className="text-amber-400/60 text-[11px] truncate">{selectedPhoto.challenge.title}</p>
                  </div>
                )}
                {selectedPhoto.caption && <p className="text-white/40 text-xs mt-0.5 truncate">{selectedPhoto.caption}</p>}
              </div>
            </div>
            <button onClick={() => setSelectedPhoto(null)} className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center shrink-0 ml-3">
              <span className="material-symbols-outlined text-white text-[22px]">close</span>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 py-3 min-h-0" onClick={(e) => e.stopPropagation()}>
            <img src={selectedPhoto.image_url} alt={selectedPhoto.meal_name} className="max-w-full max-h-full object-contain rounded-2xl" />
          </div>
          {selectedPhoto.user_id !== currentUserId && (
            <div className="px-4 pt-2 shrink-0" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => hidePhoto(selectedPhoto)}
                disabled={hidingPhoto}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/8 border border-white/15 text-white/50 font-semibold text-sm active:scale-95 transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                {hidingPhoto ? 'Masquage...' : 'Masquer cette photo'}
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {selectedMyPhoto && createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col bg-black" onClick={() => setSelectedMyPhoto(null)}>
          <div className="flex items-center justify-between px-4 pb-3 shrink-0" style={{ paddingTop: 'max(52px, env(safe-area-inset-top))' }} onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-bold text-base leading-tight truncate">{selectedMyPhoto.meal_name}</h3>
              {selectedMyPhoto.challenge && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-amber-400 text-[12px] fill-1">emoji_events</span>
                  <p className="text-amber-400/70 text-xs truncate">{selectedMyPhoto.challenge.title}</p>
                </div>
              )}
              {selectedMyPhoto.caption && <p className="text-white/40 text-xs mt-0.5 truncate">{selectedMyPhoto.caption}</p>}
            </div>
            <button onClick={() => setSelectedMyPhoto(null)} className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center shrink-0 ml-3">
              <span className="material-symbols-outlined text-white text-[22px]">close</span>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 py-3 min-h-0" onClick={(e) => e.stopPropagation()}>
            <img src={selectedMyPhoto.image_url} alt={selectedMyPhoto.meal_name} className="max-w-full max-h-full object-contain rounded-2xl" />
          </div>
          <div className="px-4 pt-2 pb-6 shrink-0" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => handleDeletePhoto(selectedMyPhoto)} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-sm active:scale-95 transition-all">
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Supprimer cette photo
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ChallengesTab({
  challenges,
  loading,
  currentUserId,
  showCreate,
  challengeTitle,
  challengeDesc,
  creating,
  acceptedResponsibility,
  createError,
  onShowCreate,
  onTitleChange,
  onDescChange,
  onAcceptResponsibility,
  onCreate,
  onCancelCreate,
  onSelectChallenge,
}: {
  challenges: CulinaryChallenge[];
  loading: boolean;
  currentUserId: string;
  showCreate: boolean;
  challengeTitle: string;
  challengeDesc: string;
  creating: boolean;
  acceptedResponsibility: boolean;
  createError: string | null;
  onShowCreate: () => void;
  onTitleChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onAcceptResponsibility: (v: boolean) => void;
  onCreate: () => void;
  onCancelCreate: () => void;
  onSelectChallenge: (c: CulinaryChallenge) => void;
}) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    open: { label: 'Ouvert', color: 'bg-green-500/20 text-green-300 border-green-500/20' },
    active: { label: 'En cours', color: 'bg-amber-500/20 text-amber-300 border-amber-500/20' },
    closed: { label: 'Fermé', color: 'bg-red-500/20 text-red-300 border-red-500/20' },
    completed: { label: 'Terminé', color: 'bg-white/10 text-white/40 border-white/10' },
  };

  if (loading) {
    return (
      <div className="px-4 pt-3 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/5 rounded-2xl h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      {!showCreate && (
        <button
          onClick={onShowCreate}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-300 font-bold text-sm active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">emoji_events</span>
          Lancer un nouveau défi
        </button>
      )}

      {showCreate && (
        <div className="bg-black/40 rounded-3xl border border-amber-400/20 p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">Nouveau défi cercle · 3–5 personnes</p>
          <input
            type="text"
            value={challengeTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Titre du défi *  (ex: Voyage culinaire japonais)"
            className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50"
          />
          <textarea
            value={challengeDesc}
            onChange={(e) => onDescChange(e.target.value)}
            placeholder="Décris l'esprit du défi, le thème, l'ambiance souhaitée..."
            rows={3}
            className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50 resize-none"
          />
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-[10px] text-amber-400/70 leading-relaxed">
              Chaque membre accueille les autres chez lui pour un repas. Minimum 3, maximum 5 personnes. Chacun note les repas à la fin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onAcceptResponsibility(!acceptedResponsibility)}
            className="w-full flex items-start gap-3 bg-white/5 border border-amber-400/20 rounded-xl p-3 text-left active:scale-95 transition-all"
          >
            <div className={`flex-shrink-0 w-5 h-5 rounded border-2 mt-0.5 flex items-center justify-center transition-all ${acceptedResponsibility ? 'bg-amber-500 border-amber-500' : 'border-amber-400/40'}`}>
              {acceptedResponsibility && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <p className="text-[11px] text-amber-200/70 leading-relaxed">
              Je comprends que ShareEat n'est pas responsable des rencontres organisées via cette plateforme. Les participants sont seuls responsables de leurs interactions, de leur sécurité et du respect des règles lors des repas du Cercle.
            </p>
          </button>
          {createError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-[11px] text-red-400 leading-relaxed">{createError}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onCancelCreate}
              className="flex-1 py-2.5 rounded-xl border border-amber-400/20 text-amber-400/60 text-sm font-bold">
              Annuler
            </button>
            <button onClick={onCreate} disabled={creating || !challengeTitle.trim() || !acceptedResponsibility}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1.5">
              {creating ? (
                <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Création...</>
              ) : (
                <><span className="material-symbols-outlined text-[14px]">emoji_events</span>Lancer le défi</>
              )}
            </button>
          </div>
        </div>
      )}

      {challenges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
          <div className="w-20 h-20 bg-amber-400/10 rounded-full flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-amber-400/40 text-[40px]">emoji_events</span>
          </div>
          <p className="text-amber-200 font-bold text-base mb-1">Aucun défi en cours</p>
          <p className="text-amber-400/50 text-sm mb-5 leading-relaxed">
            Lance le premier défi du Cercle ! Réunis 3 à 5 membres, chacun cuisine chez soi et les autres notent.
          </p>
          {!showCreate && (
            <button
              onClick={onShowCreate}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 text-white font-bold text-sm active:scale-95 transition-all shadow-lg shadow-amber-500/30"
            >
              <span className="material-symbols-outlined text-[18px]">emoji_events</span>
              Lancer le premier défi
            </button>
          )}
        </div>
      ) : (
        challenges.map((c) => {
          const sc = statusConfig[c.status] ?? statusConfig.open;
          const isMyChallenge = c.creator_id === currentUserId;
          const hasPendingApplicants = isMyChallenge && (c.pending_count ?? 0) > 0;
          const myStatus = c.my_status ?? null;
          const iAmPending = !isMyChallenge && myStatus === 'pending';
          const iAmAccepted = !isMyChallenge && myStatus === 'accepted';
          const iAmInvited = iAmPending && c.my_invited_by;

          let cardBorder = 'bg-white/5 border-amber-400/10';
          if (hasPendingApplicants) cardBorder = 'bg-amber-500/10 border-amber-400/30';
          else if (iAmPending) cardBorder = 'bg-amber-500/8 border-amber-400/25';
          else if (iAmAccepted) cardBorder = 'bg-green-500/8 border-green-500/20';

          return (
            <button
              key={c.id}
              onClick={() => onSelectChallenge(c)}
              className={`w-full text-left rounded-2xl p-4 active:scale-[0.98] transition-all relative border ${cardBorder}`}
            >
              {hasPendingApplicants && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-red-500 rounded-full px-2 py-0.5">
                  <span className="material-symbols-outlined text-white text-[10px]">person_add</span>
                  <span className="text-white text-[10px] font-extrabold">{c.pending_count}</span>
                </div>
              )}
              {iAmPending && !hasPendingApplicants && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500/80 rounded-full px-2 py-0.5">
                  <span className="material-symbols-outlined text-white text-[10px]">pending</span>
                  <span className="text-white text-[10px] font-extrabold">En attente</span>
                </div>
              )}
              {iAmAccepted && !hasPendingApplicants && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-green-500/80 rounded-full px-2 py-0.5">
                  <span className="material-symbols-outlined text-white text-[10px]">check_circle</span>
                  <span className="text-white text-[10px] font-extrabold">Accepté</span>
                </div>
              )}
              <div className="flex items-start gap-3">
                <img
                  src={c.creator?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                  alt={c.creator?.name}
                  className="w-10 h-10 rounded-full object-cover border border-amber-400/20 shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0 pr-20">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-extrabold text-amber-100 truncate">{c.title}</p>
                    <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${sc.color} shrink-0`}>
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-400/50">
                    {isMyChallenge ? 'Mon défi' : `Par ${c.creator?.name}`}
                  </p>
                  {c.description && (
                    <p className="text-xs text-amber-300/40 mt-1 line-clamp-2">{c.description}</p>
                  )}
                </div>
              </div>

              {iAmPending && (
                <div className="mt-2.5 bg-amber-500/10 border border-amber-400/20 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400/70 text-[14px]">hourglass_empty</span>
                  <p className="text-xs text-amber-300/70 flex-1">
                    {iAmInvited ? "Tu as été invité(e) — réponds à l'invitation" : "Candidature envoyée — attente d'acceptation par le créateur"}
                  </p>
                  <span className="material-symbols-outlined text-amber-400/40 text-[14px]">chevron_right</span>
                </div>
              )}

              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-amber-400/40 text-[14px]">group</span>
                  <span className="text-xs text-amber-400/50">{c.member_count ?? 0}/{c.max_members} membres</span>
                </div>
                {hasPendingApplicants && (
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-red-400/80 text-[14px]">pending</span>
                    <span className="text-xs text-red-400/80 font-semibold">
                      {c.pending_count} candidature{(c.pending_count ?? 0) > 1 ? 's' : ''} en attente
                    </span>
                  </div>
                )}
                {!hasPendingApplicants && !iAmPending && !iAmAccepted && (c.status === 'open' || c.status === 'active') && (c.member_count ?? 0) < c.max_members && !isMyChallenge && (
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-green-400/60 text-[14px]">person_add</span>
                    <span className="text-xs text-green-400/60">Places disponibles</span>
                  </div>
                )}
                <div className="ml-auto">
                  <span className="material-symbols-outlined text-amber-400/30 text-[16px]">chevron_right</span>
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

function FeedTab({
  photos,
  loading,
  challengeFilter,
  onChallengeFilterChange,
  onSelectPhoto,
}: {
  photos: CulinaryPhoto[];
  loading: boolean;
  challengeFilter: string | null;
  onChallengeFilterChange: (id: string | null) => void;
  onSelectPhoto: (p: CulinaryPhoto) => void;
}) {
  const challengesInFeed = Array.from(
    new Map(
      photos
        .filter((p) => p.challenge_id && p.challenge)
        .map((p) => [p.challenge_id!, p.challenge!])
    ).entries()
  ).map(([id, c]) => ({ id, title: c.title }));

  const filtered = challengeFilter
    ? photos.filter((p) => p.challenge_id === challengeFilter)
    : photos;

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1 p-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-amber-900/20 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        <div className="w-16 h-16 bg-amber-400/10 rounded-full flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-amber-400/40 text-[32px]">photo_camera</span>
        </div>
        <p className="text-amber-300/50 font-semibold">Aucune photo partagée pour l'instant</p>
        <p className="text-amber-400/30 text-sm mt-1 leading-relaxed">
          Partage des photos de tes plats depuis l'onglet "Moi" et associe-les à un défi
        </p>
      </div>
    );
  }

  return (
    <div>
      {challengesInFeed.length > 0 && (
        <div className="px-3 pt-2 pb-3 flex gap-2 overflow-x-auto">
          <button
            onClick={() => onChallengeFilterChange(null)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
              !challengeFilter
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white/5 text-amber-300/50 border-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[12px]">grid_view</span>
            Tout
          </button>
          {challengesInFeed.map((c) => (
            <button
              key={c.id}
              onClick={() => onChallengeFilterChange(challengeFilter === c.id ? null : c.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border max-w-[160px] ${
                challengeFilter === c.id
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white/5 text-amber-300/50 border-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[12px] shrink-0">emoji_events</span>
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-12 h-12 bg-amber-400/10 rounded-full flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-amber-400/40 text-[24px]">photo_camera</span>
          </div>
          <p className="text-amber-300/40 text-sm">Aucune photo pour ce défi</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 p-1">
          {filtered.map((photo) => (
            <button
              key={photo.id}
              onClick={() => onSelectPhoto(photo)}
              className="aspect-square relative rounded-xl overflow-hidden active:scale-95 transition-all group"
            >
              <img
                src={photo.image_url}
                alt={photo.meal_name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {photo.challenge_id && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-amber-500/80 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[11px] fill-1">emoji_events</span>
                </div>
              )}
              {photo.author && (
                <div className="absolute bottom-1 left-1">
                  <img
                    src={photo.author.avatar_url || ''}
                    alt={photo.author.name}
                    className="w-5 h-5 rounded-full object-cover border border-amber-400/40"
                  />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-active:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MembersTab({
  members,
  loading,
  hiddenMemberIds,
  showHidden,
  onToggleShowHidden,
  onInvite,
  onContact,
  onHide,
  onUnhide,
  onViewProfile,
}: {
  members: CircleMember[];
  loading: boolean;
  hiddenMemberIds: Set<string>;
  showHidden: boolean;
  onToggleShowHidden: () => void;
  onInvite: (m: CircleMember) => void;
  onContact: (hostId: string, hostName: string, hostAvatar: string) => void;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onViewProfile: (userId: string) => void;
}) {
  if (loading) {
    return (
      <div className="px-4 pt-3 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white/5 rounded-2xl p-4 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  const visibleMembers = members.filter((m) => !hiddenMemberIds.has(m.id));
  const hiddenMembers = members.filter((m) => hiddenMemberIds.has(m.id));

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        <div className="w-16 h-16 bg-amber-400/10 rounded-full flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-amber-400/40 text-[32px]">group</span>
        </div>
        <p className="text-amber-300/50 font-semibold">Aucun membre pour l'instant</p>
        <p className="text-amber-400/30 text-sm mt-1">Rejoins la communauté et partage tes repas</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 pb-6 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/40">
          {visibleMembers.length} membre{visibleMembers.length > 1 ? 's' : ''} du Cercle
        </p>
        {hiddenMembers.length > 0 && (
          <button
            onClick={onToggleShowHidden}
            className="flex items-center gap-1 text-[10px] text-amber-400/40 hover:text-amber-400/70 transition-colors"
          >
            <span className="material-symbols-outlined text-[13px]">
              {showHidden ? 'visibility_off' : 'visibility'}
            </span>
            {showHidden ? 'Masquer' : `${hiddenMembers.length} masqué${hiddenMembers.length > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {visibleMembers.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          isHidden={false}
          onInvite={onInvite}
          onContact={onContact}
          onHide={onHide}
          onUnhide={onUnhide}
          onViewProfile={onViewProfile}
        />
      ))}

      {showHidden && hiddenMembers.length > 0 && (
        <>
          <div className="pt-2 pb-1">
            <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/20">
              Masqués de mon Cercle
            </p>
          </div>
          {hiddenMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isHidden={true}
              onInvite={onInvite}
              onContact={onContact}
              onHide={onHide}
              onUnhide={onUnhide}
              onViewProfile={onViewProfile}
            />
          ))}
        </>
      )}
    </div>
  );
}

function MemberCard({
  member,
  isHidden,
  onInvite,
  onContact,
  onHide,
  onUnhide,
  onViewProfile,
}: {
  member: CircleMember;
  isHidden: boolean;
  onInvite: (m: CircleMember) => void;
  onContact: (hostId: string, hostName: string, hostAvatar: string) => void;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onViewProfile: (userId: string) => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className={`border rounded-2xl p-3 overflow-hidden transition-all ${
      isHidden
        ? 'bg-white/3 border-white/5 opacity-60'
        : 'bg-white/5 border-amber-400/10'
    }`}>
      <div className="flex items-center gap-3">
        <img
          src={member.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
          alt={member.name}
          className={`w-11 h-11 rounded-full object-cover border-2 shrink-0 ${isHidden ? 'border-white/10 grayscale' : 'border-amber-400/20'}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-amber-100 truncate">{member.name}</p>
            {!isHidden && (
              <span className="material-symbols-outlined text-amber-400 text-[13px] fill-1 shrink-0">verified</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-amber-400/40">{member.shares_count} partages</p>
            {member.rating > 0 && !isHidden && (
              <div className="flex items-center gap-0.5">
                <span className="material-symbols-outlined text-amber-400 text-[10px] fill-1">star</span>
                <span className="text-[10px] text-amber-300/50">{member.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
          {member.location_name && !isHidden && (
            <p className="text-[10px] text-amber-400/30 truncate mt-0.5">{member.location_name}</p>
          )}
        </div>
        {!isHidden ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 shrink-0"
          >
            <span className="material-symbols-outlined text-white/30 text-[15px]">person_remove</span>
          </button>
        ) : (
          <button
            onClick={() => onUnhide(member.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/20 text-amber-400/60 text-[10px] font-bold shrink-0 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[12px]">visibility</span>
            Restaurer
          </button>
        )}
      </div>

      {!isHidden && member.photos.length > 0 && (
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {member.photos.slice(0, 5).map((ph) => (
            <img
              key={ph.id}
              src={ph.image_url}
              alt={ph.meal_name}
              className="w-14 h-14 rounded-xl object-cover shrink-0 border border-amber-400/10"
            />
          ))}
        </div>
      )}

      {!isHidden && (
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={() => onViewProfile(member.id)}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-white/5 border border-amber-400/15 text-amber-300/60 text-xs font-bold active:scale-95 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[13px]">person</span>
          </button>
          <button
            onClick={() => onContact(member.id, member.name, member.avatar_url)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 border border-amber-400/15 text-amber-300/70 text-xs font-bold active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[13px]">chat_bubble</span>
            Message
          </button>
          <button
            onClick={() => onInvite(member)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/80 text-white text-xs font-bold active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[13px]">send</span>
            Inviter
          </button>
        </div>
      )}

      {showConfirm && (
        <div className="mt-3 bg-black/40 rounded-2xl border border-red-500/20 p-3 space-y-2">
          <p className="text-xs text-amber-200/70 leading-relaxed">
            Masquer <span className="font-bold text-amber-100">{member.name}</span> de ton Cercle ? Il ne sera plus visible dans ta liste.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-2 rounded-xl border border-amber-400/20 text-amber-400/50 text-xs font-bold active:scale-95 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={() => { onHide(member.id); setShowConfirm(false); }}
              className="flex-1 py-2 rounded-xl bg-red-500/80 text-white text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[12px]">person_remove</span>
              Masquer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InvitationsTab({
  received,
  sent,
  loading,
  invTab,
  onChangeInvTab,
  onSelectInvitation,
  statusBadge,
}: {
  received: CulinaryInvitation[];
  sent: CulinaryInvitation[];
  loading: boolean;
  invTab: 'received' | 'sent';
  onChangeInvTab: (t: 'received' | 'sent') => void;
  onSelectInvitation: (inv: CulinaryInvitation) => void;
  statusBadge: (status: string) => React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="px-4 pt-3 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/5 rounded-2xl p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const list = invTab === 'received' ? received : sent;

  return (
    <div className="pt-3 pb-6">
      <div className="px-4 mb-3">
        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1">
          {(['received', 'sent'] as const).map((t) => (
            <button
              key={t}
              onClick={() => onChangeInvTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                invTab === t ? 'bg-amber-500 text-white' : 'text-amber-300/40'
              }`}
            >
              {t === 'received'
                ? `Reçues${received.length > 0 ? ` (${received.length})` : ''}`
                : `Envoyées${sent.length > 0 ? ` (${sent.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-amber-400/30 text-[26px]">
              {invTab === 'received' ? 'mail' : 'send'}
            </span>
          </div>
          <p className="text-amber-300/40 text-sm">
            {invTab === 'received' ? 'Aucune invitation reçue' : 'Aucune invitation envoyée'}
          </p>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {list.map((inv) => {
            const person = invTab === 'received' ? inv.host : inv.guest;
            return (
              <button
                key={inv.id}
                onClick={() => onSelectInvitation(inv)}
                className="w-full text-left bg-white/5 rounded-2xl border border-amber-400/10 p-4 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <img
                    src={person?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                    alt={person?.name}
                    className="w-9 h-9 rounded-full object-cover border border-amber-400/20 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-100 truncate">{person?.name}</p>
                    <p className="text-[10px] text-amber-400/40">{formatDate(inv.created_at)}</p>
                  </div>
                  {statusBadge(inv.status)}
                </div>
                <p className="text-sm font-semibold text-amber-200">{inv.meal_name}</p>
                {inv.proposed_date && (
                  <p className="text-[10px] text-amber-400/40 mt-0.5">{formatDateShort(inv.proposed_date)}</p>
                )}
                {inv.message && (
                  <p className="text-xs text-amber-300/40 mt-1.5 italic line-clamp-2">"{inv.message}"</p>
                )}
                {inv.status === 'pending' && invTab === 'received' && (
                  <div className="mt-2 flex items-center gap-1 text-amber-400/50">
                    <span className="material-symbols-outlined text-[12px]">touch_app</span>
                    <span className="text-[10px] font-medium">Appuyer pour répondre</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MyGalleryTab({
  photos,
  loading,
  showAddForm,
  uploading,
  uploadError,
  onDismissError,
  previewUrl,
  photoMealName,
  photoCaption,
  photoChallengeId,
  myAcceptedChallenges,
  onPhotoMealNameChange,
  onPhotoCaptionChange,
  onPhotoChallengeIdChange,
  onAddClick,
  onUpload,
  onCancelAdd,
  onSelectPhoto,
}: {
  photos: CulinaryPhoto[];
  loading: boolean;
  showAddForm: boolean;
  uploading: boolean;
  uploadError: string | null;
  onDismissError: () => void;
  previewUrl: string | null;
  photoMealName: string;
  photoCaption: string;
  photoChallengeId: string | null;
  myAcceptedChallenges: { id: string; title: string }[];
  onPhotoMealNameChange: (v: string) => void;
  onPhotoCaptionChange: (v: string) => void;
  onPhotoChallengeIdChange: (v: string | null) => void;
  onAddClick: () => void;
  onUpload: () => void;
  onCancelAdd: () => void;
  onSelectPhoto: (p: CulinaryPhoto) => void;
}) {
  if (loading) {
    return (
      <div className="px-4 pt-3 grid grid-cols-3 gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square bg-amber-900/20 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="pt-3 pb-6">
      {!showAddForm && (
        <div className="px-4 mb-4">
          <button
            onClick={onAddClick}
            className="w-full flex items-center justify-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-2xl py-3.5 text-amber-300 font-bold text-sm active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
            Ajouter une photo culinaire
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="mx-4 mb-4 bg-black/40 rounded-3xl border border-amber-400/20 overflow-hidden">
          {previewUrl && (
            <div className="relative">
              <img src={previewUrl} alt="preview" className="w-full aspect-video object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          )}
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/70 mb-1.5 block">
                Nom du plat *
              </label>
              <input
                type="text"
                value={photoMealName}
                onChange={(e) => onPhotoMealNameChange(e.target.value)}
                placeholder="Ex: Risotto aux champignons"
                className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/70 mb-1.5 block">
                Description (optionnel)
              </label>
              <textarea
                value={photoCaption}
                onChange={(e) => onPhotoCaptionChange(e.target.value)}
                placeholder="Décris ce qui rend ce plat spécial..."
                rows={2}
                className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50 resize-none"
              />
            </div>
            {myAcceptedChallenges.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/70 mb-1.5 block">
                  Lier à un défi (optionnel)
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onPhotoChallengeIdChange(null)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                      !photoChallengeId
                        ? 'bg-amber-500/30 border-amber-500/50 text-amber-200'
                        : 'bg-white/5 border-white/10 text-amber-400/40'
                    }`}
                  >
                    Aucun défi
                  </button>
                  {myAcceptedChallenges.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onPhotoChallengeIdChange(photoChallengeId === c.id ? null : c.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border max-w-[200px] ${
                        photoChallengeId === c.id
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-white/5 border-white/10 text-amber-400/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[11px] shrink-0">emoji_events</span>
                      <span className="truncate">{c.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {uploadError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5">
                <span className="material-symbols-outlined text-red-400 text-[16px] shrink-0">error</span>
                <p className="text-xs text-red-300 flex-1">{uploadError}</p>
                <button onClick={onDismissError} className="text-red-400/60 shrink-0">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={onCancelAdd}
                className="flex-1 py-2.5 rounded-xl border border-amber-400/20 text-amber-400/60 text-sm font-bold active:scale-95 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={onUpload}
                disabled={uploading || !photoMealName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {uploading ? (
                  <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Envoi...</>
                ) : (
                  <><span className="material-symbols-outlined text-[14px]">check</span>Publier</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {photos.length === 0 && !showAddForm ? (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-16 h-16 bg-amber-400/10 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-amber-400/40 text-[32px]">photo_camera</span>
          </div>
          <p className="text-amber-300/50 font-semibold">Aucune photo pour l'instant</p>
          <p className="text-amber-400/30 text-sm mt-1">Partage tes créations culinaires pour attirer des invités</p>
        </div>
      ) : (
        <div className="px-1 grid grid-cols-3 gap-1">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => onSelectPhoto(photo)}
              className="aspect-square relative rounded-xl overflow-hidden active:scale-95 transition-all"
            >
              <img src={photo.image_url} alt={photo.meal_name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              {photo.challenge_id && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-amber-500/80 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[11px] fill-1">emoji_events</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SendInviteSheet({
  member,
  mealName,
  message,
  proposedDate,
  sending,
  onMealNameChange,
  onMessageChange,
  onProposedDateChange,
  onSend,
  onClose,
}: {
  member: CircleMember;
  mealName: string;
  message: string;
  proposedDate: string;
  sending: boolean;
  onMealNameChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onProposedDateChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(to bottom, #1c0a00, #0f0700, #000)' }}>
      <div className="flex items-center px-4 pt-14 pb-4 border-b border-amber-400/10">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 mr-3">
          <span className="material-symbols-outlined text-amber-300 text-[20px]">arrow_back</span>
        </button>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">Cercle Culinaire</p>
          <h2 className="text-base font-extrabold text-amber-100">Inviter {member.name}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {member.photos.length > 0 && (
          <div className="relative h-52 bg-black overflow-hidden">
            <img src={member.photos[activePhotoIdx]?.image_url} alt="" className="w-full h-full object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-white font-bold text-sm">{member.photos[activePhotoIdx]?.meal_name}</p>
            </div>
            {member.photos.length > 1 && (
              <div className="absolute top-3 right-3 flex gap-1">
                {member.photos.map((_, i) => (
                  <button key={i} onClick={() => setActivePhotoIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === activePhotoIdx ? 'bg-white' : 'bg-white/30'}`} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-4 pt-4 pb-8 space-y-4">
          <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 border border-amber-400/10">
            <img src={member.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'} alt={member.name}
              className="w-11 h-11 rounded-full object-cover border-2 border-amber-400/30 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-100">{member.name}</p>
              <p className="text-[10px] text-amber-400/50">{member.shares_count} partages · Note {member.rating.toFixed(1)}</p>
              {member.location_name && <p className="text-[10px] text-amber-400/30 mt-0.5">{member.location_name}</p>}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60 mb-1.5 block">Quel plat tu proposes ? *</label>
            <input type="text" value={mealName} onChange={(e) => onMealNameChange(e.target.value)}
              placeholder="Ex: Tajine d'agneau aux pruneaux"
              className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-3 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60 mb-1.5 block">Date proposée (optionnel)</label>
            <input type="datetime-local" value={proposedDate} onChange={(e) => onProposedDateChange(e.target.value)}
              className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-3 text-sm text-amber-100 outline-none focus:border-amber-400/50 [color-scheme:dark]" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60 mb-1.5 block">Message personnel (optionnel)</label>
            <textarea value={message} onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Présente ton repas, ton ambiance, ton intention..." rows={3}
              className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-3 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50 resize-none" />
          </div>

          <button onClick={onSend} disabled={sending || !mealName.trim()}
            className="w-full py-4 rounded-2xl bg-amber-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
            {sending ? (
              <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Envoi en cours...</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">send</span>Envoyer l'invitation</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvitationDetailSheet({
  invitation,
  currentUserId,
  nextTimeNote,
  onNextTimeNoteChange,
  responding,
  showNextTimeInput,
  onShowNextTimeInput,
  onRespond,
  onClose,
  statusBadge,
}: {
  invitation: CulinaryInvitation;
  currentUserId: string;
  nextTimeNote: string;
  onNextTimeNoteChange: (v: string) => void;
  responding: boolean;
  showNextTimeInput: boolean;
  onShowNextTimeInput: (v: boolean) => void;
  onRespond: (inv: CulinaryInvitation, status: 'accepted' | 'declined' | 'next_time') => void;
  onClose: () => void;
  statusBadge: (status: string) => React.ReactNode;
}) {
  const [hostPhotos, setHostPhotos] = useState<CulinaryPhoto[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const isGuest = invitation.guest_id === currentUserId;

  useEffect(() => {
    if (!invitation.host_id) return;
    supabase
      .from('culinary_circle_photos')
      .select('id, user_id, image_url, caption, meal_name, likes_count, challenge_id, created_at')
      .eq('user_id', invitation.host_id)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setHostPhotos((data ?? []) as CulinaryPhoto[]));
  }, [invitation.host_id]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(to bottom, #1c0a00, #0f0700, #000)' }}>
      <div className="flex items-center px-4 pt-14 pb-4 border-b border-amber-400/10">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 mr-3">
          <span className="material-symbols-outlined text-amber-300 text-[20px]">arrow_back</span>
        </button>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">Cercle Culinaire</p>
          <h2 className="text-base font-extrabold text-amber-100">Invitation</h2>
        </div>
        <div className="ml-auto">{statusBadge(invitation.status)}</div>
      </div>

      <div className="flex-1 overflow-y-auto pb-10">
        {hostPhotos.length > 0 && (
          <div className="relative h-60 bg-black overflow-hidden">
            <img src={hostPhotos[activeIdx]?.image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white font-bold text-lg">{hostPhotos[activeIdx]?.meal_name}</p>
              {hostPhotos[activeIdx]?.caption && <p className="text-white/60 text-sm mt-0.5">{hostPhotos[activeIdx].caption}</p>}
            </div>
            {hostPhotos.length > 1 && (
              <div className="absolute top-3 right-3 flex gap-1">
                {hostPhotos.map((_, i) => (
                  <button key={i} onClick={() => setActiveIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIdx ? 'bg-white' : 'bg-white/30'}`} />
                ))}
              </div>
            )}
          </div>
        )}

        {hostPhotos.length > 1 && (
          <div className="px-4 pt-3 flex gap-1.5 overflow-x-auto pb-1">
            {hostPhotos.map((ph, i) => (
              <button key={ph.id} onClick={() => setActiveIdx(i)}
                className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${i === activeIdx ? 'border-amber-400' : 'border-transparent'}`}>
                <img src={ph.image_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}

        <div className="px-4 pt-5 space-y-4">
          <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 border border-amber-400/10">
            <img src={invitation.host?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
              alt={invitation.host?.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-amber-400/30 shrink-0" />
            <div>
              <p className="text-xs text-amber-400/50 mb-0.5">Invitation de</p>
              <p className="text-sm font-bold text-amber-100">{invitation.host?.name}</p>
              <p className="text-[10px] text-amber-400/40">{formatDate(invitation.created_at)}</p>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl border border-amber-400/10 p-4 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/50">Repas proposé</p>
              <p className="text-lg font-extrabold text-amber-100 mt-0.5">{invitation.meal_name}</p>
            </div>
            {invitation.proposed_date && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/50">Date</p>
                <p className="text-sm text-amber-200 mt-0.5">{formatDate(invitation.proposed_date)}</p>
              </div>
            )}
            {invitation.message && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/50">Message</p>
                <p className="text-sm text-amber-300/70 leading-relaxed mt-0.5 italic">"{invitation.message}"</p>
              </div>
            )}
          </div>

          {isGuest && invitation.status === 'pending' && (
            <div className="space-y-2">
              <button onClick={() => onRespond(invitation, 'accepted')} disabled={responding}
                className="w-full py-3.5 rounded-2xl bg-green-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Je suis intéressé(e) !
              </button>
              {!showNextTimeInput ? (
                <button onClick={() => onShowNextTimeInput(true)} disabled={responding}
                  className="w-full py-3.5 rounded-2xl bg-white/5 border border-amber-400/20 text-amber-300/70 font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  Prochaine fois
                </button>
              ) : (
                <div className="bg-white/5 rounded-2xl border border-amber-400/10 p-3 space-y-2">
                  <p className="text-xs text-amber-400/60">Laisse un mot pour l'hôte (optionnel)</p>
                  <input type="text" value={nextTimeNote} onChange={(e) => onNextTimeNoteChange(e.target.value)}
                    placeholder="Ex: Je serai disponible en mars"
                    className="w-full bg-black/30 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none" />
                  <button onClick={() => onRespond(invitation, 'next_time')} disabled={responding}
                    className="w-full py-2.5 rounded-xl bg-blue-500/80 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40">
                    Confirmer "Prochaine fois"
                  </button>
                </div>
              )}
              <button onClick={() => onRespond(invitation, 'declined')} disabled={responding}
                className="w-full py-3 rounded-2xl text-red-400/60 font-medium text-sm active:scale-95 transition-all disabled:opacity-40">
                Décliner l'invitation
              </button>
            </div>
          )}

          {invitation.status !== 'pending' && (
            <div className="text-center py-4">
              <p className="text-amber-400/40 text-sm">
                {invitation.status === 'accepted' && 'Invitation acceptée'}
                {invitation.status === 'declined' && 'Invitation déclinée'}
                {invitation.status === 'next_time' && 'Répondu : Prochaine fois'}
              </p>
              {invitation.next_time_note && <p className="text-amber-300/30 text-xs mt-1 italic">"{invitation.next_time_note}"</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
