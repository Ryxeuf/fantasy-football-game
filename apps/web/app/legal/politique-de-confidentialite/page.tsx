import Link from "next/link";

export const metadata = {
  title: "Politique de confidentialité - Nuffle Arena",
  description:
    "Politique de confidentialité et protection des données personnelles de Nuffle Arena, conformément au RGPD.",
};

export default function PolitiqueDeConfidentialitePage() {
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
        Politique de confidentialité
      </h1>

      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p className="mb-4">
            La présente politique de confidentialité a pour objet d&apos;informer les
            utilisateurs du site <strong>Nuffle Arena</strong> (accessible à
            l&apos;adresse nufflearena.fr) de la manière dont leurs données
            personnelles sont collectées, traitées et protégées, conformément au
            Règlement Général sur la Protection des Données (RGPD - Règlement UE
            2016/679) et à la loi n° 78-17 du 6 janvier 1978 relative à
            l&apos;informatique, aux fichiers et aux libertés (dite « Loi
            Informatique et Libertés »).
          </p>
          <p className="mb-4">
            En utilisant le site Nuffle Arena et en créant un compte, vous
            acceptez les pratiques décrites dans la présente politique de
            confidentialité.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            2. Responsable du traitement
          </h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="mb-2">
              <strong>Responsable du traitement :</strong> Ryxeuf (personne
              physique)
            </p>
            <p className="mb-2">
              <strong>Site web :</strong> nufflearena.fr
            </p>
            <p className="mb-2">
              <strong>Email de contact :</strong>{" "}
              contact@nufflearena.fr
            </p>
          </div>
          <p className="mt-4 mb-4">
            Le responsable du traitement détermine les finalités et les moyens du
            traitement des données personnelles collectées sur le site.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            3. Données personnelles collectées
          </h2>
          <p className="mb-4">
            Dans le cadre de l&apos;utilisation du site Nuffle Arena, les données
            personnelles suivantes peuvent être collectées :
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            3.1. Données fournies lors de l&apos;inscription
          </h3>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Adresse e-mail</strong> (obligatoire) — utilisée pour
              l&apos;identification et la connexion
            </li>
            <li>
              <strong>Nom de coach</strong> (obligatoire) — pseudonyme affiché
              sur la plateforme
            </li>
            <li>
              <strong>Prénom</strong> (facultatif)
            </li>
            <li>
              <strong>Nom de famille</strong> (facultatif)
            </li>
            <li>
              <strong>Date de naissance</strong> (facultative) — utilisée pour
              vérifier l&apos;âge minimum requis
            </li>
            <li>
              <strong>Mot de passe</strong> — stocké sous forme hachée
              (chiffrement irréversible via bcryptjs), jamais en clair
            </li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            3.2. Données techniques et de navigation
          </h3>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Jeton d&apos;authentification (auth_token)</strong> — cookie
              JWT nécessaire au maintien de la session, durée de 24 heures
            </li>
            <li>
              <strong>Préférence de langue</strong> — stockée localement dans
              votre navigateur (localStorage)
            </li>
            <li>
              <strong>Jeton de match (match_token)</strong> — stocké localement
              dans votre navigateur pour les sessions de jeu en cours
            </li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            3.3. Données liées à l&apos;utilisation du service
          </h3>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Équipes créées</strong> — compositions, noms, budgets,
              joueurs recrutés
            </li>
            <li>
              <strong>Historique de matchs</strong> — résultats des parties en
              ligne
            </li>
            <li>
              <strong>Classement ELO</strong> — score calculé à partir des
              résultats de matchs
            </li>
            <li>
              <strong>Dates de création et de mise à jour</strong> du compte
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            4. Finalités du traitement
          </h2>
          <p className="mb-4">
            Vos données personnelles sont collectées et traitées pour les
            finalités suivantes :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Gestion des comptes utilisateurs :</strong> création,
              authentification et administration de votre compte
            </li>
            <li>
              <strong>Fourniture du service :</strong> création et gestion
              d&apos;équipes Blood Bowl, participation aux matchs en ligne,
              calcul du classement ELO
            </li>
            <li>
              <strong>Sécurité :</strong> protection de votre compte par
              hachage du mot de passe et authentification par jeton JWT
            </li>
            <li>
              <strong>Personnalisation :</strong> mémorisation de votre
              préférence de langue
            </li>
            <li>
              <strong>Communication :</strong> réponse à vos demandes de
              contact et notifications liées au service
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            5. Base légale du traitement
          </h2>
          <p className="mb-4">
            Conformément à l&apos;article 6 du RGPD, le traitement de vos données
            repose sur les bases légales suivantes :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Exécution du contrat</strong> (Article 6.1.b) — le
              traitement est nécessaire à la fourniture du service Nuffle Arena
              tel que décrit dans les{" "}
              <Link
                href="/legal/conditions-utilisation"
                className="text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                conditions d&apos;utilisation
              </Link>
            </li>
            <li>
              <strong>Consentement</strong> (Article 6.1.a) — vous consentez au
              traitement de vos données en créant un compte et en acceptant la
              présente politique
            </li>
            <li>
              <strong>Intérêt légitime</strong> (Article 6.1.f) — sécurisation
              du service, prévention des abus et amélioration de la plateforme
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            6. Durée de conservation des données
          </h2>
          <p className="mb-4">
            Vos données personnelles sont conservées selon les durées suivantes :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Données de compte</strong> (email, nom de coach, prénom,
              nom, date de naissance) — conservées pendant toute la durée
              d&apos;existence de votre compte, puis supprimées dans un délai
              raisonnable après la suppression du compte
            </li>
            <li>
              <strong>Mot de passe haché</strong> — conservé pendant la durée de
              vie du compte, supprimé avec celui-ci
            </li>
            <li>
              <strong>Données de jeu</strong> (équipes, matchs, ELO) —
              conservées pendant la durée de vie du compte
            </li>
            <li>
              <strong>Jeton d&apos;authentification</strong> — expire
              automatiquement après 24 heures
            </li>
            <li>
              <strong>Données de navigation locales</strong> (langue, match_token)
              — stockées dans votre navigateur et supprimables à tout moment par
              vous
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            7. Destinataires des données
          </h2>
          <p className="mb-4">
            Vos données personnelles ne sont communiquées à aucun tiers à des
            fins commerciales ou publicitaires.
          </p>
          <p className="mb-4">
            Les seuls destinataires de vos données sont :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>L&apos;éditeur du site</strong> (Ryxeuf) — pour
              l&apos;administration et la maintenance du service
            </li>
            <li>
              <strong>L&apos;hébergeur du site</strong> — dans le cadre
              strictement nécessaire à l&apos;hébergement technique (voir les{" "}
              <Link
                href="/legal/mentions-legales"
                className="text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                mentions légales
              </Link>{" "}
              pour les coordonnées de l&apos;hébergeur)
            </li>
          </ul>
          <p className="mb-4">
            Aucune donnée n&apos;est vendue, louée ou mise à disposition de tiers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            8. Transferts internationaux de données
          </h2>
          <p className="mb-4">
            Les données collectées sont hébergées au sein de l&apos;Union
            européenne ou dans des pays reconnus comme offrant un niveau de
            protection adéquat par la Commission européenne. En cas de transfert
            vers un pays tiers, des garanties appropriées (clauses contractuelles
            types, par exemple) seront mises en place conformément au RGPD.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            9. Sécurité des données
          </h2>
          <p className="mb-4">
            Nuffle Arena met en œuvre des mesures techniques et organisationnelles
            appropriées pour protéger vos données personnelles contre tout accès
            non autorisé, modification, divulgation ou destruction :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Hachage des mots de passe :</strong> les mots de passe sont
              hachés avec l&apos;algorithme bcrypt avant stockage (chiffrement
              irréversible)
            </li>
            <li>
              <strong>Authentification sécurisée :</strong> utilisation de jetons
              JWT (JSON Web Token) avec expiration automatique
            </li>
            <li>
              <strong>Connexion chiffrée :</strong> le site utilise le protocole
              HTTPS pour sécuriser les échanges de données
            </li>
            <li>
              <strong>Accès restreint :</strong> seul l&apos;éditeur a accès aux
              données d&apos;administration
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            10. Vos droits (Articles 15 à 22 du RGPD)
          </h2>
          <p className="mb-4">
            Conformément au RGPD et à la Loi Informatique et Libertés, vous
            disposez des droits suivants sur vos données personnelles :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Droit d&apos;accès</strong> (Article 15) — obtenir la
              confirmation que vos données sont traitées et en recevoir une copie
            </li>
            <li>
              <strong>Droit de rectification</strong> (Article 16) — faire
              corriger des données inexactes ou incomplètes
            </li>
            <li>
              <strong>Droit à l&apos;effacement</strong> (Article 17, « droit à
              l&apos;oubli ») — demander la suppression de vos données
              personnelles
            </li>
            <li>
              <strong>Droit à la limitation du traitement</strong> (Article 18) —
              obtenir la limitation du traitement dans certains cas
            </li>
            <li>
              <strong>Droit à la portabilité</strong> (Article 20) — recevoir vos
              données dans un format structuré, couramment utilisé et lisible par
              machine
            </li>
            <li>
              <strong>Droit d&apos;opposition</strong> (Article 21) — vous
              opposer au traitement de vos données pour des motifs légitimes
            </li>
            <li>
              <strong>Droit de retirer votre consentement</strong> — à tout
              moment, sans que cela n&apos;affecte la licéité du traitement
              effectué avant le retrait
            </li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            Comment exercer vos droits
          </h3>
          <p className="mb-4">
            Pour exercer l&apos;un de ces droits, vous pouvez :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              Envoyer un email à{" "}
              <strong>contact@nufflearena.fr</strong> en précisant
              votre demande et les informations permettant de vous identifier
            </li>
            <li>
              Supprimer votre compte directement depuis les paramètres de votre
              profil sur le site (ce qui entraînera la suppression de vos données)
            </li>
          </ul>
          <p className="mb-4">
            Nous nous engageons à répondre à votre demande dans un délai d&apos;un
            mois à compter de sa réception, conformément au RGPD.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            Réclamation auprès de la CNIL
          </h3>
          <p className="mb-4">
            Si vous estimez que le traitement de vos données personnelles
            constitue une violation du RGPD, vous avez le droit d&apos;introduire
            une réclamation auprès de la Commission Nationale de l&apos;Informatique
            et des Libertés (CNIL) :
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="mb-2">
              <strong>CNIL</strong> — Commission Nationale de l&apos;Informatique
              et des Libertés
            </p>
            <p className="mb-2">3 Place de Fontenoy, TSA 80715</p>
            <p className="mb-2">75334 Paris Cedex 07</p>
            <p className="mb-2">Téléphone : 01 53 73 22 22</p>
            <p>
              Site web : cnil.fr
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            11. Données des mineurs
          </h2>
          <p className="mb-4">
            Conformément à l&apos;article 8 du RGPD et à l&apos;article 45 de la Loi
            Informatique et Libertés, l&apos;utilisation de Nuffle Arena est
            réservée aux personnes âgées de <strong>16 ans ou plus</strong>.
          </p>
          <p className="mb-4">
            Si vous avez moins de 16 ans, vous ne devez pas créer de compte ni
            utiliser le service sans l&apos;autorisation et la supervision de vos
            parents ou tuteurs légaux.
          </p>
          <p className="mb-4">
            Si nous apprenons qu&apos;un utilisateur de moins de 16 ans a créé un
            compte sans consentement parental, nous prendrons les mesures
            nécessaires pour supprimer ce compte et les données associées dans les
            meilleurs délais.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            12. Cookies et technologies similaires
          </h2>
          <p className="mb-4">
            Le site Nuffle Arena utilise des cookies et des technologies de
            stockage local. Pour en savoir plus sur les cookies utilisés, leur
            finalité et la manière de les gérer, veuillez consulter notre{" "}
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
            13. Modification de la politique de confidentialité
          </h2>
          <p className="mb-4">
            La présente politique de confidentialité peut être modifiée à tout
            moment afin de se conformer aux évolutions légales ou réglementaires,
            ou pour refléter des changements dans le fonctionnement du site.
          </p>
          <p className="mb-4">
            En cas de modification substantielle, les utilisateurs seront informés
            par un avis visible sur le site. La date de dernière mise à jour
            figurant en bas de cette page sera actualisée en conséquence.
          </p>
          <p className="mb-4">
            L&apos;utilisation continue du site après modification de la politique
            vaut acceptation des nouvelles dispositions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">14. Contact</h2>
          <p className="mb-4">
            Pour toute question relative à la présente politique de
            confidentialité ou au traitement de vos données personnelles, vous
            pouvez contacter le responsable du traitement :
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="mb-2">
              <strong>Email :</strong> contact@nufflearena.fr
            </p>
            <p>
              <strong>Objet recommandé :</strong> « Données personnelles — [votre
              demande] »
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
