/**
 * Lecture PURE d'un joueur de la fiche de roster d'une compétition
 * (`TeamRosterPanel`, ligue et coupe).
 *
 * Le tableau (écran large) et les cartes (mobile) affichent EXACTEMENT les
 * mêmes informations : elles dérivent toutes d'ici, sinon les deux mises en
 * page divergent au premier champ ajouté d'un seul côté.
 */

/** Ce que la fiche lit d'un joueur pour ses dérivations. */
export interface RosterPlayerViewSource {
  readonly dead: boolean;
  readonly statusAt?: string | null;
  readonly statusSource?: string | null;
  readonly missNextMatch?: boolean;
  readonly nigglingInjuries?: number;
  readonly statReductions?: {
    readonly ma: number;
    readonly st: number;
    readonly ag: number;
    readonly pa: number;
    readonly av: number;
  };
  readonly matchesPlayed?: number;
  readonly totalTouchdowns?: number;
  readonly totalCasualties?: number;
  readonly totalCompletions?: number;
  readonly totalInterceptions?: number;
  readonly aggressions?: number;
  readonly spp: number;
}

/**
 * Origine lisible d'une mort. Sert à expliquer le ☠ : une mort issue d'une
 * feuille de match est réversible en invalidant la feuille, une mort posée
 * à la main ne l'est pas de la même façon.
 */
const STATUS_SOURCE_LABELS: Record<string, string> = {
  match_sheet: "feuille de match",
  online_match: "match en ligne",
  commissioner: "décision du commissaire",
  admin: "administration",
  legacy: "origine inconnue",
};

export function deathOriginLabel(p: RosterPlayerViewSource): string {
  if (!p.dead) return "";
  const source = p.statusSource
    ? (STATUS_SOURCE_LABELS[p.statusSource] ?? p.statusSource)
    : null;
  const when = p.statusAt
    ? new Date(p.statusAt).toLocaleDateString("fr-FR")
    : null;
  if (source && when) return `Décédé — ${source}, le ${when}`;
  if (source) return `Décédé — ${source}`;
  return "Décédé";
}

/**
 * FR20 — libellé compact des blessures durables d'un joueur.
 *
 * Les Blessures Persistantes sont notées « N BP » (abréviation officielle
 * de la feuille d'équipe) et se **cumulent** : le compteur serveur est
 * incrémenté à chaque nouvelle BP, on affiche donc le total tel quel
 * (« 1 BP », « 2 BP », …) sans pluriel — « BP » est un sigle invariable.
 * Les réductions de caractéristique (Séquelles) restent affichées à part.
 */
export function lastingInjuriesLabel(p: RosterPlayerViewSource): string {
  const parts: string[] = [];
  const r = p.statReductions;
  if (r) {
    if (r.ma > 0) parts.push(`-${r.ma} M`);
    if (r.st > 0) parts.push(`-${r.st} F`);
    if (r.ag > 0) parts.push(`+${r.ag} AG`);
    if (r.pa > 0) parts.push(`+${r.pa} CP`);
    if (r.av > 0) parts.push(`-${r.av} AR`);
  }
  const bp = p.nigglingInjuries ?? 0;
  if (bp > 0) parts.push(`${bp} BP`);
  return parts.join(", ");
}

export type RosterAvailability = "dead" | "absent" | "available";

/** Disponibilité pour le prochain match (la mort l'emporte sur l'absence). */
export function availabilityOf(p: RosterPlayerViewSource): RosterAvailability {
  if (p.dead) return "dead";
  if (p.missNextMatch) return "absent";
  return "available";
}

export function formatGold(n: number): string {
  return `${n.toLocaleString("fr-FR")} po`;
}

/**
 * Valeur d'un joueur en kpo (105 000 -> « 105 k po ») : la colonne
 * « Valeur » du roster reste compacte.
 */
export function formatKpo(n: number): string {
  return `${Math.round(n / 1000).toLocaleString("fr-FR")} k po`;
}

/** Valeur affichée d'un joueur (« — » si l'API ne la sert pas). */
export function playerValueLabel(value: number | undefined): string {
  return typeof value === "number" ? formatKpo(value) : "—";
}

/** Caractéristique « N+ » (PA absente = « – »). */
export function formatTarget(value: number | null): string {
  return value === null ? "–" : `${value}+`;
}

export type RosterStatKey =
  | "matches"
  | "td"
  | "casualties"
  | "completions"
  | "interceptions"
  | "aggressions"
  | "spp";

export interface RosterStatCell {
  readonly key: RosterStatKey;
  /** En-tête compact (colonne du tableau, case de la carte). */
  readonly label: string;
  /** Explication (attribut `title`). */
  readonly title: string;
  readonly value: number;
}

/**
 * Statistiques d'un joueur, dans l'ordre des colonnes du tableau. Une coupe
 * compte ses propres matchs et ne rapporte pas de PSP : seuls les titres
 * changent, les colonnes restent.
 */
export function rosterStatCells(
  p: RosterPlayerViewSource,
  competition: "league" | "cup",
): RosterStatCell[] {
  const isCup = competition === "cup";
  return [
    {
      key: "matches",
      label: "MJ",
      title: isCup
        ? "Matchs joués dans la coupe"
        : "Matchs joués, toutes compétitions (ligue, coupe, en ligne)",
      value: p.matchesPlayed ?? 0,
    },
    {
      key: "td",
      label: "TD",
      title: "Touchdowns marqués",
      value: p.totalTouchdowns ?? 0,
    },
    {
      key: "casualties",
      label: "Élim.",
      title: "Éliminations provoquées sur Blocage",
      value: p.totalCasualties ?? 0,
    },
    {
      key: "completions",
      label: "Pas.",
      title: "Passes complétées",
      value: p.totalCompletions ?? 0,
    },
    {
      key: "interceptions",
      label: "Int.",
      title: "Interceptions",
      value: p.totalInterceptions ?? 0,
    },
    {
      key: "aggressions",
      label: "Agr.",
      title: "Agressions",
      value: p.aggressions ?? 0,
    },
    {
      key: "spp",
      label: "PSP",
      title: isCup
        ? "Points de Star Player à l'inscription (une coupe n'en rapporte pas)"
        : "Points de Star Player gagnés",
      value: p.spp,
    },
  ];
}

/**
 * `data-testid` historiques des cellules de stats (seules certaines en
 * portaient un). Les cartes mobiles reprennent les mêmes, suffixées
 * `-mobile-`, pour ne jamais dupliquer un id du tableau.
 */
const STAT_TEST_IDS: Partial<Record<RosterStatKey, string>> = {
  matches: "player-matches",
  td: "player-td",
};

export function rosterStatTestId(
  key: RosterStatKey,
  playerId: string,
  variant: "table" | "mobile",
): string | undefined {
  const base = STAT_TEST_IDS[key];
  if (!base) return undefined;
  return variant === "mobile" ? `${base}-mobile-${playerId}` : `${base}-${playerId}`;
}

/**
 * Un joueur sans numéro (Star Player du roster d'inscription d'une coupe)
 * n'a pas de carte de joueur d'équipe : la sienne vit dans le catalogue
 * des Star Players.
 */
export function hasTeamPlayerCard(p: { readonly number: number | null }): boolean {
  return p.number !== null;
}
