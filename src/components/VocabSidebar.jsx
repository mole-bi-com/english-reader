import { useState, useMemo, useEffect } from 'react'
import { useVocabStore } from '../stores/vocab-store'

export default function VocabSidebar({ isOpen, onClose }) {
  const vocab = useVocabStore(s => s.vocab)
  const removeWord = useVocabStore(s => s.removeWord)
  const toggleStar = useVocabStore(s => s.toggleStar)

  const [search, setSearch] = useState('')
  const [bookFilter, setBookFilter] = useState('All Books')

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Unique book titles from saved vocab
  const bookTitles = useMemo(() => {
    const titles = [...new Set(vocab.map(v => v.book_title).filter(Boolean))]
    titles.sort()
    return titles
  }, [vocab])

  // Filtered word list
  const filtered = useMemo(() => {
    let list = vocab
    if (bookFilter !== 'All Books') {
      list = list.filter(v => v.book_title === bookFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(v =>
        v.word.toLowerCase().includes(q) ||
        (v.ko && v.ko.toLowerCase().includes(q))
      )
    }
    return list
  }, [vocab, bookFilter, search])

  // CSV export
  const handleExport = () => {
    const headers = ['word', 'ko', 'pos', 'context_sentence', 'sentence_translation', 'book_title', 'created_at']
    const escape = (val) => {
      if (val == null) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"'
      }
      return str
    }
    const rows = filtered.map(v =>
      headers.map(h => escape(v[h])).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vocab_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          ...styles.overlay,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div
        style={{
          ...styles.panel,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>My Vocabulary</h2>
          <button
            onClick={onClose}
            style={styles.closeButton}
            onMouseEnter={e => { e.target.style.background = 'rgba(139,105,20,0.1)' }}
            onMouseLeave={e => { e.target.style.background = 'transparent' }}
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <div style={styles.controls}>
          <input
            type="text"
            placeholder="Search words..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />

          {/* Book filter */}
          <select
            value={bookFilter}
            onChange={e => setBookFilter(e.target.value)}
            style={styles.bookSelect}
          >
            <option value="All Books">All Books</option>
            {bookTitles.map(title => (
              <option key={title} value={title}>{title}</option>
            ))}
          </select>

          {/* Word count */}
          <div style={styles.wordCount}>
            {filtered.length} word{filtered.length !== 1 ? 's' : ''}
            {bookFilter !== 'All Books' && ` in "${bookFilter}"`}
          </div>
        </div>

        {/* Word list */}
        <div style={styles.wordList}>
          {filtered.length === 0 ? (
            <div style={styles.emptyState}>
              {vocab.length === 0
                ? 'No words saved yet. Tap any word while reading to look it up and save it!'
                : 'No words match your search.'}
            </div>
          ) : (
            filtered.map((entry, idx) => (
              <div key={`${entry.word}-${entry.context_sentence}-${idx}`} style={styles.wordCard}>
                <div style={styles.cardTopRow}>
                  <div style={styles.wordInfo}>
                    <span style={styles.wordText}>{entry.word}</span>
                    {entry.pos && <span style={styles.posTag}>{entry.pos}</span>}
                  </div>
                  <div style={styles.cardActions}>
                    <button
                      onClick={() => toggleStar(entry.word, entry.context_sentence)}
                      style={styles.starButton}
                      title={entry.is_starred ? 'Unstar' : 'Star'}
                    >
                      {entry.is_starred ? '\u2B50' : '\u2606'}
                    </button>
                    <button
                      onClick={() => removeWord(entry.word, entry.context_sentence)}
                      style={styles.deleteButton}
                      title="Remove word"
                    >
                      {'\uD83D\uDDD1\uFE0F'}
                    </button>
                  </div>
                </div>
                {entry.ko && (
                  <div style={styles.koreanMeaning}>{entry.ko}</div>
                )}
                {entry.context_sentence && (
                  <div style={styles.contextSentence}>
                    {entry.context_sentence.length > 120
                      ? entry.context_sentence.slice(0, 120) + '...'
                      : entry.context_sentence}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            onClick={handleExport}
            style={styles.exportButton}
            onMouseEnter={e => { e.target.style.background = '#7a5c10' }}
            onMouseLeave={e => { e.target.style.background = '#8b6914' }}
            disabled={filtered.length === 0}
          >
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>
    </>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 999,
    transition: 'opacity 0.3s ease',
  },
  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: 380,
    height: '100vh',
    background: '#fffdf7',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
    transition: 'transform 0.3s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e0d5be',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 600,
    fontFamily: 'Georgia, serif',
    color: '#3d3229',
    margin: 0,
    letterSpacing: '0.02em',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: 26,
    color: '#8b7b6b',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 6,
    lineHeight: 1,
    transition: 'background 0.2s',
  },
  controls: {
    padding: '14px 20px',
    borderBottom: '1px solid #e0d5be',
    flexShrink: 0,
  },
  searchInput: {
    width: '100%',
    padding: '9px 12px',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    border: '1px solid #d4c9a8',
    borderRadius: 6,
    background: '#fff',
    color: '#3d3229',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 10,
  },
  bookSelect: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: 'Georgia, serif',
    border: '1px solid #d4c9a8',
    borderRadius: 6,
    background: '#fff',
    color: '#3d3229',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 8,
    cursor: 'pointer',
  },
  wordCount: {
    fontSize: 13,
    color: '#8b7b6b',
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
  },
  wordList: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 20px',
  },
  emptyState: {
    textAlign: 'center',
    color: '#a09585',
    fontFamily: 'Georgia, serif',
    fontSize: 14,
    fontStyle: 'italic',
    padding: '40px 20px',
    lineHeight: 1.6,
  },
  wordCard: {
    padding: '12px 14px',
    marginBottom: 10,
    border: '1px solid #e8dcc6',
    borderRadius: 8,
    background: '#fff',
  },
  cardTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  wordInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  wordText: {
    fontWeight: 700,
    fontSize: 15,
    fontFamily: 'Georgia, serif',
    color: '#3d3229',
  },
  posTag: {
    fontSize: 11,
    color: '#8b6914',
    background: 'rgba(139,105,20,0.08)',
    padding: '2px 7px',
    borderRadius: 4,
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  starButton: {
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
  },
  deleteButton: {
    background: 'transparent',
    border: 'none',
    fontSize: 15,
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
    opacity: 0.6,
  },
  koreanMeaning: {
    fontSize: 14,
    color: '#5a4a3a',
    fontFamily: 'Georgia, serif',
    marginBottom: 4,
  },
  contextSentence: {
    fontSize: 12.5,
    color: '#8b7b6b',
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
    lineHeight: 1.5,
    marginTop: 4,
  },
  footer: {
    padding: '14px 20px',
    borderTop: '1px solid #e0d5be',
    flexShrink: 0,
  },
  exportButton: {
    width: '100%',
    padding: '10px 16px',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    fontWeight: 600,
    color: '#fff',
    background: '#8b6914',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.2s',
    letterSpacing: '0.02em',
  },
}
