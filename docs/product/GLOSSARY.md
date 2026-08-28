# Glossary

Dayspring uses a deliberate, unusual vocabulary. That's an asset — it's why the product
doesn't read like productivity software — but it only works if it's used **consistently**
and if internal names stay stable while display names change.

**The rule that prevents the most pain:** *display names are cheap to change; internal
keys are not.* When a surface is renamed, change the user-facing strings only. Feature
flags, DB values, routes, CSS class prefixes, and analytics keys keep their original
name forever.

---

## Surface names

| Display | Internal key | Shortcut | Means |
|---|---|---|---|
| **Dayspring** | `dayspring` | — | The product. Luke 1:78, *"the dayspring from on high hath visited us."* First light, visitation, mercy after darkness. Most users won't know the reference — telling them is a small gift. |
| **The Ascent** | `reflections` | ⌘2 | Retrospective as elevation. ⚠️ Internal key is `reflections`, not `ascent` — predates the rename. |
| **Lamp** | `scripture` | ⌘3 | Scripture as it has intersected the user's life. Psalm 119:105. |
| **Altar** | `altar` | ⌘4 | Matters returned to, and what came of them. **Not "Covenant"** — that rename was reverted unshipped (D-009). |
| **Concordance** | `concordance` | — | Per-user vocabulary engine. Names and spellings only, never moods. |
| **Threads & Ropes** | `threadsRopes` | — | Flagged off, unshipped. Status open (D-005). |
| **heartIQ** | `noticing` | — | The journal proposing markings in pencil. Built, and deliberately not on the writing surface — waiting on a reading surface to live in (D-026). |

**Retired:** *Covenant* (Altar, reverted 2026-07-26) · *Reflections* (the old UI Ascent
replaced; survives only as an internal key).

---

## Ascent vocabulary — elevation

| Term | Means | Careful |
|---|---|---|
| **Valley** | A season the user described as low or hard | ⚠️ **Highest-risk word in the product.** Must read as *terrain passed through*, never *low performance*. Principle 1. |
| **Hillside** | Ordinary, moving | |
| **Ridge** | Extended effort or tension | Quarterly. Blocked in prod — missing `'quarterly'` in `insights_type_check`. |
| **Summit** | A season of clarity or arrival | ⚠️ Must not read as *reward for doing faith well*. |
| **Arc** | A movement traced across entries | |
| **Tension** | A pull the user carried, unresolved | Named, never adjudicated (H4). |
| **Refrain** | A phrase that recurs in the user's own writing | **Always verbatim.** Never paraphrased. Guarded live. |

**The whole metaphor's risk:** elevation is the one metaphor in the product with an
implied up/down. It only survives Principle 1 because it describes **terrain**, not
**achievement** — you don't earn a Summit, you pass through one. Copy must never
congratulate a Summit or console a Valley.

---

## Altar vocabulary — remembrance

| Term | Means |
|---|---|
| **Matter** | Something brought to God — a prayer, a burden, a sense |
| **Cairn** | A matter returned to enough times to become visible. From the OT stones of remembrance. |
| **Strand** | The thread of a matter through time — its then→now history |
| **Encounter** | A moment the user marked God as having met them in a matter |
| **Heft** | How often a matter has been brought |
| **Span** | How long it's been carried |

**The rule this surface exists to protect: light = encounter, not verdict.** Illumination
means *God met you here*, never *you did well here*. And — from the abandoned Sky work —
**no vertical valence**: height must never imply better/worse.

---

## Capture vocabulary

| Term | Means |
|---|---|
| **heartIQ** | The journal proposing markings in pencil. Internal key stays `noticing` (setting, API route, every call site). Nothing it proposes is a marking until the writer keeps it. Belongs to reading, never to the writing surface (D-026). ⚠️ The name is a deliberate override of the `score` ban below. |
| **The `+`** | The one insert door in the editor — left gutter, every line, opens the same palette `/` opens. A capture kind picked from it MARKS a line that has words and INSERTS on one that doesn't (D-026). |
| `/pray` | Marks a prayer inline; feeds Altar |
| `/sense` | Marks something sensed or discerned; feeds Altar |
| `/scripture` | Captures a reference; feeds Lamp |
| `/image` | Inline image |
| **Page scan** | Photograph a handwritten entry → OCR → reviewable draft |
| **Dictation** | Voice → transcription → inserted at caret |

---

## System vocabulary

| Term | Means |
|---|---|
| **Processing job** | A per-owner background build (`processing_jobs`) |
| **Backfill** | Building retrospectives for history that predates the account |
| **Rollup** | A period synthesis (weekly/monthly/quarterly/yearly) |
| **Grounding** | The guarantee that every claim traces to a user row. Facts in code; model selects only. |
| **Outbox** | The offline write queue |
| **Alpha / Stable** | `master` (Phil only) / `stable` (beta users) |

---

## Naming rules

**Do:**
- Name from **remembrance and terrain**: altar, cairn, lamp, ascent, valley, strand, season
- Prefer **concrete and physical** over abstract ("cairn" over "milestone")
- Prefer words that **describe what the user did**, not what we computed
- Keep names **non-valent** — nothing that implies better/worse

**Don't:**
- **Never** *dashboard, analytics, insights (as a noun-blob), score, streak, level,
  progress, goal, optimize, track*
- **Never** *journey* — exhausted in this category
- **Never** productivity register (*inbox, workflow, capture rate, review*)
- **Never** wellness register (*mindfulness, self-care, mood tracking*) — wrong tradition
- **Never** *AI-powered* — an implementation detail, and it frightens this audience

**When renaming a surface:**
1. Change display strings only.
2. Leave internal key, flag, routes, CSS prefix, and DB values alone.
3. Update this file, including the retired-names list.
4. Log it in `DECISIONS.md`.

*(The `reflections` → Ascent rename is the model: internal key untouched, one display
change, no migration. The reverted Covenant rename is why step 3 exists.)*
