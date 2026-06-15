import { describe, it, expect } from 'vitest';
import { TEAM_ROSTERS_BY_RULESET } from './positions';
import { POSITION_NAMES_EN, getPositionNameEn } from './position-names-en';

function season3Slugs(): Set<string> {
  const slugs = new Set<string>();
  for (const roster of Object.values(TEAM_ROSTERS_BY_RULESET.season_3)) {
    for (const p of roster.positions) slugs.add(p.slug);
  }
  return slugs;
}

describe('POSITION_NAMES_EN', () => {
  it('ne reference que des slugs de positions season_3 existants', () => {
    const valid = season3Slugs();
    const unknown = Object.keys(POSITION_NAMES_EN).filter(slug => !valid.has(slug));
    expect(unknown).toEqual([]);
  });

  it('retourne le nom anglais pour un slug connu, undefined sinon', () => {
    expect(getPositionNameEn('skaven_coureur_d_egouts')).toBe('Gutter Runner');
    expect(getPositionNameEn('human_blitzer')).toBe('Human Blitzer');
    expect(getPositionNameEn('lizardmen_bloqueur_saurus')).toBe('Saurus Blocker');
    expect(getPositionNameEn('slug_inexistant')).toBeUndefined();
  });

  it('couvre une part significative des positions season_3', () => {
    const total = Object.values(TEAM_ROSTERS_BY_RULESET.season_3).reduce(
      (n, r) => n + r.positions.length,
      0
    );
    const covered = Object.keys(POSITION_NAMES_EN).length;
    expect(covered / total).toBeGreaterThan(0.6);
  });
});
