import { describe, it, expect, beforeEach } from "vitest";
import { rawPost, rawPut, resetDb } from "../helpers/api";
import { createTeam, seedAndLogin } from "../helpers/factories";

/**
 * Spec validations Zod sur les routes mutate de /team/* — O.4 expansion E2E.
 *
 * `team-listing.spec.ts` couvre les auth gates, `team-build-validation.spec.ts`
 * couvre `POST /team/build`. Ce spec couvre les autres routes mutate du
 * controller team pour verifier que les schemas Zod sont bien declenches
 * en E2E :
 *
 *  - POST /team/:id/players              (addPlayerSchema)
 *  - PUT  /team/:id/players/:pid/skills  (updatePlayerSkillsSchema)
 *  - POST /team/:id/star-players         (addStarPlayerToTeamSchema)
 *  - POST /team/:id/purchase             (purchaseSchema)
 *  - PUT  /team/:id                      (updateTeamSchema)
 *  - PUT  /team/:id/info                 (updateTeamInfoSchema)
 *
 * Le `validate` middleware fire AVANT toute lecture Prisma, donc on peut
 * utiliser un teamId fictif : la 400 (validation) est renvoyee avant
 * que la route ne cherche l'equipe en base.
 */

const TEAM_ID = "fictional-team-id";
const PLAYER_ID = "fictional-player-id";

describe("E2E API — /team/* mutate validations Zod", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("POST /team/:id/players (addPlayerSchema)", () => {
    it("position absente -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/team/${TEAM_ID}/players`, token, {
        name: "Joueur 1",
        number: 5,
      });
      expect(res.status).toBe(400);
    });

    it("name vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/team/${TEAM_ID}/players`, token, {
        position: "lineman",
        name: "",
        number: 5,
      });
      expect(res.status).toBe(400);
    });

    it("number = 0 -> 400 (min 1)", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/team/${TEAM_ID}/players`, token, {
        position: "lineman",
        name: "Joueur 1",
        number: 0,
      });
      expect(res.status).toBe(400);
    });

    it("number = 100 -> 400 (max 99)", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/team/${TEAM_ID}/players`, token, {
        position: "lineman",
        name: "Joueur 1",
        number: 100,
      });
      expect(res.status).toBe(400);
    });

    it("name > 100 chars -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/team/${TEAM_ID}/players`, token, {
        position: "lineman",
        name: "x".repeat(101),
        number: 5,
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /team/:id/players/:pid/skills (updatePlayerSkillsSchema)", () => {
    it("advancementType absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(
        `/team/${TEAM_ID}/players/${PLAYER_ID}/skills`,
        token,
        { skillSlug: "block" },
      );
      expect(res.status).toBe(400);
    });

    it("advancementType invalide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(
        `/team/${TEAM_ID}/players/${PLAYER_ID}/skills`,
        token,
        { advancementType: "magic-rainbow" },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("POST /team/:id/star-players (addStarPlayerToTeamSchema)", () => {
    it("starPlayerSlug absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        `/team/${TEAM_ID}/star-players`,
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("starPlayerSlug vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        `/team/${TEAM_ID}/star-players`,
        token,
        { starPlayerSlug: "" },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("POST /team/:id/purchase (purchaseSchema)", () => {
    it("type absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/team/${TEAM_ID}/purchase`, token, {});
      expect(res.status).toBe(400);
    });

    it("type invalide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/team/${TEAM_ID}/purchase`, token, {
        type: "magic-armor",
      });
      expect(res.status).toBe(400);
    });

    it("number = 0 (hors bornes) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/team/${TEAM_ID}/purchase`, token, {
        type: "player",
        position: "lineman",
        name: "Joueur",
        number: 0,
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /team/:id (updateTeamSchema)", () => {
    it("players absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(`/team/${TEAM_ID}`, token, {});
      expect(res.status).toBe(400);
    });

    it("players = [] (min 1) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(`/team/${TEAM_ID}`, token, { players: [] });
      expect(res.status).toBe(400);
    });

    it("name > 100 chars -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(`/team/${TEAM_ID}`, token, {
        players: [{ id: "p1", name: "Joueur 1", number: 1 }],
        name: "x".repeat(101),
      });
      expect(res.status).toBe(400);
    });

    it("player.number = 100 -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(`/team/${TEAM_ID}`, token, {
        players: [{ id: "p1", name: "Joueur 1", number: 100 }],
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /team/:id/info (updateTeamInfoSchema)", () => {
    // Les plafonds de staff ne sont plus figes dans le schema Zod : ils
    // dependent du couple roster x format (`RosterStaffConfig`, editable en
    // admin) et sont donc verifies dans le handler, une fois l'equipe lue.
    // Zod ne garde qu'un controle de sanite (entier, positif, majorant
    // absolu) — c'est lui qu'on couvre ici avec un teamId fictif ; le
    // plafond reel est couvert plus bas sur une vraie equipe.
    it("rerolls = -1 -> 400 (min 0)", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(`/team/${TEAM_ID}/info`, token, {
        rerolls: -1,
      });
      expect(res.status).toBe(400);
    });

    it("rerolls = 100 -> 400 (majorant de sanite)", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(`/team/${TEAM_ID}/info`, token, {
        rerolls: 100,
      });
      expect(res.status).toBe(400);
    });

    it("dedicatedFans = 0 -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(`/team/${TEAM_ID}/info`, token, {
        dedicatedFans: 0,
      });
      expect(res.status).toBe(400);
    });

    it("apothecary type-check (string au lieu de bool) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(`/team/${TEAM_ID}/info`, token, {
        apothecary: "yes",
      });
      expect(res.status).toBe(400);
    });

    it("rerolls au-dela du plafond du roster -> 400 (handler)", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@tw.test",
        "pwd",
        "Alice",
      );
      const { teamId } = await createTeam(userId, "Les Rats", "skaven");

      // Plafond BB11 = 8 relances : 9 est refuse, 8 passe.
      const tooMany = await rawPut(`/team/${teamId}/info`, token, {
        rerolls: 9,
      });
      expect(tooMany.status).toBe(400);

      const ok = await rawPut(`/team/${teamId}/info`, token, { rerolls: 8 });
      expect(ok.status).toBe(200);
    });
  });
});
