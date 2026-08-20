/**
 * Image de joueur : upload (binaire brut) et retrait.
 *
 * Couvre les invariants sensibles : ownership à DEUX niveaux (le joueur
 * appartient à l'équipe, l'équipe au coach — 404 sinon), détection du type
 * par magic bytes (jamais le Content-Type client), restriction PNG/JPEG
 * (l'export de carte satori ne lit pas le WEBP), nom de fichier généré côté
 * serveur, et nettoyage de l'ancien fichier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";

vi.mock("../prisma", () => ({
  prisma: {
    teamPlayer: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  setPlayerImage,
  clearPlayerImage,
  PlayerImageError,
} from "./player-image";

const mockPrisma = prisma as unknown as {
  teamPlayer: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

/** En-tête PNG valide (magic bytes) suivi de quelques octets de charge. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 1),
]);

/** En-tête WEBP valide : accepté pour le blog/logo mais PAS ici. */
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4, 0),
  Buffer.from("WEBP"),
  Buffer.alloc(16, 1),
]);

let uploadDir: string;

beforeEach(async () => {
  vi.resetAllMocks();
  uploadDir = await mkdtemp(path.join(os.tmpdir(), "player-image-"));
  process.env.PLAYER_IMAGE_UPLOAD_DIR = uploadDir;
  delete process.env.PLAYER_IMAGE_ASSET_PUBLIC_BASE;
  delete process.env.BLOG_ASSET_PUBLIC_BASE;
});

describe("setPlayerImage", () => {
  it("écrit le fichier et persiste l'URL publique", async () => {
    mockPrisma.teamPlayer.findFirst.mockResolvedValue({
      id: "p1",
      name: "Boris le Rapide",
      imageUrl: null,
    });
    mockPrisma.teamPlayer.update.mockResolvedValue({});

    const { imageUrl } = await setPlayerImage({
      teamId: "t1",
      playerId: "p1",
      ownerId: "u1",
      body: PNG,
    });

    expect(imageUrl).toMatch(
      /^\/images\/player-images\/boris-le-rapide-[0-9a-f]{12}\.png$/,
    );
    const files = await readdir(uploadDir);
    expect(files).toHaveLength(1);
    expect(mockPrisma.teamPlayer.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { imageUrl },
    });
    // Ownership à deux niveaux : joueur ∈ équipe ∈ coach.
    expect(mockPrisma.teamPlayer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "p1",
          teamId: "t1",
          team: { ownerId: "u1", deletedAt: null },
        },
      }),
    );
  });

  it("supprime l'ancien fichier une fois le nouveau enregistré", async () => {
    await writeFile(path.join(uploadDir, "old-aaaaaaaaaaaa.png"), PNG);
    mockPrisma.teamPlayer.findFirst.mockResolvedValue({
      id: "p1",
      name: "Boris",
      imageUrl: "/images/player-images/old-aaaaaaaaaaaa.png",
    });
    mockPrisma.teamPlayer.update.mockResolvedValue({});

    await setPlayerImage({
      teamId: "t1",
      playerId: "p1",
      ownerId: "u1",
      body: PNG,
    });

    const files = await readdir(uploadDir);
    expect(files).toHaveLength(1);
    expect(files[0]).not.toBe("old-aaaaaaaaaaaa.png");
  });

  it("refuse le WEBP (export de carte satori) et le SVG", async () => {
    mockPrisma.teamPlayer.findFirst.mockResolvedValue({
      id: "p1",
      name: "Boris",
      imageUrl: null,
    });
    await expect(
      setPlayerImage({ teamId: "t1", playerId: "p1", ownerId: "u1", body: WEBP }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
    await expect(
      setPlayerImage({
        teamId: "t1",
        playerId: "p1",
        ownerId: "u1",
        body: Buffer.from("<svg onload=alert(1)></svg>"),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
    expect(await readdir(uploadDir)).toHaveLength(0);
    expect(mockPrisma.teamPlayer.update).not.toHaveBeenCalled();
  });

  it("refuse un corps vide", async () => {
    mockPrisma.teamPlayer.findFirst.mockResolvedValue({
      id: "p1",
      name: "Boris",
      imageUrl: null,
    });
    await expect(
      setPlayerImage({
        teamId: "t1",
        playerId: "p1",
        ownerId: "u1",
        body: Buffer.alloc(0),
      }),
    ).rejects.toMatchObject({ code: "EMPTY" });
  });

  it("404 quand le joueur n'appartient pas au coach (ou pas à l'équipe)", async () => {
    mockPrisma.teamPlayer.findFirst.mockResolvedValue(null);
    await expect(
      setPlayerImage({
        teamId: "t1",
        playerId: "p1",
        ownerId: "intrus",
        body: PNG,
      }),
    ).rejects.toBeInstanceOf(PlayerImageError);
    expect(mockPrisma.teamPlayer.update).not.toHaveBeenCalled();
  });

  it("préfixe l'URL avec l'hôte public quand il est configuré", async () => {
    process.env.PLAYER_IMAGE_ASSET_PUBLIC_BASE = "https://api.nufflearena.fr/";
    mockPrisma.teamPlayer.findFirst.mockResolvedValue({
      id: "p1",
      name: "Boris",
      imageUrl: null,
    });
    mockPrisma.teamPlayer.update.mockResolvedValue({});
    const { imageUrl } = await setPlayerImage({
      teamId: "t1",
      playerId: "p1",
      ownerId: "u1",
      body: PNG,
    });
    expect(
      imageUrl?.startsWith("https://api.nufflearena.fr/images/player-images/"),
    ).toBe(true);
  });
});

describe("clearPlayerImage", () => {
  it("remet imageUrl à null et supprime le fichier", async () => {
    await writeFile(path.join(uploadDir, "old-bbbbbbbbbbbb.png"), PNG);
    mockPrisma.teamPlayer.findFirst.mockResolvedValue({
      id: "p1",
      name: "Boris",
      imageUrl: "/images/player-images/old-bbbbbbbbbbbb.png",
    });
    mockPrisma.teamPlayer.update.mockResolvedValue({});

    const result = await clearPlayerImage({
      teamId: "t1",
      playerId: "p1",
      ownerId: "u1",
    });

    expect(result).toEqual({ imageUrl: null });
    expect(mockPrisma.teamPlayer.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { imageUrl: null },
    });
    expect(await readdir(uploadDir)).toHaveLength(0);
  });

  it("est un no-op quand le joueur n'a pas d'image", async () => {
    mockPrisma.teamPlayer.findFirst.mockResolvedValue({
      id: "p1",
      name: "Boris",
      imageUrl: null,
    });
    await expect(
      clearPlayerImage({ teamId: "t1", playerId: "p1", ownerId: "u1" }),
    ).resolves.toEqual({ imageUrl: null });
    expect(mockPrisma.teamPlayer.update).not.toHaveBeenCalled();
  });

  it("404 quand le joueur n'appartient pas au coach", async () => {
    mockPrisma.teamPlayer.findFirst.mockResolvedValue(null);
    await expect(
      clearPlayerImage({ teamId: "t1", playerId: "p1", ownerId: "intrus" }),
    ).rejects.toBeInstanceOf(PlayerImageError);
  });
});
