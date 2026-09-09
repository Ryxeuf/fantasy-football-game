import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollapsibleSection } from "./CollapsibleSection";
import { CollapseToggle } from "./CollapseToggle";

const LABELS = { collapseLabel: "Replier", expandLabel: "Déplier" };

describe("CollapseToggle", () => {
  it("expose son état via aria-expanded et son libellé", () => {
    const onToggle = vi.fn();
    render(
      <CollapseToggle
        open
        onToggle={onToggle}
        label="Replier"
        testId="tgl"
        controls="body-1"
      />,
    );
    const btn = screen.getByTestId("tgl");
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(btn.getAttribute("aria-label")).toBe("Replier");
    expect(btn.getAttribute("aria-controls")).toBe("body-1");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("CollapsibleSection", () => {
  it("est dépliée au montage et masque son corps au clic", () => {
    render(
      <CollapsibleSection testId="sec" title={<h3>Classement</h3>} {...LABELS}>
        <p>Contenu</p>
      </CollapsibleSection>,
    );
    expect(screen.getByText("Contenu")).toBeTruthy();

    fireEvent.click(screen.getByTestId("sec-toggle"));
    expect(screen.queryByText("Contenu")).toBeNull();
    expect(screen.getByTestId("sec-toggle").getAttribute("aria-expanded")).toBe(
      "false",
    );
    // Le titre reste visible : la page garde ses repères.
    expect(screen.getByText("Classement")).toBeTruthy();
  });

  it("se replie et se déplie de nouveau", () => {
    render(
      <CollapsibleSection testId="sec" title={<h3>T</h3>} {...LABELS}>
        <p>Contenu</p>
      </CollapsibleSection>,
    );
    fireEvent.click(screen.getByTestId("sec-toggle"));
    fireEvent.click(screen.getByTestId("sec-toggle"));
    expect(screen.getByText("Contenu")).toBeTruthy();
  });

  it("respecte defaultOpen={false}", () => {
    render(
      <CollapsibleSection
        testId="sec"
        title={<h3>T</h3>}
        defaultOpen={false}
        {...LABELS}
      >
        <p>Contenu</p>
      </CollapsibleSection>,
    );
    expect(screen.queryByText("Contenu")).toBeNull();
  });

  it("bascule le libellé accessible selon l'état", () => {
    render(
      <CollapsibleSection testId="sec" title={<h3>T</h3>} {...LABELS}>
        <p>Contenu</p>
      </CollapsibleSection>,
    );
    const btn = screen.getByTestId("sec-toggle");
    expect(btn.getAttribute("aria-label")).toBe("Replier");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-label")).toBe("Déplier");
  });

  it("garde les actions visibles même repliée", () => {
    render(
      <CollapsibleSection
        testId="sec"
        title={<h3>T</h3>}
        actions={<button type="button">Action</button>}
        defaultOpen={false}
        {...LABELS}
      >
        <p>Contenu</p>
      </CollapsibleSection>,
    );
    expect(screen.getByText("Action")).toBeTruthy();
  });

  it("délègue l'état en mode contrôlé", () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection
        testId="sec"
        title={<h3>T</h3>}
        open={false}
        onToggle={onToggle}
        {...LABELS}
      >
        <p>Contenu</p>
      </CollapsibleSection>,
    );
    expect(screen.queryByText("Contenu")).toBeNull();
    fireEvent.click(screen.getByTestId("sec-toggle"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    // L'état vient du parent : sans re-render, rien ne bouge.
    expect(screen.queryByText("Contenu")).toBeNull();
  });
});
