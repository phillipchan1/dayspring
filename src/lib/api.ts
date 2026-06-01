import { env } from './env'

/** Resolve a serverless API path for web (same-origin) or desktop (Vercel prod). */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = env.apiBaseUrl
  if (!base) return normalized
  return `${base.replace(/\/$/, '')}${normalized}`
}
