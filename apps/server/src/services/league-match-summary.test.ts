/**
 * Lot G — Tests du summarizer pur `summarizeMatchSheet`.
 */

import { describe, it, expect } from "vitest";
import {
  summarizeMatchSheet,
  eliminationEarnsSpp,
  isMatchEventKind,
  computeMatchWinnings,
  computeStalledTeams,
  NO_STALLING_BONUS,
  WINNINGS_PER_POPULARITY,
  MATCH_EVENT_KINDS,
  type MatchEventInput,
} from "./league-match-summary";

describe("Lot G — summarizeMatchSheet", () => {
  it("empty events -> zero summary", () => {
    const out = summarizeMatchSheet([]);
    expect(out).toEqual({
      scoreHome: 0,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
      injuries: [],
      playerStats: [],
    });
  });

  it("counts touchdowns per team and per player", () => {
    const events: MatchEventInput[] = [
      { kind: "touchdown", team: "home", actorPlayerId: "h1" },
      { kind: "touchdown", team: "home", actorPlayerId: "h1" },
      { kind: "touchdown", team: "away", actorPlayerId: "a1" },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.scoreHome).toBe(2);
    expect(out.scoreAway).toBe(1);
    const h1 = out.playerStats.find((p) => p.playerId === "h1");
    expect(h1?.touchdowns).toBe(2);
    const a1 = out.playerStats.find((p) => p.playerId === "a1");
    expect(a1?.touchdowns).toBe(1);
  });

  it("counts casualties inflicted and injured player on opposite side (block)", () => {
    const events: MatchEventInput[] = [
      {
        kind: "casualty",
        team: "home",
        actorPlayerId: "h1",
        targetPlayerId: "a5",
        causeDetail: "block",
        injurySeverity: "dead",
      },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.casualtiesHome).toBe(1);
    expect(out.casualtiesAway).toBe(0);
    expect(out.injuries).toHaveLength(1);
    expect(out.injuries[0]).toEqual({
      playerId: "a5",
      severity: "dead",
      side: "away", // victim is opposite of the actor's team
      cause: "block",
      // L'auteur de la sortie : X de Haine (X) se lit sur lui.
      causedByPlayerId: "h1",
    });
    const h1 = out.playerStats.find((p) => p.playerId === "h1");
    expect(h1?.casualtiesInflicted).toBe(1);
  });

  it("other_elim (failed dodge) injures a player on the SAME team (self-cause)", () => {
    const events: MatchEventInput[] = [
      {
        kind: "other_elim",
        team: "home",
        targetPlayerId: "h7",
        causeDetail: "failed_dodge",
        injurySeverity: "badly_hurt",
      },
    ];
    const out = summarizeMatchSheet(events);
    // self-cause: counts as a casualty "for" home? No — it's an
    // elimination but not inflicted by the opponent. We still tally
    // it under the team that owns the event for casualty count.
    expect(out.injuries).toHaveLength(1);
    expect(out.injuries[0]).toEqual({
      playerId: "h7",
      severity: "badly_hurt",
      side: "home", // self-cause: victim is in `team`
      cause: "failed_dodge",
      // Auto-elimination : personne a hair.
      causedByPlayerId: null,
    });
  });

  it("A62 — other_elim sans cible : victime = acteur, rien d'infligé", () => {
    const events: MatchEventInput[] = [
      {
        kind: "other_elim",
        team: "home",
        actorPlayerId: "h7",
        injurySeverity: "mng",
      },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.injuries).toEqual([
      {
        playerId: "h7",
        severity: "mng",
        side: "home",
        cause: "other_elim",
        causedByPlayerId: null,
      },
    ]);
    // Auto-élimination : aucun compteur d'élimination infligée (ni équipe
    // ni joueur — donc pas de SPP indus).
    expect(out.casualtiesHome).toBe(0);
    expect(out.casualtiesAway).toBe(0);
    const h7 = out.playerStats.find((p) => p.playerId === "h7");
    expect(h7?.casualtiesInflicted ?? 0).toBe(0);
  });

  it("stalling avec blessure : victime = acteur (auto-élimination), rien d'infligé", () => {
    const events: MatchEventInput[] = [
      {
        kind: "stalling",
        team: "home",
        actorPlayerId: "h4",
        injurySeverity: "mng",
      },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.injuries).toEqual([
      {
        playerId: "h4",
        severity: "mng",
        side: "home",
        cause: "stalling",
        causedByPlayerId: null,
      },
    ]);
    // Comme other_elim : aucun compteur d'élimination infligée (ni équipe
    // ni joueur — donc pas de SPP indus).
    expect(out.casualtiesHome).toBe(0);
    expect(out.casualtiesAway).toBe(0);
    const h4 = out.playerStats.find((p) => p.playerId === "h4");
    expect(h4?.casualtiesInflicted ?? 0).toBe(0);
  });

  it("stalling avec Séquelle : la blessure porte la gravité stat_loss", () => {
    const events: MatchEventInput[] = [
      {
        kind: "stalling",
        team: "away",
        actorPlayerId: "a9",
        injurySeverity: "stat_loss",
      },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.injuries).toEqual([
      {
        playerId: "a9",
        severity: "stat_loss",
        side: "away",
        cause: "stalling",
        causedByPlayerId: null,
      },
    ]);
  });

  it("agression : l'auteur de la sortie est trace (source du X de Haine)", () => {
    const out = summarizeMatchSheet([
      {
        kind: "aggression",
        team: "away",
        actorPlayerId: "a3",
        targetPlayerId: "h2",
        injurySeverity: "niggling",
      },
    ]);
    expect(out.injuries[0]).toMatchObject({
      playerId: "h2",
      side: "home",
      causedByPlayerId: "a3",
    });
  });

  it("foule : sortie sans auteur, donc personne a hair", () => {
    const out = summarizeMatchSheet([
      {
        kind: "crowd_surge",
        team: "home",
        targetPlayerId: "a4",
        injurySeverity: "mng",
      },
    ]);
    expect(out.injuries[0]).toMatchObject({
      playerId: "a4",
      causedByPlayerId: null,
    });
  });

  it("stalling sans blessure : aucun impact score/casualty/blessures", () => {
    const events: MatchEventInput[] = [
      { kind: "stalling", team: "home", actorPlayerId: "h4" },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.injuries).toEqual([]);
    expect(out.casualtiesHome).toBe(0);
    expect(out.casualtiesAway).toBe(0);
    expect(out.scoreHome).toBe(0);
  });

  // Une agression est une agression : elle compte dans la colonne Agr, sa
  // blessure est consignée, mais elle ne rapporte aucun PSP — donc elle
  // n'est PAS une sortie (ni pour l'équipe, ni pour le joueur). Bug
  // observé : un match à 4 sorties + 1 agression affichait 5 sorties.
  it("agression qui blesse : comptée en agressions, jamais en sorties", () => {
    const events: MatchEventInput[] = [
      { kind: "aggression", team: "away", actorPlayerId: "a3" },
      {
        kind: "aggression",
        team: "away",
        actorPlayerId: "a3",
        targetPlayerId: "h2",
        causeDetail: "foul",
        injurySeverity: "mng",
      },
    ];
    const out = summarizeMatchSheet(events);
    const a3 = out.playerStats.find((p) => p.playerId === "a3");
    expect(a3?.aggressions).toBe(2);
    expect(a3?.casualtiesInflicted).toBe(0);
    expect(out.casualtiesAway).toBe(0);
    expect(out.casualtiesHome).toBe(0);
    // La victime est bien blessée, et sait qui l'a agressée (Haine).
    expect(out.injuries).toEqual([
      {
        playerId: "h2",
        severity: "mng",
        side: "home",
        cause: "foul",
        causedByPlayerId: "a3",
      },
    ]);
  });

  it("4 éliminations sur blocage + 1 agression = 4 sorties", () => {
    const block = (n: number): MatchEventInput => ({
      kind: "casualty",
      team: "home",
      actorPlayerId: `h${n}`,
      targetPlayerId: `a${n}`,
      causeDetail: "block",
      injurySeverity: "badly_hurt",
    });
    const out = summarizeMatchSheet([
      block(1),
      block(2),
      block(3),
      block(4),
      {
        kind: "aggression",
        team: "home",
        actorPlayerId: "h5",
        targetPlayerId: "a5",
        injurySeverity: "mng",
      },
    ]);
    expect(out.casualtiesHome).toBe(4);
    // Les 5 joueurs adverses sont bien blessés.
    expect(out.injuries).toHaveLength(5);
    expect(out.playerStats.find((p) => p.playerId === "h5")).toMatchObject({
      aggressions: 1,
      casualtiesInflicted: 0,
    });
  });

  // Prière à Nuffle 13 « Frénésie d'Agression » : une Élimination infligée
  // lors d'une Action d'Agression rapporte les PSP d'Élimination — elle
  // devient donc une sortie, pour l'équipe bénie seulement.
  describe("agression sous « Frénésie d'Agression »", () => {
    const foulHome: MatchEventInput = {
      kind: "aggression",
      team: "home",
      actorPlayerId: "h5",
      targetPlayerId: "a5",
      injurySeverity: "mng",
    };
    const foulAway: MatchEventInput = {
      kind: "aggression",
      team: "away",
      actorPlayerId: "a3",
      targetPlayerId: "h2",
      injurySeverity: "badly_hurt",
    };

    it("le côté béni crédite la sortie et les PSP, l'autre non", () => {
      const out = summarizeMatchSheet([foulHome, foulAway], {
        foulingFrenzy: { home: true },
      });
      expect(out.casualtiesHome).toBe(1);
      expect(out.casualtiesAway).toBe(0);
      expect(out.playerStats.find((p) => p.playerId === "h5")).toMatchObject({
        aggressions: 1,
        casualtiesInflicted: 1,
      });
      expect(out.playerStats.find((p) => p.playerId === "a3")).toMatchObject({
        aggressions: 1,
        casualtiesInflicted: 0,
      });
      // Les deux victimes sont blessées dans tous les cas.
      expect(out.injuries.map((i) => i.playerId)).toEqual(["a5", "h2"]);
    });

    it("une agression SANS blessure ne devient pas une sortie", () => {
      const out = summarizeMatchSheet(
        [{ kind: "aggression", team: "home", actorPlayerId: "h5" }],
        { foulingFrenzy: { home: true } },
      );
      expect(out.casualtiesHome).toBe(0);
      expect(out.playerStats.find((p) => p.playerId === "h5")).toMatchObject({
        aggressions: 1,
        casualtiesInflicted: 0,
      });
    });
  });

  it("crowd_surge injures without crediting a player (no actor stat)", () => {
    const events: MatchEventInput[] = [
      {
        kind: "crowd_surge",
        team: "home",
        targetPlayerId: "a9",
        causeDetail: "crowd",
        injurySeverity: "stat_loss",
      },
    ];
    const out = summarizeMatchSheet(events);
    // Une sortie par le public ne rapporte aucun PSP : elle ne compte pas
    // comme sortie de l'équipe (elle a sa propre colonne, SP).
    expect(out.casualtiesHome).toBe(0);
    // no actor -> no playerStats entry
    expect(out.playerStats).toHaveLength(0);
    expect(out.injuries[0]).toMatchObject({
      playerId: "a9",
      side: "away",
      severity: "stat_loss",
    });
  });

  it("counts completions and interceptions", () => {
    const events: MatchEventInput[] = [
      { kind: "pass_complete", team: "home", actorPlayerId: "h4" },
      { kind: "pass_complete", team: "home", actorPlayerId: "h4" },
      { kind: "interception", team: "away", actorPlayerId: "a8" },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.playerStats.find((p) => p.playerId === "h4")?.completions).toBe(2);
    expect(
      out.playerStats.find((p) => p.playerId === "a8")?.interceptions,
    ).toBe(1);
  });

  // FDM — le réceptionneur d'une passe réussie. Il est saisi dans
  // `targetPlayerId`, mais contrairement à toutes les autres cibles du
  // journal il est dans la MÊME équipe que l'acteur. Sans lui, rien ne
  // permettait d'attribuer la Prière à Nuffle « Réception Étourdissante »
  // (D16 = 11 : 1 PSP à qui réceptionne le ballon sur une Action de Passe).
  describe("pass_complete — réceptionneur", () => {
    it("crédite la Réussite au lanceur et la réception au coéquipier", () => {
      const events: MatchEventInput[] = [
        {
          kind: "pass_complete",
          team: "home",
          actorPlayerId: "h_thrower",
          targetPlayerId: "h_catcher",
        },
      ];
      const out = summarizeMatchSheet(events);
      const thrower = out.playerStats.find((p) => p.playerId === "h_thrower");
      const catcher = out.playerStats.find((p) => p.playerId === "h_catcher");
      expect(thrower?.completions).toBe(1);
      expect(thrower?.receptions).toBe(0);
      // Le réceptionneur ne marque PAS la Réussite (elle revient au
      // lanceur) : sans Prière à Nuffle, sa ligne ne rapporte aucun PSP.
      expect(catcher?.completions).toBe(0);
      expect(catcher?.receptions).toBe(1);
      expect(catcher?.touchdowns).toBe(0);
      expect(catcher?.casualtiesInflicted).toBe(0);
      expect(catcher?.interceptions).toBe(0);
    });

    it("range le réceptionneur dans l'équipe du lanceur, pas chez l'adversaire", () => {
      const out = summarizeMatchSheet([
        {
          kind: "pass_complete",
          team: "away",
          actorPlayerId: "a_thrower",
          targetPlayerId: "a_catcher",
        },
      ]);
      expect(out.playerStats.find((p) => p.playerId === "a_catcher")?.side).toBe(
        "away",
      );
      // Une passe ne blesse personne et ne change pas le score.
      expect(out.injuries).toEqual([]);
      expect(out.scoreAway).toBe(0);
      expect(out.casualtiesAway).toBe(0);
    });

    it("cumule les réceptions d'un même joueur sur plusieurs passes", () => {
      const out = summarizeMatchSheet([
        {
          kind: "pass_complete",
          team: "home",
          actorPlayerId: "h1",
          targetPlayerId: "h9",
        },
        {
          kind: "pass_complete",
          team: "home",
          actorPlayerId: "h2",
          targetPlayerId: "h9",
        },
      ]);
      const h9 = out.playerStats.find((p) => p.playerId === "h9");
      expect(h9?.receptions).toBe(2);
      expect(h9?.completions).toBe(0);
    });

    it("ignore un réceptionneur identique au lanceur (pas de double compte)", () => {
      const out = summarizeMatchSheet([
        {
          kind: "pass_complete",
          team: "home",
          actorPlayerId: "h4",
          targetPlayerId: "h4",
        },
      ]);
      const h4 = out.playerStats.find((p) => p.playerId === "h4");
      expect(h4?.completions).toBe(1);
      expect(h4?.receptions).toBe(0);
    });

    it("rétro-compat : une passe sans réceptionneur reste une Réussite seule", () => {
      const out = summarizeMatchSheet([
        { kind: "pass_complete", team: "home", actorPlayerId: "h4" },
      ]);
      expect(out.playerStats).toHaveLength(1);
      expect(out.playerStats[0]).toMatchObject({
        playerId: "h4",
        completions: 1,
        receptions: 0,
      });
    });

    it("compte la réception même si le lanceur n'est pas identifié", () => {
      const out = summarizeMatchSheet([
        { kind: "pass_complete", team: "home", targetPlayerId: "h9" },
      ]);
      expect(out.playerStats).toEqual([
        {
          playerId: "h9",
          side: "home",
          touchdowns: 0,
          casualtiesInflicted: 0,
          completions: 0,
          receptions: 1,
          interceptions: 0,
          aggressions: 0,
          ttmLandings: 0,
        },
      ]);
    });
  });

  it("ttm_landing : le coéquipier lancé (acteur) compte un atterrissage réussi", () => {
    const events: MatchEventInput[] = [
      { kind: "ttm_landing", team: "home", actorPlayerId: "h9" },
      { kind: "ttm_landing", team: "home", actorPlayerId: "h9" },
      // Le lancer lui-même (team_throw) reste sans effet sur les stats SPP.
      { kind: "team_throw", team: "home", actorPlayerId: "h5" },
    ];
    const out = summarizeMatchSheet(events);
    // Aucun impact score / casualties.
    expect(out.scoreHome).toBe(0);
    expect(out.casualtiesHome).toBe(0);
    const h9 = out.playerStats.find((p) => p.playerId === "h9");
    expect(h9?.ttmLandings).toBe(2);
    expect(out.playerStats.find((p) => p.playerId === "h5")).toBeUndefined();
  });

  // « Vol Fatal » — le joueur LANCÉ qui atterrit sur une case occupée et
  // plaque l'adversaire gagne les PSP d'Élimination si celui-ci sort.
  it("ttm_landing : PSP d'élimination réservés à Vol Fatal", () => {
    const events: MatchEventInput[] = [
      // h9 a Vol Fatal, h8 non.
      {
        kind: "ttm_landing",
        team: "home",
        actorPlayerId: "h9",
        targetPlayerId: "a5",
        injurySeverity: "dead",
      },
      {
        kind: "ttm_landing",
        team: "home",
        actorPlayerId: "h8",
        targetPlayerId: "a6",
        injurySeverity: "badly_hurt",
      },
    ];
    const out = summarizeMatchSheet(events, {
      fatalFlighters: new Set(["h9"]),
    });
    // Les 2 éliminations blessent la cible, mais seule celle qui rapporte
    // des PSP (Vol Fatal) compte comme sortie de l'équipe…
    expect(out.casualtiesHome).toBe(1);
    expect(out.injuries.map((i) => i.playerId)).toEqual(["a5", "a6"]);
    expect(out.injuries[0]?.side).toBe("away");
    expect(out.injuries[0]?.causedByPlayerId).toBe("h9");
    // …mais seul le porteur de Vol Fatal crédite des PSP d'Élimination.
    const h9 = out.playerStats.find((p) => p.playerId === "h9");
    const h8 = out.playerStats.find((p) => p.playerId === "h8");
    expect(h9?.casualtiesInflicted).toBe(1);
    expect(h8?.casualtiesInflicted).toBe(0);
    // L'atterrissage lui-même reste crédité aux deux (1 PSP chacun).
    expect(h9?.ttmLandings).toBe(1);
    expect(h8?.ttmLandings).toBe(1);
  });

  it("ttm_landing sans option : aucun PSP d'élimination crédité (défaut)", () => {
    const out = summarizeMatchSheet([
      {
        kind: "ttm_landing",
        team: "away",
        actorPlayerId: "a1",
        targetPlayerId: "h1",
        injurySeverity: "mng",
      },
    ]);
    expect(out.casualtiesAway).toBe(0);
    expect(out.injuries.map((i) => i.playerId)).toEqual(["h1"]);
    const a1 = out.playerStats.find((p) => p.playerId === "a1");
    expect(a1?.casualtiesInflicted).toBe(0);
    expect(a1?.ttmLandings).toBe(1);
  });

  it("ttm_landing sans gravité : atterrissage seul, aucune sortie", () => {
    const out = summarizeMatchSheet(
      [
        {
          kind: "ttm_landing",
          team: "home",
          actorPlayerId: "h9",
          targetPlayerId: "a5",
        },
      ],
      { fatalFlighters: new Set(["h9"]) },
    );
    expect(out.casualtiesHome).toBe(0);
    expect(out.injuries).toHaveLength(0);
    const h9 = out.playerStats.find((p) => p.playerId === "h9");
    expect(h9?.ttmLandings).toBe(1);
    expect(h9?.casualtiesInflicted).toBe(0);
  });

  it("special_elim : PSP d'élimination réservés à Innovateur Violent", () => {
    const events: MatchEventInput[] = [
      // h3 a Innovateur Violent, h4 non.
      {
        kind: "special_elim",
        team: "home",
        actorPlayerId: "h3",
        targetPlayerId: "a5",
        injurySeverity: "mng",
      },
      {
        kind: "special_elim",
        team: "home",
        actorPlayerId: "h4",
        targetPlayerId: "a6",
        injurySeverity: "badly_hurt",
      },
    ];
    const out = summarizeMatchSheet(events, {
      violentInnovators: new Set(["h3"]),
    });
    // Les 2 éliminations blessent la cible, mais seule celle d'Innovateur
    // Violent (la seule à rapporter des PSP) compte comme sortie…
    expect(out.casualtiesHome).toBe(1);
    expect(out.injuries.map((i) => i.playerId)).toEqual(["a5", "a6"]);
    expect(out.injuries[0]?.side).toBe("away");
    // …mais seule celle d'Innovateur Violent crédite des PSP.
    expect(
      out.playerStats.find((p) => p.playerId === "h3")?.casualtiesInflicted,
    ).toBe(1);
    expect(
      out.playerStats.find((p) => p.playerId === "h4")?.casualtiesInflicted,
    ).toBeUndefined();
  });

  it("special_elim sans option : aucun PSP crédité (défaut)", () => {
    const out = summarizeMatchSheet([
      {
        kind: "special_elim",
        team: "away",
        actorPlayerId: "a1",
        targetPlayerId: "h1",
        injurySeverity: "dead",
      },
    ]);
    expect(out.casualtiesAway).toBe(0);
    expect(out.injuries.map((i) => i.playerId)).toEqual(["h1"]);
    expect(out.playerStats.find((p) => p.playerId === "a1")).toBeUndefined();
  });

  it("special_elim sans gravité de blessure : ignoré", () => {
    const out = summarizeMatchSheet(
      [
        {
          kind: "special_elim",
          team: "home",
          actorPlayerId: "h3",
          targetPlayerId: "a5",
        },
      ],
      { violentInnovators: new Set(["h3"]) },
    );
    expect(out.casualtiesHome).toBe(0);
    expect(out.injuries).toHaveLength(0);
    expect(out.playerStats).toHaveLength(0);
  });

  it("ignores kickoff/expulsion/stalling for score and casualties", () => {
    const events: MatchEventInput[] = [
      { kind: "kickoff", team: "home" },
      { kind: "expulsion", team: "away", actorPlayerId: "a1" },
      { kind: "stalling", team: "home" },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.scoreHome).toBe(0);
    expect(out.scoreAway).toBe(0);
    expect(out.casualtiesHome).toBe(0);
    expect(out.injuries).toHaveLength(0);
  });

  it("ignores casualty with unknown severity (no injury recorded)", () => {
    const events: MatchEventInput[] = [
      {
        kind: "casualty",
        team: "home",
        actorPlayerId: "h1",
        targetPlayerId: "a5",
        injurySeverity: "scratch", // unknown
      },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.casualtiesHome).toBe(0);
    expect(out.injuries).toHaveLength(0);
  });

  it("is deterministic", () => {
    const events: MatchEventInput[] = [
      { kind: "touchdown", team: "home", actorPlayerId: "h1" },
      {
        kind: "casualty",
        team: "away",
        actorPlayerId: "a1",
        targetPlayerId: "h2",
        injurySeverity: "niggling",
        causeDetail: "block",
      },
    ];
    expect(summarizeMatchSheet(events)).toEqual(summarizeMatchSheet(events));
  });

  it("full match scenario", () => {
    const events: MatchEventInput[] = [
      { kind: "kickoff", team: "home" },
      { kind: "pass_complete", team: "home", actorPlayerId: "h_thrower" },
      { kind: "touchdown", team: "home", actorPlayerId: "h_catcher" },
      {
        kind: "casualty",
        team: "home",
        actorPlayerId: "h_blitz",
        targetPlayerId: "a_line",
        causeDetail: "block",
        injurySeverity: "dead",
      },
      { kind: "touchdown", team: "away", actorPlayerId: "a_runner" },
      { kind: "touchdown", team: "away", actorPlayerId: "a_runner" },
      {
        kind: "other_elim",
        team: "away",
        targetPlayerId: "a_gfi",
        causeDetail: "failed_gfi",
        injurySeverity: "badly_hurt",
      },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.scoreHome).toBe(1);
    expect(out.scoreAway).toBe(2);
    expect(out.casualtiesHome).toBe(1); // the block kill
    expect(out.injuries).toHaveLength(2);
    const runner = out.playerStats.find((p) => p.playerId === "a_runner");
    expect(runner?.touchdowns).toBe(2);
  });
});

// LA définition d'une sortie : une élimination qui rapporte des PSP. Tout ce
// qui compte des sorties (feuille, classement, bonus, cogneurs) en dérive.
describe("eliminationEarnsSpp", () => {
  const elim = (
    kind: MatchEventInput["kind"],
    extra: Partial<MatchEventInput> = {},
  ): MatchEventInput => ({
    kind,
    team: "home",
    actorPlayerId: "h1",
    targetPlayerId: "a1",
    injurySeverity: "mng",
    ...extra,
  });

  it("blocage : oui, sans option", () => {
    expect(eliminationEarnsSpp(elim("casualty"))).toBe(true);
    expect(eliminationEarnsSpp(elim("casualty", { causeDetail: "blitz" }))).toBe(
      true,
    );
    // Sans acteur, la sortie reste une sortie de l'équipe.
    expect(
      eliminationEarnsSpp(elim("casualty", { actorPlayerId: null })),
    ).toBe(true);
  });

  it("sans blessure : jamais", () => {
    expect(
      eliminationEarnsSpp(elim("casualty", { injurySeverity: null })),
    ).toBe(false);
    expect(
      eliminationEarnsSpp(elim("casualty", { injurySeverity: "scratch" })),
    ).toBe(false);
  });

  it("auto-éliminations et public : jamais", () => {
    expect(eliminationEarnsSpp(elim("other_elim"))).toBe(false);
    expect(eliminationEarnsSpp(elim("stalling"))).toBe(false);
    expect(eliminationEarnsSpp(elim("crowd_surge"))).toBe(false);
    expect(eliminationEarnsSpp(elim("casualty", { causeDetail: "self" }))).toBe(
      false,
    );
  });

  it("agression : seulement sous Frénésie d'Agression, pour SON côté", () => {
    expect(eliminationEarnsSpp(elim("aggression"))).toBe(false);
    expect(
      eliminationEarnsSpp(elim("aggression"), { foulingFrenzy: { home: true } }),
    ).toBe(true);
    expect(
      eliminationEarnsSpp(elim("aggression"), { foulingFrenzy: { away: true } }),
    ).toBe(false);
    expect(
      eliminationEarnsSpp(elim("aggression", { team: null }), {
        foulingFrenzy: { home: true, away: true },
      }),
    ).toBe(false);
  });

  it("action spéciale : seulement pour un Innovateur Violent", () => {
    expect(eliminationEarnsSpp(elim("special_elim"))).toBe(false);
    expect(
      eliminationEarnsSpp(elim("special_elim"), {
        violentInnovators: new Set(["h1"]),
      }),
    ).toBe(true);
    expect(
      eliminationEarnsSpp(elim("special_elim", { actorPlayerId: null }), {
        violentInnovators: new Set(["h1"]),
      }),
    ).toBe(false);
  });

  it("atterrissage sur un adversaire : seulement avec Vol Fatal", () => {
    expect(eliminationEarnsSpp(elim("ttm_landing"))).toBe(false);
    expect(
      eliminationEarnsSpp(elim("ttm_landing"), {
        fatalFlighters: new Set(["h1"]),
      }),
    ).toBe(true);
  });

  it("les évènements sans élimination ne rapportent rien", () => {
    for (const kind of [
      "kickoff",
      "touchdown",
      "pass_complete",
      "interception",
      "expulsion",
      "team_throw",
    ] as const) {
      expect(eliminationEarnsSpp(elim(kind)), kind).toBe(false);
    }
  });

  it("invariant : les sorties d'équipe sont la somme des sorties créditées", () => {
    const events: MatchEventInput[] = [
      elim("casualty"),
      elim("casualty", { team: "away", actorPlayerId: "a2", targetPlayerId: "h2" }),
      elim("aggression"),
      elim("aggression", { team: "away", actorPlayerId: "a3", targetPlayerId: "h3" }),
      elim("special_elim", { actorPlayerId: "h4" }),
      elim("special_elim", { actorPlayerId: "h5" }),
      elim("ttm_landing", { actorPlayerId: "h6" }),
      elim("crowd_surge", { actorPlayerId: null }),
      elim("other_elim", { actorPlayerId: "h7", targetPlayerId: null }),
    ];
    const options = {
      violentInnovators: new Set(["h4"]),
      fatalFlighters: new Set(["h6"]),
      foulingFrenzy: { away: true },
    };
    const out = summarizeMatchSheet(events, options);
    const sum = (side: "home" | "away") =>
      out.playerStats
        .filter((p) => p.side === side)
        .reduce((acc, p) => acc + p.casualtiesInflicted, 0);
    // home : blocage h1 + Innovateur Violent h4 + Vol Fatal h6 = 3.
    expect(out.casualtiesHome).toBe(3);
    expect(sum("home")).toBe(3);
    // away : blocage a2 + agression a3 sous Frénésie = 2.
    expect(out.casualtiesAway).toBe(2);
    expect(sum("away")).toBe(2);
    expect(
      events.filter((e) => eliminationEarnsSpp(e, options)).length,
    ).toBe(5);
    // Toutes les victimes sont blessées, sortie ou pas.
    expect(out.injuries).toHaveLength(9);
  });
});

describe("Lot G — isMatchEventKind / MATCH_EVENT_KINDS", () => {
  it("exposes 13 kinds", () => {
    expect(MATCH_EVENT_KINDS).toHaveLength(13);
  });
  it("validates known kinds", () => {
    expect(isMatchEventKind("touchdown")).toBe(true);
    expect(isMatchEventKind("crowd_surge")).toBe(true);
    // FR18 — La Catapulte : team_throw doit être accepté à la saisie
    // (régression : présent dans le type/Zod/UI mais absent du whitelist).
    expect(isMatchEventKind("team_throw")).toBe(true);
    // Atterrissage réussi (coéquipier lancé) : +1 PSP.
    expect(isMatchEventKind("ttm_landing")).toBe(true);
    expect(isMatchEventKind("nope")).toBe(false);
    expect(isMatchEventKind(42)).toBe(false);
  });
});

describe("A63 — computeMatchWinnings", () => {
  it("exemple du log QA : pop 3 et 2, score 2-1 -> 45k / 35k", () => {
    const w = computeMatchWinnings({
      popularityHome: 3,
      popularityAway: 2,
      scoreHome: 2,
      scoreAway: 1,
    });
    expect(w).toEqual({ home: 45_000, away: 35_000 });
  });
  it("partage la somme des popularités, TD par équipe", () => {
    const w = computeMatchWinnings({
      popularityHome: 4,
      popularityAway: 0,
      scoreHome: 0,
      scoreAway: 3,
    });
    expect(w).toEqual({
      home: 2 * WINNINGS_PER_POPULARITY,
      away: 2 * WINNINGS_PER_POPULARITY + 3 * WINNINGS_PER_POPULARITY,
    });
  });
  it("clampe négatifs/null/NaN à 0", () => {
    const w = computeMatchWinnings({
      popularityHome: -5,
      popularityAway: null,
      scoreHome: 0,
      scoreAway: 0,
    });
    expect(w).toEqual({ home: 0, away: 0 });
    const w2 = computeMatchWinnings({
      popularityHome: NaN,
      popularityAway: undefined,
      scoreHome: 1,
      scoreAway: 0,
    });
    expect(w2).toEqual({ home: 10_000, away: 0 });
  });
  it("somme impaire de popularités : division entière", () => {
    const w = computeMatchWinnings({
      popularityHome: 2,
      popularityAway: 1,
      scoreHome: 0,
      scoreAway: 0,
    });
    expect(w).toEqual({ home: 15_000, away: 15_000 });
  });
});

describe("Bonus « sans temporisation » — +10k si aucun event stalling", () => {
  it("bonifie chaque équipe qui n'a pas temporisé", () => {
    const w = computeMatchWinnings({
      popularityHome: 3,
      popularityAway: 2,
      scoreHome: 2,
      scoreAway: 1,
      stalledHome: false,
      stalledAway: false,
    });
    // Exemple du livre (45k / 35k) + 10k de bonus chacun.
    expect(w).toEqual({
      home: 45_000 + NO_STALLING_BONUS,
      away: 35_000 + NO_STALLING_BONUS,
    });
  });

  it("l'équipe qui a temporisé perd son bonus, pas l'autre", () => {
    const w = computeMatchWinnings({
      popularityHome: 0,
      popularityAway: 0,
      scoreHome: 0,
      scoreAway: 0,
      stalledHome: true,
      stalledAway: false,
    });
    expect(w).toEqual({ home: 0, away: NO_STALLING_BONUS });
  });

  it("flags omis (info inconnue) : formule historique sans bonus", () => {
    const w = computeMatchWinnings({
      popularityHome: 3,
      popularityAway: 2,
      scoreHome: 2,
      scoreAway: 1,
    });
    expect(w).toEqual({ home: 45_000, away: 35_000 });
  });
});

describe("computeStalledTeams — dérivation depuis les events", () => {
  it("détecte la temporisation par équipe", () => {
    const stalled = computeStalledTeams([
      { kind: "touchdown", team: "home" },
      { kind: "stalling", team: "home", actorPlayerId: "p1" },
      { kind: "kickoff" },
    ]);
    expect(stalled).toEqual({ home: true, away: false });
  });

  it("aucun event stalling : personne n'a temporisé", () => {
    const stalled = computeStalledTeams([
      { kind: "touchdown", team: "away" },
      { kind: "casualty", team: "home", injurySeverity: "mng" },
    ]);
    expect(stalled).toEqual({ home: false, away: false });
  });

  it("un event stalling sans team est ignoré (défensif)", () => {
    const stalled = computeStalledTeams([{ kind: "stalling", team: null }]);
    expect(stalled).toEqual({ home: false, away: false });
  });
});
