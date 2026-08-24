"use client";

import type { ReactNode } from "react";

interface StaffRowProps {
  label: string;
  /** Coût unitaire déjà formaté (ex. « 60k po »). */
  unitCost: string;
  testId?: string;
  children: ReactNode;
}

/**
 * Ligne de configuration d'un poste de staff : libellé + coût unitaire à
 * gauche, contrôle (stepper / interrupteur) à droite.
 *
 * Partagé entre le builder de création (`me/teams/new`) et le panneau staff
 * de l'édition (`components/TeamInfoEditor`) pour que les deux écrans aient
 * exactement le même rendu.
 */
export default function StaffRow({
  label,
  unitCost,
  testId,
  children,
}: StaffRowProps) {
  return (
    <div
      data-testid={testId}
      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50"
    >
      <div className="min-w-0">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-600">{unitCost}</div>
      </div>
      {children}
    </div>
  );
}
