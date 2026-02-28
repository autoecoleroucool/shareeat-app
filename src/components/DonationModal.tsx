import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface DonationModalProps {
  onClose: () => void;
}

type Step = 'form' | 'success';

const DONATION_AMOUNTS = [1, 2, 5, 10, 20];

const ASSOCIATIONS = [
  {
    name: 'Restos du Coeur',
    description: 'Distribution de repas et aide alimentaire pour les personnes dans le besoin',
    icon: 'soup_kitchen',
  },
  {
    name: 'Samu Social',
    description: 'Maraudes, hébergement d\'urgence et accompagnement des sans-abri',
    icon: 'emergency_home',
  },
  {
    name: 'Secours Populaire',
    description: 'Lutte contre la pauvreté et l\'exclusion en France et dans le monde',
    icon: 'volunteer_activism',
  },
];

export default function DonationModal({ onClose }: DonationModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAssociation, setSelectedAssociation] = useState(ASSOCIATIONS[0].name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const donationAmount = selectedAmount ?? (customAmount ? parseFloat(customAmount) : null);
  const isValid = donationAmount !== null && !isNaN(donationAmount) && donationAmount > 0;

  async function handleDonate() {
    if (!isValid) return;
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Tu dois être connecté pour faire un don.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('donations').insert({
      user_id: user.id,
      meal_id: null,
      amount: donationAmount,
      association: selectedAssociation,
    });

    if (insertError) {
      setError('Une erreur est survenue. Réessaie.');
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep('success');
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-md mx-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={step === 'form' ? onClose : undefined} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl overflow-hidden">

        <div className="relative h-32 w-full bg-gradient-to-br from-orange-500 to-red-600">
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, white 0%, transparent 60%)' }}
          />
          {step === 'form' && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/20 backdrop-blur flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-white text-[20px]">close</span>
            </button>
          )}
          <div className="absolute bottom-4 left-5">
            <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold mb-1">Don solidaire</p>
            <h2 className="text-xl font-bold text-white">Aider les sans-abri</h2>
          </div>
          <div className="absolute right-5 bottom-4 w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[26px]">handshake</span>
          </div>
        </div>

        <div className="px-6 pt-5 pb-8 space-y-5">

          {step === 'form' && (
            <>
              <p className="text-sm text-slate-500 leading-relaxed">
                Ton don va directement aux associations qui aident les personnes sans domicile : repas chauds, maraudes, hébergement d'urgence.
              </p>

              <div className="h-px bg-slate-100" />

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Choisir une association</p>
                <div className="space-y-2">
                  {ASSOCIATIONS.map((a) => (
                    <button
                      key={a.name}
                      onClick={() => setSelectedAssociation(a.name)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        selectedAssociation === a.name
                          ? 'border-orange-400 bg-orange-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                        selectedAssociation === a.name ? 'bg-orange-500' : 'bg-slate-100'
                      }`}>
                        <span className={`material-symbols-outlined text-[18px] ${
                          selectedAssociation === a.name ? 'text-white' : 'text-slate-500'
                        }`}>{a.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{a.name}</p>
                        <p className="text-[11px] text-slate-500 leading-tight">{a.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Montant du don</p>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {DONATION_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        selectedAmount === amount
                          ? 'border-orange-400 bg-orange-50 text-orange-600'
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
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 transition-colors"
                />
              </div>

              {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

              <button
                onClick={handleDonate}
                disabled={loading || !isValid}
                className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">favorite</span>
                    {isValid ? `Donner ${donationAmount}€` : 'Choisir un montant'}
                  </>
                )}
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-orange-500 text-[40px]">favorite</span>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900">Merci !</p>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Ton don de <span className="font-bold text-slate-700">{donationAmount}€</span> a été envoyé à{' '}
                  <span className="font-bold text-slate-700">{selectedAssociation}</span>.<br />
                  Tu aides des personnes à avoir un repas chaud ce soir.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-orange-50 rounded-full px-5 py-2.5">
                <span className="material-symbols-outlined text-orange-500 text-[18px]">handshake</span>
                <p className="text-xs font-semibold text-orange-700">Don solidaire confirmé</p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 text-sm text-slate-400 font-medium"
              >
                Fermer
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
