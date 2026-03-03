import { memo } from 'react';
import { Meal } from '../../types';
import {
  CATEGORY_CONFIG,
  getMealCategory,
  formatExpiry,
  isExpiringSoon,
  formatMealTiming,
} from '../../lib/mealUtils';

const FALLBACK_AVATAR = 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?w=60';

interface MealCardProps {
  meal: Meal;
  currentUserId: string | null;
  isLiked: boolean;
  isBooked: boolean;
  onOpen: (meal: Meal) => void;
  onBook: (meal: Meal) => void;
  onReport: (meal: Meal) => void;
  onToggleLike: (hostId: string) => void;
}

const MealCard = memo(function MealCard({
  meal,
  currentUserId,
  isLiked,
  isBooked,
  onOpen,
  onBook,
  onReport,
  onToggleLike,
}: MealCardProps) {
  const cat = getMealCategory(meal);
  const cfg = CATEGORY_CONFIG[cat];
  const isFoodRescue = cat === 'food_rescue';
  const mealWithExtra = meal as unknown as { category?: string; expires_at?: string | null; quantity?: string | null };
  const spotsLeft = meal.slots_total - meal.slots_taken;
  const timing = formatMealTiming(meal.meal_date);
  const hostName = meal.host?.name || 'Utilisateur';
  const hostAvatar = meal.host?.avatar_url || FALLBACK_AVATAR;
  const isOwnMeal = meal.host_id === currentUserId;
  const expiringSoon = isFoodRescue && isExpiringSoon(mealWithExtra.expires_at);

  if (isFoodRescue) {
    return (
      <button
        onClick={() => onOpen(meal)}
        className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border text-left"
        style={{ borderColor: expiringSoon ? '#fca5a5' : '#d1fae5', borderLeftWidth: 4, borderLeftColor: cfg.color }}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 text-3xl"
              style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
              ♻️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: cfg.color }}>
                  Anti-gaspi
                </span>
                {expiringSoon && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-red-700 bg-red-50 border border-red-200">
                    Expire bientôt
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 leading-tight truncate">{meal.title}</h3>
              {mealWithExtra.quantity && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{mealWithExtra.quantity}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <img src={hostAvatar} alt={hostName} className="w-5 h-5 rounded-full object-cover" loading="lazy" decoding="async" />
                <p className="text-xs text-slate-500">{hostName}</p>
              </div>
            </div>
            {!isOwnMeal && meal.host_id && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleLike(meal.host_id!); }}
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0 transition-transform active:scale-90"
              >
                <span className={`material-symbols-outlined text-[18px] ${isLiked ? 'fill-1 text-red-500' : 'text-slate-400'}`}>favorite</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
            <div>
              {mealWithExtra.expires_at && (
                <p className="text-sm font-semibold" style={{ color: expiringSoon ? '#dc2626' : '#16a34a' }}>
                  {formatExpiry(mealWithExtra.expires_at)}
                </p>
              )}
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[13px]">location_on</span>
                {meal.location_name || 'Quartier'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {meal.host_id !== currentUserId && (
                <button
                  onClick={(e) => { e.stopPropagation(); onReport(meal); }}
                  className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">flag</span>
                </button>
              )}
              {isOwnMeal ? (
                <span className="font-bold py-2 px-5 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-default">
                  Mon annonce
                </span>
              ) : isBooked ? (
                <span className="flex items-center gap-1 font-bold py-2.5 px-4 rounded-xl text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Réservé
                </span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onBook(meal); }}
                  className="font-bold py-2.5 px-5 rounded-xl text-sm text-white transition-all active:scale-95"
                  style={{ background: cfg.color }}
                >
                  Récupérer
                </button>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => onOpen(meal)}
      className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50 text-left"
    >
      <div className="relative h-48 w-full">
        <img
          src={meal.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
          alt={meal.title}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: cfg.color }}>
            Repas maison
          </span>
          <span className="bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full" style={{ background: spotsLeft <= 1 ? '#f97316' : '#16a34a' }} />
            {spotsLeft} place{spotsLeft !== 1 ? 's' : ''}
          </span>
        </div>
        {!isOwnMeal && meal.host_id && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleLike(meal.host_id!); }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-sm transition-transform active:scale-90"
          >
            <span className={`material-symbols-outlined text-[19px] ${isLiked ? 'fill-1 text-red-500' : 'text-slate-900'}`}>favorite</span>
          </button>
        )}
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-[17px] font-bold text-slate-900 leading-tight flex-1 pr-2">{meal.title}</h3>
          <span className="flex items-center gap-1 bg-[#f0fdf4] px-2.5 py-1 rounded-full text-xs font-bold text-[#16a34a] shrink-0">
            <span className="material-symbols-outlined text-[13px]">volunteer_activism</span>
            Gratuit
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <img src={hostAvatar} alt={hostName} className="w-6 h-6 rounded-full object-cover bg-slate-200" loading="lazy" decoding="async" />
          <p className="text-sm text-slate-500">{hostName}</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{timing.day}</span>
            <span className="text-sm font-medium text-slate-700">{timing.time}</span>
          </div>
          <div className="flex items-center gap-2">
            {meal.host_id !== currentUserId && (
              <button
                onClick={(e) => { e.stopPropagation(); onReport(meal); }}
                className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-200 hover:bg-orange-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[17px]">flag</span>
              </button>
            )}
            {isOwnMeal ? (
              <span className="font-bold py-2.5 px-5 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-default">
                Mon repas
              </span>
            ) : isBooked ? (
              <span className="flex items-center gap-1 font-bold py-2.5 px-4 rounded-xl text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Réservé
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onBook(meal); }}
                className="font-bold py-2.5 px-5 rounded-xl text-sm text-white transition-all active:scale-95"
                style={{ background: cfg.color }}
              >
                Rejoindre
              </button>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});

export default MealCard;
