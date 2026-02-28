import { useState, useEffect, useRef } from 'react';
import { Screen } from '../types';
import { supabase } from '../lib/supabase';
import LocationPicker from '../components/LocationPicker';

interface EditMealData {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  category: 'food_rescue' | 'homemade_meal';
  slots_total: number;
  allergens: string[];
  meal_date: string | null;
  expires_at: string | null;
  quantity: string | null;
  location_lat: number;
  location_lng: number;
  location_name: string;
}

interface CreateMealScreenProps {
  onNavigate: (screen: Screen) => void;
  editMeal?: EditMealData | null;
}

const DIET_TAGS: { label: string; icon: string }[] = [
  { label: 'Végétarien', icon: '🥦' },
  { label: 'Vegan', icon: '🌱' },
  { label: 'Sans gluten', icon: '🌾' },
  { label: 'Sans lactose', icon: '🥛' },
  { label: 'Sans noix', icon: '🥜' },
  { label: 'Sans porc', icon: '🐷' },
  { label: 'Halal', icon: '☪' },
  { label: 'Casher', icon: '✡' },
  { label: 'Sans œuf', icon: '🥚' },
  { label: 'Sans soja', icon: '🫘' },
  { label: 'Sans fruits de mer', icon: '🦐' },
  { label: 'Sans arachide', icon: '🥜' },
  { label: 'Épicé', icon: '🌶' },
  { label: 'Cru', icon: '🥗' },
  { label: 'Faible en sel', icon: '🧂' },
  { label: 'Sans sucre ajouté', icon: '🍬' },
];

type ListingMode = 'food_rescue' | 'meal_standard';

function toLocalDatetimeValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateMealScreen({ onNavigate, editMeal }: CreateMealScreenProps) {
  const isEditing = !!editMeal;

  const [listingMode, setListingMode] = useState<ListingMode>(
    editMeal ? (editMeal.category === 'food_rescue' ? 'food_rescue' : 'meal_standard') : 'meal_standard'
  );
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    editMeal ? new Set(editMeal.allergens) : new Set()
  );
  const [participants, setParticipants] = useState(editMeal?.slots_total ?? 1);
  const [title, setTitle] = useState(editMeal?.title ?? '');
  const [description, setDescription] = useState(editMeal?.description ?? '');
  const [quantity, setQuantity] = useState(editMeal?.quantity ?? '');
  const [imagePreview, setImagePreview] = useState(editMeal?.image_url ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [mealDate, setMealDate] = useState(toLocalDatetimeValue(editMeal?.meal_date));
  const [expiresAt, setExpiresAt] = useState(toLocalDatetimeValue(editMeal?.expires_at));
  const [locationLat, setLocationLat] = useState(editMeal?.location_lat ?? 48.8566);
  const [locationLng, setLocationLng] = useState(editMeal?.location_lng ?? 2.3522);
  const [locationName, setLocationName] = useState(editMeal?.location_name ?? 'Paris, France');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [safetyConfirmed, setSafetyConfirmed] = useState(isEditing);
  const [draftSaved, setDraftSaved] = useState(false);
  const imagePreviewRef = useRef<string>('');
  const DRAFT_KEY = 'shareeat_meal_draft';

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('is_premium').eq('id', user.id).maybeSingle().then(({ data }) => {
        if (data?.is_premium) setIsPremium(true);
      });
    });
  }, []);

  useEffect(() => {
    if (isEditing) return;
    if (!navigator.geolocation) return;
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocationLat(latitude);
        setLocationLng(longitude);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'fr' } }
          );
          const data = await res.json();
          const addr = data.address;
          if (addr) {
            const parts = [
              addr.road || addr.pedestrian || addr.footway,
              addr.city || addr.town || addr.village || addr.municipality,
            ].filter(Boolean);
            if (parts.length) setLocationName(parts.join(', '));
          }
        } catch {
          // keep default
        } finally {
          setGeolocating(false);
        }
      },
      () => setGeolocating(false),
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.listingMode) setListingMode(draft.listingMode);
        if (draft.quantity) setQuantity(draft.quantity);
        if (draft.mealDate) setMealDate(draft.mealDate);
        if (draft.expiresAt) setExpiresAt(draft.expiresAt);
        if (draft.participants) setParticipants(draft.participants);
        if (draft.selectedTags) setSelectedTags(new Set(draft.selectedTags));
      }
    } catch { /* ignore */ }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) return;
    const timeout = setTimeout(() => {
      const draft = {
        title, description, listingMode, quantity, mealDate, expiresAt, participants,
        selectedTags: Array.from(selectedTags),
      };
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [title, description, listingMode, quantity, mealDate, expiresAt, participants, selectedTags, isEditing]);

  useEffect(() => {
    return () => {
      if (imagePreviewRef.current) {
        URL.revokeObjectURL(imagePreviewRef.current);
      }
    };
  }, []);

  function validateField(name: string, value: string) {
    let msg = '';
    if (name === 'title' && !value.trim()) {
      msg = isFoodRescue ? 'Ajoute un titre pour tes aliments.' : 'Ajoute un titre pour ton repas.';
    }
    if (name === 'expiresAt' && isFoodRescue) {
      if (!value) msg = "Indique une date d'expiration.";
    }
    if (name === 'mealDate' && !isFoodRescue) {
      if (!value) msg = 'Choisis une date et une heure.';
    }
    setFieldErrors((prev) => ({ ...prev, [name]: msg }));
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file);
      setImageFile(compressed);
      if (imagePreviewRef.current) {
        URL.revokeObjectURL(imagePreviewRef.current);
      }
      const url = URL.createObjectURL(compressed);
      imagePreviewRef.current = url;
      setImagePreview(url);
    }
  }

  async function handlePublish() {
    setError('');

    if (!safetyConfirmed) {
      setError('Tu dois confirmer que les aliments partagés sont propres à la consommation.');
      return;
    }

    if (!title.trim()) {
      setError(listingMode === 'food_rescue' ? 'Ajoute un titre pour tes aliments.' : 'Ajoute un titre pour ton repas.');
      return;
    }
    if (listingMode === 'food_rescue' && !expiresAt) {
      setError('Indique une date d\'expiration pour tes aliments.');
      return;
    }
    if (listingMode !== 'food_rescue' && !mealDate) {
      setError('Choisis une date et une heure.');
      return;
    }
    setPublishing(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Tu dois être connecté pour publier une annonce.');
      setPublishing(false);
      return;
    }

    const isFR = listingMode === 'food_rescue';

    let uploadedImageUrl = editMeal?.image_url ?? '';
    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('meal-images')
        .upload(path, imageFile, { upsert: true });
      if (uploadError) {
        setError('Erreur lors du téléchargement de la photo. Réessaie.');
        setPublishing(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('meal-images').getPublicUrl(path);
      uploadedImageUrl = urlData.publicUrl;
    }

    if (isEditing && editMeal) {
      const { error: updateError } = await supabase.from('meals').update({
        title: title.trim(),
        description: description.trim(),
        image_url: uploadedImageUrl || editMeal.image_url || '',
        slots_total: isFR ? 1 : participants,
        location_lat: locationLat,
        location_lng: locationLng,
        location_name: locationName,
        allergens: Array.from(selectedTags),
        meal_date: isFR ? (editMeal.meal_date ?? new Date().toISOString()) : new Date(mealDate).toISOString(),
        expires_at: isFR && expiresAt ? new Date(expiresAt).toISOString() : null,
        quantity: isFR ? quantity.trim() : null,
      }).eq('id', editMeal.id).eq('host_id', user.id);

      setPublishing(false);

      if (updateError) {
        setError(updateError.message || 'Une erreur est survenue. Réessaie.');
        return;
      }

      setSuccess(true);
      setTimeout(() => { onNavigate('profile'); }, 1500);
      return;
    }

    const { error: insertError } = await supabase.from('meals').insert({
      title: title.trim(),
      description: description.trim(),
      image_url: uploadedImageUrl,
      host_id: user.id,
      slots_total: isFR ? 1 : participants,
      slots_taken: 0,
      confirmed: false,
      location_lat: locationLat,
      location_lng: locationLng,
      location_name: locationName,
      allergens: Array.from(selectedTags),
      meal_date: isFR ? new Date().toISOString() : new Date(mealDate).toISOString(),
      price: 0,
      is_premium_meal: false,
      meal_type: 'standard',
      category: isFR ? 'food_rescue' : 'homemade_meal',
      expires_at: isFR && expiresAt ? new Date(expiresAt).toISOString() : null,
      quantity: isFR ? quantity.trim() : null,
    });

    setPublishing(false);

    if (insertError) {
      if (insertError.code === '42501' || insertError.message?.includes('row-level security')) {
        setError('Tu dois être connecté pour publier une annonce.');
      } else {
        setError(insertError.message || 'Une erreur est survenue. Réessaie.');
      }
      return;
    }

    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setSuccess(true);
    setTimeout(() => {
      onNavigate('explore');
    }, 1500);
  }

  const isFoodRescue = listingMode === 'food_rescue';

  if (success) {
    return (
      <div className="flex flex-col h-[100dvh] bg-white items-center justify-center gap-4 font-display">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-[#16a34a] text-[40px]">{isEditing ? 'check_circle' : (listingMode === 'food_rescue' ? 'recycling' : 'check_circle')}</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          {isEditing ? 'Annonce modifiée !' : (listingMode === 'food_rescue' ? 'Annonce publiée !' : 'Repas publié !')}
        </h2>
        <p className="text-slate-500 text-sm">Redirection en cours...</p>
      </div>
    );
  }

  const accentColor = '#16a34a';

  const TABS: { key: ListingMode; label: string; icon: string; color: string }[] = [
    { key: 'meal_standard', label: 'Repas maison', icon: 'restaurant', color: '#16a34a' },
    { key: 'food_rescue', label: 'Anti-gaspi', icon: 'recycling', color: '#16a34a' },
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-white font-display overflow-x-hidden">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md px-6 pb-4 flex items-center justify-between border-b border-slate-50" style={{ paddingTop: 'calc(env(safe-area-inset-top, 44px) + 12px)' }}>
        <button
          onClick={() => onNavigate(isEditing ? 'profile' : 'explore')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-900"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight">
          {isEditing ? 'Modifier l\'annonce' : 'Partager'}
        </h1>
        {!isEditing && draftSaved !== undefined && (
          <span className="text-[10px] text-slate-400 font-medium">Brouillon sauvegardé</span>
        )}
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar pb-32" style={{ touchAction: 'pan-y' }}>

        <section className="px-6 pt-5">
          {!isEditing && (
            <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setListingMode(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    listingMode === tab.key
                      ? 'bg-white shadow-sm text-slate-900'
                      : 'text-slate-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {isEditing && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-2">
              <span className="material-symbols-outlined text-slate-500 text-[20px]">edit_note</span>
              <div>
                <p className="text-sm font-bold text-slate-800">Mode modification</p>
                <p className="text-xs text-slate-400 mt-0.5">Tu modifies une annonce existante</p>
              </div>
            </div>
          )}

          {isFoodRescue && !isEditing && (
            <div className="mt-3 flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl p-4">
              <span className="material-symbols-outlined text-[#16a34a] text-[20px] flex-shrink-0 mt-0.5">recycling</span>
              <div>
                <p className="text-xs font-bold text-green-900">Sauver des aliments</p>
                <p className="text-[11px] text-green-700 mt-0.5 leading-relaxed">
                  Tu as des aliments qui vont bientôt expirer ? Publie-les gratuitement. Tes voisins peuvent venir les récupérer avant qu'ils soient perdus.
                </p>
              </div>
            </div>
          )}

          {!isFoodRescue && listingMode === 'meal_standard' && !isEditing && (
            <div className="mt-3 flex items-start gap-3 bg-green-50 border border-green-100 rounded-2xl p-4">
              <span className="material-symbols-outlined text-[#16a34a] text-[20px] flex-shrink-0 mt-0.5">volunteer_activism</span>
              <div>
                <p className="text-xs font-bold text-slate-800">Repas maison partagé</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Tu cuisines pour trop de monde ? Partage ton repas avec tes voisins. Celui qui mange doit à son tour partager un repas.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="px-6 mt-6">
          <label className="relative block w-full aspect-video rounded-2xl overflow-hidden cursor-pointer group">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-100 border-2 border-dashed border-slate-300 group-hover:border-[#16a34a] transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 group-hover:text-[#16a34a]">
                <span className="material-symbols-outlined text-5xl">add_a_photo</span>
                <p className="font-medium text-sm">
                  {isFoodRescue ? 'Ajoute une photo (optionnel)' : 'Ajoute une photo de ton plat'}
                </p>
                {isFoodRescue && (
                  <p className="text-[11px] text-slate-400 group-hover:text-[#16a34a]/70 px-8 text-center leading-relaxed">
                    Montre l'état réel des aliments pour inspirer confiance
                  </p>
                )}
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            {imagePreview && (
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-4xl">edit</span>
              </div>
            )}
          </label>
        </section>

        <section className="px-6 mt-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 ml-1">
              {isFoodRescue ? 'Que veux-tu sauver ?' : 'Qu\'est-ce que tu cuisines ?'}
            </label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (fieldErrors.title) validateField('title', e.target.value); }}
              onBlur={(e) => validateField('title', e.target.value)}
              className={`w-full h-14 px-6 rounded-full border bg-slate-50 outline-none transition-all text-slate-900 placeholder:text-slate-400 ${fieldErrors.title ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
              placeholder={isFoodRescue ? 'Ex: Légumes du marché, Baguettes, Yaourts...' : 'Ex: Lasagnes maison, Ratatouille...'}
            />
            {fieldErrors.title && (
              <p className="text-xs text-red-500 ml-2 mt-1">{fieldErrors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 ml-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[90px] p-5 rounded-2xl border border-slate-200 bg-slate-50 outline-none transition-all text-slate-900 placeholder:text-slate-400 resize-none"
              placeholder={isFoodRescue ? 'Précise l\'état, la quantité approximative...' : 'Décris les ingrédients, les saveurs, l\'histoire du plat...'}
            />
          </div>

          {isFoodRescue && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 ml-1">Quantité</label>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full h-14 px-6 rounded-full border border-slate-200 bg-slate-50 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                placeholder="Ex: 2 kg de courgettes, 6 baguettes..."
              />
            </div>
          )}

          {isFoodRescue && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 ml-1">
                Date d'expiration
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => { setExpiresAt(e.target.value); if (fieldErrors.expiresAt) validateField('expiresAt', e.target.value); }}
                onBlur={(e) => validateField('expiresAt', e.target.value)}
                className={`w-full h-14 px-6 rounded-full border bg-slate-50 outline-none transition-all text-slate-900 ${fieldErrors.expiresAt ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
              />
              {fieldErrors.expiresAt && (
                <p className="text-xs text-red-500 ml-2">{fieldErrors.expiresAt}</p>
              )}
              <p className="text-xs text-slate-400 ml-2">Ton annonce sera retirée automatiquement après cette date.</p>
            </div>
          )}

          {!isFoodRescue && (
            <div className="space-y-3">
              <div className="flex items-center justify-between ml-1">
                <label className="block text-sm font-bold text-slate-700">Régimes & allergènes</label>
                {selectedTags.size > 0 && (
                  <span className="text-xs font-semibold text-[#16a34a]">{selectedTags.size} sélectionné{selectedTags.size > 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {DIET_TAGS.map((tag) => {
                  const active = selectedTags.has(tag.label);
                  return (
                    <button
                      key={tag.label}
                      onClick={() => toggleTag(tag.label)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-semibold transition-all ${
                        active
                          ? 'border-[#16a34a] bg-green-50 text-[#16a34a]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-[#16a34a] hover:bg-green-50/50'
                      }`}
                    >
                      <span>{tag.icon}</span>
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isFoodRescue && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 ml-1">Date & heure du repas</label>
              <input
                type="datetime-local"
                value={mealDate}
                onChange={(e) => { setMealDate(e.target.value); if (fieldErrors.mealDate) validateField('mealDate', e.target.value); }}
                onBlur={(e) => validateField('mealDate', e.target.value)}
                className={`w-full h-14 px-6 rounded-full border bg-slate-50 outline-none transition-all text-slate-900 ${fieldErrors.mealDate ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
              />
              {fieldErrors.mealDate && (
                <p className="text-xs text-red-500 ml-2">{fieldErrors.mealDate}</p>
              )}
            </div>
          )}

          {!isFoodRescue && (
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 ml-1">
                Nombre de personnes{' '}
                <span className="text-slate-400 font-normal">
                  {isPremium ? '(min. 3)' : '(min. 1)'}
                </span>
              </label>
              <div className="flex items-center gap-5">
                <button
                  onClick={() => setParticipants(Math.max(isPremium ? 3 : 1, participants - 1))}
                  disabled={participants <= (isPremium ? 3 : 1)}
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors ${
                    participants <= (isPremium ? 3 : 1)
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-slate-200 text-slate-700 hover:border-[#16a34a]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">remove</span>
                </button>
                <div className="flex-1 text-center">
                  <span className="text-4xl font-bold text-slate-900">{participants}</span>
                  <p className="text-xs text-slate-400 mt-0.5">personne{participants > 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setParticipants(participants + 1)}
                  className="w-12 h-12 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-700 hover:border-[#16a34a] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>
              <div className="flex gap-1.5 justify-center mt-2">
                {Array.from({ length: Math.min(participants, 8) }, (_, i) => (
                  <span
                    key={i}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: isPremium ? '#f59e0b' : '#16a34a' }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
              <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                {isFoodRescue ? 'Lieu de récupération' : 'Lieu du repas'}
                {geolocating && (
                  <span className="w-3 h-3 border-2 border-[#16a34a] border-t-transparent rounded-full animate-spin inline-block" />
                )}
              </label>
              <button onClick={() => setShowLocationPicker(true)} className="text-xs font-bold" style={{ color: accentColor }}>Modifier</button>
            </div>
            <button
              onClick={() => setShowLocationPicker(true)}
              className="relative w-full h-36 rounded-2xl overflow-hidden group focus:outline-none"
            >
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-white ring-4 ring-white/50"
                  style={{ background: accentColor }}>
                  <span className="material-symbols-outlined text-[20px]">location_on</span>
                </div>
              </div>
              <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold shadow-sm max-w-[85%] truncate">
                {locationName}
              </div>
              <div className="absolute inset-0 bg-black/0 group-active:bg-black/5 transition-colors rounded-2xl" />
            </button>
          </div>

          <button
            onClick={() => setSafetyConfirmed(!safetyConfirmed)}
            className={`w-full flex items-start gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
              safetyConfirmed
                ? 'border-[#16a34a] bg-green-50'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
              safetyConfirmed
                ? 'bg-[#16a34a] border-[#16a34a]'
                : 'border-slate-300 bg-white'
            }`}>
              {safetyConfirmed && (
                <span className="material-symbols-outlined text-white text-[14px]">check</span>
              )}
            </div>
            <p className={`text-xs leading-relaxed font-medium transition-colors ${
              safetyConfirmed ? 'text-green-800' : 'text-slate-600'
            }`}>
              Je confirme que les aliments partagés sont propres à la consommation. Je reconnais agir sous ma propre responsabilité et que ShareEat est une plateforme de mise en relation sans garantie sur la qualité des aliments.
            </p>
          </button>

          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
              <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}
        </section>
      </main>

      {showLocationPicker && (
        <LocationPicker
          lat={locationLat}
          lng={locationLng}
          name={locationName}
          onConfirm={(lat, lng, name) => {
            setLocationLat(lat);
            setLocationLng(lng);
            setLocationName(name);
            setShowLocationPicker(false);
          }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}

      <footer className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="w-full h-16 disabled:opacity-60 disabled:cursor-not-allowed font-extrabold text-lg rounded-full shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] text-white"
          style={{
            background: '#16a34a',
            boxShadow: '0 4px 20px rgba(22,163,74,0.3)',
          }}
        >
          {publishing ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{isEditing ? 'Enregistrement...' : 'Publication...'}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px]">{isEditing ? 'save' : 'send'}</span>
              <span>{isEditing ? 'Enregistrer les modifications' : (isFoodRescue ? "Publier l'annonce" : 'Partager ce repas')}</span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
