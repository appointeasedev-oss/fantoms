export function b64urlEncode(input: string) {
  const b64 = typeof btoa !== "undefined" ? btoa(input) : Buffer.from(input).toString("base64")
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function b64urlDecode(input: string) {
  const s = input || ""
  // If it contains chars outside base64url, treat as plain text (prevents atob errors)
  if (!/^[A-Za-z0-9\-_]+$/.test(s)) {
    return s
  }
  const sanitized = s.replace(/-/g, "+").replace(/_/g, "/")
  const padLen = (4 - (sanitized.length % 4)) % 4
  const b64 = sanitized + "=".repeat(padLen)
  try {
    return typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString()
  } catch {
    return input
  }
}

export function encodeTenant(pantryId: string, bucket: string) {
  return b64urlEncode(`${pantryId}:${bucket}`)
}

export function decodeTenant(encoded: string) {
  // Accept both "b-<base64url>" and plain "pantry:bucket"
  const stripped = stripPrefix(encoded)
  let raw = stripped
  // Only try to decode if it looks base64url-like
  if (/^[A-Za-z0-9\-_]+$/.test(stripped)) {
    const maybe = b64urlDecode(stripped)
    // Use decoded result only if it looks like "pantry:bucket"
    if (typeof maybe === "string" && maybe.includes(":")) {
      raw = maybe
    }
  }
  // If not decoded to "pantry:bucket", but string already contains ":", treat as plain
  const [pantryId = "", bucket = ""] = raw.includes(":") ? raw.split(":") : [raw, ""]
  return { pantryId, bucket }
}

export function tenantKeyFrom(pantryId: string, bucket: string) {
  return b64urlEncode(`${pantryId}|${bucket}`)
}

export function isPrefixedEncoded(v: string) {
  if (typeof v !== "string") return false
  if (!v.startsWith("b-")) return false
  const rest = v.slice(2)
  return /^[A-Za-z0-9\-_]+$/.test(rest)
}

export function stripPrefix(v: string) {
  return v.startsWith("b-") ? v.slice(2) : v
}
