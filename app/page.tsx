"use client"

import { useEffect, useState } from "react"
import ShaderBackground from "@/components/shader-background"
import LoaderScreen from "@/components/loader-screen"
import AuthForm, { type AuthLoginResult, type AuthSignupResult } from "@/components/auth-form"
import SqlInstructions from "@/components/sql-instructions"
import MainApp from "@/components/main-app"

type Step = "loader" | "auth" | "sql" | "app"

export default function FantomsApp() {
  const [step, setStep] = useState<Step>("loader")

  const [pantryId, setPantryId] = useState<string>("")
  const [bucket, setBucket] = useState<string>("")
  const [supabaseUrl, setSupabaseUrl] = useState<string>("")
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>("")

  useEffect(() => {
    const t = setTimeout(() => setStep("auth"), 2000)
    return () => clearTimeout(t)
  }, [])

  const handleSignupComplete = (r: AuthSignupResult) => {
    setPantryId(r.pantryId)
    setBucket(r.bucket)
    setSupabaseUrl(r.supabaseUrl)
    setSupabaseAnonKey(r.supabaseAnonKey)
    setStep("sql")
  }

  const handleLoginComplete = (r: AuthLoginResult) => {
    setPantryId(r.pantryId)
    setBucket(r.bucket)
    setSupabaseUrl(r.supabaseUrl)
    setSupabaseAnonKey(r.supabaseAnonKey)
    setStep("app")
  }

  return (
    <ShaderBackground>
      <div className="min-h-screen w-full relative flex items-center justify-center p-4">
        {step === "loader" && <LoaderScreen />}

        {step === "auth" && (
          <main className="w-full max-w-sm text-white">
            <AuthForm onSignupComplete={handleSignupComplete} onLoginComplete={handleLoginComplete} />
          </main>
        )}

        {step === "sql" && (
          <main className="w-full max-w-lg text-white">
            <SqlInstructions
              supabaseUrl={supabaseUrl}
              onBack={() => setStep("auth")}
              onContinue={() => setStep("app")}
            />
          </main>
        )}

        {step === "app" && (
          <main className="w-full max-w-4xl text-white">
            <MainApp
              pantryId={pantryId}
              bucket={bucket}
              supabaseUrl={supabaseUrl}
              supabaseAnonKey={supabaseAnonKey}
              onLogout={() => setStep("auth")}
            />
          </main>
        )}
      </div>
    </ShaderBackground>
  )
}
