/**
 * E2E API — Documents officiels de competition (ligues et coupes).
 *
 * Rejoue la chaine complete contre une vraie base : creation de la
 * competition, depot du binaire brut, listing public, corrections, purge —
 * plus les refus (coach tiers, format non supporte, depassement de taille).
 *
 * C'est le seul niveau qui verifie que la FK polymorphe, le parser `raw` et
 * `express.static` s'accordent : les tests unitaires mockent Prisma, ils ne
 * peuvent pas attraper une contrainte de schema.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { get, post, rawDelete, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";
import { API_BASE } from "../helpers/env";

interface LeagueDTO {
  id: string;
  creatorId: string;
}
interface CupDTO {
  id: string;
}
interface DocumentDTO {
  id: string;
  competitionKind: "league" | "cup";
  competitionId: string;
  title: string;
  description: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  bytes: number;
  url: string;
  sortOrder: number;
  uploadedBy: { id: string; coachName: string } | null;
}

/** PDF minimal valide du point de vue de la detection (signature `%PDF-`). */
function pdfBuffer(size = 256): Buffer {
  const buf = Buffer.alloc(size, 0x20);
  buf.write("%PDF-1.7\n", 0, "ascii");
  return buf;
}

/** Upload brut : les helpers REST envoient du JSON, pas un binaire. */
async function uploadDocument(
  scope: "leagues" | "cups",
  competitionId: string,
  token: string | null,
  body: Buffer,
  query: Record<string, string> = {},
  contentType = "application/pdf",
): Promise<Response> {
  const qs = new URLSearchParams(query).toString();
  return fetch(
    `${API_BASE}/api/competitions/${scope}/${competitionId}/documents${
      qs ? `?${qs}` : ""
    }`,
    {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: new Uint8Array(body),
    },
  );
}

async function patchDocument(
  scope: "leagues" | "cups",
  competitionId: string,
  documentId: string,
  token: string | null,
  body: unknown,
): Promise<Response> {
  return fetch(
    `${API_BASE}/api/competitions/${scope}/${competitionId}/documents/${documentId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
  );
}

let commissioner: { token: string; userId: string };
let outsider: { token: string; userId: string };
let admin: { token: string; userId: string };
let leagueId: string;
let cupId: string;

beforeAll(async () => {
  await resetDb();
  commissioner = await seedAndLogin(
    "commissioner-docs@e2e.test",
    "pwd",
    "Grim",
  );
  outsider = await seedAndLogin("outsider-docs@e2e.test", "pwd", "Skab");
  admin = await seedAndLogin("admin-docs@e2e.test", "pwd", "Boss", {
    role: "admin",
  });

  const league = unwrap(
    await post<{ success: true; data: LeagueDTO }>(
      "/leagues",
      commissioner.token,
      { name: "Ligue des Documents", maxParticipants: 4 },
    ),
  );
  leagueId = league.id;

  const cup = await post<{ cup: CupDTO }>("/cup", commissioner.token, {
    name: "Coupe des Documents",
    isPublic: true,
  });
  cupId = cup.cup.id;
});

describe("Documents officiels — ligue", () => {
  it("le commissaire depose un reglement PDF", async () => {
    const res = await uploadDocument(
      "leagues",
      leagueId,
      commissioner.token,
      pdfBuffer(),
      { filename: "reglement.pdf", title: "Règlement 2027" },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { document: DocumentDTO } };
    const doc = body.data.document;
    expect(doc).toMatchObject({
      competitionKind: "league",
      competitionId: leagueId,
      title: "Règlement 2027",
      mimeType: "application/pdf",
      originalName: "reglement.pdf",
    });
    // Nom regenere cote serveur : jamais celui du client tel quel.
    expect(doc.filename).toMatch(/^reglement-[0-9a-f]{12}\.pdf$/);
    expect(doc.uploadedBy?.id).toBe(commissioner.userId);
  });

  it("le fichier est reellement servi a son URL publique", async () => {
    const listed = unwrap(
      await get<{ success: true; data: { documents: DocumentDTO[] } }>(
        `/api/competitions/leagues/${leagueId}/documents`,
        null,
      ),
    );
    const doc = listed.documents[0];
    const res = await fetch(`${API_BASE}${doc.url}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
  });

  it("la liste est publique pour une ligue publique", async () => {
    const listed = unwrap(
      await get<{ success: true; data: { documents: DocumentDTO[] } }>(
        `/api/competitions/leagues/${leagueId}/documents`,
        null,
      ),
    );
    expect(listed.documents).toHaveLength(1);
  });

  it("refuse un coach qui n'est pas commissaire (403)", async () => {
    const res = await uploadDocument(
      "leagues",
      leagueId,
      outsider.token,
      pdfBuffer(),
      { filename: "pirate.pdf" },
    );
    expect(res.status).toBe(403);
  });

  it("refuse un visiteur non authentifie (401)", async () => {
    const res = await uploadDocument("leagues", leagueId, null, pdfBuffer(), {
      filename: "anon.pdf",
    });
    expect(res.status).toBe(401);
  });

  it("refuse une archive renommee en .pdf (415, magic bytes)", async () => {
    const zip = Buffer.alloc(64);
    zip.set([0x50, 0x4b, 0x03, 0x04], 0);
    const res = await uploadDocument(
      "leagues",
      leagueId,
      commissioner.token,
      zip,
      {
        filename: "piege.pdf",
      },
    );
    expect(res.status).toBe(415);
  });

  it("refuse un fichier de plus de 10 Mo (413)", async () => {
    const big = pdfBuffer(10 * 1024 * 1024 + 1024);
    const res = await uploadDocument(
      "leagues",
      leagueId,
      commissioner.token,
      big,
      { filename: "gros.pdf" },
    );
    expect(res.status).toBe(413);
  });

  it("accepte un depot une fois la ligue demarree", async () => {
    // Le statut de la ligue ne verrouille PAS les documents (contrairement
    // aux parametres de scoring).
    const season = unwrap(
      await post<{ success: true; data: { id: string } }>(
        `/leagues/${leagueId}/seasons`,
        commissioner.token,
        { name: "S1" },
      ),
    );
    expect(season.id).toBeTruthy();
    const res = await uploadDocument(
      "leagues",
      leagueId,
      commissioner.token,
      pdfBuffer(),
      { filename: "calendrier.pdf" },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { document: DocumentDTO } };
    // Second document => il se place a la suite du premier.
    expect(body.data.document.sortOrder).toBe(1);
  });

  it("le commissaire corrige le libelle puis supprime le document", async () => {
    const listed = unwrap(
      await get<{ success: true; data: { documents: DocumentDTO[] } }>(
        `/api/competitions/leagues/${leagueId}/documents`,
        commissioner.token,
      ),
    );
    const target = listed.documents[listed.documents.length - 1];

    const patched = await patchDocument(
      "leagues",
      leagueId,
      target.id,
      commissioner.token,
      { title: "Calendrier officiel", description: "Journées 1 à 6" },
    );
    expect(patched.status).toBe(200);
    const patchedBody = (await patched.json()) as {
      data: { document: DocumentDTO };
    };
    expect(patchedBody.data.document).toMatchObject({
      title: "Calendrier officiel",
      description: "Journées 1 à 6",
    });

    const deleted = await rawDelete(
      `/api/competitions/leagues/${leagueId}/documents/${target.id}`,
      commissioner.token,
    );
    expect(deleted.status).toBe(200);

    const after = unwrap(
      await get<{ success: true; data: { documents: DocumentDTO[] } }>(
        `/api/competitions/leagues/${leagueId}/documents`,
        null,
      ),
    );
    expect(after.documents.some((d) => d.id === target.id)).toBe(false);
    // Le binaire n'est plus servi non plus.
    const gone = await fetch(`${API_BASE}${target.url}`);
    expect(gone.status).toBe(404);
  });
});

describe("Documents officiels — coupe", () => {
  it("se rattache a la coupe via la FK cupId", async () => {
    const res = await uploadDocument(
      "cups",
      cupId,
      commissioner.token,
      pdfBuffer(),
      { filename: "reglement-coupe.pdf" },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { document: DocumentDTO } };
    expect(body.data.document).toMatchObject({
      competitionKind: "cup",
      competitionId: cupId,
      title: "reglement-coupe",
    });
  });

  it("404 sur une competition inconnue", async () => {
    const res = await uploadDocument(
      "cups",
      "cup-inexistante",
      commissioner.token,
      pdfBuffer(),
    );
    expect(res.status).toBe(404);
  });

  it("400 sur une famille de competition inconnue", async () => {
    const res = await uploadDocument(
      "tournois" as "cups",
      cupId,
      commissioner.token,
      pdfBuffer(),
    );
    expect(res.status).toBe(400);
  });
});

describe("Documents officiels — administration", () => {
  it("l'admin voit les documents de toutes les competitions", async () => {
    const res = await fetch(`${API_BASE}/admin/competition-documents`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { documents: DocumentDTO[] };
      meta: { total: number };
    };
    expect(body.meta.total).toBeGreaterThanOrEqual(2);
    expect(body.data.documents.some((d) => d.competitionKind === "cup")).toBe(
      true,
    );
  });

  it("la console admin est fermee aux non-admins", async () => {
    const res = await fetch(`${API_BASE}/admin/competition-documents`, {
      headers: { Authorization: `Bearer ${outsider.token}` },
    });
    expect(res.status).toBe(403);
  });

  it("l'admin depose sur la competition d'un autre coach", async () => {
    const res = await uploadDocument(
      "leagues",
      leagueId,
      admin.token,
      pdfBuffer(),
      { filename: "charte-admin.pdf" },
    );
    expect(res.status).toBe(201);
  });

  it("l'admin purge n'importe quel document", async () => {
    const listRes = await fetch(
      `${API_BASE}/admin/competition-documents?search=charte`,
      { headers: { Authorization: `Bearer ${admin.token}` } },
    );
    const body = (await listRes.json()) as {
      data: { documents: DocumentDTO[] };
    };
    const target = body.data.documents[0];
    expect(target).toBeTruthy();

    const res = await fetch(
      `${API_BASE}/admin/competition-documents/${target.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${admin.token}` },
      },
    );
    expect(res.status).toBe(200);
  });
});
