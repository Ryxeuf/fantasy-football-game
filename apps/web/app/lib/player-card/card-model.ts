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
  /**
   * Lignes de la rubrique "Joue pour" : le nom de l'équipe pour un joueur
   * positionnel, les rosters recruteurs pour un Star Player.
   */
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
  /**
   * Photo du joueur (pleine résolution) affichée à la place de l'emblème
   * programmatique. URL STRICTEMENT validée au décodage (chemin
   * `/images/player-images/*` + origine allowlistée) : le renderer
   * (`/api/player-card`) la fetch côté serveur — anti-SSRF.
   */
  readonly imageUrl?: string;
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
/**
 * Coupe de sécurité du texte libre (règle spéciale). Calibrée sur le corpus
 * réel : la plus longue règle de star (Zzharg Madeye) fait 515 caractères —
 * elle DOIT tenir en entier (police dégressive via `infoTextFontSize`),
 * l'ellipse ne joue que sur des payloads arbitraires du renderer générique.
 */
export const MAX_INFO_TEXT_LENGTH = 560;
const MAX_INFO_STATS = 5;
const MAX_INFO_STAT_LABEL_LENGTH = 16;
const MAX_INFO_STAT_VALUE_LENGTH = 12;
const MAX_COST = 5_000_000;
const MAX_STAT_VALUE = 15;
const MAX_NUMBER = 99;

const ROSTER_SLUG_RE = /^[a-z0-9_-]+$/;

const MAX_IMAGE_URL_LENGTH = 300;
/** Chemin d'une image de joueur servie par notre API (nom généré). */
const PLAYER_IMAGE_PATH_RE =
  /^\/images\/player-images\/[a-z0-9][a-z0-9-]*\.(png|jpg)$/i;

/**
 * Origines autorisées pour l'image de la carte (anti-SSRF : le payload est
 * contrôlable par l'appelant et le renderer fetch l'URL côté serveur).
 */
function allowedImageOrigins(): string[] {
  const bases = [
    process.env.NEXT_PUBLIC_API_BASE,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];
  const origins: string[] = [];
  for (const base of bases) {
    if (!base) continue;
    try {
      origins.push(new URL(base).origin);
    } catch {
      // base invalide -> ignorée
    }
  }
  return origins;
}

/**
 * Valide une URL d'image de joueur : chemin relatif de notre dossier
 * d'upload, ou URL absolue http(s) du même chemin sur une origine
 * allowlistée. Tout le reste est rejeté (undefined).
 */
export function sanitizePlayerImageUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  if (raw.length > MAX_IMAGE_URL_LENGTH) return undefined;
  if (raw.startsWith("/")) {
    return PLAYER_IMAGE_PATH_RE.test(raw) ? raw : undefined;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (!PLAYER_IMAGE_PATH_RE.test(url.pathname)) return undefined;
    if (!allowedImageOrigins().includes(url.origin)) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

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

/**
 * Taille de police des listes (compétences, « joue pour »), dégressive selon
 * la longueur du texte joint — une star à 9-10 compétences (~130 caractères,
 * pire cas réel : Gretchen Wachter 132) reste sur ~3 lignes.
 */
export function listFontSize(totalLength: number): number {
  if (totalLength <= 90) return 23;
  if (totalLength <= 140) return 20;
  return 17;
}

/**
 * Taille de police du texte libre (règle spéciale), dégressive pour que la
 * règle la plus longue du corpus (515 caractères) tienne EN ENTIER sur la
 * carte, l'emblème se comprimant en face (minHeight).
 */
export function infoTextFontSize(length: number): number {
  if (length <= 150) return 21;
  if (length <= 260) return 19;
  if (length <= 400) return 17;
  return 15;
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
  /** Photo uploadée par le coach (pleine résolution sur la carte). */
  readonly imageUrl?: string | null;
}

export interface BuildTeamCardOptions {
  readonly lang: CardLang;
  /** Nom du poste déjà résolu ("Blitzer"). */
  readonly positionName: string;
  readonly teamName: string;
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
    // Joueur positionnel : « Joue pour » = le nom de l'équipe, rien d'autre
    // (le roster est déjà porté par le thème/emblème et le poste).
    playsFor: [options.teamName],
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
    imageUrl: sanitizePlayerImageUrl(player.imageUrl),
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
    imageUrl: sanitizePlayerImageUrl(source.imageUrl),
  };
}
