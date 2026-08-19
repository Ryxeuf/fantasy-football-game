"use client";

import { useCallback, useEffect, useState } from "react";

const PREFIX = "nuffle_aide_de_jeu:";

/**
 * Coches persistées sur l'appareil, une clé par liste.
 *
 * La lecture se fait dans un `useEffect` et jamais pendant le rendu : le
 * HTML serveur et le premier rendu client doivent être identiques, sinon
 * Next signale une erreur d'hydratation. Conséquence assumée : les coches
 * apparaissent au tick suivant le montage.
 *
 * Un `localStorage` indisponible (navigation privée, quota atteint) est
 * traité comme « rien de coché » — la page reste utilisable.
 */
export function useChecklist(listId: string): {
  checked: ReadonlySet<string>;
  isChecked: (id: string) => boolean;
  toggle: (id: string) => void;
  reset: () => void;
} {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setChecked(read(listId));
  }, [listId]);

  const toggle = useCallback(
    (id: string) => {
      setChecked((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        write(listId, next);
        return next;
      });
    },
    [listId],
  );

  const reset = useCallback(() => {
    setChecked(() => {
      const empty = new Set<string>();
      write(listId, empty);
      return empty;
    });
  }, [listId]);

  const isChecked = useCallback((id: string) => checked.has(id), [checked]);

  return { checked, isChecked, toggle, reset };
}

function read(listId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(PREFIX + listId);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function write(listId: string, value: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(PREFIX + listId, JSON.stringify([...value]));
  } catch {
    // Stockage indisponible : les coches restent en mémoire pour cette visite.
  }
}
