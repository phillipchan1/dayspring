import { openExternal } from '@/lib/openExternal'
import { legalUrl } from '@/lib/legal'
import './Paywall.css'

/**
 * The disclosure Apple requires on any screen that sells a subscription
 * (App Store Review Guideline 3.1.2 + Schedule 2 of the Paid Apps agreement).
 *
 * Missing or incomplete versions of this block are one of the most common
 * causes of rejection, and the requirement is specific: length of subscription,
 * price, the fact that it auto-renews, how to cancel, and *functional* links to
 * both a Terms of Use (EULA) and a Privacy Policy.
 *
 * Links go through openExternal, not target="_blank". Inside the Tauri webview a
 * plain _blank either does nothing or — worse — navigates the app itself away to
 * the web origin, stranding a session-less webview (the same trap documented in
 * openExternal.ts). See lib/legal.ts for where the URLs come from.
 *
 * The copy is intentionally plain. Per PRINCIPLES, the paywall states what is
 * true and lets the reader decide; it does not press.
 */

export function AppleSubscriptionTerms() {
  return (
    <div className="apple-terms">
      {/* "Starts today" leads because there is no introductory offer: the plan
          bills at confirmation (Guideline 3.1.2(c), 2026-09-17 and -21). This
          is the one place a purchase surface says it, and it stays short:
          Apple needs length, price, auto-renewal and how to cancel, no more. */}
      <p className="apple-terms__body">
        Starts today, billed to your Apple Account at confirmation. Renews automatically unless
        cancelled at least 24 hours before the period ends. Cancel anytime in Apple Account
        settings.
      </p>
      <p className="apple-terms__links">
        <TermsLink href={legalUrl('terms')} label="Terms of Use" />
        <span aria-hidden> · </span>
        <TermsLink href={legalUrl('privacy')} label="Privacy Policy" />
      </p>
    </div>
  )
}

function TermsLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="apple-terms__link"
      onClick={(e) => {
        e.preventDefault()
        void openExternal(href)
      }}
    >
      {label}
    </a>
  )
}
