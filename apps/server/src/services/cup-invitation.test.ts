import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { findUnique: vi.fn() },
    cupInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./cup-registration", () => {
  class CupRegistrationError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "CupRegistrationError";
    }
  }
  return { CupRegistrationError, registerTeamToCup: vi.fn() };
});

vi.mock("./cup-invitation-notify", () => ({
  notifyInvitedCoach: vi.fn(),
}));

import { prisma } from "../prisma";
import { registerTeamToCup, CupRegistrationError } from "./cup-registration";
import {
  createCupInvitation,
  acceptCupInvitation,
  CupInvitationError,
} from "./cup-invitation";

const cupFind = prisma.cup.findUnique as unknown as ReturnType<typeof vi.fn>;
const invFindFirst = prisma.cupInvitation.findFirst as unknown as ReturnType<typeof vi.fn>;
const invFindUnique = prisma.cupInvitation.findUnique as unknown as ReturnType<typeof vi.fn>;
const invCreate = prisma.cupInvitation.create as unknown as ReturnType<typeof vi.fn>;
const invUpdate = prisma.cupInvitation.update as unknown as ReturnType<typeof vi.fn>;
const mockRegister = registerTeamToCup as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createCupInvitation", () => {
  it("crée une invitation avec un code quand la coupe est ouverte", async () => {
    cupFind.mockResolvedValue({ id: "C1", name: "Coupe X", status: "ouverte", validated: false });
    invFindFirst.mockResolvedValue(null);
    invCreate.mockImplementation((args: any) => Promise.resolve({ id: "I1", ...args.data }));

    const inv = await createCupInvitation({ cupId: "C1", inviterUserId: "U1" });
    expect(inv.code).toBeTruthy();
    expect(invCreate).toHaveBeenCalled();
  });

  it("refuse si la coupe est fermée", async () => {
    cupFind.mockResolvedValue({ id: "C1", name: "X", status: "en_cours", validated: true });
    await expect(
      createCupInvitation({ cupId: "C1", inviterUserId: "U1" }),
    ).rejects.toMatchObject({ code: "cup_closed" });
  });

  it("idempotence : renvoie une invitation pending existante pour le même coach", async () => {
    cupFind.mockResolvedValue({ id: "C1", name: "X", status: "ouverte", validated: false });
    invFindFirst.mockResolvedValue({ id: "EXISTING", code: "abc" });
    const inv = await createCupInvitation({
      cupId: "C1",
      inviterUserId: "U1",
      inviteeUserId: "U2",
    });
    expect(inv.id).toBe("EXISTING");
    expect(invCreate).not.toHaveBeenCalled();
  });
});

describe("acceptCupInvitation", () => {
  const future = new Date(Date.now() + 3600_000);

  it("inscrit l'équipe et marque accepted", async () => {
    invFindUnique.mockResolvedValue({
      id: "I1",
      cupId: "C1",
      status: "pending",
      expiresAt: future,
      inviteeUserId: null,
    });
    mockRegister.mockResolvedValue({ participantId: "P1", pspPoolGranted: 0 });
    invUpdate.mockImplementation((args: any) => Promise.resolve({ id: "I1", ...args.data }));

    const out = await acceptCupInvitation({ code: "abc", userId: "U2", teamId: "T1" });
    expect(mockRegister).toHaveBeenCalledWith({ cupId: "C1", teamId: "T1", userId: "U2" });
    expect(out.status).toBe("accepted");
    expect(out.acceptedParticipantId).toBe("P1");
  });

  it("refuse une invitation expirée", async () => {
    invFindUnique.mockResolvedValue({
      id: "I1",
      cupId: "C1",
      status: "pending",
      expiresAt: new Date(Date.now() - 1000),
      inviteeUserId: null,
    });
    (prisma.cupInvitation.update as any).mockResolvedValue({});
    await expect(
      acceptCupInvitation({ code: "abc", userId: "U2", teamId: "T1" }),
    ).rejects.toMatchObject({ code: "expired" });
  });

  it("mappe une erreur d'inscription (engagement) en erreur d'invitation", async () => {
    invFindUnique.mockResolvedValue({
      id: "I1",
      cupId: "C1",
      status: "pending",
      expiresAt: future,
      inviteeUserId: null,
    });
    mockRegister.mockRejectedValue(
      new CupRegistrationError("already_engaged", "déjà engagée"),
    );
    await expect(
      acceptCupInvitation({ code: "abc", userId: "U2", teamId: "T1" }),
    ).rejects.toMatchObject({ code: "already_engaged" });
  });

  it("refuse si l'invitation cible un autre coach", async () => {
    invFindUnique.mockResolvedValue({
      id: "I1",
      cupId: "C1",
      status: "pending",
      expiresAt: future,
      inviteeUserId: "OTHER",
    });
    await expect(
      acceptCupInvitation({ code: "abc", userId: "U2", teamId: "T1" }),
    ).rejects.toBeInstanceOf(CupInvitationError);
  });
});
