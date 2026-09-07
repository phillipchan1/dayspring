import { beginExternalTrip } from './appLockSuppress'
import { isIOSTauri } from './platform'

export type IosSelectionAction = 'lookup' | 'share' | 'search' | 'translate' | 'guesses'

/**
 * Native stand-ins for the system edit-menu items we suppress on iOS.
 * Look Up / Share present UIKit sheets; Search Web / Translate leave the app
 * (so we mark an external trip); Replace returns UITextChecker guesses.
 */
export async function iosSelectionAction(
  action: IosSelectionAction,
  text: string,
): Promise<string[] | null> {
  if (!isIOSTauri() || !text.trim()) return null
  if (action === 'search' || action === 'translate') beginExternalTrip()
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<string[] | null>('ios_selection_action', { action, text })
  } catch {
    return null
  }
}
