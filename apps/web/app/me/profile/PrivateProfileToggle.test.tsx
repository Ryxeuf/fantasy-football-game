import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PrivateProfileToggle from "./PrivateProfileToggle";

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

describe("PrivateProfileToggle (S26.3k)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("fake-token");
  });

  it("renders the section heading and explanation", () => {
    render(<PrivateProfileToggle initialValue={false} />);
    expect(
      screen.getByRole("heading", { level: 3, name: /profil prive/i }),
    ).toBeTruthy();
  });

  it("checkbox initial state reflects the prop", () => {
    const r1 = render(<PrivateProfileToggle initialValue={false} />);
    expect(
      (r1.getByTestId("private-profile-toggle") as HTMLInputElement).checked,
    ).toBe(false);
    r1.unmount();
    const r2 = render(<PrivateProfileToggle initialValue={true} />);
    expect(
      (r2.getByTestId("private-profile-toggle") as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("PUTs /auth/me/privacy with the new value when toggled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { privateProfile: true } }),
    });

    render(<PrivateProfileToggle initialValue={false} />);
    const checkbox = screen.getByTestId(
      "private-profile-toggle",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/me\/privacy$/);
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      privateProfile: true,
    });
  });

  it("displays a confirmation message after a successful save", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { privateProfile: true } }),
    });

    render(<PrivateProfileToggle initialValue={false} />);
    fireEvent.click(screen.getByTestId("private-profile-toggle"));

    const status = await screen.findByTestId("private-profile-status");
    expect(status.textContent).toMatch(/enregistre|sauvegarde/i);
  });

  it("reverts the checkbox and shows an error when the request fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: "boom" }),
    });

    render(<PrivateProfileToggle initialValue={false} />);
    const checkbox = screen.getByTestId(
      "private-profile-toggle",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(checkbox.checked).toBe(false);
    });
    const status = await screen.findByTestId("private-profile-status");
    expect(status.textContent).toMatch(/erreur|boom/i);
  });
});
