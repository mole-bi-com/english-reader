import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useReadingStore } from '../stores/reading-store'
import { useSettingsStore } from '../stores/settings-store'
import { useVocabStore } from '../stores/vocab-store'
import { useStatsStore } from '../stores/stats-store'
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

  const addReadActivity = useStatsStore(s => s.addReadActivity)
  const targetWpm = useSettingsStore(s => s.targetWpm)
  const updateSetting = useSettingsStore(s => s.updateSetting)

  const [selectedWord, setSelectedWord] = useState(null)
  const [showVocab, setShowVocab] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Pacemaker state
  const [isPacemakerOn, setIsPacemakerOn] = useState(false)
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(-1)
  const [readWordsCount, setReadWordsCount] = useState(0)

  // Hint & Focus state
  const [showHints, setShowHints] = useState(false)
  const [isLineFocusOn, setIsLineFocusOn] = useState(false)

  // Focus Timer state (countup - elapsed time)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [focusStars, setFocusStars] = useState(0)
  const [showBookmarkToast, setShowBookmarkToast] = useState(false)

  // Session summary state
  const [showSummary, setShowSummary] = useState(false)

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState([])
  const [quizLoading, setQuizLoading] = useState(false)
  const [revealedAnswers, setRevealedAnswers] = useState(new Set())

  const pacemakerTimerRef = useRef(null)
  const focusTimerRef = useRef(null)
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

  // Pacemaker Logic
  useEffect(() => {
    if (!isPacemakerOn || activeSentenceIdx === -1) {
      if (pacemakerTimerRef.current) clearInterval(pacemakerTimerRef.current)
      return
    }

    // Find the current sentence to calculate words
    let count = 0
    let currentSentenceText = ''
    for (const p of paragraphs) {
      for (const s of p) {
        if (count === activeSentenceIdx) {
          currentSentenceText = s.raw
          break
        }
        count++
      }
      if (currentSentenceText) break
    }

    const wordCount = currentSentenceText.split(/\s+/).length
    const durationMs = (wordCount / targetWpm) * 60 * 1000

    pacemakerTimerRef.current = setTimeout(() => {
      const totalSentences = paragraphs.flat().length
      if (activeSentenceIdx < totalSentences - 1) {
        setActiveSentenceIdx(prev => prev + 1)
        setReadWordsCount(prev => prev + wordCount)

        // Auto-scroll to keep active sentence in view
        const activeEl = document.querySelector(`[data-sentence-id="${activeSentenceIdx + 1}"]`)
        if (activeEl && contentRef.current) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } else {
        setIsPacemakerOn(false)
      }
    }, durationMs)

    return () => clearTimeout(pacemakerTimerRef.current)
  }, [isPacemakerOn, activeSentenceIdx, targetWpm, paragraphs])

  // Sync activity words to DB periodically
  useEffect(() => {
    if (readWordsCount >= 50) {
      addReadActivity(readWordsCount, 1) // Assume roughly 1 min per 50-100 words
      setReadWordsCount(0)
    }
  }, [readWordsCount, addReadActivity])

  // Focus Timer Logic (countup)
  useEffect(() => {
    if (isTimerRunning) {
      focusTimerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const next = prev + 1
          if (next > 0 && next % 60 === 0) {
            setFocusStars(s => s + 1)
          }
          return next
        })
      }, 1000)
    } else {
      clearInterval(focusTimerRef.current)
    }
    return () => clearInterval(focusTimerRef.current)
  }, [isTimerRunning])

  // Visibility API to pause timer
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTimerRunning(false)
      } else if (currentBook) {
        setIsTimerRunning(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [currentBook])

  // Start timer on mount/book load
  useEffect(() => {
    if (currentBook) setIsTimerRunning(true)
    return () => setIsTimerRunning(false)
  }, [currentBook])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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

        <div style={styles.focusStats}>
          <span style={styles.timerText}>{formatTime(elapsedTime)}</span>
          <span style={styles.starsText}>{focusStars > 0 ? '✨'.repeat(focusStars) : '⏱️'}</span>
        </div>

        <div style={styles.topBarRight}>
          <button
            onClick={() => {
              if (isLineFocusOn) {
                setIsLineFocusOn(false)
                setIsPacemakerOn(false)
              } else {
                setIsLineFocusOn(true)
                setIsPacemakerOn(true)
                if (activeSentenceIdx === -1) setActiveSentenceIdx(0)
              }
            }}
            style={{
              ...styles.pacemakerBtn,
              background: isLineFocusOn ? 'rgba(139, 105, 20, 0.25)' : 'transparent',
              borderColor: isLineFocusOn ? '#8b6914' : '#e0d5be',
              transform: isLineFocusOn ? 'scale(1.05)' : 'scale(1)'
            }}
          >
            {isLineFocusOn ? '⏹' : '▶'} <span className="desktop-only">{isLineFocusOn ? 'Stop' : 'Focus'}</span>
          </button>

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
                if (Array.isArray(data)) {
                  setQuizQuestions(data)
                } else {
                  setQuizQuestions([{ question: data.error || 'Failed to generate questions.', answer: '' }])
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
            onClick={() => {
              const next = !showHints
              setShowHints(next)
              // Trigger generation if turning on and no hints yet (or previous error)
              if (next && currentBook && ['idle', 'error'].includes(currentBook.hintStatus ?? 'idle') && Object.keys(currentBook.hints ?? {}).length === 0) {
                generateHints(currentBook.title)
              }
            }}
            style={{
              ...styles.hintBtn,
              background: showHints ? 'rgba(139, 105, 20, 0.15)' : 'transparent',
              display: window.innerWidth < 600 && !showHints ? 'none' : 'flex',
              opacity: currentBook?.hintStatus === 'loading' ? 0.7 : 1,
            }}
            title={currentBook?.hintStatus === 'error' ? 'Hint analysis failed — click to retry' : undefined}
          >
            {currentBook?.hintStatus === 'loading' ? '⏳' : '🪄'}
            {' '}
            <span className="desktop-only">
              {currentBook?.hintStatus === 'loading' ? 'Analyzing…'
                : currentBook?.hintStatus === 'error' ? 'Retry Hints'
                : showHints ? 'Hints On' : 'Hints'}
            </span>
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
            opacity: isLineFocusOn ? 1 : 1, // container overall
          }}
          className={isLineFocusOn ? 'line-focus-mode' : ''}
          onClick={handleContentClick}
        >
          {paragraphs.map((sentences, pIdx) => (
            <p key={pIdx} style={styles.paragraph}>
              {sentences.map((sentence, sIdx) => {
                const sentenceIdx = globalSentenceIdx++
                const isActive = activeSentenceIdx === sentenceIdx
                return (
                  <span
                    key={sIdx}
                    className={`sentence${isActive ? ' sentence-active' : ''}`}
                    data-sentence-id={sentenceIdx}
                    style={{
                      ...(isActive ? styles.activeSentence : {}),
                      opacity: isLineFocusOn && !isActive ? 0.3 : 1,
                      transition: 'opacity 0.4s ease',
                      display: 'inline', // Ensure sentences wrap correctly
                    }}
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
                              {showHints && hint && !wordIsKnown ? (
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
    padding: '10px 20px',
    borderBottom: '1px solid var(--border, #e0d5be)',
    background: 'var(--bg, #f4ecd8)',
    flexShrink: 0,
    minHeight: 60,
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
  focusStats: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(139, 105, 20, 0.08)',
    padding: '6px 14px',
    borderRadius: 24,
    border: '1px solid rgba(139, 105, 20, 0.15)',
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  timerText: {
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'monospace',
    color: '#8b6914',
    letterSpacing: '0.05em',
  },
  starsText: {
    fontSize: 16,
    letterSpacing: 1,
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
  pacemakerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 14px',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'Georgia, serif',
    color: '#8b6914',
    border: '1px solid #e0d5be',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  activeSentence: {
    background: 'rgba(255, 255, 224, 0.95)',
    boxShadow: '0 4px 12px rgba(139, 105, 20, 0.1), -4px 0 0 #8b6914',
    borderRadius: '0 4px 4px 0',
    padding: '2px 4px 2px 8px',
    position: 'relative',
    zIndex: 10,
  },
  hintBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    fontSize: 14,
    color: '#8b6914',
    border: '1px solid #e0d5be',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s',
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

