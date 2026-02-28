import ModalBase from './ModalBase';

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  return (
    <ModalBase title="A propos" onClose={onClose}>
      <div className="px-6 py-5 space-y-6">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-16 h-16 rounded-2xl bg-[#49e619] flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-[32px]">volunteer_activism</span>
          </div>
          <div className="text-center">
            <p className="text-xl font-extrabold text-slate-900">ShareEat</p>
            <p className="text-xs text-slate-400 mt-0.5">Version 1.0.0 (build 42)</p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-green-800 mb-1">Notre mission</p>
          <p className="text-xs text-green-700 leading-relaxed">
            ShareEat est une plateforme gratuite de mise en relation entre voisins. Nous facilitons le partage de repas faits maison et la lutte contre le gaspillage alimentaire. Aucun paiement n'est requis pour partager ou récupérer des aliments.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
          {[
            { label: 'Version', value: '1.0.0' },
            { label: 'Build', value: '42' },
            { label: 'Plateforme', value: 'Web' },
            { label: 'Mise à jour', value: 'Fév. 2026' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{row.label}</span>
              <span className="text-sm font-semibold text-slate-800">{row.value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 text-center leading-relaxed">
          ShareEat connecte les voisins autour du partage alimentaire. Chaque repas partagé renforce le lien communautaire et réduit le gaspillage.
        </p>

        <p className="text-xs text-slate-300 text-center">
          &copy; 2026 ShareEat. Tous droits réservés.
        </p>
      </div>
    </ModalBase>
  );
}
