import { NextResponse } from "next/server"

async function getPantryData(pantryId: string, bucket: string) {
  const res = await fetch(
    `https://getpantry.cloud/apiv1/pantry/${encodeURIComponent(pantryId)}/basket/${encodeURIComponent(bucket)}`,
    { cache: "no-store" },
  )
  if (!res.ok) throw new Error("Failed to read Pantry")
  return res.json()
}

async function callOpenRouter(key: string, model: string, prompt: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://fantoms.app",
      "X-Title": "Fantoms",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You generate concise, well-structured HTML explanations for MCQ answers. Use semantic tags (h3, p, ul, li, code). Avoid external scripts or styles.",
        },
        { role: "user", content: prompt },
      ],
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  return typeof text === "string" ? text : null
}

export async function POST(req: Request) {
  try {
    const { pantryId, bucket, question, correctAnswer } = await req.json()
    if (!pantryId || !bucket || !question) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    const basket = await getPantryData(pantryId, bucket)
    const key = basket?.openrouterKey
    if (!key) return NextResponse.json({ error: "OpenRouter key not found in Pantry" }, { status: 400 })

    const basePrompt = `Question: ${question}
Correct Answer: ${correctAnswer || "(not provided)"}

Write a thorough but concise explanation in HTML with:
- A short heading
- Why the correct option is correct
- Why the other options are wrong
- If helpful, a short example snippet in <code>`

    const models = [
      "deepseek/deepseek-chat-v3.1:free",
      "deepseek/deepseek-r1-0528:free",
      "google/gemini-2.0-flash-exp:free",
    ]
    let html: string | null = null
    for (const m of models) {
      html = await callOpenRouter(key, m, basePrompt)
      if (html) break
    }
    if (!html) return NextResponse.json({ error: "Model call failed" }, { status: 502 })
    return NextResponse.json({ html })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 })
  }
}
