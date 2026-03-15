export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, bookTitle, knownWords = [], hardWords = [] } = req.body
  const excludeLine = Array.isArray(knownWords) && knownWords.length > 0
    ? `\nDo NOT include these words the user already knows: ${knownWords.slice(0, 300).join(', ')}.`
    : ''
  const profileLine = Array.isArray(hardWords) && hardWords.length > 0
    ? `\nThe user's vocabulary profile (words they have looked up, starred = high priority, format: word (pos): definition):\n${hardWords.slice(0, 150).join('\n')}\nUse this profile to precisely calibrate difficulty — hint words should be at a similar level to these.`
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

    const prompt = `Analyze the following English text and identify ALL words this specific user would find challenging based on their vocabulary profile.
The user has PhD-level expertise in biology and master's-level expertise in physics, so do NOT suggest technical jargon from those fields (e.g. biological terms, physics terminology).${profileLine}${excludeLine}
For each word, provide its short Korean meaning (1-3 words).
Return ONLY a JSON object where the key is the English word (lowercase) and the value is the Korean meaning.

Example: {"sophisticated": "정교한", "unprecedented": "전례 없는"}

Text to analyze:
${text.substring(0, 5000)}`

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
    const hints = JSON.parse(jsonText)
    const usage = data.usageMetadata || {}

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

    return res.status(200).json({ hints, usage: { input: usage.promptTokenCount || 0, output: usage.candidatesTokenCount || 0 } })
  } catch (error) {
    console.error('AI Analysis Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
