"use client";

/**
 * Sous-navigation horizontale au-dessus des pages /admin/nfl-fantasy/*.
 * Active visuellement la section courante via `usePathname`.
 *
 * Phase 3.C — C.0.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TabDef {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
  readonly exact?: boolean;
}

const TABS: ReadonlyArray<TabDef> = [
  { href: "/admin/nfl-fantasy", label: "Actions", icon: "🎛️", exact: true },
  { href: "/admin/nfl-fantasy/teams", label: "Équipes", icon: "🏈" },
  { href: "/admin/nfl-fantasy/players", label: "Joueurs", icon: "🐀" },
];

function isActive(tab: TabDef, pathname: string | null): boolean {
  if (!pathname) return false;
  if (tab.exact) return pathname === tab.href;
  return pathname.startsWith(tab.href);
}

export default function SubNav(): JSX.Element {
  const pathname = usePathname();
  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-gray-200"
      data-testid="nfl-fantasy-admin-subnav"
    >
      {TABS.map((tab) => {
        const active = isActive(tab, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href as never}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-nuffle-gold text-nuffle-anthracite"
                : "border-transparent text-gray-500 hover:text-nuffle-anthracite"
            }`}
            data-testid={`nfl-fantasy-admin-tab-${tab.href.replace(/\//g, "-")}`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
