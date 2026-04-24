import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeJWT, isAdminToken } from "./lib/jwt-utils";

function verifyAdminAccess(request: NextRequest): boolean {
  // Récupère le token depuis les cookies ou les headers
  const token =
    request.cookies.get("auth_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return false;
  }

  // Vérifie directement le token JWT (décodage sans vérification de signature pour Edge Runtime)
  // La vérification de signature complète est faite côté serveur dans les routes API
  return isAdminToken(token);
}

function hasValidAuthToken(request: NextRequest): boolean {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  // decodeJWT retourne null si le token est expiré ou invalide
  return decodeJWT(token) !== null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore les routes API pour éviter les boucles
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Protège toutes les routes commençant par /admin
  if (pathname.startsWith("/admin")) {
    // Ignore la page de synchronisation elle-même
    if (pathname === "/admin/sync") {
      return NextResponse.next();
    }

    const hasCookie = request.cookies.has("auth_token");

    const isAdmin = verifyAdminAccess(request);

    if (!isAdmin) {
      // Si pas de cookie mais que l'utilisateur pourrait être authentifié via localStorage,
      // redirige vers la page de synchronisation
      // Sinon, retourne une 404 pour masquer l'existence de la page
      if (!hasCookie) {
        // Redirige vers la page de synchronisation qui vérifiera localStorage
        const url = request.nextUrl.clone();
        url.pathname = "/admin/sync";
        url.searchParams.set("redirect", pathname);
        return NextResponse.redirect(url);
      }

      // Cookie présent mais pas admin ou token invalide -> 404
      return new NextResponse(null, { status: 404 });
    }
  }

  // Protège toutes les routes commençant par /me : connexion ou création de compte requise
  if (pathname.startsWith("/me")) {
    if (!hasValidAuthToken(request)) {
      const redirectTarget = pathname + (request.nextUrl.search || "");
      const url = request.nextUrl.clone();

      // Si aucun cookie n'est présent, tente d'abord une synchronisation depuis
      // localStorage (utilisateurs déjà connectés sans cookie).
      // Si un cookie est présent mais invalide/expiré, redirige directement vers le login.
      if (!request.cookies.has("auth_token")) {
        url.pathname = "/auth/sync";
      } else {
        url.pathname = "/login";
      }
      url.search = "";
      url.searchParams.set("redirect", redirectTarget);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/me/:path*"],
};

