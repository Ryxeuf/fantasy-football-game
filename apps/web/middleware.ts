import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeJWT, isAdminToken } from "./lib/jwt-utils";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  detectLocaleFromHeader,
  type Locale,
} from "./app/lib/locale-detection";

const LOCALE_COOKIE = "NEXT_LOCALE";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

/**
 * Sprint R lot R.A.1 — detection de locale.
 *
 * Set un cookie `NEXT_LOCALE` au premier visit selon `Accept-Language`.
 * Le LanguageContext lit ce cookie au mount cote client si rien n'est
 * stocke en `localStorage`. Les locales SUPPORTED_LOCALES sont
 * "fr" et "en" pour l'instant ; les extensions futures (de, pl)
 * peuvent etre ajoutees en modifiant uniquement `locale-detection.ts`.
 */
function maybeSetLocaleCookie(
  request: NextRequest,
  response: NextResponse,
): void {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (
    existing &&
    (SUPPORTED_LOCALES as readonly string[]).includes(existing)
  ) {
    return;
  }
  const detected: Locale = detectLocaleFromHeader(
    request.headers.get("accept-language"),
    DEFAULT_LOCALE,
  );
  response.cookies.set(LOCALE_COOKIE, detected, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });
}

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

  // Sprint R lot R.A.1 — set NEXT_LOCALE cookie au 1er visit. Pas de
  // matcher specifique : on l'ajoute a chaque response, idempotent.
  const localeResponse = NextResponse.next();
  maybeSetLocaleCookie(request, localeResponse);

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

  return localeResponse;
}

// Matcher elargi pour le cookie locale : toutes les pages sauf
// `/api/*`, `/_next/*` (statics), `/favicon.*`, etc. Les routes
// `/admin/*` et `/me/*` continuent de beneficier des verifs auth.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon|images|fonts|icons|.*\\.).*)",
  ],
};

