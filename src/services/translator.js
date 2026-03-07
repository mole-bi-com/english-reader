export async function translateSentence(sentence) {
  return window.electronAPI.translateSentence(sentence)
}

export async function aiExplain(word, sentence) {
  return window.electronAPI.aiExplain(word, sentence)
}
