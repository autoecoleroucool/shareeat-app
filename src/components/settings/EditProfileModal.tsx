import { useState, useRef } from 'react';
import ModalBase from './ModalBase';
import { supabase } from '../../lib/supabase';

interface Profile {
  id: string;
  name: string;
  avatar_url: string;
  bio: string;
  location_name: string;
}

interface EditProfileModalProps {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditProfileModal({ profile, onClose, onSaved }: EditProfileModalProps) {
  const [name, setName] = useState(profile.name || '');
  const [location, setLocation] = useState(profile.location_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError('Le nom est obligatoire.'); return; }
    setSaving(true);
    setError('');

    let newAvatarUrl = profile.avatar_url;

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true });

      if (uploadError) {
        setError('Erreur lors du téléchargement de la photo.');
        setSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        location_name: location.trim(),
        bio: bio.trim(),
        avatar_url: newAvatarUrl,
      })
      .eq('id', profile.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message || 'Une erreur est survenue.');
      return;
    }

    setSaved(true);
    onSaved();
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 900);
  }

  return (
    <ModalBase title="Modifier le profil" onClose={onClose}>
      <div className="px-6 py-5 space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-[#49e619]/30">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-400 text-[40px]">person</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#49e619] rounded-full flex items-center justify-center border-2 border-white shadow-md active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-white text-[14px]">photo_camera</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <p className="text-xs text-slate-400">Appuie sur l'icone pour changer ta photo</p>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Nom</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:border-[#49e619] transition-colors bg-slate-50"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Ville</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ex: Paris, France"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:border-[#49e619] transition-colors bg-slate-50"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="Parle de ta cuisine, tes spécialités..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:border-[#49e619] transition-colors bg-slate-50 resize-none"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{bio.length} / 200</p>
        </div>

        {error && (
          <p className="text-sm text-red-500 font-medium">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={`w-full py-3.5 rounded-full font-bold text-sm transition-all disabled:opacity-60 ${
            saved
              ? 'bg-[#49e619] text-white'
              : 'bg-[#49e619] text-white hover:bg-[#3ecc14] active:scale-95'
          }`}
        >
          {saved ? 'Enregistré !' : saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </ModalBase>
  );
}
