// Wires the repo's derive hook to the things read off an entry's body.
//
// Prayers and scripture references are not stored in the entry — they live in
// `spiritual_items` and `scripture_refs`, rebuilt from the markdown. That rebuild
// used to run inline on every autosave, straight to Supabase, with its rejection
// swallowed by a bare `.catch(() => {})`. Written offline, the entry body synced
// when the device reconnected but the derived rows never existed at all: the
// Altar, Scripture and Concordance silently omitted something the user had
// written, on every device, permanently.
//
// Routing it through the outbox instead makes it durable, and takes two network
// round trips out of the typing path.

import { setEntryDeriveHook } from './repo'
import { syncSpiritualBlocksFromMarkdown } from './spiritual'
import { syncScriptureRefsFromMarkdown } from './scripture/capture'

/** Install the derive hook. Idempotent; call once at boot. */
export function registerEntryDerive(): void {
  setEntryDeriveHook(async (entry) => {
    // Sequential on purpose: both rewrite rows keyed on entry_id, and a failure
    // in the first should leave the op queued rather than half-applying the
    // second. A throw here keeps the op in the outbox to be retried.
    await syncSpiritualBlocksFromMarkdown(entry.id, entry.body_markdown)
    await syncScriptureRefsFromMarkdown(entry.id, entry.body_markdown)
  })
}
