/**
 * Modèle de données des cartes joueur exportables (change OpenSpec
 * `export-player-cards`).
 *
 * Une carte (style carte à collectionner, 750×1050 = 63,5×88,9 mm à 300 dpi)
 * se décrit par un `PlayerCardData` **auto-porté** : tout ce qu'il faut pour
 * la dessiner (nom, stats, compétences résolues en clair, thème via
 * `rosterSlug`) sans requête supplémentaire. Le payload circule encodé en
 * base64url dans l'URL du renderer (`/api/player-card?d=…`) : ce module
 * fournit l'encodeur (client) et le décodeur **validant** (serveur) avec des
 * bornes strictes sur chaque champ — le renderer ne doit jamais dessiner un
 * payload arbitraire non borné.
 *
 * Tout est pur (aucun I/O) : testable en unit sans satori ni réseau.
 */
import {
  getDisplayNames,
  getStarPlayerSkillSlugs,
  type StarPlayerDefinition,
} from "@bb/game-engine";

export type CardLang = "fr" | "en";
export type CardKind = "star" | "team";

export interface PlayerCardStats {
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  /** null = pas de valeur de Passe (affiché "-"). */
  readonly pa: number | null;
  readonly av: number;
}

export interface PlayerCardInfoStat {
  readonly label: string;
  readonly value: string;
}

export interface PlayerCardData {
  readonly kind: CardKind;
  readonly lang: CardLang;
  readonly name: string;
  /** Libellé haut-droit : "STAR PLAYER" ou le poste ("Blitzer"). */
  readonly kindLabel: string;
  /** Numéro de maillot (joueur d'équipe). */
  readonly number?: number;
  /** Slug roster pour le thème (couleurs canoniques + emblème). */
  readonly rosterSlug?: string;
  readonly stats: PlayerCardStats;
  /** Noms de compétences déjà résolus dans la langue de la carte. */
  readonly skills: readonly string[];
  /** Lignes de la rubrique "Joue pour" (équipe, roster, ligues…). */
  readonly playsFor: readonly string[];
  /** Coût/valeur en pièces d'or. null = rubrique masquée. */
  readonly cost: number | null;
  readonly costLabel: string;
  /** Ruban diagonal optionnel ("MEGA-STAR", "DÉCÉDÉ"…). */
  readonly ribbon?: string;
  readonly infoTitle: string;
  /** Texte libre (règle spéciale) — exclusif avec `infoStats`. */
  readonly infoText?: string;
  /** Mini-stats (carrière) — exclusif avec `infoText`. */
  readonly infoStats?: readonly PlayerCardInfoStat[];
}

/** Libellés bilingues des rubriques de la carte. */
export const CARD_LABELS: Record<
  CardLang,
  {
    skills: string;
    playsFor: string;
    cost: string;
    value: string;
    specialRule: string;
    career: string;
    starPlayer: string;
    megaStar: string;
    deceased: string;
    released: string;
    matches: string;
    touchdowns: string;
    casualties: string;
    spp: string;
    gold: string;
  }
> = {
  fr: {
    skills: "COMPÉTENCES & TRAITS",
    playsFor: "JOUE POUR",
    cost: "COÛT",
    value: "VALEUR",
    specialRule: "RÈGLE SPÉCIALE",
    career: "CARRIÈRE",
    starPlayer: "STAR PLAYER",
    megaStar: "MEGA-STAR",
    deceased: "DÉCÉDÉ",
    released: "LICENCIÉ",
    matches: "MATCHS",
    touchdowns: "TD",
    casualties: "SORTIES",
    spp: "PSP",
    gold: "PO",
  },
  en: {
    skills: "SKILLS & TRAITS",
    playsFor: "PLAYS FOR",
    cost: "COST",
    value: "VALUE",
    specialRule: "SPECIAL RULE",
    career: "CAREER",
    starPlayer: "STAR PLAYER",
    megaStar: "MEGA-STAR",
    deceased: "DECEASED",
    released: "RELEASED",
    matches: "GAMES",
    touchdowns: "TD",
    casualties: "CAS",
    spp: "SPP",
    gold: "GP",
  },
};

// ---------------------------------------------------------------------------
// Bornes du payload (décodeur validant)
// ---------------------------------------------------------------------------

/** Longueur max du paramètre `d` accepté par le renderer. */
export const MAX_ENCODED_PAYLOAD_LENGTH = 8000;

const MAX_NAME_LENGTH = 80;
const MAX_KIND_LABEL_LENGTH = 40;
const MAX_ROSTER_SLUG_LENGTH = 40;
const MAX_SKILLS = 24;
const MAX_SKILL_LENGTH = 48;
const MAX_PLAYS_FOR = 8;
const MAX_PLAYS_FOR_LENGTH = 64;
const MAX_RIBBON_LENGTH = 24;
const MAX_INFO_TITLE_LENGTH = 40;
/** Coupe du texte libre (règle spéciale) pour tenir sur la carte. */
export const MAX_INFO_TEXT_LENGTH = 340;
const MAX_INFO_STATS = 5;
const MAX_INFO_STAT_LABEL_LENGTH = 16;
const MAX_INFO_STAT_VALUE_LENGTH = 12;
const MAX_COST = 5_000_000;
const MAX_STAT_VALUE = 15;
const MAX_NUMBER = 99;

const ROSTER_SLUG_RE = /^[a-z0-9_-]+$/;

// ---------------------------------------------------------------------------
// Helpers purs de formatage
// ---------------------------------------------------------------------------

/** "1000000" → "1 000 000" (séparateur de milliers, espace). */
export function formatGoldAmount(amount: number): string {
  const safe = Math.max(0, Math.floor(amount));
  return String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Coupe un texte au mot le plus proche sous `max` caractères, avec une
 * ellipse. Retourne le texte intact s'il tient déjà.
 */
export function truncateAtWord(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, Math.max(0, max - 1));
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

/** Nom de fichier sûr pour le téléchargement ("Grip Sobërwall" → "grip-soberwall"). */
export function slugifyForFileName(name: string): string {
  const ascii = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "joueur";
}

/** Taille de police du bandeau nom, dégressive pour les noms longs. */
export function nameFontSize(name: string): number {
  const len = name.length;
  if (len <= 18) return 66;
  if (len <= 24) return 56;
  if (len <= 30) return 48;
  return 40;
}

/** Couleur 24 bits (game-engine `TeamColors`) → hex CSS "#rrggbb". */
export function hexFromColorNumber(value: number): string {
  const clamped = Math.max(0, Math.min(0xffffff, Math.floor(value)));
  return `#${clamped.toString(16).padStart(6, "0")}`;
}

/**
 * Assombrit (`factor` < 0) ou éclaircit (`factor` > 0) une couleur hex.
 * `factor` borné à [-1, 1] : -1 → noir, 1 → blanc.
 */
export function shadeHexColor(hex: string, factor: number): string {
  const f = Math.max(-1, Math.min(1, factor));
  const num = parseInt(hex.replace("#", ""), 16);
  const channels = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff].map(
    (c) => {
      const target = f < 0 ? 0 : 255;
      return Math.round(c + (target - c) * Math.abs(f));
    },
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Vrai si la couleur est claire (luminance) — pour choisir un texte lisible. */
export function isLightColor(hex: string): boolean {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  // Luminance perceptuelle (Rec. 601), seuil usuel 0.6 pour du texte blanc.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export interface BuildStarCardOptions {
  readonly lang: CardLang;
  /** Rubrique "Joue pour" déjà résolue (noms de rosters / ligues). */
  readonly playsFor: readonly string[];
  /**
   * Coût affiché (po). Par défaut `star.cost` — passer le prix de la paire
   * pour les stars en recrutement par deux (cf. fiche star).
   */
  readonly cost?: number;
}

/** Carte d'un Star Player (catalogue game-engine / API publique). */
export function buildStarPlayerCardData(
  star: Pick<
    StarPlayerDefinition,
    | "displayName"
    | "cost"
    | "ma"
    | "st"
    | "ag"
    | "pa"
    | "av"
    | "skills"
    | "isMegaStar"
    | "specialRule"
    | "specialRuleEn"
  >,
  options: BuildStarCardOptions,
): PlayerCardData {
  const labels = CARD_LABELS[options.lang];
  const skillSlugs = getStarPlayerSkillSlugs(star as StarPlayerDefinition);
  const skills = getDisplayNames(skillSlugs.join(","), options.lang);
  const specialRule =
    options.lang === "en"
      ? star.specialRuleEn ?? star.specialRule
      : star.specialRule ?? star.specialRuleEn;
  return {
    kind: "star",
    lang: options.lang,
    name: star.displayName,
    kindLabel: labels.starPlayer,
    stats: { ma: star.ma, st: star.st, ag: star.ag, pa: star.pa, av: star.av },
    skills,
    playsFor: [...options.playsFor],
    cost: options.cost ?? star.cost,
    costLabel: labels.cost,
    ribbon: star.isMegaStar ? labels.megaStar : undefined,
    infoTitle: labels.specialRule,
    infoText: specialRule
      ? truncateAtWord(specialRule, MAX_INFO_TEXT_LENGTH)
      : undefined,
  };
}

/**
 * Sous-ensemble de `TeamPlayer` (payload `/team/:id`) nécessaire à la carte.
 * Les champs carrière sont optionnels : anciens payloads / joueurs neufs.
 */
export interface TeamPlayerCardSource {
  readonly name: string;
  readonly number: number;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: string;
  readonly spp?: number;
  readonly matchesPlayed?: number;
  readonly totalTouchdowns?: number;
  readonly totalCasualties?: number;
  readonly dead?: boolean;
  readonly firedAt?: string | null;
}

export interface BuildTeamCardOptions {
  readonly lang: CardLang;
  /** Nom du poste déjà résolu ("Blitzer"). */
  readonly positionName: string;
  readonly teamName: string;
  /** Nom d'affichage du roster ("Skavens") — 2e ligne de "Joue pour". */
  readonly rosterName?: string;
  readonly rosterSlug: string;
  /** Valeur du joueur en po (coût de la position). */
  readonly cost: number | null;
}

/** Carte d'un joueur d'équipe (fiche "Mes équipes"). */
export function buildTeamPlayerCardData(
  player: TeamPlayerCardSource,
  options: BuildTeamCardOptions,
): PlayerCardData {
  const labels = CARD_LABELS[options.lang];
  const skills = getDisplayNames(player.skills ?? "", options.lang);
  const ribbon = player.dead
    ? labels.deceased
    : player.firedAt
      ? labels.released
      : undefined;
  const playsFor = options.rosterName
    ? [options.teamName, options.rosterName]
    : [options.teamName];
  return {
    kind: "team",
    lang: options.lang,
    name: player.name,
    kindLabel: options.positionName,
    number: player.number,
    rosterSlug: options.rosterSlug,
    stats: {
      ma: player.ma,
      st: player.st,
      ag: player.ag,
      pa: player.pa,
      av: player.av,
    },
    skills,
    playsFor,
    cost: options.cost,
    costLabel: labels.value,
    ribbon,
    infoTitle: labels.career,
    infoStats: [
      { label: labels.matches, value: String(player.matchesPlayed ?? 0) },
      { label: labels.touchdowns, value: String(player.totalTouchdowns ?? 0) },
      { label: labels.casualties, value: String(player.totalCasualties ?? 0) },
      { label: labels.spp, value: String(player.spp ?? 0) },
    ],
  };
}

// ---------------------------------------------------------------------------
// Encodage / décodage du payload URL
// ---------------------------------------------------------------------------

/** Uint8Array → base64url (sans padding). Isomorphe navigateur / node. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/** Sérialise la carte pour l'URL du renderer (`?d=`). */
export function encodeCardPayload(data: PlayerCardData): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(data)));
}

function cleanString(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex -- filtre les caractères de contrôle.
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function cleanInt(raw: unknown, min: number, max: number): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const int = Math.floor(raw);
  if (int < min || int > max) return null;
  return int;
}

function cleanStats(raw: unknown): PlayerCardStats | null {
  if (typeof raw !== "object" || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const ma = cleanInt(source.ma, 0, MAX_STAT_VALUE);
  const st = cleanInt(source.st, 0, MAX_STAT_VALUE);
  const ag = cleanInt(source.ag, 0, MAX_STAT_VALUE);
  const av = cleanInt(source.av, 0, MAX_STAT_VALUE);
  const pa =
    source.pa === null || source.pa === undefined
      ? null
      : cleanInt(source.pa, 0, MAX_STAT_VALUE);
  if (ma === null || st === null || ag === null || av === null) return null;
  return { ma, st, ag, pa, av };
}

function cleanStringArray(
  raw: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(raw)) return [];
  const items: string[] = [];
  for (const entry of raw) {
    if (items.length >= maxItems) break;
    const cleaned = cleanString(entry, maxLength);
    if (cleaned) items.push(cleaned);
  }
  return items;
}

function cleanInfoStats(raw: unknown): PlayerCardInfoStat[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const stats: PlayerCardInfoStat[] = [];
  for (const entry of raw) {
    if (stats.length >= MAX_INFO_STATS) break;
    if (typeof entry !== "object" || entry === null) continue;
    const source = entry as Record<string, unknown>;
    const label = cleanString(source.label, MAX_INFO_STAT_LABEL_LENGTH);
    const value = cleanString(source.value, MAX_INFO_STAT_VALUE_LENGTH);
    if (label && value) stats.push({ label, value });
  }
  return stats.length ? stats : undefined;
}

/**
 * Décode et VALIDE un payload `?d=`. Retourne `null` pour tout payload
 * malformé, hors bornes ou incomplet — le renderer répond alors 400.
 */
export function decodeCardPayload(
  raw: string | null | undefined,
): PlayerCardData | null {
  if (!raw || raw.length > MAX_ENCODED_PAYLOAD_LENGTH) return null;
  const bytes = fromBase64Url(raw);
  if (!bytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const source = parsed as Record<string, unknown>;

  const kind: CardKind = source.kind === "star" ? "star" : "team";
  const lang: CardLang = source.lang === "en" ? "en" : "fr";
  const name = cleanString(source.name, MAX_NAME_LENGTH);
  const kindLabel = cleanString(source.kindLabel, MAX_KIND_LABEL_LENGTH);
  const stats = cleanStats(source.stats);
  if (!name || !kindLabel || !stats) return null;

  const rosterSlugRaw = cleanString(source.rosterSlug, MAX_ROSTER_SLUG_LENGTH);
  const rosterSlug =
    rosterSlugRaw && ROSTER_SLUG_RE.test(rosterSlugRaw)
      ? rosterSlugRaw
      : undefined;

  const infoText = cleanString(source.infoText, MAX_INFO_TEXT_LENGTH + 1);
  const infoStats = cleanInfoStats(source.infoStats);

  return {
    kind,
    lang,
    name,
    kindLabel,
    number: cleanInt(source.number, 0, MAX_NUMBER) ?? undefined,
    rosterSlug,
    stats,
    skills: cleanStringArray(source.skills, MAX_SKILLS, MAX_SKILL_LENGTH),
    playsFor: cleanStringArray(
      source.playsFor,
      MAX_PLAYS_FOR,
      MAX_PLAYS_FOR_LENGTH,
    ),
    cost: cleanInt(source.cost, 0, MAX_COST),
    costLabel:
      cleanString(source.costLabel, MAX_KIND_LABEL_LENGTH) ??
      CARD_LABELS[lang].value,
    ribbon: cleanString(source.ribbon, MAX_RIBBON_LENGTH) ?? undefined,
    infoTitle:
      cleanString(source.infoTitle, MAX_INFO_TITLE_LENGTH) ??
      CARD_LABELS[lang].career,
    infoText: infoText ? truncateAtWord(infoText, MAX_INFO_TEXT_LENGTH) : undefined,
    infoStats,
  };
}
