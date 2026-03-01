import { useState, useEffect, useCallback } from 'react';
import { Screen } from '../types';
import { supabase } from '../lib/supabase';
import EditProfileModal from '../components/settings/EditProfileModal';
import ChangePasswordModal from '../components/settings/ChangePasswordModal';
import EmailPreferencesModal from '../components/settings/EmailPreferencesModal';
import BlockedUsersModal from '../components/settings/BlockedUsersModal';
import HelpCenterModal from '../components/settings/HelpCenterModal';
import AboutModal from '../components/settings/AboutModal';
import PrivacyPolicyModal from '../components/settings/PrivacyPolicyModal';
import TermsOfServiceModal from '../components/settings/TermsOfServiceModal';
import DeleteAccountModal from '../components/settings/DeleteAccountModal';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface SettingsScreenProps {
  onBack: () => void;
  onNavigate: (screen: Screen) => void;
}

interface Profile {
  id: string;
  name: string;
  avatar_url: string;
  bio: string;
  location_name: string;
  push_notifications: boolean;
  sms_alerts: boolean;
  profile_visible: boolean;
  location_sharing: boolean;
}

type ModalType =
  | 'editProfile'
  | 'changePassword'
  | 'emailPreferences'
  | 'blockedUsers'
  | 'helpCenter'
  | 'about'
  | 'privacyPolicy'
  | 'termsOfService'
  | 'deleteAccount'
  | null;

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [profileVisible, setProfileVisible] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const push = usePushNotifications(userId);
  const [pushDeniedBanner, setPushDeniedBanner] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, bio, location_name, push_notifications, sms_alerts, profile_visible, location_sharing')
      .eq('id', user.id)
      .maybeSingle();
    if (data) {
      setProfile(data as Profile);
      setSmsAlerts(data.sms_alerts ?? false);
      setProfileVisible(data.profile_visible ?? true);
      setLocationSharing(data.location_sharing ?? true);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function savePreference(key: string, value: boolean) {
    if (!userId) return;
    await supabase.from('profiles').update({ [key]: value }).eq('id', userId);
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
        value ? 'bg-[#49e619]' : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const Row = ({
    icon,
    label,
    onClick,
    toggle,
    last = false,
  }: {
    icon: string;
    label: string;
    onClick?: () => void;
    toggle?: React.ReactNode;
    last?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left ${
        !last ? 'border-b border-slate-50' : ''
      }`}
    >
      <div className="w-9 h-9 rounded-full bg-[#f0fce8] flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[#49e619] text-[18px]">{icon}</span>
      </div>
      <span className="flex-1 text-sm font-medium text-slate-800">{label}</span>
      {toggle ?? (
        <span className="material-symbols-outlined text-slate-300 text-[18px]">chevron_right</span>
      )}
    </button>
  );

  return (
    <>
      <div className="flex flex-col h-app bg-[#f6f8f6]">
        <div className="bg-white px-6 pb-4 flex items-center gap-3 border-b border-slate-100" style={{ paddingTop: 'calc(env(safe-area-inset-top, 44px) + 14px)' }}>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-slate-600 text-[20px]">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold text-slate-900">Paramètres</h1>
        </div>

        <main className="flex-1 overflow-y-auto hide-scrollbar pb-10">
          <div className="px-6 pt-6 space-y-6">

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Compte</p>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50">
                <Row icon="person" label="Modifier le profil" onClick={() => setActiveModal('editProfile')} />
                <Row icon="lock" label="Changer le mot de passe" onClick={() => setActiveModal('changePassword')} />
                <Row icon="mail" label="Préférences e-mail" onClick={() => setActiveModal('emailPreferences')} last />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Notifications</p>
              {pushDeniedBanner && (
                <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-500 text-[18px] mt-0.5 shrink-0">warning</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">Notifications bloquées</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Active-les dans les paramètres de ton navigateur pour recevoir des alertes quand l'app est fermée.
                    </p>
                  </div>
                  <button onClick={() => setPushDeniedBanner(false)} className="ml-auto shrink-0">
                    <span className="material-symbols-outlined text-amber-400 text-[16px]">close</span>
                  </button>
                </div>
              )}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50">
                <div className={`w-full flex items-center gap-4 px-5 py-4 border-b border-slate-50 ${push.permission === 'unsupported' ? 'opacity-50' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-[#f0fce8] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#49e619] text-[18px]">notifications</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">Notifications push</p>
                    {push.permission === 'unsupported' && (
                      <p className="text-[11px] text-slate-400 mt-0.5">Non supporté sur cet appareil</p>
                    )}
                    {push.permission === 'denied' && (
                      <p className="text-[11px] text-amber-500 mt-0.5">Bloquées — à activer dans le navigateur</p>
                    )}
                    {push.isSubscribed && push.permission === 'granted' && (
                      <p className="text-[11px] text-[#49e619] mt-0.5">Activées — tu recevras des alertes</p>
                    )}
                  </div>
                  {push.isLoading ? (
                    <span className="w-5 h-5 border-2 border-slate-200 border-t-[#49e619] rounded-full animate-spin" />
                  ) : (
                    <Toggle
                      value={push.isSubscribed}
                      onChange={async () => {
                        if (push.permission === 'unsupported') return;
                        if (push.isSubscribed) {
                          await push.unsubscribe();
                        } else {
                          const ok = await push.subscribe();
                          if (!ok && push.permission === 'denied') {
                            setPushDeniedBanner(true);
                          }
                        }
                      }}
                    />
                  )}
                </div>
                <Row
                  icon="sms"
                  label="Alertes SMS"
                  toggle={<Toggle value={smsAlerts} onChange={() => { const v = !smsAlerts; setSmsAlerts(v); savePreference('sms_alerts', v); }} />}
                  last
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Confidentialité & Sécurité</p>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50">
                <Row
                  icon="visibility"
                  label="Visibilité du profil"
                  toggle={<Toggle value={profileVisible} onChange={() => { const v = !profileVisible; setProfileVisible(v); savePreference('profile_visible', v); }} />}
                />
                <Row
                  icon="location_on"
                  label="Partage de position"
                  toggle={<Toggle value={locationSharing} onChange={() => { const v = !locationSharing; setLocationSharing(v); savePreference('location_sharing', v); }} />}
                />
                <Row icon="block" label="Utilisateurs bloqués" onClick={() => setActiveModal('blockedUsers')} last />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Support</p>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50">
                <Row icon="help" label="Centre d'aide" onClick={() => setActiveModal('helpCenter')} />
                <Row icon="info" label="À propos" onClick={() => setActiveModal('about')} />
                <Row icon="policy" label="Politique de confidentialité" onClick={() => setActiveModal('privacyPolicy')} />
                <Row icon="gavel" label="Conditions d'utilisation (CGU)" onClick={() => setActiveModal('termsOfService')} last />
              </div>
            </div>

            <div>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-50">
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left border-b border-slate-50"
                >
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">logout</span>
                  </div>
                  <span className="flex-1 text-sm font-medium text-slate-700">Se déconnecter</span>
                </button>
                <button
                  onClick={() => setActiveModal('deleteAccount')}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-red-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-red-400 text-[18px]">delete</span>
                  </div>
                  <span className="flex-1 text-sm font-medium text-red-500">Supprimer le compte</span>
                </button>
              </div>
            </div>

          </div>
        </main>
      </div>

      {activeModal === 'editProfile' && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setActiveModal(null)}
          onSaved={loadProfile}
        />
      )}
      {activeModal === 'changePassword' && <ChangePasswordModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'emailPreferences' && <EmailPreferencesModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'blockedUsers' && <BlockedUsersModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'helpCenter' && <HelpCenterModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'about' && <AboutModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'privacyPolicy' && <PrivacyPolicyModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'termsOfService' && <TermsOfServiceModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'deleteAccount' && <DeleteAccountModal onClose={() => setActiveModal(null)} onConfirm={() => setActiveModal(null)} />}
    </>
  );
}
