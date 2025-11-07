import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route API pour synchroniser le token depuis localStorage vers les cookies
 * Cette route est appelée côté client pour créer le cookie nécessaire au middleware
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = body.token;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token manquant" }, { status: 400 });
  }

  // Crée une réponse avec le cookie
  const response = NextResponse.json({ success: true });
  response.cookies.set("auth_token", token, {
    path: "/",
    maxAge: 86400, // 24 heures
    sameSite: "lax",
    httpOnly: false, // Doit être accessible depuis JavaScript pour la synchronisation
  });

  return response;
}

