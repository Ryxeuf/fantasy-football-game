import { NextResponse } from "next/server";

/**
 * Efface le cookie httpOnly auth_token (S24.1).
 *
 * Quand le cookie est httpOnly, JavaScript ne peut plus l'effacer via
 * `document.cookie`. Cette route est appelee par le client pour
 * deconnecter l'utilisateur de maniere fiable.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("auth_token", "", {
    path: "/",
    maxAge: 0,
    sameSite: "strict",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
