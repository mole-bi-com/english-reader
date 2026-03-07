const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  translateSentence: (sentence) => ipcRenderer.invoke('translate-sentence', sentence),
  aiExplain: (word, sentence) => ipcRenderer.invoke('ai-explain', word, sentence),
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
})
