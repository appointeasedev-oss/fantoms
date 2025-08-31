"use client"

import React from "react"
import useSWR from "swr"
import { useFantoms } from "./fantoms-context"
import { type SupaEnv, sbFetch, qs } from "@/lib/supabase-rest"
import { b64urlEncode } from "@/lib/encoding"

type OptionDraft = { id: string; option_text: string; is_correct: boolean }
type QuestionDraft = {
  id: string
  prompt: string
  solution_text?: string
  solution_video_url?: string
  options: OptionDraft[]
}
type QuizDraft = { title: string; description?: string; questions: QuestionDraft[] }

function randomId(n = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

function toHtml(textOrHtml?: string) {
  const s = (textOrHtml || "").trim()
  if (!s) return ""
  // If looks like HTML, keep; otherwise wrap plain text into <p> with <br/>
  if (/[<>]/.test(s)) return s
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return `<p>${esc.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`
}

export default function QuizzesTab() {
  const { pantryId, bucket, supabaseUrl, supabaseAnonKey, tenantKey } = useFantoms()
  const envReady = pantryId && bucket && supabaseUrl && supabaseAnonKey && tenantKey
  const env: SupaEnv | null = envReady
    ? { supabaseUrl: supabaseUrl!, supabaseAnonKey: supabaseAnonKey!, tenantKey: tenantKey! }
    : null

  const [creating, setCreating] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<QuizDraft>({
    title: "",
    description: "",
    questions: [
      {
        id: crypto.randomUUID(),
        prompt: "",
        solution_text: "",
        solution_video_url: "",
        options: [
          { id: crypto.randomUUID(), option_text: "", is_correct: false },
          { id: crypto.randomUUID(), option_text: "", is_correct: false },
          { id: crypto.randomUUID(), option_text: "", is_correct: false },
          { id: crypto.randomUUID(), option_text: "", is_correct: false },
        ],
      },
    ],
  })

  const {
    data: quizzes,
    mutate,
    isLoading,
    error,
  } = useSWR(
    env && !creating ? ["quizzes", env.tenantKey] : null,
    async () => {
      const { data, error } = await sbFetch<any[]>(env!, `quizzes${qs({ select: "*", order: "created_at.desc" })}`)
      if (error) throw new Error(error)
      return data || []
    },
    { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false, shouldRetryOnError: false },
  )

  function resetDraft() {
    setDraft({
      title: "",
      description: "",
      questions: [
        {
          id: crypto.randomUUID(),
          prompt: "",
          solution_text: "",
          solution_video_url: "",
          options: [
            { id: crypto.randomUUID(), option_text: "", is_correct: false },
            { id: crypto.randomUUID(), option_text: "", is_correct: false },
            { id: crypto.randomUUID(), option_text: "", is_correct: false },
            { id: crypto.randomUUID(), option_text: "", is_correct: false },
          ],
        },
      ],
    })
  }

  async function saveQuiz() {
    if (!env) return
    if (!draft.title.trim()) return alert("Please enter a quiz title")

    // Normalize questions: keep only filled questions with exactly one correct and non-empty option text
    const normalizedQuestions = draft.questions
      .map((q) => ({
        ...q,
        prompt: (q.prompt || "").trim(),
        solution_text: toHtml(q.solution_text),
        solution_video_url: (q.solution_video_url || "").trim(),
        options: q.options.filter((o) => (o.option_text || "").trim()),
      }))
      .filter((q) => q.prompt && q.options.length)

    for (const q of normalizedQuestions) {
      const correct = q.options.filter((o) => o.is_correct)
      if (correct.length !== 1) {
        return alert("Each question must have exactly one marked correct option.")
      }
    }

    if (!editingId) {
      const { data, error } = await sbFetch<any[]>(env, "quizzes", {
        method: "POST",
        body: [
          { tenant_key: env.tenantKey, title: draft.title, description: draft.description || "", status: "active" },
        ],
      })
      if (error) return alert(error)
      const quiz = data?.[0]
      if (!quiz) return

      for (const q of normalizedQuestions) {
        const qRes = await sbFetch<any[]>(env, "questions", {
          method: "POST",
          body: [
            {
              tenant_key: env.tenantKey,
              quiz_id: quiz.id,
              prompt: q.prompt,
              solution_text: q.solution_text,
              solution_video_url: q.solution_video_url,
            },
          ],
        })
        if (qRes.error) return alert(qRes.error)
        const qRow = qRes.data?.[0]
        if (!qRow) continue

        const opts = q.options.map((o) => ({
          tenant_key: env.tenantKey,
          question_id: qRow.id,
          option_text: o.option_text,
          is_correct: !!o.is_correct,
        }))
        if (opts.length) {
          const oRes = await sbFetch<any[]>(env, "options", { method: "POST", body: opts })
          if (oRes.error) return alert(oRes.error)
        }
      }
      resetDraft()
      setCreating(false)
      mutate()
    } else {
      // Update quiz title/description only (editing questions can be more complex; keep simple for now)
      const upd = await sbFetch<any[]>(env, `quizzes?id=eq.${editingId}`, {
        method: "PATCH",
        body: { title: draft.title, description: draft.description || "" },
      })
      if (upd.error) return alert(upd.error)
      setEditingId(null)
      resetDraft()
      setCreating(false)
      mutate()
    }
  }

  function QuizList() {
    if (isLoading) return <div className="opacity-80">Loading quizzes...</div>
    if (error) return <div className="opacity-80">Failed to load quizzes</div>
    if (!quizzes?.length) return <div className="opacity-80">No quizzes yet. Create your first quiz.</div>
    return (
      <div className="space-y-3">
        {quizzes.map((q: any) => (
          <QuizItem key={q.id} q={q} />
        ))}
      </div>
    )
  }

  function QuizItem({ q }: { q: any }) {
    // Prefix-encode link params so the public page can safely detect & decode them (prevents atob errors)
    const link = pantryId && bucket ? `/q/b-${b64urlEncode(pantryId)}/b-${b64urlEncode(bucket)}/${q.id}` : "#"
    async function stopQuiz() {
      if (!env) return
      await sbFetch(env, `quizzes?id=eq.${q.id}`, { method: "PATCH", body: { status: "inactive" } })
      mutate()
    }
    async function deleteQuiz() {
      if (!env) return
      if (!confirm("Delete this quiz? This will remove all questions and options.")) return
      await sbFetch(env, `quizzes?id=eq.${q.id}`, { method: "DELETE" })
      mutate()
    }
    async function edit() {
      setCreating(true)
      setEditingId(q.id)
      setDraft((d) => ({ ...d, title: q.title, description: q.description || "" }))
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
    return (
      <div className="p-3 rounded-md bg-white/5 border border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold">{q.title}</div>
            <div className="text-sm opacity-80">{q.description}</div>
            <div className="text-xs opacity-60 mt-1">Status: {q.status}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={edit} className="px-3 py-1 rounded bg-cyan-500 text-black text-sm">
              Edit quiz
            </button>
            <a href={link} className="px-3 py-1 rounded bg-white text-black text-sm" target="_blank" rel="noreferrer">
              Get link
            </a>
            <button onClick={stopQuiz} className="px-3 py-1 rounded bg-yellow-400 text-black text-sm">
              Stop
            </button>
            <button onClick={deleteQuiz} className="px-3 py-1 rounded bg-red-500 text-white text-sm">
              Delete
            </button>
          </div>
        </div>
        <QuizStats quizId={q.id} />
      </div>
    )
  }

  function QuizStats({ quizId }: { quizId: string }) {
    const { data, error, isLoading } = useSWR(env ? ["quiz-stats", quizId] : null, async () => {
      try {
        const attemptsRes = await sbFetch<any[]>(
          env!,
          `quiz_attempts${qs({ select: "id,completed_at", quiz_id: `eq.${quizId}` })}`,
        )
        if (attemptsRes.error) {
          return { totalAttempts: 0, correctPct: 0 }
        }
        const attemptIds = (attemptsRes.data || []).map((a: any) => a.id)
        if (!attemptIds.length) return { totalAttempts: 0, correctPct: 0 }
        const inList = attemptIds.join(",")
        const answersRes = await sbFetch<any[]>(
          env!,
          `quiz_answers${qs({ select: "is_correct,attempt_id" })}&attempt_id=in.(${inList})`,
        )
        if (answersRes.error) {
          return { totalAttempts: 0, correctPct: 0 }
        }
        const totalAttempts = (attemptsRes.data || []).filter((a: any) => a.completed_at)?.length || 0
        const totalAnswers = (answersRes.data || []).length || 0
        const correct = (answersRes.data || []).filter((a: any) => a.is_correct)?.length || 0
        const correctPct = totalAnswers ? Math.round((correct / totalAnswers) * 100) : 0
        return { totalAttempts, correctPct }
      } catch {
        return { totalAttempts: 0, correctPct: 0 }
      }
    })
    if (isLoading) return <div className="text-xs opacity-60 mt-2">Loading stats...</div>
    const totals = data || { totalAttempts: 0, correctPct: 0 }
    return (
      <div className="text-xs opacity-80 mt-2">
        Attempts: {totals.totalAttempts} • Avg Correct: {totals.correctPct}%
      </div>
    )
  }

  function QuizBuilder() {
    return (
      <div className="space-y-3">
        <div className="grid gap-2" autoCorrect="off" autoCapitalize="off">
          <label className="text-sm opacity-90">Quiz title</label>
          <input
            className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Enter title"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-2" autoCorrect="off" autoCapitalize="off">
          <label className="text-sm opacity-90">Description</label>
          <textarea
            className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Describe this quiz"
            autoComplete="off"
          />
        </div>

        <div className="space-y-4">
          {draft.questions.map((q, idx) => (
            <div key={q.id} className="p-3 rounded-md bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Question {idx + 1}</div>
                <button
                  className="text-xs opacity-80 hover:opacity-100"
                  onClick={() => setDraft((d) => ({ ...d, questions: d.questions.filter((x) => x.id !== q.id) }))}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-2 mt-2" autoCorrect="off" autoCapitalize="off">
                <label className="text-sm opacity-90">Prompt</label>
                <textarea
                  className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  value={q.prompt}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      questions: d.questions.map((x) => (x.id === q.id ? { ...x, prompt: e.target.value } : x)),
                    }))
                  }
                  placeholder="Enter the question"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2 mt-2">
                <label className="text-sm opacity-90">Detailed solution (text or HTML)</label>
                <textarea
                  className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  value={q.solution_text}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      questions: d.questions.map((x) => (x.id === q.id ? { ...x, solution_text: e.target.value } : x)),
                    }))
                  }
                  placeholder="Explain the answer... (or click Generate)"
                />
                <button
                  className="self-start px-2 py-1 rounded bg-white text-black text-xs"
                  onClick={async () => {
                    if (!pantryId || !bucket) return alert("Connect Pantry first.")
                    const correct = q.options.find((o) => o.is_correct)
                    const res = await fetch("/api/openrouter/explain", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        pantryId,
                        bucket,
                        question: q.prompt,
                        correctAnswer: correct?.option_text || "",
                      }),
                    })
                    const json = await res.json()
                    if (!res.ok) return alert(json?.error || "Failed to generate")
                    setDraft((d) => ({
                      ...d,
                      questions: d.questions.map((x) =>
                        x.id === q.id ? { ...x, solution_text: json.html as string } : x,
                      ),
                    }))
                  }}
                >
                  Generate solution
                </button>
              </div>
              <div className="grid gap-2 mt-2">
                <label className="text-sm opacity-90">Answer video URL</label>
                <input
                  className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  value={q.solution_video_url}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      questions: d.questions.map((x) =>
                        x.id === q.id ? { ...x, solution_video_url: e.target.value } : x,
                      ),
                    }))
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="mt-3">
                <div className="font-medium mb-2">Options (mark one correct)</div>
                <div className="space-y-2">
                  {q.options.map((o) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <input
                        className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white flex-1"
                        value={o.option_text}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            questions: d.questions.map((x) =>
                              x.id === q.id
                                ? {
                                    ...x,
                                    options: x.options.map((y) =>
                                      y.id === o.id ? { ...y, option_text: e.target.value } : y,
                                    ),
                                  }
                                : x,
                            ),
                          }))
                        }
                        placeholder="Option text"
                        autoComplete="off"
                        inputMode="text"
                      />
                      <label className="text-sm flex items-center gap-1">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={o.is_correct}
                          onChange={() =>
                            setDraft((d) => ({
                              ...d,
                              questions: d.questions.map((x) =>
                                x.id === q.id
                                  ? {
                                      ...x,
                                      options: x.options.map((y) => ({ ...y, is_correct: y.id === o.id })),
                                    }
                                  : x,
                              ),
                            }))
                          }
                        />
                        Correct
                      </label>
                      <button
                        className="text-xs opacity-80 hover:opacity-100"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            questions: d.questions.map((x) =>
                              x.id === q.id ? { ...x, options: x.options.filter((y) => y.id !== o.id) } : x,
                            ),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="px-3 py-1 rounded bg-white text-black text-sm"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        questions: [
                          ...d.questions,
                          {
                            id: crypto.randomUUID(),
                            prompt: "",
                            solution_text: "",
                            solution_video_url: "",
                            options: [
                              { id: crypto.randomUUID(), option_text: "", is_correct: false },
                              { id: crypto.randomUUID(), option_text: "", is_correct: false },
                              { id: crypto.randomUUID(), option_text: "", is_correct: false },
                              { id: crypto.randomUUID(), option_text: "", is_correct: false },
                            ],
                          },
                        ],
                      }))
                    }
                  >
                    Add option
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded bg-white text-black text-sm"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                questions: [
                  ...d.questions,
                  {
                    id: crypto.randomUUID(),
                    prompt: "",
                    solution_text: "",
                    solution_video_url: "",
                    options: [
                      { id: crypto.randomUUID(), option_text: "", is_correct: false },
                      { id: crypto.randomUUID(), option_text: "", is_correct: false },
                      { id: crypto.randomUUID(), option_text: "", is_correct: false },
                      { id: crypto.randomUUID(), option_text: "", is_correct: false },
                    ],
                  },
                ],
              }))
            }
          >
            Add question
          </button>
          <button className="px-3 py-1 rounded bg-cyan-500 text-black text-sm" onClick={saveQuiz}>
            {editingId ? "Save changes" : "Create quiz"}
          </button>
          <button
            className="px-3 py-1 rounded bg-white/10 text-white text-sm"
            onClick={() => {
              setCreating(false)
              setEditingId(null)
              resetDraft()
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (!env) {
    return <div className="opacity-80">Connect Pantry and Supabase first.</div>
  }

  return (
    <div className="p-4 text-white space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Quizzes</h2>
        {!creating && (
          <button className="px-3 py-1 rounded bg-cyan-500 text-black text-sm" onClick={() => setCreating(true)}>
            Create new quiz
          </button>
        )}
      </div>

      {creating ? <QuizBuilder /> : <QuizList />}
    </div>
  )
}
