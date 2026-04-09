import Link from "next/link";

export const metadata = {
  title: "Conditions d'utilisation - Nuffle Arena",
  description: "Conditions générales d'utilisation de Nuffle Arena.",
};

export default function ConditionsUtilisationPage() {
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

      <h1 className="text-4xl font-bold mb-8">
        Conditions générales d&apos;utilisation
      </h1>

      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            1. Acceptation des conditions
          </h2>
          <p className="mb-4">
            En accédant et en utilisant le site Nuffle Arena (ci-après « le
            Site »), vous acceptez d&apos;être lié par les présentes conditions
            générales d&apos;utilisation (ci-après « les CGU »). Si vous
            n&apos;acceptez pas ces conditions, veuillez ne pas utiliser ce site.
          </p>
          <p className="mb-4">
            La création d&apos;un compte sur Nuffle Arena implique l&apos;acceptation
            pleine et entière des présentes CGU ainsi que de la{" "}
            <Link
              href="/legal/politique-de-confidentialite"
              className="text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              politique de confidentialité
            </Link>{" "}
            et de la{" "}
            <Link
              href="/legal/politique-de-cookies"
              className="text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              politique de cookies
            </Link>
            .
          </p>
          <p className="mb-4">
            L&apos;éditeur se réserve le droit de modifier ces conditions à tout
            moment. Il est de votre responsabilité de consulter régulièrement ces
            conditions pour prendre connaissance des éventuelles modifications.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            2. Description du service
          </h2>
          <p className="mb-4">
            Nuffle Arena est une plateforme digitale gratuite permettant de créer
            et gérer des équipes Blood Bowl selon les règles officielles 2025. Le
            service permet notamment de :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>Créer et gérer des équipes Blood Bowl</li>
            <li>Recruter des joueurs et des Star Players</li>
            <li>Calculer les budgets et valeurs d&apos;équipe</li>
            <li>Exporter les rosters en format PDF</li>
            <li>
              Consulter les informations sur les équipes et Star Players
              disponibles
            </li>
            <li>
              Jouer des matchs en ligne contre d&apos;autres utilisateurs
            </li>
            <li>
              Suivre son classement et ses statistiques de matchs
            </li>
          </ul>
          <p className="mb-4">
            Le service est fourni gratuitement et sans engagement. Aucune
            transaction financière n&apos;est requise pour utiliser Nuffle Arena.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            3. Conditions d&apos;accès et inscription
          </h2>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            3.1. Âge minimum
          </h3>
          <p className="mb-4">
            Conformément à l&apos;article 8 du Règlement Général sur la Protection
            des Données (RGPD) et à l&apos;article 45 de la loi Informatique et
            Libertés, l&apos;utilisation de Nuffle Arena et la création d&apos;un
            compte sont réservées aux personnes âgées de{" "}
            <strong>16 ans ou plus</strong>.
          </p>
          <p className="mb-4">
            Si vous avez moins de 16 ans, vous ne pouvez pas créer de compte ni
            utiliser le service sans l&apos;autorisation et la supervision d&apos;un
            parent ou tuteur légal.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            3.2. Création de compte
          </h3>
          <p className="mb-4">
            L&apos;utilisation de certaines fonctionnalités de Nuffle Arena
            nécessite la création d&apos;un compte utilisateur. Vous êtes
            responsable de maintenir la confidentialité de vos identifiants de
            connexion.
          </p>
          <p className="mb-4">
            Vous vous engagez à fournir des informations exactes, à jour et
            complètes lors de votre inscription. Toute utilisation frauduleuse ou
            usurpation d&apos;identité pourra entraîner la suspension ou la
            suppression de votre compte.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            3.3. Utilisation autorisée
          </h3>
          <p className="mb-4">
            Vous vous engagez à utiliser Nuffle Arena uniquement pour :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              Des fins légales et conformes aux présentes conditions
            </li>
            <li>Créer et gérer vos propres équipes Blood Bowl</li>
            <li>
              Participer à des matchs en ligne dans un esprit sportif
            </li>
            <li>Des usages personnels et non commerciaux</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            3.4. Utilisations interdites
          </h3>
          <p className="mb-4">Il est strictement interdit de :</p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              Utiliser le service à des fins illégales ou frauduleuses
            </li>
            <li>
              Tenter d&apos;accéder de manière non autorisée aux systèmes ou
              données
            </li>
            <li>
              Reproduire, copier ou vendre tout ou partie du contenu sans
              autorisation
            </li>
            <li>
              Utiliser des robots, scripts ou outils automatisés pour accéder au
              service
            </li>
            <li>Perturber ou altérer le fonctionnement du service</li>
            <li>
              Transmettre des virus, codes malveillants ou tout élément nuisible
            </li>
            <li>
              Usurper l&apos;identité d&apos;une autre personne ou entité
            </li>
            <li>
              Exploiter le service à des fins commerciales sans autorisation
              préalable de l&apos;éditeur
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            4. Propriété intellectuelle
          </h2>
          <p className="mb-4">
            <strong>Blood Bowl</strong> et tous les éléments associés (règles,
            noms de joueurs, statistiques, etc.) sont la propriété exclusive de
            Games Workshop Limited. Nuffle Arena n&apos;est pas affilié à Games
            Workshop et utilise ces éléments avec respect dans le cadre d&apos;un
            site de fans.
          </p>
          <p className="mb-4">
            L&apos;interface, le code, le design et tous les éléments créés
            spécifiquement pour Nuffle Arena restent la propriété de
            l&apos;éditeur. Toute reproduction non autorisée est interdite.
          </p>
          <p className="mb-4">
            Les équipes et données que vous créez via Nuffle Arena vous
            appartiennent, mais vous accordez à l&apos;éditeur une licence
            d&apos;utilisation non exclusive et gratuite pour le fonctionnement du
            service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            5. Disponibilité du service
          </h2>
          <p className="mb-4">
            L&apos;éditeur s&apos;efforce d&apos;assurer la continuité et la
            qualité du service Nuffle Arena, mais ne peut garantir une
            disponibilité ininterrompue. Le service peut être temporairement
            indisponible pour des raisons de maintenance, de mise à jour ou en cas
            de force majeure.
          </p>
          <p className="mb-4">
            L&apos;éditeur se réserve le droit de modifier, suspendre ou
            interrompre le service à tout moment sans préavis, sans que sa
            responsabilité ne puisse être engagée.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            6. Limitation de responsabilité
          </h2>
          <p className="mb-4">
            Le service Nuffle Arena est fourni « tel quel », sans garantie
            d&apos;aucune sorte. L&apos;éditeur ne garantit pas que :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>Le service répondra à toutes vos attentes</li>
            <li>
              Le service sera ininterrompu, sécurisé ou exempt d&apos;erreurs
            </li>
            <li>Les résultats obtenus seront exacts ou fiables</li>
            <li>Les défauts seront corrigés</li>
          </ul>
          <p className="mb-4">
            Dans les limites permises par la loi, l&apos;éditeur ne pourra être
            tenu responsable des dommages directs ou indirects résultant de
            l&apos;utilisation ou de l&apos;impossibilité d&apos;utiliser le
            service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            7. Données utilisateur et vie privée
          </h2>
          <p className="mb-4">
            Vous êtes seul responsable des équipes et données que vous créez via
            Nuffle Arena. L&apos;éditeur ne garantit pas la sauvegarde permanente
            de vos données et ne pourra être tenu responsable en cas de perte de
            données.
          </p>
          <p className="mb-4">
            Il est recommandé de conserver des copies de sauvegarde de vos
            équipes, notamment via l&apos;export PDF disponible sur la plateforme.
          </p>
          <p className="mb-4">
            L&apos;éditeur se réserve le droit de supprimer tout contenu ou
            compte qui violerait les présentes conditions d&apos;utilisation.
          </p>
          <p className="mb-4">
            Pour en savoir plus sur la collecte et le traitement de vos données
            personnelles, veuillez consulter notre{" "}
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
          <h2 className="text-2xl font-semibold mb-4">8. Résiliation</h2>
          <p className="mb-4">
            Vous pouvez résilier votre compte à tout moment en supprimant votre
            compte via les paramètres de votre profil.
          </p>
          <p className="mb-4">
            La suppression de votre compte entraîne la suppression de vos données
            personnelles conformément à notre{" "}
            <Link
              href="/legal/politique-de-confidentialite"
              className="text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              politique de confidentialité
            </Link>{" "}
            et au droit à l&apos;effacement prévu par l&apos;article 17 du RGPD.
          </p>
          <p className="mb-4">
            L&apos;éditeur se réserve le droit de suspendre ou supprimer votre
            compte en cas de violation des présentes conditions d&apos;utilisation,
            sans préavis.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            9. Liens hypertextes
          </h2>
          <p className="mb-4">
            Le site Nuffle Arena peut contenir des liens hypertextes vers des
            sites tiers. L&apos;éditeur n&apos;exerce aucun contrôle sur le
            contenu de ces sites et décline toute responsabilité quant à leur
            contenu, leurs pratiques en matière de confidentialité ou leur
            disponibilité.
          </p>
          <p className="mb-4">
            L&apos;insertion de ces liens ne constitue pas une approbation du
            contenu de ces sites. L&apos;accès à ces sites tiers se fait sous
            votre entière responsabilité.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Force majeure</h2>
          <p className="mb-4">
            L&apos;éditeur ne pourra être tenu responsable de tout manquement ou
            retard dans l&apos;exécution de ses obligations au titre des présentes
            CGU résultant d&apos;un cas de force majeure tel que défini par
            l&apos;article 1218 du Code civil, notamment : catastrophes
            naturelles, incendies, pannes de réseau, défaillance des systèmes de
            télécommunication, cyberattaques, décisions gouvernementales ou toute
            autre circonstance indépendante de la volonté de l&apos;éditeur.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            11. Modifications des conditions
          </h2>
          <p className="mb-4">
            L&apos;éditeur se réserve le droit de modifier les présentes
            conditions d&apos;utilisation à tout moment. Les modifications entrent
            en vigueur dès leur publication sur le site.
          </p>
          <p className="mb-4">
            Il est de votre responsabilité de consulter régulièrement ces
            conditions. Votre utilisation continue du service après modification
            des conditions vaut acceptation des nouvelles conditions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            12. Loi applicable et juridiction
          </h2>
          <p className="mb-4">
            Les présentes conditions d&apos;utilisation sont régies par la loi
            française. Tout litige relatif à l&apos;interprétation ou à
            l&apos;exécution de ces conditions relève des tribunaux français
            compétents.
          </p>
          <p className="mb-4">
            En cas de litige, les parties s&apos;engagent à rechercher une
            solution amiable avant toute action judiciaire. Conformément aux
            articles L.611-1 et suivants du Code de la consommation, vous pouvez
            recourir gratuitement à un médiateur de la consommation en cas de
            litige non résolu.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">13. Contact</h2>
          <p className="mb-4">
            Pour toute question concernant les présentes conditions
            d&apos;utilisation, vous pouvez nous contacter :
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p>
              <strong>Email :</strong> contact@nufflearena.fr
            </p>
          </div>
        </section>

        <section className="mb-8">
          <p className="text-sm text-gray-500 italic">
            Dernière mise à jour : 9 avril 2026
          </p>
        </section>
      </div>
    </div>
  );
}
