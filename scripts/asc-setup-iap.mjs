#!/usr/bin/env node
/**
 * Create / verify Dayspring IAP subscriptions in App Store Connect via API.
 *
 * Requires an In-App Purchase key (Users and Access → Integrations → In-App Purchase):
 *
 *   export APPLE_ISSUER_ID=...
 *   export APPLE_KEY_ID=...
 *   export APPLE_PRIVATE_KEY="$(cat AuthKey_XXXXX.p8)"
 *   # optional override; defaults to the known Dayspring app
 *   export APPLE_APP_APPLE_ID=6776925077
 *
 *   node scripts/asc-setup-iap.mjs
 *
 * Creates (idempotent where ASC allows):
 *   - Subscription group "Dayspring Premium"
 *   - dayspring_monthly  @ $7.99 / month  (no intro offer)
 *   - dayspring_annual   @ $69.99 / year   (no intro offer)
 *   - EN localizations + USA base price (+ equalizations for all territories)
 *
 * Does NOT submit products for review (needs a build attached in ASC UI).
 * Does NOT upload the review screenshot — upload assets/appstore/iap-review-screenshot.png
 * under each product’s Review Information in ASC.
 */

import { createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ASC = 'https://api.appstoreconnect.apple.com'
const APP_APPLE_ID = process.env.APPLE_APP_APPLE_ID || '6776925077'

const PRODUCTS = [
  {
    productId: 'dayspring_monthly',
    name: 'Dayspring Monthly',
    period: 'ONE_MONTH',
    // US price point customer price we want — looked up from ASC price points
    targetCustomerPrice: '7.99',
    localizationName: 'Dayspring Monthly',
    localizationDesc:
      'Full access to Dayspring — your journal, reflections, and the shape of your walk with God — billed monthly.',
  },
  {
    productId: 'dayspring_annual',
    name: 'Dayspring Annual',
    period: 'ONE_YEAR',
    targetCustomerPrice: '69.99',
    localizationName: 'Dayspring Annual',
    localizationDesc:
      'Full access to Dayspring — your journal, reflections, and the shape of your walk with God — billed yearly.',
  },
]

function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

function appleJwt() {
  const issuerId = requireEnv('APPLE_ISSUER_ID')
  const keyId = requireEnv('APPLE_KEY_ID')
  let privateKey = requireEnv('APPLE_PRIVATE_KEY')
  // Vercel / dotenv often store newlines as literal \n
  privateKey = privateKey.replace(/\\n/g, '\n')

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString(
    'base64url',
  )
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 20 * 60,
      aud: 'appstoreconnect-v1',
    }),
  ).toString('base64url')

  const sign = createSign('SHA256')
  sign.update(`${header}.${payload}`)
  sign.end()
  const sig = sign.sign(privateKey).toString('base64url')
  return `${header}.${payload}.${sig}`
}

async function asc(method, pathname, body) {
  const res = await fetch(`${ASC}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${appleJwt()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(`${method} ${pathname} → ${res.status}`)
    err.status = res.status
    err.body = json
    throw err
  }
  return json
}

async function findApp() {
  const json = await asc(
    'GET',
    `/v1/apps?filter[appleId]=${APP_APPLE_ID}&fields[apps]=bundleId,name`,
  )
  const app = json.data?.[0]
  if (!app) throw new Error(`No app found for Apple ID ${APP_APPLE_ID}`)
  console.log(`App: ${app.attributes.name} (${app.attributes.bundleId}) id=${app.id}`)
  return app
}

async function ensureGroup(appId) {
  const existing = await asc('GET', `/v1/apps/${appId}/subscriptionGroups`)
  const found = (existing.data || []).find(
    (g) => g.attributes?.referenceName === 'Dayspring Premium',
  )
  if (found) {
    console.log(`Subscription group exists: ${found.id}`)
    return found
  }
  const created = await asc('POST', '/v1/subscriptionGroups', {
    data: {
      type: 'subscriptionGroups',
      attributes: { referenceName: 'Dayspring Premium' },
      relationships: {
        app: { data: { type: 'apps', id: appId } },
      },
    },
  })
  console.log(`Created subscription group: ${created.data.id}`)
  // EN localization for the group name shown in Manage Subscriptions
  try {
    await asc('POST', '/v1/subscriptionGroupLocalizations', {
      data: {
        type: 'subscriptionGroupLocalizations',
        attributes: { name: 'Dayspring Premium', locale: 'en-US' },
        relationships: {
          subscriptionGroup: { data: { type: 'subscriptionGroups', id: created.data.id } },
        },
      },
    })
  } catch (e) {
    if (e.status !== 409) throw e
  }
  return created.data
}

async function ensureSubscription(groupId, product) {
  const list = await asc('GET', `/v1/subscriptionGroups/${groupId}/subscriptions`)
  let sub = (list.data || []).find((s) => s.attributes?.productId === product.productId)
  if (sub) {
    console.log(`  ${product.productId} exists: ${sub.id} (${sub.attributes.state})`)
  } else {
    const created = await asc('POST', '/v1/subscriptions', {
      data: {
        type: 'subscriptions',
        attributes: {
          name: product.name,
          productId: product.productId,
          subscriptionPeriod: product.period,
          familySharable: false,
        },
        relationships: {
          group: { data: { type: 'subscriptionGroups', id: groupId } },
        },
      },
    })
    sub = created.data
    console.log(`  Created ${product.productId}: ${sub.id}`)
  }

  // Localization
  try {
    await asc('POST', '/v1/subscriptionLocalizations', {
      data: {
        type: 'subscriptionLocalizations',
        attributes: {
          name: product.localizationName,
          description: product.localizationDesc,
          locale: 'en-US',
        },
        relationships: {
          subscription: { data: { type: 'subscriptions', id: sub.id } },
        },
      },
    })
    console.log(`  EN localization set`)
  } catch (e) {
    if (e.status === 409) console.log(`  EN localization already present`)
    else console.warn(`  localization warn:`, e.body?.errors?.[0]?.detail || e.message)
  }

  // Pricing — find USA price point matching targetCustomerPrice
  const points = await asc(
    'GET',
    `/v1/subscriptions/${sub.id}/pricePoints?filter[territory]=USA&limit=200`,
  )
  const match = (points.data || []).find(
    (p) => p.attributes?.customerPrice === product.targetCustomerPrice,
  )
  if (!match) {
    console.warn(
      `  No USA price point for $${product.targetCustomerPrice} — set pricing manually in ASC`,
    )
    return sub
  }

  // Current prices
  const prices = await asc('GET', `/v1/subscriptions/${sub.id}/prices?include=subscriptionPricePoint`)
  const hasUsa = (prices.data || []).some((p) => {
    const ppId = p.relationships?.subscriptionPricePoint?.data?.id
    return ppId === match.id
  })
  if (hasUsa && (prices.data || []).length > 0) {
    console.log(`  Pricing already configured (${(prices.data || []).length} territories)`)
    return sub
  }

  // Set USA base price (startDate null = immediate)
  await asc('POST', '/v1/subscriptionPrices', {
    data: {
      type: 'subscriptionPrices',
      attributes: { startDate: null },
      relationships: {
        subscription: { data: { type: 'subscriptions', id: sub.id } },
        subscriptionPricePoint: { data: { type: 'subscriptionPricePoints', id: match.id } },
      },
    },
  })
  console.log(`  USA price set to $${product.targetCustomerPrice}`)

  // Equalizations for other territories
  const eqs = await asc('GET', `/v1/subscriptionPricePoints/${match.id}/equalizations?limit=200`)
  let set = 1
  for (const eq of eqs.data || []) {
    try {
      await asc('POST', '/v1/subscriptionPrices', {
        data: {
          type: 'subscriptionPrices',
          attributes: { startDate: null },
          relationships: {
            subscription: { data: { type: 'subscriptions', id: sub.id } },
            subscriptionPricePoint: { data: { type: 'subscriptionPricePoints', id: eq.id } },
          },
        },
      })
      set++
    } catch (e) {
      if (e.status !== 409) {
        // some territories may already have a price
        console.warn(`  price eq skip:`, e.body?.errors?.[0]?.detail || e.message)
      }
    }
  }
  console.log(`  Prices set for ~${set} territories`)
  return sub
}

async function main() {
  console.log('App Store Connect IAP setup')
  console.log('Review screenshot to upload manually:')
  console.log(`  ${path.join(ROOT, 'assets/appstore/iap-review-screenshot.png')}`)
  console.log(`  ${path.join(ROOT, 'src-tauri/icon-1024.png')} (optional product image)`)
  console.log('')

  const app = await findApp()
  const group = await ensureGroup(app.id)
  for (const product of PRODUCTS) {
    console.log(`\n${product.productId}:`)
    await ensureSubscription(group.id, product)
  }

  console.log(`
Done. Next in App Store Connect UI:
  1. Confirm neither product has an introductory offer
  2. Upload assets/appstore/iap-review-screenshot.png under Review Information
  3. Set App Store Server Notifications V2 URL:
     https://dayspring-eosin.vercel.app/api/webhooks/apple
  4. Submit subscriptions with the new app version for review
`)
}

main().catch((e) => {
  console.error(e.message)
  if (e.body) console.error(JSON.stringify(e.body, null, 2))
  process.exit(1)
})
