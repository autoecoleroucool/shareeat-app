import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Screen, Meal, CulinaryChallenge } from '../types';
import { supabase } from '../lib/supabase';
import { getCurrentPosition } from '../lib/geolocation';
import { CATEGORY_CONFIG, getMealCategory as getCategory, formatExpiry, isExpiringSoon } from '../lib/mealUtils';
import BottomNav from '../components/BottomNav';
import BookingModal from '../components/BookingModal';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullIndicator from '../components/PullIndicator';
import { useMapBoundsFetch } from '../hooks/useMapBoundsFetch';

interface MapScreenProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  unreadBookings?: number;
  onNavigateToChallenges?: () => void;
}

type CategoryFilter = 'all' | 'food_rescue' | 'homemade_meal' | 'culinary_circle';

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

const PARIS: [number, number] = [48.856, 2.347];
const BOTTOM_NAV_HEIGHT = 90;

function makePinIcon(category: 'food_rescue' | 'homemade_meal' | 'culinary_circle', selected: boolean, isTrustedCook = false) {
  const s = selected ? 52 : 42;

  const { color, emoji } = CATEGORY_CONFIG[category];
  const borderColor = isTrustedCook ? '#fbbf24' : 'white';
  const badgeHtml = isTrustedCook
    ? `<div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#fbbf24;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:7px;z-index:1;">★</div>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${s}px;height:${s}px;">
      ${badgeHtml}
      <div style="
        width:${s}px;height:${s}px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${color};
        border:3px solid ${borderColor};
        box-shadow:0 4px 14px ${color}88;
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="transform:rotate(45deg);font-size:${selected ? 21 : 17}px;line-height:1;">${emoji}</span>
      </div>
    </div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s],
    popupAnchor: [0, -s],
  });
}

function makeUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:#2563eb;border:3px solid white;
        box-shadow:0 0 0 6px rgba(37,99,235,0.2);
      "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const pinIconCache = new Map<string, L.DivIcon>();

function getCachedPinIcon(category: 'food_rescue' | 'homemade_meal' | 'culinary_circle', selected: boolean, isTrustedCook = false): L.DivIcon {
  const key = `${category}-${selected}-${isTrustedCook}`;
  if (!pinIconCache.has(key)) {
    pinIconCache.set(key, makePinIcon(category, selected, isTrustedCook));
  }
  return pinIconCache.get(key)!;
}

export default function MapScreen({ activeScreen, onNavigate, unreadBookings = 0, onNavigateToChallenges }: MapScreenProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const mountedRef = useRef(true);
  const mapInitializedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [meals, setMeals] = useState<MapMeal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [locating, setLocating] = useState(false);
  const [bookingMeal, setBookingMeal] = useState<Meal | null>(null);
  const [bookingHost, setBookingHost] = useState<{ name: string; avatar: string } | null>(null);
  const [bookingTiming, setBookingTiming] = useState<{ day: string; time: string }>({ day: '', time: '' });
  const [userKarma, setUserKarma] = useState(0);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [blockedHostIds, setBlockedHostIds] = useState<Set<string>>(new Set());
  const [challenges, setChallenges] = useState<CulinaryChallenge[]>([]);

  const fetchChallenges = useCallback(async () => {
    const { data } = await supabase
      .from('culinary_challenges')
      .select('*, creator:creator_id(id, name, avatar_url, shares_count)')
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10);
    if (!data || data.length === 0) { setChallenges([]); return; }
    const ids = (data as CulinaryChallenge[]).map((c) => c.id);
    const { data: membersData } = await supabase
      .from('culinary_challenge_members')
      .select('challenge_id')
      .in('challenge_id', ids)
      .eq('status', 'accepted');
    const countMap: Record<string, number> = {};
    (membersData ?? []).forEach((m: { challenge_id: string }) => {
      countMap[m.challenge_id] = (countMap[m.challenge_id] ?? 0) + 1;
    });
    setChallenges((data as CulinaryChallenge[]).map((c) => ({ ...c, member_count: countMap[c.id] ?? 0 })));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
      if (user?.id) {
        const { data } = await supabase
          .from('blocked_users')
          .select('blocked_id')
          .eq('blocker_id', user.id);
        if (data) setBlockedHostIds(new Set(data.map((b: { blocked_id: string }) => b.blocked_id)));
      }
    });
  }, []);

  const handleMealsLoaded = useCallback((newMeals: MapMeal[]) => {
    if (!mountedRef.current) return;
    setMeals(newMeals);
  }, []);

  const { scheduleFetch, invalidateCache } = useMapBoundsFetch(handleMealsLoaded);

  const triggerFetchForCurrentBounds = useCallback((immediate = false) => {
    const map = mapRef.current;
    if (!map) return;
    scheduleFetch(map.getBounds(), immediate ? 0 : 350);
  }, [scheduleFetch]);

  const { containerRef: mapPullRef, indicatorRef: mapIndicatorRef } = usePullToRefresh(async () => {
    invalidateCache();
    triggerFetchForCurrentBounds(true);
  });

  useEffect(() => {
    if (!mapDivRef.current || mapInitializedRef.current) return;
    mapInitializedRef.current = true;

    const initMap = (startCenter: [number, number]) => {
      if (!mapDivRef.current) return;

      const map = L.map(mapDivRef.current, {
        center: startCenter,
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      map.on('click', () => setSelectedId(null));

      map.on('moveend', () => {
        scheduleFetch(map.getBounds(), 350);
      });

      map.on('zoomend', () => {
        scheduleFetch(map.getBounds(), 350);
      });

      mapRef.current = map;
      scheduleFetch(map.getBounds(), 0);
    };

    getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 }).then((pos) => {
      if (pos) {
        initMap([pos.latitude, pos.longitude]);
      } else {
        initMap(PARIS);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      mapInitializedRef.current = false;
    };
  }, [scheduleFetch]);

  useEffect(() => {
    if (activeScreen !== 'map') return;
    if (mapRef.current) mapRef.current.invalidateSize();
    triggerFetchForCurrentBounds(true);
    fetchChallenges();

    const mealSub = supabase
      .channel('map-meals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, () => {
        invalidateCache();
        triggerFetchForCurrentBounds(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(mealSub); };
  }, [activeScreen, triggerFetchForCurrentBounds, invalidateCache, fetchChallenges]);

  const filteredMeals = useMemo(() => meals.filter((m) => {
    if (m.host_id && blockedHostIds.has(m.host_id)) return false;
    if (categoryFilter !== 'all' && getCategory(m) !== categoryFilter) return false;
    return true;
  }), [meals, blockedHostIds, categoryFilter]);

  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const filteredIds = new Set(filteredMeals.map((m) => m.id));

    markerMapRef.current.forEach((marker, id) => {
      if (!filteredIds.has(id)) {
        marker.remove();
        markerMapRef.current.delete(id);
      }
    });

    filteredMeals.forEach((meal) => {
      const cat = getCategory(meal);
      const isSelected = meal.id === selectedId;
      const isTrusted = meal.host_is_trusted_cook ?? false;
      const existing = markerMapRef.current.get(meal.id);

      if (existing) {
        existing.setIcon(getCachedPinIcon(cat, isSelected, isTrusted));
        existing.setZIndexOffset(isSelected ? 1000 : isTrusted ? 500 : 0);
      } else {
        const marker = L.marker([meal.location_lat, meal.location_lng], {
          icon: getCachedPinIcon(cat, isSelected, isTrusted),
          zIndexOffset: isSelected ? 1000 : isTrusted ? 500 : 0,
        }).addTo(map);

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedId(meal.id);
          map.panTo([meal.location_lat, meal.location_lng]);
        });

        markerMapRef.current.set(meal.id, marker);
      }
    });

    markersRef.current = Array.from(markerMapRef.current.values());
  }, [filteredMeals, selectedId]);

  const handleJoin = async () => {
    const selected = meals.find((m) => m.id === selectedId) ?? null;
    if (!selected) return;

    setLoadingBooking(true);

    const { data: { user } } = await supabase.auth.getUser();

    const [mealResult, profileResult] = await Promise.all([
      supabase
        .from('meals')
        .select('*, host:profiles!meals_host_id_fkey(id,name,avatar_url)')
        .eq('id', selected.id)
        .maybeSingle(),
      user
        ? supabase.from('profiles').select('karma_balance').eq('id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (!mountedRef.current) return;

    const mealData = mealResult.data;
    const karma = (profileResult.data as { karma_balance?: number } | null)?.karma_balance ?? 0;

    if (mealData) {
      const meal = mealData as Meal & { host?: { name?: string; avatar_url?: string } | null; meal_date?: string };
      const hostProfile = meal.host ?? null;
      setBookingMeal(meal as unknown as Meal);
      setBookingHost({
        name: hostProfile?.name ?? 'Hôte',
        avatar: hostProfile?.avatar_url ?? 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg',
      });
      const d = meal.meal_date ? new Date(meal.meal_date) : new Date();
      setBookingTiming({
        day: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      });
      setUserKarma(karma ?? 0);
    }

    setLoadingBooking(false);
  };

  const handleLocate = () => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setLocating(false);
        const map = mapRef.current;
        if (!map) return;
        map.setView(coords, 15);
        if (!userMarkerRef.current) {
          userMarkerRef.current = L.marker(coords, { icon: makeUserIcon() }).addTo(map);
        } else {
          userMarkerRef.current.setLatLng(coords);
        }
      },
      () => setLocating(false)
    );
  };

  const selected = meals.find((m) => m.id === selectedId) ?? null;
  const selectedCategory = selected ? getCategory(selected) : null;

  const isFoodRescue = selectedCategory === 'food_rescue';
  const isCulinaryCircle = selectedCategory === 'culinary_circle';

  const FILTERS: { key: CategoryFilter; label: string; color: string; gradient?: string }[] = [
    { key: 'all', label: 'Tout', color: '#374151' },
    { key: 'homemade_meal', label: '🍽️ Repas maison', color: '#f97316' },
    { key: 'food_rescue', label: '♻️ Anti-gaspi', color: '#16a34a' },
    { key: 'culinary_circle', label: '🏆 Cercle', color: '#b91c1c', gradient: 'linear-gradient(135deg,#b91c1c,#7f1d1d)' },
  ];

  return (
    <div ref={(el) => { mapPullRef.current = el; }} className="h-app" style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#e8e0d8' }}>
      <PullIndicator ref={mapIndicatorRef} />
      <div
        ref={mapDivRef}
        style={{ position: 'absolute', inset: 0, bottom: BOTTOM_NAV_HEIGHT, zIndex: 1, touchAction: 'none', overscrollBehavior: 'none' }}
      />

      <div style={{
        position: 'absolute', top: 'calc(var(--sat, 0px) + 16px)', left: 12, right: 12, zIndex: 1000,
        display: 'flex', gap: 10,
      }}>
        <button
          onClick={() => onNavigate('create')}
          style={{
            flex: 1, background: '#16a34a', color: 'white',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            border: 'none', borderRadius: 30, padding: '13px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            boxShadow: '0 4px 16px rgba(22,163,74,0.38)', cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          <span style={{ fontSize: 17 }}>+</span> Partager
        </button>
        <button
          onClick={() => onNavigateToChallenges ? onNavigateToChallenges() : onNavigate('culinary')}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg,#b91c1c,#7f1d1d)',
            color: 'white',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            border: '2px solid #fecaca',
            borderRadius: 30, padding: '11px 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            boxShadow: '0 4px 16px rgba(185,28,28,0.45)',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            transition: 'all 0.2s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>emoji_events</span>
          Défis
        </button>
      </div>

      <div style={{
        position: 'absolute',
        top: 'calc(var(--sat, 0px) + 76px)',
        left: 12, right: 12, zIndex: 1000,
        display: 'flex', gap: 7,
      }}>
        {FILTERS.map((f) => {
          const isActive = categoryFilter === f.key;
          const activeBg = f.gradient && isActive ? f.gradient : isActive ? f.color : 'rgba(255,255,255,0.92)';
          return (
            <button
              key={f.key}
              onClick={() => {
                setCategoryFilter(f.key);
                if (selected) {
                  const isVisible = f.key === 'all' || getCategory(selected) === f.key;
                  if (!isVisible) setSelectedId(null);
                }
              }}
              style={{
                flex: 1,
                fontFamily: 'inherit', fontWeight: 700, fontSize: 11,
                border: isActive ? `2px solid ${f.color}` : '2px solid transparent',
                borderRadius: 20, padding: '7px 6px',
                background: activeBg,
                color: isActive ? 'white' : f.color,
                cursor: 'pointer',
                boxShadow: isActive && f.gradient ? '0 2px 10px rgba(146,64,14,0.4)' : '0 2px 8px rgba(0,0,0,0.12)',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>


      <button
        onClick={handleLocate}
        disabled={locating}
        title="Ma position"
        style={{
          position: 'absolute', top: 'calc(var(--sat, 0px) + 118px)', left: 12, zIndex: 1000,
          width: 40, height: 40, background: 'white',
          border: 'none', borderRadius: '50%',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: locating ? 0.6 : 1,
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}
      >
        {locating
          ? <span style={{ width: 17, height: 17, border: '2px solid #16a34a', borderTopColor: 'transparent', borderRadius: '50%', display: 'block', animation: 'spin .7s linear infinite' }} />
          : <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#16a34a' }}>my_location</span>
        }
      </button>

      <div style={{
        position: 'absolute',
        bottom: BOTTOM_NAV_HEIGHT + (selected ? 148 : 12),
        left: 12, zIndex: 20,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: 14, padding: '10px 14px',
        boxShadow: '0 2px 14px rgba(0,0,0,0.13)',
        transition: 'bottom 0.25s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: '#4b5563', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Légende
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {(Object.entries(CATEGORY_CONFIG) as [keyof typeof CATEGORY_CONFIG, typeof CATEGORY_CONFIG[keyof typeof CATEGORY_CONFIG]][]).map(([cat, cfg]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, display: 'block', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{
          position: 'absolute', bottom: BOTTOM_NAV_HEIGHT + 8,
          left: 12, right: 12, zIndex: 25,
          background: 'white', borderRadius: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: '14px', display: 'flex', gap: 12, alignItems: 'center',
          animation: 'cardUp .22s cubic-bezier(0.32,0.72,0,1) forwards',
          borderLeft: `4px solid ${CATEGORY_CONFIG[getCategory(selected)].color}`,
        }}>
          <button
            onClick={() => setSelectedId(null)}
            style={{
              position: 'absolute', top: 10, right: 10,
              background: '#f3f4f6', border: 'none', borderRadius: '50%',
              width: 26, height: 26, cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#6b7280' }}>close</span>
          </button>

          {isFoodRescue ? (
            <div style={{
              width: 68, height: 68, borderRadius: 13, flexShrink: 0,
              background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #bbf7d0',
            }}>
              <span style={{ fontSize: 30 }}>♻️</span>
            </div>
          ) : isCulinaryCircle ? (
            <div style={{
              width: 68, height: 68, borderRadius: 13, flexShrink: 0,
              background: 'linear-gradient(135deg,#fef2f2,#fecaca)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fecaca',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 34, color: '#b91c1c', fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            </div>
          ) : (
            <div style={{ width: 68, height: 68, borderRadius: 13, overflow: 'hidden', flexShrink: 0 }}>
              <img src={selected.image_url} alt={selected.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />
            </div>
          )}

          <div style={{ flex: 1, overflow: 'hidden', paddingRight: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 9, fontWeight: 800, color: 'white',
                background: CATEGORY_CONFIG[getCategory(selected)].color,
                borderRadius: 20, padding: '2px 8px',
                textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
              }}>
                {CATEGORY_CONFIG[getCategory(selected)].label}
              </span>
              {isFoodRescue && selected.expires_at && isExpiringSoon(selected.expires_at) && (
                <span style={{
                  fontSize: 9, fontWeight: 800, color: '#dc2626',
                  background: '#fef2f2', borderRadius: 20, padding: '2px 8px',
                  border: '1px solid #fca5a5', flexShrink: 0,
                }}>
                  Expire bientôt
                </span>
              )}
            </div>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.title}
            </p>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
              {selected.location_name}
            </p>
            {isFoodRescue && selected.expires_at && (
              <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, margin: 0 }}>
                {formatExpiry(selected.expires_at)}
              </p>
            )}
            {!isFoodRescue && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                {selected.slots_total - selected.slots_taken} place{selected.slots_total - selected.slots_taken !== 1 ? 's' : ''} libre{selected.slots_total - selected.slots_taken !== 1 ? 's' : ''}
              </span>
            )}
            {isFoodRescue && selected.quantity && (
              <p style={{ fontSize: 11, color: '#374151', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected.quantity}
              </p>
            )}
          </div>

          {isCulinaryCircle ? (
            <button
              onClick={() => onNavigateToChallenges ? onNavigateToChallenges() : onNavigate('culinary')}
              style={{
                background: 'linear-gradient(135deg,#b91c1c,#7f1d1d)', color: 'white',
                border: 'none', borderRadius: 26,
                padding: '10px 15px', fontWeight: 700, fontSize: 13,
                cursor: 'pointer', flexShrink: 0,
                boxShadow: '0 3px 12px rgba(185,28,28,0.4)',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>emoji_events</span>
              Voir
            </button>
          ) : (() => {
            const isOwner = currentUserId != null && selected.host_id === currentUserId;
            const disabled = loadingBooking || isOwner;
            const bg = isOwner ? '#94a3b8' : CATEGORY_CONFIG[getCategory(selected)].color;
            const label = isOwner ? 'Mon annonce' : isFoodRescue ? 'Récupérer' : 'Rejoindre';
            return (
              <button
                onClick={isOwner ? undefined : handleJoin}
                disabled={disabled}
                style={{
                  background: bg, color: 'white',
                  border: 'none', borderRadius: 26,
                  padding: '10px 15px', fontWeight: 700, fontSize: 13,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  boxShadow: disabled ? 'none' : `0 3px 12px ${bg}55`,
                  fontFamily: 'inherit',
                  opacity: loadingBooking ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {loadingBooking
                  ? <span style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'block', animation: 'spin .7s linear infinite' }} />
                  : label
                }
              </button>
            );
          })()}
        </div>
      )}

      {categoryFilter === 'culinary_circle' && challenges.length > 0 && !selected && (
        <div style={{
          position: 'absolute',
          bottom: BOTTOM_NAV_HEIGHT + 8,
          left: 0, right: 0, zIndex: 24,
          padding: '0 12px',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(12px)',
            borderRadius: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            padding: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg,#b91c1c,#7f1d1d)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'white' }}>emoji_events</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1c1917' }}>Défis culinaires</span>
              </div>
              <button
                onClick={() => onNavigateToChallenges ? onNavigateToChallenges() : onNavigate('culinary')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 12, fontWeight: 700, color: '#b91c1c', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 2,
                }}
              >
                Voir tous
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
              {challenges.map((c) => {
                const statusColor = c.status === 'open' ? '#16a34a' : '#b91c1c';
                const statusLabel = c.status === 'open' ? 'Ouvert' : 'En cours';
                const spotsLeft = c.max_members - (c.member_count ?? 0);
                return (
                  <button
                    key={c.id}
                    onClick={() => onNavigateToChallenges ? onNavigateToChallenges() : onNavigate('culinary')}
                    style={{
                      flexShrink: 0, width: 180,
                      background: 'linear-gradient(145deg,#fff5f5,#fef2f2)',
                      border: '1.5px solid #fecaca',
                      borderRadius: 14, padding: '10px 12px',
                      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: 'white',
                        background: statusColor, borderRadius: 20, padding: '2px 7px',
                      }}>{statusLabel}</span>
                      <span style={{ fontSize: 9, color: '#7f1d1d', fontWeight: 600 }}>
                        {c.member_count ?? 0}/{c.max_members}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 800, color: '#1c1917', margin: '0 0 6px', lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                    }}>{c.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {c.creator?.avatar_url && (
                        <img src={c.creator.avatar_url} alt={c.creator.name} loading="lazy" decoding="async" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                      )}
                      <span style={{ fontSize: 10, color: '#7f1d1d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.creator?.name}</span>
                    </div>
                    {spotsLeft > 0 && c.status === 'open' && (
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #fecaca' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#b91c1c' }}>
                          {spotsLeft} place{spotsLeft > 1 ? 's' : ''} libre{spotsLeft > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        zIndex: 30,
        background: 'white', borderTop: '1px solid #f1f5f9',
      }}>
        <BottomNav active={activeScreen} onChange={onNavigate} unreadBookings={unreadBookings} />
      </div>

      {bookingMeal && bookingHost && (
        <BookingModal
          meal={bookingMeal}
          hostName={bookingHost.name}
          hostAvatar={bookingHost.avatar}
          timing={bookingTiming}
          userKarma={userKarma}
          onClose={() => setBookingMeal(null)}
          onBooked={(mealId) => {
            setMeals((prev) => {
              const updated = prev.map((m) => m.id === mealId ? { ...m, slots_taken: m.slots_taken + 1 } : m);
              return updated.filter((m) => {
                if (m.id !== mealId) return true;
                const newSlotsTaken = m.slots_taken;
                return getCategory(m) !== 'food_rescue' && newSlotsTaken < m.slots_total;
              });
            });
            setSelectedId(null);
            setBookingMeal(null);
          }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes cardUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .leaflet-bottom.leaflet-right { bottom: 6px !important; right: 6px !important; }
        .leaflet-control-zoom { border-radius: 10px !important; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.15) !important; border: none !important; }
        .leaflet-control-zoom a { color: #374151 !important; }
        .leaflet-control-attribution { font-size: 9px !important; background: rgba(255,255,255,0.7) !important; backdrop-filter: blur(4px); }
      `}</style>
    </div>
  );
}
