/**
 * Jeu de données des captures avant / après de la parité ligue ↔ coupe
 * (change OpenSpec `cup-league-parity`). Rejoué contre un serveur de test
 * (`TEST_SQLITE=1`) de CHAQUE version — il n'emploie que des routes communes
 * aux deux ; les pronostics, absents avant, y échouent sans bruit (404).
 *
 *   API_PORT=18002 SHOTS_OUT=/tmp/seed-apres npx tsx before-after/seed.ts
 *
 * Écrit `ids.json` (coupes, rencontres, jetons) et la feuille de la coupe
 * NAF (`naf-sheet.json`) que `capture.mjs` et le PDF consomment.
 */
import { writeFileSync } from "node:fs";
import { get, post, rawPatch, rawPost, rawPut, resetDb, unwrap } from "../../e2e-api/helpers/api";
import { seedAndLogin, createTeam } from "../../e2e-api/helpers/factories";

const OUT = process.env.SHOTS_OUT ?? ".";

interface Pairing {
  id: string;
  homeTeam: { id: string; ownerId: string };
  awayTeam: { id: string; ownerId: string } | null;
}
interface CupDTO {
  cup: { id: string; rounds: Array<{ id: string; pairings: Pairing[] }> };
}
interface Sheet {
  teams: {
    home: { teamId: string; players: Array<{ id: string }> };
    away: { teamId: string; players: Array<{ id: string }> };
  };
}

async function main(): Promise<void> {
  {
    await resetDb();
    await fetch(`${process.env.API_BASE ?? `http://localhost:${process.env.API_PORT}`}/__test/seed-rosters`, {
      method: "POST",
    });
    const names = ["Grukk", "Skritch", "Kroxi", "Snotling"];
    const coaches = await Promise.all(
      names.map((n) => seedAndLogin(`${n.toLowerCase()}@shots.test`, "pwd", n)),
    );
    const teamNames = ["Les Crânes Verts", "Rats du Gouffre", "Écailles d'Or", "Gobbos Furieux"];
    const rosters = ["orc", "skaven", "lizardmen", "orc"] as const;
    const teams = await Promise.all(
      coaches.map((c, i) => createTeam(c.userId, teamNames[i], rosters[i])),
    );
    const tokenOf = new Map(coaches.map((c) => [c.userId, c.token]));
    // La fixture pose une VE arbitraire : on la fait recalculer, comme après
    // une vraie création d'équipe.
    const recalc = (ownerToken: string, teamId: string) =>
      rawPost(`/team/${teamId}/recalculate`, ownerToken, {});
    for (let i = 0; i < 4; i++) await recalc(coaches[i].token, teams[i].teamId);
    const commish = coaches[0];

    // --- Coupe principale : une rencontre validée, une à valider. ---
    const { cup } = await post<{ cup: { id: string } }>("/cup", commish.token, {
      name: "Coupe du Chaos",
      ruleset: "season_3",
      sheetEntryMode: "full",
    });
    for (let i = 0; i < 4; i++) {
      await post(`/cup/${cup.id}/register`, coaches[i].token, { teamId: teams[i].teamId });
    }
    await post(`/cup/${cup.id}/validate`, commish.token, {});
    await post(`/cup/${cup.id}/rounds`, commish.token, { system: "random" });
    const detail = (await get<CupDTO>(`/cup/${cup.id}`, commish.token)).cup;
    const [p1, p2] = detail.rounds[0].pairings;

    // Pronostics (version « après » seulement : 404 avant).
    for (const c of coaches) {
      for (const [p, pick, h, a] of [
        [p1, "home", 2, 1],
        [p2, "away", 0, 1],
      ] as const) {
        const own = c.userId === p.homeTeam.ownerId || c.userId === p.awayTeam!.ownerId;
        if (!own) await rawPut(`/cup/pairings/${p.id}/prediction`, c.token, { pick, homeScore: h, awayScore: a });
      }
    }

    async function play(p: Pairing, home: number, away: number, validate: boolean) {
      const homeToken = tokenOf.get(p.homeTeam.ownerId)!;
      const awayToken = tokenOf.get(p.awayTeam!.ownerId)!;
      const base = `/cup/pairings/${p.id}/sheet`;
      await post(base, homeToken, {});
      const sheet = unwrap(await get<{ data: Sheet }>(base, homeToken));
      for (let i = 0; i < home; i++) {
        await post(`${base}/events`, homeToken, {
          kind: "touchdown",
          team: "home",
          actorPlayerId: sheet.teams.home.players[i].id,
        });
      }
      for (let i = 0; i < away; i++) {
        await post(`${base}/events`, homeToken, {
          kind: "touchdown",
          team: "away",
          actorPlayerId: sheet.teams.away.players[i].id,
        });
      }
      await post(`${base}/events`, homeToken, {
        kind: "casualty",
        team: "home",
        actorPlayerId: sheet.teams.home.players[2].id,
        targetPlayerId: sheet.teams.away.players[3].id,
        causeDetail: "block",
        injurySeverity: "badly_hurt",
      });
      await post(`${base}/submit`, homeToken, {});
      await post(`${base}/submit`, awayToken, {});
      if (validate) await post(`${base}/validate`, commish.token, {});
      return sheet;
    }
    await play(p1, 2, 1, true);
    await play(p2, 0, 1, false);

    // --- Coupe terminée : champion et Oracle. ---
    const autumnTeams = await Promise.all([
      createTeam(coaches[0].userId, "Crânes d'Automne", "orc"),
      createTeam(coaches[1].userId, "Rats d'Automne", "skaven"),
      createTeam(coaches[2].userId, "Écailles d'Automne", "lizardmen"),
    ]);
    const autumn = (
      await post<{ cup: { id: string } }>("/cup", commish.token, {
        name: "Coupe d'Automne",
        ruleset: "season_3",
        sheetEntryMode: "full",
        predictionsScope: "open",
      })
    ).cup;
    for (let i = 0; i < 3; i++) await recalc(coaches[i].token, autumnTeams[i].teamId);
    await post(`/cup/${autumn.id}/register`, coaches[0].token, { teamId: autumnTeams[0].teamId });
    await post(`/cup/${autumn.id}/register`, coaches[1].token, { teamId: autumnTeams[1].teamId });
    await post(`/cup/${autumn.id}/register`, coaches[2].token, { teamId: autumnTeams[2].teamId });
    await post(`/cup/${autumn.id}/validate`, commish.token, {});
    await post(`/cup/${autumn.id}/rounds`, commish.token, { system: "random" });
    const autumnPairing = (await get<CupDTO>(`/cup/${autumn.id}`, commish.token)).cup.rounds[0]
      .pairings.find((p) => p.awayTeam !== null)!;
    // Le coach exempt (membre) pronostique : il sera l'Oracle de la coupe.
    for (const c of coaches.slice(0, 3)) {
      if (c.userId === autumnPairing.homeTeam.ownerId || c.userId === autumnPairing.awayTeam!.ownerId) continue;
      await rawPut(`/cup/pairings/${autumnPairing.id}/prediction`, c.token, {
        pick: "home",
        homeScore: 2,
        awayScore: 0,
      });
    }
    await play(autumnPairing, 2, 0, true);
    await rawPost(`/cup/${autumn.id}/status`, commish.token, { status: "terminee" });

    // --- Coupe NAF : coups de pouce achetés à la création (feuille PDF). ---
    const naf = (
      await post<{ cup: { id: string } }>("/cup", commish.token, {
        name: "Coupe NAF",
        ruleset: "season_3",
        format: "bb11",
        tournamentRuleset: "naf_world_cup_2027",
      })
    ).cup;
    const build = (coach: { token: string }, name: string, extra: Record<string, unknown>) =>
      post<{ data: { team: { id: string } } }>("/team/build", coach.token, {
        name,
        roster: "goblin",
        ruleset: "season_3",
        format: "bb11",
        cupId: naf.id,
        regionalLeague: "badlands_brawl",
        choices: [{ key: "goblin_gobelin", count: 11 }],
        ...extra,
      });
    await build(coaches[0], "Les Chapardeurs", {
      starPlayers: ["scrappa_sorehead"],
      inducements: [
        { slug: "bribe", quantity: 2 },
        { slug: "team_mascot", quantity: 1 },
      ],
    });
    await build(coaches[1], "Les Fouineurs", {});
    await post(`/cup/${naf.id}/validate`, commish.token, {});
    await post(`/cup/${naf.id}/rounds`, commish.token, { system: "random" });
    const nafPairing = (await get<CupDTO>(`/cup/${naf.id}`, commish.token)).cup.rounds[0]
      .pairings[0];
    const nafHome = tokenOf.get(nafPairing.homeTeam.ownerId)!;
    await post(`/cup/pairings/${nafPairing.id}/sheet`, nafHome, {});
    await rawPatch(`/cup/pairings/${nafPairing.id}/sheet/pre-match`, nafHome, {
      popularityHome: 3,
      inducementsHome: [],
    });
    const nafSheet = unwrap(
      await get<{ data: unknown }>(`/cup/pairings/${nafPairing.id}/sheet`, nafHome),
    );
    writeFileSync(`${OUT}/naf-sheet.json`, JSON.stringify(nafSheet, null, 1));

    // --- Ligue : coups de pouce d'avant-match (feuille PDF). ---
    const league = unwrap(
      await post<{ data: { id: string } }>("/leagues", commish.token, {
        name: "Ligue du Gouffre",
        maxParticipants: 4,
      }),
    );
    const season = unwrap(
      await post<{ data: { id: string } }>(`/leagues/${league.id}/seasons`, commish.token, {
        name: "Saison 1",
      }),
    );
    const leagueTeams = await Promise.all([
      createTeam(coaches[0].userId, "Skavens du Gouffre", "skaven"),
      createTeam(coaches[1].userId, "Lézards du Gouffre", "lizardmen"),
    ]);
    for (let i = 0; i < 2; i++) {
      await recalc(coaches[i].token, leagueTeams[i].teamId);
      await post(`/leagues/seasons/${season.id}/join`, coaches[i].token, {
        teamId: leagueTeams[i].teamId,
      });
    }
    await post(`/leagues/seasons/${season.id}/start`, commish.token, {});
    const seasonView = unwrap(
      await get<{
        data: {
          season: {
            rounds: Array<{
              pairings: Array<{
                id: string;
                homeParticipant: { team: { id: string; ownerId: string } };
              }>;
            }>;
          };
        };
      }>(`/leagues/seasons/${season.id}`, commish.token),
    );
    const leaguePairing = seasonView.season.rounds[0].pairings[0];
    const leagueHome = tokenOf.get(leaguePairing.homeParticipant.team.ownerId)!;
    // Mécène : le budget d'avant-match couvre un Star Player.
    await rawPatch(`/leagues/seasons/${season.id}/config`, commish.token, { meceneEnabled: true });
    await rawPost(
      `/leagues/seasons/${season.id}/teams/${leaguePairing.homeParticipant.team.id}/mecene`,
      leagueHome,
      {},
    );
    const leagueSheetPath = `/leagues/pairings/${leaguePairing.id}/sheet`;
    await post(leagueSheetPath, leagueHome, {});
    const opened = unwrap(
      await get<{
        data: {
          reference: {
            inducements: { home: Array<{ slug: string; name: string; cost: number }> };
          };
        };
      }>(leagueSheetPath, leagueHome),
    );
    await rawPatch(`${leagueSheetPath}/pre-match`, leagueHome, {
      inducementsHome: [
        {
          slug: "star_player",
          starPlayerSlug: "cindy_piewhistle",
          name: "Cindy Piewhistle",
          cost: 50000,
          qty: 1,
        },
        ...opened.reference.inducements.home
          .slice(0, 2)
          .map((o) => ({ slug: o.slug, name: o.name, cost: o.cost, qty: 1 })),
      ],
    });
    writeFileSync(
      `${OUT}/league-sheet.json`,
      JSON.stringify(unwrap(await get<{ data: unknown }>(leagueSheetPath, leagueHome)), null, 1),
    );

    const spectator = await seedAndLogin("tribune@shots.test", "pwd", "Tribune");
    writeFileSync(
      `${OUT}/ids.json`,
      JSON.stringify(
        {
          cupId: cup.id,
          autumnId: autumn.id,
          nafId: naf.id,
          p1: p1.id,
          p2: p2.id,
          commishToken: commish.token,
          spectatorToken: spectator.token,
          coachTokens: coaches.map((c) => c.token),
          teams: teams.map((t) => t.teamId),
          p1Home: p1.homeTeam.id,
        },
        null,
        1,
      ),
    );
  }
}

await main();
