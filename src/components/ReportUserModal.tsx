import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ReportUserModalProps {
  reportedId: string;
  reportedName: string;
  conversationId: string | null;
  reporterId: string;
  onClose: () => void;
  onBlocked?: () => void;
}

const REASONS = [
  { id: 'harassment', label: 'Harcelement ou intimidation', icon: 'warning' },
  { id: 'inappropriate', label: 'Contenu inapproprie', icon: 'block' },
  { id: 'spam', label: 'Spam ou arnaque', icon: 'report_off' },
  { id: 'dangerous', label: 'Comportement dangereux', icon: 'dangerous' },
  { id: 'impersonation', label: 'Usurpation d\'identite', icon: 'person_off' },
  { id: 'other', label: 'Autre raison', icon: 'more_horiz' },
];

export default function ReportUserModal({
  reportedId,
  reportedName,
  conversationId,
  reporterId,
  onClose,
  onBlocked,
}: ReportUserModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function handleSubmit() {
    if (!selectedReason || submitting) return;
    setSubmitting(true);

    await supabase.from('user_reports').insert({
      reporter_id: reporterId,
      reported_id: reportedId,
      conversation_id: conversationId,
      reason: selectedReason,
      details: details.trim(),
    });

    setSubmitting(false);
    setSubmitted(true);
  }

  async function handleBlock() {
    setBlocking(true);
    await supabase.from('blocked_users').upsert({
      blocker_id: reporterId,
      blocked_id: reportedId,
    }, { onConflict: 'blocker_id,blocked_id' });
    setBlocking(false);
    setBlocked(true);
    onBlocked?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />

        {submitted ? (
          <div className="flex flex-col items-center text-center px-8 py-10 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px] text-[#49e619]">check_circle</span>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Signalement envoye</p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Merci pour ton signalement. Notre equipe va examiner cette situation rapidement.
              </p>
            </div>

            {!blocked ? (
              <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 text-left">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-red-500 text-[18px]">block</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-700">Bloquer {reportedName} ?</p>
                    <p className="text-xs text-red-500 mt-0.5">Il ne pourra plus voir tes annonces ni te contacter.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold transition-all active:scale-95"
                  >
                    Non merci
                  </button>
                  <button
                    onClick={handleBlock}
                    disabled={blocking}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {blocking ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-[14px]">block</span>
                    )}
                    Bloquer
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full flex items-center gap-3 bg-slate-50 rounded-2xl p-4">
                <span className="material-symbols-outlined text-slate-400 text-[20px]">check_circle</span>
                <p className="text-sm text-slate-500">{reportedName} est maintenant bloque.</p>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full bg-slate-900 text-white font-semibold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-transform"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Signaler un utilisateur</h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Signaler <span className="font-semibold text-slate-600">{reportedName}</span>
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            <div className="px-5 py-4 overflow-y-auto max-h-[60vh]">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Raison du signalement
              </p>

              <div className="space-y-2">
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReason(r.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
                      selectedReason === r.id
                        ? 'border-red-400 bg-red-50'
                        : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selectedReason === r.id ? 'bg-red-100' : 'bg-white'
                    }`}>
                      <span className={`material-symbols-outlined text-[18px] ${
                        selectedReason === r.id ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        {r.icon}
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${
                      selectedReason === r.id ? 'text-red-700' : 'text-slate-700'
                    }`}>
                      {r.label}
                    </span>
                    {selectedReason === r.id && (
                      <span className="material-symbols-outlined text-red-500 text-[18px] ml-auto">
                        check_circle
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {selectedReason && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Details supplementaires (optionnel)
                  </p>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Decris ce qui s'est passe..."
                    rows={3}
                    maxLength={500}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-300 text-slate-900 placeholder:text-slate-400 resize-none"
                  />
                  <p className="text-xs text-slate-400 text-right mt-1">{details.length}/500</p>
                </div>
              )}
            </div>

            <div className="px-5 pb-6 pt-3 border-t border-slate-100">
              <button
                onClick={handleSubmit}
                disabled={!selectedReason || submitting}
                className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]">flag</span>
                )}
                {submitting ? 'Envoi...' : 'Envoyer le signalement'}
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2 leading-relaxed">
                Les faux signalements peuvent entrainer des sanctions sur ton compte.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
