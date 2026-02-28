import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ReviewModalProps {
  reviewedId: string;
  reviewedName: string;
  reviewedAvatar: string | null;
  mealId: string;
  participantId: string;
  reviewerId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ReviewModal({
  reviewedId,
  reviewedName,
  reviewedAvatar,
  mealId,
  participantId,
  reviewerId,
  onClose,
  onSubmitted,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (rating === 0) { setError('Choisis une note entre 1 et 5 étoiles.'); return; }
    setSaving(true);
    setError('');

    const { error: err } = await supabase.from('meal_reviews').insert({
      reviewer_id: reviewerId,
      reviewed_id: reviewedId,
      meal_id: mealId,
      participant_id: participantId,
      rating,
      comment: comment.trim(),
    });

    if (err) {
      if (err.code === '23505') {
        setError('Tu as déjà laissé un avis pour ce repas.');
      } else {
        setError('Une erreur est survenue. Réessaie.');
      }
      setSaving(false);
      return;
    }

    const { data: allReviews } = await supabase
      .from('meal_reviews')
      .select('rating')
      .eq('reviewed_id', reviewedId);

    const totalRatings = allReviews ?? [];
    const avgRating = totalRatings.length > 0
      ? parseFloat((totalRatings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / totalRatings.length).toFixed(1))
      : rating;
    await supabase.from('profiles').update({ rating: avgRating }).eq('id', reviewedId);

    setSaving(false);
    onSubmitted();
  }

  const displayRating = hovered || rating;

  const LABELS: Record<number, string> = {
    1: 'Très décevant',
    2: 'Pas terrible',
    3: 'Correct',
    4: 'Bien',
    5: 'Excellent !',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center max-w-md mx-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative bg-white rounded-t-3xl shadow-2xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-8 space-y-5">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />

          <div className="text-center">
            <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3 ring-4 ring-[#49e619]/20">
              {reviewedAvatar ? (
                <img src={reviewedAvatar} alt={reviewedName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-400 text-[28px]">person</span>
                </div>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">Comment était {reviewedName} ?</h2>
            <p className="text-sm text-slate-400 mt-0.5">Ton avis aide la communauté</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                  className="transition-transform active:scale-110"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 40, color: s <= displayRating ? '#f59e0b' : '#e2e8f0', transition: 'color 0.15s' }}
                  >
                    star
                  </span>
                </button>
              ))}
            </div>
            {displayRating > 0 && (
              <p className="text-sm font-bold text-slate-700 transition-all">{LABELS[displayRating]}</p>
            )}
          </div>

          <div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Laisse un commentaire (optionnel)..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#49e619] resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-12 border border-slate-200 text-slate-500 font-semibold rounded-full text-sm"
            >
              Passer
            </button>
            <button
              onClick={submit}
              disabled={saving || rating === 0}
              className="flex-[2] h-12 bg-[#49e619] text-slate-900 font-bold rounded-full text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]"
            >
              {saving ? (
                <span className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">star</span>
                  Publier mon avis
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
