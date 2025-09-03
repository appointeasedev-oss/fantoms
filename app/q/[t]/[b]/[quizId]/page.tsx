"use client"

import React from "react"
import useSWR from "swr"
import { useParams } from "next/navigation"
import { b64urlDecode, tenantKeyFrom, stripPrefix, isPrefixedEncoded } from "@/lib/encoding"
import { sbFetch, type SupaEnv } from "@/lib/supabase-rest"
import ShaderBackground from "@/components/shader-background"
import LoaderScreen from "@/components/loader-screen"

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

  const [showLoader, setShowLoader] = React.useState(true)
  const [env, setEnv] = React.useState<SupaEnv | null>(null)
  const [user, setUser] = React.useState<any | null>(null) // quiz_users row
  const [attemptId, setAttemptId] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)
  const [score, setScore] = React.useState<number | null>(null)

  // Show loader for 2 seconds
  React.useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 2000)
    return () => clearTimeout(timer)
  }, [])

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

  const { data: quiz, error: quizError } = useSWR(env && !showLoader ? ["quiz", params.quizId] : null, async () => {
    const q = await sbFetch<any[]>(env!, `quizzes?id=eq.${params.quizId}&select=*`)
    if (q.error) throw new Error(q.error)
    return q.data?.[0] || null
  })

  const { data: qna } = useSWR(env && !showLoader ? ["qna", params.quizId] : null, async () => {
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

  return (
    <ShaderBackground>
      <div className="min-h-screen w-full relative flex items-center justify-center p-4">
        {showLoader && <LoaderScreen />}
        
        {!showLoader && (
          <main className="w-full max-w-2xl text-white">
            {!env ? (
              <section className="rounded-xl p-6 backdrop-blur-sm border border-white/10 bg-white/5">
                <div className="text-center">
                  <h1 className="text-xl font-medium mb-2">Loading Quiz...</h1>
                  <p className="text-sm text-white/70">Connecting to quiz platform</p>
                </div>
              </section>
            ) : !quiz ? (
              <section className="rounded-xl p-6 backdrop-blur-sm border border-white/10 bg-white/5">
                <div className="text-center">
                  <h1 className="text-xl font-medium mb-2">Quiz Not Found</h1>
                  <p className="text-sm text-white/70">The quiz you're looking for doesn't exist or has been removed.</p>
                </div>
              </section>
            ) : !user ? (
              <section className="rounded-xl p-6 backdrop-blur-sm border border-white/10 bg-white/5">
                <h1 className="text-2xl font-medium mb-2">{quiz.title}</h1>
                <p className="text-white/80 mb-6">{quiz.description}</p>
                <LoginForm onLogin={login} />
              </section>
            ) : !attemptId ? (
              <section className="rounded-xl p-6 backdrop-blur-sm border border-white/10 bg-white/5">
                <div className="text-center">
                  <h1 className="text-2xl font-medium mb-4">{quiz.title}</h1>
                  <p className="text-white/80 mb-6">{quiz.description}</p>
                  <p className="text-sm text-white/70 mb-6">Welcome, {user.name}!</p>
                  <button 
                    className="px-6 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-all duration-200" 
                    onClick={startAttempt}
                  >
                    Start Quiz
                  </button>
                </div>
              </section>
            ) : !qna?.length ? (
              <section className="rounded-xl p-6 backdrop-blur-sm border border-white/10 bg-white/5">
                <div className="text-center">
                  <h1 className="text-xl font-medium mb-2">No Questions Available</h1>
                  <p className="text-sm text-white/70">This quiz doesn't have any questions yet.</p>
                </div>
              </section>
            ) : done ? (
              <section className="rounded-xl p-6 backdrop-blur-sm border border-white/10 bg-white/5">
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-medium mb-2">Quiz Complete!</h1>
                  <div className="text-3xl font-bold text-cyan-400 mb-2">{score}/{qna.length}</div>
                  <p className="text-white/80">
                    You scored {Math.round(((score || 0) / qna.length) * 100)}%
                  </p>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Review Answers:</h3>
                  {qna.map((q: any, idx: number) => {
                    const correct = q.options.find((o: any) => o.is_correct)
                    return (
                      <div key={q.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <div className="font-medium mb-2">
                          Q{idx + 1}. {q.prompt}
                        </div>
                        <div className="text-sm text-green-400 mb-2">
                          ✓ Correct Answer: {correct?.option_text}
                        </div>
                        {q.solution_video_url && (
                          <div className="mb-2">
                            <a
                              className="inline-flex items-center gap-2 px-3 py-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors text-sm"
                              href={q.solution_video_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              📹 Watch Explanation
                            </a>
                          </div>
                        )}
                        {q.solution_text && (
                          <div
                            className="text-sm text-white/80 prose prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.solution_text) }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : (
              <section className="rounded-xl p-6 backdrop-blur-sm border border-white/10 bg-white/5">
                <div className="mb-6">
                  <h1 className="text-2xl font-medium mb-2">{quiz.title}</h1>
                  <p className="text-white/80">{quiz.description}</p>
                </div>
                <QuizAttempt qna={qna} onSubmit={submitAnswers} />
              </section>
            )}
          </main>
        )}
      </div>
    </ShaderBackground>
  )
}

function LoginForm({ onLogin }: { onLogin: (userId: string, password: string) => void }) {
  const [userId, setUserId] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  async function handleLogin() {
    if (!userId.trim() || !password.trim()) {
      alert("Please enter both User ID and Password")
      return
    }
    setLoading(true)
    try {
      await onLogin(userId.trim(), password.trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium mb-4">Login to Take Quiz</h2>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-white/90 mb-2">User ID</label>
          <input
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-white/40 focus:outline-none transition-colors"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter your user ID"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
        
        <div>
          <label className="block text-sm text-white/90 mb-2">Password</label>
          <input
            type="password"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-white/40 focus:outline-none transition-colors"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="off"
          />
        </div>
      </div>
      
      <button
        className="w-full px-4 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleLogin}
        disabled={loading || !userId.trim() || !password.trim()}
      >
        {loading ? "Logging in..." : "Login"}
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
  const [submitting, setSubmitting] = React.useState(false)
  
  function choose(qid: string, oid: string) {
    setAnswers((a) => ({ ...a, [qid]: oid }))
  }
  
  async function submit() {
    const unanswered = qna.filter(q => !answers[q.id])
    if (unanswered.length > 0) {
      if (!confirm(`You have ${unanswered.length} unanswered questions. Submit anyway?`)) {
        return
      }
    }
    
    setSubmitting(true)
    try {
      const result = qna.map((q) => {
        const selected = answers[q.id]
        const correct = q.options.find((o: any) => o.is_correct)
        return {
          question_id: q.id,
          selected_option_id: selected || "",
          is_correct: selected === correct?.id,
        }
      })
      await onSubmit(result)
    } finally {
      setSubmitting(false)
    }
  }

  const answeredCount = Object.keys(answers).length
  const progress = (answeredCount / qna.length) * 100

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-white/80">
          <span>Progress</span>
          <span>{answeredCount}/{qna.length} answered</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div 
            className="bg-cyan-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {qna.map((q, idx) => (
          <div key={q.id} className="p-5 rounded-lg bg-white/5 border border-white/10">
            <div className="font-medium text-lg mb-4">
              <span className="text-cyan-400">Q{idx + 1}.</span> {q.prompt}
            </div>
            
            <div className="space-y-3">
              {q.options.map((o: any) => {
                const isSelected = answers[q.id] === o.id
                return (
                  <label 
                    key={o.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? "bg-cyan-500/20 border border-cyan-400/50" 
                        : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={isSelected}
                      onChange={() => choose(q.id, o.id)}
                      className="w-4 h-4 text-cyan-400 bg-transparent border-white/30 focus:ring-cyan-400 focus:ring-2"
                    />
                    <span className={isSelected ? "text-white" : "text-white/90"}>
                      {o.option_text}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <div className="flex justify-center pt-4">
        <button 
          className="px-8 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit Quiz"}
        </button>
      </div>
    </div>
  )
}