import { describe, it, expect, beforeEach } from "vitest";
import { rawGet, rawPatch, unwrap } from "../helpers/api";
import { resetDb } from "../helpers/api";
import { createTeam, seedAndLogin } from "../helpers/factories";

/**
 * Spec de l'aperçu de partage d'un roster.
 *
 * Deux surfaces neuves, toutes deux touchant `Team` :
 *
 *  - `PATCH /team/:id/description` — le fluff du coach (cosmétique, donc
 *    hors verrou anti-triche), trimé, ≤ 1000, chaîne vide ⇒ `null` ;
 *  - `GET /api/public/teams/by-id/:id` — l'aperçu minimal servi à la
 *    metadata de `/me/teams/:id`, et UNIQUEMENT si l'équipe est publique ;
 *  - `GET /api/public/teams/:token` — la page publique elle-même, dont la
 *    réponse porte désormais les chiffres calculés par le serveur (valeur
 *    par joueur, coûts de staff, postes de dépense). Ces enrichissements
 *    interrogent le catalogue (`Roster`, `RosterStaffConfig`, `Position`),
 *    absent ou vide du miroir SQLite : la spec est le garde-fou qui exige
 *    qu'ils DÉGRADENT au lieu de faire tomber la page partagée.
 *
 * Cette suite tourne sur le miroir SQLite (`prisma/sqlite/schema.prisma`),
 * pas sur le schéma Postgres : elle est donc le garde-fou qui exige que la
 * colonne `Team.description` existe DANS LES DEUX. Sans elle, un `select`
 * sur une colonne absente du miroir ne casse qu'en production de test.
 */

interface DescriptionResponse {
  team: { id: string; description: string | null };
}

interface PublicTeamResponse {
  team: {
    id: string;
    name: string;
    roster: string;
    treasury: number;
    rerolls: number;
    logoUrl: string | null;
    description: string | null;
    players: Array<{ id: string; name: string; skills: string }>;
    starPlayers: Array<{ starPlayerSlug: string; cost: number }>;
    staffConfig?: { rerollCost: number };
    budgetSummary?: { teamValue: number };
    playerValues?: Record<string, { value: number }>;
  };
}

interface PreviewResponse {
  preview: {
    id: string;
    name: string;
    roster: string;
    ruleset: string;
    teamValue: number;
    playerCount: number;
    starPlayerNames: string[];
    logoUrl: string | null;
    description: string | null;
    shareToken: string | null;
  };
}

let token: string;
let userId: string;
let teamId: string;

beforeEach(async () => {
  await resetDb();
  const coach = await seedAndLogin("share@test.local", "Password123!", "Coach");
  token = coach.token;
  userId = coach.userId;
  const team = await createTeam(userId, "Les Rats Véloces", "skaven");
  teamId = team.teamId;
});

describe("PATCH /team/:id/description", () => {
  it("enregistre la description en la trimant", async () => {
    const res = await rawPatch(`/team/${teamId}/description`, token, {
      description: "  Écumeurs des égouts de Mordheim.  ",
    });
    expect(res.status).toBe(200);

    const body = unwrap<DescriptionResponse>(await res.json());
    expect(body.team.description).toBe("Écumeurs des égouts de Mordheim.");
  });

  it("ramène une saisie blanche à null", async () => {
    await rawPatch(`/team/${teamId}/description`, token, {
      description: "Un premier fluff",
    });

    const res = await rawPatch(`/team/${teamId}/description`, token, {
      description: "   ",
    });
    expect(res.status).toBe(200);
    expect(unwrap<DescriptionResponse>(await res.json()).team.description).toBeNull();
  });

  it("accepte null explicitement", async () => {
    const res = await rawPatch(`/team/${teamId}/description`, token, {
      description: null,
    });
    expect(res.status).toBe(200);
    expect(unwrap<DescriptionResponse>(await res.json()).team.description).toBeNull();
  });

  it("refuse au-delà de 1000 caractères", async () => {
    const res = await rawPatch(`/team/${teamId}/description`, token, {
      description: "x".repeat(1001),
    });
    expect(res.status).toBe(400);
  });

  it("exige une session", async () => {
    const res = await rawPatch(`/team/${teamId}/description`, null, {
      description: "Fluff",
    });
    expect(res.status).toBe(401);
  });

  it("répond 404 pour l'équipe d'un autre coach", async () => {
    const intrus = await seedAndLogin("intrus@test.local", "Password123!");
    const res = await rawPatch(`/team/${teamId}/description`, intrus.token, {
      description: "Fluff",
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/public/teams/by-id/:id", () => {
  it("reste fermé tant que le partage n'est pas activé", async () => {
    const res = await rawGet(`/api/public/teams/by-id/${teamId}`, null);
    expect(res.status).toBe(404);
  });

  it("sert l'aperçu une fois le partage activé", async () => {
    await rawPatch(`/team/${teamId}/description`, token, {
      description: "Écumeurs des égouts de Mordheim.",
    });
    const share = await rawPatch(`/team/${teamId}/share`, token, {
      enabled: true,
    });
    expect(share.status).toBe(200);

    const res = await rawGet(`/api/public/teams/by-id/${teamId}`, null);
    expect(res.status).toBe(200);

    const { preview } = (await res.json()) as PreviewResponse;
    expect(preview.id).toBe(teamId);
    expect(preview.name).toBe("Les Rats Véloces");
    expect(preview.roster).toBe("skaven");
    expect(preview.description).toBe("Écumeurs des égouts de Mordheim.");
    expect(preview.shareToken).toBeTruthy();
    expect(preview.playerCount).toBeGreaterThan(0);
  });

  it("n'expose que l'aperçu, jamais la trésorerie ni les joueurs", async () => {
    await rawPatch(`/team/${teamId}/share`, token, { enabled: true });

    const res = await rawGet(`/api/public/teams/by-id/${teamId}`, null);
    const { preview } = (await res.json()) as PreviewResponse;

    expect(preview).not.toHaveProperty("treasury");
    expect(preview).not.toHaveProperty("players");
  });

  it("se referme quand le coach coupe le partage", async () => {
    await rawPatch(`/team/${teamId}/share`, token, { enabled: true });
    await rawPatch(`/team/${teamId}/share`, token, { enabled: false });

    const res = await rawGet(`/api/public/teams/by-id/${teamId}`, null);
    expect(res.status).toBe(404);
  });

  it("répond 404 sur un id inconnu, comme sur une équipe privée", async () => {
    const res = await rawGet("/api/public/teams/by-id/team-qui-nexiste-pas", null);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/public/teams/:token", () => {
  async function enableShare(): Promise<string> {
    const res = await rawPatch(`/team/${teamId}/share`, token, {
      enabled: true,
    });
    expect(res.status).toBe(200);
    const { shareToken } = unwrap<{ shareToken: string | null }>(
      await res.json(),
    );
    expect(shareToken).toBeTruthy();
    return shareToken as string;
  }

  it("sert le roster complet d'une équipe partagée", async () => {
    const shareToken = await enableShare();

    const res = await rawGet(`/api/public/teams/${shareToken}`, null);
    expect(res.status).toBe(200);

    const { team } = (await res.json()) as PublicTeamResponse;
    expect(team.name).toBe("Les Rats Véloces");
    expect(team.roster).toBe("skaven");
    expect(team.players.length).toBeGreaterThan(0);
    // Les compétences sont servies pour que la page publique les affiche
    // comme la fiche du coach (base vs acquise).
    expect(typeof team.players[0].skills).toBe("string");
  });

  it("n'expose ni le propriétaire ni le jeton de partage", async () => {
    const shareToken = await enableShare();
    const res = await rawGet(`/api/public/teams/${shareToken}`, null);
    const { team } = (await res.json()) as PublicTeamResponse;

    expect(team).not.toHaveProperty("ownerId");
    expect(team).not.toHaveProperty("shareToken");
    expect(team).not.toHaveProperty("isPublic");
  });

  it("répond 404 sur un jeton inconnu", async () => {
    const res = await rawGet("/api/public/teams/jeton-inconnu", null);
    expect(res.status).toBe(404);
  });

  it("se referme quand le coach coupe le partage", async () => {
    const shareToken = await enableShare();
    await rawPatch(`/team/${teamId}/share`, token, { enabled: false });

    const res = await rawGet(`/api/public/teams/${shareToken}`, null);
    expect(res.status).toBe(404);
  });
});
