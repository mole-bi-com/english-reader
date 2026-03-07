import { useState, useEffect, useRef, useCallback } from 'react'
import { lookupLocal, lookupOnline } from '../services/dictionary'
import { translateSentence, aiExplain } from '../services/translator'
import { useVocabStore } from '../stores/vocab-store'

export default function WordPopup({ word, sentence, rect, onClose, bookTitle }) {
  const popupRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [positioned, setPositioned] = useState(false)

  // Dictionary data
  const [localData, setLocalData] = useState(null)
  const [onlineData, setOnlineData] = useState(null)
  const [onlineLoading, setOnlineLoading] = useState(true)

  // Translation
  const [translation, setTranslation] = useState('')
  const [translationLoading, setTranslationLoading] = useState(true)

  // AI Explanation
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Saved state
  const [saved, setSaved] = useState(false)
  const saveWord = useVocabStore(s => s.saveWord)
  const isWordSaved = useVocabStore(s => s.isWordSaved)

  // Check if already saved
  useEffect(() => {
    setSaved(isWordSaved(word))
  }, [word, isWordSaved])

  // Lookup local dictionary immediately
  useEffect(() => {
    const result = lookupLocal(word)
    setLocalData(result)
  }, [word])

  // Lookup online dictionary async
  useEffect(() => {
    let cancelled = false
    setOnlineLoading(true)
    setOnlineData(null)

    lookupOnline(word).then(result => {
      if (!cancelled) {
        setOnlineData(result)
        setOnlineLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [word])

  // Translate sentence async
  useEffect(() => {
    let cancelled = false
    setTranslationLoading(true)
    setTranslation('')

    if (sentence) {
      translateSentence(sentence).then(result => {
        if (!cancelled) {
          setTranslation(result || '')
          setTranslationLoading(false)
        }
      }).catch(() => {
        if (!cancelled) {
          setTranslation('Translation unavailable')
          setTranslationLoading(false)
        }
      })
    } else {
      setTranslationLoading(false)
    }

    return () => { cancelled = true }
  }, [sentence])

  // Reset AI explanation when word changes
  useEffect(() => {
    setAiResult('')
    setAiLoading(false)
  }, [word, sentence])

  // Position popup after render
  useEffect(() => {
    if (!popupRef.current || !rect) return

    const popup = popupRef.current
    const popupRect = popup.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const gap = 8

    let top = rect.bottom + gap
    let left = rect.left

    // If popup overflows bottom, show above the word
    if (top + popupRect.height > viewportH - 16) {
      top = rect.top - popupRect.height - gap
    }

    // If popup overflows right, shift left
    if (left + popupRect.width > viewportW - 16) {
      left = viewportW - popupRect.width - 16
    }

    // Don't go off left edge
    if (left < 16) {
      left = 16
    }

    setPosition({ top, left })
    setPositioned(true)
  }, [rect, localData, onlineData, translation, aiResult])

  // Click outside to close
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        // Don't close if clicking another word - let ReaderView handle it
        if (e.target.closest('[data-word]')) return
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  // Handle AI explanation
  const handleAiExplain = useCallback(async () => {
    setAiLoading(true)
    try {
      const result = await aiExplain(word, sentence)
      setAiResult(result || 'No explanation available.')
    } catch {
      setAiResult('Could not get AI explanation.')
    }
    setAiLoading(false)
  }, [word, sentence])

  // Handle save to vocab
  const handleSave = useCallback(async () => {
    const entry = {
      word: word.toLowerCase(),
      context_sentence: sentence,
      book_title: bookTitle || '',
      ko: localData?.ko || '',
      pos: onlineData?.pos || localData?.pos || '',
      phonetic: onlineData?.phonetic || '',
      en_definition: onlineData?.en_definition || '',
      ko_translation: translation || '',
    }
    await saveWord(entry)
    setSaved(true)
  }, [word, sentence, bookTitle, localData, onlineData, translation, saveWord])

  // Derive display values
  const pos = onlineData?.pos || localData?.pos || ''
  const phonetic = onlineData?.phonetic || ''

  return (
    <div
      ref={popupRef}
      style={{
        ...styles.popup,
        top: position.top,
        left: position.left,
        opacity: positioned ? 1 : 0,
        animation: positioned ? 'wordPopupFadeIn 150ms ease-out' : 'none',
      }}
    >
      {/* Injected keyframes */}
      <style>{`
        @keyframes wordPopupFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wordPopupSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header: word + POS + phonetic */}
      <div style={styles.header}>
        <span style={styles.wordText}>{word}</span>
        {pos && <span style={styles.posTag}>{pos}</span>}
        {phonetic && <span style={styles.phonetic}>{phonetic}</span>}
      </div>

      {/* Korean meaning */}
      {localData?.ko && (
        <div style={styles.meaningRow}>
          <span style={styles.label}>KO</span>
          <span style={styles.meaningText}>{localData.ko}</span>
        </div>
      )}

      {/* English definition */}
      <div style={styles.meaningRow}>
        <span style={styles.label}>EN</span>
        {onlineLoading ? (
          <span style={styles.loadingText}>Loading...</span>
        ) : onlineData?.en_definition ? (
          <span style={styles.meaningText}>{onlineData.en_definition}</span>
        ) : (
          <span style={styles.noData}>No definition found</span>
        )}
      </div>

      <div style={styles.divider} />

      {/* Original sentence */}
      <div style={styles.sentenceBlock}>
        <p style={styles.sentenceText}>{sentence}</p>
      </div>

      {/* Korean translation */}
      <div style={styles.translationRow}>
        <span style={styles.translationLabel}>KO Translation</span>
        {translationLoading ? (
          <Spinner />
        ) : (
          <span style={styles.translationText}>{translation}</span>
        )}
      </div>

      <div style={styles.divider} />

      {/* Action buttons */}
      <div style={styles.actions}>
        <button
          style={{
            ...styles.actionBtn,
            ...(saved ? styles.actionBtnSaved : {}),
          }}
          onClick={handleSave}
          disabled={saved}
          onMouseEnter={e => {
            if (!saved) e.target.style.background = 'rgba(139, 105, 20, 0.1)'
          }}
          onMouseLeave={e => {
            if (!saved) e.target.style.background = 'transparent'
          }}
        >
          {saved ? 'Saved' : 'Save to Vocab'}
        </button>
        <button
          style={styles.actionBtn}
          onClick={handleAiExplain}
          disabled={aiLoading}
          onMouseEnter={e => { e.target.style.background = 'rgba(139, 105, 20, 0.1)' }}
          onMouseLeave={e => { e.target.style.background = 'transparent' }}
        >
          {aiLoading ? 'Thinking...' : 'AI Explanation'}
        </button>
      </div>

      {/* AI Explanation result */}
      {(aiLoading || aiResult) && (
        <>
          <div style={styles.divider} />
          <div style={styles.aiBlock}>
            {aiLoading ? (
              <div style={styles.aiLoading}>
                <Spinner />
                <span style={styles.loadingText}>Getting AI explanation...</span>
              </div>
            ) : (
              <p style={styles.aiText}>{aiResult}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid #e0d5be',
        borderTop: '2px solid #8b6914',
        borderRadius: '50%',
        animation: 'wordPopupSpin 0.6s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

const styles = {
  popup: {
    position: 'fixed',
    zIndex: 1000,
    background: '#fffdf7',
    borderRadius: 8,
    boxShadow: '0 4px 24px rgba(61, 50, 41, 0.18), 0 1px 4px rgba(61, 50, 41, 0.08)',
    maxWidth: 380,
    minWidth: 260,
    padding: '14px 16px',
    fontFamily: 'Georgia, serif',
    color: '#3d3229',
    border: '1px solid #e8dfc9',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  wordText: {
    fontWeight: 700,
    fontSize: 18,
    color: '#3d3229',
  },
  posTag: {
    fontSize: 12,
    color: '#8b6914',
    background: 'rgba(139, 105, 20, 0.1)',
    padding: '1px 6px',
    borderRadius: 4,
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: 500,
  },
  phonetic: {
    fontSize: 13,
    color: '#8b7b6b',
    fontStyle: 'italic',
  },

  // Meaning rows
  meaningRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
    lineHeight: 1.5,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    color: '#fff',
    background: '#8b6914',
    padding: '1px 5px',
    borderRadius: 3,
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    flexShrink: 0,
    marginTop: 3,
    letterSpacing: '0.03em',
  },
  meaningText: {
    fontSize: 14,
    color: '#3d3229',
    lineHeight: 1.5,
  },
  noData: {
    fontSize: 13,
    color: '#b0a590',
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: 13,
    color: '#b0a590',
    fontStyle: 'italic',
  },

  // Divider
  divider: {
    height: 1,
    background: '#e8dfc9',
    margin: '10px 0',
  },

  // Sentence
  sentenceBlock: {
    marginBottom: 6,
  },
  sentenceText: {
    fontSize: 13,
    color: '#5a4e3e',
    fontStyle: 'italic',
    lineHeight: 1.6,
    margin: 0,
  },

  // Translation
  translationRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
  },
  translationLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#fff',
    background: '#6b7d3e',
    padding: '1px 5px',
    borderRadius: 3,
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    flexShrink: 0,
    marginTop: 3,
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
  },
  translationText: {
    fontSize: 14,
    color: '#3d3229',
    lineHeight: 1.5,
  },

  // Actions
  actions: {
    display: 'flex',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: 500,
    color: '#8b6914',
    background: 'transparent',
    border: '1px solid #d4c9a8',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.15s',
    textAlign: 'center',
  },
  actionBtnSaved: {
    color: '#6b7d3e',
    borderColor: '#b5c48a',
    cursor: 'default',
  },

  // AI block
  aiBlock: {
    padding: '4px 0 2px',
  },
  aiLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  aiText: {
    fontSize: 13,
    color: '#3d3229',
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
}
