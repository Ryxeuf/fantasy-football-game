/**
 * E2E API — corrections de la feuille de match (FDM).
 *
 * Un seul parcours réel (2 coachs + commissaire, SQLite) pour verrouiller
 * quatre points que l'unitaire ne prouve pas de bout en bout :
 *
 *  - E45 : le RÉCEPTIONNEUR d'une passe gagne 1 PSP sous la Prière
 *    « Réception Étourdissante », et ce PSP est bien PERSISTÉ au roster ;
 *  - A156 : un Star Player engagé en coup de pouce est proposé comme
 *    acteur d'évènement (et son TD compte au score) ;
 *  - A138 : un journalier ayant joué le match est recrutable à l'étape
 *    EMBAUCHES, arrive sans Solitaire et garde ses PSP ;
 *  - E37 : le poste de chaque journalier se choisit indépendamment.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPatch, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface SheetPlayer {
  id: string;
  number: number;
  name: string;
  position: string;
  spp: number;
}
interface SheetJourneyman {
  id: string;
  number: number;
  name: string;
  position: string;
  positionName: string;
}
interface SheetSide {
  teamId: string;
  roster: string;
  players: SheetPlayer[];
  journeymen?: SheetJourneyman[];
  journeymenOptions?: Array<{ slug: string; name: string }>;
  journeymenChoices?: string[];
  starPlayersHired?: Array<{ id: string; name: string; slug: string }>;
}
interface SheetResponse {
  sheet: { status: string };
  summary: { scoreHome: number; scoreAway: number };
  teams: { home: SheetSide | null; away: SheetSide | null };
  computedSpp: Record<string, number>;
}
interface SeasonDetailDTO {
  season: {
    rounds: Array<{
      pairings: Array<{
        id: string;
        homeParticipant: { team: { id: string; ownerId: string } };
        awayParticipant: { team: { id: string; ownerId: string } };
      }>;
    }>;
  };
}
interface TeamDetailDTO {
  team: {
    treasury: number;
    players: Array<{
      id: string;
      name: string;
      position: string;
      spp: number;
      skills: string;
      dead: boolean;
      missNextMatch: boolean;
      nigglingInjuries: number;
      firedAt: string | null;
    }>;
  };
}

interface Ctx {
  seasonId: string;
  /** Jeton de chaque coach de la saison, par `ownerId` d'équipe. */
  tokensByUser: Map<string, string>;
  pairingId: string;
  homeToken: string;
  awayToken: string;
  commissionerToken: string;
  homeTeamId: string;
}

async function setupPairing(prefix: string): Promise<Ctx> {
  const alice = await seedAndLogin(`${prefix}-a@fdm.test`, "pwd", "Alice");
  const aliceTeam = await createTeam(
    alice.userId,
    `${prefix} Skavens`,
    "skaven",
  );
  const bob = await seedAndLogin(`${prefix}-b@fdm.test`, "pwd", "Bob");
  const bobTeam = await createTeam(
    bob.userId,
    `${prefix} Lizards`,
    "lizardmen",
  );
  const carol = await seedAndLogin(`${prefix}-c@fdm.test`, "pwd", "Carol");
  const carolTeam = await createTeam(carol.userId, `${prefix} Rats`, "skaven");
  const dan = await seedAndLogin(`${prefix}-d@fdm.test`, "pwd", "Dan");
  const danTeam = await createTeam(
    dan.userId,
    `${prefix} Sauriens`,
    "lizardmen",
  );

  const tokens = new Map([
    [alice.userId, alice.token],
    [bob.userId, bob.token],
    [carol.userId, carol.token],
    [dan.userId, dan.token],
  ]);

  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", alice.token, {
      name: `${prefix} FDM League`,
      maxParticipants: 4,
    }),
  );
  const season = unwrap(
    await post<{ data: { id: string } }>(
      `/leagues/${league.id}/seasons`,
      alice.token,
      { name: "S1" },
    ),
  );
  for (const [token, team] of [
    [alice.token, aliceTeam],
    [bob.token, bobTeam],
    [carol.token, carolTeam],
    [dan.token, danTeam],
  ] as const) {
    await post(`/leagues/seasons/${season.id}/join`, token, {
      teamId: team.teamId,
    });
  }
  await post(`/leagues/seasons/${season.id}/start`, alice.token, {});

  const detail = unwrap(
    await get<{ data: SeasonDetailDTO }>(
      `/leagues/seasons/${season.id}`,
      alice.token,
    ),
  );
  const pairing = detail.season.rounds[0].pairings[0];
  return {
    seasonId: season.id,
    tokensByUser: tokens,
    pairingId: pairing.id,
    homeToken: tokens.get(pairing.homeParticipant.team.ownerId)!,
    awayToken: tokens.get(pairing.awayParticipant.team.ownerId)!,
    commissionerToken: alice.token,
    homeTeamId: pairing.homeParticipant.team.id,
  };
}

const sheetUrl = (pairingId: string) => `/leagues/pairings/${pairingId}/sheet`;

/** Corps JSON d'une Response brute, pour des messages d'echec lisibles. */
async function bodyOf(res: Response): Promise<string> {
  try {
    return JSON.stringify(await res.clone().json());
  } catch {
    return res.statusText;
  }
}

describe("E2E API — corrections FDM", () => {
  beforeEach(async () => {
    await resetDb();
  });

  // E45 — le réceptionneur est saisi sur l'évènement de passe ; sans la
  // Prière il ne gagne rien (seul le lanceur marque la Réussite), avec elle
  // il gagne 1 PSP par réception.
  it("Réception Étourdissante : le réceptionneur gagne 1 PSP, persisté au roster", async () => {
    const ctx = await setupPairing("psp");
    const url = sheetUrl(ctx.pairingId);
    await post(url, ctx.homeToken, {});
    const opened = unwrap(
      await get<{ data: SheetResponse }>(url, ctx.homeToken),
    );
    const lanceur = opened.teams.home!.players[0];
    const receveur = opened.teams.home!.players[1];
    const sppAvant = receveur.spp;

    // La Prière n°11 (D16) est achetée en coup de pouce par le domicile.
    const pre = await rawPatch(`${url}/pre-match`, ctx.homeToken, {
      prayersHome: [{ roll: 11, prayerId: "stunning-catch" }],
    });
    expect(pre.status, await bodyOf(pre)).toBe(200);

    await post(`${url}/events`, ctx.homeToken, {
      kind: "pass_complete",
      team: "home",
      actorPlayerId: lanceur.id,
      targetPlayerId: receveur.id,
    });

    // Dès la lecture, le réceptionneur apparaît dans les PSP du match.
    const withPass = unwrap(
      await get<{ data: SheetResponse }>(url, ctx.homeToken),
    );
    expect(withPass.computedSpp[lanceur.id]).toBe(1); // la Réussite
    expect(withPass.computedSpp[receveur.id]).toBe(1); // la Prière

    await post(`${url}/submit`, ctx.homeToken, {});
    await post(`${url}/submit`, ctx.awayToken, {});
    await post(`${url}/validate`, ctx.commissionerToken, {});

    const team = unwrap(
      await get<{ data: TeamDetailDTO }>(
        `/team/${ctx.homeTeamId}`,
        ctx.homeToken,
      ),
    ).team;
    const receveurApres = team.players.find((p) => p.id === receveur.id)!;
    expect(receveurApres.spp).toBe(sppAvant + 1);
  });

  it("sans la Prière, le réceptionneur ne gagne aucun PSP", async () => {
    const ctx = await setupPairing("nopsp");
    const url = sheetUrl(ctx.pairingId);
    await post(url, ctx.homeToken, {});
    const opened = unwrap(
      await get<{ data: SheetResponse }>(url, ctx.homeToken),
    );
    const lanceur = opened.teams.home!.players[0];
    const receveur = opened.teams.home!.players[1];

    await post(`${url}/events`, ctx.homeToken, {
      kind: "pass_complete",
      team: "home",
      actorPlayerId: lanceur.id,
      targetPlayerId: receveur.id,
    });

    const after = unwrap(
      await get<{ data: SheetResponse }>(url, ctx.homeToken),
    );
    expect(after.computedSpp[lanceur.id]).toBe(1);
    expect(after.computedSpp[receveur.id] ?? 0).toBe(0);
  });

  it("on ne réceptionne pas sa propre passe", async () => {
    const ctx = await setupPairing("self");
    const url = sheetUrl(ctx.pairingId);
    await post(url, ctx.homeToken, {});
    const opened = unwrap(
      await get<{ data: SheetResponse }>(url, ctx.homeToken),
    );
    const p = opened.teams.home!.players[0];
    const res = await rawPost(`${url}/events`, ctx.homeToken, {
      kind: "pass_complete",
      team: "home",
      actorPlayerId: p.id,
      targetPlayerId: p.id,
    });
    expect(res.status).toBe(400);
  });

  // A156 — un Star Player engagé JOUE le match : il doit être proposé aux
  // évènements, donc figurer dans la charge utile de la feuille.
  it("un Star Player engagé est exposé comme joueur de la feuille et peut marquer", async () => {
    const ctx = await setupPairing("star");
    const url = sheetUrl(ctx.pairingId);

    // Le budget de coups de pouce est borné par petty cash + trésorerie, et
    // la trésorerie est FIGÉE à l'ouverture de la feuille : le « coup de
    // mécène » (100 000 po) se joue donc AVANT de l'ouvrir.
    const mecene = await rawPatch(
      `/leagues/seasons/${ctx.seasonId}/config`,
      ctx.commissionerToken,
      { meceneEnabled: true },
    );
    expect(mecene.status, await bodyOf(mecene)).toBe(200);
    const played = await rawPost(
      `/leagues/seasons/${ctx.seasonId}/teams/${ctx.homeTeamId}/mecene`,
      ctx.homeToken,
      {},
    );
    expect(played.status, await bodyOf(played)).toBe(200);

    await post(url, ctx.homeToken, {});
    const pre = await rawPatch(`${url}/pre-match`, ctx.homeToken, {
      inducementsHome: [
        {
          slug: "star_player",
          starPlayerSlug: "cindy_piewhistle",
          name: "Cindy Piewhistle",
          cost: 50000,
          qty: 1,
        },
      ],
    });
    expect(pre.status, await bodyOf(pre)).toBe(200);

    const withStar = unwrap(
      await get<{ data: SheetResponse }>(url, ctx.homeToken),
    );
    const stars = withStar.teams.home!.starPlayersHired ?? [];
    expect(stars.length, "le Star Player doit être exposé").toBe(1);
    expect(stars[0].id).toBe("star-home-cindy_piewhistle");

    // Il est accepté comme acteur d'évènement (aucune FK sur le joueur).
    const ev = await rawPost(`${url}/events`, ctx.homeToken, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: stars[0].id,
    });
    expect(ev.status, await bodyOf(ev)).toBe(201);

    const after = unwrap(
      await get<{ data: SheetResponse }>(url, ctx.homeToken),
    );
    expect(after.summary.scoreHome).toBe(1);
  });
  // A138 + E37 — journaliers : une équipe qui aligne moins de 11 joueurs
  // disponibles en engage un par joueur manquant. Le roster d'une équipe
  // engagée est verrouillé : on passe donc par le chemin RÉEL, deux
  // blessures « rate le prochain match » infligées lors du match précédent.
  describe("journaliers", () => {
    /**
     * Joue le pairing de round 1 du domicile en blessant `count` de ses
     * joueurs (severité `mng`), puis renvoie le pairing du round SUIVANT
     * où cette équipe rejoue.
     */
    async function pairingAfterInjuries(
      prefix: string,
      count: number,
    ): Promise<{
      ctx: Ctx;
      nextPairingId: string;
      nextHomeToken: string;
      nextAwayToken: string;
      injured: string[];
    }> {
      const ctx = await setupPairing(prefix);
      const url = sheetUrl(ctx.pairingId);
      await post(url, ctx.homeToken, {});
      const opened = unwrap(
        await get<{ data: SheetResponse }>(url, ctx.homeToken),
      );
      const victims = opened.teams.home!.players.slice(0, count);
      for (const victim of victims) {
        // L'extérieur élimine un joueur du domicile : il rate le match suivant.
        const res = await rawPost(`${url}/events`, ctx.awayToken, {
          kind: "casualty",
          team: "away",
          actorPlayerId: opened.teams.away!.players[0].id,
          targetPlayerId: victim.id,
          injurySeverity: "mng",
        });
        expect(res.status, await bodyOf(res)).toBe(201);
      }
      await post(`${url}/submit`, ctx.homeToken, {});
      await post(`${url}/submit`, ctx.awayToken, {});
      await post(`${url}/validate`, ctx.commissionerToken, {});

      const detail = unwrap(
        await get<{ data: SeasonDetailDTO }>(
          `/leagues/seasons/${ctx.seasonId}`,
          ctx.commissionerToken,
        ),
      );
      const next = detail.season.rounds
        .flatMap((r) => r.pairings)
        .find(
          (p) =>
            p.id !== ctx.pairingId &&
            (p.homeParticipant.team.id === ctx.homeTeamId ||
              p.awayParticipant.team.id === ctx.homeTeamId),
        );
      expect(next, "l'équipe blessée doit rejouer plus tard").toBeTruthy();
      return {
        ctx,
        nextPairingId: next!.id,
        // Le pairing suivant oppose d'AUTRES coachs : la soumission exige
        // les jetons de ses deux participants, pas ceux du premier match.
        nextHomeToken: ctx.tokensByUser.get(
          next!.homeParticipant.team.ownerId,
        )!,
        nextAwayToken: ctx.tokensByUser.get(
          next!.awayParticipant.team.ownerId,
        )!,
        injured: victims.map((v) => v.id),
      };
    }

    it("2 absents ⇒ 2 journaliers, dont le poste se choisit par rang (E37)", async () => {
      const { ctx, nextPairingId, nextHomeToken } = await pairingAfterInjuries(
        "jm-choice",
        2,
      );
      const url = sheetUrl(nextPairingId);
      await post(url, nextHomeToken, {});
      const opened = unwrap(
        await get<{ data: SheetResponse }>(url, nextHomeToken),
      );
      // L'équipe blessée peut être domicile OU extérieur sur ce pairing.
      const side =
        opened.teams.home?.teamId === ctx.homeTeamId ? "home" : "away";
      const team = side === "home" ? opened.teams.home! : opened.teams.away!;
      expect(team.journeymen?.length, "2 journaliers attendus").toBe(2);

      const options = team.journeymenOptions ?? [];
      expect(options.length).toBeGreaterThan(0);
      const slug = options[0].slug;

      const patched = await rawPatch(`${url}/pre-match`, nextHomeToken, {
        [side === "home" ? "journeymenChoicesHome" : "journeymenChoicesAway"]: [
          slug,
          null,
        ],
      });
      expect(patched.status, await bodyOf(patched)).toBe(200);

      const after = unwrap(
        await get<{ data: SheetResponse }>(url, nextHomeToken),
      );
      const teamAfter = side === "home" ? after.teams.home! : after.teams.away!;
      // Le rang 0 porte le choix explicite, le rang 1 le défaut.
      expect(teamAfter.journeymenChoices).toEqual([slug, slug]);
    });

    it("un journalier du match est recrutable et garde ses PSP, sans Solitaire (A138)", async () => {
      const { ctx, nextPairingId, nextHomeToken, nextAwayToken } =
        await pairingAfterInjuries("jm-hire", 2);
      const url = sheetUrl(nextPairingId);
      await post(url, nextHomeToken, {});
      const opened = unwrap(
        await get<{ data: SheetResponse }>(url, nextHomeToken),
      );
      const side =
        opened.teams.home?.teamId === ctx.homeTeamId ? "home" : "away";
      const team = side === "home" ? opened.teams.home! : opened.teams.away!;
      const journeyman = team.journeymen![0];

      // Il marque : il gagne des PSP, qu'il conserve à l'embauche.
      await post(`${url}/events`, nextHomeToken, {
        kind: "touchdown",
        team: side,
        actorPlayerId: journeyman.id,
      });
      const scored = unwrap(
        await get<{ data: SheetResponse }>(url, nextHomeToken),
      );
      const earned = scored.computedSpp[journeyman.id];
      expect(earned).toBeGreaterThan(0);

      // Étape EMBAUCHES : le serveur recalcule le prix depuis le poste.
      const postRes = await rawPatch(`${url}/post-match`, nextHomeToken, {
        [side === "home" ? "winningsHomeManual" : "winningsAwayManual"]: 200000,
        [side === "home" ? "purchasesHome" : "purchasesAway"]: [
          {
            kind: "journeyman",
            name: journeyman.name,
            cost: 0,
            journeymanId: journeyman.id,
          },
        ],
      });
      expect(postRes.status, await bodyOf(postRes)).toBe(200);

      await post(`${url}/submit`, nextHomeToken, {});
      await post(`${url}/submit`, nextAwayToken, {});
      await post(`${url}/validate`, ctx.commissionerToken, {});

      const teamAfter = unwrap(
        await get<{ data: TeamDetailDTO }>(
          `/team/${ctx.homeTeamId}`,
          ctx.homeToken,
        ),
      ).team;
      const hired = teamAfter.players.find((p) => p.name === journeyman.name);
      expect(hired, "le journalier doit avoir rejoint le roster").toBeTruthy();
      // Il n'est plus journalier : Solitaire est retiré.
      expect(hired!.skills).not.toContain("loner");
      // Et il garde les PSP gagnés pendant la rencontre.
      expect(hired!.spp).toBe(earned);
    });
  });
});
