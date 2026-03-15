export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'Text is required' })

  try {
    // Get API key from env first, fall back to DB settings
    let apiKey = process.env.GEMINI_API_KEY

    if (!apiKey && process.env.DATABASE_URL) {
      try {
        const { neon } = await import('@neondatabase/serverless')
        const sql = neon(process.env.DATABASE_URL)
        const settings = await sql`SELECT api_key FROM settings WHERE id = 1`
        apiKey = settings[0]?.api_key
      } catch (_) {
        // DB unavailable, continue without it
      }
    }

    if (!apiKey) return res.status(400).json({ error: 'Gemini API Key not configured' })

    const excerpt = text.substring(0, 3000)

    const prompt = `Read the following English text and generate exactly 2 inferential comprehension questions that require the reader to think beyond the literal text (drawing conclusions, making inferences, understanding themes or motivations).

For each question, provide a model answer.

Return ONLY a JSON array in this exact format:
[{"question": "...", "answer": "..."}, {"question": "...", "answer": "..."}]

Text:
${excerpt}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)

    const data = await response.json()
    let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    jsonText = jsonText.replace(/```json|```/g, '').trim()
    const questions = JSON.parse(jsonText)

    return res.status(200).json(questions)
  } catch (error) {
    console.error('Comprehension API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
