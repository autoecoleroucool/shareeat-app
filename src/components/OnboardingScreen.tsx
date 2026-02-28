import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface OnboardingScreenProps {
  onDone: () => void;
}

const STEPS = [
  {
    icon: '♻️',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    title: 'Sauve des aliments',
    subtitle: 'Anti-gaspi',
    desc: 'Des voisins proposent des aliments avant qu\'ils expirent. Récupère-les gratuitement, sans engagement.',
  },
  {
    icon: '🍽️',
    color: '#f97316',
    bg: '#fff7ed',
    border: '#fed7aa',
    title: 'Partage tes repas',
    subtitle: 'Repas maison',
    desc: 'Tu cuisines pour trop de monde ? Partage avec tes voisins. Une place prise = un repas à partager.',
  },
  {
    icon: '⚖️',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    title: 'Le karma, c\'est la vie',
    subtitle: 'Équilibre communautaire',
    desc: 'Chaque repas pris diminue ton karma. Chaque repas partagé le remonte. L\'équilibre bénéficie à tous.',
  },
  {
    icon: '💬',
    color: '#0f766e',
    bg: '#f0fdfa',
    border: '#99f6e4',
    title: 'Échange avec ton hôte',
    subtitle: 'Messagerie intégrée',
    desc: 'Après avoir réservé, un message automatique est envoyé à l\'hôte. Tu peux chatter directement dans l\'app.',
  },
];

export default function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  async function finish() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ onboarding_done: true }).eq('id', user.id);
    }
    setSaving(false);
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-between"
      style={{ background: current.bg, transition: 'background 0.4s ease' }}
    >
      <div className="w-full flex justify-end px-6 pt-14">
        <button
          onClick={finish}
          className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors"
        >
          Passer
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8 w-full max-w-sm">
        <div
          className="w-32 h-32 rounded-3xl flex items-center justify-center text-6xl shadow-lg"
          style={{ border: `2px solid ${current.border}`, background: 'white' }}
        >
          {current.icon}
        </div>

        <div className="text-center space-y-3">
          <span
            className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{ color: current.color, background: `${current.color}18`, border: `1px solid ${current.border}` }}
          >
            {current.subtitle}
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">{current.title}</h1>
          <p className="text-base text-slate-500 leading-relaxed">{current.desc}</p>
        </div>
      </div>

      <div className="w-full px-8 pb-12 space-y-6">
        <div className="flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                background: i === step ? current.color : `${current.color}44`,
              }}
            />
          ))}
        </div>

        <button
          onClick={isLast ? finish : () => setStep((s) => s + 1)}
          disabled={saving}
          className="w-full h-14 rounded-full font-bold text-white text-base transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: current.color, boxShadow: `0 6px 24px ${current.color}55` }}
        >
          {saving ? (
            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : isLast ? (
            <>
              <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
              Commencer
            </>
          ) : (
            <>
              Suivant
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
