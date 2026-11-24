/** Mac RFC 8252 loopback: the Rust side binds 127.0.0.1 and waits for Safari. */

export async function beginLoopbackOAuth(): Promise<number> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<number>('begin_loopback_oauth')
}

export async function waitLoopbackOAuth(timeoutMs: number): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('wait_loopback_oauth', { timeoutMs })
}

export async function cancelLoopbackOAuth(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('cancel_loopback_oauth')
}
