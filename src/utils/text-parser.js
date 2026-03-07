// Split text into sentences
export function splitSentences(text) {
  // Handle common abbreviations and edge cases
  return text.match(/[^.!?]+[.!?]+[\s]*/g) || [text]
}

// Split sentence into words (preserving punctuation attached)
export function splitWords(sentence) {
  return sentence.match(/[\w'']+|[^\s\w]/g) || []
}

// Check if token is a word (not just punctuation)
export function isWord(token) {
  return /[a-zA-Z]/.test(token)
}
