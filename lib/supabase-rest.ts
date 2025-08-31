export type SupaEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
  tenantKey?: string | null
}

/**
 * Build a PostgREST query string.
 * Example: qs({ select: "*", order: "created_at.desc" }) -> "?select=*&order=created_at.desc"
 * Pass filters like { quiz_id: `eq.${quizId}` } to produce "quiz_id=eq.<id>".
 */
export function qs(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

/**
 * Lightweight Supabase REST fetcher with anon key and optional tenant header.
 * Usage:
 * - GET:  sbFetch(env, `quizzes${qs({ select: "*", order: "created_at.desc" })}`)
 * - POST: sbFetch(env, "quizzes", { method: "POST", body: [{ title: "..." }] })
 * - PATCH/DELETE: sbFetch(env, "quizzes?id=eq.<uuid>", { method: "PATCH", body: { title: "..." } })
 */
export async function sbFetch<T = any>(
  env: SupaEnv,
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: any },
): Promise<{ data: T | null; error: string | null; status?: number }> {
  const base = env.supabaseUrl.replace(/\/+$/, "")
  const url = `${base}/rest/v1/${path}`
  const method = init?.method || "GET"
  const headers: Record<string, string> = {
    apikey: env.supabaseAnonKey,
    Authorization: `Bearer ${env.supabaseAnonKey}`,
    "Content-Type": "application/json",
    Accept: "application/json", // be explicit so PostgREST returns JSON
    Prefer: "return=representation", // ensures inserts/updates return rows
  }
  if (env.tenantKey) {
    headers["x-tenant-key"] = env.tenantKey
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(init?.body ?? undefined),
  })
  if (!res.ok) {
    const text = await res.text()
    return { data: null, error: text || `HTTP ${res.status}`, status: res.status }
  }
  const ct = res.headers.get("content-type") || ""
  if (!ct.includes("application/json")) {
    try {
      const data = await res.json()
      return { data, error: null, status: res.status }
    } catch {
      return { data: null, error: null, status: res.status }
    }
  }
  const data = (await res.json()) as T
  return { data, error: null, status: res.status }
}

export function makeClient(baseUrl: string, anonKey: string) {
  const headersBase = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  }

  function buildUrl(table: string, params?: Record<string, string | number | undefined>) {
    const u = new URL(`${baseUrl}/rest/v1/${table}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) u.searchParams.set(k, String(v))
      })
    }
    return u.toString()
  }

  return {
    async get(table: string, opts?: { select?: string; limit?: number }) {
      const url = buildUrl(table, { select: opts?.select || "id", limit: opts?.limit })
      const res = await fetch(url, { headers: headersBase as any, method: "GET" })
      return { ok: res.ok, data: res.ok ? await res.json() : null, res }
    },
    async list(
      table: string,
      opts?: { select?: string; order?: string; filter?: string },
    ): Promise<{ data: any[] | null; ok: boolean }> {
      const params: Record<string, string> = { select: opts?.select || "*" }
      if (opts?.order) params.order = opts.order
      const url = buildUrl(table, params) + (opts?.filter ? `&${opts.filter}` : "")
      const res = await fetch(url, { headers: headersBase as any, method: "GET" })
      return { ok: res.ok, data: res.ok ? await res.json() : null }
    },
    async count(table: string, filter?: string) {
      const url = buildUrl(table, { select: "id" }) + (filter ? `&${filter}` : "")
      const res = await fetch(url, { headers: { ...headersBase, Prefer: "count=exact" } as any, method: "GET" })
      // Supabase returns Content-Range: 0-0/5
      const range = res.headers.get("Content-Range")
      const count = range?.split("/")?.[1]
      return count ? Number(count) : null
    },
    async insert(table: string, rows: any[]) {
      const url = buildUrl(table)
      const res = await fetch(url, { headers: headersBase as any, method: "POST", body: JSON.stringify(rows) })
      return { ok: res.ok, data: res.ok ? await res.json() : null, error: res.ok ? null : await res.text() }
    },
    async update(table: string, filter: string, patch: any) {
      const url = buildUrl(table) + `?${filter}`
      const res = await fetch(url, { headers: headersBase as any, method: "PATCH", body: JSON.stringify(patch) })
      return { ok: res.ok, data: res.ok ? await res.json() : null, error: res.ok ? null : await res.text() }
    },
    async remove(table: string, filter: string) {
      const url = buildUrl(table) + `?${filter}`
      const res = await fetch(url, { headers: headersBase as any, method: "DELETE" })
      return { ok: res.ok }
    },
  }
}
