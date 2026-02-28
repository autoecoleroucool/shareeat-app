import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications(userId: string | null) {
  const [permission, setPermission] = useState<PushPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PushPermission);
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported || !userId) return;

    async function checkSubscription() {
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          setIsSubscribed(true);
          setPermission('granted');
        }
      } catch {
        // ignore
      }
    }

    checkSubscription();
  }, [isSupported, userId]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !userId || !VAPID_PUBLIC_KEY) return false;
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      setPermission(permission as PushPermission);

      if (permission !== 'granted') {
        setIsLoading(false);
        return false;
      }

      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const subJson = sub.toJSON();
      const endpoint = subJson.endpoint;
      const p256dhBuffer = sub.getKey('p256dh');
      const authBuffer = sub.getKey('auth');
      if (!endpoint || !p256dhBuffer || !authBuffer) {
        setIsLoading(false);
        return false;
      }
      const p256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhBuffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const auth = btoa(String.fromCharCode(...new Uint8Array(authBuffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent.slice(0, 200),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,endpoint' }
        );

      if (error) {
        setIsLoading(false);
        return false;
      }

      setIsSubscribed(true);
      setPermission('granted');
      setIsLoading(false);
      return true;
    } catch {
      setIsLoading(false);
      return false;
    }
  }, [isSupported, userId]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !userId) return false;
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch {
      setIsLoading(false);
      return false;
    }
  }, [isSupported, userId]);

  return { permission, isSubscribed, isLoading, isSupported, subscribe, unsubscribe };
}

export async function sendPushNotification(payload: {
  user_id: string;
  title: string;
  body: string;
  icon?: string;
  image?: string | null;
  tag?: string;
  data?: Record<string, unknown>;
}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // silently fail — notifications are best-effort
  }
}
