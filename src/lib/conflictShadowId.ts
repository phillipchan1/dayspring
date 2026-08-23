// The id under which a losing version of an entry is preserved.
//
// It used to be crypto.randomUUID(), which made preserving a version an
// operation you could not repeat safely. Resolving one conflict can call it
// several times — pushEntry rebases up to three times per push, a push whose
// response is lost is retried from the outbox, and two devices can both lose to
// the same server version — and every one of those minted another row. The
// mechanism meant to save a version from being lost was itself a way to
// manufacture duplicates of it.
//
// Naming the row after WHAT it holds instead makes the whole thing idempotent:
// "the version entry X had on the server at time T" is one row no matter how
// many times, or on how many devices, we arrive at it.

/** Fixed namespace for Dayspring conflict shadows. Never change it: the ids derive from it. */
const NAMESPACE = '3f9b1c74-6a2e-4d51-9c88-0b7e5a2f41d3'

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '')
  const out = new Uint8Array(16)
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * RFC 4122 v5 (SHA-1, name-based). A real hash rather than a cheap one because a
 * collision here would merge two unrelated preserved versions into one row —
 * silently losing the writing this whole mechanism exists to keep.
 */
async function uuidV5(namespace: string, name: string): Promise<string> {
  const ns = uuidToBytes(namespace)
  const nameBytes = new TextEncoder().encode(name)
  const input = new Uint8Array(ns.length + nameBytes.length)
  input.set(ns)
  input.set(nameBytes, ns.length)

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', input))
  const out = digest.slice(0, 16)
  out[6] = (out[6]! & 0x0f) | 0x50 // version 5
  out[8] = (out[8]! & 0x3f) | 0x80 // RFC 4122 variant
  return bytesToUuid(out)
}

/**
 * The row id for "the version `entryId` held on the server at `serverUpdatedAt`".
 * Deterministic, so re-resolving the same conflict — on this device or another —
 * lands on the row that already holds it instead of adding another.
 */
export function conflictShadowId(entryId: string, serverUpdatedAt: string): Promise<string> {
  return uuidV5(NAMESPACE, `${entryId}:${serverUpdatedAt}`)
}
