/**
 * Renderer générique de carte joueur (change `export-player-cards`).
 *
 * `GET /api/player-card?d=<base64url(JSON PlayerCardData)>&download=1`
 *
 * Le payload est fourni par le client (fiche d'équipe) : il ne contient que
 * des données d'affichage non sensibles, déjà visibles par leur auteur. Le
 * décodeur (`decodeCardPayload`) borne strictement chaque champ — un payload
 * malformé ou hors bornes répond 400 sans rien dessiner.
 */
import {
  decodeCardPayload,
  MAX_ENCODED_PAYLOAD_LENGTH,
} from "../../lib/player-card/card-model";
import { renderPlayerCardResponse } from "../../lib/player-card/render";
import { resolveCardImageUrl } from "../../lib/player-card/portrait";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const raw = url.searchParams.get("d");
  if (!raw || raw.length > MAX_ENCODED_PAYLOAD_LENGTH) {
    return Response.json(
      { success: false, error: "Payload de carte manquant ou trop long" },
      { status: 400 },
    );
  }
  const data = decodeCardPayload(raw);
  if (!data) {
    return Response.json(
      { success: false, error: "Payload de carte invalide" },
      { status: 400 },
    );
  }
  // Portrait (déjà validé par le décodeur) : un asset local du site est lu
  // sur disque et embarqué en data URI — c'est le seul moyen d'afficher un
  // `.webp`, que satori ne sait pas décoder. Sinon, une URL relative est
  // résolue contre l'origine de la requête (même origine, pas de SSRF
  // nouveau) pour que satori puisse la fetch.
  const portrait = await resolveCardImageUrl(data.imageUrl, url.origin);
  const resolved = portrait === data.imageUrl ? data : { ...data, imageUrl: portrait };
  return renderPlayerCardResponse(resolved, {
    download: url.searchParams.get("download") === "1",
    // L'URL est adressée par le contenu : toute évolution du joueur (stats,
    // compétences, carrière) produit un payload — donc une URL — différent.
    // Le PNG d'une URL donnée ne change jamais : cache long + immutable.
    cacheControl: "public, max-age=86400, immutable",
  });
}
