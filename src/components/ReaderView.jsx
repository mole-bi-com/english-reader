import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useReadingStore, trackTokenUsage } from '../stores/reading-store'
import { useSettingsStore } from '../stores/settings-store'
import { useVocabStore } from '../stores/vocab-store'
import { useKnownWordsStore } from '../stores/known-words-store'
import { splitSentences, splitWords, isWord } from '../utils/text-parser'
import WordPopup from './WordPopup'
import VocabSidebar from './VocabSidebar'
import SettingsPanel from './SettingsPanel'


export default function ReaderView() {
  const currentBook = useReadingStore(s => s.currentBook)
  const goHome = useReadingStore(s => s.goHome)
  const savePosition = useReadingStore(s => s.savePosition)
  const generateHints = useReadingStore(s => s.generateHints)
  const fontSize = useSettingsStore(s => s.fontSize)
  const lineHeight = useSettingsStore(s => s.lineHeight)
  const fontFamily = useSettingsStore(s => s.fontFamily)
  const loadVocab = useVocabStore(s => s.loadVocab)
  const isWordSaved = useVocabStore(s => s.isWordSaved)
  const vocab = useVocabStore(s => s.vocab)
  const markKnown = useKnownWordsStore(s => s.markKnown)
  const isKnown = useKnownWordsStore(s => s.isKnown)
  const recordLookup = useReadingStore(s => s.recordLookup)
  const sessionLookups = useReadingStore(s => s.sessionLookups)
  const getSessionMinutes = useReadingStore(s => s.getSessionMinutes)


  const [selectedWord, setSelectedWord] = useState(null)
  const [showVocab, setShowVocab] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Hints are always active (no toggle)
  const hintsActive = true

  const [showBookmarkToast, setShowBookmarkToast] = useState(false)

  // Session summary state
  const [showSummary, setShowSummary] = useState(false)

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState([])
  const [quizLoading, setQuizLoading] = useState(false)
  const [revealedAnswers, setRevealedAnswers] = useState(new Set())

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



  // Auto-generate hints when book loads
  useEffect(() => {
    if (currentBook && ['idle', 'error'].includes(currentBook.hintStatus ?? 'idle') && Object.keys(currentBook.hints ?? {}).length === 0) {
      generateHints(currentBook.title)
    }
  }, [currentBook?.title]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualBookmark = () => {
    if (contentRef.current) {
      savePosition(contentRef.current.scrollTop)
      setShowBookmarkToast(true)
      setTimeout(() => setShowBookmarkToast(false), 2000)
    }
  }

  // Escape key moves selection
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
    recordLookup(word)
    console.log('Word clicked:', word, '| Sentence:', sentenceText)
  }, [paragraphs, recordLookup])

  if (!currentBook) return null

  // Build a global sentence index counter
  let globalSentenceIdx = 0

  return (
    <div style={styles.wrapper}>
      {/* Top bar */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <button
            onClick={() => setShowSummary(true)}
            style={styles.backButton}
          >
            <span style={styles.backArrow}>&larr;</span> <span className="desktop-only">Home</span>
          </button>
        </div>

        <div style={styles.topBarRight}>
          <button
            onClick={handleManualBookmark}
            style={styles.bookmarkBtn}
            title="Save Position"
          >
            🔖
          </button>

          <button
            onClick={async () => {
              setShowQuiz(true)
              setQuizLoading(true)
              setQuizQuestions([])
              setRevealedAnswers(new Set())
              try {
                const res = await fetch('/api/comprehension', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: currentBook.text }),
                })
                const data = await res.json()
                if (data.questions && Array.isArray(data.questions)) {
                  setQuizQuestions(data.questions)
                  if (data.usage) trackTokenUsage(data.usage)
                } else if (data.error) {
                  setQuizQuestions([{ question: data.error, answer: '' }])
                } else {
                  setQuizQuestions([{ question: 'Failed to generate questions.', answer: '' }])
                }
              } catch (err) {
                setQuizQuestions([{ question: 'Error: ' + err.message, answer: '' }])
              } finally {
                setQuizLoading(false)
              }
            }}
            style={{
              ...styles.bookmarkBtn,
              fontSize: 14,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Comprehension Check"
          >
            💡 <span className="desktop-only">Quiz</span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            style={styles.settingsButton}
          >
            &#9881;
          </button>
        </div>
      </header>

      {showBookmarkToast && (
        <div style={styles.toast}>Bookmark Saved! 🔖</div>
      )}

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
                  <span
                    key={sIdx}
                    className="sentence"
                    data-sentence-id={sentenceIdx}
                    style={{ display: 'inline' }}
                  >
                    {sentence.tokens.map((token, tIdx) => {
                      const nextToken = sentence.tokens[tIdx + 1]
                      // Add space after token unless next token is punctuation
                      const needsSpace = tIdx < sentence.tokens.length - 1 && nextToken && isWord(nextToken)
                      const spacer = needsSpace ? ' ' : (!nextToken ? '' : /^[,;:!?.)}\]'"]/.test(nextToken) ? '' : ' ')

                      if (isWord(token)) {
                        const wordLower = token.toLowerCase()
                        const savedClass = isWordSaved(wordLower) ? ' word-saved' : ''
                        const hint = currentBook.hints?.[wordLower]
                        const wordIsKnown = isKnown(wordLower)

                        return (
                          <span key={tIdx}>
                            <span
                              className={`word${savedClass}`}
                              data-word={wordLower}
                              data-sentence-idx={sentenceIdx}
                            >
                              {hintsActive && hint && !wordIsKnown ? (
                                <ruby style={styles.hintRuby}>
                                  {token}
                                  <rt style={styles.hintText}>
                                    {hint}
                                    <button
                                      style={styles.knownBtn}
                                      title="I know this word"
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        markKnown(wordLower)
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >×</button>
                                  </rt>
                                </ruby>
                              ) : (
                                token
                              )}
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

      {/* Session Summary Modal */}
      {showSummary && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Session Summary</h2>
            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Reading time</span>
              <span style={styles.summaryValue}>{getSessionMinutes()} min</span>
            </div>
            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Words explored</span>
              <span style={styles.summaryValue}>{sessionLookups.length}</span>
            </div>
            {sessionLookups.length > 0 && (
              <div style={styles.summaryWords}>
                {sessionLookups.slice(0, 15).join(', ')}
                {sessionLookups.length > 15 && '…'}
              </div>
            )}
            <div style={styles.modalBtnRow}>
              <button
                onClick={() => setShowSummary(false)}
                style={styles.modalSecondaryBtn}
              >
                Continue Reading
              </button>
              <button
                onClick={() => { setShowSummary(false); goHome() }}
                style={styles.modalPrimaryBtn}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      {showQuiz && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: 560 }}>
            <h2 style={styles.modalTitle}>Comprehension Check</h2>
            {quizLoading ? (
              <div style={styles.quizLoading}>Generating questions…</div>
            ) : (
              <div>
                {quizQuestions.map((q, idx) => (
                  <div key={idx} style={styles.quizItem}>
                    <p style={styles.quizQuestion}>{idx + 1}. {q.question}</p>
                    {q.question_ko && <p style={styles.quizQuestionKo}>{q.question_ko}</p>}
                    {!revealedAnswers.has(idx) ? (
                      <button
                        onClick={() => setRevealedAnswers(prev => new Set([...prev, idx]))}
                        style={styles.revealBtn}
                      >
                        Reveal Answer
                      </button>
                    ) : (
                      <>
                        <p style={styles.quizAnswer}>{q.answer}</p>
                        {q.answer_ko && <p style={styles.quizAnswerKo}>{q.answer_ko}</p>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={{ ...styles.modalBtnRow, marginTop: 24 }}>
              <button
                onClick={() => { setShowQuiz(false); setRevealedAnswers(new Set()) }}
                style={styles.modalPrimaryBtn}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
    padding: '8px 12px',
    borderBottom: '1px solid var(--border, #e0d5be)',
    background: 'var(--bg, #f4ecd8)',
    flexShrink: 0,
    minHeight: 44,
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    color: 'var(--accent, #8b6914)',
    background: 'transparent',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  backArrow: {
    fontSize: 18,
    lineHeight: 1,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  bookmarkBtn: {
    fontSize: 18,
    background: 'transparent',
    border: '1px solid #e0d5be',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: 8,
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    padding: '8px 10px',
    fontSize: 20,
    color: '#8b7b6b',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  scrollContainer: {
    flex: 1,
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
    background: 'var(--bg, #f4ecd8)',
  },
  content: {
    maxWidth: 750,
    margin: '0 auto',
    padding: '60px 24px 200px',
    color: 'var(--text, #3d3229)',
    transition: 'all 0.5s ease',
  },
  paragraph: {
    marginBottom: '2em',
    textIndent: 0,
  },
  hintRuby: {
    rubyPosition: 'over',
    rubyAlign: 'center',
  },
  hintText: {
    fontSize: '0.65em',
    color: '#a37d1a',
    backgroundColor: 'rgba(255,255,255,0.4)',
    padding: '0 2px',
    borderRadius: 2,
    marginBottom: '0.2em',
    fontFamily: 'sans-serif',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
  },
  knownBtn: {
    background: 'none',
    border: 'none',
    padding: '0 1px',
    margin: 0,
    fontSize: '1em',
    color: '#a37d1a',
    cursor: 'pointer',
    lineHeight: 1,
    opacity: 0.6,
  },
  toast: {
    position: 'fixed',
    top: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#3d3229',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: 8,
    fontSize: 15,
    zIndex: 2000,
    boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
    pointerEvents: 'none',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(61, 50, 41, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    padding: 16,
  },
  modal: {
    background: '#faf6ee',
    border: '1px solid #d4c9b0',
    borderRadius: 10,
    padding: '32px 36px',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 16px 48px rgba(61, 50, 41, 0.18)',
    fontFamily: 'Georgia, serif',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 400,
    color: '#3d3229',
    marginBottom: 24,
    marginTop: 0,
    fontFamily: 'Georgia, serif',
    letterSpacing: '0.01em',
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #e8dfc9',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8b7b6b',
    fontFamily: 'Georgia, serif',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 400,
    color: '#8b6914',
    fontFamily: 'Georgia, serif',
  },
  summaryWords: {
    marginTop: 16,
    fontSize: 13,
    color: '#8b7b6b',
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
    lineHeight: 1.7,
  },
  modalBtnRow: {
    display: 'flex',
    gap: 12,
    marginTop: 28,
    justifyContent: 'flex-end',
  },
  modalPrimaryBtn: {
    padding: '10px 24px',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    background: '#8b6914',
    color: '#faf6ee',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  modalSecondaryBtn: {
    padding: '10px 24px',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    background: 'transparent',
    color: '#8b7b6b',
    border: '1px solid #d4c9b0',
    borderRadius: 6,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  quizLoading: {
    textAlign: 'center',
    padding: '32px 0',
    color: '#8b7b6b',
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
    fontSize: 15,
  },
  quizItem: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottom: '1px solid #e8dfc9',
  },
  quizQuestion: {
    fontSize: 15,
    color: '#3d3229',
    fontFamily: 'Georgia, serif',
    lineHeight: 1.7,
    marginBottom: 12,
    marginTop: 0,
  },
  quizQuestionKo: {
    fontSize: 14,
    color: '#8b7b6b',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    lineHeight: 1.7,
    marginBottom: 12,
    marginTop: -8,
  },
  quizAnswer: {
    fontSize: 14,
    color: '#5a4a3a',
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
    lineHeight: 1.7,
    marginTop: 8,
    marginBottom: 0,
    padding: '10px 14px',
    background: 'rgba(139, 105, 20, 0.07)',
    borderRadius: 6,
    borderLeft: '3px solid #b58d2a',
  },
  quizAnswerKo: {
    fontSize: 13,
    color: '#8b7b6b',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    lineHeight: 1.7,
    marginTop: 6,
    marginBottom: 0,
    paddingLeft: 17,
  },
  revealBtn: {
    padding: '7px 16px',
    fontSize: 13,
    fontFamily: 'Georgia, serif',
    background: 'transparent',
    color: '#8b6914',
    border: '1px solid #c8b070',
    borderRadius: 6,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
}

