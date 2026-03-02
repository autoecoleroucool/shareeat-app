import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Screen } from '../types';
import BottomNav from '../components/BottomNav';
import { supabase } from '../lib/supabase';
import ReportUserModal from '../components/ReportUserModal';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullIndicator from '../components/PullIndicator';

interface MessagesScreenProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  unreadBookings?: number;
  unreadMessages?: number;
  onConvOpen?: (convId: string | null) => void;
  openConversationId?: string | null;
}

interface Conversation {
  id: string;
  meal_id: string | null;
  host_id: string;
  guest_id: string;
  last_message_at: string;
  last_message_text: string;
  created_at: string;
  other_profile: { id: string; name: string; avatar_url: string } | null;
  meal_title: string | null;
  unread_count: number;
  unread_by_me: number;
  is_blocked?: boolean;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  conversation_id: string | null;
}

interface MessageGroup {
  senderId: string;
  messages: ChatMessage[];
  isFirst: boolean;
}

function groupMessages(messages: ChatMessage[]): ({ type: 'date'; date: string } | { type: 'group'; group: MessageGroup })[] {
  const result: ({ type: 'date'; date: string } | { type: 'group'; group: MessageGroup })[] = [];
  let lastDate = '';
  let currentGroup: MessageGroup | null = null;

  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    if (msgDate !== lastDate) {
      if (currentGroup) result.push({ type: 'group', group: currentGroup });
      currentGroup = null;
      result.push({ type: 'date', date: msgDate });
      lastDate = msgDate;
    }

    if (!currentGroup || currentGroup.senderId !== msg.sender_id) {
      if (currentGroup) result.push({ type: 'group', group: currentGroup });
      currentGroup = { senderId: msg.sender_id, messages: [msg], isFirst: true };
    } else {
      currentGroup.messages.push(msg);
    }
  }

  if (currentGroup) result.push({ type: 'group', group: currentGroup });
  return result;
}

export default function MessagesScreen({ activeScreen, onNavigate, unreadBookings = 0, onConvOpen, openConversationId }: MessagesScreenProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [hasMoreMsgs, setHasMoreMsgs] = useState(false);
  const [loadingMoreMsgs, setLoadingMoreMsgs] = useState(false);
  const [msgOffset, setMsgOffset] = useState(0);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef<Conversation | null>(null);
  const userIdRef = useRef<string | null>(null);
  const PAGE_SIZE = 30;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        userIdRef.current = user.id;
      }
    });
    return () => {
      mountedRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (localTypingTimeoutRef.current) clearTimeout(localTypingTimeoutRef.current);
    };
  }, []);

  const loadConversations = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    setLoadingConvs(true);

    const { data } = await supabase
      .from('conversations')
      .select(`
        id, meal_id, host_id, guest_id, last_message_at, last_message_text, created_at,
        host:profiles!conversations_host_id_fkey(id, name, avatar_url),
        guest:profiles!conversations_guest_id_fkey(id, name, avatar_url),
        meal:meals(title)
      `)
      .or(`host_id.eq.${uid},guest_id.eq.${uid}`)
      .order('last_message_at', { ascending: false });

    if (!data) { setLoadingConvs(false); return; }

    const [{ data: blockedData }, { data: deletedData }] = await Promise.all([
      supabase.from('blocked_users').select('blocked_id').eq('blocker_id', uid),
      supabase.from('deleted_conversations').select('conversation_id').eq('user_id', uid),
    ]);

    const blockedIds = new Set((blockedData ?? []).map((b: { blocked_id: string }) => b.blocked_id));
    const deletedConvIds = new Set((deletedData ?? []).map((d: { conversation_id: string }) => d.conversation_id));

    const filtered = data.filter((c: { id: string }) => !deletedConvIds.has(c.id));

    const convIds = filtered.map((c: { id: string }) => c.id);
    const { data: unreadData } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('receiver_id', uid)
      .is('read_at', null)
      .in('conversation_id', convIds);

    const unreadByConv: Record<string, number> = {};
    for (const row of (unreadData ?? [])) {
      const cid = row.conversation_id;
      if (cid) unreadByConv[cid] = (unreadByConv[cid] ?? 0) + 1;
    }

    type RawConv = {
      id: string; meal_id: string | null; host_id: string; guest_id: string;
      last_message_at: string; last_message_text: string; created_at: string;
      host: { id: string; name: string; avatar_url: string } | null;
      guest: { id: string; name: string; avatar_url: string } | null;
      meal: { title: string } | null;
    };
    const convs: Conversation[] = (filtered as RawConv[]).map((c) => {
      const isHost = c.host_id === uid;
      const other = isHost ? c.guest : c.host;
      const otherId = isHost ? c.guest_id : c.host_id;
      return {
        id: c.id,
        meal_id: c.meal_id,
        host_id: c.host_id,
        guest_id: c.guest_id,
        last_message_at: c.last_message_at,
        last_message_text: c.last_message_text,
        created_at: c.created_at,
        other_profile: other ? { id: other.id, name: other.name, avatar_url: other.avatar_url } : null,
        meal_title: c.meal?.title ?? null,
        unread_count: 0,
        unread_by_me: unreadByConv[c.id] ?? 0,
        is_blocked: blockedIds.has(otherId),
      };
    });

    const activeId = activeConvRef.current?.id;
    const finalConvs = convs.map((c) =>
      c.id === activeId ? { ...c, unread_by_me: 0 } : c
    );
    setConversations(finalConvs);

    setActiveConv((prev) => {
      if (!prev) return prev;
      const updated = finalConvs.find((c) => c.id === prev.id);
      if (updated) {
        activeConvRef.current = updated;
        return updated;
      }
      return prev;
    });

    setLoadingConvs(false);
  }, []);

  const { containerRef: convScrollRef, indicatorRef: convIndicatorRef } = usePullToRefresh(loadConversations);

  useEffect(() => {
    if (!userId) return;
    loadConversations();

    const convSub = supabase
      .channel(`conversations:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `host_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as { id: string; last_message_text: string | null; last_message_at: string | null };
          const uid = userIdRef.current;
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === updated.id);
            if (!exists) { loadConversations(); return prev; }
            const reordered = prev.map((c) =>
              c.id === updated.id
                ? { ...c, last_message_text: updated.last_message_text, last_message_at: updated.last_message_at,
                    unread_by_me: (activeConvRef.current?.id === c.id || !uid || c.host_id === uid) ? c.unread_by_me : c.unread_by_me + 1 }
                : c
            ).sort((a, b) => new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime());
            return reordered;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `guest_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as { id: string; last_message_text: string | null; last_message_at: string | null };
          const uid = userIdRef.current;
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === updated.id);
            if (!exists) { loadConversations(); return prev; }
            const reordered = prev.map((c) =>
              c.id === updated.id
                ? { ...c, last_message_text: updated.last_message_text, last_message_at: updated.last_message_at,
                    unread_by_me: (activeConvRef.current?.id === c.id || !uid || c.guest_id === uid) ? c.unread_by_me : c.unread_by_me + 1 }
                : c
            ).sort((a, b) => new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime());
            return reordered;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations', filter: `host_id=eq.${userId}` },
        () => loadConversations()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations', filter: `guest_id=eq.${userId}` },
        () => loadConversations()
      )
      .subscribe();

    return () => { supabase.removeChannel(convSub); };
  }, [userId, loadConversations]);

  useEffect(() => {
    if (!openConversationId || loadingConvs) return;
    const conv = conversations.find((c) => c.id === openConversationId);
    if (conv && (!activeConv || activeConv.id !== openConversationId)) {
      setActiveConv(conv);
    }
  }, [openConversationId, conversations, loadingConvs, activeConv]);

  useEffect(() => {
    if (!activeConv) {
      onConvOpen?.(null);
      return;
    }
    const uid = userIdRef.current;
    setConversations((prev) =>
      prev.map((c) => c.id === activeConv.id ? { ...c, unread_by_me: 0 } : c)
    );
    if (uid) {
      supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', activeConv.id)
        .eq('receiver_id', uid)
        .is('read_at', null)
        .then(() => {
          onConvOpen?.(activeConv.id);
        });
    } else {
      onConvOpen?.(activeConv.id);
    }
    activeConvRef.current = activeConv;
    setMsgOffset(0);
    setHasMoreMsgs(false);
    loadMessages(activeConv.id, 0);

    const convId = activeConv.id;
    setOtherTyping(false);

    const channelName = `messages:${convId}:${Date.now()}`;
    const msgSub = supabase
      .channel(channelName)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const senderId = (payload.payload as { user_id?: string })?.user_id;
        if (senderId && senderId !== userIdRef.current) {
          setOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => { if (mountedRef.current) setOtherTyping(false); }, 3000);
        }
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => !m.id.startsWith('temp-'));
            if (withoutTemp.find((m) => m.id === newMsg.id)) return prev;
            const realWithTemp = prev.filter((m) => !m.id.startsWith('temp-') || m.sender_id !== newMsg.sender_id);
            if (realWithTemp.find((m) => m.id === newMsg.id)) return prev;
            return [...prev.filter((m) => m.id !== newMsg.id), newMsg]
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });

          const uid = userIdRef.current;
          if (uid && newMsg.sender_id !== uid && newMsg.conversation_id) {
            supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMsg.id)
              .eq('receiver_id', uid)
              .then(() => {
                onConvOpen?.(newMsg.conversation_id!);
              });
          }

          setConversations((prev) =>
            prev.map((c) =>
              c.id === newMsg.conversation_id
                ? {
                    ...c,
                    last_message_text: newMsg.content,
                    last_message_at: newMsg.created_at,
                    unread_by_me: (newMsg.sender_id !== userIdRef.current && activeConvRef.current?.id === c.id) ? 0 : c.unread_by_me,
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgSub);
    };
  }, [activeConv?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages(convId: string, offset: number) {
    if (offset === 0) {
      setLoadingMsgs(true);
    } else {
      setLoadingMoreMsgs(true);
    }

    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at, conversation_id')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const fetched = ((data as ChatMessage[]) ?? []).reverse();

    if (offset === 0) {
      setMessages(fetched);
      setLoadingMsgs(false);
    } else {
      setMessages((prev) => [...fetched, ...prev]);
      setLoadingMoreMsgs(false);
    }

    setHasMoreMsgs(fetched.length === PAGE_SIZE);
    setMsgOffset(offset + fetched.length);
  }

  async function loadMoreMessages() {
    if (!activeConv || loadingMoreMsgs || !hasMoreMsgs) return;
    await loadMessages(activeConv.id, msgOffset);
  }

  async function sendMessage() {
    if (!input.trim() || !activeConv || !userId || sending) return;
    const text = input.trim().slice(0, 2000);
    setSendError(null);
    setInput('');
    setSending(true);

    const otherId = activeConv.host_id === userId ? activeConv.guest_id : activeConv.host_id;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender_id: userId,
      content: text,
      created_at: new Date().toISOString(),
      conversation_id: activeConv.id,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { data: msg, error: sendErr } = await supabase
      .from('messages')
      .insert({
        sender_id: userId,
        receiver_id: otherId,
        meal_id: activeConv.meal_id,
        content: text,
        conversation_id: activeConv.id,
      })
      .select()
      .maybeSingle();

    if (sendErr) {
      setSendError('Impossible d\'envoyer le message. Réessaie.');
      setInput(text);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSending(false);
      return;
    }

    if (msg) {
      setMessages((prev) => prev.map((m) => m.id === tempId ? (msg as ChatMessage) : m));
    }

    const now = new Date().toISOString();
    await supabase
      .from('conversations')
      .update({ last_message_text: text, last_message_at: now })
      .eq('id', activeConv.id);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? { ...c, last_message_text: text, last_message_at: now }
          : c
      )
    );

    setSending(false);
  }

  async function blockUser(targetId: string) {
    if (!userId) return;
    setBlockingId(targetId);
    const { error } = await supabase.from('blocked_users').upsert({
      blocker_id: userId,
      blocked_id: targetId,
    }, { onConflict: 'blocker_id,blocked_id' });
    setBlockingId(null);
    if (!error) {
      setConversations((prev) =>
        prev.map((c) =>
          c.other_profile?.id === targetId ? { ...c, is_blocked: true } : c
        )
      );
      if (activeConv?.other_profile?.id === targetId) {
        setActiveConv((prev) => prev ? { ...prev, is_blocked: true } : prev);
      }
    }
    setShowBlockConfirm(false);
    setShowActionsMenu(false);
  }

  async function unblockUser(targetId: string) {
    if (!userId) return;
    setBlockingId(targetId);
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', targetId);
    setBlockingId(null);
    if (!error) {
      setConversations((prev) =>
        prev.map((c) =>
          c.other_profile?.id === targetId ? { ...c, is_blocked: false } : c
        )
      );
      if (activeConv?.other_profile?.id === targetId) {
        setActiveConv((prev) => prev ? { ...prev, is_blocked: false } : prev);
      }
    }
    setShowActionsMenu(false);
  }

  async function deleteMessage(msgId: string) {
    if (!userId) return;
    setDeletingMsgId(msgId);
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', msgId)
      .eq('sender_id', userId);
    setDeletingMsgId(null);
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    }
  }

  async function deleteConversation(convId: string) {
    if (!userId) return;
    setDeletingId(convId);
    const { error } = await supabase.from('deleted_conversations').insert({
      user_id: userId,
      conversation_id: convId,
    });
    setDeletingId(null);
    if (!error) {
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConv?.id === convId) setActiveConv(null);
    }
    setShowDeleteConfirm(false);
    setShowActionsMenu(false);
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatLastSeen(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return "A l'instant";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (diff < 86400 * 2) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function getInitials(name: string) {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  const grouped = useMemo(() => groupMessages(messages), [messages]);

  if (activeConv) {
    const isBlocked = activeConv.is_blocked;

    return (
      <div className="flex flex-col h-app bg-[#f2f4f2] font-display">
        <header
          className="sticky top-0 z-20 bg-white px-4 pb-3 flex items-center gap-3 border-b border-slate-100 shadow-sm"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 44px) + 10px)' }}
        >
          <button
            onClick={() => setActiveConv(null)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back_ios_new</span>
          </button>

          <div className="relative">
            {activeConv.other_profile?.avatar_url ? (
              <img src={activeConv.other_profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {getInitials(activeConv.other_profile?.name ?? 'U')}
                </span>
              </div>
            )}
            {!isBlocked && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#49e619] rounded-full border-2 border-white" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-900 text-[15px] leading-tight">
                {activeConv.other_profile?.name ?? 'Utilisateur'}
              </p>
              {isBlocked && (
                <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                  Bloque
                </span>
              )}
            </div>
            {activeConv.meal_title && (
              <p className="text-xs text-slate-400 truncate">
                <span className="material-symbols-outlined text-[11px] mr-0.5">restaurant</span>
                {activeConv.meal_title}
              </p>
            )}
          </div>

          <button
            onClick={() => { setShowActionsMenu(true); setShowBlockConfirm(false); setShowDeleteConfirm(false); }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
            title="Plus d'options"
          >
            <span className="material-symbols-outlined text-[20px]">more_vert</span>
          </button>
        </header>

        {showReport && activeConv.other_profile && userId && (
          <ReportUserModal
            reportedId={activeConv.other_profile.id}
            reportedName={activeConv.other_profile.name}
            conversationId={activeConv.id}
            reporterId={userId}
            onClose={() => setShowReport(false)}
            onBlocked={() => { setShowReport(false); setActiveConv(null); }}
          />
        )}

        {showActionsMenu && activeConv.other_profile && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowActionsMenu(false); setShowBlockConfirm(false); setShowDeleteConfirm(false); } }}
          >
            <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-5 pt-3 pb-2 border-b border-slate-100">
                <p className="text-base font-bold text-slate-900">{activeConv.other_profile.name}</p>
                <p className="text-xs text-slate-400">Que veux-tu faire ?</p>
              </div>

              {!showBlockConfirm && !showDeleteConfirm ? (
                <div className="px-5 py-4 space-y-2">
                  <button
                    onClick={() => { setShowActionsMenu(false); setShowReport(true); }}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-[0.98] transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-orange-500 text-[20px]">flag</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Signaler cet utilisateur</p>
                      <p className="text-xs text-slate-400 mt-0.5">Informer l'equipe d'un comportement inapproprie</p>
                    </div>
                  </button>

                  {isBlocked ? (
                    <button
                      onClick={() => unblockUser(activeConv.other_profile!.id)}
                      disabled={blockingId === activeConv.other_profile.id}
                      className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-green-50 hover:bg-green-100 active:scale-[0.98] transition-all text-left disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        {blockingId === activeConv.other_profile.id ? (
                          <span className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-green-600 text-[20px]">lock_open</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-green-700">Debloquer cet utilisateur</p>
                        <p className="text-xs text-green-500 mt-0.5">Il pourra a nouveau te contacter</p>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowBlockConfirm(true)}
                      className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-50 hover:bg-red-100 active:scale-[0.98] transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-red-500 text-[20px]">block</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-red-700">Bloquer cet utilisateur</p>
                        <p className="text-xs text-red-400 mt-0.5">Il ne pourra plus voir tes annonces</p>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-[0.98] transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-slate-500 text-[20px]">delete</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">Supprimer la conversation</p>
                      <p className="text-xs text-slate-400 mt-0.5">Disparait uniquement de ta liste</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setShowActionsMenu(false); setShowBlockConfirm(false); setShowDeleteConfirm(false); }}
                    className="w-full py-3.5 rounded-2xl text-slate-500 text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              ) : showBlockConfirm ? (
                <div className="px-5 py-6 flex flex-col gap-4">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-red-500 text-[28px]">block</span>
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900">Bloquer {activeConv.other_profile.name} ?</p>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                        Il ne pourra plus voir tes annonces ni te contacter. La conversation reste visible.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowBlockConfirm(false)}
                      className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-bold transition-all active:scale-95"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => blockUser(activeConv.other_profile!.id)}
                      disabled={blockingId === activeConv.other_profile.id}
                      className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {blockingId === activeConv.other_profile.id ? (
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">block</span>
                      )}
                      Bloquer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-6 flex flex-col gap-4">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-500 text-[28px]">delete</span>
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900">Supprimer cette conversation ?</p>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                        Elle disparaitra uniquement de ta liste. L'autre personne pourra toujours la voir.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-bold transition-all active:scale-95"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => deleteConversation(activeConv.id)}
                      disabled={deletingId === activeConv.id}
                      className="flex-1 py-3.5 rounded-2xl bg-slate-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {deletingId === activeConv.id ? (
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      )}
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
              <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }} />
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4 space-y-1">
          {hasMoreMsgs && !loadingMsgs && (
            <div className="flex justify-center pb-2">
              <button
                onClick={loadMoreMessages}
                disabled={loadingMoreMsgs}
                className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-4 py-1.5 flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {loadingMoreMsgs ? (
                  <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[13px]">expand_less</span>
                )}
                Charger plus
              </button>
            </div>
          )}
          {loadingMsgs ? (
            <div className="flex justify-center py-8">
              <span className="w-6 h-6 border-2 border-slate-200 border-t-[#49e619] rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[32px] text-slate-300">chat_bubble_outline</span>
              </div>
              <p className="text-sm font-medium text-slate-400">Commencez la conversation</p>
            </div>
          ) : (
            grouped.map((item, idx) => {
              if (item.type === 'date') {
                return (
                  <div key={`date-${idx}`} className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 capitalize">
                      {item.date}
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                );
              }

              const { group } = item;
              const mine = group.senderId === userId;

              return (
                <div key={`group-${idx}`} className={`flex flex-col gap-0.5 ${mine ? 'items-end' : 'items-start'} mb-2`}>
                  {group.messages.map((msg, mIdx) => {
                    const isLast = mIdx === group.messages.length - 1;
                    const isTemp = msg.id.startsWith('temp-');
                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div
                          className={`
                            max-w-[72vw] px-4 py-2.5 text-sm leading-relaxed transition-opacity
                            ${isTemp ? 'opacity-60' : 'opacity-100'}
                            ${deletingMsgId === msg.id ? 'opacity-30 scale-95' : ''}
                            ${mine
                              ? `bg-[#49e619] text-slate-900 ${
                                  mIdx === 0 && group.messages.length > 1
                                    ? 'rounded-t-2xl rounded-bl-2xl rounded-br-sm'
                                    : mIdx === group.messages.length - 1 && group.messages.length > 1
                                    ? 'rounded-b-2xl rounded-tl-2xl rounded-tr-sm'
                                    : group.messages.length === 1
                                    ? 'rounded-2xl rounded-br-sm'
                                    : 'rounded-l-2xl rounded-r-sm'
                                }`
                              : `bg-white text-slate-800 shadow-sm ${
                                  mIdx === 0 && group.messages.length > 1
                                    ? 'rounded-t-2xl rounded-br-2xl rounded-bl-sm'
                                    : mIdx === group.messages.length - 1 && group.messages.length > 1
                                    ? 'rounded-b-2xl rounded-tr-2xl rounded-tl-sm'
                                    : group.messages.length === 1
                                    ? 'rounded-2xl rounded-bl-sm'
                                    : 'rounded-r-2xl rounded-l-sm'
                                }`
                            }
                          `}
                          onContextMenu={(e) => {
                            if (mine && !isTemp) {
                              e.preventDefault();
                              if (window.confirm('Supprimer ce message ?')) deleteMessage(msg.id);
                            }
                          }}
                        >
                          <p className="break-words whitespace-pre-wrap">{msg.content.slice(0, 2000)}</p>
                          {isLast && (
                            <p className={`text-[10px] mt-1 ${mine ? 'text-slate-700/50' : 'text-slate-400'} text-right flex items-center justify-end gap-1`}>
                              {formatTime(msg.created_at)}
                              {mine && (
                                <span className="material-symbols-outlined text-[10px]">
                                  {isTemp ? 'schedule' : 'done'}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
          {otherTyping && (
            <div className="flex items-end gap-2 mb-2">
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </main>

        <div
          className="bg-white border-t border-slate-100 px-4 py-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          {isBlocked ? (
            <div className="flex items-center justify-center gap-2 py-3 text-slate-400">
              <span className="material-symbols-outlined text-[16px]">block</span>
              <p className="text-sm font-medium">Tu as bloque cet utilisateur</p>
            </div>
          ) : (
            <>
              {sendError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
                  <span className="material-symbols-outlined text-red-500 text-[14px]">error</span>
                  <p className="text-xs text-red-600 flex-1">{sendError}</p>
                  <button onClick={() => setSendError(null)} className="text-red-400">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <input
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (activeConv && userIdRef.current && e.target.value.trim()) {
                      supabase.channel(`messages:${activeConv.id}`).send({
                        type: 'broadcast',
                        event: 'typing',
                        payload: { user_id: userIdRef.current },
                      });
                      if (localTypingTimeoutRef.current) clearTimeout(localTypingTimeoutRef.current);
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Ecrire un message..."
                  className="flex-1 bg-[#f2f4f2] border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#49e619] text-slate-900 placeholder:text-slate-400 resize-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="w-11 h-11 bg-[#49e619] rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform disabled:opacity-40 shrink-0"
                >
                  <span className="material-symbols-outlined text-slate-900 text-[18px]">send</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-app bg-[#f2f4f2] font-display">
      <header
        className="bg-white px-6 pb-5 border-b border-slate-100 shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 44px) + 12px)' }}
      >
        <h1 className="text-3xl font-bold text-slate-900">Messages</h1>
        <p className="text-sm text-slate-400 mt-0.5">Tes conversations autour des repas</p>
      </header>

      <main ref={(el) => { convScrollRef.current = el; }} className="flex-1 overflow-y-auto hide-scrollbar pb-24 relative">
        <PullIndicator ref={convIndicatorRef} />
        {loadingConvs ? (
          <div className="flex justify-center py-16">
            <span className="w-7 h-7 border-2 border-slate-200 border-t-[#49e619] rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-300 text-[40px]">forum</span>
            </div>
            <div>
              <p className="text-base font-bold text-slate-700">Aucune conversation</p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Reserve un repas ou partage le tien pour commencer a echanger !
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.map((conv) => (
              <div key={conv.id} className="relative flex items-stretch bg-white">
                <button
                  onClick={() => setActiveConv(conv)}
                  className="flex-1 flex items-center gap-4 px-5 py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left min-w-0"
                >
                  <div className="relative flex-shrink-0">
                    {conv.other_profile?.avatar_url ? (
                      <img
                        src={conv.other_profile.avatar_url}
                        alt=""
                        className={`w-14 h-14 rounded-full object-cover ${conv.is_blocked ? 'opacity-50 grayscale' : ''}`}
                      />
                    ) : (
                      <div className={`w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center ${conv.is_blocked ? 'opacity-50 grayscale' : ''}`}>
                        <span className="text-white font-bold text-lg">
                          {getInitials(conv.other_profile?.name ?? 'U')}
                        </span>
                      </div>
                    )}
                    {conv.unread_by_me > 0 && !conv.is_blocked && (
                      <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#49e619] rounded-full border-2 border-white flex items-center justify-center px-1">
                        <span className="text-slate-900 font-extrabold" style={{ fontSize: 9, lineHeight: 1 }}>
                          {conv.unread_by_me > 9 ? '9+' : conv.unread_by_me}
                        </span>
                      </div>
                    )}
                    {conv.is_blocked && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-[10px]">block</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className={`text-[15px] ${conv.is_blocked ? 'text-slate-400 font-semibold' : conv.unread_by_me > 0 ? 'font-extrabold text-slate-900' : 'font-bold text-slate-900'}`}>
                        {conv.other_profile?.name ?? 'Utilisateur'}
                      </p>
                      <span className={`text-[11px] shrink-0 ml-2 ${conv.unread_by_me > 0 && !conv.is_blocked ? 'text-[#3acc0f] font-bold' : 'text-slate-400'}`}>
                        {formatLastSeen(conv.last_message_at)}
                      </span>
                    </div>
                    {conv.meal_title && (
                      <p className="text-[11px] text-[#3acc0f] font-semibold mb-0.5 truncate flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">restaurant</span>
                        {conv.meal_title}
                      </p>
                    )}
                    {conv.is_blocked ? (
                      <p className="text-xs text-red-400 font-medium">Utilisateur bloque</p>
                    ) : (
                      <p className={`text-sm truncate ${conv.unread_by_me > 0 ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                        {conv.last_message_text || 'Nouvelle conversation'}
                      </p>
                    )}
                  </div>

                  <span className="material-symbols-outlined text-slate-300 text-[18px] shrink-0">
                    chevron_right
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-slate-100">
        <BottomNav active={activeScreen} onChange={onNavigate} unreadBookings={unreadBookings} />
      </div>
    </div>
  );
}
