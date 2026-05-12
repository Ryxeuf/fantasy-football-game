"use client";

/**
 * Hub admin Pro League : regroupe les liens vers tous les outils
 * admin Pro League (saisons, sim, broadcaster, replays, health, sandbox).
 *
 * Architecture : une simple grille de cards avec icone + titre +
 * description. Pas de donnees fetch (purement navigation).
 */

import Link from "next/link";

interface HubLink {
  readonly href: string;
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  /** "stable" = production-ready, "beta" = utilisable mais limite. */
  readonly status?: "stable" | "beta";
}

const LINKS: ReadonlyArray<HubLink> = [
  {
    href: "/admin/pro-league/seasons",
    icon: "🏆",
    title: "Saisons",
    description:
      "Creation, clone, regeneration du calendrier, reset des standings, annulation. Detail par saison.",
    status: "stable",
  },
  {
    href: "/admin/pro-league/teams",
    icon: "🎨",
    title: "Branding teams",
    description:
      "Editer les couleurs (primaire/secondaire), motto, headline, ville/nom, flavor NFL d'une team.",
    status: "stable",
  },
  {
    href: "/admin/sim",
    icon: "🎲",
    title: "Sim Pro League",
    description:
      "Drift watcher, comparaison versions engine, run sim ponctuel. Vue d'ensemble du sim-runner.",
    status: "stable",
  },
  {
    href: "/admin/sim/health",
    icon: "❤️",
    title: "Sim Health",
    description:
      "Snapshot des sous-systemes (season, simRunner, gazette, bets). Probes prod-ready.",
    status: "stable",
  },
  {
    href: "/admin/sim/broadcaster",
    icon: "📡",
    title: "Broadcaster",
    description:
      "Stats du broadcaster temps-reel (matches actifs, viewers, push events). Load testing.",
    status: "stable",
  },
  {
    href: "/admin/sim/replays",
    icon: "📜",
    title: "Replays Panel",
    description:
      "Lecture seule des replays panel (validation C6-C9). Pour debug visuel sans toucher prod.",
    status: "stable",
  },
  {
    href: "/admin/sim/test-match",
    icon: "🧪",
    title: "Sandbox Test Match",
    description:
      "Lance un match Pro League sans impact ELO/standings/paris. ~50ms, replay immediat.",
    status: "stable",
  },
];

const STATUS_BADGE: Record<NonNullable<HubLink["status"]>, string> = {
  stable: "bg-green-100 text-green-800",
  beta: "bg-yellow-100 text-yellow-800",
};

export default function AdminProLeagueHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
          🏈 Admin Pro League
        </h1>
        <p className="text-sm text-gray-600">
          Outils de gestion de la ligue virtuelle. Toute action est tracee
          dans le journal d&apos;audit admin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href as any}
            data-testid={`hub-link-${link.href.replace(/\//g, "-")}`}
            className="p-5 rounded-xl border bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-nuffle-gold transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{link.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-nuffle-anthracite">
                    {link.title}
                  </h2>
                  {link.status && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[link.status]}`}
                    >
                      {link.status}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-1">
                  {link.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>Roadmap admin Pro League</strong> : a venir dans les
        prochains sprints : edition individuelle skills/stats joueurs,
        re-simulation d&apos;un match avec nouveau seed, gestion des bet
        markets.
      </div>
    </div>
  );
}
