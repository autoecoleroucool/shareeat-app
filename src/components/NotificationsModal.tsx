import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface NotificationItem {
  id: string;
  type: 'booking' | 'message';
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  meal_title?: string;
  guest_name?: string;
  meal_image?: string | null;
  avatar?: string | null;
}

interface BookingNotif {
  id: string;
  joined_at: string;
  seen_by_host: boolean;
  meals: { title: string; image_url: string | null } | null;
  profiles: { name: string; avatar_url: string | null } | null;
}

interface NotificationsModalProps {
  userId: string;
  onClose: () => void;
  onGoToMessages: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffH < 1) return "il y a moins d'1h";
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD === 1) return 'hier';
  if (diffD < 7) return `il y a ${diffD} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NotificationsModal({ userId, onClose, onGoToMessages }: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);

    const { data: hostMeals } = await supabase
      .from('meals')
      .select('id')
      .eq('host_id', userId);

    const mealIds = (hostMeals ?? []).map((m: { id: string }) => m.id);

    const notifs: NotificationItem[] = [];

    if (mealIds.length > 0) {
      const { data: bookings } = await supabase
        .from('meal_participants')
        .select('id, joined_at, seen_by_host, meals(title, image_url), profiles(name, avatar_url)')
        .in('meal_id', mealIds)
        .eq('no_show', false)
        .order('joined_at', { ascending: false })
        .limit(30);

      if (bookings) {
        for (const b of bookings as BookingNotif[]) {
          notifs.push({
            id: b.id,
            type: 'booking',
            title: b.profiles?.name ? `${b.profiles.name} a réservé` : 'Nouvelle réservation',
            body: b.meals?.title || 'un de tes repas',
            created_at: b.joined_at,
            read: b.seen_by_host,
            meal_title: b.meals?.title,
            guest_name: b.profiles?.name,
            meal_image: b.meals?.image_url,
            avatar: b.profiles?.avatar_url,
          });
        }
      }
    }

    notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setNotifications(notifs);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-md mx-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '88dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 shrink-0 border-b border-slate-100">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-500 text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {loading ? (
            <div className="space-y-3 p-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-slate-400 text-[30px]">notifications_off</span>
              </div>
              <p className="font-bold text-slate-700">Aucune notification</p>
              <p className="text-sm text-slate-400 mt-1">Les réservations de tes repas apparaîtront ici</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-6 py-4 transition-colors ${!notif.read ? 'bg-green-50/60' : ''}`}
                >
                  <div className="relative shrink-0">
                    {notif.avatar ? (
                      <img src={notif.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-400 text-[22px]">person</span>
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#49e619] border-2 border-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-[10px]">restaurant</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900">
                          <span className="text-[#16a34a]">{notif.guest_name}</span> a réservé
                        </p>
                        <p className="text-xs text-slate-600 font-medium mt-0.5 truncate">
                          {notif.body}
                        </p>
                      </div>
                      {notif.meal_image && (
                        <img
                          src={notif.meal_image}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{formatDate(notif.created_at)}</p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 bg-[#49e619] rounded-full shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-8 pt-3 shrink-0 border-t border-slate-100">
          <button
            onClick={() => { onClose(); onGoToMessages(); }}
            className="w-full h-12 bg-slate-900 text-white font-bold rounded-full transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
            Voir les messages
          </button>
        </div>
      </div>
    </div>
  );
}
