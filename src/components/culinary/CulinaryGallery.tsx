import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { CulinaryPhoto } from '../../types';

interface CulinaryGalleryProps {
  userId: string;
  isOwner: boolean;
  isCommunityFeed?: boolean;
  currentUserId?: string;
}

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1400;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
        else { w = Math.round((w * MAX) / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.88);
    };
    img.src = url;
  });
}

export default function CulinaryGallery({ userId, isOwner, isCommunityFeed = false, currentUserId }: CulinaryGalleryProps) {
  const [photos, setPhotos] = useState<CulinaryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<CulinaryPhoto | null>(null);
  const [mealName, setMealName] = useState('');
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    if (isCommunityFeed) {
      const { data } = await supabase
        .from('culinary_circle_photos')
        .select('*, author:profiles!user_id(id, name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(60);
      setPhotos((data as CulinaryPhoto[]) ?? []);
    } else {
      const { data } = await supabase
        .from('culinary_circle_photos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setPhotos((data as CulinaryPhoto[]) ?? []);
    }
    setLoading(false);
  }, [userId, isCommunityFeed]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowAddForm(true);
  };

  const handleUpload = async () => {
    if (!pendingFile || !mealName.trim()) return;
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const compressed = await compressImage(pendingFile);
    const ext = 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('culinary-photos')
      .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) { setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage
      .from('culinary-photos')
      .getPublicUrl(path);

    await supabase.from('culinary_circle_photos').insert({
      user_id: user.id,
      image_url: publicUrl,
      meal_name: mealName.trim(),
      caption: caption.trim(),
    });

    setMealName('');
    setCaption('');
    setPreviewUrl(null);
    setPendingFile(null);
    setShowAddForm(false);
    setUploading(false);
    loadPhotos();
  };

  const handleDelete = async (photo: CulinaryPhoto) => {
    try {
      const url = new URL(photo.image_url);
      const pathParts = url.pathname.split('/culinary-photos/');
      if (pathParts.length > 1) {
        await supabase.storage.from('culinary-photos').remove([pathParts[1]]);
      }
    } catch (_) {}
    await supabase.from('culinary_circle_photos').delete().eq('id', photo.id);
    setSelectedPhoto(null);
    loadPhotos();
  };

  const cancelAdd = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    setMealName('');
    setCaption('');
    setShowAddForm(false);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="aspect-square bg-amber-900/20 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (isCommunityFeed) {
    if (photos.length === 0) {
      return (
        <div className="text-center py-10">
          <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-amber-400/50 text-[26px]">photo_camera</span>
          </div>
          <p className="text-amber-300/50 text-sm font-medium">Aucune photo partagée pour l'instant</p>
          <p className="text-amber-400/30 text-xs mt-1">Les membres du Cercle partageront bientôt leurs créations</p>
        </div>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-3 gap-1">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="aspect-square relative rounded-xl overflow-hidden active:scale-95 transition-all group"
            >
              <img
                src={photo.image_url}
                alt={photo.meal_name}
                className="w-full h-full object-cover group-active:brightness-90 transition-all"
                loading="lazy"
              />
              {photo.author && (
                <div className="absolute bottom-1 left-1">
                  <img
                    src={photo.author.avatar_url || ''}
                    alt={photo.author.name}
                    className="w-5 h-5 rounded-full object-cover border border-amber-400/40"
                  />
                </div>
              )}
            </button>
          ))}
        </div>

        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-black/95"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={() => setSelectedPhoto(null)}
          >
            <div
              className="flex items-center justify-between px-4 pb-3 shrink-0"
              style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {selectedPhoto.author && (
                  <img
                    src={selectedPhoto.author.avatar_url || ''}
                    alt={selectedPhoto.author.name}
                    className="w-8 h-8 rounded-full object-cover border border-amber-400/30 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-base leading-tight truncate">{selectedPhoto.meal_name}</h3>
                  {selectedPhoto.author && (
                    <p className="text-amber-300/60 text-xs">{selectedPhoto.author.name}</p>
                  )}
                  {selectedPhoto.caption && (
                    <p className="text-white/50 text-xs mt-0.5 truncate">{selectedPhoto.caption}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center shrink-0 ml-2"
              >
                <span className="material-symbols-outlined text-white text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center px-4 py-2 min-h-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <img
                src={selectedPhoto.image_url}
                alt={selectedPhoto.meal_name}
                className="max-w-full max-h-full object-contain rounded-2xl"
                style={{ maxHeight: '100%' }}
              />
            </div>

            {currentUserId && selectedPhoto.user_id === currentUserId && (
              <div className="px-4 pt-3 pb-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleDelete(selectedPhoto)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Supprimer cette photo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {isOwner && !showAddForm && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full mb-4 flex items-center justify-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-2xl py-3 text-amber-300 font-bold text-sm active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
          Ajouter une photo culinaire
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {showAddForm && (
        <div className="mb-4 bg-black/40 rounded-3xl border border-amber-400/20 overflow-hidden">
          {previewUrl && (
            <div className="relative">
              <img src={previewUrl} alt="preview" className="w-full aspect-video object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          )}
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/70 mb-1.5 block">
                Nom du plat *
              </label>
              <input
                type="text"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="Ex: Risotto aux champignons"
                className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-amber-400/70 mb-1.5 block">
                Description (optionnel)
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Décris ce qui rend ce plat spécial..."
                rows={2}
                className="w-full bg-white/5 border border-amber-400/20 rounded-xl px-3 py-2.5 text-sm text-amber-100 placeholder-amber-400/30 outline-none focus:border-amber-400/50 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelAdd}
                className="flex-1 py-2.5 rounded-xl border border-amber-400/20 text-amber-400/60 text-sm font-bold active:scale-95 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !mealName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {uploading ? (
                  <>
                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                    Envoi...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[14px]">check</span>
                    Publier
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {photos.length === 0 && !showAddForm ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-amber-400/50 text-[26px]">photo_camera</span>
          </div>
          <p className="text-amber-300/50 text-sm font-medium">
            {isOwner ? 'Aucune photo pour l\'instant' : 'Aucune photo partagée'}
          </p>
          {isOwner && (
            <p className="text-amber-400/30 text-xs mt-1">
              Partage tes créations culinaires pour attirer des invités
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="aspect-square relative rounded-xl overflow-hidden active:scale-95 transition-all group"
            >
              <img
                src={photo.image_url}
                alt={photo.meal_name}
                className="w-full h-full object-cover group-active:brightness-90 transition-all"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="flex items-center justify-between px-4 pb-3 shrink-0"
            style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-bold text-base leading-tight truncate">{selectedPhoto.meal_name}</h3>
              {selectedPhoto.caption && (
                <p className="text-white/50 text-sm mt-0.5 truncate">{selectedPhoto.caption}</p>
              )}
            </div>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center shrink-0 ml-2"
            >
              <span className="material-symbols-outlined text-white text-[20px]">close</span>
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center px-4 py-2 min-h-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedPhoto.image_url}
              alt={selectedPhoto.meal_name}
              className="max-w-full max-h-full object-contain rounded-2xl"
              style={{ maxHeight: '100%' }}
            />
          </div>

          {isOwner && (
            <div className="px-4 pt-3 pb-4 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleDelete(selectedPhoto)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-sm active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Supprimer cette photo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
