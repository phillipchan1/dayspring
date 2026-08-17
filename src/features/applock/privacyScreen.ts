// Tell the native side whether to throw its own cover over the window when iOS
// takes the app-switcher snapshot. See `install_privacy_screen` in
// src-tauri/src/lib.rs for why the JS veil alone isn't enough.
//
// Armed by the presence of a lock, not by whether the lock is currently closed:
// the snapshot has to be clean every time the app leaves the foreground, which
// is precisely when the lock is still open.

import { isIOSTauri } from '@/lib/platform'

export async function setPrivacyScreen(enabled: boolean): Promise<void> {
  if (!isIOSTauri()) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_privacy_screen', { enabled })
  } catch {
    // Older build without the command. The JS veil still covers the common case.
  }
}
