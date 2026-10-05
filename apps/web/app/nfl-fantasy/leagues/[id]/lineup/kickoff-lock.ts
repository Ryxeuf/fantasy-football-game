/**
 * Verrouillage au coup d'envoi, cote ecran (miroir de
 * `apps/server/src/services/nfl-fantasy-kickoff-lock.ts`). Le serveur fait
 * foi ; ici on grise d'avance pour eviter un aller-retour en erreur. Pur.
 */

export interface PlayerKickoffView {
  readonly kickoffAt: string;
  readonly started: boolean;
}

export type RosterKickoffs = Readonly<Record<string, PlayerKickoffView>>;

/** Joueur dont le match a commence : role fige pour la semaine. */
export function isFrozen(kickoffs: RosterKickoffs, playerId: string | null): boolean {
  return playerId !== null && kickoffs[playerId]?.started === true;
}

/**
 * Raison de refuser un changement de capitaine/vice (null = autorise) :
 * ni le titulaire actuel du role ni le nouveau ne doivent etre geles.
 */
export function roleChangeBlockedReason(opts: {
  readonly kickoffs: RosterKickoffs;
  readonly role: "captain" | "vice";
  readonly currentId: string | null;
  readonly nextId: string | null;
}): string | null {
  if (opts.currentId === opts.nextId) return null;
  const label = opts.role === "captain" ? "capitaine" : "vice-capitaine";
  if (isFrozen(opts.kickoffs, opts.currentId)) {
    return `Le ${label} actuel a déjà joué : rôle figé pour la semaine.`;
  }
  if (isFrozen(opts.kickoffs, opts.nextId)) {
    return `Match déjà commencé : ce joueur ne peut plus devenir ${label}.`;
  }
  return null;
}

/** "jeu. 20:15" en heure locale du navigateur. */
export function formatKickoff(iso: string, locale = "fr-FR", timeZone?: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(locale, { weekday: "short", timeZone });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone });
  return `${day} ${time}`;
}
