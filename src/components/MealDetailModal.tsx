import { useState, useEffect, memo } from 'react';
import { Meal } from '../types';
import { supabase } from '../lib/supabase';
import { formatExpiry } from '../lib/mealUtils';

const REVIEWS_PAGE_SIZE = 3;

interface MealDetailModalProps {
  meal: Meal;
  currentUserId: string | null;
  onClose: () => void;
  onBook: (meal: Meal) => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  onEditMeal?: (meal: Meal) => void;
  onDeleteMeal?: (mealId: string) => void;
  isBooked?: boolean;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: { name: string; avatar_url: string | null };
}

function formatMealDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d >= today && d < tomorrow) {
    return `Aujourd'hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (d >= tomorrow && d < new Date(tomorrow.getTime() + 86400000)) {
    return `Demain à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ` à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className="material-symbols-outlined"
          style={{ fontSize: size, color: s <= rating ? '#f59e0b' : '#e2e8f0' }}
        >
          star
        </span>
      ))}
    </div>
  );
}

const MealDetailModal = memo(function MealDetailModal({
  meal,
  currentUserId,
  onClose,
  onBook,
  isFavorited = false,
  onToggleFavorite,
  onEditMeal,
  onDeleteMeal,
  isBooked = false,
}: MealDetailModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [totalReviewCount, setTotalReviewCount] = useState(0);
  const [favorited, setFavorited] = useState(isFavorited);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shared, setShared] = useState(false);

  const isFoodRescue = (meal as unknown as { category?: string }).category === 'food_rescue';
  const mealExtra = meal as unknown as { category?: string; expires_at?: string | null; quantity?: string | null };
  const isOwner = currentUserId === meal.host_id;
  const spotsLeft = meal.slots_total - meal.slots_taken;
  const categoryColor = isFoodRescue ? '#16a34a' : '#f97316';
  const categoryLabel = isFoodRescue ? 'Anti-gaspi' : 'Repas maison';

  useEffect(() => {
    if (!meal.host_id) { setLoadingReviews(false); return; }
    supabase
      .from('meal_reviews')
      .select('id, rating, comment, created_at, reviewer:profiles!meal_reviews_reviewer_id_fkey(name, avatar_url)', { count: 'exact' })
      .eq('reviewed_id', meal.host_id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, count }) => {
        setReviews((data as Review[]) ?? []);
        setTotalReviewCount(count ?? 0);
        setLoadingReviews(false);
      });
  }, [meal.host_id]);

  function handleShare() {
    const text = `${meal.title} — ${meal.location_name} sur ShareEat`;
    if (navigator.share) {
      navigator.share({ title: meal.title, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      });
    }
  }

  function openDirections() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${meal.location_lat},${meal.location_lng}`;
    window.open(url, '_blank');
  }

  function handleToggleFav() {
    setFavorited((prev) => !prev);
    onToggleFavorite?.();
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-md mx-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative bg-white rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-56 w-full shrink-0">
          {isFoodRescue ? (
            <div className="w-full h-full bg-green-50 flex items-center justify-center">
              <span className="text-8xl">♻️</span>
            </div>
          ) : (
            <img
              src={meal.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
              alt={meal.title}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-white text-[20px]">close</span>
          </button>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={handleShare}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center transition-transform active:scale-90"
              title="Partager"
            >
              <span className={`material-symbols-outlined text-[20px] ${shared ? 'text-[#49e619]' : 'text-white'}`}>
                {shared ? 'check' : 'share'}
              </span>
            </button>
            {onToggleFavorite && (
              <button
                onClick={handleToggleFav}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center transition-transform active:scale-90"
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${favorited ? 'fill-1 text-red-400' : 'text-white'}`}
                >
                  favorite
                </span>
              </button>
            )}
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white"
              style={{ background: categoryColor }}
            >
              {categoryLabel}
            </span>
            <h2 className="text-xl font-bold text-white mt-1 leading-tight">{meal.title}</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          <div className="px-5 py-4 space-y-4">
            {meal.host && (
              <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3">
                {meal.host.avatar_url ? (
                  <img src={meal.host.avatar_url} alt={meal.host.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">person</span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-sm">{meal.host.name}</p>
                  {avgRating !== null && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StarRating rating={Math.round(avgRating)} size={13} />
                      <span className="text-xs text-slate-500">{avgRating.toFixed(1)} ({reviews.length} avis)</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                  Hôte
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {isFoodRescue && mealExtra.expires_at && (
                <div className="bg-red-50 rounded-2xl p-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-[18px]">schedule</span>
                  <div>
                    <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Expire dans</p>
                    <p className="text-sm font-bold text-red-700">{formatExpiry(mealExtra.expires_at)}</p>
                  </div>
                </div>
              )}

              {!isFoodRescue && meal.meal_date && (
                <div className="bg-blue-50 rounded-2xl p-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-[18px]">calendar_today</span>
                  <div>
                    <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Quand</p>
                    <p className="text-xs font-bold text-blue-700 leading-tight">{formatMealDate(meal.meal_date)}</p>
                  </div>
                </div>
              )}

              {!isFoodRescue && (
                <div className="bg-green-50 rounded-2xl p-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-500 text-[18px]">group</span>
                  <div>
                    <p className="text-[10px] text-green-400 font-semibold uppercase tracking-wider">Places</p>
                    <p className="text-sm font-bold text-green-700">{spotsLeft} libre{spotsLeft !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              )}

              <button
                onClick={openDirections}
                className="bg-slate-50 rounded-2xl p-3 flex items-center gap-2 text-left active:bg-slate-100 transition-colors w-full"
              >
                <span className="material-symbols-outlined text-slate-400 text-[18px]">location_on</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Lieu</p>
                  <p className="text-xs font-bold text-slate-700 leading-tight truncate" style={{ maxWidth: 80 }}>
                    {meal.location_name || 'Quartier'}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[#16a34a] text-[14px] shrink-0">directions</span>
              </button>

              {isFoodRescue && mealExtra.quantity && (
                <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">inventory_2</span>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Quantité</p>
                    <p className="text-xs font-bold text-slate-700 leading-tight">{mealExtra.quantity}</p>
                  </div>
                </div>
              )}
            </div>

            {meal.description && (
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Description</p>
                <p className="text-sm text-slate-600 leading-relaxed">{meal.description}</p>
              </div>
            )}

            {meal.allergens && meal.allergens.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Régime alimentaire</p>
                <div className="flex flex-wrap gap-2">
                  {meal.allergens.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-semibold px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!loadingReviews && reviews.length === 0 && meal.host_id && meal.host_id !== currentUserId && (
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-400">Aucun avis pour l'instant</p>
              </div>
            )}

            {!loadingReviews && reviews.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                    Avis sur l'hôte
                    {totalReviewCount > 0 && <span className="ml-1 text-slate-300">({totalReviewCount})</span>}
                  </p>
                  {avgRating !== null && (
                    <div className="flex items-center gap-1.5">
                      <StarRating rating={Math.round(avgRating)} size={13} />
                      <span className="text-xs font-bold text-slate-600">{avgRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {(showAllReviews ? reviews : reviews.slice(0, REVIEWS_PAGE_SIZE)).map((rev) => (
                    <div key={rev.id} className="bg-slate-50 rounded-2xl p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        {rev.reviewer?.avatar_url ? (
                          <img src={rev.reviewer.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                            <span className="text-[11px] font-bold text-slate-500">
                              {rev.reviewer?.name?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                        <span className="text-xs font-bold text-slate-700">{rev.reviewer?.name || 'Utilisateur'}</span>
                        <StarRating rating={rev.rating} size={12} />
                      </div>
                      {rev.comment && <p className="text-xs text-slate-500 leading-relaxed">{rev.comment}</p>}
                    </div>
                  ))}
                </div>
                {reviews.length > REVIEWS_PAGE_SIZE && (
                  <button
                    onClick={() => setShowAllReviews((p) => !p)}
                    className="mt-3 w-full text-xs font-bold text-[#16a34a] py-2.5 rounded-xl bg-green-50 border border-green-200 active:bg-green-100 transition-colors"
                  >
                    {showAllReviews ? 'Voir moins' : `Voir tous les ${totalReviewCount} avis`}
                  </button>
                )}
              </div>
            )}

            <div className="h-4" />
          </div>
        </div>

        <div className="px-5 pb-8 pt-3 border-t border-slate-100 bg-white shrink-0">
          {isOwner ? (
            <div className="space-y-2">
              {showDeleteConfirm ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 h-12 rounded-full border border-slate-200 text-slate-600 font-bold text-sm active:scale-95 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      setDeleting(true);
                      if (onDeleteMeal) await onDeleteMeal(meal.id);
                      setDeleting(false);
                      onClose();
                    }}
                    disabled={deleting}
                    className="flex-1 h-12 rounded-full bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {deleting ? (
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    )}
                    Confirmer la suppression
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  {onEditMeal && (
                    <button
                      onClick={() => { onClose(); onEditMeal(meal); }}
                      className="flex-1 h-12 rounded-full bg-slate-100 text-slate-800 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-slate-200"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Modifier
                    </button>
                  )}
                  {onDeleteMeal && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="h-12 px-4 rounded-full bg-red-50 text-red-500 font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:bg-red-100"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  )}
                  {!onEditMeal && !onDeleteMeal && (
                    <div className="w-full h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold text-sm">
                      C'est ton annonce
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isBooked ? (
            <div className="w-full h-14 rounded-full flex items-center justify-center gap-2 bg-emerald-50 border-2 border-emerald-200">
              <span className="material-symbols-outlined text-emerald-500 text-[20px]">check_circle</span>
              <span className="font-bold text-emerald-600 text-sm">Tu as déjà réservé ce repas</span>
            </div>
          ) : (
            <button
              onClick={() => { onClose(); onBook(meal); }}
              className="w-full h-14 rounded-full font-bold text-white text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: categoryColor, boxShadow: `0 6px 20px ${categoryColor}44` }}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isFoodRescue ? 'recycling' : 'event_available'}
              </span>
              {isFoodRescue ? 'Récupérer cet aliment' : 'Rejoindre ce repas'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default MealDetailModal;
