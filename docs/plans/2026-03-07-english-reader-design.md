# English Reader MVP Design

## Overview

macOS desktop app for reading English books with instant word lookup (Korean meanings + sentence translation).
Click any word → see definition + sentence translation powered by Gemini.

## Tech Stack

- **Framework**: Electron + Vite + React (JavaScript)
- **State Management**: Zustand
- **Data Storage**: electron-store (JSON-based)
- **Translation LLM**: Gemini 3.1 Flash Lite Preview (`gemini-3.1-flash-lite-preview`)
- **Local Dictionary**: kengdic open-source (30k words) + API query caching

## Architecture

```
Main Process (Electron)
├── File I/O (electron-store read/write)
├── Gemini API calls (CORS-free)
└── IPC handlers

Renderer Process (React)
├── UI components
├── Zustand stores
└── IPC calls to main
```

## Components

```
App.jsx
├── HomeView.jsx      — Text paste input + recent books list
├── ReaderView.jsx    — Clickable word-level text rendering
│   └── WordPopup.jsx — Definition + sentence translation + AI explanation
├── VocabSidebar.jsx  — Saved vocabulary list
└── SettingsPanel.jsx — Theme/font/API key settings
```

## Key Features

### 1. Text Input (HomeView)
- Textarea for pasting English text
- Book title input field
- "Start Reading" button
- Recent books list from local storage
- Sample text button

### 2. Reader (ReaderView)
- Text split into sentences, words wrapped in `<span>` tags
- Word click → WordPopup
- Word hover → subtle background highlight
- Saved words → dot indicator
- Font size (14-32px), line height (1.4-2.6), theme selection
- Auto-save/restore scroll position

### 3. Word Popup (WordPopup)
Display order:
1. Word + POS + phonetic
2. Korean meaning (local dict, <100ms)
3. English definition (Free Dictionary API)
4. Original sentence (italic)
5. Korean sentence translation (Gemini API auto-call)
6. [Save to vocab] [AI explanation] buttons

AI explanation (on button click):
- Contextual meaning explanation in Korean
- Why this word is used in this context
- Difference from other common meanings

### 4. Dictionary Service
- **Layer 1**: Local dict (kengdic JSON, instant)
- **Layer 2**: Free Dictionary API (parallel, phonetic + English def)
- **Cache**: New lookups cached to electron-store for offline use

### 5. Translation & AI (Gemini)
- Model: `gemini-3.1-flash-lite-preview`
- API Key: stored in settings (electron-store)
- All API calls via main process IPC (CORS-free)
- Sentence translation: auto-called on word click
- AI explanation: on-demand via button

### 6. Vocabulary Store
Saved word data:
- word, ko, en, pos, phonetic
- context_sentence, sentence_translation
- ai_explanation (if requested)
- book_title, created_at, is_starred

Features:
- Filter by book / date
- Search
- CSV export

## Data Storage (electron-store)

```json
{
  "vocab": [{ "word": "...", "ko": "...", "context_sentence": "...", ... }],
  "books": [{ "title": "...", "text": "...", "lastPosition": 0, "createdAt": "..." }],
  "settings": { "theme": "sepia", "fontSize": 20, "lineHeight": 1.9, "fontFamily": "Georgia", "apiKey": "" },
  "dictCache": { "word": { "ko": "...", "pos": "...", "phonetic": "..." } }
}
```

## Themes

| Theme | Background | Text | Accent |
|-------|-----------|------|--------|
| sepia | #f4ecd8 | #3d3229 | #8b6914 |
| light | #fafaf8 | #2c2c2c | #5a4a2a |
| dark  | #1a1a1e | #d4d0c8 | #e8b84b |

## Dependencies

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "zustand": "^4",
    "electron-store": "^8"
  },
  "devDependencies": {
    "electron": "^33",
    "electron-builder": "^25",
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "vite-plugin-electron": "^0.28",
    "vite-plugin-electron-renderer": "^0.14"
  }
}
```

## Key Decisions

1. **No ePub** — MVP supports text paste only. Removes epubjs dependency.
2. **No SQLite** — electron-store (JSON) instead. No native module rebuild needed.
3. **Gemini not Claude** — All LLM calls use Gemini 3.1 Flash Lite Preview.
4. **API calls in main process** — Avoids CORS issues in renderer.
5. **kengdic + caching** — Base 30k words + auto-cache new lookups.
