"use client"
import useSWR from "swr"
import { useFantoms } from "./fantoms-context"
import { sbFetch, type SupaEnv } from "@/lib/supabase-rest"

export function DashboardTab() {
  const { pantryId, bucket, supabaseUrl, supabaseAnonKey, tenantKey, error: pantryError, loading } = useFantoms()
  const env: SupaEnv | null =
    supabaseUrl && supabaseAnonKey && tenantKey ? { supabaseUrl, supabaseAnonKey, tenantKey } : null

  const { data, error, isLoading } = useSWR(env ? ["dashboard-stats", env.tenantKey] : null, async () => {
    const quizzes = await sbFetch<any[]>(env!, "quizzes?select=id,status")
    const users = await sbFetch<any[]>(env!, "quiz_users?select=id")
    const attempts = await sbFetch<any[]>(env!, "quiz_attempts?select=id,completed_at")
    if (quizzes.error || users.error || attempts.error)
      throw new Error(quizzes.error || users.error || attempts.error || "stats error")
    const totalQuizzes = quizzes.data?.length || 0
    const activeQuizzes = quizzes.data?.filter((q) => q.status === "active")?.length || 0
    const totalUsers = users.data?.length || 0
    const totalAttempts = attempts.data?.length || 0
    const completedAttempts = attempts.data?.filter((a) => a.completed_at)?.length || 0
    return { totalQuizzes, activeQuizzes, totalUsers, totalAttempts, completedAttempts }
  })

  return (
    <div className="p-4 text-white space-y-4">
      <h2 className="text-xl font-semibold">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pantry" value={pantryError ? "Error" : pantryId && bucket ? "OK" : "Not set"} />
        <Stat label="Supabase" value={supabaseUrl && supabaseAnonKey ? "OK" : "Not set"} />
        <Stat label="Quizzes" value={isLoading ? "-" : (data?.totalQuizzes ?? 0)} />
        <Stat label="Active" value={isLoading ? "-" : (data?.activeQuizzes ?? 0)} />
        <Stat label="Users" value={isLoading ? "-" : (data?.totalUsers ?? 0)} />
        <Stat label="Attempts" value={isLoading ? "-" : (data?.totalAttempts ?? 0)} />
        <Stat label="Completed" value={isLoading ? "-" : (data?.completedAttempts ?? 0)} />
      </div>
      {error ? <div className="opacity-80">Failed to load stats.</div> : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="p-3 rounded-md bg-white/5 border border-white/10">
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}

export default DashboardTab