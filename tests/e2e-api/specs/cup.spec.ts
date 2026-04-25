import { describe, it, expect, beforeEach } from "vitest";
import {
  get,
  post,
  rawGet,
  rawPost,
  resetDb,
} from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

/**
 * Spec /cup/* (O.4 expansion E2E).
 *
 * Les routes `/cup/*` implementent les coupes (tournois, Sprint 4) :
 * creation, listing public/utilisateur, inscription/desinscription
 * d'equipes, validation et changement de statut. Toutes les routes
 * exigent un token JWT (middleware `authUser`).
 *
 * Ce spec couvre :
 *
 *  - Auth gates : chaque endpoint sans token -> 401
 *  - Validation Zod sur POST /cup (name vide / trop long) -> 400
 *  - Happy path :
 *      A cree une coupe -> 201, name et creator OK
 *      A liste -> retrouve sa coupe (status "ouverte")
 *      A inscrit son equipe -> 201
 *      A desinscrit son equipe -> 200
 *      A valide la coupe -> 200, status "en_cours"
 *      Apres validation, GET /cup/:id renvoie validated=true
 *  - Edge cases :
 *      GET /cup/:id inconnu -> 404
 *      POST /cup/:id/register sur coupe inconnue -> 404
 *      POST /cup/:id/register avec teamId inconnu -> 404
 *      POST /cup/:id/register avec ruleset different -> 400
 *      POST /cup/:id/validate par non-createur -> 403
 *
 * Couvre la derniere route auth-protegee de gestion de tournois sans
 * spec E2E. La table `Cup` du schema sqlite e2e-api a ete etendue
 * avec les champs de scoring (winPoints/drawPoints/.../passPoints)
 * pour que `POST /cup` ne crashe pas (Prisma create avec ces champs).
 */

interface CupCreator {
  id: string;
  coachName: string | null;
  email: string;
}

interface CupEntity {
  id: string;
  name: string;
  creator: CupCreator;
  creatorId: string;
  ruleset: string;
  validated: boolean;
  isPublic: boolean;
  status: "ouverte" | "en_cours" | "terminee" | "archivee";
  participantCount: number;
  participants: Array<{
    id: string;
    name: string;
    roster: string;
    owner: { id: string };
  }>;
  scoringConfig?: {
    winPoints: number;
    drawPoints: number;
    lossPoints: number;
    forfeitPoints: number;
    touchdownPoints: number;
    blockCasualtyPoints: number;
    foulCasualtyPoints: number;
    passPoints: number;
  };
}

interface CupResponse {
  cup: CupEntity;
  message?: string;
}

interface CupListResponse {
  cups: CupEntity[];
}

describe("E2E API — /cup/*", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("auth gates", () => {
    it("GET /cup sans token -> 401", async () => {
      const res = await rawGet("/cup", null);
      expect(res.status).toBe(401);
    });

    it("GET /cup/archived sans token -> 401", async () => {
      const res = await rawGet("/cup/archived", null);
      expect(res.status).toBe(401);
    });

    it("GET /cup/:id sans token -> 401", async () => {
      const res = await rawGet("/cup/dummy-id", null);
      expect(res.status).toBe(401);
    });

    it("POST /cup sans token -> 401", async () => {
      const res = await rawPost("/cup", null, { name: "Test" });
      expect(res.status).toBe(401);
    });

    it("POST /cup/:id/register sans token -> 401", async () => {
      const res = await rawPost("/cup/dummy/register", null, {
        teamId: "x",
      });
      expect(res.status).toBe(401);
    });

    it("POST /cup/:id/unregister sans token -> 401", async () => {
      const res = await rawPost("/cup/dummy/unregister", null, {
        teamId: "x",
      });
      expect(res.status).toBe(401);
    });

    it("POST /cup/:id/validate sans token -> 401", async () => {
      const res = await rawPost("/cup/dummy/validate", null, {});
      expect(res.status).toBe(401);
    });

    it("POST /cup/:id/status sans token -> 401", async () => {
      const res = await rawPost("/cup/dummy/status", null, {
        status: "en_cours",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("validation POST /cup", () => {
    it("name vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@cup.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/cup", token, { name: "" });
      expect(res.status).toBe(400);
    });

    it("name absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@cup.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/cup", token, {});
      expect(res.status).toBe(400);
    });

    it("name trop long (>100 chars) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@cup.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/cup", token, { name: "x".repeat(101) });
      expect(res.status).toBe(400);
    });
  });

  describe("happy path : create / list / register / unregister / validate", () => {
    it("POST /cup cree une coupe valide", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@cup.test",
        "pwd",
        "Alice",
      );
      const json = await post<CupResponse>("/cup", token, {
        name: "Coupe E2E Test",
        ruleset: "season_2",
      });
      expect(json.cup.name).toBe("Coupe E2E Test");
      expect(json.cup.creatorId).toBe(userId);
      expect(json.cup.validated).toBe(false);
      expect(json.cup.isPublic).toBe(true);
      expect(json.cup.status).toBe("ouverte");
      expect(json.cup.scoringConfig).toBeDefined();
      expect(json.cup.scoringConfig!.winPoints).toBe(1000);
    });

    it("GET /cup retourne la coupe creee par l'utilisateur", async () => {
      const { token } = await seedAndLogin(
        "alice@cup.test",
        "pwd",
        "Alice",
      );
      await post<CupResponse>("/cup", token, {
        name: "Visible Cup",
      });
      const list = await get<CupListResponse>("/cup", token);
      const slugs = list.cups.map((c) => c.name);
      expect(slugs).toContain("Visible Cup");
    });

    it("flux complet : register / unregister / validate", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@cup.test",
        "pwd",
        "Alice",
      );
      const team = await createTeam(userId, "Alice Skavens", "skaven");

      // Le seed-team cree l'equipe avec ruleset par defaut (season_3) ;
      // on aligne la coupe pour pouvoir l'inscrire.
      const created = await post<CupResponse>("/cup", token, {
        name: "Coupe Flux",
        ruleset: "season_3",
      });
      const cupId = created.cup.id;

      // register
      const regRes = await post<CupResponse & { message: string }>(
        `/cup/${cupId}/register`,
        token,
        { teamId: team.teamId },
      );
      expect(regRes.cup.participantCount).toBe(1);

      // unregister
      const unregRes = await post<CupResponse>(
        `/cup/${cupId}/unregister`,
        token,
        { teamId: team.teamId },
      );
      expect(unregRes.cup.participantCount).toBe(0);

      // validate
      const valRes = await post<CupResponse>(
        `/cup/${cupId}/validate`,
        token,
        {},
      );
      expect(valRes.cup.validated).toBe(true);
      expect(valRes.cup.status).toBe("en_cours");

      // GET /cup/:id confirme la persistence
      const detail = await get<CupResponse>(`/cup/${cupId}`, token);
      expect(detail.cup.validated).toBe(true);
      expect(detail.cup.status).toBe("en_cours");
    });
  });

  describe("edge cases", () => {
    it("GET /cup/:id inconnu -> 404", async () => {
      const { token } = await seedAndLogin(
        "alice@cup.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet("/cup/this-cup-does-not-exist", token);
      expect(res.status).toBe(404);
    });

    it("POST /cup/:id/register sur coupe inconnue -> 404", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@cup.test",
        "pwd",
        "Alice",
      );
      const team = await createTeam(userId, "Alice Skavens", "skaven");
      const res = await rawPost(
        "/cup/this-cup-does-not-exist/register",
        token,
        { teamId: team.teamId },
      );
      expect(res.status).toBe(404);
    });

    it("POST /cup/:id/register avec teamId inconnu -> 404", async () => {
      const { token } = await seedAndLogin(
        "alice@cup.test",
        "pwd",
        "Alice",
      );
      const created = await post<CupResponse>("/cup", token, {
        name: "Cup-no-team",
      });
      const res = await rawPost(
        `/cup/${created.cup.id}/register`,
        token,
        { teamId: "ghost-team-id" },
      );
      expect(res.status).toBe(404);
    });

    it("POST /cup/:id/register avec ruleset different -> 400", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@cup.test",
        "pwd",
        "Alice",
      );
      // L'equipe seedee a le ruleset par defaut (`season_3`).
      const team = await createTeam(userId, "S3 Skavens", "skaven");
      const created = await post<CupResponse>("/cup", token, {
        name: "Cup-S2",
        ruleset: "season_2",
      });
      const res = await rawPost(
        `/cup/${created.cup.id}/register`,
        token,
        { teamId: team.teamId },
      );
      expect(res.status).toBe(400);
    });

    it("POST /cup/:id/validate par non-createur -> 403", async () => {
      const alice = await seedAndLogin("alice@cup.test", "pwd-a", "Alice");
      const bob = await seedAndLogin("bob@cup.test", "pwd-b", "Bob");

      const created = await post<CupResponse>("/cup", alice.token, {
        name: "Cup-no-touch",
      });

      const res = await rawPost(
        `/cup/${created.cup.id}/validate`,
        bob.token,
        {},
      );
      expect(res.status).toBe(403);
    });
  });
});
