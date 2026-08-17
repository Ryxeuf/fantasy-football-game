/**
 * Logo d'équipe : upload (binaire brut) et retrait.
 *
 * Couvre les invariants sensibles : propriété de l'équipe (404 sinon),
 * détection du type par magic bytes (jamais le Content-Type client),
 * nom de fichier généré côté serveur, et nettoyage de l'ancien fichier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, readdir, writeFile, mkdir } from "node:fs/promises";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import { setTeamLogo, clearTeamLogo, TeamLogoError } from "./team-logo";

const mockPrisma = prisma as unknown as {
  team: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

/** En-tête PNG valide (magic bytes) suivi de quelques octets de charge. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 1),
]);

let uploadDir: string;

beforeEach(async () => {
  vi.resetAllMocks();
  uploadDir = await mkdtemp(path.join(os.tmpdir(), "team-logo-"));
  process.env.TEAM_LOGO_UPLOAD_DIR = uploadDir;
  delete process.env.TEAM_LOGO_ASSET_PUBLIC_BASE;
  delete process.env.BLOG_ASSET_PUBLIC_BASE;
});

describe("setTeamLogo", () => {
  it("écrit le fichier et persiste l'URL publique", async () => {
    mockPrisma.team.findFirst.mockResolvedValue({
      id: "t1",
      name: "Reikland Reavers",
      logoUrl: null,
    });
    mockPrisma.team.update.mockResolvedValue({});

    const { logoUrl } = await setTeamLogo({
      teamId: "t1",
      ownerId: "u1",
      body: PNG,
    });

    expect(logoUrl).toMatch(
      /^\/images\/team-logos\/reikland-reavers-[0-9a-f]{12}\.png$/,
    );
    const files = await readdir(uploadDir);
    expect(files).toHaveLength(1);
    expect(mockPrisma.team.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { logoUrl },
    });
    // L'equipe est cherchee par (id, owner) : pas de logo pose sur
    // l'equipe d'un autre coach.
    expect(mockPrisma.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1", ownerId: "u1", deletedAt: null },
      }),
    );
  });

  it("supprime l'ancien fichier une fois le nouveau enregistré", async () => {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, "old-aaaaaaaaaaaa.png"), PNG);
    mockPrisma.team.findFirst.mockResolvedValue({
      id: "t1",
      name: "Reavers",
      logoUrl: "/images/team-logos/old-aaaaaaaaaaaa.png",
    });
    mockPrisma.team.update.mockResolvedValue({});

    await setTeamLogo({ teamId: "t1", ownerId: "u1", body: PNG });

    const files = await readdir(uploadDir);
    expect(files).toHaveLength(1);
    expect(files[0]).not.toBe("old-aaaaaaaaaaaa.png");
  });

  it("refuse un contenu qui n'est pas une image supportée", async () => {
    mockPrisma.team.findFirst.mockResolvedValue({
      id: "t1",
      name: "Reavers",
      logoUrl: null,
    });
    await expect(
      setTeamLogo({
        teamId: "t1",
        ownerId: "u1",
        body: Buffer.from("<svg onload=alert(1)></svg>"),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
    expect(await readdir(uploadDir)).toHaveLength(0);
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("refuse un corps vide", async () => {
    mockPrisma.team.findFirst.mockResolvedValue({
      id: "t1",
      name: "Reavers",
      logoUrl: null,
    });
    await expect(
      setTeamLogo({ teamId: "t1", ownerId: "u1", body: Buffer.alloc(0) }),
    ).rejects.toMatchObject({ code: "EMPTY" });
  });

  it("404 quand l'équipe n'appartient pas au coach", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    await expect(
      setTeamLogo({ teamId: "t1", ownerId: "intrus", body: PNG }),
    ).rejects.toBeInstanceOf(TeamLogoError);
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("préfixe l'URL avec l'hôte public quand il est configuré", async () => {
    process.env.TEAM_LOGO_ASSET_PUBLIC_BASE = "https://api.nufflearena.fr/";
    mockPrisma.team.findFirst.mockResolvedValue({
      id: "t1",
      name: "Reavers",
      logoUrl: null,
    });
    mockPrisma.team.update.mockResolvedValue({});
    const { logoUrl } = await setTeamLogo({
      teamId: "t1",
      ownerId: "u1",
      body: PNG,
    });
    expect(logoUrl.startsWith("https://api.nufflearena.fr/images/team-logos/")).toBe(
      true,
    );
  });
});

describe("clearTeamLogo", () => {
  it("remet logoUrl à null et supprime le fichier", async () => {
    await writeFile(path.join(uploadDir, "old-bbbbbbbbbbbb.png"), PNG);
    mockPrisma.team.findFirst.mockResolvedValue({
      id: "t1",
      logoUrl: "/images/team-logos/old-bbbbbbbbbbbb.png",
    });
    mockPrisma.team.update.mockResolvedValue({});

    const result = await clearTeamLogo({ teamId: "t1", ownerId: "u1" });

    expect(result).toEqual({ logoUrl: null });
    expect(mockPrisma.team.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { logoUrl: null },
    });
    expect(await readdir(uploadDir)).toHaveLength(0);
  });

  it("est un no-op quand l'équipe n'a pas de logo", async () => {
    mockPrisma.team.findFirst.mockResolvedValue({ id: "t1", logoUrl: null });
    await expect(
      clearTeamLogo({ teamId: "t1", ownerId: "u1" }),
    ).resolves.toEqual({ logoUrl: null });
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("404 quand l'équipe n'appartient pas au coach", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    await expect(
      clearTeamLogo({ teamId: "t1", ownerId: "intrus" }),
    ).rejects.toBeInstanceOf(TeamLogoError);
  });
});
