/** Mac RFC 8252 loopback: the Rust side binds 127.0.0.1 and waits for Safari. */

export const LOOPBACK_STATE_RE = /^[0-9a-f]{32}$/

/** 128-bit unguessable state for `/auth-callback/<state>`. */
export function createLoopbackState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function loopbackCallbackMatches(url: string, state: string): boolean {
  if (!LOOPBACK_STATE_RE.test(state)) return false
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'http:' &&
      parsed.hostname === '127.0.0.1' &&
      parsed.pathname === `/auth-callback/${state}`
    )
  } catch {
    return false
  }
}

export async function beginLoopbackOAuth(state: string): Promise<number> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<number>('begin_loopback_oauth', { state })
}

export async function waitLoopbackOAuth(timeoutMs: number): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('wait_loopback_oauth', { timeoutMs })
}

export async function cancelLoopbackOAuth(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('cancel_loopback_oauth')
}
