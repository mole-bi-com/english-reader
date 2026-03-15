// Client-side Gemini fallback for hint generation
// Used when /api/analyze-text is unavailable (local/Electron env)
export async function generateHintsWithGemini(text, apiKey, knownWords = [], hardWords = []) {
  const excludeLine = knownWords.length > 0
    ? `\nDo NOT include these words the user already knows: ${knownWords.slice(0, 300).join(', ')}.`
    : ''
  const profileLine = hardWords.length > 0
    ? `\nThe user's vocabulary profile (words they have looked up, starred = high priority, format: word (pos): definition):\n${hardWords.slice(0, 150).join('\n')}\nUse this profile to precisely calibrate difficulty — hint words should be at a similar level to these.`
    : ''

  const prompt = `Analyze the following English text and identify ALL words this specific user would find challenging based on their vocabulary profile.
The user has PhD-level expertise in biology and master's-level expertise in physics, so do NOT suggest technical jargon from those fields (e.g. biological terms, physics terminology).${profileLine}${excludeLine}
For each word, provide its short Korean meaning (1-3 words).
Return ONLY a JSON object where the key is the English word (lowercase) and the value is the Korean meaning.

Example: {"sophisticated": "정교한", "unprecedented": "전례 없는"}

Text to analyze:
${text.substring(0, 5000)}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
