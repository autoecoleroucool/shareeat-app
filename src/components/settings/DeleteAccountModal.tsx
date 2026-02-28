import { useState } from 'react';
import ModalBase from './ModalBase';

interface DeleteAccountModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteAccountModal({ onClose, onConfirm }: DeleteAccountModalProps) {
  const [confirmation, setConfirmation] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  const canProceed = confirmation.trim().toLowerCase() === 'delete';

  if (step === 1) {
    return (
      <ModalBase title="Delete Account" onClose={onClose}>
        <div className="px-6 py-5 space-y-5">
          <div className="bg-red-50 rounded-2xl p-4 flex gap-3">
            <span className="material-symbols-outlined text-red-400 text-[22px] shrink-0 mt-0.5">warning</span>
            <div className="space-y-1">
              <p className="text-sm font-bold text-red-600">This action is permanent</p>
              <p className="text-sm text-red-500 leading-relaxed">
                All your meals, reviews, messages, and profile data will be permanently erased. This cannot be undone.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {['Your profile and photo', 'All meals you hosted', 'All reviews given and received', 'All message history', 'Your trust level and badges'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="material-symbols-outlined text-red-400 text-[16px]">close</span>
                {item}
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full py-3.5 rounded-full font-bold text-sm bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all"
          >
            I understand, continue
          </button>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-full font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Keep my account
          </button>
        </div>
      </ModalBase>
    );
  }

  return (
    <ModalBase title="Confirm Deletion" onClose={onClose}>
      <div className="px-6 py-5 space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          Type <span className="font-bold text-red-500">delete</span> below to confirm you want to permanently delete your account.
        </p>
        <input
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Type 'delete' to confirm"
          className="w-full px-4 py-3 rounded-xl border border-red-200 text-sm text-slate-800 font-medium focus:outline-none focus:border-red-400 transition-colors bg-red-50 placeholder-red-300"
        />
        <button
          onClick={onConfirm}
          disabled={!canProceed}
          className={`w-full py-3.5 rounded-full font-bold text-sm transition-all ${
            canProceed
              ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          Delete My Account
        </button>
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-full font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </ModalBase>
  );
}
