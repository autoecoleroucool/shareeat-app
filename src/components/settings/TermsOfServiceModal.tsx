import ModalBase from './ModalBase';

interface TermsOfServiceModalProps {
  onClose: () => void;
}

const SECTIONS = [
  {
    title: '1. Plateforme de mise en relation',
    body: "ShareEat est une plateforme numérique permettant la mise en relation entre particuliers souhaitant partager des repas faits maison ou des aliments en surplus. ShareEat n'est pas un restaurateur, ni un prestataire de services alimentaires. Nous n'intervenons pas dans la préparation, la manipulation ou la livraison des aliments.",
  },
  {
    title: '2. Responsabilité des utilisateurs',
    body: "Chaque utilisateur est entièrement et personnellement responsable des aliments qu'il partage via la plateforme. Cela inclut la qualité, la fraîcheur, la sécurité sanitaire, la conservation, l'étiquetage et la conformité aux réglementations alimentaires en vigueur. ShareEat ne saurait être tenu responsable d'un quelconque préjudice lié à la consommation d'aliments partagés sur la plateforme.",
  },
  {
    title: '3. Aucune garantie sur les aliments',
    body: "ShareEat ne contrôle pas, ne certifie pas et ne garantit pas la qualité, la sécurité, la fraîcheur ni l'adéquation des aliments publiés sur la plateforme. Les informations fournies par les utilisateurs (descriptions, photos, dates de péremption) relèvent de leur seule responsabilité.",
  },
  {
    title: '4. Service entièrement gratuit',
    body: "Le partage de repas faits maison et d'aliments anti-gaspi sur ShareEat est entièrement gratuit. Aucun paiement n'est requis entre utilisateurs pour participer aux échanges. ShareEat n'est pas un service de vente de repas. Les dons à l'application sont strictement volontaires et n'ont aucun impact sur le karma, les XP, ni sur l'accès aux fonctionnalités de base.",
  },
  {
    title: '5. Cercle Culinaire (fonctionnalité optionnelle)',
    body: "Le Cercle Culinaire est une fonctionnalité Premium optionnelle permettant d'accéder à des expériences culinaires organisées en groupe, des cercles communautaires exclusifs et des outils avancés. L'abonnement Premium donne accès à ces fonctionnalités organisationnelles. Les repas partagés au sein du Cercle Culinaire restent gratuits entre participants.",
  },
  {
    title: '6. Confirmation de sécurité alimentaire',
    body: "Avant toute publication d'un repas ou d'aliments, l'utilisateur confirme explicitement que les aliments partagés sont propres à la consommation humaine, qu'ils sont préparés ou conservés dans des conditions hygiéniques satisfaisantes, et qu'ils ne présentent aucun risque connu pour la santé.",
  },
  {
    title: "7. Responsabilité des personnes récupérant les aliments",
    body: "Toute personne récupérant des aliments via ShareEat agit sous sa propre responsabilité. Il incombe à chaque utilisateur d'évaluer lui-même la sécurité des aliments avant de les consommer. En cas de doute, il est recommandé de ne pas consommer les aliments proposés.",
  },
  {
    title: '8. Signalement',
    body: "Tout utilisateur peut signaler une annonce suspecte, des aliments potentiellement dangereux ou un comportement inapproprié via la fonction de signalement disponible dans l'application. ShareEat se réserve le droit de retirer tout contenu jugé non conforme aux présentes CGU.",
  },
  {
    title: '9. Données personnelles',
    body: "Le traitement de vos données personnelles est régi par notre Politique de confidentialité, accessible depuis l'écran Paramètres. Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données en nous contactant à privacy@shareat.app.",
  },
  {
    title: '10. Modification des CGU',
    body: "ShareEat se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle. La poursuite de l'utilisation de l'application après notification vaut acceptation des nouvelles conditions.",
  },
  {
    title: '11. Contact',
    body: 'Pour toute question relative aux présentes CGU : legal@shareat.app',
  },
];

export default function TermsOfServiceModal({ onClose }: TermsOfServiceModalProps) {
  return (
    <ModalBase title="Conditions Générales d'Utilisation" onClose={onClose}>
      <div className="px-6 py-5 space-y-5">
        <p className="text-xs text-slate-400">Dernière mise à jour : Février 2026</p>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-amber-800 mb-1">Avertissement important</p>
          <p className="text-xs text-amber-700 leading-relaxed">
            ShareEat est une plateforme de mise en relation entre particuliers. Nous ne garantissons pas la qualité des aliments partagés. Chaque utilisateur agit sous sa propre responsabilité.
          </p>
        </div>

        {SECTIONS.map((s) => (
          <div key={s.title}>
            <p className="text-sm font-bold text-slate-800 mb-1">{s.title}</p>
            <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </ModalBase>
  );
}
