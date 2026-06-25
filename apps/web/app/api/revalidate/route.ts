import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

// Route d'invalidation de cache ISR à la demande.
//
// Protégée par un secret partagé (`REVALIDATE_SECRET`) fourni soit via
// l'en-tête `x-revalidate-secret`, soit via `?secret=`. Sans secret
// configuré côté serveur, la route répond 401 (désactivée par défaut).
//
// Usage manuel :
//   curl -X POST "https://nufflearena.fr/api/revalidate?path=/teams/underworld" \
//        -H "x-revalidate-secret: $REVALIDATE_SECRET"
//
// Usage programmatique (depuis le serveur API après une écriture roster) :
//   POST /api/revalidate  body {"tags":["rosters","roster:underworld"]}
//
// `tags` nécessite que les `fetch` concernés soient taggés
// (`next: { tags: [...] }`). `path` revalide le segment de route.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RevalidateBody {
  paths?: unknown;
  tags?: unknown;
}

function collectStrings(raw: unknown, into: Set<string>): void {
  if (!Array.isArray(raw)) return;
  for (const v of raw) {
    if (typeof v === "string" && v.trim()) into.add(v.trim());
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.REVALIDATE_SECRET;
  const url = new URL(request.url);
  const provided =
    request.headers.get("x-revalidate-secret") ??
    url.searchParams.get("secret");

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const paths = new Set<string>();
  const tags = new Set<string>();

  const qpPath = url.searchParams.get("path");
  const qpTag = url.searchParams.get("tag");
  if (qpPath?.trim()) paths.add(qpPath.trim());
  if (qpTag?.trim()) tags.add(qpTag.trim());

  // Corps JSON optionnel : { paths?: string[], tags?: string[] }.
  try {
    const body = (await request.json()) as RevalidateBody;
    collectStrings(body?.paths, paths);
    collectStrings(body?.tags, tags);
  } catch {
    // Pas de corps JSON valide → on s'en tient aux query params.
  }

  if (paths.size === 0 && tags.size === 0) {
    return NextResponse.json(
      { error: "no path or tag provided" },
      { status: 400 },
    );
  }

  for (const tag of tags) revalidateTag(tag);
  for (const path of paths) revalidatePath(path);

  return NextResponse.json({
    revalidated: true,
    paths: [...paths],
    tags: [...tags],
  });
}
