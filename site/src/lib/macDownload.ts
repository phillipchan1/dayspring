// Resolve every `[data-dl-macos]` link to the LATEST .dmg on GitHub Releases.
//
// Lifted out of Nav.astro when the Mac download became the site's primary CTA
// rather than one pill in the nav — it now has to work on the hero, the footer,
// the pricing cards and the download page at once, and three copies of this
// script would be three chances to drift.
//
// Progressive enhancement: the link's server-rendered href already points at
// GitHub's stable `releases/latest/download/Dayspring-aarch64.dmg` alias, so it
// works with no JS and if the API is unreachable. On hover/focus we pre-resolve
// the exact asset via the REST API (CORS-enabled) and rewrite the href, so the
// click is a direct, instant download.

import { trackSite } from './siteAnalytics'

let resolved: string | null = null
let pending: Promise<string | null> | null = null

function resolveLatest(repo: string): Promise<string | null> {
  if (resolved) return Promise.resolve(resolved)
  if (pending) return pending
  pending = fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((rel) => {
      const assets = (rel && rel.assets) || []
      const dmg =
        assets.find((a: any) => /aarch64.*\.dmg$/i.test(a.name)) ||
        assets.find((a: any) => /\.dmg$/i.test(a.name))
      resolved = dmg ? dmg.browser_download_url : null
      return resolved
    })
    .catch(() => null)
  return pending
}

export function wireMacDownloads(): void {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[data-dl-macos]')
  links.forEach((link) => {
    const repo = link.dataset.repo
    if (!repo) return

    const warm = () => {
      void resolveLatest(repo).then((url) => {
        if (url) link.href = url
      })
    }
    link.addEventListener('pointerenter', warm, { once: true })
    link.addEventListener('focus', warm, { once: true })

    link.addEventListener('click', (e) => {
      // The download IS the conversion now, so it gets the same best-effort
      // signal /start's trial links get — fired without delaying the click.
      trackSite('download_clicked')
      if (resolved) return // href already points straight at the .dmg
      e.preventDefault()
      void resolveLatest(repo).then((url) => {
        window.location.href = url || link.href
      })
    })
  })
}
