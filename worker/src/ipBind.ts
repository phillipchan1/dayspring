/**
 * The network a sign-in hand-off is bound to (QA2-approved): IPv4 exact,
 * IPv6 its /64 (first four groups), IPv4-mapped IPv6 (::ffff:a.b.c.d)
 * treated as the IPv4 address. A phone keeps its /64 while iOS rotates the
 * interface half of a temporary IPv6 address. Unparseable input is used as is.
 * Shared by the claim fallback (nativeAuth.ts) and the legacy shim.
 */
export function ipBindKey(raw: string | null | undefined): string {
  const ip = (raw ?? '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '')
  if (!ip) return ''
  if (!ip.includes(':')) return ip
  const groups = expandIpv6(ip)
  if (!groups) return ip
  if (groups.slice(0, 5).every((g) => g === '0') && groups[5] === 'ffff') {
    const hi = parseInt(groups[6]!, 16)
    const lo = parseInt(groups[7]!, 16)
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  }
  return `${groups.slice(0, 4).join(':')}::/64`
}

function expandIpv6(ip: string): string[] | null {
  let text = ip
  // Embedded IPv4 tail (e.g. 64:ff9b::1.2.3.4) → two hex groups.
  const v4 = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text)
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number) as [number, number, number, number]
    if ([a, b, c, d].some((n) => n > 255)) return null
    text = `${text.slice(0, v4.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (all.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return all.map((g) => g.replace(/^0+(?=.)/, ''))
}
