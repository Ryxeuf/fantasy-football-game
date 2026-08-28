/**
 * Brouillon de la LISTE DES POSITIONS éditée par un admin.
 *
 * La console admin n'avait aucune prise sur la composition d'une équipe. Ce
 * module porte les règles du brouillon, sans React ni fetch, pour qu'elles
 * soient testables seules : ajouter un poste, retirer un joueur, numéroter
 * automatiquement, et savoir ce qu'il reste à enregistrer.
 *
 * Le brouillon décrit l'état CIBLE complet attendu par `PUT /team/:id/roster`
 * (un joueur sans `id` est créé, un joueur existant absent est supprimé).
 */

/** Poste proposé par `GET /team/:id/available-positions`. */
export interface AvailablePosition {
  readonly key: string;
  readonly name: string;
  /** Coût en Kpo (l'API sert des kpo pour les postes). */
  readonly cost: number;
  readonly currentCount: number;
  readonly maxCount: number;
  readonly canAdd: boolean;
}

/** Joueur du brouillon. `id` absent (ou vide) = joueur à créer. */
export interface DraftPlayer {
  /** Identifiant serveur, absent pour un ajout local. */
  readonly id?: string;
  /** Clé locale stable, pour le rendu React des lignes non persistées. */
  readonly key: string;
  readonly position: string;
  readonly name: string;
  readonly number: number;
  /** Joueur mort / licencié : jamais modifiable, jamais retirable ici. */
  readonly locked: boolean;
}

/** Joueur tel que renvoyé par `GET /team/:id`. */
export interface LoadedPlayer {
  readonly id: string;
  readonly position: string;
  readonly name: string;
  readonly number: number;
  readonly dead?: boolean;
  readonly firedAt?: string | null;
}

/**
 * Convertit les joueurs chargés en brouillon.
 *
 * Un joueur mort ou licencié est marqué `locked` : il ne fait plus partie du
 * roster actif, et le retirer du payload le SUPPRIMERAIT de l'historique.
 */
export function toDraft(players: readonly LoadedPlayer[]): DraftPlayer[] {
  return players.map((p) => ({
    id: p.id,
    key: p.id,
    position: p.position,
    name: p.name,
    number: p.number,
    locked: Boolean(p.dead) || p.firedAt != null,
  }));
}

/**
 * Premier numéro de maillot libre entre 1 et 99.
 *
 * Le serveur refuse les doublons : sans cette attribution, tout ajout après
 * le 1er échouait sur « numéro déjà pris ».
 */
export function nextFreeNumber(players: readonly DraftPlayer[]): number {
  const taken = new Set(players.map((p) => p.number));
  for (let n = 1; n <= 99; n += 1) {
    if (!taken.has(n)) return n;
  }
  return 99;
}

/** Ajoute un joueur au poste donné, numéroté sur le premier creux libre. */
export function addPlayer(
  players: readonly DraftPlayer[],
  position: AvailablePosition,
  nameHint?: string,
): DraftPlayer[] {
  const number = nextFreeNumber(players);
  return [
    ...players,
    {
      key: `new-${position.key}-${number}-${players.length}`,
      position: position.key,
      name: (nameHint ?? position.name).slice(0, 100),
      number,
      locked: false,
    },
  ];
}

/** Retire un joueur du brouillon. Un joueur `locked` n'est jamais retiré. */
export function removePlayer(
  players: readonly DraftPlayer[],
  key: string,
): DraftPlayer[] {
  return players.filter((p) => p.key !== key || p.locked);
}

/** Remplace un champ éditable d'un joueur (nom ou numéro). */
export function updatePlayer(
  players: readonly DraftPlayer[],
  key: string,
  patch: Partial<Pick<DraftPlayer, "name" | "number">>,
): DraftPlayer[] {
  return players.map((p) => (p.key === key ? { ...p, ...patch } : p));
}

/** Payload `PUT /team/:id/roster` : état cible complet. */
export interface RosterSavePayload {
  readonly name?: string;
  readonly players: ReadonlyArray<{
    id?: string;
    position: string;
    name: string;
    number: number;
  }>;
}

export function buildSavePayload(
  players: readonly DraftPlayer[],
  teamName?: string,
): RosterSavePayload {
  return {
    ...(teamName ? { name: teamName } : {}),
    players: players.map((p) => ({
      ...(p.id ? { id: p.id } : {}),
      position: p.position,
      name: p.name.trim(),
      number: p.number,
    })),
  };
}

/**
 * Signature stable du brouillon : deux états identiques produisent la même
 * chaîne, quel que soit l'ordre des lignes. Sert au garde « modifications
 * non enregistrées ».
 */
export function draftSignature(
  players: readonly DraftPlayer[],
  teamName: string,
): string {
  const rows = players
    .map((p) => `${p.id ?? "new"}|${p.position}|${p.name.trim()}|${p.number}`)
    .sort();
  return JSON.stringify([teamName.trim(), rows]);
}

/** Erreurs bloquantes du brouillon, affichées avant même l'appel serveur. */
export function validateDraft(players: readonly DraftPlayer[]): string[] {
  const errors: string[] = [];

  const numbers = players.map((p) => p.number);
  const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
  if (duplicates.length > 0) {
    errors.push(
      `Numéros en double : ${[...new Set(duplicates)].sort((a, b) => a - b).join(", ")}`,
    );
  }
  if (players.some((p) => p.name.trim().length === 0)) {
    errors.push("Chaque joueur doit avoir un nom");
  }
  if (players.some((p) => p.number < 1 || p.number > 99)) {
    errors.push("Les numéros doivent être compris entre 1 et 99");
  }
  if (players.length === 0) {
    errors.push("Une équipe doit compter au moins un joueur");
  }
  return errors;
}
