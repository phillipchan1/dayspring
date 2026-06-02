import Stripe from 'stripe'
import { env } from './env.js'

let _stripe: Stripe | null = null

export function stripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(env.stripeSecretKey(), {
      apiVersion: '2026-05-27.dahlia',
    })
  }
  return _stripe
}
