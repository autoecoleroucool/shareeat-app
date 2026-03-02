import { useRef, useCallback } from 'react';
import L from 'leaflet';
import { supabase } from '../lib/supabase';

interface MapMeal {
  id: string;
  title: string;
  image_url: string;
  location_lat: number;
  location_lng: number;
  location_name: string;
  slots_total: number;
  slots_taken: number;
  meal_type: string;
  category: string;
  expires_at?: string | null;
  quantity?: string | null;
  host_id?: string | null;
  host_is_trusted_cook?: boolean;
}

interface CacheEntry {
  bounds: L.LatLngBounds;
  meals: MapMeal[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000;
const BOUNDS_CHANGE_THRESHOLD = 0.20;
const MAX_CACHE_ENTRIES = 5;

function boundsArea(b: L.LatLngBounds): number {
  return (b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest());
}

function boundsOverlapRatio(a: L.LatLngBounds, b: L.LatLngBounds): number {
  const latOverlap = Math.max(0, Math.min(a.getNorth(), b.getNorth()) - Math.max(a.getSouth(), b.getSouth()));
  const lngOverlap = Math.max(0, Math.min(a.getEast(), b.getEast()) - Math.max(a.getWest(), b.getWest()));
  const intersection = latOverlap * lngOverlap;
  const areaA = boundsArea(a);
  const areaB = boundsArea(b);
  if (areaA === 0 || areaB === 0) return 0;
  return intersection / Math.max(areaA, areaB);
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useMapBoundsFetch(onMealsLoaded: (meals: MapMeal[]) => void) {
  const cacheRef = useRef<CacheEntry[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBounds = useCallback(async (bounds: L.LatLngBounds) => {
    const now = Date.now();
    const entries = cacheRef.current;

    const validEntry = entries.find(
      (e) => now - e.fetchedAt < CACHE_TTL_MS && boundsOverlapRatio(e.bounds, bounds) > (1 - BOUNDS_CHANGE_THRESHOLD)
    );
    if (validEntry) {
      onMealsLoaded(validEntry.meals);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const padding = 0.5;
    const { data, error } = await supabase
      .from('meals')
      .select('id,title,image_url,location_lat,location_lng,location_name,slots_total,slots_taken,meal_type,category,expires_at,quantity,host_id,claimed,host:profiles!meals_host_id_fkey(shares_count)')
      .gte('location_lat', sw.lat - padding)
      .lte('location_lat', ne.lat + padding)
      .gte('location_lng', sw.lng - padding)
      .lte('location_lng', ne.lng + padding)
      .or('claimed.eq.false,claimed.is.null')
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .neq('meal_type', 'culinary_circle');

    if (error) return;

    type RawMeal = MapMeal & { host?: { shares_count?: number } | null };
    const meals: MapMeal[] = ((data as RawMeal[]) ?? [])
      .filter((m) => m.slots_taken < m.slots_total)
      .map((m) => ({
        ...m,
        location_lat: parseFloat(String(m.location_lat)),
        location_lng: parseFloat(String(m.location_lng)),
        host_is_trusted_cook: (m.host?.shares_count ?? 0) >= 10,
      }))
      .filter((m) => !isNaN(m.location_lat) && !isNaN(m.location_lng));

    const newEntry: CacheEntry = { bounds, meals, fetchedAt: Date.now() };
    cacheRef.current = [newEntry, ...cacheRef.current].slice(0, MAX_CACHE_ENTRIES);
    onMealsLoaded(meals);
  }, [onMealsLoaded]);

  const scheduleFetch = useCallback((bounds: L.LatLngBounds, delay = 350) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchBounds(bounds);
    }, delay);
  }, [fetchBounds]);

  const invalidateCache = useCallback(() => {
    cacheRef.current = [];
  }, []);

  return { scheduleFetch, invalidateCache };
}
