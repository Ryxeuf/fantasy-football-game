/**
 * Documents OFFICIELS d'une competition (ligue / championnat ou coupe).
 *
 * Une competition peut porter un reglement PDF, un calendrier, une affiche...
 * Ces fichiers sont deposes par le **commissaire** (createur de la competition)
 * ou par un **admin**, a la creation comme a n'importe quel moment de la vie de
 * la competition — y compris apres son demarrage (aucun verrou de statut,
 * contrairement aux parametres de scoring : un reglement doit pouvoir etre
 * corrige en cours de saison).
 *
 * Ce module est le SEUL chemin d'ecriture de `CompetitionDocument` :
 *  - il tient l'invariant « exactement une des deux FK (`leagueId` XOR
 *    `cupId`) est renseignee », que Prisma ne sait pas exprimer ;
 *  - il garde le disque et la base coherents (ecriture du binaire puis de la
 *    ligne, suppression de la ligne puis du binaire) ;
 *  - il concentre le controle d'acces (commissaire | admin en ecriture,
 *    visibilite de la competition en lecture).
 *
 * Le binaire n'est jamais stocke en base : il vit dans
 * `COMPETITION_DOCUMENT_UPLOAD_DIR` et est servi par `express.static`, comme
 * les images du blog et les logos d'equipe.
 */

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  buildCompetitionDocumentUrl,
  detectDocumentType,
  generateDocumentFilename,
  getCompetitionDocumentUploadDir,
  MAX_COMPETITION_DOCUMENT_BYTES,
  resolveCompetitionDocumentPath,
} from "../utils/competition-document-upload";

/** Les deux familles de competitions qui portent des documents officiels. */
export type CompetitionKind = "league" | "cup";

export const COMPETITION_KINDS: readonly CompetitionKind[] = ["league", "cup"];

export type CompetitionDocumentErrorCode =
  | "competition-not-found"
  | "document-not-found"
  | "forbidden"
  | "empty"
  | "too-large"
  | "unsupported-type";

/** Erreur typee mappee en HTTP par les routes (cf. `routes/competition-documents.ts`). */
export class CompetitionDocumentError extends Error {
  constructor(
    public readonly code: CompetitionDocumentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CompetitionDocumentError";
  }
}

/** Competition telle que resolue pour les controles d'acces. */
export interface CompetitionSummary {
  readonly kind: CompetitionKind;
  readonly id: string;
  readonly name: string;
  readonly creatorId: string;
  readonly isPublic: boolean;
}

/** Document tel qu'expose par l'API (metadonnees + URL publique). */
export interface CompetitionDocumentView {
  readonly id: string;
  readonly competitionKind: CompetitionKind;
  readonly competitionId: string;
  readonly competitionName: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly filename: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly bytes: number;
  readonly url: string;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly uploadedBy: {
    readonly id: string;
    readonly coachName: string;
  } | null;
}

/** Ligne brute remontee par Prisma (select commun a toutes les lectures). */
const DOCUMENT_SELECT = {
  id: true,
  leagueId: true,
  cupId: true,
  title: true,
  description: true,
  filename: true,
  originalName: true,
  mimeType: true,
  bytes: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  uploader: { select: { id: true, coachName: true } },
  league: { select: { id: true, name: true } },
  cup: { select: { id: true, name: true } },
} as const;

interface DocumentRow {
  id: string;
  leagueId: string | null;
  cupId: string | null;
  title: string;
  description: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  bytes: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  uploader?: { id: string; coachName: string } | null;
  league?: { id: string; name: string } | null;
  cup?: { id: string; name: string } | null;
}

/** Serialise une ligne en vue API. */
export function toDocumentView(row: DocumentRow): CompetitionDocumentView {
  const kind: CompetitionKind = row.leagueId ? "league" : "cup";
  return {
    id: row.id,
    competitionKind: kind,
    competitionId: (row.leagueId ?? row.cupId) as string,
    competitionName: row.league?.name ?? row.cup?.name ?? null,
    title: row.title,
    description: row.description,
    filename: row.filename,
    originalName: row.originalName,
    mimeType: row.mimeType,
    bytes: row.bytes,
    url: buildCompetitionDocumentUrl(row.filename),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    uploadedBy: row.uploader
      ? { id: row.uploader.id, coachName: row.uploader.coachName }
      : null,
  };
}

/** Cle de FK a poser selon la famille de competition. */
function competitionWhere(kind: CompetitionKind, competitionId: string) {
  return kind === "league"
    ? { leagueId: competitionId }
    : { cupId: competitionId };
}

/**
 * Charge la competition ciblee (ligue ou coupe) sans jamais lever : `null`
 * quand elle n'existe pas. Les deux tables exposent les memes trois champs
 * utiles au controle d'acces (`name`, `creatorId`, `isPublic`).
 */
export async function getCompetitionSummary(
  kind: CompetitionKind,
  competitionId: string,
): Promise<CompetitionSummary | null> {
  const select = { id: true, name: true, creatorId: true, isPublic: true };
  const row =
    kind === "league"
      ? await prisma.league.findUnique({ where: { id: competitionId }, select })
      : await prisma.cup.findUnique({ where: { id: competitionId }, select });
  if (!row) return null;
  const typed = row as {
    id: string;
    name: string;
    creatorId: string;
    isPublic: boolean;
  };
  return {
    kind,
    id: typed.id,
    name: typed.name,
    creatorId: typed.creatorId,
    isPublic: typed.isPublic,
  };
}

/** Contexte d'appel : qui agit, et est-il admin (verifie en amont par la route). */
export interface ActorContext {
  readonly userId: string | null;
  readonly isAdmin: boolean;
}

/**
 * Droit d'ECRITURE : commissaire (createur de la competition) OU admin.
 * Volontairement sans verrou de statut : le produit exige de pouvoir deposer
 * un document « n'importe quand, meme si la competition a commence ».
 */
export function canManageCompetition(
  competition: CompetitionSummary,
  actor: ActorContext,
): boolean {
  if (actor.isAdmin) return true;
  return !!actor.userId && actor.userId === competition.creatorId;
}

/**
 * Charge la competition et verifie le droit d'ecriture. Leve
 * `competition-not-found` (404) ou `forbidden` (403).
 */
async function requireManageableCompetition(
  kind: CompetitionKind,
  competitionId: string,
  actor: ActorContext,
): Promise<CompetitionSummary> {
  const competition = await getCompetitionSummary(kind, competitionId);
  if (!competition) {
    throw new CompetitionDocumentError(
      "competition-not-found",
      kind === "league" ? "Ligue introuvable" : "Coupe introuvable",
    );
  }
  if (!canManageCompetition(competition, actor)) {
    throw new CompetitionDocumentError(
      "forbidden",
      "Seul le commissaire de la competition ou un administrateur peut gerer ses documents officiels",
    );
  }
  return competition;
}

/**
 * Droit de LECTURE : une competition publique est lisible par tous (les
 * documents officiels ont vocation a etre diffuses). Une competition privee
 * n'est lisible que par son commissaire, un admin ou un coach inscrit.
 */
export async function canViewCompetitionDocuments(
  competition: CompetitionSummary,
  actor: ActorContext,
): Promise<boolean> {
  if (competition.isPublic) return true;
  if (canManageCompetition(competition, actor)) return true;
  if (!actor.userId) return false;
  if (competition.kind === "league") {
    const count = await prisma.leagueParticipant.count({
      where: {
        team: { ownerId: actor.userId },
        season: { leagueId: competition.id },
      },
    });
    return count > 0;
  }
  const count = await prisma.cupParticipant.count({
    where: { cupId: competition.id, team: { ownerId: actor.userId } },
  });
  return count > 0;
}

/**
 * Liste les documents d'une competition, tries par `sortOrder` puis date de
 * creation (ordre stable, deterministe pour les tests et pour l'UI).
 */
export async function listCompetitionDocuments(params: {
  kind: CompetitionKind;
  competitionId: string;
  actor: ActorContext;
}): Promise<CompetitionDocumentView[]> {
  const { kind, competitionId, actor } = params;
  const competition = await getCompetitionSummary(kind, competitionId);
  if (!competition) {
    throw new CompetitionDocumentError(
      "competition-not-found",
      kind === "league" ? "Ligue introuvable" : "Coupe introuvable",
    );
  }
  if (!(await canViewCompetitionDocuments(competition, actor))) {
    throw new CompetitionDocumentError(
      "forbidden",
      "Competition privee : documents reserves aux participants",
    );
  }
  const rows = (await prisma.competitionDocument.findMany({
    where: competitionWhere(kind, competitionId),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: DOCUMENT_SELECT,
  })) as unknown as DocumentRow[];
  return rows.map(toDocumentView);
}

/** Titre par defaut : nom d'origine sans extension, borne a 160 caracteres. */
export function defaultTitleFromOriginalName(originalName: string): string {
  const base = originalName.replace(/\.[A-Za-z0-9]+$/, "").trim();
  const cleaned = base.length > 0 ? base : "Document officiel";
  return cleaned.slice(0, 160);
}

export interface CreateCompetitionDocumentInput {
  readonly kind: CompetitionKind;
  readonly competitionId: string;
  readonly actor: ActorContext;
  readonly body: Buffer;
  /** Nom d'origine cote client (query `filename`), purement indicatif. */
  readonly originalName?: string | null;
  readonly title?: string | null;
  readonly description?: string | null;
}

/**
 * Enregistre un document officiel : validation du binaire (non vide, taille,
 * type reel par magic bytes), ecriture disque puis creation de la ligne.
 *
 * Si l'insertion en base echoue, le binaire orphelin est retire (best-effort) :
 * un fichier sans ligne serait invisible de l'admin donc impossible a purger.
 */
export async function createCompetitionDocument(
  input: CreateCompetitionDocumentInput,
): Promise<CompetitionDocumentView> {
  const { kind, competitionId, actor, body } = input;
  await requireManageableCompetition(kind, competitionId, actor);

  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new CompetitionDocumentError("empty", "Aucune donnee binaire recue");
  }
  if (body.length > MAX_COMPETITION_DOCUMENT_BYTES) {
    throw new CompetitionDocumentError(
      "too-large",
      "Document trop volumineux (max 10 Mo)",
    );
  }
  const detected = detectDocumentType(body);
  if (!detected) {
    throw new CompetitionDocumentError(
      "unsupported-type",
      "Format non supporte (PDF, PNG, JPEG, GIF ou WEBP attendu)",
    );
  }

  const originalName =
    (input.originalName ?? "").trim() || `document.${detected.ext}`;
  const title =
    (input.title ?? "").trim() || defaultTitleFromOriginalName(originalName);
  const description = (input.description ?? "").trim() || null;

  const filename = generateDocumentFilename(originalName, detected.ext);
  const uploadDir = getCompetitionDocumentUploadDir();
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), body);

  // Nouvel ordre = fin de liste. `_max` plutot que `count` : un document
  // supprime ne doit pas faire retomber le prochain sur un rang deja pris.
  const aggregate = (await prisma.competitionDocument.aggregate({
    where: competitionWhere(kind, competitionId),
    _max: { sortOrder: true },
  })) as { _max: { sortOrder: number | null } };
  const sortOrder = (aggregate?._max?.sortOrder ?? -1) + 1;

  try {
    const row = (await prisma.competitionDocument.create({
      data: {
        ...competitionWhere(kind, competitionId),
        title,
        description,
        filename,
        originalName: originalName.slice(0, 255),
        mimeType: detected.mime,
        bytes: body.length,
        uploadedById: actor.userId,
        sortOrder,
      },
      select: DOCUMENT_SELECT,
    })) as unknown as DocumentRow;
    return toDocumentView(row);
  } catch (error: unknown) {
    await removeStoredDocument(filename);
    throw error;
  }
}

/** Charge un document + sa competition, ou leve `document-not-found`. */
async function loadDocumentWithCompetition(
  documentId: string,
): Promise<{ row: DocumentRow; competition: CompetitionSummary }> {
  const row = (await prisma.competitionDocument.findUnique({
    where: { id: documentId },
    select: DOCUMENT_SELECT,
  })) as unknown as DocumentRow | null;
  if (!row) {
    throw new CompetitionDocumentError(
      "document-not-found",
      "Document introuvable",
    );
  }
  const kind: CompetitionKind = row.leagueId ? "league" : "cup";
  const competitionId = (row.leagueId ?? row.cupId) as string;
  const competition = await getCompetitionSummary(kind, competitionId);
  if (!competition) {
    // Ligne orpheline (competition supprimee hors cascade) : on la traite
    // comme introuvable plutot que de laisser une 500 fuiter.
    throw new CompetitionDocumentError(
      "competition-not-found",
      "Competition introuvable",
    );
  }
  return { row, competition };
}

export interface UpdateCompetitionDocumentInput {
  readonly documentId: string;
  readonly actor: ActorContext;
  readonly title?: string;
  readonly description?: string | null;
  readonly sortOrder?: number;
}

/** Met a jour les metadonnees editables (titre, description, ordre). */
export async function updateCompetitionDocument(
  input: UpdateCompetitionDocumentInput,
): Promise<CompetitionDocumentView> {
  const { row, competition } = await loadDocumentWithCompetition(
    input.documentId,
  );
  if (!canManageCompetition(competition, input.actor)) {
    throw new CompetitionDocumentError(
      "forbidden",
      "Seul le commissaire de la competition ou un administrateur peut gerer ses documents officiels",
    );
  }
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    data.title = title || row.title;
  }
  if (input.description !== undefined) {
    const description = (input.description ?? "").trim();
    data.description = description || null;
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const updated = (await prisma.competitionDocument.update({
    where: { id: input.documentId },
    data,
    select: DOCUMENT_SELECT,
  })) as unknown as DocumentRow;
  return toDocumentView(updated);
}

/**
 * Supprime un document : la ligne d'abord (source de verite de l'API), puis le
 * binaire en best-effort. L'ordre evite un document fantome liste sans fichier
 * en cas d'echec disque.
 */
export async function deleteCompetitionDocument(params: {
  documentId: string;
  actor: ActorContext;
}): Promise<{ id: string; filename: string }> {
  const { row, competition } = await loadDocumentWithCompetition(
    params.documentId,
  );
  if (!canManageCompetition(competition, params.actor)) {
    throw new CompetitionDocumentError(
      "forbidden",
      "Seul le commissaire de la competition ou un administrateur peut gerer ses documents officiels",
    );
  }
  await prisma.competitionDocument.delete({ where: { id: params.documentId } });
  await removeStoredDocument(row.filename);
  return { id: row.id, filename: row.filename };
}

/**
 * Retire le binaire du disque. Best-effort : ni un nom suspect ni un fichier
 * deja absent ne doivent faire echouer l'operation metier deja committee.
 */
export async function removeStoredDocument(filename: string): Promise<void> {
  const dir = getCompetitionDocumentUploadDir();
  const resolved = resolveCompetitionDocumentPath(dir, filename);
  if (!resolved) {
    serverLog.error(
      `[competition-documents] nom de fichier refuse a la suppression : ${filename}`,
    );
    return;
  }
  try {
    await unlink(resolved);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== "ENOENT") {
      serverLog.error(
        "[competition-documents] suppression du binaire echouee",
        e,
      );
    }
  }
}

export interface AdminListParams {
  readonly kind?: CompetitionKind;
  readonly competitionId?: string;
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface AdminListResult {
  readonly documents: readonly CompetitionDocumentView[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

/**
 * Listing d'administration : tous les documents, toutes competitions
 * confondues, filtrables par famille, par competition et par sous-chaine
 * (titre, nom d'origine, nom de la competition).
 */
export async function listAllCompetitionDocuments(
  params: AdminListParams = {},
): Promise<AdminListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));

  const where: Record<string, unknown> = {};
  if (params.kind === "league") where.leagueId = { not: null };
  if (params.kind === "cup") where.cupId = { not: null };
  if (params.competitionId) {
    where.OR = [
      { leagueId: params.competitionId },
      { cupId: params.competitionId },
    ];
  }
  const search = params.search?.trim();
  if (search) {
    // `mode: "insensitive"` n'existe que sur le connecteur PostgreSQL : le
    // passer au miroir sqlite des tests leve une erreur de validation. Meme
    // detection que `team-audit-search.detectProviderCapabilities` (sqlite
    // applique de toute facon un LIKE insensible a la casse sur l'ASCII).
    const contains =
      process.env.TEST_SQLITE === "1"
        ? { contains: search }
        : { contains: search, mode: "insensitive" as const };
    const searchOr = [
      { title: contains },
      { originalName: contains },
      { league: { name: contains } },
      { cup: { name: contains } },
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  const [total, rows] = await Promise.all([
    prisma.competitionDocument.count({ where }),
    prisma.competitionDocument.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: DOCUMENT_SELECT,
    }) as unknown as Promise<DocumentRow[]>,
  ]);

  return {
    documents: rows.map(toDocumentView),
    total: total as number,
    page,
    limit,
  };
}
