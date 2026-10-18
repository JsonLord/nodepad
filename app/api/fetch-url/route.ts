import { requireAuth } from "@/lib/auth/server"
import { isBlockedHost, isBlockedResolvedUrl } from "@/lib/server/url"
import { NextRequest, NextResponse } from "next/server"

type UrlMeta = {
  title: string
  description: string
  excerpt: string
  statusCode: number
}

function extractMeta(html: string): Omit<UrlMeta, "statusCode"> {
  const tag = (pattern: RegExp) => {
    const m = html.match(pattern)
    return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim() : ""
  }

  const title =
    tag(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
    tag(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i) ||
    tag(/<title[^>]*>([^<]{1,200})<\/title>/i)

  const description =
    tag(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ||
    tag(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i) ||
    tag(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
    tag(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)

  const excerpt = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600)

  return { title: title.slice(0, 200), description: description.slice(0, 400), excerpt }
}

async function fetchUrlMeta(url: string): Promise<UrlMeta | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    let res: Response
    try {
      let current = url
      for (let redirects = 0; ; redirects++) {
        if (await isBlockedResolvedUrl(current)) throw new Error("blocked URL")
        res = await fetch(current, {
        signal: controller.signal,
        headers: {
          "User-Agent": "nodepad/1.0 (+https://nodepad.space)",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "manual",
      })
        if (![301,302,303,307,308].includes(res.status)) break
        if (redirects >= 3) throw new Error("too many redirects")
        const location = res.headers.get("location"); if (!location) break
        current = new URL(location, current).toString()
      }
    } finally {
      clearTimeout(timer)
    }

    const statusCode = res.status
    if (!res.ok) return { title: "", description: "", excerpt: "", statusCode }

    const ct = res.headers.get("content-type") || ""
    if (!ct.includes("text/html")) {
      const kind = ct.split(";")[0].trim()
      return { title: "", description: `Non-HTML resource: ${kind}`, excerpt: "", statusCode }
    }

    if (Number(res.headers.get("content-length") ?? 0) > 2_000_000) return null
    const html = (await res.text()).slice(0, 2_000_000)
    return { ...extractMeta(html), statusCode }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAuth(req)
  if (denied) return denied
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 16_384) return NextResponse.json({ error: "Request too large" }, { status: 413 })
    const { url } = await req.json()
    const urlStr = String(url ?? "")

    if (!urlStr || !/^https?:\/\//i.test(urlStr)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }
    if (isBlockedHost(urlStr)) {
      return NextResponse.json({ error: "Blocked URL" }, { status: 400 })
    }

    const meta = await fetchUrlMeta(urlStr)
    return NextResponse.json(meta)
  } catch {
    return NextResponse.json(null)
  }
}
