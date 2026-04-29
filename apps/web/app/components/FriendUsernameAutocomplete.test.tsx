import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import FriendUsernameAutocomplete from "./FriendUsernameAutocomplete";

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

function buildResponse(
  results: Array<{ id: string; coachName: string }>,
): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { results } }),
  } as Response;
}

describe("FriendUsernameAutocomplete (S26.4d)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("fake-token");
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("renders an input with an accessible label", () => {
    const onSelect = vi.fn();
    render(<FriendUsernameAutocomplete onSelect={onSelect} />);
    expect(
      screen.getByLabelText(/coach|pseudo|username/i),
    ).toBeTruthy();
  });

  it("does not call /friends/search when the query is too short (< 2 chars)", async () => {
    render(<FriendUsernameAutocomplete onSelect={vi.fn()} />);
    const input = screen.getByTestId(
      "friend-autocomplete-input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a" } });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("debounces fetch calls and queries /friends/search with the typed value", async () => {
    mockFetch.mockResolvedValue(buildResponse([]));
    render(<FriendUsernameAutocomplete onSelect={vi.fn()} />);
    const input = screen.getByTestId(
      "friend-autocomplete-input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "al" } });
    fireEvent.change(input, { target: { value: "ali" } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toMatch(/\/friends\/search/);
    expect(url).toMatch(/q=ali/);
  });

  it("renders suggestions returned by the API", async () => {
    mockFetch.mockResolvedValue(
      buildResponse([
        { id: "u-1", coachName: "Alice" },
        { id: "u-2", coachName: "Aline" },
      ]),
    );
    render(<FriendUsernameAutocomplete onSelect={vi.fn()} />);
    fireEvent.change(screen.getByTestId("friend-autocomplete-input"), {
      target: { value: "ali" },
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const items = await screen.findAllByTestId(
      /^friend-autocomplete-option-/,
    );
    expect(items.length).toBe(2);
    expect(items[0].textContent).toMatch(/Alice/);
  });

  it("calls onSelect when a suggestion is clicked", async () => {
    const onSelect = vi.fn();
    mockFetch.mockResolvedValue(
      buildResponse([{ id: "u-1", coachName: "Alice" }]),
    );
    render(<FriendUsernameAutocomplete onSelect={onSelect} />);
    fireEvent.change(screen.getByTestId("friend-autocomplete-input"), {
      target: { value: "ali" },
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const item = await screen.findByTestId("friend-autocomplete-option-u-1");
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledWith({
      id: "u-1",
      coachName: "Alice",
    });
  });
});
