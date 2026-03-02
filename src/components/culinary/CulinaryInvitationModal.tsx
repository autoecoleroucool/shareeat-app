import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { CulinaryInvitation, CulinaryPhoto, Profile } from '../../types';

interface Props {
  currentUserId: string;
  onClose: () => void;
}

type View = 'list' | 'send' | 'view_invitation';

interface CircleMember {
  id: string;
  name: string;
  avatar_url: string;
  shares_count: number;
  rating: number;
  location_name?: string;
  photos: CulinaryPhoto[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function CulinaryInvitationModal({ currentUserId, onClose }: Props) {
  const [view, setView] = useState<View>('list');
  const [invitations, setInvitations] = useState<CulinaryInvitation[]>([]);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<CircleMember | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<CulinaryInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [responding, setResponding] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [mealName, setMealName] = useState('');
  const [message, setMessage] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [nextTimeNote, setNextTimeNote] = useState('');
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  const loadInvitations = useCallback(async () => {
    const { data } = await supabase
      .from('culinary_invitations')
      .select(`
        *,
        host:host_id (id, name, avatar_url, shares_count),
        guest:guest_id (id, name, avatar_url)
      `)
      .or(`host_id.eq.${currentUserId},guest_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });
    setInvitations((data ?? []) as CulinaryInvitation[]);
  }, [currentUserId]);

  const loadMembers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, shares_count, rating, location_name')
      .gte('shares_count', 10)
      .neq('id', currentUserId)
      .order('shares_count', { ascending: false })
      .limit(50);

    if (!profiles?.length) { setMembers([]); return; }

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
  }, [currentUserId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadInvitations(), loadMembers()]).then(() => setLoading(false));
  }, [loadInvitations, loadMembers]);

  const openSendView = (member: CircleMember) => {
    setSelectedMember(member);
    setActivePhotoIdx(0);
    setMealName('');
    setMessage('');
    setProposedDate('');
    setView('send');
  };

  const sendInvitation = async () => {
    if (!selectedMember || !mealName.trim()) return;
    setSending(true);
    await supabase.from('culinary_invitations').insert({
      host_id: currentUserId,
      guest_id: selectedMember.id,
      meal_name: mealName.trim(),
      message: message.trim(),
      proposed_date: proposedDate || null,
    });
    setSending(false);
    setView('list');
    loadInvitations();
  };

  const respondToInvitation = async (inv: CulinaryInvitation, status: 'accepted' | 'declined' | 'next_time') => {
    setResponding(true);
    await supabase
      .from('culinary_invitations')
      .update({ status, next_time_note: status === 'next_time' ? nextTimeNote : '' })
      .eq('id', inv.id);
    setResponding(false);
    setSelectedInvitation(null);
    setView('list');
    setNextTimeNote('');
    loadInvitations();
  };

  const received = invitations.filter((i) => i.guest_id === currentUserId);
  const sent = invitations.filter((i) => i.host_id === currentUserId);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-amber-950 via-stone-950 to-black">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'radial-gradient(circle at 10% 20%, #fbbf24 0%, transparent 40%), radial-gradient(circle at 90% 80%, #f59e0b 0%, transparent 40%)',
        }}
      />

      <div className="relative flex items-center px-4 pt-14 pb-4 border-b border-amber-400/10">
        <button
          onClick={view === 'list' ? onClose : () => setView('list')}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 mr-3"
        >
          <span className="material-symbols-outlined text-amber-300 text-[20px]">
            {view === 'list' ? 'close' : 'arrow_back'}
          </span>
        </button>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60">Cercle Culinaire</p>
          <h2 className="text-base font-extrabold text-amber-100 leading-tight">
            {view === 'list' ? 'Invitations' : view === 'send' ? `Inviter ${selectedMember?.name}` : 'Invitation'}
          </h2>
        </div>
        <div className="ml-auto">
          <span className="material-symbols-outlined text-amber-400 text-[22px] fill-1">verified</span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="material-symbols-outlined text-amber-400/50 text-[40px] animate-spin">progress_activity</span>
        </div>
      ) : view === 'list' ? (
        <div className="relative flex-1 overflow-y-auto">
          <div className="px-4 pt-5 pb-3">
            <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1">
              {(['received', 'sent'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    tab === t
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-amber-300/50'
                  }`}
                >
                  {t === 'received' ? `Reçues ${received.length > 0 ? `(${received.length})` : ''}` : `Envoyées ${sent.length > 0 ? `(${sent.length})` : ''}`}
                </button>
              ))}
            </div>
          </div>

          {tab === 'received' && (
            <div className="px-4 space-y-3 pb-4">
              {received.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-amber-400/40 text-[26px]">mail</span>
                  </div>
                  <p className="text-amber-300/40 text-sm">Aucune invitation reçue</p>
                </div>
              ) : (
                received.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => { setSelectedInvitation(inv); setView('view_invitation'); }}
                    className="w-full text-left bg-white/5 rounded-2xl border border-amber-400/10 overflow-hidden active:scale-98 transition-all"
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={inv.host?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                          alt={inv.host?.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-amber-400/20"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-amber-100 truncate">{inv.host?.name}</p>
                          <p className="text-[10px] text-amber-400/50">
                            {formatDate(inv.created_at)}
                          </p>
                        </div>
                        {statusBadge(inv.status)}
                      </div>
                      <p className="text-sm font-semibold text-amber-200">{inv.meal_name}</p>
                      {inv.proposed_date && (
                        <p className="text-xs text-amber-400/50 mt-0.5">
                          {formatDateShort(inv.proposed_date)}
                        </p>
                      )}
                      {inv.message && (
                        <p className="text-xs text-amber-300/50 mt-2 leading-relaxed line-clamp-2 italic">
                          "{inv.message}"
                        </p>
                      )}
                      {inv.status === 'pending' && (
                        <div className="mt-3 flex items-center gap-1.5 text-amber-400/60">
                          <span className="material-symbols-outlined text-[14px]">touch_app</span>
                          <span className="text-xs font-medium">Appuyer pour répondre</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {tab === 'sent' && (
            <div className="px-4 space-y-3 pb-4">
              {sent.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-amber-400/40 text-[26px]">send</span>
                  </div>
                  <p className="text-amber-300/40 text-sm">Aucune invitation envoyée</p>
                </div>
              ) : (
                sent.map((inv) => (
                  <div key={inv.id} className="bg-white/5 rounded-2xl border border-amber-400/10 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={inv.guest?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                        alt={inv.guest?.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-amber-400/20"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-amber-100 truncate">{inv.guest?.name}</p>
                        <p className="text-[10px] text-amber-400/50">{formatDate(inv.created_at)}</p>
                      </div>
                      {statusBadge(inv.status)}
                    </div>
                    <p className="text-sm font-semibold text-amber-200">{inv.meal_name}</p>
                    {inv.next_time_note && (
                      <p className="text-xs text-amber-300/40 mt-2 italic">"{inv.next_time_note}"</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          <div className="px-4 pt-2 pb-6">
            <div className="bg-amber-400/5 border border-amber-400/10 rounded-3xl p-4 mb-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60 mb-3">
                Membres du Cercle
              </p>
              <div className="space-y-2">
                {members.length === 0 ? (
                  <p className="text-amber-300/30 text-sm text-center py-4">
                    Aucun autre membre pour l'instant
                  </p>
                ) : (
                  members.slice(0, 8).map((member) => (
                    <button
                      key={member.id}
                      onClick={() => openSendView(member)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 border border-amber-400/10 active:scale-98 transition-all text-left"
                    >
                      <img
                        src={member.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-amber-400/20 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-amber-100 truncate">{member.name}</p>
                        <p className="text-[10px] text-amber-400/40">
                          {member.shares_count} partages · {member.photos.length} photo{member.photos.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {member.photos.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {member.photos.slice(0, 2).map((ph) => (
                              <img
                                key={ph.id}
                                src={ph.image_url}
                                alt=""
                                className="w-7 h-7 rounded-lg object-cover border border-black"
                              />
                            ))}
                          </div>
                        )}
                        <span className="material-symbols-outlined text-amber-400/40 text-[18px] ml-1">chevron_right</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : view === 'send' && selectedMember ? (
        <div className="relative flex-1 overflow-y-auto">
          {selectedMember.photos.length > 0 && (
            <div className="relative">
              <div className="relative h-56 bg-black overflow-hidden">
                <img
                  src={selectedMember.photos[activePhotoIdx]?.image_url}
                  alt=""
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <p className="text-white font-bold text-base leading-tight">
                    {selectedMember.photos[activePhotoIdx]?.meal_name}
                  </p>
                  {selectedMember.photos[activePhotoIdx]?.caption && (
                    <p className="text-white/60 text-xs mt-0.5">
                      {selectedMember.photos[activePhotoIdx]?.caption}
                    </p>
                  )}
                </div>
                {selectedMember.photos.length > 1 && (
                  <div className="absolute top-3 right-3 flex gap-1">
                    {selectedMember.photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActivePhotoIdx(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === activePhotoIdx ? 'bg-white' : 'bg-white/30'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              {selectedMember.photos.length > 1 && (
                <div className="px-4 pt-3">
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {selectedMember.photos.map((ph, i) => (
                      <button
                        key={ph.id}
                        onClick={() => setActivePhotoIdx(i)}
                        className={`relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                          i === activePhotoIdx ? 'border-amber-400' : 'border-transparent'
                        }`}
                      >
                        <img src={ph.image_url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="px-4 pt-4 pb-8 space-y-4">
            <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 border border-amber-400/10">
              <img
                src={selectedMember.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                alt={selectedMember.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400/30 shrink-0"
              />
              <div>
                <p className="text-sm font-bold text-amber-100">{selectedMember.name}</p>
                <p className="text-[10px] text-amber-400/50">
                  {selectedMember.shares_count} partages · Note {selectedMember.rating.toFixed(1)}
                </p>
                {selectedMember.location_name && (
                  <p className="text-[10px] text-amber-400/30 mt-0.5">{selectedMember.location_name}</p>
                )}
              </div>
              <div className="ml-auto">
                <span className="material-symbols-outlined text-amber-400 text-[18px] fill-1">verified</span>
              </div>
            </div>

            {selectedMember.photos.length === 0 && (
              <div className="bg-amber-400/5 border border-amber-400/10 rounded-2xl p-4 text-center">
                <span className="material-symbols-outlined text-amber-400/30 text-[28px]">photo_camera</span>
                <p className="text-amber-300/40 text-xs mt-1">Aucune photo culinaire pour l'instant</p>
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60 mb-1.5 block">
                Quel plat tu proposes ? *
              </label>
              <input
                type="text"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="Ex: Tajine d'agneau aux pruneaux"
                className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-3 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60 mb-1.5 block">
                Date proposée (optionnel)
              </label>
              <input
                type="datetime-local"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-3 text-sm text-amber-100 outline-none focus:border-amber-400/50 [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/60 mb-1.5 block">
                Message personnel (optionnel)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Présente ton repas, ton ambiance, ton intention..."
                rows={3}
                className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-3 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50 resize-none"
              />
            </div>

            <button
              onClick={sendInvitation}
              disabled={sending || !mealName.trim()}
              className="w-full py-4 rounded-2xl bg-amber-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {sending ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  Envoyer l'invitation
                </>
              )}
            </button>
          </div>
        </div>
      ) : view === 'view_invitation' && selectedInvitation ? (
        <div className="relative flex-1 overflow-y-auto">
          <InvitationDetail
            invitation={selectedInvitation}
            currentUserId={currentUserId}
            nextTimeNote={nextTimeNote}
            onNextTimeNoteChange={setNextTimeNote}
            responding={responding}
            onRespond={respondToInvitation}
          />
        </div>
      ) : null}
    </div>
  );
}

interface InvitationDetailProps {
  invitation: CulinaryInvitation;
  currentUserId: string;
  nextTimeNote: string;
  onNextTimeNoteChange: (v: string) => void;
  responding: boolean;
  onRespond: (inv: CulinaryInvitation, status: 'accepted' | 'declined' | 'next_time') => void;
}

function InvitationDetail({
  invitation,
  currentUserId,
  nextTimeNote,
  onNextTimeNoteChange,
  responding,
  onRespond,
}: InvitationDetailProps) {
  const [hostPhotos, setHostPhotos] = useState<CulinaryPhoto[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showNextTimeInput, setShowNextTimeInput] = useState(false);
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
    <div className="pb-10">
      {hostPhotos.length > 0 && (
        <div className="relative h-64 bg-black overflow-hidden">
          <img
            src={hostPhotos[activeIdx]?.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-white font-bold text-lg">{hostPhotos[activeIdx]?.meal_name}</p>
            {hostPhotos[activeIdx]?.caption && (
              <p className="text-white/60 text-sm mt-0.5">{hostPhotos[activeIdx].caption}</p>
            )}
          </div>
          {hostPhotos.length > 1 && (
            <div className="absolute top-3 right-3 flex gap-1">
              {hostPhotos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIdx ? 'bg-white' : 'bg-white/30'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {hostPhotos.length > 1 && (
        <div className="px-4 pt-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {hostPhotos.map((ph, i) => (
            <button
              key={ph.id}
              onClick={() => setActiveIdx(i)}
              className={`relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                i === activeIdx ? 'border-amber-400' : 'border-transparent'
              }`}
            >
              <img src={ph.image_url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pt-5 space-y-4">
        <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 border border-amber-400/10">
          <img
            src={invitation.host?.avatar_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
            alt={invitation.host?.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-amber-400/30 shrink-0"
          />
          <div>
            <p className="text-xs text-amber-400/50 mb-0.5">Invitation de</p>
            <p className="text-sm font-bold text-amber-100">{invitation.host?.name}</p>
            <p className="text-[10px] text-amber-400/40">{formatDate(invitation.created_at)}</p>
          </div>
          <div className="ml-auto">
            <span className="material-symbols-outlined text-amber-400 text-[18px] fill-1">verified</span>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl border border-amber-400/10 p-4 space-y-2">
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
            <p className="text-[10px] uppercase tracking-widest font-bold text-amber-400/50 text-center">
              Ta réponse
            </p>
            <button
              onClick={() => onRespond(invitation, 'accepted')}
              disabled={responding}
              className="w-full py-3.5 rounded-2xl bg-green-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Je suis intéressé(e) !
            </button>

            {!showNextTimeInput ? (
              <button
                onClick={() => setShowNextTimeInput(true)}
                disabled={responding}
                className="w-full py-3.5 rounded-2xl bg-white/5 border border-amber-400/20 text-amber-300/70 font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                Prochaine fois
              </button>
            ) : (
              <div className="bg-white/5 rounded-2xl border border-amber-400/10 p-3 space-y-2">
                <p className="text-xs text-amber-400/60">Laisse un mot pour l'hôte (optionnel)</p>
                <input
                  type="text"
                  value={nextTimeNote}
                  onChange={(e) => onNextTimeNoteChange(e.target.value)}
                  placeholder="Ex: Je serai disponible en mars"
                  className="w-full bg-black/30 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none"
                />
                <button
                  onClick={() => onRespond(invitation, 'next_time')}
                  disabled={responding}
                  className="w-full py-2.5 rounded-xl bg-blue-500/80 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
                >
                  Confirmer "Prochaine fois"
                </button>
              </div>
            )}

            <button
              onClick={() => onRespond(invitation, 'declined')}
              disabled={responding}
              className="w-full py-3 rounded-2xl text-red-400/60 font-medium text-sm active:scale-95 transition-all disabled:opacity-40"
            >
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
            {invitation.next_time_note && (
              <p className="text-amber-300/30 text-xs mt-1 italic">"{invitation.next_time_note}"</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
