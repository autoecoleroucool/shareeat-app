import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface MemberProfile {
  id: string;
  name: string;
  avatar_url: string;
  bio: string | null;
  location_name: string | null;
  rating: number;
  xp: number;
  meals_given: number;
  meals_taken: number;
  karma_balance: number;
  shares_count: number;
  is_premium: boolean;
  created_at: string;
}

interface CulinaryPhoto {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

interface ChallengeMeal {
  id: string;
  meal_name: string;
  meal_description: string | null;
  proposed_date: string | null;
  status: string;
  avg_rating: number | null;
}

interface Props {
  userId: string;
  onClose: () => void;
  onContact: (id: string, name: string, avatar: string) => void;
}

const SHARES_FOR_CIRCLE = 10;

function KarmaBar({ karma }: { karma: number }) {
  const pct = Math.min(Math.max((karma + 10) / 20, 0), 1) * 100;
  const color = karma >= 0 ? '#49e619' : karma >= -5 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Karma communautaire</span>
        <span className="text-xs font-bold" style={{ color }}>{karma > 0 ? `+${karma}` : karma}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function XpBar({ xp }: { xp: number }) {
  const XP_PER_SHARE = 10;
  const nextMilestone = Math.ceil((xp + 1) / XP_PER_SHARE) * XP_PER_SHARE;
  const pct = Math.min((xp / Math.max(nextMilestone, XP_PER_SHARE)) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Expérience (XP)</span>
        <span className="text-xs font-bold text-[#49e619]">{xp} XP</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#49e619] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-slate-400 mt-0.5">Prochain palier : {nextMilestone} XP</p>
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MemberProfileModal({ userId, onClose, onContact }: Props) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [photos, setPhotos] = useState<CulinaryPhoto[]>([]);
  const [meals, setMeals] = useState<ChallengeMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profil' | 'cercle'>('profil');
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [profileRes, photosRes, mealsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, avatar_url, bio, location_name, rating, xp, meals_given, meals_taken, karma_balance, shares_count, is_premium, created_at')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('culinary_circle_photos')
          .select('id, user_id, image_url, caption, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('culinary_challenge_meals')
          .select('id, meal_name, meal_description, proposed_date, status')
          .eq('host_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (profileRes.data) setProfile(profileRes.data as MemberProfile);
      setPhotos((photosRes.data ?? []) as CulinaryPhoto[]);

      const rawMeals = (mealsRes.data ?? []) as ChallengeMeal[];
      if (rawMeals.length > 0) {
        const mealIds = rawMeals.map((m) => m.id);
        const { data: ratingsData } = await supabase
          .from('culinary_challenge_ratings')
          .select('challenge_meal_id, rating')
          .in('challenge_meal_id', mealIds);

        const avgByMeal: Record<string, number> = {};
        const countByMeal: Record<string, number> = {};
        (ratingsData ?? []).forEach((r: { challenge_meal_id: string; rating: number }) => {
          avgByMeal[r.challenge_meal_id] = (avgByMeal[r.challenge_meal_id] ?? 0) + r.rating;
          countByMeal[r.challenge_meal_id] = (countByMeal[r.challenge_meal_id] ?? 0) + 1;
        });

        setMeals(rawMeals.map((m) => ({
          ...m,
          avg_rating: countByMeal[m.id] ? avgByMeal[m.id] / countByMeal[m.id] : null,
        })));
      } else {
        setMeals([]);
      }

      setLoading(false);
    }
    load();
  }, [userId]);

  const isTrustedCook = (profile?.shares_count ?? 0) >= SHARES_FOR_CIRCLE;
  const memberYear = profile?.created_at ? new Date(profile.created_at).getFullYear() : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(73,230,25,0.05) 0%, transparent 60%)' }}
      />

      <div className="relative flex items-center px-4 pt-14 pb-4 border-b border-white/10">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 mr-3 shrink-0">
          <span className="material-symbols-outlined text-white/70 text-[20px]">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/30">Profil membre</p>
          {profile && <h2 className="text-base font-extrabold text-white truncate">{profile.name}</h2>}
        </div>
        {profile && (
          <button
            onClick={() => onContact(profile.id, profile.name, profile.avatar_url)}
            className="flex items-center gap-1.5 bg-[#49e619]/15 border border-[#49e619]/30 rounded-full px-3 py-1.5 shrink-0"
          >
            <span className="material-symbols-outlined text-[#49e619] text-[14px]">chat_bubble</span>
            <span className="text-[11px] font-bold text-[#49e619]">Contacter</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {loading ? (
          <div className="px-4 pt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : profile ? (
          <>
            <div className="px-4 pt-5 pb-4 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-[#49e619]/30">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white/40 text-[36px]">person</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#49e619] rounded-full flex items-center justify-center border-2 border-black">
                    <span className="material-symbols-outlined text-black text-[12px] fill-1">verified</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-lg font-extrabold text-white">{profile.name}</h3>
                    {profile.is_premium && (
                      <span className="flex items-center gap-0.5 bg-amber-400/15 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-400/20">
                        <span className="material-symbols-outlined text-[10px] fill-1">workspace_premium</span>
                        PREMIUM
                      </span>
                    )}
                    {isTrustedCook && (
                      <span className="flex items-center gap-0.5 bg-amber-500/10 text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-400/20">
                        <span className="material-symbols-outlined text-[10px] fill-1">emoji_food_beverage</span>
                        TRUSTED COOK
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    {[profile.location_name, memberYear ? `Membre depuis ${memberYear}` : null].filter(Boolean).join(' · ')}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className="material-symbols-outlined text-yellow-400 text-[13px] fill-1">star</span>
                    ))}
                    <span className="text-xs font-bold text-white ml-0.5">{profile.rating?.toFixed(1) ?? '–'}</span>
                  </div>
                </div>
              </div>

              {profile.bio && (
                <p className="mt-3 text-sm text-white/60 leading-relaxed">{profile.bio}</p>
              )}

              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="bg-white/5 rounded-xl p-2.5 text-center">
                  <p className="text-base font-extrabold text-white">{profile.meals_given}</p>
                  <p className="text-[9px] text-white/40 font-medium mt-0.5">Repas partagés</p>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 text-center">
                  <p className="text-base font-extrabold text-white">{profile.meals_taken}</p>
                  <p className="text-[9px] text-white/40 font-medium mt-0.5">Repas récupérés</p>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 text-center">
                  <p className="text-base font-extrabold text-[#49e619]">{profile.xp} XP</p>
                  <p className="text-[9px] text-white/40 font-medium mt-0.5">Expérience</p>
                </div>
              </div>
            </div>

            <div className="flex border-b border-white/10">
              {(['profil', 'cercle'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    tab === t ? 'text-[#49e619] border-b-2 border-[#49e619]' : 'text-white/30'
                  }`}
                >
                  {t === 'profil' ? 'Stats & Niveau' : 'Cercle Culinaire'}
                </button>
              ))}
            </div>

            {tab === 'profil' && (
              <div className="px-4 py-4 space-y-4">
                <div className="bg-white/5 rounded-2xl p-4 space-y-4">
                  <KarmaBar karma={profile.karma_balance} />
                  <div className="h-px bg-white/5" />
                  <XpBar xp={profile.xp} />
                  <div className="h-px bg-white/5" />
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Cercle Culinaire</span>
                      <span className="text-xs font-bold text-[#49e619]">{profile.shares_count} / {SHARES_FOR_CIRCLE} partages</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#49e619] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((profile.shares_count / SHARES_FOR_CIRCLE) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {profile.shares_count >= SHARES_FOR_CIRCLE
                        ? 'Cercle Culinaire débloqué'
                        : `Plus que ${SHARES_FOR_CIRCLE - profile.shares_count} partage${SHARES_FOR_CIRCLE - profile.shares_count > 1 ? 's' : ''} pour rejoindre le Cercle`}
                    </p>
                  </div>
                </div>

                {meals.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-white/30 mb-2">Repas proposés en défi</p>
                    <div className="space-y-2">
                      {meals.map((meal) => (
                        <div key={meal.id} className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-amber-400 text-[16px]">restaurant</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{meal.meal_name}</p>
                            {meal.proposed_date && (
                              <p className="text-[10px] text-white/30">{formatDate(meal.proposed_date)}</p>
                            )}
                          </div>
                          {meal.avg_rating !== null && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <span className="material-symbols-outlined text-yellow-400 text-[12px] fill-1">star</span>
                              <span className="text-xs font-bold text-white">{meal.avg_rating.toFixed(1)}</span>
                            </div>
                          )}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meal.status === 'done' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {meal.status === 'done' ? 'Fait' : 'Prévu'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'cercle' && (
              <div className="px-4 py-4">
                {photos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white/20 text-[28px]">photo_library</span>
                    </div>
                    <p className="text-sm text-white/30 font-medium">Aucune photo partagée</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => setLightboxPhoto(photo.image_url)}
                        className="aspect-square rounded-xl overflow-hidden active:scale-95 transition-all"
                      >
                        <img src={photo.image_url} alt={photo.caption ?? ''} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-white/20 text-[40px]">person_off</span>
            <p className="text-sm text-white/30">Profil introuvable</p>
          </div>
        )}
      </div>

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.95)' }}
          onClick={() => setLightboxPhoto(null)}
        >
          <img src={lightboxPhoto} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-12 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-white text-[20px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
