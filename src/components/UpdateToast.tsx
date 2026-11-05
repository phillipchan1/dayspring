import { useAppUpdate } from '@/hooks/useAppUpdate'
import { usePresence } from '@/hooks/usePresence'

// Small bottom-left prompt shown when a new desktop version has been downloaded
// and staged. Mirrors Claude Desktop: the update is already installed, clicking
// Restart just relaunches into it. Renders nothing on web or until ready.
export function UpdateToast() {
  const { state, restart } = useAppUpdate()

  // The toast only speaks up for in-progress / ready states. Manual-check
  // feedback ("checking", "up to date", "error") shows in Settings, not here.
  const speaking = state.status === 'downloading' || state.status === 'ready'
  // When it stops speaking (a download that failed, say) it fades out with what
  // it last said, rather than blinking away mid-sentence (usePresence).
  const presence = usePresence(speaking ? state : null)
  const shown = presence.value
  if (!presence.mounted || !shown) return null

  const downloading = shown.status === 'downloading'

  return (
    <div
      ref={presence.ref}
      className="update-toast"
      role="status"
      aria-live="polite"
      data-state={presence.state}
    >
      <div className="update-toast__row">
        <span className="update-toast__dot" data-mode={shown.status} aria-hidden />
        <span className="update-toast__text">
          {downloading ? (
            <>Downloading update…</>
          ) : (
            <>
              Update ready <span className="update-toast__ver">v{shown.version}</span>
            </>
          )}
        </span>
        {!downloading && (
          <button className="update-toast__btn" onClick={() => void restart()}>
            Restart
          </button>
        )}
      </div>
      {!downloading && shown.notes && (
        <details className="update-toast__notes">
          <summary>What’s new</summary>
          <div className="update-toast__notes-body">{shown.notes}</div>
        </details>
      )}
    </div>
  )
}
