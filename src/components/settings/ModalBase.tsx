import { ReactNode } from 'react';

interface ModalBaseProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function ModalBase({ title, onClose, children }: ModalBaseProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-slate-500 text-[18px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar">{children}</div>
      </div>
    </div>
  );
}
