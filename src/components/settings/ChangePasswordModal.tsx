import { useState } from 'react';
import ModalBase from './ModalBase';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const strength = next.length === 0 ? 0 : next.length < 6 ? 1 : next.length < 10 ? 2 : 3;
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'];
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-[#49e619]'];

  const handleSave = () => {
    setError('');
    if (!current) return setError('Please enter your current password.');
    if (next.length < 6) return setError('New password must be at least 6 characters.');
    if (next !== confirm) return setError('Passwords do not match.');
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  const Field = ({
    label,
    value,
    onChange,
    show,
    onToggle,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    onToggle: () => void;
  }) => (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:border-[#49e619] transition-colors bg-slate-50 pr-11"
        />
        <button
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        >
          <span className="material-symbols-outlined text-[18px]">
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <ModalBase title="Change Password" onClose={onClose}>
      <div className="px-6 py-5 space-y-5">
        <Field
          label="Current Password"
          value={current}
          onChange={setCurrent}
          show={showCurrent}
          onToggle={() => setShowCurrent(!showCurrent)}
        />

        <Field
          label="New Password"
          value={next}
          onChange={setNext}
          show={showNext}
          onToggle={() => setShowNext(!showNext)}
        />

        {next.length > 0 && (
          <div className="space-y-1 -mt-3">
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= strength ? strengthColor[strength] : 'bg-slate-100'
                  }`}
                />
              ))}
            </div>
            <p className={`text-xs font-semibold ${strength === 1 ? 'text-red-400' : strength === 2 ? 'text-yellow-500' : 'text-[#49e619]'}`}>
              {strengthLabel[strength]}
            </p>
          </div>
        )}

        <Field
          label="Confirm New Password"
          value={confirm}
          onChange={setConfirm}
          show={showConfirm}
          onToggle={() => setShowConfirm(!showConfirm)}
        />

        {error && (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        )}

        <button
          onClick={handleSave}
          className={`w-full py-3.5 rounded-full font-bold text-sm transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-[#49e619] text-white hover:bg-[#3ecc14] active:scale-95'
          }`}
        >
          {saved ? 'Updated!' : 'Update Password'}
        </button>
      </div>
    </ModalBase>
  );
}
