import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('/storage/v1/object/');
}

export function resizeImage(url: string | null | undefined, width: number, height: number): string | null {
  if (!url) return null;
  if (!isSupabaseStorageUrl(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}&height=${height}&resize=cover&quality=80`;
}

export function resizeAvatar(url: string | null | undefined, size = 80): string | null {
  return resizeImage(url, size, size);
}

export function resizeMealImage(url: string | null | undefined): string | null {
  return resizeImage(url, 600, 400);
}
