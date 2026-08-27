/**
 * Carte exportable d'un Star Player (change `export-player-cards`).
 *
 * `GET /star-players/:slug/card?lang=en&download=1` → PNG 750×1050.
 *
 * URL stable et partageable : les données sont chargées côté serveur depuis
 * l'API publique (même source que la fiche et son image OG), puis rendues
 * par le même pipeline satori que `/api/player-card`.
 */
import { getStarPlayerPair, type Ruleset } from "@bb/game-engine";
import { fetchServerJson, getServerApiBase } from "../../../lib/serverApi";
import {
  buildStarPlayerCardData,
  type CardLang,
} from "../../../lib/player-card/card-model";
import { renderPlayerCardResponse } from "../../../lib/player-card/render";
import { getPlaysForCardLines, toPlaysForCardLines } from "../plays-for";

export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9_-]{1,60}$/i;

interface StarPayload {
  displayName?: string;
  cost?: number;
  ma?: number;
  st?: number;
  ag?: number;
  pa?: number | null;
  av?: number;
  skills?: string;
  hirableBy?: string[];
  isMegaStar?: boolean;
  specialRule?: string;
  specialRuleEn?: string;
  /** Édition réellement servie pour ce slug (pas toujours la Saison 3). */
  ruleset?: string;
  /** Rosters pouvant recruter, résolus par le serveur DEPUIS LA BASE. */
  playsFor?: string[];
  /** Prix de la paire, calculé par le serveur sur les coûts en base. */
  pairCost?: number | null;
}

function isRenderableStar(
  star: StarPayload,
): star is StarPayload & {
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  av: number;
} {
  return (
    typeof star.displayName === "string" &&
    star.displayName.length > 0 &&
    typeof star.cost === "number" &&
    typeof star.ma === "number" &&
    typeof star.st === "number" &&
    typeof star.ag === "number" &&
    typeof star.av === "number"
  );
}

async function fetchStar(slug: string): Promise<StarPayload | null> {
  const base = getServerApiBase();
  const payload = await fetchServerJson<{
    success?: boolean;
    data?: StarPayload;
  }>(`${base}/star-players/${encodeURIComponent(slug)}`, {
    // URL stable ⇒ la fraîcheur vient du revalidate : 5 min suffisent pour
    // qu'une correction admin d'un star soit visible rapidement sur la carte.
    next: { revalidate: 300 },
  });
  return payload?.success && payload.data ? payload.data : null;
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const slug = params.slug;
  if (!SLUG_RE.test(slug)) {
    return Response.json(
      { success: false, error: "Star Player introuvable" },
      { status: 404 },
    );
  }

  let star: StarPayload | null = null;
  try {
    star = await fetchStar(slug);
  } catch {
    return Response.json(
      { success: false, error: "API indisponible, réessayez plus tard" },
      { status: 502 },
    );
  }
  if (!star || !isRenderableStar(star)) {
    return Response.json(
      { success: false, error: "Star Player introuvable" },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const lang: CardLang = url.searchParams.get("lang") === "en" ? "en" : "fr";
  // Édition RÉELLEMENT servie pour ce slug : « season_3 » était codé en dur,
  // donc une star qui n'existe qu'en Saison 2 se voyait appliquer la table de
  // paires de la Saison 3 (W7 de l'audit).
  const ruleset = (star.ruleset as Ruleset | undefined) ?? undefined;
  // Recrutement en paire : la fiche affiche le prix de LA PAIRE — la carte
  // doit montrer le même montant (cf. fiche star, Lot G). Prix FRAIS depuis
  // l'API (coûts en base) ; le catalogue compilé ne sert que de repli.
  const pair = getStarPlayerPair(slug, ruleset);
  const pairCost = star.pairCost ?? (pair ? pair.pairCost : null);
  const data = buildStarPlayerCardData(
    {
      displayName: star.displayName,
      cost: star.cost,
      ma: star.ma,
      st: star.st,
      ag: star.ag,
      pa: star.pa ?? null,
      av: star.av,
      skills: star.skills ?? "",
      isMegaStar: star.isMegaStar,
      specialRule: star.specialRule,
      specialRuleEn: star.specialRuleEn,
    },
    {
      lang,
      // « Joue pour » résolu par le serveur depuis les rosters EN BASE du
      // ruleset de la star ; dérivation locale de `hirableBy` en repli.
      playsFor: star.playsFor
        ? toPlaysForCardLines(star.playsFor, lang)
        : getPlaysForCardLines(star.hirableBy, lang, ruleset),
      cost: pairCost ?? star.cost,
    },
  );
  return renderPlayerCardResponse(data, {
    download: url.searchParams.get("download") === "1",
    // URL stable (non adressée par le contenu) : cache navigateur court pour
    // suivre les corrections de données star sans re-render à chaque vue.
    cacheControl: "public, max-age=300",
  });
}
