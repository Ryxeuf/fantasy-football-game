"use client";

/**
 * Layout commun pour toutes les pages /admin/nfl-fantasy/*. Fournit :
 * - SeasonContext (liste NflSeason + saison selectionnee persistee en
 *   URL ?season=YYYY)
 * - SubNav (Actions / Équipes / Joueurs)
 * - SeasonPicker (dropdown affiche en permanence pour tous les onglets)
 *
 * Phase 3.C — C.0.
 */

import { Suspense, type ReactNode } from "react";

import {
  NflFantasySeasonProvider,
} from "./_components/SeasonContext";
import SeasonPicker from "./_components/SeasonPicker";
import SubNav from "./_components/SubNav";

export default function NflFantasyAdminLayout({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <Suspense fallback={null}>
      <NflFantasySeasonProvider>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SubNav />
            <SeasonPicker />
          </div>
          <div>{children}</div>
        </div>
      </NflFantasySeasonProvider>
    </Suspense>
  );
}
