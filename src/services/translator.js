import { useSettingsStore } from '../stores/settings-store'

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })
    const data = await res.json()
    if (data.error) {
      console.error('Gemini API error:', data.error.message || data.error)
      return `(API error: ${data.error.message || 'Unknown error'})`
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '(No response from API)'
  } catch (err) {
    console.error('Gemini fetch error:', err)
    return `(Network error: ${err.message})`
  }
}

export async function translateSentence(sentence) {
  const apiKey = useSettingsStore.getState().apiKey
  if (!apiKey) return '(API key not set)'
  const prompt = `Translate this English sentence to natural Korean. Return ONLY the Korean translation, nothing else:\n\n${sentence}`
  return callGemini(apiKey, prompt)
}

export async function aiExplain(word, sentence) {
  const apiKey = useSettingsStore.getState().apiKey
  if (!apiKey) return '(API key not set)'
  const prompt = `다음 영어 문장에서 "${word}"이라는 단어가 사용되었습니다:

"${sentence}"

한국어로 다음을 설명해주세요:
1. 이 문맥에서의 정확한 의미
2. 이 단어가 이 문맥에서 왜 쓰였는지
3. 다른 흔한 의미와의 차이점

간결하게 답해주세요.`
  return callGemini(apiKey, prompt)
}
