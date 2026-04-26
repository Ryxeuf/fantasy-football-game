/**
 * Sert la cle IndexNow en text/plain (Q.18 — Sprint 23).
 *
 * Les operateurs IndexNow (Bing, Yandex, Naver, Seznam, Yep) verifient
 * la possession du domaine en lisant ce fichier dont le contenu doit
 * etre exactement la cle. Pour un cycle de rotation simple, on autorise
 * un override `keyLocation` dans le payload (le fichier peut donc etre
 * a un chemin fixe `/indexnow-key.txt`).
 *
 * Cle pilotee par l env : NEXT_PUBLIC_INDEXNOW_KEY.
 * Si la cle est absente / invalide, retourne 404 pour eviter de leaker
 * un placeholder ou de servir une cle non configuree.
 */
import { NextResponse } from "next/server";
import { isValidIndexNowKey } from "../lib/indexnow";

export const dynamic = "force-static";
export const revalidate = 86400; // 24h

export async function GET(): Promise<NextResponse> {
  const key = process.env.NEXT_PUBLIC_INDEXNOW_KEY;
  if (!isValidIndexNowKey(key)) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new NextResponse(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
