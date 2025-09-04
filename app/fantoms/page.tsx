"use client"

import { useMemo, useState } from "react"
import { LoaderScreen } from "@/components/loader-screen"
import { AuthForm } from "@/components/auth-form"
import { SqlInstructions } from "@/components/sql-instructions"
import { DashboardTab } from "@/components/dashboard-tab"
import { QuizzesTab } from "@/components/quizzes-tab"
import { UsersTab } from "@/components/users-tab"
import { ShaderBackground } from "@/components/shader-background"

export type EnvPayload = {
  supabaseUrl: string
  supabaseAnonKey: string
  openrouterKey: string
}

type Step = "loader" | "auth" | "sql" | "main"
type Tab = "dashboard" | "quizzes" | "users"

export default function FantomsPage() {
  const [step, setStep] = useState<Step>("loader")
  const [tab, setTab] = useState<Tab>("dashboard")
  const [pantryId, setPantryId] = useState("")
  const [bucket, setBucket] = useState("")
  const [env, setEnv] = useState<EnvPayload | null>(null)

  const supaEnv = useMemo(() => {
    if (!env || !pantryId || !bucket) return null
    return {
      supabaseUrl: env.supabaseUrl,
      supabaseAnonKey: env.supabaseAnonKey,
      tenantKey: `${pantryId}:${bucket}`,
    }
  }, [env, pantryId, bucket])

  return (
    <main className="relative min-h-screen">
      <ShaderBackground />
      <div className="relative z-10 container mx-auto max-w-2xl px-4 py-8 text-white">
        {step === "loader" && <LoaderScreen onDone={() => setStep("auth")} />}

        {step === "auth" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-semibold">Fantoms</h1>
            <p className="text-white/80">
              Sign up to connect your Pantry and Supabase, or log in with existing Pantry details.
            </p>
            <AuthForm
              onSignupDone={({ pantryId, bucket, env }) => {
                setPantryId(pantryId)
                setBucket(bucket)
                setEnv(env)
                setStep("sql")
              }}
              onSignupComplete={({ pantryId, bucket, supabaseUrl, supabaseAnonKey, openrouterKey }) => {
                setPantryId(pantryId)
                setBucket(bucket)
                setEnv({ supabaseUrl, supabaseAnonKey, openrouterKey })
                setStep("sql")
              }}
              onLoginComplete={({ pantryId, bucket, supabaseUrl, supabaseAnonKey }) => {
                setPantryId(pantryId)
                setBucket(bucket)
                setEnv({ supabaseUrl, supabaseAnonKey, openrouterKey: "" })
                setStep("main")
              }}
            />
          </div>
        )}

        {step === "sql" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">One-time setup</h2>
            <p className="text-white/80">Run the SQL in your Supabase project. Then continue.</p>
            <SqlInstructions 
              supabaseUrl={env?.supabaseUrl || ""}
              onContinue={() => setStep("main")}
              onBack={() => setStep("auth")}
            />
          </div>
        )}

        {step === "main" && env && (
          <div className="space-y-6">
            <div className="flex gap-3">
              <button
                className={`px-3 py-1 rounded ${tab === "dashboard" ? "bg-white text-black" : "bg-white/10 text-white"}`}
                onClick={() => setTab("dashboard")}
              >
                Dashboard
              </button>
              <button
                className={`px-3 py-1 rounded ${tab === "quizzes" ? "bg-white text-black" : "bg-white/10 text-white"}`}
                onClick={() => setTab("quizzes")}
              >
                Quizzes
              </button>
              <button
                className={`px-3 py-1 rounded ${tab === "users" ? "bg-white text-black" : "bg-white/10 text-white"}`}
                onClick={() => setTab("users")}
              >
                Users
              </button>
            </div>

            {tab === "dashboard" && <DashboardTab />}
            {tab === "quizzes" && <QuizzesTab />}
            {tab === "users" && <UsersTab />}
          </div>
        )}

        {!env && step === "main" && <p className="text-red-300">Missing environment. Please log in again.</p>}
      </div>
    </main>
  )
}
