import { isIP } from "node:net"
import { lookup } from "node:dns/promises"

export function isBlockedHost(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return true // unparseable → block
  }

  // Only http/https — no file://, ftp://, etc.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true

  const h = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "") // strip IPv6 brackets

  // Named loopback / metadata hostnames
  if (h === "localhost") return true
  if (h === "metadata.google.internal") return true

  // IPv6 loopback, link-local, and ULA. Only apply these checks to real IPv6
  // literals, not normal hostnames that merely begin with "fc" or "fd".
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true
  if (isIP(h) === 6 && (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd"))) return true

  // IPv4 private / reserved ranges
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 0)                              return true // 0.0.0.0/8
    if (a === 10)                             return true // 10.0.0.0/8
    if (a === 127)                            return true // 127.0.0.0/8 loopback
    if (a === 169 && b === 254)               return true // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31)      return true // 172.16.0.0/12
    if (a === 192 && b === 168)               return true // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127)     return true // 100.64.0.0/10 shared space
    if (a === 198 && (b === 18 || b === 19))  return true // 198.18.0.0/15 benchmarking
    if (a === 203 && b === 0 && Number(ipv4[3]) === 113) return true // 203.0.113.0/24 documentation
    if (a >= 224)                             return true // multicast + reserved (224–255)
  }

  return false
}

export async function isBlockedResolvedUrl(rawUrl: string) {
  if (isBlockedHost(rawUrl)) return true
  try {
    const hostname = new URL(rawUrl).hostname
    const addresses = await lookup(hostname, { all: true })
    return addresses.some(({ address }) => isBlockedHost(`http://${address.includes(":") ? `[${address}]` : address}`))
  } catch { return true }
}
