/**
 * Couronnes (Crowns) côté web — helpers PURS d'affichage.
 *
 * Le journal (`ProTransaction`) est celui du wallet Pro League : on y lit les
 * types historiques (paris, bonus) en plus de ceux des thèmes de dés.
 */

/** Préfixe de la référence d'un achat / remboursement de thème de dés. */
export const DICE_THEME_TX_REF_PREFIX = "dice-theme:";

/**
 * Préfixe de la référence d'un passage de récompenses (`crowns-earning`) :
 * une opération `REWARD` réf. `rewards:<id>` regroupe tout ce qu'un passage
 * de rattrapage a versé. Miroir de `crowns-rewards-rules` côté serveur.
 */
export const REWARDS_TX_REF_PREFIX = "rewards:";

/** Barème des récompenses, servi par `GET /crowns/me` (miroir serveur). */
export interface CrownsRewardSchedule {
  readonly sheet: number;
  readonly achievement: number;
  readonly signup: number;
  readonly seasonSheetCap: number;
}

/** Détail d'un passage de récompenses, servi par `GET /crowns/me`. */
export interface CrownsRewardBreakdown {
  readonly sheets: number;
  readonly achievements: number;
  readonly signup: boolean;
  /** Feuilles tronquées ou annulées par le plafond de saison. */
  readonly capped: number;
}

/** « 1 250 » (espace fine insécable, comme le reste du site). */
export function formatCrowns(amount: number, locale: "fr" | "en" = "fr"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR").format(amount);
}

/** Montant signé : « +250 » / « −400 ». */
export function formatCrownsDelta(amount: number): string {
  const abs = formatCrowns(Math.abs(amount));
  return amount < 0 ? `−${abs}` : `+${abs}`;
}

/** Thème de dés visé par une référence `dice-theme:<id>`, sinon `null`. */
export function diceThemeIdFromRef(ref: string | null | undefined): string | null {
  return ref && ref.startsWith(DICE_THEME_TX_REF_PREFIX)
    ? ref.slice(DICE_THEME_TX_REF_PREFIX.length) || null
    : null;
}

export interface CrownsTransactionLike {
  readonly type: string;
  readonly amount: number;
  readonly ref: string | null;
  /** Passage de récompenses uniquement — optionnel (API antérieure). */
  readonly rewards?: CrownsRewardBreakdown;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

/**
 * « Récompenses : 2 feuilles de match, 1 succès, bonus de bienvenue — 1
 * feuille plafonnée ». Sans détail (API antérieure, lecture admin) :
 * « Récompenses ».
 */
export function describeRewardPass(rewards: CrownsRewardBreakdown | undefined): string {
  if (!rewards) return "Récompenses";
  const parts: string[] = [];
  if (rewards.sheets > 0) parts.push(plural(rewards.sheets, "feuille de match", "feuilles de match"));
  if (rewards.achievements > 0) parts.push(plural(rewards.achievements, "succès", "succès"));
  if (rewards.signup) parts.push("bonus de bienvenue");
  let label = parts.length > 0 ? `Récompenses : ${parts.join(", ")}` : "Récompenses";
  if (rewards.capped > 0) {
    label += ` — ${plural(rewards.capped, "feuille plafonnée", "feuilles plafonnées")}`;
  }
  return label;
}

/**
 * Libellé lisible d'une opération. `themeName` résout le nom d'un thème de
 * dés à partir de son id (repli : l'id brut).
 */
export function describeCrownsTransaction(
  tx: CrownsTransactionLike,
  themeName: (id: string) => string | undefined = () => undefined,
): string {
  const themeId = diceThemeIdFromRef(tx.ref);
  const theme = themeId ? themeName(themeId) ?? themeId : null;
  switch (tx.type) {
    case "SINK":
      return theme ? `Achat du thème de dés « ${theme} »` : "Dépense";
    case "ADMIN_REFUND":
      return theme ? `Remboursement du thème de dés « ${theme} »` : "Remboursement";
    case "ADMIN_ADJUST":
      return tx.ref ? `Ajustement de l'équipe Nuffle Arena — ${tx.ref}` : "Ajustement de l'équipe Nuffle Arena";
    case "REWARD":
      return tx.ref?.startsWith(REWARDS_TX_REF_PREFIX)
        ? describeRewardPass(tx.rewards)
        : "Bonus de bienvenue";
    case "DAILY":
      return "Bonus quotidien";
    case "BADGE":
      return "Récompense de badge";
    case "BET":
      return "Mise sur un pari";
    case "WIN":
      return "Gain de pari";
    default:
      return tx.type;
  }
}

/**
 * Source lisible d'une récompense du registre, depuis sa clé :
 * `sheet:<id>:home|away`, `achievement:<userId>:<slug>`, `signup:<userId>`.
 */
export function describeRewardSource(kind: string, sourceKey: string): string {
  const parts = sourceKey.split(":");
  if (kind === "sheet") {
    const side = parts[2] === "away" ? "extérieur" : "domicile";
    return `Feuille de match (${side})`;
  }
  if (kind === "achievement") return `Succès « ${parts.slice(2).join(":") || sourceKey} »`;
  if (kind === "signup") return "Bonus de bienvenue";
  return sourceKey;
}

/** Période du plafond : « Saison », « Coupe » ou « — » (hors plafond). */
export function describeRewardPeriod(periodKey: string | null): string {
  if (!periodKey) return "—";
  if (periodKey.startsWith("season:")) return "Saison de ligue";
  if (periodKey.startsWith("cup:")) return "Coupe";
  return periodKey;
}

