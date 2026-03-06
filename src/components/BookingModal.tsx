import { useState, useEffect, useRef } from 'react';
import { Meal } from '../types';
import { supabase } from '../lib/supabase';

const SHARE_MESSAGE = "Je viens de récupérer un repas sur ShareEat pour lutter contre le gaspillage ! Rejoins le mouvement : https://shareeat.app";

interface BookingModalProps {
  meal: Meal;
  hostName: string;
  hostAvatar: string;
  timing: { day: string; time: string };
  onClose: () => void;
  onBooked: (mealId: string) => void;
  userKarma?: number;
}

type Step = 'blocked' | 'confirm' | 'donate' | 'success';

const DONATION_AMOUNTS = [0.5, 1, 2, 5, 10];
const KARMA_LIMIT = -10;

export default function BookingModal({ meal, hostName, hostAvatar, timing, onClose, onBooked, userKarma = 0 }: BookingModalProps) {
  const isKarmaBlocked = userKarma <= KARMA_LIMIT;

  const [step, setStep] = useState<Step>(isKarmaBlocked ? 'blocked' : 'confirm');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [loadingBook, setLoadingBook] = useState(false);
  const [loadingDonate, setLoadingDonate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [donationConfirmed, setDonationConfirmed] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  function safeTimeout(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }

  const donationAmount = selectedAmount ?? (customAmount ? parseFloat(customAmount) : null);

  async function handleBook() {
    setLoadingBook(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Tu dois être connecté pour réserver une place.');
      setLoadingBook(false);
      return;
    }

    const { data: bookResult, error: bookError } = await supabase
      .rpc('book_meal', { p_meal_id: meal.id, p_user_id: user.id });

    if (bookError) {
      setError('Une erreur est survenue. Réessaie.');
      setLoadingBook(false);
      return;
    }

    if (bookResult === 'no_slots' || bookResult === 'already_claimed') {
      setError('Ce repas n\'est plus disponible. Quelqu\'un vient de le réserver.');
      setLoadingBook(false);
      return;
    }

    if (bookResult === 'already_booked') {
      setError('Tu as déjà réservé une place pour ce repas.');
      setLoadingBook(false);
      return;
    }

    if (bookResult === 'own_meal') {
      setError('Tu ne peux pas réserver ton propre repas.');
      setLoadingBook(false);
      return;
    }

    if (bookResult !== 'ok') {
      setError('Une erreur est survenue. Réessaie.');
      setLoadingBook(false);
      return;
    }

    const autoMsg = `Bonjour ! Je viens de réserver une place pour "${meal.title}". À bientôt !`;

    const { data: conv } = await supabase
      .from('conversations')
      .upsert(
        {
          meal_id: meal.id,
          host_id: meal.host_id,
          guest_id: user.id,
          last_message_text: autoMsg,
          last_message_at: new Date().toISOString(),
        },
        { onConflict: 'meal_id,guest_id', ignoreDuplicates: false }
      )
      .select('id')
      .maybeSingle();

    if (conv?.id) {
      await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: meal.host_id,
        meal_id: meal.id,
        content: autoMsg,
        conversation_id: conv.id,
      });
    }

    setLoadingBook(false);
    setStep('donate');
  }

  async function handleDonate() {
    if (!donationAmount || isNaN(donationAmount) || donationAmount <= 0) return;

    setLoadingDonate(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingDonate(false);
      return;
    }

    await supabase.from('donations').insert({
      user_id: user.id,
      meal_id: meal.id,
      amount: donationAmount,
      association: 'ShareEat',
    });

    setDonationConfirmed(true);
    setLoadingDonate(false);
    setStep('success');
    safeTimeout(() => {
      onBooked(meal.id);
      onClose();
    }, 2500);
  }

  function skipDonate() {
    setStep('success');
    safeTimeout(() => {
      onBooked(meal.id);
      onClose();
    }, 2500);
  }

  const karmaAfter = userKarma - 1;
  const karmaWarning = karmaAfter <= -8 && !isKarmaBlocked;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-md mx-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={step === 'confirm' ? onClose : undefined} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl overflow-hidden">

        <div className="relative h-36 w-full">
          <img
            src={meal.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
            alt={meal.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          {(step === 'confirm' || step === 'blocked') && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-white text-[20px]">close</span>
            </button>
          )}
          <div className="absolute bottom-3 left-4 right-4">
            <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold mb-0.5">
              {step === 'blocked' ? 'Karma insuffisant'
                : step === 'confirm' ? 'Réserver'
                : step === 'donate' ? 'Soutenir l\'application'
                : 'Confirmation'}
            </p>
            <h2 className="text-lg font-bold text-white leading-tight">{meal.title}</h2>
          </div>
        </div>

        <div className="px-6 pt-5 pb-8 space-y-5">

          {step === 'blocked' && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500 text-[40px]">block</span>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-900">Karma insuffisant</p>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Tu as pris trop de repas sans en partager en retour. Partage d'abord un repas pour rééquilibrer ton karma.
                </p>
              </div>
              <div className="w-full bg-slate-50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Ton karma actuel</span>
                  <span className="font-bold text-red-500">{userKarma}</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full"
                    style={{ width: `${Math.max(0, ((userKarma + 10) / 20) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center">Minimum requis : -9</p>
              </div>
              <button
                onClick={onClose}
                className="w-full h-14 bg-[#49e619] text-slate-900 font-bold rounded-full flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">restaurant</span>
                Partager un repas maintenant
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={hostAvatar} alt={hostName} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{hostName}</p>
                    <p className="text-xs text-slate-500">Hôte</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{timing.day}</p>
                  <p className="text-sm font-medium text-slate-700">{timing.time}</p>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              <div className="bg-[#f0fce8] rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-[#3acc0f] text-[22px] shrink-0 mt-0.5">volunteer_activism</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">Partage entre voisins — 100% gratuit</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    ShareEat est une plateforme de mise en relation. Aucun paiement entre utilisateurs. En prenant ce repas, ton karma diminue de 1. Pense à partager le tien en retour !
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">favorite</span>
                  <span className="text-xs font-semibold text-slate-600">Karma après réservation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 line-through">{userKarma}</span>
                  <span className="material-symbols-outlined text-slate-400 text-[14px]">arrow_forward</span>
                  <span className={`text-sm font-bold ${karmaAfter <= -8 ? 'text-red-500' : karmaAfter < 0 ? 'text-amber-500' : 'text-[#49e619]'}`}>
                    {karmaAfter}
                  </span>
                </div>
              </div>

              {karmaWarning && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <span className="material-symbols-outlined text-amber-500 text-[20px] flex-shrink-0 mt-0.5">warning</span>
                  <p className="text-xs text-amber-700 font-medium leading-relaxed">
                    Attention ! Il ne te reste que {karmaAfter - KARMA_LIMIT} prise(s) avant d'être bloqué. Partage bientôt un repas !
                  </p>
                </div>
              )}

              <button
                onClick={() => setDisclaimerAccepted(!disclaimerAccepted)}
                className={`w-full flex items-start gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                  disclaimerAccepted
                    ? 'border-slate-700 bg-slate-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                  disclaimerAccepted
                    ? 'bg-slate-800 border-slate-800'
                    : 'border-slate-300 bg-white'
                }`}>
                  {disclaimerAccepted && (
                    <span className="material-symbols-outlined text-white text-[14px]">check</span>
                  )}
                </div>
                <p className={`text-xs leading-relaxed font-medium transition-colors ${
                  disclaimerAccepted ? 'text-slate-700' : 'text-slate-500'
                }`}>
                  Je comprends que ShareEat est une plateforme de mise en relation entre particuliers. ShareEat ne contrôle pas la qualité, la sécurité ou la conformité sanitaire des aliments partagés et décline toute responsabilité à cet égard. Je m'engage à vérifier les aliments avant consommation.
                </p>
              </button>

              {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

              <button
                onClick={handleBook}
                disabled={loadingBook || !disclaimerAccepted}
                className="w-full h-14 bg-slate-900 text-white font-bold rounded-full transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loadingBook ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[#49e619] text-[20px]">event_available</span>
                    Confirmer ma place
                  </>
                )}
              </button>
            </>
          )}

          {step === 'donate' && (
            <>
              <div className="flex items-start gap-3 bg-[#f0fce8] rounded-2xl p-4">
                <span className="material-symbols-outlined text-[#3acc0f] text-[24px] shrink-0 mt-0.5">check_circle</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">Ta place est confirmée !</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    ShareEat est 100% gratuit et communautaire. Si tu souhaites soutenir la solidarité alimentaire, tu peux faire un don volontaire.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#49e619]/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[#3acc0f] text-[22px]">handshake</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Soutenir la solidarité alimentaire</p>
                  <p className="text-xs text-slate-500 leading-tight">Don volontaire — sans impact sur ton karma ou tes XP</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Choisir un montant</p>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {DONATION_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        selectedAmount === amount
                          ? 'border-[#49e619] bg-[#49e619]/10 text-[#3acc0f]'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {amount}€
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="Autre montant (€)"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#49e619] transition-colors"
                />
              </div>

              {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={skipDonate}
                  className="flex-1 h-12 border border-slate-200 text-slate-500 font-semibold rounded-full text-sm transition-all active:scale-[0.98]"
                >
                  Passer
                </button>
                <button
                  onClick={handleDonate}
                  disabled={loadingDonate || !donationAmount || isNaN(donationAmount) || donationAmount <= 0}
                  className="flex-[2] h-12 bg-[#49e619] text-slate-900 font-bold rounded-full text-sm transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {loadingDonate ? (
                    <span className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">handshake</span>
                      {donationAmount && donationAmount > 0 ? `Soutenir ${donationAmount}€` : 'Soutenir'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center py-4 gap-4">
              <div className="w-16 h-16 rounded-full bg-[#49e619]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#3acc0f] text-[34px]">check_circle</span>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900">C'est confirmé !</p>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  {donationConfirmed
                    ? `Merci pour ton don de ${donationAmount}€ à ShareEat.`
                    : 'Ta place est réservée.'}{' '}
                  À bientôt à table !
                </p>
              </div>
              <div className="w-full bg-slate-50 rounded-2xl px-5 py-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Ton karma</span>
                  <span className={`font-bold ${karmaAfter < 0 ? 'text-amber-500' : 'text-[#49e619]'}`}>{karmaAfter}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Pense à partager un repas prochainement pour maintenir l'équilibre de la communauté.
                </p>
              </div>

              <div className="w-full pt-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-slate-100" />
                  <p className="text-[10px] font-600 text-slate-400 uppercase tracking-wide">Partager ce moment</p>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(SHARE_MESSAGE)}`, '_blank', 'noopener,noreferrer')}
                    style={{ background: '#25D366' }}
                    className="flex-1 h-11 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText('https://shareeat.app');
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      } catch { /* ignore */ }
                    }}
                    className={`flex-1 h-11 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${linkCopied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{linkCopied ? 'check' : 'link'}</span>
                    {linkCopied ? 'Copié !' : 'Lien'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
