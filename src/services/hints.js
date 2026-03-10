// Client-side Gemini fallback for hint generation
// Used when /api/analyze-text is unavailable (local/Electron env)
export async function generateHintsWithGemini(text, apiKey, wordCount = 20, knownWords = []) {
  const count = Math.min(60, Math.max(5, wordCount))
  const excludeLine = knownWords.length > 0
    ? `\nDo NOT include these words the user already knows: ${knownWords.slice(0, 150).join(', ')}.`
    : ''

  const prompt = `Analyze the following English text. Identify approximately ${count} words that would be difficult for an intermediate English learner (B1-B2 level).
For each word, provide its short Korean meaning (1-3 words).
Return ONLY a JSON object where the key is the English word (lowercase) and the value is the Korean meaning.${excludeLine}

Example: {"sophisticated": "정교한", "unprecedented": "전례 없는"}

Text to analyze:
${text.substring(0, 5000)}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)

  const data = await res.json()
  let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  jsonText = jsonText.replace(/```json|```/g, '').trim()
  return JSON.parse(jsonText)
}
