"use client";
import type { ReactNode } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { OFFLINE_MATCH_FLAG } from "../../lib/featureFlagKeys";
import {
  BlockDie,
  EmblemCup,
  EmblemPdf,
  EmblemRosters,
  EmblemSkills,
  EmblemStar,
  EmblemTabletop,
  EmblemTutorial,
} from "./NuffleArt";
import SectionTitle from "./SectionTitle";
import { buildHomeTiles, type HomeTileKey } from "./home-tiles";

const TILE_ICONS: Record<HomeTileKey, ReactNode> = {
  rosters: <EmblemRosters />,
  starPlayers: <EmblemStar />,
  skills: <EmblemSkills />,
  rules: <EmblemTabletop />,
  gameAid: <BlockDie face="push" />,
  tierList: <EmblemCup />,
  tutorial: <EmblemTutorial />,
  exportPdf: <EmblemPdf />,
  localMatches: <BlockDie face="bothdown" />,
};

/** Catalogue de référence en tuiles compactes (icône, titre, une ligne). */
export default function CompendiumTiles() {
  const { t } = useLanguage();
  const offlineMatchEnabled = useFeatureFlag(OFFLINE_MATCH_FLAG);
  const tiles = buildHomeTiles({ offlineMatchEnabled });

  return (
    <section
      data-testid="home-compendium"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14"
    >
      <SectionTitle kicker={t.home.featuresKicker} title={t.home.discoverTitle} />
      <ul className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {tiles.map((tile) => {
          const text = t.home.tiles[tile.key];
          return (
            <li key={tile.key}>
              <a
                href={tile.href}
                data-testid={`home-tile-${tile.key}`}
                className="group flex h-full items-start gap-3 rounded-xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-3 sm:p-4 shadow-[0_2px_10px_rgba(107,78,46,0.06)] hover:border-nuffle-gold/60 hover:shadow-[0_8px_22px_rgba(107,78,46,0.12)] hover:-translate-y-0.5 transition-all"
              >
                <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1B1610] text-nuffle-gold ring-1 ring-nuffle-gold/40 [&>svg]:h-6 [&>svg]:w-6">
                  {TILE_ICONS[tile.key]}
                </span>
                <span className="min-w-0">
                  <span className="block font-heading font-bold text-sm sm:text-base leading-tight text-nuffle-anthracite group-hover:text-nuffle-bronze">
                    {text.title}
                  </span>
                  <span className="mt-1 block text-xs sm:text-sm leading-snug font-body text-nuffle-anthracite/70">
                    {text.desc}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
