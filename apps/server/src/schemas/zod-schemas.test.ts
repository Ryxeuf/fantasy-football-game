import { describe, it, expect } from "vitest";

// Admin schemas
import {
  adminUsersQuerySchema,
  updateUserRoleSchema,
  updateUserPatreonSchema,
  updateUserValidSchema,
  updateMatchStatusSchema,
} from "./admin.schemas";

// Auth schemas
import { registerSchema } from "./auth.schemas";

// Admin data schemas
import {
  createSkillSchema,
  duplicateToRulesetSchema,
  createRosterSchema,
  createPositionSchema,
  duplicatePositionSchema,
  createStarPlayerDataSchema,
} from "./admin-data.schemas";

// Cup schemas
import {
  createCupSchema,
  registerCupSchema,
  unregisterCupSchema,
  updateCupStatusSchema,
} from "./cup.schemas";

// Local match schemas
import {
  createLocalMatchSchema,
  updateLocalMatchStateSchema,
  completeLocalMatchSchema,
  updateLocalMatchStatusSchema,
  createLocalMatchActionSchema,
} from "./local-match.schemas";

// Match schemas
import {
  createMatchSchema,
  validateSetupSchema,
  placeKickoffBallSchema,
} from "./match.schemas";

// Team schemas
import {
  addPlayerSchema,
  updatePlayerSkillsSchema,
  addStarPlayerToTeamSchema,
  buildTeamSchema,
} from "./team.schemas";

// ---------------------------------------------------------------------------
// Admin schemas
// ---------------------------------------------------------------------------

describe("Admin schemas", () => {
  describe("adminUsersQuerySchema", () => {
    it("applies defaults for empty query", () => {
      const result = adminUsersQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.sortOrder).toBe("desc");
    });

    it("coerces string page/limit to numbers", () => {
      const result = adminUsersQuerySchema.parse({ page: "3", limit: "20" });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(20);
    });

    it("rejects invalid sortBy", () => {
      expect(() => adminUsersQuerySchema.parse({ sortBy: "hacked" })).toThrow();
    });
  });

  describe("updateUserRoleSchema", () => {
    it("accepts valid role", () => {
      const result = updateUserRoleSchema.parse({ role: "admin" });
      expect(result.role).toBe("admin");
    });

    it("accepts valid roles array", () => {
      const result = updateUserRoleSchema.parse({ roles: ["admin", "moderator"] });
      expect(result.roles).toEqual(["admin", "moderator"]);
    });

    it("rejects when neither role nor roles provided", () => {
      expect(() => updateUserRoleSchema.parse({})).toThrow();
    });

    it("rejects invalid role value", () => {
      expect(() => updateUserRoleSchema.parse({ role: "superadmin" })).toThrow();
    });
  });

  describe("updateUserPatreonSchema", () => {
    it("accepts boolean true", () => {
      expect(updateUserPatreonSchema.parse({ patreon: true })).toEqual({ patreon: true });
    });

    it("rejects non-boolean", () => {
      expect(() => updateUserPatreonSchema.parse({ patreon: "yes" })).toThrow();
    });
  });

  describe("updateUserValidSchema", () => {
    it("accepts boolean false", () => {
      expect(updateUserValidSchema.parse({ valid: false })).toEqual({ valid: false });
    });
  });

  describe("updateMatchStatusSchema", () => {
    it("accepts valid status", () => {
      expect(updateMatchStatusSchema.parse({ status: "active" })).toEqual({ status: "active" });
    });

    it("rejects invalid status", () => {
      expect(() => updateMatchStatusSchema.parse({ status: "unknown" })).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Admin data schemas
// ---------------------------------------------------------------------------

describe("Admin data schemas", () => {
  describe("createSkillSchema", () => {
    it("accepts valid skill data", () => {
      const data = {
        slug: "block",
        nameFr: "Blocage",
        nameEn: "Block",
        description: "Permet de bloquer",
        category: "general",
      };
      expect(createSkillSchema.parse(data)).toMatchObject(data);
    });

    it("rejects missing slug", () => {
      expect(() => createSkillSchema.parse({ nameFr: "X", nameEn: "X", description: "X", category: "X" })).toThrow();
    });
  });

  describe("duplicateToRulesetSchema", () => {
    it("accepts valid targetRuleset", () => {
      expect(duplicateToRulesetSchema.parse({ targetRuleset: "season_3" })).toEqual({ targetRuleset: "season_3" });
    });

    it("rejects empty targetRuleset", () => {
      expect(() => duplicateToRulesetSchema.parse({ targetRuleset: "" })).toThrow();
    });
  });

  describe("createRosterSchema", () => {
    it("accepts valid roster", () => {
      const data = {
        slug: "human",
        name: "Humains",
        nameEn: "Humans",
        budget: 1000,
        tier: "A",
      };
      const result = createRosterSchema.parse(data);
      expect(result.slug).toBe("human");
      expect(result.naf).toBe(false); // default
    });
  });

  describe("createPositionSchema", () => {
    it("accepts valid position", () => {
      const data = {
        rosterId: "abc",
        slug: "lineman",
        displayName: "Lineman",
        cost: 50000,
        min: 0,
        max: 16,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
      };
      expect(createPositionSchema.parse(data)).toMatchObject(data);
    });
  });

  describe("duplicatePositionSchema", () => {
    it("rejects missing targetRosterId", () => {
      expect(() => duplicatePositionSchema.parse({})).toThrow();
    });
  });

  describe("createStarPlayerDataSchema", () => {
    it("accepts valid star player", () => {
      const data = {
        slug: "morg-n-thorg",
        displayName: "Morg 'n' Thorg",
        cost: 430000,
        ma: 6,
        st: 6,
        ag: 3,
        av: 11,
      };
      expect(createStarPlayerDataSchema.parse(data)).toMatchObject(data);
    });
  });
});

// ---------------------------------------------------------------------------
// Cup schemas
// ---------------------------------------------------------------------------

describe("Cup schemas", () => {
  describe("createCupSchema", () => {
    it("accepts valid cup name", () => {
      const result = createCupSchema.parse({ name: "Blood Bowl Cup" });
      expect(result.name).toBe("Blood Bowl Cup");
      expect(result.isPublic).toBe(true); // default
    });

    it("rejects empty name", () => {
      expect(() => createCupSchema.parse({ name: "" })).toThrow();
    });

    it("rejects name over 100 chars", () => {
      expect(() => createCupSchema.parse({ name: "x".repeat(101) })).toThrow();
    });

    it("accepts scoring config", () => {
      const result = createCupSchema.parse({
        name: "Cup",
        scoringConfig: { winPoints: 3, drawPoints: 1 },
      });
      expect(result.scoringConfig?.winPoints).toBe(3);
    });
  });

  describe("registerCupSchema", () => {
    it("accepts valid teamId", () => {
      expect(registerCupSchema.parse({ teamId: "abc" })).toEqual({ teamId: "abc" });
    });

    it("rejects empty teamId", () => {
      expect(() => registerCupSchema.parse({ teamId: "" })).toThrow();
    });
  });

  describe("unregisterCupSchema", () => {
    it("accepts teamId with optional force", () => {
      const result = unregisterCupSchema.parse({ teamId: "abc", force: true });
      expect(result.force).toBe(true);
    });
  });

  describe("updateCupStatusSchema", () => {
    it("accepts valid statuses", () => {
      for (const status of ["ouverte", "en_cours", "terminee", "archivee"]) {
        expect(updateCupStatusSchema.parse({ status })).toEqual({ status });
      }
    });

    it("rejects invalid status", () => {
      expect(() => updateCupStatusSchema.parse({ status: "deleted" })).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Local match schemas
// ---------------------------------------------------------------------------

describe("Local match schemas", () => {
  describe("createLocalMatchSchema", () => {
    it("accepts valid local match data", () => {
      const result = createLocalMatchSchema.parse({ teamAId: "team-1" });
      expect(result.teamAId).toBe("team-1");
    });

    it("rejects missing teamAId", () => {
      expect(() => createLocalMatchSchema.parse({})).toThrow();
    });

    it("accepts optional teamBId and cupId", () => {
      const result = createLocalMatchSchema.parse({
        teamAId: "team-1",
        teamBId: "team-2",
        cupId: "cup-1",
        isPublic: true,
      });
      expect(result.teamBId).toBe("team-2");
      expect(result.isPublic).toBe(true);
    });
  });

  describe("updateLocalMatchStateSchema", () => {
    it("accepts gameState with optional scores", () => {
      const result = updateLocalMatchStateSchema.parse({
        gameState: { phase: "active" },
        scoreTeamA: 2,
        scoreTeamB: 1,
      });
      expect(result.scoreTeamA).toBe(2);
    });

    it("rejects missing gameState", () => {
      expect(() => updateLocalMatchStateSchema.parse({})).toThrow();
    });
  });

  describe("completeLocalMatchSchema", () => {
    it("accepts valid scores", () => {
      const result = completeLocalMatchSchema.parse({ scoreTeamA: 3, scoreTeamB: 0 });
      expect(result.scoreTeamA).toBe(3);
    });

    it("rejects missing scores", () => {
      expect(() => completeLocalMatchSchema.parse({ scoreTeamA: 1 })).toThrow();
    });
  });

  describe("updateLocalMatchStatusSchema", () => {
    it("accepts valid statuses", () => {
      for (const status of ["pending", "waiting_for_player", "in_progress", "completed", "cancelled"]) {
        expect(updateLocalMatchStatusSchema.parse({ status })).toEqual({ status });
      }
    });
  });

  describe("createLocalMatchActionSchema", () => {
    it("accepts valid action", () => {
      const data = {
        half: 1,
        turn: 3,
        actionType: "td" as const,
        playerId: "p1",
        playerName: "Runner",
        playerTeam: "A" as const,
      };
      expect(createLocalMatchActionSchema.parse(data)).toMatchObject(data);
    });

    it("rejects half > 2", () => {
      expect(() =>
        createLocalMatchActionSchema.parse({
          half: 3,
          turn: 1,
          actionType: "td",
          playerId: "p1",
          playerName: "X",
          playerTeam: "A",
        }),
      ).toThrow();
    });

    it("rejects invalid actionType", () => {
      expect(() =>
        createLocalMatchActionSchema.parse({
          half: 1,
          turn: 1,
          actionType: "hack",
          playerId: "p1",
          playerName: "X",
          playerTeam: "A",
        }),
      ).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Match schemas
// ---------------------------------------------------------------------------

describe("Match schemas", () => {
  describe("createMatchSchema", () => {
    it("accepts empty body (all optional)", () => {
      expect(createMatchSchema.parse({})).toEqual({});
    });

    it("accepts terrain skin and timer", () => {
      const result = createMatchSchema.parse({ terrainSkin: "snow", turnTimerEnabled: true });
      expect(result.terrainSkin).toBe("snow");
      expect(result.turnTimerEnabled).toBe(true);
    });

    it("accepts rulesMode='simplified' (N.2)", () => {
      const result = createMatchSchema.parse({ rulesMode: "simplified" });
      expect(result.rulesMode).toBe("simplified");
    });

    it("accepts rulesMode='full'", () => {
      const result = createMatchSchema.parse({ rulesMode: "full" });
      expect(result.rulesMode).toBe("full");
    });

    it("rejects unknown rulesMode values", () => {
      expect(() => createMatchSchema.parse({ rulesMode: "extreme" })).toThrow();
    });
  });

  describe("validateSetupSchema", () => {
    it("accepts valid setup data", () => {
      const data = {
        placedPlayers: ["p1", "p2"],
        playerPositions: [
          { playerId: "p1", x: 5, y: 7 },
          { playerId: "p2", x: 6, y: 8 },
        ],
      };
      expect(validateSetupSchema.parse(data)).toMatchObject(data);
    });

    it("rejects missing playerPositions", () => {
      expect(() => validateSetupSchema.parse({ placedPlayers: [] })).toThrow();
    });
  });

  describe("placeKickoffBallSchema", () => {
    it("accepts valid position", () => {
      const result = placeKickoffBallSchema.parse({ position: { x: 13, y: 7 } });
      expect(result.position).toEqual({ x: 13, y: 7 });
    });

    it("rejects missing position", () => {
      expect(() => placeKickoffBallSchema.parse({})).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Team schemas
// ---------------------------------------------------------------------------

describe("Team schemas", () => {
  describe("addPlayerSchema", () => {
    it("accepts valid player data", () => {
      const result = addPlayerSchema.parse({ position: "lineman", name: "Bob", number: 7 });
      expect(result.position).toBe("lineman");
    });

    it("rejects number < 1", () => {
      expect(() => addPlayerSchema.parse({ position: "lineman", name: "Bob", number: 0 })).toThrow();
    });

    it("rejects number > 99", () => {
      expect(() => addPlayerSchema.parse({ position: "lineman", name: "Bob", number: 100 })).toThrow();
    });

    it("rejects empty name", () => {
      expect(() => addPlayerSchema.parse({ position: "lineman", name: "", number: 1 })).toThrow();
    });
  });

  describe("updatePlayerSkillsSchema", () => {
    it("accepts primary advancement", () => {
      const result = updatePlayerSkillsSchema.parse({
        advancementType: "primary",
        skillSlug: "block",
      });
      expect(result.advancementType).toBe("primary");
    });

    it("accepts random-primary with skillCategory", () => {
      const result = updatePlayerSkillsSchema.parse({
        advancementType: "random-primary",
        skillCategory: "general",
      });
      expect(result.advancementType).toBe("random-primary");
    });

    it("rejects invalid advancement type", () => {
      expect(() => updatePlayerSkillsSchema.parse({ advancementType: "super" })).toThrow();
    });
  });

  describe("addStarPlayerToTeamSchema", () => {
    it("accepts valid slug", () => {
      expect(addStarPlayerToTeamSchema.parse({ starPlayerSlug: "morg-n-thorg" })).toEqual({
        starPlayerSlug: "morg-n-thorg",
      });
    });

    it("rejects empty slug", () => {
      expect(() => addStarPlayerToTeamSchema.parse({ starPlayerSlug: "" })).toThrow();
    });
  });

  describe("buildTeamSchema", () => {
    const baseBody = {
      name: "Les Fous",
      roster: "human",
      choices: [{ key: "lineman", count: 11 }],
    };

    it("accepts minimal body without staff fields (all optional)", () => {
      const result = buildTeamSchema.parse(baseBody);
      expect(result.name).toBe("Les Fous");
      expect(result.rerolls).toBeUndefined();
      expect(result.cheerleaders).toBeUndefined();
      expect(result.assistants).toBeUndefined();
      expect(result.apothecary).toBeUndefined();
      expect(result.dedicatedFans).toBeUndefined();
    });

    it("accepts valid staff values within bounds", () => {
      const result = buildTeamSchema.parse({
        ...baseBody,
        rerolls: 3,
        cheerleaders: 2,
        assistants: 1,
        apothecary: true,
        dedicatedFans: 4,
      });
      expect(result.rerolls).toBe(3);
      expect(result.cheerleaders).toBe(2);
      expect(result.assistants).toBe(1);
      expect(result.apothecary).toBe(true);
      expect(result.dedicatedFans).toBe(4);
    });

    it("accepts zero for staff counters that allow 0", () => {
      const result = buildTeamSchema.parse({
        ...baseBody,
        rerolls: 0,
        cheerleaders: 0,
        assistants: 0,
      });
      expect(result.rerolls).toBe(0);
    });

    it("rejects rerolls > 8", () => {
      expect(() => buildTeamSchema.parse({ ...baseBody, rerolls: 9 })).toThrow();
    });

    it("rejects negative rerolls", () => {
      expect(() => buildTeamSchema.parse({ ...baseBody, rerolls: -1 })).toThrow();
    });

    it("rejects non-integer rerolls", () => {
      expect(() => buildTeamSchema.parse({ ...baseBody, rerolls: 1.5 })).toThrow();
    });

    it("rejects cheerleaders > 12", () => {
      expect(() => buildTeamSchema.parse({ ...baseBody, cheerleaders: 13 })).toThrow();
    });

    it("rejects assistants > 6", () => {
      expect(() => buildTeamSchema.parse({ ...baseBody, assistants: 7 })).toThrow();
    });

    it("rejects dedicatedFans < 1", () => {
      expect(() => buildTeamSchema.parse({ ...baseBody, dedicatedFans: 0 })).toThrow();
    });

    it("rejects dedicatedFans > 6", () => {
      expect(() => buildTeamSchema.parse({ ...baseBody, dedicatedFans: 7 })).toThrow();
    });

    it("rejects non-boolean apothecary", () => {
      expect(() => buildTeamSchema.parse({ ...baseBody, apothecary: "yes" })).toThrow();
    });

    it("still requires name, roster, and choices", () => {
      expect(() => buildTeamSchema.parse({ name: "X", roster: "human" })).toThrow();
      expect(() => buildTeamSchema.parse({ name: "", roster: "human", choices: [] })).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

describe("Auth schemas", () => {
  describe("registerSchema", () => {
    const validBody = {
      email: "coach@example.com",
      password: "secret12",
      coachName: "Coach Z",
    };

    it("accepts a minimal valid body", () => {
      const result = registerSchema.parse(validBody);
      expect(result.email).toBe("coach@example.com");
      expect(result.coachName).toBe("Coach Z");
    });

    it("accepts optional profile fields", () => {
      const result = registerSchema.parse({
        ...validBody,
        firstName: "Jane",
        lastName: "Doe",
        dateOfBirth: "1990-01-01",
      });
      expect(result.firstName).toBe("Jane");
      expect(result.dateOfBirth).toBe("1990-01-01");
    });

    it("rejects a malformed dateOfBirth", () => {
      expect(() =>
        registerSchema.parse({ ...validBody, dateOfBirth: "not-a-date" }),
      ).toThrow();
    });

    it("rejects an invalid email", () => {
      expect(() =>
        registerSchema.parse({ ...validBody, email: "not-an-email" }),
      ).toThrow();
    });

    it("rejects a password shorter than 8 characters", () => {
      expect(() =>
        registerSchema.parse({ ...validBody, password: "short" }),
      ).toThrow();
    });

    it("rejects an empty coachName", () => {
      expect(() =>
        registerSchema.parse({ ...validBody, coachName: "" }),
      ).toThrow();
    });

    it("rejects a coachName longer than 50 characters", () => {
      expect(() =>
        registerSchema.parse({ ...validBody, coachName: "x".repeat(51) }),
      ).toThrow();
    });
  });
});
