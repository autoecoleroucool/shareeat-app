import { useEffect, useRef, useState } from 'react';

interface BookingToastProps {
  guestName: string;
  mealTitle: string;
  onClose: () => void;
  onViewMessages: () => void;
}

export default function BookingToast({ guestName, mealTitle, onClose, onViewMessages }: BookingToastProps) {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      closeTimerRef.current = setTimeout(onClose, 400);
    }, 7000);
    return () => {
      cancelAnimationFrame(raf);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [onClose]);

  function dismiss() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setVisible(false);
    closeTimerRef.current = setTimeout(onClose, 400);
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        left: 12,
        right: 12,
        zIndex: 9999,
        transform: visible ? 'translateY(0)' : 'translateY(-120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.32,0.72,0,1), opacity 0.4s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div style={{
        background: 'white',
        borderRadius: 20,
        boxShadow: '0 8px 40px rgba(0,0,0,0.22), 0 0 0 1.5px rgba(73,230,25,0.35)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: 4,
          background: 'linear-gradient(90deg, #49e619, #3acc0f)',
          borderRadius: '20px 20px 0 0',
        }} />
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f0fce8, #d1fae5)',
            border: '2px solid #49e619',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
          }}>
            <span className="material-symbols-outlined" style={{ color: '#16a34a', fontSize: 22 }}>
              restaurant
            </span>
            <div style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 18,
              height: 18,
              background: '#ef4444',
              borderRadius: '50%',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ color: 'white', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>1</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: '0 0 2px', lineHeight: 1.2 }}>
              Nouvelle reservation !
            </p>
            <p style={{ fontSize: 12, color: '#374151', margin: '0 0 1px', fontWeight: 600 }}>
              {guestName}
            </p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              veut recuperer : {mealTitle}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => { onViewMessages(); dismiss(); }}
              style={{
                background: '#49e619',
                color: '#111827',
                border: 'none',
                borderRadius: 20,
                padding: '7px 14px',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              Voir
            </button>
            <button
              onClick={dismiss}
              style={{
                background: '#f3f4f6',
                color: '#6b7280',
                border: 'none',
                borderRadius: 20,
                padding: '5px 14px',
                fontWeight: 600,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
