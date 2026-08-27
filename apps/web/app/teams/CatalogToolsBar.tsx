"use client";

/**
 * Barre d'accès aux outils d'analyse du catalogue (comparateurs, études,
 * tier list).
 *
 * Ces pages existaient sans point d'entrée : on ne les trouvait qu'en
 * connaissant l'URL. Le composant est monté sur toutes les pages du
 * catalogue d'équipes pour qu'elles soient atteignables d'un clic, et
 * masque l'outil sur lequel on se trouve déjà (`current`).
 */

import Link from "next/link";
import { useLanguage } from "../contexts/LanguageContext";

export type CatalogToolId =
  | "teams"
  | "compare-teams"
  | "positions"
  | "compare-positions"
  | "tier-list";

interface ToolDefinition {
  readonly id: CatalogToolId;
  readonly href: string;
  readonly icon: string;
  readonly fr: { label: string; hint: string };
  readonly en: { label: string; hint: string };
}

const TOOLS: readonly ToolDefinition[] = [
  {
    id: "teams",
    href: "/teams",
    icon: "⚽",
    fr: { label: "Tous les rosters", hint: "Le catalogue complet" },
    en: { label: "All rosters", hint: "The full catalogue" },
  },
  {
    id: "compare-teams",
    href: "/teams/comparer",
    icon: "⚔️",
    fr: { label: "Comparer des équipes", hint: "Deux rosters côte à côte" },
    en: { label: "Compare rosters", hint: "Two rosters side by side" },
  },
  {
    id: "positions",
    href: "/teams/positions",
    icon: "📊",
    fr: { label: "Études des positions", hint: "Classements par stat" },
    en: { label: "Position studies", hint: "Rankings by stat" },
  },
  {
    id: "compare-positions",
    href: "/teams/positions/comparer",
    icon: "🔬",
    fr: { label: "Comparer des positions", hint: "Jusqu'à 4 postes" },
    en: { label: "Compare positions", hint: "Up to 4 positions" },
  },
  {
    id: "tier-list",
    href: "/teams/tier-list",
    icon: "🏅",
    fr: { label: "Tier list", hint: "Les rosters par palier" },
    en: { label: "Tier list", hint: "Rosters by tier" },
  },
];

export default function CatalogToolsBar({
  current,
  className = "",
}: {
  /** Outil courant : retiré de la barre (on y est déjà). */
  current?: CatalogToolId;
  className?: string;
}) {
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "fr";
  const visible = TOOLS.filter((tool) => tool.id !== current);

  return (
    <nav
      aria-label={lang === "en" ? "Catalogue tools" : "Outils du catalogue"}
      data-testid="catalog-tools"
      className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${className}`}
    >
      {visible.map((tool) => (
        <Link
          key={tool.id}
          href={tool.href}
          data-testid={`catalog-tool-${tool.id}`}
          className="group flex flex-col rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow"
        >
          <span className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700">
            <span aria-hidden="true">{tool.icon}</span> {tool[lang].label}
          </span>
          <span className="mt-0.5 text-xs text-gray-500">{tool[lang].hint}</span>
        </Link>
      ))}
    </nav>
  );
}
