import { useState, useEffect } from 'react';
import ModalBase from './ModalBase';
import { supabase } from '../../lib/supabase';

interface BlockedUsersModalProps {
  onClose: () => void;
}

interface BlockedUser {
  id: string;
  blocked_id: string;
  profiles: {
    name: string;
    avatar_url: string | null;
  };
}

export default function BlockedUsersModal({ onClose }: BlockedUsersModalProps) {
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockId, setUnblockId] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('blocked_users')
        .select('id, blocked_id, profiles:blocked_id(name, avatar_url)')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setBlocked(data as BlockedUser[]);
      setLoading(false);
    }
    load();
  }, []);

  async function confirmUnblock(record: BlockedUser) {
    setUnblocking(record.id);
    await supabase.from('blocked_users').delete().eq('id', record.id);
    setBlocked((b) => b.filter((u) => u.id !== record.id));
    setUnblockId(null);
    setUnblocking(null);
  }

  return (
    <ModalBase title="Utilisateurs bloqués" onClose={onClose}>
      <div className="px-6 py-5">
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-slate-100 shrink-0" />
                <div className="flex-1 h-4 bg-slate-100 rounded" />
                <div className="w-20 h-8 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : blocked.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
            <span className="material-symbols-outlined text-[40px]">check_circle</span>
            <p className="text-sm font-medium">Aucun utilisateur bloqué</p>
          </div>
        ) : (
          <div className="space-y-2">
            {blocked.map((record) => (
              <div key={record.id} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
                {record.profiles.avatar_url ? (
                  <img src={record.profiles.avatar_url} alt={record.profiles.name} className="w-11 h-11 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-slate-400 text-[22px]">person</span>
                  </div>
                )}
                <span className="flex-1 text-sm font-semibold text-slate-800">{record.profiles.name}</span>
                {unblockId === record.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUnblockId(null)}
                      className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => confirmUnblock(record)}
                      disabled={unblocking === record.id}
                      className="px-3 py-1.5 rounded-full bg-[#49e619] text-white text-xs font-semibold disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setUnblockId(record.id)}
                    className="px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50"
                  >
                    Débloquer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalBase>
  );
}
