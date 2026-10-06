/**
 * Lot 5 « exploitation » — protocole entre le pool et ses workers.
 * Données seules (clonage structuré) : pas de fonction, pas de classe.
 */

import type { SimulateDriverKind } from '../simulate-match';
import type { SimInput, SimResult } from '../types';

export interface SimPoolOptions {
  readonly driverKind?: SimulateDriverKind;
  /**
   * Ne pas renvoyer `fullReplay` (états après chaque coup, ~2 Mo) : il se
   * re-dérive du journal (`replayJournal`). Le serveur ne persiste que le
   * journal, le transfert serait pure perte.
   */
  readonly stripFullReplay?: boolean;
}

export interface SimPoolRequest {
  readonly id: number;
  readonly input: SimInput;
  readonly options?: SimPoolOptions;
}

export interface SimPoolResponse {
  readonly id: number;
  readonly result?: SimResult;
  readonly error?: string;
}
