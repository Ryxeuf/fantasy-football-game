import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ProfilePage from "./page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn(() => "fake-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

const mockProfile = {
  user: {
    id: "u1",
    email: "coach@nuffle.gg",
    coachName: "Coach Alpha",
    firstName: "John",
    lastName: "Doe",
    dateOfBirth: null,
    role: "user",
    roles: ["user"],
    patreon: false,
    eloRating: 1250,
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-03-20T14:00:00Z",
    _count: {
      teams: 3,
      matches: 12,
      createdMatches: 5,
      teamSelections: 8,
      createdLocalMatches: 2,
    },
  },
};

describe("ProfilePage — ELO display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("fake-token");
  });

  it("displays the user's ELO rating in the stats section", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfile),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Coach Alpha")).toBeTruthy();
    });

    // ELO rating should be displayed
    expect(screen.getByText("1250")).toBeTruthy();
    // Label should be present
    expect(screen.getByText(/ELO/i)).toBeTruthy();
  });

  it("displays default ELO (1000) for new users", async () => {
    const newUserProfile = {
      user: {
        ...mockProfile.user,
        eloRating: 1000,
        _count: { teams: 0, matches: 0, createdMatches: 0, teamSelections: 0, createdLocalMatches: 0 },
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(newUserProfile),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Coach Alpha")).toBeTruthy();
    });

    expect(screen.getByText("1000")).toBeTruthy();
  });
});
