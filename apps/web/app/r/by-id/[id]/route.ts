/**
 * Résolveur d'un lien de fiche privée vers la page publique de l'équipe.
 *
 * Cible du détournement posé par `middleware.ts` (cf.
 * `lib/private-team-share-divert.ts`) : la requête arrive ici SANS session.
 *
 *  - équipe publique (`isPublic`) → 307 vers `/r/:token`. Le scraper
 *    unfurle alors la vraie carte (logo, nom, description) et l'humain à
 *    qui le lien était destiné voit le roster, au lieu d'un mur de login
 *    pour une équipe qui n'est pas la sienne.
 *  - sinon → parcours de connexion habituel, `?redirect=` intact.
 *
 * Le chemin de repli est RECONSTRUIT ici à partir de `params.id` : aucune
 * URL fournie par l'appelant n'est suivie, donc aucune redirection ouverte
 * possible. `sync=1` ne porte qu'un booléen (le middleware avait-il un
 * cookie d'auth), pas une destination.
 *
 * `/r/by-id` ne peut pas entrer en collision avec `/r/[token]` : un
 * `shareToken` est une chaîne de 32 caractères hexadécimaux.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchTeamSharePreview } from "../../../lib/team-share-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const preview = await fetchTeamSharePreview(params.id);

  if (preview?.shareToken) {
    return NextResponse.redirect(
      new URL(`/r/${preview.shareToken}`, request.nextUrl.origin),
      307,
    );
  }

  // Équipe privée, inexistante, ou API injoignable : on reconduit très
  // exactement le parcours que le middleware aurait suivi.
  const useSync = request.nextUrl.searchParams.get("sync") === "1";
  const fallback = new URL(
    useSync ? "/auth/sync" : "/login",
    request.nextUrl.origin,
  );
  fallback.searchParams.set("redirect", `/me/teams/${params.id}`);
  return NextResponse.redirect(fallback, 307);
}
