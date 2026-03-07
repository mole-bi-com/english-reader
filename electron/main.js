const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow
let store

// Gemini API call helper
async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`
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

async function initStore() {
  const { default: Store } = await import('electron-store')
  store = new Store()

  // IPC handlers
  ipcMain.handle('store-get', (_, key) => store.get(key))
  ipcMain.handle('store-set', (_, key, value) => store.set(key, value))

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
}

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

app.whenReady().then(async () => {
  await initStore()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
