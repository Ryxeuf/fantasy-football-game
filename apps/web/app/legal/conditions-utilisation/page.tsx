import Link from "next/link";

export const metadata = {
  title: "Conditions d'utilisation - Nuffle Arena",
  description: "Conditions d'utilisation de Nuffle Arena",
};

export default function ConditionsUtilisationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-emerald-600 hover:text-emerald-700 hover:underline"
        >
          ← Retour à l'accueil
        </Link>
      </div>

      <h1 className="text-4xl font-bold mb-8">Conditions d'utilisation</h1>

      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Acceptation des conditions</h2>
          <p className="mb-4">
            En accédant et en utilisant le site Nuffle Arena, vous acceptez d'être lié par les présentes
            conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser
            ce site.
          </p>
          <p className="mb-4">
            L'éditeur se réserve le droit de modifier ces conditions à tout moment. Il est de votre
            responsabilité de consulter régulièrement ces conditions pour prendre connaissance des
            éventuelles modifications.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Description du service</h2>
          <p className="mb-4">
            Nuffle Arena est une plateforme digitale permettant de créer et gérer des équipes Blood Bowl
            selon les règles officielles. Le service permet notamment de :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>Créer et gérer des équipes Blood Bowl</li>
            <li>Recruter des joueurs et des Star Players</li>
            <li>Calculer les budgets et valeurs d'équipe</li>
            <li>Exporter les rosters en format PDF</li>
            <li>Consulter les informations sur les équipes et Star Players disponibles</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Utilisation du service</h2>
          <h3 className="text-xl font-semibold mb-3 mt-4">3.1. Accès au service</h3>
          <p className="mb-4">
            L'utilisation de Nuffle Arena nécessite la création d'un compte utilisateur. Vous êtes
            responsable de maintenir la confidentialité de vos identifiants de connexion.
          </p>
          <p className="mb-4">
            Vous vous engagez à fournir des informations exactes, à jour et complètes lors de
            votre inscription.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-4">3.2. Utilisation autorisée</h3>
          <p className="mb-4">Vous vous engagez à utiliser Nuffle Arena uniquement pour :</p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>Des fins légales et conformes aux présentes conditions</li>
            <li>Créer et gérer vos propres équipes Blood Bowl</li>
            <li>Des usages personnels et non commerciaux</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-4">3.3. Utilisations interdites</h3>
          <p className="mb-4">Il est strictement interdit de :</p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>Utiliser le service à des fins illégales ou frauduleuses</li>
            <li>Tenter d'accéder de manière non autorisée aux systèmes ou données</li>
            <li>Reproduire, copier ou vendre tout ou partie du contenu sans autorisation</li>
            <li>Utiliser des robots, scripts ou outils automatisés pour accéder au service</li>
            <li>Perturber ou altérer le fonctionnement du service</li>
            <li>Transmettre des virus, codes malveillants ou tout élément nuisible</li>
            <li>Usurper l'identité d'une autre personne ou entité</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Propriété intellectuelle</h2>
          <p className="mb-4">
            <strong>Blood Bowl</strong> et tous les éléments associés (règles, noms de joueurs,
            statistiques, etc.) sont la propriété exclusive de Games Workshop Limited. Nuffle Arena
            n'est pas affilié à Games Workshop et utilise ces éléments avec respect dans le cadre
            d'un site de fans.
          </p>
          <p className="mb-4">
            L'interface, le code, le design et tous les éléments créés spécifiquement pour Nuffle Arena
            restent la propriété de l'éditeur. Toute reproduction non autorisée est interdite.
          </p>
          <p className="mb-4">
            Les équipes et données que vous créez via Nuffle Arena vous appartiennent, mais vous
            accordez à l'éditeur une licence d'utilisation pour le fonctionnement du service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Disponibilité du service</h2>
          <p className="mb-4">
            L'éditeur s'efforce d'assurer la continuité et la qualité du service Nuffle Arena, mais
            ne peut garantir une disponibilité ininterrompue. Le service peut être temporairement
            indisponible pour des raisons de maintenance, de mise à jour ou en cas de force majeure.
          </p>
          <p className="mb-4">
            L'éditeur se réserve le droit de modifier, suspendre ou interrompre le service à tout
            moment sans préavis, sans que sa responsabilité ne puisse être engagée.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Limitation de responsabilité</h2>
          <p className="mb-4">
            Le service Nuffle Arena est fourni "tel quel", sans garantie d'aucune sorte. L'éditeur ne
            garantit pas que :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>Le service répondra à toutes vos attentes</li>
            <li>Le service sera ininterrompu, sécurisé ou exempt d'erreurs</li>
            <li>Les résultats obtenus seront exacts ou fiables</li>
            <li>Les défauts seront corrigés</li>
          </ul>
          <p className="mb-4">
            Dans les limites permises par la loi, l'éditeur ne pourra être tenu responsable des
            dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser
            le service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Données utilisateur</h2>
          <p className="mb-4">
            Vous êtes seul responsable des équipes et données que vous créez via Nuffle Arena. L'éditeur
            ne garantit pas la sauvegarde permanente de vos données et ne pourra être tenu responsable
            en cas de perte de données.
          </p>
          <p className="mb-4">
            Il est recommandé de conserver des copies de sauvegarde de vos équipes, notamment via
            l'export PDF disponible sur la plateforme.
          </p>
          <p className="mb-4">
            L'éditeur se réserve le droit de supprimer tout contenu ou compte qui violerait les
            présentes conditions d'utilisation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Résiliation</h2>
          <p className="mb-4">
            Vous pouvez résilier votre compte à tout moment en supprimant votre compte via les
            paramètres de votre profil.
          </p>
          <p className="mb-4">
            L'éditeur se réserve le droit de suspendre ou supprimer votre compte en cas de violation
            des présentes conditions d'utilisation, sans préavis et sans remboursement.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Modifications des conditions</h2>
          <p className="mb-4">
            L'éditeur se réserve le droit de modifier les présentes conditions d'utilisation à tout
            moment. Les modifications entrent en vigueur dès leur publication sur le site.
          </p>
          <p className="mb-4">
            Il est de votre responsabilité de consulter régulièrement ces conditions. Votre
            utilisation continue du service après modification des conditions vaut acceptation
            des nouvelles conditions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Loi applicable et juridiction</h2>
          <p className="mb-4">
            Les présentes conditions d'utilisation sont régies par la loi française. Tout litige
            relatif à l'interprétation ou à l'exécution de ces conditions relève des tribunaux
            français compétents.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Contact</h2>
          <p className="mb-4">
            Pour toute question concernant les présentes conditions d'utilisation, vous pouvez
            nous contacter via les moyens de communication disponibles sur le site.
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

