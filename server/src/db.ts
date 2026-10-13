import pg from 'pg'
import { MIGRATIONS } from './migrations.ts'

/**
 * The server's database (D-262): PostgreSQL in production, PGlite (PostgreSQL
 * compiled to WebAssembly, in memory or in a folder) for development and tests.
 * Both speak the same SQL; the code only sees `Db`.
 */

export type Row = Record<string, unknown>

export interface Queryable {
  query<T extends object = Row>(sql: string, params?: unknown[]): Promise<T[]>
}

export interface Db extends Queryable {
  /** Runs `fn` in one transaction (rolled back if it throws). */
  tx<R>(fn: (q: Queryable) => Promise<R>): Promise<R>
  close(): Promise<void>
}

function postgres(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 10 })
  return {
    async query<T extends object>(sql: string, params: unknown[] = []) {
      return (await pool.query(sql, params)).rows as T[]
    },
    async tx(fn) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await fn({
          query: async <T extends object>(sql: string, params: unknown[] = []) =>
            (await client.query(sql, params)).rows as T[],
        })
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
}

async function pglite(dataDir: string | undefined): Promise<Db> {
  // Development and tests only: not installed in the production image.
  const { PGlite } = await import('@electric-sql/pglite')
  const db = await PGlite.create(dataDir)
  // PGlite has one connection: transactions must not interleave.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <R>(task: () => Promise<R>): Promise<R> => {
    const run = queue.then(task, task)
    queue = run.catch(() => {})
    return run
  }
  const query = async <T extends object>(sql: string, params: unknown[] = []) =>
    (await db.query<T>(sql, params)).rows
  return {
    query: (sql, params) => serial(() => query(sql, params)),
    tx: (fn) =>
      serial(() =>
        db.transaction((tx) =>
          fn({
            query: async <T extends object>(sql: string, params: unknown[] = []) =>
              (await tx.query<T>(sql, params)).rows,
          }),
        ),
      ),
    close: () => db.close(),
  }
}

/**
 * `postgres://…` → PostgreSQL; `pglite:memory` → in memory; `pglite:./folder` → on disk.
 */
export async function openDb(url: string): Promise<Db> {
  const db = url.startsWith('pglite:')
    ? await pglite(url === 'pglite:memory' ? undefined : url.slice('pglite:'.length))
    : postgres(url)
  await migrate(db)
  return db
}

/** Applies the migrations not applied yet, each in its own transaction. */
export async function migrate(db: Db): Promise<void> {
  await db.query('CREATE TABLE IF NOT EXISTS schema_version (version int PRIMARY KEY)')
  const done = new Set(
    (await db.query<{ version: number }>('SELECT version FROM schema_version')).map(
      (r) => r.version,
    ),
  )
  for (const [index, sql] of MIGRATIONS.entries()) {
    const version = index + 1
    if (done.has(version)) continue
    await db.tx(async (q) => {
      for (const statement of sql.split(/;\s*\n/).filter((s) => s.trim())) await q.query(statement)
      await q.query('INSERT INTO schema_version (version) VALUES ($1)', [version])
    })
  }
}
