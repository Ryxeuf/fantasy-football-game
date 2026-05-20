import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Synchronise le token depuis le client vers un cookie httpOnly.
 *
 * S24.1 : le cookie est httpOnly + sameSite=strict + secure (en
 * production) afin qu'un attaquant XSS ne puisse pas le voler via
 * `document.cookie` ni le rejouer en CSRF cross-site. Le token reste
 * disponible cote client via localStorage pour les appels API
 * authentifies par header `Authorization`.
 *
 * Audit round 11 (CRITICAL) : avant, on stockait n'importe quel
 * string fourni par le client sans verifier la signature JWT. Le
 * `middleware.ts` gate ensuite `/admin/*` via `isAdminToken` qui
 * decode le JWT SANS verifier la signature (Edge Runtime ne supporte
 * pas jose). Un attaquant pouvait fabriquer un JWT
 * `{role: "admin"}` avec une signature arbitraire, POST a cet endpoint,
 * et bypass le middleware admin → render des pages admin.
 *
 * Fix : valider le token contre le backend via `/auth/me` avant de
 * set le cookie. Si le token est invalide ou si le backend n'est pas
 * joignable, on refuse le set.
 */

function inferApiBase(): string {
  // Cote server-side Next.js (cette route tourne dans Node, pas Edge),
  // on prefere SERVER_API_BASE quand il est defini : c'est l'URL HTTP
  // interne docker (ex: http://nufflearena_server:8201) qui evite les
  // problemes de TLS self-signed sur les domaines OrbStack *.orb.local.
  // Sinon, fallback sur NEXT_PUBLIC_API_BASE (utilise par le client),
  // puis localhost en dernier recours.
  if (process.env.SERVER_API_BASE) return process.env.SERVER_API_BASE;
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  return "http://localhost:4000";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = body?.token;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token manquant" }, { status: 400 });
  }

  // Audit round 11 : valide le token cote serveur avant de set le cookie.
  // Le backend signe le JWT avec un secret connu seulement de lui ;
  // /auth/me retourne 200 uniquement si la signature est valide.
  try {
    const verifyResponse = await fetch(`${inferApiBase()}/auth/me`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      // 5s pour eviter de bloquer le user en cas de backend lent.
      signal: AbortSignal.timeout(5000),
    });
    if (!verifyResponse.ok) {
      return NextResponse.json(
        { error: "Token invalide" },
        { status: 401 },
      );
    }
  } catch {
    // Backend injoignable ou timeout : on refuse plutot que set un
    // cookie potentiellement forge.
    return NextResponse.json(
      { error: "Verification token impossible" },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("auth_token", token, {
    path: "/",
    maxAge: 86400,
    sameSite: "strict",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
