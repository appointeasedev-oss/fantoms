// ---------------- SS-Code ----------------
const ssMap: Record<string, string> = {
  A: "Z", B: "E", C: "F", D: "G", E: "H", F: "I", G: "J", H: "K", I: "L", J: "M",
  K: "N", L: "O", M: "P", N: "Q", O: "R", P: "S", Q: "T", R: "U", S: "V", T: "W",
  U: "X", V: "Y", W: "A", X: "B", Y: "C", Z: "D",

  a: "z", b: "e", c: "f", d: "g", e: "h", f: "i", g: "j", h: "k", i: "l", j: "m",
  k: "n", l: "o", m: "p", n: "q", o: "r", p: "s", q: "t", r: "u", s: "v", t: "w",
  u: "x", v: "y", w: "a", x: "b", y: "c", z: "d",

  "1": "9", "2": "3", "3": "2", "4": "5", "5": "4", "6": "0", "7": "8", "8": "7", "9": "1", "0": "6",
}

const ssReverseMap: Record<string, string> = {}
for (const [k, v] of Object.entries(ssMap)) {
  ssReverseMap[v] = k
}

function ssEncode(text: string): string {
  return text.split("").map(ch => ssMap[ch] || ch).join("")
}

function ssDecode(text: string): string {
  return text.split("").map(ch => ssReverseMap[ch] || ch).join("")
}

// ---------------- Encryption functions ----------------
export function b64urlEncode(input: string) {
  const secured = ssEncode(input) // Apply SS-Code first
  const b64 = typeof btoa !== "undefined" ? btoa(secured) : Buffer.from(secured).toString("base64")
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function b64urlDecode(input: string) {
  const s = input || ""
  if (!/^[A-Za-z0-9\-_]+$/.test(s)) {
    return s
  }
  const sanitized = s.replace(/-/g, "+").replace(/_/g, "/")
  const padLen = (4 - (sanitized.length % 4)) % 4
  const b64 = sanitized + "=".repeat(padLen)
  try {
    const decoded = typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString()
    return ssDecode(decoded) // Apply reverse SS-Code
  } catch {
    return input
  }
}

// ---------------- Tenant helpers ----------------
export function encodeTenant(pantryId: string, bucket: string) {
  return b64urlEncode(`${pantryId}:${bucket}`)
}

export function decodeTenant(encoded: string) {
  const stripped = stripPrefix(encoded)
  let raw = stripped
  if (/^[A-Za-z0-9\-_]+$/.test(stripped)) {
    const maybe = b64urlDecode(stripped)
    if (typeof maybe === "string" && maybe.includes(":")) {
      raw = maybe
    }
  }
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
