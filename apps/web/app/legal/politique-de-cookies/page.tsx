import Link from "next/link";

export const metadata = {
  title: "Politique de cookies - Nuffle Arena",
  description:
    "Politique de cookies de Nuffle Arena : informations sur les cookies et technologies de stockage utilisés sur le site.",
};

export default function PolitiqueDeCookiesPage() {
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

      <h1 className="text-4xl font-bold mb-8">Politique de cookies</h1>

      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p className="mb-4">
            La présente politique de cookies a pour objet d&apos;informer les
            utilisateurs du site <strong>Nuffle Arena</strong> (nufflearena.fr) de
            l&apos;utilisation des cookies et des technologies de stockage local,
            conformément à l&apos;article 82 de la loi n° 78-17 du 6 janvier 1978
            (« Loi Informatique et Libertés »), à la directive européenne
            2002/58/CE (« directive ePrivacy ») et au Règlement Général sur la
            Protection des Données (RGPD).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            2. Qu&apos;est-ce qu&apos;un cookie ?
          </h2>
          <p className="mb-4">
            Un <strong>cookie</strong> est un petit fichier texte déposé sur votre
            terminal (ordinateur, tablette, smartphone) lors de la visite d&apos;un
            site web. Il permet au site de mémoriser certaines informations sur
            votre visite, facilitant ainsi vos visites ultérieures et rendant le
            site plus utile pour vous.
          </p>
          <p className="mb-4">
            Le terme « cookie » désigne ici également les technologies similaires
            de stockage local telles que le <strong>localStorage</strong> de votre
            navigateur, qui permettent de stocker des données localement sans les
            transmettre au serveur à chaque requête.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            3. Cookies et technologies utilisés sur Nuffle Arena
          </h2>
          <p className="mb-4">
            Le site Nuffle Arena utilise un nombre limité de cookies et de
            technologies de stockage local, exclusivement à des fins techniques et
            fonctionnelles. <strong>Aucun cookie publicitaire, de suivi ou
            d&apos;analyse (analytics) n&apos;est utilisé.</strong>
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300 rounded-lg mt-4 mb-4">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-300">
                    Nom
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-300">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-300">
                    Finalité
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-300">
                    Durée
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold border-b border-gray-300">
                    Classification
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 text-sm border-b border-gray-200 font-mono">
                    auth_token
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">
                    Cookie HTTP
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">
                    Authentification de l&apos;utilisateur. Contient un jeton JWT
                    permettant de maintenir votre session de connexion.
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">
                    24 heures
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                      Strictement nécessaire
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm border-b border-gray-200 font-mono">
                    language
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">
                    localStorage
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">
                    Mémorisation de votre préférence de langue (français ou
                    anglais) pour personnaliser l&apos;interface.
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">
                    Persistant (jusqu&apos;à suppression manuelle)
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                      Fonctionnel
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono">match_token</td>
                  <td className="px-4 py-3 text-sm">localStorage</td>
                  <td className="px-4 py-3 text-sm">
                    Identification de votre session lors d&apos;un match en ligne.
                    Permet de retrouver votre partie en cours.
                  </td>
                  <td className="px-4 py-3 text-sm">
                    Durée de la session de jeu
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                      Strictement nécessaire
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            4. Classification des cookies
          </h2>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            4.1. Cookies strictement nécessaires
          </h3>
          <p className="mb-4">
            Les cookies <strong>auth_token</strong> et{" "}
            <strong>match_token</strong> sont indispensables au fonctionnement du
            site. Sans eux, il est impossible de vous connecter à votre compte ou
            de participer à un match en ligne.
          </p>
          <p className="mb-4">
            Conformément à l&apos;article 82 de la Loi Informatique et Libertés
            et aux lignes directrices de la CNIL, ces cookies sont{" "}
            <strong>exemptés du recueil préalable du consentement</strong> car ils
            sont strictement nécessaires à la fourniture du service expressément
            demandé par l&apos;utilisateur.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            4.2. Cookies fonctionnels
          </h3>
          <p className="mb-4">
            Le stockage de la préférence de <strong>langue</strong> dans le
            localStorage de votre navigateur est un cookie fonctionnel qui
            améliore votre expérience en mémorisant votre choix de langue. Cette
            donnée reste stockée localement sur votre appareil et n&apos;est pas
            transmise au serveur.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-4">
            4.3. Cookies publicitaires et de suivi
          </h3>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="font-semibold text-green-800">
              Nuffle Arena n&apos;utilise aucun cookie publicitaire, de suivi
              (tracking), d&apos;analyse (analytics) ou de réseau social. Aucune
              donnée de navigation n&apos;est partagée avec des tiers à des fins
              publicitaires.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Base légale</h2>
          <p className="mb-4">
            Le dépôt des cookies sur Nuffle Arena repose sur les bases légales
            suivantes :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Cookies strictement nécessaires (auth_token, match_token) :</strong>{" "}
              exemptés de consentement en vertu de l&apos;article 82 alinéa 2 de
              la Loi Informatique et Libertés (transposition de l&apos;article
              5.3 de la directive ePrivacy). Ces cookies sont indispensables à la
              fourniture du service demandé par l&apos;utilisateur.
            </li>
            <li>
              <strong>Cookies fonctionnels (language) :</strong> le stockage de la
              préférence de langue dans le localStorage est réalisé dans
              l&apos;intérêt légitime de fournir une interface dans la langue
              choisie par l&apos;utilisateur.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            6. Comment gérer les cookies
          </h2>
          <p className="mb-4">
            Vous pouvez à tout moment gérer, désactiver ou supprimer les cookies
            et les données de stockage local via les paramètres de votre
            navigateur :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Google Chrome :</strong> Paramètres → Confidentialité et
              sécurité → Cookies et autres données des sites
            </li>
            <li>
              <strong>Mozilla Firefox :</strong> Paramètres → Vie privée et
              sécurité → Cookies et données de sites
            </li>
            <li>
              <strong>Safari :</strong> Préférences → Confidentialité → Gérer les
              données de sites web
            </li>
            <li>
              <strong>Microsoft Edge :</strong> Paramètres → Cookies et
              autorisations de site → Cookies et données de sites
            </li>
          </ul>
          <p className="mb-4">
            Pour supprimer les données du localStorage, vous pouvez utiliser les
            outils de développement de votre navigateur (généralement accessibles
            via F12 → Application → Local Storage).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            7. Conséquences du refus ou de la suppression des cookies
          </h2>
          <p className="mb-4">
            La désactivation ou la suppression des cookies peut avoir les
            conséquences suivantes :
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
            <li>
              <strong>Suppression du cookie auth_token :</strong> vous serez
              déconnecté et devrez vous reconnecter à chaque visite
            </li>
            <li>
              <strong>Suppression du match_token :</strong> vous pourriez perdre
              l&apos;accès à un match en cours
            </li>
            <li>
              <strong>Suppression de la préférence de langue :</strong> le site
              reviendra à la langue par défaut (français) à chaque visite
            </li>
          </ul>
          <p className="mb-4">
            Le refus des cookies strictement nécessaires rend impossible
            l&apos;utilisation des fonctionnalités nécessitant une connexion
            (gestion d&apos;équipes, matchs en ligne).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            8. Modification de la politique de cookies
          </h2>
          <p className="mb-4">
            La présente politique de cookies peut être modifiée à tout moment pour
            refléter les évolutions du site ou des obligations légales. En cas de
            modification, la date de mise à jour en bas de cette page sera
            actualisée.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Contact</h2>
          <p className="mb-4">
            Pour toute question relative aux cookies utilisés sur Nuffle Arena,
            vous pouvez nous contacter :
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="mb-2">
              <strong>Email :</strong> contact@nufflearena.fr
            </p>
          </div>
          <p className="mt-4 mb-4">
            Pour plus d&apos;informations sur la protection de vos données
            personnelles, consultez notre{" "}
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
          <p className="text-sm text-gray-500 italic">
            Dernière mise à jour : 9 avril 2026
          </p>
        </section>
      </div>
    </div>
  );
}
