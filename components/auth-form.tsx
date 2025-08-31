"use client"

import { useState } from "react"

export type AuthSignupResult = {
  pantryId: string
  bucket: string
  supabaseUrl: string
  supabaseAnonKey: string
  openrouterKey: string
  pantryOk: boolean
}

export type AuthLoginResult = {
  pantryId: string
  bucket: string
  supabaseUrl: string
  supabaseAnonKey: string
  pantryOk: boolean
}

type Props = {
  onSignupComplete: (r: AuthSignupResult) => void
  onLoginComplete: (r: AuthLoginResult) => void
}

async function storeToPantry(pantryId: string, bucket: string, data: unknown) {
  const res = await fetch("/api/pantry/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pantryId, bucket, data }),
  })
  return (await res.json()) as { ok: boolean; status: number; statusText: string; error?: string }
}

async function fetchFromPantry(pantryId: string, bucket: string) {
  const res = await fetch("/api/pantry/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pantryId, bucket }),
  })
  return (await res.json()) as { ok: boolean; data?: any; error?: string; status?: number }
}

export function AuthForm({ onSignupComplete, onLoginComplete }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("signup")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // shared
  const [pantryId, setPantryId] = useState("")
  const [bucket, setBucket] = useState("fantoms")

  // signup-only
  const [supabaseUrl, setSupabaseUrl] = useState("")
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("")
  const [openrouterKey, setOpenrouterKey] = useState("")

  async function handleSignup() {
    setError(null)
    setLoading(true)
    try {
      // Store Supabase URL + anon key inside Pantry bucket
      const payload = {
        supabaseUrl,
        supabaseAnonKey,
        openrouterKey, // <— store key
        savedAt: new Date().toISOString(),
      }
      const pantryRes = await storeToPantry(pantryId.trim(), bucket.trim(), payload)

      onSignupComplete({
        pantryId: pantryId.trim(),
        bucket: bucket.trim(),
        supabaseUrl,
        supabaseAnonKey,
        openrouterKey,
        pantryOk: pantryRes.ok,
      })
    } catch (e: any) {
      setError(e?.message || "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    setError(null)
    setLoading(true)
    try {
      const fetchRes = await fetchFromPantry(pantryId.trim(), bucket.trim())
      if (!fetchRes.ok || !fetchRes.data) {
        setError(fetchRes.error || "Could not fetch stored credentials")
        setLoading(false)
        return
      }

      const creds = fetchRes.data as { supabaseUrl?: string; supabaseAnonKey?: string; openrouterKey?: string }
      if (!creds?.supabaseUrl || !creds?.supabaseAnonKey || !creds?.openrouterKey) {
        setError("Stored credentials incomplete. Please sign up again.")
        setLoading(false)
        return
      }

      onLoginComplete({
        pantryId: pantryId.trim(),
        bucket: bucket.trim(),
        supabaseUrl: creds.supabaseUrl,
        supabaseAnonKey: creds.supabaseAnonKey,
        pantryOk: true,
      })
    } catch (e: any) {
      setError(e?.message || "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm text-white">
      <h1 className="text-2xl font-medium mb-1">Fantoms</h1>
      <p className="text-xs text-white/70 mb-4">Connect Pantry and Supabase.</p>

      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/10 mb-4" role="tablist" aria-label="Auth mode">
        <button
          role="tab"
          aria-selected={mode === "signup"}
          className={`text-sm py-2 rounded-lg transition ${
            mode === "signup" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
          }`}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
        <button
          role="tab"
          aria-selected={mode === "login"}
          className={`text-sm py-2 rounded-lg transition ${
            mode === "login" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
          }`}
          onClick={() => setMode("login")}
        >
          Log in
        </button>
      </div>

      {/* Shared fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs mb-1">Pantry ID</label>
          <input
            className="w-full bg-transparent border border-white/30 rounded-lg px-3 py-2 text-sm placeholder-white/40"
            placeholder="e.g. 9d1b1f0b-...."
            value={pantryId}
            onChange={(e) => setPantryId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Bucket Name</label>
          <input
            className="w-full bg-transparent border border-white/30 rounded-lg px-3 py-2 text-sm placeholder-white/40"
            placeholder="e.g. fantoms"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
          />
        </div>

        {mode === "signup" && (
          <>
            <div>
              <label className="block text-xs mb-1">Supabase URL</label>
              <input
                className="w-full bg-transparent border border-white/30 rounded-lg px-3 py-2 text-sm placeholder-white/40"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Supabase Anon Key</label>
              <input
                className="w-full bg-transparent border border-white/30 rounded-lg px-3 py-2 text-sm placeholder-white/40"
                placeholder="anon key"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                type="password"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">OpenRouter API Key</label>
              <input
                className="w-full bg-transparent border border-white/30 rounded-lg px-3 py-2 text-sm placeholder-white/40"
                placeholder="sk-or-v1-..."
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                type="password"
              />
            </div>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

      <button
        disabled={
          loading || !pantryId || !bucket || (mode === "signup" && (!supabaseUrl || !supabaseAnonKey || !openrouterKey))
        }
        className="w-full mt-4 px-4 py-2 rounded-lg bg-white text-black text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90 transition"
        onClick={mode === "signup" ? handleSignup : handleLogin}
      >
        {loading ? "Please wait..." : mode === "signup" ? "Sign up" : "Log in"}
      </button>

      <p className="text-[10px] text-white/60 mt-3">
        Note: This demo stores your Supabase URL, anon key, and OpenRouter API key in your Pantry bucket. Use test
        credentials only.
      </p>
    </section>
  )
}

export type { Props as AuthFormProps }
export default AuthForm
