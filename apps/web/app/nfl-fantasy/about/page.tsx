import Link from "next/link";

export const metadata = {
  title: "Nuffle Coach — À propos",
  description:
    "Nuffle Coach : la NFL repassee a la sauce Blood Bowl. Draft, lineup hebdo, mercato, captains. 100 % fictif, 0 € en jeu.",
};

export default function NuffleCoachAboutPage() {
  return (
    <div className="space-y-10" data-testid="nuffle-coach-about">
      <section
        className="rounded-xl border border-nuffle-gold/30 bg-gradient-to-br from-nuffle-gold/10 via-white to-nuffle-ivory p-8"
        data-testid="nuffle-coach-hero"
      >
        <p className="text-xs uppercase tracking-widest text-nuffle-gold">
          Fantasy mode · Blood Bowl flavor
        </p>
        <h1 className="mt-2 text-3xl font-bold text-nuffle-anthracite sm:text-4xl">
          🏈 Nuffle Coach
        </h1>
        <p className="mt-3 max-w-2xl text-base text-nuffle-anthracite/80">
          Coache une équipe fantasy de joueurs fictifs, inspirés de
          l&apos;univers du football américain et re-imaginés dans la
          rugosité du Vieux Monde de Blood Bowl. Drafte ton roster,
          règle ton lineup chaque semaine, choisis ton capitaine et
          affronte les autres coachs.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/nfl-fantasy/new"
            className="rounded-md bg-nuffle-gold px-4 py-2 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80"
          >
            ➕ Créer un coach
          </Link>
          <Link
            href="/nfl-fantasy/join"
            className="rounded-md border border-nuffle-bronze/30 px-4 py-2 text-sm font-medium text-nuffle-anthracite hover:border-nuffle-gold"
          >
            🤝 Rejoindre
          </Link>
          <Link
            href="/nfl-fantasy/players"
            className="rounded-md border border-nuffle-bronze/30 px-4 py-2 text-sm font-medium text-nuffle-anthracite hover:border-nuffle-gold"
          >
            📋 Catalogue joueurs
          </Link>
        </div>
      </section>

      <section
        className="grid gap-4 sm:grid-cols-3"
        data-testid="nuffle-coach-features"
      >
        {[
          {
            icon: "📋",
            title: "Draft à budget TV",
            body: "Comme à Blood Bowl : un budget Team Value, des joueurs cotés selon leur niveau. À toi de doser stars et lineman pour tenir 22 semaines.",
          },
          {
            icon: "📅",
            title: "Lineup hebdomadaire",
            body: "Choisis ton onze, ton capitaine et ton vice-capitaine. Lock automatique a 17:00 UTC le dimanche.",
          },
          {
            icon: "📊",
            title: "Scoring SPP",
            body: "Stats nflverse converties en BB SPP via la formule Nuffle Coach : completions, TDs, casualties metaphoriques.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-nuffle-bronze/20 bg-white p-4"
          >
            <p className="text-2xl">{f.icon}</p>
            <h3 className="mt-2 text-lg font-semibold text-nuffle-anthracite">
              {f.title}
            </h3>
            <p className="mt-1 text-sm text-nuffle-anthracite/70">{f.body}</p>
          </div>
        ))}
      </section>

      <section data-testid="nuffle-coach-origins">
        <h2 className="text-xl font-semibold text-nuffle-anthracite">
          D&apos;où viennent les joueurs ?
        </h2>
        <div className="mt-4 space-y-4 rounded-lg border border-nuffle-bronze/20 bg-white p-5 text-sm text-nuffle-anthracite/80">
          <p>
            Les coachs et joueurs de Nuffle Coach sont des <strong>créations
            originales inspirées</strong> de l&apos;univers du football
            américain professionnel. Chaque joueur fictif est généré à
            partir de statistiques sportives publiquement disponibles
            (passes complétées, courses, plaquages, etc.) que nous
            convertissons via notre propre formule SPP (Star Player
            Points) — la mécanique de progression de Blood Bowl.
          </p>
          <p>
            Pour rester dans l&apos;esprit Blood Bowl, nous générons un{" "}
            <strong>pseudonyme fantasy</strong> pour chaque joueur (Bjor,
            Grimnok, etc.) et associons chaque franchise à une{" "}
            <strong>race fictive</strong> de l&apos;univers Warhammer
            Fantasy (Skavens, Orques, Nains du Chaos, etc.). Le résultat
            est une compétition parodique qui s&apos;inspire d&apos;un
            sport réel pour proposer une expérience ludique 100 % fictive.
          </p>
          <p>
            <strong>Aucune affiliation</strong> : Nuffle Coach n&apos;est
            ni endossé, ni sponsorisé, ni affilié à la National Football
            League, à ses franchises, à ses joueurs, ni à Games Workshop.
            Les statistiques utilisées proviennent du projet open-source{" "}
            <a
              href="https://nflverse.nflverse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-nuffle-gold underline hover:text-nuffle-red"
            >
              nflverse
            </a>{" "}
            (données publiques agrégées). Aucun logo, aucune marque
            déposée, aucune image officielle n&apos;est utilisée. Aucun
            droit à l&apos;image n&apos;est exploité commercialement —
            Nuffle Coach est un projet de fan, gratuit, sans publicité ni
            monétisation des joueurs.
          </p>
          <p className="text-xs text-nuffle-anthracite/60">
            Si vous estimez qu&apos;un contenu enfreint vos droits,
            contactez-nous via la page Soutenir — nous retirons sans délai.
          </p>
        </div>
      </section>

      <section data-testid="nuffle-coach-faq">
        <h2 className="text-xl font-semibold text-nuffle-anthracite">FAQ</h2>
        <dl className="mt-4 space-y-4">
          {[
            {
              q: "C'est un jeu d'argent ?",
              a: "Non. Aucun argent réel, aucun lot, aucune mise. Nuffle Coach est un mode fantasy ludique skinné Blood Bowl.",
            },
            {
              q: "Quels matchs comptent ?",
              a: "La saison régulière NFL (semaines 1 à 18) + playoffs (W19-22). Stats officielles via nflverse, mises a jour quotidiennement.",
            },
          ].map((item) => (
            <div
              key={item.q}
              className="rounded-lg border border-nuffle-bronze/20 bg-white p-4"
              data-testid="nuffle-coach-faq-item"
            >
              <dt className="font-semibold text-nuffle-anthracite">{item.q}</dt>
              <dd className="mt-1 text-sm text-nuffle-anthracite/80">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700"
        data-testid="nuffle-coach-disclaimer"
      >
        Nuffle Coach est un mode de jeu fictif. Aucun argent réel n&apos;est
        impliqué. Les noms et statistiques NFL sont utilisés a des fins
        d&apos;illustration ludique, sans affiliation a la NFL ou aux
        franchises mentionnées.
      </section>
    </div>
  );
}
