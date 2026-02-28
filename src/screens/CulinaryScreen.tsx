import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Screen, CulinaryPhoto, CulinaryInvitation, Profile, CulinaryChallenge } from '../types';
import BottomNav from '../components/BottomNav';
import ChallengeDetailScreen from '../components/culinary/ChallengeDetailScreen';

interface CulinaryScreenProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  unreadBookings?: number;
  onContactMember: (hostId: string, hostName: string, hostAvatar: string) => void;
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

export default function CulinaryScreen({ activeScreen, onNavigate, unreadBookings = 0, onContactMember }: CulinaryScreenProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('feed');

  const [challenges, setChallenges] = useState<CulinaryChallenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<CulinaryChallenge | null>(null);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDesc, setChallengeDesc] = useState('');
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [myPendingChallenges, setMyPendingChallenges] = useState(0);

  const [feedPhotos, setFeedPhotos] = useState<CulinaryPhoto[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<CulinaryPhoto | null>(null);

  const [members, setMembers] = useState<CircleMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedMyPhoto, setSelectedMyPhoto] = useState<CulinaryPhoto | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    const { data } = await supabase
      .from('culinary_circle_photos')
      .select('*, author:profiles!user_id(id, name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(60);
    setFeedPhotos((data as CulinaryPhoto[]) ?? []);
    setFeedLoading(false);
  }, []);

  const loadMembers = useCallback(async () => {
    if (!currentUserId) return;
    setMembersLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, shares_count, rating, location_name')
      .gte('shares_count', 10)
      .neq('id', currentUserId)
      .order('shares_count', { ascending: false })
      .limit(50);

    if (!profiles?.length) { setMembers([]); setMembersLoading(false); return; }

    const ids = profiles.map((p: Profile) => p.id);
    const { data: photos } = await supabase
      .from('culinary_circle_photos')
      .select('*')
      .in('user_id', ids)
      .order('created_at', { ascending: false });

    const photosByUser: Record<string, CulinaryPhoto[]> = {};
    (photos ?? []).forEach((ph: CulinaryPhoto) => {
      if (!photosByUser[ph.user_id]) photosByUser[ph.user_id] = [];
      if (photosByUser[ph.user_id].length < 6) photosByUser[ph.user_id].push(ph);
    });

    setMembers(
      (profiles as Profile[]).map((p) => ({
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
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });
    setMyPhotos((data as CulinaryPhoto[]) ?? []);
    setMyPhotosLoading(false);
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
        .select('challenge_id, status')
        .in('challenge_id', ids);

      const countByChallenge: Record<string, number> = {};
      const myPending: string[] = [];
      (membersData ?? []).forEach((m: { challenge_id: string; status: string; user_id?: string }) => {
        if (m.status === 'accepted') {
          countByChallenge[m.challenge_id] = (countByChallenge[m.challenge_id] ?? 0) + 1;
        }
      });

      const { data: myMemberships } = await supabase
        .from('culinary_challenge_members')
        .select('challenge_id, status, invited_by')
        .eq('user_id', currentUserId)
        .in('challenge_id', ids);

      (myMemberships ?? []).forEach((m: { challenge_id: string; status: string; invited_by: string | null }) => {
        if (m.status === 'pending' && m.invited_by) myPending.push(m.challenge_id);
      });

      setMyPendingChallenges(myPending.length);
      setChallenges(list.map((c) => ({ ...c, member_count: countByChallenge[c.id] ?? 0 })));
    } else {
      setChallenges([]);
      setMyPendingChallenges(0);
    }
    setChallengesLoading(false);
  }, [currentUserId]);

  const createChallenge = async () => {
    if (!challengeTitle.trim() || !currentUserId) return;
    setCreatingChallenge(true);
    const { data: newChallenge } = await supabase
      .from('culinary_challenges')
      .insert({
        creator_id: currentUserId,
        title: challengeTitle.trim(),
        description: challengeDesc.trim(),
      })
      .select()
      .maybeSingle();

    if (newChallenge) {
      await supabase.from('culinary_challenge_members').insert({
        challenge_id: newChallenge.id,
        user_id: currentUserId,
        role: 'creator',
        status: 'accepted',
        invited_by: null,
      });
    }
    setChallengeTitle('');
    setChallengeDesc('');
    setCreatingChallenge(false);
    await loadChallenges();
    setShowCreateChallenge(false);
  };

  useEffect(() => { loadFeed(); }, [loadFeed]);

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
    });
    setPhotoMealName('');
    setPhotoCaption('');
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
    setShowAddForm(false);
  };

  const handleDeletePhoto = async (photo: CulinaryPhoto) => {
    await supabase.from('culinary_circle_photos').delete().eq('id', photo.id);
    setSelectedMyPhoto(null);
    loadMyPhotos();
    loadFeed();
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
    <div className="flex flex-col w-full overflow-hidden" style={{ height: '100dvh', background: 'linear-gradient(to bottom, #1c0a00, #0f0700, #000)' }}>
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
            { id: 'feed', label: 'Galerie', icon: 'grid_view' },
            { id: 'challenges', label: 'Défis', icon: 'emoji_events' },
            { id: 'members', label: 'Membres', icon: 'group' },
            { id: 'invitations', label: 'Invitations', icon: 'mail' },
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
            selectedPhoto={selectedPhoto}
            onSelectPhoto={setSelectedPhoto}
            currentUserId={currentUserId}
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
            onShowCreate={() => setShowCreateChallenge(true)}
            onTitleChange={setChallengeTitle}
            onDescChange={setChallengeDesc}
            onCreate={createChallenge}
            onCancelCreate={() => { setShowCreateChallenge(false); setChallengeTitle(''); setChallengeDesc(''); }}
            onSelectChallenge={setSelectedChallenge}
          />
        )}
        {tab === 'members' && (
          <MembersTab
            members={members}
            loading={membersLoading}
            onInvite={openSendInvite}
            onContact={onContactMember}
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
            onPhotoMealNameChange={setPhotoMealName}
            onPhotoCaptionChange={setPhotoCaption}
            onAddClick={() => fileInputRef.current?.click()}
            onUpload={handleUpload}
            onCancelAdd={cancelAdd}
            selectedPhoto={selectedMyPhoto}
            onSelectPhoto={setSelectedMyPhoto}
            onDeletePhoto={handleDeletePhoto}
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
        />
      )}

      <BottomNav active={activeScreen} onChange={onNavigate} unreadBookings={unreadBookings} />
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
  onShowCreate,
  onTitleChange,
  onDescChange,
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
  onShowCreate: () => void;
  onTitleChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onCreate: () => void;
  onCancelCreate: () => void;
  onSelectChallenge: (c: CulinaryChallenge) => void;
}) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    open: { label: 'Ouvert', color: 'bg-green-500/20 text-green-300 border-green-500/20' },
    active: { label: 'En cours', color: 'bg-amber-500/20 text-amber-300 border-amber-500/20' },
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
          <div className="flex gap-2">
            <button onClick={onCancelCreate}
              className="flex-1 py-2.5 rounded-xl border border-amber-400/20 text-amber-400/60 text-sm font-bold">
              Annuler
            </button>
            <button onClick={onCreate} disabled={creating || !challengeTitle.trim()}
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
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-16 h-16 bg-amber-400/10 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-amber-400/30 text-[32px]">emoji_events</span>
          </div>
          <p className="text-amber-300/50 font-semibold">Aucun défi en cours</p>
          <p className="text-amber-400/30 text-sm mt-1">Lance le premier défi du Cercle !</p>
        </div>
      ) : (
        challenges.map((c) => {
          const sc = statusConfig[c.status] ?? statusConfig.open;
          const isMyChallenge = c.creator_id === currentUserId;
          return (
            <button
              key={c.id}
              onClick={() => onSelectChallenge(c)}
              className="w-full text-left bg-white/5 border border-amber-400/10 rounded-2xl p-4 active:scale-[0.98] transition-all"
            >
              <div className="flex items-start gap-3">
                <img
                  src={c.creator?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                  alt={c.creator?.name}
                  className="w-10 h-10 rounded-full object-cover border border-amber-400/20 shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
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
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-amber-400/40 text-[14px]">group</span>
                  <span className="text-xs text-amber-400/50">{c.member_count ?? 0}/{c.max_members} membres</span>
                </div>
                {c.status === 'open' && (c.member_count ?? 0) < c.max_members && (
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
  selectedPhoto,
  onSelectPhoto,
  currentUserId,
}: {
  photos: CulinaryPhoto[];
  loading: boolean;
  selectedPhoto: CulinaryPhoto | null;
  onSelectPhoto: (p: CulinaryPhoto | null) => void;
  currentUserId: string | null;
}) {
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
        <p className="text-amber-300/50 font-semibold">Galerie vide pour l'instant</p>
        <p className="text-amber-400/30 text-sm mt-1">Les membres partageront bientôt leurs créations</p>
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-3 gap-1 p-1">
        {photos.map((photo) => (
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

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/96" onClick={() => onSelectPhoto(null)}>
          <div className="flex items-center justify-between px-4 pt-14 pb-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {selectedPhoto.author && (
                <img
                  src={selectedPhoto.author.avatar_url || ''}
                  alt={selectedPhoto.author.name}
                  className="w-9 h-9 rounded-full object-cover border border-amber-400/30 shrink-0"
                />
              )}
              <div className="min-w-0">
                <h3 className="text-white font-bold text-base leading-tight truncate">{selectedPhoto.meal_name}</h3>
                {selectedPhoto.author && (
                  <p className="text-amber-300/60 text-xs">{selectedPhoto.author.name}</p>
                )}
                {selectedPhoto.caption && (
                  <p className="text-white/40 text-xs mt-0.5 truncate">{selectedPhoto.caption}</p>
                )}
              </div>
            </div>
            <button onClick={() => onSelectPhoto(null)} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center shrink-0 ml-2">
              <span className="material-symbols-outlined text-white text-[20px]">close</span>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
            <img src={selectedPhoto.image_url} alt={selectedPhoto.meal_name} className="w-full max-h-full object-contain rounded-2xl" />
          </div>
          {selectedPhoto.author && selectedPhoto.author.id !== currentUserId && (
            <div className="px-4 pb-10 pt-4" onClick={(e) => e.stopPropagation()}>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MembersTab({
  members,
  loading,
  onInvite,
  onContact,
}: {
  members: CircleMember[];
  loading: boolean;
  onInvite: (m: CircleMember) => void;
  onContact: (hostId: string, hostName: string, hostAvatar: string) => void;
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
      <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/40 mb-3">
        {members.length} membre{members.length > 1 ? 's' : ''} du Cercle
      </p>
      {members.map((member) => (
        <div key={member.id} className="bg-white/5 border border-amber-400/10 rounded-2xl p-3 overflow-hidden">
          <div className="flex items-center gap-3">
            <img
              src={member.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
              alt={member.name}
              className="w-11 h-11 rounded-full object-cover border-2 border-amber-400/20 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-amber-100 truncate">{member.name}</p>
                <span className="material-symbols-outlined text-amber-400 text-[13px] fill-1 shrink-0">verified</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] text-amber-400/40">
                  {member.shares_count} partages
                </p>
                {member.rating > 0 && (
                  <div className="flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-amber-400 text-[10px] fill-1">star</span>
                    <span className="text-[10px] text-amber-300/50">{member.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              {member.location_name && (
                <p className="text-[10px] text-amber-400/30 truncate mt-0.5">{member.location_name}</p>
              )}
            </div>
          </div>

          {member.photos.length > 0 && (
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

          <div className="mt-2.5 flex gap-2">
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
        </div>
      ))}
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
  onPhotoMealNameChange,
  onPhotoCaptionChange,
  onAddClick,
  onUpload,
  onCancelAdd,
  selectedPhoto,
  onSelectPhoto,
  onDeletePhoto,
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
  onPhotoMealNameChange: (v: string) => void;
  onPhotoCaptionChange: (v: string) => void;
  onAddClick: () => void;
  onUpload: () => void;
  onCancelAdd: () => void;
  selectedPhoto: CulinaryPhoto | null;
  onSelectPhoto: (p: CulinaryPhoto | null) => void;
  onDeletePhoto: (p: CulinaryPhoto) => void;
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
              <img src={photo.image_url} alt={photo.meal_name} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/96" onClick={() => onSelectPhoto(null)}>
          <div className="flex items-center justify-between px-4 pt-14 pb-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-white font-bold text-lg">{selectedPhoto.meal_name}</h3>
              {selectedPhoto.caption && <p className="text-white/40 text-sm mt-0.5">{selectedPhoto.caption}</p>}
            </div>
            <button onClick={() => onSelectPhoto(null)} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[20px]">close</span>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
            <img src={selectedPhoto.image_url} alt={selectedPhoto.meal_name} className="w-full max-h-full object-contain rounded-2xl" />
          </div>
          <div className="px-4 pb-10 pt-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onDeletePhoto(selectedPhoto)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-sm active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Supprimer cette photo
            </button>
          </div>
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
      .select('*')
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
                <img src={ph.image_url} alt="" className="w-full h-full object-cover" />
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
