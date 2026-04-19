/**
 * Types du tutoriel interactif.
 * N.1 — Tutoriel interactif (match guide, scripts pas a pas).
 */

export type TutorialDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type TutorialStepActionKind =
  | 'info'
  | 'move-player'
  | 'block-player'
  | 'pass-ball'
  | 'pickup-ball'
  | 'score-touchdown'
  | 'end-turn';

export interface TutorialStepHighlight {
  /** Identifiant logique de la zone mise en avant par la UI (board-cell, HUD, dugout, etc.). */
  kind: 'cell' | 'hud' | 'dugout' | 'dice' | 'info-panel';
  /** Coordonnees sur le plateau (optionnel selon kind). */
  cell?: { x: number; y: number };
  /** Cible generique (ex: id CSS, data-testid). */
  target?: string;
}

export interface TutorialStep {
  id: string;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
  /** Action attendue du joueur (info par defaut : on passe a l'etape suivante avec le bouton). */
  action?: TutorialStepActionKind;
  /** Cellules ou elements de UI a mettre en evidence durant cette etape. */
  highlights?: TutorialStepHighlight[];
  /** Cle d'image (asset) illustrant l'etape. */
  imageKey?: string;
  /** Notes complementaires affichees comme infobulle. */
  tipFr?: string;
  tipEn?: string;
}

export interface TutorialScript {
  slug: string;
  titleFr: string;
  titleEn: string;
  summaryFr: string;
  summaryEn: string;
  /** Duree estimee pour completer le tutoriel, en minutes. */
  estimatedMinutes: number;
  difficulty: TutorialDifficulty;
  steps: TutorialStep[];
  /** Slugs d'autres tutoriels recommandes apres celui-ci. */
  nextSlugs?: string[];
}

export interface TutorialProgress {
  slug: string;
  currentStepIndex: number;
  completed: boolean;
  /** Horodatage ISO de la derniere mise a jour (facultatif pour la persistance). */
  updatedAt?: string;
}
