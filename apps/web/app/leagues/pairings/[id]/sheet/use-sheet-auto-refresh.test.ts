import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSheetAutoRefresh } from "./use-sheet-auto-refresh";

describe("useSheetAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("relit toutes les 15 s tant qu'il est actif", () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useSheetAutoRefresh(enabled, refresh),
      { initialProps: { enabled: true } },
    );
    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    rerender({ enabled: false });
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("relit au retour sur l'onglet (focus / visibilité)", () => {
    const refresh = vi.fn();
    renderHook(() => useSheetAutoRefresh(true, refresh));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("inactif : aucune relecture", () => {
    const refresh = vi.fn();
    renderHook(() => useSheetAutoRefresh(false, refresh));
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(60_000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
