export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, bookTitle, hintWordCount = 20, knownWords = [] } = req.body
  const count = Math.min(60, Math.max(5, hintWordCount))
  const excludeLine = Array.isArray(knownWords) && knownWords.length > 0
    ? `\nDo NOT include these words the user already knows: ${knownWords.slice(0, 150).join(', ')}.`
    : ''

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

    const prompt = `Analyze the following English text. Identify approximately ${count} words that would be difficult for an intermediate English learner (B1-B2 level).
For each word, provide its short Korean meaning (1-3 words).
Return ONLY a JSON object where the key is the English word (lowercase) and the value is the Korean meaning.${excludeLine}

Example: {"sophisticated": "정교한", "unprecedented": "전례 없는"}

Text to analyze:
${text.substring(0, 5000)}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
    const hints = JSON.parse(jsonText)

    // Save to DB if available
    if (bookTitle && process.env.DATABASE_URL) {
      try {
        const { neon } = await import('@neondatabase/serverless')
        const sql = neon(process.env.DATABASE_URL)
        await sql`UPDATE books SET hints = ${JSON.stringify(hints)} WHERE title = ${bookTitle}`
      } catch (_) {
        // DB save failed, return hints anyway
      }
    }

    return res.status(200).json(hints)
  } catch (error) {
    console.error('AI Analysis Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
