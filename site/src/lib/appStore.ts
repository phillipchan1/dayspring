// Every `[data-dl-ios]` link goes straight to the App Store listing — no
// resolution to do, unlike the .dmg in macDownload.ts. All this adds is the
// click signal, fired without intercepting or delaying the navigation.

import { trackSite } from './siteAnalytics'

export function wireAppStoreLinks(): void {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[data-dl-ios]')
  links.forEach((link) => {
    // Nav and DownloadCTA both call this on the same page; wire each link once.
    if (link.hasAttribute('data-dl-wired')) return
    link.setAttribute('data-dl-wired', '')
    link.addEventListener('click', () => trackSite('app_store_clicked'))
  })
}
