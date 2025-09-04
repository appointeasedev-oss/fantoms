"use client"

import { useEffect, useMemo, useState } from "react"
import { makeClient } from "@/lib/supabase-rest"
import { FantomsProvider } from "./fantoms-context"
import DashboardTab from "./dashboard-tab"
import QuizzesTab from "./quizzes-tab"
import UsersTab from "./users-tab"
import SettingsTab from "./settings-tab"

type Props = {
  pantryId: string
  bucket: string
  supabaseUrl: string
  supabaseAnonKey: string
  onLogout: () => void
}

export default function MainApp({ pantryId, bucket, supabaseUrl, supabaseAnonKey, onLogout }: Props) {
  const supa = useMemo(() => makeClient(supabaseUrl, supabaseAnonKey), [supabaseUrl, supabaseAnonKey])
  const [activeTab, setActiveTab] = useState<"Dashboard" | "Quizzes" | "Users" | "Settings">("Dashboard")
  const [status, setStatus] = useState<{ pantry: boolean; supabase: boolean; error?: string }>({
    pantry: Boolean(pantryId && bucket),
    supabase: false,
  })

  // Basic status check: test if tables exist by listing quizzes (should 200 after SQL)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await supa.get("quizzes", { select: "id", limit: 1 })
        if (!cancelled) setStatus((s) => ({ ...s, supabase: r.ok }))
      } catch (e: any) {
        if (!cancelled) setStatus((s) => ({ ...s, supabase: false, error: e.message }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supa])

  return (
    <FantomsProvider pantryId={pantryId} bucket={bucket} supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey}>
      <section className="rounded-xl p-5 backdrop-blur-sm border border-white/10 bg-white/5 text-white">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-medium">Fantoms</h1>
          <button className="px-3 py-2 rounded-lg border border-white/20 text-white" onClick={onLogout}>
            Logout
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(["Dashboard", "Quizzes", "Users", "Settings"] as const).map((t) => (
            <button
              key={t}
              className={`px-3 py-2 rounded-lg text-sm ${
                activeTab === t ? "bg-white text-black" : "border border-white/20 text-white"
              }`}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {activeTab === "Dashboard" && <DashboardTab />}
        {activeTab === "Quizzes" && <QuizzesTab />}
        {activeTab === "Users" && <UsersTab />}
        {activeTab === "Settings" && <SettingsTab />}
      </section>
    </FantomsProvider>
  )
}
