/**
 * Mode de saisie de la feuille de match d'une COUPE (`Cup.sheetEntryMode`).
 *
 * - `full` : la feuille de la ligue, telle quelle ;
 * - `simplified` : la même feuille, dont le formulaire ne garde que ce que la
 *   coupe compte (forfait, touchdowns, éliminations sur blocage et sur
 *   agression, passes réussies, interceptions).
 *
 * Le mode ne gouverne QUE le formulaire : le serveur accepte tout évènement
 * quel que soit le mode, et rien de persisté n'en dépend. C'est ce qui le
 * rend modifiable à tout moment, coupe lancée comprise.
 *
 * Module PUR (aucune I/O) : partagé par le jeu de règles de la feuille et
 * les schémas Zod de la coupe sans tirer Prisma.
 */

export const SHEET_ENTRY_MODES = ["full", "simplified"] as const;
export type SheetEntryMode = (typeof SHEET_ENTRY_MODES)[number];

/**
 * Lecture tolérante de la colonne. `null` = coupe antérieure au réglage, lue
 * en saisie COMPLÈTE (pas de backfill possible, `db push` en prod) ; une
 * valeur inconnue l'est aussi, jamais servie à moitié.
 */
export function parseSheetEntryMode(raw: unknown): SheetEntryMode {
  return raw === "simplified" ? "simplified" : "full";
}
