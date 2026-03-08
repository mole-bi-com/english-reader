import { useReadingStore } from '../stores/reading-store'
import { useSettingsStore } from '../stores/settings-store'
import { useStatsStore } from '../stores/stats-store'
import SettingsPanel from './SettingsPanel'
import { useEffect } from 'react'

const SAMPLE_TEXT = `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.

"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"

Mr. Bennet replied that he had not.

"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."

Mr. Bennet made no answer.

"Do not you want to know who has taken it?" cried his wife impatiently.

"You want to tell me, and I have no objection to hearing it."

This was invitation enough.

"Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England; that he came down on Monday in a chaise and four to see the place, and was so much delighted with it that he agreed with Mr. Morris immediately; that he is to take possession before Michaelmas, and some of his servants are to be in the house by the end of next week."`

const styles = {
  container: {
    maxWidth: 700,
    margin: '0 auto',
    padding: '60px 32px 80px',
    minHeight: '100vh',
    position: 'relative',
  },
  settingsGear: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: '6px 10px',
    fontSize: 22,
    color: 'var(--text-secondary, #8b7b6b)',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.2s',
    lineHeight: 1,
  },
  header: {
    textAlign: 'center',
    marginBottom: 52,
  },
  icon: {
    fontSize: 36,
    marginBottom: 12,
    display: 'block',
    opacity: 0.6,
  },
  title: {
    fontSize: 32,
    fontWeight: 400,
    letterSpacing: '0.02em',
    color: 'var(--text, #3d3229)',
    marginBottom: 8,
    fontFamily: 'Georgia, serif',
  },
  subtitle: {
    fontSize: 15,
    color: 'var(--text-secondary, #8b7b6b)',
    fontWeight: 400,
    letterSpacing: '0.03em',
    fontFamily: 'Georgia, serif',
  },
  section: {
    marginBottom: 44,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--text-secondary, #8b7b6b)',
    marginBottom: 16,
    fontFamily: 'Georgia, serif',
    fontWeight: 400,
  },
  titleInput: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 18,
    fontFamily: 'Georgia, serif',
    border: '1px solid var(--border, #d4c9b0)',
    borderRadius: 6,
    background: 'var(--card-bg, #faf6ee)',
    color: 'var(--text, #3d3229)',
    outline: 'none',
    marginBottom: 12,
    transition: 'border-color 0.2s',
  },
  textarea: {
    width: '100%',
    minHeight: 220,
    padding: '18px 20px',
    fontSize: 16,
    lineHeight: 1.8,
    fontFamily: 'Georgia, serif',
    border: '1px solid var(--border, #d4c9b0)',
    borderRadius: 6,
    background: 'var(--card-bg, #faf6ee)',
    color: 'var(--text, #3d3229)',
    outline: 'none',
    resize: 'vertical',
    transition: 'border-color 0.2s',
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  startButton: {
    padding: '12px 32px',
    fontSize: 16,
    fontFamily: 'Georgia, serif',
    background: 'var(--accent, #8b6914)',
    color: '#faf6ee',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    letterSpacing: '0.03em',
    transition: 'background 0.2s, opacity 0.2s',
  },
  startButtonDisabled: {
    padding: '12px 32px',
    fontSize: 16,
    fontFamily: 'Georgia, serif',
    background: 'var(--accent, #8b6914)',
    color: '#faf6ee',
    border: 'none',
    borderRadius: 6,
    cursor: 'not-allowed',
    opacity: 0.4,
    letterSpacing: '0.03em',
  },
  sampleButton: {
    padding: '12px 20px',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    background: 'transparent',
    color: 'var(--text-secondary, #8b7b6b)',
    border: '1px solid var(--border, #d4c9b0)',
    borderRadius: 6,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'color 0.2s, border-color 0.2s',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid var(--border, #ddd3be)',
    margin: '44px 0',
  },
  bookList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  bookItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    marginBottom: 8,
    background: 'var(--card-bg, #faf6ee)',
    borderRadius: 6,
    border: '1px solid var(--border, #e8dfc9)',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  },
  bookTitle: {
    fontSize: 16,
    fontFamily: 'Georgia, serif',
    color: 'var(--text, #3d3229)',
    fontWeight: 400,
  },
  bookMeta: {
    fontSize: 13,
    color: 'var(--text-secondary, #a89880)',
    fontFamily: 'Georgia, serif',
  },
  bookProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    width: 60,
    height: 4,
    background: 'var(--border, #e8dfc9)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent, #8b6914)',
    borderRadius: 2,
    transition: 'width 0.3s',
  },
  emptyState: {
    textAlign: 'center',
    padding: '32px 0',
    color: 'var(--text-secondary, #a89880)',
    fontSize: 15,
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
  },
  // Header
  header: {
    textAlign: 'center',
    marginBottom: 52,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  streakBadge: {
    padding: '6px 16px',
    background: 'linear-gradient(135deg, #ff9d00, #ff5e00)',
    color: '#fff',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 16,
    boxShadow: '0 4px 12px rgba(255, 94, 0, 0.3)',
    letterSpacing: '0.05em',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  },
  dailyProgressContainer: {
    width: '100%',
    maxWidth: 280,
    marginTop: 8,
  },
  dailyProgressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#8b7b6b',
    marginBottom: 6,
    fontFamily: 'Georgia, serif',
  },
  dailyProgressBar: {
    width: '100%',
    height: 8,
    background: '#e8dfc9',
    borderRadius: 4,
    overflow: 'hidden',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
  },
  dailyProgressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #8b6914, #b58d2a)',
    borderRadius: 4,
    transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
}

export default function HomeView() {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const books = useReadingStore(s => s.books)
  const startReading = useReadingStore(s => s.startReading)
  const loadBooks = useReadingStore(s => s.loadBooks)

  const dailyStreak = useSettingsStore(s => s.dailyStreak)
  const loadSettings = useSettingsStore(s => s.loadSettings)

  const fetchStats = useStatsStore(s => s.fetchStats)
  const dailyStats = useStatsStore(s => s.dailyStats)

  useEffect(() => {
    loadBooks()
    loadSettings()
    fetchStats()
  }, [loadBooks, loadSettings, fetchStats])

  const todayStats = dailyStats.find(s => s.read_date.startsWith(new Date().toISOString().split('T')[0]))
  const wordsToday = todayStats ? todayStats.words_read : 0
  const dailyTarget = 500 // Example target
  const progressPercent = Math.min(100, Math.round((wordsToday / dailyTarget) * 100))

  const canStart = text.trim().length > 0

  const handleStart = () => {
    if (!canStart) return
    const bookTitle = title.trim() || 'Untitled'
    startReading(bookTitle, text.trim())
  }

  const handleSample = () => {
    setTitle('Pride and Prejudice')
    setText(SAMPLE_TEXT)
  }

  const handleResumeBook = (book) => {
    startReading(book.title, book.text)
  }

  const getProgress = (book) => {
    if (!book.text) return 0
    return Math.min(100, Math.round((book.last_position / book.text.length) * 100))
  }

  const calculateDifficulty = (bookText) => {
    if (!bookText || vocab.length === 0) return 0
    // Simple word-based intersection
    const words = bookText.toLowerCase().match(/\b\w{3,}\b/g) || [] // only 3+ letter words
    if (words.length === 0) return 100

    const uniqueWords = [...new Set(words)]
    const knownWords = uniqueWords.filter(w => vocab.some(v => v.word.toLowerCase() === w))

    return Math.round((knownWords.length / uniqueWords.length) * 100)
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div style={styles.container}>
      {/* Settings gear in top-right corner */}
      <button
        onClick={() => setShowSettings(true)}
        style={styles.settingsGear}
        onMouseEnter={e => { e.target.style.background = 'rgba(139, 105, 20, 0.1)' }}
        onMouseLeave={e => { e.target.style.background = 'transparent' }}
        title="Settings"
      >
        &#9881;
      </button>

      <header style={styles.header}>
        <div style={styles.streakBadge}>
          🔥 {dailyStreak} DAY STREAK
        </div>
        <h1 style={styles.title}>English Reader</h1>

        <div style={styles.dailyProgressContainer}>
          <div style={styles.dailyProgressHeader}>
            <span>Today's Progress</span>
            <span>{wordsToday} / {dailyTarget} words</span>
          </div>
          <div style={styles.dailyProgressBar}>
            <div style={{ ...styles.dailyProgressFill, width: `${progressPercent}%` }} />
          </div>
        </div>
      </header>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>New Reading</h2>
        <input
          type="text"
          placeholder="Book title (optional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={styles.titleInput}
          onFocus={e => { e.target.style.borderColor = '#8b6914' }}
          onBlur={e => { e.target.style.borderColor = '#d4c9b0' }}
        />
        <textarea
          placeholder="Paste your English text here..."
          value={text}
          onChange={e => setText(e.target.value)}
          style={styles.textarea}
          onFocus={e => { e.target.style.borderColor = '#8b6914' }}
          onBlur={e => { e.target.style.borderColor = '#d4c9b0' }}
        />
        <div style={styles.buttonRow}>
          <button
            onClick={handleStart}
            disabled={!canStart}
            style={canStart ? styles.startButton : styles.startButtonDisabled}
            onMouseEnter={e => { if (canStart) e.target.style.background = '#a37d1a' }}
            onMouseLeave={e => { if (canStart) e.target.style.background = '#8b6914' }}
          >
            Start Reading
          </button>
          <button
            onClick={handleSample}
            style={styles.sampleButton}
            onMouseEnter={e => {
              e.target.style.color = '#3d3229'
              e.target.style.borderColor = '#8b6914'
            }}
            onMouseLeave={e => {
              e.target.style.color = '#8b7b6b'
              e.target.style.borderColor = '#d4c9b0'
            }}
          >
            Try Sample Text
          </button>
        </div>
      </section>

      {books.length > 0 && (
        <>
          <hr style={styles.divider} />
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Recent Books</h2>
            <ul style={styles.bookList}>
              {books.map((book) => {
                const progress = getProgress(book)
                return (
                  <li
                    key={book.title}
                    style={styles.bookItem}
                    onClick={() => handleResumeBook(book)}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#8b6914'
                      e.currentTarget.style.background = '#f7f0e2'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#e8dfc9'
                      e.currentTarget.style.background = '#faf6ee'
                    }}
                  >
                    <div>
                      <div style={styles.bookTitle}>{book.title}</div>
                      <div style={styles.bookMeta}>
                        {formatDate(book.created_at)} • {calculateDifficulty(book.text)}% known
                      </div>
                    </div>
                    <div style={styles.bookProgress}>
                      <span style={styles.bookMeta}>{progress}%</span>
                      <div style={styles.progressBar}>
                        <div
                          style={{ ...styles.progressFill, width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}

      {books.length === 0 && (
        <>
          <hr style={styles.divider} />
          <p style={styles.emptyState}>
            No books yet. Paste some text above to begin reading.
          </p>
        </>
      )}

      {/* Settings panel */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
