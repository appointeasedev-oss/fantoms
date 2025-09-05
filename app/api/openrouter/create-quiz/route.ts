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
          content: `You are a quiz generator. Create educational quizzes in JSON format.
          
Return ONLY valid JSON in this exact format:
{
  "title": "Quiz Title",
  "description": "Brief description",
  "questions": [
    {
      "id": "uuid-string",
      "prompt": "Question text",
      "solution_text": "Detailed explanation in HTML",
      "solution_video_url": "",
      "options": [
        {"id": "uuid-string", "option_text": "Option A", "is_correct": false},
        {"id": "uuid-string", "option_text": "Option B", "is_correct": true},
        {"id": "uuid-string", "option_text": "Option C", "is_correct": false},
        {"id": "uuid-string", "option_text": "Option D", "is_correct": false}
      ]
    }
  ]
}

Rules:
- Each question must have exactly 4 options
- Exactly one option per question must be is_correct: true
- Use crypto.randomUUID() format for IDs
- solution_text should be detailed HTML explanation
- Make questions educational and well-structured`,
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
    const { pantryId, bucket, topic, questionCount, difficulty } = await req.json()
    
    if (!pantryId || !bucket || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    
    const basket = await getPantryData(pantryId, bucket)
    const key = basket?.openrouterKey
    if (!key) {
      return NextResponse.json({ error: "OpenRouter key not found in Pantry" }, { status: 400 })
    }

    const prompt = `Create a ${difficulty} level quiz about: ${topic}

Generate exactly ${questionCount} questions with 4 multiple choice options each.
Make the quiz educational and comprehensive.
Include detailed explanations for each correct answer.

Topic: ${topic}
Difficulty: ${difficulty}
Number of questions: ${questionCount}

Return the quiz in the specified JSON format.`

    const models = [
      "deepseek/deepseek-chat-v3.1:free",
      "deepseek/deepseek-r1-0528:free", 
      "google/gemini-2.0-flash-exp:free",
    ]
    
    let response: string | null = null
    for (const model of models) {
      response = await callOpenRouter(key, model, prompt)
      if (response) break
    }
    
    if (!response) {
      return NextResponse.json({ error: "Failed to generate quiz with AI" }, { status: 502 })
    }
    
    // Parse the JSON response
    let quiz
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("No JSON found in response")
      
      quiz = JSON.parse(jsonMatch[0])
      
      // Validate the structure
      if (!quiz.title || !quiz.questions || !Array.isArray(quiz.questions)) {
        throw new Error("Invalid quiz structure")
      }
      
      // Generate proper UUIDs for questions and options
      quiz.questions = quiz.questions.map((q: any) => ({
        ...q,
        id: crypto.randomUUID(),
        options: q.options?.map((o: any) => ({
          ...o,
          id: crypto.randomUUID()
        })) || []
      }))
      
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError)
      return NextResponse.json({ error: "Failed to parse AI-generated quiz" }, { status: 500 })
    }
    
    return NextResponse.json({ quiz })
    
  } catch (err: any) {
    console.error("Quiz creation error:", err)
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 })
  }
}