/**
 * Garde-fou « modifications non sauvegardées ».
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  navigationTargetFor,
  useUnsavedChanges,
  UNSAVED_CHANGES_MESSAGE,
} from "./useUnsavedChanges";

function Harness({
  when,
  confirmLeave,
}: {
  when: boolean;
  confirmLeave: (m: string) => boolean;
}) {
  useUnsavedChanges({ when, confirmLeave });
  return (
    <div>
      <a href="/me/teams" data-testid="internal-link">
        Annuler
      </a>
      <a href="#section" data-testid="anchor-link">
        Ancre
      </a>
      <a href="/docs" target="_blank" data-testid="new-tab-link">
        Nouvel onglet
      </a>
    </div>
  );
}

let confirmLeave: ReturnType<typeof vi.fn>;

beforeEach(() => {
  confirmLeave = vi.fn().mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUnsavedChanges", () => {
  it("bloque un lien interne quand l'utilisateur refuse de quitter", () => {
    const { getByTestId } = render(
      <Harness when confirmLeave={confirmLeave} />,
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    getByTestId("internal-link").dispatchEvent(event);

    expect(confirmLeave).toHaveBeenCalledWith(UNSAVED_CHANGES_MESSAGE);
    expect(event.defaultPrevented).toBe(true);
  });

  it("laisse partir quand l'utilisateur confirme", () => {
    confirmLeave.mockReturnValue(true);
    const { getByTestId } = render(
      <Harness when confirmLeave={confirmLeave} />,
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    getByTestId("internal-link").dispatchEvent(event);

    expect(confirmLeave).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ne demande rien sans modification en attente", () => {
    const { getByTestId } = render(
      <Harness when={false} confirmLeave={confirmLeave} />,
    );
    fireEvent.click(getByTestId("internal-link"));
    expect(confirmLeave).not.toHaveBeenCalled();
  });

  it("ignore les ancres internes et les ouvertures en nouvel onglet", () => {
    const { getByTestId } = render(
      <Harness when confirmLeave={confirmLeave} />,
    );
    fireEvent.click(getByTestId("anchor-link"));
    fireEvent.click(getByTestId("new-tab-link"));
    expect(confirmLeave).not.toHaveBeenCalled();
  });

  it("arme puis désarme `beforeunload` selon l'état", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<Harness when confirmLeave={confirmLeave} />);
    expect(add.mock.calls.some(([type]) => type === "beforeunload")).toBe(true);

    unmount();
    expect(remove.mock.calls.some(([type]) => type === "beforeunload")).toBe(
      true,
    );
  });
});

describe("navigationTargetFor", () => {
  function clickOn(html: string, init: MouseEventInit = {}) {
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const anchor = host.querySelector("a")!;
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    Object.defineProperty(event, "target", { value: anchor });
    const result = navigationTargetFor(event);
    host.remove();
    return result;
  }

  it("retient un lien interne cliqué normalement", () => {
    expect(clickOn('<a href="/me/teams">x</a>')).not.toBeNull();
  });

  it("ignore un clic milieu ou avec modificateur", () => {
    expect(clickOn('<a href="/me/teams">x</a>', { button: 1 })).toBeNull();
    expect(clickOn('<a href="/me/teams">x</a>', { metaKey: true })).toBeNull();
    expect(clickOn('<a href="/me/teams">x</a>', { ctrlKey: true })).toBeNull();
  });

  it("ignore un téléchargement et les protocoles non navigables", () => {
    expect(clickOn('<a href="/x.pdf" download>x</a>')).toBeNull();
    expect(clickOn('<a href="mailto:a@b.c">x</a>')).toBeNull();
    expect(clickOn('<a href="tel:+3312">x</a>')).toBeNull();
  });

  it("ignore un clic déjà annulé en amont", () => {
    const host = document.createElement("div");
    host.innerHTML = '<a href="/me/teams">x</a>';
    document.body.appendChild(host);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", {
      value: host.querySelector("a")!,
    });
    event.preventDefault();
    expect(navigationTargetFor(event)).toBeNull();
    host.remove();
  });
});
