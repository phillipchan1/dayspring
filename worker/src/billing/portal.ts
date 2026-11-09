import type Stripe from 'stripe'
import type { Sql } from '../db.ts'
import type { Env } from '../env.ts'
import { planStateByOwner } from './updateSubscription.ts'

export async function handleStripePortal(
  sql: Sql,
  env: Env,
  user: { id: string },
  stripe: {
    billingPortal: {
      sessions: {
        create: (
          params: Stripe.BillingPortal.SessionCreateParams,
        ) => Promise<Pick<Stripe.BillingPortal.Session, 'url'>>
      }
    }
  },
): Promise<Response> {
  const profile = await planStateByOwner(sql, user.id)
  const customerId = profile?.stripe_customer_id
  if (!customerId) {
    return Response.json({ error: 'no subscription found' }, { status: 404 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: env.APP_URL ?? 'https://dayspring-eosin.vercel.app',
  })

  return Response.json({ url: session.url })
}
