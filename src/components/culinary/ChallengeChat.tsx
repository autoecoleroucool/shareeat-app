import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface ChallengeMessage {
  id: string;
  challenge_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { id: string; name: string; avatar_url: string };
}

interface MessageGroup {
  senderId: string;
  senderName: string;
  senderAvatar: string;
  messages: ChallengeMessage[];
}

type GroupedItem =
  | { type: 'date'; date: string }
  | { type: 'group'; group: MessageGroup };

function groupMessages(messages: ChallengeMessage[]): GroupedItem[] {
  const result: GroupedItem[] = [];
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
      currentGroup = {
        senderId: msg.sender_id,
        senderName: msg.sender?.name ?? '?',
        senderAvatar: msg.sender?.avatar_url ?? '',
        messages: [msg],
      };
    } else {
      currentGroup.messages.push(msg);
    }
  }

  if (currentGroup) result.push({ type: 'group', group: currentGroup });
  return result;
}

interface Props {
  challengeId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  isAccepted: boolean;
}

export default function ChallengeChat({ challengeId, currentUserId, currentUserName, currentUserAvatar, isAccepted }: Props) {
  const [messages, setMessages] = useState<ChallengeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const addMessage = useCallback((msg: ChallengeMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      const withoutTemp = prev.filter((m) => !(m.id.startsWith('temp-') && m.sender_id === msg.sender_id && m.content === msg.content));
      return [...withoutTemp, msg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    setTimeout(() => scrollToBottom(true), 30);
  }, [scrollToBottom]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('challenge_messages')
      .select('*, sender:profiles!sender_id(id, name, avatar_url)')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as ChallengeMessage[]);
    setLoading(false);
  }, [challengeId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!loading) scrollToBottom(false);
  }, [loading, scrollToBottom]);

  useEffect(() => {
    const channelName = `challenge_chat:${challengeId}`;
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const msg = payload.payload as ChallengeMessage;
        if (msg.sender_id !== currentUserId) {
          addMessage(msg);
        }
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'challenge_messages', filter: `challenge_id=eq.${challengeId}` },
        (payload) => {
          const newMsg = payload.new as ChallengeMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
          setTimeout(() => scrollToBottom(true), 30);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [challengeId, currentUserId, addMessage, scrollToBottom]);

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !isAccepted) return;
    setSending(true);
    setText('');

    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChallengeMessage = {
      id: tempId,
      challenge_id: challengeId,
      sender_id: currentUserId,
      content: trimmed,
      created_at: new Date().toISOString(),
      sender: { id: currentUserId, name: currentUserName, avatar_url: currentUserAvatar },
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(true), 30);

    const { data, error } = await supabase
      .from('challenge_messages')
      .insert({ challenge_id: challengeId, sender_id: currentUserId, content: trimmed })
      .select('*, sender:profiles!sender_id(id, name, avatar_url)')
      .maybeSingle();

    if (!error && data) {
      const realMsg = data as ChallengeMessage;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      channelRef.current?.send({
        type: 'broadcast',
        event: 'new_message',
        payload: realMsg,
      });
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(trimmed);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const grouped = groupMessages(messages);

  if (!isAccepted) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center py-16">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-amber-400 text-[28px]">lock</span>
        </div>
        <p className="text-sm font-bold text-amber-100">Réservé aux membres confirmés</p>
        <p className="text-xs text-amber-400/50 leading-relaxed">
          Le chat du défi est disponible uniquement pour les participants acceptés.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-400 text-[28px]">chat_bubble</span>
            </div>
            <p className="text-sm font-bold text-amber-100">Démarrez la conversation</p>
            <p className="text-xs text-amber-400/50 leading-relaxed">
              Partagez des idées, coordonnez les repas et planifiez vos rendez-vous ici.
            </p>
          </div>
        ) : (
          grouped.map((item, i) => {
            if (item.type === 'date') {
              return (
                <div key={`date-${i}`} className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-amber-400/10" />
                  <span className="text-[9px] uppercase tracking-widest font-bold text-amber-400/30">{item.date}</span>
                  <div className="flex-1 h-px bg-amber-400/10" />
                </div>
              );
            }
            const { group } = item;
            const isMe = group.senderId === currentUserId;
            return (
              <div key={`group-${i}`} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end`}>
                {!isMe && (
                  <img
                    src={group.senderAvatar || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                    alt={group.senderName}
                    className="w-7 h-7 rounded-full object-cover border border-amber-400/20 shrink-0 mb-0.5"
                  />
                )}
                <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-[10px] font-bold text-amber-400/60 px-1 mb-0.5">{group.senderName}</span>
                  )}
                  {group.messages.map((msg, mi) => {
                    const isLast = mi === group.messages.length - 1;
                    const time = new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`px-3 py-2 text-sm leading-snug break-words whitespace-pre-wrap rounded-2xl ${
                            isMe
                              ? 'bg-amber-500 text-white rounded-br-sm'
                              : 'bg-white/8 text-amber-100 border border-amber-400/10 rounded-bl-sm'
                          } ${msg.id.startsWith('temp-') ? 'opacity-60' : ''}`}
                        >
                          {msg.content}
                        </div>
                        {isLast && (
                          <span className="text-[9px] text-amber-400/30 px-1">{time}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-amber-400/10 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          className="flex-1 bg-white/5 border border-amber-400/20 rounded-2xl px-3.5 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50 resize-none leading-snug max-h-28 overflow-y-auto transition-colors"
          style={{ minHeight: '42px' }}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0 disabled:opacity-30 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
        >
          <span className="material-symbols-outlined text-white text-[18px]">send</span>
        </button>
      </div>
    </div>
  );
}
