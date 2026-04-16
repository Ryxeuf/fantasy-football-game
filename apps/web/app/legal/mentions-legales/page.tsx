import Link from "next/link";

export const metadata = {
  title: "Mentions légales - Nuffle Arena",
  description: "Mentions légales de Nuffle Arena, conformément à la loi LCEN.",
};

export default function MentionsLegalesPage() {
  return (
    <div className="w-full px-6 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-emerald-600 hover:text-emerald-700 hover:underline"
        >
          ← Retour à l&apos;accueil
        </Link>
      </div>

      <h1 className="text-4xl font-bold mb-8">Mentions légales</h1>

      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            1. Informations légales
          </h2>
          <p className="mb-4">
            Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004
            pour la confiance dans l&apos;économie numérique (LCEN), et notamment
            son article 6-III, il est précisé aux utilisateurs du site Nuffle
            Arena l&apos;identité des différents intervenants dans le cadre de sa
            réalisation et de son suivi.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="mb-2">
              <strong>Éditeur du site :</strong>
            </p>
            <p className="mb-2">
              Ryxeuf — personne physique
            </p>
            <p className="mb-2">
              <strong>Directeur de la publication :</strong> Ryxeuf
            </p>
            <p className="mb-2">
              <strong>Email de contact :</strong>{" "}
              contact@nufflearena.fr
            </p>
            <p className="mb-2">
              <strong>Site web :</strong> nufflearena.fr
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Le site étant édité par une personne physique à titre non
              professionnel, les mentions relatives au numéro SIRET, au RCS et à
              la TVA intracommunautaire ne sont pas applicables (article 6-III-2
              de la LCEN).
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Hébergement</h2>
          <p className="mb-4">
            Conformément à l&apos;article 6-I-2 de la LCEN, les coordonnées de
            l&apos;hébergeur du site sont les suivantes :
          </p>
          {/* TODO: Remplacer par les informations réelles de l'hébergeur */}
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <p className="mb-2">
              <strong>Hébergeur :</strong> [Nom de l&apos;hébergeur]
            </p>
            <p className="mb-2">
              <strong>Adresse :</strong> [Adresse du siège social]
            </p>
            <p className="mb-2">
              <strong>Téléphone :</strong> [Numéro de téléphone]
            </p>
            <p className="text-sm text-yellow-700 mt-2 italic">
              Information à compléter par l&apos;éditeur conformément à l&apos;article
              6-I-2 de la LCEN.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            3. Financement et dons
          </h2>
          <p className="mb-4">
            Nuffle Arena est un projet gratuit financé par des dons
            volontaires. Les dons sont collectés via la plateforme tierce{" "}
            <a
              href="https://ko-fi.com/nufflearena"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Ko-fi
            </a>{" "}
            (Ko-fi Labs Limited, Royaume-Uni).
          </p>
          <p className="mb-4">
            Les dons sont des libéralités et ne donnent droit à aucune
            contrepartie ni avantage en jeu. Ils ne sont pas déductibles
            fiscalement. Aucune donnée de paiement n&apos;est collectée ou
            stockée par Nuffle Arena. Pour plus de détails, consultez
            l&apos;article 3 de nos{" "}
            <Link
              href="/legal/conditions-utilisation"
              className="text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              conditions d&apos;utilisation
            </Link>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            4. Propriété intellectuelle
          </h2>
          <p className="mb-4">
            <strong>Blood Bowl</strong> est une marque déposée de Games Workshop
            Limited. Toutes les règles, statistiques, descriptions de joueurs,
            noms de personnages et éléments du jeu Blood Bowl sont la propriété
            intellectuelle de Games Workshop Limited.
          </p>
          <p className="mb-4">
            Ce site web, Nuffle Arena, n&apos;est pas affilié à, approuvé par, ni
            lié à Games Workshop Limited ou à ses filiales. Ce site est créé et
            maintenu par des fans de Blood Bowl à des fins éducatives et de
            référence uniquement.
          </p>
          <p className="mb-4">
            Les références aux règles officielles de Blood Bowl 2025 et les noms
            des joueurs utilisés sur ce site sont la propriété exclusive de Games
            Workshop. Aucune revendication de propriété n&apos;est faite
            concernant ces éléments.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            5. Propriété du site
          </h2>
          <p className="mb-4">
            L&apos;ensemble de ce site relève de la législation française et
            internationale sur le droit d&apos;auteur et la propriété
            intellectuelle. Tous les droits de reproduction sont réservés, y
            compris pour les documents téléchargeables et les représentations
            iconographiques et photographiques.
          </p>
          <p className="mb-4">
            La reproduction de tout ou partie de ce site sur un support
            électronique quel qu&apos;il soit est formellement interdite sauf
            autorisation expresse de l&apos;éditeur. Toute reproduction non
            autorisée constitue une contrefaçon passible de sanctions pénales.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            6. Protection des données personnelles
          </h2>
          <p className="mb-4">
            Conformément au Règlement Général sur la Protection des Données (RGPD
            — Règlement UE 2016/679) et à la loi n° 78-17 du 6 janvier 1978
            relative à l&apos;informatique, aux fichiers et aux libertés, vous
            disposez de droits sur vos données personnelles (accès, rectification,
            suppression, opposition, portabilité, limitation).
          </p>
          <p className="mb-4">
            Pour connaître en détail les données collectées, les finalités du
            traitement, vos droits et les modalités pour les exercer, veuillez
            consulter notre{" "}
            <Link
              href="/legal/politique-de-confidentialite"
              className="text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Cookies</h2>
          <p className="mb-4">
            Le site Nuffle Arena utilise des cookies strictement nécessaires au
            fonctionnement du service et des technologies de stockage local. Aucun
            cookie publicitaire, de suivi ou d&apos;analyse n&apos;est utilisé.
          </p>
          <p className="mb-4">
            Pour connaître en détail les cookies utilisés, leur finalité et la
            manière de les gérer, veuillez consulter notre{" "}
            <Link
              href="/legal/politique-de-cookies"
              className="text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              politique de cookies
            </Link>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            8. Limitation de responsabilité
          </h2>
          <p className="mb-4">
            L&apos;éditeur s&apos;efforce d&apos;assurer au mieux de ses
            possibilités l&apos;exactitude et la mise à jour des informations
            diffusées sur ce site, dont il se réserve le droit de corriger, à tout
            moment et sans préavis, le contenu.
          </p>
          <p className="mb-4">
            Toutefois, l&apos;éditeur ne peut garantir l&apos;exactitude, la
            précision ou l&apos;exhaustivité des informations mises à disposition
            sur ce site. En conséquence, l&apos;utilisateur reconnaît utiliser ces
            informations sous sa responsabilité exclusive.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            9. Loi applicable
          </h2>
          <p className="mb-4">
            Les présentes mentions légales sont régies par la loi française. En
            cas de litige et à défaut d&apos;accord amiable, le litige sera porté
            devant les tribunaux français conformément aux règles de compétence en
            vigueur.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Contact</h2>
          <p className="mb-4">
            Pour toute question concernant les présentes mentions légales, vous
            pouvez nous contacter à l&apos;adresse suivante :
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p>
              <strong>Email :</strong> contact@nufflearena.fr
            </p>
          </div>
        </section>

        <section className="mb-8">
          <p className="text-sm text-gray-500 italic">
            Dernière mise à jour : 16 avril 2026
          </p>
        </section>
      </div>
    </div>
  );
}
