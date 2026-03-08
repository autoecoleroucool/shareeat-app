import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { validateEmail } from '../lib/formatting';

type Mode = 'login' | 'register' | 'forgot';

function getAuthErrorMessage(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (message.includes('Email not confirmed')) return 'Confirme ton email avant de te connecter.';
  if (message.includes('User already registered')) return 'Un compte existe déjà avec cet email.';
  if (message.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (message.includes('Unable to validate email')) return 'Adresse email invalide.';
  if (message.includes('rate limit')) return 'Trop de tentatives. Attends quelques minutes.';
  return message;
}

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailInvalid = emailTouched && email.length > 0 && !validateEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateEmail(email)) {
      setError('Adresse email invalide.');
      setEmailTouched(true);
      return;
    }

    if (mode === 'register' && name.trim().length < 2) {
      setError('Le nom doit contenir au moins 2 caractères.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() } },
        });
        if (signUpError) throw signUpError;
      } else if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
        if (resetError) throw resetError;
        setSuccess('Un email de réinitialisation a été envoyé. Vérifie ta boîte mail.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(getAuthErrorMessage(msg));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSuccess(null);
    setEmailTouched(false);
  };

  return (
    <div
      className="h-app bg-[#f6f8f6] flex flex-col items-center justify-center px-6"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-2">
            <img
              src="/Logo_ShareEat_eco_et_alimentation.png"
              alt="ShareEat - Partage de repas"
              width="176"
              height="176"
              className="h-44 w-auto object-contain drop-shadow-lg"
            />
          </div>
          <p className="text-sm text-slate-500">Partagez des repas, créez des liens</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          {mode !== 'forgot' ? (
            <div className="flex rounded-xl bg-slate-100 p-1 mb-6" role="tablist">
              <button
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => switchMode('login')}
                className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Connexion
              </button>
              <button
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => switchMode('register')}
                className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Inscription
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <button
                onClick={() => switchMode('login')}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Retour
              </button>
              <h2 className="text-lg font-bold text-slate-900">Mot de passe oublié</h2>
              <p className="text-xs text-slate-500 mt-1">Saisis ton email et on t'envoie un lien pour réinitialiser ton mot de passe.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Nom</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={60}
                  placeholder="Votre nom"
                  autoComplete="name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#49e619] focus:border-transparent transition"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                required
                placeholder="votre@email.com"
                autoComplete={mode === 'register' ? 'email' : 'username'}
                aria-invalid={emailInvalid}
                aria-describedby={emailInvalid ? 'email-error' : undefined}
                className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${
                  emailInvalid ? 'border-red-300 focus:ring-red-300' : 'border-slate-200 focus:ring-[#49e619]'
                }`}
              />
              {emailInvalid && (
                <p id="email-error" className="text-xs text-red-500 mt-1">Format d'email invalide</p>
              )}
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mot de passe</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={6}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#49e619] focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                {mode === 'register' && password.length > 0 && password.length < 6 && (
                  <p className="text-xs text-amber-500 mt-1">Au moins 6 caractères requis</p>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2" role="alert">
                <span className="material-symbols-outlined text-red-400 text-[16px] shrink-0 mt-0.5">error</span>
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-start gap-2" role="alert">
                <span className="material-symbols-outlined text-green-500 text-[16px] shrink-0 mt-0.5">check_circle</span>
                <p className="text-xs text-green-700">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#49e619] text-slate-900 font-bold text-sm shadow-sm hover:bg-[#3dd414] active:bg-[#35bc12] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  Chargement...
                </span>
              ) : mode === 'login' ? 'Se connecter' : mode === 'register' ? "S'inscrire" : 'Envoyer le lien'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
