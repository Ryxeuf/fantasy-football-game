/**
 * Fenêtre d'édition du QUOTA de qualifiés d'une poule de ligue (PUR).
 *
 * La composition des poules se fige au démarrage de la saison ; le quota, lui,
 * ne gouverne que le seeding du bracket et reste corrigeable jusqu'à sa
 * génération (même fenêtre que la taille du bracket). Le serveur reste
 * l'autorité (`ensureQuotaEditable`) : un écran périmé reçoit son 409.
 */

interface SeasonForQuotaWindow {
  readonly status: string;
  readonly rounds: ReadonlyArray<{
    /** Optionnels : l'API les sert, le type historique ne les déclarait pas. */
    readonly kind?: string;
    readonly bracketSlot?: string | null;
  }>;
}

/**
 * Signature des quotas de poule : change dès qu'un quota change (ou qu'une
 * poule apparaît / disparaît). Sert à relire le panneau de lancement des
 * play-offs, qui affiche leur total.
 */
export function poolQuotaSignature(
  pools: ReadonlyArray<{
    readonly id: string;
    readonly qualifiesForPlayoffs: number;
  }>,
): string {
  return pools.map((p) => `${p.id}:${p.qualifiesForPlayoffs}`).join("|");
}

/**
 * Vrai si le commissaire peut encore corriger un quota : saison non
 * clôturée et aucun tour de bracket. Un tour de bracket créé à la main n'a
 * pas forcément `kind = "playoff"` — son `bracketSlot` suffit.
 */
export function isPoolQuotaEditable(
  season: SeasonForQuotaWindow | null | undefined,
): boolean {
  if (!season || season.status === "completed") return false;
  return !season.rounds.some(
    (r) => r.kind === "playoff" || Boolean(r.bracketSlot),
  );
}
