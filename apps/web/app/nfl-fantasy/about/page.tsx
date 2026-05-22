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
        className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-slate-900/40 to-slate-900/60 p-8"
        data-testid="nuffle-coach-hero"
      >
        <p className="text-xs uppercase tracking-widest text-orange-300/80">
          Fantasy mode · Blood Bowl flavor
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-100 sm:text-4xl">
          🏈 Nuffle Coach
        </h1>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          Coach une équipe fictive composée de joueurs NFL renommés et
          re-skinned à la sauce BB. Drafte, règle ton lineup chaque
          semaine, choisis ton capitaine, batte tes adversaires.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/nfl-fantasy/new"
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
          >
            ➕ Créer un coach
          </Link>
          <Link
            href="/nfl-fantasy/join"
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            🤝 Rejoindre
          </Link>
          <Link
            href="/nfl-fantasy/players"
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
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
            title: "Draft + mercato",
            body: "Snake draft, auction ou free agency, selon ton mode de ligue. Mercato hebdo entre les semaines NFL.",
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
            className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
          >
            <p className="text-2xl">{f.icon}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-100">
              {f.title}
            </h3>
            <p className="mt-1 text-sm text-slate-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section data-testid="nuffle-coach-faq">
        <h2 className="text-xl font-semibold text-slate-100">FAQ</h2>
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
            {
              q: "Pourquoi des pseudos a la place des vrais noms ?",
              a: "V1 : les vrais noms ne sont pas exposes côté UI pour éviter toute confusion avec la NFL réelle. Les pseudos sont generés par hash stable du nom + équipe + jersey.",
            },
            {
              q: "Quelle est la difference avec Pro League ?",
              a: "Pro League = sim BB pure (Old World, ELO, leaderboards). Nuffle Coach = stats NFL réelles converties en SPP. Deux univers indépendants.",
            },
          ].map((item) => (
            <div
              key={item.q}
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
              data-testid="nuffle-coach-faq-item"
            >
              <dt className="font-semibold text-slate-100">{item.q}</dt>
              <dd className="mt-1 text-sm text-slate-300">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200"
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
