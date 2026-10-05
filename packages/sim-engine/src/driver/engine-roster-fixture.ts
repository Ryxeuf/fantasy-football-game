/**
 * Lot 1 « match complet » — rosters de 13 joueurs tirés du catalogue du
 * moteur (`TEAM_ROSTERS`), pour que les mesures (perf, comparaison,
 * invariants) portent sur de VRAIS matchs à 22 joueurs.
 *
 * Sans `roster`, le full driver retombe sur `setup()` du moteur, soit
 * 2 contre 2 : c'est ce que mesuraient `sim:perf` et `sim:compare` avant
 * ce lot, et leurs chiffres ne décrivaient pas un match.
 *
 * Composition déterministe : les minimums du roster, puis les positionnels
 * en tour de rôle jusqu'à `size - 4`, puis des Trois-quarts.
 */

import { TEAM_ROSTERS } from '@bb/game-engine';

import type { SimInput, SimRosterPlayer } from '../types';
import type { ProTeamProfile } from '../tactics/race-profiles';

interface CataloguePosition {
  readonly displayName: string;
  readonly min: number;
  readonly max: number;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number;
  readonly av: number;
  readonly skills?: string;
}

/** Race Pro League (libellé) → slug de roster du moteur. */
export const RACE_TO_ROSTER_SLUG: Readonly<Record<string, string>> = {
  Orc: 'orc',
  'Wood Elf': 'wood_elf',
  Skaven: 'skaven',
  Dwarf: 'dwarf',
  Halfling: 'halfling',
  Ogre: 'ogre',
  Lizardmen: 'lizardmen',
  'Dark Elf': 'dark_elf',
  Undead: 'undead',
  'Tomb Kings': 'tomb_kings',
  Beastmen: 'chaos_chosen',
  Human: 'human',
  Amazon: 'amazon',
  Norse: 'norse',
  'High Elf': 'high_elf',
  'Chaos Chosen': 'chaos_chosen',
};

export function rosterSlugForRace(race: string): string | undefined {
  const direct = RACE_TO_ROSTER_SLUG[race];
  if (direct && direct in TEAM_ROSTERS) return direct;
  const guess = race.toLowerCase().replace(/\s+/g, '_');
  return guess in TEAM_ROSTERS ? guess : undefined;
}

/**
 * Construit un roster de `size` joueurs (13 par défaut) pour le slug donné.
 * Lève si le slug est inconnu du catalogue.
 */
export function buildEngineRoster(
  prefix: string,
  slug: string,
  size = 13,
): SimRosterPlayer[] {
  const def = (TEAM_ROSTERS as Record<string, { positions: ReadonlyArray<CataloguePosition> }>)[
    slug
  ];
  if (!def) {
    throw new Error(
      `Roster inconnu du catalogue moteur : ${slug} (connus : ${Object.keys(TEAM_ROSTERS).join(', ')})`,
    );
  }
  const counts = def.positions.map((p) => Math.min(p.min, p.max));
  let total = counts.reduce((a, b) => a + b, 0);
  const positional = def.positions
    .map((p, i) => [p, i] as const)
    .filter(([p]) => p.max < 16);
  let progressed = true;
  while (total < size - 4 && progressed) {
    progressed = false;
    for (const [p, i] of positional) {
      if (total >= size - 4) break;
      if (counts[i] < p.max) {
        counts[i] += 1;
        total += 1;
        progressed = true;
      }
    }
  }
  const lineIdx = def.positions.findIndex((p) => p.max >= 16);
  while (total < size && lineIdx >= 0) {
    counts[lineIdx] += 1;
    total += 1;
  }
  const roster: SimRosterPlayer[] = [];
  let n = 1;
  def.positions.forEach((p, i) => {
    for (let k = 0; k < counts[i]; k++) {
      roster.push({
        id: `${prefix}-${n}`,
        name: `${prefix} ${p.displayName} ${n}`,
        number: n,
        position: p.displayName,
        ma: p.ma,
        st: p.st,
        ag: p.ag,
        pa: p.pa,
        av: p.av,
        skills: p.skills
          ? p.skills
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      });
      n += 1;
    }
  });
  return roster;
}

/**
 * `SimInput` complet (profil tactique, VE, roster de 13 joueurs dérivé de la
 * race) pour deux profils Pro League. C'est l'entrée que doivent utiliser
 * toutes les MESURES (perf, comparaison, invariants) : elle correspond à ce
 * que le serveur envoie en production.
 */
export function buildEngineSimInput(
  home: ProTeamProfile,
  away: ProTeamProfile,
  seed: number,
): SimInput {
  const homeSlug = rosterSlugForRace(home.race);
  const awaySlug = rosterSlugForRace(away.race);
  return {
    seed,
    home: {
      id: home.id,
      name: home.name,
      side: 'home',
      tactics: home.tactics,
      tv: home.tv,
      roster: homeSlug ? buildEngineRoster('home', homeSlug) : undefined,
    },
    away: {
      id: away.id,
      name: away.name,
      side: 'away',
      tactics: away.tactics,
      tv: away.tv,
      roster: awaySlug ? buildEngineRoster('away', awaySlug) : undefined,
    },
  };
}
