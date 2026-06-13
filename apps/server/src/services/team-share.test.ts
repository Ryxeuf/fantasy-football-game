import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  setTeamShare,
  getPublicTeamByToken,
  generateShareToken,
  TeamShareError,
} from "./team-share";

const team = prisma.team as unknown as {
  findFirst: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("generateShareToken", () => {
  it("génère un token hex de 32 caractères, unique", () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("setTeamShare", () => {
  it("rejette si l'équipe n'appartient pas au coach", async () => {
    team.findFirst.mockResolvedValue(null);
    await expect(
      setTeamShare({ teamId: "t1", ownerId: "u1", enabled: true }),
    ).rejects.toBeInstanceOf(TeamShareError);
    expect(team.update).not.toHaveBeenCalled();
  });

  it("active le partage et génère un token quand il n'y en a pas", async () => {
    team.findFirst.mockResolvedValue({ id: "t1", shareToken: null });
    team.update.mockImplementation(async ({ data }: any) => ({
      isPublic: data.isPublic,
      shareToken: data.shareToken,
    }));
    const res = await setTeamShare({ teamId: "t1", ownerId: "u1", enabled: true });
    expect(res.isPublic).toBe(true);
    expect(res.shareToken).toMatch(/^[0-9a-f]{32}$/);
    expect(team.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" } }),
    );
  });

  it("conserve le token existant à la réactivation", async () => {
    team.findFirst.mockResolvedValue({ id: "t1", shareToken: "existing-token" });
    team.update.mockImplementation(async ({ data }: any) => ({
      isPublic: data.isPublic,
      shareToken: data.shareToken,
    }));
    const res = await setTeamShare({ teamId: "t1", ownerId: "u1", enabled: true });
    expect(res.shareToken).toBe("existing-token");
  });

  it("désactive le partage et n'expose pas le token", async () => {
    team.findFirst.mockResolvedValue({ id: "t1", shareToken: "existing-token" });
    team.update.mockImplementation(async ({ data }: any) => ({
      isPublic: data.isPublic,
      shareToken: data.shareToken,
    }));
    const res = await setTeamShare({ teamId: "t1", ownerId: "u1", enabled: false });
    expect(res.isPublic).toBe(false);
    expect(res.shareToken).toBeNull();
  });
});

describe("getPublicTeamByToken", () => {
  it("retourne null pour un token vide (pas d'appel DB)", async () => {
    const res = await getPublicTeamByToken("");
    expect(res).toBeNull();
    expect(team.findFirst).not.toHaveBeenCalled();
  });

  it("ne résout qu'une équipe publique (isPublic + shareToken)", async () => {
    team.findFirst.mockResolvedValue({ id: "t1", name: "Les Rats", players: [], starPlayers: [] });
    const res = await getPublicTeamByToken("tok");
    expect(res).not.toBeNull();
    expect(team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shareToken: "tok", isPublic: true } }),
    );
  });

  it("retourne null quand aucune équipe publique ne correspond", async () => {
    team.findFirst.mockResolvedValue(null);
    expect(await getPublicTeamByToken("tok")).toBeNull();
  });
});
