import { describe, it, expect } from "vitest";
import {
  buildProfileUpdatePayload,
  formatDateFr,
  getInitials,
  parseProfileResponse,
  validatePasswordChange,
  validateProfileUpdate,
  type PasswordChange,
  type ProfileFormData,
  type UserProfile,
} from "./profile";

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "u1",
    email: "coach@example.com",
    coachName: "Coach",
    firstName: null,
    lastName: null,
    dateOfBirth: null,
    role: "user",
    roles: ["user"],
    patreon: false,
    eloRating: 1500,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    counts: {
      teams: 0,
      matches: 0,
      createdMatches: 0,
      teamSelections: 0,
      createdLocalMatches: 0,
    },
    ...overrides,
  };
}

describe("getInitials", () => {
  it("uses two first letters of a two-word coach name", () => {
    expect(getInitials("John Smith", null, "j@x.com")).toBe("JS");
  });

  it("falls back to a single-letter for a single-word coach name", () => {
    expect(getInitials("Coach", null, "c@x.com")).toBe("C");
  });

  it("falls back to name when coach name is missing", () => {
    expect(getInitials("", "Jane Doe", "j@x.com")).toBe("JD");
  });

  it("falls back to email initial when no name is provided", () => {
    expect(getInitials("", null, "alpha@x.com")).toBe("A");
  });

  it("returns ? when nothing is available", () => {
    expect(getInitials("", null, "")).toBe("?");
  });

  it("truncates to two characters at most", () => {
    expect(getInitials("Alpha Beta Gamma Delta", null, "")).toBe("AB");
  });
});

describe("formatDateFr", () => {
  it("formats a valid ISO date into a FR long date", () => {
    const result = formatDateFr("2026-04-23T00:00:00.000Z");
    expect(result).toMatch(/2026/);
    expect(result).not.toBe("");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatDateFr(null)).toBe("");
    expect(formatDateFr(undefined)).toBe("");
    expect(formatDateFr("")).toBe("");
  });

  it("returns empty string for an invalid date", () => {
    expect(formatDateFr("not-a-date")).toBe("");
  });
});

describe("validateProfileUpdate", () => {
  function makeForm(overrides: Partial<ProfileFormData> = {}): ProfileFormData {
    return {
      email: "coach@example.com",
      coachName: "Coach",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      ...overrides,
    };
  }

  it("returns null when email and coachName are valid", () => {
    expect(validateProfileUpdate(makeForm())).toBeNull();
  });

  it("rejects an empty email", () => {
    expect(validateProfileUpdate(makeForm({ email: "" }))).toBe(
      "L'email est requis",
    );
  });

  it("rejects whitespace-only email", () => {
    expect(validateProfileUpdate(makeForm({ email: "   " }))).toBe(
      "L'email est requis",
    );
  });

  it("rejects an invalid email (no @)", () => {
    expect(validateProfileUpdate(makeForm({ email: "invalid" }))).toBe(
      "Email invalide",
    );
  });

  it("rejects an empty coach name", () => {
    expect(validateProfileUpdate(makeForm({ coachName: "" }))).toBe(
      "Le nom de coach est requis",
    );
  });

  it("rejects whitespace-only coach name", () => {
    expect(validateProfileUpdate(makeForm({ coachName: "   " }))).toBe(
      "Le nom de coach est requis",
    );
  });

  it("rejects a date of birth that is not parseable", () => {
    expect(
      validateProfileUpdate(makeForm({ dateOfBirth: "not-a-date" })),
    ).toBe("Date de naissance invalide");
  });

  it("accepts an empty date of birth", () => {
    expect(
      validateProfileUpdate(makeForm({ dateOfBirth: "" })),
    ).toBeNull();
  });

  it("accepts a valid ISO date of birth", () => {
    expect(
      validateProfileUpdate(makeForm({ dateOfBirth: "1990-05-15" })),
    ).toBeNull();
  });
});

describe("validatePasswordChange", () => {
  function makeData(overrides: Partial<PasswordChange> = {}): PasswordChange {
    return {
      currentPassword: "oldPass123",
      newPassword: "newPass123",
      confirmPassword: "newPass123",
      ...overrides,
    };
  }

  it("returns null when every field is valid and matching", () => {
    expect(validatePasswordChange(makeData())).toBeNull();
  });

  it("rejects when currentPassword is empty", () => {
    expect(
      validatePasswordChange(makeData({ currentPassword: "" })),
    ).toBe("Tous les champs sont requis");
  });

  it("rejects when newPassword is empty", () => {
    expect(validatePasswordChange(makeData({ newPassword: "" }))).toBe(
      "Tous les champs sont requis",
    );
  });

  it("rejects when confirmPassword is empty", () => {
    expect(
      validatePasswordChange(makeData({ confirmPassword: "" })),
    ).toBe("Tous les champs sont requis");
  });

  it("rejects when newPassword has fewer than 8 characters", () => {
    expect(
      validatePasswordChange(
        makeData({ newPassword: "short", confirmPassword: "short" }),
      ),
    ).toBe("Le nouveau mot de passe doit contenir au moins 8 caractères");
  });

  it("rejects when newPassword and confirmPassword differ", () => {
    expect(
      validatePasswordChange(
        makeData({ newPassword: "password1", confirmPassword: "password2" }),
      ),
    ).toBe("Les nouveaux mots de passe ne correspondent pas");
  });

  it("rejects when new password equals current password", () => {
    expect(
      validatePasswordChange(
        makeData({
          currentPassword: "samePass1",
          newPassword: "samePass1",
          confirmPassword: "samePass1",
        }),
      ),
    ).toBe("Le nouveau mot de passe doit être différent de l'ancien");
  });
});

describe("parseProfileResponse", () => {
  it("parses a well-formed response into a UserProfile", () => {
    const response = {
      user: {
        id: "u1",
        email: "coach@example.com",
        coachName: "Coach",
        firstName: "John",
        lastName: "Doe",
        dateOfBirth: "1990-05-15T00:00:00.000Z",
        role: "user",
        roles: ["user"],
        patreon: true,
        eloRating: 1600,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
        _count: {
          teams: 3,
          matches: 12,
          createdMatches: 5,
          teamSelections: 7,
          createdLocalMatches: 2,
        },
      },
    };
    const profile = parseProfileResponse(response);
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe("u1");
    expect(profile!.email).toBe("coach@example.com");
    expect(profile!.eloRating).toBe(1600);
    expect(profile!.counts.teams).toBe(3);
    expect(profile!.counts.matches).toBe(12);
    expect(profile!.counts.createdLocalMatches).toBe(2);
    expect(profile!.roles).toEqual(["user"]);
    expect(profile!.patreon).toBe(true);
  });

  it("returns null when user is missing", () => {
    expect(parseProfileResponse({})).toBeNull();
    expect(parseProfileResponse(null)).toBeNull();
    expect(parseProfileResponse(undefined)).toBeNull();
  });

  it("returns null when core fields are missing", () => {
    const response = { user: { id: "u1" } };
    expect(parseProfileResponse(response)).toBeNull();
  });

  it("fills counts defaults when _count is missing", () => {
    const response = {
      user: {
        id: "u1",
        email: "c@x.com",
        coachName: "Coach",
        role: "user",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    };
    const profile = parseProfileResponse(response);
    expect(profile).not.toBeNull();
    expect(profile!.counts).toEqual({
      teams: 0,
      matches: 0,
      createdMatches: 0,
      teamSelections: 0,
      createdLocalMatches: 0,
    });
  });

  it("normalises role into roles when roles is absent", () => {
    const response = {
      user: {
        id: "u1",
        email: "c@x.com",
        coachName: "Coach",
        role: "admin",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    };
    const profile = parseProfileResponse(response);
    expect(profile!.roles).toEqual(["admin"]);
  });

  it("defaults eloRating to 1000 when missing", () => {
    const response = {
      user: {
        id: "u1",
        email: "c@x.com",
        coachName: "Coach",
        role: "user",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    };
    const profile = parseProfileResponse(response);
    expect(profile!.eloRating).toBe(1000);
  });
});

describe("buildProfileUpdatePayload", () => {
  it("maps empty optional string fields to null", () => {
    const payload = buildProfileUpdatePayload({
      email: "c@x.com",
      coachName: "Coach",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
    });
    expect(payload).toEqual({
      email: "c@x.com",
      coachName: "Coach",
      firstName: null,
      lastName: null,
      dateOfBirth: null,
    });
  });

  it("keeps non-empty optional fields as is", () => {
    const payload = buildProfileUpdatePayload({
      email: "c@x.com",
      coachName: "Coach",
      firstName: "John",
      lastName: "Doe",
      dateOfBirth: "1990-05-15",
    });
    expect(payload).toEqual({
      email: "c@x.com",
      coachName: "Coach",
      firstName: "John",
      lastName: "Doe",
      dateOfBirth: "1990-05-15",
    });
  });

  it("trims email and coachName", () => {
    const payload = buildProfileUpdatePayload({
      email: "  c@x.com  ",
      coachName: "  Coach  ",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
    });
    expect(payload.email).toBe("c@x.com");
    expect(payload.coachName).toBe("Coach");
  });
});

describe("UserProfile defaults (sanity)", () => {
  it("makeProfile factory creates a usable fixture", () => {
    const p = makeProfile();
    expect(p.eloRating).toBe(1500);
    expect(p.counts.teams).toBe(0);
  });
});
