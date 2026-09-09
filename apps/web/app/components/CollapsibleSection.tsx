"use client";
import { useId, useState, type ReactNode } from "react";
import { CollapseToggle } from "./CollapseToggle";

/**
 * Section titrée repliable. Le titre reste toujours visible (avec les
 * actions éventuelles) : seul le corps se plie, de sorte qu'une page
 * longue reste navigable sans perdre ses repères.
 *
 * Non contrôlée par défaut ; `open`/`onToggle` permettent de la piloter
 * depuis un « Tout replier » externe.
 */
interface CollapsibleSectionProps {
  title: ReactNode;
  children: ReactNode;
  /** Ouvert au montage (mode non contrôlé). */
  defaultOpen?: boolean;
  /** Mode contrôlé : passer les deux. */
  open?: boolean;
  onToggle?: () => void;
  /** Libellés accessibles du bouton, selon l'état. */
  collapseLabel: string;
  expandLabel: string;
  /** Rendu à droite du titre, toujours visible (boutons d'action…). */
  actions?: ReactNode;
  testId?: string;
  className?: string;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  open: controlledOpen,
  onToggle,
  collapseLabel,
  expandLabel,
  actions,
  testId,
  className = "space-y-3",
}: CollapsibleSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const bodyId = useId();

  const toggle = () => {
    if (isControlled) onToggle?.();
    else setUncontrolledOpen((v) => !v);
  };

  return (
    <section data-testid={testId} className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CollapseToggle
            open={open}
            onToggle={toggle}
            label={open ? collapseLabel : expandLabel}
            controls={bodyId}
            testId={testId ? `${testId}-toggle` : undefined}
          />
          {title}
        </div>
        {actions}
      </div>
      <div
        id={bodyId}
        hidden={!open}
        data-testid={testId ? `${testId}-body` : undefined}
      >
        {open ? children : null}
      </div>
    </section>
  );
}
