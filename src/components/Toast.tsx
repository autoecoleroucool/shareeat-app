import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [duration, onClose]);

  const colors = {
    success: 'bg-slate-900 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-slate-700 text-white',
  };

  const icons = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
  };

  return (
    <div
      className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 max-w-[85vw] ${colors[type]} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      role="alert"
      aria-live="polite"
    >
      <span className="material-symbols-outlined text-[18px] fill-1 shrink-0">{icons[type]}</span>
      <p className="text-sm font-semibold">{message}</p>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType; id: number } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type, id: Date.now() });
  };

  const hideToast = () => setToast(null);

  return { toast, showToast, hideToast };
}
