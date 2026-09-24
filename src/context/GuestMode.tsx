import { createContext, useContext, type ReactNode } from 'react'

export interface GuestModeValue {
  /** True when this session is writing on-device with no account. */
  isGuest: boolean
  /** Open the sign-in overlay (sync, backup, subscribe, restore, cloud surfaces). */
  requestSignIn: () => void
}

const GuestModeContext = createContext<GuestModeValue>({
  isGuest: false,
  requestSignIn: () => {},
})

export function GuestModeProvider({
  requestSignIn,
  children,
}: {
  requestSignIn: () => void
  children: ReactNode
}) {
  return (
    <GuestModeContext.Provider value={{ isGuest: true, requestSignIn }}>
      {children}
    </GuestModeContext.Provider>
  )
}

export function useGuestMode(): GuestModeValue {
  return useContext(GuestModeContext)
}
