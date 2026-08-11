/**
 * Export the support manifest — the contract between the app and the help site.
 *
 * The support site at usedayspring.app/help must never re-type a value that
 * already lives in this repo. Every shortcut, slash command, setting default,
 * palette, practice, importer, price and limit is read out of the module that
 * already owns it, and written to one JSON document that the site consumes at
 * build time. If a feature is renamed or removed here, the site build fails
 * rather than serving a page that quietly lies.
 *
 * Two extraction strategies, deliberately:
 *
 *   1. Modules that are pure data are IMPORTED (via Vite's SSR pipeline, so the
 *      `@/` alias and TS/TSX both resolve). The real value is read, not a copy.
 *
 *   2. A few scalars live inside modules that can't be imported outside the
 *      browser or without env vars — `api/profile/ensure.ts` throws on a missing
 *      SUPABASE_URL, `PageScanCapture.tsx` is a React component. Those are read
 *      out of the source text by `readNumericConst`, which THROWS when the
 *      declaration is missing. A rename fails the build loudly; it never
 *      silently emits a stale number.
 *
 * Usage: npm run support:manifest [-- --out path/to/manifest.json]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ---------------------------------------------------------------------------
// Loading app modules
// ---------------------------------------------------------------------------

/**
 * Modules replaced with inert stubs while extracting.
 *
 * Every binding listed here is referenced only from inside a function body in
 * the modules we read — never at module scope — so stubbing them changes
 * nothing about the data we extract. They're stubbed because they reach for a
 * browser, a native shell, or a network client that doesn't exist in Node.
 *
 * Named explicitly rather than proxied: if one of these modules grows an export
 * that a data module starts using at load time, the import throws by name
 * instead of handing back a silent `undefined`.
 */
const STUBS: Record<string, string[]> = {
  '@/lib/supabase': ['requireSupabase', 'getSupabase'],
  '@/lib/api': ['apiUrl'],
}

function stubPlugin() {
  const PREFIX = '\0support-stub:'
  return {
    name: 'dayspring-support-stub',
    resolveId(id: string) {
      return id in STUBS ? PREFIX + id : null
    },
    load(id: string) {
      if (!id.startsWith(PREFIX)) return null
      const names = STUBS[id.slice(PREFIX.length)] ?? []
      return names
        .map(
          (n) =>
            `export function ${n}() { throw new Error('${n}() is stubbed during manifest export') }`,
        )
        .join('\n')
    },
  }
}

async function startLoader(): Promise<ViteDevServer> {
  return createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true, watch: null },
    resolve: { alias: { '@': resolve(ROOT, 'src') } },
    /**
     * Inject NO app env into the extraction.
     *
     * `resolveFlag()` falls back to `import.meta.env.VITE_FF_<KEY> === 'true'`,
     * so with a developer's local .env loaded, a flag they'd switched on for
     * themselves would be published as a shipped feature — and CI, which has no
     * .env, would produce a different manifest from the same commit. A prefix
     * that matches nothing is the most direct way to say "defaults only".
     */
    envPrefix: 'DAYSPRING_MANIFEST_NO_APP_ENV_',
    plugins: [stubPlugin()],
  })
}

// ---------------------------------------------------------------------------
// Reading scalars out of source text (for modules we can't import)
// ---------------------------------------------------------------------------

/**
 * Read `const NAME = <number>` out of a source file.
 *
 * Throws when the declaration is gone. That is the point: these constants are
 * published to users as facts ("14-day trial", "up to 8 pages"), and a rename
 * that silently dropped one would put a wrong number on a public page.
 */
function readNumericConst(relPath: string, name: string): number {
  const src = readFileSync(resolve(ROOT, relPath), 'utf8')
  const m = new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)`).exec(src)
  if (!m) {
    throw new Error(
      `export-support-manifest: could not find \`const ${name}\` in ${relPath}. ` +
        `If it moved, update scripts/export-support-manifest.ts — the help site ` +
        `publishes this number.`,
    )
  }
  return Number(m[1])
}

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

export interface ManifestEntry {
  id: string
  [key: string]: unknown
}

export interface SupportManifest {
  /** Schema version — bump when the shape changes incompatibly. */
  schema: number
  /** App version this was generated from. */
  appVersion: string
  /** Release channel: which branch generated it. */
  channel: string
  categories: Record<string, ManifestEntry[]>
  /** Flat scalars addressable as {{tokens}} in help prose. */
  values: Record<string, string | number>
}

/** kebab-case an arbitrary label so IDs are stable and URL-safe. */
export function slugify(input: string): string {
  return input
    .replace(/['’]/g, '')
    // split camelCase so `fontSize` reads as `font-size`, not `fontsize`
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export async function buildManifest(channel: string): Promise<SupportManifest> {
  const server = await startLoader()
  const absent: string[] = []

  /**
   * Load an app module, or return null when this branch doesn't have it.
   *
   * The generator runs on both `master` and `stable`, and those branches differ
   * — the five-colour highlighter, for instance, is on master only. A missing
   * module must mean "that feature isn't on this channel yet", exactly like an
   * absent capability. Crashing instead would take the whole help site's build
   * down every time a feature was mid-flight.
   */
  const tryLoad = async (p: string): Promise<Record<string, any> | null> => {
    if (!existsSync(resolve(ROOT, p.replace(/^\//, '')))) {
      absent.push(p)
      return null
    }
    return server.ssrLoadModule(p)
  }

  /** Required modules — absent means the repo is broken, not mid-flight. */
  const load = async (p: string): Promise<Record<string, any>> => {
    const m = await tryLoad(p)
    if (!m) {
      throw new Error(
        `export-support-manifest: required module ${p} is missing. The help site ` +
          `cannot be built without it.`,
      )
    }
    return m
  }

  try {
    const [shortcuts, slash, settings, themes, highlight, practices, imports, subscription, prices, appleIap, flags] =
      await Promise.all([
        load('/src/features/shortcuts/shortcuts.ts'),
        load('/src/editor/slashCommands.ts'),
        load('/src/lib/settings.ts'),
        load('/src/lib/resolveTheme.ts'),
        tryLoad('/src/lib/highlightColors.ts'),
        load('/src/editor/practices/practicesData.ts'),
        load('/src/lib/import/sources.ts'),
        load('/src/lib/subscription.ts'),
        load('/src/features/paywall/prices.ts'),
        load('/src/lib/appleIap.ts'),
        load('/src/features/flags.tsx'),
      ])

    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))

    // --- shortcuts ---------------------------------------------------------
    // `Mod` is rendered per-platform in the app; the help site is read on every
    // platform, so both renderings are carried and the page picks one.
    const renderKey = shortcuts.renderKey as (t: string, mac: boolean) => string
    const shortcutEntries: ManifestEntry[] = []
    for (const group of shortcuts.SHORTCUT_GROUPS as any[]) {
      for (const item of group.items) {
        shortcutEntries.push({
          id: `shortcut.${slugify(item.label)}`,
          group: group.title,
          label: item.label,
          when: item.when ?? null,
          keys: item.keys,
          mac: item.keys.map((k: string) => renderKey(k, true)).join(''),
          pc: item.keys.map((k: string) => renderKey(k, false)).join(' + '),
        })
      }
    }

    // --- slash commands ----------------------------------------------------
    const slashEntries: ManifestEntry[] = (slash.SLASH_ITEMS as any[]).map((i) => ({
      id: `slash.${i.selection.id}`,
      label: i.label,
      hint: i.hint,
      badge: i.badge,
      column: i.column,
      keywords: i.keywords,
    }))

    // --- settings ----------------------------------------------------------
    // DEFAULT_SETTINGS, not migrateSettings({}) — a blob with no `v` counts as
    // version 1, so the v3 font migration would apply and publish 28px as the
    // default font size when a new user actually gets 24.
    const defaults = settings.DEFAULT_SETTINGS as Record<string, unknown>
    const settingEntries: ManifestEntry[] = Object.entries(defaults).map(([key, value]) => ({
      id: `setting.${slugify(key)}`,
      key,
      default: value as never,
      type: typeof value,
    }))

    // --- themes & fonts ----------------------------------------------------
    const themeEntries: ManifestEntry[] = (themes.THEMES as any[]).map((t) => ({
      id: `theme.${t.id}`,
      label: t.label,
      family: t.family,
      blurb: t.blurb,
      isDefault: t.id === themes.DEFAULT_LIGHT_THEME || t.id === themes.DEFAULT_DARK_THEME,
    }))

    const fontEntries: ManifestEntry[] = Object.keys(
      settings.EDITOR_FONT_VARS as Record<string, string>,
    ).map((id) => ({
      id: `font.${id}`,
      key: id,
      isDefault: id === defaults.editorFont,
    }))

    // --- highlight colours -------------------------------------------------
    const highlightEntries: ManifestEntry[] = !highlight
      ? []
      : (highlight.HIGHLIGHT_ORDER as string[]).map((c) => ({
          id: `highlight.${c}`,
          key: c,
          label: (highlight.HIGHLIGHT_LABELS as Record<string, string>)[c],
          /** Amber is the bare `==text==`; the rest carry a colour spec. */
          markdown: c === 'amber' ? '==text==' : `=={${c}}text==`,
        }))

    // --- practices ---------------------------------------------------------
    const practiceEntries: ManifestEntry[] = (practices.PRACTICES as any[]).map((p) => ({
      id: `practice.${slugify(p.name)}`,
      name: p.name,
      function: p.function,
      rhythm: p.rhythm,
      origin: p.origin,
      tradition: p.tradition,
      intention: p.intention,
      quote: p.quote,
      steps: p.prompts.map((pr: any) => pr.label),
    }))

    // --- importers ---------------------------------------------------------
    const importEntries: ManifestEntry[] = (imports.IMPORT_SOURCES as any[]).map((s) => ({
      id: `import.${s.id}`,
      name: s.name,
      tagline: s.tagline,
      status: s.status,
      fileLabel: s.fileLabel ?? null,
      instructions: s.instructions ?? [],
      note: s.note ?? null,
    }))

    // --- feature flags -----------------------------------------------------
    // resolveFlag([], key) with no per-user overrides and no env is exactly what
    // a default install sees, so `defaultOn` is the truth for a normal user.
    const resolveFlag = flags.resolveFlag as (f: string[], k: string) => boolean
    const flagKeys = ['altar', 'threadsRopes', 'concordance']
    const flagEntries: ManifestEntry[] = flagKeys.map((key) => ({
      id: `flag.${slugify(key)}`,
      key,
      defaultOn: resolveFlag([], key),
    }))

    // --- surfaces ----------------------------------------------------------
    // Labelled from the shortcut list so the names users see in the app rail
    // and the names in the docs can't drift apart.
    const surfaceEntries: ManifestEntry[] = [
      { id: 'surface.entries', label: 'Entries', shortcut: 'shortcut.entries-your-pages' },
      { id: 'surface.ascent', label: 'Ascent', shortcut: 'shortcut.ascent' },
      { id: 'surface.lamp', label: 'Lamp', shortcut: 'shortcut.lamp' },
      { id: 'surface.altar', label: 'Altar', shortcut: 'shortcut.altar' },
      { id: 'surface.find', label: 'Find and Ask', shortcut: 'shortcut.find-a-word-or-ask-a-question' },
      { id: 'surface.settings', label: 'Settings', shortcut: 'shortcut.settings' },
    ]

    // --- capabilities ------------------------------------------------------
    // Features with no list to enumerate, but which help articles still need to
    // gate on. A capability is present iff the module that implements it is
    // present on THIS branch — which is the whole gating mechanism.
    //
    // Pages and handwriting scan ship to alpha unflagged (D-017/D-018): the
    // release channel is the gate. So on `stable` these files simply don't
    // exist, the capability drops out of the manifest, and the site excludes
    // the articles that require it. When the feature merges to stable the file
    // arrives, the capability reappears, and the article publishes itself.
    // Nobody has to remember to flip anything.
    const CAPABILITIES: { id: string; label: string; impl: string; touchOnly?: boolean }[] = [
      { id: 'capability.editor', label: 'The editor', impl: 'src/editor/Editor.tsx' },
      { id: 'capability.focus-mode', label: 'Focus mode', impl: 'src/features/journal/useFocusMode.ts' },
      { id: 'capability.photos', label: 'Photos in entries', impl: 'src/editor/attachmentInsert.ts' },
      { id: 'capability.scripture-blocks', label: 'Scripture, prayer and sense blocks', impl: 'src/lib/spiritualBlocks.ts' },
      { id: 'capability.practices', label: 'Rituals and practices', impl: 'src/editor/practices/PracticeLibrary.tsx' },
      { id: 'capability.marking', label: 'Marking a passage', impl: 'src/lib/marks.ts' },
      { id: 'capability.backup', label: 'Download a backup', impl: 'src/lib/export/exportEntries.ts' },
      { id: 'capability.import', label: 'Importing another journal', impl: 'src/lib/import/sources.ts' },
      { id: 'capability.sign-in', label: 'Sign in with Apple or Google', impl: 'src/lib/auth.ts' },
      { id: 'capability.billing', label: 'Subscription and billing', impl: 'src/lib/subscription.ts' },
      { id: 'capability.account-deletion', label: 'Deleting your account', impl: 'api/account/delete.ts' },
      { id: 'capability.apple-iap', label: 'Buying through the App Store', impl: 'src/lib/appleIap.ts' },
      { id: 'capability.find-ask', label: 'Find and Ask', impl: 'src/lib/ask.ts' },
      { id: 'capability.ascent', label: 'The Ascent', impl: 'src/features/ascent/AscentView.tsx' },
      { id: 'capability.lamp', label: 'The Lamp', impl: 'src/features/scripture' },
      { id: 'capability.altar', label: 'The Altar', impl: 'src/features/altar/AltarView.tsx' },
      // Touch-only: reachable solely from the keyboard accessory bar, which
      // needs a software keyboard. No desktop entry point exists.
      { id: 'capability.voice-dictation', label: 'Voice dictation', impl: 'src/features/capture/VoiceCapture.tsx', touchOnly: true },
      { id: 'capability.page-scan', label: 'Handwriting page scan', impl: 'src/features/capture/PageScanCapture.tsx', touchOnly: true },
      // Alpha-only today.
      { id: 'capability.pages-wall', label: 'The Pages wall', impl: 'src/features/pages/PagesView.tsx' },
    ]

    const capabilityEntries: ManifestEntry[] = CAPABILITIES.filter((c) =>
      existsSync(resolve(ROOT, c.impl)),
    ).map((c) => ({
      id: c.id,
      label: c.label,
      ...(c.touchOnly ? { touchOnly: true } : {}),
    }))

    // A capability whose implementing module was RENAMED would silently vanish
    // and take its articles offline with no error. But a capability that simply
    // hasn't been merged down to stable yet is the mechanism working.
    //
    // Those look identical from a single branch, so the rule keys off which
    // branch we're on: master carries every feature that exists, so a missing
    // file there is a rename and must fail loudly. On any other channel an
    // absence is expected — stable trails master by design — and is only
    // logged. This is why there's no allowlist of "mid-flight" features to keep
    // up to date, and why a stable build never breaks over one.
    const missing = CAPABILITIES.filter((c) => !existsSync(resolve(ROOT, c.impl)))
    if (missing.length) {
      const names = missing.map((c) => `${c.id} (${c.impl})`).join(', ')
      if (channel === 'master') {
        throw new Error(
          `export-support-manifest: implementing module missing on master for ${names}. ` +
            `On master every capability's file must exist, so this is a rename — ` +
            `update CAPABILITIES, or the help site silently unpublishes these articles.`,
        )
      }
      console.warn(`[support-manifest] not yet on ${channel}: ${names}`)
    }

    // --- scalars published as prose tokens ---------------------------------
    const attachments = await load('/src/editor/attachmentInsert.ts')
    const webPrices = prices.WEB_PRICES as Record<string, string>
    const productIds = appleIap.APPLE_PRODUCT_IDS as Record<string, string>

    // Scan lives in a component that's alpha-only, so its limit is optional in
    // exactly the way the capability is.
    const scanMaxPages = existsSync(resolve(ROOT, 'src/features/capture/PageScanCapture.tsx'))
      ? readNumericConst('src/features/capture/PageScanCapture.tsx', 'MAX_PAGES')
      : undefined

    // Undefined entries are dropped rather than published as 0 or "undefined" —
    // a count of 0 highlight colours would read as a fact on a public page.
    const rawValues: Record<string, string | number | undefined> = {
      'billing.trial-days': readNumericConst('api/profile/ensure.ts', 'TRIAL_DAYS'),
      'billing.extension-days': readNumericConst('api/trial/extend.ts', 'EXTENSION_DAYS'),
      'billing.grace-days': subscription.GRACE_DAYS as number,
      'billing.web.monthly': webPrices.monthly,
      'billing.web.annual': webPrices.annual,
      'billing.apple.monthly-product': productIds.monthly,
      'billing.apple.annual-product': productIds.annual,
      'limits.image-max-mb': Math.round((attachments.IMAGE_MAX_BYTES as number) / (1024 * 1024)),
      'limits.scan-max-pages': scanMaxPages,
      'editor.font-size-default': settings.FONT_SIZE_DEFAULT as number,
      'editor.font-size-min': settings.FONT_SIZE_MIN as number,
      'editor.font-size-max': settings.FONT_SIZE_MAX as number,
      'counts.practices': practiceEntries.length || undefined,
      'counts.themes': themeEntries.length || undefined,
      'counts.slash-commands': slashEntries.length || undefined,
      'counts.highlight-colors': highlightEntries.length || undefined,
      'counts.importers': importEntries.filter((i) => i.status === 'available').length || undefined,
    }

    const values = Object.fromEntries(
      Object.entries(rawValues).filter(([, v]) => v !== undefined),
    ) as Record<string, string | number>

    if (absent.length) {
      console.warn(`[support-manifest] not on this branch: ${absent.join(', ')}`)
    }

    return {
      schema: 1,
      appVersion: pkg.version,
      channel,
      categories: {
        shortcuts: shortcutEntries,
        slashCommands: slashEntries,
        settings: settingEntries,
        themes: themeEntries,
        fonts: fontEntries,
        highlightColors: highlightEntries,
        practices: practiceEntries,
        importers: importEntries,
        flags: flagEntries,
        surfaces: surfaceEntries,
        capabilities: capabilityEntries,
      },
      values,
    }
  } finally {
    await server.close()
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const channel = arg('channel', process.env.SUPPORT_CHANNEL ?? 'alpha')
  const out = resolve(ROOT, arg('out', 'support-manifest.json'))
  const manifest = await buildManifest(channel)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n')

  const counts = Object.entries(manifest.categories)
    .map(([k, v]) => `${k}=${v.length}`)
    .join(' ')
  console.log(`[support-manifest] ${out}`)
  console.log(`[support-manifest] channel=${channel} v${manifest.appVersion} ${counts}`)
  process.exit(0)
}
