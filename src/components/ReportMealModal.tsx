import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ReportMealModalProps {
  mealId: string;
  mealTitle: string;
  reporterId: string;
  onClose: () => void;
}

const REASONS = [
  { id: 'off_topic', label: 'Hors contexte de l\'application', icon: 'category' },
  { id: 'not_food', label: 'Ne concerne pas la nourriture', icon: 'no_food' },
  { id: 'misleading', label: 'Annonce trompeuse ou fausse', icon: 'report_problem' },
  { id: 'spam', label: 'Spam ou contenu commercial', icon: 'report_off' },
  { id: 'inappropriate', label: 'Contenu inapproprie ou offensant', icon: 'block' },
  { id: 'expired', label: 'Aliment impropre a la consommation', icon: 'dangerous' },
  { id: 'other', label: 'Autre raison', icon: 'more_horiz' },
];

export default function ReportMealModal({
  mealId,
  mealTitle,
  reporterId,
  onClose,
}: ReportMealModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!selectedReason || submitting) return;
    setSubmitting(true);

    await supabase.from('meal_reports').insert({
      reporter_id: reporterId,
      meal_id: mealId,
      reason: selectedReason,
      details: details.trim(),
    });

    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl overflow-hidden">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />

        {submitted ? (
          <div className="flex flex-col items-center text-center px-8 py-12 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px] text-green-500">check_circle</span>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Signalement envoye</p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Merci. Notre equipe va examiner cette annonce et prendre les mesures necessaires.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 w-full bg-slate-900 text-white font-semibold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-transform"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Signaler cette annonce</h2>
                  <p className="text-sm text-slate-400 mt-0.5 truncate max-w-[240px]">
                    {mealTitle}
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
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selectedReason === r.id ? 'bg-orange-100' : 'bg-white'
                    }`}>
                      <span className={`material-symbols-outlined text-[18px] ${
                        selectedReason === r.id ? 'text-orange-500' : 'text-slate-400'
                      }`}>
                        {r.icon}
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${
                      selectedReason === r.id ? 'text-orange-700' : 'text-slate-700'
                    }`}>
                      {r.label}
                    </span>
                    {selectedReason === r.id && (
                      <span className="material-symbols-outlined text-orange-500 text-[18px] ml-auto">
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
                    placeholder="Decris le probleme avec cette annonce..."
                    rows={3}
                    maxLength={500}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-300 text-slate-900 placeholder:text-slate-400 resize-none"
                  />
                  <p className="text-xs text-slate-400 text-right mt-1">{details.length}/500</p>
                </div>
              )}
            </div>

            <div className="px-5 pb-6 pt-3 border-t border-slate-100">
              <button
                onClick={handleSubmit}
                disabled={!selectedReason || submitting}
                className="w-full bg-orange-500 text-white font-semibold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
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
