"use client"

import React from "react"
import useSWR from "swr"
import { useParams } from "next/navigation"
import { b64urlDecode, tenantKeyFrom, stripPrefix, isPrefixedEncoded } from "@/lib/encoding"
import { sbFetch, type SupaEnv } from "@/lib/supabase-rest"

function shuffle<T>(arr: T[]) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function sanitizeHtml(html: string) {
  if (!html) return ""
  // rudimentary sanitizer: strip script/style/iframe and on* handlers
  let out = html
  out = out.replace(/<\s*(script|style|iframe)[^>]*>.*?<\s*\/\s*\1\s*>/gis, "")
  out = out.replace(/\son\w+="[^"]*"/g, "")
  out = out.replace(/\son\w+='[^']*'/g, "")
  return out
}

export default function QuizTakePage() {
  const params = useParams() as { t: string; b: string; quizId: string }
  const rawT = Array.isArray(params.t) ? params.t[0] : params.t
  const rawB = Array.isArray(params.b) ? params.b[0] : params.b

  const pantryId = isPrefixedEncoded(rawT) ? b64urlDecode(stripPrefix(rawT)) : rawT
  const bucket = isPrefixedEncoded(rawB) ? b64urlDecode(stripPrefix(rawB)) : rawB

  const [env, setEnv] = React.useState<SupaEnv | null>(null)
  const [user, setUser] = React.useState<any | null>(null) // quiz_users row
  const [attemptId, setAttemptId] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)
  const [score, setScore] = React.useState<number | null>(null)

  // fetch supabase creds from pantry
  React.useEffect(() => {
    async function run() {
      const res = await fetch("/api/pantry/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pantryId, bucket }),
      })
      if (!res.ok) return
      const json = await res.json()
      const supabaseUrl = json?.data?.supabaseUrl
      const supabaseAnonKey = json?.data?.supabaseAnonKey
      const tenantKey = tenantKeyFrom(pantryId, bucket)
      if (supabaseUrl && supabaseAnonKey) setEnv({ supabaseUrl, supabaseAnonKey, tenantKey })
    }
    run()
  }, [pantryId, bucket])

  const { data: quiz, error: quizError } = useSWR(env ? ["quiz", params.quizId] : null, async () => {
    const q = await sbFetch<any[]>(env!, `quizzes?id=eq.${params.quizId}&select=*`)
    if (q.error) throw new Error(q.error)
    return q.data?.[0] || null
  })

  const { data: qna } = useSWR(env ? ["qna", params.quizId] : null, async () => {
    const questions = await sbFetch<any[]>(env!, `questions?select=*&quiz_id=eq.${params.quizId}`)
    if (questions.error) throw new Error(questions.error)
    const qIds = (questions.data || []).map((x) => x.id)
    if (!qIds.length) return []
    const inList = qIds.join(",")
    const options = await sbFetch<any[]>(env!, `options?select=*&question_id=in.(${inList})`)
    if (options.error) throw new Error(options.error)
    return (questions.data || []).map((q) => ({
      ...q,
      options: shuffle((options.data || []).filter((o) => o.question_id === q.id)),
    }))
  })

  async function login(userId: string, password: string) {
    if (!env) return
    const res = await sbFetch<any[]>(
      env,
      `quiz_users?select=*&user_id=eq.${encodeURIComponent(userId)}&password=eq.${encodeURIComponent(password)}`,
    )
    if (res.error) return alert(res.error)
    const u = res.data?.[0]
    if (!u) return alert("Invalid credentials")
    setUser(u)
  }

  async function startAttempt() {
    if (!env || !user) return
    const res = await sbFetch<any[]>(env, "quiz_attempts", {
      method: "POST",
      body: [{ tenant_key: env.tenantKey, quiz_id: params.quizId, quiz_user_id: user.id }],
    })
    if (res.error) return alert(res.error)
    setAttemptId(res.data?.[0]?.id)
  }

  async function submitAnswers(answers: { question_id: string; selected_option_id: string; is_correct: boolean }[]) {
    if (!env || !attemptId) return
    const ins = await sbFetch<any[]>(env, "quiz_answers", {
      method: "POST",
      body: answers.map((a) => ({ tenant_key: env.tenantKey, attempt_id: attemptId, ...a })),
    })
    if (ins.error) return alert(ins.error)
    const sc = answers.filter((a) => a.is_correct).length
    setScore(sc)
    await sbFetch(env, `quiz_attempts?id=eq.${attemptId}`, {
      method: "PATCH",
      body: { score: sc, completed_at: new Date().toISOString() },
    })
    setDone(true)
  }

  if (!env) return <div className="p-4 text-white max-w-3xl mx-auto">Loading...</div>
  if (!quiz) return <div className="p-4 text-white max-w-3xl mx-auto">Quiz not found.</div>
  if (!user)
    return (
      <div className="p-4 text-white max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold mb-2">{quiz.title}</h2>
        <p className="opacity-80 mb-4">{quiz.description}</p>
        <LoginForm onLogin={login} />
      </div>
    )

  if (!attemptId)
    return (
      <div className="p-4 text-white max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">{quiz.title}</h2>
        <button className="px-4 py-2 rounded bg-cyan-500 text-black" onClick={startAttempt}>
          Start Quiz
        </button>
      </div>
    )

  if (!qna?.length) return <div className="p-4 text-white max-w-3xl mx-auto">No questions.</div>

  return (
    <div className="p-4 text-white max-w-3xl mx-auto space-y-4">
      {done ? (
        <div className="p-3 rounded-md bg-white/5 border border-white/10">
          <div className="text-lg font-semibold">Your Score: {score}</div>
          <div className="mt-3 space-y-3">
            {qna.map((q: any, idx: number) => {
              const correct = q.options.find((o: any) => o.is_correct)
              return (
                <div key={q.id}>
                  <div className="font-medium">
                    Q{idx + 1}. {q.prompt}
                  </div>
                  <div className="text-sm opacity-90">Correct: {correct?.option_text}</div>
                  {q.solution_video_url ? (
                    <div className="mt-2">
                      <a
                        className="underline text-cyan-400"
                        href={q.solution_video_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Answer video
                      </a>
                    </div>
                  ) : null}
                  {q.solution_text ? (
                    <div
                      className="mt-1 text-sm opacity-90"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.solution_text) }}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <QuizAttempt qna={qna} onSubmit={(ans) => submitAnswers(ans)} />
      )}
    </div>
  )
}

function LoginForm({ onLogin }: { onLogin: (userId: string, password: string) => void }) {
  const [userId, setUserId] = React.useState("")
  const [password, setPassword] = React.useState("")
  return (
    <div className="p-3 rounded-md bg-white/5 border border-white/10">
      <div className="grid gap-2">
        <label className="text-sm opacity-90">User ID</label>
        <input
          className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
      </div>
      <div className="grid gap-2 mt-2">
        <label className="text-sm opacity-90">Password</label>
        <input
          type="password"
          className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button
        className="px-3 py-2 rounded bg-cyan-500 text-black text-sm mt-3"
        onClick={() => onLogin(userId, password)}
      >
        Login
      </button>
    </div>
  )
}

function QuizAttempt({
  qna,
  onSubmit,
}: {
  qna: any[]
  onSubmit: (answers: { question_id: string; selected_option_id: string; is_correct: boolean }[]) => void
}) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({}) // question_id -> option_id
  function choose(qid: string, oid: string) {
    setAnswers((a) => ({ ...a, [qid]: oid }))
  }
  function submit() {
    const result = qna.map((q) => {
      const selected = answers[q.id]
      const correct = q.options.find((o: any) => o.is_correct)
      return {
        question_id: q.id,
        selected_option_id: selected,
        is_correct: selected === correct?.id,
      }
    })
    onSubmit(result)
  }
  return (
    <div className="space-y-4">
      {qna.map((q, idx) => (
        <div key={q.id} className="p-3 rounded-md bg-white/5 border border-white/10">
          <div className="font-medium">
            Q{idx + 1}. {q.prompt}
          </div>
          <div className="mt-2 space-y-2">
            {q.options.map((o: any) => (
              <label key={o.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={answers[q.id] === o.id}
                  onChange={() => choose(q.id, o.id)}
                />
                <span>{o.option_text}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <button className="px-4 py-2 rounded bg-cyan-500 text-black" onClick={submit}>
        Submit
      </button>
    </div>
  )
}
