import type { ExtendedGameState } from './game-state';
import type {
  InducementSelection,
  InducementContext,
  PettyCashInput,
} from './inducements';
import { processInducementsWithSelection } from './inducements';

export interface InducementSubmissionParams {
  teamId: "A" | "B";
  selection: InducementSelection;
  pettyCashInput: PettyCashInput;
  otherTeamSelection: InducementSelection;
  ctxA: InducementContext;
  ctxB: InducementContext;
}

export interface InducementSubmissionResult {
  success: boolean;
  state?: ExtendedGameState;
  error?: string;
  errors?: string[];
}

/**
 * Handles inducement submission for both teams.
 * Called when both teams have made their selections.
 */
export function handleInducementSubmission(
  state: ExtendedGameState,
  params: InducementSubmissionParams,
): InducementSubmissionResult {
  if (state.preMatch.phase !== "inducements") {
    return {
      success: false,
      error: "Phase incorrecte : la phase inducements n'est pas active.",
    };
  }

  const { pettyCashInput, ctxA, ctxB } = params;

  // Determine which selection goes to which team
  const selectionA =
    params.teamId === "A" ? params.selection : params.otherTeamSelection;
  const selectionB =
    params.teamId === "B" ? params.selection : params.otherTeamSelection;

  const result = processInducementsWithSelection(
    state,
    pettyCashInput,
    selectionA,
    selectionB,
    ctxA,
    ctxB,
  );

  const allErrors = [
    ...result.validationA.errors,
    ...result.validationB.errors,
  ];

  if (!result.validationA.valid || !result.validationB.valid) {
    return {
      success: false,
      errors: allErrors,
      error: allErrors.join("; "),
    };
  }

  return {
    success: true,
    state: result.state,
  };
}
