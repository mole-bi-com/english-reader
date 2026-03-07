# English Reader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a macOS desktop app where users paste English text, click any word to see Korean meaning + sentence translation via Gemini.

**Architecture:** Electron main process handles file I/O and Gemini API calls (CORS-free). React renderer communicates via IPC. Zustand manages UI state, electron-store persists data as JSON.

**Tech Stack:** Electron 33, Vite 5, React 18, Zustand 4, electron-store 8, Gemini 3.1 Flash Lite Preview

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `electron/main.js`
- Create: `electron/preload.js`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/index.css`
- Create: `index.html`
- Create: `.gitignore`

**Step 1: Initialize project and install dependencies**

```bash
cd /Users/seungwoolee/Downloads/english-reader
npm init -y
npm install react react-dom zustand electron-store
npm install -D electron electron-builder vite @vitejs/plugin-react vite-plugin-electron vite-plugin-electron-renderer
```

**Step 2: Create package.json with correct scripts and main entry**

`package.json` must have:
```json
{
  "name": "english-reader",
  "version": "1.0.0",
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**Step 3: Create vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.js',
      },
      {
        entry: 'electron/preload.js',
        onstart(args) {
          args.reload()
        },
      },
    ]),
    renderer(),
  ],
})
```

**Step 4: Create electron/main.js**

Minimal Electron main process:
- BrowserWindow: 1200x800, min 900x600
- titleBarStyle: 'hiddenInset' (macOS native feel)
- Load Vite dev server in dev, file:// in production
- preload.js attached

```js
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

**Step 5: Create electron/preload.js**

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  translateSentence: (sentence) => ipcRenderer.invoke('translate-sentence', sentence),
  aiExplain: (word, sentence) => ipcRenderer.invoke('ai-explain', word, sentence),
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
})
```

**Step 6: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>English Reader</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Step 7: Create src/main.jsx and src/App.jsx**

`src/main.jsx`:
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/App.jsx`:
```jsx
import { useState } from 'react'

export default function App() {
  return (
    <div className="app">
      <h1>English Reader</h1>
      <p>Coming soon...</p>
    </div>
  )
}
```

**Step 8: Create src/index.css with base theme**

Sepia theme as default:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: Georgia, 'Times New Roman', serif;
  background: #f4ecd8;
  color: #3d3229;
}
.app {
  padding-top: 40px; /* space for macOS title bar */
}
```

**Step 9: Create .gitignore**

```
node_modules/
dist/
dist-electron/
.env
*.dmg
```

**Step 10: Run dev to verify**

```bash
cd /Users/seungwoolee/Downloads/english-reader
npm run dev
```

Expected: Electron window opens with "English Reader" heading on sepia background.

**Step 11: Init git and commit**

```bash
cd /Users/seungwoolee/Downloads/english-reader
git init
git add -A
git commit -m "feat: project scaffolding - Electron + Vite + React"
```

---

### Task 2: electron-store IPC + Settings Store

**Files:**
- Modify: `electron/main.js` (add electron-store + IPC handlers)
- Create: `src/stores/settings-store.js`

**Step 1: Add electron-store and IPC handlers to main.js**

Add to `electron/main.js` after imports:
```js
const Store = require('electron-store')
const store = new Store()

// IPC handlers
ipcMain.handle('store-get', (_, key) => store.get(key))
ipcMain.handle('store-set', (_, key, value) => store.set(key, value))
```

**Step 2: Create settings store**

`src/stores/settings-store.js`:
```js
import { create } from 'zustand'

const defaults = {
  theme: 'sepia',
  fontSize: 20,
  lineHeight: 1.9,
  fontFamily: 'Georgia',
  apiKey: '',
}

export const useSettingsStore = create((set, get) => ({
  ...defaults,
  loaded: false,

  loadSettings: async () => {
    const saved = await window.electronAPI.storeGet('settings')
    if (saved) set({ ...saved, loaded: true })
    else set({ loaded: true })
  },

  updateSetting: async (key, value) => {
    set({ [key]: value })
    const { theme, fontSize, lineHeight, fontFamily, apiKey } = { ...get(), [key]: value }
    await window.electronAPI.storeSet('settings', { theme, fontSize, lineHeight, fontFamily, apiKey })
  },
}))
```

**Step 3: Run dev to verify no errors**

```bash
npm run dev
```

**Step 4: Commit**

```bash
git add electron/main.js src/stores/settings-store.js
git commit -m "feat: electron-store IPC + settings store"
```

---

### Task 3: Local Dictionary (kengdic)

**Files:**
- Create: `scripts/build-dict.js` (script to download and convert kengdic)
- Create: `assets/dict/en-ko-dict.json` (generated)
- Create: `src/services/dictionary.js`

**Step 1: Create dictionary build script**

`scripts/build-dict.js` — Downloads kengdic TSV from GitHub, converts to JSON `{ "word": { "ko": "...", "pos": "..." } }`.

The kengdic project hosts TSV data at:
`https://raw.githubusercontent.com/garfieldnate/kengdic/master/kengdic_2011.tsv`

Parse TSV, extract English word + Korean meaning + POS, save as JSON.

**Step 2: Run the script**

```bash
node scripts/build-dict.js
```

Expected: `assets/dict/en-ko-dict.json` created with ~30k entries.

**Step 3: Create dictionary service**

`src/services/dictionary.js`:
```js
import dictData from '../../assets/dict/en-ko-dict.json'

// Layer 1: Local dictionary lookup (instant)
export function lookupLocal(word) {
  const lower = word.toLowerCase()
  const entry = dictData[lower]
  if (entry) return { word: lower, ko: entry.ko, pos: entry.pos || '' }
  return null
}

// Layer 2: Free Dictionary API (async)
export async function lookupOnline(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`)
    if (!res.ok) return null
    const data = await res.json()
    const entry = data[0]
    const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || ''
    const meaning = entry.meanings?.[0]
    const definition = meaning?.definitions?.[0]?.definition || ''
    const pos = meaning?.partOfSpeech || ''
    return { phonetic, en_definition: definition, pos }
  } catch {
    return null
  }
}

// Combined lookup
export async function lookupWord(word) {
  const local = lookupLocal(word)
  const result = {
    word: word.toLowerCase(),
    ko: local?.ko || '',
    pos: local?.pos || '',
    phonetic: '',
    en_definition: '',
    loading: true,
  }

  // Fire online lookup in parallel
  const online = await lookupOnline(word)
  if (online) {
    result.phonetic = online.phonetic
    result.en_definition = online.en_definition
    if (!result.pos && online.pos) result.pos = online.pos
  }
  result.loading = false

  return result
}
```

**Step 4: Commit**

```bash
git add scripts/ assets/dict/ src/services/dictionary.js
git commit -m "feat: local dictionary (kengdic) + Free Dictionary API service"
```

---

### Task 4: Gemini API Service (Main Process IPC)

**Files:**
- Modify: `electron/main.js` (add Gemini IPC handlers)
- Create: `src/services/translator.js` (renderer-side IPC wrapper)

**Step 1: Add Gemini API handlers to main.js**

Add IPC handlers in `electron/main.js`:

```js
// Gemini API call helper
async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

ipcMain.handle('translate-sentence', async (_, sentence) => {
  const apiKey = store.get('settings.apiKey')
  if (!apiKey) return '(API key not set)'
  const prompt = `Translate this English sentence to natural Korean. Return ONLY the Korean translation, nothing else:\n\n${sentence}`
  return callGemini(apiKey, prompt)
})

ipcMain.handle('ai-explain', async (_, word, sentence) => {
  const apiKey = store.get('settings.apiKey')
  if (!apiKey) return '(API key not set)'
  const prompt = `다음 영어 문장에서 "${word}"이라는 단어가 사용되었습니다:

"${sentence}"

한국어로 다음을 설명해주세요:
1. 이 문맥에서의 정확한 의미
2. 이 단어가 이 문맥에서 왜 쓰였는지
3. 다른 흔한 의미와의 차이점

간결하게 답해주세요.`
  return callGemini(apiKey, prompt)
})
```

**Step 2: Create renderer-side wrapper**

`src/services/translator.js`:
```js
export async function translateSentence(sentence) {
  return window.electronAPI.translateSentence(sentence)
}

export async function aiExplain(word, sentence) {
  return window.electronAPI.aiExplain(word, sentence)
}
```

**Step 3: Verify no errors**

```bash
npm run dev
```

**Step 4: Commit**

```bash
git add electron/main.js src/services/translator.js
git commit -m "feat: Gemini API service via IPC (translate + AI explain)"
```

---

### Task 5: HomeView Component

**Files:**
- Create: `src/components/HomeView.jsx`
- Modify: `src/App.jsx` (add routing)
- Create: `src/stores/reading-store.js`

**Step 1: Create reading store**

`src/stores/reading-store.js`:
```js
import { create } from 'zustand'

export const useReadingStore = create((set, get) => ({
  books: [],
  currentBook: null,

  loadBooks: async () => {
    const books = await window.electronAPI.storeGet('books') || []
    set({ books })
  },

  startReading: async (title, text) => {
    const books = get().books
    const existing = books.find(b => b.title === title)
    const book = existing || { title, text, lastPosition: 0, createdAt: new Date().toISOString() }

    if (!existing) {
      book.text = text
      books.unshift(book)
      await window.electronAPI.storeSet('books', books)
    }

    set({ currentBook: book, books })
  },

  savePosition: async (position) => {
    const { currentBook, books } = get()
    if (!currentBook) return
    currentBook.lastPosition = position
    const updated = books.map(b => b.title === currentBook.title ? currentBook : b)
    set({ books: updated, currentBook: { ...currentBook } })
    await window.electronAPI.storeSet('books', updated)
  },

  goHome: () => set({ currentBook: null }),
}))
```

**Step 2: Create HomeView**

`src/components/HomeView.jsx`:
- Textarea for pasting text
- Title input
- "Start Reading" button
- Recent books list
- Sample text button (hardcoded sample paragraph)
- Sepia-themed, minimal book feel, Georgia font

**Step 3: Update App.jsx with view switching**

```jsx
import { useEffect } from 'react'
import { useReadingStore } from './stores/reading-store'
import { useSettingsStore } from './stores/settings-store'
import HomeView from './components/HomeView'

export default function App() {
  const currentBook = useReadingStore(s => s.currentBook)
  const loadBooks = useReadingStore(s => s.loadBooks)
  const loadSettings = useSettingsStore(s => s.loadSettings)

  useEffect(() => {
    loadBooks()
    loadSettings()
  }, [])

  if (currentBook) return <div>Reader coming soon...</div>
  return <HomeView />
}
```

**Step 4: Run dev and verify**

HomeView should show with textarea, title input, start button on sepia background.

**Step 5: Commit**

```bash
git add src/components/HomeView.jsx src/stores/reading-store.js src/App.jsx
git commit -m "feat: HomeView with text paste + recent books"
```

---

### Task 6: ReaderView — Word-Level Text Rendering

**Files:**
- Create: `src/components/ReaderView.jsx`
- Create: `src/utils/text-parser.js`
- Modify: `src/App.jsx` (render ReaderView when currentBook exists)

**Step 1: Create text parser utility**

`src/utils/text-parser.js`:
```js
// Split text into sentences
export function splitSentences(text) {
  return text.match(/[^.!?]+[.!?]+\s*/g) || [text]
}

// Split sentence into words (preserving punctuation attached)
export function splitWords(sentence) {
  return sentence.match(/[\w'']+|[^\s\w]/g) || []
}

// Check if token is a word (not just punctuation)
export function isWord(token) {
  return /[a-zA-Z]/.test(token)
}
```

**Step 2: Create ReaderView**

`src/components/ReaderView.jsx`:
- Renders text as sentences, each word in a `<span>` with `data-word` and `data-sentence-index`
- Click handler via event delegation on container
- Hover effect (subtle bg color on words)
- Back button to HomeView
- Font size / line height from settings store
- Scroll position save/restore

**Step 3: Wire ReaderView into App.jsx**

Replace the "Reader coming soon..." placeholder.

**Step 4: Run dev, paste text, click "Start Reading", verify word rendering**

Click individual words — they should be individually clickable spans.

**Step 5: Commit**

```bash
git add src/components/ReaderView.jsx src/utils/text-parser.js src/App.jsx
git commit -m "feat: ReaderView with word-level text rendering"
```

---

### Task 7: WordPopup — Dictionary + Translation

**Files:**
- Create: `src/components/WordPopup.jsx`
- Modify: `src/components/ReaderView.jsx` (integrate popup)
- Create: `src/stores/vocab-store.js`

**Step 1: Create vocab store**

`src/stores/vocab-store.js`:
```js
import { create } from 'zustand'

export const useVocabStore = create((set, get) => ({
  vocab: [],

  loadVocab: async () => {
    const vocab = await window.electronAPI.storeGet('vocab') || []
    set({ vocab })
  },

  saveWord: async (entry) => {
    const vocab = get().vocab
    const exists = vocab.find(v => v.word === entry.word && v.context_sentence === entry.context_sentence)
    if (exists) return
    const newEntry = { ...entry, created_at: new Date().toISOString(), is_starred: false }
    const updated = [newEntry, ...vocab]
    set({ vocab: updated })
    await window.electronAPI.storeSet('vocab', updated)
  },

  removeWord: async (word, context_sentence) => {
    const updated = get().vocab.filter(v => !(v.word === word && v.context_sentence === context_sentence))
    set({ vocab: updated })
    await window.electronAPI.storeSet('vocab', updated)
  },

  isWordSaved: (word) => get().vocab.some(v => v.word === word.toLowerCase()),
}))
```

**Step 2: Create WordPopup**

`src/components/WordPopup.jsx`:
- Positioned below clicked word (use getBoundingClientRect)
- Auto-adjust if near screen edge
- Shows: word, POS, phonetic, Korean meaning, English definition, original sentence, Korean translation
- Save to vocab button, AI explain button
- fadeIn animation (150ms)
- Click outside to close

On mount:
1. Immediately show local dict result
2. Fetch online dict in parallel
3. Auto-call translateSentence via IPC
4. AI explain only on button click

**Step 3: Integrate popup into ReaderView**

- Track selected word state (word, position, sentence)
- On word click: set state, show WordPopup
- On click outside / another word: close / switch popup

**Step 4: Run dev, click a word, verify popup appears with dictionary data**

**Step 5: Commit**

```bash
git add src/components/WordPopup.jsx src/stores/vocab-store.js src/components/ReaderView.jsx
git commit -m "feat: WordPopup with dictionary lookup + Gemini translation"
```

---

### Task 8: VocabSidebar

**Files:**
- Create: `src/components/VocabSidebar.jsx`
- Modify: `src/App.jsx` (add sidebar toggle)

**Step 1: Create VocabSidebar**

`src/components/VocabSidebar.jsx`:
- Slide-in panel from right side
- Lists saved words with Korean meaning, context sentence
- Search filter
- Filter by book title
- Star/unstar toggle
- CSV export button
- Delete word button

**Step 2: Add sidebar toggle to App.jsx / ReaderView**

Button in ReaderView top bar to toggle sidebar.

**Step 3: Run dev, save some words, open sidebar, verify list**

**Step 4: Commit**

```bash
git add src/components/VocabSidebar.jsx src/App.jsx
git commit -m "feat: VocabSidebar with search, filter, CSV export"
```

---

### Task 9: SettingsPanel + Theme System

**Files:**
- Create: `src/components/SettingsPanel.jsx`
- Modify: `src/index.css` (add theme variables + all 3 themes)
- Modify: `src/App.jsx` (apply theme class, add settings toggle)

**Step 1: Create SettingsPanel**

`src/components/SettingsPanel.jsx`:
- Modal or slide-in panel
- Theme selector (sepia / light / dark) with color preview
- Font size slider (14-32px)
- Line height slider (1.4-2.6)
- API key input (password field, show/hide toggle)
- All changes save immediately via settings store

**Step 2: Add CSS theme variables**

```css
.theme-sepia { --bg: #f4ecd8; --text: #3d3229; --accent: #8b6914; }
.theme-light { --bg: #fafaf8; --text: #2c2c2c; --accent: #5a4a2a; }
.theme-dark  { --bg: #1a1a1e; --text: #d4d0c8; --accent: #e8b84b; }
```

Apply `theme-{name}` class to root element.

**Step 3: Wire theme into App.jsx**

Read theme from settings store, apply class to `.app` wrapper.

**Step 4: Run dev, toggle themes, adjust font size, verify visuals**

**Step 5: Commit**

```bash
git add src/components/SettingsPanel.jsx src/index.css src/App.jsx
git commit -m "feat: SettingsPanel with theme, font, API key config"
```

---

### Task 10: Polish + Build

**Files:**
- Modify: various (UI polish, edge cases)
- Create: `electron-builder.yml`

**Step 1: UI polish**

- Saved words dot indicator in ReaderView
- Loading spinners for API calls
- Empty states (no books, no vocab)
- Error handling for failed API calls
- Keyboard: Escape to close popup

**Step 2: Create electron-builder.yml**

```yaml
appId: com.visualcamp.english-reader
productName: English Reader
mac:
  category: public.app-category.education
  target: dmg
asar: true
directories:
  output: release
```

**Step 3: Build**

```bash
npm run build
npx electron-builder --mac
```

Expected: `release/` folder with .dmg file.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: UI polish + macOS build config"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffolding | package.json, vite.config.js, electron/main.js, electron/preload.js |
| 2 | electron-store + settings | electron/main.js, settings-store.js |
| 3 | Local dictionary (kengdic) | dictionary.js, en-ko-dict.json |
| 4 | Gemini API service | electron/main.js, translator.js |
| 5 | HomeView | HomeView.jsx, reading-store.js |
| 6 | ReaderView | ReaderView.jsx, text-parser.js |
| 7 | WordPopup | WordPopup.jsx, vocab-store.js |
| 8 | VocabSidebar | VocabSidebar.jsx |
| 9 | Settings + Themes | SettingsPanel.jsx, index.css |
| 10 | Polish + Build | electron-builder.yml |
