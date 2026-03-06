import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BadgeConfig } from '../types';

interface ShareSuccessModalProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  newBadges?: BadgeConfig[];
  shareMessage?: string;
}

const DEFAULT_SHARE_MESSAGE = "Je viens de partager un repas sur ShareEat pour lutter contre le gaspillage alimentaire. Rejoins le mouvement : https://shareeat.app";

export default function ShareSuccessModal({
  title,
  subtitle,
  onClose,
  newBadges = [],
  shareMessage = DEFAULT_SHARE_MESSAGE,
}: ShareSuccessModalProps) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText('https://shareeat.app');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silent fail
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: 'ShareEat - Partage de repas',
        text: shareMessage,
        url: 'https://shareeat.app',
      });
    } catch {
      // user cancelled
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: visible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
        transition: 'background 0.28s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '24px 24px 0 0',
          padding: '28px 24px 40px',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '3px solid #16a34a22',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 30, color: '#16a34a' }}>check_circle</span>
          </div>
        </div>

        <h2 style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
          {title}
        </h2>
        <p style={{ textAlign: 'center', fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
          {subtitle}
        </p>

        {newBadges.length > 0 && (
          <div style={{
            background: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: 16,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Badges débloqués
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {newBadges.map((badge) => (
                <div
                  key={badge.slug}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: badge.bg,
                    border: `1.5px solid ${badge.color}33`,
                    borderRadius: 20, padding: '5px 10px',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{badge.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: badge.color }}>{badge.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', margin: 0 }}>Partager ce moment</p>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleWhatsApp}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#25D366', color: 'white',
              border: 'none', borderRadius: 14, padding: '14px 18px',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
              cursor: 'pointer', width: '100%',
              boxShadow: '0 3px 12px rgba(37,211,102,0.3)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Partager sur WhatsApp
          </button>

          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: copied ? '#f0fdf4' : '#f9fafb',
              color: copied ? '#16a34a' : '#374151',
              border: `1.5px solid ${copied ? '#bbf7d0' : '#e5e7eb'}`,
              borderRadius: 14, padding: '14px 18px',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
              cursor: 'pointer', width: '100%',
              transition: 'all 0.2s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: copied ? '#16a34a' : '#6b7280' }}>
              {copied ? 'check' : 'link'}
            </span>
            {copied ? 'Lien copié !' : 'Copier le lien'}
          </button>

          {hasNativeShare && (
            <button
              onClick={handleNativeShare}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#f9fafb',
                color: '#374151',
                border: '1.5px solid #e5e7eb',
                borderRadius: 14, padding: '14px 18px',
                fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
                cursor: 'pointer', width: '100%',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#6b7280' }}>share</span>
              Partager
            </button>
          )}
        </div>

        <button
          onClick={handleClose}
          style={{
            display: 'block', margin: '20px auto 0',
            background: 'none', border: 'none',
            fontSize: 14, color: '#9ca3af', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Fermer
        </button>
      </div>
    </div>,
    document.body
  );
}
