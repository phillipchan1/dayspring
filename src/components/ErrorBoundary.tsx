import { Component, type ErrorInfo, type ReactNode } from 'react'
import { buildCrashPayload, reportCrash } from '@/lib/crashReport'
import './ErrorBoundary.css'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode
  /**
   * `root`    — last-resort wrapper around <App>. Full-screen, only offers Reload.
   * `surface` — wraps authenticated content. Shows in-shell fallback with
   *             Go Home + Try Again so the user stays in the app.
   */
  variant: 'root' | 'surface'
  /** Current surface name (journal, altar, etc.) — attached to crash reports. */
  surface?: string
  /** Called when the user clicks "Go Home". Only used for surface variant. */
  onGoHome?: () => void
}

interface State {
  error: Error | null
  /** How many times we've auto-retried for this crash. */
  retries: number
  /** Show the collapsed technical details pane. */
  showDetails: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * React class-based Error Boundary.
 *
 * Two variants:
 * - `root`    — catches everything, full-screen reload-only fallback.
 * - `surface` — catches surface crashes, shows elegant in-shell fallback
 *               with Go Home / Try Again. Auto-retries once silently.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retries: 0, showDetails: false }
  private componentStack: string | undefined

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.componentStack = info.componentStack ?? undefined

    // Auto-retry once silently — catches transient errors (stale cache, race).
    if (this.state.retries === 0) {
      this.setState((s) => ({ error: null, retries: s.retries + 1 }))
      return
    }

    // Report on second failure.
    reportCrash(
      buildCrashPayload(error, this.componentStack, this.props.surface),
    )
  }

  private handleRetry = () => {
    this.componentStack = undefined
    this.setState({ error: null, retries: 0, showDetails: false })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    this.componentStack = undefined
    this.setState({ error: null, retries: 0, showDetails: false })
    this.props.onGoHome?.()
  }

  private toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }))
  }

  render() {
    if (!this.state.error) return this.props.children

    const { variant } = this.props
    const { error } = this.state

    // ----- Root variant: full-screen, only reload -----
    if (variant === 'root') {
      return (
        <div className="error-boundary error-boundary--root" role="alert">
          <div className="error-boundary__inner">
            <span className="error-boundary__mark" aria-hidden />
            <p className="error-boundary__label">Something went wrong.</p>
            <p className="error-boundary__sub">
              The app ran into an unexpected error. Reloading should fix it.
            </p>
            <div className="error-boundary__actions">
              <button
                type="button"
                className="error-boundary__btn error-boundary__btn--primary"
                onClick={this.handleReload}
              >
                Reload
              </button>
            </div>
            {this.renderDetails(error)}
          </div>
        </div>
      )
    }

    // ----- Surface variant: in-shell, retry + go home -----
    return (
      <div className="error-boundary error-boundary--surface" role="alert">
        <div className="error-boundary__inner">
          <span className="error-boundary__mark" aria-hidden />
          <p className="error-boundary__label">Something stumbled.</p>
          <p className="error-boundary__sub">
            This part of the app hit an error, but your work is safe.
          </p>
          <div className="error-boundary__actions">
            <button
              type="button"
              className="error-boundary__btn error-boundary__btn--ghost"
              onClick={this.handleGoHome}
            >
              Go Home
            </button>
            <button
              type="button"
              className="error-boundary__btn error-boundary__btn--primary"
              onClick={this.handleRetry}
            >
              Try Again
            </button>
          </div>
          {this.renderDetails(error)}
        </div>
      </div>
    )
  }

  private renderDetails(error: Error) {
    const { showDetails } = this.state
    return (
      <div className="error-boundary__details-wrap">
        <button
          type="button"
          className="error-boundary__details-toggle"
          onClick={this.toggleDetails}
          aria-expanded={showDetails}
        >
          Technical details {showDetails ? '▾' : '▸'}
        </button>
        {showDetails && (
          <pre className="error-boundary__details">
            {error.name}: {error.message}
            {this.componentStack ? `\n\nComponent stack:${this.componentStack}` : ''}
          </pre>
        )}
      </div>
    )
  }
}
