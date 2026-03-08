import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useReadingStore } from '../stores/reading-store'
import { useSettingsStore } from '../stores/settings-store'
import { useVocabStore } from '../stores/vocab-store'
import { splitSentences, splitWords, isWord } from '../utils/text-parser'
import WordPopup from './WordPopup'
import VocabSidebar from './VocabSidebar'
import SettingsPanel from './SettingsPanel'

export default function ReaderView() {
  const currentBook = useReadingStore(s => s.currentBook)
  const goHome = useReadingStore(s => s.goHome)
  const savePosition = useReadingStore(s => s.savePosition)
  const fontSize = useSettingsStore(s => s.fontSize)
  const lineHeight = useSettingsStore(s => s.lineHeight)
  const fontFamily = useSettingsStore(s => s.fontFamily)
  const loadVocab = useVocabStore(s => s.loadVocab)
  const isWordSaved = useVocabStore(s => s.isWordSaved)
  const vocab = useVocabStore(s => s.vocab) // subscribe to trigger re-render on save

  const [selectedWord, setSelectedWord] = useState(null)
  const [showVocab, setShowVocab] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const contentRef = useRef(null)
  const scrollTimeoutRef = useRef(null)

  // Parse the text into paragraphs > sentences > words
  const paragraphs = useMemo(() => {
    if (!currentBook?.text) return []
    return currentBook.text.split(/\n\s*\n/).filter(p => p.trim()).map(paragraph => {
      const sentences = splitSentences(paragraph.trim())
      return sentences.map(sentence => ({
        raw: sentence,
        tokens: splitWords(sentence),
      }))
    })
  }, [currentBook?.text])

  // Restore scroll position on mount
  useEffect(() => {
    if (currentBook?.last_position && contentRef.current) {
      // Use requestAnimationFrame to ensure the DOM is rendered
      requestAnimationFrame(() => {
        contentRef.current.scrollTop = currentBook.last_position
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load vocab store on mount
  useEffect(() => {
    loadVocab()
  }, [loadVocab])

  // Debounced scroll position save
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      if (contentRef.current) {
        savePosition(contentRef.current.scrollTop)
      }
    }, 300)
  }, [savePosition])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  // Escape key to close popup, sidebar, or settings
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedWord) {
          setSelectedWord(null)
        } else if (showSettings) {
          setShowSettings(false)
        } else if (showVocab) {
          setShowVocab(false)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedWord, showSettings, showVocab])

  // Event delegation for word clicks
  const handleContentClick = useCallback((e) => {
    const wordEl = e.target.closest('[data-word]')
    if (!wordEl) {
      setSelectedWord(null)
      return
    }

    const word = wordEl.dataset.word
    const sentenceIdx = parseInt(wordEl.dataset.sentenceIdx, 10)
    const rect = wordEl.getBoundingClientRect()

    // Find the full sentence text
    let sentenceCount = 0
    let sentenceText = ''
    for (const paragraph of paragraphs) {
      for (const sentence of paragraph) {
        if (sentenceCount === sentenceIdx) {
          sentenceText = sentence.raw.trim()
          break
        }
        sentenceCount++
      }
      if (sentenceText) break
    }

    const selection = { word, rect, sentence: sentenceText, sentenceIdx }
    setSelectedWord(selection)
    console.log('Word clicked:', word, '| Sentence:', sentenceText)
  }, [paragraphs])

  if (!currentBook) return null

  // Build a global sentence index counter
  let globalSentenceIdx = 0

  return (
    <div style={styles.wrapper}>
      {/* Top bar */}
      <header style={styles.topBar}>
        <button
          onClick={goHome}
          style={styles.backButton}
          onMouseEnter={e => { e.target.style.background = 'rgba(139, 105, 20, 0.1)' }}
          onMouseLeave={e => { e.target.style.background = 'transparent' }}
        >
          <span style={styles.backArrow}>&larr;</span> Home
        </button>
        <h1 style={styles.bookTitle}>{currentBook.title}</h1>
        <div style={styles.topBarRight}>
          <button
            onClick={() => setShowVocab(true)}
            style={styles.vocabButton}
            onMouseEnter={e => { e.target.style.background = 'rgba(139, 105, 20, 0.1)' }}
            onMouseLeave={e => { e.target.style.background = 'transparent' }}
            title="My Vocabulary"
          >
            {'\uD83D\uDCD6'} Vocab
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={styles.settingsButton}
            onMouseEnter={e => { e.target.style.background = 'rgba(139, 105, 20, 0.1)' }}
            onMouseLeave={e => { e.target.style.background = 'transparent' }}
            title="Settings"
          >
            &#9881;
          </button>
        </div>
      </header>

      {/* Main reading area */}
      <div
        ref={contentRef}
        style={styles.scrollContainer}
        onScroll={handleScroll}
      >
        <div
          style={{
            ...styles.content,
            fontSize,
            lineHeight,
            fontFamily: `${fontFamily}, Georgia, serif`,
          }}
          onClick={handleContentClick}
        >
          {paragraphs.map((sentences, pIdx) => (
            <p key={pIdx} style={styles.paragraph}>
              {sentences.map((sentence, sIdx) => {
                const sentenceIdx = globalSentenceIdx++
                return (
                  <span key={sIdx} className="sentence">
                    {sentence.tokens.map((token, tIdx) => {
                      const nextToken = sentence.tokens[tIdx + 1]
                      // Add space after token unless next token is punctuation
                      const needsSpace = tIdx < sentence.tokens.length - 1 && nextToken && isWord(nextToken)
                      const spacer = needsSpace ? ' ' : (!nextToken ? '' : /^[,;:!?.)}\]'"]/.test(nextToken) ? '' : ' ')

                      if (isWord(token)) {
                        const wordLower = token.toLowerCase()
                        const savedClass = isWordSaved(wordLower) ? ' word-saved' : ''
                        return (
                          <span key={tIdx}>
                            <span
                              className={`word${savedClass}`}
                              data-word={wordLower}
                              data-sentence-idx={sentenceIdx}
                            >
                              {token}
                            </span>
                            {spacer}
                          </span>
                        )
                      }
                      return (
                        <span key={tIdx}>{token}{spacer}</span>
                      )
                    })}
                  </span>
                )
              })}
            </p>
          ))}
        </div>
      </div>

      {/* Word popup */}
      {selectedWord && (
        <WordPopup
          word={selectedWord.word}
          sentence={selectedWord.sentence}
          rect={selectedWord.rect}
          onClose={() => setSelectedWord(null)}
          bookTitle={currentBook.title}
        />
      )}

      {/* Vocabulary sidebar */}
      <VocabSidebar isOpen={showVocab} onClose={() => setShowVocab(false)} />

      {/* Settings panel */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg, #f4ecd8)',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    borderBottom: '1px solid var(--border, #e0d5be)',
    background: 'var(--bg, #f4ecd8)',
    flexShrink: 0,
    minHeight: 52,
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    fontSize: 15,
    fontFamily: 'Georgia, serif',
    color: 'var(--accent, #8b6914)',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.2s',
    letterSpacing: '0.02em',
  },
  backArrow: {
    fontSize: 18,
    lineHeight: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: 400,
    fontFamily: 'Georgia, serif',
    color: 'var(--text, #3d3229)',
    letterSpacing: '0.02em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 400,
    textAlign: 'center',
    flex: 1,
    margin: '0 16px',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  vocabButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    color: 'var(--accent, #8b6914)',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.2s',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  },
  settingsButton: {
    padding: '6px 10px',
    fontSize: 20,
    color: 'var(--text-secondary, #8b7b6b)',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.2s',
    lineHeight: 1,
  },
  scrollContainer: {
    flex: 1,
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  content: {
    maxWidth: 700,
    margin: '0 auto',
    padding: '40px 32px 120px',
    color: 'var(--text, #3d3229)',
  },
  paragraph: {
    marginBottom: '1.2em',
    textIndent: 0,
  },
}
