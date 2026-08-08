/**
 * A minimal in-memory stand-in for the Supabase client.
 *
 * Enough of the query builder to exercise the webhook and job handlers without
 * a database: insert, upsert, update, select with eq/in filters, maybeSingle.
 * It is not a Postgres emulator and does not pretend to be — it exists so that
 * "does the Stripe webhook set the right subscription state?" is testable, and
 * anything needing real SQL semantics is tested against a real database
 * instead.
 */

interface Row {
  [key: string]: unknown;
}

type Filter = (row: Row) => boolean;

export class FakeDb {
  readonly tables = new Map<string, Row[]>();
  readonly rpcCalls: Array<{ name: string; args: unknown }> = [];

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [table, rows] of Object.entries(seed)) {
      this.tables.set(table, rows.map((r) => ({ ...r })));
    }
  }

  rows(table: string): Row[] {
    let existing = this.tables.get(table);
    if (!existing) {
      existing = [];
      this.tables.set(table, existing);
    }
    return existing;
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  async rpc(name: string, args: unknown) {
    this.rpcCalls.push({ name, args });
    return { data: null, error: null };
  }
}

class FakeQuery {
  private filters: Filter[] = [];
  private pending: { op: "select" | "insert" | "update" | "upsert"; payload?: Row | Row[] } | null =
    null;
  private conflictKeys: string[] = [];

  constructor(
    private readonly db: FakeDb,
    private readonly table: string
  ) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    this.pending ??= { op: "select" };
    if (options?.count) {
      // Count queries resolve immediately with the filtered length.
      return {
        eq: (column: string, value: unknown) => {
          this.filters.push((row) => row[column] === value);
          return this.countResult();
        },
        in: (column: string, values: unknown[]) => {
          this.filters.push((row) => values.includes(row[column]));
          return this.countResult();
        },
        gte: () => this.countResult(),
        then: (resolve: (value: { count: number }) => void) => resolve(this.count()),
      };
    }
    return this;
  }

  private countResult() {
    return {
      gte: () => this.countResult(),
      eq: (column: string, value: unknown) => {
        this.filters.push((row) => row[column] === value);
        return this.countResult();
      },
      then: (resolve: (value: { count: number }) => void) => resolve(this.count()),
    };
  }

  private count() {
    return { count: this.matching().length };
  }

  insert(payload: Row | Row[]) {
    this.pending = { op: "insert", payload };
    return this;
  }

  update(payload: Row) {
    this.pending = { op: "update", payload };
    return this;
  }

  upsert(payload: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.pending = { op: "upsert", payload };
    this.conflictKeys = options?.onConflict?.split(",").map((k) => k.trim()) ?? [];
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  not(column: string, _operator: string, values: string) {
    const list = values.replace(/[()]/g, "").split(",");
    this.filters.push((row) => !list.includes(String(row[column])));
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push((row) => String(row[column] ?? "") >= String(value));
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  single() {
    return this.resolve(true);
  }

  maybeSingle() {
    return this.resolve(true);
  }

  then(
    resolve: (value: { data: unknown; error: unknown }) => void,
    reject?: (reason: unknown) => void
  ) {
    return Promise.resolve(this.resolve(false)).then(resolve, reject);
  }

  private matching(): Row[] {
    return this.db.rows(this.table).filter((row) => this.filters.every((f) => f(row)));
  }

  private resolve(single: boolean): { data: unknown; error: unknown } {
    const rows = this.db.rows(this.table);

    switch (this.pending?.op) {
      case "insert": {
        const payload = Array.isArray(this.pending.payload)
          ? this.pending.payload
          : [this.pending.payload as Row];
        const inserted = payload.map((r) => ({ id: `id_${rows.length + 1}`, ...r }));
        rows.push(...inserted);
        return { data: single ? inserted[0] : inserted, error: null };
      }

      case "upsert": {
        const payload = Array.isArray(this.pending.payload)
          ? this.pending.payload
          : [this.pending.payload as Row];
        const result: Row[] = [];
        for (const item of payload) {
          const existing =
            this.conflictKeys.length > 0
              ? rows.find((row) => this.conflictKeys.every((key) => row[key] === item[key]))
              : undefined;
          if (existing) {
            Object.assign(existing, item);
            result.push(existing);
          } else {
            const created = { id: `id_${rows.length + 1}`, ...item };
            rows.push(created);
            result.push(created);
          }
        }
        return { data: single ? result[0] : result, error: null };
      }

      case "update": {
        const matched = this.matching();
        for (const row of matched) Object.assign(row, this.pending.payload);
        return { data: single ? (matched[0] ?? null) : matched, error: null };
      }

      default: {
        const matched = this.matching();
        return { data: single ? (matched[0] ?? null) : matched, error: null };
      }
    }
  }
}

/** Cast helper: the handlers take a SupabaseClient and we are giving them this. */
export function asClient(db: FakeDb): never {
  return db as never;
}
