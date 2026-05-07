import Link from "next/link";

/**
 * Page marketing Pro League — sprint 1.F.4.
 *
 * Server component (pas d'interactivite). Pitch produit + comment ca
 * marche + features + calendrier + FAQ + disclaimer "no real money".
 *
 * SEO meta dans `./layout.tsx`. JSON-LD parent (SportsLeague + FAQPage)
 * deja injecte par le layout `/pro-league` (sprint 1.F.3).
 */

interface Feature {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly cta: string;
}

const FEATURES: readonly Feature[] = [
  {
    title: "Diffusion live mardi 21h",
    description:
      "8 matchs simulés en parallèle chaque mardi soir, diffusés en direct via SSE avec rendu Pixi + ticker textuel mobile-friendly.",
    href: "/pro-league",
    cta: "Voir la prochaine journee",
  },
  {
    title: "Paris virtuels en Crowns",
    description:
      "6+ marchés par match (Moneyline, Total TDs, MVP, Casualties, Nuffle, Double chance). Cotes dynamiques. Gains crédités automatiquement post-match.",
    href: "/pro-league/leaderboard",
    cta: "Leaderboard parieurs",
  },
  {
    title: "Nuffle Gazette quotidienne",
    description:
      "Articles écrits par IA chaque matin à 8h : 1 article principal + brèves + édito signé par 1 des 3 personas (le cynique, l'enthousiaste orc, le statisticien).",
    href: "/pro-league/gazette",
    cta: "Lire l'edition du jour",
  },
  {
    title: "Hall of Fame légendes",
    description:
      "Snapshot fige des joueurs immortalisés (mort en match, palmares carrière) — nom, race, stats, raison de l'induction restent consultables pour toujours.",
    href: "/pro-league/hall-of-fame",
    cta: "Hall of Fame",
  },
];

interface FAQItem {
  readonly q: string;
  readonly a: string;
}

const FAQ: readonly FAQItem[] = [
  {
    q: "Qu'est-ce que la Pro League ?",
    a: "Une ligue Blood Bowl-like de 16 équipes simulées (hommages NFL × races BB). Les matchs sont joués automatiquement par un engine déterministe, les fans suivent, parient et lisent la Gazette quotidienne.",
  },
  {
    q: "Comment je participe ?",
    a: "Aucune action obligatoire. Tu peux suivre passivement, ouvrir un compte gratuit pour parier en Crowns virtuels, ou suivre une équipe pour recevoir un newsfeed personnalisé.",
  },
  {
    q: "Les paris sont-ils en argent réel ?",
    a: "Non. Les Crowns sont une monnaie 100% virtuelle, créditée à l'inscription et regagnée par bonus quotidiens. Aucun cashout possible, aucun lien avec la monnaie réelle, aucun achat in-app.",
  },
  {
    q: "Pourquoi 16 équipes ?",
    a: "Round-robin classique : 16 équipes × 15 journées = 120 matchs par saison, 8 matchs par journée. Calibré pour aligner sur la saison NFL (septembre → janvier).",
  },
  {
    q: "Comment l'engine garantit-il du fair-play ?",
    a: "Tous les matchs utilisent le même engine déterministe versionné (engineVer figé sur chaque match). Les replays sont stockés en CBOR + gzip et rejouables à l'identique. Les cotes sont gelées au moment du pari (`oddsAtPlace`) — pas de re-pricing rétroactif.",
  },
  {
    q: "Que se passe-t-il quand un joueur meurt en match ?",
    a: "Casualty 'dead' → joueur retiré du roster, entrée automatique au Hall of Fame, rookie procédural généré pour combler le manque. Cycle réaliste qui imite l'attrition Blood Bowl.",
  },
  {
    q: "La Gazette est-elle écrite par un humain ?",
    a: "Non — c'est Claude Haiku qui rédige chaque édition à partir du recap factuel de la veille. Le ton est pulp Blood Bowl-like, signé par 1 des 3 personas. Tout est ancré sur les données réelles du match.",
  },
  {
    q: "Puis-je rejouer un match passé ?",
    a: "Oui. Chaque match completed dispose d'un replay player avec play/pause, scrub bar, vitesse 0.5×–8×, markers sur les key moments (TD/casualty/Nuffle), et raccourcis clavier.",
  },
];

interface ScheduleSlot {
  readonly label: string;
  readonly time: string;
  readonly description: string;
}

const SCHEDULE: readonly ScheduleSlot[] = [
  {
    label: "Mardi",
    time: "21h00",
    description:
      "Kickoff de la journée — 8 matchs simulés en parallèle, broadcast SSE en direct.",
  },
  {
    label: "Mercredi → Lundi",
    time: "8h00",
    description:
      "Édition Nuffle Gazette du jour : article principal + brèves + édito.",
  },
  {
    label: "Quotidien",
    time: "Reset 00h00 UTC",
    description:
      "Bonus de connexion Crowns + 1ʳᵉ visite saison = bonus de bienvenue.",
  },
  {
    label: "Saison",
    time: "15 journées",
    description:
      "Round-robin classique. Saison alignée sur le calendrier NFL 2026-27.",
  },
];

export default function ProLeagueAboutPage(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-8 flex items-center justify-between gap-3">
        <Link
          href="/pro-league"
          className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Hub
        </Link>
      </header>

      <section
        data-testid="about-hero"
        className="mb-10 rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 px-6 py-8"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
          Old World League
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-amber-100 sm:text-4xl">
          La Pro League Nuffle Arena
        </h1>
        <p className="mt-3 text-base text-slate-300">
          Une ligue Blood Bowl-like permanente : 16 équipes simulées, 15
          journées, paris virtuels, Gazette quotidienne et Hall of Fame.
          Chaque mardi 21h, Nuffle décide du destin des plus grandes légendes
          du Vieux Monde.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/pro-league"
            className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500"
          >
            Voir le hub
          </Link>
          <Link
            href="/pro-league/standings"
            className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Classement live
          </Link>
        </div>
      </section>

      <section data-testid="about-howitworks" className="mb-10">
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-100">
          Comment ça marche
        </h2>
        <ol className="flex flex-col gap-3 text-sm text-slate-300">
          <li className="flex gap-3">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-amber-50"
            >
              1
            </span>
            <span>
              <strong className="text-slate-100">Simulation déterministe.</strong>{" "}
              Le sim engine joue chaque match selon un seed et une version
              gelée (`engineVer`). Pas d'aléa caché — tout est rejouable à
              l'identique.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-amber-50"
            >
              2
            </span>
            <span>
              <strong className="text-slate-100">Diffusion live SSE.</strong>{" "}
              À l'heure du kickoff, le broadcaster dispatch les events
              pré-simulés en temps réel. Latence faible, reconnect-friendly
              via Last-Event-ID.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-amber-50"
            >
              3
            </span>
            <span>
              <strong className="text-slate-100">Paris en Crowns.</strong> Les
              cotes sont calculées par pré-simulation (N=200 runs). La cote au
              moment du pari (`oddsAtPlace`) est gelée pour fairness. Settlement
              automatique post-match.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-amber-50"
            >
              4
            </span>
            <span>
              <strong className="text-slate-100">Gazette LLM.</strong> Chaque
              matin 8h, Claude Haiku écrit l'édition du jour à partir du
              recap factuel : 1 article principal + brèves + édito signé.
            </span>
          </li>
        </ol>
      </section>

      <section data-testid="about-features" className="mb-10">
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-100">
          Ce que tu peux faire
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              data-testid="about-feature-card"
              className="flex flex-col rounded border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <h3 className="text-base font-semibold text-amber-100">
                {f.title}
              </h3>
              <p className="mt-1 flex-1 text-sm text-slate-300">
                {f.description}
              </p>
              <Link
                href={f.href}
                className="mt-3 inline-block text-sm font-semibold text-amber-300 hover:text-amber-200"
              >
                {f.cta} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section data-testid="about-schedule" className="mb-10">
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-100">
          Calendrier
        </h2>
        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="w-32 px-3 py-2 text-left">Quand</th>
                <th className="w-24 px-3 py-2 text-left">Heure</th>
                <th className="px-3 py-2 text-left">Quoi</th>
              </tr>
            </thead>
            <tbody>
              {SCHEDULE.map((s) => (
                <tr
                  key={s.label}
                  data-testid="about-schedule-row"
                  className="border-t border-slate-800"
                >
                  <td className="px-3 py-2 font-semibold text-slate-100">
                    {s.label}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-300">
                    {s.time}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {s.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        data-testid="about-faq"
        aria-labelledby="about-faq-heading"
        className="mb-10"
      >
        <h2
          id="about-faq-heading"
          className="mb-3 text-2xl font-bold tracking-tight text-slate-100"
        >
          FAQ
        </h2>
        <ul className="flex flex-col gap-3">
          {FAQ.map((item) => (
            <li
              key={item.q}
              data-testid="about-faq-item"
              className="rounded border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100 group-open:text-amber-200">
                  {item.q}
                </summary>
                <p className="mt-2 text-sm text-slate-300">{item.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <aside
        data-testid="about-disclaimer"
        role="note"
        aria-label="No real money disclaimer"
        className="mb-10 rounded-lg border border-amber-700 bg-amber-950/40 px-5 py-4"
      >
        <h2 className="mb-1 text-base font-semibold text-amber-200">
          🛡 Pas d'argent réel impliqué
        </h2>
        <p className="text-sm text-amber-100/90">
          Les Crowns sont une monnaie de jeu virtuelle. Pas de cashout, pas
          d'achat in-app, pas de lien avec la monnaie réelle. Nuffle Arena
          n'est pas une plateforme de paris sportifs au sens légal — c'est un
          jeu fantasy où la stratégie, les pronostics et l'humour pulp
          remplacent l'argent. La participation est gratuite et sans
          obligation.
        </p>
      </aside>

      <footer className="mt-2 mb-8 flex flex-wrap gap-2">
        <Link
          href="/pro-league"
          className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500"
        >
          Rejoindre le hub →
        </Link>
        <Link
          href="/pro-league/gazette"
          className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Lire la Gazette
        </Link>
      </footer>
    </main>
  );
}
