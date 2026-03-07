/**
 * build-dict.js
 *
 * Downloads the kengdic TSV (Korean-English dictionary) and converts it
 * into a JSON lookup keyed by English word.
 *
 * TSV columns (tab-separated):
 *   id | surface (Korean) | hanja | gloss (English) | level | created | source
 *
 * Output format:
 *   { "word": { "ko": "Korean meaning", "pos": "" } }
 *
 * Usage:
 *   node scripts/build-dict.js
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const TSV_URL =
  'https://raw.githubusercontent.com/garfieldnate/kengdic/master/kengdic.tsv'

const OUT_DIR = path.resolve(__dirname, '..', 'assets', 'dict')
const OUT_FILE = path.join(OUT_DIR, 'en-ko-dict.json')

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirects
        return download(res.headers.location).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function parseTSV(tsv) {
  const lines = tsv.split('\n')
  const header = lines[0].split('\t')

  // Find column indices
  const colIndex = {}
  header.forEach((col, i) => {
    colIndex[col.trim().toLowerCase()] = i
  })

  console.log('TSV columns:', header.map((h) => h.trim()))
  console.log('Column indices:', colIndex)

  const surfaceIdx = colIndex['surface'] // Korean word
  const glossIdx = colIndex['gloss'] // English meaning
  const levelIdx = colIndex['level'] // proficiency level (used as rough POS proxy)

  if (surfaceIdx === undefined || glossIdx === undefined) {
    throw new Error(
      'Could not find required columns "surface" and "gloss" in TSV header'
    )
  }

  const dict = Object.create(null) // no prototype -- avoids collisions with "constructor" etc.
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split('\t')
    const korean = (cols[surfaceIdx] || '').trim()
    const english = (cols[glossIdx] || '').trim().toLowerCase()
    const level = (cols[levelIdx] || '').trim()

    // Skip entries with no English or no Korean
    if (!english || !korean) {
      skipped++
      continue
    }

    // Skip multi-word English phrases (keep only single words and simple
    // two-word entries for broader coverage)
    // Also skip entries that look like codes or numbers only
    if (/^\d+$/.test(english)) {
      skipped++
      continue
    }

    // Normalise: remove extra whitespace in English gloss
    const normEnglish = english.replace(/\s+/g, ' ').trim()

    if (!(normEnglish in dict)) {
      // First entry for this English word -- store it
      dict[normEnglish] = { ko: korean, pos: level || '' }
    } else {
      // Duplicate English key -- append Korean meaning if different
      const existing = dict[normEnglish].ko || ''
      if (existing && !existing.includes(korean)) {
        // Cap at 3 meanings to keep the file size reasonable
        const meanings = existing.split(', ')
        if (meanings.length < 3) {
          dict[normEnglish].ko = existing + ', ' + korean
        }
      } else if (!existing) {
        dict[normEnglish].ko = korean
      }
    }
  }

  console.log(`Parsed ${lines.length - 1} lines, skipped ${skipped}`)
  return dict
}

async function main() {
  console.log('Downloading kengdic TSV...')
  const tsv = await download(TSV_URL)
  console.log(`Downloaded ${(tsv.length / 1024 / 1024).toFixed(1)} MB`)

  console.log('Parsing TSV...')
  const dict = parseTSV(tsv)

  const entryCount = Object.keys(dict).length
  console.log(`Dictionary entries: ${entryCount}`)

  // Ensure output directory exists
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Write JSON
  fs.writeFileSync(OUT_FILE, JSON.stringify(dict, null, 0), 'utf-8')

  const fileSize = fs.statSync(OUT_FILE).size
  console.log(
    `Wrote ${OUT_FILE} (${(fileSize / 1024 / 1024).toFixed(1)} MB, ${entryCount} entries)`
  )
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
