import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: { skill: { updateMany: vi.fn() } },
}));

import { prisma } from "../prisma";
import { syncSkillPrerequisites } from "./sync-skill-prerequisites";

const updateMany = prisma.skill.updateMany as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
});

describe("syncSkillPrerequisites", () => {
  it("n'écrit que les lignes jamais renseignées", async () => {
    await syncSkillPrerequisites();
    expect(updateMany).toHaveBeenCalledWith({
      where: { slug: "strong-arm", requiredSkills: null },
      data: { requiredSkills: "throw-team-mate" },
    });
  });

  it("ignore les compétences sans prérequis", async () => {
    const total = await syncSkillPrerequisites();
    expect(total).toBe(4);
    expect(updateMany).toHaveBeenCalledTimes(4);
  });
});
