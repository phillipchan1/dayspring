import { useAppUpdate } from '@/hooks/useAppUpdate'

// Small bottom-left prompt shown when a new desktop version has been downloaded
// and staged. Mirrors Claude Desktop: the update is already installed, clicking
// Restart just relaunches into it. Renders nothing on web or until ready.
export function UpdateToast() {
  const { state, restart } = useAppUpdate()

  // The toast only speaks up for in-progress / ready states. Manual-check
  // feedback ("checking", "up to date", "error") shows in Settings, not here.
  if (state.status !== 'downloading' && state.status !== 'ready') return null

  const downloading = state.status === 'downloading'

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <div className="update-toast__row">
        <span className="update-toast__dot" data-mode={state.status} aria-hidden />
        <span className="update-toast__text">
          {downloading ? (
            <>Downloading update…</>
          ) : (
            <>
              Update ready <span className="update-toast__ver">v{state.version}</span>
            </>
          )}
        </span>
        {!downloading && (
          <button className="update-toast__btn" onClick={() => void restart()}>
            Restart
          </button>
        )}
      </div>
      {!downloading && state.notes && (
        <details className="update-toast__notes">
          <summary>What’s new</summary>
          <div className="update-toast__notes-body">{state.notes}</div>
        </details>
      )}
    </div>
  )
}
