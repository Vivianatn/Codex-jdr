import type { DBCore, DBCoreCursor, DBCoreTableSchema, Middleware } from 'dexie'
import { DecryptionError, fromUtf8, seal, unseal, utf8 } from '@/security/crypto'

/**
 * Dexie DBCore middlewares (D-242). They sit under every table, so no code path
 * can bypass them: repositories, live queries, `modify()`, schema upgrades.
 */

export class InvalidRecordError extends Error {
  constructor(table: string, reason: string) {
    super(`Refused to write an invalid record in ${table}: ${reason}`)
    this.name = 'InvalidRecordError'
  }
}

/** Tables whose records must belong to a campaign (D-224). */
const CAMPAIGN_OWNED = new Set([
  'entities',
  'bestiary',
  'rolls',
  'itemLibrary',
  'skills',
  'maps',
  'assets',
  'sessions',
  'sessionRuns',
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

/** Write guard: every record is a plain object with a string id, and a campaign when it needs one. */
export const integrityMiddleware: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'codex-integrity',
  // Under Dexie's hooks (2), above the encryption (1.5): checks the final clear record.
  level: 1.8,
  create: (down) => ({
    ...down,
    table: (name) => {
      const table = down.table(name)
      return {
        ...table,
        mutate: (req) => {
          if (req.type === 'add' || req.type === 'put')
            for (const value of req.values) {
              if (!isPlainObject(value)) throw new InvalidRecordError(name, 'not a plain object')
              if (typeof value.id !== 'string' || value.id.length === 0)
                throw new InvalidRecordError(name, 'missing id')
              if (CAMPAIGN_OWNED.has(name) && typeof value.campaignId !== 'string')
                throw new InvalidRecordError(name, 'missing campaignId')
            }
          return table.mutate(req)
        },
      }
    },
  }),
}

/** Encrypted record as stored: index fields in clear, the whole record sealed in `$e`. */
interface SealedRecord {
  $v: 1
  $e: Uint8Array
  [indexField: string]: unknown
}

/** Properties IndexedDB must read in clear: the primary key and every index. */
export function clearFields(schema: DBCoreTableSchema): string[] {
  const paths = [schema.primaryKey, ...schema.indexes].flatMap((index) =>
    index.keyPath === null ? [] : Array.isArray(index.keyPath) ? index.keyPath : [index.keyPath],
  )
  for (const path of paths)
    if (path.includes('.')) throw new Error(`Nested index ${path} cannot be kept in clear`)
  return [...new Set(paths)].sort()
}

function asBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value
  // Values cloned by IndexedDB may come from another realm (tests, workers).
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return null
}

/**
 * Encryption at rest (D-241). Each record is sealed with the account's data key
 * (XChaCha20-Poly1305). The associated data binds the ciphertext to its table
 * and to the clear index values, so a record cannot be moved to another table,
 * id or campaign, nor its indexes altered, without failing authentication.
 *
 * A record that fails authentication is reported through `onCorrupt` and read
 * as missing, so one damaged record never blocks a whole campaign.
 */
export function encryptionMiddleware(
  key: Uint8Array,
  onCorrupt: (table: string, primaryKey: unknown) => void = () => {},
): Middleware<DBCore> {
  return {
    stack: 'dbcore',
    name: 'codex-encryption',
    // Above Dexie's cache and observability (0) and virtual indexes (1), which only read index fields.
    level: 1.5,
    create: (down) => ({
      ...down,
      table: (name) => {
        const table = down.table(name)
        const fields = clearFields(table.schema)
        const aad = (record: Record<string, unknown>) =>
          utf8(JSON.stringify([name, ...fields.map((f) => record[f] ?? null)]))

        const encrypt = (value: Record<string, unknown>): SealedRecord => {
          const out: SealedRecord = {
            $v: 1,
            $e: seal(key, utf8(JSON.stringify(value)), aad(value)),
          }
          for (const f of fields) if (value[f] !== undefined) out[f] = value[f]
          return out
        }

        /** Decrypted record, or undefined (reported) when it is not authentic. */
        const decrypt = (raw: unknown): unknown => {
          if (raw === undefined || raw === null) return raw
          const record = raw as Partial<SealedRecord>
          const sealed = asBytes(record.$e)
          try {
            if (record.$v !== 1 || !sealed) throw new DecryptionError()
            return JSON.parse(fromUtf8(unseal(key, sealed, aad(record))))
          } catch (error) {
            if (!(error instanceof DecryptionError) && !(error instanceof SyntaxError)) throw error
            onCorrupt(name, record.id)
            return undefined
          }
        }

        const wrapCursor = (cursor: DBCoreCursor): DBCoreCursor => {
          let raw: unknown
          let value: unknown
          return Object.create(cursor, {
            value: {
              get() {
                if (cursor.value !== raw) {
                  raw = cursor.value
                  value = decrypt(raw)
                }
                return value
              },
            },
          }) as DBCoreCursor
        }

        return {
          ...table,
          mutate: (req) =>
            req.type === 'add' || req.type === 'put'
              ? table.mutate({
                  ...req,
                  values: req.values.map((v: Record<string, unknown>) => encrypt(v)),
                })
              : table.mutate(req),
          get: (req) => table.get(req).then(decrypt),
          getMany: (req) => table.getMany(req).then((values) => values.map(decrypt)),
          query: (req) =>
            table
              .query(req)
              .then((res) =>
                req.values
                  ? { ...res, result: res.result.map(decrypt).filter((v) => v !== undefined) }
                  : res,
              ),
          openCursor: (req) =>
            table
              .openCursor(req)
              .then((cursor) => (cursor && req.values !== false ? wrapCursor(cursor) : cursor)),
        }
      },
    }),
  }
}
