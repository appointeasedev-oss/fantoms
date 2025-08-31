"use client"

import React from "react"
import useSWR from "swr"
import { useFantoms } from "./fantoms-context"
import { sbFetch, qs, type SupaEnv } from "@/lib/supabase-rest"

function generateUserId(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${base || "user"}_${suffix}`
}

export function UsersTab() {
  const { supabaseUrl, supabaseAnonKey, tenantKey } = useFantoms()
  const env: SupaEnv | null =
    supabaseUrl && supabaseAnonKey && tenantKey ? { supabaseUrl, supabaseAnonKey, tenantKey } : null

  const {
    data: users,
    mutate,
    error,
    isLoading,
  } = useSWR(env ? ["quiz-users", env.tenantKey] : null, async () => {
    const { data, error } = await sbFetch<any[]>(env!, `quiz_users${qs({ select: "*", order: "created_at.desc" })}`)
    if (error) throw new Error(error)
    return data || []
  })

  const [name, setName] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [lastCreated, setLastCreated] = React.useState<{ user_id: string; password: string } | null>(null)

  async function addUser() {
    if (!env) return
    if (!name.trim() || !password.trim()) return alert("Enter name and password")
    const user_id = generateUserId(name)
    const { error } = await sbFetch<any[]>(env, "quiz_users", {
      method: "POST",
      body: [{ tenant_key: env.tenantKey, name, user_id, password }],
    })
    if (error) return alert(error)
    setLastCreated({ user_id, password }) // <— show inline, no popup
    setName("")
    setPassword("")
    mutate()
  }

  // Helper to load per-user details with quiz names
  async function fetchUserDetails(u: any) {
    const attempts = await sbFetch<any[]>(
      env!,
      `quiz_attempts${qs({ select: "id,score,quiz_id,completed_at", quiz_user_id: `eq.${u.id}` })}`,
    )
    if (attempts.error) throw new Error(attempts.error)
    const arr = attempts.data || []
    const quizIds = Array.from(new Set(arr.map((a: any) => a.quiz_id)))
    let quizzesById: Record<string, string> = {}
    if (quizIds.length) {
      const inList = quizIds.join(",")
      const quizzes = await sbFetch<any[]>(env!, `quizzes${qs({ select: "id,title" })}&id=in.(${inList})`)
      quizzesById = Object.fromEntries((quizzes.data || []).map((q: any) => [q.id, q.title]))
    }
    const attemptsWithNames = arr.map((a: any) => ({ ...a, quiz_title: quizzesById[a.quiz_id] || a.quiz_id }))
    const completed = attemptsWithNames.filter((a: any) => a.completed_at)
    const overall = completed.length
      ? Math.round((completed.reduce((s: number, a: any) => s + (a.score || 0), 0) / completed.length) * 100) / 100
      : 0
    return { attempts: attemptsWithNames, overall }
  }

  function UserItem({ u }: { u: any }) {
    const [show, setShow] = React.useState(false)
    const { data, error } = useSWR(env && show ? ["user-stats-details", u.id] : null, () => fetchUserDetails(u))

    return (
      <div className="p-3 rounded-md bg-white/5 border border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold">{u.name}</div>
            <div className="text-sm opacity-80">User ID: {u.user_id}</div>
          </div>
          <button className="px-2 py-1 rounded bg-white text-black text-xs" onClick={() => setShow((s) => !s)}>
            {show ? "Hide" : "Show"} details
          </button>
        </div>

        {show && (
          <div className="mt-3 text-sm">
            <div className="opacity-80">Password: {u.password}</div>
            {error ? (
              <div className="text-xs opacity-60 mt-1">Stats unavailable</div>
            ) : !data ? (
              <div className="text-xs opacity-60 mt-1">Loading details...</div>
            ) : (
              <>
                <div className="opacity-80 mt-1">Quizzes given: {data.attempts.length}</div>
                <div className="opacity-80">Overall avg score: {data.overall}</div>
                {data.attempts.length ? (
                  <ul className="mt-2 list-disc pl-5">
                    {data.attempts.map((a: any) => (
                      <li key={a.id}>
                        {a.quiz_title} — Score: {a.score} {a.completed_at ? "(completed)" : "(in progress)"}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!env) return <div className="opacity-80">Connect Pantry and Supabase first.</div>

  return (
    <div className="p-4 text-white space-y-4">
      <h2 className="text-xl font-semibold">Users</h2>

      {lastCreated ? (
        <div className="p-3 rounded-md bg-white/10 border border-white/20 text-sm">
          User created — ID: <span className="font-mono">{lastCreated.user_id}</span>, Password:{" "}
          <span className="font-mono">{lastCreated.password}</span>
        </div>
      ) : null}

      <div className="p-3 rounded-md bg-white/5 border border-white/10">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm opacity-90">Name</label>
            <input
              className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm opacity-90">Password</label>
            <input
              className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button className="px-3 py-2 rounded bg-cyan-500 text-black text-sm" onClick={addUser}>
              Add user
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="opacity-80">Loading users...</div>
      ) : error ? (
        <div className="opacity-80">Failed to load users</div>
      ) : (
        <div className="space-y-3">
          {users?.map((u: any) => (
            <UserItem key={u.id} u={u} />
          ))}
        </div>
      )}
    </div>
  )
}

export default UsersTab
