import { memo } from 'react';
import { Screen } from '../types';

interface BottomNavProps {
  active: Screen;
  onChange: (screen: Screen) => void;
  unreadBookings?: number;
}

const tabs = [
  { id: 'map' as Screen, icon: 'map', label: 'Map' },
  { id: 'explore' as Screen, icon: 'explore', label: 'Explorer' },
  { id: 'culinary' as Screen, icon: 'emoji_food_beverage', label: 'Cercle' },
  { id: 'messages' as Screen, icon: 'chat_bubble', label: 'Inbox' },
  { id: 'profile' as Screen, icon: 'person', label: 'Profil' },
];

const BottomNav = memo(function BottomNav({ active, onChange, unreadBookings = 0 }: BottomNavProps) {
  return (
    <nav className="bg-white border-t border-slate-100 px-2 pt-3 flex justify-between items-center pb-safe" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const showBadge = tab.id === 'messages' && unreadBookings > 0;
        const isCulinary = tab.id === 'culinary';
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex flex-col items-center gap-0.5 flex-1 transition-colors ${
              isActive
                ? isCulinary ? 'text-amber-500' : 'text-[#49e619]'
                : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <span className={`material-symbols-outlined text-[22px] ${isActive ? 'fill-1' : ''}`}>
                {tab.icon}
              </span>
              {showBadge ? (
                <div
                  className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center px-1"
                  style={{ animation: 'badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
                >
                  <span className="text-white font-extrabold" style={{ fontSize: 9, lineHeight: 1 }}>
                    {unreadBookings > 9 ? '9+' : unreadBookings}
                  </span>
                </div>
              ) : null}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider">{tab.label}</span>
          </button>
        );
      })}
      <style>{`
        @keyframes badgePop {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </nav>
  );
});

export default BottomNav;
