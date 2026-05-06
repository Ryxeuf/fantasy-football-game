/**
 * S27.3.12 — Mapping discriminant -> cle i18n pour l'ecran
 * `apps/mobile/app/player/[teamId]/[playerId].tsx`.
 *
 * Extrait dans `lib/` pour rester :
 *  - reutilisable par d'autres ecrans (mobile + tests),
 *  - hors du scope de l'audit i18n (`scripts/audit-i18n.ts` scanne
 *    uniquement `app/` et `components/`).
 */
import type { AdvancementType } from "@bb/game-engine";
import type { TranslationKey } from "./i18n";
import type { PlayerStatusKind } from "./player-details";

export const PLAYER_STATUS_TRANSLATION_KEYS: Record<
  PlayerStatusKind,
  TranslationKey
> = {
  dead: "players.detail.status.dead",
  "miss-next-match": "players.detail.status.missNextMatch",
  injured: "players.detail.status.injured",
  fit: "players.detail.status.fit",
};

export const ADVANCEMENT_TRANSLATION_KEYS: Record<
  AdvancementType,
  TranslationKey
> = {
  primary: "players.detail.advancements.types.primary",
  secondary: "players.detail.advancements.types.secondary",
  "random-primary": "players.detail.advancements.types.randomPrimary",
  "random-secondary": "players.detail.advancements.types.randomSecondary",
};
