/**
 * Mini-modèle Prisma EN MÉMOIRE pour les tests de service et de route : le
 * sous-ensemble de l'API qu'utilise le blog des compétitions (filtres
 * d'égalité, `null`, `not`, `in`, `gte`, `OR`, tri, pagination, `groupBy`,
 * `upsert` sur clé composite, `select` à un niveau de relation).
 *
 * Ce n'est pas un ORM : il suffit à rendre un test lisible de bout en bout
 * (création → lecture → droits) sans fixer à la main la réponse de chaque
 * appel.
 */

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function matchValue(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null || value === undefined;
  if (cond instanceof Date) {
    return value instanceof Date && value.getTime() === cond.getTime();
  }
  if (typeof cond === "object" && cond !== null) {
    const c = cond as Record<string, unknown>;
    if ("not" in c) {
      return !matchValue(value, c.not);
    }
    if ("in" in c) return (c.in as unknown[]).includes(value);
    if ("gte" in c) {
      return value instanceof Date && value.getTime() >= (c.gte as Date).getTime();
    }
    return false;
  }
  return value === cond;
}

export function matchWhere(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      if (!(cond as Where[]).some((w) => matchWhere(row, w))) return false;
      continue;
    }
    if (key === "AND") {
      if (!(cond as Where[]).every((w) => matchWhere(row, w))) return false;
      continue;
    }
    if (!matchValue(row[key], cond)) return false;
  }
  return true;
}

type OrderBy = Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;

function compare(a: unknown, b: unknown): number {
  const va = a instanceof Date ? a.getTime() : a;
  const vb = b instanceof Date ? b.getTime() : b;
  if (va === vb) return 0;
  if (va === null || va === undefined) return -1;
  if (vb === null || vb === undefined) return 1;
  return (va as number | string) < (vb as number | string) ? -1 : 1;
}

function sortRows(rows: Row[], orderBy?: OrderBy): Row[] {
  if (!orderBy) return rows;
  const keys = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const [field, dir] = Object.entries(k)[0];
      const c = compare(a[field], b[field]);
      if (c !== 0) return dir === "desc" ? -c : c;
    }
    return 0;
  });
}

export interface FakeModelOptions {
  /** Relations résolues à la sélection : `author` → `(row) => objet | null`. */
  readonly relations?: Record<string, (row: Row) => Row | null>;
  /** Champs posés par défaut à la création. */
  readonly defaults?: () => Row;
  /** Clés uniques composites (`postId_userId_kind` → ["postId","userId","kind"]). */
  readonly compoundKeys?: Record<string, readonly string[]>;
}

let seq = 0;

export function createFakeModel(options: FakeModelOptions = {}) {
  const rows: Row[] = [];

  function project(row: Row, select?: Record<string, unknown>): Row {
    if (!select) return { ...row };
    const out: Row = {};
    for (const [key, sel] of Object.entries(select)) {
      if (!sel) continue;
      const rel = options.relations?.[key];
      if (rel) {
        const related = rel(row);
        if (!related || sel === true) {
          out[key] = related;
        } else {
          const inner = (sel as { select?: Record<string, unknown> }).select;
          out[key] = inner ? project(related, inner) : related;
        }
      } else {
        out[key] = row[key];
      }
    }
    return out;
  }

  function uniqueWhere(where: Where): Where {
    for (const [name, fields] of Object.entries(options.compoundKeys ?? {})) {
      if (name in where) {
        const v = where[name] as Row;
        return Object.fromEntries(fields.map((f) => [f, v[f]]));
      }
    }
    return where;
  }

  const model = {
    rows,
    async findUnique(args: { where: Where; select?: Record<string, unknown> }) {
      const row = rows.find((r) => matchWhere(r, uniqueWhere(args.where)));
      return row ? project(row, args.select) : null;
    },
    async findFirst(args: { where?: Where; select?: Record<string, unknown>; orderBy?: OrderBy }) {
      const row = sortRows(rows.filter((r) => matchWhere(r, args.where)), args.orderBy)[0];
      return row ? project(row, args.select) : null;
    },
    async findMany(args: {
      where?: Where;
      select?: Record<string, unknown>;
      orderBy?: OrderBy;
      skip?: number;
      take?: number;
    } = {}) {
      const sorted = sortRows(rows.filter((r) => matchWhere(r, args.where)), args.orderBy);
      const start = args.skip ?? 0;
      const sliced = sorted.slice(start, args.take ? start + args.take : undefined);
      return sliced.map((r) => project(r, args.select));
    },
    async count(args: { where?: Where } = {}) {
      return rows.filter((r) => matchWhere(r, args.where)).length;
    },
    async create(args: { data: Row; select?: Record<string, unknown> }) {
      for (const fields of Object.values(options.compoundKeys ?? {})) {
        if (rows.some((r) => fields.every((f) => r[f] === args.data[f]))) {
          throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        }
      }
      const now = new Date();
      const row: Row = {
        id: `id${++seq}`,
        createdAt: now,
        updatedAt: now,
        ...(options.defaults?.() ?? {}),
        ...args.data,
      };
      rows.push(row);
      return project(row, args.select);
    },
    async createMany(args: { data: Row[] }) {
      for (const data of args.data) await model.create({ data });
      return { count: args.data.length };
    },
    async update(args: { where: Where; data: Row; select?: Record<string, unknown> }) {
      const row = rows.find((r) => matchWhere(r, uniqueWhere(args.where)));
      if (!row) throw Object.assign(new Error("Not found"), { code: "P2025" });
      Object.assign(row, args.data, { updatedAt: new Date() });
      return project(row, args.select);
    },
    async updateMany(args: { where: Where; data: Row }) {
      const hit = rows.filter((r) => matchWhere(r, args.where));
      for (const r of hit) Object.assign(r, args.data, { updatedAt: new Date() });
      return { count: hit.length };
    },
    async upsert(args: { where: Where; create: Row; update: Row }) {
      const row = rows.find((r) => matchWhere(r, uniqueWhere(args.where)));
      if (row) {
        Object.assign(row, args.update);
        return { ...row };
      }
      return model.create({ data: args.create });
    },
    async deleteMany(args: { where: Where }) {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matchWhere(rows[i], args.where)) {
          rows.splice(i, 1);
          count++;
        }
      }
      return { count };
    },
    async groupBy(args: { by: string[]; where?: Where }) {
      const groups = new Map<string, Row & { _count: { _all: number } }>();
      for (const r of rows.filter((x) => matchWhere(x, args.where))) {
        const key = args.by.map((b) => String(r[b])).join("|");
        const g =
          groups.get(key) ??
          ({ ...Object.fromEntries(args.by.map((b) => [b, r[b]])), _count: { _all: 0 } } as Row & {
            _count: { _all: number };
          });
        g._count._all++;
        groups.set(key, g);
      }
      return [...groups.values()];
    },
  };
  return model;
}

export type FakeModel = ReturnType<typeof createFakeModel>;
