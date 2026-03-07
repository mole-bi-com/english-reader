import dictData from '../../assets/dict/en-ko-dict.json'

// Layer 1: Local dictionary lookup (instant)
export function lookupLocal(word) {
  const lower = word.toLowerCase()
  const entry = dictData[lower]
  if (entry) return { word: lower, ko: entry.ko, pos: entry.pos || '' }
  return null
}

// Layer 2: Free Dictionary API (async)
export async function lookupOnline(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`)
    if (!res.ok) return null
    const data = await res.json()
    const entry = data[0]
    const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || ''
    const meaning = entry.meanings?.[0]
    const definition = meaning?.definitions?.[0]?.definition || ''
    const pos = meaning?.partOfSpeech || ''
    return { phonetic, en_definition: definition, pos }
  } catch {
    return null
  }
}

// Combined lookup
export async function lookupWord(word) {
  const local = lookupLocal(word)
  const result = {
    word: word.toLowerCase(),
    ko: local?.ko || '',
    pos: local?.pos || '',
    phonetic: '',
    en_definition: '',
    loading: true,
  }

  // Fire online lookup in parallel
  const online = await lookupOnline(word)
  if (online) {
    result.phonetic = online.phonetic
    result.en_definition = online.en_definition
    if (!result.pos && online.pos) result.pos = online.pos
  }
  result.loading = false

  return result
}
