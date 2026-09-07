/**
 * Generate the Meta Ads Manager paste sheet from the ad registry.
 *
 *   npm run ads:copy   →  assets/ads/COPY.md
 *
 * Ads Manager has no bulk import for creative text worth using at this size, and
 * its fields are separate boxes — primary text, headline, description, CTA, URL.
 * So the deliverable is a paste sheet, the same shape as
 * assets/appstore/listing-paste.md and generated the same way: edit the source,
 * re-run, never hand-edit the output.
 *
 * Unlike scripts/print-listing.mjs this is a `.ts` run through tsx, so it can
 * import ads.ts directly and cannot drift from what the images actually render.
 * ads.ts's only imports are `import type`, which tsx erases — so there is no
 * path-alias resolution to arrange at runtime.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ADS, type Ad } from '../src/features/ads/ads'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.join(ROOT, 'assets/ads/COPY.md')

/** Where every ad lands. The arm and the ad ride along so Ads Manager reporting
 *  can answer the question this round exists to answer (see DECISIONS D-001). */
function url(ad: Ad): string {
  return `https://usedayspring.app/start?utm_source=meta&utm_medium=paid_social&utm_campaign=${ad.arm}&utm_content=${ad.file}`
}

const ARM_LABEL: Record<Ad['arm'], string> = {
  archive: 'Arm A — Archive ("you have never read it back", P1 the Archivist)',
  growth: 'Arm B — Growth ("a journal built for spiritual growth", P2 the Dry Season)',
  neutral: 'Neutral — product craft; reads to both arms',
}

function section(ad: Ad, n: number): string {
  const chars = ad.meta.primary.length
  // Meta truncates primary text around 125 characters on mobile with a "more"
  // link. Flagging it here rather than in review is the difference between
  // writing a first sentence that survives alone and discovering it did not.
  const firstSentence = ad.meta.primary.split(/(?<=\.)\s/)[0] ?? ad.meta.primary
  return [
    `## ${n}. ${ad.file}`,
    '',
    `_${ad.premise}_`,
    '',
    `**Arm:** ${ARM_LABEL[ad.arm]}`,
    `**Creative:** \`assets/ads/${ad.file}/{4x5,1x1,9x16}.png\``,
    `**Preview:** \`?__preview=${ad.id}&ratio=4x5\``,
    '',
    '### Primary text',
    '',
    ad.meta.primary,
    '',
    `> ${chars} characters. Above the fold on mobile (~125): _${firstSentence}_`,
    '',
    '### Headline',
    '',
    ad.meta.headline,
    '',
    '### Description',
    '',
    ad.meta.description,
    '',
    '### Call to action',
    '',
    ad.meta.cta,
    '',
    '### Website URL',
    '',
    '```',
    url(ad),
    '```',
    '',
    '### In the image',
    '',
    `- Eyebrow — ${ad.eyebrow.toUpperCase()}`,
    `- Headline — ${ad.headline.lead} _${ad.headline.accent}_`,
    ...(ad.subcaption ? [`- Sub — ${ad.subcaption}`] : []),
    ...(ad.struck?.length ? [`- Struck through — ${ad.struck.join(' ')}`] : []),
    ...(ad.pair ? ad.pair.entries.map((e) => `- ${e.date} — "${e.line}"`) : []),
    ...(ad.pair ? [`- Note — ${ad.pair.note}`] : []),
    `- Footer — ${ad.offer}`,
    '',
    '---',
    '',
  ].join('\n')
}

async function main() {
  const body = [
    '# Dayspring — Meta Ads Manager paste sheet',
    '',
    '_Generated from `src/features/ads/ads.ts` by `npm run ads:copy`. Edit that file,',
    'then re-run — do not hand-edit this one._',
    '',
    'Open this beside Ads Manager and copy each block into the matching field. The',
    'images are produced by `npm run ads` from the same registry, so the words in an',
    'image and the words beside it cannot fall out of step.',
    '',
    '## Before you spend',
    '',
    '- **The landing page has to exist.** Every URL below points at `usedayspring.app/start`,',
    '  which does not exist yet — the site\'s only CTA is a macOS `.dmg`, and most of this',
    '  traffic will be on a phone. Ship `/start` with a web-signup CTA first, or the buy is wasted.',
    '- **Prices here are the web prices** — $7/month, $64/year. Apple\'s ($7.99 / $69.99) apply',
    '  only to a buy that lands on the App Store.',
    '- **Targeting cannot name Christians.** Meta removed religion from detailed targeting in',
    '  2022. Go broad and let the creative self-select; that is why the copy is specific.',
    '- **Judge on trial starts per dollar, not CTR.** A growth-frame ad will usually win CTR',
    '  and can still lose on cost per trial.',
    '',
    '---',
    '',
    ...ADS.map((ad, i) => section(ad, i + 1)),
  ].join('\n')

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(OUT, body, 'utf8')
  console.log(`Wrote ${path.relative(ROOT, OUT)} — ${ADS.length} ads.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
