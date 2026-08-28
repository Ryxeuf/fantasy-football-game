/**
 * Haine (X) — acquisition du trait à la validation d'une feuille de match.
 *
 * Règle : un joueur sorti pour au moins le match suivant (Amoché, Blessure
 * Sérieuse, Séquelle) jette 1D6 ; sur 4+, il gagne « Haine (X) » où X est un
 * Mot-clé du joueur qui l'a éliminé. Les mots-clés de POSTE sont exclus
 * (cf. `@bb/game-engine` → `skills/hate-trait.ts`, 100 % pur).
 *
 * Ce trait ne se choisit JAMAIS à l'évolution : la compétence créée à la
 * volée porte `excludedFromSelection`, comme les trois variantes déjà au
 * catalogue (`hate`, `hate-troll`, `hate-dwarf`).
 *
 * Le trait est posé sur la CSV `TeamPlayer.skills`, pas dans
 * `advancements` : ce n'est pas une amélioration achetée, il ne coûte donc
 * rien en VE (le calcul de VE ne lit que `advancements`).
 *
 * Comme toute écriture d'après-match, l'octroi est REVERSIBLE : les grants
 * sont mémorisés dans le snapshot du match, et `revertHateTraitGrants` les
 * retire à l'invalidation de la feuille.
 */

import { prisma } from "../prisma";
import {
  KEYWORDS_SEASON3,
  buildHateSkillDefinition,
  getStarPlayerKeywords,
  hateRollSucceeds,
  hateSlugForKeyword,
  parseSkillSlugs,
  pickHateKeyword,
} from "@bb/game-engine";
import { serverLog } from "../utils/server-log";
import { invalidatePublicSkillsCache } from "../utils/skills-cache";
import {
  safeRecordTeamAudit,
  type TeamAuditPrismaLike,
} from "./team-audit";
import type { OfflineInjuryType } from "./league-offline-result";

/**
 * Blessures qui déclenchent le jet : celles qui rendent le joueur absent
 * au moins un match. La mort en est exclue — un joueur mort n'a plus de
 * match à jouer, donc personne à haïr.
 */
export const HATE_TRIGGERING_INJURIES: ReadonlySet<OfflineInjuryType> = new Set(
  ["mng", "niggling", "ma", "st", "ag", "pa", "av"],
);

/** Une blessure candidate, avant résolution du mot-clé. */
export interface HateInjuryInput {
  readonly victimPlayerId: string;
  readonly causerPlayerId: string | null;
  readonly injuryType: OfflineInjuryType;
}

/** Victime + mot-clé retenu : il ne reste plus qu'à jeter le D6. */
export interface HateCandidate {
  readonly victimPlayerId: string;
  readonly keyword: string;
}

/** Trait réellement accordé (mémorisé pour la réversion). */
export interface HateGrant {
  readonly playerId: string;
  readonly skillSlug: string;
  readonly keyword: string;
  readonly roll: number;
}

/**
 * Pourquoi un jet réussi n'a finalement rien accordé. `undefined` sur un
 * jet accordé ou simplement raté — l'UI n'a alors rien à expliquer.
 */
export type HateRollFailure = "skill-unavailable" | "write-failed";

/**
 * UN jet de D6 réellement lancé, accordé ou non.
 *
 * `granted` ne se déduit PAS de `roll >= 4` : un 4+ peut ne rien donner si
 * la compétence n'a pas pu être garantie au catalogue. L'UI doit dire la
 * vérité du dé ET celle de l'attribution, sinon un coach qui voit « 5 » sur
 * la feuille et rien sur la fiche du joueur croit à une perte de données.
 *
 * `playerName` est FIGÉ à l'écriture (même posture que `actorLabel` du
 * journal d'équipe) : le récapitulatif reste lisible même si le joueur est
 * mort, licencié ou renommé depuis.
 */
export interface HateRoll {
  readonly playerId: string;
  readonly playerName: string;
  readonly teamId: string;
  readonly keyword: string;
  readonly skillSlug: string;
  readonly roll: number;
  readonly granted: boolean;
  readonly failure?: HateRollFailure;
}

/**
 * PURE — candidats au jet de Haine.
 *
 * Écarte : les blessures qui ne coûtent pas le match suivant, les sorties
 * sans auteur (auto-élimination, foule), les auteurs dont on ne connaît pas
 * les mots-clés, et ceux qui n'ont que des mots-clés de poste.
 *
 * Un même joueur blessé deux fois par le même adversaire ne jette qu'une
 * fois pour ce mot-clé : on dédoublonne sur (victime, X).
 */
export function buildHateCandidates(input: {
  readonly injuries: readonly HateInjuryInput[];
  /** CSV de mots-clés par id de joueur (roster réel, journaliers, Stars). */
  readonly keywordsByPlayerId: ReadonlyMap<string, string>;
}): HateCandidate[] {
  const seen = new Set<string>();
  const out: HateCandidate[] = [];
  for (const inj of input.injuries) {
    if (!HATE_TRIGGERING_INJURIES.has(inj.injuryType)) continue;
    if (!inj.causerPlayerId) continue;
    const keyword = pickHateKeyword(
      input.keywordsByPlayerId.get(inj.causerPlayerId),
    );
    if (!keyword) continue;
    const dedupe = `${inj.victimPlayerId}::${keyword}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ victimPlayerId: inj.victimPlayerId, keyword });
  }
  return out;
}

/**
 * Mots-clés d'un Star Player engagé en coup de pouce, depuis son id
 * synthétique de feuille (`star-<side>-<slug>`). `null` hors de ce format.
 */
export function starKeywordsFromSheetId(playerId: string): string | null {
  const m = /^star-(?:home|away)-(.+)$/.exec(playerId);
  if (!m) return null;
  return getStarPlayerKeywords(m[1]);
}

/**
 * Mots-clés par slug de position — base d'abord, moteur en repli (même
 * posture que `effectiveRegionalRules` : la colonne `Position.keywords`
 * est éditable en admin, `KEYWORDS_SEASON3` en est la transcription de
 * référence).
 */
export async function resolveKeywordsByPosition(
  positionSlugs: readonly string[],
): Promise<Map<string, string>> {
  const slugs = [...new Set(positionSlugs.filter((s) => s.length > 0))];
  const out = new Map<string, string>();
  for (const slug of slugs) {
    const fromEngine = KEYWORDS_SEASON3[slug];
    if (fromEngine) out.set(slug, fromEngine);
  }
  if (slugs.length === 0) return out;
  try {
    const rows = (await prisma.position.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, keywords: true },
    })) as Array<{ slug: string; keywords: string | null }>;
    for (const r of rows) {
      if (r.keywords && r.keywords.trim().length > 0) {
        out.set(r.slug, r.keywords);
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.warn(
      `[league-hate-trait] lecture des mots-cles en base echouee, repli moteur: ${msg}`,
    );
  }
  return out;
}

/** Jet de D6 par défaut. Injectable pour rendre les tests déterministes. */
function rollD6(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/**
 * S'assure que la compétence `slug` existe pour ce ruleset, en la créant
 * depuis la définition dérivée du mot-clé si elle manque. Retourne `false`
 * si la compétence n'a pas pu être garantie (on n'octroie alors rien : un
 * slug orphelin ne s'afficherait nulle part).
 */
async function ensureHateSkill(
  slug: string,
  keyword: string,
  ruleset: string,
): Promise<boolean> {
  try {
    const existing = (await prisma.skill.findUnique({
      where: { slug_ruleset: { slug, ruleset: ruleset as never } },
      select: { id: true, excludedFromSelection: true },
    })) as { id: string; excludedFromSelection?: boolean } | null;
    if (existing) {
      // Auto-reparation : une ligne anterieure a la regle (ex. `hate-troll`
      // seede avant) pouvait rester selectionnable a l'evolution. Le seed
      // la corrige aussi, mais on n'attend pas le prochain deploiement.
      if (existing.excludedFromSelection === false) {
        await prisma.skill.update({
          where: { slug_ruleset: { slug, ruleset: ruleset as never } },
          data: { excludedFromSelection: true },
        });
      }
      return true;
    }
    const definition = buildHateSkillDefinition(keyword);
    if (!definition) return false;
    await prisma.skill.create({
      data: {
        slug: definition.slug,
        ruleset: ruleset as never,
        nameFr: definition.nameFr,
        nameEn: definition.nameEn,
        description: definition.description,
        descriptionEn: definition.descriptionEn ?? null,
        category: definition.category,
        isPassive: definition.isPassive ?? false,
        // Le trait ne s'obtient qu'en etant blesse : jamais proposé dans
        // la liste d'évolution.
        excludedFromSelection: true,
      },
    });
    // Le catalogue public est memoize 5 min : sans purge, le badge fraichement
    // pose s'afficherait en slug brut sur la fiche du joueur jusqu'a
    // expiration. Le trait vient d'apparaitre, il doit etre lisible tout de
    // suite.
    invalidatePublicSkillsCache();
    serverLog.info(
      `[league-hate-trait] trait cree slug=${slug} ruleset=${ruleset}`,
    );
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(
      `[league-hate-trait] creation du trait ${slug} echouee: ${msg}`,
    );
    return false;
  }
}

/**
 * Joue le jet de Haine pour chaque candidat et pose le trait sur 4+.
 *
 * Best-effort et idempotent par joueur : un joueur qui possède déjà
 * Haine (X) pour ce mot-clé ne rejette pas (il les hait déjà) ; un échec
 * unitaire est loggé sans faire échouer la validation de la feuille.
 */
export async function applyHateTraitAcquisitions(input: {
  readonly candidates: readonly HateCandidate[];
  /** Bornes de sécurité : les 2 équipes du match. */
  readonly allowedTeamIds: readonly string[];
  readonly roll?: () => number;
}): Promise<{ granted: HateGrant[]; rolls: HateRoll[] }> {
  const granted: HateGrant[] = [];
  /** Tous les D6 REELLEMENT lances (accordes ou non) — trace pour l'UI. */
  const rolls: HateRoll[] = [];
  if (input.candidates.length === 0) return { granted, rolls };
  const roll = input.roll ?? rollD6;

  const ids = [...new Set(input.candidates.map((c) => c.victimPlayerId))];
  const players = (await prisma.teamPlayer.findMany({
    where: { id: { in: ids }, teamId: { in: [...input.allowedTeamIds] } },
    select: {
      id: true,
      name: true,
      teamId: true,
      skills: true,
      dead: true,
      team: { select: { ruleset: true } },
    },
  })) as Array<{
    id: string;
    name: string | null;
    teamId: string;
    skills: string | null;
    dead: boolean;
    team: { ruleset: string | null } | null;
  }>;
  const byId = new Map(players.map((p) => [p.id, p]));
  /** Compétences courantes par joueur, mises à jour au fil des octrois. */
  const skillsById = new Map<string, string[]>(
    players.map((p) => [p.id, parseSkillSlugs(p.skills ?? "")]),
  );

  for (const candidate of input.candidates) {
    const player = byId.get(candidate.victimPlayerId);
    // Joueur hors des 2 équipes (id synthétique, saisie douteuse) ou mort
    // entre-temps : rien à faire.
    if (!player || player.dead) continue;
    const slug = hateSlugForKeyword(candidate.keyword);
    if (!slug) continue;
    const current = skillsById.get(player.id) ?? [];
    if (current.includes(slug)) continue;

    const value = roll();
    // Le D6 est lance : quoi qu'il advienne ensuite, la feuille doit le
    // montrer. `pushRoll` est donc appele sur TOUS les chemins de sortie.
    const pushRoll = (isGranted: boolean, failure?: HateRollFailure): void => {
      rolls.push({
        playerId: player.id,
        playerName: player.name ?? "",
        teamId: player.teamId,
        keyword: candidate.keyword,
        skillSlug: slug,
        roll: value,
        granted: isGranted,
        ...(failure ? { failure } : {}),
      });
    };
    if (!hateRollSucceeds(value)) {
      pushRoll(false);
      continue;
    }

    const ruleset = player.team?.ruleset ?? "season_3";
    if (!(await ensureHateSkill(slug, candidate.keyword, ruleset))) {
      // 4+ obtenu mais rien accorde : l'UI doit l'expliquer plutot que
      // d'afficher un jet reussi sans trait sur la fiche du joueur.
      pushRoll(false, "skill-unavailable");
      continue;
    }

    const next = [...current, slug];
    try {
      await prisma.teamPlayer.update({
        where: { id: player.id },
        data: { skills: next.join(",") },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(
        `[league-hate-trait] pose du trait ${slug} echouee player=${player.id}: ${msg}`,
      );
      pushRoll(false, "write-failed");
      continue;
    }
    pushRoll(true);
    skillsById.set(player.id, next);
    // Journal d'equipe : une competence qui apparait sur un joueur sans
    // que personne ne l'ait choisie est exactement ce qu'un coach vient
    // demander. Ni or ni VE ne bougent — l'etat resultant est recapture
    // par le journal.
    if (player.teamId) {
      await safeRecordTeamAudit(prisma as unknown as TeamAuditPrismaLike, {
        teamId: player.teamId,
        action: "team.player.hate_trait",
        entity: "TeamPlayer",
        entityId: player.id,
        details: {
          skillSlug: slug,
          keyword: candidate.keyword,
          roll: value,
          skillsBefore: current.join(","),
          skillsAfter: next.join(","),
        },
      });
    }
    granted.push({
      playerId: player.id,
      skillSlug: slug,
      keyword: candidate.keyword,
      roll: value,
    });
    serverLog.info(
      `[league-hate-trait] ${slug} accorde player=${player.id} (d6=${value})`,
    );
  }

  return { granted, rolls };
}

/**
 * Retire les traits de Haine accordés par un match invalidé. Best-effort :
 * un joueur introuvable ou dont le trait a déjà été retiré est ignoré.
 * Retourne le nombre de traits effectivement retirés.
 */
export async function revertHateTraitGrants(
  grants: readonly HateGrant[],
): Promise<number> {
  if (grants.length === 0) return 0;
  const ids = [...new Set(grants.map((g) => g.playerId))];
  let removed = 0;
  try {
    const players = (await prisma.teamPlayer.findMany({
      where: { id: { in: ids } },
      select: { id: true, teamId: true, skills: true },
    })) as Array<{ id: string; teamId: string; skills: string | null }>;
    const byId = new Map(players.map((p) => [p.id, parseSkillSlugs(p.skills ?? "")]));
    const teamById = new Map(players.map((p) => [p.id, p.teamId]));
    for (const grant of grants) {
      const current = byId.get(grant.playerId);
      if (!current || !current.includes(grant.skillSlug)) continue;
      const next = current.filter((s) => s !== grant.skillSlug);
      await prisma.teamPlayer.update({
        where: { id: grant.playerId },
        data: { skills: next.join(",") },
      });
      byId.set(grant.playerId, next);
      const teamId = teamById.get(grant.playerId);
      if (teamId) {
        await safeRecordTeamAudit(prisma as unknown as TeamAuditPrismaLike, {
          teamId,
          action: "team.player.hate_trait.reverted",
          entity: "TeamPlayer",
          entityId: grant.playerId,
          details: {
            skillSlug: grant.skillSlug,
            keyword: grant.keyword,
            skillsAfter: next.join(","),
          },
        });
      }
      removed += 1;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(
      `[league-hate-trait] reversion des traits de Haine echouee: ${msg}`,
    );
  }
  return removed;
}

/** Parse tolérant (array PG / string sqlite) des grants du snapshot. */
export function parseHateGrants(raw: unknown): HateGrant[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: HateGrant[] = [];
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    const playerId = (e as { playerId?: unknown }).playerId;
    const skillSlug = (e as { skillSlug?: unknown }).skillSlug;
    const keyword = (e as { keyword?: unknown }).keyword;
    const rollValue = (e as { roll?: unknown }).roll;
    if (typeof playerId !== "string" || typeof skillSlug !== "string") continue;
    out.push({
      playerId,
      skillSlug,
      keyword: typeof keyword === "string" ? keyword : "",
      roll: typeof rollValue === "number" ? rollValue : 0,
    });
  }
  return out;
}

/**
 * Parse tolérant (array PG / string sqlite) des jets du snapshot.
 *
 * Rétro-compat : un match validé AVANT ce champ n'a que `hateGranted`. On
 * en reconstitue les jets réussis (`granted: true`) pour que le récap ne
 * soit pas vide sur l'historique — les jets ratés d'alors sont perdus,
 * ils n'ont jamais été écrits.
 */
export function parseHateRolls(
  raw: unknown,
  fallbackGrants?: unknown,
): HateRoll[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = null;
    }
  }
  if (!Array.isArray(arr)) {
    return parseHateGrants(fallbackGrants).map((g) => ({
      playerId: g.playerId,
      playerName: "",
      teamId: "",
      keyword: g.keyword,
      skillSlug: g.skillSlug,
      roll: g.roll,
      granted: true,
    }));
  }
  const out: HateRoll[] = [];
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    if (typeof r.playerId !== "string" || typeof r.skillSlug !== "string") {
      continue;
    }
    const failure = r.failure;
    out.push({
      playerId: r.playerId,
      playerName: typeof r.playerName === "string" ? r.playerName : "",
      teamId: typeof r.teamId === "string" ? r.teamId : "",
      keyword: typeof r.keyword === "string" ? r.keyword : "",
      skillSlug: r.skillSlug,
      roll: typeof r.roll === "number" ? r.roll : 0,
      granted: r.granted === true,
      ...(failure === "skill-unavailable" || failure === "write-failed"
        ? { failure }
        : {}),
    });
  }
  return out;
}

/**
 * CSV de Mots-cles par id de joueur de la FEUILLE : joueurs du roster,
 * journaliers alignes (leur poste porte les memes mots-cles) et Star
 * Players engages (mots-cles de lignee du catalogue).
 *
 * Un id absent de la map ne produit aucun candidat — se faire sortir par
 * un joueur dont on ignore la lignee n'accorde rien.
 */
export async function buildSheetKeywordMap(input: {
  /** Joueurs porteurs d'un slug de poste (roster reel + journaliers). */
  readonly positionedPlayers: ReadonlyArray<{
    readonly id: string;
    readonly position: string;
  }>;
  /** Ids synthetiques `star-<side>-<slug>` des Star Players engages. */
  readonly starPlayerIds?: readonly string[];
}): Promise<Map<string, string>> {
  const byPosition = await resolveKeywordsByPosition(
    input.positionedPlayers.map((p) => p.position),
  );
  const out = new Map<string, string>();
  for (const p of input.positionedPlayers) {
    const keywords = byPosition.get(p.position);
    if (keywords) out.set(p.id, keywords);
  }
  for (const id of input.starPlayerIds ?? []) {
    const keywords = starKeywordsFromSheetId(id);
    if (keywords) out.set(id, keywords);
  }
  return out;
}
