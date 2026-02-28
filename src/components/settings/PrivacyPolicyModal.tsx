import ModalBase from './ModalBase';

interface PrivacyPolicyModalProps {
  onClose: () => void;
}

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'We collect information you provide when creating an account (name, email, photo), using the app (meals joined, messages sent, location when enabled), and payment details processed securely through our payment provider.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'Your information is used to match you with meals nearby, facilitate communication between hosts and guests, calculate trust levels, and improve the app experience. We never sell your personal data to third parties.',
  },
  {
    title: '3. Location Data',
    body: 'Location is used only to show nearby meals and is never stored beyond your session unless you explicitly enable persistent location sharing in Settings. You can disable this at any time.',
  },
  {
    title: '4. Data Sharing',
    body: 'Your public profile (name, photo, rating) is visible to other users. Your email and exact address are never shared. Meal details are only visible to confirmed attendees.',
  },
  {
    title: '5. Data Retention',
    body: 'Account data is kept as long as your account is active. After deletion, personal data is removed within 30 days. Anonymised usage statistics may be retained for analytics.',
  },
  {
    title: '6. Your Rights',
    body: 'You may request access to, correction of, or deletion of your personal data at any time by contacting privacy@shareat.app or using the Delete Account option in Settings.',
  },
  {
    title: '7. Contact',
    body: 'For any privacy-related questions: privacy@shareat.app',
  },
];

export default function PrivacyPolicyModal({ onClose }: PrivacyPolicyModalProps) {
  return (
    <ModalBase title="Privacy Policy" onClose={onClose}>
      <div className="px-6 py-5 space-y-5">
        <p className="text-xs text-slate-400">Last updated: February 2026</p>
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <p className="text-sm font-bold text-slate-800 mb-1">{s.title}</p>
            <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </ModalBase>
  );
}
