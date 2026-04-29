/**
 * Tests for the tutorial engine.
 * N.1 — Tutoriel interactif (match guide, scripts pas a pas).
 */
import { describe, it, expect } from 'vitest';
import {
  createTutorialProgress,
  advanceTutorialProgress,
  goBackTutorialProgress,
  restartTutorialProgress,
  isTutorialComplete,
  getCurrentStep,
  getProgressRatio,
  findTutorialScript,
  listTutorialScripts,
  getTutorialBadge,
  getRecommendedTeamsForBeginners,
  getTotalTutorialXP,
  getMaxTutorialXP,
} from './engine';
import type { TutorialScript } from './types';

const fixture: TutorialScript = {
  slug: 'fixture',
  titleFr: 'Fixture FR',
  titleEn: 'Fixture EN',
  summaryFr: 'Resume FR',
  summaryEn: 'Summary EN',
  estimatedMinutes: 5,
  difficulty: 'beginner',
  steps: [
    {
      id: 'step-1',
      titleFr: 'Etape 1 FR',
      titleEn: 'Step 1 EN',
      bodyFr: 'Corps FR',
      bodyEn: 'Body EN',
    },
    {
      id: 'step-2',
      titleFr: 'Etape 2 FR',
      titleEn: 'Step 2 EN',
      bodyFr: 'Corps FR 2',
      bodyEn: 'Body EN 2',
    },
    {
      id: 'step-3',
      titleFr: 'Etape 3 FR',
      titleEn: 'Step 3 EN',
      bodyFr: 'Corps FR 3',
      bodyEn: 'Body EN 3',
    },
  ],
};

describe('Regle: Tutorial Engine', () => {
  it('createTutorialProgress initialises to the first step', () => {
    const progress = createTutorialProgress(fixture);
    expect(progress.slug).toBe('fixture');
    expect(progress.currentStepIndex).toBe(0);
    expect(progress.completed).toBe(false);
  });

  it('advanceTutorialProgress moves to the next step (immutable)', () => {
    const progress = createTutorialProgress(fixture);
    const next = advanceTutorialProgress(progress, fixture);
    expect(progress.currentStepIndex).toBe(0);
    expect(next.currentStepIndex).toBe(1);
    expect(next.completed).toBe(false);
  });

  it('advanceTutorialProgress marks completed on the final step', () => {
    const at2 = { ...createTutorialProgress(fixture), currentStepIndex: 2 };
    const after = advanceTutorialProgress(at2, fixture);
    expect(after.currentStepIndex).toBe(2);
    expect(after.completed).toBe(true);
  });

  it('advanceTutorialProgress is a no-op once completed', () => {
    const done = { ...createTutorialProgress(fixture), currentStepIndex: 2, completed: true };
    const after = advanceTutorialProgress(done, fixture);
    expect(after).toEqual(done);
  });

  it('goBackTutorialProgress moves to the previous step', () => {
    const at1 = { ...createTutorialProgress(fixture), currentStepIndex: 1 };
    const back = goBackTutorialProgress(at1);
    expect(back.currentStepIndex).toBe(0);
  });

  it('goBackTutorialProgress clamps at zero', () => {
    const progress = createTutorialProgress(fixture);
    const back = goBackTutorialProgress(progress);
    expect(back.currentStepIndex).toBe(0);
  });

  it('goBackTutorialProgress clears the completed flag', () => {
    const done = { ...createTutorialProgress(fixture), currentStepIndex: 2, completed: true };
    const back = goBackTutorialProgress(done);
    expect(back.completed).toBe(false);
    expect(back.currentStepIndex).toBe(1);
  });

  it('restartTutorialProgress returns a fresh progress', () => {
    const done = { ...createTutorialProgress(fixture), currentStepIndex: 2, completed: true };
    const fresh = restartTutorialProgress(done);
    expect(fresh.currentStepIndex).toBe(0);
    expect(fresh.completed).toBe(false);
    expect(fresh.slug).toBe('fixture');
  });

  it('isTutorialComplete returns true only when completed flag is true', () => {
    const progress = createTutorialProgress(fixture);
    expect(isTutorialComplete(progress)).toBe(false);
    const done = { ...progress, currentStepIndex: 2, completed: true };
    expect(isTutorialComplete(done)).toBe(true);
  });

  it('getCurrentStep returns the step at the current index', () => {
    const progress = createTutorialProgress(fixture);
    expect(getCurrentStep(progress, fixture)?.id).toBe('step-1');
    const at2 = { ...progress, currentStepIndex: 2 };
    expect(getCurrentStep(at2, fixture)?.id).toBe('step-3');
  });

  it('getCurrentStep returns undefined for out-of-range indices', () => {
    const progress = { ...createTutorialProgress(fixture), currentStepIndex: 99 };
    expect(getCurrentStep(progress, fixture)).toBeUndefined();
  });

  it('getProgressRatio reflects the position within the script', () => {
    expect(getProgressRatio({ ...createTutorialProgress(fixture), currentStepIndex: 0 }, fixture)).toBeCloseTo(1 / 3);
    expect(getProgressRatio({ ...createTutorialProgress(fixture), currentStepIndex: 2 }, fixture)).toBeCloseTo(2 / 3);
    expect(getProgressRatio({ ...createTutorialProgress(fixture), currentStepIndex: 2, completed: true }, fixture)).toBe(1);
  });

  it('findTutorialScript returns the intro script by slug', () => {
    const script = findTutorialScript('mon-premier-match');
    expect(script).toBeDefined();
    expect(script?.slug).toBe('mon-premier-match');
    expect(script?.steps.length).toBeGreaterThanOrEqual(5);
  });

  it('findTutorialScript returns undefined for an unknown slug', () => {
    expect(findTutorialScript('ghost-slug')).toBeUndefined();
  });

  it('listTutorialScripts returns at least the intro script', () => {
    const scripts = listTutorialScripts();
    expect(scripts.length).toBeGreaterThanOrEqual(1);
    expect(scripts.some((s) => s.slug === 'mon-premier-match')).toBe(true);
  });

  it('every registered tutorial script has unique step ids', () => {
    for (const script of listTutorialScripts()) {
      const ids = script.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('every registered tutorial step has bilingual content', () => {
    for (const script of listTutorialScripts()) {
      for (const step of script.steps) {
        expect(step.titleFr.length).toBeGreaterThan(0);
        expect(step.titleEn.length).toBeGreaterThan(0);
        expect(step.bodyFr.length).toBeGreaterThan(0);
        expect(step.bodyEn.length).toBeGreaterThan(0);
      }
    }
  });

  it('createTutorialProgress initialises completedAt to null', () => {
    const progress = createTutorialProgress(fixture);
    expect(progress.completedAt).toBeNull();
  });

  it('advanceTutorialProgress sets completedAt on transition to complete', () => {
    const at2 = { ...createTutorialProgress(fixture), currentStepIndex: 2 };
    const after = advanceTutorialProgress(at2, fixture);
    expect(after.completed).toBe(true);
    expect(typeof after.completedAt).toBe('string');
    expect(() => new Date(after.completedAt as string).toISOString()).not.toThrow();
  });

  it('advanceTutorialProgress preserves completedAt once already completed', () => {
    const completedAt = '2026-01-01T00:00:00.000Z';
    const done = {
      ...createTutorialProgress(fixture),
      currentStepIndex: 2,
      completed: true,
      completedAt,
    };
    const after = advanceTutorialProgress(done, fixture);
    expect(after.completedAt).toBe(completedAt);
  });

  it('advanceTutorialProgress does not set completedAt when not on the final step', () => {
    const progress = createTutorialProgress(fixture);
    const after = advanceTutorialProgress(progress, fixture);
    expect(after.completed).toBe(false);
    expect(after.completedAt).toBeNull();
  });

  it('goBackTutorialProgress clears completedAt', () => {
    const done = {
      ...createTutorialProgress(fixture),
      currentStepIndex: 2,
      completed: true,
      completedAt: '2026-01-01T00:00:00.000Z',
    };
    const back = goBackTutorialProgress(done);
    expect(back.completedAt).toBeNull();
  });

  it('restartTutorialProgress clears completedAt', () => {
    const done = {
      ...createTutorialProgress(fixture),
      currentStepIndex: 2,
      completed: true,
      completedAt: '2026-01-01T00:00:00.000Z',
    };
    const fresh = restartTutorialProgress(done);
    expect(fresh.completedAt).toBeNull();
  });

  it('getTutorialBadge returns bilingual badge metadata for the intro tutorial', () => {
    const script = findTutorialScript('mon-premier-match');
    expect(script).toBeDefined();
    const badge = getTutorialBadge(script as TutorialScript);
    expect(badge.id).toBe('tutorial:mon-premier-match');
    expect(badge.labelFr.length).toBeGreaterThan(0);
    expect(badge.labelEn.length).toBeGreaterThan(0);
    expect(badge.emoji.length).toBeGreaterThan(0);
    expect(badge.xp).toBeGreaterThan(0);
  });

  it('getTutorialBadge returns a default badge for an unknown slug', () => {
    const fakeScript: TutorialScript = { ...fixture, slug: 'unknown-tutorial' };
    const badge = getTutorialBadge(fakeScript);
    expect(badge.id).toBe('tutorial:unknown-tutorial');
    expect(badge.labelFr.length).toBeGreaterThan(0);
    expect(badge.labelEn.length).toBeGreaterThan(0);
    expect(badge.emoji.length).toBeGreaterThan(0);
    expect(badge.xp).toBeGreaterThan(0);
  });

  it('getRecommendedTeamsForBeginners returns exactly 3 beginner-friendly rosters', () => {
    const recos = getRecommendedTeamsForBeginners();
    expect(recos.length).toBe(3);
    const slugs = recos.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(3);
  });

  it('getRecommendedTeamsForBeginners returns rosters that exist in the registry', () => {
    const recos = getRecommendedTeamsForBeginners();
    for (const reco of recos) {
      expect(typeof reco.slug).toBe('string');
      expect(reco.slug.length).toBeGreaterThan(0);
      expect(reco.labelFr.length).toBeGreaterThan(0);
      expect(reco.labelEn.length).toBeGreaterThan(0);
      expect(reco.descriptionFr.length).toBeGreaterThan(0);
      expect(reco.descriptionEn.length).toBeGreaterThan(0);
      expect(reco.emoji.length).toBeGreaterThan(0);
    }
  });

  it('getRecommendedTeamsForBeginners includes the canonical beginner rosters', () => {
    const recos = getRecommendedTeamsForBeginners();
    const slugs = recos.map((r) => r.slug);
    expect(slugs).toContain('human');
    expect(slugs).toContain('orc');
    expect(slugs).toContain('dwarf');
  });

  it('getMaxTutorialXP sums the XP of every registered tutorial badge (S26.1c)', () => {
    const maxXp = getMaxTutorialXP();
    const expected = listTutorialScripts().reduce(
      (sum, script) => sum + getTutorialBadge(script).xp,
      0,
    );
    expect(maxXp).toBe(expected);
    expect(maxXp).toBeGreaterThan(0);
  });

  it('getTotalTutorialXP returns 0 when no tutorial is completed (S26.1c)', () => {
    expect(getTotalTutorialXP([])).toBe(0);
  });

  it('getTotalTutorialXP sums XP of completed tutorials (S26.1c)', () => {
    const introBadge = getTutorialBadge(
      findTutorialScript('mon-premier-match') as TutorialScript,
    );
    expect(getTotalTutorialXP(['mon-premier-match'])).toBe(introBadge.xp);
  });

  it('getTotalTutorialXP ignores unknown slugs and dedupes duplicates (S26.1c)', () => {
    const introBadge = getTutorialBadge(
      findTutorialScript('mon-premier-match') as TutorialScript,
    );
    expect(
      getTotalTutorialXP([
        'mon-premier-match',
        'mon-premier-match',
        'unknown-slug',
      ]),
    ).toBe(introBadge.xp);
  });

  it('getTotalTutorialXP never exceeds getMaxTutorialXP (S26.1c)', () => {
    const allSlugs = listTutorialScripts().map((s) => s.slug);
    expect(getTotalTutorialXP([...allSlugs, ...allSlugs])).toBe(
      getMaxTutorialXP(),
    );
  });
});
