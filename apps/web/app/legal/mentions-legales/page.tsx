import Link from "next/link";

export const metadata = {
  title: "Mentions légales - Nuffle Arena",
  description: "Mentions légales de Nuffle Arena",
};

export default function MentionsLegalesPage() {
  return (
    <div className="w-full px-6 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-emerald-600 hover:text-emerald-700 hover:underline"
        >
          ← Retour à l'accueil
        </Link>
      </div>

      <h1 className="text-4xl font-bold mb-8">Mentions légales</h1>

      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Informations légales</h2>
          <p className="mb-4">
            Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004 pour la confiance
            en l'économie numérique, il est précisé aux utilisateurs du site Nuffle Arena l'identité
            des différents intervenants dans le cadre de sa réalisation et de son suivi.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="mb-2"><strong>Éditeur du site :</strong></p>
            <p className="mb-2">Ryxeuf</p>
            <p className="mb-2">Propriétaire et responsable de publication</p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Propriété intellectuelle</h2>
          <p className="mb-4">
            <strong>Blood Bowl</strong> est une marque déposée de Games Workshop Limited.
            Toutes les règles, statistiques, descriptions de joueurs, noms de personnages et
            éléments du jeu Blood Bowl sont la propriété intellectuelle de Games Workshop Limited.
          </p>
          <p className="mb-4">
            Ce site web, Nuffle Arena, n'est pas affilié à, approuvé par, ni lié à Games Workshop Limited
            ou à ses filiales. Ce site est créé et maintenu par des fans de Blood Bowl à des fins
            éducatives et de référence uniquement.
          </p>
          <p className="mb-4">
            Les références aux règles officielles de Blood Bowl 2020 et les noms des joueurs utilisés
            sur ce site sont la propriété exclusive de Games Workshop. Aucune revendication de propriété
            n'est faite concernant ces éléments.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Propriété du site</h2>
          <p className="mb-4">
            L'ensemble de ce site relève de la législation française et internationale sur le droit
            d'auteur et la propriété intellectuelle. Tous les droits de reproduction sont réservés,
            y compris pour les documents téléchargeables et les représentations iconographiques et
            photographiques.
          </p>
          <p className="mb-4">
            La reproduction de tout ou partie de ce site sur un support électronique quel qu'il soit
            est formellement interdite sauf autorisation expresse de l'éditeur. Toute reproduction
            non autorisée constitue une contrefaçon passible de sanctions pénales.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Données personnelles</h2>
          <p className="mb-4">
            Conformément à la loi "Informatique et Libertés" du 6 janvier 1978 modifiée et au Règlement
            Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification,
            de suppression et d'opposition aux données personnelles vous concernant.
          </p>
          <p className="mb-4">
            Les données collectées lors de votre inscription sont utilisées uniquement dans le cadre du
            fonctionnement de la plateforme Nuffle Arena. Elles ne sont pas communiquées à des tiers et sont
            stockées de manière sécurisée.
          </p>
          <p className="mb-4">
            Pour exercer vos droits, vous pouvez nous contacter via les moyens disponibles sur le site.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Cookies</h2>
          <p className="mb-4">
            Le site Nuffle Arena peut utiliser des cookies pour améliorer l'expérience utilisateur et
            permettre le fonctionnement de certaines fonctionnalités. Les cookies sont de petits fichiers
            texte stockés sur votre appareil.
          </p>
          <p className="mb-4">
            Vous pouvez configurer votre navigateur pour refuser les cookies, mais certaines fonctionnalités
            du site pourraient ne plus être accessibles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Limitation de responsabilité</h2>
          <p className="mb-4">
            L'éditeur s'efforce d'assurer au mieux de ses possibilités l'exactitude et la mise à jour
            des informations diffusées sur ce site, dont il se réserve le droit de corriger, à tout moment
            et sans préavis, le contenu.
          </p>
          <p className="mb-4">
            Toutefois, l'éditeur ne peut garantir l'exactitude, la précision ou l'exhaustivité des
            informations mises à disposition sur ce site. En conséquence, l'utilisateur reconnaît
            utiliser ces informations sous sa responsabilité exclusive.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Hébergement</h2>
          <p className="mb-4">
            Le site Nuffle Arena est hébergé par un prestataire d'hébergement. L'éditeur décline toute
            responsabilité en cas de défaillance, panne ou interruption du service d'hébergement.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Loi applicable</h2>
          <p className="mb-4">
            Les présentes mentions légales sont régies par la loi française. En cas de litige et à défaut
            d'accord amiable, le litige sera porté devant les tribunaux français conformément aux règles
            de compétence en vigueur.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Contact</h2>
          <p className="mb-4">
            Pour toute question concernant les présentes mentions légales, vous pouvez nous contacter
            via les moyens de communication disponibles sur le site.
          </p>
        </section>

        <section className="mb-8">
          <p className="text-sm text-gray-500 italic">
            Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", {
              year: "numeric",
              month: "long",
              day: "numeric"
            })}
          </p>
        </section>
      </div>
    </div>
  );
}

