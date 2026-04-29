/**
 * Moteur du tutoriel interactif.
 * Gestion du progres pas a pas, navigation avant/arriere et registre de scripts.
 * N.1 — Tutoriel interactif (match guide, scripts pas a pas).
 */
import type {
  RecommendedTeam,
  TutorialBadge,
  TutorialProgress,
  TutorialScript,
  TutorialStep,
} from './types';
import { MON_PREMIER_MATCH } from './scripts/intro';

const REGISTRY: readonly TutorialScript[] = Object.freeze([MON_PREMIER_MATCH]);

const BADGE_REGISTRY: Readonly<Record<string, Omit<TutorialBadge, 'id'>>> = Object.freeze({
  'mon-premier-match': {
    labelFr: 'Premiere foulee',
    labelEn: 'First Stride',
    emoji: '🏆',
    xp: 50,
  },
});

const DEFAULT_BADGE: Omit<TutorialBadge, 'id'> = Object.freeze({
  labelFr: 'Tutoriel termine',
  labelEn: 'Tutorial complete',
  emoji: '🎓',
  xp: 25,
});

export function listTutorialScripts(): readonly TutorialScript[] {
  return REGISTRY;
}

export function findTutorialScript(slug: string): TutorialScript | undefined {
  return REGISTRY.find((script) => script.slug === slug);
}

export function createTutorialProgress(script: TutorialScript): TutorialProgress {
  return {
    slug: script.slug,
    currentStepIndex: 0,
    completed: false,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getCurrentStep(
  progress: TutorialProgress,
  script: TutorialScript
): TutorialStep | undefined {
  if (progress.currentStepIndex < 0 || progress.currentStepIndex >= script.steps.length) {
    return undefined;
  }
  return script.steps[progress.currentStepIndex];
}

export function advanceTutorialProgress(
  progress: TutorialProgress,
  script: TutorialScript
): TutorialProgress {
  if (progress.completed) {
    return progress;
  }
  const now = new Date().toISOString();
  const lastIndex = script.steps.length - 1;
  if (progress.currentStepIndex >= lastIndex) {
    return {
      ...progress,
      currentStepIndex: lastIndex,
      completed: true,
      completedAt: progress.completedAt ?? now,
      updatedAt: now,
    };
  }
  return {
    ...progress,
    currentStepIndex: progress.currentStepIndex + 1,
    completed: false,
    completedAt: progress.completedAt ?? null,
    updatedAt: now,
  };
}

export function goBackTutorialProgress(progress: TutorialProgress): TutorialProgress {
  const nextIndex = Math.max(0, progress.currentStepIndex - 1);
  return {
    ...progress,
    currentStepIndex: nextIndex,
    completed: false,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function restartTutorialProgress(progress: TutorialProgress): TutorialProgress {
  return {
    ...progress,
    currentStepIndex: 0,
    completed: false,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getTutorialBadge(script: TutorialScript): TutorialBadge {
  const meta = BADGE_REGISTRY[script.slug] ?? DEFAULT_BADGE;
  return {
    id: `tutorial:${script.slug}`,
    ...meta,
  };
}

const BEGINNER_RECOMMENDATIONS: readonly RecommendedTeam[] = Object.freeze([
  {
    slug: 'human',
    labelFr: 'Humains',
    labelEn: 'Humans',
    descriptionFr:
      'Equipe equilibree, sans piege. Bonne armure, bons lanceurs, bons receveurs : ideale pour apprendre tous les aspects du jeu.',
    descriptionEn:
      'A balanced, no-trap team. Decent armour, solid throwers and catchers — perfect to learn every aspect of the game.',
    emoji: '🛡️',
  },
  {
    slug: 'orc',
    labelFr: 'Orques',
    labelEn: 'Orcs',
    descriptionFr:
      'Tres resistants, faciles a jouer en force. Pardonnent les erreurs grace a leur armure elevee.',
    descriptionEn:
      'Tough and forgiving. High armour means rookie mistakes hurt less while you learn positional play.',
    emoji: '⚔️',
  },
  {
    slug: 'dwarf',
    labelFr: 'Nains',
    labelEn: 'Dwarves',
    descriptionFr:
      'Lents mais blindes : presque impossibles a blesser. Excellent choix pour comprendre la guerre de tranchees.',
    descriptionEn:
      'Slow but heavily armoured — almost impossible to injure. Great pick to learn trench-warfare positioning.',
    emoji: '🪓',
  },
]);

export function getRecommendedTeamsForBeginners(): readonly RecommendedTeam[] {
  return BEGINNER_RECOMMENDATIONS;
}

export function isTutorialComplete(progress: TutorialProgress): boolean {
  return progress.completed === true;
}

export function getMaxTutorialXP(): number {
  return REGISTRY.reduce((sum, script) => sum + getTutorialBadge(script).xp, 0);
}

export function getTotalTutorialXP(completedSlugs: readonly string[]): number {
  const knownSlugs = new Set(REGISTRY.map((script) => script.slug));
  const uniqueCompleted = new Set(
    completedSlugs.filter((slug) => knownSlugs.has(slug)),
  );
  let total = 0;
  for (const slug of uniqueCompleted) {
    const script = findTutorialScript(slug);
    if (script) {
      total += getTutorialBadge(script).xp;
    }
  }
  return total;
}

export function getProgressRatio(
  progress: TutorialProgress,
  script: TutorialScript
): number {
  if (script.steps.length === 0) {
    return 0;
  }
  if (progress.completed) {
    return 1;
  }
  const stepsDone = Math.min(progress.currentStepIndex + 1, script.steps.length - 1);
  return stepsDone / script.steps.length;
}
