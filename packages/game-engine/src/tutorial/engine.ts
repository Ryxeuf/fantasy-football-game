/**
 * Moteur du tutoriel interactif.
 * Gestion du progres pas a pas, navigation avant/arriere et registre de scripts.
 * N.1 — Tutoriel interactif (match guide, scripts pas a pas).
 */
import type { TutorialProgress, TutorialScript, TutorialStep } from './types';
import { MON_PREMIER_MATCH } from './scripts/intro';

const REGISTRY: readonly TutorialScript[] = Object.freeze([MON_PREMIER_MATCH]);

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
  const lastIndex = script.steps.length - 1;
  if (progress.currentStepIndex >= lastIndex) {
    return {
      ...progress,
      currentStepIndex: lastIndex,
      completed: true,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    ...progress,
    currentStepIndex: progress.currentStepIndex + 1,
    completed: false,
    updatedAt: new Date().toISOString(),
  };
}

export function goBackTutorialProgress(progress: TutorialProgress): TutorialProgress {
  const nextIndex = Math.max(0, progress.currentStepIndex - 1);
  return {
    ...progress,
    currentStepIndex: nextIndex,
    completed: false,
    updatedAt: new Date().toISOString(),
  };
}

export function restartTutorialProgress(progress: TutorialProgress): TutorialProgress {
  return {
    ...progress,
    currentStepIndex: 0,
    completed: false,
    updatedAt: new Date().toISOString(),
  };
}

export function isTutorialComplete(progress: TutorialProgress): boolean {
  return progress.completed === true;
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
