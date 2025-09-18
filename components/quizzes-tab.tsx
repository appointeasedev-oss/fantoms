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

function toHtml(textOrHtml?: string) {
  const s = (textOrHtml || "").trim()
  if (!s) return ""
  // If looks like HTML, keep; otherwise wrap plain text into <p> with <br/>
  if (/<[^>]+>/.test(s)) return s
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return `<p>${esc.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`
}

export function QuizzesTab() {
  const { pantryId, bucket, supabaseUrl, supabaseAnonKey, tenantKey } = useFantoms()
  const envReady = pantryId && bucket && supabaseUrl && supabaseAnonKey && tenantKey
  const env: SupaEnv | null = envReady
    ? { supabaseUrl: supabaseUrl!, supabaseAnonKey: supabaseAnonKey!, tenantKey: tenantKey! }
    : null

  const [creating, setCreating] = React.useState(false)
  const [creatingWithAI, setCreatingWithAI] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [aiForm, setAiForm] = React.useState({ topic: "", questionCount: 5, difficulty: "medium" })
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
    env ? ["quizzes", env.tenantKey] : null,
    async () => {
      const { data, error } = await sbFetch<any[]>(env!, `quizzes${qs({ select: "*", order: "created_at.desc" })}`)
      if (error) throw new Error(error)
      return data || []
    },
    { 
      revalidateOnFocus: false, 
      revalidateIfStale: false, 
      revalidateOnReconnect: false, 
      shouldRetryOnError: true,
      errorRetryCount: 3,
      refreshInterval: 0
    },
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

  async function loadQuizForEdit(quizId: string) {
    if (!env) return
    
    try {
      // Fetch quiz details
      const quizRes = await sbFetch<any[]>(env, `quizzes${qs({ select: "*" })}&id=eq.${quizId}`)
      if (quizRes.error) throw new Error(quizRes.error)
      const quiz = quizRes.data?.[0]
      if (!quiz) throw new Error("Quiz not found")

      // Fetch questions for this quiz
      const questionsRes = await sbFetch<any[]>(env, `questions${qs({ select: "*", order: "created_at.asc" })}&quiz_id=eq.${quizId}`)
      if (questionsRes.error) throw new Error(questionsRes.error)
      const questions = questionsRes.data || []

      // Fetch options for all questions
      const questionIds = questions.map(q => q.id)
      if (questionIds.length === 0) {
        setDraft({
          title: quiz.title,
          description: quiz.description || "",
          questions: [{
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
          }]
        })
        return
      }

      const inList = questionIds.join(",")
      const optionsRes = await sbFetch<any[]>(env, `options${qs({ select: "*", order: "created_at.asc" })}&question_id=in.(${inList})`)
      if (optionsRes.error) throw new Error(optionsRes.error)
      const options = optionsRes.data || []

      // Build the draft structure
      const questionsWithOptions = questions.map(q => ({
        id: q.id,
        prompt: q.prompt,
        solution_text: q.solution_text || "",
        solution_video_url: q.solution_video_url || "",
        options: options.filter(o => o.question_id === q.id).map(o => ({
          id: o.id,
          option_text: o.option_text,
          is_correct: o.is_correct
        }))
      }))

      setDraft({
        title: quiz.title,
        description: quiz.description || "",
        questions: questionsWithOptions
      })
    } catch (e: any) {
      alert(`Failed to load quiz: ${e.message}`)
    }
  }

  async function saveQuiz() {
    if (!env) return
    if (!draft.title.trim()) return alert("Please enter a quiz title")

    // Validate questions: keep only filled questions with exactly one correct and non-empty option text
    const validQuestions = draft.questions
      .map((q) => ({
        ...q,
        prompt: (q.prompt || "").trim(),
        solution_text: (q.solution_text || "").trim(),
        solution_video_url: (q.solution_video_url || "").trim(),
        options: q.options.filter((o) => (o.option_text || "").trim()),
      }))
      .filter((q) => q.prompt && q.options.length >= 2)

    if (validQuestions.length === 0) {
      return alert("Please add at least one question with at least 2 options.")
    }

    for (const q of validQuestions) {
      const correct = q.options.filter((o) => o.is_correct)
      if (correct.length !== 1) {
        return alert(`Question "${q.prompt}" must have exactly one correct option marked.`)
      }
    }

    try {
      if (!editingId) {
        // Create new quiz
        const { data: quizData, error: quizError } = await sbFetch<any[]>(env, "quizzes", {
          method: "POST",
          body: [
            { 
              tenant_key: env.tenantKey, 
              title: draft.title.trim(), 
              description: draft.description?.trim() || "", 
              status: "active" 
            },
          ],
        })
        if (quizError) throw new Error(quizError)
        const quiz = quizData?.[0]
        if (!quiz) throw new Error("Failed to create quiz")

        // Create questions and options
        for (const q of validQuestions) {
          const { data: questionData, error: questionError } = await sbFetch<any[]>(env, "questions", {
            method: "POST",
            body: [
              {
                tenant_key: env.tenantKey,
                quiz_id: quiz.id,
                prompt: q.prompt,
                question_order: validQuestions.indexOf(q) + 1,
                solution_text: toHtml(q.solution_text),
                solution_video_url: q.solution_video_url,
              },
            ],
          })
          if (questionError) throw new Error(questionError)
          const question = questionData?.[0]
          if (!question) continue

          const optionsToInsert = q.options.map((o) => ({
            tenant_key: env.tenantKey,
            question_id: question.id,
            option_text: o.option_text.trim(),
            is_correct: o.is_correct,
          }))

          if (optionsToInsert.length > 0) {
            const { error: optionsError } = await sbFetch<any[]>(env, "options", { 
              method: "POST", 
              body: optionsToInsert 
            })
            if (optionsError) throw new Error(optionsError)
          }
        }
      } else {
        // Update existing quiz
        const { error: updateError } = await sbFetch<any[]>(env, `quizzes?id=eq.${editingId}`, {
          method: "PATCH",
          body: { 
            title: draft.title.trim(), 
            description: draft.description?.trim() || "",
            question_count: validQuestions.length
          },
        })
        if (updateError) throw new Error(updateError)

        // For editing, we'll keep it simple and just update the quiz metadata
        // Full question editing would require more complex logic to handle adds/updates/deletes
        alert("Quiz updated! Note: Question editing is simplified - only title and description are updated.")
      }

      resetDraft()
      setCreating(false)
      setCreatingWithAI(false)
      setEditingId(null)
      await mutate()
    } catch (e: any) {
      alert(`Error saving quiz: ${e.message}`)
    }
  }

  async function createQuizWithAI() {
    if (!pantryId || !bucket) return alert("Connect Pantry first.")
    if (!aiForm.topic.trim()) return alert("Please enter a topic.")
    if (aiForm.questionCount < 1 || aiForm.questionCount > 20) return alert("Question count must be between 1 and 20.")

    try {
      const res = await fetch("/api/openrouter/create-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pantryId,
          bucket,
          topic: aiForm.topic,
          questionCount: aiForm.questionCount,
          difficulty: aiForm.difficulty,
        }),
      })
      
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to generate quiz")
      
      // Set the AI-generated quiz as the current draft
      setDraft(json.quiz)
      setCreatingWithAI(false)
      setCreating(true)
      
    } catch (e: any) {
      alert(`Failed to create quiz with AI: ${e.message}`)
    }
  }

  function QuizList() {
    console.log('QuizList render:', { isLoading, error, quizzes, quizzesLength: quizzes?.length })
    
    if (isLoading) return <div className="opacity-80">Loading quizzes...</div>
    if (error) return <div className="opacity-80">Failed to load quizzes: {String(error)}</div>
    if (!quizzes?.length) {
      return (
        <div className="text-center py-8">
          <div className="opacity-80 mb-4">No quizzes yet. Create your first quiz.</div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              className="px-4 py-2 rounded bg-cyan-500 text-black text-sm font-medium" 
              onClick={() => setCreating(true)}
            >
              Create Manually
            </button>
            <button 
              className="px-4 py-2 rounded bg-purple-500 text-white text-sm font-medium" 
              onClick={() => setCreatingWithAI(true)}
            >
              Create with AI
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-3">
        {quizzes.map((q: any) => (
          <QuizItem key={q.id} q={q} />
        ))}
      </div>
    )
  }

  function QuizItem({ q }: { q: any }) {
    const link = pantryId && bucket ? `/q/b-${b64urlEncode(pantryId)}/b-${b64urlEncode(bucket)}/${q.id}` : "#"
    
    async function stopQuiz() {
      if (!env) return
      const { error } = await sbFetch(env, `quizzes?id=eq.${q.id}`, { method: "PATCH", body: { status: "inactive" } })
      if (error) alert(`Error stopping quiz: ${error}`)
      else mutate()
    }
    
    async function deleteQuiz() {
      if (!env) return
      if (!confirm("Delete this quiz? This will remove all questions and options.")) return
      const { error } = await sbFetch(env, `quizzes?id=eq.${q.id}`, { method: "DELETE" })
      if (error) alert(`Error deleting quiz: ${error}`)
      else mutate()
    }
    
    async function editQuiz() {
      setCreating(true)
      setEditingId(q.id)
      await loadQuizForEdit(q.id)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
    
    return (
      <div className="p-3 rounded-md bg-white/5 border border-white/10 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex-1">
            <div className="font-semibold">{q.title}</div>
            <div className="text-sm opacity-80">{q.description}</div>
            <div className="text-xs opacity-60 mt-1">Status: {q.status} • Questions: {q.question_count || 0}</div>
          </div>
          <div className="grid grid-cols-2 lg:flex lg:items-center gap-2">
            <button onClick={editQuiz} className="px-3 py-2 rounded bg-cyan-500 text-black text-sm font-medium">
              Edit
            </button>
            <a href={link} className="px-3 py-2 rounded bg-white text-black text-sm font-medium text-center" target="_blank" rel="noreferrer">
              Link
            </a>
            <button onClick={stopQuiz} className="px-3 py-2 rounded bg-yellow-400 text-black text-sm font-medium">
              Stop
            </button>
            <button onClick={deleteQuiz} className="px-3 py-2 rounded bg-red-500 text-white text-sm font-medium">
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
          `quiz_attempts${qs({ select: "id,completed_at,score", quiz_id: `eq.${quizId}` })}`,
        )
        if (attemptsRes.error) {
          return { totalAttempts: 0, completedAttempts: 0, avgScore: 0 }
        }
        const attempts = attemptsRes.data || []
        const completed = attempts.filter((a: any) => a.completed_at)
        const totalAttempts = attempts.length
        const completedAttempts = completed.length
        const avgScore = completed.length > 0 
          ? Math.round((completed.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / completed.length) * 100) / 100
          : 0
        return { totalAttempts, completedAttempts, avgScore }
      } catch {
        return { totalAttempts: 0, completedAttempts: 0, avgScore: 0 }
      }
    })
    
    if (isLoading) return <div className="text-xs opacity-60 mt-2">Loading stats...</div>
    const stats = data || { totalAttempts: 0, completedAttempts: 0, avgScore: 0 }
    return (
      <div className="text-xs opacity-80 mt-2">
        Attempts: {stats.totalAttempts} • Completed: {stats.completedAttempts} • Avg Score: {stats.avgScore}
      </div>
    )
  }

  function AIQuizCreator() {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Create Quiz with AI</h3>
        <p className="text-sm text-white/80">Let AI generate a complete quiz for you based on your topic and requirements.</p>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm opacity-90 mb-1">Topic/Subject</label>
            <textarea
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white resize-none"
              rows={3}
              value={aiForm.topic}
              onChange={(e) => setAiForm(prev => ({ ...prev, topic: e.target.value }))}
              placeholder="Describe the topic in detail (e.g., 'JavaScript fundamentals including variables, functions, and arrays for beginners')"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm opacity-90 mb-1">Number of Questions</label>
              <input
                type="number"
                min="1"
                max="20"
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                value={aiForm.questionCount}
                onChange={(e) => setAiForm(prev => ({ ...prev, questionCount: parseInt(e.target.value) || 5 }))}
              />
            </div>
            
            <div>
              <label className="block text-sm opacity-90 mb-1">Difficulty Level</label>
              <select
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                value={aiForm.difficulty}
                onChange={(e) => setAiForm(prev => ({ ...prev, difficulty: e.target.value }))}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-white/10">
          <button
            className="w-full sm:w-auto px-4 py-2 rounded bg-purple-500 text-white text-sm font-medium"
            onClick={createQuizWithAI}
            disabled={!aiForm.topic.trim()}
          >
            Generate Quiz with AI
          </button>
          <button
            className="w-full sm:w-auto px-4 py-2 rounded bg-white/10 text-white text-sm"
            onClick={() => {
              setCreatingWithAI(false)
              setAiForm({ topic: "", questionCount: 5, difficulty: "medium" })
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  function QuizBuilder() {
    function updateDraft(updater: (prev: QuizDraft) => QuizDraft) {
      setDraft(updater)
    }

    function updateQuestion(questionId: string, updater: (prev: QuestionDraft) => QuestionDraft) {
      updateDraft(draft => ({
        ...draft,
        questions: draft.questions.map(q => q.id === questionId ? updater(q) : q)
      }))
    }

    function updateOption(questionId: string, optionId: string, updater: (prev: OptionDraft) => OptionDraft) {
      updateQuestion(questionId, question => ({
        ...question,
        options: question.options.map(o => o.id === optionId ? updater(o) : o)
      }))
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm opacity-90">Quiz title</label>
          <input
            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
            value={draft.title}
            onChange={(e) => updateDraft(d => ({ ...d, title: e.target.value }))}
            placeholder="Enter quiz title"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm opacity-90">Description</label>
          <textarea
            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white resize-none"
            rows={2}
            value={draft.description}
            onChange={(e) => updateDraft(d => ({ ...d, description: e.target.value }))}
            placeholder="Describe this quiz"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Questions</h3>
          {draft.questions.map((q, idx) => (
            <div key={q.id} className="p-4 rounded-md bg-white/5 border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="font-semibold">Question {idx + 1}</div>
                {draft.questions.length > 1 && (
                  <button
                    className="text-xs opacity-80 hover:opacity-100 px-3 py-1 rounded bg-red-500/20 text-red-300 self-start sm:self-auto"
                    onClick={() => updateDraft(d => ({ ...d, questions: d.questions.filter(x => x.id !== q.id) }))}
                  >
                    Remove Question
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm opacity-90">Question prompt</label>
                  <textarea
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white resize-none"
                    rows={2}
                    value={q.prompt}
                    onChange={(e) => updateQuestion(q.id, question => ({ ...question, prompt: e.target.value }))}
                    placeholder="Enter the question"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm opacity-90">Solution explanation (optional)</label>
                  <textarea
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white resize-none"
                    rows={3}
                    value={q.solution_text}
                    onChange={(e) => updateQuestion(q.id, question => ({ ...question, solution_text: e.target.value }))}
                    placeholder="Explain the correct answer..."
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                  <button
                    className="self-start px-3 py-1 rounded bg-white text-black text-xs"
                    onClick={async () => {
                      if (!pantryId || !bucket) return alert("Connect Pantry first.")
                      const correct = q.options.find((o) => o.is_correct)
                      if (!correct?.option_text.trim()) return alert("Mark a correct answer first.")
                      
                      try {
                        const res = await fetch("/api/openrouter/explain", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            pantryId,
                            bucket,
                            question: q.prompt,
                            correctAnswer: correct.option_text,
                          }),
                        })
                        const json = await res.json()
                        if (!res.ok) throw new Error(json?.error || "Failed to generate")
                        updateQuestion(q.id, question => ({ ...question, solution_text: json.html }))
                      } catch (e: any) {
                        alert(`Failed to generate solution: ${e.message}`)
                      }
                    }}
                  >
                    Generate solution
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm opacity-90">Solution video URL (optional)</label>
                  <input
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                    value={q.solution_video_url}
                    onChange={(e) => updateQuestion(q.id, question => ({ ...question, solution_video_url: e.target.value }))}
                    placeholder="https://youtube.com/watch?v=..."
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                </div>

                <div className="space-y-2">
                  <div className="font-medium text-sm">Answer Options (mark one correct)</div>
                  {q.options.map((o, optIdx) => (
                    <div key={o.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                        value={o.option_text}
                        onChange={(e) => updateOption(q.id, o.id, option => ({ ...option, option_text: e.target.value }))}
                        placeholder={`Option ${optIdx + 1}`}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-sm flex items-center gap-1 whitespace-nowrap">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={o.is_correct}
                            onChange={() => updateQuestion(q.id, question => ({
                              ...question,
                              options: question.options.map(opt => ({ ...opt, is_correct: opt.id === o.id }))
                            }))}
                          />
                          Correct
                        </label>
                        {q.options.length > 2 && (
                          <button
                            className="text-xs opacity-80 hover:opacity-100 px-2 py-1 rounded bg-red-500/20 text-red-300"
                            onClick={() => updateQuestion(q.id, question => ({
                              ...question,
                              options: question.options.filter(opt => opt.id !== o.id)
                            }))}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <button
                    className="px-3 py-1 rounded bg-white/20 text-white text-sm"
                    onClick={() => updateQuestion(q.id, question => ({
                      ...question,
                      options: [
                        ...question.options,
                        { id: crypto.randomUUID(), option_text: "", is_correct: false },
                      ]
                    }))}
                  >
                    Add option
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-white/10">
          <button
            className="w-full sm:w-auto px-4 py-2 rounded bg-white/20 text-white text-sm"
            onClick={() => updateDraft(d => ({
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
            }))}
          >
            Add Question
          </button>
          <button className="w-full sm:w-auto px-4 py-2 rounded bg-cyan-500 text-black text-sm font-medium" onClick={saveQuiz}>
            {editingId ? "Save Changes" : "Create Quiz"}
          </button>
          <button
            className="w-full sm:w-auto px-4 py-2 rounded bg-white/10 text-white text-sm"
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

  console.log('QuizzesTab render:', { env, creating, quizzes, isLoading, error })

  return (
    <div className="p-4 text-white space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-semibold">Quizzes</h2>
        {!creating && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button className="w-full sm:w-auto px-4 py-2 rounded bg-cyan-500 text-black text-sm font-medium" onClick={() => setCreating(true)}>
              Create Manually
            </button>
            <button className="w-full sm:w-auto px-4 py-2 rounded bg-purple-500 text-white text-sm font-medium" onClick={() => setCreatingWithAI(true)}>
              Create with AI
            </button>
          </div>
        )}
      </div>

      {creatingWithAI ? <AIQuizCreator /> : creating ? <QuizBuilder /> : <QuizList />}
    </div>
  )
}

export default QuizzesTab