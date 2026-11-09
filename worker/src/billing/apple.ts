import type {
  AppleSubscriptionState,
  VerifiedNotification,
  VerifiedTransaction,
} from '../../../api/_lib/apple.ts'
import {
  resolveAppleSubscription,
  verifySignedNotification,
  verifySignedTransaction,
} from '../../../api/_lib/apple.ts'
import type { Environment } from '@apple/app-store-server-library'

export type AppleFns = {
  verifySignedNotification: (jws: string) => Promise<VerifiedNotification>
  verifySignedTransaction: (jws: string) => Promise<VerifiedTransaction>
  resolveAppleSubscription: (
    anyTransactionId: string,
    environment: Environment,
  ) => Promise<AppleSubscriptionState | null>
}

export const liveApple: AppleFns = {
  verifySignedNotification,
  verifySignedTransaction,
  resolveAppleSubscription,
}

export type { AppleSubscriptionState, VerifiedNotification, VerifiedTransaction }
