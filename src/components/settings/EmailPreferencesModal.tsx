import { useState } from 'react';
import ModalBase from './ModalBase';

interface EmailPreferencesModalProps {
  onClose: () => void;
}

const PREFS = [
  { key: 'newMeals', label: 'New meal near you', desc: 'Get notified when someone hosts a meal nearby' },
  { key: 'mealUpdates', label: 'Meal updates', desc: 'Changes to meals you have joined' },
  { key: 'messages', label: 'New messages', desc: 'Email digest of unread messages' },
  { key: 'reviews', label: 'New reviews', desc: 'When someone leaves you a review' },
  { key: 'promotions', label: 'Tips & promotions', desc: 'Feature highlights and community news' },
];

export default function EmailPreferencesModal({ onClose }: EmailPreferencesModalProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    newMeals: true,
    mealUpdates: true,
    messages: true,
    reviews: true,
    promotions: false,
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: string) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 900);
  };

  return (
    <ModalBase title="Email Preferences" onClose={onClose}>
      <div className="px-6 py-5 space-y-2">
        {PREFS.map((pref) => (
          <button
            key={pref.key}
            onClick={() => toggle(pref.key)}
            className="w-full flex items-center gap-4 py-4 border-b border-slate-50 last:border-0 text-left"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">{pref.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{pref.desc}</p>
            </div>
            <div
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                prefs[pref.key] ? 'bg-[#49e619]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  prefs[pref.key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
        ))}

        <div className="pt-2">
          <button
            onClick={handleSave}
            className={`w-full py-3.5 rounded-full font-bold text-sm transition-all ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-[#49e619] text-white hover:bg-[#3ecc14] active:scale-95'
            }`}
          >
            {saved ? 'Saved!' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}
