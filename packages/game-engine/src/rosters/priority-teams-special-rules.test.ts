import { describe, it, expect } from 'vitest';
import {
  PRIORITY_TEAM_ROSTERS,
  getStarPlayersHirableByPriorityTeams,
} from './priority-teams';
import type { StarPlayerDefinition } from './star-players';

/**
 * P2.8 — Ecrire les special rules manquantes des star players hirables par
 * les 5 equipes prioritaires.
 *
 * Ces tests figent la qualite minimale du contenu de chaque `specialRule` pour
 * eviter toute regression (retour a un texte fallback generique ou a un simple
 * copier-coller de la definition du skill de base).
 *
 * Les seuils sont deliberement conservateurs : ils refletent le format attendu
 * par la DDB contenu ("Nom : description mecanique...", entre 80 et 500 chars)
 * et laissent la latitude d'ecriture necessaire au pole contenu.
 */

const FALLBACK_PATTERN = /^Consultez le Livre de Règles Blood Bowl/;
const MIN_RULE_LENGTH = 80;
const MAX_RULE_LENGTH = 500;

/**
 * Duos officiels qui partagent une meme regle speciale — exception documentee
 * dans star-players.test.ts et preservee ici pour coherence.
 */
const SHARED_RULE_SLUGS = new Set(['grak', 'crumbleberry']);

function collectUniqueStars(): StarPlayerDefinition[] {
  const map = getStarPlayersHirableByPriorityTeams('season_2');
  const seen = new Set<string>();
  const unique: StarPlayerDefinition[] = [];
  for (const roster of PRIORITY_TEAM_ROSTERS) {
    for (const star of map[roster]) {
      if (seen.has(star.slug)) continue;
      seen.add(star.slug);
      unique.push(star);
    }
  }
  return unique;
}

describe('P2.8 — Qualite des special rules (5 equipes prioritaires)', () => {
  const stars = collectUniqueStars();

  it('chaque star player expose une specialRule non vide et non fallback', () => {
    for (const star of stars) {
      expect(star.specialRule, `${star.slug} sans specialRule`).toBeTruthy();
      expect(
        FALLBACK_PATTERN.test(star.specialRule ?? ''),
        `${star.slug} a une specialRule fallback`,
      ).toBe(false);
    }
  });

  it(`chaque specialRule fait entre ${MIN_RULE_LENGTH} et ${MAX_RULE_LENGTH} caracteres`, () => {
    for (const star of stars) {
      const rule = star.specialRule ?? '';
      expect(
        rule.length,
        `${star.slug}: specialRule trop courte (${rule.length} chars) — ${rule}`,
      ).toBeGreaterThanOrEqual(MIN_RULE_LENGTH);
      expect(
        rule.length,
        `${star.slug}: specialRule trop longue (${rule.length} chars)`,
      ).toBeLessThanOrEqual(MAX_RULE_LENGTH);
    }
  });

  it('chaque specialRule mentionne explicitement le nom du star player ou la mecanique', () => {
    // La regle doit reconnecter le joueur a son effet : soit en le nommant,
    // soit en decrivant une mecanique forte (Une fois par match, +1, etc.).
    const mechanicMarkers = [
      'une fois par match',
      'une fois par partie',
      '+1',
      '+2',
      '-1',
      '-2',
      'relancer',
      'relance',
      'ignorer',
      'traverser',
      'immunis',
      'double',
    ];
    for (const star of stars) {
      const rule = (star.specialRule ?? '').toLowerCase();
      const firstName = star.displayName.split(/[\s']/)[0]?.toLowerCase() ?? '';
      const hasName = firstName.length > 2 && rule.includes(firstName);
      const hasMechanic = mechanicMarkers.some((marker) =>
        rule.includes(marker),
      );
      expect(
        hasName || hasMechanic,
        `${star.slug}: specialRule ne nomme ni le joueur ni une mecanique concrete — ${star.specialRule}`,
      ).toBe(true);
    }
  });

  it('les specialRule sont uniques sauf pour le duo Grak/Crumbleberry', () => {
    const byRule = new Map<string, string[]>();
    for (const star of stars) {
      const key = (star.specialRule ?? '').trim();
      if (!key) continue;
      const bucket = byRule.get(key) ?? [];
      bucket.push(star.slug);
      byRule.set(key, bucket);
    }
    for (const [rule, slugs] of byRule.entries()) {
      if (slugs.length <= 1) continue;
      const allShared = slugs.every((slug) => SHARED_RULE_SLUGS.has(slug));
      expect(
        allShared,
        `Regle dupliquee par plusieurs stars: ${slugs.join(', ')} — "${rule}"`,
      ).toBe(true);
    }
  });

  it('aucune specialRule ne se resume au nom du skill sans description', () => {
    // Heuristique : si la regle tient en un seul mot-cle (ex. "Slayer: ..."),
    // elle doit quand meme decrire un effet en plusieurs propositions.
    for (const star of stars) {
      const rule = star.specialRule ?? '';
      const beforeColon = rule.split(/[:：]/)[0]?.trim() ?? '';
      const afterColon = rule.slice(beforeColon.length + 1).trim();
      expect(
        afterColon.length,
        `${star.slug}: description apres ":" trop courte — ${rule}`,
      ).toBeGreaterThanOrEqual(40);
    }
  });
});
