/**
 * Tests de conformite Blood Bowl Saison 3
 *
 * Valide systematiquement que les rosters implementes dans season3-rosters.ts
 * sont conformes aux regles officielles de la Saison 3 (2025).
 *
 * Strategie de validation :
 * 1. Contraintes structurelles (budget, tiers, nombre d'equipes)
 * 2. Plages de stats valides (MA, ST, AG, PA, AV)
 * 3. Coherence des positions (min/max, couts, lineman type)
 * 4. Cross-validation avec les donnees de reference
 * 5. Coherence des skills (slugs valides)
 */

import { describe, it, expect } from 'vitest';
import { SEASON_THREE_ROSTERS } from './season3-rosters';
import {
  SEASON_3_REFERENCE,
  STRUCTURAL_RULES,
} from './season3-reference-data';
import type { TeamRoster, PositionDefinition } from './positions';

// ─── Helper : parse les skills d'une position en tableau trie ─────────

function parseSkills(skillsStr: string): string[] {
  if (!skillsStr || skillsStr.trim() === '') return [];
  return skillsStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}

// ─── 1. Tests structurels globaux ────────────────────────────────────────

describe('S3 Rules Validation: Structure globale', () => {
  const rosterKeys = Object.keys(SEASON_THREE_ROSTERS);

  it(`devrait contenir exactement ${STRUCTURAL_RULES.expectedTeamCount} equipes`, () => {
    expect(rosterKeys.length).toBe(STRUCTURAL_RULES.expectedTeamCount);
  });

  it('devrait avoir un budget de depart de 1000 pour chaque equipe', () => {
    for (const key of rosterKeys) {
      const roster = SEASON_THREE_ROSTERS[key];
      expect(roster.budget, `${key} budget`).toBe(
        STRUCTURAL_RULES.startingBudget
      );
    }
  });

  it('devrait avoir un tier valide (I, II, III ou IV) pour chaque equipe', () => {
    for (const key of rosterKeys) {
      const roster = SEASON_THREE_ROSTERS[key];
      expect(
        (STRUCTURAL_RULES.validTiers as readonly string[]).includes(
          roster.tier
        ),
        `${key} tier "${roster.tier}" invalide`
      ).toBe(true);
    }
  });

  it('devrait avoir un nom non vide pour chaque equipe', () => {
    for (const key of rosterKeys) {
      expect(
        SEASON_THREE_ROSTERS[key].name.length,
        `${key} nom vide`
      ).toBeGreaterThan(0);
    }
  });

  it('devrait avoir au moins 2 types de positions par equipe', () => {
    for (const key of rosterKeys) {
      expect(
        SEASON_THREE_ROSTERS[key].positions.length,
        `${key} positions`
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── 2. Validation des stats par position ────────────────────────────────

describe('S3 Rules Validation: Plages de stats', () => {
  const { statRanges } = STRUCTURAL_RULES;

  for (const [teamKey, roster] of Object.entries(SEASON_THREE_ROSTERS)) {
    describe(`${roster.name} (${teamKey})`, () => {
      for (const pos of roster.positions) {
        describe(`${pos.displayName}`, () => {
          it(`MA (${pos.ma}) dans la plage [${statRanges.ma.min}-${statRanges.ma.max}]`, () => {
            expect(pos.ma).toBeGreaterThanOrEqual(statRanges.ma.min);
            expect(pos.ma).toBeLessThanOrEqual(statRanges.ma.max);
          });

          it(`ST (${pos.st}) dans la plage [${statRanges.st.min}-${statRanges.st.max}]`, () => {
            expect(pos.st).toBeGreaterThanOrEqual(statRanges.st.min);
            expect(pos.st).toBeLessThanOrEqual(statRanges.st.max);
          });

          it(`AG (${pos.ag}) dans la plage [${statRanges.ag.min}-${statRanges.ag.max}]`, () => {
            expect(pos.ag).toBeGreaterThanOrEqual(statRanges.ag.min);
            expect(pos.ag).toBeLessThanOrEqual(statRanges.ag.max);
          });

          it(`PA (${pos.pa}) dans la plage [${statRanges.pa.min}-${statRanges.pa.max}]`, () => {
            expect(pos.pa).toBeGreaterThanOrEqual(statRanges.pa.min);
            expect(pos.pa).toBeLessThanOrEqual(statRanges.pa.max);
          });

          it(`AV (${pos.av}) dans la plage [${statRanges.av.min}-${statRanges.av.max}]`, () => {
            expect(pos.av).toBeGreaterThanOrEqual(statRanges.av.min);
            expect(pos.av).toBeLessThanOrEqual(statRanges.av.max);
          });

          it(`cout (${pos.cost}) dans la plage [${statRanges.cost.min}-${statRanges.cost.max}]`, () => {
            expect(pos.cost).toBeGreaterThanOrEqual(statRanges.cost.min);
            expect(pos.cost).toBeLessThanOrEqual(statRanges.cost.max);
          });
        });
      }
    });
  }
});

// ─── 3. Contraintes de positions ────────────────────────────────────────

describe('S3 Rules Validation: Contraintes de positions', () => {
  for (const [teamKey, roster] of Object.entries(SEASON_THREE_ROSTERS)) {
    describe(`${roster.name} (${teamKey})`, () => {
      it('devrait avoir au moins un type "lineman" (max >= 11)', () => {
        const hasLineman = roster.positions.some((p) => p.max >= 11);
        expect(hasLineman, `${teamKey} n'a pas de lineman type`).toBe(true);
      });

      it('devrait avoir min <= max pour chaque position', () => {
        for (const pos of roster.positions) {
          expect(
            pos.min,
            `${pos.displayName}: min (${pos.min}) > max (${pos.max})`
          ).toBeLessThanOrEqual(pos.max);
        }
      });

      it('devrait avoir min >= 0 pour chaque position', () => {
        for (const pos of roster.positions) {
          expect(
            pos.min,
            `${pos.displayName}: min negatif`
          ).toBeGreaterThanOrEqual(0);
        }
      });

      it('devrait avoir des slugs uniques', () => {
        const slugs = roster.positions.map((p) => p.slug);
        const uniqueSlugs = new Set(slugs);
        expect(uniqueSlugs.size, 'slugs en doublon').toBe(slugs.length);
      });

      it('devrait avoir des slugs prefixes par le nom d\'equipe', () => {
        for (const pos of roster.positions) {
          expect(
            pos.slug.startsWith(teamKey + '_'),
            `slug "${pos.slug}" ne commence pas par "${teamKey}_"`
          ).toBe(true);
        }
      });

      it('le total max de joueurs devrait permettre au moins 11 joueurs', () => {
        const totalMax = roster.positions.reduce((sum, p) => sum + p.max, 0);
        expect(
          totalMax,
          `${teamKey}: total max ${totalMax} < 11`
        ).toBeGreaterThanOrEqual(11);
      });
    });
  }
});

// ─── 4. Cross-validation avec les donnees de reference ──────────────────

describe('S3 Rules Validation: Cross-validation avec reference', () => {
  it('la reference devrait couvrir toutes les equipes', () => {
    const rosterKeys = Object.keys(SEASON_THREE_ROSTERS);
    const referenceKeys = Object.keys(SEASON_3_REFERENCE);
    for (const key of rosterKeys) {
      expect(
        referenceKeys.includes(key),
        `equipe "${key}" absente de la reference`
      ).toBe(true);
    }
  });

  for (const [teamKey, ref] of Object.entries(SEASON_3_REFERENCE)) {
    const roster = SEASON_THREE_ROSTERS[teamKey];
    if (!roster) continue;

    describe(`${ref.nameEn} (${teamKey})`, () => {
      it(`tier devrait etre ${ref.tier}`, () => {
        expect(roster.tier).toBe(ref.tier);
      });

      it(`budget devrait etre ${ref.budget}`, () => {
        expect(roster.budget).toBe(ref.budget);
      });

      it(`devrait avoir ${ref.positionCount} types de positions`, () => {
        expect(roster.positions.length).toBe(ref.positionCount);
      });

      for (const refPos of ref.keyPositions) {
        describe(`Position: ${refPos.nameEn}`, () => {
          // Trouver la position correspondante par cout + max (combinaison unique)
          const matchingPositions = roster.positions.filter(
            (p) => p.cost === refPos.cost && p.max === refPos.max
          );

          it('devrait exister dans le roster', () => {
            expect(
              matchingPositions.length,
              `Aucune position trouvee avec cost=${refPos.cost} max=${refPos.max} pour ${refPos.nameEn}`
            ).toBeGreaterThanOrEqual(1);
          });

          if (matchingPositions.length >= 1) {
            const pos = matchingPositions[0];

            it(`MA devrait etre ${refPos.ma}`, () => {
              expect(pos.ma, `${refPos.nameEn} MA`).toBe(refPos.ma);
            });

            it(`ST devrait etre ${refPos.st}`, () => {
              expect(pos.st, `${refPos.nameEn} ST`).toBe(refPos.st);
            });

            it(`AG devrait etre ${refPos.ag}`, () => {
              expect(pos.ag, `${refPos.nameEn} AG`).toBe(refPos.ag);
            });

            it(`PA devrait etre ${refPos.pa}`, () => {
              expect(pos.pa, `${refPos.nameEn} PA`).toBe(refPos.pa);
            });

            it(`AV devrait etre ${refPos.av}`, () => {
              expect(pos.av, `${refPos.nameEn} AV`).toBe(refPos.av);
            });

            it(`skills de depart devraient correspondre`, () => {
              const actualSkills = parseSkills(pos.skills);
              expect(
                actualSkills,
                `${refPos.nameEn} skills: got [${actualSkills}], expected [${refPos.skills}]`
              ).toEqual(refPos.skills);
            });
          }
        });
      }
    });
  }
});

// ─── 5. Coherence des skills ────────────────────────────────────────────

describe('S3 Rules Validation: Coherence des skills', () => {
  // Skills connus dans le jeu (registre + traits)
  const KNOWN_SKILL_PATTERNS = [
    // General
    'arm-bar', 'block', 'brawler', 'dauntless', 'dirty-player-1', 'dirty-player-2',
    'fend', 'frenzy', 'grab', 'guard', 'kick', 'leader', 'pro', 'shadowing',
    'strip-ball', 'sure-hands', 'tackle', 'wrestle',
    // Agility
    'catch', 'defensive', 'diving-catch', 'diving-tackle', 'dodge', 'hit-and-run',
    'jump-up', 'leap', 'safe-pair-of-hands', 'sidestep', 'sneaky-git', 'sprint',
    'sure-feet',
    // Passing
    'accurate', 'cannoneer', 'cloud-burster', 'dump-off', 'hail-mary-pass',
    'nerves-of-steel', 'on-the-ball', 'pass', 'running-pass-2025', 'safe-pass',
    // Strength
    'break-tackle', 'grab', 'guard', 'horns', 'juggernaut', 'mighty-blow-1',
    'mighty-blow-2', 'prehensile-tail', 'stand-firm', 'strong-arm', 'thick-skull',
    // Mutations
    'big-hand', 'claws', 'disturbing-presence', 'extra-arms', 'foul-appearance',
    'horns', 'iron-hard-skin', 'prehensile-tail', 'tentacles', 'two-heads',
    'very-long-legs',
    // Traits
    'always-hungry', 'animal-savagery', 'animosity', 'animosity-all',
    'animosity-all-dwarf-halfling', 'animosity-all-dwarf-human',
    'animosity-underworld', 'ball-and-chain', 'bloodlust', 'bombardier',
    'bone-head', 'breathe-fire', 'chainsaw', 'contagieux', 'decay',
    'fork', 'hypnotic-gaze', 'insignifiant', 'instable',
    'loner-3', 'loner-4', 'loner-5', 'my-ball', 'no-hands',
    'pick-me-up', 'pile-on', 'pogo-stick', 'projectile-vomit',
    'provocation', 'really-stupid', 'regeneration', 'right-stuff',
    'secret-weapon', 'stab', 'stunty', 'surefoot',
    'take-root', 'throw-team-mate', 'timmm-ber', 'titchy',
    'trickster', 'wild-animal', 'drunkard', 'hate',
    'kick-team-mate', 'clearance', 'fumblerooskie',
  ];

  const knownSkillSet = new Set(KNOWN_SKILL_PATTERNS);

  for (const [teamKey, roster] of Object.entries(SEASON_THREE_ROSTERS)) {
    describe(`${roster.name} (${teamKey})`, () => {
      for (const pos of roster.positions) {
        const skills = parseSkills(pos.skills);
        if (skills.length === 0) continue;

        it(`${pos.displayName}: tous les skills devraient etre reconnus`, () => {
          const unknownSkills = skills.filter((s) => !knownSkillSet.has(s));
          expect(
            unknownSkills,
            `Skills inconnus pour ${pos.displayName}: ${unknownSkills.join(', ')}`
          ).toEqual([]);
        });
      }
    });
  }
});

// ─── 6. Regles de jeu structurelles ─────────────────────────────────────

describe('S3 Rules Validation: Regles de jeu', () => {
  it('8 tours par mi-temps en regles completes', () => {
    // Import dynamique pour eviter les dependances circulaires
    // Verifie via la constante de reference
    expect(STRUCTURAL_RULES.turnsPerHalf).toBe(8);
  });

  it('maximum 11 joueurs sur le terrain', () => {
    expect(STRUCTURAL_RULES.maxPlayersOnPitch).toBe(11);
  });

  it('minimum 3 joueurs pour commencer un match', () => {
    expect(STRUCTURAL_RULES.minPlayersToStart).toBe(3);
  });

  it('chaque equipe peut aligner 11 joueurs avec un budget de 1000k', () => {
    // Verifie que le lineman le moins cher permet d'acheter 11 joueurs
    for (const [teamKey, roster] of Object.entries(SEASON_THREE_ROSTERS)) {
      // Trouver le lineman (position avec max >= 11)
      const lineman = roster.positions.find((p) => p.max >= 11);
      expect(lineman, `${teamKey}: pas de lineman`).toBeDefined();
      if (lineman) {
        const costFor11 = lineman.cost * 11;
        expect(
          costFor11,
          `${teamKey}: 11x ${lineman.displayName} coute ${costFor11}k > 1000k`
        ).toBeLessThanOrEqual(1000);
      }
    }
  });
});
