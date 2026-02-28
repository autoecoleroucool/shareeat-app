import { useState } from 'react';
import ModalBase from './ModalBase';

interface HelpCenterModalProps {
  onClose: () => void;
}

const FAQS = [
  {
    q: 'Comment rejoindre un repas ou récupérer des aliments ?',
    a: "Parcours les annonces depuis l'onglet Explorer ou la Carte, appuie sur une annonce qui t'intéresse, puis clique sur le bouton de réservation. Tout est entièrement gratuit, aucun paiement n'est demandé.",
  },
  {
    q: 'Est-ce que je dois payer pour récupérer un repas ?',
    a: "Non. ShareEat est une plateforme de partage entre voisins, 100% gratuite. Aucun échange d'argent n'a lieu entre utilisateurs pour les repas ou les aliments. Tu peux optionnellement soutenir l'application via un don volontaire, mais ce n'est absolument pas obligatoire.",
  },
  {
    q: 'Comment fonctionne le karma ?',
    a: "Ton karma reflète l'équilibre de tes échanges dans la communauté. Il diminue quand tu récupères un repas et remonte quand tu en partages un. Un karma trop bas limite temporairement ta capacité à réserver. L'objectif est que chacun contribue autant qu'il reçoit.",
  },
  {
    q: 'Puis-je annuler ma réservation ?',
    a: "Oui. Va dans ton profil, retrouve le repas concerné dans la section 'Récupéré récemment', puis appuie sur 'Annuler la réservation'. Ton karma sera restauré de +1.",
  },
  {
    q: "Qu'est-ce que le Cercle Culinaire (mode Premium) ?",
    a: "Le Cercle Culinaire est une fonctionnalité optionnelle donnant accès à des expériences culinaires organisées en groupe, des cercles exclusifs et des outils communautaires avancés. Les repas au sein du Cercle restent gratuits entre participants.",
  },
  {
    q: 'Comment signaler un problème ou un utilisateur ?',
    a: "Appuie sur l'icône de signalement présente sur chaque annonce ou profil. Pour toute question, contacte-nous à support@shareat.app.",
  },
  {
    q: 'Les dons sont-ils obligatoires ?',
    a: "Non. Les dons sont entièrement volontaires et servent à soutenir le fonctionnement de l'application. Ils n'ont aucun impact sur ton karma, tes XP, ou ta capacité à utiliser la plateforme.",
  },
];

export default function HelpCenterModal({ onClose }: HelpCenterModalProps) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <ModalBase title="Centre d'aide" onClose={onClose}>
      <div className="px-6 py-5 space-y-2">
        <div className="bg-[#f0fce8] rounded-2xl p-4 flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-[#49e619] text-[22px]">support_agent</span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Besoin d'aide supplémentaire ?</p>
            <p className="text-xs text-slate-500">support@shareat.app</p>
          </div>
        </div>

        {FAQS.map((faq, idx) => (
          <div key={idx} className="border border-slate-100 rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpen(open === idx ? null : idx)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="flex-1 text-sm font-semibold text-slate-800">{faq.q}</span>
              <span className={`material-symbols-outlined text-slate-400 text-[18px] transition-transform ${open === idx ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </button>
            {open === idx && (
              <div className="px-4 pb-4">
                <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </ModalBase>
  );
}
