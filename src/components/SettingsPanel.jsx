import { useState } from 'react'
import { useSettingsStore } from '../stores/settings-store'

const themes = [
  { key: 'sepia', label: 'Sepia', color: '#f4ecd8' },
  { key: 'light', label: 'Light', color: '#fafaf8' },
  { key: 'dark', label: 'Dark', color: '#1a1a1e' },
]

export default function SettingsPanel({ isOpen, onClose }) {
  const theme = useSettingsStore(s => s.theme)
  const fontSize = useSettingsStore(s => s.fontSize)
  const lineHeight = useSettingsStore(s => s.lineHeight)
  const apiKey = useSettingsStore(s => s.apiKey)
  const updateSetting = useSettingsStore(s => s.updateSetting)

  const [showApiKey, setShowApiKey] = useState(false)

  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Settings</h2>
          <button
            onClick={onClose}
            style={styles.closeButton}
            onMouseEnter={e => { e.target.style.background = 'rgba(0,0,0,0.06)' }}
            onMouseLeave={e => { e.target.style.background = 'transparent' }}
          >
            &#x2715;
          </button>
        </div>

        {/* Theme selector */}
        <div style={styles.section}>
          <label style={styles.label}>Theme</label>
          <div style={styles.themeRow}>
            {themes.map(t => {
              const isActive = theme === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => updateSetting('theme', t.key)}
                  style={{
                    ...styles.themeButton,
                    borderColor: isActive ? '#8b6914' : '#d4c9b0',
                    background: isActive ? 'rgba(139, 105, 20, 0.08)' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.borderColor = '#8b6914'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.borderColor = '#d4c9b0'
                  }}
                >
                  <span
                    style={{
                      ...styles.themePreview,
                      background: t.color,
                      border: t.key === 'dark' ? '1px solid #555' : '1px solid #ccc',
                    }}
                  />
                  <span style={{
                    ...styles.themeLabel,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#8b6914' : '#6b5d4d',
                  }}>
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Font size */}
        <div style={styles.section}>
          <div style={styles.sliderHeader}>
            <label style={styles.label}>Font Size</label>
            <span style={styles.sliderValue}>{fontSize}px</span>
          </div>
          <input
            type="range"
            min={14}
            max={32}
            step={1}
            value={fontSize}
            onChange={e => updateSetting('fontSize', Number(e.target.value))}
            style={styles.slider}
          />
        </div>

        {/* Line height */}
        <div style={styles.section}>
          <div style={styles.sliderHeader}>
            <label style={styles.label}>Line Height</label>
            <span style={styles.sliderValue}>{lineHeight.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={1.4}
            max={2.6}
            step={0.1}
            value={lineHeight}
            onChange={e => updateSetting('lineHeight', Number(e.target.value))}
            style={styles.slider}
          />
        </div>

        {/* API Key */}
        <div style={styles.section}>
          <label style={styles.label}>Gemini API Key</label>
          <div style={styles.apiKeyRow}>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => updateSetting('apiKey', e.target.value)}
              placeholder="Enter your API key"
              style={styles.apiKeyInput}
              onFocus={e => { e.target.style.borderColor = '#8b6914' }}
              onBlur={e => { e.target.style.borderColor = '#d4c9b0' }}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              style={styles.toggleVisibility}
              onMouseEnter={e => { e.target.style.background = 'rgba(0,0,0,0.06)' }}
              onMouseLeave={e => { e.target.style.background = 'transparent' }}
              title={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? '\u25C9' : '\u25CB'}
            </button>
          </div>
          <p style={styles.apiKeyHint}>
            Enter your Google AI Studio API key for translations
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  panel: {
    background: '#fffdf7',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
    maxWidth: 450,
    width: '90%',
    padding: '28px 32px 32px',
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 400,
    fontFamily: 'Georgia, serif',
    color: '#3d3229',
    letterSpacing: '0.02em',
  },
  closeButton: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    fontSize: 16,
    color: '#8b7b6b',
    cursor: 'pointer',
    transition: 'background 0.2s',
    lineHeight: 1,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    display: 'block',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#8b7b6b',
    marginBottom: 10,
    fontFamily: 'Georgia, serif',
    fontWeight: 400,
  },
  themeRow: {
    display: 'flex',
    gap: 10,
  },
  themeButton: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: '14px 12px',
    border: '2px solid #d4c9b0',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    fontFamily: 'Georgia, serif',
  },
  themePreview: {
    display: 'inline-block',
    width: 32,
    height: 32,
    borderRadius: '50%',
  },
  themeLabel: {
    fontSize: 13,
    letterSpacing: '0.02em',
  },
  sliderHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sliderValue: {
    fontSize: 14,
    color: '#3d3229',
    fontFamily: 'Georgia, serif',
    fontWeight: 400,
  },
  slider: {
    width: '100%',
    accentColor: '#8b6914',
    cursor: 'pointer',
    marginTop: 2,
  },
  apiKeyRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  apiKeyInput: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    border: '1px solid #d4c9b0',
    borderRadius: 6,
    background: '#faf6ee',
    color: '#3d3229',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  toggleVisibility: {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    fontSize: 18,
    color: '#8b7b6b',
    cursor: 'pointer',
    transition: 'background 0.2s',
    flexShrink: 0,
  },
  apiKeyHint: {
    fontSize: 12,
    color: '#a89880',
    marginTop: 8,
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
  },
}
