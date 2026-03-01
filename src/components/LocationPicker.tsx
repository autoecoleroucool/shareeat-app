import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCurrentPosition, reverseGeocode as geocode } from '../lib/geolocation';

interface LocationPickerProps {
  lat: number;
  lng: number;
  name: string;
  onConfirm: (lat: number, lng: number, name: string) => void;
  onClose: () => void;
}

export default function LocationPicker({ lat, lng, name, onConfirm, onClose }: LocationPickerProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [currentLat, setCurrentLat] = useState(lat);
  const [currentLng, setCurrentLng] = useState(lng);
  const [currentName, setCurrentName] = useState(name);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!mapDivRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:36px;height:36px;background:#49e619;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
    markerRef.current = marker;
    mapRef.current = map;

    marker.on('dragend', async () => {
      const pos = marker.getLatLng();
      setCurrentLat(pos.lat);
      setCurrentLng(pos.lng);
      const resolved = await geocode(pos.lat, pos.lng);
      setCurrentName(resolved);
    });

    map.on('click', async (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      setCurrentLat(e.latlng.lat);
      setCurrentLng(e.latlng.lng);
      const resolved = await geocode(e.latlng.lat, e.latlng.lng);
      setCurrentName(resolved);
    });

    return () => {
      map.remove();
    };
  }, []);

  async function handleLocate() {
    setLocating(true);
    const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    if (pos) {
      setCurrentLat(pos.latitude);
      setCurrentLng(pos.longitude);
      mapRef.current?.setView([pos.latitude, pos.longitude], 16);
      markerRef.current?.setLatLng([pos.latitude, pos.longitude]);
      const resolved = await geocode(pos.latitude, pos.longitude);
      setCurrentName(resolved);
    }
    setLocating(false);
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 bg-white">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
        </button>
        <h2 className="flex-1 text-base font-bold text-slate-900">Choisir le lieu de récupération</h2>
      </div>

      <div className="relative flex-1">
        <div ref={mapDivRef} className="w-full h-full" />

        <button
          onClick={handleLocate}
          disabled={locating}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 1000,
            width: 40, height: 40, background: 'white',
            border: 'none', borderRadius: '50%',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {locating ? (
            <span style={{ width: 18, height: 18, border: '2px solid #49e619', borderTopColor: 'transparent', borderRadius: '50%', display: 'block', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#49e619' }}>my_location</span>
          )}
        </button>

        <div style={{
          position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 1000,
          background: 'white', borderRadius: 16, padding: '12px 16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span className="material-symbols-outlined" style={{ color: '#49e619', fontSize: 20 }}>location_on</span>
          <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentName}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 bg-white border-t border-slate-100" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
        <button
          onClick={() => onConfirm(currentLat, currentLng, currentName)}
          className="w-full h-14 bg-[#49e619] hover:bg-[#3acc0f] text-slate-900 font-extrabold text-base rounded-full shadow-lg shadow-[#49e619]/20 active:scale-[0.98] transition-transform"
        >
          Confirmer cet emplacement
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
