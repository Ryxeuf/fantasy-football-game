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
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = body?.token;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token manquant" }, { status: 400 });
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
