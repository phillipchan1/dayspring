import { useAppUpdate } from '@/hooks/useAppUpdate'

// Small bottom-left prompt shown when a new desktop version has been downloaded
// and staged. Mirrors Claude Desktop: the update is already installed, clicking
// Restart just relaunches into it. Renders nothing on web or until ready.
export function UpdateToast() {
  const { state, restart } = useAppUpdate()

  if (state.status === 'idle') return null

  const downloading = state.status === 'downloading'

  return (
    <div className="update-toast" role="status" aria-live="polite">
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
  )
}
