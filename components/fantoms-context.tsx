"use client"

import React from "react"
import useSWR from "swr"
import { tenantKeyFrom } from "@/lib/encoding"

type FantomsState = {
  pantryId: string | null
  bucket: string | null
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  tenantKey: string | null
  loading: boolean
  error: string | null
  setPantry: (pid: string, b: string) => void
}

const FantomsCtx = React.createContext<FantomsState | null>(null)

export function FantomsProvider({
  children,
  pantryId: pantryIdProp,
  bucket: bucketProp,
  supabaseUrl: supabaseUrlProp,
  supabaseAnonKey: supabaseAnonKeyProp,
}: {
  children: React.ReactNode
  pantryId?: string
  bucket?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
}) {
  const [pantryId, setPantryId] = React.useState<string | null>(null)
  const [bucket, setBucket] = React.useState<string | null>(null)

  // Initialize from props, falling back to localStorage
  React.useEffect(() => {
    if (pantryIdProp && bucketProp) {
      localStorage.setItem("fantoms.pantryId", pantryIdProp)
      localStorage.setItem("fantoms.bucket", bucketProp)
      setPantryId(pantryIdProp)
      setBucket(bucketProp)
      return
    }
    const pid = localStorage.getItem("fantoms.pantryId")
    const b = localStorage.getItem("fantoms.bucket")
    if (pid && b) {
      setPantryId(pid)
      setBucket(b)
    }
  }, [pantryIdProp, bucketProp])

  const { data, error, isLoading } = useSWR(
    pantryId && bucket ? ["pantry-fetch", pantryId, bucket] : null,
    async () => {
      const res = await fetch("/api/pantry/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pantryId, bucket }),
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      return json?.data || {}
    },
  )

  const supabaseUrl = (supabaseUrlProp ?? data?.supabaseUrl) || null
  const supabaseAnonKey = (supabaseAnonKeyProp ?? data?.supabaseAnonKey) || null
  const tenantKey = pantryId && bucket ? tenantKeyFrom(pantryId, bucket) : null

  const setPantry = React.useCallback((pid: string, b: string) => {
    localStorage.setItem("fantoms.pantryId", pid)
    localStorage.setItem("fantoms.bucket", b)
    setPantryId(pid)
    setBucket(b)
  }, [])

  return (
    <FantomsCtx.Provider
      value={{
        pantryId,
        bucket,
        supabaseUrl,
        supabaseAnonKey,
        tenantKey,
        loading: isLoading,
        error: error ? String(error) : null,
        setPantry,
      }}
    >
      {children}
    </FantomsCtx.Provider>
  )
}

export function useFantoms() {
  const ctx = React.useContext(FantomsCtx)
  if (!ctx) throw new Error("useFantoms must be used within FantomsProvider")
  return ctx
}
