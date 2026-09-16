import type { Archive } from '../data/model'
import { ARCHIVE } from '../data/archive'

export type Source = 'invented' | 'real'

/**
 * The real archive is LOCAL-ONLY, and that is a privacy constraint, not a
 * convenience.
 *
 * `prototypes/scripts/build-all.mjs` builds every prototype whose status is not
 * `archived` and publishes it to prototypes.usedayspring.app. `listed: false`
 * keeps it off the hub index; it does NOT make the URL private. So a committed
 * file of real journal answers would be a public file of real journal answers.
 *
 * `real.local.json` is therefore gitignored and loaded through `import.meta.glob`,
 * which resolves to an empty object when the file is absent rather than failing
 * the build. On Phil's machine the toggle shows the real archive; in CI, and in
 * anything ever deployed, there is nothing to show and the surface says so.
 *
 * Regenerate it with:
 *   npm run extract:rituals -- --owner <you> \
 *     --out prototypes/rituals/src/data/real.local.json
 */
const local = import.meta.glob<{ default: Archive }>('../data/real.local.json', {
  eager: true,
})

const EMPTY: Archive = { generatedAt: '', entries: 0, threads: [] }

const REAL: Archive = Object.values(local)[0]?.default ?? EMPTY

export const HAS_REAL = REAL.threads.length > 0

export function archiveFor(source: Source): Archive {
  return source === 'real' ? REAL : ARCHIVE
}
