// A one-shot handoff of the fresh-start opening prompt from the onboarding flow
// into the editor. The Fresh-start path drops the user into a new entry with a
// gentle reflective prompt shown as a PLACEHOLDER (never committed text); the
// editor reads it once for the first empty entry, then it's consumed.

let pendingSeedPrompt: string | null = null

export function setSeedPrompt(prompt: string): void {
  pendingSeedPrompt = prompt
}

/** Read-and-clear the pending seed prompt. Returns null when none is pending. */
export function consumeSeedPrompt(): string | null {
  const p = pendingSeedPrompt
  pendingSeedPrompt = null
  return p
}
