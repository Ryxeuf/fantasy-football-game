import { describe, it, expect } from "vitest";
import {
  participantRemovalAction,
  participantRemovalConfirm,
  type ParticipantRemovalInput,
} from "./participant-removal";

const BASE: ParticipantRemovalInput = {
  isCommissioner: false,
  isAdmin: false,
  isMyTeam: false,
  status: "ouverte",
  validated: false,
};

describe("participantRemovalAction", () => {
  it("le commissaire retire l'équipe d'un coach, coupe en cours comprise", () => {
    for (const status of ["ouverte", "en_cours"]) {
      expect(
        participantRemovalAction({
          ...BASE,
          isCommissioner: true,
          status,
          validated: status !== "ouverte",
        }),
      ).toEqual({ label: "Retirer", byCommissioner: true });
    }
  });

  it("un admin a les droits du commissaire", () => {
    expect(
      participantRemovalAction({ ...BASE, isAdmin: true, status: "en_cours", validated: true }),
    ).toEqual({ label: "Retirer", byCommissioner: true });
  });

  it("personne ne retire d'une coupe terminée ou archivée", () => {
    for (const status of ["terminee", "archivee"]) {
      expect(
        participantRemovalAction({ ...BASE, isCommissioner: true, status, validated: true }),
      ).toBeNull();
    }
  });

  it("le propriétaire retire SON équipe tant que les inscriptions sont ouvertes", () => {
    expect(participantRemovalAction({ ...BASE, isMyTeam: true })).toEqual({
      label: "Retirer mon équipe",
      byCommissioner: false,
    });
    expect(
      participantRemovalAction({ ...BASE, isMyTeam: true, validated: true }),
    ).toBeNull();
    expect(
      participantRemovalAction({ ...BASE, isMyTeam: true, status: "en_cours", validated: true }),
    ).toBeNull();
  });

  it("un commissaire qui joue garde le libellé « mon équipe »", () => {
    expect(
      participantRemovalAction({
        ...BASE,
        isCommissioner: true,
        isMyTeam: true,
        status: "en_cours",
        validated: true,
      }),
    ).toEqual({ label: "Retirer mon équipe", byCommissioner: false });
  });

  it("un simple visiteur ne voit rien", () => {
    expect(participantRemovalAction(BASE)).toBeNull();
  });
});

describe("participantRemovalConfirm", () => {
  it("nomme l'équipe et son coach, rappelle les résultats acquis et la notification", () => {
    const text = participantRemovalConfirm({
      teamName: "Les Rats",
      coachName: "Skritch",
      byCommissioner: true,
      cupStarted: true,
    });
    expect(text).toContain("« Les Rats » de Skritch");
    expect(text).toContain("restent au classement");
    expect(text).toContain("notification");
  });

  it("reste court pour un coach qui retire son équipe avant le début", () => {
    expect(
      participantRemovalConfirm({
        teamName: "Les Rats",
        coachName: "Skritch",
        byCommissioner: false,
        cupStarted: false,
      }),
    ).toBe("Retirer votre équipe « Les Rats » de la coupe ?");
  });
});
